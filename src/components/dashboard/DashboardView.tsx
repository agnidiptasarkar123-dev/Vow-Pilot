import React from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview } from '../../domain/budgetEngine';
import { evaluateTasks } from '../../domain/taskEngine';
import { formatCurrency } from '../../domain/currency';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  PieChart,
  Sliders,
  TrendingDown,
  Users,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { state, setActiveTab } = useEvent();
  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
  const evaluations = evaluateTasks(state.tasks, state.event.date);

  const completedTasks = evaluations.filter((e) => e.task.status === 'completed');
  const overdueTasks = evaluations.filter((e) => e.risks.isOverdue);
  const blockedTasks = evaluations.filter((e) => e.risks.isBlocked);
  const inProgressTasks = evaluations.filter((e) => e.effectiveStatus === 'in_progress');

  const pendingQuotes = state.quotes.filter((q) => q.status === 'under_review');
  const selectedQuotes = state.quotes.filter((q) => q.status === 'selected');

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Welcome & Health Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading">
              {state.event.name}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FAF0EB] text-[#A2421D] font-semibold border border-[#F3CEBE] uppercase">
              {state.event.eventType}
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            📍 {state.event.location} • 📅 {state.event.date} • 👥 {state.event.guestCount} Confirmed Guests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('simulator')}
            className="px-4 py-2 rounded-md bg-[#FAF0EB] hover:bg-[#F5E8E0] text-[#A2421D] text-xs font-semibold border border-[#F3CEBE] flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            Model Decision What-Ifs
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className="px-4 py-2 rounded-md bg-[#1C1917] hover:bg-[#33302B] text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask Coordinator
          </button>
        </div>
      </div>

      {/* Critical Attention Banners */}
      {(overdueTasks.length > 0 || overview.isOverrun || blockedTasks.length > 0) && (
        <div className="space-y-3">
          {overview.isOverrun && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs flex items-start justify-between gap-3 text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#BE123C] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Budget Overrun Detected:</span> Projected spend exceeds the total budget by{' '}
                  <span className="font-mono font-bold">
                    {formatCurrency(overview.overrunAmount, state.event.currency)}
                  </span>
                  . Review priority-aware trim suggestions in the Budget Planner or Simulator.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('budget')}
                className="font-bold underline text-[#A2421D] hover:text-[#863414] shrink-0"
              >
                Review Reductions
              </button>
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-start justify-between gap-3 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{overdueTasks.length} Milestone Deadlines Overdue:</span> Tasks like{' '}
                  <span className="font-semibold">"{overdueTasks[0].task.title}"</span> have passed target dates and risk downstream deliveries.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                className="font-bold underline text-[#B45309] hover:text-amber-950 shrink-0"
              >
                Inspect Tasks
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Projected Total Spend */}
        <div className="bg-white p-5 rounded-xl border border-[#E6DFD5] shadow-xs space-y-1">
          <span className="text-xs text-[#78716C] font-medium flex items-center justify-between">
            Projected Spend
            <PieChart className="w-4 h-4 text-[#78716C]" />
          </span>
          <div className="text-2xl font-bold font-mono text-[#1C1917]">
            {formatCurrency(overview.effectiveProjectedTotal, state.event.currency)}
          </div>
          <div className="text-xs text-[#5C554E] flex items-center justify-between pt-1">
            <span>Budget: {formatCurrency(overview.totalBudget, state.event.currency)}</span>
            <span className="font-semibold">{overview.utilizationPercentage}% used</span>
          </div>
          <div className="w-full bg-[#EAE4DB] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${
                overview.isOverrun ? 'bg-[#BE123C]' : 'bg-[#A2421D]'
              }`}
              style={{ width: `${Math.min(overview.utilizationPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Committed Actuals vs Runway */}
        <div className="bg-white p-5 rounded-xl border border-[#E6DFD5] shadow-xs space-y-1">
          <span className="text-xs text-[#78716C] font-medium flex items-center justify-between">
            Remaining Runway
            <TrendingDown className="w-4 h-4 text-[#047857]" />
          </span>
          <div
            className={`text-2xl font-bold font-mono ${
              overview.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'
            }`}
          >
            {formatCurrency(overview.remainingBudget, state.event.currency)}
          </div>
          <div className="text-xs text-[#5C554E] pt-1">
            Committed Actuals: {formatCurrency(overview.committedTotal, state.event.currency)}
          </div>
          <p className="text-[11px] text-[#78716C]">
            {overview.remainingBudget >= 0 ? 'Uncommitted contingency intact' : 'Action required to balance'}
          </p>
        </div>

        {/* Metric 3: Task & Dependency Health */}
        <div className="bg-white p-5 rounded-xl border border-[#E6DFD5] shadow-xs space-y-1">
          <span className="text-xs text-[#78716C] font-medium flex items-center justify-between">
            Milestones Progress
            <CheckCircle2 className="w-4 h-4 text-[#A2421D]" />
          </span>
          <div className="text-2xl font-bold text-[#1C1917]">
            {completedTasks.length} <span className="text-sm font-normal text-[#78716C]">/ {state.tasks.length} Done</span>
          </div>
          <div className="text-xs text-[#5C554E] flex items-center gap-2 pt-1">
            <span className="text-[#B45309] font-medium">{inProgressTasks.length} In Progress</span>
            <span>•</span>
            <span className="text-[#BE123C] font-medium">{blockedTasks.length} Blocked</span>
          </div>
          <p className="text-[11px] text-[#78716C]">
            {blockedTasks.length > 0 ? `${blockedTasks.length} await prerequisite completion` : 'No dependency deadlocks'}
          </p>
        </div>

        {/* Metric 4: Vendor Quotation Status */}
        <div className="bg-white p-5 rounded-xl border border-[#E6DFD5] shadow-xs space-y-1">
          <span className="text-xs text-[#78716C] font-medium flex items-center justify-between">
            Vendor Quotations
            <Users className="w-4 h-4 text-[#78716C]" />
          </span>
          <div className="text-2xl font-bold text-[#1C1917]">
            {selectedQuotes.length} <span className="text-sm font-normal text-[#78716C]">/ {state.vendors.length} Selected</span>
          </div>
          <div className="text-xs text-[#5C554E] pt-1 flex items-center justify-between">
            <span>{pendingQuotes.length} proposals under review</span>
          </div>
          <p className="text-[11px] text-[#78716C]">
            All demo suppliers flagged as fictional
          </p>
        </div>
      </div>

      {/* Main Split: Immediate Action Items vs Recent Planning Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Immediate Action Milestones (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
                  High-Priority Milestones
                </h3>
                <p className="text-xs text-[#78716C]">
                  Active tasks driving critical path deadlines.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1"
              >
                View Full Graph
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#F4EFEA]">
              {evaluations
                .filter((e) => e.task.status !== 'completed')
                .slice(0, 4)
                .map((evalItem) => {
                  const isBlocked = evalItem.risks.isBlocked;
                  const isOverdue = evalItem.risks.isOverdue;
                  return (
                    <div key={evalItem.task.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1C1917]">
                            {evalItem.task.title}
                          </span>
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                              <Lock className="w-2.5 h-2.5" />
                              Blocked
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-[#BE123C]">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#78716C] leading-snug">
                          {evalItem.priorityRationale}
                        </p>
                        {isBlocked && (
                          <p className="text-[11px] text-[#A2421D]">
                            Awaiting: {evalItem.risks.missingPrerequisites.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-[#5C554E] block">
                          Due {evalItem.task.dueDate}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            evalItem.task.priority === 'critical'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {evalItem.task.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Category Allocation Health Glance */}
          <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
                  Category Allocations & Commitments
                </h3>
                <p className="text-xs text-[#78716C]">
                  Committed expenses compared against baseline category budgets.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('budget')}
                className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1"
              >
                Open Budget Planner
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {overview.categories.map((catSummary) => {
                const pct = catSummary.allocatedAmount > 0
                  ? Math.round((catSummary.effectiveTotal / catSummary.allocatedAmount) * 100)
                  : 0;
                return (
                  <div key={catSummary.category.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1C1917]">
                        {catSummary.category.name}
                      </span>
                      <div className="font-mono text-xs flex items-center gap-2">
                        <span className="text-[#5C554E]">
                          {formatCurrency(catSummary.effectiveTotal, state.event.currency)}
                        </span>
                        <span className="text-[#78716C]">/</span>
                        <span className="text-[#78716C]">
                          {formatCurrency(catSummary.allocatedAmount, state.event.currency)}
                        </span>
                        <span className={`text-[10px] font-bold ${pct > 100 ? 'text-[#BE123C]' : 'text-[#5C554E]'}`}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#EAE4DB] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct > 100 ? 'bg-[#BE123C]' : 'bg-[#A2421D]'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Planning Changes & Simulator Promo */}
        <div className="space-y-6">
          {/* Decision Simulator Prompt */}
          <div className="bg-[#FAF0EB] p-6 rounded-xl border border-[#F3CEBE] space-y-3">
            <div className="flex items-center gap-2 text-[#A2421D] font-bold text-sm">
              <Sliders className="w-4 h-4" />
              <span>Simulate Planning Changes</span>
            </div>
            <p className="text-xs text-[#5C554E] leading-relaxed">
              Evaluating a higher guest count or shifting funds from decor to photography? Use the simulator to calculate the ripple effect on remaining runway and venue limits before altering your confirmed plan.
            </p>
            <button
              onClick={() => setActiveTab('simulator')}
              className="w-full py-2 bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold rounded-md transition shadow-xs"
            >
              Open Simulator Sandbox
            </button>
          </div>

          {/* Audit Log / Change Records */}
          <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
              Recent Planning Changes
            </h3>
            <div className="space-y-3">
              {state.changeLog.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs border-l-2 border-[#A2421D] pl-3 py-1 space-y-0.5">
                  <span className="text-[#78716C] text-[10px] block">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                  <p className="font-medium text-[#1C1917]">{log.description}</p>
                  {log.deltaSummary && (
                    <p className="text-[11px] text-[#5C554E]">{log.deltaSummary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
