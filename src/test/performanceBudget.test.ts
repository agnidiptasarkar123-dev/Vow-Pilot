import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { AuthStore } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext, DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';
import performanceBudgets from '../../performance-budget.json';

describe('VowPilot CI Performance & Regression Budget Enforcement', () => {
  const distDir = path.resolve(process.cwd(), 'dist');
  const assetsDir = path.join(distDir, 'assets');

  describe('1. Production Bundle Size Budgets', () => {
    it('verifies production build artifacts exist and conform to documented size budgets', () => {
      expect(fs.existsSync(distDir)).toBe(true);
      expect(fs.existsSync(assetsDir)).toBe(true);

      const files = fs.readdirSync(assetsDir);

      // Locate initial app chunk
      const appJsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
      expect(appJsFile).toBeDefined();
      const appJsStats = fs.statSync(path.join(assetsDir, appJsFile!));

      // Locate vendor React chunk
      const vendorJsFile = files.find((f) => f.startsWith('vendor-react-') && f.endsWith('.js'));
      expect(vendorJsFile).toBeDefined();
      const vendorJsStats = fs.statSync(path.join(assetsDir, vendorJsFile!));

      // Locate CSS chunk
      const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
      expect(cssFile).toBeDefined();
      const cssStats = fs.statSync(path.join(assetsDir, cssFile!));

      const budgets = performanceBudgets.budgets.bundleSizes;

      // Budget Assertions
      expect(appJsStats.size).toBeLessThanOrEqual(budgets.initialAppJsBytes);
      expect(vendorJsStats.size).toBeLessThanOrEqual(budgets.vendorReactJsBytes);
      expect(appJsStats.size + vendorJsStats.size).toBeLessThanOrEqual(budgets.totalInitialJsBytes);
      expect(cssStats.size).toBeLessThanOrEqual(budgets.globalCssBytes);

      // Assert on dynamic route chunks
      const routeChunkFiles = files.filter(
        (f) =>
          f.endsWith('.js') &&
          !f.startsWith('index-') &&
          !f.startsWith('vendor-react-') &&
          !f.startsWith('rolldown-runtime-')
      );

      for (const routeFile of routeChunkFiles) {
        const stats = fs.statSync(path.join(assetsDir, routeFile));
        expect(
          stats.size,
          `Route chunk ${routeFile} size (${stats.size} bytes) exceeds budget (${budgets.maxIndividualRouteChunkBytes} bytes)`
        ).toBeLessThanOrEqual(budgets.maxIndividualRouteChunkBytes);
      }
    });
  });

  describe('2. API Response Latency Budgets', () => {
    let dbContext: DatabaseContext;
    let authStore: AuthStore;
    let eventStore: EventStore;
    let emailService: EmailDispatchService;
    let app: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
    let testToken: string;
    let testEventId: string;

    const makeRequest = async (method: string, url: string, headers: Record<string, string> = {}) => {
      return new Promise<{ statusCode: number; durationMs: number }>((resolve) => {
        const { EventEmitter } = require('node:events');
        const req = new EventEmitter() as http.IncomingMessage;
        req.method = method;
        req.url = url;
        req.headers = { host: 'localhost:3000', ...headers };

        const res = new EventEmitter() as any;
        res.headersSent = false;
        res.setHeader = () => res;
        res.getHeader = () => undefined;
        res.writeHead = (status: number) => {
          res.statusCode = status;
          res.headersSent = true;
          return res;
        };
        res.write = () => true;
        res.end = () => {
          res.emit('finish');
          const t1 = performance.now();
          resolve({ statusCode: res.statusCode || 200, durationMs: t1 - t0 });
          return res;
        };

        const t0 = performance.now();
        app(req, res);
        req.emit('end');
      });
    };

    beforeAll(async () => {
      dbContext = createTestDatabaseContext();
      authStore = new AuthStore(dbContext);
      eventStore = new EventStore(dbContext);
      emailService = new EmailDispatchService(new TestEmailProvider(), dbContext);
      app = createServerApp(authStore, eventStore, emailService);

      const userRes = await authStore.registerUser('Budget Test User', 'budget@vowpilot.internal', 'Password123!');
      testToken = userRes.token;
      const event = eventStore.createEvent({ ...userRes.user, passwordHash: 'hash' }, DEMO_STATE);
      testEventId = event.id;
    });

    afterAll(() => {
      dbContext.close();
    });

    it('enforces p95 latency budget for /api/live probe', async () => {
      const samples: number[] = [];
      const iterations = 40;

      for (let i = 0; i < iterations; i++) {
        const res = await makeRequest('GET', '/api/live');
        expect(res.statusCode).toBe(200);
        samples.push(res.durationMs);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const budgetP95 = performanceBudgets.budgets.apiLatencies.liveProbeP95Ms;

      expect(p95).toBeLessThanOrEqual(budgetP95);
    });

    it('enforces p95 latency budget for /api/ready dependency check', async () => {
      const samples: number[] = [];
      const iterations = 25;

      for (let i = 0; i < iterations; i++) {
        const res = await makeRequest('GET', '/api/ready');
        expect(res.statusCode).toBe(200);
        samples.push(res.durationMs);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const budgetP95 = performanceBudgets.budgets.apiLatencies.readyProbeP95Ms;

      expect(p95).toBeLessThanOrEqual(budgetP95);
    });

    it('enforces p95 latency budget for authenticated tenant state reads', async () => {
      const samples: number[] = [];
      const iterations = 25;

      for (let i = 0; i < iterations; i++) {
        const res = await makeRequest('GET', `/api/events/${testEventId}`, {
          authorization: `Bearer ${testToken}`,
        });
        expect(res.statusCode).toBe(200);
        samples.push(res.durationMs);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const budgetP95 = performanceBudgets.budgets.apiLatencies.authenticatedReadP95Ms;

      expect(p95).toBeLessThanOrEqual(budgetP95);
    });
  });
});
