import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview, generatePriorityAwareRecommendations } from '../../domain/budgetEngine';
import { formatCurrency, parseDisplayToMinor } from '../../domain/currency';
import { BudgetCategory, CostStatus } from '../../types';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import {
  Edit2,
  Lock,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
} from 'lucide-react';

export const BudgetPlannerView: React.FC = () => {
  const { state, updateCategory, addExpense, deleteExpense, isReadOnly } = useEvent();
  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
  const recs = generatePriorityAwareRecommendations(overview, state.event.preferences.planningPriorities);

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);

  // Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState(state.categories[0]?.id || '');
  const [expenseAmountDisplay, setExpenseAmountDisplay] = useState('');
  const [expenseStatus, setExpenseStatus] = useState<CostStatus>('estimated');
  const [expenseVendorId, setExpenseVendorId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Category edit form state
  const [editAllocatedDisplay, setEditAllocatedDisplay] = useState('');
  const [editPerGuestDisplay, setEditPerGuestDisplay] = useState('');
  const [editMaxCapacity, setEditMaxCapacity] = useState<number | undefined>();

  const handleOpenAddExpense = (catId?: string) => {
    if (isReadOnly) return;
    setExpenseTitle('');
    setExpenseCategoryId(catId || state.categories[0]?.id || '');
    setExpenseAmountDisplay('');
    setExpenseStatus('estimated');
    setExpenseVendorId('');
    setExpenseNotes('');
    setIsAddExpenseOpen(true);
  };

  const handleSaveExpense = () => {
    if (isReadOnly) return;
    if (!expenseTitle.trim()) return;
    const amountMinor = parseDisplayToMinor(expenseAmountDisplay);
    if (amountMinor <= 0) return;

    addExpense({
      categoryId: expenseCategoryId,
      title: expenseTitle.trim(),
      amount: amountMinor,
      status: expenseStatus,
      vendorId: expenseVendorId || undefined,
      paidAmount: expenseStatus === 'actual' ? amountMinor : 0,
      notes: expenseNotes.trim(),
    });
    setIsAddExpenseOpen(false);
  };

  const handleOpenEditCategory = (cat: BudgetCategory) => {
    if (isReadOnly) return;
    setSelectedCategory(cat);
    setEditAllocatedDisplay((cat.allocatedAmount / 100).toString());
    setEditPerGuestDisplay(cat.perGuestCost ? (cat.perGuestCost / 100).toString() : '');
    setEditMaxCapacity(cat.maxCapacity);
    setIsEditCategoryOpen(true);
  };

  const handleSaveCategory = () => {
    if (isReadOnly) return;
    if (!selectedCategory) return;
    const allocatedMinor = parseDisplayToMinor(editAllocatedDisplay);
    const perGuestMinor = editPerGuestDisplay ? parseDisplayToMinor(editPerGuestDisplay) : undefined;

    updateCategory({
      ...selectedCategory,
      allocatedAmount: allocatedMinor,
      perGuestCost: perGuestMinor,
      maxCapacity: editMaxCapacity ? Number(editMaxCapacity) : undefined,
      userDefined: true,
    });
    setIsEditCategoryOpen(false);
  };

  const statusBadge = (status: CostStatus) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success" size="sm">Confirmed</Badge>;
      case 'actual':
        return <Badge variant="info" size="sm">Actual (Paid)</Badge>;
      case 'quoted':
        return <Badge variant="accent" size="sm">Quoted</Badge>;
      case 'estimated':
      default:
        return <Badge variant="neutral" size="sm">Estimated</Badge>;
    }
  };

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
              <strong>Viewer Permissions (Read-Only):</strong> You can inspect budget allocations, telemetry, and itemized records. Modifying budget items or creating expenses is restricted to Editors and Owners.
            </span>
          </div>
        </div>
      )}

      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary font-serif-heading tracking-tight">
            Budget & Trade-Off Planner
          </h1>
          <p className="text-xs text-secondary mt-1">
            Strict separation of Estimated, Quoted, Confirmed, and Actual commitments. No guesswork.
          </p>
        </div>

        {!isReadOnly ? (
          <button
            onClick={() => handleOpenAddExpense()}
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense Record</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle text-secondary text-xs font-medium border border-subtle">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only Mode</span>
          </div>
        )}
      </div>

      {/* Top Telemetry Strip */}
      <Card padding="md" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="space-y-0.5">
          <span className="text-[11px] text-muted font-medium uppercase tracking-wider">Total Budget</span>
          <p className="font-mono text-base sm:text-lg font-bold text-primary">
            {formatCurrency(overview.totalBudget, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-muted font-medium uppercase tracking-wider">Total Allocated</span>
          <p className="font-mono text-base sm:text-lg font-semibold text-secondary">
            {formatCurrency(overview.totalAllocated, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-muted font-medium uppercase tracking-wider">Committed (Actual/Conf.)</span>
          <p className="font-mono text-base sm:text-lg font-semibold text-[#047857] dark:text-emerald-400">
            {formatCurrency(overview.committedTotal, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-muted font-medium uppercase tracking-wider">Projected Total</span>
          <p className="font-mono text-base sm:text-lg font-semibold text-primary">
            {formatCurrency(overview.effectiveProjectedTotal, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-tertiary font-medium uppercase tracking-wider">Remaining Runway</span>
          <p
            className={`font-mono text-base sm:text-lg font-bold ${
              overview.isOverrun ? 'text-[#BE123C] dark:text-rose-400' : 'text-[#047857] dark:text-emerald-400'
            }`}
          >
            {formatCurrency(overview.remainingBudget, state.event.currency)}
          </p>
        </div>
      </Card>

      {/* Priority Reduction Recommendations (if overrun or user seeks buffer) */}
      {recs.recommendations.length > 0 && (
        <div className="bg-accent-subtle p-5 sm:p-6 rounded-xl border border-accent-subtle space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-accent">
            <TrendingDown className="w-4 h-4" />
            <h3 className="text-sm font-bold">
              Priority-Aware Reduction Proposals
            </h3>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Your top priorities (<strong>{state.event.preferences.planningPriorities.slice(0, 2).join(' & ')}</strong>) are protected. The suggestions below trim uncommitted headroom from lower-ranked categories to balance the budget:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {recs.recommendations.map((rec) => (
              <div key={rec.categoryId} className="bg-surface p-3.5 rounded-lg border border-subtle text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-semibold text-primary">
                  <span>{rec.categoryName} (Priority #{rec.priorityRank})</span>
                  <span className="text-[#BE123C] dark:text-rose-400 font-mono">
                    -{formatCurrency(rec.suggestedReduction, state.event.currency)}
                  </span>
                </div>
                <p className="text-[11px] text-secondary">{rec.rationale}</p>
                <div className="text-[11px] text-secondary pt-1 border-t border-subtle flex items-center justify-between">
                  <span>New Allocation Cap:</span>
                  <span className="font-mono font-semibold text-primary">{formatCurrency(rec.newAllocated, state.event.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Allocations Breakdown Card */}
      <div className="bg-surface rounded-xl border border-subtle shadow-xs overflow-hidden">
        <div className="p-5 border-b border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-primary font-serif-heading">
              Category Allocations
            </h3>
            <p className="text-xs text-secondary">
              Real-time balance of category caps vs recorded commitments.
            </p>
          </div>
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle text-secondary uppercase font-semibold border-b border-subtle">
              <tr>
                <th scope="col" className="py-3 px-4">Priority & Category</th>
                <th scope="col" className="py-3 px-4 text-right">Allocated Cap</th>
                <th scope="col" className="py-3 px-4 text-right">Confirmed / Actual</th>
                <th scope="col" className="py-3 px-4 text-right">Quoted / Est.</th>
                <th scope="col" className="py-3 px-4 text-right">Effective Total</th>
                <th scope="col" className="py-3 px-4 text-right">Headroom</th>
                <th scope="col" className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {overview.categories.map((catSummary) => {
                const isOver = catSummary.isOverBudget;
                return (
                  <tr key={catSummary.category.id} className="hover:bg-subtle/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent-subtle text-accent text-[10px] font-bold flex items-center justify-center border border-accent-subtle">
                          {catSummary.category.priorityRank}
                        </span>
                        <div>
                          <span className="font-semibold text-sm text-primary block">
                            {catSummary.category.name}
                          </span>
                          {catSummary.category.perGuestCost && (
                            <span className="text-[10px] text-tertiary">
                              Scales at {formatCurrency(catSummary.category.perGuestCost, state.event.currency)}/guest
                            </span>
                          )}
                          {catSummary.category.maxCapacity && (
                            <span className="text-[10px] text-tertiary block">
                              Max capacity: {catSummary.category.maxCapacity} guests
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-primary">
                      {formatCurrency(catSummary.allocatedAmount, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[#047857] dark:text-emerald-400 font-semibold">
                      {formatCurrency(catSummary.committedTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-secondary">
                      {formatCurrency(catSummary.quotedAmount + catSummary.estimatedAmount, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-primary">
                      {formatCurrency(catSummary.effectiveTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <span className={isOver ? 'text-[#BE123C] dark:text-rose-400 font-bold' : 'text-secondary'}>
                        {formatCurrency(catSummary.remainingAllocated, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {!isReadOnly ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditCategory(catSummary.category)}
                            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-subtle transition cursor-pointer"
                            title="Edit Category Allocation"
                            aria-label={`Edit ${catSummary.category.name} allocation`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenAddExpense(catSummary.category.id)}
                            className="p-1.5 rounded-md text-accent hover:bg-accent-subtle transition cursor-pointer"
                            title="Add Expense to Category"
                            aria-label={`Add expense to ${catSummary.category.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-tertiary italic">Read-only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Responsive Stacked Cards (< 768px) */}
        <div className="block md:hidden divide-y divide-subtle p-4 space-y-3">
          {overview.categories.map((catSummary) => {
            const isOver = catSummary.isOverBudget;
            return (
              <div key={catSummary.category.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-subtle text-accent text-[10px] font-bold flex items-center justify-center border border-accent-subtle">
                      {catSummary.category.priorityRank}
                    </span>
                    <span className="font-semibold text-sm text-primary">
                      {catSummary.category.name}
                    </span>
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCategory(catSummary.category)}
                        className="p-2 rounded-md text-secondary hover:bg-subtle min-h-[36px] min-w-[36px] flex items-center justify-center"
                        aria-label={`Edit ${catSummary.category.name} allocation`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenAddExpense(catSummary.category.id)}
                        className="p-2 rounded-md text-accent hover:bg-accent-subtle min-h-[36px] min-w-[36px] flex items-center justify-center"
                        aria-label={`Add expense to ${catSummary.category.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-subtle p-2.5 rounded-lg border border-subtle">
                  <div>
                    <span className="text-[10px] uppercase text-tertiary block font-sans">Allocated Cap</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(catSummary.allocatedAmount, state.event.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-tertiary block font-sans">Committed</span>
                    <span className="font-semibold text-[#047857] dark:text-emerald-400">
                      {formatCurrency(catSummary.committedTotal, state.event.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-tertiary block font-sans">Effective Total</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(catSummary.effectiveTotal, state.event.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-tertiary block font-sans">Headroom</span>
                    <span className={isOver ? 'text-[#BE123C] dark:text-rose-400 font-bold' : 'text-secondary'}>
                      {formatCurrency(catSummary.remainingAllocated, state.event.currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Itemized Expenses Table */}
      <div className="bg-surface rounded-xl border border-subtle shadow-xs overflow-hidden">
        <div className="p-5 border-b border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-primary font-serif-heading">
              Recorded Expense Items ({state.expenses.length})
            </h3>
            <p className="text-xs text-secondary">
              Itemized entries linked to vendors or internal estimates.
            </p>
          </div>

          {!isReadOnly && state.expenses.length > 0 && (
            <button
              onClick={() => handleOpenAddExpense()}
              className="text-xs font-semibold text-accent dark:text-[#D48668] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
          )}
        </div>

        {state.expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses recorded yet"
            description="Log your first confirmed invoice, quotation commitment, or estimated operational cost."
            action={!isReadOnly ? {
              label: 'Add First Expense',
              icon: Plus,
              onClick: () => handleOpenAddExpense(),
            } : undefined}
          />
        ) : (
          <>
            {/* Desktop View Table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle text-secondary uppercase font-semibold border-b border-subtle">
                  <tr>
                    <th scope="col" className="py-3 px-4">Title & Notes</th>
                    <th scope="col" className="py-3 px-4">Category</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Amount</th>
                    <th scope="col" className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {state.expenses.map((exp) => {
                    const cat = state.categories.find((c) => c.id === exp.categoryId);
                    return (
                      <tr key={exp.id} className="hover:bg-subtle/60 transition">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-sm text-primary block">
                            {exp.title}
                          </span>
                          {exp.notes && <span className="text-[11px] text-muted">{exp.notes}</span>}
                        </td>

                        <td className="py-3 px-4 text-secondary font-medium">
                          {cat?.name || exp.categoryId}
                        </td>

                        <td className="py-3 px-4">
                          {statusBadge(exp.status)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-primary">
                          {formatCurrency(exp.amount, state.event.currency)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {!isReadOnly ? (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete expense record "${exp.title}"?`)) {
                                  deleteExpense(exp.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete Expense"
                              aria-label={`Delete expense: ${exp.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-tertiary italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Stacked Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-subtle p-4 space-y-3">
              {state.expenses.map((exp) => {
                const cat = state.categories.find((c) => c.id === exp.categoryId);
                return (
                  <div key={exp.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm text-primary block">
                          {exp.title}
                        </span>
                        <span className="text-[11px] text-tertiary">
                          {cat?.name || exp.categoryId} {exp.notes ? `• ${exp.notes}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusBadge(exp.status)}
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete expense record "${exp.title}"?`)) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center"
                            aria-label={`Delete expense: ${exp.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between font-mono text-sm font-bold text-primary bg-subtle px-3 py-1.5 rounded-md border border-subtle">
                      <span className="text-xs font-sans font-medium text-tertiary">Recorded Cost</span>
                      <span>{formatCurrency(exp.amount, state.event.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditCategoryOpen}
        onClose={() => setIsEditCategoryOpen(false)}
        title={`Edit Allocation: ${selectedCategory?.name}`}
        description="Fine-tune category cap and variable per-guest scaling."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="edit-category-allocated" className="block font-semibold text-primary mb-1">
              Allocated Amount ({state.event.currency})
            </label>
            <input
              id="edit-category-allocated"
              type="text"
              value={editAllocatedDisplay}
              onChange={(e) => setEditAllocatedDisplay(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div>
            <label htmlFor="edit-category-per-guest" className="block font-semibold text-primary mb-1">
              Variable Per-Guest Cost ({state.event.currency}/guest, optional)
            </label>
            <input
              id="edit-category-per-guest"
              type="text"
              value={editPerGuestDisplay}
              onChange={(e) => setEditPerGuestDisplay(e.target.value)}
              placeholder="e.g. 3500"
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
            <p className="text-[11px] text-secondary mt-1">
              Leave blank if cost does not automatically scale with guest count changes.
            </p>
          </div>

          <div>
            <label htmlFor="edit-category-capacity" className="block font-semibold text-primary mb-1">
              Venue Maximum Guest Capacity (optional)
            </label>
            <input
              id="edit-category-capacity"
              type="number"
              value={editMaxCapacity || ''}
              onChange={(e) => setEditMaxCapacity(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 200"
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <button
              type="button"
              onClick={() => setIsEditCategoryOpen(false)}
              className="px-4 py-2 rounded-lg border border-subtle text-secondary hover:bg-subtle text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCategory}
              className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-[0.98]"
            >
              Save Allocation Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Expense Record Modal */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        title="Add Expense Record"
        description="Record a committed invoice, actual payment, or estimated operational cost."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveExpense();
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label htmlFor="expense-title-input" className="block font-semibold text-primary mb-1">
              Expense Item Description *
            </label>
            <input
              id="expense-title-input"
              type="text"
              required
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              placeholder="e.g. Catering Advance Deposit 50%"
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="expense-category-select" className="block font-semibold text-primary mb-1">
                Target Category *
              </label>
              <select
                id="expense-category-select"
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="expense-amount-input" className="block font-semibold text-primary mb-1">
                Amount ({state.event.currency}) *
              </label>
              <input
                id="expense-amount-input"
                type="text"
                required
                value={expenseAmountDisplay}
                onChange={(e) => setExpenseAmountDisplay(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="expense-status-select" className="block font-semibold text-primary mb-1">
                Cost Commitment Status *
              </label>
              <select
                id="expense-status-select"
                value={expenseStatus}
                onChange={(e) => setExpenseStatus(e.target.value as CostStatus)}
                className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
              >
                <option value="estimated">Estimated (Rough Planning Budget)</option>
                <option value="quoted">Quoted (Vendor Formal Offer)</option>
                <option value="confirmed">Confirmed (Contract Signed)</option>
                <option value="actual">Actual (Paid / Transferred)</option>
              </select>
            </div>

            <div>
              <label htmlFor="expense-vendor-select" className="block font-semibold text-primary mb-1">
                Linked Supplier (Optional)
              </label>
              <select
                id="expense-vendor-select"
                value={expenseVendorId}
                onChange={(e) => setExpenseVendorId(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
              >
                <option value="">None / Direct Procurement</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="expense-notes-input" className="block font-semibold text-primary mb-1">
              Internal Notes / Invoice Reference
            </label>
            <input
              id="expense-notes-input"
              type="text"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              placeholder="e.g. Invoice #2026-INV-091 verified"
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(false)}
              className="px-4 py-2 rounded-lg border border-subtle text-secondary hover:bg-subtle text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-[0.98]"
            >
              Save Expense Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
