import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAllPersistedData,
  loadPersistedState,
  resetToDemoState,
  savePersistedState,
  validateStateSchema,
  STORAGE_KEY,
} from '../persistence/storage';
import { validateImportedJson } from '../persistence/importExport';
import { DEMO_STATE } from '../persistence/demoData';

describe('State Persistence and Data Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reloads state from localStorage successfully', () => {
    savePersistedState(DEMO_STATE);
    const loaded = loadPersistedState();

    expect(loaded.loadedFromStorage).toBe(true);
    expect(loaded.state.event.name).toBe(DEMO_STATE.event.name);
    expect(loaded.state.schemaVersion).toBe(1);
  });

  it('safely recovers and falls back to DEMO_STATE when storage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'corrupted{json:');
    const loaded = loadPersistedState();

    expect(loaded.loadedFromStorage).toBe(false);
    expect(loaded.recoveredFromError).toBe(true);
    expect(loaded.state.event.name).toBe(DEMO_STATE.event.name);
  });

  it('rejects schema validation for objects missing required domain fields', () => {
    expect(validateStateSchema(null)).toBe(false);
    expect(validateStateSchema({})).toBe(false);
    expect(validateStateSchema({ schemaVersion: 1, event: 'invalid' })).toBe(false);
    expect(validateStateSchema(DEMO_STATE)).toBe(true);
  });

  it('resets state to clean demo dataset with confirmation', () => {
    const customState = {
      ...DEMO_STATE,
      event: { ...DEMO_STATE.event, name: 'Custom Modified Event' },
    };
    savePersistedState(customState);
    expect(loadPersistedState().state.event.name).toBe('Custom Modified Event');

    const reset = resetToDemoState();
    expect(reset.event.name).toBe(DEMO_STATE.event.name);
    expect(loadPersistedState().state.event.name).toBe(DEMO_STATE.event.name);
  });

  it('validates and sanitizes imported JSON files', () => {
    const validJson = JSON.stringify(DEMO_STATE);
    const result = validateImportedJson(validJson);
    expect(result.success).toBe(true);
    expect(result.state?.event.id).toBe(DEMO_STATE.event.id);

    const invalidJson = '{"foo": "bar"}';
    const badResult = validateImportedJson(invalidJson);
    expect(badResult.success).toBe(false);
    expect(badResult.error).toContain('Invalid VowPilot schema');
  });

  it('clears all local storage safely', () => {
    savePersistedState(DEMO_STATE);
    clearAllPersistedData();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
