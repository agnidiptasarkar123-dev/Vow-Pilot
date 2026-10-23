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

/**
 * Validates basic structural integrity of loaded data before adopting it.
 */
export function validateStateSchema(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const s = data as Record<string, unknown>;

  if (typeof s.schemaVersion !== 'number') return false;
  if (!s.event || typeof s.event !== 'object') return false;
  const evt = s.event as Record<string, unknown>;
  if (typeof evt.id !== 'string' || typeof evt.name !== 'string' || typeof evt.totalBudget !== 'number') {
    return false;
  }
  if (!Array.isArray(s.categories) || !Array.isArray(s.expenses) || !Array.isArray(s.tasks) || !Array.isArray(s.vendors)) {
    return false;
  }
  return true;
}

/**
 * Migration strategy: handles schema transitions safely.
 */
export function migrateState(rawState: Record<string, unknown> | AppState): AppState {
  const s = rawState as Record<string, unknown>;
  const version = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;

  if (version === 0) {
    return {
      ...(rawState as unknown as AppState),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  return rawState as AppState;
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
