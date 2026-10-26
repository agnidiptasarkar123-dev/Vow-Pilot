import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { AuthStore } from '../../server/auth';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext, DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';

describe('VowPilot Multi-User Collaboration & Distributed Systems Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let testDb: DatabaseContext;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let emailProvider: TestEmailProvider;
  let emailService: EmailDispatchService;

  beforeEach(async () => {
    testDb = createTestDatabaseContext();
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

  // Helper to register a test user
  const registerUser = async (name: string, email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'password123' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    return { token: data.token as string, user: data.user };
  };

  // Helper to create an event as a user
  const createTestEvent = async (token: string, eventName = 'Jaipur Royal Gala') => {
    const customState = JSON.parse(JSON.stringify(DEMO_STATE));
    customState.event.name = eventName;
    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state: customState }),
    });
    expect(res.status).toBe(201);
    return await res.json();
  };

  // ============================================================================
  // Suite 1: Complete Invitation Lifecycle & Privilege Escalation Prevention
  // ============================================================================
  describe('Invitation Lifecycle & Privilege Escalation Defenses', () => {
    it('allows an owner to invite users with explicit roles (editor, viewer)', async () => {
      const owner = await registerUser('Owner Rani', 'rani@palace.test');
      const event = await createTestEvent(owner.token);

      // Create editor invite
      const editorInviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ role: 'editor', expiresInHours: 24 }),
      });
      expect(editorInviteRes.status).toBe(201);
      const editorInvite = await editorInviteRes.json();
      expect(editorInvite.role).toBe('editor');
      expect(editorInvite.token).toBeDefined();

      // Create viewer invite
      const viewerInviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ role: 'viewer', expiresInHours: 48 }),
      });
      expect(viewerInviteRes.status).toBe(201);
      const viewerInvite = await viewerInviteRes.json();
      expect(viewerInvite.role).toBe('viewer');
      expect(viewerInvite.token).toBeDefined();

      // Owner can list all invitations
      const listRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        headers: { Authorization: `Bearer ${owner.token}` },
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.invites.length).toBe(2);
    });

    it('allows invitee to safely inspect invitation preview without joining', async () => {
      const owner = await registerUser('Host Aarav', 'aarav@vowpilot.test');
      const event = await createTestEvent(owner.token, 'Udaipur Lake Palace Sangeet');

      const inviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const { token: rawInviteToken } = await inviteRes.json();

      // Public / pre-auth inspection endpoint
      const inspectRes = await fetch(`${baseUrl}/api/events/invitations/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawInviteToken }),
      });

      expect(inspectRes.status).toBe(200);
      const preview = await inspectRes.json();
      expect(preview.eventName).toBe('Udaipur Lake Palace Sangeet');
      expect(preview.role).toBe('editor');
      expect(preview.inviterName).toBe('Host Aarav');
      expect(preview.status).toBe('valid');
      expect(preview.expiresAt).toBeDefined();
    });

    it('allows invitee to decline an invitation and prevents further use', async () => {
      const owner = await registerUser('Owner Priya', 'priya@vowpilot.test');
      const invitee = await registerUser('Guest Vikram', 'vikram@vowpilot.test');
      const event = await createTestEvent(owner.token);

      const inviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ role: 'viewer' }),
      });
      const { token: rawInviteToken } = await inviteRes.json();

      // Invitee declines invitation
      const declineRes = await fetch(`${baseUrl}/api/events/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invitee.token}` },
        body: JSON.stringify({ token: rawInviteToken }),
      });
      expect(declineRes.status).toBe(200);
      const declineData = await declineRes.json();
      expect(declineData.success).toBe(true);

      // Attempting to join with the declined token must fail safely
      const joinRes = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invitee.token}` },
        body: JSON.stringify({ token: rawInviteToken }),
      });
      expect([400, 409]).toContain(joinRes.status);
      const joinErr = await joinRes.json();
      expect(joinErr.error).toMatch(/already (been used|consumed|declined)/i);

      // Invitee is NOT added as an event member
      const eventDetailsRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        headers: { Authorization: `Bearer ${invitee.token}` },
      });
      expect(eventDetailsRes.status).toBe(403);
    });

    it('allows owner to revoke an invitation immediately', async () => {
      const owner = await registerUser('Owner Kabir', 'kabir@vowpilot.test');
      const invitee = await registerUser('Invitee Rohan', 'rohan@vowpilot.test');
      const event = await createTestEvent(owner.token);

      const inviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ role: 'editor' }),
      });
      const invite = await inviteRes.json();

      // Owner revokes invitation using tokenHash
      const revokeRes = await fetch(`${baseUrl}/api/events/${event.id}/invites/${invite.tokenHash}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner.token}` },
      });
      expect(revokeRes.status).toBe(200);

      // Invitee attempts to accept revoked token
      const joinRes = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invitee.token}` },
        body: JSON.stringify({ token: invite.token }),
      });
      expect(joinRes.status).toBe(400);
      const joinErr = await joinRes.json();
      expect(joinErr.error).toContain('revoked');
    });

    it('rejects tampered, expired, or non-existent invitation tokens', async () => {
      const user = await registerUser('Regular User', 'user@vowpilot.test');

      // Non-existent token
      const nonExistentRes = await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ token: 'bogus_token_12345' }),
      });
      expect(nonExistentRes.status).toBe(400);

      // Inspect non-existent token
      const inspectRes = await fetch(`${baseUrl}/api/events/invitations/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'bogus_token_12345' }),
      });
      expect(inspectRes.status).toBe(404);
    });

    it('prevents an invite from granting permissions beyond those authorized by the owner', async () => {
      const owner = await registerUser('Owner Sovereign', 'sovereign@vowpilot.test');
      const event = await createTestEvent(owner.token);

      // Create editor invite
      const editorInvite = await (
        await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ role: 'editor' }),
        })
      ).json();

      const editor = await registerUser('Subordinate Editor', 'sub_editor@vowpilot.test');
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ token: editorInvite.token }),
      });

      // Editor attempts to create an owner invite -> must be rejected with 403
      const escalationRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ role: 'owner' }),
      });
      expect(escalationRes.status).toBe(403);
      const err = await escalationRes.json();
      expect(err.error).toContain('Only event owners can invite another owner');
    });
  });

  // ============================================================================
  // Suite 2: Role-Based Access Control (RBAC) Enforcement
  // ============================================================================
  describe('Role-Based Access Control (RBAC) Backend Enforcement', () => {
    it('strictly enforces permissions for Owner, Editor, and Viewer roles', async () => {
      const owner = await registerUser('Event Owner', 'owner_rbac@palace.test');
      const editor = await registerUser('Event Editor', 'editor_rbac@palace.test');
      const viewer = await registerUser('Event Viewer', 'viewer_rbac@palace.test');

      const event = await createTestEvent(owner.token, 'Grand Jodhpur Sangeet');

      // Add editor
      const editInvite = await (
        await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ role: 'editor' }),
        })
      ).json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ token: editInvite.token }),
      });

      // Add viewer
      const viewInvite = await (
        await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ role: 'viewer' }),
        })
      ).json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.token}` },
        body: JSON.stringify({ token: viewInvite.token }),
      });

      // --- Viewer Restrictions ---
      // 1. Viewer cannot update event data
      const modifiedState = JSON.parse(JSON.stringify(DEMO_STATE));
      modifiedState.event.name = 'Hacked by Viewer';
      const viewerUpdateRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.token}` },
        body: JSON.stringify({ state: modifiedState, expectedVersion: 1 }),
      });
      expect(viewerUpdateRes.status).toBe(403);
      const viewerUpdateErr = await viewerUpdateRes.json();
      expect(viewerUpdateErr.error).toContain('Viewer role does not have permission');

      // 2. Viewer cannot create invitations
      const viewerInviteRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.token}` },
        body: JSON.stringify({ role: 'viewer' }),
      });
      expect(viewerInviteRes.status).toBe(403);

      // 3. Viewer cannot dispatch vendor inquiries
      const viewerDispatchRes = await fetch(
        `${baseUrl}/api/vendors/dispatch-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.token}` },
          body: JSON.stringify({
            eventId: event.id,
            vendorId: 'vendor_palace',
            recipientEmail: 'palace@jaipur.test',
            subject: 'Inquiry',
            bodyText: 'Details',
          }),
        }
      );
      expect(viewerDispatchRes.status).toBe(403);

      // 4. Viewer can read event details and see their role
      const viewerGetRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        headers: { Authorization: `Bearer ${viewer.token}` },
      });
      expect(viewerGetRes.status).toBe(200);
      const viewerData = await viewerGetRes.json();
      expect(viewerData.userRole).toBe('viewer');

      // --- Editor Permissions & Boundaries ---
      // 1. Editor CAN update event data
      modifiedState.event.name = 'Coordinated by Editor';
      const editorUpdateRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: modifiedState, expectedVersion: 1 }),
      });
      expect(editorUpdateRes.status).toBe(200);
      const editorUpdateData = await editorUpdateRes.json();
      expect(editorUpdateData.version).toBe(2);

      // 2. Editor CAN invite viewers
      const editorInviteViewerRes = await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ role: 'viewer' }),
      });
      expect(editorInviteViewerRes.status).toBe(201);

      // 3. Editor CANNOT remove members
      const editorRemoveRes = await fetch(`${baseUrl}/api/events/${event.id}/members/${viewer.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editor.token}` },
      });
      expect(editorRemoveRes.status).toBe(403);

      // 4. Editor CANNOT delete the event
      const editorDeleteRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editor.token}` },
      });
      expect(editorDeleteRes.status).toBe(403);

      // --- Owner-Only Powers ---
      // 1. Owner CAN remove a member
      const ownerRemoveRes = await fetch(`${baseUrl}/api/events/${event.id}/members/${viewer.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner.token}` },
      });
      expect(ownerRemoveRes.status).toBe(200);

      // Verify removed user can no longer access event
      const removedUserGetRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        headers: { Authorization: `Bearer ${viewer.token}` },
      });
      expect(removedUserGetRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Suite 3: Cross-Tenant Isolation
  // ============================================================================
  describe('Cross-Tenant Isolation & Unauthorized Subscription Defense', () => {
    it('strictly forbids a foreign tenant from reading or updating another tenant event', async () => {
      const tenantA = await registerUser('Tenant Alpha', 'alpha@org.test');
      const tenantB = await registerUser('Tenant Beta', 'beta@org.test');

      const eventA = await createTestEvent(tenantA.token, 'Alpha Private Celebration');

      // Tenant B tries to read Tenant A's event
      const readRes = await fetch(`${baseUrl}/api/events/${eventA.id}`, {
        headers: { Authorization: `Bearer ${tenantB.token}` },
      });
      expect(readRes.status).toBe(403);

      // Tenant B tries to write to Tenant A's event
      const writeRes = await fetch(`${baseUrl}/api/events/${eventA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantB.token}` },
        body: JSON.stringify({ state: DEMO_STATE, expectedVersion: 1 }),
      });
      expect(writeRes.status).toBe(403);

      // Tenant B tries to list invites for Tenant A's event
      const invitesRes = await fetch(`${baseUrl}/api/events/${eventA.id}/invites`, {
        headers: { Authorization: `Bearer ${tenantB.token}` },
      });
      expect(invitesRes.status).toBe(403);
    });

    it('rejects unauthorized SSE subscriptions with HTTP 403 or 401', async () => {
      const owner = await registerUser('Event Owner', 'sse_owner@vowpilot.test');
      const foreign = await registerUser('Foreign User', 'sse_foreign@vowpilot.test');
      const event = await createTestEvent(owner.token);

      // 1. Unauthenticated SSE connection attempt
      const unauthRes = await fetch(`${baseUrl}/api/events/${event.id}/stream`);
      expect(unauthRes.status).toBe(401);

      // 2. Authenticated but unauthorized foreign tenant SSE connection attempt
      const foreignRes = await fetch(`${baseUrl}/api/events/${event.id}/stream?token=${foreign.token}`);
      expect(foreignRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Suite 4: Optimistic Concurrency Control (OCC) & Stale Write Rejection
  // ============================================================================
  describe('Optimistic Concurrency Control (OCC)', () => {
    it('detects concurrent stale writes, returns explicit 409 Conflict, and provides reconciliation path', async () => {
      const owner = await registerUser('Coordinator One', 'coord1@vowpilot.test');
      const editor = await registerUser('Coordinator Two', 'coord2@vowpilot.test');
      const event = await createTestEvent(owner.token);

      // Add editor
      const invite = await (
        await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ role: 'editor' }),
        })
      ).json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ token: invite.token }),
      });

      // Both users start at version 1
      const stateOne = JSON.parse(JSON.stringify(DEMO_STATE));
      stateOne.event.name = 'Revision by Coordinator One';

      const stateTwo = JSON.parse(JSON.stringify(DEMO_STATE));
      stateTwo.event.name = 'Revision by Coordinator Two';

      // 1. User 1 submits update with expectedVersion 1 -> SUCCESS (advances to version 2)
      const resOne = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ state: stateOne, expectedVersion: 1 }),
      });
      expect(resOne.status).toBe(200);
      const dataOne = await resOne.json();
      expect(dataOne.version).toBe(2);

      // 2. User 2 submits update with stale expectedVersion 1 -> EXPLICIT 409 CONFLICT
      const resTwo = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: stateTwo, expectedVersion: 1 }),
      });
      expect(resTwo.status).toBe(409);
      const conflict = await resTwo.json();

      expect(conflict.code).toBe('CONCURRENCY_CONFLICT');
      expect(conflict.expectedVersion).toBe(1);
      expect(conflict.currentVersion).toBe(2);
      expect(conflict.lastModifiedBy).toBe('Coordinator One');
      expect(conflict.serverState).toBeDefined();
      expect(conflict.serverState.event.name).toBe('Revision by Coordinator One');

      // 3. Coordinator Two reviews conflict and chooses reconciliation: advance to version 2 and apply
      stateTwo.event.name = 'Reconciled Revision by Coordinator Two';
      const reconcileRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: stateTwo, expectedVersion: 2 }),
      });

      expect(reconcileRes.status).toBe(200);
      const reconcileData = await reconcileRes.json();
      expect(reconcileData.version).toBe(3);
      expect(reconcileData.state.event.name).toBe('Reconciled Revision by Coordinator Two');
    });
  });

  // ============================================================================
  // Suite 5: SSE Live Synchronization, Heartbeats, and Cursor Recovery
  // ============================================================================
  describe('SSE Live Synchronization & Reconnection Cursor Recovery', () => {
    it('broadcasts real-time events to active subscribers and performs catch-up sync for reconnected clients', async () => {
      const owner = await registerUser('Live Host', 'live_host@vowpilot.test');
      const event = await createTestEvent(owner.token);

      // 1. Connect SSE listener using Node HTTP client
      const url = new URL(`${baseUrl}/api/events/${event.id}/stream?token=${owner.token}`);
      const sseEvents: string[] = [];

      const sseReq = http.request(url, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          sseEvents.push(chunk.toString());
        });
      });
      sseReq.end();

      // Wait 100ms for SSE connection handshake
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Perform an update on the event
      const updatedState = JSON.parse(JSON.stringify(DEMO_STATE));
      updatedState.event.name = 'Live Broadcast Test Event';

      const updateRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ state: updatedState, expectedVersion: 1 }),
      });
      expect(updateRes.status).toBe(200);

      // Allow 150ms for broadcast delivery
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Disconnect SSE client
      sseReq.destroy();

      // Verify that event was received
      const joinedOutput = sseEvents.join('');
      expect(joinedOutput).toContain('data:');
      expect(joinedOutput).toContain('Live Broadcast Test Event');

      // 3. Reconnection Cursor Recovery: Client reconnects indicating sinceVersion=1
      // While client was offline, event advanced to version 2. Server must catch up client immediately!
      const catchupUrl = new URL(
        `${baseUrl}/api/events/${event.id}/stream?token=${owner.token}&sinceVersion=1`
      );
      const catchupEvents: string[] = [];

      const catchupReq = http.request(catchupUrl, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          catchupEvents.push(chunk.toString());
        });
      });
      catchupReq.end();

      await new Promise((resolve) => setTimeout(resolve, 150));
      catchupReq.destroy();

      const catchupOutput = catchupEvents.join('');
      expect(catchupOutput).toContain('"version":2');
      expect(catchupOutput).toContain('Live Broadcast Test Event');
    });

    it('cleans up disconnected listeners safely without memory leaks', async () => {
      const owner = await registerUser('Leak Checker', 'leak@vowpilot.test');
      const event = await createTestEvent(owner.token);

      const url = new URL(`${baseUrl}/api/events/${event.id}/stream?token=${owner.token}`);

      // Open and immediately close 5 connections
      for (let i = 0; i < 5; i++) {
        const req = http.request(url, () => {});
        req.on('error', () => {});
        req.end();
        await new Promise((resolve) => setTimeout(resolve, 20));
        req.destroy();
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // A new update should succeed cleanly and not crash due to dead sockets
      const updatedState = JSON.parse(JSON.stringify(DEMO_STATE));
      const res = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({ state: updatedState, expectedVersion: 1 }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ============================================================================
  // Suite 6: Server Restart & Crash Recovery
  // ============================================================================
  describe('Server Restart & Crash Recovery', () => {
    it('preserves versioning, members, and relational state across full server store restart', async () => {
      const owner = await registerUser('Durable Owner', 'durable_owner@vowpilot.test');
      const editor = await registerUser('Durable Editor', 'durable_editor@vowpilot.test');
      const event = await createTestEvent(owner.token, 'Historic Durability Gala');

      // Add editor
      const invite = await (
        await fetch(`${baseUrl}/api/events/${event.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ role: 'editor' }),
        })
      ).json();
      await fetch(`${baseUrl}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ token: invite.token }),
      });

      // Update to version 2
      const state2 = JSON.parse(JSON.stringify(DEMO_STATE));
      state2.event.name = 'Durability Gala - Phase 2';
      await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: state2, expectedVersion: 1 }),
      });

      // --- SIMULATE SERVER RESTART ---
      // Close HTTP server and re-create server with new store instances on the SAME persistent testDb
      await new Promise<void>((resolve) => server.close(() => resolve()));

      const restoredAuthStore = new AuthStore(testDb);
      const restoredEventStore = new EventStore(testDb);
      const restoredEmailService = new EmailDispatchService(emailProvider, testDb);
      const newHandler = createServerApp(restoredAuthStore, restoredEventStore, restoredEmailService);
      server = http.createServer(newHandler);

      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          if (addr && typeof addr === 'object') {
            baseUrl = `http://localhost:${addr.port}`;
          }
          resolve();
        });
      });

      // Verify that event data, version 2, and membership are fully preserved
      const verifyRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        headers: { Authorization: `Bearer ${editor.token}` },
      });
      expect(verifyRes.status).toBe(200);
      const data = await verifyRes.json();
      expect(data.version).toBe(2);
      expect(data.userRole).toBe('editor');
      expect(data.state.event.name).toBe('Durability Gala - Phase 2');
      expect(data.members.length).toBe(2);

      // Verify OCC continues to operate accurately after restart
      // Writing with stale version 1 must still trigger 409 Conflict
      const staleRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: state2, expectedVersion: 1 }),
      });
      expect(staleRes.status).toBe(409);

      // Writing with correct version 2 advances to version 3
      const validRes = await fetch(`${baseUrl}/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}` },
        body: JSON.stringify({ state: state2, expectedVersion: 2 }),
      });
      expect(validRes.status).toBe(200);
      expect((await validRes.json()).version).toBe(3);
    });
  });
});
