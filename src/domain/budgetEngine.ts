import {
  AppState,
  BudgetCategory,
  BudgetScenario,
  Expense,
  FinancialImpact,
} from '../types';

export interface CategorySummary {
  category: BudgetCategory;
  allocatedAmount: number;
  estimatedAmount: number;
  quotedAmount: number;
  confirmedAmount: number;
  actualAmount: number;
  committedTotal: number; // confirmed + actual
  effectiveTotal: number; // uses actual if present, else confirmed, else quoted, else estimated
  remainingAllocated: number;
  isOverBudget: boolean;
}

export interface BudgetOverview {
  totalBudget: number;
  totalAllocated: number;
  unallocatedBudget: number;
  sumEstimated: number;
  sumQuoted: number;
  sumConfirmed: number;
  sumActual: number;
  committedTotal: number; // Confirmed + Actual
  effectiveProjectedTotal: number; // Effective total across all categories
  remainingBudget: number; // totalBudget - effectiveProjectedTotal
  utilizationPercentage: number;
  isOverrun: boolean;
  overrunAmount: number;
  categories: CategorySummary[];
}

/**
 * Calculates a complete, transparent breakdown of the budget.
 * Distinguishes Estimated, Quoted, Confirmed, and Actual expenses strictly.
 */
export function calculateBudgetOverview(
  totalBudget: number,
  categories: BudgetCategory[],
  expenses: Expense[]
): BudgetOverview {
  const safeTotalBudget = Math.max(0, Number.isFinite(totalBudget) ? totalBudget : 0);
  let sumEstimated = 0;
  let sumQuoted = 0;
  let sumConfirmed = 0;
  let sumActual = 0;

  const categoryMap = new Map<string, {
    estimated: number;
    quoted: number;
    confirmed: number;
    actual: number;
  }>();

  for (const cat of categories) {
    categoryMap.set(cat.id, { estimated: 0, quoted: 0, confirmed: 0, actual: 0 });
  }

  for (const exp of expenses) {
    const safeAmount = Math.max(0, Number.isFinite(exp.amount) ? exp.amount : 0);
    let catTotals = categoryMap.get(exp.categoryId);
    if (!catTotals) {
      catTotals = { estimated: 0, quoted: 0, confirmed: 0, actual: 0 };
      categoryMap.set(exp.categoryId, catTotals);
    }

    switch (exp.status) {
      case 'estimated':
        sumEstimated += safeAmount;
        catTotals.estimated += safeAmount;
        break;
      case 'quoted':
        sumQuoted += safeAmount;
        catTotals.quoted += safeAmount;
        break;
      case 'confirmed':
        sumConfirmed += safeAmount;
        catTotals.confirmed += safeAmount;
        break;
      case 'actual':
        sumActual += safeAmount;
        catTotals.actual += safeAmount;
        break;
    }
  }

  let totalAllocated = 0;
  let effectiveProjectedTotal = 0;

  const categorySummaries: CategorySummary[] = categories.map((cat) => {
    const totals = categoryMap.get(cat.id) || { estimated: 0, quoted: 0, confirmed: 0, actual: 0 };
    const safeAllocated = Math.max(0, Number.isFinite(cat.allocatedAmount) ? cat.allocatedAmount : 0);
    totalAllocated += safeAllocated;

    // Committed is confirmed + actual
    const committedTotal = totals.confirmed + totals.actual;

    // Effective projected total for this category:
    const hasExpenses = totals.actual > 0 || totals.confirmed > 0 || totals.quoted > 0 || totals.estimated > 0;
    const effectiveTotal = hasExpenses
      ? (totals.actual + totals.confirmed + totals.quoted + totals.estimated)
      : safeAllocated;

    effectiveProjectedTotal += effectiveTotal;

    const remainingAllocated = safeAllocated - effectiveTotal;
    const isOverBudget = effectiveTotal > safeAllocated;

    return {
      category: cat,
      allocatedAmount: safeAllocated,
      estimatedAmount: totals.estimated,
      quotedAmount: totals.quoted,
      confirmedAmount: totals.confirmed,
      actualAmount: totals.actual,
      committedTotal,
      effectiveTotal,
      remainingAllocated,
      isOverBudget,
    };
  });

  const unallocatedBudget = safeTotalBudget - totalAllocated;
  const committedTotal = sumConfirmed + sumActual;
  const remainingBudget = safeTotalBudget - effectiveProjectedTotal;
  const utilizationPercentage = safeTotalBudget > 0 ? (effectiveProjectedTotal / safeTotalBudget) * 100 : 0;
  const isOverrun = effectiveProjectedTotal > safeTotalBudget;
  const overrunAmount = isOverrun ? effectiveProjectedTotal - safeTotalBudget : 0;

  return {
    totalBudget: safeTotalBudget,
    totalAllocated,
    unallocatedBudget,
    sumEstimated,
    sumQuoted,
    sumConfirmed,
    sumActual,
    committedTotal,
    effectiveProjectedTotal,
    remainingBudget,
    utilizationPercentage: Math.round(utilizationPercentage * 10) / 10,
    isOverrun,
    overrunAmount,
    categories: categorySummaries,
  };
}

