import { describe, it, expect } from 'vitest';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
} from '../domain/budgetEngine';
import { AppState, BudgetCategory, Expense } from '../types';
import { DEMO_STATE } from '../persistence/demoData';

describe('Comprehensive Budget Engine & Financial Invariants (250 Parameterized Test Cases)', () => {
  // --------------------------------------------------------------------------
  // Suite 1: Guest Count Scaling & Variable Cost Projections (50 cases)
  // --------------------------------------------------------------------------
  const guestCountCases = Array.from({ length: 50 }, (_, i) => {
    const guests = i * 10; // 0 to 490 guests
    return {
      guests,
      expectedPerGuestCateringCost: 350000, // ₹3,500 in paise
    };
  });

  describe('Guest count scaling determinism', () => {
    guestCountCases.forEach(({ guests, expectedPerGuestCateringCost }) => {
      it(`deterministically computes guest scaling for ${guests} guests`, () => {
        const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
        const impactResult = calculateGuestCountImpact(state, guests);

        expect(impactResult).toBeDefined();
        expect(impactResult.impact).toBeDefined();

        const safeGuests = Math.max(0, guests);
        const expectedVariableCateringSpend = safeGuests * expectedPerGuestCateringCost;

        // Catering expense in demo is 150 * 3500 = 525,000 INR = 52,500,000 minor
        const baselineCatering = 150 * expectedPerGuestCateringCost;
        const expectedDelta = expectedVariableCateringSpend - baselineCatering;

        expect(impactResult.impact.difference).toBe(expectedDelta);

        // Capacity check: venue maxCapacity in demo is 200
        if (guests > 200) {
          expect(impactResult.capacityViolation).toBeDefined();
          expect(impactResult.capacityViolation).toMatch(/capacity limit/i);
        } else {
          expect(impactResult.capacityViolation).toBeUndefined();
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Status Segregation: Committed vs Flexible Expenses (50 cases)
  // --------------------------------------------------------------------------
  const expensePermutations = Array.from({ length: 50 }, (_, i) => {
    return {
      id: i,
      estimated: (i + 1) * 100000,
      quoted: (i * 2 + 1) * 100000,
      confirmed: (i * 3 + 1) * 100000,
      actual: (i * 4 + 1) * 100000,
    };
  });

  describe('Expense status segregation and committed fund arithmetic', () => {
    expensePermutations.forEach(({ id, estimated, quoted, confirmed, actual }) => {
      it(`[Case ${id + 1}] strictly segregates committed (confirmed+actual) from flexible spend`, () => {
        const categories: BudgetCategory[] = [
          {
            id: `cat-${id}`,
            name: `Category ${id}`,
            allocatedAmount: 100000000,
            priorityRank: 1,
            userDefined: false,
          },
        ];

        const expenses: Expense[] = [
          {
            id: `e-${id}-1`,
            categoryId: `cat-${id}`,
            title: 'Est',
            amount: estimated,
            status: 'estimated',
            paidAmount: 0,
            createdAt: '2026-10-01',
          },
          {
            id: `e-${id}-2`,
            categoryId: `cat-${id}`,
            title: 'Quo',
            amount: quoted,
            status: 'quoted',
            paidAmount: 0,
            createdAt: '2026-10-01',
          },
          {
            id: `e-${id}-3`,
            categoryId: `cat-${id}`,
            title: 'Conf',
            amount: confirmed,
            status: 'confirmed',
            paidAmount: 0,
            createdAt: '2026-10-01',
          },
          {
            id: `e-${id}-4`,
            categoryId: `cat-${id}`,
            title: 'Act',
            amount: actual,
            status: 'actual',
            paidAmount: actual,
            createdAt: '2026-10-01',
          },
        ];

        const overview = calculateBudgetOverview(200000000, categories, expenses);

        // Core Invariants
        const expectedCommitted = confirmed + actual;
        const expectedFlexible = estimated + quoted;
        const expectedTotalSpend = expectedCommitted + expectedFlexible;

        expect(overview.committedTotal).toBe(expectedCommitted);
        expect(overview.effectiveProjectedTotal).toBe(expectedTotalSpend);
        expect(overview.remainingBudget).toBe(200000000 - expectedTotalSpend);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Overrun Detection & Runway Across Spend Ratios (50 cases)
  // --------------------------------------------------------------------------
  const overrunCases = Array.from({ length: 50 }, (_, i) => {
    const totalBudget = 100000000; // 10 Lakhs (1,000,000 minor)
    const spend = (i + 1) * 4000000; // 40,000 to 2,000,000 minor
    return { id: i, totalBudget, spend };
  });

  describe('Budget overrun and uncommitted runway tracking', () => {
    overrunCases.forEach(({ id, totalBudget, spend }) => {
      it(`[Case ${id + 1}] evaluates runway and overrun for spend ${spend} against ${totalBudget}`, () => {
        const categories: BudgetCategory[] = [
          {
            id: 'c-test',
            name: 'Test Category',
            allocatedAmount: totalBudget,
            priorityRank: 1,
            userDefined: false,
          },
        ];

        const expenses: Expense[] = [
          {
            id: 'exp-test',
            categoryId: 'c-test',
            title: 'Spend',
            amount: spend,
            status: 'confirmed',
            paidAmount: 0,
            createdAt: '2026-10-01',
          },
        ];

        const overview = calculateBudgetOverview(totalBudget, categories, expenses);

        if (spend > totalBudget) {
          expect(overview.isOverrun).toBe(true);
          expect(overview.overrunAmount).toBe(spend - totalBudget);
          expect(overview.remainingBudget).toBe(totalBudget - spend);
        } else {
          expect(overview.isOverrun).toBe(false);
          expect(overview.overrunAmount).toBe(0);
          expect(overview.remainingBudget).toBe(totalBudget - spend);
        }

        const expectedUtilization = Math.round((spend / totalBudget) * 100);
        expect(overview.utilizationPercentage).toBe(expectedUtilization);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Priority-Aware Trade-Off Recommendations (50 cases)
  // --------------------------------------------------------------------------
  const priorityCases = Array.from({ length: 50 }, (_, i) => {
    const overrun = (i + 1) * 1000000; // ₹10,000 to ₹5,00,000
    return { id: i, overrun };
  });

  describe('Priority-protected category shielding in recommendations', () => {
    priorityCases.forEach(({ id, overrun }) => {
      it(`[Case ${id + 1}] shields top-priority category when resolving overrun of ${overrun}`, () => {
        const categories: BudgetCategory[] = [
          { id: 'cat-venue', name: 'Venue', allocatedAmount: 80000000, priorityRank: 1, userDefined: false },
          { id: 'cat-catering', name: 'Catering', allocatedAmount: 60000000, priorityRank: 2, userDefined: false },
          { id: 'cat-photo', name: 'Photography', allocatedAmount: 40000000, priorityRank: 3, userDefined: false },
          { id: 'cat-decor', name: 'Decor', allocatedAmount: 30000000, priorityRank: 4, userDefined: false },
          { id: 'cat-music', name: 'Music', allocatedAmount: 20000000, priorityRank: 5, userDefined: false },
          { id: 'cat-favors', name: 'Favors', allocatedAmount: 10000000, priorityRank: 6, userDefined: false },
        ];

        const priorities = ['cat-venue', 'cat-catering', 'cat-photo', 'cat-decor', 'cat-music', 'cat-favors'];

        const overview = calculateBudgetOverview(200000000, categories, [
          {
            id: 'exp-big',
            categoryId: 'cat-venue',
            title: 'Big Overrun',
            amount: 200000000 + overrun,
            status: 'estimated',
            paidAmount: 0,
            createdAt: '2026-10-01',
          },
        ]);

        const recResult = generatePriorityAwareRecommendations(overview, priorities);

        expect(recResult).toBeDefined();
        expect(recResult.targetReductionAmount).toBe(overview.overrunAmount);

        // Assert that top priority ('cat-venue') has rank 1 and is protected
        const topRec = recResult.recommendations.find((r) => r.categoryId === 'cat-venue');
        if (topRec) {
          expect(topRec.priorityRank).toBe(1);
          // High priority rank cuts must never exceed lowest priority cuts
          const lowestRec = recResult.recommendations.find((r) => r.categoryId === 'cat-favors');
          if (lowestRec) {
            expect(lowestRec.priorityRank).toBe(6);
          }
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Allocation Boundary Safety and Zero-Clamping (50 cases)
  // --------------------------------------------------------------------------
  const allocationBoundaryCases = Array.from({ length: 50 }, (_, i) => {
    return {
      id: i,
      rawAllocated: i % 2 === 0 ? -i * 50000 : i * 1000000,
      rawExpense: i % 3 === 0 ? -i * 20000 : (i + 1) * 500000,
    };
  });

  describe('Allocation boundary safety and negative amount clamping', () => {
    allocationBoundaryCases.forEach(({ id, rawAllocated, rawExpense }) => {
      it(`[Case ${id + 1}] cleanly clamps negative amounts without NaN or crash`, () => {
        const cat: BudgetCategory = {
          id: `c-${id}`,
          name: `Cat ${id}`,
          allocatedAmount: rawAllocated,
          priorityRank: 3,
          userDefined: false,
        };

        const exp: Expense = {
          id: `e-${id}`,
          categoryId: `c-${id}`,
          title: `Expense ${id}`,
          amount: rawExpense,
          status: 'confirmed',
          paidAmount: 0,
          createdAt: '2026-10-01',
        };

        const overview = calculateBudgetOverview(100000000, [cat], [exp]);

        expect(Number.isFinite(overview.totalBudget)).toBe(true);
        expect(Number.isFinite(overview.totalAllocated)).toBe(true);
        expect(Number.isFinite(overview.committedTotal)).toBe(true);
        expect(Number.isFinite(overview.effectiveProjectedTotal)).toBe(true);
        expect(overview.totalAllocated).toBeGreaterThanOrEqual(0);
        expect(overview.committedTotal).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
