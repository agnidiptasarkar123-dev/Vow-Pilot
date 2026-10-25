import React from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview } from '../../domain/budgetEngine';
import { evaluateTasks } from '../../domain/taskEngine';
import { formatCurrency } from '../../domain/currency';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  PieChart,
  Sliders,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { state, setActiveTab, setCollabModalOpen, collabState } = useEvent();
  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
  const evaluations = evaluateTasks(state.tasks, state.event.date);

  const completedTasks = evaluations.filter((e) => e.task.status === 'completed');
  const overdueTasks = evaluations.filter((e) => e.risks.isOverdue);
  const blockedTasks = evaluations.filter((e) => e.risks.isBlocked);
  const inProgressTasks = evaluations.filter((e) => e.effectiveStatus === 'in_progress');

  const pendingQuotes = state.quotes.filter((q) => q.status === 'under_review');
  const selectedQuotes = state.quotes.filter((q) => q.status === 'selected');

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Top Welcome & Mission Header */}
      <Card padding="md" className="bg-white border-[#E6DFD5]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading tracking-tight">
                {state.event.name}
              </h1>
              <Badge variant="accent" size="sm" className="uppercase font-semibold">
                {state.event.eventType}
              </Badge>
            </div>
            <p className="text-xs text-[#6E665E] flex flex-wrap items-center gap-2 pt-0.5">
              <span>📍 {state.event.location}</span>
              <span>•</span>
              <span>📅 {state.event.date}</span>
              <span>•</span>
              <span>👥 {state.event.guestCount} Confirmed Guests</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('simulator')}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#FAF0EB] hover:bg-[#F5E8E0] text-[#A2421D] text-xs font-semibold border border-[#F3CEBE] flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-[0.98]"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Model Decision What-Ifs</span>
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#1C1917] hover:bg-[#33302B] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-[0.98]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask Coordinator</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Critical Attention Banners */}
      {(overdueTasks.length > 0 || overview.isOverrun || blockedTasks.length > 0) && (
        <div className="space-y-3">
          {overview.isOverrun && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs flex items-start justify-between gap-3 text-red-900 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
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
                className="font-bold underline text-[#A2421D] hover:text-[#863414] shrink-0 cursor-pointer"
              >
                Review Reductions
              </button>
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div
              role="alert"
              className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-start justify-between gap-3 text-amber-900 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{overdueTasks.length} Milestone Deadlines Overdue:</span> Tasks like{' '}
                  <span className="font-semibold">"{overdueTasks[0].task.title}"</span> have passed target dates and risk downstream deliveries.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                className="font-bold underline text-[#B45309] hover:text-amber-950 shrink-0 cursor-pointer"
              >
                Inspect Tasks
              </button>
            </div>
          )}
        </div>
      )}

      {/* Event Launchpad & Next Logical Steps (Information Architecture) */}
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#A2421D]" />
            <h2 className="text-sm sm:text-base font-bold text-[#1C1917] font-serif-heading">
              Planning Progression & Next Logical Actions
            </h2>
          </div>
          <span className="text-xs text-[#6E665E] hidden sm:inline">
            Actionable workflow guide
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1: Budget Cap */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E6DFD5] flex flex-col justify-between space-y-2.5 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C1917]">1. Budget Strategy</span>
                <Badge
                  variant={overview.isOverrun ? 'error' : 'success'}
                  size="sm"
                  showDot
                >
                  {overview.isOverrun ? 'Overrun' : 'On Track'}
                </Badge>
              </div>
              <p className="text-[11px] text-[#6E665E] leading-relaxed">
                {overview.isOverrun
                  ? `Deficit of ${formatCurrency(overview.overrunAmount, state.event.currency)}`
                  : `${formatCurrency(overview.remainingBudget, state.event.currency)} runway uncommitted`}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('budget')}
              className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              Review Budget <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 2: Milestone Schedule */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E6DFD5] flex flex-col justify-between space-y-2.5 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C1917]">2. Critical Path</span>
                <Badge
                  variant={overdueTasks.length > 0 ? 'warning' : 'neutral'}
                  size="sm"
                  showDot
                >
                  {overdueTasks.length > 0 ? `${overdueTasks.length} Overdue` : `${completedTasks.length}/${state.tasks.length} Done`}
                </Badge>
              </div>
              <p className="text-[11px] text-[#6E665E] leading-relaxed">
                {blockedTasks.length > 0
                  ? `${blockedTasks.length} tasks blocked by prerequisites`
                  : 'All prerequisite relationships satisfied'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              Inspect Tasks <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 3: Supplier Proposals */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E6DFD5] flex flex-col justify-between space-y-2.5 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C1917]">3. Vendor Quotes</span>
                <Badge
                  variant={selectedQuotes.length >= 3 ? 'success' : 'accent'}
                  size="sm"
                  showDot
                >
                  {selectedQuotes.length} Selected
                </Badge>
              </div>
              <p className="text-[11px] text-[#6E665E] leading-relaxed">
                {pendingQuotes.length} proposal inquiries pending evaluation
              </p>
            </div>
            <button
              onClick={() => setActiveTab('vendors')}
              className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              Compare Quotes <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 4: Co-Planner Sync */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E6DFD5] flex flex-col justify-between space-y-2.5 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C1917]">4. Collaboration</span>
                <Badge
                  variant={collabState.members.length > 0 ? 'success' : 'neutral'}
                  size="sm"
                  showDot
                >
                  {collabState.members.length > 0 ? 'Live Multi-User' : 'Local Mode'}
                </Badge>
              </div>
              <p className="text-[11px] text-[#6E665E] leading-relaxed">
                {collabState.members.length > 0
                  ? `${collabState.members.length} collaborators sharing event state`
                  : 'Invite planners, partners, and coordinators'}
              </p>
            </div>
            <button
              onClick={() => setCollabModalOpen(true)}
              className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              Manage Sharing <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Projected Total Spend */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6E665E] font-medium">
            <span>Projected Spend</span>
            <div className="w-7 h-7 rounded-lg bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-[#1C1917]">
            {formatCurrency(overview.effectiveProjectedTotal, state.event.currency)}
          </div>
          <div className="text-xs text-[#5C554E] flex items-center justify-between pt-0.5">
            <span>Budget: {formatCurrency(overview.totalBudget, state.event.currency)}</span>
            <span className="font-semibold">{overview.utilizationPercentage}% used</span>
          </div>
          <div className="w-full bg-[#EAE4DB] h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full ${
                overview.isOverrun ? 'bg-[#BE123C]' : 'bg-[#A2421D]'
              } transition-all duration-300`}
              style={{ width: `${Math.min(overview.utilizationPercentage, 100)}%` }}
            />
          </div>
        </Card>

        {/* Metric 2: Committed Actuals vs Runway */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6E665E] font-medium">
            <span>Remaining Runway</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#047857] flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono tracking-tight ${
              overview.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'
            }`}
          >
            {formatCurrency(overview.remainingBudget, state.event.currency)}
          </div>
          <div className="text-xs text-[#5C554E] pt-0.5">
            Committed Actuals: {formatCurrency(overview.committedTotal, state.event.currency)}
          </div>
          <p className="text-[11px] text-[#6E665E]">
            {overview.remainingBudget >= 0 ? 'Uncommitted contingency intact' : 'Action required to balance'}
          </p>
        </Card>

        {/* Metric 3: Task & Dependency Health */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6E665E] font-medium">
            <span>Milestones Progress</span>
            <div className="w-7 h-7 rounded-lg bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#1C1917]">
            {completedTasks.length} <span className="text-sm font-normal text-[#6E665E]">/ {state.tasks.length} Done</span>
          </div>
          <div className="text-xs text-[#5C554E] flex items-center gap-2 pt-0.5">
            <span className="text-[#B45309] font-medium">{inProgressTasks.length} In Progress</span>
            <span>•</span>
            <span className="text-[#BE123C] font-medium">{blockedTasks.length} Blocked</span>
          </div>
          <p className="text-[11px] text-[#6E665E]">
            {blockedTasks.length > 0 ? `${blockedTasks.length} await prerequisite completion` : 'No dependency deadlocks'}
          </p>
        </Card>

        {/* Metric 4: Vendor Quotation Status */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6E665E] font-medium">
            <span>Vendor Quotations</span>
            <div className="w-7 h-7 rounded-lg bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#1C1917]">
            {selectedQuotes.length} <span className="text-sm font-normal text-[#6E665E]">/ {state.vendors.length} Selected</span>
          </div>
          <div className="text-xs text-[#5C554E] pt-0.5 flex items-center justify-between">
            <span>{pendingQuotes.length} proposals under review</span>
          </div>
          <p className="text-[11px] text-[#6E665E]">
            Verified quotation contract terms
          </p>
        </Card>
      </div>

      {/* Main Split: Immediate Action Items vs Recent Planning Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column: Immediate Action Milestones & Category Breakdown (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
                  High-Priority Milestones
                </h3>
                <p className="text-xs text-[#6E665E]">
                  Active tasks driving critical path deadlines.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 cursor-pointer"
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
                    <div key={evalItem.task.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1C1917]">
                            {evalItem.task.title}
                          </span>
                          {isBlocked && (
                            <Badge variant="neutral" size="sm" className="gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Blocked
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge variant="error" size="sm">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#6E665E] leading-snug">
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
          </Card>

          {/* Category Allocation Health Glance */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
                  Category Allocations & Commitments
                </h3>
                <p className="text-xs text-[#6E665E]">
                  Committed expenses compared against baseline category budgets.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('budget')}
                className="text-xs font-semibold text-[#A2421D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Open Budget Planner
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {overview.categories.map((catSummary) => {
                const pct = catSummary.allocatedAmount > 0
                  ? Math.round((catSummary.effectiveTotal / catSummary.allocatedAmount) * 100)
                  : 0;
                return (
                  <div key={catSummary.category.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1C1917]">
                        {catSummary.category.name}
                      </span>
                      <div className="font-mono text-xs flex items-center gap-2">
                        <span className="text-[#5C554E]">
                          {formatCurrency(catSummary.effectiveTotal, state.event.currency)}
                        </span>
                        <span className="text-[#6E665E]">/</span>
                        <span className="text-[#6E665E]">
                          {formatCurrency(catSummary.allocatedAmount, state.event.currency)}
                        </span>
                        <span className={`text-[10px] font-bold ${pct > 100 ? 'text-[#BE123C]' : 'text-[#5C554E]'}`}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#EAE4DB] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct > 100 ? 'bg-[#BE123C]' : 'bg-[#A2421D]'} transition-all duration-300`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Recent Planning Changes & Simulator Promo */}
        <div className="space-y-6">
          {/* Decision Simulator Prompt */}
          <div className="bg-[#FAF0EB] p-5 sm:p-6 rounded-xl border border-[#F3CEBE] space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[#A2421D] font-bold text-sm">
              <Sliders className="w-4 h-4" />
              <span>Simulate Planning Changes</span>
            </div>
            <p className="text-xs text-[#5C554E] leading-relaxed">
              Evaluating a higher guest count or shifting funds from decor to photography? Use the simulator to calculate the ripple effect on remaining runway and venue limits before altering your confirmed plan.
            </p>
            <button
              onClick={() => setActiveTab('simulator')}
              className="w-full py-2.5 bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer active:scale-[0.98]"
            >
              Open Simulator Sandbox
            </button>
          </div>

          {/* Audit Log / Change Records */}
          <Card padding="md" className="space-y-4">
            <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
              Recent Planning Changes
            </h3>
            <div className="space-y-3">
              {state.changeLog.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs border-l-2 border-[#A2421D] pl-3 py-1 space-y-0.5">
                  <span className="text-[#6E665E] text-[10px] block">
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
          </Card>
        </div>
      </div>
    </div>
  );
};
