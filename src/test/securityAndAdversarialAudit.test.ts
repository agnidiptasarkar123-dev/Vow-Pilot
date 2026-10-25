import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';
import { createServerApp } from '../../server/app';
import {
  AuthStore,
  buildSessionCookie,
  buildLogoutCookie,
  parseSessionFromCookie,
  validateEnvironmentSecurity,
  SecurityConfigurationError,
} from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';

describe('VowPilot Comprehensive Security & Adversarial Audit Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;

  beforeEach(async () => {
    const testDb = createTestDatabaseContext();
    authStore = new AuthStore(testDb);
    eventStore = new EventStore(testDb);
    emailProvider = new TestEmailProvider();
    emailService = new EmailDispatchService(emailProvider, testDb);

    const handler = createServerApp(authStore, eventStore, emailService);
    server = http.createServer(handler);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // ==========================================================================
  // Section 1: Password Storage, Argon2id & Legacy Rehashing Migration
  // ==========================================================================
  describe('1. Password Storage & Migration', () => {
    it('hashes passwords using Argon2id with unique cryptographically random salts', async () => {
      const password = 'StrongPassword2026!';
      const hash1 = await authStore.hashPassword(password);
      const hash2 = await authStore.hashPassword(password);

      // Verify Argon2id PHC format
      expect(hash1).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(hash2).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

      // Unique salt per invocation: hashing identical passwords must produce different hash strings
      expect(hash1).not.toBe(hash2);

      // Supported verification
      const verifyResult1 = await authStore.verifyAndRehashPassword(hash1, password);
      expect(verifyResult1.isValid).toBe(true);
      expect(verifyResult1.needsRehash).toBe(false);

      const verifyWrong = await authStore.verifyAndRehashPassword(hash1, 'WrongPassword123');
      expect(verifyWrong.isValid).toBe(false);
    });

    it('transparently rehashes legacy scrypt hashes to Argon2id upon successful authentication', async () => {
      // Simulate existing legacy account in store
      const legacySalt = crypto.randomBytes(16).toString('hex');
      const legacyScryptHash = crypto.scryptSync('legacySecret123', legacySalt, 64).toString('hex');
      const legacyPasswordHash = `${legacySalt}:${legacyScryptHash}`;

      const legacyUser = {
        id: 'usr-legacy-01',
        name: 'Legacy User',
        email: 'legacy@example.com',
        passwordHash: legacyPasswordHash,
        createdAt: new Date().toISOString(),
      };
      authStore.seedUserWithRawHash(legacyUser);

      // Verify user currently has legacy scrypt hash
      const seeded = authStore.getUser('legacy@example.com');
      expect(seeded?.passwordHash).toBe(legacyPasswordHash);
      expect(seeded?.passwordHash.startsWith('$argon2id$')).toBe(false);

      // User logs in with legacy credentials
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'legacy@example.com',
          password: 'legacySecret123',
        }),
      });

      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.user.email).toBe('legacy@example.com');

      // Verify stored hash has been transparently migrated to Argon2id without user disruption
      const migratedUser = authStore.getUser('legacy@example.com');
      expect(migratedUser?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

      // Subsequent login verifies directly via Argon2id
      const subsequentLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'legacy@example.com',
          password: 'legacySecret123',
        }),
      });
      expect(subsequentLogin.status).toBe(200);
    });

    it('rejects passwords exceeding 128 characters to protect against CPU exhaustion DoS', async () => {
      const giganticPassword = 'A'.repeat(150);
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'DoS Tester',
          email: 'dos@example.com',
          password: giganticPassword,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('maximum length');
    });
  });

  // ==========================================================================
  // Section 2: Session Security, Rotation & Cookie Protections
  // ==========================================================================
  describe('2. Session Security & Lifecycle', () => {
    it('sets HttpOnly, SameSite=Lax session cookie on successful registration and login', async () => {
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Cookie User',
          email: 'cookie@example.com',
          password: 'password123',
        }),
      });

      expect(regRes.status).toBe(201);
      const setCookie = regRes.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('vowpilot_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
    });

    it('authenticates requests via HttpOnly cookie without requiring Authorization header', async () => {
      // Register
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Session User',
          email: 'session@example.com',
          password: 'password123',
        }),
      });
      const { token } = await regRes.json();

      // Access /api/auth/me using Cookie header
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Cookie: `vowpilot_session=${token}`,
        },
      });

      expect(meRes.status).toBe(200);
      const meData = await meRes.json();
      expect(meData.user.email).toBe('session@example.com');
    });

    it('rotates session token on login to prevent session fixation attacks', async () => {
      // Register initial account
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Fixation Target',
          email: 'fixation@example.com',
          password: 'password123',
        }),
      });
      const { token: initialToken } = await regRes.json();

      // Authenticate with existing session in cookie
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `vowpilot_session=${initialToken}`,
        },
        body: JSON.stringify({
          email: 'fixation@example.com',
          password: 'password123',
        }),
      });
      expect(loginRes.status).toBe(200);
      const { token: rotatedToken } = await loginRes.json();

      // Rotated token must differ from initial token
      expect(rotatedToken).not.toBe(initialToken);

      // Old pre-auth token must be invalidated
      const oldCheck = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${initialToken}` },
      });
      expect(oldCheck.status).toBe(401);

      // New token must authenticate successfully
      const newCheck = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${rotatedToken}` },
      });
      expect(newCheck.status).toBe(200);
    });

    it('invalidates cookie and revokes session on explicit logout', async () => {
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'password123',
        }),
      });
      const { token } = await regRes.json();

      // Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `vowpilot_session=${token}`,
        },
      });
      expect(logoutRes.status).toBe(200);
      const setCookie = logoutRes.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');

      // Invalidation verification
      const checkRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(checkRes.status).toBe(401);
    });

    it('formats and parses secure session cookies correctly', () => {
      const devCookie = buildSessionCookie('vow_dev_token_123', false);
      expect(devCookie).toContain('vowpilot_session=vow_dev_token_123');
      expect(devCookie).toContain('HttpOnly');
      expect(devCookie).toContain('SameSite=Lax');
      expect(devCookie).not.toContain('Secure');

      const prodCookie = buildSessionCookie('vow_prod_token_456', true);
      expect(prodCookie).toContain('Secure');

      const logoutCookie = buildLogoutCookie(true);
      expect(logoutCookie).toContain('Max-Age=0');
      expect(logoutCookie).toContain('Secure');

      const parsed = parseSessionFromCookie('theme=dark; vowpilot_session=vow_extracted_token; lang=en');
      expect(parsed).toBe('vow_extracted_token');
      expect(parseSessionFromCookie(undefined)).toBeNull();
      expect(parseSessionFromCookie('other_cookie=value')).toBeNull();
    });

    it('fails closed during production startup if required SESSION_SECRET is missing or weak', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.SESSION_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;

        expect(() => validateEnvironmentSecurity()).toThrow(SecurityConfigurationError);
        expect(() => validateEnvironmentSecurity()).toThrow(/at least 32 cryptographically random/);

        // Rejects synthetic development placeholder in production
        process.env.SESSION_SECRET = 'vowpilot_dev_synthetic_secret_change_in_production_32chars';
        expect(() => validateEnvironmentSecurity()).toThrow(/cannot use the development placeholder/);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.SESSION_SECRET = originalSecret;
      }
    });
  });

  // ==========================================================================
  // Section 3: Server-side Authorization, RBAC & Tenant Isolation (IDOR)
  // ==========================================================================
  describe('3. Server-side Authorization & Tenant Isolation', () => {
    it('blocks unauthenticated requests to protected endpoints with HTTP 401', async () => {
      const endpoints = [
        { url: `${baseUrl}/api/events`, method: 'GET' },
        { url: `${baseUrl}/api/events`, method: 'POST', body: { state: DEMO_STATE } },
        { url: `${baseUrl}/api/events/evt-123`, method: 'GET' },
        { url: `${baseUrl}/api/events/evt-123`, method: 'PUT', body: { expectedVersion: 1, state: DEMO_STATE } },
        { url: `${baseUrl}/api/events/evt-123/invites`, method: 'POST', body: { role: 'editor' } },
        { url: `${baseUrl}/api/vendors/dispatch-email`, method: 'POST', body: { eventId: 'evt-1' } },
        { url: `${baseUrl}/api/vendors/email-audit`, method: 'GET' },
      ];

      for (const ep of endpoints) {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toContain('Authentication required');
      }
    });

    it('enforces strict tenant isolation: User B cannot access or modify User A event (IDOR protection)', async () => {
      // User A (Tenant 1) creates Event A
      const userARes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User A', email: 'user_a@example.com', password: 'password123' }),
      });
      const { token: tokenA } = await userARes.json();

      const eventARes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const eventA = await eventARes.json();

      // User B (Tenant 2) registers
      const userBRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User B', email: 'user_b@example.com', password: 'password123' }),
      });
      const { token: tokenB } = await userBRes.json();

      // User B attempts to read Event A
      const readRes = await fetch(`${baseUrl}/api/events/${eventA.id}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(readRes.status).toBe(403);
      const readData = await readRes.json();
      expect(readData.error).toContain('not a member');

      // User B attempts to write to Event A
      const writeRes = await fetch(`${baseUrl}/api/events/${eventA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
          'X-Expected-Version': '1',
        },
        body: JSON.stringify({ expectedVersion: 1, state: DEMO_STATE }),
      });
      expect(writeRes.status).toBe(403);

      // User B attempts to generate an invite for Event A
      const inviteRes = await fetch(`${baseUrl}/api/events/${eventA.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      expect(inviteRes.status).toBe(403);
    });

    it('isolates vendor email audit logs strictly to authorized tenant events', async () => {
      // Owner A creates Event A and dispatches an email
      const regA = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Owner A', email: 'owner_a@example.com', password: 'password123' }),
      });
      const { token: tokenA } = await regA.json();
      const evtRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const evtA = await evtRes.json();

      await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          eventId: evtA.id,
          vendorId: DEMO_STATE.vendors[0].id,
          recipientEmail: 'confidential_vendor@example.com',
          subject: 'Confidential Inquiry for Tenant A',
          bodyText: 'Proprietary event specifications...',
        }),
      });

      // User B (unrelated tenant) queries general audit log
      const regB = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User B', email: 'user_b_unrelated@example.com', password: 'password123' }),
      });
      const { token: tokenB } = await regB.json();

      const auditRes = await fetch(`${baseUrl}/api/vendors/email-audit`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(auditRes.status).toBe(200);
      const auditData = await auditRes.json();
      // Tenant B must receive 0 logs (no cross-tenant leakage of Tenant A's vendor details)
      expect(auditData.logs.length).toBe(0);

      // Tenant A queries audit log and receives their record
      const auditResA = await fetch(`${baseUrl}/api/vendors/email-audit`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const auditDataA = await auditResA.json();
      expect(auditDataA.logs.length).toBe(1);
      expect(auditDataA.logs[0].recipientEmail).toBe('confidential_vendor@example.com');
    });

    it('enforces RBAC: prevents viewers from dispatching vendor emails or editing plans', async () => {
      // Owner creates event
      const regOwner = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Owner', email: 'owner_rbac@example.com', password: 'password123' }),
      });
      const { token: ownerToken } = await regOwner.json();
      const evtRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const event = await evtRes.json();

      // Create viewer invitation
      const invRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'viewer' }),
      });
      const invite = await invRes.json();

      // Viewer joins
      const regViewer = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Viewer User', email: 'viewer_rbac@example.com', password: 'password123' }),
      });
      const { token: viewerToken } = await regViewer.json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({ inviteToken: invite.token }),
      });

      // Viewer attempts to modify event -> 403 Forbidden
      const writeAttempt = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
          'X-Expected-Version': '1',
        },
        body: JSON.stringify({ expectedVersion: 1, state: DEMO_STATE }),
      });
      expect(writeAttempt.status).toBe(403);
      const writeData = await writeAttempt.json();
      expect(writeData.error).toContain('Viewer role does not have permission');

      // Viewer attempts to dispatch email -> 403 Forbidden
      const emailAttempt = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({
          eventId: event.id,
          vendorId: DEMO_STATE.vendors[0].id,
          recipientEmail: 'vendor@example.com',
          subject: 'Inquiry',
          bodyText: 'Text',
        }),
      });
      expect(emailAttempt.status).toBe(403);
      const emailData = await emailAttempt.json();
      expect(emailData.error).toContain('Viewers are not permitted');
    });
  });

  // ==========================================================================
  // Section 4: Invitation Security, Hashed Storage & Revocation
  // ==========================================================================
  describe('4. Invitation Security & Hashed Token Storage', () => {
    it('stores invitations keyed by SHA-256 digest rather than raw token', async () => {
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Inviter', email: 'inviter@example.com', password: 'password123' }),
      });
      const { token: authToken } = await reg.json();
      const evtRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const evt = await evtRes.json();

      const invRes = await fetch(`${baseUrl}/api/events/${evt.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const invite = await invRes.json();
      const rawToken = invite.token;

      // Verify token format (inv_ followed by 64 hex characters = 256 bits)
      expect(rawToken).toMatch(/^inv_[a-f0-9]{64}$/);

      // Verify raw token is NOT in internal Map keys (only SHA-256 digest is stored)
      const invitesMap = (eventStore as unknown as { invites: Map<string, unknown> }).invites;
      expect(invitesMap.has(rawToken)).toBe(false);

      const computedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(invitesMap.has(computedHash)).toBe(true);
    });

    it('rejects invitation reuse / replay attacks with HTTP 409 Conflict', async () => {
      const regOwner = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Owner Inv', email: 'owner_inv@example.com', password: 'password123' }),
      });
      const { token: ownerToken } = await regOwner.json();
      const evtRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const evt = await evtRes.json();

      const invRes = await fetch(`${baseUrl}/api/events/${evt.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const invite = await invRes.json();

      // First user consumes the token
      const regU1 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User 1', email: 'u1@example.com', password: 'password123' }),
      });
      const { token: token1 } = await regU1.json();
      const join1 = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
        body: JSON.stringify({ inviteToken: invite.token }),
      });
      expect(join1.status).toBe(200);

      // Second user attempts replay with same token
      const regU2 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User 2', email: 'u2@example.com', password: 'password123' }),
      });
      const { token: token2 } = await regU2.json();
      const join2 = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ inviteToken: invite.token }),
      });
      expect(join2.status).toBe(409);
      const data2 = await join2.json();
      expect(data2.error).toContain('already been used');
    });

    it('enforces invitation revocation by event owner', async () => {
      const regOwner = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Revoke Owner', email: 'revoke_owner@example.com', password: 'password123' }),
      });
      const { token: ownerToken } = await regOwner.json();
      const evtRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const evt = await evtRes.json();

      const invRes = await fetch(`${baseUrl}/api/events/${evt.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const invite = await invRes.json();

      // Owner revokes invitation
      const revokeRes = await fetch(`${baseUrl}/api/events/${evt.id}/invites/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ token: invite.token }),
      });
      expect(revokeRes.status).toBe(200);

      // Target user attempts to join with revoked invite
      const regU = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Revoked User', email: 'revoked_target@example.com', password: 'password123' }),
      });
      const { token: uToken } = await regU.json();
      const joinRes = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uToken}` },
        body: JSON.stringify({ inviteToken: invite.token }),
      });
      expect(joinRes.status).toBe(400);
      const data = await joinRes.json();
      expect(data.error).toContain('has been revoked');
    });
  });

  // ==========================================================================
  // Section 5: API Protection, Brute-Force Rate Limiting & Hostile Inputs
  // ==========================================================================
  describe('5. API Protection, Brute-Force Defense & Hostile Payloads', () => {
    it('locks account after 5 consecutive failed login attempts and returns HTTP 429', async () => {
      // Register valid account
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lockout Target',
          email: 'lockout@example.com',
          password: 'CorrectPassword123!',
        }),
      });

      // Submit 5 bad passwords
      for (let i = 0; i < 5; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'lockout@example.com',
            password: `BadPasswordAttempt_${i}`,
          }),
        });
        expect(failRes.status).toBe(400);
      }

      // 6th attempt must be rejected with HTTP 429 (Rate Limit / Lockout)
      const lockRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'lockout@example.com',
          password: 'CorrectPassword123!', // Even correct password is locked out
        }),
      });
      expect(lockRes.status).toBe(429);
      const lockData = await lockRes.json();
      expect(lockData.error).toContain('Account temporarily locked');
    });

    it('rejects oversized JSON payloads exceeding 5MB ceiling with HTTP 413', async () => {
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Size Tester', email: 'size@example.com', password: 'password123' }),
      });
      const { token } = await reg.json();

      // Construct payload slightly larger than 5MB
      const largeString = 'X'.repeat(5.5 * 1024 * 1024);
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state: { ...DEMO_STATE, notes: largeString } }),
      });

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toContain('exceeds 5MB limit');
    });

    it('rejects prototype pollution attempts via nested constructor/prototype keys', async () => {
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Proto Tester', email: 'proto@example.com', password: 'password123' }),
      });
      const { token } = await reg.json();

      const maliciousPayload = JSON.stringify({
        state: DEMO_STATE,
        constructor: { prototype: { isAdmin: true } },
      });

      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: maliciousPayload,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Prototype pollution attempt detected');
    });

    it('rejects cross-origin requests from untrusted origins in production mode (CSRF defense)', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalOrigins = process.env.ALLOWED_ORIGINS;

      try {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://vowpilot.vercel.app';

        // Attack from evil domain
        const res = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://malicious-attacker-site.com',
          },
          body: JSON.stringify({
            name: 'Evil',
            email: 'evil@example.com',
            password: 'password123',
          }),
        });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain('Untrusted cross-origin request rejected');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ALLOWED_ORIGINS = originalOrigins;
      }
    });

    it('sanitizes unexpected internal 500 error messages in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.SESSION_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.SESSION_SECRET = 'valid_production_secret_at_least_32_characters_random_test_12345';

        // Mock eventStore.listUserEvents to throw an unexpected database failure error
        const mockStore = new EventStore();
        mockStore.listUserEvents = () => {
          throw new Error('Postgres connection pool exhausted at /var/run/postgresql/.s.PGSQL.5432');
        };

        const prodHandler = createServerApp(authStore, mockStore, emailService);
        const prodServer = http.createServer(prodHandler);

        await new Promise<void>((resolve) => {
          prodServer.listen(0, async () => {
            const addr = prodServer.address();
            const prodUrl = typeof addr === 'object' && addr ? `http://localhost:${addr.port}` : '';

            // Register user
            const reg = await fetch(`${prodUrl}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Prod User', email: 'prod@example.com', password: 'password123' }),
            });
            const { token } = await reg.json();

            // Call /api/events which triggers the mocked internal failure
            const res = await fetch(`${prodUrl}/api/events`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            // Verify internal stack/path information is sanitized
            expect(data.error).not.toContain('/var/run/postgresql');
            expect(data.error).toBe('An unexpected internal server error occurred.');

            prodServer.close(() => resolve());
          });
        });
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.SESSION_SECRET = originalSecret;
      }
    });
  });
});
