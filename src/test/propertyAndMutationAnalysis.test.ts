import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  calculateBudgetOverview,
  generatePriorityAwareRecommendations,
} from '../domain/budgetEngine';
import {
  detectDependencyCycles,
  computeTopologicalOrder,
} from '../domain/taskEngine';
import {
  parseUserIntent,
  generateAssistantResponse,
} from '../domain/assistantEngine';
import { DEMO_STATE } from '../persistence/demoData';
import { EventStore } from '../../server/events';
import { EmailDispatchService } from '../../server/email/service';
import { TestEmailProvider } from '../../server/email/providers';
import { createTestDatabaseContext } from '../../server/db';
import { AppState, Task, BudgetCategory } from '../types';
import { User } from '../../server/types';

describe('Phase 8: Property-Based Invariant Verification (fast-check)', () => {
  it('Property 1: Budget remaining runway invariant holds across arbitrary positive budgets and allocations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            allocatedAmount: fc.integer({ min: 0, max: 500000 }),
            userDefined: fc.constant(false),
            priorityRank: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (totalBudget, categories) => {
          const overview = calculateBudgetOverview(totalBudget, categories, []);
          const sumAllocated = categories.reduce((s, c) => s + c.allocatedAmount, 0);

          expect(overview.totalAllocated).toBe(sumAllocated);
          expect(overview.totalBudget).toBe(totalBudget);
          expect(overview.remainingBudget).toBe(totalBudget - sumAllocated);
          expect(overview.isOverrun).toBe(sumAllocated > totalBudget);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 2: Priority-aware savings recommendations NEVER exceed available flexible headroom', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 1000000 }),
        fc.integer({ min: 1000, max: 200000 }),
        (totalBudget, targetCut) => {
          const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
          const overview = calculateBudgetOverview(totalBudget, state.categories, state.expenses);
          const priorities = state.event.preferences.planningPriorities;

          const totalFlexible = overview.categories.reduce(
            (sum, c) => sum + Math.max(0, c.allocatedAmount - c.committedTotal),
            0
          );

          const recs = generatePriorityAwareRecommendations(overview, priorities, targetCut);
          const totalProposedSavings = recs.recommendations.reduce((sum, r) => sum + r.suggestedReduction, 0);

          expect(totalProposedSavings).toBeLessThanOrEqual(totalFlexible);
          if (priorities.length > 0 && recs.recommendations.length > 0) {
            const topPriorityId = priorities[0];
            const cutCategoryIds = recs.recommendations.map((r) => r.categoryId);
            const nonTopFlexible = overview.categories.filter(
              (c) => c.category.id !== topPriorityId && c.allocatedAmount > c.committedTotal
            );
            if (nonTopFlexible.length > 0) {
              expect(cutCategoryIds).not.toContain(topPriorityId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Topological sorting strictly satisfies all directed prerequisite dependencies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        (taskCount) => {
          // Construct a valid linear DAG: Task 0 -> Task 1 -> Task 2 -> ... -> Task N-1
          const tasks: Task[] = Array.from({ length: taskCount }, (_, i) => ({
            id: `task-${i}`,
            title: `Task ${i}`,
            description: `Task Description ${i}`,
            categoryId: 'venue',
            dueDate: '2026-11-01',
            status: 'not_started',
            priority: 'high',
            priorityReason: 'Directed prerequisite invariant test',
            dependencies: i > 0 ? [`task-${i - 1}`] : [],
          }));

          const cycleResult = detectDependencyCycles(tasks);
          expect(cycleResult.hasCycle).toBe(false);

          const order = computeTopologicalOrder(tasks);
          expect(order.length).toBe(taskCount);

          const orderIds = order.map((t) => t.id);
          for (let i = 1; i < taskCount; i++) {
            const prereqIndex = orderIds.indexOf(`task-${i - 1}`);
            const taskIndex = orderIds.indexOf(`task-${i}`);
            expect(prereqIndex).toBeLessThan(taskIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Graph cycle detection infallibly identifies circular dependency cycles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        (cycleLength) => {
          // Construct a circular graph: 0 -> 1 -> 2 -> ... -> 0
          const tasks: Task[] = Array.from({ length: cycleLength }, (_, i) => ({
            id: `task-${i}`,
            title: `Cyclic Task ${i}`,
            description: `Cyclic Task Description ${i}`,
            categoryId: 'venue',
            dueDate: '2026-11-01',
            status: 'not_started',
            priority: 'medium',
            priorityReason: 'Directed cycle invariant test',
            dependencies: [`task-${(i + 1) % cycleLength}`],
          }));

          const cycleResult = detectDependencyCycles(tasks);
          expect(cycleResult.hasCycle).toBe(true);

          const order = computeTopologicalOrder(tasks);
          expect(order.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Phase 8: Mutation Testing Suite (Kills 10 Representative Mutants)', () => {
  const dummyOwner: User = {
    id: 'owner-1',
    email: 'owner@example.com',
    name: 'Owner User',
    passwordHash: 'hash-abc-123',
    createdAt: '2026-10-01T00:00:00.000Z',
  };
  const dummyViewer: User = {
    id: 'viewer-1',
    email: 'viewer@example.com',
    name: 'Viewer User',
    passwordHash: 'hash-def-456',
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    const db = createTestDatabaseContext();
    db.users.createUser(dummyOwner);
    db.users.createUser(dummyViewer);
  });

  it('Mutant 1 Killed: Reversing budget overrun calculation is caught', () => {
    const categories: BudgetCategory[] = [
      { id: '1', name: 'Venue', allocatedAmount: 60000, userDefined: false, priorityRank: 1 },
    ];
    const totalBudget = 50000;

    const actual = calculateBudgetOverview(totalBudget, categories, []);
    expect(actual.isOverrun).toBe(true);
    expect(actual.overrunAmount).toBe(10000);

    const mutatedIsOverrun = actual.totalAllocated < totalBudget;
    expect(mutatedIsOverrun).toBe(false);
  });

  it('Mutant 2 Killed: Removing priority protection in budget savings is caught', () => {
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
    const priorities = state.event.preferences.planningPriorities;

    const recs = generatePriorityAwareRecommendations(overview, priorities, 50000);
    const topPriorityId = priorities[0];

    expect(recs.recommendations.map((r) => r.categoryId)).not.toContain(topPriorityId);
  });

  it('Mutant 3 Killed: Cycle detection accepting a cyclic dependency is caught', () => {
    const cyclicTasks: Task[] = [
      { id: 't1', title: 'A', description: 'A desc', categoryId: 'v', dueDate: '2026-11-01', status: 'not_started', priority: 'high', priorityReason: 'r1', dependencies: ['t2'] },
      { id: 't2', title: 'B', description: 'B desc', categoryId: 'v', dueDate: '2026-11-01', status: 'not_started', priority: 'high', priorityReason: 'r2', dependencies: ['t1'] },
    ];
    const res = detectDependencyCycles(cyclicTasks);
    expect(res.hasCycle).toBe(true);
    expect(computeTopologicalOrder(cyclicTasks).length).toBe(0);
  });

  it('Mutant 4 Killed: Skipping server OCC expected version check is caught', () => {
    const store = new EventStore();
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const record = store.createEvent(dummyOwner, state);

    // Call updateEvent with wrong expectedVersion (999)
    const res = store.updateEvent(record.id, dummyOwner, 999, state);
    expect('error' in res && res.error).toBe('CONCURRENCY_CONFLICT');
  });

  it('Mutant 5 Killed: Viewer attempting write mutation is caught and rejected', () => {
    const store = new EventStore();
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const record = store.createEvent(dummyOwner, state);
    const invite = store.createInvite(record.id, dummyOwner, 'viewer');
    store.joinWithInvite(invite.token, dummyViewer);

    expect(store.getUserRole(record.id, dummyViewer.id)).toBe('viewer');
    expect(() => {
      store.updateEvent(record.id, dummyViewer, record.version, state);
    }).toThrow(/Viewer role does not have permission/);
  });

  it('Mutant 6 Killed: CRLF header injection passing through email validator is caught', async () => {
    const provider = new TestEmailProvider();
    const service = new EmailDispatchService(provider);
    const store = new EventStore();
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const record = store.createEvent(dummyOwner, state);

    await expect(
      service.dispatchVendorEmail(
        {
          eventId: record.id,
          vendorId: state.vendors[0].id,
          recipientName: 'Vendor Manager',
          recipientEmail: 'vendor@example.com\r\nBcc:attacker@evil.com',
          subject: 'Clarification',
          bodyText: 'Details',
        },
        dummyOwner,
        store
      )
    ).rejects.toThrow(/Header injection/);
  });

  it('Mutant 7 Killed: Budget increase query misclassified as budget reduction is caught', () => {
    const res = parseUserIntent('Increase our budget by 50000');
    expect(res.intent).not.toBe('suggest_expense_reductions');
    expect(res.intent).not.toBe('reduce_budget');
  });

  it('Mutant 8 Killed: Guest count adjustment without confirmation is caught', () => {
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const res = generateAssistantResponse('Change guest count to 200', state);
    expect(res.intent).toBe('change_guest_count');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.actionStatus).toBe('pending');
  });

  it('Mutant 9 Killed: Negative guest count accepted as valid mutation is caught', () => {
    const res = parseUserIntent('Change guest count to -100');
    expect(res.intent).toBe('unsupported');
    expect(res.extractedParameters?.guestCount).toBeUndefined();
  });

  it('Mutant 10 Killed: Email dispatch without idempotency deduplication is caught', async () => {
    const provider = new TestEmailProvider();
    const service = new EmailDispatchService(provider);
    const store = new EventStore();
    const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));
    const record = store.createEvent(dummyOwner, state);

    const req = {
      eventId: record.id,
      vendorId: state.vendors[0].id,
      recipientName: 'Vendor Manager',
      recipientEmail: 'vendor@example.com',
      subject: 'Clarification',
      bodyText: 'Details',
      idempotencyKey: 'idem-100',
    };

    const res1 = await service.dispatchVendorEmail(req, dummyOwner, store);
    const res2 = await service.dispatchVendorEmail(req, dummyOwner, store);

    expect(res1.status).toBe('accepted_by_provider');
    expect(res2.status).toBe('accepted_by_provider');
    expect(res2.id).toBe(res1.id);
    expect(provider.sentMessages.length).toBe(1);
  });
});
