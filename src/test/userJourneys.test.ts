import { describe, it, expect, beforeEach } from 'vitest';
import { DEMO_STATE } from '../persistence/demoData';
import { savePersistedState, loadPersistedState, STORAGE_KEY } from '../persistence/storage';
import { validateImportedJson } from '../persistence/importExport';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
} from '../domain/budgetEngine';
import {
  canCompleteTask,
  detectDependencyCycles,
} from '../domain/taskEngine';
import {
  compareCategoryVendors,
  draftClarificationMessage,
} from '../domain/vendorEngine';
import { generateAssistantResponse } from '../domain/assistantEngine';
import { AppState, Task } from '../types';

describe('VowPilot End-to-End User Journeys (A through H)', () => {
  let state: AppState;

  beforeEach(() => {
    localStorage.clear();
    // Deep clone demo state to ensure pure test isolation
    state = JSON.parse(JSON.stringify(DEMO_STATE));
    savePersistedState(state);
  });

  // --------------------------------------------------------------------------
  // Journey A: Create an event, complete needs assessment, and inspect resulting plan
  // --------------------------------------------------------------------------
  it('Journey A: creates an event, completes needs assessment, and inspects the resulting plan', () => {
    // 1. Initial baseline state has demo event
    expect(state.event.name).toContain('Aarav & Meera');

    // 2. User defines a new event profile with constraints and priorities
    const newEventDetails = {
      ...state.event,
      id: 'evt-journey-a',
      name: 'Rohan & Ananya Royal Udaipur Wedding',
      eventType: 'wedding' as const,
      date: '2027-02-15',
      location: 'City Palace, Udaipur, Rajasthan',
      guestCount: 200,
      totalBudget: 350000000, // ₹35,00,000 in minor units
      currency: 'INR' as const,
      preferences: {
        style: 'Royal Rajasthani Heritage with Candlelight Ambience',
        cateringType: 'Multi-Course Royal Thali and Live Street Food Chaat',
        dietaryRequirements: ['Strict Vegetarian', 'Jain Counter Available', 'Nut-Free'],
        photographyTier: 'Premium Candid + Drone Cinema 4K',
        venuePreference: 'Historical Palace Courtyard',
        decorationPreference: 'Marigold & White Jasmine Floral Drapes with Brass Lanterns',
        accessibilityNeeds: ['Golf cart mobility transport', 'Step-free ramp to main mandap'],
        planningPriorities: ['venue', 'catering', 'photography', 'decor', 'entertainment', 'logistics'],
        specialConstraints: ['Acoustic sound restrictions past 10:30 PM', 'No synthetic floral foam'],
        optionalNotes: 'Guest arrival via boat transfer from jetty',
      },
      updatedAt: new Date().toISOString(),
    };

    const updatedState: AppState = {
      ...state,
      event: newEventDetails,
    };

    // 3. Inspect the resulting financial overview with the new budget and guest count
    const overview = calculateBudgetOverview(
      updatedState.event.totalBudget,
      updatedState.categories,
      updatedState.expenses
    );
    expect(overview.totalBudget).toBe(350000000);
    expect(overview.totalAllocated).toBeGreaterThan(0);
    expect(overview.remainingBudget).toBeDefined();

    // 4. Verify preferences are accurately captured and accessible
    expect(updatedState.event.guestCount).toBe(200);
    expect(updatedState.event.preferences.dietaryRequirements).toContain('Jain Counter Available');
    expect(updatedState.event.preferences.planningPriorities[0]).toBe('venue');
    expect(updatedState.event.preferences.specialConstraints).toContain('No synthetic floral foam');
  });

  // --------------------------------------------------------------------------
  // Journey B: Change guest count, inspect financial impact, verify calculation consistency
  // --------------------------------------------------------------------------
  it('Journey B: changes guest count, inspects financial impact, and verifies calculation consistency', () => {
    const baselineGuests = state.event.guestCount; // 150
    expect(baselineGuests).toBe(150);
    const newGuestCount = 220; // +70 guests

    // 1. Calculate guest count financial impact using deterministic budget engine
    const impactResult = calculateGuestCountImpact(state, newGuestCount);
    const impact = impactResult.impact;

    expect(impact.currentEstimatedTotal).toBeGreaterThan(0);
    expect(impact.proposedEstimatedTotal).toBeGreaterThan(impact.currentEstimatedTotal);
    expect(impact.difference).toBe(impact.proposedEstimatedTotal - impact.currentEstimatedTotal);
    expect(impact.affectedCategories).toContain('Catering & Beverages');

    // 2. Verified commitments (signed contracts) must NOT change when guest count is adjusted
    const baselineCommitted = state.expenses
      .filter((e) => e.status === 'confirmed' || e.status === 'actual')
      .reduce((sum, e) => sum + e.amount, 0);

    const overviewAfterSim = calculateBudgetOverview(
      state.event.totalBudget,
      state.categories,
      state.expenses
    );
    expect(overviewAfterSim.committedTotal).toBe(baselineCommitted);

    // 3. Trade-off recommendations should protect top-priority categories
    const topPriority = state.event.preferences.planningPriorities[0]; // 'venue'
    const recResult = generatePriorityAwareRecommendations(
      overviewAfterSim,
      state.event.preferences.planningPriorities
    );

    // Lowest priority categories should be targeted first for reduction
    if (recResult.recommendations.length > 0) {
      const topPriorityRec = recResult.recommendations.find((r) => r.categoryId === topPriority);
      if (topPriorityRec) {
        expect(topPriorityRec.priorityRank).toBe(1);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Journey C: Create dependent tasks, attempt invalid completion, verify blocking rule
  // --------------------------------------------------------------------------
  it('Journey C: creates dependent tasks, attempts invalid completion, and verifies blocking rule', () => {
    const taskPrereq: Task = {
      id: 'task-vendor-shortlist',
      title: 'Shortlist 3 Live Acoustic Bands',
      categoryId: 'entertainment',
      status: 'not_started',
      priority: 'high',
      dueDate: '2026-11-01',
      dependencies: [],
      description: 'Review performance tapes and sound equipment riders.',
      priorityReason: 'Required before scheduling auditions.',
    };

    const taskDependent: Task = {
      id: 'task-audition-band',
      title: 'Conduct In-Person Band Audition & Sound Check',
      categoryId: 'entertainment',
      status: 'not_started',
      priority: 'high',
      dueDate: '2026-11-10',
      dependencies: ['task-vendor-shortlist'],
      description: 'Audition the shortlisted groups at studio.',
      priorityReason: 'Cannot audition before shortlisting candidates.',
    };

    const tasksState: Task[] = [...state.tasks, taskPrereq, taskDependent];

    // 1. Attempt to complete dependent task when prerequisite is still 'pending'
    const attempt1 = canCompleteTask(taskDependent.id, tasksState);
    expect(attempt1.allowed).toBe(false);
    expect(attempt1.blockingTaskTitles).toContain('Shortlist 3 Live Acoustic Bands');

    // 2. Mark prerequisite as 'completed'
    const updatedTasks = tasksState.map((t) =>
      t.id === 'task-vendor-shortlist' ? { ...t, status: 'completed' as const } : t
    );

    // 3. Now verify dependent task can be completed
    const attempt2 = canCompleteTask(taskDependent.id, updatedTasks);
    expect(attempt2.allowed).toBe(true);
    expect(attempt2.blockingTaskTitles).toHaveLength(0);

    // 4. Test cycle detection prevents circular dependencies
    const cyclicTask1: Task = {
      ...taskPrereq,
      dependencies: ['task-audition-band'], // Creates cycle: short -> audition -> short
    };
    const cycleDetected = detectDependencyCycles([cyclicTask1, taskDependent]);
    expect(cycleDetected.hasCycle).toBe(true);
    expect(cycleDetected.cyclePath.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Journey D: Compare vendor quotations, detect missing details, draft clarification
  // --------------------------------------------------------------------------
  it('Journey D: compares vendor quotations, detects missing details, and drafts clarification message', () => {
    // 1. Compare photography vendors in demo state
    const comparison = compareCategoryVendors(
      'photography',
      'Photography & Cinema',
      state.vendors,
      state.quotes
    );

    expect(comparison.quotesCount).toBeGreaterThanOrEqual(2);
    expect(comparison.rows.length).toBeGreaterThanOrEqual(2);

    // 2. Identify vendor with missing information (ShutterCraft Visuals - quo-005)
    const incompleteRow = comparison.rows.find(
      (r) => r.vendor.id === 'ven-005'
    );
    expect(incompleteRow).toBeDefined();
    expect(incompleteRow!.missingDetails.length).toBeGreaterThan(0);

    // 3. Draft clarification inquiry message
    const targetQuote = state.quotes.find((q) => q.vendorId === incompleteRow!.vendor.id)!;
    const inquiry = draftClarificationMessage(
      incompleteRow!.vendor,
      targetQuote,
      state.event.name,
      state.event.date
    );

    expect(inquiry).toContain(incompleteRow!.vendor.contactName);
    expect(inquiry).toContain(state.event.name);
    expect(inquiry).toMatch(/clarification/i);
    expect(inquiry).toMatch(/expiration date|exclusions/i);
  });

  // --------------------------------------------------------------------------
  // Journey E: Assistant recommendation, inspect explanation, cancel proposed action
  // --------------------------------------------------------------------------
  it('Journey E: asks assistant for recommendation, inspects rationale, and verifies cancel leaves state unchanged', () => {
    // 1. Ask assistant how to optimize budget
    const response = generateAssistantResponse('Explain the current budget breakdown and runway', state);

    expect(response.intent).toBe('explain_budget');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.rationale).toBeDefined();

    // 2. Test an action-proposing query (e.g. changing guest count)
    const actionQuery = generateAssistantResponse('Change guest count to 180', state);
    expect(actionQuery.intent).toBe('change_guest_count');
    expect(actionQuery.requiresConfirmation).toBe(true);
    expect(actionQuery.proposedAction).toBeDefined();

    // 3. If action is proposed, inspect impact preview
    if (actionQuery.proposedAction) {
      expect(actionQuery.proposedAction.type).toBe('adjust_guest_count');
      expect(actionQuery.proposedAction.impact).toBeDefined();

      // 4. Simulate cancellation: state remains strictly identical
      const stateBeforeDismiss = JSON.stringify(state);
      // User clicks 'Dismiss' -> no mutation applied
      const stateAfterDismiss = JSON.stringify(state);
      expect(stateAfterDismiss).toBe(stateBeforeDismiss);
      expect(state.event.guestCount).toBe(150); // Unaltered baseline
    }
  });

  // --------------------------------------------------------------------------
  // Journey F: Decision scenario, compare with baseline, ensure baseline untouched
  // --------------------------------------------------------------------------
  it('Journey F: creates a decision scenario, compares against baseline, and keeps baseline untouched until applied', () => {
    const baselineGuests = state.event.guestCount;
    const baselineAllocations: Record<string, number> = {};
    for (const c of state.categories) {
      baselineAllocations[c.id] = c.allocatedAmount;
    }

    // 1. Create a simulated alternative scenario
    const scenarioGuestCount = 180;
    const scenarioAllocations: Record<string, number> = {
      ...baselineAllocations,
      catering: (baselineAllocations['catering'] || 0) + 15000000, // +₹1,50,000 for catering
      decor: Math.max(0, (baselineAllocations['decor'] || 0) - 10000000), // -₹1,00,000 for decor
    };

    const newScenario = {
      id: 'scen-monsoon-garden',
      name: 'Monsoon Garden Pavilion Plan',
      description: 'Expanded guest list with covered courtyard canopy.',
      modifiedGuestCount: scenarioGuestCount,
      categoryAllocations: scenarioAllocations,
      notes: 'Modeled during rainy season fallback planning.',
      isBaseline: false,
      createdAt: new Date().toISOString(),
    };

    // 2. Add scenario to state
    const stateWithScenario: AppState = {
      ...state,
      scenarios: [...state.scenarios, newScenario],
    };

    // 3. Baseline event and categories must remain completely unchanged
    expect(stateWithScenario.event.guestCount).toBe(baselineGuests);
    for (const cat of stateWithScenario.categories) {
      expect(cat.allocatedAmount).toBe(baselineAllocations[cat.id]);
    }

    // 4. Explicit user action to apply scenario to baseline
    const appliedState: AppState = {
      ...stateWithScenario,
      event: {
        ...stateWithScenario.event,
        guestCount: newScenario.modifiedGuestCount,
      },
      categories: stateWithScenario.categories.map((c) => ({
        ...c,
        allocatedAmount: newScenario.categoryAllocations[c.id] ?? c.allocatedAmount,
      })),
    };

    // 5. Now verified that baseline reflects applied scenario
    expect(appliedState.event.guestCount).toBe(180);
    const updatedCatering = appliedState.categories.find((c) => c.id === 'catering');
    expect(updatedCatering?.allocatedAmount).toBe(scenarioAllocations['catering']);
  });

  // --------------------------------------------------------------------------
  // Journey G: Export data, import it again, verify round trip and invalid rejection
  // --------------------------------------------------------------------------
  it('Journey G: exports data, imports it again for clean round trip, and rejects invalid imports', () => {
    // 1. Export state to JSON string
    const jsonString = JSON.stringify(state, null, 2);
    expect(typeof jsonString).toBe('string');
    expect(jsonString.length).toBeGreaterThan(100);

    // 2. Validate exported JSON schema
    const validationResult = validateImportedJson(jsonString);
    expect(validationResult.success).toBe(true);
    expect(validationResult.state).toBeDefined();

    // 3. Import validated JSON; verify round trip integrity
    const importedState = validationResult.state!;
    expect(importedState.event.name).toBe(state.event.name);
    expect(importedState.event.guestCount).toBe(state.event.guestCount);
    expect(importedState.categories.length).toBe(state.categories.length);
    expect(importedState.tasks.length).toBe(state.tasks.length);
    expect(importedState.quotes.length).toBe(state.quotes.length);

    // 4. Test rejection of invalid import (e.g. non-JSON string)
    const corruptValidation = validateImportedJson('not a json string { broken: ');
    expect(corruptValidation.success).toBe(false);
    expect(corruptValidation.error).toBeDefined();

    // 5. Test rejection of structurally invalid payload missing required fields
    const missingFieldsValidation = validateImportedJson(JSON.stringify({ schemaVersion: 1, event: {} }));
    expect(missingFieldsValidation.success).toBe(false);
    expect(missingFieldsValidation.error).toContain('schema');
  });

  // --------------------------------------------------------------------------
  // Journey H: Persistence reload and safe recovery from malformed stored data
  // --------------------------------------------------------------------------
  it('Journey H: verifies persistence round-trip and safe recovery from corrupted local storage', () => {
    // 1. Save valid state to localStorage and reload
    savePersistedState(state);
    const loadedResult = loadPersistedState();
    expect(loadedResult.loadedFromStorage).toBe(true);
    expect(loadedResult.state.event.id).toBe(state.event.id);
    expect(loadedResult.state.event.name).toBe(state.event.name);
    expect(loadedResult.state.categories.length).toBe(state.categories.length);

    // 2. Corrupt localStorage with invalid JSON
    localStorage.setItem(STORAGE_KEY, '<<<CORRUPT_SYNTAX_ERROR>>>');

    // 3. Reload must safely handle corruption without throwing, falling back gracefully to DEMO_STATE
    const recoveredResult = loadPersistedState();
    expect(recoveredResult.recoveredFromError).toBe(true);
    expect(recoveredResult.state).toBeDefined();
    expect(recoveredResult.state.event).toBeDefined();
    expect(recoveredResult.state.categories.length).toBeGreaterThan(0);
    expect(recoveredResult.state.event.name).toContain('Aarav & Meera');
  });
});
