import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../../server/app';
import { EventStore } from '../../server/events';
import { AuthStore } from '../../server/auth';
import { DatabaseContext } from '../../server/db';
import { DEMO_STATE } from '../persistence/demoData';
import type { AppState, GuestRecord } from '../types';

describe('VowPilot V2 — Multi-User Cloud Persistence & Security E2E Suite', () => {
  let dbContext: DatabaseContext;
  let authStore: AuthStore;
  let eventStore: EventStore;
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    dbContext.close();
  });

  it('1. Full Multi-User Cloud Persistence: Owner creates V2 event, Editor modifies it, Viewer is restricted', async () => {
    // 1. Register Owner (Priya Sharma)
    const ownerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        password: 'SecurePassword123!',
      }),
    });
    expect(ownerRegRes.status).toBe(201);
    const ownerAuth = await ownerRegRes.json();
    const ownerToken = ownerAuth.token;
    expect(ownerToken).toBeDefined();

    // 2. Owner creates an event with V2 state on the server
    const initialV2State: AppState = {
      ...DEMO_STATE,
      event: {
        ...DEMO_STATE.event,
        id: 'evt-cloud-v2-001',
        name: 'Priya & Kabir Grand Gala',
      },
      invitations: [
        {
          id: 'inv-v2-test-01',
          eventId: 'evt-cloud-v2-001',
          name: 'Main Gala Invitation',
          templateId: 'botanical-embroidery',
          printSize: '5x7',
          palette: 'cream-terracotta',
          title: 'The Wedding Celebration',
          hostNames: 'The Sharma & Kapoor Families',
          invitationHeading: 'Cordially invite you to celebrate',
          bodyText: 'An evening of celebration and eternal blessings.',
          eventDate: '2026-11-20',
          startTime: '6:30 PM',
          venueName: 'The Rambagh Palace',
          venueAddress: 'Bhawani Singh Road, Jaipur, Rajasthan',
          rsvpDeadline: '2026-10-31',
          contactInfo: 'priya.kabir@example.com',
          isBilingual: true,
          bilingualLanguage: 'bn',
          bilingualTitle: 'বিবাহের শুভ আমন্ত্রণ',
          bilingualBody: 'আমাদের পরিবারের শুভ মিলন উৎসবে আপনার উপস্থিতি একান্ত কাম্য।',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      guests: [
        {
          id: 'gst-v2-01',
          eventId: 'evt-cloud-v2-001',
          name: 'Arjun Verma',
          partySize: 2,
          confirmedCount: 0,
          rsvpStatus: 'pending',
          invitationToken: 'vow_rsvp_a1b2c3d4e5f60718293a4b5c6d7e8f90',
          updatedAt: new Date().toISOString(),
        },
      ],
      timeline: [
        {
          id: 'tml-v2-01',
          eventId: 'evt-cloud-v2-001',
          time: '18:30',
          endTime: '19:30',
          activity: 'Welcome Reception & Cocktails',
          durationMinutes: 60,
          orderIndex: 0,
        },
      ],
      tables: [
        {
          id: 'tbl-v2-01',
          eventId: 'evt-cloud-v2-001',
          name: 'Table 1 - Royal Court',
          capacity: 8,
          shape: 'round',
          assignedGuestIds: [],
        },
      ],
    };

    const createRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ state: initialV2State }),
    });

    expect(createRes.status).toBe(201);
    const createdEventData = await createRes.json();
    const eventId = createdEventData.id;
    expect(eventId).toBeDefined();

    // 3. Register Editor (Kabir Kapoor)
    const editorRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kabir Kapoor',
        email: 'kabir.kapoor@example.com',
        password: 'EditorPassword123!',
      }),
    });
    expect(editorRegRes.status).toBe(201);
    const editorAuth = await editorRegRes.json();
    const editorToken = editorAuth.token;

    // 4. Owner creates collaboration invite for Editor
    const inviteRes = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ role: 'editor' }),
    });
    expect(inviteRes.status).toBe(201);
    const inviteData = await inviteRes.json();
    const inviteToken = inviteData.token;

    // 5. Editor accepts invitation via /api/events/join
    const acceptRes = await fetch(`${baseUrl}/api/events/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${editorToken}`,
      },
      body: JSON.stringify({ inviteToken }),
    });
    expect(acceptRes.status).toBe(200);

    // 6. Editor connects to the event from a second account/device
    const getRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${editorToken}`,
      },
    });
    expect(getRes.status).toBe(200);
    const editorEventData = await getRes.json();

    // VERIFY ALL V2 DATA IS RETRIEVED FROM SERVER
    expect(editorEventData.state.invitations).toHaveLength(1);
    expect(editorEventData.state.invitations[0].name).toBe('Main Gala Invitation');
    expect(editorEventData.state.invitations[0].isBilingual).toBe(true);
    expect(editorEventData.state.invitations[0].bilingualLanguage).toBe('bn');
    expect(editorEventData.state.guests).toHaveLength(1);
    expect(editorEventData.state.guests[0].name).toBe('Arjun Verma');
    expect(editorEventData.state.timeline).toHaveLength(1);
    expect(editorEventData.state.tables).toHaveLength(1);

    // 7. Editor pushes modifications to V2 fields (OCC Version 1 -> 2)
    const modifiedState: AppState = {
      ...editorEventData.state,
      invitations: [
        {
          ...editorEventData.state.invitations[0],
          name: 'Main Gala Invitation (Gold Edition)',
          palette: 'forest-gold',
        },
      ],
      guests: [
        ...editorEventData.state.guests,
        {
          id: 'gst-v2-02',
          eventId,
          name: 'Sunita Mehra',
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          invitationToken: 'vow_rsvp_f1e2d3c4b5a60718293a4b5c6d7e8f99',
          updatedAt: new Date().toISOString(),
        },
      ],
      timeline: [
        ...editorEventData.state.timeline,
        {
          id: 'tml-v2-02',
          eventId,
          time: '19:30',
          endTime: '21:00',
          activity: 'Banquet & Sangeet Performances',
          durationMinutes: 90,
          orderIndex: 1,
        },
      ],
      tables: [
        {
          ...editorEventData.state.tables[0],
          assignedGuestIds: ['gst-v2-02'],
        },
      ],
    };

    const updateRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${editorToken}`,
        'X-Expected-Version': '1',
      },
      body: JSON.stringify({
        expectedVersion: 1,
        state: modifiedState,
      }),
    });

    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.version).toBe(2);

    // 8. Owner reloads the event and sees Editor's changes persisted on the server
    const ownerReloadRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(ownerReloadRes.status).toBe(200);
    const reloadedOwnerData = await ownerReloadRes.json();

    expect(reloadedOwnerData.version).toBe(2);
    expect(reloadedOwnerData.state.invitations[0].name).toBe('Main Gala Invitation (Gold Edition)');
    expect(reloadedOwnerData.state.invitations[0].palette).toBe('forest-gold');
    expect(reloadedOwnerData.state.guests).toHaveLength(2);
    expect(reloadedOwnerData.state.timeline).toHaveLength(2);
    expect(reloadedOwnerData.state.tables[0].assignedGuestIds).toContain('gst-v2-02');

    // 9. Register Viewer (Rohan - Read Only)
    const viewerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Viewer',
        email: 'rohan.viewer@example.com',
        password: 'ViewerPassword123!',
      }),
    });
    const viewerAuth = await viewerRegRes.json();
    const viewerToken = viewerAuth.token;

    // Owner invites Rohan as Viewer
    const viewerInviteRes = await fetch(`${baseUrl}/api/events/${eventId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ role: 'viewer' }),
    });
    const viewerInvite = await viewerInviteRes.json();

    // Viewer accepts via /api/events/join
    const joinRes = await fetch(`${baseUrl}/api/events/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ inviteToken: viewerInvite.token }),
    });
    expect(joinRes.status).toBe(200);

    // Viewer attempts to push state change (Must be rejected with HTTP 403 Forbidden)
    const forbiddenRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
        'X-Expected-Version': '2',
      },
      body: JSON.stringify({
        expectedVersion: 2,
        state: modifiedState,
      }),
    });

    expect(forbiddenRes.status).toBe(403);
    const forbiddenData = await forbiddenRes.json();
    expect(forbiddenData.error).toContain('Viewer');
  });

  it('2. Public RSVP submission modifies guest record on server without corrupting unrelated event state', async () => {
    // Register Owner
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Meera Rajput',
        email: 'meera.rajput@example.com',
        password: 'MeeraPassword123!',
      }),
    });
    const { token: ownerToken } = await regRes.json();

    // Create event with budget, tasks, vendors, and guests
    const targetToken = 'vow_rsvp_99887766554433221100aabbccddeeff';
    const initialAppState: AppState = {
      ...DEMO_STATE,
      event: {
        ...DEMO_STATE.event,
        id: 'evt-rsvp-test-001',
        name: 'Royal Heritage Sangeet',
        totalBudget: 5000000,
      },
      guests: [
        {
          id: 'gst-rsvp-target',
          eventId: 'evt-rsvp-test-001',
          name: 'Nikhil Saxena',
          partySize: 3,
          confirmedCount: 0,
          rsvpStatus: 'pending',
          invitationToken: targetToken,
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const createRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ state: initialAppState }),
    });
    const createdEvent = await createRes.json();
    const eventId = createdEvent.id;

    // Public guest submits RSVP response
    const rsvpRes = await fetch(`${baseUrl}/api/public/rsvp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: targetToken,
        rsvpStatus: 'accepted',
        confirmedCount: 3,
        dietaryNotes: 'No nuts / tree nuts allergy',
        accessibilityRequirements: 'Need ground floor seating for elderly parent',
      }),
    });

    expect(rsvpRes.status).toBe(200);
    const rsvpData = await rsvpRes.json();
    expect(rsvpData.success).toBe(true);
    expect(rsvpData.confirmedCount).toBe(3);

    // Verify in server event state that:
    // a) Target guest is updated
    // b) Unrelated state (budget, tasks, vendors) is 100% intact
    const verifyRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    const refreshed = await verifyRes.json();
    expect(refreshed.state.event.totalBudget).toBe(5000000);
    expect(refreshed.state.event.name).toBe('Royal Heritage Sangeet');
    expect(refreshed.state.categories.length).toBe(DEMO_STATE.categories.length);
    expect(refreshed.state.tasks.length).toBe(DEMO_STATE.tasks.length);
    expect(refreshed.state.vendors.length).toBe(DEMO_STATE.vendors.length);

    const updatedGuest = refreshed.state.guests?.find((g: GuestRecord) => g.id === 'gst-rsvp-target');
    expect(updatedGuest?.rsvpStatus).toBe('accepted');
    expect(updatedGuest?.confirmedCount).toBe(3);
    expect(updatedGuest?.dietaryNotes).toBe('No nuts / tree nuts allergy');
    expect(updatedGuest?.accessibilityRequirements).toBe('Need ground floor seating for elderly parent');
    expect(updatedGuest?.respondedAt).toBeDefined();
  });
});
