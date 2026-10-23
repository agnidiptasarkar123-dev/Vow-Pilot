import {
  AppState,
  AssistantIntent,
  PlanningMessage,
  ProposedAction,
} from '../types';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
} from './budgetEngine';
import { formatCurrency } from './currency';
import { evaluateTasks } from './taskEngine';
import { compareCategoryVendors, identifyMissingQuoteDetails } from './vendorEngine';

export interface IntentParseResult {
  intent: AssistantIntent;
  extractedParameters?: {
    guestCount?: number;
    categoryId?: string;
    percentage?: number;
  };
}

/**
 * Parses user text deterministically into one of the 11 documented intents or 'unsupported'.
 */
export function parseUserIntent(input: string): IntentParseResult {
  const text = input.trim().toLowerCase();

  // 1. Guest count change
  const guestMatch = text.match(/(?:guest|people|attendee|headcount)\s*(?:count)?\s*(?:to|by|is|=)?\s*(\d+)/i) ||
    text.match(/(?:increase|decrease|change|set|update)\s*(?:guests?|guest count)\s*(?:to)?\s*(\d+)/i);
  if (guestMatch) {
    const count = parseInt(guestMatch[1], 10);
    if (!isNaN(count) && count > 0) {
      return {
        intent: 'change_guest_count',
        extractedParameters: { guestCount: count },
      };
    }
  }

  // 2. Suggest reductions vs direct budget reduction
  if (text.includes('suggest') && (text.includes('reduc') || text.includes('cut') || text.includes('save') || text.includes('expense'))) {
    return { intent: 'suggest_expense_reductions' };
  }
  if (text.includes('reduce') && (text.includes('budget') || text.includes('cost') || text.includes('expense') || text.includes('spend'))) {
    return { intent: 'reduce_budget' };
  }

  // 3. Explain budget
  if (text.includes('explain') && (text.includes('budget') || text.includes('spend') || text.includes('cost'))) {
    return { intent: 'explain_budget' };
  }
  if (text.includes('how much') || text.includes('budget status') || text.includes('breakdown')) {
    return { intent: 'explain_budget' };
  }

  // 4. Protect priority
  if (text.includes('protect') || (text.includes('priorit') && text.includes('category'))) {
    return { intent: 'protect_priority' };
  }

  // 5. Overdue tasks
  if (text.includes('overdue') || text.includes('late task') || text.includes('missed deadline')) {
    return { intent: 'find_overdue_tasks' };
  }

  // 6. Blocked tasks
  if (text.includes('blocked') || text.includes('prerequisite') || text.includes('dependency')) {
    return { intent: 'explain_blocked_tasks' };
  }

  // 7. Compare vendor quotes
  if (text.includes('compare') && (text.includes('vendor') || text.includes('quote') || text.includes('quotation'))) {
    return { intent: 'compare_vendor_quotes' };
  }

  // 8. Missing vendor info
  if (text.includes('missing') && (text.includes('vendor') || text.includes('quote') || text.includes('info') || text.includes('detail'))) {
    return { intent: 'identify_missing_vendor_info' };
  }

  // 9. Create scenario
  if (text.includes('scenario') || text.includes('what if') || text.includes('model alternative')) {
    return { intent: 'create_budget_scenario' };
  }

  // 10. Summarize plan
  if (text.includes('summar') || text.includes('overview') || text.includes('plan status') || text.includes('how are we doing')) {
    return { intent: 'summarize_plan' };
  }

  return { intent: 'unsupported' };
}

/**
 * Generates an honest, deterministic, context-aware assistant response
 * based on live application state.
 */
