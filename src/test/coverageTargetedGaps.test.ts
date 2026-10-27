import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateStateSchema,
  migrateState,
  loadPersistedState,
  clearAllPersistedData,
  STORAGE_KEY,
  EVENTS_STORE_KEY,
  CURRENT_SCHEMA_VERSION,
  createInitialEventState,
  loadMultiEventStore,
  saveMultiEventStore,
} from '../persistence/storage';
import {
  validateImportedJson,
  sanitizeText,
} from '../persistence/importExport';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState, BudgetScenario, CurrencyCode, Task, Vendor, VendorQuote } from '../types';
import { formatCurrency } from '../domain/currency';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
  evaluateScenario,
  initializeCategoriesForBudget,
  classifyCategoryCostType,
  calculateCategoryGuestAdjustments,
} from '../domain/budgetEngine';
import {
  canCompleteTask,
  evaluateTasks,
  detectDependencyCycles,
  computeTopologicalOrder,
} from '../domain/taskEngine';
import {
  compareCategoryVendors,
} from '../domain/vendorEngine';
import {
  validateProposedAction,
  analyzeInputSecurity,
} from '../domain/assistantValidation';
import * as assistantValidationModule from '../domain/assistantValidation';
import {
  detectInputLanguage,
  parseUserIntent,
  generateAssistantResponse,
} from '../domain/assistantEngine';

