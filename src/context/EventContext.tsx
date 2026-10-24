import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  AppState,
  BudgetCategory,
  BudgetScenario,
  EventDetails,
  Expense,
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
import {
  handleUpdateEvent,
  handleUpdateCategory,
  handleAddCategory,
  handleDeleteCategory,
  handleAddExpense,
  handleUpdateExpense,
  handleDeleteExpense,
} from './slices/budgetSlice';
import {
  handleAddTask,
  handleUpdateTask,
  handleCompleteTask,
  handleDeleteTask,
} from './slices/taskSlice';
import {
  handleAddVendor,
  handleUpdateVendor,
  handleDeleteVendor,
  handleAddQuote,
  handleUpdateQuote,
  handleSelectQuote,
  handleRecordVendorInquiry,
} from './slices/vendorSlice';
import {
  handleCreateScenario,
  handleApplyScenarioToBaseline,
  handleDeleteScenario,
} from './slices/scenarioSlice';
import {
  handleSendAssistantMessage,
  handleApplyProposedAction,
  handleDismissProposedAction,
} from './slices/assistantSlice';

export interface EventContextType {
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
  recordVendorInquiry: (quoteId: string, vendorId: string, method: 'email_client' | 'clipboard_handoff') => void;
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

  // Event & Budget Handlers
  const updateEvent = (updatedEvent: EventDetails) => {
    setState((prev) => handleUpdateEvent(prev, updatedEvent));
  };

  const updateCategory = (category: BudgetCategory) => {
    setState((prev) => handleUpdateCategory(prev, category));
  };

  const addCategory = (category: BudgetCategory) => {
    setState((prev) => handleAddCategory(prev, category));
  };

  const deleteCategory = (categoryId: string) => {
    setState((prev) => handleDeleteCategory(prev, categoryId));
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    setState((prev) => handleAddExpense(prev, expenseData));
  };

  const updateExpense = (expense: Expense) => {
    setState((prev) => handleUpdateExpense(prev, expense));
  };

  const deleteExpense = (expenseId: string) => {
    setState((prev) => handleDeleteExpense(prev, expenseId));
  };

  // Task Handlers
  const addTask = (taskData: Omit<Task, 'id'>): { success: boolean; error?: string } => {
    const { nextState, result } = handleAddTask(state, taskData);
    if (result.success) {
      setState(nextState);
    }
    return result;
  };

  const updateTask = (task: Task): { success: boolean; error?: string } => {
    const { nextState, result } = handleUpdateTask(state, task);
    if (result.success) {
      setState(nextState);
    }
    return result;
  };

  const completeTask = (taskId: string): { success: boolean; error?: string } => {
    const { nextState, result } = handleCompleteTask(state, taskId);
    if (result.success) {
      setState(nextState);
    }
    return result;
  };

  const deleteTask = (taskId: string) => {
    setState((prev) => handleDeleteTask(prev, taskId));
  };

