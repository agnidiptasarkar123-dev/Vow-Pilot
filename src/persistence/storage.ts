import { AppState } from '../types';
import { DEMO_STATE } from './demoData';

export const CURRENT_SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'vowpilot_state_v1';

export interface StorageResult {
  state: AppState;
  loadedFromStorage: boolean;
  migrationApplied: boolean;
  recoveredFromError: boolean;
}

const VALID_EVENT_TYPES = new Set(['wedding', 'anniversary', 'birthday', 'corporate', 'other']);
const VALID_CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP']);
const VALID_TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'blocked']);
const VALID_EXPENSE_STATUSES = new Set(['estimated', 'quoted', 'confirmed', 'actual']);
const VALID_QUOTE_STATUSES = new Set(['draft', 'under_review', 'selected', 'rejected', 'expired']);

/**
 * Validates complete structural integrity of loaded data before adopting it.
 * Strictly verifies types, valid enums, non-negative numbers, unique IDs, and guards against prototype pollution.
 */
function hasDangerousKey(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype')
  ) {
    return true;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && hasDangerousKey(val)) {
      return true;
    }
  }
  return false;
}

export function validateStateSchema(data: unknown): data is AppState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (hasDangerousKey(data)) return false;

  const s = data as Record<string, unknown>;

  if (
    typeof s.schemaVersion !== 'number' ||
    !Number.isInteger(s.schemaVersion) ||
    s.schemaVersion < 0 ||
    s.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    return false;
  }
  if (!s.event || typeof s.event !== 'object' || Array.isArray(s.event)) return false;
  const evt = s.event as Record<string, unknown>;

  if (
    typeof evt.id !== 'string' || !evt.id ||
    typeof evt.name !== 'string' || !evt.name.trim() ||
    typeof evt.totalBudget !== 'number' || !Number.isFinite(evt.totalBudget) || evt.totalBudget < 0 ||
    typeof evt.guestCount !== 'number' || !Number.isFinite(evt.guestCount) || evt.guestCount < 0 ||
    typeof evt.currency !== 'string' || !VALID_CURRENCIES.has(evt.currency) ||
    typeof evt.eventType !== 'string' || !VALID_EVENT_TYPES.has(evt.eventType) ||
    typeof evt.date !== 'string' || !evt.date.trim() ||
    typeof evt.location !== 'string' || !evt.location.trim()
  ) {
    return false;
  }

  if (!evt.preferences || typeof evt.preferences !== 'object' || Array.isArray(evt.preferences)) {
    return false;
  }

  // Validate categories
  if (!Array.isArray(s.categories)) return false;
  const categoryIds = new Set<string>();
  for (const cat of s.categories) {
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return false;
    const c = cat as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id || categoryIds.has(c.id)) return false;
    if (typeof c.name !== 'string' || !c.name.trim()) return false;
    if (typeof c.allocatedAmount !== 'number' || !Number.isFinite(c.allocatedAmount) || c.allocatedAmount < 0) return false;
    categoryIds.add(c.id);
  }

  // Validate tasks
  if (!Array.isArray(s.tasks)) return false;
  const taskIds = new Set<string>();
  for (const t of s.tasks) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
    const task = t as Record<string, unknown>;
    if (typeof task.id !== 'string' || !task.id || taskIds.has(task.id)) return false;
    if (typeof task.title !== 'string' || !task.title.trim()) return false;
    if (typeof task.categoryId !== 'string' || !task.categoryId) return false;
    if (typeof task.dueDate !== 'string' || !task.dueDate) return false;
    if (typeof task.priority !== 'string' || !VALID_TASK_PRIORITIES.has(task.priority)) return false;
    if (typeof task.status !== 'string' || !VALID_TASK_STATUSES.has(task.status)) return false;
    if (!Array.isArray(task.dependencies)) return false;
    for (const d of task.dependencies) {
      if (typeof d !== 'string') return false;
    }
    taskIds.add(task.id);
  }

  // Validate expenses
  if (!Array.isArray(s.expenses)) return false;
  const expenseIds = new Set<string>();
  for (const e of s.expenses) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
    const exp = e as Record<string, unknown>;
    if (typeof exp.id !== 'string' || !exp.id || expenseIds.has(exp.id)) return false;
    if (typeof exp.categoryId !== 'string' || !exp.categoryId) return false;
    if (typeof exp.title !== 'string' || !exp.title.trim()) return false;
    if (typeof exp.amount !== 'number' || !Number.isFinite(exp.amount) || exp.amount < 0) return false;
    if (typeof exp.status !== 'string' || !VALID_EXPENSE_STATUSES.has(exp.status)) return false;
    expenseIds.add(exp.id);
  }

  // Validate vendors
  if (!Array.isArray(s.vendors)) return false;
  const vendorIds = new Set<string>();
  for (const v of s.vendors) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const ven = v as Record<string, unknown>;
    if (typeof ven.id !== 'string' || !ven.id || vendorIds.has(ven.id)) return false;
    if (typeof ven.name !== 'string' || !ven.name.trim()) return false;
    if (typeof ven.categoryId !== 'string' || !ven.categoryId) return false;
    vendorIds.add(ven.id);
  }

  // Validate quotes
  if (!Array.isArray(s.quotes)) return false;
  const quoteIds = new Set<string>();
  for (const q of s.quotes) {
    if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
    const quo = q as Record<string, unknown>;
    if (typeof quo.id !== 'string' || !quo.id || quoteIds.has(quo.id)) return false;
    if (typeof quo.vendorId !== 'string' || !quo.vendorId) return false;
    if (typeof quo.quotedAmount !== 'number' || !Number.isFinite(quo.quotedAmount) || quo.quotedAmount < 0) return false;
    if (typeof quo.currency !== 'string' || !VALID_CURRENCIES.has(quo.currency)) return false;
    if (typeof quo.status !== 'string' || !VALID_QUOTE_STATUSES.has(quo.status)) return false;
    quoteIds.add(quo.id);
  }

  // Validate scenarios
  if (!Array.isArray(s.scenarios)) return false;
  for (const sc of s.scenarios) {
    if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return false;
    const scen = sc as Record<string, unknown>;
    if (typeof scen.id !== 'string' || !scen.id) return false;
    if (typeof scen.name !== 'string' || !scen.name.trim()) return false;
    if (typeof scen.modifiedGuestCount !== 'number' || !Number.isFinite(scen.modifiedGuestCount) || scen.modifiedGuestCount < 0) return false;
    if (!scen.categoryAllocations || typeof scen.categoryAllocations !== 'object') return false;
  }

  // Validate messages
  if (!Array.isArray(s.messages)) return false;

  // Validate optional V2 invitations
  if (s.invitations !== undefined) {
    if (!Array.isArray(s.invitations)) return false;
    for (const inv of s.invitations) {
      if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return false;
      const i = inv as Record<string, unknown>;
      if (typeof i.id !== 'string' || !i.id) return false;
      if (typeof i.title !== 'string') return false;
      if (typeof i.templateId !== 'string') return false;
    }
  }

  // Validate optional V2 guests
  if (s.guests !== undefined) {
    if (!Array.isArray(s.guests)) return false;
    for (const gst of s.guests) {
      if (!gst || typeof gst !== 'object' || Array.isArray(gst)) return false;
      const g = gst as Record<string, unknown>;
      if (typeof g.id !== 'string' || !g.id) return false;
      if (typeof g.name !== 'string' || !g.name.trim()) return false;
      if (typeof g.partySize !== 'number' || g.partySize < 1) return false;
      if (typeof g.confirmedCount !== 'number' || g.confirmedCount < 0) return false;
      if (g.rsvpStatus !== 'pending' && g.rsvpStatus !== 'accepted' && g.rsvpStatus !== 'declined') return false;
    }
  }

  // Validate optional V2 timeline
  if (s.timeline !== undefined) {
    if (!Array.isArray(s.timeline)) return false;
    for (const tml of s.timeline) {
      if (!tml || typeof tml !== 'object' || Array.isArray(tml)) return false;
      const t = tml as Record<string, unknown>;
      if (typeof t.id !== 'string' || !t.id) return false;
      if (typeof t.activity !== 'string' || !t.activity.trim()) return false;
      if (typeof t.time !== 'string') return false;
      if (typeof t.durationMinutes !== 'number' || t.durationMinutes < 0) return false;
    }
  }

  // Validate optional V2 seating tables
  if (s.tables !== undefined) {
    if (!Array.isArray(s.tables)) return false;
    for (const tbl of s.tables) {
      if (!tbl || typeof tbl !== 'object' || Array.isArray(tbl)) return false;
      const tb = tbl as Record<string, unknown>;
      if (typeof tb.id !== 'string' || !tb.id) return false;
      if (typeof tb.name !== 'string' || !tb.name.trim()) return false;
      if (typeof tb.capacity !== 'number' || tb.capacity < 1) return false;
      if (!Array.isArray(tb.assignedGuestIds)) return false;
    }
  }

  return true;
}

