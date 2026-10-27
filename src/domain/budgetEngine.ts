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
    const totals = categoryMap.get(cat.id)!;
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

export type CostCategoryType = 'variable' | 'fixed' | 'capacity_tier';

export interface CategoryGuestAdjustment {
  categoryId: string;
  categoryName: string;
  costType: CostCategoryType;
  baselineAllocated: number;
  perGuestRate: number;
  variableDelta: number;
  capacityTierDelta: number;
  totalGuestAdjustment: number;
  projectedAmount: number;
  isCapacityExceeded: boolean;
  capacityLimit?: number;
}

/**
 * Classifies a budget category into 'variable', 'capacity_tier', or 'fixed'
 * according to explicit cost properties or known domain service semantics.
 */
export function classifyCategoryCostType(category: BudgetCategory): CostCategoryType {
  const catWithMeta = category as BudgetCategory & { costType?: CostCategoryType };
  if (catWithMeta.costType) {
    return catWithMeta.costType;
  }
  const idLower = category.id.toLowerCase();
  const nameLower = category.name.toLowerCase();

  // If explicit perGuestCost is provided and positive, it scales directly with guests
  if (category.perGuestCost !== undefined && category.perGuestCost > 0) {
    return 'variable';
  }

  // Capacity tier: venue, lawns, ballrooms or any category with defined maxCapacity
  if (
    category.maxCapacity !== undefined ||
    idLower === 'venue' ||
    nameLower.includes('venue') ||
    nameLower.includes('lawn') ||
    nameLower.includes('hall') ||
    nameLower.includes('ballroom')
  ) {
    return 'capacity_tier';
  }

  // Per-guest variable services (catering, bar, dining, favors, invitations, gifts)
  if (
    idLower === 'catering' ||
    nameLower.includes('catering') ||
    nameLower.includes('beverage') ||
    nameLower.includes('food') ||
    nameLower.includes('favor') ||
    nameLower.includes('invitation') ||
    nameLower.includes('gift')
  ) {
    return 'variable';
  }

  // Fixed by default: photography, entertainment, decor, contingency
  return 'fixed';
}

/**
 * Deterministically evaluates per-category guest sensitivity across variable, fixed,
 * and capacity-tier cost rules without hardcoded budget assumptions.
 */
