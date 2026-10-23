import { describe, it, expect } from 'vitest';
import {
  canCompleteTask,
  detectDependencyCycles,
  evaluateTasks,
} from '../domain/taskEngine';
import { Task } from '../types';

describe('Task and Dependency Management Engine', () => {
  const baseTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Sign Venue Contract',
      description: 'Book venue',
      categoryId: 'venue',
      priority: 'critical',
      priorityReason: 'Base prerequisite for decorators',
      dueDate: '2026-10-10',
      status: 'completed',
      dependencies: [],
    },
    {
      id: 'task-2',
      title: 'Mandap Design Walkthrough',
      description: 'Decor planning',
      categoryId: 'decor',
      priority: 'high',
      priorityReason: 'Requires venue layout',
      dueDate: '2026-10-20',
      status: 'in_progress',
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      title: 'Lighting Rigging Confirmation',
      description: 'Electrician signoff',
      categoryId: 'decor',
      priority: 'medium',
      priorityReason: 'Depends on design walkthrough',
      dueDate: '2026-11-01',
      status: 'not_started',
      dependencies: ['task-2'],
    },
  ];

  it('prohibits completing a task when its required dependencies are incomplete', () => {
    // task-3 depends on task-2, which is still 'in_progress'
    const check = canCompleteTask('task-3', baseTasks);
    expect(check.allowed).toBe(false);
    expect(check.blockingTaskTitles).toContain('Mandap Design Walkthrough');
  });

  it('permits completing a task once all dependencies are completed', () => {
    const updatedTasks: Task[] = baseTasks.map((t) =>
      t.id === 'task-2' ? { ...t, status: 'completed' as const } : t
    );

    const check = canCompleteTask('task-3', updatedTasks);
    expect(check.allowed).toBe(true);
    expect(check.blockingTaskTitles.length).toBe(0);
  });

  it('detects direct and indirect circular dependencies', () => {
    const cyclicTasks: Task[] = [
      {
        id: 't-A',
        title: 'Task A',
        description: '',
        categoryId: 'decor',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-10-10',
        status: 'not_started',
        dependencies: ['t-B'],
      },
      {
        id: 't-B',
        title: 'Task B',
        description: '',
        categoryId: 'decor',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-10-12',
        status: 'not_started',
        dependencies: ['t-C'],
      },
      {
        id: 't-C',
        title: 'Task C',
        description: '',
        categoryId: 'decor',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-10-15',
        status: 'not_started',
        dependencies: ['t-A'], // Cycle: A -> B -> C -> A
      },
    ];

    const result = detectDependencyCycles(cyclicTasks);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath.length).toBeGreaterThan(0);
  });

  it('identifies overdue tasks and flags downstream risk', () => {
    const overdueTasks: Task[] = [
      {
        id: 'task-late',
        title: 'Catering Tasting',
        description: '',
        categoryId: 'catering',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-10-01', // Date in the past relative to 2026-10-23
        status: 'in_progress',
        dependencies: [],
      },
      {
        id: 'task-downstream',
        title: 'Catering Final Contract',
        description: '',
        categoryId: 'catering',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-10-28',
        status: 'not_started',
        dependencies: ['task-late'],
      },
    ];

    const evaluations = evaluateTasks(overdueTasks, '2026-12-18', '2026-10-23');
    const lateEval = evaluations.find((e) => e.task.id === 'task-late');

    expect(lateEval?.risks.isOverdue).toBe(true);
    expect(lateEval?.risks.putsDownstreamAtRisk).toBe(true);
    expect(lateEval?.risks.downstreamTaskTitles).toContain('Catering Final Contract');
  });

  it('detects unrealistic deadlines scheduled after event date or before prerequisite due date', () => {
    const unrealisticTasks: Task[] = [
      {
        id: 't-prep',
        title: 'Draft Menu',
        description: '',
        categoryId: 'catering',
        priority: 'medium',
        priorityReason: '',
        dueDate: '2026-11-10',
        status: 'not_started',
        dependencies: [],
      },
      {
        id: 't-backward',
        title: 'Approve Menu',
        description: '',
        categoryId: 'catering',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-11-05', // Due BEFORE prerequisite Draft Menu (11-10)
        status: 'not_started',
        dependencies: ['t-prep'],
      },
      {
        id: 't-post-event',
        title: 'Send Late Favors',
        description: '',
        categoryId: 'logistics',
        priority: 'low',
        priorityReason: '',
        dueDate: '2026-12-25', // Event date is 2026-12-18
        status: 'not_started',
        dependencies: [],
      },
    ];

    const evaluations = evaluateTasks(unrealisticTasks, '2026-12-18', '2026-10-23');

    const backwardEval = evaluations.find((e) => e.task.id === 't-backward');
    expect(backwardEval?.risks.isUnrealistic).toBe(true);
    expect(backwardEval?.risks.unrealisticReason).toContain('Scheduled earlier than prerequisite');

    const postEventEval = evaluations.find((e) => e.task.id === 't-post-event');
    expect(postEventEval?.risks.isUnrealistic).toBe(true);
    expect(postEventEval?.risks.unrealisticReason).toContain('after the event date');
  });
});
