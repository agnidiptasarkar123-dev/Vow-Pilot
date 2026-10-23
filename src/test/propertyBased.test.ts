import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toMinorUnits,
  toMajorUnits,
  formatCurrency,
  parseDisplayToMinor
} from '../domain/currency';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations
} from '../domain/budgetEngine';
import {
  canCompleteTask,
  detectDependencyCycles,
  evaluateTasks
} from '../domain/taskEngine';
import {
  compareCategoryVendors,
  draftClarificationMessage
} from '../domain/vendorEngine';
import {
  validateStateSchema
} from '../persistence/storage';
import { DEMO_STATE } from '../persistence/demoData';
import {
  AppState,
  BudgetCategory,
  CurrencyCode,
  Expense,
  Task,
  Vendor,
  VendorQuote
} from '../types';

describe('Property-Based Invariant Testing with fast-check', () => {
  const currencyCodes: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP'];

  describe('Currency & Numeric Invariants', () => {
    it('Property 1: toMinorUnits(toMajorUnits(minor)) round-trips for safe integer cents/paise', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10_000_000, max: 10_000_000 }),
          (minor) => {
            const major = toMajorUnits(minor);
            const roundTrip = toMinorUnits(major);
            return roundTrip === (minor === 0 ? 0 : minor);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: parseDisplayToMinor(toMajorUnits(minor).toFixed(2)) is idempotent for positive integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          (minor) => {
            const formatted = toMajorUnits(minor).toFixed(2);
            const parsed = parseDisplayToMinor(formatted);
            return parsed === minor;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: formatCurrency never throws and returns non-empty string for finite numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10_000_000, max: 10_000_000 }),
          fc.constantFrom(...currencyCodes),
          fc.boolean(),
          (minor, currency, includeDecimals) => {
            const formatted = formatCurrency(minor, currency, includeDecimals);
            return typeof formatted === 'string' && formatted.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4: formatCurrency contains currency symbol or code', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10_000_000 }),
          fc.constantFrom(...currencyCodes),
          (minor, currency) => {
            const formatted = formatCurrency(minor, currency);
            const expectedTokens: Record<CurrencyCode, string[]> = {
              INR: ['₹', 'Rs', 'INR'],
              USD: ['$', 'USD'],
              EUR: ['€', 'EUR'],
              GBP: ['£', 'GBP']
            };
            return expectedTokens[currency].some(token => formatted.includes(token));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Budget Engine Mathematical Invariants', () => {
    it('Property 5: Total allocated equals exact sum of category allocations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 8 }),
              name: fc.string({ minLength: 1, maxLength: 10 }),
              allocatedAmount: fc.integer({ min: 0, max: 5_000_000 }),
              priorityRank: fc.integer({ min: 1, max: 10 }),
              userDefined: fc.boolean()
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (cats) => {
            const categories: BudgetCategory[] = cats;
            const overview = calculateBudgetOverview(100_000_000, categories, []);
            const expectedAllocated = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
            return overview.totalAllocated === expectedAllocated;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6: Committed total is exact sum of confirmed and actual expenses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1_000_000, max: 50_000_000 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 5 }),
              categoryId: fc.constant('venue'),
              title: fc.string({ minLength: 1, maxLength: 8 }),
              status: fc.constantFrom('estimated' as const, 'quoted' as const, 'confirmed' as const, 'actual' as const),
              amount: fc.integer({ min: 10_000, max: 2_000_000 }),
              paidAmount: fc.constant(0),
              createdAt: fc.constant('2026-10-01')
            }),
            { minLength: 0, maxLength: 15 }
          ),
          (totalBudget, expenses) => {
            const categories: BudgetCategory[] = [
              { id: 'venue', name: 'Venue', allocatedAmount: totalBudget, userDefined: false, priorityRank: 1 }
            ];
            const overview = calculateBudgetOverview(totalBudget, categories, expenses as Expense[]);
            const expectedConfirmed = expenses.filter(e => e.status === 'confirmed').reduce((sum, e) => sum + e.amount, 0);
            const expectedActual = expenses.filter(e => e.status === 'actual').reduce((sum, e) => sum + e.amount, 0);

            expect(overview.sumConfirmed).toBe(expectedConfirmed);
            expect(overview.sumActual).toBe(expectedActual);
            expect(overview.committedTotal).toBe(expectedConfirmed + expectedActual);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 7: Guest count impact on variable expenses is monotonic with positive perGuestCost', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 300 }),
          fc.integer({ min: 1, max: 100 }),
          (baseGuests, deltaGuests) => {
            const testState: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
            testState.event.guestCount = baseGuests;

            const res = calculateGuestCountImpact(testState, baseGuests + deltaGuests);

            // Adding guests to catering should increase or keep estimated total equal
            return res.impact.proposedEstimatedTotal >= res.impact.currentEstimatedTotal;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 8: Priority-aware reductions never cut confirmed or actual expenses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10_000, max: 500_000 }),
          (overrunAmount) => {
            const testState: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
            const overview = calculateBudgetOverview(
              testState.event.totalBudget,
              testState.categories,
              testState.expenses
            );
            // Simulate an overrun
            overview.isOverrun = true;
            overview.overrunAmount = overrunAmount;

            const priorities = testState.event.preferences.planningPriorities;
            const result = generatePriorityAwareRecommendations(overview, priorities);

            for (const rec of result.recommendations) {
              const catExpenses = testState.expenses.filter(e => e.categoryId === rec.categoryId);
              const committedInCat = catExpenses
                .filter(e => e.status === 'confirmed' || e.status === 'actual')
                .reduce((s, e) => s + e.amount, 0);

              expect(rec.newAllocated).toBeGreaterThanOrEqual(committedInCat);
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Task Dependency & Graph Theory Invariants', () => {
    it('Property 9: Any closed cycle A -> B -> ... -> A is detected as having hasCycle: true', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          (chainLength) => {
            const tasks: Task[] = [];
            for (let i = 0; i < chainLength; i++) {
              const nextId = i === chainLength - 1 ? 'task-0' : `task-${i + 1}`;
              tasks.push({
                id: `task-${i}`,
                title: `Task ${i}`,
                description: '',
                categoryId: 'venue',
                priority: 'medium',
                priorityReason: '',
                dueDate: '2026-11-01',
                status: 'not_started',
                dependencies: [nextId]
              });
            }

            const result = detectDependencyCycles(tasks);
            return result.hasCycle === true && result.cyclePath.length > 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 10: Linear DAG T0 -> T1 -> ... -> Tn has hasCycle: false', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 15 }),
          (length) => {
            const tasks: Task[] = [];
            for (let i = 0; i < length; i++) {
              tasks.push({
                id: `node-${i}`,
                title: `Node ${i}`,
                description: '',
                categoryId: 'venue',
                priority: 'medium',
                priorityReason: '',
                dueDate: '2026-11-01',
                status: 'not_started',
                dependencies: i > 0 ? [`node-${i - 1}`] : []
              });
            }

            const result = detectDependencyCycles(tasks);
            return result.hasCycle === false && result.cyclePath.length === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 11: Uncompleted prerequisite strictly prevents task completion', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('not_started' as const, 'in_progress' as const, 'blocked' as const),
          (prereqStatus) => {
            const tasks: Task[] = [
              { id: 'prereq', title: 'Prereq', description: '', categoryId: 'c1', priority: 'high', priorityReason: '', dueDate: '2026-10-25', status: prereqStatus, dependencies: [] },
              { id: 'dep', title: 'Dependent', description: '', categoryId: 'c1', priority: 'high', priorityReason: '', dueDate: '2026-10-26', status: 'not_started', dependencies: ['prereq'] }
            ];

            const check = canCompleteTask('dep', tasks);
            return check.allowed === false && check.blockingTaskTitles.length > 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 12: evaluateTasks correctly flags blocked tasks when prerequisites are uncompleted', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('not_started' as const, 'in_progress' as const),
          (prereqStatus) => {
            const tasks: Task[] = [
              { id: 'p1', title: 'Task P1', description: '', categoryId: 'c1', priority: 'high', priorityReason: '', dueDate: '2026-11-10', status: prereqStatus, dependencies: [] },
              { id: 'd1', title: 'Task D1', description: '', categoryId: 'c1', priority: 'high', priorityReason: '', dueDate: '2026-11-11', status: 'not_started', dependencies: ['p1'] }
            ];

            const evaluations = evaluateTasks(tasks, '2026-12-01', '2026-10-24');
            const d1Eval = evaluations.find(e => e.task.id === 'd1');
            return d1Eval?.risks.isBlocked === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Vendor Engine Invariants', () => {
    it('Property 13: Category vendor comparison accurately reports quote counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (numQuotes) => {
            const vendors: Vendor[] = [];
            const quotes: VendorQuote[] = [];

            for (let i = 0; i < numQuotes; i++) {
              vendors.push({
                id: `v-${i}`,
                name: `Vendor ${i}`,
                categoryId: 'cat-test',
                contactName: 'Contact',
                email: 'test@example.com',
                phone: '1234567890',
                isSample: true,
                createdAt: '2026-10-01'
              });
              quotes.push({
                id: `q-${i}`,
                vendorId: `v-${i}`,
                quoteDate: '2026-10-01',
                quotedAmount: (i + 1) * 100_000,
                currency: 'INR',
                status: 'under_review',
                includedServices: ['Service A'],
                exclusions: ['Exclusion B'],
                paymentTerms: '50% advance',
                isSample: true
              });
            }

            const comp = compareCategoryVendors('cat-test', 'Test Category', vendors, quotes);
            return comp.quotesCount === numQuotes && comp.rows.length === numQuotes;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 14: Draft clarification message includes vendor name and event details', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,15}$/),
          fc.boolean(),
          (vendorName, missValidity) => {
            const vendor: Vendor = {
              id: 'v1',
              name: vendorName,
              categoryId: 'c1',
              contactName: '',
              email: 'manager@test.com',
              phone: '123',
              isSample: true,
              createdAt: '2026-10-01'
            };
            const quote: VendorQuote = {
              id: 'q1',
              vendorId: 'v1',
              quoteDate: '2026-10-01',
              validityDate: missValidity ? undefined : '2026-11-01',
              quotedAmount: 500000,
              currency: 'INR',
              status: 'under_review',
              includedServices: ['Service'],
              exclusions: [],
              paymentTerms: '50/50',
              isSample: true
            };

            const draft = draftClarificationMessage(vendor, quote, 'Grand Gala', '2026-12-31');
            return draft.includes(vendorName) && draft.includes('Grand Gala') && draft.includes('2026-12-31');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('State Schema & Persistence Invariants', () => {
    it('Property 15: JSON serialization followed by deserialization conforms to validateStateSchema', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{1,18}[A-Za-z0-9]$/),
          fc.integer({ min: 1, max: 2000 }),
          (eventName, guestCount) => {
            const testState: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
            testState.event.name = eventName;
            testState.event.guestCount = guestCount;

            const exportedJson = JSON.stringify(testState);
            const parsed = JSON.parse(exportedJson);
            return validateStateSchema(parsed) === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 16: validateStateSchema strictly rejects any payload with prototype pollution keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('__proto__', 'constructor', 'prototype'),
          fc.string({ minLength: 1, maxLength: 10 }),
          (badKey, dummyValue) => {
            const rawJson = JSON.stringify(DEMO_STATE);
            // Inject dangerous key as an own property in parsed JSON
            const tainted = JSON.parse(rawJson);
            Object.defineProperty(tainted.event, badKey, {
              value: { [dummyValue]: true },
              enumerable: true,
              configurable: true
            });

            return validateStateSchema(tainted) === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 17: Negative guestCount is strictly rejected by validateStateSchema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10_000, max: -1 }),
          (invalidGuestCount) => {
            const invalidState = JSON.parse(JSON.stringify(DEMO_STATE));
            invalidState.event.guestCount = invalidGuestCount;

            return validateStateSchema(invalidState) === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 18: Negative totalBudget is strictly rejected by validateStateSchema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100_000_000, max: -1 }),
          (invalidBudget) => {
            const invalidState = JSON.parse(JSON.stringify(DEMO_STATE));
            invalidState.event.totalBudget = invalidBudget;

            return validateStateSchema(invalidState) === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 19: Missing essential top-level arrays causes validateStateSchema rejection', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('categories', 'expenses', 'tasks', 'vendors', 'quotes', 'scenarios', 'messages'),
          (omittedField) => {
            const incompleteState = JSON.parse(JSON.stringify(DEMO_STATE));
            delete incompleteState[omittedField];

            return validateStateSchema(incompleteState) === false;
          }
        ),
        { numRuns: 35 }
      );
    });

    it('Property 20: White-space only or empty event date is rejected by validateStateSchema', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (blankDate) => {
            const badState = JSON.parse(JSON.stringify(DEMO_STATE));
            badState.event.date = blankDate;

            return validateStateSchema(badState) === false;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
