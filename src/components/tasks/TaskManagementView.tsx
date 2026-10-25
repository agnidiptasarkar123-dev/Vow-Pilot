import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { evaluateTasks } from '../../domain/taskEngine';
import { TaskPriority, TaskStatus } from '../../types';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Filter,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';

export const TaskManagementView: React.FC = () => {
  const { state, addTask, updateTask, completeTask, deleteTask, isReadOnly } = useEvent();
  const evaluations = evaluateTasks(state.tasks, state.event.date);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [blockedAlertMessage, setBlockedAlertMessage] = useState<string | null>(null);

  // Add Task Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(state.categories[0]?.id || 'venue');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newPriorityReason, setNewPriorityReason] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDependencies, setNewDependencies] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    if (isReadOnly) return;
    setNewTitle('');
    setNewDescription('');
    setNewCategoryId(state.categories[0]?.id || 'venue');
    setNewPriority('medium');
    setNewPriorityReason('');
    setNewDueDate('');
    setNewDependencies([]);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateTask = () => {
    if (isReadOnly) return;
    if (!newTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!newDueDate) {
      setFormError('Due date is required.');
      return;
    }

    const result = addTask({
      title: newTitle.trim(),
      description: newDescription.trim(),
      categoryId: newCategoryId,
      priority: newPriority,
      priorityReason: newPriorityReason.trim() || 'Scheduled operational requirement',
      dueDate: newDueDate,
      status: 'not_started',
      dependencies: newDependencies,
    });

    if (!result.success) {
      setFormError(result.error || 'Failed to create task.');
    } else {
      setIsAddModalOpen(false);
    }
  };

  const handleToggleComplete = (taskId: string, currentStatus: TaskStatus) => {
    if (isReadOnly) return;
    if (currentStatus === 'completed') {
      // Reopen task
      const target = state.tasks.find((t) => t.id === taskId);
      if (target) {
        updateTask({ ...target, status: 'in_progress', completedAt: undefined });
      }
      return;
    }

    const result = completeTask(taskId);
    if (!result.success) {
      setBlockedAlertMessage(result.error || 'Cannot complete task.');
    }
  };

  const filteredEvaluations = evaluations.filter((item) => {
    if (statusFilter === 'overdue' && !item.risks.isOverdue) return false;
    if (statusFilter === 'blocked' && !item.risks.isBlocked) return false;
    if (statusFilter !== 'all' && statusFilter !== 'overdue' && item.effectiveStatus !== statusFilter) {
      return false;
    }
    if (categoryFilter !== 'all' && item.task.categoryId !== categoryFilter) {
      return false;
    }
    return true;
  });

  const completedCount = evaluations.filter((e) => e.task.status === 'completed').length;
  const overdueCount = evaluations.filter((e) => e.risks.isOverdue).length;
  const blockedCount = evaluations.filter((e) => e.risks.isBlocked).length;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Read-Only Viewer Alert Banner */}
      {isReadOnly && (
        <div
          data-testid="viewer-readonly-banner"
          className="p-3.5 rounded-xl bg-stone-100 border border-stone-300 flex items-center justify-between text-xs text-stone-700 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-stone-500 shrink-0" />
            <span>
              <strong>Viewer Permissions (Read-Only):</strong> You can review the milestone graph, prerequisites, and priority rationales. Creating, reordering, or toggling tasks is restricted to Editors and Owners.
            </span>
          </div>
        </div>
      )}

      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading tracking-tight">
            Tasks & Dependency Graph
          </h1>
          <p className="text-xs text-[#6E665E] mt-1">
            Topological ordering with cycle detection. Blocked milestones cannot be prematurely marked complete.
          </p>
        </div>

        {!isReadOnly ? (
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-lg bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Actionable Task</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-500 text-xs font-medium border border-stone-200">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only Mode</span>
          </div>
        )}
      </div>

      {/* Top Milestone Health Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] text-[#6E665E] font-medium uppercase tracking-wider">Total Milestones</span>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1917]">{state.tasks.length}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] text-[#6E665E] font-medium uppercase tracking-wider">Completed</span>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#047857]">{completedCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] text-[#6E665E] font-medium uppercase tracking-wider">Overdue</span>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight ${overdueCount > 0 ? 'text-[#BE123C]' : 'text-[#1C1917]'}`}>{overdueCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <span className="text-[11px] text-[#6E665E] font-medium uppercase tracking-wider">Blocked Prereqs</span>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight ${blockedCount > 0 ? 'text-[#B45309]' : 'text-[#1C1917]'}`}>{blockedCount}</p>
        </Card>
      </div>

      {/* Blocked Completion Alert (Modal / Toast) */}
      {blockedAlertMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs flex items-start justify-between gap-3 text-red-900 shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#BE123C] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Dependency Rule Enforced:</span> {blockedAlertMessage}
            </div>
          </div>
          <button
            onClick={() => setBlockedAlertMessage(null)}
            aria-label="Dismiss dependency rule alert"
            className="text-red-700 hover:text-black font-bold p-1 rounded focus-visible:outline-2 focus-visible:outline-[#A2421D] cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[#5C554E] flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-[#6E665E]" />
            Status:
          </span>
          {['all', 'not_started', 'in_progress', 'completed', 'blocked', 'overdue'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              aria-pressed={statusFilter === st}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#FAF0EB] text-[#A2421D] font-bold border border-[#F3CEBE] shadow-2xs'
                  : 'text-[#5C554E] hover:bg-[#F4EFEA]'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="task-category-filter" className="text-[#6E665E] font-medium">
            Category:
          </label>
          <select
            id="task-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#D5CCC0] rounded-lg text-xs bg-[#FAF8F5] focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
          >
            <option value="all">All Categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Task List Cards */}
      <div className="space-y-3">
        {filteredEvaluations.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks match criteria"
            description="Adjust your status or category filters, or add a new operational milestone."
            action={!isReadOnly ? {
              label: 'Add New Task',
              icon: Plus,
              onClick: handleOpenAddModal,
            } : undefined}
          />
        ) : (
          filteredEvaluations.map((evalItem) => {
            const task = evalItem.task;
            const isCompleted = task.status === 'completed';
            const isBlocked = evalItem.risks.isBlocked;
            const isOverdue = evalItem.risks.isOverdue;
            const isUnrealistic = evalItem.risks.isUnrealistic;
            const cat = state.categories.find((c) => c.id === task.categoryId);

            return (
              <div
                key={task.id}
                className={`p-5 rounded-xl border transition bg-white shadow-xs ${
                  isCompleted
                    ? 'border-[#E6DFD5] bg-[#FBF9F7]'
                    : isBlocked
                    ? 'border-neutral-300 bg-neutral-50/50'
                    : isOverdue
                    ? 'border-red-200'
                    : 'border-[#E6DFD5]'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {/* Left: Checkbox & Info */}
                  <div className="flex items-start gap-3 flex-1 w-full">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleToggleComplete(task.id, task.status)}
                      aria-label={
                        isReadOnly
                          ? `Read-only view: ${task.title}`
                          : isBlocked
                          ? `Task blocked: ${task.title}`
                          : isCompleted
                          ? `Reopen task: ${task.title}`
                          : `Complete task: ${task.title}`
                      }
                      className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition border shrink-0 cursor-pointer ${
                        isReadOnly
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                          : isCompleted
                          ? 'bg-[#047857] border-[#047857] text-white'
                          : isBlocked
                          ? 'border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                          : 'border-[#D5CCC0] hover:border-[#A2421D] bg-white'
                      }`}
                      title={
                        isReadOnly
                          ? 'Viewer permissions: read-only'
                          : isBlocked
                          ? `Cannot complete: Pending prerequisites (${evalItem.risks.missingPrerequisites.join(', ')})`
                          : isCompleted
                          ? 'Click to reopen task'
                          : 'Mark complete'
                      }
                    >
                      {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                      {isBlocked && !isCompleted && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm sm:text-base font-bold ${
                            isCompleted ? 'line-through text-[#6E665E]' : 'text-[#1C1917]'
                          }`}
                        >
                          {task.title}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF8F5] text-[#5C554E] border border-[#E6DFD5]">
                          {cat?.name || task.categoryId}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            task.priority === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : task.priority === 'high'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {task.priority}
                        </span>

                        {isBlocked && (
                          <Badge variant="neutral" size="sm" className="gap-1">
                            <Lock className="w-2.5 h-2.5" /> Blocked
                          </Badge>
                        )}

                        {isOverdue && (
                          <Badge variant="error" size="sm">
                            Overdue
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-[#5C554E] leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Priority Rationale Explanation */}
                      <p className="text-[11px] text-[#6E665E] italic">
                        <strong>Why {task.priority.toUpperCase()} priority:</strong> {evalItem.priorityRationale}
                      </p>

                      {/* Dependencies Badges */}
                      {task.dependencies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                          <span className="text-[11px] text-[#6E665E] font-semibold">
                            Prerequisites:
                          </span>
                          {task.dependencies.map((depId) => {
                            const depTask = state.tasks.find((t) => t.id === depId);
                            const isDepDone = depTask?.status === 'completed';
                            return (
                              <span
                                key={depId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                                  isDepDone
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
                                }`}
                              >
                                {isDepDone ? '✓' : '🔒'} {depTask?.title || depId}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Warnings: Cascading Downstream Risk or Unrealistic Deadline */}
                      {isUnrealistic && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-900 flex items-center gap-2 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 text-[#BE123C] shrink-0" />
                          <span>
                            <strong>Unrealistic Schedule:</strong> {evalItem.risks.unrealisticReason}
                          </span>
                        </div>
                      )}

                      {evalItem.risks.putsDownstreamAtRisk && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-2 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                          <span>
                            <strong>Downstream Cascade Risk:</strong> Delays here jeopardize dependent tasks: {evalItem.risks.downstreamTaskTitles.join(', ')}.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Due Date & Delete Action */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                    <div className="text-right">
                      <span className="text-[11px] text-[#6E665E] block">Target Deadline</span>
                      <span className="font-mono text-xs font-semibold text-[#1C1917]">
                        {task.dueDate}
                      </span>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete task "${task.title}"?`)) {
                            deleteTask(task.id);
                          }
                        }}
                        className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Delete Task"
                        aria-label={`Delete task: ${task.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Actionable Task"
        description="Establish explicit milestones with prerequisite dependencies and priority rationale."
      >
        <div className="space-y-4 text-xs">
          {formError && (
            <div id="new-task-form-error" role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="new-task-title-input" className="block font-semibold text-[#1C1917] mb-1">Task Title *</label>
            <input
              id="new-task-title-input"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Schedule Mandatory Lighting Electrical Walkthrough"
              aria-invalid={!!formError && !newTitle.trim()}
              aria-describedby={formError && !newTitle.trim() ? "new-task-form-error" : undefined}
              className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
            />
          </div>

          <div>
            <label htmlFor="new-task-description-input" className="block font-semibold text-[#1C1917] mb-1">Description (optional)</label>
            <textarea
              id="new-task-description-input"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Detailed instructions or specifications..."
              className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-task-category-select" className="block font-semibold text-[#1C1917] mb-1">Category</label>
              <select
                id="new-task-category-select"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-task-due-date-input" className="block font-semibold text-[#1C1917] mb-1">Due Date *</label>
              <input
                id="new-task-due-date-input"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-task-priority-select" className="block font-semibold text-[#1C1917] mb-1">Priority Level</label>
              <select
                id="new-task-priority-select"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
              >
                <option value="low">Low (Flexible timing)</option>
                <option value="medium">Medium (Standard milestone)</option>
                <option value="high">High (Urgent milestone)</option>
                <option value="critical">Critical (Blocks major path)</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-task-priority-reason-input" className="block font-semibold text-[#1C1917] mb-1">Priority Justification</label>
              <input
                id="new-task-priority-reason-input"
                type="text"
                value={newPriorityReason}
                onChange={(e) => setNewPriorityReason(e.target.value)}
                placeholder="Why is this prioritized this way?"
                className="w-full text-sm px-3.5 py-2 border border-[#D5CCC0] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#A2421D] bg-[#FAF8F5]"
              />
            </div>
          </div>

          {/* Dependencies / Prerequisites Multi-Select */}
          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Prerequisite Dependencies (Must be completed first)
            </label>
            <div className="max-h-36 overflow-y-auto border border-[#D5CCC0] rounded-lg p-2.5 space-y-1 bg-[#FAF8F5]">
              {state.tasks.map((existingTask) => {
                const isChecked = newDependencies.includes(existingTask.id);
                return (
                  <label key={existingTask.id} className="flex items-center gap-2 text-xs py-1 px-1.5 hover:bg-[#F4EFEA] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewDependencies([...newDependencies, existingTask.id]);
                        } else {
                          setNewDependencies(newDependencies.filter((id) => id !== existingTask.id));
                        }
                      }}
                      className="rounded border-[#D5CCC0] text-[#A2421D] focus:ring-[#A2421D]"
                    />
                    <span className="text-[#1C1917] font-medium">{existingTask.title}</span>
                    <span className="text-[10px] text-[#6E665E]">({existingTask.dueDate})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F4EFEA]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#D5CCC0] text-[#5C554E] hover:bg-[#F4EFEA] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateTask}
              className="px-4 py-2 rounded-lg bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-[0.98]"
            >
              Create Milestone Task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
