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
    let catTotals = categoryMap.get(exp.categoryId);
    if (!catTotals) {
      catTotals = { estimated: 0, quoted: 0, confirmed: 0, actual: 0 };
      categoryMap.set(exp.categoryId, catTotals);
    }

    switch (exp.status) {
      case 'estimated':
        sumEstimated += exp.amount;
        catTotals.estimated += exp.amount;
        break;
      case 'quoted':
        sumQuoted += exp.amount;
        catTotals.quoted += exp.amount;
        break;
      case 'confirmed':
        sumConfirmed += exp.amount;
        catTotals.confirmed += exp.amount;
        break;
      case 'actual':
        sumActual += exp.amount;
        catTotals.actual += exp.amount;
        break;
    }
  }

  let totalAllocated = 0;
  let effectiveProjectedTotal = 0;

  const categorySummaries: CategorySummary[] = categories.map((cat) => {
    const totals = categoryMap.get(cat.id) || { estimated: 0, quoted: 0, confirmed: 0, actual: 0 };
    totalAllocated += cat.allocatedAmount;

    // Committed is confirmed + actual
    const committedTotal = totals.confirmed + totals.actual;

    // Effective projected total for this category:
    // If actual exists, we use actual; if confirmed exists, confirmed; etc.
    // If explicit expenses exist, we take the highest commitment or fallback to allocation if no expenses recorded.
    const hasExpenses = totals.actual > 0 || totals.confirmed > 0 || totals.quoted > 0 || totals.estimated > 0;
    const effectiveTotal = hasExpenses
      ? (totals.actual + totals.confirmed + totals.quoted + totals.estimated)
      : cat.allocatedAmount;

    effectiveProjectedTotal += effectiveTotal;

    const remainingAllocated = cat.allocatedAmount - effectiveTotal;
    const isOverBudget = effectiveTotal > cat.allocatedAmount;

    return {
      category: cat,
      allocatedAmount: cat.allocatedAmount,
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

  const unallocatedBudget = totalBudget - totalAllocated;
  const committedTotal = sumConfirmed + sumActual;
  const remainingBudget = totalBudget - effectiveProjectedTotal;
  const utilizationPercentage = totalBudget > 0 ? (effectiveProjectedTotal / totalBudget) * 100 : 0;
  const isOverrun = effectiveProjectedTotal > totalBudget;
  const overrunAmount = isOverrun ? effectiveProjectedTotal - totalBudget : 0;

  return {
    totalBudget,
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
  const currentGuestCount = currentState.event.guestCount;
  const deltaGuests = newGuestCount - currentGuestCount;
  const overview = calculateBudgetOverview(
    currentState.event.totalBudget,
    currentState.categories,
    currentState.expenses
  );

  const affectedCategories: string[] = [];
  const missingDataWarnings: string[] = [];
  let totalDelta = 0;

  let capacityViolation: string | undefined;

  for (const cat of currentState.categories) {
    // Check venue capacity
    if (cat.maxCapacity && newGuestCount > cat.maxCapacity) {
      capacityViolation = `New guest count (${newGuestCount}) exceeds ${cat.name} capacity limit (${cat.maxCapacity} guests).`;
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
  priorities: string[] // List of category IDs in order of priority (first = highest)
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
  const targetReductionAmount = overview.overrunAmount > 0 ? overview.overrunAmount : 0;
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
