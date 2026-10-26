import React, { useState } from 'react';
import { TimelineItem } from '../../types';
import { Modal } from '../common/Modal';
import { RUN_SHEET_PRESETS, RunSheetPreset } from './timelineTemplates';
import {
  Sparkles,
  MapPin,
  User,
  AlertTriangle,
  Check,
} from 'lucide-react';

export interface StarterRunSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEventId: string;
  currentEventType?: string;
  hasExistingActivities: boolean;
  onApplyPreset: (
    items: Array<Omit<TimelineItem, 'id'>>,
    strategy: 'replace' | 'append'
  ) => void;
}

export const StarterRunSheetModal: React.FC<StarterRunSheetModalProps> = ({
  isOpen,
  onClose,
  currentEventId,
  currentEventType = 'wedding',
  hasExistingActivities,
  onApplyPreset,
}) => {
  // Map eventType to closest preset
  const initialPresetId = React.useMemo(() => {
    const lower = currentEventType.toLowerCase();
    if (lower.includes('wedding') || lower.includes('reception') || lower.includes('engagement')) {
      return 'wedding-classic';
    }
    if (lower.includes('birthday') || lower.includes('anniversary')) {
      return 'birthday-anniversary';
    }
    if (lower.includes('corporate') || lower.includes('conference') || lower.includes('summit')) {
      return 'corporate-conference';
    }
    if (lower.includes('cultural') || lower.includes('festival') || lower.includes('sangeet')) {
      return 'cultural-celebration';
    }
    return 'wedding-classic';
  }, [currentEventType]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPresetId);
  const [strategy, setStrategy] = useState<'replace' | 'append'>('append');

  const selectedPreset: RunSheetPreset =
    RUN_SHEET_PRESETS.find((p) => p.id === selectedPresetId) || RUN_SHEET_PRESETS[0];

  const handleApply = () => {
    if (hasExistingActivities && strategy === 'replace') {
      const confirmed = window.confirm(
        'Are you sure you want to replace your current schedule? All existing timeline activities will be replaced by the starter template.'
      );
      if (!confirmed) return;
    }

    const itemsToCreate: Array<Omit<TimelineItem, 'id'>> = selectedPreset.items.map((item, index) => ({
      ...item,
      eventId: currentEventId,
      orderIndex: index,
    }));

    onApplyPreset(itemsToCreate, strategy);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Starter Run Sheet"
      description="Choose a structured timeline draft calibrated for your celebration type"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-5 text-xs text-primary">
        {/* Preset Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {RUN_SHEET_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPresetId(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#FAF0EB] dark:bg-[#2E2222] text-[#B85C3A] dark:text-[#E8D7C4] border-[#E8C8BD] dark:border-[#5C3830] shadow-2xs'
                    : 'bg-subtle text-secondary border-subtle hover:text-primary hover:bg-muted'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSelected ? 'text-[#B85C3A] dark:text-[#D48668]' : 'text-tertiary'}`} />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Preset Overview Banner */}
        <div className="p-3.5 rounded-xl bg-subtle border border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-sm text-primary flex items-center gap-2">
              <span>{selectedPreset.name}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-surface border border-subtle text-secondary">
                {selectedPreset.items.length} Activities • ~{selectedPreset.estimatedDurationHours} Hours
              </span>
            </h4>
            <p className="text-secondary text-[11px] mt-1 max-w-xl">
              {selectedPreset.description}
            </p>
          </div>

          <div className="text-[10px] text-amber-700 dark:text-[#E5BD76] font-medium bg-amber-50 dark:bg-[#332A20] px-2.5 py-1 rounded-md border border-amber-200 dark:border-[#55462D] shrink-0">
            Suggested draft timings — fully customizable
          </div>
        </div>

        {/* Existing Schedule Warning & Strategy Options */}
        {hasExistingActivities && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-[#332A20] border border-amber-200 dark:border-[#55462D] space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-[#E5BD76] text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-[#E5BD76]" />
              <span>You already have activities in your schedule</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-[#C5B9B3]">
              Choose how you want to apply the starter template:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs ${
                  strategy === 'append'
                    ? 'bg-surface border-[#B85C3A] text-primary shadow-xs'
                    : 'bg-surface/60 border-subtle text-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="runsheet_strategy"
                  value="append"
                  checked={strategy === 'append'}
                  onChange={() => setStrategy('append')}
                  className="text-[#B85C3A] focus:ring-[#B85C3A]"
                />
                <div>
                  <strong className="block font-semibold">Append to Existing Schedule</strong>
                  <span className="text-[10px] text-secondary">Add new template activities after current items (recommended)</span>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs ${
                  strategy === 'replace'
                    ? 'bg-surface border-rose-400 text-rose-900 dark:text-[#E58C91] shadow-xs'
                    : 'bg-surface/60 border-subtle text-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="runsheet_strategy"
                  value="replace"
                  checked={strategy === 'replace'}
                  onChange={() => setStrategy('replace')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <strong className="block font-semibold">Replace Existing Schedule</strong>
                  <span className="text-[10px] text-secondary">Discard current items and start fresh with this template</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Template Activities Preview List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-secondary px-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Template Activities Sequence ({selectedPreset.items.length})
            </span>
            <span>All details can be edited after creation</span>
          </div>

          <div className="border border-subtle rounded-xl divide-y divide-subtle max-h-64 overflow-y-auto bg-surface">
            {selectedPreset.items.map((item, idx) => (
              <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-subtle/50 transition">
                <div className="flex items-start gap-3">
                  <div className="w-14 font-mono font-bold text-primary shrink-0">
                    {item.time}
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-primary block">
                      {item.activity}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary">
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#B85C3A] dark:text-[#D48668]" />
                          <span>{item.location}</span>
                        </span>
                      )}
                      {item.assignedPerson && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-tertiary" />
                          <span>Lead: {item.assignedPerson}</span>
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-[10px] text-tertiary italic pt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-subtle text-secondary border border-subtle">
                    {item.durationMinutes} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-subtle text-secondary hover:bg-muted text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>Apply {selectedPreset.name}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
