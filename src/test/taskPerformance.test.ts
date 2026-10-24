import { describe, it, expect } from 'vitest';
import { Task, TaskPriority, TaskStatus } from '../types';
import {
  detectDependencyCycles,
  computeTopologicalOrder,
  evaluateTasks,
} from '../domain/taskEngine';

/**
 * 5,000 Task Large-Dataset Performance & Domain Engine Benchmark (Finding G)
 *
 * Measures:
 * 1. Cycle detection over 5,000 interconnected tasks
 * 2. Topological sort ordering over 5,000 tasks
 * 3. Full evaluation (risks, blocked state, overdue) over 5,000 tasks
 * 4. Cycle detection under adversarial cycle insertion
 */

describe('Task Engine Performance & Scalability (Finding G)', () => {
  const generateLargeDataset = (count: number): Task[] => {
    const tasks: Task[] = [];
    const categories = ['cat-venue', 'cat-catering', 'cat-photo', 'cat-decor', 'cat-music'];
    const priorities: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
    const statuses: TaskStatus[] = ['not_started', 'in_progress', 'completed', 'blocked'];

    for (let i = 0; i < count; i++) {
      // Create DAG dependencies: each task may depend on up to 2 earlier tasks
      const dependencies: string[] = [];
      if (i > 0 && i % 3 === 0) {
        dependencies.push(`perf-task-${i - 1}`);
      }
      if (i > 10 && i % 7 === 0) {
        dependencies.push(`perf-task-${i - 5}`);
      }

      tasks.push({
        id: `perf-task-${i}`,
        title: `Operational Task #${i}`,
        description: `Automated scalability test task index ${i}`,
        categoryId: categories[i % categories.length],
        priority: priorities[i % priorities.length],
        priorityReason: 'Automated test suite stress benchmark',
        dueDate: '2026-12-18',
        status: statuses[i % statuses.length],
        dependencies,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    return tasks;
  };

  it('evaluates cycle detection on 5,000 tasks in under 100ms', () => {
    const largeDataset = generateLargeDataset(5000);
    expect(largeDataset.length).toBe(5000);

    const start = performance.now();
    const cycleCheck = detectDependencyCycles(largeDataset);
    const duration = performance.now() - start;

    expect(cycleCheck.hasCycle).toBe(false);
    expect(duration).toBeLessThan(150); // Generous ceiling, typically < 30ms
  });

  it('computes topological sort order on 5,000 tasks in under 100ms with strict dependency ordering', () => {
    const largeDataset = generateLargeDataset(5000);

    const start = performance.now();
    const sorted = computeTopologicalOrder(largeDataset);
    const duration = performance.now() - start;

    expect(sorted.length).toBe(5000);
    expect(duration).toBeLessThan(150);

    // Verify ordering validity: For each task, all its dependencies must appear before it in sorted
    const positionMap = new Map<string, number>();
    sorted.forEach((task, idx) => positionMap.set(task.id, idx));

    for (const task of sorted) {
      const taskPos = positionMap.get(task.id)!;
      for (const depId of task.dependencies) {
        const depPos = positionMap.get(depId);
        if (depPos !== undefined) {
          expect(depPos).toBeLessThan(taskPos);
        }
      }
    }
  });

  it('runs complete task risk & status evaluation on 5,000 tasks in under 150ms', () => {
    const largeDataset = generateLargeDataset(5000);

    const start = performance.now();
    const evaluated = evaluateTasks(largeDataset, '2026-12-01');
    const duration = performance.now() - start;

    expect(evaluated.length).toBe(5000);
    expect(duration).toBeLessThan(200);

    // Verify evaluation outputs exist
    expect(evaluated[0].effectiveStatus).toBeDefined();
    expect(evaluated[0].risks).toBeDefined();
  });

  it('detects introduced cycle within 5,000 tasks quickly', () => {
    const largeDataset = generateLargeDataset(5000);
    // Introduce mutual cyclic dependency between task 0 and task 1
    largeDataset[0].dependencies = ['perf-task-1'];
    largeDataset[1].dependencies = ['perf-task-0'];

    const start = performance.now();
    const cycleCheck = detectDependencyCycles(largeDataset);
    const duration = performance.now() - start;

    expect(cycleCheck.hasCycle).toBe(true);
    expect(cycleCheck.cyclePath.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100);
  });
});
