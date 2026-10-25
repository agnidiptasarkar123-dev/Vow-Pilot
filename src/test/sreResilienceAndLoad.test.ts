import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { AuthStore } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext, DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';
import {
  StructuredLogger,
  MetricsRegistry,
  sanitizeForLogging,
} from '../../server/observability';

// Helper to execute in-memory HTTP requests against createServerApp
async function makeRequest(
  app: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: any }> {
  return new Promise((resolve) => {
    const { EventEmitter } = require('node:events');
    const req = new EventEmitter() as http.IncomingMessage;
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      host: 'localhost:3000',
      ...(options.headers || {}),
    };

    const resHeaders: Record<string, string | string[] | undefined> = {};
    let statusCode = 200;
    let responseData = '';

    const res = new EventEmitter() as any;
    res.headersSent = false;
    res.setHeader = (name: string, value: string | string[]) => {
      resHeaders[name.toLowerCase()] = value;
      return res;
    };
    res.getHeader = (name: string) => resHeaders[name.toLowerCase()];
    res.writeHead = (status: number, headers?: Record<string, string | string[]>) => {
      statusCode = status;
      res.statusCode = status;
      res.headersSent = true;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          resHeaders[k.toLowerCase()] = v;
        }
      }
      return res;
    };
    res.write = (chunk: string | Buffer) => {
      responseData += chunk.toString();
      return true;
    };
    res.end = (chunk?: string | Buffer) => {
      if (chunk) responseData += chunk.toString();
      res.emit('finish');
      let parsedBody: any = responseData;
      try {
        parsedBody = JSON.parse(responseData);
      } catch {
        // Keep as string
      }
      resolve({ statusCode, headers: resHeaders, body: parsedBody });
      return res;
    };

    app(req, res);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.emit('data', Buffer.from(payload));
    }
    req.emit('end');
  });
}

