import http from 'node:http';
import { globalAuthStore, AuthStore } from './auth';
import { globalEventStore, EventStore } from './events';
import { globalEmailService, EmailDispatchService } from './email/service';
import { User, AppState } from './types';

export function createServerApp(
  authStore: AuthStore = globalAuthStore,
  eventStore: EventStore = globalEventStore,
  emailService: EmailDispatchService = globalEmailService
) {
  return async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS for local Vite development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Expected-Version');

    // Strict OWASP Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    // Helper for sending JSON
    const sendJson = (statusCode: number, data: unknown) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

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

    // Helper for reading JSON body safely (with 5MB size limit & prototype guard)
    const readJsonBody = async <T = Record<string, unknown>>(): Promise<T> => {
      return new Promise((resolve, reject) => {
        let body = '';
        let bytesCount = 0;
        const maxBytes = 5 * 1024 * 1024; // 5MB limit

        req.on('data', (chunk) => {
          bytesCount += chunk.length;
          if (bytesCount > maxBytes) {
            reject(new Error('Payload too large: JSON payload exceeds 5MB limit.'));
            req.destroy();
            return;
          }
          body += chunk;
        });

        req.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : ({} as T);
            checkPrototypePollution(parsed);
            resolve(parsed);
          } catch (err: unknown) {
            if (err instanceof Error && (err.message.includes('Prototype pollution') || err.message.includes('Maximum object depth'))) {
              reject(err);
            } else {
              reject(new Error('Malformed JSON payload.'));
            }
          }
        });

        req.on('error', (err) => reject(err));
      });
    };

    // Helper to extract authenticated user
    const getAuthUser = (): User => {
      const authHeader = req.headers['authorization'];
      const user = authStore.authenticateToken(authHeader);
      if (!user) {
        throw new Error('Authentication required.');
      }
      return user;
    };

    try {
      // ----------------------------------------------------------------------
      // Auth Endpoints
      // ----------------------------------------------------------------------
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await readJsonBody<{ name?: string; email?: string; password?: string }>();
        const result = authStore.registerUser(body.name || '', body.email || '', body.password || '');
        sendJson(201, result);
        return;
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody<{ email?: string; password?: string }>();
        const result = authStore.loginUser(body.email || '', body.password || '');
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
        if (authHeader) {
          authStore.revokeSession(authHeader);
        }
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

      // Route: /api/events/:eventId
      const eventMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)$/);
      if (eventMatch) {
        const eventId = eventMatch[1];

        if (method === 'GET') {
          const user = getAuthUser();
          const event = eventStore.getEvent(eventId, user);
          sendJson(200, event);
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
            sendJson(400, { error: 'Missing expectedVersion header or body property for optimistic concurrency control.' });
            return;
          }
          if (!body.state) {
            sendJson(400, { error: 'Missing updated state payload.' });
            return;
          }

          const updateResult = eventStore.updateEvent(eventId, user, expectedVersion, body.state);
          if ('error' in updateResult && updateResult.error === 'CONCURRENCY_CONFLICT') {
            sendJson(409, updateResult);
            return;
          }
          sendJson(200, updateResult);
          return;
        }
      }

      // Route: /api/events/:eventId/invites
      const inviteMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/invites$/);
      if (inviteMatch && method === 'POST') {
        const eventId = inviteMatch[1];
        const user = getAuthUser();
        const body = await readJsonBody<{ role?: 'editor' | 'viewer'; expiresInHours?: number }>();
        const invite = eventStore.createInvite(eventId, user, body.role || 'editor', body.expiresInHours || 48);
        sendJson(201, invite);
        return;
      }

      // Route: /api/events/:eventId/members/:userId
      const memberMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
      if (memberMatch && method === 'DELETE') {
        const eventId = memberMatch[1];
        const targetUserId = memberMatch[2];
        const user = getAuthUser();
        const updated = eventStore.removeMember(eventId, user, targetUserId);
        sendJson(200, updated);
        return;
      }

      // Route: /api/events/:eventId/stream (Server-Sent Events)
      const streamMatch = pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)\/stream$/);
      if (streamMatch && method === 'GET') {
        const eventId = streamMatch[1];
        const tokenFromQuery = url.searchParams.get('token');
        const user = authStore.authenticateToken(tokenFromQuery || (req.headers['authorization'] as string));
        if (!user) {
          sendJson(401, { error: 'Authentication required for SSE stream.' });
          return;
        }

        // Check membership
        const event = eventStore.getEvent(eventId, user);

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify({ type: 'connected', version: event.version })}\n\n`);

        const unsubscribe = eventStore.subscribe(eventId, (updatedEvent) => {
          res.write(`data: ${JSON.stringify({ type: 'sync', version: updatedEvent.version, event: updatedEvent })}\n\n`);
        });

        req.on('close', () => {
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
          idempotencyKey?: string;
        }>();

        if (!body.eventId || !body.vendorId || !body.recipientEmail || !body.subject || !body.bodyText) {
          sendJson(400, { error: 'Missing required email dispatch fields (eventId, vendorId, recipientEmail, subject, bodyText).' });
          return;
        }

        const record = await emailService.dispatchVendorEmail(
          {
            eventId: body.eventId,
            vendorId: body.vendorId,
            recipientEmail: body.recipientEmail,
            recipientName: body.recipientName || 'Vendor',
            subject: body.subject,
            bodyText: body.bodyText,
            idempotencyKey: body.idempotencyKey,
          },
          user,
          eventStore
        );

        sendJson(200, record);
        return;
      }

      if (pathname === '/api/vendors/email-audit' && method === 'GET') {
        const user = getAuthUser();
        const eventId = url.searchParams.get('eventId') || undefined;
        if (eventId) {
          eventStore.getEvent(eventId, user); // checks authorization
        }
        const logs = emailService.getAuditLog(eventId);
        sendJson(200, { logs });
        return;
      }

      // 404 Fallback
      sendJson(404, { error: 'Endpoint not found.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      const statusCode =
        message.includes('Authentication') ? 401 :
        message.includes('Forbidden') || message.includes('Unauthorized') ? 403 :
        message.includes('not found') ? 404 :
        message.includes('already exists') || message.includes('already been used') ? 409 :
        message.includes('Rate limit') ? 429 :
        message.includes('Payload too large') ? 413 :
        message.includes('Security violation') || message.includes('Invalid') || message.includes('Malformed') || message.includes('required') ? 400 : 500;

      sendJson(statusCode, { error: message });
    }
  };
}
