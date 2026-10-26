import React, { useState, useMemo } from 'react';
import { GuestRecord, SeatingTable } from '../../types';
import { Modal } from '../common/Modal';
import {
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';

export interface SeatingPreset {
  id: string;
  name: string;
  shape: 'round' | 'rectangular' | 'oval';
  capacity: number;
  description: string;
}

export const SEATING_PRESETS: SeatingPreset[] = [
  {
    id: 'round-8',
    name: 'Round Banquet (8 Seats)',
    shape: 'round',
    capacity: 8,
    description: 'Classic 60-inch round tables. Ideal for conversations and balanced ballroom flow.',
  },
  {
    id: 'round-10',
    name: 'Round Large (10 Seats)',
    shape: 'round',
    capacity: 10,
    description: 'Spacious 72-inch rounds for high-headcount galas and grand banquets.',
  },
  {
    id: 'family-6',
    name: 'Family & VIP Table (6 Seats)',
    shape: 'oval',
    capacity: 6,
    description: 'Intimate oval tables suited for immediate families, bridal party, or elders.',
  },
  {
    id: 'banquet-12',
    name: 'Long Banquet (12 Seats)',
    shape: 'rectangular',
    capacity: 12,
    description: 'Imperial banquet tables lined end-to-end for dramatic feasting aesthetics.',
  },
  {
    id: 'grand-16',
    name: 'Grand Banquet (16 Seats)',
    shape: 'rectangular',
    capacity: 16,
    description: 'High-capacity feasting tables for communal dining and large delegation groups.',
  },
];

export interface GenerateSeatingDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEventId: string;
  guests: GuestRecord[];
  existingTables: SeatingTable[];
  onApplyDraft: (
    newTables: SeatingTable[],
    updatedGuests: GuestRecord[],
    description: string
  ) => void;
}

