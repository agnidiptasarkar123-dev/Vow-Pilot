import { Task, TaskStatus } from '../types';

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath: string[]; // Task IDs forming the cycle
}

export interface TaskRiskAnalysis {
  isOverdue: boolean;
  isUnrealistic: boolean;
  unrealisticReason?: string;
  isBlocked: boolean;
  missingPrerequisites: string[]; // Task IDs that must be completed first
  putsDownstreamAtRisk: boolean;
  downstreamTaskTitles: string[];
}

export interface TaskEvaluation {
  task: Task;
  effectiveStatus: TaskStatus;
  risks: TaskRiskAnalysis;
  priorityRationale: string;
}

/**
 * Checks if completing a task is valid under dependency rules.
 * Rule: A dependent task cannot be marked complete while its required dependencies remain incomplete.
 */
export function canCompleteTask(
  taskId: string,
  tasks: Task[]
): { allowed: boolean; blockingTaskTitles: string[] } {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const target = taskMap.get(taskId);
  if (!target) {
    return { allowed: false, blockingTaskTitles: ['Task not found'] };
  }

  const blockingTitles: string[] = [];
  for (const depId of target.dependencies) {
    if (depId === target.id) {
      blockingTitles.push('Self-dependency cycle detected');
      continue;
    }
    const dep = taskMap.get(depId);
    if (!dep) {
      blockingTitles.push(`Unresolved prerequisite (ID: ${depId})`);
    } else if (dep.status !== 'completed') {
      blockingTitles.push(dep.title);
    }
  }

  return {
    allowed: blockingTitles.length === 0,
    blockingTaskTitles: blockingTitles,
  };
}

/**
 * Detects cyclic dependencies using Depth First Search (DFS).
 * Returns hasCycle = true and the cycle path if a cycle exists.
 */
