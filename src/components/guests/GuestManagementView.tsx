import React, { useState, useMemo } from 'react';
import { useEvent } from '../../context/EventContext';
import { GuestRecord, RsvpStatus } from '../../types';
import { formatGuestsCsv } from '../../context/slices/guestSlice';
import { PublicRsvpModal } from '../rsvp/PublicRsvpModal';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Plus,
  Search,
  Download,
  Share2,
  Edit2,
  Trash2,
  CheckCircle2,
  Utensils,
  Accessibility,
} from 'lucide-react';

export const GuestManagementView: React.FC = () => {
  const {
    state,
    addGuest,
    updateGuest,
    deleteGuest,
    isReadOnly,
  } = useEvent();

  const guests = useMemo(() => state.guests || [], [state.guests]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RsvpStatus>('all');
  const [householdFilter, setHouseholdFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestRecord | null>(null);
  const [activeRsvpToken, setActiveRsvpToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form state for Add/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formHousehold, setFormHousehold] = useState('');
  const [formPartySize, setFormPartySize] = useState(1);
  const [formStatus, setFormStatus] = useState<RsvpStatus>('pending');
  const [formDietary, setFormDietary] = useState('');
  const [formAccessibility, setFormAccessibility] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Extract distinct households
  const households = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g) => {
      if (g.householdGroup?.trim()) {
        set.add(g.householdGroup.trim());
      }
    });
    return Array.from(set).sort();
  }, [guests]);

  // Attendance metrics
  const metrics = useMemo(() => {
    let totalInvitedSeats = 0;
    let confirmedSeats = 0;
    let declinedCount = 0;
    let pendingSeats = 0;

    guests.forEach((g) => {
      totalInvitedSeats += g.partySize;
      if (g.rsvpStatus === 'accepted') {
        confirmedSeats += g.confirmedCount > 0 ? g.confirmedCount : g.partySize;
      } else if (g.rsvpStatus === 'declined') {
        declinedCount += 1;
      } else {
        pendingSeats += g.partySize;
      }
    });

    return {
      totalGuests: guests.length,
      totalInvitedSeats,
      confirmedSeats,
      declinedCount,
      pendingSeats,
    };
  }, [guests]);

  // Filtered list
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      if (statusFilter !== 'all' && g.rsvpStatus !== statusFilter) return false;
      if (householdFilter !== 'all' && g.householdGroup !== householdFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = g.name.toLowerCase().includes(q);
        const matchesEmail = g.email?.toLowerCase().includes(q) || false;
        const matchesPhone = g.phone?.toLowerCase().includes(q) || false;
        const matchesHousehold = g.householdGroup?.toLowerCase().includes(q) || false;
        const matchesDietary = g.dietaryNotes?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesHousehold && !matchesDietary) {
          return false;
        }
      }
      return true;
    });
  }, [guests, statusFilter, householdFilter, searchQuery]);

  // Open Add modal with clean state
  const handleOpenAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormHousehold('');
    setFormPartySize(1);
    setFormStatus('pending');
    setFormDietary('');
    setFormAccessibility('');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (guest: GuestRecord) => {
    setEditingGuest(guest);
    setFormName(guest.name);
    setFormEmail(guest.email || '');
    setFormPhone(guest.phone || '');
    setFormHousehold(guest.householdGroup || '');
    setFormPartySize(guest.partySize);
    setFormStatus(guest.rsvpStatus);
    setFormDietary(guest.dietaryNotes || '');
    setFormAccessibility(guest.accessibilityRequirements || '');
    setFormNotes(guest.notes || '');
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    addGuest({
      eventId: state.event.id,
      name: formName.trim(),
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      householdGroup: formHousehold.trim() || undefined,
      partySize: Math.max(1, formPartySize),
      confirmedCount: formStatus === 'accepted' ? formPartySize : 0,
      rsvpStatus: formStatus,
      dietaryNotes: formDietary.trim() || undefined,
      accessibilityRequirements: formAccessibility.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest || !formName.trim()) return;

    updateGuest({
      ...editingGuest,
      name: formName.trim(),
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      householdGroup: formHousehold.trim() || undefined,
      partySize: Math.max(1, formPartySize),
      confirmedCount: formStatus === 'accepted' ? Math.min(editingGuest.confirmedCount || formPartySize, formPartySize) : 0,
      rsvpStatus: formStatus,
      dietaryNotes: formDietary.trim() || undefined,
      accessibilityRequirements: formAccessibility.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
    setEditingGuest(null);
  };

  const handleDelete = (guestId: string, guestName: string) => {
    if (window.confirm(`Remove "${guestName}" from the guest list?`)) {
      deleteGuest(guestId);
    }
  };

  const handleCopyRsvpLink = (guest: GuestRecord) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vowpilot.vercel.app';
    const rsvpUrl = `${origin}/?rsvpToken=${guest.invitationToken}`;
    navigator.clipboard.writeText(rsvpUrl);
    setCopiedToken(guest.invitationToken);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleExportCsv = () => {
    if (guests.length === 0) {
      alert('No guests to export.');
      return;
    }

    const csvContent = formatGuestsCsv(guests);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VowPilot_Guests_${state.event.name.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Attendance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tertiary">Total Invited</span>
            <Users className="w-4 h-4 text-tertiary" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-primary">
            {metrics.totalInvitedSeats} <span className="text-xs font-normal text-stone-500">seats</span>
          </p>
          <span className="text-[11px] text-tertiary">{metrics.totalGuests} parties</span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Confirmed Attending</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {metrics.confirmedSeats} <span className="text-xs font-normal">seats</span>
          </p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            {metrics.totalInvitedSeats > 0
              ? `${Math.round((metrics.confirmedSeats / metrics.totalInvitedSeats) * 100)}% attendance rate`
              : '0% attendance'}
          </span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-400">Awaiting Response</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {metrics.pendingSeats} <span className="text-xs font-normal">seats</span>
          </p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Pending follow-up</span>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 dark:text-rose-400">Regretfully Declined</span>
            <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
            {metrics.declinedCount} <span className="text-xs font-normal">parties</span>
          </p>
          <span className="text-[11px] text-rose-700/80 dark:text-rose-400/80">Not attending</span>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Export */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests, household, dietary..."
              className="w-full bg-subtle border border-border-strong rounded-lg pl-9 pr-3 py-1.5 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 border border-border-subtle rounded-lg p-0.5 bg-subtle">
            {(['all', 'accepted', 'pending', 'declined'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-surface text-[#B85C3A] dark:text-[#E8D7C4] shadow-xs'
                    : 'text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Household Dropdown */}
          {households.length > 0 && (
            <select
              value={householdFilter}
              onChange={(e) => setHouseholdFilter(e.target.value)}
              className="bg-subtle border border-border-strong rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary cursor-pointer"
            >
              <option value="all">All Groups ({households.length})</option>
              {households.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={guests.length === 0}
            className="px-3 py-1.5 rounded-lg border border-border-subtle hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] text-secondary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            disabled={isReadOnly}
            className="px-3.5 py-1.5 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Guest</span>
          </button>
        </div>
      </div>

      {/* Guest Table / Empty State */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xs">
        {filteredGuests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Users className="w-8 h-8 text-[#A8A29E] dark:text-[#78716C] mx-auto mb-2" />
            <h4 className="font-serif-heading text-base font-semibold text-primary">
              No guests found
            </h4>
            <p className="text-xs text-tertiary max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== 'all' || householdFilter !== 'all'
                ? 'Try adjusting your search query or filters to find guests.'
                : 'Get started by clicking "+ Add Guest" to organize attendees, send RSVP links, and track dietary needs.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-subtle text-secondary font-semibold">
                  <th className="py-3 px-4">Guest Name & Group</th>
                  <th className="py-3 px-4">RSVP Status</th>
                  <th className="py-3 px-4 text-center">Party Size</th>
                  <th className="py-3 px-4 text-center">Confirmed</th>
                  <th className="py-3 px-4">Dietary & Accessibility</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EFEA] dark:divide-[#26362C] text-primary">
                {filteredGuests.map((guest) => {
                  const isCopied = copiedToken === guest.invitationToken;
                  return (
                    <tr
                      key={guest.id}
                      className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#26362C]/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sm">{guest.name}</div>
                        {guest.householdGroup && (
                          <span className="inline-block px-2 py-0.5 text-[10px] rounded-full bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] font-medium border border-[#E8C8BD] dark:border-[#4D332B] mt-0.5">
                            {guest.householdGroup}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {guest.rsvpStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Accepted
                          </span>
                        ) : guest.rsvpStatus === 'declined' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                            <UserX className="w-3 h-3" />
                            Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-medium">
                        {guest.partySize}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {guest.rsvpStatus === 'accepted' ? guest.confirmedCount : 0}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="space-y-0.5 text-[11px]">
                          {guest.dietaryNotes && (
                            <div className="flex items-center gap-1 text-stone-600 dark:text-stone-300">
                              <Utensils className="w-3 h-3 text-[#B85C3A] shrink-0" />
                              <span className="truncate">{guest.dietaryNotes}</span>
                            </div>
                          )}
                          {guest.accessibilityRequirements && (
                            <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                              <Accessibility className="w-3 h-3 shrink-0" />
                              <span className="truncate">{guest.accessibilityRequirements}</span>
                            </div>
                          )}
                          {!guest.dietaryNotes && !guest.accessibilityRequirements && (
                            <span className="text-stone-400 italic">None specified</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        <div>{guest.email || <span className="text-stone-400 italic">No email</span>}</div>
                        <div className="text-stone-500">{guest.phone}</div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test RSVP Link / Open Public Modal */}
                          <button
                            onClick={() => setActiveRsvpToken(guest.invitationToken)}
                            title="Preview and test public RSVP form for this guest"
                            className="p-1 rounded text-[#B85C3A] dark:text-[#E8D7C4] hover:bg-[#FAF0EB] dark:hover:bg-[#2B211E] transition cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy RSVP Link */}
                          <button
                            onClick={() => handleCopyRsvpLink(guest)}
                            title="Copy dedicated RSVP link to clipboard"
                            className="px-2 py-0.5 text-[10px] font-semibold rounded border border-border-subtle hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer"
                          >
                            {isCopied ? 'Copied!' : 'Copy Link'}
                          </button>

                          {/* Edit Guest */}
                          <button
                            onClick={() => handleOpenEditModal(guest)}
                            disabled={isReadOnly}
                            title="Edit guest information"
                            className="p-1 rounded text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer disabled:opacity-40"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Guest */}
                          <button
                            onClick={() => handleDelete(guest.id, guest.name)}
                            disabled={isReadOnly}
                            title="Remove guest"
                            className="p-1 rounded text-tertiary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Guest Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Add Guest to Event</h3>
            <form onSubmit={handleSaveAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Full Name / Household Title *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Mr. & Mrs. Rajesh Mukherjee"
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Group / Household
                  </label>
                  <input
                    type="text"
                    value={formHousehold}
                    onChange={(e) => setFormHousehold(e.target.value)}
                    placeholder="e.g. Groom Family"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Party Size (Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formPartySize}
                    onChange={(e) => setFormPartySize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98000 00000"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Dietary Requirements
                </label>
                <input
                  type="text"
                  value={formDietary}
                  onChange={(e) => setFormDietary(e.target.value)}
                  placeholder="e.g. Vegetarian, Jain counter, Peanut allergy"
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Accessibility Requests
                </label>
                <input
                  type="text"
                  value={formAccessibility}
                  onChange={(e) => setFormAccessibility(e.target.value)}
                  placeholder="e.g. Wheelchair access, ground-floor seating"
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
                  Add Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-canvas border border-border-subtle rounded-2xl shadow-xl p-6 text-primary">
            <h3 className="font-serif-heading text-lg font-bold mb-4">Edit Guest Record</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-secondary mb-1">
                  Full Name / Household Title *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    RSVP Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as RsvpStatus)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A] cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Party Size (Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formPartySize}
                    onChange={(e) => setFormPartySize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Group / Household
                  </label>
                  <input
                    type="text"
                    value={formHousehold}
                    onChange={(e) => setFormHousehold(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-secondary mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-secondary mb-1">
                  Dietary Notes
                </label>
                <input
                  type="text"
                  value={formDietary}
                  onChange={(e) => setFormDietary(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGuest(null)}
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

      {/* Public RSVP Modal Test View */}
      {activeRsvpToken && (
        <PublicRsvpModal
          isOpen={!!activeRsvpToken}
          token={activeRsvpToken}
          onClose={() => setActiveRsvpToken(null)}
        />
      )}
    </div>
  );
};
