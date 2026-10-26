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
import {
  collaborationClient,
  CollaborationState,
} from '../services/collaborationClient';

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
  // Multi-User Collaboration & OCC
  collabState: CollaborationState;
  userRole: 'owner' | 'editor' | 'viewer' | null;
  isReadOnly: boolean;
  isCollabModalOpen: boolean;
  setCollabModalOpen: (open: boolean) => void;
  isConflictModalOpen: boolean;
  resolveConflictAcceptServer: () => void;
  resolveConflictReapplyLocal: () => Promise<boolean>;
  connectToCollabEvent: (eventId: string) => Promise<void>;
  // Authentication & Cloud Sync
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  currentUser: { id: string; name: string; email?: string } | null;
  createEventOnServer: () => Promise<{ success: boolean; eventId?: string; error?: string }>;
  logoutUser: () => Promise<void>;
  syncError: string | null;
  clearSyncError: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    return loadPersistedState().state;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [collabState, setCollabState] = useState<CollaborationState>(() => collaborationClient.getState());
  const [isCollabModalOpen, setCollabModalOpen] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync to localStorage on state changes
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  // Subscribe to collaboration state updates
  useEffect(() => {
    const unsubscribe = collaborationClient.subscribe((latest) => {
      setCollabState(latest);
      if (latest.currentUserId && latest.currentUserName) {
        setCurrentUser((prev) => ({
          id: latest.currentUserId!,
          name: latest.currentUserName!,
          email: prev?.email,
        }));
      } else if (!latest.currentUserId) {
        setCurrentUser(null);
      }
    });
    return unsubscribe;
  }, []);

  // Check auth session on startup
  useEffect(() => {
    collaborationClient.checkAuth().then(({ isAuthenticated, user }) => {
      if (isAuthenticated && user) {
        setCurrentUser(user);
      }
    });
  }, []);

  // Check URL query parameters on mount (e.g. invite token or event deep-link)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteToken = urlParams.get('inviteToken');
      const eventId = urlParams.get('eventId');
      if (inviteToken) {
        setCollabModalOpen(true);
      } else if (eventId && eventId !== collabState.activeEventId) {
        connectToCollabEvent(eventId);
      }
    }
  }, []);

  const pushUpdateIfConnected = (nextState: AppState) => {
    if (collabState.activeEventId && collabState.status !== 'local_only') {
      if (collabState.role !== 'viewer') {
        collaborationClient.pushStateUpdate(collabState.activeEventId, nextState).then((res) => {
          if (!res.success && res.error) {
            setSyncError(res.error);
          } else {
            setSyncError(null);
          }
        });
      }
    }
  };

  const createEventOnServer = async () => {
    const res = await collaborationClient.createEventOnServer(state);
    if (!res.success && res.error) {
      setSyncError(res.error);
    } else {
      setSyncError(null);
    }
    return res;
  };

  const logoutUser = async () => {
    await collaborationClient.logout();
    setCurrentUser(null);
    setSyncError(null);
  };

  const clearSyncError = () => {
    setSyncError(null);
  };

  const isReadOnly = collabState.role === 'viewer';
  const userRole = collabState.role;

  const connectToCollabEvent = async (eventId: string) => {
    await collaborationClient.connectToEvent(eventId, (remoteState) => {
      setState(remoteState);
    });
  };

  const isConflictModalOpen = collabState.status === 'conflict' && !!collabState.lastConflict;

  const resolveConflictAcceptServer = () => {
    collaborationClient.resolveConflictWithServer((serverState) => {
      setState(serverState);
    });
  };

  const resolveConflictReapplyLocal = async (): Promise<boolean> => {
    if (!collabState.activeEventId) return false;
    const res = await collaborationClient.resolveConflictWithLocal(collabState.activeEventId, state);
    return res.success;
  };

  // Event & Budget Handlers
  const updateEvent = (updatedEvent: EventDetails) => {
    if (isReadOnly) return;
    const next = handleUpdateEvent(state, updatedEvent);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const updateCategory = (category: BudgetCategory) => {
    if (isReadOnly) return;
    const next = handleUpdateCategory(state, category);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const addCategory = (category: BudgetCategory) => {
    if (isReadOnly) return;
    const next = handleAddCategory(state, category);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const deleteCategory = (categoryId: string) => {
    if (isReadOnly) return;
    const next = handleDeleteCategory(state, categoryId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    if (isReadOnly) return;
    const next = handleAddExpense(state, expenseData);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const updateExpense = (expense: Expense) => {
    if (isReadOnly) return;
    const next = handleUpdateExpense(state, expense);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const deleteExpense = (expenseId: string) => {
    if (isReadOnly) return;
    const next = handleDeleteExpense(state, expenseId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  // Task Handlers
  const addTask = (taskData: Omit<Task, 'id'>): { success: boolean; error?: string } => {
    if (isReadOnly) {
      return { success: false, error: 'Viewer role is read-only and cannot create tasks.' };
    }
    const { nextState, result } = handleAddTask(state, taskData);
    if (result.success) {
      setState(nextState);
      pushUpdateIfConnected(nextState);
    }
    return result;
  };

  const updateTask = (task: Task): { success: boolean; error?: string } => {
    if (isReadOnly) {
      return { success: false, error: 'Viewer role is read-only and cannot update tasks.' };
    }
    const { nextState, result } = handleUpdateTask(state, task);
    if (result.success) {
      setState(nextState);
      pushUpdateIfConnected(nextState);
    }
    return result;
  };

  const completeTask = (taskId: string): { success: boolean; error?: string } => {
    if (isReadOnly) {
      return { success: false, error: 'Viewer role is read-only and cannot complete tasks.' };
    }
    const { nextState, result } = handleCompleteTask(state, taskId);
    if (result.success) {
      setState(nextState);
      pushUpdateIfConnected(nextState);
    }
    return result;
  };

  const deleteTask = (taskId: string) => {
    if (isReadOnly) return;
    const next = handleDeleteTask(state, taskId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  // Vendor & Quote Handlers
  const addVendor = (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => {
    if (isReadOnly) return;
    const next = handleAddVendor(state, vendorData);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const updateVendor = (vendor: Vendor) => {
    if (isReadOnly) return;
    const next = handleUpdateVendor(state, vendor);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const deleteVendor = (vendorId: string) => {
    if (isReadOnly) return;
    const next = handleDeleteVendor(state, vendorId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const addQuote = (quoteData: Omit<VendorQuote, 'id'>) => {
    if (isReadOnly) return;
    const next = handleAddQuote(state, quoteData);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const updateQuote = (quote: VendorQuote) => {
    if (isReadOnly) return;
    const next = handleUpdateQuote(state, quote);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const selectQuote = (quoteId: string) => {
    if (isReadOnly) return;
    const next = handleSelectQuote(state, quoteId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const recordVendorInquiry = (
    quoteId: string,
    vendorId: string,
    method: 'email_client' | 'clipboard_handoff'
  ) => {
    if (isReadOnly) return;
    const next = handleRecordVendorInquiry(state, quoteId, vendorId, method);
    setState(next);
    pushUpdateIfConnected(next);
  };

  // Scenario Handlers
  const createScenario = (scenarioData: Omit<BudgetScenario, 'id' | 'createdAt'>) => {
    if (isReadOnly) return;
    const next = handleCreateScenario(state, scenarioData);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const applyScenarioToBaseline = (scenarioId: string) => {
    if (isReadOnly) return;
    const next = handleApplyScenarioToBaseline(state, scenarioId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const deleteScenario = (scenarioId: string) => {
    if (isReadOnly) return;
    const next = handleDeleteScenario(state, scenarioId);
    setState(next);
    pushUpdateIfConnected(next);
  };

  // Assistant Handlers
  const sendAssistantMessage = (userText: string) => {
    setState((prev) => handleSendAssistantMessage(prev, userText));
  };

  const applyProposedAction = (messageId: string, action: ProposedAction) => {
    if (isReadOnly) return;
    const next = handleApplyProposedAction(state, messageId, action);
    setState(next);
    pushUpdateIfConnected(next);
  };

  const dismissProposedAction = (messageId: string) => {
    setState((prev) => handleDismissProposedAction(prev, messageId));
  };

  // Data & Reset Handlers
  const resetToDemo = () => {
    if (isReadOnly) return;
    const demo = resetToDemoState();
    setState(demo);
    pushUpdateIfConnected(demo);
  };

  const importState = (newState: AppState) => {
    if (isReadOnly) return;
    savePersistedState(newState);
    setState(newState);
    pushUpdateIfConnected(newState);
  };

  const clearAllData = () => {
    if (isReadOnly) return;
    clearAllPersistedData();
    const cleanState = resetToDemoState();
    setState(cleanState);
    pushUpdateIfConnected(cleanState);
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
      collabState,
      userRole,
      isReadOnly,
      isCollabModalOpen,
      setCollabModalOpen,
      isConflictModalOpen,
      resolveConflictAcceptServer,
      resolveConflictReapplyLocal,
      connectToCollabEvent,
      isAuthModalOpen,
      setAuthModalOpen,
      currentUser,
      createEventOnServer,
      logoutUser,
      syncError,
      clearSyncError,
    }),
    [
      state,
      activeTab,
      collabState,
      isReadOnly,
      userRole,
      isCollabModalOpen,
      isConflictModalOpen,
      isAuthModalOpen,
      currentUser,
      syncError,
    ]
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
