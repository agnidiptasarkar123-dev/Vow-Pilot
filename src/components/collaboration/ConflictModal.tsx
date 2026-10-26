import React from 'react';
import { Modal } from '../common/Modal';
import { CollaborationState } from '../../services/collaborationClient';
import { AlertTriangle, RefreshCw, Check } from 'lucide-react';

interface ConflictModalProps {
  conflict?: CollaborationState['lastConflict'];
  isOpen: boolean;
  onAcceptServer: () => void;
  onKeepLocal: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflict,
  isOpen,
  onAcceptServer,
  onKeepLocal,
}) => {
  if (!conflict) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Force explicit user decision
      title="Concurrent Modification Conflict"
      description="Another coordinator submitted changes while you were editing this celebration."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div role="alert" className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold text-sm">Conflict Detected (Optimistic Concurrency Control)</p>
            <p>
              Coordinator <span className="font-bold">{conflict.lastModifiedBy}</span> updated the plan to{' '}
              <span className="font-mono font-semibold">version {conflict.currentVersion}</span> while you were editing{' '}
              <span className="font-mono font-semibold">version {conflict.expectedVersion}</span>.
            </p>
            <p className="text-amber-800 font-medium">
              To protect both contributions, your changes have <strong>NOT</strong> silently overwritten the plan.
            </p>
          </div>
        </div>

        {/* Remote State Summary */}
        <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E6DFD5] text-xs space-y-2">
          <div className="font-semibold text-[#1C1917] flex items-center justify-between">
            <span>Remote Version {conflict.currentVersion} Details:</span>
            <span className="text-[#78716C]">Modified by {conflict.lastModifiedBy}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[#57534E]">
            <div>
              <span className="text-[#A8A29E]">Event Name:</span>{' '}
              <span className="font-medium text-[#1C1917]">{conflict.serverState.event.name}</span>
            </div>
            <div>
              <span className="text-[#A8A29E]">Guest Count:</span>{' '}
              <span className="font-medium text-[#1C1917]">{conflict.serverState.event.guestCount}</span>
            </div>
            <div>
              <span className="text-[#A8A29E]">Total Expenses:</span>{' '}
              <span className="font-medium text-[#1C1917]">{conflict.serverState.expenses.length} items</span>
            </div>
            <div>
              <span className="text-[#A8A29E]">Total Tasks:</span>{' '}
              <span className="font-medium text-[#1C1917]">{conflict.serverState.tasks.length} items</span>
            </div>
          </div>
        </div>

        {/* Explicit Action Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={onAcceptServer}
            className="flex flex-col items-start p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-left transition group"
          >
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 text-xs mb-1">
              <RefreshCw className="w-4 h-4 text-emerald-600 group-hover:rotate-45 transition" />
              <span>Accept Server Version (Recommended)</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Discard your unsaved local edits and synchronize with {conflict.lastModifiedBy}'s newest plan.
            </p>
          </button>

          <button
            onClick={onKeepLocal}
            className="flex flex-col items-start p-3 rounded-lg border border-[#E6DFD5] hover:border-[#B85C3A] bg-[#FFFFFF] hover:bg-[#FAF0EB]/30 text-left transition group"
          >
            <div className="flex items-center gap-1.5 font-semibold text-[#26221F] text-xs mb-1">
              <Check className="w-4 h-4 text-[#B85C3A]" />
              <span>Re-apply My Changes</span>
            </div>
            <p className="text-[11px] text-[#78716C]">
              Advance past version {conflict.currentVersion} and save your local modifications on top.
            </p>
          </button>
        </div>
      </div>
    </Modal>
  );
};
