import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import {
  createServerApp,
  SlidingWindowRateLimiter,
  resolveClientIp,
} from '../../server/app';
import { EventStore } from '../../server/events';
import { AuthStore } from '../../server/auth';
import { DatabaseContext } from '../../server/db';

describe('Security: Sliding-Window Rate Limiting & Proxy IP Resolution (15 Tests)', () => {
  describe('1. resolveClientIp & Proxy Spoofing Defense', () => {
    it('ignores spoofed X-Forwarded-For when trustProxy is false (direct socket)', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 198.51.100.1',
        },
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as http.IncomingMessage;

      const ip = resolveClientIp(mockReq, false);
      expect(ip).toBe('10.0.0.5');
    });

    it('trusts X-Forwarded-For client IP when trustProxy is true', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 198.51.100.1',
        },
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as http.IncomingMessage;

      const ip = resolveClientIp(mockReq, true);
      expect(ip).toBe('203.0.113.195');
    });

    it('handles multiple commas and whitespace cleanly in X-Forwarded-For', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '  198.51.100.42  , 10.0.0.1 ',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as http.IncomingMessage;

      const ip = resolveClientIp(mockReq, true);
      expect(ip).toBe('198.51.100.42');
    });

    it('falls back to socket remoteAddress if X-Forwarded-For is empty string', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '   ',
        },
        socket: { remoteAddress: '192.168.1.100' },
      } as unknown as http.IncomingMessage;

      const ip = resolveClientIp(mockReq, true);
      expect(ip).toBe('192.168.1.100');
    });

    it('falls back to 127.0.0.1 if both X-Forwarded-For and socket remoteAddress are missing', () => {
      const mockReq = {
        headers: {},
        socket: {},
      } as unknown as http.IncomingMessage;

      const ip = resolveClientIp(mockReq, false);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('2. SlidingWindowRateLimiter Unit Invariants', () => {
    it('tracks remaining requests sequentially down to zero', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60_000);
      const key = 'test-client-1';

      for (let i = 1; i <= 5; i++) {
        const res = limiter.check(key);
        expect(res.allowed).toBe(true);
        expect(res.limit).toBe(5);
        expect(res.remaining).toBe(5 - i);
        expect(res.retryAfterSeconds).toBe(0);
      }

      // 6th request is blocked
      const blocked = limiter.check(key);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('segregates counters between different client IP keys', () => {
      const limiter = new SlidingWindowRateLimiter(2, 60_000);
      limiter.check('ip-alpha');
      limiter.check('ip-alpha');
      expect(limiter.check('ip-alpha').allowed).toBe(false);

      // ip-beta should still have full quota
      const betaRes = limiter.check('ip-beta');
      expect(betaRes.allowed).toBe(true);
      expect(betaRes.remaining).toBe(1);
    });

    it('resets state cleanly when reset() is called', () => {
      const limiter = new SlidingWindowRateLimiter(2, 60_000);
      limiter.check('ip-gamma');
      limiter.check('ip-gamma');
      expect(limiter.check('ip-gamma').allowed).toBe(false);

      limiter.reset();
      expect(limiter.check('ip-gamma').allowed).toBe(true);
    });
  });

  describe('3. HTTP Endpoint Integration & RFC Headers', () => {
    let dbContext: DatabaseContext;
    let authStore: AuthStore;
    let eventStore: EventStore;
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
      dbContext = new DatabaseContext({ filename: ':memory:' });
      authStore = new AuthStore(dbContext);
      eventStore = new EventStore(dbContext);

      const app = createServerApp(authStore, eventStore, undefined, undefined, undefined, {
        isProduction: false,
        trustProxy: true,
      });
      server = http.createServer(app);

      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          if (typeof addr === 'object' && addr) {
            baseUrl = `http://127.0.0.1:${addr.port}`;
          }
          resolve();
        });
      });
    });

    afterEach(async () => {
      (server as any)?.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      dbContext.close();
    });

    it('includes RateLimit-Limit and RateLimit-Remaining headers on inspect requests', async () => {
      const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.77',
        },
        body: JSON.stringify({ token: 'vow_rsvp_nonexistent_test' }),
      });

      expect(res.headers.get('RateLimit-Limit')).toBe('30');
      expect(res.headers.get('RateLimit-Remaining')).toBe('29');
      expect(res.headers.get('RateLimit-Reset')).toBeDefined();
    });

    it('returns HTTP 429 with Retry-After and standard RFC headers when rate limit is exceeded', async () => {
      const testIp = '198.51.100.88';

      // Exhaust 30 requests limit
      for (let i = 0; i < 30; i++) {
        await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': testIp,
          },
          body: JSON.stringify({ token: 'test_token' }),
        });
      }

      // 31st request triggers rate limiter
      const blockedRes = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp,
        },
        body: JSON.stringify({ token: 'test_token' }),
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
      expect(Number(blockedRes.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(blockedRes.headers.get('RateLimit-Limit')).toBe('30');
      expect(blockedRes.headers.get('RateLimit-Remaining')).toBe('0');

      const data = await blockedRes.json();
      expect(data.error).toContain('Rate limit exceeded');
      expect(data.retryAfter).toBeGreaterThan(0);
    });
  });
});