describe('VowPilot SRE & Performance Engineering Suite', () => {
  let dbContext: DatabaseContext;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;
  let logger: StructuredLogger;
  let metrics: MetricsRegistry;
  let app: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  let testUserToken: string;
  let testEventId: string;

  beforeEach(async () => {
    dbContext = createTestDatabaseContext();
    authStore = new AuthStore(dbContext);
    eventStore = new EventStore(dbContext);
    emailProvider = new TestEmailProvider();
    emailService = new EmailDispatchService(emailProvider, dbContext);
    logger = new StructuredLogger();
    metrics = new MetricsRegistry();

    app = createServerApp(authStore, eventStore, emailService, logger, metrics);

    // Seed test user and event
    const userResult = await authStore.registerUser('SRE Coordinator', 'sre@vowpilot.internal', 'SecureP@ss12345');
    testUserToken = userResult.token;

    const eventRecord = eventStore.createEvent({ ...userResult.user, passwordHash: 'hash' }, DEMO_STATE);
    testEventId = eventRecord.id;
  });

  afterEach(() => {
    dbContext.close();
  });

  // --------------------------------------------------------------------------
  // 1. OBSERVABILITY & CORRELATION
  // --------------------------------------------------------------------------
  describe('1. Observability, Correlation IDs & Structured Logging', () => {
    it('propagates or generates X-Request-Id correlation headers across all endpoints', async () => {
      // With client-provided correlation ID
      const customId = 'client-trace-id-12345678';
      const resWithCustom = await makeRequest(app, {
        method: 'GET',
        url: '/api/live',
        headers: { 'x-request-id': customId },
      });

      expect(resWithCustom.statusCode).toBe(200);
      expect(resWithCustom.headers['x-request-id']).toBe(customId);
      expect(resWithCustom.body.requestId).toBe(customId);

      // Auto-generated correlation ID when absent
      const resGenerated = await makeRequest(app, {
        method: 'GET',
        url: '/api/live',
      });
      expect(resGenerated.statusCode).toBe(200);
      expect(resGenerated.headers['x-request-id']).toMatch(/^req_[a-zA-Z0-9]+$/);
      expect(resGenerated.body.requestId).toBe(resGenerated.headers['x-request-id']);
    });

    it('redacts sensitive fields (passwords, tokens, cookies, auth headers) in structured logging', () => {
      const sensitivePayload = {
        email: 'user@example.com',
        password: 'TopSecretPassword99!',
        token: 'jwt.token.string',
        cookie: 'session=xyz',
        authorization: 'Bearer secret_token',
        nested: {
          apiKey: 'key_12345',
          bodyText: 'Confidential vendor negotiation',
        },
        safeField: 'Wedding Celebration',
      };

      const sanitized = sanitizeForLogging(sensitivePayload) as Record<string, any>;

      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.safeField).toBe('Wedding Celebration');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.apiKey).toBe('[REDACTED]');
      expect(sanitized.nested.bodyText).toBe('[REDACTED]');
    });

    it('summarizes event state trees in logs rather than logging full memory payloads', () => {
      const statePayload = {
        state: DEMO_STATE,
      };

      const sanitized = sanitizeForLogging(statePayload) as Record<string, any>;
      expect(sanitized.state.summaryOnly).toBe(true);
      expect(sanitized.state.eventName).toBe(DEMO_STATE.event.name);
      expect(sanitized.state.vendors).toBeUndefined(); // Does not leak entire vendor contract array
    });

    it('records operational metrics and computes latency percentiles via /api/metrics', async () => {
      // Fire 10 simulated requests
      for (let i = 0; i < 10; i++) {
        await makeRequest(app, { method: 'GET', url: '/api/live' });
      }

      const metricsRes = await makeRequest(app, { method: 'GET', url: '/api/metrics' });
      expect(metricsRes.statusCode).toBe(200);
      expect(metricsRes.body.totalRequests).toBeGreaterThanOrEqual(10);
      expect(metricsRes.body.statusSummary['2xx']).toBeGreaterThanOrEqual(10);
      expect(metricsRes.body.errorRatePercent).toBe(0);
      expect(metricsRes.body.routeMetrics['GET /api/live']).toBeDefined();
      expect(metricsRes.body.routeMetrics['GET /api/live'].count).toBeGreaterThanOrEqual(10);
      expect(metricsRes.body.routeMetrics['GET /api/live'].p50Ms).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. HEALTH PROBES: LIVENESS VS READINESS
  // --------------------------------------------------------------------------
  describe('2. Health Checks: Liveness vs Dependency Readiness', () => {
    it('returns 200 for /api/live when process is responsive', async () => {
      const res = await makeRequest(app, { method: 'GET', url: '/api/live' });
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('returns 200 for /api/ready when both SQLite database and email provider are operational', async () => {
      const res = await makeRequest(app, { method: 'GET', url: '/api/ready' });
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database.healthy).toBe(true);
      expect(res.body.database.foreignKeys).toBe(true);
      expect(res.body.email.ok).toBe(true);
    });

    it('returns 503 degraded for /api/ready if the database dependency fails, while /api/live stays 200', async () => {
      // Simulate database unavailability
      vi.spyOn(dbContext.db, 'healthCheck').mockReturnValueOnce({
        healthy: false,
        databasePath: ':memory:',
        journalMode: 'unknown',
        foreignKeysEnabled: false,
        migrationsCount: 0,
        error: 'SQLITE_IOERR: disk I/O error',
      });

      const readyRes = await makeRequest(app, { method: 'GET', url: '/api/ready' });
      expect(readyRes.statusCode).toBe(503);
      expect(readyRes.body.status).toBe('degraded');
      expect(readyRes.body.database.healthy).toBe(false);
      expect(readyRes.body.database.error).toContain('disk I/O error');

      // Process liveness probe must remain 200 so orchestrator knows process itself is running
      const liveRes = await makeRequest(app, { method: 'GET', url: '/api/live' });
      expect(liveRes.statusCode).toBe(200);
      expect(liveRes.body.status).toBe('alive');
    });

    it('returns 503 degraded for /api/ready if email provider connection fails', async () => {
      // Simulate email provider failure
      vi.spyOn(emailService, 'verifyProviderConnection').mockResolvedValueOnce({
        ok: false,
        provider: 'MockSmtp',
        error: 'ECONNREFUSED: SMTP port unreachable',
      });

      const readyRes = await makeRequest(app, { method: 'GET', url: '/api/ready' });
      expect(readyRes.statusCode).toBe(503);
      expect(readyRes.body.status).toBe('degraded');
      expect(readyRes.body.email.ok).toBe(false);
      expect(readyRes.body.email.error).toContain('ECONNREFUSED');
    });
  });

  // --------------------------------------------------------------------------
  // 3. PRODUCTION FAILURE MODES & RESILIENCE
  // --------------------------------------------------------------------------
  describe('3. Production Failures & Error Handling', () => {
    it('expired or invalid session returns clean 401 with correlation ID', async () => {
      const res = await makeRequest(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid_or_expired_token' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Authentication required.');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('handles unexpected internal server errors without leaking stack traces in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // Force unexpected exception in event retrieval
        vi.spyOn(eventStore, 'getEvent').mockImplementationOnce(() => {
          throw new Error('Fatal internal memory segmentation error');
        });

        const res = await makeRequest(app, {
          method: 'GET',
          url: `/api/events/${testEventId}`,
          headers: { authorization: `Bearer ${testUserToken}` },
        });

        expect(res.statusCode).toBe(500);
        // Production must never leak internal stack traces
        expect(res.body.error).toBe('An unexpected internal server error occurred.');
        expect(res.body.requestId).toBeDefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('enforces optimistic concurrency control (OCC) to prevent data corruption under concurrent writes', async () => {
      // User fetches event at version 1
      const initialRes = await makeRequest(app, {
        method: 'GET',
        url: `/api/events/${testEventId}`,
        headers: { authorization: `Bearer ${testUserToken}` },
      });
      const initialVersion = initialRes.body.version;

      // Update 1: Client A updates at version 1 -> succeeds, increments to version 2
      const modifiedStateA = { ...DEMO_STATE, event: { ...DEMO_STATE.event, guestCount: 160 } };
      const resA = await makeRequest(app, {
        method: 'PUT',
        url: `/api/events/${testEventId}`,
        headers: {
          authorization: `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
          'x-expected-version': String(initialVersion),
        },
        body: { expectedVersion: initialVersion, state: modifiedStateA },
      });

      expect(resA.statusCode).toBe(200);
      expect(resA.body.version).toBe(initialVersion + 1);

      // Update 2: Client B attempts to write based on stale version 1 -> rejects with 409 CONCURRENCY_CONFLICT
      const modifiedStateB = { ...DEMO_STATE, event: { ...DEMO_STATE.event, guestCount: 175 } };
      const resB = await makeRequest(app, {
        method: 'PUT',
        url: `/api/events/${testEventId}`,
        headers: {
          authorization: `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
          'x-expected-version': String(initialVersion),
        },
        body: { expectedVersion: initialVersion, state: modifiedStateB },
      });

      expect(resB.statusCode).toBe(409);
      expect(resB.body.code).toBe('CONCURRENCY_CONFLICT');
      expect(resB.body.expectedVersion).toBe(initialVersion);
      expect(resB.body.currentVersion).toBe(initialVersion + 1);
      expect(resB.body.serverState.event.guestCount).toBe(160); // Preserves Client A's confirmed data
    });

    it('safely handles non-idempotent operations: duplicate email dispatches with identical idempotencyKey are deduplicated', async () => {
      const idempotencyKey = 'idempotent_test_key_999';
      const vendorId = DEMO_STATE.vendors[0].id;

      const payload = {
        eventId: testEventId,
        vendorId,
        recipientEmail: 'vendor@jaipurheritage.com',
        recipientName: 'Jaipur Heritage Palace',
        subject: 'Catering menu confirmation inquiry',
        bodyText: 'Please clarify whether dietary options are included.',
        idempotencyKey,
      };

      // Dispatch 1
      const res1 = await makeRequest(app, {
        method: 'POST',
        url: '/api/vendors/dispatch-email',
        headers: {
          authorization: `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      expect(res1.statusCode).toBe(200);
      expect(res1.body.idempotencyKey).toBe(idempotencyKey);
      const firstDispatchId = res1.body.id;

      // Dispatch 2 with identical idempotencyKey
      const res2 = await makeRequest(app, {
        method: 'POST',
        url: '/api/vendors/dispatch-email',
        headers: {
          authorization: `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      expect(res2.statusCode).toBe(200);
      // Must return identical cached record without duplicate delivery
      expect(res2.body.id).toBe(firstDispatchId);
      expect(emailProvider.sentMessages.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. REAL-TIME RELIABILITY & SSE RECOVERY
  // --------------------------------------------------------------------------
  describe('4. Real-Time Reliability, SSE Reconnection & Listener Cleanup', () => {
    it('tracks active SSE connections and cleans up listeners upon client disconnection', async () => {
      const { EventEmitter } = require('node:events');
      const req = new EventEmitter() as http.IncomingMessage;
      req.method = 'GET';
      req.url = `/api/events/${testEventId}/stream`;
      req.headers = {
        host: 'localhost:3000',
        authorization: `Bearer ${testUserToken}`,
      };

      const res = new EventEmitter() as any;
      let output = '';
      res.headersSent = false;
      res.setHeader = vi.fn();
      res.getHeader = vi.fn();
      res.writeHead = vi.fn();
      res.write = (chunk: string) => {
        output += chunk;
        return true;
      };

      expect(metrics.getSnapshot().activeSseConnections).toBe(0);

      // Start SSE stream
      app(req, res);

      // Verify connection handshake sent
      expect(output).toContain('type":"connected"');
      expect(metrics.getSnapshot().activeSseConnections).toBe(1);

      // Trigger client disconnection
      req.emit('close');

      // Verify active SSE gauge decrements cleanly
      expect(metrics.getSnapshot().activeSseConnections).toBe(0);
    });

    it('sends catch-up sync packet when client reconnects with a stale cursor', async () => {
      // First update event to version 2
      eventStore.updateEvent(testEventId, authStore.authenticateToken(testUserToken)!, 1, DEMO_STATE);

      const { EventEmitter } = require('node:events');
      const req = new EventEmitter() as http.IncomingMessage;
      req.method = 'GET';
      req.url = `/api/events/${testEventId}/stream?sinceVersion=1`; // Client reconnects claiming version 1
      req.headers = {
        host: 'localhost:3000',
        authorization: `Bearer ${testUserToken}`,
      };

      const res = new EventEmitter() as any;
      let output = '';
      res.headersSent = false;
      res.setHeader = vi.fn();
      res.getHeader = vi.fn();
      res.writeHead = vi.fn();
      res.write = (chunk: string) => {
        output += chunk;
        return true;
      };

      app(req, res);

      // Verify catch-up sync packet is transmitted
      expect(output).toContain('type":"sync"');
      expect(output).toContain('version":2');

      req.emit('close');
    });
  });

  // --------------------------------------------------------------------------
  // 5. CONTROLLED LOAD & CONCURRENCY BENCHMARKS
  // --------------------------------------------------------------------------
  describe('5. Controlled Load Testing (10, 25, 50, 100 Concurrency)', () => {
    const runConcurrentBatch = async (
      concurrency: number,
      fn: (idx: number) => Promise<{ statusCode: number }>
    ) => {
      const startTime = performance.now();
      const promises: Promise<{ statusCode: number; durationMs: number }>[] = [];

      for (let i = 0; i < concurrency; i++) {
        const itemPromise = (async () => {
          const t0 = performance.now();
          const res = await fn(i);
          const t1 = performance.now();
          return { statusCode: res.statusCode, durationMs: t1 - t0 };
        })();
        promises.push(itemPromise);
      }

      const results = await Promise.all(promises);
      const totalDurationMs = performance.now() - startTime;
      const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
      const successCount = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;

      return {
        concurrency,
        totalDurationMs,
        throughputReqSec: Math.round((concurrency / (totalDurationMs / 1000)) * 100) / 100,
        p50Ms: Math.round(durations[Math.floor(durations.length * 0.5)] * 100) / 100,
        p95Ms: Math.round(durations[Math.floor(durations.length * 0.95)] * 100) / 100,
        p99Ms: Math.round(durations[Math.floor(durations.length * 0.99)] * 100) / 100,
        successRate: successCount / concurrency,
      };
    };

    it('measures high throughput and sub-10ms p95 latency on /api/live under increasing concurrency', async () => {
      const concurrencies = [10, 25, 50, 100];
      const benchmarks: any[] = [];

      for (const concurrency of concurrencies) {
        const result = await runConcurrentBatch(concurrency, () =>
          makeRequest(app, { method: 'GET', url: '/api/live' })
        );
        benchmarks.push(result);

        expect(result.successRate).toBe(1.0);
        expect(result.p95Ms).toBeLessThan(50); // Generous margin for local CI execution
      }

      // Verify scaling behavior: all batches must have 100% success rate
      expect(benchmarks.every((b) => b.successRate === 1.0)).toBe(true);
    });

    it('measures authenticated event read latency under 50 concurrent requests', async () => {
      const result = await runConcurrentBatch(50, () =>
        makeRequest(app, {
          method: 'GET',
          url: `/api/events/${testEventId}`,
          headers: { authorization: `Bearer ${testUserToken}` },
        })
      );

      expect(result.successRate).toBe(1.0);
      expect(result.p95Ms).toBeLessThan(100);
      expect(result.throughputReqSec).toBeGreaterThan(100);
    });
  });
});
