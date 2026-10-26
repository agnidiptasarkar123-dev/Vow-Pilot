import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { GuestRecord, RsvpStatus } from '../../types';
import { VowPilotLogo } from '../common/VowPilotLogo';
import { Calendar, MapPin, CheckCircle, XCircle, Heart, ShieldCheck } from 'lucide-react';

interface PublicRsvpModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  guest?: GuestRecord;
}

export const PublicRsvpModal: React.FC<PublicRsvpModalProps> = ({
  isOpen,
  onClose,
  token,
  guest: providedGuest,
}) => {
  const { state, updateGuestRsvp } = useEvent();

  // Find guest by token if provided, else use providedGuest
  const guest: GuestRecord | undefined = (() => {
    if (providedGuest) return providedGuest;
    if (token && state.guests) {
      return state.guests.find((g) => g.invitationToken === token);
    }
    return undefined;
  })();

  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(guest?.rsvpStatus || 'accepted');
  const [confirmedCount, setConfirmedCount] = useState<number>(() => {
    if (guest) {
      return guest.confirmedCount > 0 ? guest.confirmedCount : guest.partySize;
    }
    return 1;
  });
  const [dietaryNotes, setDietaryNotes] = useState<string>(guest?.dietaryNotes || '');
  const [accessibility, setAccessibility] = useState<string>(guest?.accessibilityRequirements || '');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest) return;

    updateGuestRsvp(
      guest.id,
      rsvpStatus,
      rsvpStatus === 'accepted' ? confirmedCount : 0,
      dietaryNotes,
      accessibility
    );
    setIsSubmitted(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-lg bg-canvas border border-border-subtle rounded-2xl shadow-2xl p-6 sm:p-8 animate-fade-in text-primary">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close RSVP form"
          className="absolute top-4 right-4 text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5] p-2 rounded-full hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] transition cursor-pointer"
        >
          ✕
        </button>

        {/* Public Header with Botanical Monogram */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <VowPilotLogo variant="mark" size="md" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#B85C3A] dark:text-[#E8D7C4]">
            Celebration Invitation Response
          </span>
          <h2 id="rsvp-modal-title" className="font-serif-heading text-2xl font-bold tracking-tight mt-1 text-primary">
            {state.event.name}
          </h2>

          {/* Strict Privacy: Public Event Card showing ONLY Date & Venue */}
          <div className="mt-3 py-2 px-4 bg-[#FFFFFF] dark:bg-[#26362C] rounded-lg border border-border-subtle inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-secondary">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-[#B85C3A]" />
              {state.event.date}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#B85C3A]" />
              {state.event.location}
            </span>
          </div>
        </div>

        {/* Guest Validation State */}
        {!guest ? (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Invalid Invitation Token
            </p>
            <p className="text-xs text-tertiary mt-1">
              We could not find an active guest invitation matching this link. Please verify your RSVP URL or contact the celebration host.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] text-xs font-semibold rounded-lg hover:bg-[#E8C8BD] transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : guest.tokenRevoked ? (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Invitation Token Revoked
            </p>
            <p className="text-xs text-tertiary mt-1">
              This invitation token has been revoked by the celebration host. Please request a new invitation link if you plan to attend.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] text-xs font-semibold rounded-lg hover:bg-[#E8C8BD] transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : guest.tokenExpiresAt && new Date(guest.tokenExpiresAt).getTime() < Date.now() ? (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Invitation Link Expired
            </p>
            <p className="text-xs text-tertiary mt-1">
              The RSVP response window for this invitation link has closed. Please contact the celebration coordinator directly.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] text-xs font-semibold rounded-lg hover:bg-[#E8C8BD] transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : isSubmitted ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
              <Heart className="w-6 h-6 fill-current" />
            </div>
            <h3 className="font-serif-heading text-xl font-bold text-primary">
              {rsvpStatus === 'accepted' ? 'RSVP Confirmed!' : 'Thank you for letting us know'}
            </h3>
            <p className="text-xs text-secondary max-w-sm mx-auto">
              {rsvpStatus === 'accepted'
                ? `We are delighted to celebrate with you! A party of ${confirmedCount} has been reserved for ${guest.name}.`
                : `We will miss your presence at ${state.event.name}, but we warmly appreciate you letting us know.`}
            </p>
            <div className="pt-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Guest Banner */}
            <div className="p-3.5 bg-[#FAF0EB] dark:bg-[#2B211E] border border-[#E8C8BD] dark:border-[#4D332B] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#B85C3A] dark:text-[#E8D7C4] block">
                  Invited Guest
                </span>
                <span className="font-semibold text-sm text-primary">
                  {guest.name}
                </span>
                {guest.householdGroup && (
                  <span className="text-xs text-[#78716C] dark:text-[#C5D1C8] block">
                    {guest.householdGroup}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-[#78716C] dark:text-[#C5D1C8]">Party Size</span>
                <span className="block text-base font-bold text-[#B85C3A] dark:text-[#E8D7C4]">
                  Up to {guest.partySize} {guest.partySize === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>

            {/* Attendance Choice */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                Will you be attending?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRsvpStatus('accepted')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    rsvpStatus === 'accepted'
                      ? 'border-[#047857] bg-emerald-50 dark:bg-emerald-950/50 text-[#047857] dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-border-subtle hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] text-secondary'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Joyfully Accept</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRsvpStatus('declined')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    rsvpStatus === 'declined'
                      ? 'border-[#BE123C] bg-rose-50 dark:bg-rose-950/50 text-[#BE123C] dark:text-rose-300 ring-2 ring-rose-500/20'
                      : 'border-border-subtle hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] text-secondary'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Regretfully Decline</span>
                </button>
              </div>
            </div>

            {/* If Accepted, choose headcount */}
            {rsvpStatus === 'accepted' && (
              <div className="space-y-4 pt-1 animate-fade-in">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Number of Attending Guests
                  </label>
                  <select
                    value={confirmedCount}
                    onChange={(e) => setConfirmedCount(parseInt(e.target.value, 10))}
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-2 text-xs font-semibold text-primary focus:ring-1 focus:ring-[#B85C3A] cursor-pointer"
                  >
                    {Array.from({ length: guest.partySize }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Guest attending' : 'Guests attending'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Dietary Requirements or Allergies
                  </label>
                  <input
                    type="text"
                    value={dietaryNotes}
                    onChange={(e) => setDietaryNotes(e.target.value)}
                    placeholder="e.g. Vegetarian, Jain (no onion/garlic), Nut allergy, Vegan"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Accessibility Needs (Optional)
                  </label>
                  <input
                    type="text"
                    value={accessibility}
                    onChange={(e) => setAccessibility(e.target.value)}
                    placeholder="e.g. Wheelchair ramp, step-free seating, quiet zone"
                    className="w-full bg-[#FFFFFF] dark:bg-[#26362C] border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>
            )}

            {/* Privacy notice badge */}
            <div className="flex items-center gap-1.5 text-[10px] text-tertiary pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Response is encrypted and delivered securely to event hosts.</span>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border-strong text-secondary text-xs font-medium rounded-lg hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
              >
                Submit Response
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