describe('VowPilot Targeted Coverage Gap Remediation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Persistence & Storage Layer Branch & Edge-Case Coverage
  // ==========================================================================
  describe('1. persistence/storage.ts edge cases', () => {
    it('validates dangerous key edge cases with primitives and safe objects', () => {
      expect(validateStateSchema(null)).toBe(false);
      expect(validateStateSchema(123)).toBe(false);
      expect(validateStateSchema('string')).toBe(false);
    });

    it('rejects state when event preferences is an array or primitive', () => {
      const invalidPrefsArray = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, preferences: ['invalid'] as any },
      };
      expect(validateStateSchema(invalidPrefsArray)).toBe(false);

      const invalidPrefsPrimitive = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, preferences: 'invalid' as any },
      };
      expect(validateStateSchema(invalidPrefsPrimitive)).toBe(false);
    });

    it('rejects categories containing non-objects or arrays', () => {
      const invalidCatObj = {
        ...DEMO_STATE,
        categories: [null as any],
      };
      expect(validateStateSchema(invalidCatObj)).toBe(false);

      const invalidCatArray = {
        ...DEMO_STATE,
        categories: [['nested-array'] as any],
      };
      expect(validateStateSchema(invalidCatArray)).toBe(false);
    });

    it('rejects tasks with malformed fields (empty categoryId, non-array deps, non-string dep)', () => {
      const taskNonObj = {
        ...DEMO_STATE,
        tasks: [null as any],
      };
      expect(validateStateSchema(taskNonObj)).toBe(false);

      const taskEmptyCat = {
        ...DEMO_STATE,
        tasks: [{ ...DEMO_STATE.tasks[0], categoryId: '' }],
      };
      expect(validateStateSchema(taskEmptyCat)).toBe(false);

      const taskEmptyDue = {
        ...DEMO_STATE,
        tasks: [{ ...DEMO_STATE.tasks[0], dueDate: '' }],
      };
      expect(validateStateSchema(taskEmptyDue)).toBe(false);

      const taskNonArrayDeps = {
        ...DEMO_STATE,
        tasks: [{ ...DEMO_STATE.tasks[0], dependencies: 'not-an-array' as any }],
      };
      expect(validateStateSchema(taskNonArrayDeps)).toBe(false);

      const taskNonStringDep = {
        ...DEMO_STATE,
        tasks: [{ ...DEMO_STATE.tasks[0], dependencies: [123 as any] }],
      };
      expect(validateStateSchema(taskNonStringDep)).toBe(false);
    });

    it('rejects expenses with malformed fields', () => {
      const expNonObj = {
        ...DEMO_STATE,
        expenses: [null as any],
      };
      expect(validateStateSchema(expNonObj)).toBe(false);

      const expEmptyId = {
        ...DEMO_STATE,
        expenses: [{ ...DEMO_STATE.expenses[0], id: '' }],
      };
      expect(validateStateSchema(expEmptyId)).toBe(false);

      const expEmptyCat = {
        ...DEMO_STATE,
        expenses: [{ ...DEMO_STATE.expenses[0], categoryId: '' }],
      };
      expect(validateStateSchema(expEmptyCat)).toBe(false);
    });

    it('rejects vendors with malformed fields', () => {
      const venNonObj = {
        ...DEMO_STATE,
        vendors: [null as any],
      };
      expect(validateStateSchema(venNonObj)).toBe(false);

      const venEmptyCat = {
        ...DEMO_STATE,
        vendors: [{ ...DEMO_STATE.vendors[0], categoryId: '' }],
      };
      expect(validateStateSchema(venEmptyCat)).toBe(false);
    });

    it('rejects quotes with non-finite or negative quotedAmount and invalid currency', () => {
      const quoNonObj = {
        ...DEMO_STATE,
        quotes: [null as any],
      };
      expect(validateStateSchema(quoNonObj)).toBe(false);

      const quoNegAmount = {
        ...DEMO_STATE,
        quotes: [{ ...DEMO_STATE.quotes[0], quotedAmount: -500 }],
      };
      expect(validateStateSchema(quoNegAmount)).toBe(false);

      const quoInvalidCurrency = {
        ...DEMO_STATE,
        quotes: [{ ...DEMO_STATE.quotes[0], currency: 'INVALID' as any }],
      };
      expect(validateStateSchema(quoInvalidCurrency)).toBe(false);
    });

    it('rejects scenarios with malformed fields', () => {
      const scenNonObj = {
        ...DEMO_STATE,
        scenarios: [null as any],
      };
      expect(validateStateSchema(scenNonObj)).toBe(false);

      const scenEmptyId = {
        ...DEMO_STATE,
        scenarios: [{ id: '', name: 'Test', modifiedGuestCount: 100, categoryAllocations: {} }],
      };
      expect(validateStateSchema(scenEmptyId)).toBe(false);

      const scenEmptyName = {
        ...DEMO_STATE,
        scenarios: [{ id: 's1', name: '', modifiedGuestCount: 100, categoryAllocations: {} }],
      };
      expect(validateStateSchema(scenEmptyName)).toBe(false);

      const scenNegGuests = {
        ...DEMO_STATE,
        scenarios: [{ id: 's1', name: 'Test', modifiedGuestCount: -10, categoryAllocations: {} }],
      };
      expect(validateStateSchema(scenNegGuests)).toBe(false);

      const scenNonObjAlloc = {
        ...DEMO_STATE,
        scenarios: [{ id: 's1', name: 'Test', modifiedGuestCount: 100, categoryAllocations: 'bad' as any }],
      };
      expect(validateStateSchema(scenNonObjAlloc)).toBe(false);
    });

    it('rejects invitations with malformed items', () => {
      expect(validateStateSchema({ ...DEMO_STATE, invitations: 'bad' as any })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, invitations: [null as any] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, invitations: [{ id: '', title: 'Inv', templateId: 't1' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, invitations: [{ id: 'i1', title: 123 as any, templateId: 't1' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, invitations: [{ id: 'i1', title: 'Inv', templateId: 123 as any }] })).toBe(false);
    });

    it('rejects guests with malformed items', () => {
      expect(validateStateSchema({ ...DEMO_STATE, guests: 'bad' as any })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [null as any] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [{ id: '', name: 'Guest', partySize: 1, confirmedCount: 1, rsvpStatus: 'accepted' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [{ id: 'g1', name: '', partySize: 1, confirmedCount: 1, rsvpStatus: 'accepted' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [{ id: 'g1', name: 'Guest', partySize: 0, confirmedCount: 0, rsvpStatus: 'accepted' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [{ id: 'g1', name: 'Guest', partySize: 2, confirmedCount: -1, rsvpStatus: 'accepted' }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, guests: [{ id: 'g1', name: 'Guest', partySize: 2, confirmedCount: 1, rsvpStatus: 'invalid_status' as any }] })).toBe(false);
    });

    it('rejects timeline with malformed items', () => {
      expect(validateStateSchema({ ...DEMO_STATE, timeline: 'bad' as any })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, timeline: [null as any] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, timeline: [{ id: '', activity: 'Ceremony', time: '10:00', durationMinutes: 60 }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, timeline: [{ id: 't1', activity: '', time: '10:00', durationMinutes: 60 }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, timeline: [{ id: 't1', activity: 'Ceremony', time: 123 as any, durationMinutes: 60 }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, timeline: [{ id: 't1', activity: 'Ceremony', time: '10:00', durationMinutes: -5 }] })).toBe(false);
    });

    it('rejects tables with malformed items', () => {
      expect(validateStateSchema({ ...DEMO_STATE, tables: 'bad' as any })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, tables: [null as any] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, tables: [{ id: '', name: 'Table 1', capacity: 8, assignedGuestIds: [] }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, tables: [{ id: 'tb1', name: '', capacity: 8, assignedGuestIds: [] }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, tables: [{ id: 'tb1', name: 'Table 1', capacity: 0, assignedGuestIds: [] }] })).toBe(false);
      expect(validateStateSchema({ ...DEMO_STATE, tables: [{ id: 'tb1', name: 'Table 1', capacity: 8, assignedGuestIds: 'bad' as any }] })).toBe(false);
    });

    it('handles loadPersistedState when stored JSON fails schema validation', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, event: null }));

      const res = loadPersistedState();
      expect(res.loadedFromStorage).toBe(false);
      expect(res.recoveredFromError).toBe(true);
      expect(res.state.event.name).toBe(DEMO_STATE.event.name);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handles loadPersistedState schemaVersion: 0 migration branch', () => {
      const v0State = {
        ...DEMO_STATE,
        schemaVersion: 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v0State));

      const res = loadPersistedState();
      expect(res.loadedFromStorage).toBe(true);
      expect(res.migrationApplied).toBe(true);
      expect(res.recoveredFromError).toBe(false);
      expect(res.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('rejects unsupported future and invalid fractional schema versions safely in validateStateSchema', () => {
      const futureSchemaState = { ...DEMO_STATE, schemaVersion: 99 };
      expect(validateStateSchema(futureSchemaState)).toBe(false);

      const fractionalSchemaState = { ...DEMO_STATE, schemaVersion: 1.5 };
      expect(validateStateSchema(fractionalSchemaState)).toBe(false);

      const negativeSchemaState = { ...DEMO_STATE, schemaVersion: -1 };
      expect(validateStateSchema(negativeSchemaState)).toBe(false);

      // Verify safe fallback in loadPersistedState when stored payload has future schema version
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(futureSchemaState));
      const res = loadPersistedState();
      expect(res.loadedFromStorage).toBe(false);
      expect(res.recoveredFromError).toBe(true);
      expect(res.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handles clearAllPersistedData when localStorage.removeItem throws', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      expect(() => clearAllPersistedData()).not.toThrow();
      expect(errSpy).toHaveBeenCalledWith('VowPilot: Error clearing localStorage:', expect.any(Error));

      errSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('accepts legacy state when optional collections (invitations, guests, timeline, tables) are undefined', () => {
      const { invitations, guests, timeline, tables, ...legacyV1State } = DEMO_STATE;
      expect(validateStateSchema(legacyV1State)).toBe(true);
    });

    it('falls back safely to empty arrays for all missing or non-array collections in migrateState', () => {
      const migrated = migrateState({});
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.categories).toEqual([]);
      expect(migrated.tasks).toEqual([]);
      expect(migrated.expenses).toEqual([]);
      expect(migrated.vendors).toEqual([]);
      expect(migrated.quotes).toEqual([]);
      expect(migrated.scenarios).toEqual([]);
      expect(migrated.messages).toEqual([]);
      expect(migrated.changeLog).toEqual([]);
      expect(migrated.invitations).toEqual([]);
      expect(migrated.guests).toEqual([]);
      expect(migrated.timeline).toEqual([]);
      expect(migrated.tables).toEqual([]);
    });
  });

  // ==========================================================================
  // 2. Import / Export & Sanitization Branch Coverage
  // ==========================================================================
  describe('2. persistence/importExport.ts branch coverage', () => {
    it('rejects imported JSON when expense references non-existent vendor ID (lines 85-88)', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      payload.expenses[0].vendorId = 'non-existent-vendor-xyz';

      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(false);
      expect(res.error).toContain('references non-existent vendor ID');
    });

    it('rejects imported JSON when quote references non-existent vendor ID (lines 95-98)', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      payload.quotes[0].vendorId = 'non-existent-vendor-xyz';

      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(false);
      expect(res.error).toContain('references non-existent vendor ID');
    });

    it('safely handles non-string input in sanitizeText (line 184)', () => {
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
      expect(sanitizeText(123 as any)).toBe('');
      expect(sanitizeText({} as any)).toBe('');
    });

    it('exercises all optional preference branches in validateImportedJson (lines 111-124)', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      // Test with missing/falsy optional preferences and specialConstraints as string
      (payload.event as any).preferences = {
        style: '',
        cateringType: '',
        venuePreference: '',
        decorationPreference: '',
        photographyTier: '',
        specialConstraints: 'Single string constraint',
        optionalNotes: '',
        dietaryRequirements: undefined,
        accessibilityNeeds: undefined,
      };

      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(true);
      expect(res.state?.event.preferences?.specialConstraints).toEqual(['Single string constraint']);
    });

    it('exercises optional notes and rationale branches in validateImportedJson', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      payload.expenses[0].notes = 'Itemized note';
      payload.vendors[0].notes = 'Vendor note';
      payload.quotes[0].includedServices = undefined as any;
      payload.quotes[0].exclusions = undefined as any;
      payload.messages[0].rationale = 'Decision rationale';

      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(true);
      expect(res.state?.expenses[0].notes).toBe('Itemized note');
      expect(res.state?.vendors[0].notes).toBe('Vendor note');
      expect(res.state?.messages[0].rationale).toBe('Decision rationale');
    });

    it('exercises non-array and non-string specialConstraints fallback to empty array', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      (payload.event as any).preferences = {
        ...payload.event.preferences,
        specialConstraints: 12345 as any,
      };
      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(true);
      expect(res.state?.event.preferences?.specialConstraints).toEqual([]);
    });

    it('exercises falsy optional string fields and undefined notes in validateImportedJson', () => {
      const payload: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
      payload.expenses[0].notes = undefined;
      payload.tasks[0].description = undefined as any;
      payload.tasks[0].priorityReason = undefined as any;
      payload.vendors[0].contactName = undefined as any;
      payload.vendors[0].email = undefined as any;
      payload.vendors[0].phone = undefined as any;
      payload.vendors[0].notes = undefined;
      payload.quotes[0].paymentTerms = undefined as any;
      payload.scenarios[0].description = undefined as any;
      payload.scenarios[0].notes = undefined as any;
      payload.messages[0].rationale = undefined;

      const res = validateImportedJson(JSON.stringify(payload));
      expect(res.success).toBe(true);
      expect(res.state?.expenses[0].notes).toBeUndefined();
      expect(res.state?.tasks[0].description).toBe('');
      expect(res.state?.tasks[0].priorityReason).toBe('');
      expect(res.state?.vendors[0].contactName).toBe('');
      expect(res.state?.vendors[0].email).toBe('');
      expect(res.state?.vendors[0].phone).toBe('');
      expect(res.state?.vendors[0].notes).toBeUndefined();
      expect(res.state?.quotes[0].paymentTerms).toBe('');
      expect(res.state?.scenarios[0].description).toBe('');
      expect(res.state?.scenarios[0].notes).toBe('');
      expect(res.state?.messages[0].rationale).toBeUndefined();
    });

    it('handles non-Error thrown during JSON parse in validateImportedJson', () => {
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw 'non-error string exception';
      });

      const res = validateImportedJson('{ invalid');
      expect(res.success).toBe(false);
      expect(res.error).toBe('JSON parse error: Unknown error');

      parseSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 3. Domain: Currency Formatting Fallback Branch Coverage
  // ==========================================================================
  describe('3. domain/currency.ts branch coverage', () => {
    it('falls back to default currency symbol when given unknown currency code (line 47)', () => {
      const formatted = formatCurrency(50000, 'CAD' as unknown as CurrencyCode);
      expect(formatted).toBe('₹500');
    });
  });

  // ==========================================================================
  // 4. Domain: Budget Engine Branch Coverage
  // ==========================================================================
  describe('4. domain/budgetEngine.ts branch coverage', () => {
    it('aggregates expenses belonging to unlisted or custom categories (lines 68-71)', () => {
      const categories = DEMO_STATE.categories;
      const expenses = [
        ...DEMO_STATE.expenses,
        {
          id: 'exp-unlisted-1',
          categoryId: 'unlisted-category-99',
          title: 'Custom Pop-up Bar',
          amount: 500000,
          status: 'actual' as const,
          paidAmount: 500000,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ];

      const overview = calculateBudgetOverview(DEMO_STATE.event.totalBudget, categories, expenses);
      expect(overview.sumActual).toBeGreaterThan(0);
      expect(overview.committedTotal).toBeGreaterThan(0);
    });

    it('emits missingDataWarnings when catering category has no per-guest cost (lines 200-202)', () => {
      const stateWithoutPerGuest: AppState = {
        ...DEMO_STATE,
        categories: DEMO_STATE.categories.map((c) =>
          c.id === 'catering' ? { ...c, perGuestCost: 0 } : c
        ),
      };

      const result = calculateGuestCountImpact(stateWithoutPerGuest, 250);
      expect(result.missingDataWarnings).toBeDefined();
      expect(result.missingDataWarnings.length).toBeGreaterThan(0);
      expect(result.missingDataWarnings[0]).toContain('Catering does not have a configured per-guest cost');
    });

    it('skips categories with zero or negative flexible budget in priority reductions (line 293)', () => {
      const overview = calculateBudgetOverview(DEMO_STATE.event.totalBudget, DEMO_STATE.categories, DEMO_STATE.expenses);
      // Make a fully committed category by setting committedTotal >= allocatedAmount
      overview.categories[0].committedTotal = overview.categories[0].allocatedAmount;

      const recs = generatePriorityAwareRecommendations(overview, ['venue', 'catering'], 200000);
      expect(recs.recommendations.every((r) => r.categoryId !== overview.categories[0].category.id)).toBe(true);
    });

    it('handles non-finite totalBudget, expense amounts, and category allocations safely in calculateBudgetOverview', () => {
      const nonFiniteOverview = calculateBudgetOverview(
        NaN,
        [{ id: 'cat-nan', name: 'NaN Cat', allocatedAmount: NaN, userDefined: false, priorityRank: 1 }],
        [{ id: 'exp-nan', categoryId: 'cat-nan', title: 'NaN Exp', amount: NaN, status: 'estimated', paidAmount: 0, createdAt: '' }]
      );
      expect(nonFiniteOverview.totalBudget).toBe(0);
      expect(nonFiniteOverview.totalAllocated).toBe(0);
      expect(nonFiniteOverview.sumEstimated).toBe(0);
      expect(nonFiniteOverview.utilizationPercentage).toBe(0);
    });

    it('handles zero guestCount and non-finite target headcount in calculateGuestCountImpact', () => {
      const zeroGuestState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, guestCount: 0 },
      };
      const res = calculateGuestCountImpact(zeroGuestState, NaN);
      expect(res.missingDataWarnings.some((w) => w.includes('Invalid guest count'))).toBe(true);
    });

    it('exercises flexibleBudget <= 0 continue and confirmed vendors rationale in generatePriorityAwareRecommendations', () => {
      const fullyCommittedCat = { id: 'cat-locked', name: 'Locked Category', allocatedAmount: 50000, userDefined: false, priorityRank: 2 };
      const decorCat = DEMO_STATE.categories[3];
      const overview = calculateBudgetOverview(DEMO_STATE.event.totalBudget, [fullyCommittedCat, decorCat], [
        {
          id: 'exp-locked-1',
          categoryId: 'cat-locked',
          title: 'Fully Locked Expense',
          amount: 50000,
          status: 'confirmed',
          paidAmount: 50000,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'exp-decor-1',
          categoryId: decorCat.id,
          title: 'Partial Decor Commitment',
          amount: 50000,
          status: 'confirmed',
          paidAmount: 50000,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ]);
      const recs = generatePriorityAwareRecommendations(overview, [decorCat.id], 500000);
      expect(recs.recommendations.some((r) => r.categoryId === 'cat-locked')).toBe(false);
      const decorRec = recs.recommendations.find((r) => r.categoryId === decorCat.id);
      expect(decorRec?.rationale).toContain('confirmed vendors');
    });

    it('falls back to baseline allocation in evaluateScenario when category is omitted from scenario allocations', () => {
      const scenario: BudgetScenario = {
        id: 'scen-partial',
        name: 'Partial Scenario',
        description: 'Partial Scenario Description',
        createdAt: '2026-10-01',
        modifiedGuestCount: 150,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const result = evaluateScenario(DEMO_STATE, scenario);
      expect(result.categoryComparisons.length).toBe(DEMO_STATE.categories.length);
      expect(result.categoryComparisons[0].scenarioAllocated).toBe(DEMO_STATE.categories[0].allocatedAmount);
    });
  });

  // ==========================================================================
  // 5. Domain: Task Engine Branch Coverage
  // ==========================================================================
  describe('5. domain/taskEngine.ts branch coverage', () => {
    it('returns Task not found when canCompleteTask is called with non-existent ID (line 36)', () => {
      const result = canCompleteTask('non-existent-task-id', DEMO_STATE.tasks);
      expect(result.allowed).toBe(false);
      expect(result.blockingTaskTitles).toContain('Task not found');
    });

    it('flags self-referencing dependency in evaluateTasks (lines 153-154)', () => {
      const tasksWithSelfRef: Task[] = [
        {
          ...DEMO_STATE.tasks[0],
          id: 'task-self-1',
          dependencies: ['task-self-1'],
        },
      ];

      const evaluations = evaluateTasks(tasksWithSelfRef, '2026-12-01');
      expect(evaluations[0].risks.missingPrerequisites).toContain('Self-referencing dependency');
    });

    it('handles undefined dependencies and missing neighbor IDs in cycle detection and topological order', () => {
      const taskWithUndefDeps: Task = {
        ...DEMO_STATE.tasks[0],
        id: 't-undef-deps',
        dependencies: undefined as any,
      };
      const taskWithMissingDep: Task = {
        ...DEMO_STATE.tasks[1],
        id: 't-missing-dep',
        dependencies: ['non-existent-task-id-xyz'],
      };

      const cycleResult = detectDependencyCycles([taskWithUndefDeps, taskWithMissingDep]);
      expect(cycleResult.hasCycle).toBe(false);

      const order = computeTopologicalOrder([taskWithMissingDep]);
      expect(order.length).toBe(1);
    });

    it('returns plural tasks rationale when a task blocks multiple downstream tasks', () => {
      const parentTask: Task = {
        id: 't-parent',
        title: 'Parent Task',
        description: 'Blocks two children',
        categoryId: 'venue',
        status: 'not_started',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-11-01',
        dependencies: [],
      };
      const child1: Task = {
        id: 't-child-1',
        title: 'Child 1',
        description: '',
        categoryId: 'venue',
        status: 'not_started',
        priority: 'medium',
        priorityReason: '',
        dueDate: '2026-11-10',
        dependencies: ['t-parent'],
      };
      const child2: Task = {
        id: 't-child-2',
        title: 'Child 2',
        description: '',
        categoryId: 'venue',
        status: 'not_started',
        priority: 'medium',
        priorityReason: '',
        dueDate: '2026-11-15',
        dependencies: ['t-parent'],
      };

      const evaluations = evaluateTasks([parentTask, child1, child2], '2026-10-01');
      const parentEval = evaluations.find((e) => e.task.id === 't-parent');
      expect(parentEval?.priorityRationale).toBe('Blocks 2 downstream tasks. High scheduling impact.');
    });

    it('returns critical path rationale for critical priority task with no blockers (line 261)', () => {
      const task: Task = {
        id: 'crit-task-1',
        title: 'Sign Key Contract',
        description: 'Sign venue contract',
        categoryId: 'venue',
        status: 'not_started',
        priority: 'critical',
        priorityReason: '',
        dueDate: '2026-11-20',
        dependencies: [],
      };

      const evaluations = evaluateTasks([task], '2026-11-01');
      expect(evaluations[0].priorityRationale).toBe('Critical path item: Crucial contractual or booking requirement.');
    });

    it('returns past target date rationale for completed task with past due date (line 265)', () => {
      const task: Task = {
        id: 'overdue-completed-task-1',
        title: 'Send Save the Dates',
        description: 'Send invitation cards',
        categoryId: 'invitations',
        status: 'completed',
        priority: 'medium',
        priorityReason: '',
        dueDate: '2026-10-01',
        dependencies: [],
      };

      const evaluations = evaluateTasks([task], '2026-11-01');
      expect(evaluations[0].priorityRationale).toBe('Past target completion date.');
    });
  });

  // ==========================================================================
  // 6. Domain: Assistant Validation Branch Coverage
  // ==========================================================================
  describe('6. domain/assistantValidation.ts branch coverage', () => {
    it('validates non-negative integer check in cut_category_budget (line 98)', () => {
      const action = {
        id: 'act-cut-1',
        type: 'cut_category_budget' as const,
        summary: 'Cut budget',
        impact: {
          currentEstimatedTotal: 100000,
          proposedEstimatedTotal: 50000,
          difference: -50000,
          remainingBudget: 50000,
          affectedCategories: [DEMO_STATE.categories[0].name],
          budgetViolations: [],
        },
        payload: {
          adjustments: [{ categoryId: DEMO_STATE.categories[0].id, newAllocated: -50000 }],
        },
      };

      const res = validateProposedAction(action, DEMO_STATE);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('must be a non-negative integer');
    });

    it('validates cut_category_budget against actual expenses and accepts valid reduction above committed spend', () => {
      const cat = DEMO_STATE.categories[0];
      const stateWithActual: AppState = {
        ...DEMO_STATE,
        expenses: [
          {
            id: 'exp-act-1',
            categoryId: cat.id,
            title: 'Paid Advance',
            amount: 50000,
            status: 'actual',
            paidAmount: 50000,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
          {
            id: 'exp-est-1',
            categoryId: cat.id,
            title: 'Estimate Only',
            amount: 30000,
            status: 'estimated',
            paidAmount: 0,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      };

      const validAction = {
        id: 'act-valid-cut',
        type: 'cut_category_budget' as const,
        summary: 'Safe cut above committed spend',
        impact: {
          currentEstimatedTotal: cat.allocatedAmount,
          proposedEstimatedTotal: 80000,
          difference: 80000 - cat.allocatedAmount,
          remainingBudget: 10000,
          affectedCategories: [cat.name],
          budgetViolations: [],
        },
        payload: {
          adjustments: [{ categoryId: cat.id, newAllocated: 60000 }],
        },
      };

      const res = validateProposedAction(validAction, stateWithActual);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('handles empty input in analyzeInputSecurity (lines 178-180)', () => {
      const res = analyzeInputSecurity('');
      expect(res.isHostile).toBe(false);
      expect(res.sanitizedText).toBe('');
    });
  });

  // ==========================================================================
  // 6b. Domain: Vendor Engine Branch Coverage
  // ==========================================================================
  describe('6b. domain/vendorEngine.ts branch coverage', () => {
    it('handles vendors without quotes and quotes with missing currency in compareCategoryVendors', () => {
      const vendorWithoutQuote: Vendor = {
        id: 'v-no-quote',
        name: 'Unquoted Studio',
        categoryId: 'photography',
        contactName: 'Studio Contact',
        email: 'unquoted@studio.com',
        phone: '1234567890',
        isSample: true,
        createdAt: '2026-10-01',
      };
      const vendorWithEmptyCurrQuote: Vendor = {
        id: 'v-with-quote',
        name: 'Quote Studio',
        categoryId: 'photography',
        contactName: 'Studio Contact',
        email: 'quote@studio.com',
        phone: '1234567890',
        isSample: true,
        createdAt: '2026-10-01',
      };
      const quoteWithoutCurrency: VendorQuote = {
        id: 'q-no-curr',
        vendorId: 'v-with-quote',
        quoteDate: '2026-10-01',
        quotedAmount: 50000,
        currency: '' as any,
        status: 'draft',
        includedServices: [],
        exclusions: [],
        paymentTerms: '',
        isSample: true,
      };
      const comparison = compareCategoryVendors(
        'photography',
        'Photography',
        [vendorWithoutQuote, vendorWithEmptyCurrQuote],
        [quoteWithoutCurrency]
      );
      expect(comparison.rows.some((r) => r.missingDetails.includes('No formal quotation submitted yet'))).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Domain: Assistant Engine Branch Coverage
  // ==========================================================================
  describe('7. domain/assistantEngine.ts branch coverage', () => {
    it('returns en when detectInputLanguage is called with empty string (line 45)', () => {
      expect(detectInputLanguage('')).toBe('en');
    });

    it('deterministically handles intent cache saturation and oldest key eviction across 500+ unique queries', () => {
      for (let i = 0; i <= 510; i++) {
        const result = parseUserIntent(`Unique test intent query #${i}`);
        expect(result.intent).toBeDefined();
      }
      // Re-query an existing item to ensure cache retrieval remains healthy after eviction
      const repeated = parseUserIntent('Unique test intent query #510');
      expect(repeated.intent).toBeDefined();
    });

    it('reports no schedule conflicts when event schedule is conflict-free in English and Bengali (lines 611-629)', () => {
      const cleanState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, date: '2026-12-31' },
        tasks: [
          {
            id: 't-clean-1',
            title: 'Early Task',
            description: 'Completed early task',
            categoryId: 'venue',
            status: 'completed',
            priority: 'high',
            priorityReason: '',
            dueDate: '2026-11-01',
            dependencies: [],
          },
        ],
      };

      const enRes = generateAssistantResponse('Are there any schedule conflicts?', cleanState);
      expect(enRes.content).toContain('No Schedule Conflicts Detected');

      const bnRes = generateAssistantResponse('সময়সূচিতে কোনো সংঘাত আছে?', cleanState);
      expect(bnRes.content).toContain('সময়সূচিতে কোনো সংঘাত নেই');
    });

    it('handles interpret_quote_terms when quotes array is empty (lines 716-725)', () => {
      const stateNoQuotes: AppState = { ...DEMO_STATE, quotes: [] };
      const res = generateAssistantResponse('Interpret quote terms', stateNoQuotes);
      expect(res.content).toContain('No vendor quotations have been recorded yet');
    });

    it('handles explain_budget when categories array is empty (lines 774-783)', () => {
      const stateNoCats: AppState = { ...DEMO_STATE, categories: [] };
      const res = generateAssistantResponse('Explain my budget', stateNoCats);
      expect(res.content).toContain('No budget categories have been configured yet');
    });

    it('handles suggest_expense_reductions when recommendations array is empty (lines 927-939)', () => {
      // Fully committed categories
      const stateCommitted: AppState = {
        ...DEMO_STATE,
        categories: DEMO_STATE.categories.map((c) => ({ ...c, allocatedAmount: 100000 })),
        expenses: DEMO_STATE.categories.map((c) => ({
          id: `exp-${c.id}`,
          categoryId: c.id,
          title: `Commitment for ${c.name}`,
          amount: 100000,
          status: 'confirmed' as const,
          paidAmount: 100000,
          createdAt: '2026-10-01T00:00:00.000Z',
        })),
      };

      const res = generateAssistantResponse('Suggest expense reductions', stateCommitted);
      expect(res.content).toBeDefined();
    });

    it('handles find_overdue_tasks when no tasks are overdue (lines 1047-1056)', () => {
      const stateFuture: AppState = {
        ...DEMO_STATE,
        tasks: DEMO_STATE.tasks.map((t) => ({ ...t, dueDate: '2030-01-01' })),
      };

      const res = generateAssistantResponse('Find overdue tasks', stateFuture);
      expect(res.content).toContain('No overdue tasks');
    });

    it('handles explain_blocked_tasks when no tasks are blocked (lines 1083-1092)', () => {
      const stateUnblocked: AppState = {
        ...DEMO_STATE,
        tasks: DEMO_STATE.tasks.map((t) => ({ ...t, dependencies: [] })),
      };

      const res = generateAssistantResponse('Explain blocked tasks', stateUnblocked);
      expect(res.content).toContain('No tasks are currently blocked');
    });

    it('handles compare_vendor_quotes when vendors array is empty (lines 1117-1126)', () => {
      const stateNoVendors: AppState = { ...DEMO_STATE, vendors: [], quotes: [] };
      const res = generateAssistantResponse('Compare vendor quotes', stateNoVendors);
      expect(res.content).toContain('No vendor records have been added to compare yet');
    });

    it('handles identify_missing_vendor_info when all quotes are complete (lines 1182-1191)', () => {
      const completeQuotesState: AppState = {
        ...DEMO_STATE,
        quotes: DEMO_STATE.quotes.map((q) => ({
          ...q,
          includedServices: ['Service 1'],
          exclusions: ['Exclusion 1'],
          validityDate: '2026-12-31',
          paymentTerms: '50% advance',
        })),
      };

      const res = generateAssistantResponse('Identify missing vendor info', completeQuotesState);
      expect(res.content).toContain('All submitted quotations currently include itemized inclusions');
    });

    it('handles unsupported and security-rejected requests with honest fallback (lines 1260-1285)', () => {
      const enRes = generateAssistantResponse('Book the venue for me and hire caterer', DEMO_STATE);
      expect(enRes.intent).toBe('unsupported');
      expect(enRes.dataGrounding).toBe('unsupported_request');
      expect(enRes.content).toContain("I did not recognize a supported planning command");

      const bnRes = generateAssistantResponse('ভেন্যু বুক করে দাও', DEMO_STATE);
      expect(bnRes.intent).toBe('unsupported');
      expect(bnRes.dataGrounding).toBe('unsupported_request');
      expect(bnRes.content).toContain('আমি VowPilot-এর সুনির্দিষ্ট পরিকল্পনা ইঞ্জিন');
    });

    it('handles non-string input safely in parseUserIntent', () => {
      expect(parseUserIntent(null as any).intent).toBe('unsupported');
    });

    it('handles location query keyword variations in query_event_schedule', () => {
      expect(parseUserIntent('where is wedding').intent).toBe('query_event_schedule');
      expect(parseUserIntent('where is venue').intent).toBe('query_event_schedule');
    });

    it('ignores candidate words starting with details in category budget inquiry', () => {
      const res = parseUserIntent('how much budget for details of package');
      expect(res.intent).toBe('explain_budget');
    });

    it('exercises priority protect keywords in English and Bengali without short-circuiting', () => {
      expect(parseUserIntent('priority category').intent).toBe('protect_priority');
      expect(parseUserIntent('priority venue').intent).toBe('protect_priority');
      expect(parseUserIntent('priority catering').intent).toBe('protect_priority');
      expect(parseUserIntent('priority decor').intent).toBe('protect_priority');
      expect(parseUserIntent('priority top').intent).toBe('protect_priority');

      expect(parseUserIntent('অগ্রাধিকার ক্যাটাগরি').intent).toBe('protect_priority');
      expect(parseUserIntent('গুরুত্বপূর্ণ ক্যাটাগরি').intent).toBe('protect_priority');
      expect(parseUserIntent('শীর্ষ ক্যাটাগরি').intent).toBe('protect_priority');
    });

    it('recognizes overdue queries with deri and task keywords', () => {
      expect(parseUserIntent('ei task ta deri hocche').intent).toBe('find_overdue_tasks');
    });

    it('formats countdown and overdue notices in query_event_schedule for past event dates', () => {
      const pastState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, date: '2020-01-01' },
        tasks: [
          {
            id: 't-past-overdue',
            title: 'Past Task',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'high',
            priorityReason: '',
            dueDate: '2020-01-01',
            dependencies: [],
          },
        ],
      };
      const res = generateAssistantResponse('when is the event?', pastState);
      expect(res.content).toContain('days ago');
      expect(res.content).toContain('overdue');
    });

    it('reports circular dependencies, post-event deadlines, and blocked high priority tasks in detect_schedule_conflicts', () => {
      const conflictState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, date: '2026-12-01' },
        tasks: [
          {
            id: 't-cyc-1',
            title: 'Cycle Task A',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'critical',
            priorityReason: '',
            dueDate: '2026-11-01',
            dependencies: ['t-cyc-2'],
          },
          {
            id: 't-cyc-2',
            title: 'Cycle Task B',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'high',
            priorityReason: '',
            dueDate: '2026-11-02',
            dependencies: ['t-cyc-1'],
          },
          {
            id: 't-post-event',
            title: 'Post Event Followup',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'low',
            priorityReason: '',
            dueDate: '2026-12-25',
            dependencies: [],
          },
        ],
      };
      const res = generateAssistantResponse('detect schedule conflicts', conflictState);
      expect(res.content).toContain('Circular Dependency Cycle');
      expect(res.content).toContain('Deadlines Scheduled After Event Date');
      expect(res.content).toContain('Blocked Critical Milestones');
    });

    it('reports category budget overrun when expenses exceed allocated amount in query_category_budget', () => {
      const overrunCatState: AppState = {
        ...DEMO_STATE,
        categories: [
          { id: 'catering', name: 'Catering', allocatedAmount: 20000, userDefined: false, priorityRank: 1 },
        ],
        expenses: [
          {
            id: 'exp-big',
            categoryId: 'catering',
            title: 'Big Expense',
            amount: 50000,
            status: 'confirmed',
            paidAmount: 50000,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      };
      const res = generateAssistantResponse('how much for catering?', overrunCatState);
      expect(res.content).toContain('Overrun of');
    });

    it('audits quote validity including expired quotes, missing payment terms, and empty inclusions', () => {
      const auditState: AppState = {
        ...DEMO_STATE,
        vendors: [
          { id: 'v-known', name: 'Known Caterer', categoryId: 'catering', contactName: 'Chef', email: 'chef@caterer.com', phone: '1234567890', isSample: true, createdAt: '2026-10-01' },
        ],
        quotes: [
          {
            id: 'q-expired-unknown-vendor',
            vendorId: 'v-ghost-vendor',
            quoteDate: '2026-01-01',
            quotedAmount: 100000,
            currency: 'INR',
            status: 'expired',
            validityDate: '2020-01-01',
            paymentTerms: '',
            includedServices: [],
            exclusions: [],
            isSample: true,
          },
          {
            id: 'q-active-sparse',
            vendorId: 'v-known',
            quoteDate: '2026-01-01',
            quotedAmount: 200000,
            currency: 'INR',
            status: 'selected',
            validityDate: '2030-01-01',
            paymentTerms: '',
            includedServices: [],
            exclusions: [],
            isSample: true,
          },
        ],
      };
      const res = generateAssistantResponse('quote terms and validity', auditState);
      expect(res.content).toContain('Expired Quotations');
      expect(res.content).toContain('Terms pending agreement');
      expect(res.content).toContain('None specified');
    });

    it('warns when total budget has an overrun in explain_budget', () => {
      const overrunState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 50000 },
        expenses: [
          {
            id: 'exp-overrun',
            categoryId: DEMO_STATE.categories[0].id,
            title: 'Heavy Spend',
            amount: 200000,
            status: 'actual',
            paidAmount: 200000,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      };
      const res = generateAssistantResponse('explain my budget', overrunState);
      expect(res.content).toContain('The plan is currently over budget by');
    });

    it('handles venue capacity note, zero variable categories, and missing data warnings in change_guest_count', () => {
      const stateWithCapacityNote: AppState = {
        ...DEMO_STATE,
        categories: [
          {
            id: 'venue',
            name: 'Palace Venue',
            allocatedAmount: 500000,
            userDefined: false,
            priorityRank: 1,
            notes: 'Grand Ballroom capacity: 200 guests',
          },
          {
            id: 'decor',
            name: 'Decorations',
            allocatedAmount: 100000,
            userDefined: false,
            priorityRank: 2,
          },
        ],
      };
      const res = generateAssistantResponse('change guest count to 250', stateWithCapacityNote);
      expect(res.content).toContain('Capacity Constraint Alert');
      expect(res.content).toContain('None (no variable per-guest costs configured)');
    });

    it('handles reduce_budget imperative across state permutations (zero categories, full commitments, overrun, and viable cuts)', () => {
      // 1. Zero categories
      const noCatRes = generateAssistantResponse('reduce expenses', { ...DEMO_STATE, categories: [] });
      expect(noCatRes.intent).toBe('reduce_budget');
      expect(noCatRes.dataGrounding).toBe('missing_information');

      // 2. Fully committed
      const committedState: AppState = {
        ...DEMO_STATE,
        categories: [{ id: 'c1', name: 'Cat 1', allocatedAmount: 100000, userDefined: false, priorityRank: 1 }],
        expenses: [{ id: 'e1', categoryId: 'c1', title: 'Committed', amount: 100000, status: 'confirmed', paidAmount: 100000, createdAt: '' }],
      };
      const comRes = generateAssistantResponse('reduce expenses', committedState);
      expect(comRes.intent).toBe('reduce_budget');
      expect(comRes.content).toContain('already committed to confirmed vendor expenses');

      // 3. Overrun state with viable cuts
      const overrunState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 500000 },
        categories: [
          { id: 'venue', name: 'Venue', allocatedAmount: 300000, userDefined: false, priorityRank: 1 },
          { id: 'decor', name: 'Decorations', allocatedAmount: 400000, userDefined: false, priorityRank: 2 },
        ],
        expenses: [
          { id: 'e1', categoryId: 'venue', title: 'Venue Confirmed', amount: 300000, status: 'confirmed', paidAmount: 300000, createdAt: '' },
          { id: 'e2', categoryId: 'decor', title: 'Decor Est', amount: 350000, status: 'estimated', paidAmount: 0, createdAt: '' },
        ],
      };
      const overrunRes = generateAssistantResponse('reduce budget allocation', overrunState);
      expect(overrunRes.intent).toBe('reduce_budget');
      expect(overrunRes.content).toContain('Priority-Aware Budget Reduction Proposals');

      // 4. Within budget viable cuts
      const normalRes = generateAssistantResponse('reduce total cost', DEMO_STATE);
      expect(normalRes.intent).toBe('reduce_budget');
      expect(normalRes.content).toContain('Priority-Aware Budget Reduction Opportunities');
    });

    it('handles protect_priority when priority category is unknown or categories list is empty', () => {
      const unknownPriorityState: AppState = {
        ...DEMO_STATE,
        event: {
          ...DEMO_STATE.event,
          preferences: {
            ...DEMO_STATE.event.preferences,
            planningPriorities: ['non-existent-priority-id'],
          },
        },
      };
      const res1 = generateAssistantResponse('protect top priority', unknownPriorityState);
      expect(res1.content).toContain('Priority Protection:');

      const emptyCatsState: AppState = {
        ...DEMO_STATE,
        categories: [],
      };
      const res2 = generateAssistantResponse('protect top priority', emptyCatsState);
      expect(res2.content).toContain('Top Priority');
    });

    it('formats overdue tasks that do not put downstream tasks at risk', () => {
      const independentOverdueState: AppState = {
        ...DEMO_STATE,
        tasks: [
          {
            id: 't-independent-overdue',
            title: 'Independent Review',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'medium',
            priorityReason: '',
            dueDate: '2020-01-01',
            dependencies: [],
          },
        ],
      };
      const res = generateAssistantResponse('find overdue tasks', independentOverdueState);
      expect(res.content).toContain('Individual deadline passed.');
    });

    it('handles compare_vendor_quotes with unknown category filter, unquoted/unrated vendors, and empty comparison rows', () => {
      // 1. Unknown category filter falls back to state.categories
      const resFallback = generateAssistantResponse('compare vendor quotes for non-existent-category', DEMO_STATE);
      expect(resFallback.content).toContain('Vendor Quotation Comparison Summary');

      // 2. Category with vendor without quote and without rating
      const unquotedState: AppState = {
        ...DEMO_STATE,
        vendors: [
          { id: 'v-plain', name: 'Plain Vendor', categoryId: 'photography', contactName: 'Contact', email: 'v@example.com', phone: '1234567890', isSample: true, createdAt: '2026-10-01' },
        ],
        quotes: [],
      };
      const resUnquoted = generateAssistantResponse('compare vendor quotes for photography', unquotedState);
      expect(resUnquoted.content).toContain('No quote submitted');

      // 3. Filter yields zero rendered rows
      const noRowsState: AppState = {
        ...DEMO_STATE,
        vendors: [
          { id: 'v-decor', name: 'Decor Vendor', categoryId: 'decor', contactName: 'Contact', email: 'd@example.com', phone: '1234567890', isSample: true, createdAt: '2026-10-01' },
        ],
        quotes: [],
      };
      const resNoRows = generateAssistantResponse('compare vendor quotes for venue', noRowsState);
      expect(resNoRows.content).toContain('No vendor quotes recorded for venue');
    });

    it('identifies missing vendor quote info when quote references an unknown vendor', () => {
      const unknownVendorState: AppState = {
        ...DEMO_STATE,
        vendors: [],
        quotes: [
          {
            id: 'q-anon',
            vendorId: 'v-ghost',
            quoteDate: '2026-01-01',
            quotedAmount: 100000,
            currency: 'INR',
            status: 'draft',
            includedServices: [],
            exclusions: [],
            paymentTerms: '',
            isSample: true,
          },
        ],
      };
      const res = generateAssistantResponse('identify missing vendor info', unknownVendorState);
      expect(res.content).toContain('Unknown Vendor');
    });

    it('summarizes plan with budget overrun and zero overdue tasks', () => {
      const summaryOverrunState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 50000 },
        tasks: [
          {
            id: 't-future',
            title: 'Future Milestone',
            description: '',
            categoryId: 'venue',
            status: 'completed',
            priority: 'low',
            priorityReason: '',
            dueDate: '2030-01-01',
            dependencies: [],
          },
        ],
        expenses: [
          {
            id: 'e-overrun',
            categoryId: DEMO_STATE.categories[0].id,
            title: 'Huge Expense',
            amount: 150000,
            status: 'actual',
            paidAmount: 150000,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      };
      const res = generateAssistantResponse('summarize event plan', summaryOverrunState);
      expect(res.content).toContain('Overrun of');
      expect(res.content).toContain('all deadlines on schedule');
    });

    it('falls back to adversarial_input when hostile security analysis lacks specific risk category', () => {
      const secSpy = vi.spyOn(assistantValidationModule, 'analyzeInputSecurity').mockReturnValueOnce({
        isHostile: true,
        riskCategory: '' as any,
        sanitizedText: '',
      });
      const res = parseUserIntent('some hostile query');
      expect(res.intent).toBe('unsupported');
      expect(res.extractedParameters?.unsupportedReason).toBe('Security policy violation: adversarial_input');
      secSpy.mockRestore();
    });

    it('formats countdown with all deadlines on track when overdueCount is zero', () => {
      const cleanState: AppState = {
        ...DEMO_STATE,
        tasks: DEMO_STATE.tasks.map((t) => ({ ...t, dueDate: '2030-01-01' })),
      };
      const res = generateAssistantResponse('when is the wedding?', cleanState);
      expect(res.content).toContain('all deadlines on track');
    });

    it('evaluates detect_schedule_conflicts false branch when high priority tasks are not blocked', () => {
      const postOnlyState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, date: '2026-11-01' },
        tasks: [
          {
            id: 't-post',
            title: 'Post Event Task',
            description: '',
            categoryId: 'venue',
            status: 'not_started',
            priority: 'low',
            priorityReason: '',
            dueDate: '2026-11-15',
            dependencies: [],
          },
        ],
      };
      const res = generateAssistantResponse('detect schedule conflicts', postOnlyState);
      expect(res.content).toContain('Deadlines Scheduled After Event Date');
      expect(res.content).not.toContain('Blocked Critical Milestones');
    });

    it('formats active quotes without expired section when no quotes are expired', () => {
      const activeState: AppState = {
        ...DEMO_STATE,
        quotes: DEMO_STATE.quotes.map((q) => ({ ...q, validityDate: '2030-01-01' })),
      };
      const res = generateAssistantResponse('quote terms and validity', activeState);
      expect(res.content).not.toContain('Expired Quotations');
      expect(res.content).toContain('Active Quotes & Payment Terms');
    });

    it('falls back to default 250 venue capacity when venue category lacks capacity notes', () => {
      const noNoteState: AppState = {
        ...DEMO_STATE,
        categories: DEMO_STATE.categories.map((c) => ({ ...c, notes: undefined })),
      };
      const res = generateAssistantResponse('change guest count to 200', noNoteState);
      expect(res.content).not.toContain('Capacity Constraint Alert');
    });

    it('handles capacityViolation when targetCount is within maxCapacity but exceeds category limit', () => {
      const capState: AppState = {
        ...DEMO_STATE,
        categories: [
          { id: 'venue', name: 'Intimate Hall', allocatedAmount: 500000, maxCapacity: 100, userDefined: false, priorityRank: 1 },
          { id: 'catering', name: 'Catering Service', allocatedAmount: 300000, perGuestCost: 0, userDefined: false, priorityRank: 2 },
        ],
      };
      const res = generateAssistantResponse('change guest count to 150', capState);
      expect(res.content).toContain('New guest count (150) exceeds Intimate Hall capacity limit');
      expect(res.content).toContain('Catering does not have a configured per-guest cost');
    });

    it('handles zero target reduction within budget in reduce_budget yielding zero recommendations', () => {
      const zeroTargetState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 4 },
        categories: [{ id: 'decor', name: 'Decor', allocatedAmount: 4, userDefined: false, priorityRank: 1 }],
        expenses: [],
      };
      const res = generateAssistantResponse('reduce expenses', zeroTargetState);
      expect(res.intent).toBe('reduce_budget');
      expect(res.content).toContain('Your budget is currently within the total limit');
    });

    it('falls back to top-ranked categories label when all categories receive cuts', () => {
      const singleCatOverrun: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 50000 },
        categories: [{ id: 'decor', name: 'Decor', allocatedAmount: 100000, userDefined: false, priorityRank: 1 }],
        expenses: [{ id: 'e1', categoryId: 'decor', title: 'Decor Est', amount: 100000, status: 'estimated', paidAmount: 0, createdAt: '' }],
      };
      const resOverrun = generateAssistantResponse('reduce expenses', singleCatOverrun);
      expect(resOverrun.content).toContain('top-ranked categories');

      const singleCatNormal: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 200000 },
        categories: [{ id: 'decor', name: 'Decor', allocatedAmount: 100000, userDefined: false, priorityRank: 1 }],
        expenses: [],
      };
      const resNormal = generateAssistantResponse('reduce expenses', singleCatNormal);
      expect(resNormal.content).toContain('top-ranked categories');
    });

    it('falls back to scanning all categories when category filter matches no category', () => {
      const noPhotoState: AppState = {
        ...DEMO_STATE,
        categories: [{ id: 'venue', name: 'Venue Category', allocatedAmount: 500000, userDefined: false, priorityRank: 1 }],
        vendors: [{ id: 'v1', name: 'Venue Corp', categoryId: 'venue', contactName: 'Venue Contact', email: 'venue@corp.com', phone: '1234567890', isSample: true, createdAt: '2026-10-01' }],
        quotes: [],
      };
      const res = generateAssistantResponse('compare vendor quotes for photography', noPhotoState);
      expect(res.content).toContain('Vendor Quotation Comparison Summary');
      expect(res.content).toContain('Venue Category');
    });

    it('reports no vendor quotes recorded for any category when rendered rows is zero without category filter', () => {
      const unlistedVendorState: AppState = {
        ...DEMO_STATE,
        categories: [{ id: 'venue', name: 'Venue Category', allocatedAmount: 500000, userDefined: false, priorityRank: 1 }],
        vendors: [{ id: 'v1', name: 'Other Vendor', categoryId: 'unlisted-category-99', contactName: 'Other Contact', email: 'other@corp.com', phone: '1234567890', isSample: true, createdAt: '2026-10-01' }],
        quotes: [],
      };
      const res = generateAssistantResponse('compare vendor quotes', unlistedVendorState);
      expect(res.content).toContain('No vendor quotes recorded for any category.');
    });

    it('handles refuse_unsupported_request intent in English and Bengali (lines 507-522)', () => {
      const resEn = generateAssistantResponse(
        {
          intent: 'refuse_unsupported_request',
          extractedParameters: { unsupportedReason: 'External payment gateway is disabled' },
        } as any,
        DEMO_STATE,
        'pay with card'
      );
      expect(resEn.content).toContain('Platform Boundary & Unsupported Capability Notice');
      expect(resEn.content).toContain('External payment gateway is disabled');

      const resBn = generateAssistantResponse(
        {
          intent: 'refuse_unsupported_request',
          extractedParameters: { unsupportedReason: 'বহিরাগত পেমেন্ট গেটওয়ে সংযোগ নিষ্ক্রিয়' },
        } as any,
        DEMO_STATE,
        'বুক করে দাও'
      );
      expect(resBn.content).toContain('সীমাবদ্ধতা বিজ্ঞপ্তি (Platform Boundary Notice)');
      expect(resBn.content).toContain('বহিরাগত পেমেন্ট গেটওয়ে সংযোগ নিষ্ক্রিয়');
    });

    it('exercises Bengali protect priority keywords in parseUserIntent (line 313)', () => {
      const parseBn1 = parseUserIntent('শীর্ষ ক্যাটাগরি রক্ষা করো');
      expect(parseBn1.intent).toBe('protect_priority');

      const parseBn2 = parseUserIntent('অগ্রাধিকার ক্যাটাগরি বাঁচাও');
      expect(parseBn2.intent).toBe('protect_priority');
    });

    it('falls back to empty keyword in query_category_budget when categoryKeyword parameter is omitted (line 664)', () => {
      const res = generateAssistantResponse({ intent: 'query_category_budget' } as any, DEMO_STATE);
      expect(res.content).toContain('No budget category matching');
    });

    it('exercises overrun branches with zero recommendations in reduce_budget and suggest_expense_reductions (lines 932-934)', () => {
      const overrunFullyCommitted: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 50000 },
        categories: [{ id: 'locked', name: 'Locked Cat', allocatedAmount: 100000, userDefined: false, priorityRank: 1 }],
        expenses: [
          {
            id: 'e-locked',
            categoryId: 'locked',
            title: 'Committed Exp',
            amount: 100000,
            status: 'confirmed',
            paidAmount: 100000,
            createdAt: '2026-10-01',
          },
        ],
      };

      const resReduce = generateAssistantResponse({ intent: 'reduce_budget' } as any, overrunFullyCommitted);
      expect(resReduce.content).toContain('all category allocations are already tied to confirmed vendor commitments');
      expect(resReduce.intent).toBe('reduce_budget');

      const resSuggest = generateAssistantResponse({ intent: 'suggest_expense_reductions' } as any, overrunFullyCommitted);
      expect(resSuggest.content).toContain('all category allocations are already tied to confirmed vendor commitments');
      expect(resSuggest.intent).toBe('suggest_expense_reductions');
    });

    it('covers storage.ts createInitialEventState fallbacks and multi-event validation (lines 30, 307-312, 329-344, 391)', () => {
      // 1. Non-finite budget, empty location, city fallback
      const cityEvent: any = {
        name: 'City Fallback Event',
        city: 'Jaipur, Rajasthan',
        totalBudget: NaN,
        guestCount: NaN,
        planningPriorities: ['catering', 'venue'],
      };
      const stateWithCity = createInitialEventState(cityEvent);
      expect(stateWithCity.event.location).toBe('Jaipur, Rajasthan');
      expect(stateWithCity.event.totalBudget).toBe(0);
      expect(stateWithCity.event.guestCount).toBe(0);
      expect(stateWithCity.event.status).toBe('planning');
      expect(stateWithCity.event.currency).toBe('INR');
      expect(stateWithCity.event.eventType).toBe('wedding');

      // 2. Default location and name fallback when name and city are absent
      const minimalEvent = {
        totalBudget: 1000000,
        guestCount: 50,
      };
      const stateMinimal = createInitialEventState(minimalEvent);
      expect(stateMinimal.event.name).toBe('New Event');
      expect(stateMinimal.event.location).toBe('Kolkata, West Bengal');

      // 3. Custom initialCategories
      const customCats = [
        { id: 'custom-cat', name: 'Custom Cat', allocatedAmount: 50000, userDefined: true, priorityRank: 1 },
      ];
      const stateCustom = createInitialEventState({ ...DEMO_STATE.event }, customCats);
      expect(stateCustom.categories).toEqual(customCats);

      // 4. Multi-event store invalid state rejection (line 391)
      const fakeStore = {
        'evt-good': DEMO_STATE,
        'evt-corrupt': { badData: true },
      };
      localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(fakeStore));
      const loadedStore = loadMultiEventStore();
      expect(loadedStore.events['evt-good']).toBeDefined();
      expect(loadedStore.events['evt-corrupt']).toBeUndefined();
    });

    it('exercises budgetEngine.ts NaN safeguards and zero-allocation missing data warnings (lines 97, 339, 423, 427)', () => {
      // 1. Line 339: zero catering allocation with missing perGuestCost
      const zeroCatState: AppState = {
        ...DEMO_STATE,
        categories: DEMO_STATE.categories.map((c) =>
          c.id === 'catering' ? { ...c, allocatedAmount: 0, perGuestCost: 0 } : c
        ),
      };
      const resZeroCat = calculateGuestCountImpact(zeroCatState, 200);
      expect(resZeroCat.missingDataWarnings.some((w) => w.includes('Cannot compute guest scaling'))).toBe(true);

      // 2. Line 423: NaN totalBudget in initializeCategoriesForBudget
      const catsNaN = initializeCategoriesForBudget(NaN);
      expect(catsNaN.length).toBeGreaterThan(0);
      expect(catsNaN[0].allocatedAmount).toBe(0);

      // 3. Line 427: NaN category allocation in baseCategories
      const catsBaseNaN = initializeCategoriesForBudget(10000000, undefined, [
        { id: 'cat-nan', name: 'NaN Cat', allocatedAmount: NaN, userDefined: true, priorityRank: 1 },
      ]);
      expect(catsBaseNaN[0].allocatedAmount).toBe(10000000);

      // 4. Base categories exact budget match (line 593)
      const exactBaseCats = [
        { id: 'cat-1', name: 'Cat 1', allocatedAmount: 500000, userDefined: true, priorityRank: 1 },
        { id: 'cat-2', name: 'Cat 2', allocatedAmount: 500000, userDefined: true, priorityRank: 2 },
      ];
      const catsExact = initializeCategoriesForBudget(1000000, undefined, exactBaseCats);
      expect(catsExact[0].allocatedAmount).toBe(500000);
      expect(catsExact[1].allocatedAmount).toBe(500000);

      // 5. classifyCategoryCostType with explicit costType metadata (line 177)
      expect(classifyCategoryCostType({ id: 'c1', name: 'Custom', allocatedAmount: 100, userDefined: true, priorityRank: 1, costType: 'variable' } as any)).toBe('variable');
      expect(classifyCategoryCostType({ id: 'c2', name: 'Custom Fixed', allocatedAmount: 100, userDefined: true, priorityRank: 1, costType: 'fixed' } as any)).toBe('fixed');
      expect(classifyCategoryCostType({ id: 'c3', name: 'Custom Tier', allocatedAmount: 100, userDefined: true, priorityRank: 1, costType: 'capacity_tier' } as any)).toBe('capacity_tier');

      // 6. calculateCategoryGuestAdjustments with NaN guests, NaN allocations, and zero rates (lines 225, 231, 236, 245)
      const adjNaN = calculateCategoryGuestAdjustments(
        [
          { id: 'catering', name: 'Catering', allocatedAmount: NaN, userDefined: true, priorityRank: 1 },
          { id: 'venue', name: 'Venue', allocatedAmount: 100000, userDefined: true, priorityRank: 2, maxCapacity: 250 },
          { id: 'decor', name: 'Decor', allocatedAmount: 0, userDefined: true, priorityRank: 3 },
          { id: 'custom-var', name: 'Custom Food Bar', allocatedAmount: 0, userDefined: true, priorityRank: 4 },
        ],
        NaN,
        NaN
      );
      expect(adjNaN.length).toBe(4);
      expect(adjNaN[0].perGuestRate).toBe(0);
      expect(adjNaN[1].capacityLimit).toBe(250);

      // 7. evaluateScenario with NaN manual override (line 522)
      const evalNaNManual = evaluateScenario(DEMO_STATE, {
        id: 'scen-nan',
        name: 'NaN Manual',
        description: '',
        createdAt: '2026-10-01',
        modifiedGuestCount: 150,
        categoryAllocations: { catering: NaN },
        notes: '',
        isBaseline: false,
      });
      expect(evalNaNManual.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(
        DEMO_STATE.categories.find((c) => c.id === 'catering')!.allocatedAmount
      );

      // 8. assistantEngine fallback reason in refuse_unsupported_request (line 512)
      const fallbackRefuse = generateAssistantResponse({ intent: 'refuse_unsupported_request' } as any, DEMO_STATE);
      expect(fallbackRefuse.content).toContain('The requested action is not supported');

      // 9. budgetEngine line 330: calculateGuestCountImpact with zero current guests and unconfigured catering
      const stateZeroGuests: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, guestCount: 0 },
        categories: [
          { id: 'catering', name: 'Catering Service', allocatedAmount: 150000, userDefined: true, priorityRank: 1 },
        ],
      };
      const impactZeroGuests = calculateGuestCountImpact(stateZeroGuests, 150);
      expect(impactZeroGuests.missingDataWarnings.length).toBeGreaterThan(0);
      expect(impactZeroGuests.missingDataWarnings[0]).toContain('Cannot compute guest scaling');

      // 10. budgetEngine line 236: explicit maxCapacity on capacity_tier vs fixed category
      const adjExplicitCap = calculateCategoryGuestAdjustments(
        [
          { id: 'venue', name: 'Grand Venue', allocatedAmount: 200000, userDefined: true, priorityRank: 1, maxCapacity: 180 },
          { id: 'venue-def', name: 'Banquet Hall', allocatedAmount: 200000, userDefined: true, priorityRank: 1 },
          { id: 'photo', name: 'Photography', allocatedAmount: 50000, userDefined: true, priorityRank: 2, maxCapacity: 250 },
          { id: 'music', name: 'Music DJ', allocatedAmount: 30000, userDefined: true, priorityRank: 3 },
        ],
        150,
        210
      );
      expect(adjExplicitCap[0].capacityLimit).toBe(180);
      expect(adjExplicitCap[0].isCapacityExceeded).toBe(true);
      expect(adjExplicitCap[1].capacityLimit).toBe(200);
      expect(adjExplicitCap[1].isCapacityExceeded).toBe(true);
      expect(adjExplicitCap[2].capacityLimit).toBe(250);
      expect(adjExplicitCap[2].isCapacityExceeded).toBe(false);
      expect(adjExplicitCap[3].capacityLimit).toBeUndefined();

      // 11. assistantEngine line 404: query with increase word but NOT budget words
      const intentNonBudgetIncrease = parseUserIntent('Please increase the volume of the speakers');
      expect(intentNonBudgetIncrease.intent).not.toBe('refuse_unsupported_request');

      // 12. assistantEngine line 503: non-string non-object input
      const invalidInputRes = generateAssistantResponse(42 as any, DEMO_STATE);
      expect(invalidInputRes).toBeDefined();
      expect(invalidInputRes.role).toBe('assistant');

      // 13. assistantEngine lines 942-945: zero recommendations with overrun and without overrun
      const fullyCommittedOverrunState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 100000 },
        categories: [
          { id: 'cat1', name: 'Cat1', allocatedAmount: 200000, userDefined: true, priorityRank: 1 }
        ],
        expenses: [
          { id: 'exp1', categoryId: 'cat1', title: 'Committed Exp', amount: 200000, status: 'confirmed', paidAmount: 200000, createdAt: '2026-10-01T00:00:00.000Z' }
        ]
      };
      const overrunResReduce = generateAssistantResponse({ intent: 'reduce_budget' } as any, fullyCommittedOverrunState);
      expect(overrunResReduce.content).toContain('all category allocations are already tied to confirmed vendor commitments');
      expect(overrunResReduce.intent).toBe('reduce_budget');

      const overrunResSuggest = generateAssistantResponse({ intent: 'suggest_expense_reductions' } as any, fullyCommittedOverrunState);
      expect(overrunResSuggest.content).toContain('all category allocations are already tied to confirmed vendor commitments');
      expect(overrunResSuggest.intent).toBe('suggest_expense_reductions');

      const fullyCommittedUnderLimitState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 300000 },
        categories: [
          { id: 'cat1', name: 'Cat1', allocatedAmount: 200000, userDefined: true, priorityRank: 1 }
        ],
        expenses: [
          { id: 'exp1', categoryId: 'cat1', title: 'Committed Exp', amount: 200000, status: 'confirmed', paidAmount: 200000, createdAt: '2026-10-01T00:00:00.000Z' }
        ]
      };
      const underLimitResReduce = generateAssistantResponse({ intent: 'reduce_budget' } as any, fullyCommittedUnderLimitState);
      expect(underLimitResReduce.content).toContain('There is no flexible, uncommitted headroom available');
      expect(underLimitResReduce.intent).toBe('reduce_budget');

      const tinyBudgetState: AppState = {
        ...DEMO_STATE,
        event: { ...DEMO_STATE.event, totalBudget: 2 },
        categories: [
          { id: 'cat1', name: 'Cat1', allocatedAmount: 1, userDefined: true, priorityRank: 1 }
        ],
        expenses: []
      };
      const zeroBudgetRes = generateAssistantResponse({ intent: 'reduce_budget' } as any, tinyBudgetState);
      expect(zeroBudgetRes.content).toContain('existing category headroom is already optimized');
      expect(zeroBudgetRes.intent).toBe('reduce_budget');

      const zeroBudgetResSuggest = generateAssistantResponse({ intent: 'suggest_expense_reductions' } as any, tinyBudgetState);
      expect(zeroBudgetResSuggest.content).toContain('existing category headroom is already optimized');
      expect(zeroBudgetResSuggest.intent).toBe('suggest_expense_reductions');

      // 14. storage.ts line 459: saveMultiEventStore with invalid or missing event elements
      const multiEventSaveRes = saveMultiEventStore(DEMO_STATE, [
        DEMO_STATE,
        null as any,
        { event: null } as any,
        { event: { id: '' } } as any,
      ]);
      expect(multiEventSaveRes).toBe(true);
    });
  });
});
