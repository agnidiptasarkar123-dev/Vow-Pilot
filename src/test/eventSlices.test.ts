import { describe, it, expect } from 'vitest';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState, BudgetCategory, Task, Vendor } from '../types';
import {
  handleUpdateEvent,
  handleUpdateCategory,
  handleAddCategory,
  handleDeleteCategory,
  handleAddExpense,
  handleUpdateExpense,
  handleDeleteExpense,
} from '../context/slices/budgetSlice';
import {
  handleAddTask,
  handleUpdateTask,
  handleCompleteTask,
  handleDeleteTask,
} from '../context/slices/taskSlice';
import {
  handleAddVendor,
  handleUpdateVendor,
  handleDeleteVendor,
  handleAddQuote,
  handleUpdateQuote,
  handleSelectQuote,
  handleRecordVendorInquiry,
} from '../context/slices/vendorSlice';
import {
  handleCreateScenario,
  handleApplyScenarioToBaseline,
  handleDeleteScenario,
} from '../context/slices/scenarioSlice';
import {
  handleSendAssistantMessage,
  handleApplyProposedAction,
  handleDismissProposedAction,
} from '../context/slices/assistantSlice';

describe('Event State Slices - Isolated Domain State Transitions', () => {
  const getInitialState = (): AppState => JSON.parse(JSON.stringify(DEMO_STATE));

  describe('Budget Slice', () => {
    it('handleUpdateEvent updates event metadata and prepends changeLog record', () => {
      const initial = getInitialState();
      const updated = handleUpdateEvent(initial, {
        ...initial.event,
        name: 'Royal Heritage Gala 2027',
      });
      expect(updated.event.name).toBe('Royal Heritage Gala 2027');
      expect(updated.changeLog[0].changeType).toBe('setup');
      expect(updated.changeLog[0].description).toContain('Royal Heritage Gala 2027');
    });

    it('handleUpdateCategory updates category allocation and logs change', () => {
      const initial = getInitialState();
      const targetCat = initial.categories[0];
      const updated = handleUpdateCategory(initial, {
        ...targetCat,
        allocatedAmount: targetCat.allocatedAmount + 1000000,
      });
      expect(updated.categories.find((c: BudgetCategory) => c.id === targetCat.id)?.allocatedAmount).toBe(
        targetCat.allocatedAmount + 1000000
      );
      expect(updated.changeLog[0].changeType).toBe('budget');
    });

    it('handleAddCategory appends a new category and logs change', () => {
      const initial = getInitialState();
      const newCat: BudgetCategory = {
        id: 'cat-fireworks',
        name: 'Pyrotechnics & Fireworks',
        allocatedAmount: 1500000,
        priorityRank: 5,
        userDefined: true,
      };
      const updated = handleAddCategory(initial, newCat);
      expect(updated.categories.some((c: BudgetCategory) => c.id === 'cat-fireworks')).toBe(true);
      expect(updated.changeLog[0].description).toContain('Pyrotechnics & Fireworks');
    });

    it('handleDeleteCategory reassigns dependent tasks and vendors to fallback category and deletes expenses', () => {
      const initial = getInitialState();
      const targetCatId = initial.categories[0].id;
      const updated = handleDeleteCategory(initial, targetCatId);
      expect(updated.categories.some((c: BudgetCategory) => c.id === targetCatId)).toBe(false);
      expect(updated.expenses.some((e: { categoryId: string }) => e.categoryId === targetCatId)).toBe(false);
      const fallbackId = updated.categories[0].id;
      const reassignedTask = updated.tasks.find((t: Task) =>
        initial.tasks.some((it: Task) => it.id === t.id && it.categoryId === targetCatId)
      );
      if (reassignedTask) {
        expect(reassignedTask.categoryId).toBe(fallbackId);
      }
    });

    it('handleAddExpense adds a new expense record with unique ID and timestamps', () => {
      const initial = getInitialState();
      const updated = handleAddExpense(initial, {
        categoryId: initial.categories[0].id,
        title: 'Stage Acoustic Rental Deposit',
        amount: 2500000,
        status: 'estimated',
        paidAmount: 0,
      });
      const added = updated.expenses.find((e: { title: string }) => e.title === 'Stage Acoustic Rental Deposit');
      expect(added).toBeDefined();
      expect(added?.id).toMatch(/^exp-/);
      expect(added?.createdAt).toBeDefined();
      expect(updated.changeLog[0].description).toContain('Stage Acoustic Rental Deposit');
    });

    it('handleUpdateExpense modifies expense fields and logs change', () => {
      const initial = getInitialState();
      const exp = initial.expenses[0];
      const updated = handleUpdateExpense(initial, {
        ...exp,
        status: 'actual',
        paidAmount: exp.amount,
      });
      const modified = updated.expenses.find((e: { id: string }) => e.id === exp.id);
      expect(modified?.status).toBe('actual');
      expect(modified?.paidAmount).toBe(exp.amount);
    });

    it('handleDeleteExpense removes expense and logs change', () => {
      const initial = getInitialState();
      const exp = initial.expenses[0];
      const updated = handleDeleteExpense(initial, exp.id);
      expect(updated.expenses.some((e) => e.id === exp.id)).toBe(false);
      expect(updated.changeLog[0].description).toContain(exp.title);
    });
  });

  describe('Task Slice', () => {
    it('handleAddTask succeeds for valid independent task', () => {
      const initial = getInitialState();
      const { nextState, result } = handleAddTask(initial, {
        categoryId: initial.categories[0].id,
        title: 'Order Ceremonial Garlands',
        description: 'Fresh jasmine and marigold garlands',
        dueDate: '2027-02-15',
        priority: 'high',
        priorityReason: 'Vendor requires advance notice',
        status: 'not_started',
        dependencies: [],
      });
      expect(result.success).toBe(true);
      expect(nextState.tasks.some((t: Task) => t.title === 'Order Ceremonial Garlands')).toBe(true);
      expect(nextState.changeLog[0].description).toContain('Order Ceremonial Garlands');
    });

    it('handleAddTask detects valid additions with dependencies', () => {
      const initial = getInitialState();
      const task1 = initial.tasks[0];
      const { nextState, result } = handleAddTask(initial, {
        categoryId: initial.categories[0].id,
        title: 'Follow-up on Stage Setup',
        description: 'Check progress after foundation is laid',
        dueDate: '2027-02-15',
        priority: 'medium',
        priorityReason: 'Dependent on prior stage tasks',
        status: 'not_started',
        dependencies: [task1.id],
      });
      expect(result.success).toBe(true);
      expect(nextState.tasks.some((t: Task) => t.title === 'Follow-up on Stage Setup')).toBe(true);
    });

    it('handleUpdateTask rejects cyclic dependencies and preserves state', () => {
      const initial = getInitialState();
      const taskWithDep = initial.tasks.find((t: Task) => t.dependencies.length > 0)!;
      const parentId = taskWithDep.dependencies[0];
      const parentTask = initial.tasks.find((t: Task) => t.id === parentId)!;

      const { nextState, result } = handleUpdateTask(initial, {
        ...parentTask,
        dependencies: [taskWithDep.id],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cyclic dependency detected');
      expect(nextState).toBe(initial);
    });

    it('handleCompleteTask blocks task if prerequisites are incomplete', () => {
      const initial = getInitialState();
      const taskWithDep = initial.tasks.find((t: Task) => t.dependencies.length > 0)!;
      const parentId = taskWithDep.dependencies[0];
      const stateWithPendingDep: AppState = {
        ...initial,
        tasks: initial.tasks.map((t: Task) =>
          t.id === parentId ? { ...t, status: 'not_started' as const } : t
        ),
      };

      const { nextState, result } = handleCompleteTask(stateWithPendingDep, taskWithDep.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Required prerequisite tasks are still incomplete');
      expect(nextState).toBe(stateWithPendingDep);
    });

    it('handleCompleteTask succeeds when prerequisites are fulfilled', () => {
      const initial = getInitialState();
      const taskWithDep = initial.tasks.find((t: Task) => t.dependencies.length > 0)!;
      const stateWithCompletedDeps: AppState = {
        ...initial,
        tasks: initial.tasks.map((t: Task) =>
          taskWithDep.dependencies.includes(t.id) ? { ...t, status: 'completed' as const } : t
        ),
      };

      const { nextState, result } = handleCompleteTask(stateWithCompletedDeps, taskWithDep.id);
      expect(result.success).toBe(true);
      const completed = nextState.tasks.find((t: Task) => t.id === taskWithDep.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.completedAt).toBeDefined();
    });

    it('handleDeleteTask removes task and cleans up dependent task dependency arrays', () => {
      const initial = getInitialState();
      const taskWithDep = initial.tasks.find((t: Task) => t.dependencies.length > 0)!;
      const parentId = taskWithDep.dependencies[0];

      const updated = handleDeleteTask(initial, parentId);
      expect(updated.tasks.some((t: Task) => t.id === parentId)).toBe(false);
      const child = updated.tasks.find((t: Task) => t.id === taskWithDep.id);
      expect(child?.dependencies).not.toContain(parentId);
    });
  });

  describe('Vendor Slice', () => {
    it('handleAddVendor adds vendor and updates audit log', () => {
      const initial = getInitialState();
      const updated = handleAddVendor(initial, {
        categoryId: initial.categories[0].id,
        name: 'Jaipur Royal Palanquin Services',
        contactName: 'Mr. Singh',
        phone: '+91 99887 76655',
        email: 'info@palanquin.example',
        notes: 'Specialized in ceremonial procession',
        isSample: false,
      });
      const ven = updated.vendors.find((v: Vendor) => v.name === 'Jaipur Royal Palanquin Services');
      expect(ven).toBeDefined();
      expect(ven?.id).toMatch(/^ven-/);
      expect(updated.changeLog[0].description).toContain('Jaipur Royal Palanquin Services');
    });

    it('handleUpdateVendor modifies vendor details and logs change', () => {
      const initial = getInitialState();
      const ven = initial.vendors[0];
      const updated = handleUpdateVendor(initial, {
        ...ven,
        phone: '+91 11223 34455',
      });
      expect(updated.vendors.find((v: Vendor) => v.id === ven.id)?.phone).toBe('+91 11223 34455');
      expect(updated.changeLog[0].description).toContain(ven.name);
    });

    it('handleDeleteVendor removes vendor and associated quotes', () => {
      const initial = getInitialState();
      const ven = initial.vendors[0];
      const updated = handleDeleteVendor(initial, ven.id);
      expect(updated.vendors.some((v: Vendor) => v.id === ven.id)).toBe(false);
      expect(updated.quotes.some((q) => q.vendorId === ven.id)).toBe(false);
    });

    it('handleAddQuote and handleUpdateQuote manage quotations', () => {
      const initial = getInitialState();
      const ven = initial.vendors[0];
      const quoteAdded = handleAddQuote(initial, {
        vendorId: ven.id,
        quoteDate: '2026-10-24',
        quotedAmount: 4500000,
        currency: 'INR',
        status: 'under_review',
        includedServices: ['Stage lighting'],
        exclusions: ['Sound setup'],
        paymentTerms: '50% advance',
        isSample: false,
      });
      expect(quoteAdded.quotes.length).toBe(initial.quotes.length + 1);

      const newQuote = quoteAdded.quotes[quoteAdded.quotes.length - 1];
      const quoteUpdated = handleUpdateQuote(quoteAdded, {
        ...newQuote,
        quotedAmount: 4200000,
      });
      expect(quoteUpdated.quotes.find((q) => q.id === newQuote.id)?.quotedAmount).toBe(4200000);
    });

    it('handleSelectQuote selects quote, rejects other quotes in category, and creates confirmed expense', () => {
      const initial = getInitialState();
      const quote = initial.quotes[0];
      const updated = handleSelectQuote(initial, quote.id);
      const selected = updated.quotes.find((q) => q.id === quote.id);
      expect(selected?.status).toBe('selected');
      const syncedExp = updated.expenses.find((e) => e.quoteId === quote.id);
      expect(syncedExp).toBeDefined();
      expect(syncedExp?.status).toBe('confirmed');
      expect(syncedExp?.amount).toBe(quote.quotedAmount);
    });

    it('handleRecordVendorInquiry logs RFC-6068 email client dispatch', () => {
      const initial = getInitialState();
      const ven = initial.vendors[0];
      const quote = initial.quotes[0];
      const updated = handleRecordVendorInquiry(initial, quote.id, ven.id, 'email_client');
      expect(updated.changeLog[0].changeType).toBe('vendor');
      expect(updated.changeLog[0].description).toContain('external email client (RFC-6068)');
      expect(updated.changeLog[0].deltaSummary).toContain(quote.id);
    });

    it('handleRecordVendorInquiry logs clipboard handoff fallback', () => {
      const initial = getInitialState();
      const ven = initial.vendors[0];
      const quote = initial.quotes[0];
      const updated = handleRecordVendorInquiry(initial, quote.id, ven.id, 'clipboard_handoff');
      expect(updated.changeLog[0].description).toContain('clipboard draft handoff');
    });
  });

  describe('Scenario Slice', () => {
    it('handleCreateScenario creates new decision scenario and logs change', () => {
      const initial = getInitialState();
      const updated = handleCreateScenario(initial, {
        name: 'Boutique Courtyard Option',
        description: 'Downsizing to 120 guests with ultra-premium dining',
        modifiedGuestCount: 120,
        categoryAllocations: { [initial.categories[0].id]: 3000000 },
        notes: 'Trade-off analysis',
        isBaseline: false,
      });
      const scen = updated.scenarios.find((s) => s.name === 'Boutique Courtyard Option');
      expect(scen).toBeDefined();
      expect(scen?.id).toMatch(/^scen-/);
      expect(updated.changeLog[0].description).toContain('Boutique Courtyard Option');
    });

    it('handleApplyScenarioToBaseline updates category allocations and guest count', () => {
      const initial = getInitialState();
      const scen = initial.scenarios[0];
      const updated = handleApplyScenarioToBaseline(initial, scen.id);
      expect(updated.event.guestCount).toBe(scen.modifiedGuestCount);
      expect(updated.changeLog[0].description).toContain(scen.name);
    });

    it('handleDeleteScenario removes scenario and logs change', () => {
      const initial = getInitialState();
      const scen = initial.scenarios[0];
      const updated = handleDeleteScenario(initial, scen.id);
      expect(updated.scenarios.some((s) => s.id === scen.id)).toBe(false);
      expect(updated.changeLog[0].description).toContain(scen.name);
    });
  });

  describe('Assistant Slice', () => {
    it('handleSendAssistantMessage appends user query and generated response', () => {
      const initial = getInitialState();
      const updated = handleSendAssistantMessage(initial, 'How can I save budget?');
      expect(updated.messages.length).toBe(initial.messages.length + 2);
      expect(updated.messages[updated.messages.length - 2].role).toBe('user');
      expect(updated.messages[updated.messages.length - 1].role).toBe('assistant');
    });

    it('handleApplyProposedAction applies guest count adjustment', () => {
      const initial = getInitialState();
      const mockMsgId = 'msg-1';
      const action = {
        id: 'act-1',
        type: 'adjust_guest_count' as const,
        summary: 'Reduce guest count from 250 to 200',
        payload: { guestCount: 200 },
        impact: {
          currentEstimatedTotal: 5000000,
          proposedEstimatedTotal: 4000000,
          difference: -1000000,
          remainingBudget: 1000000,
          affectedCategories: [],
          budgetViolations: [],
        },
      };
      const stateWithMsg: AppState = {
        ...initial,
        messages: [
          {
            id: mockMsgId,
            timestamp: new Date().toISOString(),
            role: 'assistant' as const,
            content: '...',
            actionStatus: 'pending' as const,
            proposedAction: action,
          },
        ],
      };
      const updated = handleApplyProposedAction(stateWithMsg, mockMsgId, action);
      expect(updated.event.guestCount).toBe(200);
      expect(updated.messages.find((m) => m.id === mockMsgId)?.actionStatus).toBe('applied');
    });

    it('handleDismissProposedAction marks proposal as rejected', () => {
      const initial = getInitialState();
      const mockMsgId = 'msg-dismiss';
      const stateWithMsg: AppState = {
        ...initial,
        messages: [
          {
            id: mockMsgId,
            timestamp: new Date().toISOString(),
            role: 'assistant' as const,
            content: '...',
            actionStatus: 'pending' as const,
          },
        ],
      };
      const updated = handleDismissProposedAction(stateWithMsg, mockMsgId);
      expect(updated.messages.find((m) => m.id === mockMsgId)?.actionStatus).toBe('rejected');
    });
  });
});
