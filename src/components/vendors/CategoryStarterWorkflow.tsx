import React, { useState } from 'react';
import { CategoryStarterInfo } from './vendorCategoryStarters';
import {
  CheckSquare,
  HelpCircle,
  Copy,
  Check,
  Plus,
  FileText,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

interface CategoryStarterWorkflowProps {
  categoryName: string;
  starterInfo: CategoryStarterInfo;
  isReadOnly: boolean;
  onAddSupplier: () => void;
  onLogQuote?: () => void;
  hasVendorsInAnyCategory: boolean;
}

export const CategoryStarterWorkflow: React.FC<CategoryStarterWorkflowProps> = ({
  categoryName,
  starterInfo,
  isReadOnly,
  onAddSupplier,
  onLogQuote,
  hasVendorsInAnyCategory,
}) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [hasCopied, setHasCopied] = useState(false);

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleCopyChecklist = () => {
    const textLines = [
      `VowPilot — ${categoryName} Service Scope Brief & Checklist`,
      '==================================================',
      '',
      'Key Scope Requirements:',
      ...starterInfo.scopeChecklist.map((item, i) => `[${checkedItems[i] ? 'x' : ' '}] ${item}`),
      '',
      'Clarification Questions for Supplier:',
      ...starterInfo.suggestedQuestions.map((q, i) => `${i + 1}. ${q}`),
      '',
      'Standard Inclusions to Verify:',
      ...starterInfo.sampleInclusions.map((inc) => `• ${inc}`),
      '',
      'Standard Exclusions to Confirm:',
      ...starterInfo.sampleExclusions.map((exc) => `• ${exc}`),
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };

  return (
    <div
      data-testid="category-starter-workflow"
      className="bg-surface border border-subtle rounded-xl p-6 shadow-xs space-y-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-subtle flex items-center justify-center shrink-0 mt-0.5">
            <ClipboardList className="w-5 h-5 text-[#B85C3A] dark:text-[#D48668]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif-heading text-lg font-bold text-primary">
                {starterInfo.scopeTitle}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-subtle text-secondary border border-subtle">
                Starter Guide
              </span>
            </div>
            <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">
              {starterInfo.scopeDescription}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyChecklist}
            data-testid="copy-category-checklist-btn"
            className="px-3 py-1.5 rounded-lg border border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Copy editable scope brief to clipboard"
          >
            {hasCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied Brief</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Scope Brief</span>
              </>
            )}
          </button>

          {!isReadOnly && (
            <button
              onClick={onAddSupplier}
              data-testid="starter-add-supplier-btn"
              className="px-3.5 py-1.5 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier in {categoryName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout: Scope Checklist & Evaluation Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Scope Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-[#B85C3A] dark:text-[#D48668]" />
              Recommended Service Deliverables
            </h4>
            <span className="text-[11px] text-muted">
              {Object.values(checkedItems).filter(Boolean).length}/{starterInfo.scopeChecklist.length} selected
            </span>
          </div>

          <div className="space-y-1.5 bg-subtle/50 border border-subtle rounded-xl p-3">
            {starterInfo.scopeChecklist.map((item, idx) => {
              const isChecked = !!checkedItems[idx];
              return (
                <label
                  key={idx}
                  onClick={() => toggleCheck(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                    isChecked
                      ? 'bg-surface text-primary font-medium border border-subtle'
                      : 'hover:bg-subtle text-secondary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A] cursor-pointer"
                  />
                  <span className="leading-snug">{item}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Column 2: Suggested Questions & Contract Safeguards */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-[#B85C3A] dark:text-[#D48668]" />
            Supplier Evaluation Questions & Traps
          </h4>

          <div className="space-y-2 bg-subtle/50 border border-subtle rounded-xl p-3">
            {starterInfo.suggestedQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-surface border border-subtle text-xs text-secondary space-y-1"
              >
                <div className="font-semibold text-primary flex items-start gap-1.5">
                  <span className="text-[#B85C3A] dark:text-[#D48668] font-mono shrink-0">Q{idx + 1}.</span>
                  <span>{q}</span>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted italic">
                <Sparkles className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668] shrink-0" />
                <span>
                  Tip: Use &quot;Draft Clarification&quot; on any logged quote to automatically formulate missing clause inquiries.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Banner */}
      <div className="p-3 bg-subtle/70 border border-subtle rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-secondary">
          No live quotes registered yet for <strong>{categoryName}</strong>. Add your first vendor contact or proposal to unlock side-by-side comparison metrics.
        </span>
        <div className="flex items-center gap-2">
          {!isReadOnly && onLogQuote && hasVendorsInAnyCategory && (
            <button
              onClick={onLogQuote}
              className="px-3 py-1.5 rounded-lg border border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
              <span>Log Quotation</span>
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={onAddSupplier}
              className="px-3.5 py-1.5 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
