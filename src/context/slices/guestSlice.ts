import { AppState, ChangeRecord, GuestRecord, RsvpStatus } from '../../types';
import { generateSecureRsvpToken } from '../../utils/security';

export function handleAddGuest(
  state: AppState,
  guestInput: Omit<GuestRecord, 'id' | 'updatedAt' | 'invitationToken'>
): AppState {
  const existingGuests = state.guests || [];
  const now = new Date().toISOString();
  const id = `gst-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newGuest: GuestRecord = {
    ...guestInput,
    id,
    invitationToken: generateSecureRsvpToken(),
    confirmedCount: guestInput.rsvpStatus === 'accepted' ? (guestInput.confirmedCount || guestInput.partySize) : 0,
    updatedAt: now,
  };

  const changeRecord: ChangeRecord = {
    id: `chg-gst-${Date.now()}`,
    timestamp: now,
    changeType: 'guest',
    description: `Added guest "${newGuest.name}" (Party of ${newGuest.partySize}).`,
    deltaSummary: `Status: ${newGuest.rsvpStatus}.`,
  };

  return {
    ...state,
    guests: [...existingGuests, newGuest],
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleUpdateGuest(state: AppState, guest: GuestRecord): AppState {
  const existingGuests = state.guests || [];
  const index = existingGuests.findIndex((g) => g.id === guest.id);
  if (index === -1) return state;

  const now = new Date().toISOString();
  const updatedGuest: GuestRecord = {
    ...guest,
    confirmedCount: guest.rsvpStatus === 'accepted' ? Math.min(guest.confirmedCount, guest.partySize) : 0,
    updatedAt: now,
  };

  const updatedGuests = [...existingGuests];
  updatedGuests[index] = updatedGuest;

  const changeRecord: ChangeRecord = {
    id: `chg-gst-${Date.now()}`,
    timestamp: now,
    changeType: 'guest',
    description: `Updated guest details for "${guest.name}".`,
    deltaSummary: `RSVP: ${guest.rsvpStatus}, Confirmed: ${updatedGuest.confirmedCount}/${guest.partySize}.`,
  };

  return {
    ...state,
    guests: updatedGuests,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleDeleteGuest(state: AppState, guestId: string): AppState {
  const existingGuests = state.guests || [];
  const target = existingGuests.find((g) => g.id === guestId);
  if (!target) return state;

  const now = new Date().toISOString();
  const changeRecord: ChangeRecord = {
    id: `chg-gst-${Date.now()}`,
    timestamp: now,
    changeType: 'guest',
    description: `Removed guest "${target.name}".`,
  };

  // If assigned to a table, also remove from tables
  const existingTables = state.tables || [];
  const updatedTables = existingTables.map((tbl) => ({
    ...tbl,
    assignedGuestIds: tbl.assignedGuestIds.filter((id) => id !== guestId),
  }));

  return {
    ...state,
    guests: existingGuests.filter((g) => g.id !== guestId),
    tables: updatedTables,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleUpdateGuestRsvp(
  state: AppState,
  guestId: string,
  status: RsvpStatus,
  confirmedCount: number,
  dietaryNotes?: string,
  accessibilityRequirements?: string
): AppState {
  const existingGuests = state.guests || [];
  const index = existingGuests.findIndex((g) => g.id === guestId);
  if (index === -1) return state;

  const target = existingGuests[index];
  const now = new Date().toISOString();

  const finalConfirmed = status === 'accepted' ? Math.max(1, Math.min(confirmedCount, target.partySize)) : 0;

  const updatedGuest: GuestRecord = {
    ...target,
    rsvpStatus: status,
    confirmedCount: finalConfirmed,
    dietaryNotes: dietaryNotes !== undefined ? dietaryNotes : target.dietaryNotes,
    accessibilityRequirements:
      accessibilityRequirements !== undefined ? accessibilityRequirements : target.accessibilityRequirements,
    respondedAt: now,
    updatedAt: now,
  };

  const updatedGuests = [...existingGuests];
  updatedGuests[index] = updatedGuest;

  const changeRecord: ChangeRecord = {
    id: `chg-gst-${Date.now()}`,
    timestamp: now,
    changeType: 'guest',
    description: `Recorded RSVP for "${target.name}": ${status.toUpperCase()} (${finalConfirmed}/${target.partySize} attending).`,
  };

  return {
    ...state,
    guests: updatedGuests,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleBatchAddGuests(
  state: AppState,
  guestsToAdd: Array<Omit<GuestRecord, 'id' | 'updatedAt' | 'invitationToken'>>
): AppState {
  const existingGuests = state.guests || [];
  const now = new Date().toISOString();

  const newRecords: GuestRecord[] = guestsToAdd.map((g) => ({
    ...g,
    id: `gst-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    invitationToken: generateSecureRsvpToken(),
    confirmedCount: g.rsvpStatus === 'accepted' ? (g.confirmedCount || g.partySize) : 0,
    updatedAt: now,
  }));

  const changeRecord: ChangeRecord = {
    id: `chg-gst-${Date.now()}`,
    timestamp: now,
    changeType: 'guest',
    description: `Batch imported ${newRecords.length} guests.`,
  };

  return {
    ...state,
    guests: [...existingGuests, ...newRecords],
    changeLog: [changeRecord, ...state.changeLog],
  };
}
