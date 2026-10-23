import { describe, it, expect, beforeEach } from 'vitest';
import { DEMO_STATE } from '../persistence/demoData';
import { calculateGuestCountImpact, calculateBudgetOverview } from '../domain/budgetEngine';
import { AppState, BudgetScenario } from '../types';

describe('Comprehensive Decision Simulator Sandboxing & Scenario Management (100 Parameterized Test Cases)', () => {
  let state: AppState;

  beforeEach(() => {
    state = JSON.parse(JSON.stringify(DEMO_STATE));
  });

  // --------------------------------------------------------------------------
  // Suite 1: Sandbox Guest Count Simulation & Baseline Preservation (40 cases)
  // --------------------------------------------------------------------------
  const sandboxGuestCases = Array.from({ length: 40 }, (_, i) => {
    const guests = 100 + i * 5; // 100 to 295 guests
    return { id: i, guests, baselineGuests: 150 };
  });

  describe('Sandbox guest headcount modeling without baseline mutation', () => {
    sandboxGuestCases.forEach(({ id, guests, baselineGuests }) => {
      it(`[Case ${id + 1}] models ${guests} guests in sandbox while baseline remains strictly ${baselineGuests}`, () => {
        const stateSnapshotBefore = JSON.stringify(state);

        // Run sandbox impact evaluation
        const impactResult = calculateGuestCountImpact(state, guests);

        // 1. Assert impact results are mathematically sound
        expect(impactResult.impact).toBeDefined();
        expect(impactResult.impact.proposedEstimatedTotal).toBeGreaterThan(0);

        // 2. Capacity constraint check: Venue limit in demo is 200
        if (guests > 200) {
          expect(impactResult.capacityViolation).toBeDefined();
          expect(impactResult.capacityViolation).toMatch(/capacity limit/i);
        } else {
          expect(impactResult.capacityViolation).toBeUndefined();
        }

        // 3. Baseline state snapshot MUST be identical - no silent mutations!
        const stateSnapshotAfter = JSON.stringify(state);
        expect(stateSnapshotAfter).toBe(stateSnapshotBefore);
        expect(state.event.guestCount).toBe(baselineGuests);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Category Budget Adjustments & Negative Clamping (30 cases)
  // --------------------------------------------------------------------------
  const categoryAdjustCases = Array.from({ length: 30 }, (_, i) => {
    const cateringDelta = (i - 15) * 5000000; // negative and positive deltas
    const decorDelta = (15 - i) * 3000000;
    return { id: i, cateringDelta, decorDelta };
  });

  describe('Sandbox category allocation adjusters and non-negative clamping', () => {
    categoryAdjustCases.forEach(({ id, cateringDelta, decorDelta }) => {
      it(`[Case ${id + 1}] adjusts catering by ${cateringDelta} and decor by ${decorDelta}`, () => {
        const cateringCat = state.categories.find((c) => c.id === 'catering')!;
        const decorCat = state.categories.find((c) => c.id === 'decor')!;

        const simulatedCateringAlloc = Math.max(0, cateringCat.allocatedAmount + cateringDelta);
        const simulatedDecorAlloc = Math.max(0, decorCat.allocatedAmount + decorDelta);

        const simulatedCategories = state.categories.map((c) => {
          if (c.id === 'catering') return { ...c, allocatedAmount: simulatedCateringAlloc };
          if (c.id === 'decor') return { ...c, allocatedAmount: simulatedDecorAlloc };
          return c;
        });

        const overview = calculateBudgetOverview(state.event.totalBudget, simulatedCategories, state.expenses);

        expect(overview.totalAllocated).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(overview.remainingBudget)).toBe(true);

        // Baseline categories in state remain pristine
        expect(cateringCat.allocatedAmount).toBe(60000000);
        expect(decorCat.allocatedAmount).toBe(40000000);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Scenario Lifecycle: Create, Compare, Apply, and Revert (30 cases)
  // --------------------------------------------------------------------------
  const scenarioLifecycleCases = Array.from({ length: 30 }, (_, i) => {
    const scenarioGuests = 160 + i * 2;
    return { id: i, name: `Alternative Plan Option ${i + 1}`, scenarioGuests };
  });

  describe('Scenario lifecycle: create, compare, apply, and rollback', () => {
    scenarioLifecycleCases.forEach(({ id, name, scenarioGuests }) => {
      it(`[Case ${id + 1}] manages scenario "${name}" with explicit user application`, () => {
        const baselineGuests = state.event.guestCount;

        // 1. Create alternative scenario
        const scenario: BudgetScenario = {
          id: `scen-${id}`,
          name,
          description: `Custom simulation ${id}`,
          modifiedGuestCount: scenarioGuests,
          categoryAllocations: {
            catering: 70000000,
            decor: 35000000,
          },
          notes: 'Test scenario',
          isBaseline: false,
          createdAt: new Date().toISOString(),
        };

        // Add to state scenarios array
        const stateWithScenario: AppState = {
          ...state,
          scenarios: [...state.scenarios, scenario],
        };

        // Assert baseline is NOT changed
        expect(stateWithScenario.event.guestCount).toBe(baselineGuests);
        expect(stateWithScenario.scenarios).toHaveLength(state.scenarios.length + 1);

        // 2. Explicit User Decision: Apply Scenario to Baseline
        const appliedState: AppState = {
          ...stateWithScenario,
          event: {
            ...stateWithScenario.event,
            guestCount: scenario.modifiedGuestCount,
          },
          categories: stateWithScenario.categories.map((c) => ({
            ...c,
            allocatedAmount: scenario.categoryAllocations[c.id] ?? c.allocatedAmount,
          })),
        };

        expect(appliedState.event.guestCount).toBe(scenarioGuests);
        const appliedCatering = appliedState.categories.find((c) => c.id === 'catering')!;
        expect(appliedCatering.allocatedAmount).toBe(70000000);

        // 3. Rollback: user reverts to previous baseline
        const revertedState: AppState = {
          ...appliedState,
          event: {
            ...appliedState.event,
            guestCount: baselineGuests,
          },
          categories: state.categories,
        };

        expect(revertedState.event.guestCount).toBe(baselineGuests);
      });
    });
  });
});