export function generateAssistantResponse(
  input: string,
  state: AppState
): PlanningMessage {
  const parse = parseUserIntent(input);
  const now = new Date().toISOString();
  const currency = state.event.currency;

  switch (parse.intent) {
    case 'explain_budget': {
      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const content = `### Current Budget Breakdown\n\n` +
        `* **Total Event Budget:** ${formatCurrency(overview.totalBudget, currency)}\n` +
        `* **Allocated Across Categories:** ${formatCurrency(overview.totalAllocated, currency)}\n` +
        `* **Committed Spend (Confirmed + Actual):** ${formatCurrency(overview.committedTotal, currency)}\n` +
        `* **Effective Projected Spend:** ${formatCurrency(overview.effectiveProjectedTotal, currency)}\n` +
        `* **Remaining Runway:** ${formatCurrency(overview.remainingBudget, currency)}\n` +
        `* **Utilization Rate:** ${overview.utilizationPercentage}%\n\n` +
        (overview.isOverrun
          ? `⚠️ **Warning:** The plan is currently over budget by ${formatCurrency(overview.overrunAmount, currency)}.`
          : `✅ Current projections are within the configured total budget.`);

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'explain_budget',
        requiresConfirmation: false,
        rationale: 'Derived directly from current budget categories and confirmed expenses.',
      };
    }

    case 'change_guest_count': {
      const targetCount = parse.extractedParameters?.guestCount;
      if (!targetCount) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'Please specify the target guest count number (e.g., "Change guest count to 150").',
          intent: 'change_guest_count',
          requiresConfirmation: false,
        };
      }

      const impactResult = calculateGuestCountImpact(state, targetCount);
      const impact = impactResult.impact;

      let content = `### Impact Analysis: Guest Count Adjustment (${state.event.guestCount} ➔ ${targetCount} Guests)\n\n` +
        `* **Current Projected Spend:** ${formatCurrency(impact.currentEstimatedTotal, currency)}\n` +
        `* **Proposed Projected Spend:** ${formatCurrency(impact.proposedEstimatedTotal, currency)}\n` +
        `* **Net Cost Difference:** ${impact.difference >= 0 ? '+' : ''}${formatCurrency(impact.difference, currency)}\n` +
        `* **Revised Remaining Budget:** ${formatCurrency(impact.remainingBudget, currency)}\n\n` +
        `**Affected Categories:** ${impact.affectedCategories.join(', ') || 'None (no variable per-guest costs configured)'}.\n\n`;

      if (impactResult.capacityViolation) {
        content += `🚨 **Capacity Constraint Alert:** ${impactResult.capacityViolation}\n\n`;
      }
      if (impact.budgetViolations.length > 0) {
        content += `⚠️ **Budget Overrun Alert:** Projected spend exceeds the total budget by ${formatCurrency(impact.proposedEstimatedTotal - state.event.totalBudget, currency)}.\n\n`;
      }
      if (impactResult.missingDataWarnings.length > 0) {
        content += `ℹ️ **Notice:** ${impactResult.missingDataWarnings.join(' ')}\n\n`;
      }

      content += `Would you like me to apply this update to your active event plan?`;

      const proposedAction: ProposedAction = {
        id: `act-${Date.now()}`,
        type: 'adjust_guest_count',
        summary: `Update guest count to ${targetCount}`,
        payload: { guestCount: targetCount },
        impact,
      };

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'change_guest_count',
        proposedAction,
        requiresConfirmation: true,
        actionStatus: 'pending',
        rationale: `Calculated from configured per-guest rules for variable categories.`,
      };
    }

    case 'reduce_budget':
    case 'suggest_expense_reductions': {
      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const priorities = state.event.preferences.planningPriorities;
      const recs = generatePriorityAwareRecommendations(overview, priorities);

      if (recs.recommendations.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: overview.isOverrun
            ? `Your budget has an overrun of ${formatCurrency(overview.overrunAmount, currency)}, but all category allocations are already tied to confirmed vendor commitments. You may need to renegotiate quotes or increase the total budget.`
            : `Your budget is currently within the total limit of ${formatCurrency(state.event.totalBudget, currency)}. If you wish to create a leaner contingency buffer, you can create a test scenario in the Decision Simulator.`,
          intent: 'suggest_expense_reductions',
          requiresConfirmation: false,
        };
      }

      let content = `### Priority-Aware Budget Reduction Proposals\n\n` +
        `The recommendations below safeguard your top-ranked priority categories (${priorities.slice(0, 2).join(', ')}) while trimming non-committed flexible allocations from lower-priority items:\n\n`;

      for (const rec of recs.recommendations) {
        content += `* **${rec.categoryName}** (Rank #${rec.priorityRank}): Reduce allocation by **${formatCurrency(rec.suggestedReduction, currency)}** ` +
          `(${formatCurrency(rec.currentAllocated, currency)} ➔ ${formatCurrency(rec.newAllocated, currency)}).\n` +
          `  *Rationale:* ${rec.rationale}\n`;
      }

      content += `\nWould you like to generate an alternative Budget Scenario incorporating these reductions?`;

      const proposedAction: ProposedAction = {
        id: `act-${Date.now()}`,
        type: 'create_scenario',
        summary: 'Create Leaner Contingency Scenario',
        payload: {
          scenarioName: 'Lean Rebalance Scenario',
          adjustments: recs.recommendations,
        },
        impact: {
          currentEstimatedTotal: overview.effectiveProjectedTotal,
          proposedEstimatedTotal: overview.effectiveProjectedTotal - recs.recommendations.reduce((sum, r) => sum + r.suggestedReduction, 0),
          difference: -recs.recommendations.reduce((sum, r) => sum + r.suggestedReduction, 0),
          remainingBudget: overview.remainingBudget + recs.recommendations.reduce((sum, r) => sum + r.suggestedReduction, 0),
          affectedCategories: recs.recommendations.map((r) => r.categoryName),
          budgetViolations: [],
        },
      };

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'suggest_expense_reductions',
        proposedAction,
        requiresConfirmation: true,
        actionStatus: 'pending',
        rationale: 'Follows priority ranking order strictly, preserving committed actuals.',
      };
    }

    case 'protect_priority': {
      const topPriorityId = state.event.preferences.planningPriorities[0];
      const topCat = state.categories.find((c) => c.id === topPriorityId) || state.categories[0];

      const content = `### Priority Protection: ${topCat?.name || 'Top Priority'}\n\n` +
        `* **Category Status:** Currently allocated ${formatCurrency(topCat?.allocatedAmount || 0, currency)}.\n` +
        `* **Priority Order:** Designated as Priority #1 in your event preferences.\n\n` +
        `The budget engine automatically shields this category from automatic cuts. If you require additional funds for ${topCat?.name}, you can reallocate uncommitted headroom from lower-priority categories in the Budget Planner.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'protect_priority',
        requiresConfirmation: false,
      };
    }

    case 'find_overdue_tasks': {
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const overdue = evaluations.filter((e) => e.risks.isOverdue);

      if (overdue.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ **No overdue tasks!** All task deadlines are currently on schedule relative to today.',
          intent: 'find_overdue_tasks',
          requiresConfirmation: false,
        };
      }

      let content = `### ⚠️ Overdue Tasks Requiring Attention (${overdue.length})\n\n`;
      for (const item of overdue) {
        content += `* **${item.task.title}** (Due: ${item.task.dueDate}, Priority: ${item.task.priority.toUpperCase()})\n` +
          `  *Risk:* ${item.risks.putsDownstreamAtRisk ? `Blocks downstream tasks (${item.risks.downstreamTaskTitles.join(', ')})` : 'Individual deadline passed.'}\n`;
      }
      content += `\nYou can navigate to the **Tasks** screen to reschedule or mark them complete.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'find_overdue_tasks',
        requiresConfirmation: false,
      };
    }

    case 'explain_blocked_tasks': {
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const blocked = evaluations.filter((e) => e.risks.isBlocked);

      if (blocked.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ **No tasks are currently blocked.** All remaining tasks have their prerequisites completed or have no dependencies.',
          intent: 'explain_blocked_tasks',
          requiresConfirmation: false,
        };
      }

      let content = `### 🔒 Blocked Tasks (${blocked.length})\n\n` +
        `The following tasks cannot be marked complete because their prerequisite tasks are still pending:\n\n`;

      for (const item of blocked) {
        content += `* **${item.task.title}**\n` +
          `  *Awaiting Completion Of:* ${item.risks.missingPrerequisites.join(', ')}\n`;
      }

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'explain_blocked_tasks',
        requiresConfirmation: false,
      };
    }

    case 'compare_vendor_quotes': {
      if (state.vendors.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'No vendor records have been added to compare yet. Add vendors in the **Vendors** tab to see side-by-side quotation matrices.',
          intent: 'compare_vendor_quotes',
          requiresConfirmation: false,
        };
      }

      let content = `### Vendor Quotation Comparison Summary\n\n`;
      for (const cat of state.categories) {
        const comp = compareCategoryVendors(cat.id, cat.name, state.vendors, state.quotes);
        if (comp.rows.length > 0) {
          content += `#### ${cat.name} (${comp.rows.length} ${comp.rows.length === 1 ? 'vendor' : 'vendors'})\n`;
          for (const row of comp.rows) {
            const price = row.quote ? formatCurrency(row.quote.quotedAmount, row.quote.currency) : 'No quote submitted';
            const status = row.quote ? `[${row.quote.status.toUpperCase()}]` : '';
            content += `* **${row.vendor.name}**: ${price} ${status} ${row.isExpired ? '⚠️ (Quote Expired)' : ''}\n`;
          }
          content += '\n';
        }
      }

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'compare_vendor_quotes',
        requiresConfirmation: false,
      };
    }

    case 'identify_missing_vendor_info': {
      const missingDetails: string[] = [];
      for (const q of state.quotes) {
        const vendor = state.vendors.find((v) => v.id === q.vendorId);
        const name = vendor?.name || 'Unknown Vendor';
        const missing = identifyMissingQuoteDetails(q, name);
        if (missing.length > 0) {
          missingDetails.push(`* **${name}**:\n` + missing.map((m) => `  - ${m}`).join('\n'));
        }
      }

      if (missingDetails.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ All submitted quotations currently include itemized inclusions, exclusions, validity dates, and payment terms.',
          intent: 'identify_missing_vendor_info',
          requiresConfirmation: false,
        };
      }

      const content = `### 📋 Incomplete Quotation Details Detected\n\n` +
        `The following quotations lack critical contractual specifications:\n\n` +
        missingDetails.join('\n\n') +
        `\n\nYou can use the **Draft Clarification** button in the Vendors tab to send inquiries to these providers.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'identify_missing_vendor_info',
        requiresConfirmation: false,
      };
    }

    case 'create_budget_scenario': {
      const content = `### Decision Impact Modeling\n\n` +
        `To explore alternative budget scenarios without modifying your confirmed plan, navigate to the **Simulator** tab. ` +
        `There you can:\n\n` +
        `1. Adjust guest count to stress-test catering and venue capacity.\n` +
        `2. Reallocate budget across photography, decor, and catering.\n` +
        `3. Compare side-by-side variances against baseline before committing.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'create_budget_scenario',
        requiresConfirmation: false,
      };
    }

    case 'summarize_plan': {
      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const completedTasks = evaluations.filter((e) => e.task.status === 'completed').length;
      const overdueTasks = evaluations.filter((e) => e.risks.isOverdue).length;
      const selectedQuotes = state.quotes.filter((q) => q.status === 'selected').length;

      const content = `### Event Executive Summary: "${state.event.name}"\n\n` +
        `* **Date:** ${state.event.date} (${state.event.location})\n` +
        `* **Headcount:** ${state.event.guestCount} confirmed guests\n` +
        `* **Budget Health:** ${formatCurrency(overview.effectiveProjectedTotal, currency)} projected of ${formatCurrency(overview.totalBudget, currency)} total (${overview.remainingBudget >= 0 ? `${formatCurrency(overview.remainingBudget, currency)} remaining` : `⚠️ Overrun of ${formatCurrency(overview.overrunAmount, currency)}`})\n` +
        `* **Milestone Progress:** ${completedTasks} of ${state.tasks.length} tasks completed (${overdueTasks > 0 ? `⚠️ ${overdueTasks} overdue` : 'all deadlines on schedule'})\n` +
        `* **Vendor Coordination:** ${selectedQuotes} selected of ${state.vendors.length} vendors tracked\n\n` +
        `All metrics are derived in real-time from your confirmed plan.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'summarize_plan',
        requiresConfirmation: false,
      };
    }

    case 'unsupported':
    default: {
      const content = `I am VowPilot's deterministic planning engine. I specialize in constraint validation, budget calculations, task dependency tracking, and vendor coordination.\n\n` +
        `I did not recognize a supported planning command in your message. Here are specific things you can ask me:\n\n` +
        `* **"Explain my current budget"** — Detailed breakdown of allocations and committed spend\n` +
        `* **"Change guest count to 150"** — Impact analysis on catering and venue constraints\n` +
        `* **"Suggest ways to reduce expenses"** — Priority-aware trimming of non-committed allocations\n` +
        `* **"Find tasks that are overdue"** — List overdue deadlines and blocked items\n` +
        `* **"Explain which tasks are blocked"** — Show upstream prerequisite requirements\n` +
        `* **"Compare vendor quotations"** — Side-by-side category vendor review\n` +
        `* **"Identify missing vendor information"** — Check quotes for validity dates and exclusions\n` +
        `* **"Summarize the current event plan"** — Executive readiness overview`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'unsupported',
        requiresConfirmation: false,
        rationale: 'Honest response: intent was not matched to any deterministic planning action.',
      };
    }
  }
}
