import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { EventStore } from '../../server/events';
import { AuthStore } from '../../server/auth';
import { DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';
import { User } from '../../server/types';
import { AppState, GuestRecord } from '../types';

describe('VowPilot V2 — Server Public RSVP & Persistence Suite', () => {
  let dbContext: DatabaseContext;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  const testOwner: User = {
    id: 'usr_test_owner_v2',
    name: 'Anirban Sen',
    email: 'anirban.sen@example.com',
    passwordHash: 'dummy_hash_for_testing',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    // In-memory isolated database context for test
    dbContext = new DatabaseContext({ filename: ':memory:' });
    authStore = new AuthStore(dbContext);
    eventStore = new EventStore(dbContext);

    const app = createServerApp(authStore, eventStore);
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          port = addr.port;
          baseUrl = `http://127.0.0.1:${port}`;
        }
        resolve();
      });
    });

    // Populate initial test user and test event with V2 guests in database
    dbContext.users.createUser(testOwner);
    eventStore.createEvent(testOwner, DEMO_STATE);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    dbContext.close();
  });

  it('1. Allows public guest RSVP inspection by 128-bit secure token without requiring authentication', async () => {
    const validToken = 'vow_rsvp_9a4f2c81d7e34b958c21a0f8b3d64e12';

    const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validToken }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();

    // Verifies returned public guest details
    expect(data.guest.name).toBe('Dr. Siddharth Roy & Dr. Nandini Roy');
    expect(data.guest.partySize).toBe(2);
    expect(data.guest.rsvpStatus).toBe('accepted');
    expect(data.guest.dietaryNotes).toContain('No onion / garlic');

    // Verifies returned public event details
    expect(data.event.name).toBe("Aarav & Meera's Wedding Celebration");
    expect(data.event.date).toBe('2026-12-18');

    // STRICT PRIVACY VERIFICATION: Ensures private financial and vendor data are NEVER leaked
    expect(data.event.totalBudget).toBeUndefined();
    expect(data.event.categories).toBeUndefined();
    expect(data.event.expenses).toBeUndefined();
    expect(data.event.vendors).toBeUndefined();
    expect(data.event.quotes).toBeUndefined();
    expect(data.event.collaborators).toBeUndefined();
    expect(data.event.tasks).toBeUndefined();
    expect(data.event.tables).toBeUndefined();
    expect(data.guestList).toBeUndefined();
  });

  it('2. Rejects invalid or nonexistent RSVP tokens with HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'vow_rsvp_00000000000000000000000000000000' }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('not found');
  });

  it('3. Rejects short or malformed tokens (< 16 characters) with HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'short_token' }),
    });

    expect(res.status).toBe(404);
  });

  it('4. Rejects revoked tokens with explicit revocation error message', async () => {
    // Add a revoked guest to the event
    const revokedToken = 'vow_rsvp_revoked_token_1234567890abcdef';
    const revokedGuest: GuestRecord = {
      id: 'gst-revoked-001',
      eventId: 'evt-demo-001',
      name: 'Revoked Guest',
      partySize: 2,
      confirmedCount: 0,
      rsvpStatus: 'pending',
      invitationToken: revokedToken,
      tokenRevoked: true,
      updatedAt: new Date().toISOString(),
    };

    const currentState = eventStore.getEvent('evt-demo-001', testOwner).state;
    const updatedState: AppState = {
      ...currentState,
      guests: [...(currentState.guests || []), revokedGuest],
    };
    eventStore.updateEvent('evt-demo-001', testOwner, 1, updatedState);

    const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: revokedToken }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('revoked');
  });

  it('5. Rejects expired tokens with explicit expiration error message', async () => {
    // Add an expired guest token to the event
    const expiredToken = 'vow_rsvp_expired_token_1234567890abcdef';
    const expiredGuest: GuestRecord = {
      id: 'gst-expired-001',
      eventId: 'evt-demo-001',
      name: 'Expired Guest',
      partySize: 2,
      confirmedCount: 0,
      rsvpStatus: 'pending',
      invitationToken: expiredToken,
      tokenExpiresAt: '2020-01-01T00:00:00.000Z', // past date
      updatedAt: new Date().toISOString(),
    };

    const currentState = eventStore.getEvent('evt-demo-001', testOwner).state;
    const updatedState: AppState = {
      ...currentState,
      guests: [...(currentState.guests || []), expiredGuest],
    };
    eventStore.updateEvent('evt-demo-001', testOwner, 1, updatedState);

    const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredToken }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('expired');
  });

  it('6. Submits public guest RSVP and persists response in server database', async () => {
    const pendingToken = 'vow_rsvp_8d1b4e20f0a54c879b45d6e7f8a90b12';

    const submitRes = await fetch(`${baseUrl}/api/public/rsvp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: pendingToken,
        rsvpStatus: 'accepted',
        confirmedCount: 2,
        dietaryNotes: 'No seafood / shellfish',
        accessibilityRequirements: 'Ground-floor access',
      }),
    });

    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.success).toBe(true);
    expect(submitData.guestName).toBe('Aditya & Rhea Kapoor');
    expect(submitData.confirmedCount).toBe(2);

    // Verify persisted state in server SQLite database
    const inspectRes = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pendingToken }),
    });

    const updated = await inspectRes.json();
    expect(updated.guest.rsvpStatus).toBe('accepted');
    expect(updated.guest.confirmedCount).toBe(2);
    expect(updated.guest.dietaryNotes).toBe('No seafood / shellfish');
    expect(updated.guest.accessibilityRequirements).toBe('Ground-floor access');
  });

  it('7. Handles duplicate submissions cleanly without corrupting state or duplicating records', async () => {
    const pendingToken = 'vow_rsvp_8d1b4e20f0a54c879b45d6e7f8a90b12';

    // First submission: accepted with 2
    await fetch(`${baseUrl}/api/public/rsvp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: pendingToken,
        rsvpStatus: 'accepted',
        confirmedCount: 2,
      }),
    });

    // Second submission: updated to accepted with 1 (change of plans)
    const secondRes = await fetch(`${baseUrl}/api/public/rsvp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: pendingToken,
        rsvpStatus: 'accepted',
        confirmedCount: 1,
        dietaryNotes: 'Gluten-free only for 1 guest',
      }),
    });

    expect(secondRes.status).toBe(200);

    // Verify in database: total guests count did not increase, record was updated
    const event = eventStore.getEvent('evt-demo-001', testOwner);
    const matchingGuests = event.state.guests?.filter((g) => g.invitationToken === pendingToken);
    expect(matchingGuests?.length).toBe(1); // exactly one record
    expect(matchingGuests?.[0].confirmedCount).toBe(1);
    expect(matchingGuests?.[0].dietaryNotes).toBe('Gluten-free only for 1 guest');
  });

  it('8. Correctly handles declining guest RSVP', async () => {
    const pendingToken = 'vow_rsvp_8d1b4e20f0a54c879b45d6e7f8a90b12';

    const submitRes = await fetch(`${baseUrl}/api/public/rsvp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: pendingToken,
        rsvpStatus: 'declined',
        confirmedCount: 0,
      }),
    });

    expect(submitRes.status).toBe(200);
    const inspectRes = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pendingToken }),
    });

    const updated = await inspectRes.json();
    expect(updated.guest.rsvpStatus).toBe('declined');
    expect(updated.guest.confirmedCount).toBe(0);
  });

  it('9. Enforces rate limiting on public RSVP inspection endpoint', async () => {
    const testIp = '198.51.100.42';
    const validToken = 'vow_rsvp_9a4f2c81d7e34b958c21a0f8b3d64e12';

    // Rapidly send 30 allowed requests
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp,
        },
        body: JSON.stringify({ token: validToken }),
      });
      expect(res.status).toBe(200);
    }

    // 31st request from same IP should receive HTTP 429
    const blockedRes = await fetch(`${baseUrl}/api/public/rsvp/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIp,
      },
      body: JSON.stringify({ token: validToken }),
    });

    expect(blockedRes.status).toBe(429);
    const blockedData = await blockedRes.json();
    expect(blockedData.error).toContain('Rate limit exceeded');
  });
});
