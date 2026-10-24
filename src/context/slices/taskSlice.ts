import { AppState, Task } from '../../types';
import { canCompleteTask, detectDependencyCycles } from '../../domain/taskEngine';
import { createChangeRecord } from './recordChange';

export const handleAddTask = (
  state: AppState,
  taskData: Omit<Task, 'id'>
): { nextState: AppState; result: { success: boolean; error?: string } } => {
  const newTask: Task = {
    ...taskData,
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    updatedAt: new Date().toISOString(),
  };

  const candidateTasks = [...state.tasks, newTask];
  const cycleCheck = detectDependencyCycles(candidateTasks);
  if (cycleCheck.hasCycle) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `Cannot add task: Cyclic dependency detected (${cycleCheck.cyclePath.join(' ➔ ')})`,
      },
    };
  }

  const nextState: AppState = {
    ...state,
    tasks: candidateTasks,
    changeLog: [
      createChangeRecord('task', `Created task "${newTask.title}"`),
      ...state.changeLog,
    ],
  };

  return { nextState, result: { success: true } };
};

export const handleUpdateTask = (
  state: AppState,
  task: Task
): { nextState: AppState; result: { success: boolean; error?: string } } => {
  const candidateTasks = state.tasks.map((t) => (t.id === task.id ? task : t));
  const cycleCheck = detectDependencyCycles(candidateTasks);
  if (cycleCheck.hasCycle) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `Cannot update task: Cyclic dependency detected (${cycleCheck.cyclePath.join(' ➔ ')})`,
      },
    };
  }

  const nextState: AppState = {
    ...state,
    tasks: candidateTasks,
    changeLog: [
      createChangeRecord('task', `Updated task "${task.title}"`),
      ...state.changeLog,
    ],
  };

  return { nextState, result: { success: true } };
};

export const handleCompleteTask = (
  state: AppState,
  taskId: string
): { nextState: AppState; result: { success: boolean; error?: string } } => {
  const check = canCompleteTask(taskId, state.tasks);
  if (!check.allowed) {
    return {
      nextState: state,
      result: {
        success: false,
        error: `Cannot complete task: Required prerequisite tasks are still incomplete (${check.blockingTaskTitles.join(', ')})`,
      },
    };
  }

  const task = state.tasks.find((t) => t.id === taskId);
  const nextState: AppState = {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
        : t
    ),
    changeLog: [
      createChangeRecord('task', `Marked task completed: "${task?.title || taskId}"`),
      ...state.changeLog,
    ],
  };

  return { nextState, result: { success: true } };
};

export const handleDeleteTask = (state: AppState, taskId: string): AppState => {
  const task = state.tasks.find((t) => t.id === taskId);
  return {
    ...state,
    tasks: state.tasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({
        ...t,
        dependencies: t.dependencies.filter((d) => d !== taskId),
      })),
    changeLog: [
      createChangeRecord('task', `Deleted task "${task?.title || taskId}"`),
      ...state.changeLog,
    ],
  };
};
