import React, { useRef, useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { exportEventData, validateImportedJson } from '../../persistence/importExport';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from '../../persistence/storage';
import { parseDisplayToMinor } from '../../domain/currency';
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
  const { state, updateEvent, resetToDemo, importState, clearAllData, currentUser, collabState, setAuthModalOpen } = useEvent();

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
        <h1 className="text-2xl sm:text-3xl font-bold text-[#26221F] font-serif-heading">
          Event Settings & Local Data Management
        </h1>
        <p className="text-xs text-[#78716C] mt-1">
          Adjust core constraints, create JSON backups, or audit client-side browser storage health.
        </p>
      </div>

      {saveSuccessNotice && (
        <div role="status" aria-live="polite" className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#047857]" />
          <span>Event preferences and budget constraints successfully saved!</span>
        </div>
      )}

      {importSuccess && (
        <div role="status" aria-live="polite" className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#047857]" />
          <span>JSON event state imported and validated successfully!</span>
        </div>
      )}

      {importError && (
        <div role="alert" aria-live="assertive" className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#BE123C]" />
          <span>{importError}</span>
        </div>
      )}

      {/* Form: Core Event Details */}
      <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-5">
        <h3 className="text-base font-bold text-[#26221F] font-serif-heading">
          Edit Event Constraints
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="settings-event-name" className="block font-semibold text-[#26221F] mb-1">Event Title</label>
            <input
              id="settings-event-name"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-type" className="block font-semibold text-[#26221F] mb-1">Event Type</label>
            <select
              id="settings-event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            >
              <option value="wedding">Wedding</option>
              <option value="anniversary">Anniversary</option>
              <option value="birthday">Milestone Birthday</option>
              <option value="corporate">Corporate</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="settings-event-date" className="block font-semibold text-[#26221F] mb-1">Date</label>
            <input
              id="settings-event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-location" className="block font-semibold text-[#26221F] mb-1">City / Venue Location</label>
            <input
              id="settings-event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-guests" className="block font-semibold text-[#26221F] mb-1">Confirmed Guest Count</label>
            <input
              id="settings-event-guests"
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 0)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-event-budget" className="block font-semibold text-[#26221F] mb-1">Total Target Budget</label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                aria-label="Event Currency"
                className="w-24 text-xs px-2 py-2 border border-[#D5CCC0] rounded-md bg-[#FAF8F5]"
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
                className="flex-1 text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
              />
            </div>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-style" className="block font-semibold text-[#26221F] mb-1">Event Style & Tone</label>
            <input
              id="settings-event-style"
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-catering" className="block font-semibold text-[#26221F] mb-1">Catering Format</label>
            <input
              id="settings-event-catering"
              type="text"
              value={cateringType}
              onChange={(e) => setCateringType(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="settings-event-notes" className="block font-semibold text-[#26221F] mb-1">Optional Notes</label>
            <textarea
              id="settings-event-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSavePreferences}
            className="px-5 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            Save Constraint Changes
          </button>
        </div>
      </div>

      {/* JSON Import & Export Tools */}
      <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#26221F] font-serif-heading">
            Data Portability & Backup
          </h3>
          <p className="text-xs text-[#78716C]">
            Export complete plans as portable JSON files or restore from an existing backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            className="px-4 py-2.5 rounded-md bg-[#26221F] hover:bg-[#33302B] text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export Event JSON Backup
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-md bg-white border border-[#D5CCC0] text-[#26221F] hover:bg-[#FAF8F5] text-xs font-semibold flex items-center gap-2 transition shadow-xs"
          >
            <Upload className="w-4 h-4 text-[#B85C3A]" />
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
      <div className="bg-[#FAF8F5] p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#26221F]">
          <ShieldCheck className="w-5 h-5 text-[#047857]" />
          <h3 className="text-base font-bold font-serif-heading">
            Privacy & Client-Side Storage Audit
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-0.5">
            <span className="text-[#78716C] font-semibold">Local Storage</span>
            <p className="font-mono text-sm font-bold text-[#26221F]">Browser LocalStorage</p>
            <span className="text-[10px] text-[#78716C]">Client-side zero-latency cache</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-0.5">
            <span className="text-[#78716C] font-semibold">Schema Version</span>
            <p className="font-mono text-sm font-bold text-[#26221F]">Version {CURRENT_SCHEMA_VERSION}</p>
            <span className="text-[10px] text-[#78716C]">Validated schema structure</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-0.5">
            <span className="text-[#78716C] font-semibold">Local Footprint</span>
            <p className="font-mono text-sm font-bold text-[#26221F]">{storageKb} KB</p>
            <span className="text-[10px] text-[#78716C]">Below 5MB browser quota</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-0.5">
            <span className="text-[#78716C] font-semibold">Cloud Sync & Auth</span>
            <p className="font-mono text-sm font-bold text-[#26221F]">
              {currentUser ? ((collabState.status === 'synced' || collabState.status === 'syncing') ? `Live (Rev #${collabState.serverVersion})` : 'Cloud Ready') : 'Local Mode'}
            </p>
            <span className="text-[10px] text-[#78716C]">
              {currentUser ? `User: ${currentUser.name}` : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="text-[#B85C3A] underline hover:font-bold"
                >
                  Sign in to sync
                </button>
              )}
            </span>
          </div>
        </div>

        <p className="text-xs text-[#5C554E] leading-relaxed">
          <strong>Offline-First Architecture:</strong> VowPilot functions reliably offline using client-side Browser LocalStorage. When signed in to your account, events can be synchronized to the backend cloud database for multi-user collaboration and role-based permissions. No third-party ad networks or trackers are loaded.
        </p>

        {/* Danger Zone Actions */}
        <div className="pt-3 border-t border-[#EAE4DB] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetWithConfirm}
            className="px-3.5 py-2 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Clean Jaipur Demo Dataset
          </button>

          <button
            onClick={handleClearWithConfirm}
            className="px-3.5 py-2 rounded-md bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Local Application Storage
          </button>
        </div>
      </div>
    </div>
  );
};
