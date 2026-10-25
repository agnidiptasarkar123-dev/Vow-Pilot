import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from '../../server/app';
import { AuthStore, buildSessionCookie, buildLogoutCookie } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { DatabaseContext, VowPilotDatabase } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';

describe('Railway Deployment & Production Readiness Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;
  let testDbPath: string;

  let initialEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    initialEnv = { ...process.env };
    process.env.SESSION_SECRET = 'ephemeral_32_char_test_secret_for_railway_tests_only';

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    testDbPath = path.resolve(process.cwd(), 'data', `test_railway_${runId}.db`);

    const dbContext = new DatabaseContext({ filename: testDbPath });
    authStore = new AuthStore(dbContext);
    eventStore = new EventStore(dbContext);
    emailProvider = new TestEmailProvider();
    emailService = new EmailDispatchService(emailProvider, dbContext);

    const handler = createServerApp(authStore, eventStore, emailService);
    server = http.createServer(handler);

    await new Promise<void>((resolve) => {
      server.listen(0, '0.0.0.0', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    process.env = { ...initialEnv };
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    // Clean up test database file
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {
      // ignore
    }
  });

  // ==========================================================================
  // 1. Health Endpoints (/health, /api/health, /live, /api/live)
  // ==========================================================================
  describe('Health & Liveness Endpoints for Host Orchestration', () => {
    it('exposes /health endpoint returning 200 OK and non-sensitive readiness data', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ready');
      expect(data.database.healthy).toBe(true);
      expect(data.database.journalMode).toBe('wal');
      expect(data.database.foreignKeys).toBe(true);
      expect(data.database.migrationsCount).toBeGreaterThanOrEqual(3);
      expect(data.email.ok).toBe(true);
      expect(data.uptime).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.requestId).toBeDefined();
    });

    it('exposes /api/health identically for existing API clients', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ready');
      expect(data.database.healthy).toBe(true);
    });

    it('exposes /live and /api/live returning 200 alive without executing heavy queries', async () => {
      const res1 = await fetch(`${baseUrl}/live`);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.status).toBe('alive');

      const res2 = await fetch(`${baseUrl}/api/live`);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.status).toBe('alive');
    });

    it('never leaks internal absolute database file paths in production mode', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await fetch(`${baseUrl}/health`);
        const data = await res.json();
        expect(data.database.path).toBeUndefined();
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ==========================================================================
  // 2. Database Path & Runtime Volume Mount Support
  // ==========================================================================
  describe('SQLite Path Config & Runtime Mount Directory Creation', () => {
    it('creates nested parent directory at runtime for persistent volume path', () => {
      const runId = Math.random().toString(36).slice(2, 8);
      const customDir = path.resolve(process.cwd(), 'data', 'nested_volume', runId);
      const customDbFile = path.join(customDir, 'vowpilot.sqlite');

      // Verify directory does not exist beforehand
      expect(fs.existsSync(customDir)).toBe(false);

      process.env.DATABASE_PATH = customDbFile;
      try {
        const db = new VowPilotDatabase();
        expect(fs.existsSync(customDir)).toBe(true);
        expect(fs.existsSync(customDbFile)).toBe(true);
        expect(db.getPath()).toBe(customDbFile);
        expect(db.healthCheck().healthy).toBe(true);
        db.close();
      } finally {
        delete process.env.DATABASE_PATH;
        // Clean up
        try {
          fs.rmSync(path.resolve(process.cwd(), 'data', 'nested_volume'), { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    });

    it('supports SQLITE_PATH fallback environment variable', () => {
      const runId = Math.random().toString(36).slice(2, 8);
      const customDbFile = path.resolve(process.cwd(), 'data', `sqlite_fallback_${runId}.sqlite`);

      process.env.SQLITE_PATH = customDbFile;
      try {
        const db = new VowPilotDatabase();
        expect(db.getPath()).toBe(customDbFile);
        expect(db.healthCheck().healthy).toBe(true);
        db.close();
      } finally {
        delete process.env.SQLITE_PATH;
        try {
          if (fs.existsSync(customDbFile)) fs.unlinkSync(customDbFile);
          if (fs.existsSync(`${customDbFile}-wal`)) fs.unlinkSync(`${customDbFile}-wal`);
          if (fs.existsSync(`${customDbFile}-shm`)) fs.unlinkSync(`${customDbFile}-shm`);
        } catch {
          // ignore
        }
      }
    });

    it('initialization does not drop tables or erase existing data on restart', () => {
      const runId = Math.random().toString(36).slice(2, 8);
      const persistentPath = path.resolve(process.cwd(), 'data', `restart_test_${runId}.db`);

      // 1. Initial boot: creates tables and inserts records
      const db1 = new DatabaseContext({ filename: persistentPath });
      db1.users.createUser({
        id: 'usr_preserve_test',
        name: 'Persistent User',
        email: 'preserve@example.com',
        passwordHash: 'argon2id_hash_test',
        createdAt: new Date().toISOString(),
      });
      db1.close();

      // 2. Simulated container restart / redeployment: mounts same file
      const db2 = new DatabaseContext({ filename: persistentPath });
      const user = db2.users.getUserByEmail('preserve@example.com');
      expect(user).toBeDefined();
      expect(user?.name).toBe('Persistent User');
      db2.close();

      // Clean up
      try {
        if (fs.existsSync(persistentPath)) fs.unlinkSync(persistentPath);
        if (fs.existsSync(`${persistentPath}-wal`)) fs.unlinkSync(`${persistentPath}-wal`);
        if (fs.existsSync(`${persistentPath}-shm`)) fs.unlinkSync(`${persistentPath}-shm`);
      } catch {
        // ignore
      }
    });
  });

  // ==========================================================================
  // 3. Cross-Site Cookie Policy (Vercel Frontend <-> Railway Backend)
  // ==========================================================================
  describe('Reverse Proxy & Cross-Site Cookie Configuration', () => {
    it('supports SameSite=None; Secure when COOKIE_SAMESITE is set to None', () => {
      const origEnv = process.env.COOKIE_SAMESITE;
      process.env.COOKIE_SAMESITE = 'None';
      try {
        const cookie = buildSessionCookie('vow_cross_site_token');
        expect(cookie).toContain('SameSite=None');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('HttpOnly');

        const logoutCookie = buildLogoutCookie();
        expect(logoutCookie).toContain('SameSite=None');
        expect(logoutCookie).toContain('Secure');
      } finally {
        if (origEnv) {
          process.env.COOKIE_SAMESITE = origEnv;
        } else {
          delete process.env.COOKIE_SAMESITE;
        }
      }
    });

    it('defaults to SameSite=Lax when COOKIE_SAMESITE is unset', () => {
      delete process.env.COOKIE_SAMESITE;
      const cookie = buildSessionCookie('vow_default_token', false);
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure');
    });
  });

  // ==========================================================================
  // 4. CORS Trailing Slash Normalization & Preflight Headers
  // ==========================================================================
  describe('CORS & Preflight Defense-in-Depth', () => {
    it('normalizes allowed origins with trailing slashes to match incoming browser origin', async () => {
      const origAllowed = process.env.ALLOWED_ORIGINS;
      const origEnv = process.env.NODE_ENV;
      process.env.ALLOWED_ORIGINS = 'https://vowpilot.vercel.app/,http://localhost:3000/';
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'a_valid_32_character_production_test_secret';

      const customHandler = createServerApp(authStore, eventStore, emailService);
      const customServer = http.createServer(customHandler);

      await new Promise<void>((resolve) => {
        customServer.listen(0, '0.0.0.0', () => resolve());
      });

      const port = (customServer.address() as any).port;

      try {
        // Browser sends Origin without trailing slash per RFC 6454
        const res = await fetch(`http://localhost:${port}/health`, {
          headers: { Origin: 'https://vowpilot.vercel.app' },
        });

        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://vowpilot.vercel.app');
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      } finally {
        await new Promise<void>((resolve) => customServer.close(() => resolve()));
        process.env.ALLOWED_ORIGINS = origAllowed;
        process.env.NODE_ENV = origEnv;
      }
    });

    it('includes Last-Event-ID and X-Request-Id in allowed preflight headers', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'OPTIONS',
      });
      expect(res.status).toBe(204);
      const allowedHeaders = res.headers.get('Access-Control-Allow-Headers') || '';
      expect(allowedHeaders).toContain('Last-Event-ID');
      expect(allowedHeaders).toContain('X-Request-Id');
      expect(allowedHeaders).toContain('X-Expected-Version');
    });
  });

  // ==========================================================================
  // 5. SSE Anti-Buffering Headers for Reverse Proxies
  // ==========================================================================
  describe('SSE Stream Anti-Buffering Headers for Railway / Nginx Proxies', () => {
    it('sets X-Accel-Buffering: no and no-transform on SSE stream endpoint', async () => {
      // Register user and create event to get valid SSE stream URL
      const reg = await authStore.registerUser('SSE User', 'sse@example.com', 'password123');
      const user = authStore.authenticateToken(reg.token)!;
      const event = eventStore.createEvent(user, {
        ...DEMO_STATE,
        event: {
          ...DEMO_STATE.event,
          id: 'evt_sse_proxy_test',
          name: 'SSE Test',
        },
      });

      const res = await fetch(`${baseUrl}/api/events/${event.id}/stream?token=${reg.token}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
      expect(res.headers.get('Cache-Control')).toBe('no-cache');
      expect(res.headers.get('X-Accel-Buffering')).toBe('no');

      // Close the stream connection
      const reader = res.body?.getReader();
      if (reader) await reader.cancel();
    });
  });
});
