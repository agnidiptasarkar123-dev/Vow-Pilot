import { AppState, BudgetScenario } from '../../types';
import { createChangeRecord } from './recordChange';

export const handleCreateScenario = (
  state: AppState,
  scenarioData: Omit<BudgetScenario, 'id' | 'createdAt'>
): AppState => {
  const newScenario: BudgetScenario = {
    ...scenarioData,
    id: `scen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    scenarios: [...state.scenarios, newScenario],
    changeLog: [
      createChangeRecord('scenario', `Created decision scenario "${newScenario.name}"`),
      ...state.changeLog,
    ],
  };
};

export const handleApplyScenarioToBaseline = (state: AppState, scenarioId: string): AppState => {
  const scenario = state.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return state;

  const updatedCategories = state.categories.map((cat) => {
    if (scenario.categoryAllocations[cat.id] !== undefined) {
      return {
        ...cat,
        allocatedAmount: scenario.categoryAllocations[cat.id],
      };
    }
    return cat;
  });

  return {
    ...state,
    event: {
      ...state.event,
      guestCount: scenario.modifiedGuestCount,
      updatedAt: new Date().toISOString(),
    },
    categories: updatedCategories,
    changeLog: [
      createChangeRecord('scenario', `Applied scenario "${scenario.name}" to confirmed plan`),
      ...state.changeLog,
    ],
  };
};

export const handleDeleteScenario = (state: AppState, scenarioId: string): AppState => {
  const scenario = state.scenarios.find((s) => s.id === scenarioId);
  return {
    ...state,
    scenarios: state.scenarios.filter((s) => s.id !== scenarioId),
    changeLog: [
      createChangeRecord('scenario', `Deleted scenario "${scenario?.name || scenarioId}"`),
      ...state.changeLog,
    ],
  };
};
