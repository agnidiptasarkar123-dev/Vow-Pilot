import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { handleAddGuest, handleRegenerateGuestToken, handleUpdateGuestRsvp } from '../context/slices/guestSlice';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState } from '../types';

describe('VowPilot V2.1 — Unique RSVP QR Codes & Guest Tokens', () => {
  it('generates distinct, cryptographically unique RSVP URLs for two different guests', async () => {
    let state: AppState = { ...DEMO_STATE, guests: [] };

    const guest1 = {
      eventId: 'event_1',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      partySize: 2,
      confirmedCount: 0,
      rsvpStatus: 'pending' as const,
    };
    const guest2 = {
      eventId: 'event_1',
      name: 'Rohan Verma',
      email: 'rohan@example.com',
      partySize: 1,
      confirmedCount: 0,
      rsvpStatus: 'pending' as const,
    };

    state = handleAddGuest(state, guest1);
    state = handleAddGuest(state, guest2);

    expect(state.guests).toBeDefined();
    const guests = state.guests!;
    expect(guests.length).toBe(2);
    const [savedGuest1, savedGuest2] = guests;

    // Both guests must have valid vow_rsvp_ tokens with 128-bit cryptographic entropy
    expect(savedGuest1.invitationToken).toMatch(/^vow_rsvp_[a-f0-9]{32}$/);
    expect(savedGuest2.invitationToken).toMatch(/^vow_rsvp_[a-f0-9]{32}$/);
    expect(savedGuest1.invitationToken).not.toBe(savedGuest2.invitationToken);

    // Build RSVP URLs
    const origin = 'https://vowpilot.vercel.app';
    const rsvpUrl1 = `${origin}/?rsvpToken=${savedGuest1.invitationToken}`;
    const rsvpUrl2 = `${origin}/?rsvpToken=${savedGuest2.invitationToken}`;

    expect(rsvpUrl1).not.toBe(rsvpUrl2);
    expect(rsvpUrl1).toContain(savedGuest1.invitationToken);
    expect(rsvpUrl2).toContain(savedGuest2.invitationToken);

    // Verify QR SVG generation for both guests
    const svg1 = await QRCode.toString(rsvpUrl1, { type: 'svg', margin: 2 });
    const svg2 = await QRCode.toString(rsvpUrl2, { type: 'svg', margin: 2 });

    expect(svg1).toContain('<svg');
    expect(svg2).toContain('<svg');
    expect(svg1).not.toBe(svg2);

    // Verify QR PNG generation
    const dataUrl1 = await QRCode.toDataURL(rsvpUrl1, { width: 300, margin: 2 });
    expect(dataUrl1.startsWith('data:image/png;base64,')).toBe(true);

    // Security check: Payload must NEVER encode sensitive internal budgets, vendor quotes, or passwords
    expect(rsvpUrl1).not.toContain('budget');
    expect(rsvpUrl1).not.toContain('quotes');
    expect(rsvpUrl1).not.toContain('password');
    expect(rsvpUrl1).not.toContain('totalBudget');
  });

  it('supports token regeneration that creates a fresh distinct token and invalidates old link', () => {
    let state: AppState = { ...DEMO_STATE, guests: [] };

    state = handleAddGuest(state, {
      eventId: 'event_1',
      name: 'Kavita Sengupta',
      email: 'kavita@example.com',
      partySize: 3,
      confirmedCount: 0,
      rsvpStatus: 'pending',
    });

    const originalGuest = state.guests![0];
    const oldToken = originalGuest.invitationToken;

    // Planners can regenerate token if an invitation pass was leaked or lost
    state = handleRegenerateGuestToken(state, originalGuest.id);
    const updatedGuest = state.guests![0];
    const newToken = updatedGuest.invitationToken;

    expect(newToken).toMatch(/^vow_rsvp_[a-f0-9]{32}$/);
    expect(newToken).not.toBe(oldToken);

    // Old token lookup should fail, while new token lookup succeeds
    const foundByOldToken = state.guests!.find((g) => g.invitationToken === oldToken);
    const foundByNewToken = state.guests!.find((g) => g.invitationToken === newToken);

    expect(foundByOldToken).toBeUndefined();
    expect(foundByNewToken).toBeDefined();
    expect(foundByNewToken?.id).toBe(originalGuest.id);
  });

  it('correctly updates guest RSVP response when submitted via their individual token destination', () => {
    let state: AppState = { ...DEMO_STATE, guests: [] };

    state = handleAddGuest(state, {
      eventId: 'event_1',
      name: 'Aditya Roy',
      email: 'aditya@example.com',
      partySize: 2,
      confirmedCount: 0,
      rsvpStatus: 'pending',
    });

    const guest = state.guests![0];
    expect(guest.rsvpStatus).toBe('pending');
    expect(guest.confirmedCount).toBe(0);

    // Guest opens unique QR code and confirms attendance for 2 guests
    state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 2, 'Vegan meal request');

    const confirmedGuest = state.guests![0];
    expect(confirmedGuest.rsvpStatus).toBe('accepted');
    expect(confirmedGuest.confirmedCount).toBe(2);
    expect(confirmedGuest.dietaryNotes).toBe('Vegan meal request');
  });
});
