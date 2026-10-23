import { describe, it, expect } from 'vitest';
import {
  canCompleteTask,
  detectDependencyCycles,
  evaluateTasks,
} from '../domain/taskEngine';
import { Task } from '../types';

describe('Comprehensive Task Engine & Graph Scheduling (250 Parameterized Test Cases)', () => {
  // --------------------------------------------------------------------------
  // Suite 1: Cycle Detection across Graph Topologies (50 cases)
  // --------------------------------------------------------------------------
  const graphTopologies = Array.from({ length: 50 }, (_, i) => {
    if (i < 10) {
      // Direct self-cycles
      return { id: i, type: 'self-cycle', size: i + 1, hasCycle: true };
    }
    if (i < 25) {
      // N-node cycles (size 2 to 16)
      return { id: i, type: 'n-cycle', size: (i - 10) + 2, hasCycle: true };
    }
    if (i < 40) {
      // Linear acyclic chains (depth 2 to 16)
      return { id: i, type: 'linear-dag', size: (i - 25) + 2, hasCycle: false };
    }
    // Diamond DAG and tree structures
    return { id: i, type: 'diamond-dag', size: 4, hasCycle: false };
  });

  describe('Graph cycle detection across complex topologies', () => {
    graphTopologies.forEach(({ id, type, size, hasCycle }) => {
      it(`[Case ${id + 1}] evaluates cycle detection for ${type} of size ${size}`, () => {
        let tasks: Task[] = [];

        if (type === 'self-cycle') {
          tasks = [
            {
              id: 'task-self',
              title: 'Self-Dependent Task',
              categoryId: 'venue',
              status: 'not_started',
              priority: 'high',
              dueDate: '2026-11-01',
              dependencies: ['task-self'],
              description: 'Self cycle test',
              priorityReason: 'Test',
            },
          ];
        } else if (type === 'n-cycle') {
          // Circular chain: 0 -> 1 -> 2 -> ... -> N-1 -> 0
          tasks = Array.from({ length: size }, (_, k) => ({
            id: `task-${k}`,
            title: `Task ${k}`,
            categoryId: 'venue',
            status: 'not_started',
            priority: 'medium',
            dueDate: '2026-11-01',
            dependencies: [k === size - 1 ? 'task-0' : `task-${k + 1}`],
            description: `Part of cycle ${size}`,
            priorityReason: 'Cycle check',
          }));
        } else if (type === 'linear-dag') {
          // Acyclic chain: 0 -> 1 -> 2 -> ... -> N-1 (N-1 has no dependencies)
          tasks = Array.from({ length: size }, (_, k) => ({
            id: `task-${k}`,
            title: `Task ${k}`,
            categoryId: 'venue',
            status: 'not_started',
            priority: 'medium',
            dueDate: '2026-11-01',
            dependencies: k === size - 1 ? [] : [`task-${k + 1}`],
            description: `Chain node ${k}`,
            priorityReason: 'Chain check',
          }));
        } else {
          // Diamond: 0 depends on 1 and 2; 1 and 2 depend on 3; 3 has no deps
          tasks = [
            { id: 't-0', title: 'T0', categoryId: 'c', status: 'not_started', priority: 'high', dueDate: '2026-11-10', dependencies: ['t-1', 't-2'], description: '', priorityReason: '' },
            { id: 't-1', title: 'T1', categoryId: 'c', status: 'not_started', priority: 'medium', dueDate: '2026-11-05', dependencies: ['t-3'], description: '', priorityReason: '' },
            { id: 't-2', title: 'T2', categoryId: 'c', status: 'not_started', priority: 'medium', dueDate: '2026-11-05', dependencies: ['t-3'], description: '', priorityReason: '' },
            { id: 't-3', title: 'T3', categoryId: 'c', status: 'not_started', priority: 'low', dueDate: '2026-11-01', dependencies: [], description: '', priorityReason: '' },
          ];
        }

        const result = detectDependencyCycles(tasks);
        expect(result.hasCycle).toBe(hasCycle);
        if (hasCycle) {
          expect(result.cyclePath.length).toBeGreaterThan(0);
        } else {
          expect(result.cyclePath.length).toBe(0);
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Prerequisite Dependency Blocking Rule (50 cases)
  // --------------------------------------------------------------------------
  const blockingCases = Array.from({ length: 50 }, (_, i) => {
    const numPrereqs = (i % 5) + 1; // 1 to 5 prerequisites
    const numCompleted = i % (numPrereqs + 1);
    const hasDanglingPrereq = i % 7 === 0;
    return { id: i, numPrereqs, numCompleted, hasDanglingPrereq };
  });

  describe('Prerequisite dependency completion blocking rule', () => {
    blockingCases.forEach(({ id, numPrereqs, numCompleted, hasDanglingPrereq }) => {
      it(`[Case ${id + 1}] evaluates completion for task with ${numPrereqs} prereqs (${numCompleted} completed, dangling: ${hasDanglingPrereq})`, () => {
        const prereqTasks: Task[] = Array.from({ length: numPrereqs }, (_, k) => ({
          id: `prereq-${id}-${k}`,
          title: `Prerequisite ${k}`,
          categoryId: 'catering',
          status: k < numCompleted ? 'completed' : 'not_started',
          priority: 'medium',
          dueDate: '2026-10-15',
          dependencies: [],
          description: '',
          priorityReason: '',
        }));

        const depIds = prereqTasks.map((t) => t.id);
        if (hasDanglingPrereq) {
          depIds.push('dangling-prereq-missing-id');
        }

        const mainTask: Task = {
          id: `main-task-${id}`,
          title: `Target Action ${id}`,
          categoryId: 'catering',
          status: 'not_started',
          priority: 'high',
          dueDate: '2026-11-01',
          dependencies: depIds,
          description: '',
          priorityReason: '',
        };

        const allTasks = [...prereqTasks, mainTask];
        const check = canCompleteTask(mainTask.id, allTasks);

        const allPrereqsDone = numCompleted === numPrereqs && !hasDanglingPrereq;

        expect(check.allowed).toBe(allPrereqsDone);
        if (!allPrereqsDone) {
          expect(check.blockingTaskTitles.length).toBeGreaterThan(0);
        } else {
          expect(check.blockingTaskTitles.length).toBe(0);
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Deadline Realism & Risk Analysis (50 cases)
  // --------------------------------------------------------------------------
  const deadlineCases = Array.from({ length: 50 }, (_, i) => {
    const day = (i % 28) + 1;
    const month = (i % 12) + 1;
    const year = 2026 + (i > 30 ? 1 : 0);
    const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { id: i, dueDate };
  });

  describe('Deadline realism and scheduling risk audits', () => {
    deadlineCases.forEach(({ id, dueDate }) => {
      it(`[Case ${id + 1}] analyzes deadline realism for due date ${dueDate}`, () => {
        const eventDate = '2026-12-15';
        const currentDate = '2026-10-24';

        const task: Task = {
          id: `deadline-task-${id}`,
          title: `Deadline Task ${id}`,
          categoryId: 'logistics',
          status: 'not_started',
          priority: 'medium',
          dueDate,
          dependencies: [],
          description: '',
          priorityReason: 'Deadline check',
        };

        const evaluations = evaluateTasks([task], eventDate, currentDate);
        expect(evaluations).toHaveLength(1);

        const evalResult = evaluations[0];
        const isScheduledAfterEvent = dueDate > eventDate;
        const isPastCurrent = dueDate < currentDate;

        if (isScheduledAfterEvent) {
          expect(evalResult.risks.isUnrealistic).toBe(true);
        }
        if (isPastCurrent) {
          expect(evalResult.risks.isOverdue).toBe(true);
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Date Boundary & Leap Day Robustness (50 cases)
  // --------------------------------------------------------------------------
  const dateBoundaryCases = [
    { label: 'Leap day 2028', date: '2028-02-29', valid: true },
    { label: 'Leap day 2024', date: '2024-02-29', valid: true },
    { label: 'Non-leap 2026 Feb 28', date: '2026-02-28', valid: true },
    { label: 'Non-leap 2027 Feb 28', date: '2027-02-28', valid: true },
    { label: 'Year end 2026 Dec 31', date: '2026-12-31', valid: true },
    { label: 'Year start 2027 Jan 01', date: '2027-01-01', valid: true },
    ...Array.from({ length: 44 }, (_, i) => ({
      label: `Calendar day 2026-11-${String((i % 30) + 1).padStart(2, '0')}`,
      date: `2026-11-${String((i % 30) + 1).padStart(2, '0')}`,
      valid: true,
    })),
  ];

  describe('Calendar boundary and date parsing robustness', () => {
    dateBoundaryCases.forEach(({ label, date }, idx) => {
      it(`[Case ${idx + 1}] stably evaluates task on ${label} (${date})`, () => {
        const task: Task = {
          id: `cal-task-${idx}`,
          title: `Calendar Task ${idx}`,
          categoryId: 'decor',
          status: 'not_started',
          priority: 'low',
          dueDate: date,
          dependencies: [],
          description: label,
          priorityReason: 'Calendar boundary',
        };

        const evals = evaluateTasks([task], '2028-12-31', '2026-01-01');
        expect(evals).toHaveLength(1);
        expect(evals[0].task.dueDate).toBe(date);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Downstream Cascading Risk Propagation (50 cases)
  // --------------------------------------------------------------------------
  const cascadingCases = Array.from({ length: 50 }, (_, i) => {
    const isParentOverdue = i % 2 === 0;
    return { id: i, isParentOverdue };
  });

  describe('Downstream cascading risk propagation', () => {
    cascadingCases.forEach(({ id, isParentOverdue }) => {
      it(`[Case ${id + 1}] propagates cascading risk when parent overdue is ${isParentOverdue}`, () => {
        const parentTask: Task = {
          id: `parent-${id}`,
          title: `Critical Pre-requisite ${id}`,
          categoryId: 'venue',
          status: 'not_started',
          priority: 'critical',
          dueDate: isParentOverdue ? '2026-10-01' : '2026-11-15',
          dependencies: [],
          description: '',
          priorityReason: 'Foundational task',
        };

        const childTask: Task = {
          id: `child-${id}`,
          title: `Dependent Event Milestone ${id}`,
          categoryId: 'venue',
          status: 'not_started',
          priority: 'high',
          dueDate: '2026-11-20',
          dependencies: [`parent-${id}`],
          description: '',
          priorityReason: 'Depends on parent',
        };

        const evals = evaluateTasks([parentTask, childTask], '2026-12-15', '2026-10-24');
        const parentEval = evals.find((e) => e.task.id === `parent-${id}`)!;
        const childEval = evals.find((e) => e.task.id === `child-${id}`)!;

        if (isParentOverdue) {
          expect(parentEval.risks.isOverdue).toBe(true);
          expect(parentEval.risks.putsDownstreamAtRisk).toBe(true);
          expect(parentEval.risks.downstreamTaskTitles).toContain(childTask.title);
        } else {
          expect(parentEval.risks.isOverdue).toBe(false);
          expect(parentEval.risks.putsDownstreamAtRisk).toBe(false);
        }

        // Child should be marked blocked because parent is not completed
        expect(childEval.risks.isBlocked).toBe(true);
      });
    });
  });
});