/**
 * Calculates the exact financial impact of changing guest count.
 * Uses explicit per-guest rules for categories that scale (e.g. catering, favors).
 * Also checks venue capacity constraints.
 */
export function calculateGuestCountImpact(
  currentState: AppState,
  newGuestCount: number
): {
  impact: FinancialImpact;
  capacityViolation?: string;
  missingDataWarnings: string[];
} {
  const missingDataWarnings: string[] = [];
  let safeGuestCount = newGuestCount;

  if (!Number.isFinite(safeGuestCount) || safeGuestCount < 0) {
    missingDataWarnings.push(`Invalid guest count (${newGuestCount}) provided. Must be a non-negative number.`);
    safeGuestCount = Math.max(0, Math.floor(Number.isFinite(safeGuestCount) ? safeGuestCount : 0));
  } else {
    safeGuestCount = Math.floor(safeGuestCount);
  }

  const currentGuestCount = Math.max(0, currentState.event.guestCount || 0);
  const deltaGuests = safeGuestCount - currentGuestCount;
  const overview = calculateBudgetOverview(
    currentState.event.totalBudget,
    currentState.categories,
    currentState.expenses
  );

  const affectedCategories: string[] = [];
  let totalDelta = 0;
  let capacityViolation: string | undefined;

  for (const cat of currentState.categories) {
    // Check venue capacity
    if (cat.maxCapacity && safeGuestCount > cat.maxCapacity) {
      capacityViolation = `New guest count (${safeGuestCount}) exceeds ${cat.name} capacity limit (${cat.maxCapacity} guests).`;
    }

    // Check variable costs
    if (cat.perGuestCost !== undefined && cat.perGuestCost > 0) {
      const catDelta = deltaGuests * cat.perGuestCost;
      totalDelta += catDelta;
      affectedCategories.push(cat.name);
    } else if (cat.id === 'catering' && (cat.perGuestCost === undefined || cat.perGuestCost === 0)) {
      missingDataWarnings.push(`Catering does not have a configured per-guest cost. Cannot compute guest scaling for ${cat.name}.`);
    }
  }

  const currentEstimatedTotal = overview.effectiveProjectedTotal;
  const proposedEstimatedTotal = currentEstimatedTotal + totalDelta;
  const remainingBudget = currentState.event.totalBudget - proposedEstimatedTotal;

  const budgetViolations: string[] = [];
  if (proposedEstimatedTotal > currentState.event.totalBudget) {
    budgetViolations.push(
      `Proposed spend exceeds total budget by ${proposedEstimatedTotal - currentState.event.totalBudget} minor units.`
    );
  }
  if (capacityViolation) {
    budgetViolations.push(capacityViolation);
  }

  return {
    impact: {
      currentEstimatedTotal,
      proposedEstimatedTotal,
      difference: totalDelta,
      remainingBudget,
      affectedCategories,
      budgetViolations,
    },
    capacityViolation,
    missingDataWarnings,
  };
}

/**
 * Priority-aware recommendation engine:
 * If the budget is overrun or user wants to save money, suggest reductions starting
 * from the lowest priority categories, strictly protecting higher priority ones.
 */
