import React, { useRef, useState, useEffect } from 'react';
import { useEvent } from '../../context/EventContext';
import { exportEventData, validateImportedJson } from '../../persistence/importExport';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from '../../persistence/storage';
import { parseDisplayToMinor, formatCurrency } from '../../domain/currency';
import { CurrencyCode, EventType } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    state,
    updateEvent,
    resetToDemo,
    importState,
    clearAllData,
    currentUser,
    collabState,
    setAuthModalOpen,
    allEvents,
    switchEvent,
  } = useEvent();

  // Form State
  const [eventName, setEventName] = useState(state.event.name);
  const [eventType, setEventType] = useState<EventType>(state.event.eventType);
  const [date, setDate] = useState(state.event.date);
  const [location, setLocation] = useState(state.event.location);
  const [guestCount, setGuestCount] = useState(state.event.guestCount);
  const [budgetDisplay, setBudgetDisplay] = useState((state.event.totalBudget / 100).toString());
  const [currency, setCurrency] = useState<CurrencyCode>(state.event.currency);
  const [style, setStyle] = useState(state.event.preferences.style);
  const [cateringType, setCateringType] = useState(state.event.preferences.cateringType);
  const [notes, setNotes] = useState(state.event.preferences.optionalNotes);

  // Sync state when active event is switched
  useEffect(() => {
    setEventName(state.event.name);
    setEventType(state.event.eventType);
    setDate(state.event.date);
    setLocation(state.event.location);
    setGuestCount(state.event.guestCount);
    setBudgetDisplay((state.event.totalBudget / 100).toString());
    setCurrency(state.event.currency);
    setStyle(state.event.preferences.style);
    setCateringType(state.event.preferences.cateringType);
    setNotes(state.event.preferences.optionalNotes);
  }, [state.event.id, state.event.updatedAt]);

  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage metric calculation
  let storageKb = '0.0';
  try {
    const rawStored = localStorage.getItem(STORAGE_KEY) || '';
    storageKb = (new Blob([rawStored]).size / 1024).toFixed(1);
  } catch {
    storageKb = '0.0';
  }

  const handleSavePreferences = () => {
    const budgetMinor = parseDisplayToMinor(budgetDisplay);
    updateEvent({
      ...state.event,
      name: eventName,
      eventType,
      date,
      location,
      guestCount,
      totalBudget: budgetMinor,
      currency,
      preferences: {
        ...state.event.preferences,
        style,
        cateringType,
        optionalNotes: notes,
      },
    });

    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleExport = () => {
    exportEventData(state);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateImportedJson(content);
      if (result.success && result.state) {
        importState(result.state);
        setImportError(null);
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError(result.error || 'Failed to import JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetWithConfirm = () => {
    if (window.confirm('Reset all event data to the original Jaipur Heritage Wedding demo state? Unsaved customizations will be replaced.')) {
      resetToDemo();
    }
  };

  const handleClearWithConfirm = () => {
    if (window.confirm('Clear all local browser data? This permanently resets the workspace storage.')) {
      clearAllData();
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary font-serif-heading">
          Event Settings & Local Data Management
        </h1>
        <p className="text-xs text-secondary mt-1">
          Adjust core constraints, create JSON backups, or audit client-side browser storage health.
        </p>
      </div>

      {saveSuccessNotice && (
        <div role="status" aria-live="polite" className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-emerald-400" />
          <span>Event preferences and budget constraints successfully saved!</span>
        </div>
      )}

      {importSuccess && (
        <div role="status" aria-live="polite" className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-emerald-400" />
          <span>JSON event state imported and validated successfully!</span>
        </div>
      )}

      {importError && (
        <div role="alert" aria-live="assertive" className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-900 dark:text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#BE123C] dark:text-rose-400" />
          <span>{importError}</span>
        </div>
      )}

      {/* Multi-Event Workspace Roster */}
      {allEvents && allEvents.length > 1 && (
        <div className="bg-surface p-6 rounded-xl border border-subtle shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-primary font-serif-heading">
              Events in Workspace
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              Switch active planning context between configured events. Each event maintains strictly isolated budgets, categories, and financial data.
            </p>
          </div>

          <div className="space-y-2.5">
            {allEvents.map((evt) => {
              const isActive = evt.id === state.event.id;
              return (
                <div
                  key={evt.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg border gap-3 transition ${
                    isActive
                      ? 'bg-accent-subtle/50 border-accent/40 text-primary'
                      : 'bg-subtle border-subtle text-secondary'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary text-sm">{evt.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary mt-1">
                      {evt.date} • Budget: <span className="font-mono font-semibold text-primary">{formatCurrency(evt.totalBudget, evt.currency)}</span> • {evt.guestCount} Guests
                    </p>
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => switchEvent(evt.id)}
                      data-testid={`switch-event-btn-${evt.id}`}
                      className="px-3 py-1.5 rounded-md bg-surface border border-subtle hover:bg-muted text-primary text-xs font-semibold cursor-pointer shadow-2xs transition"
                    >
                      Switch to Event
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form: Core Event Details */}
      <div className="bg-surface p-6 rounded-xl border border-subtle shadow-xs space-y-5">
        <h3 className="text-base font-bold text-primary font-serif-heading">
          Edit Event Constraints
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="settings-event-name" className="block font-semibold text-primary mb-1">Event Title</label>
            <input
              id="settings-event-name"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-type" className="block font-semibold text-primary mb-1">Event Type</label>
            <select
              id="settings-event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            >
              <option value="wedding">Wedding</option>
              <option value="anniversary">Anniversary</option>
              <option value="birthday">Milestone Birthday</option>
              <option value="corporate">Corporate</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="settings-event-date" className="block font-semibold text-primary mb-1">Date</label>
            <input
              id="settings-event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-location" className="block font-semibold text-primary mb-1">City / Venue Location</label>
            <input
              id="settings-event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-guests" className="block font-semibold text-primary mb-1">Confirmed Guest Count</label>
            <input
              id="settings-event-guests"
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 0)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-budget" className="block font-semibold text-primary mb-1">Total Target Budget</label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                aria-label="Event Currency"
                className="w-24 text-xs px-2 py-2 border border-subtle rounded-md bg-subtle text-primary"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
              <input
                id="settings-event-budget"
                type="text"
                value={budgetDisplay}
                onChange={(e) => setBudgetDisplay(e.target.value)}
                className="flex-1 text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
              />
            </div>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-style" className="block font-semibold text-primary mb-1">Event Style & Tone</label>
            <input
              id="settings-event-style"
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-catering" className="block font-semibold text-primary mb-1">Catering Format</label>
            <input
              id="settings-event-catering"
              type="text"
              value={cateringType}
              onChange={(e) => setCateringType(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-notes" className="block font-semibold text-primary mb-1">Optional Notes</label>
            <textarea
              id="settings-event-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSavePreferences}
            className="px-5 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
          >
            Save Constraint Changes
          </button>
        </div>
      </div>

      {/* JSON Import & Export Tools */}
      <div className="bg-surface p-6 rounded-xl border border-subtle shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-primary font-serif-heading">
            Data Portability & Backup
          </h3>
          <p className="text-xs text-secondary">
            Export complete plans as portable JSON files or restore from an existing backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            className="px-4 py-2.5 rounded-md bg-primary text-surface hover:opacity-90 text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Event JSON Backup
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-md bg-surface border border-subtle text-primary hover:bg-subtle text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#B85C3A] dark:text-[#D48668]" />
            Import JSON Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Storage Health & Privacy Audit */}
      <div className="bg-surface p-6 rounded-xl border border-subtle shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="w-5 h-5 text-[#047857] dark:text-emerald-400" />
          <h3 className="text-base font-bold font-serif-heading">
            Privacy & Client-Side Storage Audit
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-subtle rounded-lg border border-subtle space-y-0.5">
            <span className="text-secondary font-semibold">Local Storage</span>
            <p className="font-mono text-sm font-bold text-primary">Browser LocalStorage</p>
            <span className="text-[10px] text-muted">Client-side zero-latency cache</span>
          </div>

          <div className="p-3 bg-subtle rounded-lg border border-subtle space-y-0.5">
            <span className="text-secondary font-semibold">Storage Schema</span>
            <p className="font-mono text-sm font-bold text-primary">Version {CURRENT_SCHEMA_VERSION} (Active)</p>
            <span className="text-[10px] text-muted">Validated schema structure</span>
          </div>

          <div className="p-3 bg-subtle rounded-lg border border-subtle space-y-0.5">
            <span className="text-secondary font-semibold">Local Footprint</span>
            <p className="font-mono text-sm font-bold text-primary">{storageKb} KB</p>
            <span className="text-[10px] text-muted">Below 5MB browser quota</span>
          </div>

          <div className="p-3 bg-subtle rounded-lg border border-subtle space-y-0.5">
            <span className="text-secondary font-semibold">Cloud Sync & Auth</span>
            <p className="font-mono text-sm font-bold text-primary">
              {currentUser ? ((collabState.status === 'synced' || collabState.status === 'syncing') ? `Live (Rev #${collabState.serverVersion})` : 'Cloud Ready') : 'Local Mode'}
            </p>
            <span className="text-[10px] text-muted">
              {currentUser ? `User: ${currentUser.name}` : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="text-[#B85C3A] dark:text-[#D48668] underline hover:font-bold cursor-pointer"
                >
                  Sign in to sync
                </button>
              )}
            </span>
          </div>
        </div>

        <p className="text-xs text-secondary leading-relaxed">
          <strong>Offline-First Architecture:</strong> VowPilot functions reliably offline using client-side Browser LocalStorage. When signed in to your account, events can be synchronized to the backend cloud database for multi-user collaboration and role-based permissions. No third-party ad networks or trackers are loaded.
        </p>

        {/* Danger Zone Actions */}
        <div className="pt-3 border-t border-subtle flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetWithConfirm}
            className="px-3.5 py-2 rounded-md bg-surface border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-subtle text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Clean Jaipur Demo Dataset
          </button>

          <button
            onClick={handleClearWithConfirm}
            className="px-3.5 py-2 rounded-md bg-surface border border-red-300 dark:border-red-800 text-red-700 dark:text-rose-300 hover:bg-subtle text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Local Application Storage
          </button>
        </div>
      </div>
    </div>
  );
};
