import { describe, it, expect } from 'vitest';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  evaluateScenario,
  generatePriorityAwareRecommendations,
} from '../domain/budgetEngine';
import { AppState, BudgetCategory, Expense } from '../types';

describe('Budget and Trade-Off Engine', () => {
  const ONE_INR = 100;

  const sampleCategories: BudgetCategory[] = [
    {
      id: 'venue',
      name: 'Venue & Lawns',
      allocatedAmount: 1000000 * ONE_INR, // ₹10,00,000
      userDefined: true,
      priorityRank: 1,
      maxCapacity: 150,
    },
    {
      id: 'catering',
      name: 'Catering',
      allocatedAmount: 600000 * ONE_INR, // ₹6,00,000
      userDefined: true,
      priorityRank: 2,
      perGuestCost: 4000 * ONE_INR, // ₹4,000 / guest
    },
    {
      id: 'decor',
      name: 'Decor',
      allocatedAmount: 400000 * ONE_INR, // ₹4,00,000
      userDefined: true,
      priorityRank: 3,
    },
  ];

  const sampleExpenses: Expense[] = [
    {
      id: 'exp-1',
      categoryId: 'venue',
      title: 'Venue Deposit',
      amount: 500000 * ONE_INR,
      status: 'confirmed',
      paidAmount: 500000 * ONE_INR,
      createdAt: '2026-09-01',
    },
    {
      id: 'exp-2',
      categoryId: 'catering',
      title: 'Catering Quote A',
      amount: 550000 * ONE_INR,
      status: 'quoted',
      paidAmount: 0,
      createdAt: '2026-09-02',
    },
    {
      id: 'exp-3',
      categoryId: 'decor',
      title: 'Lighting Estimate',
      amount: 380000 * ONE_INR,
      status: 'estimated',
      paidAmount: 0,
      createdAt: '2026-09-03',
    },
  ];

  it('calculates normal allocation, committed total, and segregates cost statuses strictly', () => {
    const totalBudget = 2500000 * ONE_INR; // ₹25,00,000
    const overview = calculateBudgetOverview(totalBudget, sampleCategories, sampleExpenses);

    expect(overview.totalBudget).toBe(totalBudget);
    expect(overview.totalAllocated).toBe(2000000 * ONE_INR); // 10L + 6L + 4L = 20L
    expect(overview.unallocatedBudget).toBe(500000 * ONE_INR);
    expect(overview.sumConfirmed).toBe(500000 * ONE_INR);
    expect(overview.sumQuoted).toBe(550000 * ONE_INR);
    expect(overview.sumEstimated).toBe(380000 * ONE_INR);
    expect(overview.committedTotal).toBe(500000 * ONE_INR); // Confirmed only (actual is 0)
    expect(overview.isOverrun).toBe(false);
  });

  it('detects budget overrun when effective spend exceeds total budget', () => {
    const tightBudget = 1000000 * ONE_INR; // ₹10,00,000 total budget
    const overview = calculateBudgetOverview(tightBudget, sampleCategories, sampleExpenses);

    expect(overview.isOverrun).toBe(true);
    expect(overview.overrunAmount).toBeGreaterThan(0);
    expect(overview.remainingBudget).toBeLessThan(0);
  });

  it('calculates guest count scaling using configured per-guest rules', () => {
    const state: AppState = {
      schemaVersion: 1,
      event: {
        id: 'evt-1',
        name: 'Test Event',
        eventType: 'wedding',
        date: '2026-11-20',
        location: 'Jaipur',
        guestCount: 100,
        totalBudget: 2500000 * ONE_INR,
        currency: 'INR',
        status: 'planning',
        preferences: {
          style: 'Modern',
          cateringType: 'Buffet',
          dietaryRequirements: [],
          photographyTier: 'Standard',
          venuePreference: 'Ballroom',
          decorationPreference: 'Floral',
          accessibilityNeeds: [],
          planningPriorities: ['venue', 'catering', 'decor'],
          specialConstraints: [],
          optionalNotes: '',
        },
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
      categories: sampleCategories,
      expenses: sampleExpenses,
      tasks: [],
      vendors: [],
      quotes: [],
      scenarios: [],
      messages: [],
      changeLog: [],
    };

    // Increase from 100 to 120 guests (+20 guests)
    // Catering is ₹4,000 / guest -> +20 * 4000 = +₹80,000 (8000000 minor units)
    const result = calculateGuestCountImpact(state, 120);

    expect(result.impact.difference).toBe(20 * 4000 * ONE_INR);
    expect(result.impact.affectedCategories).toContain('Catering');
    expect(result.capacityViolation).toBeUndefined();
  });

  it('detects venue capacity violation when guest count exceeds maxCapacity', () => {
    const state: AppState = {
      schemaVersion: 1,
      event: {
        id: 'evt-1',
        name: 'Test Event',
        eventType: 'wedding',
        date: '2026-11-20',
        location: 'Jaipur',
        guestCount: 100,
        totalBudget: 2500000 * ONE_INR,
        currency: 'INR',
        status: 'planning',
        preferences: {
          style: 'Modern',
          cateringType: 'Buffet',
          dietaryRequirements: [],
          photographyTier: 'Standard',
          venuePreference: 'Ballroom',
          decorationPreference: 'Floral',
          accessibilityNeeds: [],
          planningPriorities: ['venue', 'catering', 'decor'],
          specialConstraints: [],
          optionalNotes: '',
        },
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
      categories: sampleCategories, // Venue maxCapacity is 150
      expenses: sampleExpenses,
      tasks: [],
      vendors: [],
      quotes: [],
      scenarios: [],
      messages: [],
      changeLog: [],
    };

    const result = calculateGuestCountImpact(state, 175);
    expect(result.capacityViolation).toBeDefined();
    expect(result.capacityViolation).toContain('exceeds Venue & Lawns capacity limit (150 guests)');
  });

  it('generates priority-aware recommendations that protect top priorities', () => {
    const tightBudget = 1200000 * ONE_INR;
    const overview = calculateBudgetOverview(tightBudget, sampleCategories, sampleExpenses);
    const priorities = ['venue', 'catering', 'decor']; // Venue #1, Catering #2, Decor #3

    const recs = generatePriorityAwareRecommendations(overview, priorities);
    expect(recs.targetReductionAmount).toBeGreaterThan(0);
    expect(recs.recommendations.length).toBeGreaterThan(0);

    // Lowest priority (Decor, Rank #3) should be targeted first
    expect(recs.recommendations[0].categoryId).toBe('decor');
  });

  it('evaluates alternative scenarios without mutating baseline state', () => {
    const state: AppState = {
      schemaVersion: 1,
      event: {
        id: 'evt-1',
        name: 'Test Event',
        eventType: 'wedding',
        date: '2026-11-20',
        location: 'Jaipur',
        guestCount: 100,
        totalBudget: 2500000 * ONE_INR,
        currency: 'INR',
        status: 'planning',
        preferences: {
          style: 'Modern',
          cateringType: 'Buffet',
          dietaryRequirements: [],
          photographyTier: 'Standard',
          venuePreference: 'Ballroom',
          decorationPreference: 'Floral',
          accessibilityNeeds: [],
          planningPriorities: ['venue', 'catering', 'decor'],
          specialConstraints: [],
          optionalNotes: '',
        },
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
      categories: sampleCategories,
      expenses: sampleExpenses,
      tasks: [],
      vendors: [],
      quotes: [],
      scenarios: [],
      messages: [],
      changeLog: [],
    };

    const scenario = {
      id: 'scen-test',
      name: 'Luxury Decor Scenario',
      description: 'Increase decor allocation',
      createdAt: '2026-10-01',
      modifiedGuestCount: 100,
      categoryAllocations: {
        venue: 1000000 * ONE_INR,
        catering: 600000 * ONE_INR,
        decor: 600000 * ONE_INR, // +₹2,00,000
      },
      notes: '',
      isBaseline: false,
    };

    const evaluation = evaluateScenario(state, scenario);
    expect(evaluation.scenarioTotal).toBe(2200000 * ONE_INR);
    const decorComp = evaluation.categoryComparisons.find((c) => c.categoryId === 'decor');
    expect(decorComp?.delta).toBe(200000 * ONE_INR);
  });
});