export function generatePriorityAwareRecommendations(
  overview: BudgetOverview,
  priorities: string[], // List of category IDs in order of priority (first = highest)
  targetAmount?: number
): {
  targetReductionAmount: number;
  recommendations: Array<{
    categoryId: string;
    categoryName: string;
    priorityRank: number;
    currentAllocated: number;
    suggestedReduction: number;
    newAllocated: number;
    rationale: string;
  }>;
} {
  const targetReductionAmount =
    targetAmount !== undefined && targetAmount > 0
      ? targetAmount
      : (overview.overrunAmount > 0 ? overview.overrunAmount : 0);

  if (targetReductionAmount <= 0) {
    return { targetReductionAmount: 0, recommendations: [] };
  }

  // Create priority index map (lower index = higher priority)
  const priorityIndexMap = new Map<string, number>();
  priorities.forEach((id, index) => {
    priorityIndexMap.set(id, index);
  });

  // Sort categories by lowest priority first (highest index or unranked at the very end)
  const sortedCategories = [...overview.categories].sort((a, b) => {
    const rankA = priorityIndexMap.has(a.category.id) ? priorityIndexMap.get(a.category.id)! : 999;
    const rankB = priorityIndexMap.has(b.category.id) ? priorityIndexMap.get(b.category.id)! : 999;
    // We want lowest priority first, so descending rank order
    return rankB - rankA;
  });

  let remainingToReduce = targetReductionAmount;
  const recommendations: Array<{
    categoryId: string;
    categoryName: string;
    priorityRank: number;
    currentAllocated: number;
    suggestedReduction: number;
    newAllocated: number;
    rationale: string;
  }> = [];

  for (const catSummary of sortedCategories) {
    if (remainingToReduce <= 0) break;

    // We can only reduce what isn't already committed (actual + confirmed expenses)
    const flexibleBudget = catSummary.allocatedAmount - catSummary.committedTotal;
    if (flexibleBudget <= 0) continue;

    // Limit cut to at most 40% of flexible allocation to preserve viability, or whatever needed
    const maxReduction = Math.min(flexibleBudget, Math.ceil(flexibleBudget * 0.45));
    const cut = Math.min(remainingToReduce, maxReduction);

    if (cut > 0) {
      remainingToReduce -= cut;
      const rank = priorityIndexMap.has(catSummary.category.id)
        ? priorityIndexMap.get(catSummary.category.id)! + 1
        : 999;

      recommendations.push({
        categoryId: catSummary.category.id,
        categoryName: catSummary.category.name,
        priorityRank: rank,
        currentAllocated: catSummary.allocatedAmount,
        suggestedReduction: cut,
        newAllocated: catSummary.allocatedAmount - cut,
        rationale: `Ranked #${rank} in priority. Flexible headroom available without impacting ${catSummary.committedTotal > 0 ? 'confirmed vendors' : 'commitments'}.`,
      });
    }
  }

  return {
    targetReductionAmount,
    recommendations,
  };
}

/**
 * Calculates a scenario's projected totals and compares with the baseline plan.
 */
export function evaluateScenario(
  baselineState: AppState,
  scenario: BudgetScenario
): {
  scenarioTotal: number;
  deltaFromBaseline: number;
  remainingBudget: number;
  isOverrun: boolean;
  categoryComparisons: Array<{
    categoryId: string;
    categoryName: string;
    baselineAllocated: number;
    scenarioAllocated: number;
    delta: number;
  }>;
} {
  const baselineOverview = calculateBudgetOverview(
    baselineState.event.totalBudget,
    baselineState.categories,
    baselineState.expenses
  );

  let scenarioTotal = 0;
  const categoryComparisons: Array<{
    categoryId: string;
    categoryName: string;
    baselineAllocated: number;
    scenarioAllocated: number;
    delta: number;
  }> = [];

  for (const cat of baselineState.categories) {
    const scenarioAllocated = scenario.categoryAllocations[cat.id] !== undefined
      ? scenario.categoryAllocations[cat.id]
      : cat.allocatedAmount;

    // Check if guest count scaling applies
    let guestAdjustment = 0;
    if (scenario.modifiedGuestCount !== baselineState.event.guestCount && cat.perGuestCost) {
      guestAdjustment = (scenario.modifiedGuestCount - baselineState.event.guestCount) * cat.perGuestCost;
    }

    const effectiveScenarioAmount = scenarioAllocated + guestAdjustment;
    scenarioTotal += effectiveScenarioAmount;

    categoryComparisons.push({
      categoryId: cat.id,
      categoryName: cat.name,
      baselineAllocated: cat.allocatedAmount,
      scenarioAllocated: effectiveScenarioAmount,
      delta: effectiveScenarioAmount - cat.allocatedAmount,
    });
  }

  const deltaFromBaseline = scenarioTotal - baselineOverview.effectiveProjectedTotal;
  const remainingBudget = baselineState.event.totalBudget - scenarioTotal;
  const isOverrun = scenarioTotal > baselineState.event.totalBudget;

  return {
    scenarioTotal,
    deltaFromBaseline,
    remainingBudget,
    isOverrun,
    categoryComparisons,
  };
}