  // Vendor & Quote Handlers
  const addVendor = (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => {
    setState((prev) => handleAddVendor(prev, vendorData));
  };

  const updateVendor = (vendor: Vendor) => {
    setState((prev) => handleUpdateVendor(prev, vendor));
  };

  const deleteVendor = (vendorId: string) => {
    setState((prev) => handleDeleteVendor(prev, vendorId));
  };

  const addQuote = (quoteData: Omit<VendorQuote, 'id'>) => {
    setState((prev) => handleAddQuote(prev, quoteData));
  };

  const updateQuote = (quote: VendorQuote) => {
    setState((prev) => handleUpdateQuote(prev, quote));
  };

  const selectQuote = (quoteId: string) => {
    setState((prev) => handleSelectQuote(prev, quoteId));
  };

  const recordVendorInquiry = (
    quoteId: string,
    vendorId: string,
    method: 'email_client' | 'clipboard_handoff'
  ) => {
    setState((prev) => handleRecordVendorInquiry(prev, quoteId, vendorId, method));
  };

  // Scenario Handlers
  const createScenario = (scenarioData: Omit<BudgetScenario, 'id' | 'createdAt'>) => {
    setState((prev) => handleCreateScenario(prev, scenarioData));
  };

  const applyScenarioToBaseline = (scenarioId: string) => {
    setState((prev) => handleApplyScenarioToBaseline(prev, scenarioId));
  };

  const deleteScenario = (scenarioId: string) => {
    setState((prev) => handleDeleteScenario(prev, scenarioId));
  };

  // Assistant Handlers
  const sendAssistantMessage = (userText: string) => {
    setState((prev) => handleSendAssistantMessage(prev, userText));
  };

  const applyProposedAction = (messageId: string, action: ProposedAction) => {
    setState((prev) => handleApplyProposedAction(prev, messageId, action));
  };

  const dismissProposedAction = (messageId: string) => {
    setState((prev) => handleDismissProposedAction(prev, messageId));
  };

  // Data & Reset Handlers
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

  const contextValue = useMemo<EventContextType>(
    () => ({
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
      recordVendorInquiry,
      createScenario,
      applyScenarioToBaseline,
      deleteScenario,
      sendAssistantMessage,
      applyProposedAction,
      dismissProposedAction,
      resetToDemo,
      importState,
      clearAllData,
    }),
    [state, activeTab]
  );

  return <EventContext.Provider value={contextValue}>{children}</EventContext.Provider>;
};

/**
 * Universal hook providing unified access to entire event state & dispatchers
 */
export function useEvent(): EventContextType {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

/**
 * Domain-specific Hook: Budget and Expense tracking
 */
export function useBudget() {
  const ctx = useEvent();
  return {
    event: ctx.state.event,
    categories: ctx.state.categories,
    expenses: ctx.state.expenses,
    updateEvent: ctx.updateEvent,
    updateCategory: ctx.updateCategory,
    addCategory: ctx.addCategory,
    deleteCategory: ctx.deleteCategory,
    addExpense: ctx.addExpense,
    updateExpense: ctx.updateExpense,
    deleteExpense: ctx.deleteExpense,
  };
}

/**
 * Domain-specific Hook: Task dependencies, scheduling, and completion
 */
export function useTasks() {
  const ctx = useEvent();
  return {
    tasks: ctx.state.tasks,
    categories: ctx.state.categories,
    addTask: ctx.addTask,
    updateTask: ctx.updateTask,
    completeTask: ctx.completeTask,
    deleteTask: ctx.deleteTask,
  };
}

/**
 * Domain-specific Hook: Vendor proposal comparison, quotation, and coordination
 */
export function useVendors() {
  const ctx = useEvent();
  return {
    vendors: ctx.state.vendors,
    quotes: ctx.state.quotes,
    categories: ctx.state.categories,
    event: ctx.state.event,
    addVendor: ctx.addVendor,
    updateVendor: ctx.updateVendor,
    deleteVendor: ctx.deleteVendor,
    addQuote: ctx.addQuote,
    updateQuote: ctx.updateQuote,
    selectQuote: ctx.selectQuote,
    recordVendorInquiry: ctx.recordVendorInquiry,
  };
}

/**
 * Domain-specific Hook: What-if decision simulator and trade-off modeling
 */
export function useSimulator() {
  const ctx = useEvent();
  return {
    scenarios: ctx.state.scenarios,
    categories: ctx.state.categories,
    event: ctx.state.event,
    createScenario: ctx.createScenario,
    applyScenarioToBaseline: ctx.applyScenarioToBaseline,
    deleteScenario: ctx.deleteScenario,
  };
}

/**
 * Domain-specific Hook: Contextual AI planning assistant
 */
export function useAssistant() {
  const ctx = useEvent();
  return {
    messages: ctx.state.messages,
    state: ctx.state,
    sendAssistantMessage: ctx.sendAssistantMessage,
    applyProposedAction: ctx.applyProposedAction,
    dismissProposedAction: ctx.dismissProposedAction,
  };
}
