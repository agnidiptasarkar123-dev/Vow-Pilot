import React, { useState, useMemo } from 'react';
import { useEvent } from '../../context/EventContext';
import { formatCurrency } from '../../domain/currency';
import { calculateBudgetOverview } from '../../domain/budgetEngine';
import { VowPilotLogo } from '../common/VowPilotLogo';
import {
  FileText,
  Printer,
  Calendar,
  DollarSign,
  CheckSquare,
  Users,
  Clock,
  UserCheck,
} from 'lucide-react';

export const PlanningBriefView: React.FC = () => {
  const { state } = useEvent();

  // Section inclusion toggles
  const [includeFoundation, setIncludeFoundation] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeVendors, setIncludeVendors] = useState(true);
  const [includeGuests, setIncludeGuests] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [coordinatorNotes, setCoordinatorNotes] = useState(
    state.event.preferences.optionalNotes || ''
  );

  React.useEffect(() => {
    setCoordinatorNotes(state.event.preferences.optionalNotes || '');
  }, [state.event.id]);

  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);

  // Guest attendance summary
  const guestSummary = useMemo(() => {
    const list = state.guests || [];
    let invitedSeats = 0;
    let confirmedSeats = 0;
    let declined = 0;
    let pending = 0;

    list.forEach((g) => {
      invitedSeats += g.partySize;
      if (g.rsvpStatus === 'accepted') {
        confirmedSeats += g.confirmedCount > 0 ? g.confirmedCount : g.partySize;
      } else if (g.rsvpStatus === 'declined') {
        declined += 1;
      } else {
        pending += g.partySize;
      }
    });

    return {
      partiesCount: list.length,
      invitedSeats,
      confirmedSeats,
      declined,
      pending,
    };
  }, [state.guests]);

  const timelineSorted = useMemo(() => {
    const list = state.timeline || [];
    return [...list].sort((a, b) => a.orderIndex - b.orderIndex || a.time.localeCompare(b.time));
  }, [state.timeline]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Configuration Controls (Hidden on Print) */}
      <div className="no-print bg-surface border border-border-subtle rounded-xl p-5 mb-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-serif-heading text-lg font-bold text-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#B85C3A] dark:text-[#C66B49]" />
              Executive Event Planning Brief & Summary Pack
            </h2>
            <p className="text-xs text-tertiary mt-0.5">
              Select sections to include in the printable dossier for venue coordinators, vendors, or family hosts.
            </p>
          </div>

          <button
            onClick={handlePrint}
            data-testid="print-brief-btn"
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Executive Brief / PDF</span>
          </button>
        </div>

        {/* Section Inclusion Checkboxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-2 border-t border-subtle">
          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeFoundation}
              onChange={(e) => setIncludeFoundation(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>1. Foundation</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeBudget}
              onChange={(e) => setIncludeBudget(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>2. Budget</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeTasks}
              onChange={(e) => setIncludeTasks(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>3. Tasks & Risks</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeVendors}
              onChange={(e) => setIncludeVendors(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>4. Vendors</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeGuests}
              onChange={(e) => setIncludeGuests(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>5. Guest Attendance</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={includeTimeline}
              onChange={(e) => setIncludeTimeline(e.target.checked)}
              className="rounded border-subtle text-[#B85C3A] focus:ring-[#B85C3A]"
            />
            <span>6. Run Sheet</span>
          </label>
        </div>

        {/* Custom Coordinator Notes Field */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <label className="block text-xs font-medium text-secondary mb-1">
            Executive Coordinator Notes / Special Instructions
          </label>
          <textarea
            rows={2}
            value={coordinatorNotes}
            onChange={(e) => setCoordinatorNotes(e.target.value)}
            placeholder="Add specific instructions for on-site staff or vendors..."
            className="w-full bg-surface border border-subtle rounded-md px-3 py-1.5 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          />
        </div>
      </div>

      {/* The Printable Executive Brief Document Container */}
      <div className="bg-surface border border-subtle rounded-2xl p-6 sm:p-12 shadow-sm space-y-8 text-primary">
        {/* Document Header */}
        <div className="border-b border-border-subtle pb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <VowPilotLogo variant="compact" size="sm" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#B85C3A]">
                Official Planning Brief
              </span>
            </div>
            <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold tracking-tight">
              {state.event.name}
            </h1>
            <p className="text-xs text-tertiary mt-1">
              {state.event.eventType.toUpperCase()} • Generated on {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="text-right text-xs space-y-1">
            <div className="font-semibold">{state.event.location}</div>
            <div className="text-tertiary">Scheduled Date: {state.event.date}</div>
            <div className="text-tertiary">Total Guest Target: {state.event.guestCount}</div>
          </div>
        </div>

        {/* 1. Foundation & Scope */}
        {includeFoundation && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              1. Event Foundation & Operating Constraints
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-medium text-tertiary block">Aesthetic & Style Theme</span>
                <p className="font-semibold">{state.event.preferences.style || 'Custom curated'}</p>
              </div>
              <div className="space-y-1">
                <span className="font-medium text-tertiary block">Catering Style</span>
                <p className="font-semibold">{state.event.preferences.cateringType || 'Standard banquet'}</p>
              </div>
              {state.event.preferences.specialConstraints?.length > 0 && (
                <div className="sm:col-span-2 space-y-1">
                  <span className="font-medium text-tertiary block">Special Operational Constraints</span>
                  <ul className="list-disc list-inside text-stone-700 dark:text-stone-300">
                    {state.event.preferences.specialConstraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 2. Budget Summary & Variances */}
        {includeBudget && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              2. Financial Budget & Cost Breakdown
            </h2>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-subtle rounded-xl text-center text-xs">
              <div>
                <span className="text-tertiary block text-[11px]">Total Budget Cap</span>
                <span className="font-mono font-bold text-sm sm:text-base">
                  {formatCurrency(state.event.totalBudget, state.event.currency)}
                </span>
              </div>
              <div>
                <span className="text-tertiary block text-[11px]">Allocated Categories</span>
                <span className="font-mono font-bold text-sm sm:text-base">
                  {formatCurrency(overview.totalAllocated, state.event.currency)}
                </span>
              </div>
              <div>
                <span className="text-tertiary block text-[11px]">Safety Runway</span>
                <span className={`font-mono font-bold text-sm sm:text-base ${overview.isOverrun ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatCurrency(overview.remainingBudget, state.event.currency)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-subtle text-tertiary">
                    <th className="py-2">Category</th>
                    <th className="py-2 text-right">Allocated</th>
                    <th className="py-2 text-right">Committed</th>
                    <th className="py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {overview.categories.map((c) => (
                    <tr key={c.category.id}>
                      <td className="py-1.5 font-medium">{c.category.name}</td>
                      <td className="py-1.5 text-right font-mono">
                        {formatCurrency(c.category.allocatedAmount, state.event.currency)}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {formatCurrency(c.committedTotal, state.event.currency)}
                      </td>
                      <td className={`py-1.5 text-right font-mono font-semibold ${c.remainingAllocated < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {formatCurrency(c.remainingAllocated, state.event.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. Tasks & Operational Deadlines */}
        {includeTasks && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              3. Critical Action Items & Milestone Schedule
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-subtle text-tertiary">
                    <th className="py-2">Task Title</th>
                    <th className="py-2">Due Date</th>
                    <th className="py-2">Priority</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {state.tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="py-1.5 font-medium">{task.title}</td>
                      <td className="py-1.5 text-secondary font-mono">{task.dueDate}</td>
                      <td className="py-1.5 uppercase text-[10px] font-bold tracking-wider">{task.priority}</td>
                      <td className="py-1.5 capitalize">{task.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Vendors & Quotations */}
        {includeVendors && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <Users className="w-4 h-4" />
              4. Vendor Directory & Contact Roster
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-subtle text-tertiary">
                    <th className="py-2">Vendor Name</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Contact Person</th>
                    <th className="py-2">Phone / Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {state.vendors.map((v) => (
                    <tr key={v.id}>
                      <td className="py-1.5 font-semibold">{v.name}</td>
                      <td className="py-1.5 capitalize text-secondary">{v.categoryId}</td>
                      <td className="py-1.5">{v.contactName || 'Primary Coordinator'}</td>
                      <td className="py-1.5 font-mono text-[11px]">{v.phone} • {v.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Guest Attendance & Dietary Summary */}
        {includeGuests && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              5. Guest RSVP Attendance & Dietary Requirements
            </h2>

            <div className="grid grid-cols-4 gap-2 text-center p-3 bg-subtle rounded-xl text-xs">
              <div>
                <span className="text-tertiary block text-[10px]">Total Parties</span>
                <span className="font-bold">{guestSummary.partiesCount}</span>
              </div>
              <div>
                <span className="text-tertiary block text-[10px]">Invited Seats</span>
                <span className="font-bold">{guestSummary.invitedSeats}</span>
              </div>
              <div>
                <span className="text-emerald-800 dark:text-emerald-400 block text-[10px]">Confirmed Attending</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{guestSummary.confirmedSeats}</span>
              </div>
              <div>
                <span className="text-amber-800 dark:text-amber-400 block text-[10px]">Awaiting RSVP</span>
                <span className="font-bold text-amber-700 dark:text-amber-300">{guestSummary.pending}</span>
              </div>
            </div>
          </section>
        )}

        {/* 6. Event-Day Timeline Run Sheet */}
        {includeTimeline && (
          <section className="space-y-3">
            <h2 className="font-serif-heading text-base font-bold text-accent border-b border-subtle pb-1 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              6. Master Event-Day Run Sheet Schedule
            </h2>

            <div className="divide-y divide-subtle">
              {timelineSorted.map((item) => (
                <div key={item.id} className="py-2 flex items-start gap-4 text-xs">
                  <span className="font-mono font-bold w-16 text-accent shrink-0">
                    {item.time}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold block">{item.activity}</span>
                    <div className="text-[11px] text-tertiary flex gap-3 mt-0.5">
                      {item.location && <span>Location: {item.location}</span>}
                      {item.assignedPerson && <span>Lead: {item.assignedPerson}</span>}
                      <span>Duration: {item.durationMinutes}m</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coordinator Notes */}
        {coordinatorNotes && (
          <section className="pt-4 border-t border-border-subtle space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-tertiary block">
              Coordinator Notes & Site Instructions
            </span>
            <p className="text-xs italic leading-relaxed text-secondary">
              {coordinatorNotes}
            </p>
          </section>
        )}

        {/* Document Footer Signoff */}
        <div className="pt-6 border-t border-border-subtle flex items-center justify-between text-[10px] text-tertiary">
          <span>VowPilot V2 Celebration & Event Planner</span>
          <span>Verified Event Dossier • Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
};
