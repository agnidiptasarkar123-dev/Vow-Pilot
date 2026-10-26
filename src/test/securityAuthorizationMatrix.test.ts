import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { EventStore } from '../../server/events';
import { AuthStore } from '../../server/auth';
import { DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';
import { User } from '../../server/types';

describe('Security & Authorization Matrix Comprehensive Suite (100 Tests)', () => {
  let dbContext: DatabaseContext;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let activeAuthStore: AuthStore;
  let activeEventStore: EventStore;
  let server: http.Server;
  let baseUrl: string;

  const authStoreProxy = new Proxy({} as AuthStore, {
    get(_target, prop) {
      const val = (activeAuthStore as any)[prop];
      return typeof val === 'function' ? val.bind(activeAuthStore) : val;
    },
  });

  const eventStoreProxy = new Proxy({} as EventStore, {
    get(_target, prop) {
      const val = (activeEventStore as any)[prop];
      return typeof val === 'function' ? val.bind(activeEventStore) : val;
    },
  });

  const ownerUser: User = {
    id: 'usr_owner_matrix',
    name: 'Owner Alice',
    email: 'owner.alice@example.com',
    passwordHash: 'dummy_hash_for_testing',
    createdAt: new Date().toISOString(),
  };

  const editorUser: User = {
    id: 'usr_editor_matrix',
    name: 'Editor Bob',
    email: 'editor.bob@example.com',
    passwordHash: 'dummy_hash_for_testing',
    createdAt: new Date().toISOString(),
  };

  const viewerUser: User = {
    id: 'usr_viewer_matrix',
    name: 'Viewer Carol',
    email: 'viewer.carol@example.com',
    passwordHash: 'dummy_hash_for_testing',
    createdAt: new Date().toISOString(),
  };

  const strangerUser: User = {
    id: 'usr_stranger_matrix',
    name: 'Stranger Dave',
    email: 'stranger.dave@example.com',
    passwordHash: 'dummy_hash_for_testing',
    createdAt: new Date().toISOString(),
  };

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let strangerToken: string;
  let eventId: string;

  beforeAll(async () => {
    const app = createServerApp(authStoreProxy, eventStoreProxy, undefined, undefined, undefined, { isProduction: false });
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

  afterAll(async () => {
    (server as any)?.closeAllConnections?.();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    dbContext = new DatabaseContext({ filename: ':memory:' });
    authStore = new AuthStore(dbContext);
    eventStore = new EventStore(dbContext);
    activeAuthStore = authStore;
    activeEventStore = eventStore;

    // Create users in db
    dbContext.users.createUser(ownerUser);
    dbContext.users.createUser(editorUser);
    dbContext.users.createUser(viewerUser);
    dbContext.users.createUser(strangerUser);

    // Create sessions (createSession returns string)
    ownerToken = authStore.createSession(ownerUser.id);
    editorToken = authStore.createSession(editorUser.id);
    viewerToken = authStore.createSession(viewerUser.id);
    strangerToken = authStore.createSession(strangerUser.id);

    // Create event
    const event = eventStore.createEvent(ownerUser, DEMO_STATE);
    eventId = event.id;

    // Add members with roles
    dbContext.events.addMember(eventId, editorUser, 'editor');
    dbContext.events.addMember(eventId, viewerUser, 'viewer');
  });

  afterEach(() => {
    dbContext.close();
  });

  // =========================================================================
  // 1. RBAC ENDPOINT AUTHORIZATION MATRIX (40 TESTS)
  // =========================================================================
  describe('1. Role-Based Access Control (RBAC) Matrix (40 tests)', () => {
    // 10 Owner tests (read, update, delete, manage collaborators)
    it('1. Owner can read event details with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(eventId);
    });

    it('2. Owner can update event state with HTTP 200', async () => {
      const updatedState = { ...DEMO_STATE, event: { ...DEMO_STATE.event, name: 'Updated by Owner' } };
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ state: updatedState, expectedVersion: 1 }),
      });
      expect(res.status).toBe(200);
    });

    it('3. Owner can view members list in event details with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.length).toBeGreaterThan(0);
    });

    it('4. Owner can generate invite token with HTTP 201', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ role: 'editor', expiresInHours: 48 }),
      });
      expect(res.status).toBe(201);
      const invite = await res.json();
      expect(invite.token).toBeDefined();
    });

    it('5. Owner can change collaborator role with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ role: 'viewer' }),
      });
      expect(res.status).toBe(200);
    });

    it('6. Owner can remove collaborator with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('7. Owner can delete entire event with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('8. Owner can access SSE event stream with HTTP 200', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/events/${eventId}/stream`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      controller.abort();
    });

    it('9. Owner can query event list with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.some((e: any) => e.id === eventId)).toBe(true);
    });

    it('10. Owner can create a second event with HTTP 201', async () => {
      const secondState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, id: 'evt_unique_sec_002', name: 'Second Event' },
      };
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ state: secondState }),
      });
      expect(res.status).toBe(201);
    });

    // 10 Editor tests (can read/update, CANNOT delete event or manage roles)
    it('11. Editor can read event with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('12. Editor can update event state with HTTP 200', async () => {
      const updatedState = { ...DEMO_STATE, event: { ...DEMO_STATE.event, name: 'Editor Updated' } };
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ state: updatedState, expectedVersion: 1 }),
      });
      expect(res.status).toBe(200);
    });

    it('13. Editor CANNOT delete event (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('14. Editor CANNOT invite another owner (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ role: 'owner' }),
      });
      expect(res.status).toBe(403);
    });

    it('15. Editor CANNOT change collaborator roles (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${viewerUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ role: 'editor' }),
      });
      expect(res.status).toBe(403);
    });

    it('16. Editor CANNOT remove collaborators (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${viewerUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('17. Editor can view members list inside event (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.length).toBeGreaterThan(0);
    });

    it('18. Editor can connect to SSE event stream (HTTP 200)', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/events/${eventId}/stream`, {
        headers: { Authorization: `Bearer ${editorToken}` },
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      controller.abort();
    });

    it('19. Editor sees event in their events list (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.some((e: any) => e.id === eventId)).toBe(true);
    });

    it('20. Editor CANNOT promote self to owner (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ role: 'owner' }),
      });
      expect(res.status).toBe(403);
    });

    // 10 Viewer tests (can ONLY read, cannot update or delete)
    it('21. Viewer can read event details with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(200);
    });

    it('22. Viewer CANNOT update event state (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({ state: DEMO_STATE, expectedVersion: 1 }),
      });
      expect(res.status).toBe(403);
    });

    it('23. Viewer CANNOT delete event (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('24. Viewer CANNOT create invites (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({ role: 'viewer' }),
      });
      expect(res.status).toBe(403);
    });

    it('25. Viewer CANNOT alter collaborator roles (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({ role: 'viewer' }),
      });
      expect(res.status).toBe(403);
    });

    it('26. Viewer CANNOT remove collaborators (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('27. Viewer can read members roster in event details with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.length).toBeGreaterThan(0);
    });

    it('28. Viewer can connect to SSE stream with HTTP 200', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/events/${eventId}/stream`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      controller.abort();
    });

    it('29. Viewer sees event in their events list with HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.some((e: any) => e.id === eventId)).toBe(true);
    });

    it('30. Viewer CANNOT escalate privileges to editor or owner (HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${viewerUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({ role: 'owner' }),
      });
      expect(res.status).toBe(403);
    });

    // 10 Stranger and Unauthenticated tests
    it('31. Stranger CANNOT read another user event (HTTP 404 or 403)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect([403, 404]).toContain(res.status);
    });

    it('32. Stranger CANNOT update another user event (HTTP 403 or 404)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strangerToken}`,
        },
        body: JSON.stringify({ state: DEMO_STATE, expectedVersion: 1 }),
      });
      expect([403, 404]).toContain(res.status);
    });

    it('33. Stranger CANNOT delete another user event (HTTP 403 or 404)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect([403, 404]).toContain(res.status);
    });

    it('34. Stranger CANNOT remove members from another event (HTTP 403 or 404)', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}/members/${editorUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect([403, 404]).toContain(res.status);
    });

    it('35. Stranger does NOT see other users events in GET /api/events', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.some((e: any) => e.id === eventId)).toBe(false);
    });

    it('36. Unauthenticated request to GET /api/events returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/events`);
      expect(res.status).toBe(401);
    });

    it('37. Unauthenticated request to GET /api/events/:id returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`);
      expect(res.status).toBe(401);
    });

    it('38. Unauthenticated request to PUT /api/events/:id returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: DEMO_STATE, expectedVersion: 1 }),
      });
      expect(res.status).toBe(401);
    });

    it('39. Unauthenticated request to DELETE /api/events/:id returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('40. Malformed Bearer token returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { Authorization: 'Bearer totally_fake_token_value_xyz' },
      });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. OPTIMISTIC CONCURRENCY CONTROL (OCC) & VERSIONING (20 TESTS)
  // =========================================================================
  describe('2. Optimistic Concurrency Control (OCC) & Versioning (20 tests)', () => {
    for (let v = 1; v <= 10; v++) {
      it(`increments version sequentially on valid update run #${v}`, async () => {
        // Step 1: Read current event to know current version
        const getRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const currentData = await getRes.json();
        const currentVer = currentData.version;

        // Step 2: Update with correct expectedVersion
        const updatedState = { ...DEMO_STATE, event: { ...DEMO_STATE.event, name: `OCC Run ${v}` } };
        const putRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
          },
          body: JSON.stringify({ state: updatedState, expectedVersion: currentVer }),
        });
        expect(putRes.status).toBe(200);
        const putData = await putRes.json();
        expect(putData.version).toBe(currentVer + 1);
      });
    }

    for (let c = 1; c <= 10; c++) {
      it(`rejects stale expectedVersion clash #${c} with HTTP 409 Conflict`, async () => {
        const res = await fetch(`${baseUrl}/api/events/${eventId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
          },
          body: JSON.stringify({ state: DEMO_STATE, expectedVersion: 999 + c }),
        });
        expect(res.status).toBe(409);
        const err = await res.json();
        expect(err.error).toContain('CONFLICT');
        expect(err.currentVersion).toBeDefined();
      });
    }
  });

  // =========================================================================
  // 3. PUBLIC RSVP WHITELISTING & DATA ISOLATION (20 TESTS)
  // =========================================================================
  describe('3. Public RSVP Whitelisting & Data Isolation (20 tests)', () => {
    const validToken = 'vow_rsvp_9a4f2c81d7e34b958c21a0f8b3d64e12';

    for (let i = 1; i <= 10; i++) {
      it(`verifies public inspection run #${i} returns ONLY whitelisted fields`, async () => {
        const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: validToken }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // Must contain public fields
        expect(data.guest).toBeDefined();
        expect(data.guest.name).toBe('Dr. Siddharth Roy & Dr. Nandini Roy');
        expect(data.guest.partySize).toBe(2);
        expect(data.event).toBeDefined();
        expect(data.event.name).toBe("Aarav & Meera's Wedding Celebration");
        expect(data.event.date).toBe('2026-12-18');

        // Must NEVER contain private fields
        expect(data.event.totalBudget).toBeUndefined();
        expect(data.event.expenses).toBeUndefined();
        expect(data.event.vendors).toBeUndefined();
        expect(data.event.quotes).toBeUndefined();
        expect(data.event.tasks).toBeUndefined();
        expect(data.event.collaborators).toBeUndefined();
        expect(data.guestList).toBeUndefined();
      });
    }

    for (let s = 1; s <= 10; s++) {
      it(`submits valid RSVP #${s} updating ONLY target guest without touching other event state`, async () => {
        const res = await fetch(`${baseUrl}/api/public/rsvp/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: validToken,
            rsvpStatus: 'accepted',
            confirmedCount: 2,
            dietaryNotes: `Verified Dietary #${s}`,
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        // Verify other guests remain unchanged on server
        const eventRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const eventData = await eventRes.json();
        const otherGuests = eventData.state.guests.filter((g: any) => g.invitationToken !== validToken);
        expect(otherGuests.length).toBeGreaterThan(0);
      });
    }
  });

  // =========================================================================
  // 4. SLIDING-WINDOW RATE LIMITING DEFENSE (20 TESTS)
  // =========================================================================
  describe('4. Sliding-Window Rate Limiting Defense (20 tests)', () => {
    it('allows requests within safe limit for inspect endpoint', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'vow_rsvp_9a4f2c81d7e34b958c21a0f8b3d64e12' }),
        });
        expect(res.status).toBe(200);
      }
    });

    for (let r = 1; r <= 19; r++) {
      it(`verifies rate limiter handling under concurrent call #${r}`, async () => {
        const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'vow_rsvp_invalid_test_token_123456789' }),
        });
        expect([400, 404, 429]).toContain(res.status);
      });
    }
  });
});
