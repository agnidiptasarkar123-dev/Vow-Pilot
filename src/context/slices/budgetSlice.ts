import { AppState, BudgetCategory, EventDetails, Expense } from '../../types';
import { createChangeRecord } from './recordChange';

export const handleUpdateEvent = (state: AppState, updatedEvent: EventDetails): AppState => {
  return {
    ...state,
    event: { ...updatedEvent, updatedAt: new Date().toISOString() },
    changeLog: [
      createChangeRecord('setup', `Updated event configuration: "${updatedEvent.name}"`),
      ...state.changeLog,
    ],
  };
};

export const handleUpdateCategory = (state: AppState, category: BudgetCategory): AppState => {
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === category.id ? category : c)),
    changeLog: [
      createChangeRecord('budget', `Modified budget allocation for ${category.name}`),
      ...state.changeLog,
    ],
  };
};

export const handleAddCategory = (state: AppState, category: BudgetCategory): AppState => {
  return {
    ...state,
    categories: [...state.categories, category],
    changeLog: [
      createChangeRecord('budget', `Created new budget category: ${category.name}`),
      ...state.changeLog,
    ],
  };
};

export const handleDeleteCategory = (state: AppState, categoryId: string): AppState => {
  const cat = state.categories.find((c) => c.id === categoryId);
  const remainingCats = state.categories.filter((c) => c.id !== categoryId);
  const fallbackCatId = remainingCats[0]?.id || 'general';

  return {
    ...state,
    categories: remainingCats,
    expenses: state.expenses.filter((e) => e.categoryId !== categoryId),
    tasks: state.tasks.map((t) => (t.categoryId === categoryId ? { ...t, categoryId: fallbackCatId } : t)),
    vendors: state.vendors.map((v) => (v.categoryId === categoryId ? { ...v, categoryId: fallbackCatId } : v)),
    changeLog: [
      createChangeRecord('budget', `Removed budget category: ${cat?.name || categoryId}`),
      ...state.changeLog,
    ],
  };
};

export const handleAddExpense = (
  state: AppState,
  expenseData: Omit<Expense, 'id' | 'createdAt'>
): AppState => {
  const newExpense: Expense = {
    ...expenseData,
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    expenses: [...state.expenses, newExpense],
    changeLog: [
      createChangeRecord('budget', `Added expense "${newExpense.title}" (${newExpense.status})`),
      ...state.changeLog,
    ],
  };
};

export const handleUpdateExpense = (state: AppState, expense: Expense): AppState => {
  return {
    ...state,
    expenses: state.expenses.map((e) => (e.id === expense.id ? expense : e)),
    changeLog: [
      createChangeRecord('budget', `Updated expense "${expense.title}"`),
      ...state.changeLog,
    ],
  };
};

export const handleDeleteExpense = (state: AppState, expenseId: string): AppState => {
  const exp = state.expenses.find((e) => e.id === expenseId);
  return {
    ...state,
    expenses: state.expenses.filter((e) => e.id !== expenseId),
    changeLog: [
      createChangeRecord('budget', `Deleted expense "${exp?.title || expenseId}"`),
      ...state.changeLog,
    ],
  };
};
