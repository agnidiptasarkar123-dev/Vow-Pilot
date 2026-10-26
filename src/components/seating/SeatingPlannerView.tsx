import React, { useState, useMemo } from 'react';
import { useEvent } from '../../context/EventContext';
import { SeatingTable, GuestRecord } from '../../types';
import { GenerateSeatingDraftModal } from './GenerateSeatingDraftModal';
import {
  LayoutGrid,
  Plus,
  AlertCircle,
  Printer,
  Trash2,
  Edit2,
  UserPlus,
  UserMinus,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export const SeatingPlannerView: React.FC = () => {
  const {
    state,
    addTable,
    updateTable,
    deleteTable,
    assignGuestToTable,
    removeGuestFromTable,
    applySeatingDraft,
    isReadOnly,
  } = useEvent();

  const tables = useMemo(() => state.tables || [], [state.tables]);
  const guests = useMemo(() => state.guests || [], [state.guests]);

  // Guest lookup map
  const guestMap = useMemo(() => {
    return new Map<string, GuestRecord>(guests.map((g) => [g.id, g]));
  }, [guests]);

  // Unassigned confirmed/attending guests
  const unassignedGuests = useMemo(() => {
    return guests.filter((g) => !g.tableId && g.rsvpStatus !== 'declined');
  }, [guests]);

  // Metrics
  const metrics = useMemo(() => {
    let totalCapacity = 0;
    let totalSeatedGuests = 0;
    let overloadedTables = 0;

    tables.forEach((t) => {
      totalCapacity += t.capacity;
      const seatedCount = t.assignedGuestIds.length;
      totalSeatedGuests += seatedCount;
      if (seatedCount > t.capacity) {
        overloadedTables += 1;
      }
    });

    return {
      tableCount: tables.length,
      totalCapacity,
      totalSeatedGuests,
      remainingSeats: Math.max(0, totalCapacity - totalSeatedGuests),
      unseatedGuestsCount: unassignedGuests.length,
      overloadedTables,
    };
  }, [tables, unassignedGuests]);

  // Modals state
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<SeatingTable | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCapacity, setFormCapacity] = useState(8);
  const [formShape, setFormShape] = useState<'round' | 'rectangular' | 'oval'>('round');
  const [formNotes, setFormNotes] = useState('');

  const handleAssignGuest = (guest: GuestRecord, tableId: string) => {
    const targetTable = tables.find((t) => t.id === tableId);
    const targetName = targetTable ? targetTable.name : 'Table';
    assignGuestToTable(guest.id, tableId);
    const newCount = targetTable ? targetTable.assignedGuestIds.length + 1 : 1;
    if (targetTable && newCount > targetTable.capacity) {
      setLiveAnnouncement(`Warning: ${targetName} is now over capacity with ${newCount} of ${targetTable.capacity} seats assigned.`);
    } else {
      setLiveAnnouncement(`${guest.name} seated at ${targetName}.`);
    }
  };

  const handleRemoveGuest = (guest: GuestRecord, tableName: string) => {
    removeGuestFromTable(guest.id);
    setLiveAnnouncement(`${guest.name} removed from ${tableName} and is now unassigned.`);
  };

  const handleOpenAdd = () => {
    setFormName(`Table ${tables.length + 1}`);
    setFormCapacity(8);
    setFormShape('round');
    setFormNotes('');
    setIsAddTableOpen(true);
  };

  const handleOpenEdit = (t: SeatingTable) => {
    setEditingTable(t);
    setFormName(t.name);
    setFormCapacity(t.capacity);
    setFormShape(t.shape);
    setFormNotes(t.notes || '');
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    addTable({
      eventId: state.event.id,
      name: formName.trim(),
      capacity: Math.max(1, formCapacity),
      shape: formShape,
      notes: formNotes.trim() || undefined,
    });
    setLiveAnnouncement(`Table "${formName.trim()}" added with capacity for ${formCapacity} guests.`);
    setIsAddTableOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !formName.trim()) return;

    updateTable({
      ...editingTable,
      name: formName.trim(),
      capacity: Math.max(1, formCapacity),
      shape: formShape,
      notes: formNotes.trim() || undefined,
    });
    setLiveAnnouncement(`Table "${formName.trim()}" updated.`);
    setEditingTable(null);
  };

  const handleDelete = (tableId: string, name: string) => {
    if (window.confirm(`Delete "${name}"? Seated guests will become unassigned.`)) {
      deleteTable(tableId);
      setLiveAnnouncement(`Table "${name}" deleted. Seated guests are now unassigned.`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Screen Reader ARIA Live Region for Immediate Auditory Feedback */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      {/* Printable Title (Print Only) */}
      <div className="print-only hidden mb-6 pb-4 border-b">
        <h1 className="font-serif-heading text-2xl font-bold">{state.event.name} — Guest Seating Plan</h1>
        <p className="text-xs text-stone-600 mt-1">
          Date: {state.event.date} • Venue: {state.event.location} • Confirmed Seated: {metrics.totalSeatedGuests}
        </p>
      </div>

      {/* Seating KPIs Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tertiary">Total Tables</span>
            <LayoutGrid className="w-4 h-4 text-tertiary" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-primary">
            {metrics.tableCount}
          </p>
          <span className="text-[11px] text-tertiary">{metrics.totalCapacity} total seat capacity</span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Assigned Guests</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {metrics.totalSeatedGuests}
          </p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            {metrics.remainingSeats} remaining vacant seats
          </span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-400">Unassigned Guests</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {metrics.unseatedGuestsCount}
          </p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Awaiting table assignment</span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">Over-Capacity Tables</span>
            <AlertCircle className={`w-4 h-4 ${metrics.overloadedTables > 0 ? 'text-rose-600' : 'text-stone-400'}`} />
          </div>
          <p className={`mt-2 text-2xl font-bold font-mono ${metrics.overloadedTables > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-stone-700 dark:text-stone-300'}`}>
            {metrics.overloadedTables}
          </p>
          <span className="text-[11px] text-stone-500">
            {metrics.overloadedTables > 0 ? 'Requires re-balancing' : 'All tables within limits'}
          </span>
        </div>
      </div>

      {/* Control Bar (No Print) */}
      <div className="no-print bg-surface border border-border-subtle rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-heading text-lg font-bold text-primary flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#B85C3A] dark:text-[#C66B49]" />
            Reception & Banquet Seating Planner
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Organize banquet tables, balance guest party sizes, and generate accessible seating charts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDraftModalOpen(true)}
            disabled={isReadOnly}
            data-testid="generate-seating-draft-btn"
            className="px-3.5 py-1.5 rounded-lg border border-border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
            <span>Generate Seating Draft</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg border border-border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Seating Chart</span>
          </button>

          <button
            onClick={handleOpenAdd}
            disabled={isReadOnly}
            className="px-3.5 py-1.5 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Unassigned Guests Tray (No Print) */}
      {unassignedGuests.length > 0 && (
        <div className="no-print bg-[#FAF0EB] dark:bg-[#2B211E] border border-[#E8C8BD] dark:border-[#4D332B] rounded-xl p-4 mb-6 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif-heading text-xs font-bold uppercase tracking-wider text-[#B85C3A] dark:text-[#E8D7C4] flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              Unassigned Guests Awaiting Seating ({unassignedGuests.length})
            </h3>
            <span className="text-[11px] text-tertiary">
              Select a table below to seat each guest party
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
            {unassignedGuests.map((guest) => (
              <div
                key={guest.id}
                className="bg-surface border border-border-subtle rounded-lg px-3 py-2 flex items-center gap-3 text-xs shadow-2xs"
              >
                <div>
                  <span className="font-semibold block">{guest.name}</span>
                  <span className="text-[10px] text-stone-500">
                    Party of {guest.partySize} {guest.householdGroup ? `• ${guest.householdGroup}` : ''}
                  </span>
                </div>

                {tables.length > 0 && (
                  <select
                    disabled={isReadOnly}
                    aria-label={`Assign ${guest.name} to a reception table`}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignGuest(guest, e.target.value);
                      }
                    }}
                    defaultValue=""
                    className="bg-subtle border border-border-strong rounded-md px-2 py-1 text-[11px] font-semibold text-primary cursor-pointer"
                  >
                    <option value="" disabled>
                      Assign to...
                    </option>
                    {tables.map((tbl) => (
                      <option key={tbl.id} value={tbl.id}>
                        {tbl.name} ({tbl.assignedGuestIds.length}/{tbl.capacity})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables Grid */}
      {tables.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl text-center py-12 px-6 shadow-xs max-w-2xl mx-auto my-6">
          <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-6 h-6 text-[#B85C3A] dark:text-[#D48668]" />
          </div>
          <h4 className="font-serif-heading text-lg font-semibold text-primary">
            No seating arrangement configured
          </h4>
          <p className="text-xs text-secondary max-w-md mx-auto mt-1 mb-5 leading-relaxed">
            Generate an intelligent seating plan based on confirmed guest counts and household groupings, or add tables manually to arrange your hall.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsDraftModalOpen(true)}
              disabled={isReadOnly}
              data-testid="empty-generate-seating-draft-btn"
              className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Seating Draft</span>
            </button>
            <button
              onClick={handleOpenAdd}
              disabled={isReadOnly}
              className="px-4 py-2 rounded-lg border border-border-subtle hover:bg-subtle text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              <span>Add Table Manually</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => {
            const seatedCount = table.assignedGuestIds.length;
            const isFull = seatedCount === table.capacity;
            const isOverCapacity = seatedCount > table.capacity;
            const remaining = table.capacity - seatedCount;

            return (
              <div
                key={table.id}
                className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs flex flex-col justify-between"
              >
                {/* Table Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-serif-heading text-base font-bold text-primary">
                        {table.name}
                      </h3>
                      <span className="text-[11px] capitalize text-tertiary">
                        {table.shape} Table
                      </span>
                    </div>

                    {/* Capacity Badge */}
                    <div className="text-right">
                      {isOverCapacity ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-300 dark:border-rose-800">
                          Over Capacity ({seatedCount}/{table.capacity})
                        </span>
                      ) : isFull ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200 dark:border-emerald-800">
                          Full ({seatedCount}/{table.capacity})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-[10px]">
                          {seatedCount} / {table.capacity} Seats ({remaining} left)
                        </span>
                      )}
                    </div>
                  </div>

                  {table.notes && (
                    <p className="text-[11px] text-tertiary italic mb-3">
                      {table.notes}
                    </p>
                  )}

                  {/* Seated Guests List */}
                  <div className="space-y-1.5 my-3 border-t border-[#F4EFEA] dark:border-[#26362C] pt-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 block mb-1">
                      Seated Guests ({seatedCount})
                    </span>

                    {table.assignedGuestIds.length === 0 ? (
                      <p className="text-xs text-stone-400 italic py-2">No guests seated at this table.</p>
                    ) : (
                      table.assignedGuestIds.map((guestId) => {
                        const guest = guestMap.get(guestId);
                        if (!guest) return null;

                        return (
                          <div
                            key={guestId}
                            className="bg-subtle rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-medium text-primary block">
                                {guest.name}
                              </span>
                              <span className="text-[10px] text-stone-500">
                                Party of {guest.partySize} {guest.dietaryNotes ? `• ${guest.dietaryNotes}` : ''}
                              </span>
                            </div>

                            {/* Accessible Re-assign / Remove Actions */}
                            <div className="no-print flex items-center gap-1">
                              {/* Re-assign dropdown */}
                              <select
                                disabled={isReadOnly}
                                aria-label={`Move ${guest.name} from ${table.name} to another table`}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignGuest(guest, e.target.value);
                                  }
                                }}
                                defaultValue=""
                                title={`Move ${guest.name} to another table`}
                                className="bg-surface border border-border-strong rounded text-[10px] px-1 py-0.5 cursor-pointer"
                              >
                                <option value="" disabled>
                                  Move...
                                </option>
                                {tables
                                  .filter((t) => t.id !== table.id)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                              </select>

                              {/* Unseat button */}
                              <button
                                onClick={() => handleRemoveGuest(guest, table.name)}
                                disabled={isReadOnly}
                                aria-label={`Remove ${guest.name} from ${table.name}`}
                                title={`Remove ${guest.name} from ${table.name}`}
                                className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <UserMinus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Table Footer Controls (No Print) */}
                <div className="no-print pt-3 border-t border-[#F4EFEA] dark:border-[#26362C] flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEdit(table)}
                    disabled={isReadOnly}
                    className="text-xs text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5] flex items-center gap-1 transition cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(table.id, table.name)}
                    disabled={isReadOnly}
                    className="text-xs text-stone-400 hover:text-rose-600 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Add Reception Table</h3>
            <form onSubmit={handleSaveAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Table Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Table 1 — High Table"
                  className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Seat Capacity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(parseInt(e.target.value, 10) || 8)}
                    className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A] text-primary"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Table Shape
                  </label>
                  <select
                    value={formShape}
                    onChange={(e) => setFormShape(e.target.value as 'round' | 'rectangular' | 'oval')}
                    className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] cursor-pointer text-primary"
                  >
                    <option value="round">Round</option>
                    <option value="oval">Oval</option>
                    <option value="rectangular">Rectangular</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Notes / Location Placement
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Near stage, reserved for immediate family"
                  className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] text-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-3.5 py-1.5 border border-border-strong rounded-lg text-secondary hover:bg-subtle transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-lg transition shadow-xs cursor-pointer"
                >
                  Add Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Edit Table</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Table Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Seat Capacity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(parseInt(e.target.value, 10) || 8)}
                    className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 font-mono focus:ring-1 focus:ring-[#B85C3A] text-primary"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Table Shape
                  </label>
                  <select
                    value={formShape}
                    onChange={(e) => setFormShape(e.target.value as 'round' | 'rectangular' | 'oval')}
                    className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] cursor-pointer text-primary"
                  >
                    <option value="round">Round</option>
                    <option value="oval">Oval</option>
                    <option value="rectangular">Rectangular</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] text-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-3.5 py-1.5 border border-border-strong rounded-lg text-secondary hover:bg-subtle transition cursor-pointer"
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

      {/* Generate Seating Draft Modal */}
      <GenerateSeatingDraftModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        currentEventId={state.event.id}
        guests={guests}
        existingTables={tables}
        onApplyDraft={(newTables, updatedGuests, description) =>
          applySeatingDraft(newTables, updatedGuests, description)
        }
      />
    </div>
  );
};
