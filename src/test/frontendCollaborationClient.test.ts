import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { CollaborationClient } from '../services/collaborationClient';
import { createServerApp } from '../../server/app';
import { AuthStore } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';

describe('Frontend CollaborationClient & Auth Service Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;

  beforeEach(async () => {
    localStorage.clear();
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
    localStorage.clear();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Server URL Resolution & Fallback Logic', () => {
    it('uses configured VITE_API_URL or vowpilot_server_url when provided', () => {
      localStorage.setItem('vowpilot_server_url', 'https://custom-backend.example.com');
      const client = new CollaborationClient();
      expect(client.getServerUrl()).toBe('https://custom-backend.example.com');
    });

    it('defaults to production Render backend when running outside localhost and no env var is set', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = new URL('https://vowpilot.vercel.app');

      const client = new CollaborationClient();
      expect(client.getServerUrl()).toBe('https://vow-pilot.onrender.com');

      // Restore
      (window as any).location = originalLocation;
    });

    it('defaults to localhost:3001 when running on localhost', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = new URL('http://localhost:5173');

      const client = new CollaborationClient();
      expect(client.getServerUrl()).toBe('http://localhost:3001');

      // Restore
      (window as any).location = originalLocation;
    });
  });

  describe('Client Authentication Lifecycle', () => {
    it('registers a user, persists token to localStorage, and updates client state', async () => {
      const client = new CollaborationClient(baseUrl);

      const res = await client.register('Aavni Patel', 'aavni@example.com', 'aavniPassword123');
      expect(res.success).toBe(true);
      expect(res.user?.name).toBe('Aavni Patel');
      expect(res.user?.email).toBe('aavni@example.com');
      expect(res.token).toMatch(/^vow_/);

      // Verify token persisted in localStorage
      expect(localStorage.getItem('vowpilot_auth_token')).toBe(res.token);

      // checkAuth() should confirm active session
      const authCheck = await client.checkAuth();
      expect(authCheck.authenticated).toBe(true);
      expect(authCheck.user?.email).toBe('aavni@example.com');
    });

    it('logs in an existing user and clears token on logout', async () => {
      const client = new CollaborationClient(baseUrl);

      // Register first
      await client.register('Kabir Mehta', 'kabir@example.com', 'kabirPassword123');
      await client.logout();

      expect(localStorage.getItem('vowpilot_auth_token')).toBeNull();

      // Log back in
      const loginRes = await client.login('kabir@example.com', 'kabirPassword123');
      expect(loginRes.success).toBe(true);
      expect(loginRes.user?.name).toBe('Kabir Mehta');
      expect(localStorage.getItem('vowpilot_auth_token')).toBe(loginRes.token);

      // Logout
      const logoutRes = await client.logout();
      expect(logoutRes.success).toBe(true);
      expect(localStorage.getItem('vowpilot_auth_token')).toBeNull();

      const verifyCheck = await client.checkAuth();
      expect(verifyCheck.authenticated).toBe(false);
    });

    it('handles invalid credentials without unhandled exceptions', async () => {
      const client = new CollaborationClient(baseUrl);
      const res = await client.login('nonexistent@example.com', 'wrongpassword');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('Cloud Event Creation & Sync Flow', () => {
    it('requires authentication before creating event on backend', async () => {
      const client = new CollaborationClient(baseUrl);
      const res = await client.createEventOnServer(DEMO_STATE);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Authentication required');
    });

    it('creates event on server when authenticated, transitioning client to synced', async () => {
      const client = new CollaborationClient(baseUrl);
      await client.register('Organizer', 'organizer@example.com', 'strongPassword123');

      const createRes = await client.createEventOnServer(DEMO_STATE);
      expect(createRes.success).toBe(true);
      expect(createRes.eventId).toBeDefined();

      const state = client.getState();
      expect(state.activeEventId).toBe(createRes.eventId);
      expect(state.status).toBe('synced');
      expect(state.serverVersion).toBe(1);
      expect(state.members.length).toBe(1);
      expect(state.members[0].role).toBe('owner');
    });

    it('allows owner to update collaborator role and updates client members state', async () => {
      // 1. Owner registers and creates event
      const ownerClient = new CollaborationClient(baseUrl);
      await ownerClient.register('Event Owner', 'owner@example.com', 'password123');
      const createRes = await ownerClient.createEventOnServer(DEMO_STATE);
      const eventId = createRes.eventId!;

      // 2. Owner invites editor
      const inviteRes = await ownerClient.createInvite(eventId, 'editor', 24);
      expect(inviteRes.token).toBeDefined();

      // 3. Collaborator registers and joins
      const collabClient = new CollaborationClient(baseUrl);
      const collabReg = await collabClient.register('Event Editor', 'editor@example.com', 'password123');
      const collabUserId = collabReg.user!.id;
      const joinRes = await collabClient.joinEvent(inviteRes.token!);
      expect(joinRes.success).toBe(true);

      // 4. Owner updates collaborator role to viewer
      const updateRoleRes = await ownerClient.updateMemberRole(eventId, collabUserId, 'viewer');
      expect(updateRoleRes.success).toBe(true);

      // Verify owner client members reflect new role
      const ownerMembers = ownerClient.getState().members;
      const updatedMember = ownerMembers.find((m) => m.userId === collabUserId);
      expect(updatedMember?.role).toBe('viewer');
    });

    it('gracefully handles server unavailability without corrupting state', async () => {
      // Point client to non-existent port
      const deadClient = new CollaborationClient('http://localhost:59999');
      deadClient.setAuthToken('vow_fake_token');

      const res = await deadClient.updateMemberRole('evt-123', 'usr-456', 'viewer');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
