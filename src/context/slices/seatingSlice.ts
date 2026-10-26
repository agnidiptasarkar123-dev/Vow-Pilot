import { AppState, ChangeRecord, SeatingTable } from '../../types';

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
