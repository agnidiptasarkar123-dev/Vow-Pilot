import http from 'node:http';
import {
  globalAuthStore,
  AuthStore,
  validateEnvironmentSecurity,
  buildSessionCookie,
  buildLogoutCookie,
  parseSessionFromCookie,
} from './auth';
import { globalEventStore, EventStore } from './events';
import { globalEmailService, EmailDispatchService } from './email/service';
import { User, AppState } from './types';
import {
  globalLogger,
  globalMetrics,
  resolveCorrelationId,
  StructuredLogger,
  MetricsRegistry,
} from './observability';

export function createServerApp(
  authStore: AuthStore = globalAuthStore,
  eventStore: EventStore = globalEventStore,
  emailService: EmailDispatchService = globalEmailService,
  logger: StructuredLogger = globalLogger,
  metrics: MetricsRegistry = globalMetrics
) {
  // Validate production security configuration on app initialization
  validateEnvironmentSecurity();

  // Bounded concurrency tracking for expensive asynchronous operations
  let inFlightEmailDispatches = 0;
  const MAX_CONCURRENT_EMAILS = 5;

  return async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = performance.now();
    const requestId = resolveCorrelationId(req);
    res.setHeader('X-Request-Id', requestId);

    const isProduction = process.env.NODE_ENV === 'production';
    const origin = req.headers['origin'];
    const configuredOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().toLowerCase().replace(/\/+$/, ''))
      : ['https://vowpilot.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

    let isAllowedOrigin = false;
    if (origin) {
      const cleanOrigin = origin.trim().toLowerCase().replace(/\/+$/, '');
      if (!isProduction) {
        // Development / testing: accept request origin with credentials
        isAllowedOrigin = true;
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (configuredOrigins.includes(cleanOrigin)) {
        isAllowedOrigin = true;
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else if (!isProduction) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Expected-Version, Last-Event-ID, X-Request-Id');

    // Strict Security & Defense-in-Depth Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https: ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );

    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    // Structured request completion and telemetry hooks
    let isCompleted = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const cleanupTimeout = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    res.on('finish', () => {
      isCompleted = true;
      cleanupTimeout();
      const durationMs = performance.now() - startTime;
      metrics.recordRequest(req.method || 'GET', pathname, res.statusCode, durationMs);
      logger.info(`${req.method || 'GET'} ${pathname} ${res.statusCode}`, {
        requestId,
        method: req.method,
        path: pathname,
        statusCode: res.statusCode,
        durationMs,
      });
    });

    res.on('close', () => {
      cleanupTimeout();
    });

    // Enforce 15-second bounded execution limit for standard HTTP requests (excludes continuous SSE)
    if (!pathname.endsWith('/stream')) {
      timeoutTimer = setTimeout(() => {
        if (!isCompleted && !res.headersSent) {
          logger.warn(`Request timed out after 15000ms`, {
            requestId,
            method: req.method,
            path: pathname,
          });
          res.writeHead(504, {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          });
          res.end(
            JSON.stringify({
              error: 'Gateway Timeout: Request exceeded bounded execution limit of 15000ms.',
              requestId,
            })
          );
        }
      }, 15000);
    }

    // Helper for sending JSON with correlation ID
    const sendJson = (statusCode: number, data: unknown) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      });
      res.end(JSON.stringify(data));
    };

    // CSRF Defense: Reject cross-origin state-changing browser requests if origin is untrusted
    if (origin && isProduction && !isAllowedOrigin && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method || '')) {
      sendJson(403, { error: 'Forbidden: Untrusted cross-origin request rejected.' });
      return;
    }

    // Helper to guard against prototype pollution and excessive nesting
    const checkPrototypePollution = (data: unknown, depth = 0): void => {
      if (depth > 50) {
        throw new Error('Payload too nested: Maximum object depth exceeded.');
      }
      if (!data || typeof data !== 'object') return;
      for (const key of Object.keys(data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error('Security violation: Prototype pollution attempt detected.');
        }
        checkPrototypePollution((data as Record<string, unknown>)[key], depth + 1);
      }
    };

    // Safe JSON parser with 5MB ceiling and prototype pollution verification
    const readJsonBody = async <T = Record<string, unknown>>(): Promise<T> => {
      return new Promise((resolve, reject) => {
        let body = '';
        let bytesCount = 0;
        let exceeded = false;
        const maxBytes = 5 * 1024 * 1024; // 5MB limit

        req.on('data', (chunk) => {
          if (exceeded) return;
          bytesCount += chunk.length;
          if (bytesCount > maxBytes) {
            exceeded = true;
            // Drain remainder of stream so client does not receive connection reset
            req.resume();
            reject(new Error('Payload too large: JSON payload exceeds 5MB limit.'));
            return;
          }
          body += chunk;
        });

        req.on('end', () => {
          if (exceeded) return;
          try {
            const parsed = body ? JSON.parse(body) : ({} as T);
            checkPrototypePollution(parsed);
            resolve(parsed);
          } catch (err: unknown) {
            if (
              err instanceof Error &&
              (err.message.includes('Prototype pollution') || err.message.includes('Maximum object depth'))
            ) {
              reject(err);
            } else {
              reject(new Error('Malformed JSON payload.'));
            }
          }
        });

        req.on('error', (err) => reject(err));
      });
    };

    // Helper to extract authenticated user from Bearer header or HttpOnly Cookie
    const getAuthUser = (): User => {
      const authHeader = req.headers['authorization'];
      const cookieHeader = req.headers['cookie'];
      const cookieToken = parseSessionFromCookie(cookieHeader);
      const token = authHeader || cookieToken;

      const user = authStore.authenticateToken(token || undefined);
      if (!user) {
        throw new Error('Authentication required.');
      }
      return user;
    };

    try {
      // ----------------------------------------------------------------------
      // Health, Liveness, Readiness & Operational Metrics Endpoints
      // ----------------------------------------------------------------------
      // Liveness probe: Verifies the process is responsive and event loop is not blocked
      if ((pathname === '/live' || pathname === '/api/live') && method === 'GET') {
        sendJson(200, {
          status: 'alive',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      // Readiness & health probe: Verifies actual dependency readiness (SQLite + Email)
      // Exposes /health, /ready, /api/health, and /api/ready for host orchestrators
      if (
        (pathname === '/health' ||
          pathname === '/ready' ||
          pathname === '/api/health' ||
          pathname === '/api/ready') &&
        method === 'GET'
      ) {
        const dbHealth = authStore.getDbContext().db.healthCheck();
        let emailHealth: { ok: boolean; provider: string; error?: string } = {
          ok: true,
          provider: emailService.getProvider().name,
        };
        try {
          emailHealth = await emailService.verifyProviderConnection();
        } catch (err: unknown) {
          emailHealth = {
            ok: false,
            provider: emailService.getProvider().name,
            error: err instanceof Error ? err.message : String(err),
          };
        }

        const isHealthy = dbHealth.healthy && emailHealth.ok;
        const statusCode = isHealthy ? 200 : 503;

        sendJson(statusCode, {
          status: isHealthy ? 'ready' : 'degraded',
          database: {
            healthy: dbHealth.healthy,
            journalMode: dbHealth.journalMode,
            foreignKeys: dbHealth.foreignKeysEnabled,
            migrationsCount: dbHealth.migrationsCount,
            ...(isProduction ? {} : { path: dbHealth.databasePath }),
            ...(dbHealth.error ? { error: dbHealth.error } : {}),
          },
          email: emailHealth,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      // Operational metrics endpoint for SRE monitoring and diagnostics
      if (pathname === '/api/metrics' && method === 'GET') {
        sendJson(200, {
          ...metrics.getSnapshot(),
          timestamp: new Date().toISOString(),
          requestId,
        });
        return;
      }

      // ----------------------------------------------------------------------
      // Auth Endpoints
      // ----------------------------------------------------------------------
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await readJsonBody<{ name?: string; email?: string; password?: string }>();
        const result = await authStore.registerUser(body.name || '', body.email || '', body.password || '');
        res.setHeader('Set-Cookie', buildSessionCookie(result.token, isProduction));
        sendJson(201, result);
        return;
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody<{ email?: string; password?: string }>();
        const existingCookieToken = parseSessionFromCookie(req.headers['cookie']);
        const existingAuthToken = req.headers['authorization'];
        const existingToken = (existingAuthToken as string) || existingCookieToken || undefined;

        const result = await authStore.loginUser(body.email || '', body.password || '', existingToken);
        res.setHeader('Set-Cookie', buildSessionCookie(result.token, isProduction));
        sendJson(200, result);
        return;
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = getAuthUser();
        const { passwordHash: _, ...safeUser } = user;
        sendJson(200, { user: safeUser });
        return;
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const authHeader = req.headers['authorization'];
        const cookieToken = parseSessionFromCookie(req.headers['cookie']);
        const tokenToRevoke = (authHeader as string) || cookieToken;
        if (tokenToRevoke) {
          authStore.revokeSession(tokenToRevoke);
        }
        res.setHeader('Set-Cookie', buildLogoutCookie(isProduction));
        sendJson(200, { success: true });
        return;
      }

      // ----------------------------------------------------------------------
      // Event Collaboration Endpoints
      // ----------------------------------------------------------------------
      if (pathname === '/api/events' && method === 'GET') {
        const user = getAuthUser();
        const events = eventStore.listUserEvents(user);
        sendJson(200, { events });
        return;
      }

      if (pathname === '/api/events' && method === 'POST') {
        const user = getAuthUser();
        const body = await readJsonBody<{ state?: AppState }>();
        if (!body.state) {
          sendJson(400, { error: 'Missing state payload in event creation.' });
          return;
        }
        const created = eventStore.createEvent(user, body.state);
        sendJson(201, created);
        return;
      }

      if (pathname === '/api/events/join' && method === 'POST') {
        const user = getAuthUser();
        const body = await readJsonBody<{ inviteToken?: string; token?: string }>();
        const tokenToUse = body.inviteToken || body.token;
        if (!tokenToUse) {
          sendJson(400, { error: 'Missing inviteToken parameter.' });
          return;
        }
        const event = eventStore.joinWithInvite(tokenToUse, user);
        sendJson(200, event);
        return;
      }

      if (pathname === '/api/events/decline' && method === 'POST') {
        const body = await readJsonBody<{ inviteToken?: string; token?: string }>();
        const tokenToUse = body.inviteToken || body.token;
        if (!tokenToUse) {
          sendJson(400, { error: 'Missing inviteToken parameter.' });
          return;
        }
        let user: User | undefined;
        try {
          user = getAuthUser();
        } catch {
          // Declining does not strictly require active session
        }
        const result = eventStore.declineInvite(tokenToUse, user);
        sendJson(200, result);
        return;
      }

      if (pathname === '/api/events/invitations/inspect' && method === 'POST') {
        const body = await readJsonBody<{ inviteToken?: string; token?: string }>();
        const tokenToUse = body.inviteToken || body.token;
        if (!tokenToUse) {
          sendJson(400, { error: 'Missing inviteToken parameter.' });
          return;
        }
        const preview = eventStore.inspectInvite(tokenToUse);
        sendJson(200, preview);
        return;
      }

      // Route: /api/events/:eventId/invites/revoke (POST)
      const inviteRevokeMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/invites\/revoke$/);
      if (inviteRevokeMatch && method === 'POST') {
        const eventId = inviteRevokeMatch[1];
        const user = getAuthUser();
        const body = await readJsonBody<{ token?: string; tokenHash?: string }>();
        const target = body.token || body.tokenHash;
        if (!target) {
          sendJson(400, { error: 'Missing token parameter to revoke.' });
          return;
        }
        eventStore.revokeInvite(eventId, user, target);
        sendJson(200, { success: true, message: 'Invitation token revoked successfully.' });
        return;
      }

      // Route: /api/events/:eventId/invites/:tokenHash (DELETE)
      const deleteInviteMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/invites\/([a-zA-Z0-9_-]+)$/);
      if (deleteInviteMatch && method === 'DELETE') {
        const eventId = deleteInviteMatch[1];
        const tokenHash = deleteInviteMatch[2];
        const user = getAuthUser();
        eventStore.revokeInvite(eventId, user, tokenHash);
        sendJson(200, { success: true, message: 'Invitation token revoked successfully.' });
        return;
      }

      // Route: /api/events/:eventId
      const eventMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)$/);
      if (eventMatch) {
        const eventId = eventMatch[1];

        if (method === 'GET') {
          const user = getAuthUser();
          const event = eventStore.getEvent(eventId, user);
          const userRole = eventStore.getUserRole(eventId, user.id);
          sendJson(200, { ...event, userRole });
          return;
        }

        if (method === 'PUT') {
          const user = getAuthUser();
          const body = await readJsonBody<{ expectedVersion?: number; state?: AppState }>();
          const headerVersion = req.headers['x-expected-version']
            ? parseInt(req.headers['x-expected-version'] as string, 10)
            : undefined;

          const expectedVersion = body.expectedVersion ?? headerVersion;
          if (expectedVersion === undefined || isNaN(expectedVersion)) {
            sendJson(400, {
              error: 'Missing expectedVersion header or body property for optimistic concurrency control.',
            });
            return;
          }
          if (!body.state) {
            sendJson(400, { error: 'Missing updated state payload.' });
            return;
          }

          const updateResult = eventStore.updateEvent(eventId, user, expectedVersion, body.state);
          if ('error' in updateResult) {
            sendJson(409, {
              code: 'CONCURRENCY_CONFLICT',
              error: 'CONCURRENCY_CONFLICT',
              message: updateResult.message,
              expectedVersion: updateResult.expectedVersion,
              currentVersion: updateResult.currentVersion,
              lastModifiedBy: updateResult.lastModifiedBy,
              serverState: updateResult.currentState,
              currentState: updateResult.currentState,
            });
            return;
          }
          sendJson(200, {
            success: true,
            version: updateResult.event.version,
            event: updateResult.event,
            state: updateResult.event.state,
          });
          return;
        }

        if (method === 'DELETE') {
          const user = getAuthUser();
          eventStore.deleteEvent(eventId, user);
          sendJson(200, { success: true, message: 'Event deleted successfully.' });
          return;
        }
      }

      // Route: /api/events/:eventId/invites
      const inviteMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/invites$/);
      if (inviteMatch) {
        const eventId = inviteMatch[1];
        const user = getAuthUser();

        if (method === 'GET') {
          const invites = eventStore.listEventInvites(eventId, user);
          sendJson(200, { invites });
          return;
        }

        if (method === 'POST') {
          const body = await readJsonBody<{ role?: 'owner' | 'editor' | 'viewer'; expiresInHours?: number }>();
          const invite = eventStore.createInvite(eventId, user, body.role || 'editor', body.expiresInHours || 48);
          sendJson(201, invite);
          return;
        }
      }

      // Route: /api/events/:eventId/members/:userId
      const memberMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
      if (memberMatch) {
        const eventId = memberMatch[1];
        const targetUserId = memberMatch[2];

        if (method === 'PUT' || method === 'PATCH') {
          const user = getAuthUser();
          const body = await readJsonBody<{ role?: string }>();
          if (!body.role || (body.role !== 'owner' && body.role !== 'editor' && body.role !== 'viewer')) {
            sendJson(400, { error: 'Invalid or missing role: Must be owner, editor, or viewer.' });
            return;
          }
          const updated = eventStore.updateMemberRole(eventId, user, targetUserId, body.role);
          const targetMember = updated.members.find((m) => m.userId === targetUserId);
          sendJson(200, {
            ...updated,
            success: true,
            role: targetMember?.role || body.role,
          });
          return;
        }

        if (method === 'DELETE') {
          const user = getAuthUser();
          const updated = eventStore.removeMember(eventId, user, targetUserId);
          sendJson(200, {
            ...updated,
            success: true,
            removedUserId: targetUserId,
          });
          return;
        }
      }

      // Route: /api/events/:eventId/stream (Server-Sent Events)
      const streamMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/stream$/);
      if (streamMatch && method === 'GET') {
        const eventId = streamMatch[1];
        const tokenFromQuery = url.searchParams.get('token');
        const cookieToken = parseSessionFromCookie(req.headers['cookie']);
        const token = tokenFromQuery || (req.headers['authorization'] as string) || cookieToken;

        const user = authStore.authenticateToken(token || undefined);
        if (!user) {
          sendJson(401, { error: 'Authentication required for SSE stream.' });
          return;
        }

        // Check membership & authorization
        const event = eventStore.getEvent(eventId, user);

        // Bounded concurrency for real-time SSE streams (prevents socket exhaustion)
        const currentActiveSse = metrics.incrementSseConnection();
        if (currentActiveSse > 1000) {
          metrics.decrementSseConnection();
          sendJson(503, {
            error: 'Service Unavailable: Maximum concurrent real-time connections reached.',
            requestId,
          });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
          Connection: 'keep-alive',
          'X-Request-Id': requestId,
        });

        // Parse reconnect cursor
        const lastEventIdHeader = req.headers['last-event-id'];
        const sinceVersionQuery = url.searchParams.get('sinceVersion');
        const clientCursor = lastEventIdHeader
          ? parseInt(lastEventIdHeader as string, 10)
          : sinceVersionQuery
          ? parseInt(sinceVersionQuery, 10)
          : undefined;

        res.write(`id: ${event.version}\n`);
        res.write(`data: ${JSON.stringify({ type: 'connected', version: event.version })}\n\n`);

        // If client disconnected and reconnected with a stale cursor, immediately send catch-up sync
        if (clientCursor !== undefined && !isNaN(clientCursor) && clientCursor < event.version) {
          res.write(`id: ${event.version}\n`);
          res.write(`data: ${JSON.stringify({ type: 'sync', version: event.version, event })}\n\n`);
        }

        const unsubscribe = eventStore.subscribe(eventId, (updatedEvent) => {
          try {
            res.write(`id: ${updatedEvent.version}\n`);
            res.write(`data: ${JSON.stringify({ type: 'sync', version: updatedEvent.version, event: updatedEvent })}\n\n`);
          } catch {
            // Write failed on disconnected socket
          }
        });

        // 15-second heartbeat keepalive comment to prevent proxy timeouts
        const keepAliveInterval = setInterval(() => {
          try {
            res.write(': keepalive\n\n');
          } catch {
            clearInterval(keepAliveInterval);
          }
        }, 15000);

        req.on('close', () => {
          clearInterval(keepAliveInterval);
          metrics.decrementSseConnection();
          unsubscribe();
        });
        return;
      }

      // ----------------------------------------------------------------------
      // Vendor Email Dispatch Endpoints
      // ----------------------------------------------------------------------
      if (pathname === '/api/vendors/dispatch-email' && method === 'POST') {
        const user = getAuthUser();
        const body = await readJsonBody<{
          eventId?: string;
          vendorId?: string;
          recipientEmail?: string;
          recipientName?: string;
          subject?: string;
          bodyText?: string;
          replyTo?: string;
          idempotencyKey?: string;
        }>();

        if (!body.eventId || !body.vendorId || !body.recipientEmail || !body.subject || !body.bodyText) {
          sendJson(400, {
            error: 'Missing required email dispatch fields (eventId, vendorId, recipientEmail, subject, bodyText).',
          });
          return;
        }

        // Bounded concurrency guard for expensive SMTP operations
        if (inFlightEmailDispatches >= MAX_CONCURRENT_EMAILS) {
          sendJson(429, {
            error: 'Rate limit / Concurrency limit exceeded: Server is currently processing maximum concurrent email dispatches. Please retry shortly.',
            requestId,
          });
          return;
        }

        inFlightEmailDispatches++;
        try {
          const record = await emailService.dispatchVendorEmail(
            {
              eventId: body.eventId,
              vendorId: body.vendorId,
              recipientEmail: body.recipientEmail,
              recipientName: body.recipientName || 'Vendor',
              subject: body.subject,
              bodyText: body.bodyText,
              replyTo: body.replyTo,
              idempotencyKey: body.idempotencyKey,
            },
            user,
            eventStore
          );

          const isDelivered = record.status === 'accepted_by_provider' || record.status === 'delivered';
          metrics.recordEmailDispatch(isDelivered);
          sendJson(200, record);
          return;
        } catch (dispatchErr) {
          metrics.recordEmailDispatch(false);
          throw dispatchErr;
        } finally {
          inFlightEmailDispatches--;
        }
      }

      if (pathname === '/api/vendors/email-audit' && method === 'GET') {
        const user = getAuthUser();
        const eventId = url.searchParams.get('eventId') || undefined;
        // Tenant-isolated email audit logs: enforces user authorization across all tenant records
        const logs = emailService.getAuditLog(user, eventStore, eventId);
        sendJson(200, { logs });
        return;
      }

      if (pathname === '/api/vendors/email-health' && method === 'GET') {
        const user = getAuthUser();
        const health = await emailService.verifyProviderConnection();
        sendJson(health.ok ? 200 : 503, { ...health, requestedBy: user.name });
        return;
      }

      // 404 Fallback
      sendJson(404, { error: 'Endpoint not found.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';

      const isKnownClientError =
        message.includes('Authentication') ||
        message.includes('Forbidden') ||
        message.includes('Unauthorized') ||
        message.includes('not found') ||
        message.includes('already exists') ||
        message.includes('already been used') ||
        message.includes('has expired') ||
        message.includes('has been revoked') ||
        message.includes('Rate limit') ||
        message.includes('Payload too large') ||
        message.includes('Security violation') ||
        message.includes('Invalid') ||
        message.includes('Malformed') ||
        message.includes('required');

      const statusCode =
        message.includes('Authentication') ? 401 :
        message.includes('Forbidden') || message.includes('Unauthorized') ? 403 :
        message.includes('not found') ? 404 :
        message.includes('already exists') || message.includes('already been used') ? 409 :
        message.includes('Rate limit') ? 429 :
        message.includes('Payload too large') ? 413 :
        isKnownClientError ? 400 : 500;

      // Structured error logging with correlation ID and redacted metadata
      logger.error(`Request failed: ${message}`, {
        requestId,
        method: req.method,
        path: pathname,
        statusCode,
        error: err,
      });

      // Never leak stack traces or unhandled internal error messages in production
      const responseMessage =
        statusCode === 500 && isProduction
          ? 'An unexpected internal server error occurred.'
          : message;

      sendJson(statusCode, { error: responseMessage, requestId });
    }
  };
}
