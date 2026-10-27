import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBudgetOverview,
  calculateCategoryGuestAdjustments,
  classifyCategoryCostType,
  evaluateScenario,
} from '../domain/budgetEngine';
import { createInitialEventState, loadMultiEventStore, saveMultiEventStore, clearAllPersistedData } from '../persistence/storage';
import { AppState, BudgetScenario, EventDetails } from '../types';

const ONE_INR = 100;

describe('Priority 1 — Decision Simulator Guest-Count Sensitivity & Financial Regression', () => {
  let fiveLakhState: AppState;

  beforeEach(() => {
    clearAllPersistedData();

    // Baseline Event matching the prompt's exact scenario:
    // ₹5,00,000 budget, 150 confirmed guests, standard templates
    // Catering = 24% = ₹1,20,000
    // Venue = 30% = ₹1,50,000 (capacity 200)
    // Decor = 16% = ₹80,000
    // Photography = 14% = ₹70,000
    // Entertainment = 7.2% = ₹36,000
    // Logistics = 4.8% = ₹24,000
    // Contingency = 4% = ₹20,000
    const eventDetails: EventDetails = {
      id: 'evt-5lakh-test',
      name: 'Priya & Rohan Wedding',
      eventType: 'wedding',
      date: '2027-11-20',
      location: 'Kolkata, West Bengal',
      guestCount: 150,
      totalBudget: 500000 * ONE_INR, // ₹5,00,000
      currency: 'INR',
      status: 'planning',
      preferences: {
        style: 'Traditional',
        cateringType: 'Bengali Feast Buffet',
        dietaryRequirements: [],
        photographyTier: 'Standard',
        venuePreference: 'Banquet Hall',
        decorationPreference: 'Floral',
        accessibilityNeeds: [],
        planningPriorities: ['venue', 'catering', 'decor', 'photography', 'entertainment', 'logistics', 'contingency'],
        specialConstraints: [],
        optionalNotes: '',
      },
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    };

    fiveLakhState = createInitialEventState(eventDetails);
  });

  // --------------------------------------------------------------------------
  // Case A: Guest increase (150 -> 193 guests)
  // --------------------------------------------------------------------------
  describe('Case A: Guest Increase (150 -> 193 guests)', () => {
    it('increases variable catering estimate by implied rate (₹800/guest) and keeps fixed costs fixed', () => {
      const baselineOverview = calculateBudgetOverview(
        fiveLakhState.event.totalBudget,
        fiveLakhState.categories,
        fiveLakhState.expenses
      );
      expect(baselineOverview.effectiveProjectedTotal).toBe(500000 * ONE_INR);

      const cateringCat = fiveLakhState.categories.find((c) => c.id === 'catering')!;
      expect(cateringCat.allocatedAmount).toBe(120000 * ONE_INR); // ₹1,20,000

      // Baseline implied rate: ₹1,20,000 / 150 guests = ₹800 per guest (80,000 minor units)
      const impliedRate = Math.round(cateringCat.allocatedAmount / fiveLakhState.event.guestCount);
      expect(impliedRate).toBe(800 * ONE_INR);

      // Scenario: increase guests to 193 (+43 guests)
      const scenario: BudgetScenario = {
        id: 'scen-increase-193',
        name: 'Extended Guestlist (193)',
        description: 'Simulate +43 guests',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 193,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };

      const evaluation = evaluateScenario(fiveLakhState, scenario);

      // Catering projection: ₹1,20,000 + (43 * ₹800) = ₹1,54,400 (15,440,000 minor units)
      const cateringComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'catering')!;
      expect(cateringComp.baselineAllocated).toBe(120000 * ONE_INR);
      expect(cateringComp.scenarioAllocated).toBe(154400 * ONE_INR);
      expect(cateringComp.delta).toBe(34400 * ONE_INR); // +₹34,400

      // Fixed cost categories remain completely unchanged
      const photoComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'photography')!;
      expect(photoComp.scenarioAllocated).toBe(photoComp.baselineAllocated);
      expect(photoComp.delta).toBe(0);

      const decorComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'decor')!;
      expect(decorComp.scenarioAllocated).toBe(decorComp.baselineAllocated);
      expect(decorComp.delta).toBe(0);

      // Venue is under capacity (193 <= 200), so venue cost remains unchanged
      const venueComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'venue')!;
      expect(venueComp.scenarioAllocated).toBe(venueComp.baselineAllocated);
      expect(venueComp.delta).toBe(0);

      // Total projected spend: ₹5,00,000 + ₹34,400 = ₹5,34,400
      expect(evaluation.scenarioTotal).toBe(534400 * ONE_INR);
      expect(evaluation.deltaFromBaseline).toBe(34400 * ONE_INR);

      // Remaining budget / runway: ₹5,00,000 - ₹5,34,400 = -₹34,400 (over budget)
      expect(evaluation.remainingBudget).toBe(-34400 * ONE_INR);
      expect(evaluation.isOverrun).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Case B: Guest decrease (150 -> 120 guests)
  // --------------------------------------------------------------------------
  describe('Case B: Guest Decrease (150 -> 120 guests)', () => {
    it('decreases variable catering estimate and improves projected runway', () => {
      // Scenario: decrease guests to 120 (-30 guests)
      const scenario: BudgetScenario = {
        id: 'scen-decrease-120',
        name: 'Intimate Gathering (120)',
        description: 'Simulate -30 guests',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 120,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };

      const evaluation = evaluateScenario(fiveLakhState, scenario);

      // Catering delta: -30 guests * ₹800 = -₹24,000
      // Projected catering: ₹1,20,000 - ₹24,000 = ₹96,000
      const cateringComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'catering')!;
      expect(cateringComp.baselineAllocated).toBe(120000 * ONE_INR);
      expect(cateringComp.scenarioAllocated).toBe(96000 * ONE_INR);
      expect(cateringComp.delta).toBe(-24000 * ONE_INR);

      // Fixed costs remain unchanged
      const photoComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'photography')!;
      expect(photoComp.delta).toBe(0);

      // Projected total: ₹5,00,000 - ₹24,000 = ₹4,76,000
      expect(evaluation.scenarioTotal).toBe(476000 * ONE_INR);
      expect(evaluation.deltaFromBaseline).toBe(-24000 * ONE_INR);

      // Remaining runway improves to +₹24,000
      expect(evaluation.remainingBudget).toBe(24000 * ONE_INR);
      expect(evaluation.isOverrun).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Case C: No-change baseline (150 == 150 guests)
  // --------------------------------------------------------------------------
  describe('Case C: No-Change Baseline (150 guests)', () => {
    it('matches confirmed baseline spend and allocations exactly', () => {
      const scenario: BudgetScenario = {
        id: 'scen-nochange',
        name: 'Baseline Copy (150)',
        description: 'No guest changes',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 150,
        categoryAllocations: {},
        notes: '',
        isBaseline: true,
      };

      const evaluation = evaluateScenario(fiveLakhState, scenario);

      expect(evaluation.scenarioTotal).toBe(500000 * ONE_INR);
      expect(evaluation.deltaFromBaseline).toBe(0);
      expect(evaluation.remainingBudget).toBe(0);
      expect(evaluation.isOverrun).toBe(false);

      for (const comp of evaluation.categoryComparisons) {
        expect(comp.scenarioAllocated).toBe(comp.baselineAllocated);
        expect(comp.delta).toBe(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Case D: Category Sensitivity, Capacity Tiers & Boundary Conditions
  // --------------------------------------------------------------------------
  describe('Case D: Category Sensitivity, Capacity Tiers & Boundary Thresholds', () => {
    it('classifies variable, fixed, and capacity-tier categories correctly', () => {
      const catering = fiveLakhState.categories.find((c) => c.id === 'catering')!;
      const venue = fiveLakhState.categories.find((c) => c.id === 'venue')!;
      const photo = fiveLakhState.categories.find((c) => c.id === 'photography')!;

      expect(classifyCategoryCostType(catering)).toBe('variable');
      expect(classifyCategoryCostType(venue)).toBe('capacity_tier');
      expect(classifyCategoryCostType(photo)).toBe('fixed');
    });

    it('triggers capacity-tier surcharge when venue capacity threshold (200) is exceeded', () => {
      // 1. Boundary test: Exactly 200 guests (at capacity threshold)
      const atCapScenario: BudgetScenario = {
        id: 'scen-cap-200',
        name: 'Max Venue Capacity (200)',
        description: 'No surcharge under or at limit',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 200,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const evalAtCap = evaluateScenario(fiveLakhState, atCapScenario);
      const venueAtCap = evalAtCap.categoryComparisons.find((c) => c.categoryId === 'venue')!;
      expect(venueAtCap.delta).toBe(0); // 200 <= 200: no surcharge

      // 2. Boundary test: 201 guests (exceeds limit by 1 guest -> 1 overflow tier of 50)
      // Tier surcharge = 20% of baseline venue (20% of ₹1,50,000 = ₹30,000)
      const overCapScenario: BudgetScenario = {
        id: 'scen-cap-201',
        name: 'Venue Exceeded (201)',
        description: 'Triggers 1 tier block surcharge',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 201,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const evalOverCap = evaluateScenario(fiveLakhState, overCapScenario);
      const venueOverCap = evalOverCap.categoryComparisons.find((c) => c.categoryId === 'venue')!;
      expect(venueOverCap.delta).toBe(30000 * ONE_INR); // +₹30,000
      expect(venueOverCap.scenarioAllocated).toBe(180000 * ONE_INR); // ₹1,50,000 + ₹30,000

      // 3. Multi-tier test: 255 guests (55 overflow -> 2 tier blocks of 50 -> +₹60,000)
      const multiTierScenario: BudgetScenario = {
        id: 'scen-cap-255',
        name: 'Venue Doubly Exceeded (255)',
        description: 'Triggers 2 tier blocks surcharge',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 255,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const evalMultiTier = evaluateScenario(fiveLakhState, multiTierScenario);
      const venueMultiTier = evalMultiTier.categoryComparisons.find((c) => c.categoryId === 'venue')!;
      expect(venueMultiTier.delta).toBe(60000 * ONE_INR); // +₹60,000
    });

    it('handles zero guests by zeroing variable costs while retaining committed fixed costs', () => {
      const zeroGuestScenario: BudgetScenario = {
        id: 'scen-zero',
        name: 'Zero Guests',
        description: 'Check zero guest boundary',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 0,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const evalZero = evaluateScenario(fiveLakhState, zeroGuestScenario);
      const cateringComp = evalZero.categoryComparisons.find((c) => c.categoryId === 'catering')!;
      expect(cateringComp.scenarioAllocated).toBe(0); // All variable cost eliminated
      expect(cateringComp.delta).toBe(-120000 * ONE_INR);

      // Fixed photography is preserved
      const photoComp = evalZero.categoryComparisons.find((c) => c.categoryId === 'photography')!;
      expect(photoComp.scenarioAllocated).toBe(70000 * ONE_INR);
    });

    it('handles negative and non-finite guest counts safely', () => {
      const adjsNegative = calculateCategoryGuestAdjustments(fiveLakhState.categories, 150, -50);
      expect(adjsNegative.every((a) => a.projectedAmount >= 0)).toBe(true);

      const adjsNaN = calculateCategoryGuestAdjustments(fiveLakhState.categories, 150, NaN);
      expect(adjsNaN.every((a) => Number.isFinite(a.projectedAmount))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Case E: Interaction Between Guest Count and Category Reallocation Sliders
  // --------------------------------------------------------------------------
  describe('Case E: Interaction Between Guest Count and Category Sliders', () => {
    it('composes manual budget reallocation with dynamic guest scaling seamlessly', () => {
      // Step 1: User moves guests to 193 (+43 guests -> Catering = ₹1,54,400)
      const step1Scenario: BudgetScenario = {
        id: 'scen-step1',
        name: 'Step 1: Guests to 193',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 193,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };
      const eval1 = evaluateScenario(fiveLakhState, step1Scenario);
      expect(eval1.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(154400 * ONE_INR);

      // Step 2: User manually increases Decor allocation from ₹80,000 to ₹1,00,000 (+₹20,000)
      // and overrides Catering to ₹1,60,000
      const step2Scenario: BudgetScenario = {
        id: 'scen-step2',
        name: 'Step 2: Reallocations',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 193,
        categoryAllocations: {
          decor: 100000 * ONE_INR,
          catering: 160000 * ONE_INR,
        },
        notes: '',
        isBaseline: false,
      };
      const eval2 = evaluateScenario(fiveLakhState, step2Scenario);
      expect(eval2.categoryComparisons.find((c) => c.categoryId === 'decor')!.scenarioAllocated).toBe(100000 * ONE_INR);
      expect(eval2.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(160000 * ONE_INR);

      // Step 3: User resets guest count back to 150 while keeping custom decor allocation
      const step3Scenario: BudgetScenario = {
        id: 'scen-step3',
        name: 'Step 3: Guests back to 150 with custom decor',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 150,
        categoryAllocations: {
          decor: 100000 * ONE_INR,
        },
        notes: '',
        isBaseline: false,
      };
      const eval3 = evaluateScenario(fiveLakhState, step3Scenario);
      expect(eval3.categoryComparisons.find((c) => c.categoryId === 'decor')!.scenarioAllocated).toBe(100000 * ONE_INR);
      // Catering returns to baseline ₹1,20,000 because guest delta is 0 and no manual catering override was passed
      expect(eval3.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(120000 * ONE_INR);
    });
  });

  // --------------------------------------------------------------------------
  // Case F: Reset and Saved Scenarios Preservation
  // --------------------------------------------------------------------------
  describe('Case F: Reset and Saved Scenarios Preservation', () => {
    it('restores baseline scenario completely on reset and preserves saved scenarios faithfully', () => {
      // 1. Simulate and save a named scenario
      const customScenario: BudgetScenario = {
        id: 'scen-named-193',
        name: 'Gala Feast 193',
        description: 'Scaled catering and custom contingency',
        createdAt: '2026-10-27T10:00:00.000Z',
        modifiedGuestCount: 193,
        categoryAllocations: {
          catering: 154400 * ONE_INR,
          venue: 150000 * ONE_INR,
          contingency: 10000 * ONE_INR, // cut buffer by ₹10,000
        },
        notes: 'Modeled with 193 guests against 150 baseline.',
        isBaseline: false,
      };

      const stateWithScenario: AppState = {
        ...fiveLakhState,
        scenarios: [...fiveLakhState.scenarios, customScenario],
      };

      // 2. Evaluate the saved scenario
      const evalSaved = evaluateScenario(stateWithScenario, customScenario);
      expect(evalSaved.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(154400 * ONE_INR);
      expect(evalSaved.categoryComparisons.find((c) => c.categoryId === 'contingency')!.scenarioAllocated).toBe(10000 * ONE_INR);

      // 3. Evaluate baseline scenario
      const baselineScenario: BudgetScenario = {
        id: 'scen-baseline',
        name: 'Confirmed Baseline',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: stateWithScenario.event.guestCount,
        categoryAllocations: {},
        notes: '',
        isBaseline: true,
      };
      const evalReset = evaluateScenario(stateWithScenario, baselineScenario);
      expect(evalReset.scenarioTotal).toBe(500000 * ONE_INR);
      expect(evalReset.deltaFromBaseline).toBe(0);

      // 4. Confirm original event baseline was never mutated
      expect(stateWithScenario.event.guestCount).toBe(150);
      expect(stateWithScenario.event.totalBudget).toBe(500000 * ONE_INR);
      expect(stateWithScenario.categories.find((c) => c.id === 'catering')!.allocatedAmount).toBe(120000 * ONE_INR);
    });
  });

  // --------------------------------------------------------------------------
  // Case G: Multi-Event Isolation
  // --------------------------------------------------------------------------
  describe('Case G: Multi-Event Isolation', () => {
    it('guarantees complete isolation between two distinct events with different budgets and baselines', () => {
      // Event A: ₹5,00,000 budget, 150 guests, implied catering rate ₹800
      const eventA = fiveLakhState;

      // Event B: ₹25,00,000 budget, 200 guests, catering rate ₹3,500
      const eventBDetails: EventDetails = {
        id: 'evt-25lakh-test',
        name: 'Royal Heritage Wedding',
        eventType: 'wedding',
        date: '2027-12-18',
        location: 'Jaipur, Rajasthan',
        guestCount: 200,
        totalBudget: 2500000 * ONE_INR, // ₹25,00,000
        currency: 'INR',
        status: 'planning',
        preferences: {
          style: 'Palace Royal',
          cateringType: 'Multi-Cuisine Buffet',
          dietaryRequirements: [],
          photographyTier: 'Premium',
          venuePreference: 'Heritage Courtyard',
          decorationPreference: 'Lanterns',
          accessibilityNeeds: [],
          planningPriorities: ['venue', 'catering'],
          specialConstraints: [],
          optionalNotes: '',
        },
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };

      const eventB = createInitialEventState(eventBDetails);
      // Explicit per-guest cost on Event B catering
      eventB.categories = eventB.categories.map((c) =>
        c.id === 'catering' ? { ...c, perGuestCost: 3500 * ONE_INR } : c
      );

      // Persist both in multi-event store
      saveMultiEventStore(eventA, [eventA, eventB]);
      const store = loadMultiEventStore();
      expect(store.events['evt-5lakh-test']).toBeDefined();
      expect(store.events['evt-25lakh-test']).toBeDefined();

      // Simulate guest increase on Event B to 240 (+40 guests)
      const scenarioB: BudgetScenario = {
        id: 'scen-event-b',
        name: 'Event B Expansion',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 240,
        categoryAllocations: {},
        notes: '',
        isBaseline: false,
      };

      const evalB = evaluateScenario(eventB, scenarioB);
      // Event B catering delta: 40 * ₹3,500 = ₹1,40,000
      const cateringB = evalB.categoryComparisons.find((c) => c.categoryId === 'catering')!;
      expect(cateringB.delta).toBe(40 * 3500 * ONE_INR);

      // Verify Event A remains completely untouched
      const evalA = evaluateScenario(eventA, {
        id: 'scen-event-a',
        name: 'Event A Check',
        description: '',
        createdAt: new Date().toISOString(),
        modifiedGuestCount: 150,
        categoryAllocations: {},
        notes: '',
        isBaseline: true,
      });
      expect(evalA.scenarioTotal).toBe(500000 * ONE_INR);
      expect(evalA.categoryComparisons.find((c) => c.categoryId === 'catering')!.scenarioAllocated).toBe(120000 * ONE_INR);
      expect(eventA.event.guestCount).toBe(150);
      expect(eventA.event.totalBudget).toBe(500000 * ONE_INR);
    });
  });
});