/**
 * Migration strategy: handles schema transitions safely.
 */
export function migrateState(rawState: Record<string, unknown> | AppState): AppState {
  const s = rawState as Record<string, unknown>;

  return {
    ...(rawState as unknown as AppState),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: Array.isArray(s.categories) ? s.categories as any : [],
    tasks: Array.isArray(s.tasks) ? s.tasks as any : [],
    expenses: Array.isArray(s.expenses) ? s.expenses as any : [],
    vendors: Array.isArray(s.vendors) ? s.vendors as any : [],
    quotes: Array.isArray(s.quotes) ? s.quotes as any : [],
    scenarios: Array.isArray(s.scenarios) ? s.scenarios as any : [],
    messages: Array.isArray(s.messages) ? s.messages as any : [],
    changeLog: Array.isArray(s.changeLog) ? s.changeLog as any : [],
    invitations: Array.isArray(s.invitations) ? s.invitations as any : [],
    guests: Array.isArray(s.guests) ? s.guests as any : [],
    timeline: Array.isArray(s.timeline) ? s.timeline as any : [],
    tables: Array.isArray(s.tables) ? s.tables as any : [],
  };
}

/**
 * Loads state from localStorage with safe error handling and fallback to DEMO_STATE.
 */
export function loadPersistedState(): StorageResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        state: DEMO_STATE,
        loadedFromStorage: false,
        migrationApplied: false,
        recoveredFromError: false,
      };
    }

    const parsed = JSON.parse(raw);
    if (!validateStateSchema(parsed)) {
      console.warn('VowPilot: Stored state failed schema validation. Falling back to default demo state.');
      return {
        state: DEMO_STATE,
        loadedFromStorage: false,
        migrationApplied: false,
        recoveredFromError: true,
      };
    }

    if (parsed.schemaVersion < CURRENT_SCHEMA_VERSION) {
      const migrated = migrateState(parsed);
      savePersistedState(migrated);
      return {
        state: migrated,
        loadedFromStorage: true,
        migrationApplied: true,
        recoveredFromError: false,
      };
    }

    return {
      state: parsed,
      loadedFromStorage: true,
      migrationApplied: false,
      recoveredFromError: false,
    };
  } catch (error) {
    console.error('VowPilot: Error reading localStorage:', error);
    return {
      state: DEMO_STATE,
      loadedFromStorage: false,
      migrationApplied: false,
      recoveredFromError: true,
    };
  }
}

/**
 * Saves state to localStorage safely.
 */
export function savePersistedState(state: AppState): boolean {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('VowPilot: Failed to serialize and save state to localStorage:', error);
    return false;
  }
}

/**
 * Resets state to default demo dataset.
 */
export function resetToDemoState(): AppState {
  savePersistedState(DEMO_STATE);
  return DEMO_STATE;
}

/**
 * Clears all locally stored application data.
 */
export function clearAllPersistedData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('VowPilot: Error clearing localStorage:', error);
  }
}