export function detectDependencyCycles(tasks: Task[]): CycleDetectionResult {
  // First check for direct self-cycles
  for (const t of tasks) {
    if (t.dependencies && t.dependencies.includes(t.id)) {
      return {
        hasCycle: true,
        cyclePath: [t.id, t.id],
      };
    }
  }

  const adjList = new Map<string, string[]>();
  for (const t of tasks) {
    adjList.set(t.id, t.dependencies || []);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const parentMap = new Map<string, string>();

  let cycleFound: string[] | null = null;

  function dfs(current: string): boolean {
    visited.add(current);
    recStack.add(current);

    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        parentMap.set(neighbor, current);
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        // Cycle detected: reconstruct path
        const path = [neighbor, current];
        let curr = current;
        while (curr !== neighbor && parentMap.has(curr)) {
          curr = parentMap.get(curr)!;
          path.push(curr);
        }
        cycleFound = path.reverse();
        return true;
      }
    }

    recStack.delete(current);
    return false;
  }

  for (const t of tasks) {
    if (!visited.has(t.id)) {
      if (dfs(t.id)) {
        return {
          hasCycle: true,
          cyclePath: cycleFound || [],
        };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

/**
 * Evaluates all tasks against deadlines, dependencies, and event date.
 * Performs deterministic risk analysis and priority reasoning.
 */
export function evaluateTasks(
  tasks: Task[],
  eventDate: string,
  currentDateIso: string = new Date().toISOString().split('T')[0]
): TaskEvaluation[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Build reverse map: prerequisiteId -> list of tasks that depend on it
  const downstreamMap = new Map<string, Task[]>();
  for (const t of tasks) {
    for (const depId of t.dependencies) {
      const list = downstreamMap.get(depId) || [];
      list.push(t);
      downstreamMap.set(depId, list);
    }
  }

  return tasks.map((task) => {
    const isCompleted = task.status === 'completed';

    // 1. Dependency check
    const missingPrerequisites: string[] = [];
    for (const depId of task.dependencies) {
      if (depId === task.id) {
        missingPrerequisites.push('Self-referencing dependency');
        continue;
      }
      const dep = taskMap.get(depId);
      if (!dep) {
        missingPrerequisites.push(`Unresolved prerequisite (ID: ${depId})`);
      } else if (dep.status !== 'completed') {
        missingPrerequisites.push(dep.title);
      }
    }

    const isBlocked = !isCompleted && missingPrerequisites.length > 0;
    const effectiveStatus: TaskStatus = isCompleted
      ? 'completed'
      : isBlocked
      ? 'blocked'
      : task.status === 'blocked' && !isBlocked
      ? 'not_started'
      : task.status;

    // 2. Overdue check
    const isOverdue = !isCompleted && task.dueDate < currentDateIso;

    // 3. Unrealistic check:
    // a) Due date after event date
    // b) Due date earlier than one of its prerequisite tasks
    let isUnrealistic = false;
    let unrealisticReason: string | undefined;

    if (task.dueDate > eventDate) {
      isUnrealistic = true;
      unrealisticReason = `Due date (${task.dueDate}) is scheduled after the event date (${eventDate}).`;
    } else {
      for (const depId of task.dependencies) {
        const dep = taskMap.get(depId);
        if (dep && task.dueDate < dep.dueDate) {
          isUnrealistic = true;
          unrealisticReason = `Scheduled earlier than prerequisite "${dep.title}" (${dep.dueDate} vs ${task.dueDate}).`;
          break;
        }
      }
    }

    // 4. Downstream risk check
    // If this task is overdue or delayed, check if it risks dependent tasks
    const downstream = downstreamMap.get(task.id) || [];
    let putsDownstreamAtRisk = false;
    const downstreamTaskTitles: string[] = [];

    if (!isCompleted && (isOverdue || isBlocked)) {
      for (const down of downstream) {
        if (down.status !== 'completed') {
          putsDownstreamAtRisk = true;
          downstreamTaskTitles.push(down.title);
        }
      }
    }

    // 5. Priority rationale explanation
    const priorityRationale = computePriorityRationale(
      task,
      downstream.length,
      isOverdue,
      isBlocked,
      task.dueDate,
      currentDateIso
    );

    return {
      task,
      effectiveStatus,
      risks: {
        isOverdue,
        isUnrealistic,
        unrealisticReason,
        isBlocked,
        missingPrerequisites,
        putsDownstreamAtRisk,
        downstreamTaskTitles,
      },
      priorityRationale,
    };
  });
}

function computePriorityRationale(
  task: Task,
  downstreamCount: number,
  isOverdue: boolean,
  isBlocked: boolean,
  dueDate: string,
  currentDate: string
): string {
  if (task.priorityReason) return task.priorityReason;

  if (isOverdue) {
    return 'Urgent: Deadline has passed. Requires immediate resolution.';
  }

  if (isBlocked) {
    return 'Blocked: Waiting for required prerequisite tasks to complete.';
  }

  if (downstreamCount > 0) {
    return `Blocks ${downstreamCount} downstream ${downstreamCount === 1 ? 'task' : 'tasks'}. High scheduling impact.`;
  }

  if (task.priority === 'critical') {
    return 'Critical path item: Crucial contractual or booking requirement.';
  }

  if (dueDate < currentDate) {
    return 'Past target completion date.';
  }

  return 'Standard operational priority.';
}

/**
 * Computes topological order of tasks (prerequisites appear before dependents).
 * If a cycle is present, returns an empty array.
 */
export function computeTopologicalOrder(tasks: Task[]): Task[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const taskMap = new Map<string, Task>();

  for (const t of tasks) {
    taskMap.set(t.id, t);
    inDegree.set(t.id, 0);
    adjList.set(t.id, []);
  }

  // Edge: dep -> t (dep must finish before t)
  for (const t of tasks) {
    for (const depId of t.dependencies) {
      if (taskMap.has(depId)) {
        adjList.get(depId)!.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
      }
    }
  }

  // Queue tasks with 0 dependencies
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const result: Task[] = [];
  let head = 0;
  while (head < queue.length) {
    const currId = queue[head++];
    const task = taskMap.get(currId);
    if (task) {
      result.push(task);
    }

    const dependents = adjList.get(currId) || [];
    for (const dep of dependents) {
      const newDeg = (inDegree.get(dep) || 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) {
        queue.push(dep);
      }
    }
  }

  return result.length === tasks.length ? result : [];
}
