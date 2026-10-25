import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { evaluateTasks } from '../../domain/taskEngine';
import { TaskPriority, TaskStatus } from '../../types';
import { Modal } from '../common/Modal';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';

export const TaskManagementView: React.FC = () => {
  const { state, addTask, updateTask, completeTask, deleteTask } = useEvent();
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

  const toggleDependency = (depId: string) => {
    if (newDependencies.includes(depId)) {
      setNewDependencies(newDependencies.filter((id) => id !== depId));
    } else {
      setNewDependencies([...newDependencies, depId]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header and Add Task */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading">
            Tasks & Dependency Graph
          </h1>
          <p className="text-xs text-[#78716C] mt-1">
            Deterministic scheduling with cycle detection and cascading risk analysis.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 rounded-md bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create New Task
        </button>
      </div>

      {/* Blocked Completion Alert (Modal / Toast) */}
      {blockedAlertMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs flex items-start justify-between gap-3 text-red-900">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-[#BE123C] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Dependency Rule Enforced:</span> {blockedAlertMessage}
            </div>
          </div>
          <button
            onClick={() => setBlockedAlertMessage(null)}
            className="text-red-700 hover:text-black font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E6DFD5] shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#5C554E] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filter Status:
          </span>
          {['all', 'not_started', 'in_progress', 'completed', 'blocked', 'overdue'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
                statusFilter === st
                  ? 'bg-[#FAF0EB] text-[#A2421D] font-bold border border-[#F3CEBE]'
                  : 'text-[#5C554E] hover:bg-[#F4EFEA]'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="task-category-filter" className="text-[#78716C]">
            Category:
          </label>
          <select
            id="task-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1 border border-[#D5CCC0] rounded-md text-xs bg-[#FAF8F5]"
          >
            <option value="all">All Categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List Cards */}
      <div className="space-y-3">
        {filteredEvaluations.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-[#E6DFD5] text-xs text-[#78716C]">
            No tasks match your selected filter criteria.
          </div>
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
                    ? 'border-neutral-300 bg-neutral-50/40'
                    : isOverdue
                    ? 'border-red-200'
                    : 'border-[#E6DFD5]'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {/* Left: Checkbox & Info */}
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task.id, task.status)}
                      aria-label={
                        isBlocked
                          ? `Task blocked: ${task.title}`
                          : isCompleted
                          ? `Reopen task: ${task.title}`
                          : `Complete task: ${task.title}`
                      }
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition border ${
                        isCompleted
                          ? 'bg-[#047857] border-[#047857] text-white'
                          : isBlocked
                          ? 'border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                          : 'border-[#D5CCC0] hover:border-[#A2421D] bg-white'
                      }`}
                      title={
                        isBlocked
                          ? `Cannot complete: Pending prerequisites (${evalItem.risks.missingPrerequisites.join(', ')})`
                          : isCompleted
                          ? 'Click to reopen task'
                          : 'Mark complete'
                      }
                    >
                      {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                      {isBlocked && !isCompleted && <Lock className="w-3 h-3 text-neutral-400" />}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isCompleted ? 'line-through text-[#78716C]' : 'text-[#1C1917]'
                          }`}
                        >
                          {task.title}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF8F5] text-[#78716C] border border-[#E6DFD5]">
                          {cat?.name || task.categoryId}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                            <Lock className="w-2.5 h-2.5" /> Blocked
                          </span>
                        )}

                        {isOverdue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-[#BE123C] border border-red-200">
                            Overdue
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-[#5C554E] leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Priority Rationale Explanation */}
                      <p className="text-[11px] text-[#78716C] italic">
                        <strong>Why {task.priority.toUpperCase()} priority:</strong> {evalItem.priorityRationale}
                      </p>

                      {/* Dependencies Badges */}
                      {task.dependencies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                          <span className="text-[11px] text-[#78716C] font-semibold">
                            Prerequisites:
                          </span>
                          {task.dependencies.map((depId) => {
                            const depTask = state.tasks.find((t) => t.id === depId);
                            const isDepDone = depTask?.status === 'completed';
                            return (
                              <span
                                key={depId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
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
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-900 flex items-center gap-1.5 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 text-[#BE123C] shrink-0" />
                          <span>
                            <strong>Unrealistic Schedule:</strong> {evalItem.risks.unrealisticReason}
                          </span>
                        </div>
                      )}

                      {evalItem.risks.putsDownstreamAtRisk && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                          <span>
                            <strong>Downstream Cascade Risk:</strong> Delays here jeopardize dependent tasks: {evalItem.risks.downstreamTaskTitles.join(', ')}.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Due Date & Delete Action */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-start">
                    <div className="text-right">
                      <span className="text-[11px] text-[#78716C] block">Target Deadline</span>
                      <span className="font-mono text-xs font-semibold text-[#1C1917]">
                        {task.dueDate}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete Task"
                      aria-label={`Delete task: ${task.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-900 text-xs">
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
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
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
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-task-category-select" className="block font-semibold text-[#1C1917] mb-1">Category</label>
              <select
                id="new-task-category-select"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-task-priority-select" className="block font-semibold text-[#1C1917] mb-1">Priority</label>
              <select
                id="new-task-priority-select"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="new-task-reason-input" className="block font-semibold text-[#1C1917] mb-1">
              Priority Rationale (Why this priority?)
            </label>
            <input
              id="new-task-reason-input"
              type="text"
              value={newPriorityReason}
              onChange={(e) => setNewPriorityReason(e.target.value)}
              placeholder="e.g. Contractual prerequisite for catering tasting"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label htmlFor="new-task-duedate-input" className="block font-semibold text-[#1C1917] mb-1">Target Due Date *</label>
            <input
              id="new-task-duedate-input"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          {/* Dependency Selector */}
          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Prerequisite Tasks (Must be completed before this task can finish)
            </label>
            <div className="max-h-36 overflow-y-auto border border-[#D5CCC0] rounded-md p-2 space-y-1 bg-[#FAF8F5]">
              {state.tasks.length === 0 ? (
                <p className="text-xs text-[#78716C]">No other tasks available.</p>
              ) : (
                state.tasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-[#EAE4DB]">
                    <input
                      type="checkbox"
                      checked={newDependencies.includes(t.id)}
                      onChange={() => toggleDependency(t.id)}
                      className="accent-[#A2421D]"
                    />
                    <span className="font-medium text-[#1C1917]">{t.title}</span>
                    <span className="text-[10px] text-[#78716C]">({t.status})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Create Task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
