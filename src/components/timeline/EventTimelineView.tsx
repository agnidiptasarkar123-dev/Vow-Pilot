import React, { useState, useMemo } from 'react';
import { useEvent } from '../../context/EventContext';
import { TimelineItem } from '../../types';
import { detectTimelineConflicts } from '../../context/slices/timelineSlice';
import { StarterRunSheetModal } from './StarterRunSheetModal';
import {
  Clock,
  Plus,
  AlertTriangle,
  Printer,
  MapPin,
  User,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';

export const EventTimelineView: React.FC = () => {
  const {
    state,
    addTimelineItem,
    updateTimelineItem,
    deleteTimelineItem,
    reorderTimeline,
    applyTimelinePreset,
    isReadOnly,
  } = useEvent();

  const timeline = useMemo(() => {
    const list = state.timeline || [];
    return [...list].sort((a, b) => a.orderIndex - b.orderIndex || a.time.localeCompare(b.time));
  }, [state.timeline]);

  const conflicts = useMemo(() => detectTimelineConflicts(timeline), [timeline]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStarterModalOpen, setIsStarterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);

  // Form state
  const [formTime, setFormTime] = useState('16:00');
  const [formActivity, setFormActivity] = useState('');
  const [formDuration, setFormDuration] = useState(60);
  const [formAssigned, setFormAssigned] = useState('');
  const [formVendorId, setFormVendorId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Vendor map for lookup
  const vendorMap = useMemo(() => {
    return new Map(state.vendors.map((v) => [v.id, v.name]));
  }, [state.vendors]);

  const handleOpenAddModal = () => {
    setFormTime('16:00');
    setFormActivity('');
    setFormDuration(60);
    setFormAssigned('');
    setFormVendorId('');
    setFormLocation(state.event.location || '');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: TimelineItem) => {
    setEditingItem(item);
    setFormTime(item.time);
    setFormActivity(item.activity);
    setFormDuration(item.durationMinutes);
    setFormAssigned(item.assignedPerson || '');
    setFormVendorId(item.vendorId || '');
    setFormLocation(item.location || '');
    setFormNotes(item.notes || '');
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formActivity.trim()) return;

    addTimelineItem({
      eventId: state.event.id,
      time: formTime,
      activity: formActivity.trim(),
      durationMinutes: Math.max(5, formDuration),
      assignedPerson: formAssigned.trim() || undefined,
      vendorId: formVendorId || undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formActivity.trim()) return;

    updateTimelineItem({
      ...editingItem,
      time: formTime,
      activity: formActivity.trim(),
      durationMinutes: Math.max(5, formDuration),
      assignedPerson: formAssigned.trim() || undefined,
      vendorId: formVendorId || undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
    setEditingItem(null);
  };

  const handleDelete = (itemId: string, activity: string) => {
    if (window.confirm(`Delete activity "${activity}" from the timeline?`)) {
      deleteTimelineItem(itemId);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const items = [...timeline];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    reorderTimeline(items.map((i) => i.id));
  };

  const handleMoveDown = (index: number) => {
    if (index >= timeline.length - 1) return;
    const items = [...timeline];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    reorderTimeline(items.map((i) => i.id));
  };

  const handlePrintRunSheet = () => {
    window.print();
  };

  // Calculate formatted end time given start time string (e.g. "17:15") and duration in minutes
  const calculateEndTime = (startTimeStr: string, duration: number): string => {
    const [hStr, mStr] = startTimeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return '';

    const totalMins = h * 60 + m + duration;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Printable Run Sheet Header (Shown only on Print, hidden on screen) */}
      <div className="print-only hidden mb-6 pb-4 border-b">
        <h1 className="font-serif-heading text-2xl font-bold">{state.event.name} — Official Event-Day Run Sheet</h1>
        <p className="text-xs text-stone-600 mt-1">
          Date: {state.event.date} • Venue: {state.event.location} • Generated via VowPilot V2
        </p>
      </div>

      {/* Top Banner Control Bar (Hidden on Print) */}
      <div className="no-print bg-surface border border-border-subtle rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-heading text-lg font-bold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#B85C3A] dark:text-[#C66B49]" />
            Event-Day Timeline & Master Run Sheet
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            Coordinate ceremony milestones, vendor load-ins, and guest movements with minute-level precision.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStarterModalOpen(true)}
            disabled={isReadOnly}
            data-testid="start-from-template-btn"
            className="px-3.5 py-1.5 rounded-lg border border-border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
            <span>Start from Template</span>
          </button>

          <button
            onClick={handlePrintRunSheet}
            data-testid="print-run-sheet-btn"
            className="px-3.5 py-1.5 rounded-lg border border-border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Run Sheet</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            disabled={isReadOnly}
            className="px-3.5 py-1.5 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* Timeline Conflict Warning Alert Banner */}
      {conflicts.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-[#332A20] border border-amber-300 dark:border-[#55462D] text-xs text-amber-900 dark:text-[#E5BD76]"
        >
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-[#E5BD76] shrink-0" />
            <span>Timeline Overlaps & Schedule Warnings ({conflicts.length})</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-amber-800 dark:text-[#C5B9B3]">
            {conflicts.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline Schedule Cards / Table */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xs">
        {timeline.length === 0 ? (
          <div className="text-center py-12 px-6 space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF0EB] dark:bg-[#2E2222] text-[#B85C3A] dark:text-[#E8D7C4] flex items-center justify-center mx-auto border border-[#E8C8BD]/80 dark:border-[#5C3830] shadow-2xs">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif-heading text-base font-semibold text-primary">
                Build Your Event Day Run Sheet
              </h4>
              <p className="text-xs text-secondary leading-relaxed">
                Start from a curated template for weddings, birthdays, corporate summits, or cultural festivals, or add custom activities one by one.
              </p>
            </div>
            {!isReadOnly && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsStarterModalOpen(true)}
                  data-testid="starter-run-sheet-empty-btn"
                  className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Starter Run Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-lg bg-subtle hover:bg-muted text-primary text-xs font-semibold border border-subtle transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Activity Manually</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#F4EFEA] dark:divide-[#26362C]">
            {timeline.map((item, index) => {
              const endTime = calculateEndTime(item.time, item.durationMinutes);
              const vendorName = item.vendorId ? vendorMap.get(item.vendorId) : undefined;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/60 dark:hover:bg-[#26362C]/40 transition"
                >
                  {/* Left: Time & Duration Column */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 text-left">
                      <span className="font-mono text-base font-bold text-primary">
                        {item.time}
                      </span>
                      {endTime && (
                        <span className="block text-[11px] font-mono text-tertiary">
                          until {endTime}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] border border-[#E8C8BD] dark:border-[#4D332B]">
                      {item.durationMinutes} min
                    </span>
                  </div>

                  {/* Center: Activity Name, Location, Lead & Notes */}
                  <div className="flex-1 space-y-1">
                    <h3 className="font-serif-heading text-sm sm:text-base font-semibold text-primary">
                      {item.activity}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#B85C3A]" />
                          <span>{item.location}</span>
                        </span>
                      )}
                      {item.assignedPerson && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-stone-500" />
                          <span>Lead: {item.assignedPerson}</span>
                        </span>
                      )}
                      {vendorName && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 rounded text-[11px]">
                          Vendor: <strong>{vendorName}</strong>
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-tertiary italic pt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Right Actions: Reorder, Edit, Delete (Hidden on Print) */}
                  <div className="no-print flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={isReadOnly || index === 0}
                      title="Move up"
                      className="p-1 rounded text-tertiary hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={isReadOnly || index === timeline.length - 1}
                      title="Move down"
                      className="p-1 rounded text-tertiary hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      disabled={isReadOnly}
                      title="Edit activity"
                      className="p-1 rounded text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer disabled:opacity-40"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.activity)}
                      disabled={isReadOnly}
                      title="Delete activity"
                      className="p-1 rounded text-tertiary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Timeline Item Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Add Schedule Activity</h3>
            <form onSubmit={handleSaveAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Activity Name *
                </label>
                <input
                  type="text"
                  required
                  value={formActivity}
                  onChange={(e) => setFormActivity(e.target.value)}
                  placeholder="e.g. Baraat Procession & Welcome Ceremony"
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    required
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Location / Area
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Courtyard Mandap"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Assigned Lead / Person
                  </label>
                  <input
                    type="text"
                    value={formAssigned}
                    onChange={(e) => setFormAssigned(e.target.value)}
                    placeholder="e.g. Wedding Coordinator"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              {state.vendors.length > 0 && (
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Associated Vendor (Optional)
                  </label>
                  <select
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] cursor-pointer"
                  >
                    <option value="">None</option>
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.categoryId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Coordination Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Audio cues, equipment arrival notes..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 border border-border-strong rounded-lg text-stone-600 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-lg transition shadow-xs cursor-pointer"
                >
                  Add Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Timeline Item Modal */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Edit Activity</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Activity Name *
                </label>
                <input
                  type="text"
                  required
                  value={formActivity}
                  onChange={(e) => setFormActivity(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    required
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Location / Area
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Assigned Lead
                  </label>
                  <input
                    type="text"
                    value={formAssigned}
                    onChange={(e) => setFormAssigned(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 border border-border-strong rounded-lg text-stone-600 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-lg transition shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Starter Run Sheet Modal */}
      <StarterRunSheetModal
        isOpen={isStarterModalOpen}
        onClose={() => setIsStarterModalOpen(false)}
        currentEventId={state.event.id}
        currentEventType={state.event.eventType}
        hasExistingActivities={timeline.length > 0}
        onApplyPreset={(items, strategy) => applyTimelinePreset(items, strategy)}
      />
    </div>
  );
};