export const GenerateSeatingDraftModal: React.FC<GenerateSeatingDraftModalProps> = ({
  isOpen,
  onClose,
  currentEventId,
  guests,
  existingTables,
  onApplyDraft,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('round-8');
  const [scope, setScope] = useState<'confirmed_only' | 'all_non_declined'>('confirmed_only');
  const [prioritizeHouseholds, setPrioritizeHouseholds] = useState<boolean>(true);
  const [strategy, setStrategy] = useState<'replace' | 'append'>('replace');

  const confirmedGuests = useMemo(
    () => guests.filter((g) => g.rsvpStatus === 'accepted'),
    [guests]
  );
  const pendingGuests = useMemo(
    () => guests.filter((g) => g.rsvpStatus === 'pending'),
    [guests]
  );
  const declinedGuests = useMemo(
    () => guests.filter((g) => g.rsvpStatus === 'declined'),
    [guests]
  );

  const selectedPreset =
    SEATING_PRESETS.find((p) => p.id === selectedPresetId) || SEATING_PRESETS[0];

  const targetGuests = useMemo(() => {
    if (scope === 'confirmed_only') {
      return confirmedGuests;
    }
    return guests.filter((g) => g.rsvpStatus !== 'declined');
  }, [scope, confirmedGuests, guests]);

  // Projected required tables
  const estimatedTableCount = Math.max(
    1,
    Math.ceil(targetGuests.length / selectedPreset.capacity)
  );

  const handleGenerate = () => {
    if (existingTables.length > 0 && strategy === 'replace') {
      const confirmed = window.confirm(
        'Are you sure you want to replace all current tables? Existing seating assignments will be reset to the new draft.'
      );
      if (!confirmed) return;
    }

    // 1. Cluster guests
    let guestPool: GuestRecord[] = [];

    if (strategy === 'append') {
      // Only seat guests who currently have no tableId
      guestPool = targetGuests.filter((g) => !g.tableId);
    } else {
      guestPool = [...targetGuests];
    }

    if (guestPool.length === 0) {
      alert('No unseated guests matching your criteria to place at new tables.');
      return;
    }

    // Sort by household group if enabled so families cluster together
    if (prioritizeHouseholds) {
      guestPool.sort((a, b) => {
        const hA = a.householdGroup || 'zzz';
        const hB = b.householdGroup || 'zzz';
        return hA.localeCompare(hB);
      });
    }

    // 2. Allocate tables
    const tableCountToGenerate = Math.max(
      1,
      Math.ceil(guestPool.length / selectedPreset.capacity)
    );

    const generatedTables: SeatingTable[] = [];
    const baseTableNumber = strategy === 'append' ? existingTables.length + 1 : 1;

    for (let i = 0; i < tableCountToGenerate; i++) {
      const tableNumber = baseTableNumber + i;
      const tableId = `tbl-draft-${Date.now().toString(36)}-${i}-${Math.random().toString(36).substring(2, 5)}`;
      generatedTables.push({
        id: tableId,
        eventId: currentEventId,
        name: `Table ${tableNumber}`,
        capacity: selectedPreset.capacity,
        shape: selectedPreset.shape,
        assignedGuestIds: [],
        notes: `Draft generated layout (${selectedPreset.name})`,
      });
    }

    // 3. Assign guests up to capacity with zero duplicates
    let currentTableIdx = 0;
    const assignedGuestIdsByTable = new Map<string, string[]>();
    generatedTables.forEach((t) => assignedGuestIdsByTable.set(t.id, []));

    const updatedGuestMap = new Map<string, string>(); // guestId -> tableId

    for (const guest of guestPool) {
      let placed = false;

      // Find first table with available capacity
      for (let tIdx = currentTableIdx; tIdx < generatedTables.length; tIdx++) {
        const table = generatedTables[tIdx];
        const currentAssigned = assignedGuestIdsByTable.get(table.id) || [];

        if (currentAssigned.length < table.capacity) {
          currentAssigned.push(guest.id);
          assignedGuestIdsByTable.set(table.id, currentAssigned);
          updatedGuestMap.set(guest.id, table.id);
          placed = true;
          break;
        } else if (tIdx === currentTableIdx) {
          // Table full, advance pointer
          currentTableIdx++;
        }
      }

      if (!placed) {
        // If all generated tables filled, remaining guests stay unassigned
        break;
      }
    }

    // Attach assignments to generated tables
    const finalGeneratedTables = generatedTables.map((t) => ({
      ...t,
      assignedGuestIds: assignedGuestIdsByTable.get(t.id) || [],
    }));

    // Merge tables based on strategy
    const finalTables =
      strategy === 'append'
        ? [...existingTables, ...finalGeneratedTables]
        : finalGeneratedTables;

    // Update guest records tableId
    const now = new Date().toISOString();
    const finalGuests = guests.map((g) => {
      if (updatedGuestMap.has(g.id)) {
        return {
          ...g,
          tableId: updatedGuestMap.get(g.id),
          updatedAt: now,
        };
      }
      if (strategy === 'replace') {
        // Any guest not in updatedGuestMap has tableId cleared
        return {
          ...g,
          tableId: undefined,
          updatedAt: now,
        };
      }
      return g;
    });

    const description = `Generated seating draft: ${finalGeneratedTables.length} tables (${selectedPreset.name}), seated ${updatedGuestMap.size} guests.`;
    onApplyDraft(finalTables, finalGuests, description);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Seating Draft"
      description="Automatically calculate table requirements and assign attendees without exceeding capacities"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5 text-xs text-primary">
        {/* Guest Headcount Health Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-subtle border border-subtle text-center">
          <div>
            <span className="text-[10px] text-emerald-700 dark:text-[#91B8A0] font-semibold uppercase block">
              Confirmed Attending
            </span>
            <span className="text-lg font-bold font-mono text-emerald-800 dark:text-[#91B8A0]">
              {confirmedGuests.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-amber-700 dark:text-[#E5BD76] font-semibold uppercase block">
              RSVP Pending
            </span>
            <span className="text-lg font-bold font-mono text-amber-800 dark:text-[#E5BD76]">
              {pendingGuests.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-stone-500 font-semibold uppercase block">
              Declined
            </span>
            <span className="text-lg font-bold font-mono text-stone-500">
              {declinedGuests.length}
            </span>
          </div>
        </div>

        {/* Scope Selection */}
        <div className="space-y-1.5">
          <label className="block font-semibold text-primary">
            Which guests should be seated in this draft?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                scope === 'confirmed_only'
                  ? 'bg-surface border-[#B85C3A] text-primary shadow-xs'
                  : 'bg-subtle/60 border-subtle text-secondary'
              }`}
            >
              <input
                type="radio"
                name="seating_scope"
                value="confirmed_only"
                checked={scope === 'confirmed_only'}
                onChange={() => setScope('confirmed_only')}
                className="mt-0.5 text-[#B85C3A] focus:ring-[#B85C3A]"
              />
              <div>
                <strong className="block font-semibold">Confirmed Guests Only ({confirmedGuests.length})</strong>
                <span className="text-[11px] text-secondary">
                  Seat only attendees who have officially accepted their RSVP. Pending guests remain unassigned.
                </span>
              </div>
            </label>

            <label
              className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                scope === 'all_non_declined'
                  ? 'bg-surface border-[#B85C3A] text-primary shadow-xs'
                  : 'bg-subtle/60 border-subtle text-secondary'
              }`}
            >
              <input
                type="radio"
                name="seating_scope"
                value="all_non_declined"
                checked={scope === 'all_non_declined'}
                onChange={() => setScope('all_non_declined')}
                className="mt-0.5 text-[#B85C3A] focus:ring-[#B85C3A]"
              />
              <div>
                <strong className="block font-semibold">All Non-Declined ({confirmedGuests.length + pendingGuests.length})</strong>
                <span className="text-[11px] text-secondary">
                  Reserve seats for all invited guests who have not declined, anticipating confirmation.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Advisory Warning if Seating Pending Guests */}
        {scope === 'all_non_declined' && pendingGuests.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-[#332A20] border border-amber-200 dark:border-[#55462D] text-amber-900 dark:text-[#E5BD76] flex items-start gap-2 text-xs">
            <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-[#E5BD76] mt-0.5" />
            <span>
              <strong>Draft Advisory:</strong> {pendingGuests.length} invited guests have not confirmed attendance yet. Seating assignments are generated as a provisional planning draft.
            </span>
          </div>
        )}

        {/* Table Layout Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-primary">
              Select Table Capacity & Layout Preset
            </label>
            <span className="text-secondary text-[11px]">
              Requires ~{estimatedTableCount} tables for {targetGuests.length} guests
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEATING_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-1 ${
                    isSelected
                      ? 'bg-surface border-[#B85C3A] ring-1 ring-[#B85C3A] shadow-xs'
                      : 'bg-subtle/60 border-subtle hover:bg-subtle text-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{preset.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-subtle border border-subtle text-secondary uppercase">
                      {preset.shape}
                    </span>
                  </div>
                  <p className="text-[11px] text-secondary leading-snug">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grouping Checkbox */}
        <div className="p-3 rounded-xl bg-subtle border border-subtle flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={prioritizeHouseholds}
              onChange={(e) => setPrioritizeHouseholds(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span className="text-primary font-medium">
              Keep Household & Group Parties Together
            </span>
          </label>
          <span className="text-tertiary text-[11px]">
            Clusters families at identical tables
          </span>
        </div>

        {/* Strategy if tables already exist */}
        {existingTables.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-[#332A20] border border-amber-200 dark:border-[#55462D] space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-[#E5BD76] text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-[#E5BD76]" />
              <span>You currently have {existingTables.length} tables arranged</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer text-xs ${
                  strategy === 'append'
                    ? 'bg-surface border-[#B85C3A] text-primary shadow-xs'
                    : 'bg-surface/60 border-subtle text-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="seating_strategy"
                  value="append"
                  checked={strategy === 'append'}
                  onChange={() => setStrategy('append')}
                  className="text-[#B85C3A] focus:ring-[#B85C3A]"
                />
                <div>
                  <strong className="block font-semibold">Append for Unseated Guests</strong>
                  <span className="text-[10px] text-secondary">Keep existing table assignments and create tables for remaining guests</span>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer text-xs ${
                  strategy === 'replace'
                    ? 'bg-surface border-rose-400 text-rose-900 dark:text-[#E58C91] shadow-xs'
                    : 'bg-surface/60 border-subtle text-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="seating_strategy"
                  value="replace"
                  checked={strategy === 'replace'}
                  onChange={() => setStrategy('replace')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <strong className="block font-semibold">Replace All Tables</strong>
                  <span className="text-[10px] text-secondary">Reset tables and generate a completely fresh balanced draft</span>
                </div>
              </label>
            </div>
          </div>
        )}

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
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>Generate Seating Draft ({estimatedTableCount} Tables)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
