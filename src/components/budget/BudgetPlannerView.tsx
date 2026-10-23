import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview, generatePriorityAwareRecommendations } from '../../domain/budgetEngine';
import { formatCurrency, parseDisplayToMinor } from '../../domain/currency';
import { BudgetCategory, CostStatus } from '../../types';
import { Modal } from '../common/Modal';
import {
  Edit2,
  Plus,
  Trash2,
  TrendingDown,
} from 'lucide-react';

export const BudgetPlannerView: React.FC = () => {
  const { state, updateCategory, addExpense, deleteExpense } = useEvent();
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
    setExpenseTitle('');
    setExpenseCategoryId(catId || state.categories[0]?.id || '');
    setExpenseAmountDisplay('');
    setExpenseStatus('estimated');
    setExpenseVendorId('');
    setExpenseNotes('');
    setIsAddExpenseOpen(true);
  };

  const handleSaveExpense = () => {
    if (!expenseTitle.trim()) return;
    const amountMinor = parseDisplayToMinor(expenseAmountDisplay);
    if (amountMinor <= 0) return;

    addExpense({
      categoryId: expenseCategoryId,
      title: expenseTitle,
      amount: amountMinor,
      status: expenseStatus,
      vendorId: expenseVendorId || undefined,
      paidAmount: expenseStatus === 'actual' ? amountMinor : 0,
      notes: expenseNotes,
    });
    setIsAddExpenseOpen(false);
  };

  const handleOpenEditCategory = (cat: BudgetCategory) => {
    setSelectedCategory(cat);
    setEditAllocatedDisplay((cat.allocatedAmount / 100).toString());
    setEditPerGuestDisplay(cat.perGuestCost ? (cat.perGuestCost / 100).toString() : '');
    setEditMaxCapacity(cat.maxCapacity);
    setIsEditCategoryOpen(true);
  };

  const handleSaveCategory = () => {
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed</span>;
      case 'actual':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Actual (Paid)</span>;
      case 'quoted':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Quoted</span>;
      case 'estimated':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">Estimated</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading">
            Budget & Trade-Off Planner
          </h1>
          <p className="text-xs text-[#78716C] mt-1">
            Strict separation of Estimated, Quoted, Confirmed, and Actual commitments. No guesswork.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddExpense()}
          className="px-4 py-2 rounded-md bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Expense Record
        </button>
      </div>

      {/* Top Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white p-5 rounded-xl border border-[#E6DFD5] shadow-xs">
        <div className="space-y-0.5">
          <span className="text-[11px] text-[#78716C] font-medium">Total Budget</span>
          <p className="font-mono text-base font-bold text-[#1C1917]">
            {formatCurrency(overview.totalBudget, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-[#78716C] font-medium">Total Allocated</span>
          <p className="font-mono text-base font-semibold text-[#5C554E]">
            {formatCurrency(overview.totalAllocated, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-[#78716C] font-medium">Committed (Actual/Conf.)</span>
          <p className="font-mono text-base font-semibold text-[#047857]">
            {formatCurrency(overview.committedTotal, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] text-[#78716C] font-medium">Projected Total</span>
          <p className="font-mono text-base font-semibold text-[#1C1917]">
            {formatCurrency(overview.effectiveProjectedTotal, state.event.currency)}
          </p>
        </div>

        <div className="space-y-0.5 col-span-2 md:col-span-1">
          <span className="text-[11px] text-[#78716C] font-medium">Remaining Runway</span>
          <p
            className={`font-mono text-base font-bold ${
              overview.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'
            }`}
          >
            {formatCurrency(overview.remainingBudget, state.event.currency)}
          </p>
        </div>
      </div>

      {/* Priority Reduction Recommendations (if overrun or user seeks buffer) */}
      {recs.recommendations.length > 0 && (
        <div className="bg-[#FAF0EB] p-5 rounded-xl border border-[#F3CEBE] space-y-3">
          <div className="flex items-center gap-2 text-[#A2421D]">
            <TrendingDown className="w-4 h-4" />
            <h3 className="text-sm font-bold">
              Priority-Aware Reduction Proposals
            </h3>
          </div>
          <p className="text-xs text-[#5C554E] leading-relaxed">
            Your top priorities (<strong>{state.event.preferences.planningPriorities.slice(0, 2).join(' & ')}</strong>) are protected. The suggestions below trim uncommitted headroom from lower-ranked categories to balance the budget:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {recs.recommendations.map((rec) => (
              <div key={rec.categoryId} className="bg-white p-3 rounded-lg border border-[#F3CEBE] text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                  <span>{rec.categoryName} (Priority #{rec.priorityRank})</span>
                  <span className="text-[#BE123C]">
                    -{formatCurrency(rec.suggestedReduction, state.event.currency)}
                  </span>
                </div>
                <p className="text-[11px] text-[#78716C]">{rec.rationale}</p>
                <div className="text-[11px] text-[#5C554E] pt-1">
                  New Allocation: <span className="font-mono font-semibold">{formatCurrency(rec.newAllocated, state.event.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Allocations Breakdown Table */}
      <div className="bg-white rounded-xl border border-[#E6DFD5] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#F4EFEA] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
              Category Allocations
            </h3>
            <p className="text-xs text-[#78716C]">
              Real-time balance of category caps vs recorded commitments.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#78716C] uppercase font-semibold border-b border-[#E6DFD5]">
              <tr>
                <th className="py-3 px-4">Priority & Category</th>
                <th className="py-3 px-4 text-right">Allocated Cap</th>
                <th className="py-3 px-4 text-right">Confirmed / Actual</th>
                <th className="py-3 px-4 text-right">Quoted / Est.</th>
                <th className="py-3 px-4 text-right">Effective Total</th>
                <th className="py-3 px-4 text-right">Headroom</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EFEA]">
              {overview.categories.map((catSummary) => {
                const isOver = catSummary.isOverBudget;
                return (
                  <tr key={catSummary.category.id} className="hover:bg-[#FAF8F5]/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#FAF0EB] text-[#A2421D] text-[10px] font-bold flex items-center justify-center border border-[#F3CEBE]">
                          {catSummary.category.priorityRank}
                        </span>
                        <div>
                          <span className="font-semibold text-sm text-[#1C1917] block">
                            {catSummary.category.name}
                          </span>
                          {catSummary.category.perGuestCost && (
                            <span className="text-[10px] text-[#78716C]">
                              Scales at {formatCurrency(catSummary.category.perGuestCost, state.event.currency)}/guest
                            </span>
                          )}
                          {catSummary.category.maxCapacity && (
                            <span className="text-[10px] text-[#78716C] block">
                              Max capacity: {catSummary.category.maxCapacity} guests
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-[#1C1917]">
                      {formatCurrency(catSummary.allocatedAmount, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[#047857] font-semibold">
                      {formatCurrency(catSummary.committedTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[#5C554E]">
                      {formatCurrency(catSummary.quotedAmount + catSummary.estimatedAmount, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#1C1917]">
                      {formatCurrency(catSummary.effectiveTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <span className={isOver ? 'text-[#BE123C] font-bold' : 'text-[#5C554E]'}>
                        {formatCurrency(catSummary.remainingAllocated, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditCategory(catSummary.category)}
                          className="p-1 rounded text-[#78716C] hover:text-[#1C1917] hover:bg-[#EAE4DB] transition"
                          title="Edit Category Allocation"
                          aria-label={`Edit ${catSummary.category.name} allocation`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenAddExpense(catSummary.category.id)}
                          className="p-1 rounded text-[#A2421D] hover:bg-[#FAF0EB] transition"
                          title="Add Expense to Category"
                          aria-label={`Add expense to ${catSummary.category.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized Expenses Table */}
      <div className="bg-white rounded-xl border border-[#E6DFD5] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#F4EFEA] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
              Recorded Expense Items ({state.expenses.length})
            </h3>
            <p className="text-xs text-[#78716C]">
              Itemized entries linked to vendors or internal estimates.
            </p>
          </div>
        </div>

        {state.expenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#78716C]">
            No expenses recorded yet. Click <strong>Add Expense Record</strong> to log costs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#78716C] uppercase font-semibold border-b border-[#E6DFD5]">
                <tr>
                  <th className="py-3 px-4">Title & Notes</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EFEA]">
                {state.expenses.map((exp) => {
                  const cat = state.categories.find((c) => c.id === exp.categoryId);
                  return (
                    <tr key={exp.id} className="hover:bg-[#FAF8F5]/60 transition">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-sm text-[#1C1917] block">
                          {exp.title}
                        </span>
                        {exp.notes && <span className="text-[11px] text-[#78716C]">{exp.notes}</span>}
                      </td>

                      <td className="py-3 px-4 text-[#5C554E] font-medium">
                        {cat?.name || exp.categoryId}
                      </td>

                      <td className="py-3 px-4">
                        {statusBadge(exp.status)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917]">
                        {formatCurrency(exp.amount, state.event.currency)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          className="p-1 rounded text-red-600 hover:bg-red-50 transition"
                          title="Delete Expense"
                          aria-label={`Delete expense: ${exp.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            <label htmlFor="edit-category-allocated" className="block font-semibold text-[#1C1917] mb-1">
              Allocated Amount ({state.event.currency})
            </label>
            <input
              id="edit-category-allocated"
              type="text"
              value={editAllocatedDisplay}
              onChange={(e) => setEditAllocatedDisplay(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label htmlFor="edit-category-per-guest" className="block font-semibold text-[#1C1917] mb-1">
              Variable Per-Guest Cost ({state.event.currency}/guest, optional)
            </label>
            <input
              id="edit-category-per-guest"
              type="text"
              value={editPerGuestDisplay}
              onChange={(e) => setEditPerGuestDisplay(e.target.value)}
              placeholder="e.g. 3500"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
            <p className="text-[11px] text-[#78716C] mt-1">
              Leave blank if cost does not automatically scale with guest count changes.
            </p>
          </div>

          <div>
            <label htmlFor="edit-category-capacity" className="block font-semibold text-[#1C1917] mb-1">
              Venue Maximum Guest Capacity (optional)
            </label>
            <input
              id="edit-category-capacity"
              type="number"
              value={editMaxCapacity || ''}
              onChange={(e) => setEditMaxCapacity(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="e.g. 200"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsEditCategoryOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Save Allocation
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        title="Add Expense Record"
        description="Record a new cost with explicit status distinction."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="expense-title-input" className="block font-semibold text-[#1C1917] mb-1">Expense Title</label>
            <input
              id="expense-title-input"
              type="text"
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              placeholder="e.g. Stage Floral Deposit"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="expense-category-select" className="block font-semibold text-[#1C1917] mb-1">Category</label>
              <select
                id="expense-category-select"
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}
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
              <label htmlFor="expense-status-select" className="block font-semibold text-[#1C1917] mb-1">Status</label>
              <select
                id="expense-status-select"
                value={expenseStatus}
                onChange={(e) => setExpenseStatus(e.target.value as CostStatus)}
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              >
                <option value="estimated">Estimated (Internal approximation)</option>
                <option value="quoted">Quoted (Vendor proposal under review)</option>
                <option value="confirmed">Confirmed (Contract signed / committed)</option>
                <option value="actual">Actual (Paid expense)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="expense-amount-input" className="block font-semibold text-[#1C1917] mb-1">
              Amount ({state.event.currency})
            </label>
            <input
              id="expense-amount-input"
              type="text"
              value={expenseAmountDisplay}
              onChange={(e) => setExpenseAmountDisplay(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label htmlFor="expense-vendor-select" className="block font-semibold text-[#1C1917] mb-1">
              Link to Vendor (optional)
            </label>
            <select
              id="expense-vendor-select"
              value={expenseVendorId}
              onChange={(e) => setExpenseVendorId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            >
              <option value="">None / Internal Estimate</option>
              {state.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expense-notes-textarea" className="block font-semibold text-[#1C1917] mb-1">Notes (optional)</label>
            <textarea
              id="expense-notes-textarea"
              rows={2}
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              placeholder="Payment milestone or contract details..."
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddExpenseOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveExpense}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Add Expense
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
