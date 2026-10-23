import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppState,
  BudgetCategory,
  BudgetScenario,
  ChangeRecord,
  EventDetails,
  Expense,
  PlanningMessage,
  ProposedAction,
  Task,
  Vendor,
  VendorQuote,
} from '../types';
import {
  clearAllPersistedData,
  loadPersistedState,
  resetToDemoState,
  savePersistedState,
} from '../persistence/storage';
import { canCompleteTask, detectDependencyCycles } from '../domain/taskEngine';
import { generateAssistantResponse } from '../domain/assistantEngine';

interface EventContextType {
  state: AppState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // Event
  updateEvent: (event: EventDetails) => void;
  // Categories
  updateCategory: (category: BudgetCategory) => void;
  addCategory: (category: BudgetCategory) => void;
  deleteCategory: (categoryId: string) => void;
  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (expenseId: string) => void;
  // Tasks
  addTask: (task: Omit<Task, 'id'>) => { success: boolean; error?: string };
  updateTask: (task: Task) => { success: boolean; error?: string };
  completeTask: (taskId: string) => { success: boolean; error?: string };
  deleteTask: (taskId: string) => void;
  // Vendors & Quotes
  addVendor: (vendor: Omit<Vendor, 'id' | 'createdAt'>) => void;
  updateVendor: (vendor: Vendor) => void;
  deleteVendor: (vendorId: string) => void;
  addQuote: (quote: Omit<VendorQuote, 'id'>) => void;
  updateQuote: (quote: VendorQuote) => void;
  selectQuote: (quoteId: string) => void;
  // Scenarios
  createScenario: (scenario: Omit<BudgetScenario, 'id' | 'createdAt'>) => void;
  applyScenarioToBaseline: (scenarioId: string) => void;
  deleteScenario: (scenarioId: string) => void;
  // Assistant
  sendAssistantMessage: (text: string) => void;
  applyProposedAction: (messageId: string, action: ProposedAction) => void;
  dismissProposedAction: (messageId: string) => void;
  // Storage & Reset
  resetToDemo: () => void;
  importState: (newState: AppState) => void;
  clearAllData: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    return loadPersistedState().state;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Sync to localStorage on state changes
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  const recordChange = (
    changeType: ChangeRecord['changeType'],
    description: string,
    deltaSummary?: string
  ): ChangeRecord => {
    return {
      id: `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      changeType,
      description,
      deltaSummary,
    };
  };

  const updateEvent = (updatedEvent: EventDetails) => {
    setState((prev) => ({
      ...prev,
      event: { ...updatedEvent, updatedAt: new Date().toISOString() },
      changeLog: [
        recordChange('setup', `Updated event configuration: "${updatedEvent.name}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const updateCategory = (category: BudgetCategory) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === category.id ? category : c)),
      changeLog: [
        recordChange('budget', `Modified budget allocation for ${category.name}`),
        ...prev.changeLog,
      ],
    }));
  };

  const addCategory = (category: BudgetCategory) => {
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, category],
      changeLog: [
        recordChange('budget', `Created new budget category: ${category.name}`),
        ...prev.changeLog,
      ],
    }));
  };

  const deleteCategory = (categoryId: string) => {
    const cat = state.categories.find((c) => c.id === categoryId);
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== categoryId),
      expenses: prev.expenses.filter((e) => e.categoryId !== categoryId),
      changeLog: [
        recordChange('budget', `Removed budget category: ${cat?.name || categoryId}`),
        ...prev.changeLog,
      ],
    }));
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      expenses: [...prev.expenses, newExpense],
      changeLog: [
        recordChange('budget', `Added expense "${newExpense.title}" (${newExpense.status})`),
        ...prev.changeLog,
      ],
    }));
  };

  const updateExpense = (expense: Expense) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === expense.id ? expense : e)),
      changeLog: [
        recordChange('budget', `Updated expense "${expense.title}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const deleteExpense = (expenseId: string) => {
    const exp = state.expenses.find((e) => e.id === expenseId);
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
      changeLog: [
        recordChange('budget', `Deleted expense "${exp?.title || expenseId}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const addTask = (taskData: Omit<Task, 'id'>): { success: boolean; error?: string } => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      updatedAt: new Date().toISOString(),
    };

    const candidateTasks = [...state.tasks, newTask];
    const cycleCheck = detectDependencyCycles(candidateTasks);
    if (cycleCheck.hasCycle) {
      return {
        success: false,
        error: `Cannot add task: Cyclic dependency detected (${cycleCheck.cyclePath.join(' ➔ ')})`,
      };
    }

    setState((prev) => ({
      ...prev,
      tasks: candidateTasks,
      changeLog: [
        recordChange('task', `Created task "${newTask.title}"`),
        ...prev.changeLog,
      ],
    }));
    return { success: true };
  };

  const updateTask = (task: Task): { success: boolean; error?: string } => {
    const candidateTasks = state.tasks.map((t) => (t.id === task.id ? task : t));
    const cycleCheck = detectDependencyCycles(candidateTasks);
    if (cycleCheck.hasCycle) {
      return {
        success: false,
        error: `Cannot update task: Cyclic dependency detected (${cycleCheck.cyclePath.join(' ➔ ')})`,
      };
    }

    setState((prev) => ({
      ...prev,
      tasks: candidateTasks,
      changeLog: [
        recordChange('task', `Updated task "${task.title}"`),
        ...prev.changeLog,
      ],
    }));
    return { success: true };
  };

  const completeTask = (taskId: string): { success: boolean; error?: string } => {
    const check = canCompleteTask(taskId, state.tasks);
    if (!check.allowed) {
      return {
        success: false,
        error: `Cannot complete task: Required prerequisite tasks are still incomplete (${check.blockingTaskTitles.join(', ')})`,
      };
    }

    const task = state.tasks.find((t) => t.id === taskId);
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
          : t
      ),
      changeLog: [
        recordChange('task', `Marked task completed: "${task?.title || taskId}"`),
        ...prev.changeLog,
      ],
    }));
    return { success: true };
  };

  const deleteTask = (taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId);
    setState((prev) => ({
      ...prev,
      // Remove task and also clean up dependencies from tasks that relied on it
      tasks: prev.tasks
        .filter((t) => t.id !== taskId)
        .map((t) => ({
          ...t,
          dependencies: t.dependencies.filter((d) => d !== taskId),
        })),
      changeLog: [
        recordChange('task', `Deleted task "${task?.title || taskId}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const addVendor = (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => {
    const newVendor: Vendor = {
      ...vendorData,
      id: `ven-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      vendors: [...prev.vendors, newVendor],
      changeLog: [
        recordChange('vendor', `Added vendor "${newVendor.name}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const updateVendor = (vendor: Vendor) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === vendor.id ? vendor : v)),
      changeLog: [
        recordChange('vendor', `Updated vendor details for "${vendor.name}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const deleteVendor = (vendorId: string) => {
    const vendor = state.vendors.find((v) => v.id === vendorId);
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.filter((v) => v.id !== vendorId),
      quotes: prev.quotes.filter((q) => q.vendorId !== vendorId),
      changeLog: [
        recordChange('vendor', `Removed vendor "${vendor?.name || vendorId}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const addQuote = (quoteData: Omit<VendorQuote, 'id'>) => {
    const newQuote: VendorQuote = {
      ...quoteData,
      id: `quo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    const vendor = state.vendors.find((v) => v.id === newQuote.vendorId);
    setState((prev) => ({
      ...prev,
      quotes: [...prev.quotes, newQuote],
      changeLog: [
        recordChange('vendor', `Added quotation from "${vendor?.name || 'Vendor'}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const updateQuote = (quote: VendorQuote) => {
    setState((prev) => ({
      ...prev,
      quotes: prev.quotes.map((q) => (q.id === quote.id ? quote : q)),
      changeLog: [
        recordChange('vendor', `Updated quote ${quote.id}`),
        ...prev.changeLog,
      ],
    }));
  };

  const selectQuote = (quoteId: string) => {
    const selectedQuote = state.quotes.find((q) => q.id === quoteId);
    if (!selectedQuote) return;
    const vendor = state.vendors.find((v) => v.id === selectedQuote.vendorId);
    const categoryId = vendor?.categoryId;

    setState((prev) => {
      // Mark selected quote, and mark other quotes in the same category as rejected
      const updatedQuotes = prev.quotes.map((q) => {
        if (q.id === quoteId) return { ...q, status: 'selected' as const };
        const qVendor = prev.vendors.find((v) => v.id === q.vendorId);
        if (categoryId && qVendor?.categoryId === categoryId && q.status === 'selected') {
          return { ...q, status: 'rejected' as const };
        }
        return q;
      });

      // Update or create corresponding confirmed/quoted expense
      const existingExpenseIndex = prev.expenses.findIndex((e) => e.quoteId === quoteId);
      let updatedExpenses = [...prev.expenses];

      if (existingExpenseIndex >= 0) {
        updatedExpenses[existingExpenseIndex] = {
          ...updatedExpenses[existingExpenseIndex],
          status: 'confirmed',
          amount: selectedQuote.quotedAmount,
        };
      } else if (categoryId) {
        updatedExpenses.push({
          id: `exp-${Date.now()}`,
          categoryId,
          title: `${vendor?.name || 'Vendor'} Proposal`,
          amount: selectedQuote.quotedAmount,
          status: 'confirmed',
          vendorId: vendor?.id,
          quoteId: selectedQuote.id,
          paidAmount: 0,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        ...prev,
        quotes: updatedQuotes,
        expenses: updatedExpenses,
        changeLog: [
          recordChange('vendor', `Selected quotation from "${vendor?.name || 'Vendor'}"`),
          ...prev.changeLog,
        ],
      };
    });
  };

  const createScenario = (scenarioData: Omit<BudgetScenario, 'id' | 'createdAt'>) => {
    const newScenario: BudgetScenario = {
      ...scenarioData,
      id: `scen-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      scenarios: [...prev.scenarios, newScenario],
      changeLog: [
        recordChange('scenario', `Created decision scenario "${newScenario.name}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const applyScenarioToBaseline = (scenarioId: string) => {
    const scenario = state.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;

    setState((prev) => {
      // Update categories based on scenario allocations
      const updatedCategories = prev.categories.map((cat) => {
        if (scenario.categoryAllocations[cat.id] !== undefined) {
          return {
            ...cat,
            allocatedAmount: scenario.categoryAllocations[cat.id],
          };
        }
        return cat;
      });

      return {
        ...prev,
        event: {
          ...prev.event,
          guestCount: scenario.modifiedGuestCount,
          updatedAt: new Date().toISOString(),
        },
        categories: updatedCategories,
        changeLog: [
          recordChange('scenario', `Applied scenario "${scenario.name}" to confirmed plan`),
          ...prev.changeLog,
        ],
      };
    });
  };

  const deleteScenario = (scenarioId: string) => {
    const scenario = state.scenarios.find((s) => s.id === scenarioId);
    setState((prev) => ({
      ...prev,
      scenarios: prev.scenarios.filter((s) => s.id !== scenarioId),
      changeLog: [
        recordChange('scenario', `Deleted scenario "${scenario?.name || scenarioId}"`),
        ...prev.changeLog,
      ],
    }));
  };

  const sendAssistantMessage = (userText: string) => {
    const userMsg: PlanningMessage = {
      id: `msg-u-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'user',
      content: userText,
    };

    const botResponse = generateAssistantResponse(userText, state);

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg, botResponse],
    }));
  };

  const applyProposedAction = (messageId: string, action: ProposedAction) => {
    setState((prev) => {
      let nextEvent = { ...prev.event };
      let nextCategories = [...prev.categories];
      let nextScenarios = [...prev.scenarios];

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
        for (const cat of prev.categories) {
          const adj = adjustments.find((a) => a.categoryId === cat.id);
          allocations[cat.id] = adj ? adj.newAllocated : cat.allocatedAmount;
        }

        nextScenarios.push({
          id: `scen-${Date.now()}`,
          name: scenarioName,
          description: 'Priority-aware rebalance recommended by assistant',
          createdAt: new Date().toISOString(),
          modifiedGuestCount: prev.event.guestCount,
          categoryAllocations: allocations,
          notes: 'Auto-generated via planning assistant',
          isBaseline: false,
        });
      }

      const updatedMessages = prev.messages.map((m) =>
        m.id === messageId ? { ...m, actionStatus: 'applied' as const } : m
      );

      return {
        ...prev,
        event: nextEvent,
        categories: nextCategories,
        scenarios: nextScenarios,
        messages: updatedMessages,
        changeLog: [
          recordChange('budget', `Applied assistant action: "${action.summary}"`),
          ...prev.changeLog,
        ],
      };
    });
  };

  const dismissProposedAction = (messageId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === messageId ? { ...m, actionStatus: 'rejected' as const } : m
      ),
    }));
  };

  const resetToDemo = () => {
    const demo = resetToDemoState();
    setState(demo);
  };

  const importState = (newState: AppState) => {
    savePersistedState(newState);
    setState(newState);
  };

  const clearAllData = () => {
    clearAllPersistedData();
    const cleanState = resetToDemoState();
    setState(cleanState);
  };

  return (
    <EventContext.Provider
      value={{
        state,
        activeTab,
        setActiveTab,
        updateEvent,
        updateCategory,
        addCategory,
        deleteCategory,
        addExpense,
        updateExpense,
        deleteExpense,
        addTask,
        updateTask,
        completeTask,
        deleteTask,
        addVendor,
        updateVendor,
        deleteVendor,
        addQuote,
        updateQuote,
        selectQuote,
        createScenario,
        applyScenarioToBaseline,
        deleteScenario,
        sendAssistantMessage,
        applyProposedAction,
        dismissProposedAction,
        resetToDemo,
        importState,
        clearAllData,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export function useEvent(): EventContextType {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}
