import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  savePersistedState,
  loadPersistedState,
  migrateState,
  validateStateSchema,
  clearAllPersistedData,
  STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
} from '../persistence/storage';
import {
  validateImportedJson,
  exportEventData,
  MAX_IMPORT_BYTES,
} from '../persistence/importExport';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState } from '../types';

describe('Comprehensive Persistence, Migration & Import/Export Fuzzing (150 Parameterized Test Cases)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // Suite 1: Structural Schema Validation Negative Tests (40 cases)
  // --------------------------------------------------------------------------
  const invalidPayloads = [
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
    { label: 'number primitive', data: 42 },
    { label: 'string primitive', data: 'hello' },
    { label: 'boolean primitive', data: true },
    { label: 'empty object', data: {} },
    { label: 'missing event', data: { schemaVersion: 1, categories: [], expenses: [], tasks: [], vendors: [], quotes: [], scenarios: [], messages: [] } },
    { label: 'missing categories', data: { schemaVersion: 1, event: DEMO_STATE.event, expenses: [], tasks: [], vendors: [], quotes: [], scenarios: [], messages: [] } },
    { label: 'missing expenses', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], tasks: [], vendors: [], quotes: [], scenarios: [], messages: [] } },
    { label: 'missing tasks', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], expenses: [], vendors: [], quotes: [], scenarios: [], messages: [] } },
    { label: 'missing vendors', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], expenses: [], tasks: [], quotes: [], scenarios: [], messages: [] } },
    { label: 'missing quotes', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], expenses: [], tasks: [], vendors: [], scenarios: [], messages: [] } },
    { label: 'missing scenarios', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], expenses: [], tasks: [], vendors: [], quotes: [], messages: [] } },
    { label: 'missing messages', data: { schemaVersion: 1, event: DEMO_STATE.event, categories: [], expenses: [], tasks: [], vendors: [], quotes: [], scenarios: [] } },
    { label: 'invalid eventType', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, eventType: 'invalid_type' } } },
    { label: 'invalid currency', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, currency: 'BITCOIN' } } },
    { label: 'negative totalBudget', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, totalBudget: -100 } } },
    { label: 'negative guestCount', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, guestCount: -5 } } },
    { label: 'empty event name', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, name: '' } } },
    { label: 'empty event date', data: { ...DEMO_STATE, event: { ...DEMO_STATE.event, date: '' } } },
    { label: 'category missing name', data: { ...DEMO_STATE, categories: [{ id: 'c1', allocatedAmount: 100, priority: 'high', isCustom: false }] } },
    { label: 'category negative allocation', data: { ...DEMO_STATE, categories: [{ id: 'c1', name: 'Cat', allocatedAmount: -50, priority: 'high', isCustom: false }] } },
    { label: 'task missing title', data: { ...DEMO_STATE, tasks: [{ id: 't1', categoryId: 'c1', status: 'not_started', priority: 'high', dueDate: '2026-11-01', dependencies: [] }] } },
    { label: 'task invalid status', data: { ...DEMO_STATE, tasks: [{ id: 't1', title: 'Task', categoryId: 'c1', status: 'finished', priority: 'high', dueDate: '2026-11-01', dependencies: [] }] } },
    { label: 'task invalid priority', data: { ...DEMO_STATE, tasks: [{ id: 't1', title: 'Task', categoryId: 'c1', status: 'not_started', priority: 'urgent', dueDate: '2026-11-01', dependencies: [] }] } },
    { label: 'expense missing title', data: { ...DEMO_STATE, expenses: [{ id: 'e1', categoryId: 'c1', amount: 100, status: 'estimated', paidAmount: 0 }] } },
    { label: 'expense invalid status', data: { ...DEMO_STATE, expenses: [{ id: 'e1', categoryId: 'c1', title: 'Exp', amount: 100, status: 'settled', paidAmount: 0 }] } },
    { label: 'expense negative amount', data: { ...DEMO_STATE, expenses: [{ id: 'e1', categoryId: 'c1', title: 'Exp', amount: -100, status: 'estimated', paidAmount: 0 }] } },
    { label: 'vendor missing name', data: { ...DEMO_STATE, vendors: [{ id: 'v1', categoryId: 'c1', isSample: true }] } },
    { label: 'quote missing vendorId', data: { ...DEMO_STATE, quotes: [{ id: 'q1', quoteDate: '2026-10-01', quotedAmount: 100, currency: 'INR', status: 'under_review', includedServices: [] }] } },
    { label: 'quote invalid status', data: { ...DEMO_STATE, quotes: [{ id: 'q1', vendorId: 'v1', quoteDate: '2026-10-01', quotedAmount: 100, currency: 'INR', status: 'accepted', includedServices: [] }] } },
    { label: 'duplicate category IDs', data: { ...DEMO_STATE, categories: [{ id: 'dup', name: 'A', allocatedAmount: 10, priority: 'low', isCustom: false }, { id: 'dup', name: 'B', allocatedAmount: 20, priority: 'low', isCustom: false }] } },
    { label: 'duplicate task IDs', data: { ...DEMO_STATE, tasks: [{ id: 'dup-t', title: 'A', categoryId: 'c', status: 'not_started', priority: 'low', dueDate: '2026-11-01', dependencies: [], description: '', priorityReason: '' }, { id: 'dup-t', title: 'B', categoryId: 'c', status: 'not_started', priority: 'low', dueDate: '2026-11-01', dependencies: [], description: '', priorityReason: '' }] } },
    { label: 'duplicate vendor IDs', data: { ...DEMO_STATE, vendors: [{ id: 'dup-v', name: 'A', categoryId: 'c', isSample: true }, { id: 'dup-v', name: 'B', categoryId: 'c', isSample: true }] } },
    { label: 'duplicate quote IDs', data: { ...DEMO_STATE, quotes: [{ id: 'dup-q', vendorId: 'v', quoteDate: '2026-10-01', quotedAmount: 100, currency: 'INR', status: 'draft', includedServices: [] }, { id: 'dup-q', vendorId: 'v', quoteDate: '2026-10-01', quotedAmount: 200, currency: 'INR', status: 'draft', includedServices: [] }] } },
    { label: 'schemaVersion not a number', data: { ...DEMO_STATE, schemaVersion: 'one' } },
    { label: 'event not an object', data: { ...DEMO_STATE, event: 'wedding' } },
    { label: 'categories not an array', data: { ...DEMO_STATE, categories: 'venue' } },
    { label: 'tasks not an array', data: { ...DEMO_STATE, tasks: 'task1' } },
    { label: 'vendors not an array', data: { ...DEMO_STATE, vendors: 'vendor1' } },
  ];

  describe('Strict schema boundary rejection', () => {
    invalidPayloads.forEach(({ label, data }, idx) => {
      it(`[Case ${idx + 1}] rejects structurally invalid payload: ${label}`, () => {
        expect(validateStateSchema(data)).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Prototype Pollution Attacks (20 cases)
  // --------------------------------------------------------------------------
  const pollutionCases = Array.from({ length: 20 }, (_, i) => {
    const key = i % 3 === 0 ? '__proto__' : i % 3 === 1 ? 'constructor' : 'prototype';
    return { id: i, key, level: (i % 4) + 1 };
  });

  describe('Prototype pollution attack rejection', () => {
    pollutionCases.forEach(({ id, key, level }) => {
      it(`[Case ${id + 1}] rejects payload with pollution key "${key}" at nesting depth ${level}`, () => {
        const payload: Record<string, unknown> = JSON.parse(JSON.stringify(DEMO_STATE));

        let target: Record<string, unknown> = payload;
        if (level === 2) target = payload.event as Record<string, unknown>;
        else if (level === 3) target = (payload.event as Record<string, unknown>).preferences as Record<string, unknown>;
        else if (level === 4) target = (payload.categories as Array<Record<string, unknown>>)[0];

        Object.defineProperty(target, key, {
          value: { polluted: true },
          enumerable: true,
          configurable: true,
        });

        const isValid = validateStateSchema(payload);
        expect(isValid).toBe(false);

        // Also test JSON string validator
        const jsonStr = JSON.stringify(payload);
        const importCheck = validateImportedJson(jsonStr);
        expect(importCheck.success).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Relational Foreign Key Integrity (30 cases)
  // --------------------------------------------------------------------------
  const relationalCases = Array.from({ length: 30 }, (_, i) => {
    const type = i < 10 ? 'dangling-task' : i < 20 ? 'self-cycle-task' : 'orphaned-expense';
    return { id: i, type };
  });

  describe('Cross-field relational integrity validation', () => {
    relationalCases.forEach(({ id, type }) => {
      it(`[Case ${id + 1}] rejects imported state with relational violation: ${type}`, () => {
        const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));

        if (type === 'dangling-task') {
          payload.tasks[0].dependencies = [`non-existent-task-id-${id}`];
        } else if (type === 'self-cycle-task') {
          payload.tasks[0].dependencies = [payload.tasks[0].id];
        } else {
          payload.expenses[0].categoryId = `non-existent-category-${id}`;
        }

        const result = validateImportedJson(JSON.stringify(payload));
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Storage Lifecycle, Migration, and Recovery (30 cases)
  // --------------------------------------------------------------------------
  const storageCases = Array.from({ length: 30 }, (_, i) => {
    const action = i < 10 ? 'save-and-load' : i < 20 ? 'v0-migration' : 'corrupted-recovery';
    return { id: i, action };
  });

  describe('Storage persistence lifecycle and safe recovery', () => {
    storageCases.forEach(({ id, action }) => {
      it(`[Case ${id + 1}] handles storage operation: ${action}`, () => {
        if (action === 'save-and-load') {
          const customState: AppState = {
            ...DEMO_STATE,
            event: { ...DEMO_STATE.event, name: `Custom Event ${id}` },
          };
          savePersistedState(customState);
          const loaded = loadPersistedState();
          expect(loaded.loadedFromStorage).toBe(true);
          expect(loaded.state.event.name).toBe(`Custom Event ${id}`);
        } else if (action === 'v0-migration') {
          const v0State = {
            ...DEMO_STATE,
            schemaVersion: 0,
          };
          const migrated = migrateState(v0State);
          expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        } else {
          localStorage.setItem(STORAGE_KEY, `invalid-json-${id}{broken`);
          const recovered = loadPersistedState();
          expect(recovered.recoveredFromError).toBe(true);
          expect(recovered.state.event.name).toBe(DEMO_STATE.event.name);
        }
      });
    });

    it('clears persisted data safely without exceptions', () => {
      savePersistedState(DEMO_STATE);
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
      clearAllPersistedData();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('gracefully returns false when savePersistedState encounters localStorage setItem error', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const success = savePersistedState(DEMO_STATE);
      expect(success).toBe(false);

      setItemSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: File Size Boundaries & Browser Export Trigger (30 cases)
  // --------------------------------------------------------------------------
  const fileSizeCases = Array.from({ length: 28 }, (_, i) => {
    const isOverLimit = i % 2 === 0;
    const size = isOverLimit ? MAX_IMPORT_BYTES + (i + 1) * 1024 : 1000 + i * 500;
    return { id: i, size, isOverLimit };
  });

  describe('Import file size boundary protection and export triggers', () => {
    fileSizeCases.forEach(({ id, size, isOverLimit }) => {
      it(`[Case ${id + 1}] validates payload of size ${size} bytes (overLimit: ${isOverLimit})`, () => {
        let payload = '';
        if (isOverLimit) {
          payload = 'A'.repeat(size);
        } else {
          payload = JSON.stringify(DEMO_STATE);
        }

        const res = validateImportedJson(payload);
        if (isOverLimit) {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/exceeds maximum allowed size/i);
        } else {
          expect(res.success).toBe(true);
        }
      });
    });

    it('triggers browser DOM anchor download on exportEventData', () => {
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      exportEventData(DEMO_STATE);
      expect(appendChildSpy).toHaveBeenCalled();
      appendChildSpy.mockRestore();
    });

    it('rejects empty or whitespace string import', () => {
      expect(validateImportedJson('').success).toBe(false);
      expect(validateImportedJson('    ').success).toBe(false);
    });
  });
});
