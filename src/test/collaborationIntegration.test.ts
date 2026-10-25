import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { AuthStore } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider, SmtpEmailProvider } from '../../server/email/providers';
import { DEMO_STATE } from '../persistence/demoData';

describe('VowPilot Multi-User Collaboration & Email Delivery Integration Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;

  beforeEach(async () => {
    authStore = new AuthStore();
    eventStore = new EventStore();
    emailProvider = new TestEmailProvider();
    emailService = new EmailDispatchService(emailProvider);

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
  // Suite 1: Authentication & Session Lifecycle
  // ==========================================================================
  describe('Authentication & Session Management', () => {
    it('registers a new user and generates a cryptographically secure session token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Meera Sharma',
          email: 'meera@example.com',
          password: 'securePassword123',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.name).toBe('Meera Sharma');
      expect(data.user.email).toBe('meera@example.com');
      expect(data.token).toMatch(/^vow_[a-f0-9]{48}$/);
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('rejects registration with duplicate email or short password', async () => {
      // First registration
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User 1', email: 'dup@example.com', password: 'password123' }),
      });

      // Duplicate attempt
      const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User 2', email: 'dup@example.com', password: 'password123' }),
      });
      expect(dupRes.status).toBe(409);
      const dupData = await dupRes.json();
      expect(dupData.error).toContain('already exists');

      // Short password attempt
      const shortRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User 3', email: 'short@example.com', password: '123' }),
      });
      expect(shortRes.status).toBe(400);
    });

    it('authenticates login credentials and verifies /api/auth/me', async () => {
      // Register
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Aarav Mehta', email: 'aarav@example.com', password: 'password123' }),
      });

      // Login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aarav@example.com', password: 'password123' }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.token).toBeDefined();

      // Verify session via /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      expect(meRes.status).toBe(200);
      const meData = await meRes.json();
      expect(meData.user.name).toBe('Aarav Mehta');
    });

    it('rejects access when token is revoked via logout', async () => {
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User', email: 'logout@example.com', password: 'password123' }),
      });
      const { token } = await reg.json();

      // Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutRes.status).toBe(200);

      // Verify token no longer works
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(meRes.status).toBe(401);
    });
  });

  // ==========================================================================
  // Suite 2: Multi-User Collaboration & Tenant Isolation
  // ==========================================================================
  describe('Multi-User Collaboration & Tenant Isolation', () => {
    let ownerToken: string;
    let collaboratorToken: string;
    let strangerToken: string;
    let eventId: string;

    beforeEach(async () => {
      // Create Owner
      const r1 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Owner', email: 'owner@example.com', password: 'password123' }),
      });
      ownerToken = (await r1.json()).token;

      // Create Collaborator
      const r2 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Collab', email: 'collab@example.com', password: 'password123' }),
      });
      collaboratorToken = (await r2.json()).token;

      // Create Stranger
      const r3 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Stranger', email: 'stranger@example.com', password: 'password123' }),
      });
      strangerToken = (await r3.json()).token;

      // Owner creates event
      const eventRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      const eventData = await eventRes.json();
      eventId = eventData.id;
    });

    it('enforces tenant isolation: uninvited user cannot read or write to event', async () => {
      // Stranger tries to read event
      const readRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect(readRes.status).toBe(403);
      const readData = await readRes.json();
      expect(readData.error).toContain('Unauthorized');

      // Stranger tries to update event
      const writeRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strangerToken}`,
          'X-Expected-Version': '1',
        },
        body: JSON.stringify({ expectedVersion: 1, state: DEMO_STATE }),
      });
      expect(writeRes.status).toBe(403);
    });

    it('allows collaborator to join via secure invite token and sync shared state', async () => {
      // Owner creates invite
      const inviteRes = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ role: 'editor', expiresInHours: 24 }),
      });
      expect(inviteRes.status).toBe(201);
      const { token: inviteToken } = await inviteRes.json();

      // Collaborator joins
      const joinRes = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collaboratorToken}`,
        },
        body: JSON.stringify({ inviteToken }),
      });
      expect(joinRes.status).toBe(200);

      // Collaborator can now read event
      const readRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${collaboratorToken}` },
      });
      expect(readRes.status).toBe(200);
      const readData = await readRes.json();
      expect(readData.members.length).toBe(2);
      expect(readData.members.some((m: { userName: string }) => m.userName === 'Collab')).toBe(true);
    });

    it('rejects reused single-use invite tokens', async () => {
      // Owner creates invite
      const inviteRes = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ role: 'editor' }),
      });
      const { token: inviteToken } = await inviteRes.json();

      // Collaborator joins
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collaboratorToken}`,
        },
        body: JSON.stringify({ inviteToken }),
      });

      // Stranger tries to use the same token
      const secondJoin = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strangerToken}`,
        },
        body: JSON.stringify({ inviteToken }),
      });
      expect(secondJoin.status).toBe(409);
      const data = await secondJoin.json();
      expect(data.error).toContain('already been used');
    });

    it('enforces access revocation when owner removes a member', async () => {
      // Collaborator joins
      const inv = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const { token: inviteToken } = await inv.json();

      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collaboratorToken}` },
        body: JSON.stringify({ inviteToken }),
      });

      // Get collaborator user ID
      const me = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${collaboratorToken}` },
      });
      const { user: collabUser } = await me.json();

      // Owner revokes member access
      const delRes = await fetch(`${baseUrl}/api/events/${eventId}/members/${collabUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(delRes.status).toBe(200);

      // Collaborator's subsequent read attempt is rejected with 403 Forbidden
      const revokedRead = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${collaboratorToken}` },
      });
      expect(revokedRead.status).toBe(403);
    });
  });

  // ==========================================================================
  // Suite 3: Optimistic Concurrency Control (OCC) & Conflict Resolution
  // ==========================================================================
  describe('Optimistic Concurrency Control (OCC)', () => {
    let ownerToken: string;
    let collabToken: string;
    let eventId: string;

    beforeEach(async () => {
      const r1 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Owner', email: 'occ_owner@example.com', password: 'password123' }),
      });
      ownerToken = (await r1.json()).token;

      const r2 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Collab', email: 'occ_collab@example.com', password: 'password123' }),
      });
      collabToken = (await r2.json()).token;

      const eventRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      eventId = (await eventRes.json()).id;

      // Join collab
      const inv = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const { token } = await inv.json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collabToken}` },
        body: JSON.stringify({ inviteToken: token }),
      });
    });

    it('advances version atomically on sequential valid writes', async () => {
      const update1 = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Expected-Version': '1',
        },
        body: JSON.stringify({
          expectedVersion: 1,
          state: {
            ...DEMO_STATE,
            event: { ...DEMO_STATE.event, guestCount: 160 },
          },
        }),
      });

      expect(update1.status).toBe(200);
      const data1 = await update1.json();
      expect(data1.event.version).toBe(2);
      expect(data1.event.state.event.guestCount).toBe(160);

      // Collaborator updates from version 2 to 3
      const update2 = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collabToken}`,
          'X-Expected-Version': '2',
        },
        body: JSON.stringify({
          expectedVersion: 2,
          state: {
            ...DEMO_STATE,
            event: { ...DEMO_STATE.event, guestCount: 175 },
          },
        }),
      });

      expect(update2.status).toBe(200);
      const data2 = await update2.json();
      expect(data2.event.version).toBe(3);
      expect(data2.event.state.event.guestCount).toBe(175);
    });

    it('detects concurrent edits and returns 409 CONCURRENCY_CONFLICT without silent overwrite', async () => {
      // Client 1 writes version 1 -> 2
      await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          expectedVersion: 1,
          state: { ...DEMO_STATE, event: { ...DEMO_STATE.event, guestCount: 165 } },
        }),
      });

      // Client 2 attempts to write based on stale version 1
      const conflictRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collabToken}`,
        },
        body: JSON.stringify({
          expectedVersion: 1, // Stale!
          state: { ...DEMO_STATE, event: { ...DEMO_STATE.event, guestCount: 190 } },
        }),
      });

      expect(conflictRes.status).toBe(409);
      const conflictData = await conflictRes.json();
      expect(conflictData.error).toBe('CONCURRENCY_CONFLICT');
      expect(conflictData.currentVersion).toBe(2);
      expect(conflictData.expectedVersion).toBe(1);
      expect(conflictData.lastModifiedBy).toBe('Owner');
      expect(conflictData.currentState.event.guestCount).toBe(165); // Preserved!
    });

    it('enforces viewer read-only role: rejects write attempts with 403 Forbidden', async () => {
      // Invite Viewer
      const inv = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ role: 'viewer' }),
      });
      const { token } = await inv.json();

      // Register Viewer
      const vReg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Guest Viewer', email: 'viewer@example.com', password: 'password123' }),
      });
      const { token: viewerToken } = await vReg.json();

      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({ inviteToken: token }),
      });

      // Viewer attempts to update
      const viewerWrite = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({ expectedVersion: 1, state: DEMO_STATE }),
      });

      expect(viewerWrite.status).toBe(403);
      const data = await viewerWrite.json();
      expect(data.error).toContain('Viewer role does not have permission');
    });
  });

  // ==========================================================================
  // Suite 4: Secure Vendor Email Delivery System
  // ==========================================================================
  describe('Secure Vendor Email Delivery & Header Injection Defenses', () => {
    let token: string;
    let eventId: string;
    const vendorId = DEMO_STATE.vendors[0].id; // ven-001

    beforeEach(async () => {
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Coordinator', email: 'coord@example.com', password: 'password123' }),
      });
      token = (await reg.json()).token;

      const eventRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state: DEMO_STATE }),
      });
      eventId = (await eventRes.json()).id;
    });

    it('dispatches valid vendor clarification email and logs audit record', async () => {
      const res = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId,
          vendorId,
          recipientEmail: 'sales@jaipurpalace.in',
          recipientName: 'Jaipur Palace Reservations',
          subject: 'Clarification regarding courtyard lighting power backup',
          bodyText: 'Could you please confirm if generator fuel charges are included in the quote?',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('accepted_by_provider');
      expect(data.providerMessageId).toMatch(/^msg_test_/);
      expect(data.dispatchedBy).toBe('Coordinator');

      // Verify audit log
      const auditRes = await fetch(`${baseUrl}/api/vendors/email-audit?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(auditRes.status).toBe(200);
      const auditData = await auditRes.json();
      expect(auditData.logs.length).toBe(1);
      expect(auditData.logs[0].recipientEmail).toBe('sales@jaipurpalace.in');
    });

    it('rejects CRLF header injection attempts in recipient email and subject', async () => {
      // CRLF in recipient
      const crlfEmailRes = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId,
          vendorId,
          recipientEmail: 'victim@example.com\r\nBcc: attacker@spam.com',
          subject: 'Valid Subject',
          bodyText: 'Valid Body',
        }),
      });
      expect(crlfEmailRes.status).toBe(400);
      const err1 = await crlfEmailRes.json();
      expect(err1.error).toContain('Header injection detected');

      // CRLF in subject
      const crlfSubRes = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId,
          vendorId,
          recipientEmail: 'vendor@example.com',
          subject: 'Inquiry\r\nCc: spy@shadow.com',
          bodyText: 'Valid Body',
        }),
      });
      expect(crlfSubRes.status).toBe(400);
      const err2 = await crlfSubRes.json();
      expect(err2.error).toContain('Header injection detected');
    });

    it('deduplicates requests sharing the same idempotencyKey', async () => {
      const idempotencyKey = 'key_unique_12345';
      const payload = {
        eventId,
        vendorId,
        recipientEmail: 'idemp@vendor.com',
        subject: 'Inquiry regarding payment schedule',
        bodyText: 'What are the milestone dates?',
        idempotencyKey,
      };

      // Send Request 1
      const res1 = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data1 = await res1.json();

      // Send Request 2 with identical key
      const res2 = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data2 = await res2.json();

      // Should return identical message ID without re-dispatching to provider
      expect(data1.providerMessageId).toBe(data2.providerMessageId);
      expect(emailProvider.sentMessages.length).toBe(1);
    });

    it('enforces rate limits on excessive email dispatch', async () => {
      // Dispatch 10 emails (max allowed)
      for (let i = 0; i < 10; i++) {
        await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            eventId,
            vendorId,
            recipientEmail: `vendor${i}@example.com`,
            subject: `Inquiry #${i}`,
            bodyText: `Body text #${i}`,
          }),
        });
      }

      // 11th email should be rejected with 429 Rate Limit Exceeded
      const rateLimitRes = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId,
          vendorId,
          recipientEmail: 'vendor11@example.com',
          subject: 'Inquiry #11',
          bodyText: 'Body text #11',
        }),
      });

      expect(rateLimitRes.status).toBe(429);
      const data = await rateLimitRes.json();
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('gracefully reports unconfigured SMTP provider without throwing unhandled exceptions', async () => {
      emailService.setProvider(new SmtpEmailProvider());

      const res = await fetch(`${baseUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventId,
          vendorId,
          recipientEmail: 'vendor@example.com',
          subject: 'Inquiry',
          bodyText: 'Body text',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('rejected');
      expect(data.error).toContain('SMTP provider unconfigured');
    });
  });
});
