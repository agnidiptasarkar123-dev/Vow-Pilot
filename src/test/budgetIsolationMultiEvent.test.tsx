import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { EventProvider, useEvent } from '../context/EventContext';
import { ThemeProvider } from '../context/ThemeContext';
import {
  loadAllEventsFromStorage,
  saveAllEventsToStorage,
  createInitialEventState,
} from '../persistence/storage';
import { calculateBudgetOverview, initializeCategoriesForBudget } from '../domain/budgetEngine';
import { toMinorUnits } from '../domain/currency';
import { EventDetails } from '../types';
import { Header } from '../components/common/Header';
import { DashboardView } from '../components/dashboard/DashboardView';
import { SettingsView } from '../components/settings/SettingsView';

describe('VowPilot — Critical Budget Isolation & Multi-Event Regression Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const createEventMock = (overrides?: Partial<EventDetails>): EventDetails => ({
    id: overrides?.id || 'evt_test_' + Math.random().toString(36).substring(2, 9),
    name: overrides?.name || 'Test Celebration',
    eventType: overrides?.eventType || 'wedding',
    date: '2027-12-15',
    location: 'Kolkata',
    guestCount: 250,
    totalBudget: overrides?.totalBudget ?? toMinorUnits(500000), // 5 Lakh INR default (50,000,000 paise)
    currency: 'INR',
    status: 'planning',
    preferences: {
      style: 'Traditional Royal',
      cateringType: 'Multi-Cuisine Buffet',
      dietaryRequirements: [],
      photographyTier: 'Standard',
      venuePreference: 'Banquet Hall',
      decorationPreference: 'Floral & Ambient',
      accessibilityNeeds: [],
      planningPriorities: ['venue', 'catering'],
      specialConstraints: [],
      optionalNotes: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  // Scenario 1: Create Event A with ₹25 crore, then Event B with ₹5 lakh. Event B must retain ₹5 lakh everywhere.
  it('Scenario 1: creates Event A (₹25 Cr) and Event B (₹5 Lakh); Event B strictly retains ₹5 Lakh with zero leakage', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    // 1. Create Event A with ₹25,00,00,000 (25 crore INR = 25,000,000,000 paise)
    const budgetA = toMinorUnits(250000000);
    const eventA = createEventMock({
      id: 'event_a_25cr',
      name: 'Event A - Royal 25 Crore Gala',
      totalBudget: budgetA,
    });

    act(() => {
      result.current.createEvent(eventA);
    });

    expect(result.current.state.event.id).toBe('event_a_25cr');
    expect(result.current.state.event.totalBudget).toBe(budgetA);

    const summaryA = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(summaryA.totalBudget).toBe(budgetA);
    expect(summaryA.effectiveProjectedTotal).toBe(budgetA);
    expect(summaryA.isOverrun).toBe(false);

    // 2. Create Event B with ₹5,00,000 (5 lakh INR = 50,000,000 paise)
    const budgetB = toMinorUnits(500000);
    const eventB = createEventMock({
      id: 'event_b_5lakh',
      name: 'Event B - Intimate 5 Lakh Wedding',
      totalBudget: budgetB,
    });

    act(() => {
      result.current.createEvent(eventB);
    });

    // Verify Event B is now active and its budget is strictly ₹5 Lakh
    expect(result.current.state.event.id).toBe('event_b_5lakh');
    expect(result.current.state.event.totalBudget).toBe(budgetB);
    expect(result.current.state.event.totalBudget).not.toBe(budgetA);

    // Verify Event B's category allocations sum exactly to ₹5 Lakh (50,000,000 paise)
    const totalAllocatedB = result.current.state.categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
    expect(totalAllocatedB).toBe(budgetB);

    // Verify Event B has zero inherited expenses
    expect(result.current.state.expenses).toHaveLength(0);

    // Verify budget summary has no false overrun or ₹23.75L phantom spend
    const summaryB = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(summaryB.totalBudget).toBe(budgetB);
    expect(summaryB.effectiveProjectedTotal).toBe(budgetB); // exactly ₹5 Lakh
    expect(summaryB.isOverrun).toBe(false);
    expect(summaryB.overrunAmount).toBe(0);
    expect(summaryB.utilizationPercentage).toBe(100);
  });

  // Scenario 2: Switch A → B → A. Each event must restore its own budget.
  it('Scenario 2: switches A -> B -> A; each event seamlessly restores its own independent budget', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    const budgetA = toMinorUnits(250000000); // ₹25 Cr
    const budgetB = toMinorUnits(500000);    // ₹5 Lakh

    const eventA = createEventMock({ id: 'event_a', totalBudget: budgetA, name: 'Event A' });
    const eventB = createEventMock({ id: 'event_b', totalBudget: budgetB, name: 'Event B' });

    act(() => {
      result.current.createEvent(eventA);
    });
    act(() => {
      result.current.createEvent(eventB);
    });

    // Currently on B
    expect(result.current.state.event.id).toBe('event_b');
    expect(result.current.state.event.totalBudget).toBe(budgetB);

    // Switch B -> A
    act(() => {
      result.current.switchEvent('event_a');
    });
    expect(result.current.state.event.id).toBe('event_a');
    expect(result.current.state.event.totalBudget).toBe(budgetA);
    const sumA = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(sumA.totalBudget).toBe(budgetA);

    // Switch A -> B
    act(() => {
      result.current.switchEvent('event_b');
    });
    expect(result.current.state.event.id).toBe('event_b');
    expect(result.current.state.event.totalBudget).toBe(budgetB);
    const sumB = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(sumB.totalBudget).toBe(budgetB);

    // Switch B -> A again
    act(() => {
      result.current.switchEvent('event_a');
    });
    expect(result.current.state.event.id).toBe('event_a');
    expect(result.current.state.event.totalBudget).toBe(budgetA);
  });

  // Scenario 3: Change Event B's budget. Event A must remain unchanged.
  it("Scenario 3: modifying Event B's budget leaves Event A completely untouched", () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    const budgetA = toMinorUnits(250000000); // ₹25 Cr
    const budgetBInitial = toMinorUnits(500000); // ₹5 Lakh
    const budgetBUpdated = toMinorUnits(750000); // ₹7.5 Lakh

    act(() => {
      result.current.createEvent(createEventMock({ id: 'event_a', totalBudget: budgetA }));
    });
    act(() => {
      result.current.createEvent(createEventMock({ id: 'event_b', totalBudget: budgetBInitial }));
    });

    // Update Event B's budget
    act(() => {
      result.current.updateEvent({
        ...result.current.state.event,
        totalBudget: budgetBUpdated,
      });
    });
    expect(result.current.state.event.totalBudget).toBe(budgetBUpdated);

    // Switch to Event A
    act(() => {
      result.current.switchEvent('event_a');
    });

    // Event A's budget must remain strictly unchanged at ₹25 Cr
    expect(result.current.state.event.id).toBe('event_a');
    expect(result.current.state.event.totalBudget).toBe(budgetA);

    // Switch back to Event B
    act(() => {
      result.current.switchEvent('event_b');
    });
    expect(result.current.state.event.id).toBe('event_b');
    expect(result.current.state.event.totalBudget).toBe(budgetBUpdated);
  });

  // Scenario 4: Add expenses to Event A. They must not appear in Event B.
  it('Scenario 4: expenses added to Event A do not leak into Event B', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    const budgetA = toMinorUnits(250000000);
    const budgetB = toMinorUnits(500000);

    act(() => {
      result.current.createEvent(createEventMock({ id: 'event_a', totalBudget: budgetA }));
    });
    act(() => {
      result.current.createEvent(createEventMock({ id: 'event_b', totalBudget: budgetB }));
    });

    // Switch to Event A and add an expense
    act(() => {
      result.current.switchEvent('event_a');
    });

    const categoryIdA = result.current.state.categories[0].id;

    act(() => {
      result.current.addExpense({
        categoryId: categoryIdA,
        title: 'Grand Ballroom Booking Deposit',
        amount: toMinorUnits(5000000), // ₹50 Lakh
        status: 'confirmed',
        vendorId: 'v1',
        dueDate: '2027-01-15',
        paidAmount: toMinorUnits(5000000),
        notes: 'Initial non-refundable deposit',
      });
    });

    expect(result.current.state.expenses).toHaveLength(1);
    expect(result.current.state.expenses[0].title).toBe('Grand Ballroom Booking Deposit');

    // Switch to Event B
    act(() => {
      result.current.switchEvent('event_b');
    });

    // Event B must have zero expenses
    expect(result.current.state.expenses).toHaveLength(0);
    expect(result.current.state.expenses.some((e) => e.title === 'Grand Ballroom Booking Deposit')).toBe(false);

    // Event B's calculations must not include the ₹50 Lakh expense
    const summaryB = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(summaryB.committedTotal).toBe(0);
    expect(summaryB.isOverrun).toBe(false);
  });

  // Scenario 5: Reload the application. Both events must retain their correct budgets and expenses.
  it('Scenario 5: preserves both events across page reload/persistence simulation', () => {
    const budgetA = toMinorUnits(250000000);
    const budgetB = toMinorUnits(500000);

    // Initial session
    const { result: hook1, unmount } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    act(() => {
      hook1.current.createEvent(createEventMock({ id: 'event_a', name: 'Event A Saved', totalBudget: budgetA }));
    });

    // Add an expense to A
    const catA = hook1.current.state.categories[0].id;
    act(() => {
      hook1.current.addExpense({
        categoryId: catA,
        title: 'Palace Lighting',
        amount: toMinorUnits(1000000), // ₹10 Lakh
        status: 'actual',
        paidAmount: toMinorUnits(1000000),
        dueDate: '2027-02-01',
      });
    });

    act(() => {
      hook1.current.createEvent(createEventMock({ id: 'event_b', name: 'Event B Saved', totalBudget: budgetB }));
    });

    // Add an expense to B
    const catB = hook1.current.state.categories[1].id;
    act(() => {
      hook1.current.addExpense({
        categoryId: catB,
        title: 'Boutique Florist',
        amount: toMinorUnits(50000), // ₹50,000
        status: 'confirmed',
        paidAmount: toMinorUnits(25000),
        dueDate: '2027-03-01',
      });
    });

    // Verify localStorage has the events store
    const stored = loadAllEventsFromStorage();
    expect(stored.activeEventId).toBe('event_b');
    expect(stored.events['event_a']).toBeDefined();
    expect(stored.events['event_b']).toBeDefined();

    // Unmount hook1 (simulate browser close)
    unmount();

    // New session (simulate reload)
    const { result: hook2 } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    // Active event is B
    expect(hook2.current.state.event.id).toBe('event_b');
    expect(hook2.current.state.event.totalBudget).toBe(budgetB);
    expect(hook2.current.state.expenses).toHaveLength(1);
    expect(hook2.current.state.expenses[0].title).toBe('Boutique Florist');

    // Switch to A after reload
    act(() => {
      hook2.current.switchEvent('event_a');
    });

    expect(hook2.current.state.event.id).toBe('event_a');
    expect(hook2.current.state.event.totalBudget).toBe(budgetA);
    expect(hook2.current.state.expenses).toHaveLength(1);
    expect(hook2.current.state.expenses[0].title).toBe('Palace Lighting');
  });

  // Scenario 6: Verify remaining balance, spending percentage, overrun detection and simulator calculations
  it('Scenario 6: calculates metrics, overruns, and simulator values strictly against the active event data', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    const budgetB = toMinorUnits(500000); // ₹5 Lakh (50,000,000 paise)

    act(() => {
      result.current.createEvent(createEventMock({ id: 'event_b_metric', totalBudget: budgetB }));
    });

    const catId = result.current.state.categories[0].id;

    // Add an expense within budget (e.g. ₹1 Lakh)
    act(() => {
      result.current.addExpense({
        categoryId: catId,
        title: 'Catering Advance',
        amount: toMinorUnits(100000),
        status: 'actual',
        paidAmount: toMinorUnits(100000),
        dueDate: '2027-04-01',
      });
    });

    const summaryWithin = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    expect(summaryWithin.isOverrun).toBe(false);
    expect(summaryWithin.overrunAmount).toBe(0);

    // Now add a massive expense to Event B that causes a legitimate budget overrun
    act(() => {
      result.current.addExpense({
        categoryId: catId,
        title: 'Celebrity Appearance',
        amount: toMinorUnits(600000), // ₹6 Lakh (exceeds total budget of ₹5 Lakh on its own!)
        status: 'actual',
        paidAmount: toMinorUnits(600000),
        dueDate: '2027-04-02',
      });
    });

    const summaryOverrun = calculateBudgetOverview(
      result.current.state.event.totalBudget,
      result.current.state.categories,
      result.current.state.expenses
    );
    // Legitimate overrun detected based purely on Event B's data
    expect(summaryOverrun.isOverrun).toBe(true);
    expect(summaryOverrun.overrunAmount).toBeGreaterThan(0);
    expect(summaryOverrun.utilizationPercentage).toBeGreaterThan(100);
  });

  // Scenario 7: Test rapid event creation or switching without race conditions
  it('Scenario 7: handles rapid creation and switching across multiple events reliably', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: ({ children }) => <EventProvider>{children}</EventProvider>,
    });

    const eventsToCreate = [
      { id: 'rapid_1', budget: toMinorUnits(300000), name: 'Rapid 3 Lakh' },
      { id: 'rapid_2', budget: toMinorUnits(1200000), name: 'Rapid 12 Lakh' },
      { id: 'rapid_3', budget: toMinorUnits(4500000), name: 'Rapid 45 Lakh' },
      { id: 'rapid_4', budget: toMinorUnits(8000000), name: 'Rapid 80 Lakh' },
      { id: 'rapid_5', budget: toMinorUnits(250000000), name: 'Rapid 25 Crore' },
    ];

    // Rapidly create all events
    for (const item of eventsToCreate) {
      act(() => {
        result.current.createEvent(
          createEventMock({
            id: item.id,
            name: item.name,
            totalBudget: item.budget,
          })
        );
      });
    }

    expect(result.current.allEvents.length).toBeGreaterThanOrEqual(5);

    // Rapidly switch in reverse order and verify each event's budget is preserved
    for (const item of [...eventsToCreate].reverse()) {
      act(() => {
        result.current.switchEvent(item.id);
      });

      expect(result.current.state.event.id).toBe(item.id);
      expect(result.current.state.event.totalBudget).toBe(item.budget);
      expect(result.current.state.event.name).toBe(item.name);

      const summary = calculateBudgetOverview(
        result.current.state.event.totalBudget,
        result.current.state.categories,
        result.current.state.expenses
      );
      expect(summary.totalBudget).toBe(item.budget);
      expect(summary.isOverrun).toBe(false);
    }
  });

  // Additional Test: initializeCategoriesForBudget edge cases and integrity
  it('initializeCategoriesForBudget distributes total budget with exact zero remainder', () => {
    const oddBudgets = [
      toMinorUnits(500000), // 5,00,000 INR
      toMinorUnits(333333), // 3,33,333 INR
      toMinorUnits(1),      // 1 INR
      toMinorUnits(250000000), // 25 Crore INR
      77777777, // arbitrary minor units
    ];

    for (const budget of oddBudgets) {
      const categories = initializeCategoriesForBudget(budget);
      const sumAllocated = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      expect(sumAllocated).toBe(budget);
      expect(categories.length).toBe(7);
      categories.forEach((cat) => {
        expect(cat.allocatedAmount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(cat.allocatedAmount)).toBe(true);
      });
    }
  });

  // UI Integration: Header event switcher dropdown switches events and isolates displayed event
  it('UI Integration: Header event switcher dropdown switches events and isolates displayed event', () => {
    const budgetA = toMinorUnits(250000000); // ₹25 Cr
    const budgetB = toMinorUnits(500000);    // ₹5 Lakh

    const stateA = createInitialEventState(createEventMock({ id: 'evt_a_ui', name: 'Event A Royal', totalBudget: budgetA }));
    const stateB = createInitialEventState(createEventMock({ id: 'evt_b_ui', name: 'Event B Minimal', totalBudget: budgetB }));

    saveAllEventsToStorage(
      {
        evt_a_ui: stateA,
        evt_b_ui: stateB,
      },
      'evt_b_ui'
    );

    render(
      <ThemeProvider>
        <EventProvider>
          <Header onOpenNewEventWizard={() => {}} />
          <DashboardView />
        </EventProvider>
      </ThemeProvider>
    );

    // Initial state is Event B (₹5 Lakh)
    expect(screen.getByText('Event B Minimal')).toBeDefined();
    expect(screen.getByText('₹5,00,000')).toBeDefined();

    // Event switcher select is visible because allEvents.length > 1
    const switcher = screen.getByTestId('event-switcher-select') as HTMLSelectElement;
    expect(switcher).toBeDefined();
    expect(switcher.value).toBe('evt_b_ui');

    // Switch to Event A via Header dropdown
    fireEvent.change(switcher, { target: { value: 'evt_a_ui' } });

    // Now DashboardView shows Event A (₹25 Cr)
    expect(screen.getByText('Event A Royal')).toBeDefined();
    expect(screen.getByText('₹25,00,00,000')).toBeDefined();
  });

  // UI Integration: SettingsView workspace shows all events and switches seamlessly
  it('UI Integration: SettingsView workspace renders all events and supports switching', () => {
    const budgetA = toMinorUnits(250000000);
    const budgetB = toMinorUnits(500000);

    const stateA = createInitialEventState(createEventMock({ id: 'evt_a_settings', name: 'Gala Dinner', totalBudget: budgetA }));
    const stateB = createInitialEventState(createEventMock({ id: 'evt_b_settings', name: 'Beach Wedding', totalBudget: budgetB }));

    saveAllEventsToStorage(
      {
        evt_a_settings: stateA,
        evt_b_settings: stateB,
      },
      'evt_a_settings'
    );

    render(
      <ThemeProvider>
        <EventProvider>
          <SettingsView />
        </EventProvider>
      </ThemeProvider>
    );

    // Active event is Gala Dinner
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Gala Dinner')).toBeDefined();
    expect(screen.getByText('Beach Wedding')).toBeDefined();

    // Switch to Beach Wedding via button
    const switchBtn = screen.getByTestId('switch-event-btn-evt_b_settings');
    fireEvent.click(switchBtn);

    // Now active event is Beach Wedding
    const eventNameInput = screen.getByLabelText(/Event Title/i) as HTMLInputElement;
    expect(eventNameInput.value).toBe('Beach Wedding');
  });

  // Coverage & Invariant Tests: initializeCategoriesForBudget with baseCategories and priorities
  it('initializeCategoriesForBudget supports scaling existing baseCategories and mapping priorities', () => {
    const base = [
      { id: 'cat1', name: 'Cat 1', allocatedAmount: 100, userDefined: false, priorityRank: 1 },
      { id: 'cat2', name: 'Cat 2', allocatedAmount: 200, userDefined: false, priorityRank: 2 },
    ];

    // Exact match case
    const exact = initializeCategoriesForBudget(300, undefined, base);
    expect(exact[0].allocatedAmount).toBe(100);
    expect(exact[1].allocatedAmount).toBe(200);

    // Scaled up case
    const scaled = initializeCategoriesForBudget(600, undefined, base);
    expect(scaled.reduce((s, c) => s + c.allocatedAmount, 0)).toBe(600);

    // Base with zero allocations
    const zeroBase = [
      { id: 'cat1', name: 'Cat 1', allocatedAmount: 0, userDefined: false, priorityRank: 1 },
      { id: 'cat2', name: 'Cat 2', allocatedAmount: 0, userDefined: false, priorityRank: 2 },
    ];
    const fromZero = initializeCategoriesForBudget(500, undefined, zeroBase);
    expect(fromZero.reduce((s, c) => s + c.allocatedAmount, 0)).toBe(500);

    // Template with custom planningPriorities
    const withPriorities = initializeCategoriesForBudget(1000000, ['decor', 'venue']);
    const decor = withPriorities.find((c) => c.id === 'decor');
    const venue = withPriorities.find((c) => c.id === 'venue');
    expect(decor?.priorityRank).toBe(1);
    expect(venue?.priorityRank).toBe(2);
  });

  // Storage Edge Cases: Legacy backwards compatibility and error resilience
  it('storage: loads legacy single-event storage and handles storage exceptions safely', () => {
    // 1. Legacy single-event storage backwards compatibility
    const legacyState = createInitialEventState(createEventMock({ id: 'evt_legacy', name: 'Legacy Single' }));
    localStorage.setItem('vowpilot_state_v1', JSON.stringify(legacyState));

    const loaded = loadAllEventsFromStorage();
    expect(loaded.events['evt_legacy']).toBeDefined();
    expect(loaded.activeEventId).toBe('evt_legacy');

    // 2. Fallback when neither active ID nor singleResult matches
    localStorage.clear();
    const stateNoActive = createInitialEventState(createEventMock({ id: 'evt_orphan', name: 'Orphan' }));
    localStorage.setItem('vowpilot_events_store_v1', JSON.stringify({ evt_orphan: stateNoActive }));
    localStorage.setItem('vowpilot_active_event_id_v1', 'non_existent_id');
    const loadedOrphan = loadAllEventsFromStorage();
    expect(loadedOrphan.activeEventId).toBe('evt_orphan');

    // 3. saveAllEventsToStorage handles exception gracefully
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    const saved = saveAllEventsToStorage({ evt_orphan: stateNoActive }, 'evt_orphan');
    expect(saved).toBe(false);
    setItemSpy.mockRestore();

    // 4. Malformed JSON in events store safely caught
    localStorage.setItem('vowpilot_events_store_v1', 'corrupted-json{');
    const loadedCorrupted = loadAllEventsFromStorage();
    expect(loadedCorrupted.events[loadedCorrupted.activeEventId]).toBeDefined();
  });
});

