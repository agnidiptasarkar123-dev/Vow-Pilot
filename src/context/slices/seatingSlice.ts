import { AppState, ChangeRecord, GuestRecord, SeatingTable } from '../../types';

export function handleAddTable(
  state: AppState,
  tableInput: Omit<SeatingTable, 'id' | 'assignedGuestIds'>
): AppState {
  const existingTables = state.tables || [];
  const now = new Date().toISOString();
  const id = `tbl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newTable: SeatingTable = {
    ...tableInput,
    id,
    assignedGuestIds: [],
  };

  const changeRecord: ChangeRecord = {
    id: `chg-tbl-${Date.now()}`,
    timestamp: now,
    changeType: 'seating',
    description: `Added "${newTable.name}" (Capacity: ${newTable.capacity} guests).`,
  };

  return {
    ...state,
    tables: [...existingTables, newTable],
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleUpdateTable(state: AppState, table: SeatingTable): AppState {
  const existingTables = state.tables || [];
  const index = existingTables.findIndex((t) => t.id === table.id);
  if (index === -1) return state;

  const now = new Date().toISOString();
  const updatedTables = [...existingTables];
  updatedTables[index] = table;

  const changeRecord: ChangeRecord = {
    id: `chg-tbl-${Date.now()}`,
    timestamp: now,
    changeType: 'seating',
    description: `Updated table details for "${table.name}".`,
  };

  return {
    ...state,
    tables: updatedTables,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleDeleteTable(state: AppState, tableId: string): AppState {
  const existingTables = state.tables || [];
  const target = existingTables.find((t) => t.id === tableId);
  if (!target) return state;

  const now = new Date().toISOString();

  // Reset tableId on any guests who were seated at this table
  const existingGuests = state.guests || [];
  const updatedGuests = existingGuests.map((g) => {
    if (g.tableId === tableId) {
      return { ...g, tableId: undefined };
    }
    return g;
  });

  const changeRecord: ChangeRecord = {
    id: `chg-tbl-${Date.now()}`,
    timestamp: now,
    changeType: 'seating',
    description: `Removed table "${target.name}". Unassigned ${target.assignedGuestIds.length} seated guests.`,
  };

  return {
    ...state,
    tables: existingTables.filter((t) => t.id !== tableId),
    guests: updatedGuests,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleAssignGuestToTable(
  state: AppState,
  guestId: string,
  targetTableId: string
): AppState {
  const existingTables = state.tables || [];
  const existingGuests = state.guests || [];

  const targetTable = existingTables.find((t) => t.id === targetTableId);
  const targetGuest = existingGuests.find((g) => g.id === guestId);
  if (!targetTable || !targetGuest) return state;

  const now = new Date().toISOString();

  // 1. Remove guest from any previous table
  const cleanTables = existingTables.map((t) => ({
    ...t,
    assignedGuestIds: t.assignedGuestIds.filter((id) => id !== guestId),
  }));

  // 2. Add guest to target table
  const finalTables = cleanTables.map((t) => {
    if (t.id === targetTableId) {
      if (!t.assignedGuestIds.includes(guestId)) {
        return {
          ...t,
          assignedGuestIds: [...t.assignedGuestIds, guestId],
        };
      }
    }
    return t;
  });

  // 3. Update guest record
  const updatedGuests = existingGuests.map((g) => {
    if (g.id === guestId) {
      return { ...g, tableId: targetTableId, updatedAt: now };
    }
    return g;
  });

  const changeRecord: ChangeRecord = {
    id: `chg-tbl-${Date.now()}`,
    timestamp: now,
    changeType: 'seating',
    description: `Assigned "${targetGuest.name}" to "${targetTable.name}".`,
  };

  return {
    ...state,
    tables: finalTables,
    guests: updatedGuests,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleRemoveGuestFromTable(state: AppState, guestId: string): AppState {
  const existingTables = state.tables || [];
  const existingGuests = state.guests || [];

  const targetGuest = existingGuests.find((g) => g.id === guestId);
  if (!targetGuest) return state;

  const now = new Date().toISOString();

  const updatedTables = existingTables.map((t) => ({
    ...t,
    assignedGuestIds: t.assignedGuestIds.filter((id) => id !== guestId),
  }));

  const updatedGuests = existingGuests.map((g) => {
    if (g.id === guestId) {
      return { ...g, tableId: undefined, updatedAt: now };
    }
    return g;
  });

  const changeRecord: ChangeRecord = {
    id: `chg-tbl-${Date.now()}`,
    timestamp: now,
    changeType: 'seating',
    description: `Unseated "${targetGuest.name}".`,
  };

  return {
    ...state,
    tables: updatedTables,
    guests: updatedGuests,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

/**
 * Checks for seating allocation conflicts, capacity violations, orphaned assignments,
 * and link inconsistencies between tables and guests.
 */
export function detectSeatingConflicts(
  tables: SeatingTable[] = [],
  guests: GuestRecord[] = []
): string[] {
  const conflicts: string[] = [];
  const guestMap = new Map(guests.map((g) => [g.id, g]));
  const seenGuestTableMap = new Map<string, string>(); // guestId -> tableId

  for (const table of tables) {
    // 1. Capacity check
    if (table.assignedGuestIds.length > table.capacity) {
      conflicts.push(
        `Capacity Overload: Table "${table.name}" has ${table.assignedGuestIds.length} seated guests exceeding its capacity of ${table.capacity}.`
      );
    }

    for (const guestId of table.assignedGuestIds) {
      const guest = guestMap.get(guestId);

      // 2. Orphaned guest check
      if (!guest) {
        conflicts.push(
          `Orphaned Assignment: Table "${table.name}" references non-existent guest ID "${guestId}".`
        );
        continue;
      }

      // 3. Duplicate table assignment check
      const priorTableId = seenGuestTableMap.get(guestId);
      if (priorTableId) {
        const priorTable = tables.find((t) => t.id === priorTableId);
        conflicts.push(
          `Duplicate Seating: Guest "${guest.name}" is assigned to both "${priorTable?.name || priorTableId}" and "${table.name}".`
        );
      } else {
        seenGuestTableMap.set(guestId, table.id);
      }

      // 4. Inactive guest check
      if (guest.rsvpStatus === 'declined') {
        conflicts.push(
          `Declined Guest Seated: Guest "${guest.name}" RSVP is declined but still assigned to "${table.name}".`
        );
      }

      // 5. Inconsistent linkage (guest record tableId mismatch)
      if (guest.tableId && guest.tableId !== table.id) {
        conflicts.push(
          `Linkage Mismatch: Guest "${guest.name}" has tableId "${guest.tableId}" but is seated in "${table.id}".`
        );
      }
    }
  }

  // 6. Check guests pointing to tableId that don't have reciprocal assignment in table.assignedGuestIds
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  for (const guest of guests) {
    if (guest.tableId) {
      const targetTable = tableMap.get(guest.tableId);
      if (!targetTable) {
        conflicts.push(
          `Missing Table: Guest "${guest.name}" is linked to deleted or non-existent table ID "${guest.tableId}".`
        );
      } else if (!targetTable.assignedGuestIds.includes(guest.id)) {
        conflicts.push(
          `Unreciprocated Seating: Guest "${guest.name}" is marked as seated at "${targetTable.name}" but not in table roster.`
        );
      }
    }
  }

  return conflicts;
}