/**
 * Standard category templates with balanced default proportional weights.
 * Proportions match the canonical domain architecture (sum = 1.0 = 100%).
 */
export const STANDARD_CATEGORY_TEMPLATES: Array<{
  id: string;
  name: string;
  defaultRatio: number;
  priorityRank: number;
  userDefined: boolean;
  notes?: string;
}> = [
  { id: 'venue', name: 'Venue & Lawns', defaultRatio: 0.30, priorityRank: 1, userDefined: true, notes: 'Includes main heritage courtyard and banquet hall.' },
  { id: 'catering', name: 'Catering & Beverages', defaultRatio: 0.24, priorityRank: 2, userDefined: true, notes: 'Multi-course menu with mocktail bar and dessert station.' },
  { id: 'decor', name: 'Decor & Production', defaultRatio: 0.16, priorityRank: 3, userDefined: true, notes: 'Mandap floral setup, walkway lights, dining table centerpieces.' },
  { id: 'photography', name: 'Photography & Cinema', defaultRatio: 0.14, priorityRank: 4, userDefined: true, notes: 'Lead photographers, cinematographers, drone operator, same-day teaser edit.' },
  { id: 'entertainment', name: 'Music & Entertainment', defaultRatio: 0.072, priorityRank: 5, userDefined: true, notes: 'Folk musicians for welcome, DJ and sound system for evening.' },
  { id: 'logistics', name: 'Guest Logistics & Transport', defaultRatio: 0.048, priorityRank: 6, userDefined: false, notes: 'Airport shuttles and local vans for relatives.' },
  { id: 'contingency', name: 'Buffer & Contingency', defaultRatio: 0.04, priorityRank: 7, userDefined: false, notes: 'Unforeseen weather contingencies and generator backup fuel.' },
];

/**
 * Dynamically initializes balanced, non-negative category allocations for any event budget.
 * Distributes the total budget exactly without penny rounding loss.
 */
export function initializeCategoriesForBudget(
  totalBudget: number,
  planningPriorities?: string[],
  baseCategories?: BudgetCategory[]
): BudgetCategory[] {
  const safeBudget = Math.max(0, Number.isFinite(totalBudget) ? totalBudget : 0);

  if (baseCategories && baseCategories.length > 0) {
    const totalCurrentAllocated = baseCategories.reduce(
      (sum, c) => sum + Math.max(0, Number.isFinite(c.allocatedAmount) ? c.allocatedAmount : 0),
      0
    );
    if (totalCurrentAllocated === safeBudget) {
      return baseCategories.map((c) => ({ ...c }));
    }
    let allocatedSoFar = 0;
    return baseCategories.map((cat, idx) => {
      const isLast = idx === baseCategories.length - 1;
      const ratio = totalCurrentAllocated > 0 ? cat.allocatedAmount / totalCurrentAllocated : 1 / baseCategories.length;
      const allocated = isLast ? Math.max(0, safeBudget - allocatedSoFar) : Math.round(safeBudget * ratio);
      allocatedSoFar += allocated;
      return {
        ...cat,
        allocatedAmount: allocated,
      };
    });
  }

  let allocatedSoFar = 0;
  return STANDARD_CATEGORY_TEMPLATES.map((tmpl, idx) => {
    const isLast = idx === STANDARD_CATEGORY_TEMPLATES.length - 1;
    const allocated = isLast ? Math.max(0, safeBudget - allocatedSoFar) : Math.round(safeBudget * tmpl.defaultRatio);
    allocatedSoFar += allocated;

    let priorityRank = tmpl.priorityRank;
    if (planningPriorities && planningPriorities.length > 0) {
      const pIdx = planningPriorities.indexOf(tmpl.id);
      if (pIdx !== -1) {
        priorityRank = pIdx + 1;
      }
    }

    return {
      id: tmpl.id,
      name: tmpl.name,
      allocatedAmount: allocated,
      userDefined: tmpl.userDefined,
      priorityRank,
      notes: tmpl.notes,
    };
  });
}
