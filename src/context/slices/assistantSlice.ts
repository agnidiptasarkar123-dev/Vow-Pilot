import { AppState, PlanningMessage, ProposedAction } from '../../types';
import { generateAssistantResponse } from '../../domain/assistantEngine';
import { createChangeRecord } from './recordChange';

export const handleSendAssistantMessage = (state: AppState, userText: string): AppState => {
  const userMsg: PlanningMessage = {
    id: `msg-u-${Date.now()}`,
    timestamp: new Date().toISOString(),
    role: 'user',
    content: userText,
  };

  const botResponse = generateAssistantResponse(userText, state);

  return {
    ...state,
    messages: [...state.messages, userMsg, botResponse],
  };
};

export const handleApplyProposedAction = (
  state: AppState,
  messageId: string,
  action: ProposedAction
): AppState => {
  let nextEvent = { ...state.event };
  let nextCategories = [...state.categories];
  let nextScenarios = [...state.scenarios];

  if (action.type === 'adjust_guest_count') {
    const newCount = action.payload.guestCount as number;
    nextEvent.guestCount = newCount;
    nextEvent.updatedAt = new Date().toISOString();
  } else if (action.type === 'create_scenario') {
    const scenarioName = (action.payload.scenarioName as string) || 'Assistant Proposed Scenario';
    const adjustments = action.payload.adjustments as Array<{
      categoryId: string;
      newAllocated: number;
    }>;
    const allocations: Record<string, number> = {};
    for (const cat of state.categories) {
      const adj = adjustments?.find((a) => a.categoryId === cat.id);
      allocations[cat.id] = adj ? adj.newAllocated : cat.allocatedAmount;
    }

    nextScenarios.push({
      id: `scen-${Date.now()}`,
      name: scenarioName,
      description: 'Priority-aware rebalance recommended by assistant',
      createdAt: new Date().toISOString(),
      modifiedGuestCount: state.event.guestCount,
      categoryAllocations: allocations,
      notes: 'Auto-generated via planning assistant',
      isBaseline: false,
    });
  } else if (action.type === 'rebalance_budget' || action.type === 'cut_category_budget') {
    const adjustments = (action.payload.adjustments as Array<{
      categoryId: string;
      newAllocated: number;
    }>) || [];
    nextCategories = state.categories.map((cat) => {
      const adj = adjustments.find((a) => a.categoryId === cat.id);
      return adj ? { ...cat, allocatedAmount: adj.newAllocated } : cat;
    });
  }

  const updatedMessages = state.messages.map((m) =>
    m.id === messageId ? { ...m, actionStatus: 'applied' as const } : m
  );

  return {
    ...state,
    event: nextEvent,
    categories: nextCategories,
    scenarios: nextScenarios,
    messages: updatedMessages,
    changeLog: [
      createChangeRecord('budget', `Applied assistant action: "${action.summary}"`),
      ...state.changeLog,
    ],
  };
};

export const handleDismissProposedAction = (state: AppState, messageId: string): AppState => {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.id === messageId ? { ...m, actionStatus: 'rejected' as const } : m
    ),
  };
};