export function calculateCategoryGuestAdjustments(
  categories: BudgetCategory[],
  baselineGuestCount: number,
  simulatedGuestCount: number
): CategoryGuestAdjustment[] {
  const safeBaselineGuests = Math.max(0, Number.isFinite(baselineGuestCount) ? Math.floor(baselineGuestCount) : 0);
  const safeSimulatedGuests = Math.max(0, Number.isFinite(simulatedGuestCount) ? Math.floor(simulatedGuestCount) : 0);
  const deltaGuests = safeSimulatedGuests - safeBaselineGuests;

  return categories.map((cat) => {
    const costType = classifyCategoryCostType(cat);
    const baseAlloc = Math.max(0, Number.isFinite(cat.allocatedAmount) ? cat.allocatedAmount : 0);
    let perGuestRate = 0;
    let variableDelta = 0;
    let capacityTierDelta = 0;
    let isCapacityExceeded = false;
    const capacityLimit = cat.maxCapacity ?? (costType === 'capacity_tier' ? 200 : undefined);

    if (costType === 'variable') {
      if (cat.perGuestCost !== undefined && cat.perGuestCost > 0) {
        perGuestRate = cat.perGuestCost;
      } else if (safeBaselineGuests > 0 && baseAlloc > 0) {
        // Derive implied baseline rate from actual event baseline allocation
        perGuestRate = Math.round(baseAlloc / safeBaselineGuests);
      } else {
        perGuestRate = 0;
      }

      if (safeSimulatedGuests === 0) {
        variableDelta = -baseAlloc;
      } else {
        variableDelta = deltaGuests * perGuestRate;
      }
    } else if (costType === 'capacity_tier') {
      if (capacityLimit !== undefined && safeSimulatedGuests > capacityLimit) {
        isCapacityExceeded = true;
        const overflow = safeSimulatedGuests - capacityLimit;
        const tierBlocks = Math.ceil(overflow / 50);
        // Capacity tier surcharge: 20% of baseline allocation per 50-guest overflow block
        const blockCost = Math.round(baseAlloc * 0.20);
        capacityTierDelta = tierBlocks * blockCost;
      }
    }

    const totalGuestAdjustment = variableDelta + capacityTierDelta;
    const projectedAmount = Math.max(0, baseAlloc + totalGuestAdjustment);

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      costType,
      baselineAllocated: baseAlloc,
      perGuestRate,
      variableDelta,
      capacityTierDelta,
      totalGuestAdjustment,
      projectedAmount,
      isCapacityExceeded,
      capacityLimit,
    };
  });
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
    safeGuestCount = 0;
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
      const impliedRate = currentGuestCount > 0 ? Math.round(cat.allocatedAmount / currentGuestCount) : 0;
      if (impliedRate > 0) {
        const catDelta = deltaGuests * impliedRate;
        totalDelta += catDelta;
        affectedCategories.push(cat.name);
        missingDataWarnings.push(
          `Catering does not have a configured per-guest cost. Using implied baseline rate of ${impliedRate} minor units/guest for ${cat.name}.`
        );
      } else {
        missingDataWarnings.push(
          `Catering does not have a configured per-guest cost. Cannot compute guest scaling for ${cat.name}.`
        );
      }
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

    // Limit cut to at most 45% of flexible allocation to preserve viability, or whatever needed
    const maxReduction = Math.min(flexibleBudget, Math.ceil(flexibleBudget * 0.45));
    const cut = Math.min(remainingToReduce, maxReduction);
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
    costType: CostCategoryType;
    perGuestRate: number;
    guestAdjustment: number;
    isCapacityExceeded?: boolean;
    capacityTierDelta?: number;
  }>;
} {
  const baselineOverview = calculateBudgetOverview(
    baselineState.event.totalBudget,
    baselineState.categories,
    baselineState.expenses
  );

  const adjustments = calculateCategoryGuestAdjustments(
    baselineState.categories,
    baselineState.event.guestCount,
    scenario.modifiedGuestCount
  );
  const adjustmentMap = new Map(adjustments.map((a) => [a.categoryId, a]));

  let scenarioTotal = 0;
  const categoryComparisons: Array<{
    categoryId: string;
    categoryName: string;
    baselineAllocated: number;
    scenarioAllocated: number;
    delta: number;
    costType: CostCategoryType;
    perGuestRate: number;
    guestAdjustment: number;
    isCapacityExceeded?: boolean;
    capacityTierDelta?: number;
  }> = [];

  for (const cat of baselineState.categories) {
    const hasManualOverride =
      scenario.categoryAllocations !== undefined &&
      scenario.categoryAllocations[cat.id] !== undefined;

    const adj = adjustmentMap.get(cat.id)!;
    const guestAdjustment = adj.totalGuestAdjustment;

    let effectiveScenarioAmount: number;
    if (hasManualOverride) {
      const manualVal = scenario.categoryAllocations[cat.id];
      effectiveScenarioAmount = Math.max(0, Number.isFinite(manualVal) ? manualVal : cat.allocatedAmount);
    } else {
      effectiveScenarioAmount = Math.max(0, cat.allocatedAmount + guestAdjustment);
    }

    scenarioTotal += effectiveScenarioAmount;

    categoryComparisons.push({
      categoryId: cat.id,
      categoryName: cat.name,
      baselineAllocated: cat.allocatedAmount,
      scenarioAllocated: effectiveScenarioAmount,
      delta: effectiveScenarioAmount - cat.allocatedAmount,
      costType: adj.costType,
      perGuestRate: adj.perGuestRate,
      guestAdjustment,
      isCapacityExceeded: adj.isCapacityExceeded,
      capacityTierDelta: adj.capacityTierDelta,
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
  maxCapacity?: number;
  notes?: string;
}> = [
  { id: 'venue', name: 'Venue & Lawns', defaultRatio: 0.30, priorityRank: 1, userDefined: true, maxCapacity: 200, notes: 'Includes main heritage courtyard and banquet hall. Maximum capacity 200 guests.' },
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
      maxCapacity: tmpl.maxCapacity,
      notes: tmpl.notes,
    };
  });
}
