import React from 'react';
import { GuestRecord } from '../../types';
import {
  CheckCircle2,
  UserX,
  Clock,
  Utensils,
  Accessibility,
  QrCode,
  Edit2,
  Trash2,
  Share2,
} from 'lucide-react';

export interface GuestTableRowProps {
  guest: GuestRecord;
  isCopied: boolean;
  isReadOnly: boolean;
  onPreviewRsvp: (token: string) => void;
  onOpenQrModal: (guest: GuestRecord) => void;
  onCopyRsvpLink: (guest: GuestRecord) => void;
  onOpenEditModal: (guest: GuestRecord) => void;
  onDelete: (guestId: string, guestName: string) => void;
}

export const GuestTableRow: React.FC<GuestTableRowProps> = React.memo(
  ({
    guest,
    isCopied,
    isReadOnly,
    onPreviewRsvp,
    onOpenQrModal,
    onCopyRsvpLink,
    onOpenEditModal,
    onDelete,
  }) => {
    return (
      <tr className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#26362C]/50 transition-colors">
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
              onClick={() => onPreviewRsvp(guest.invitationToken)}
              title="Preview and test public RSVP form for this guest"
              aria-label={`Preview RSVP form for ${guest.name}`}
              className="p-1 rounded text-[#B85C3A] dark:text-[#E8D7C4] hover:bg-[#FAF0EB] dark:hover:bg-[#2E2222] transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Dedicated QR Code Modal */}
            <button
              onClick={() => onOpenQrModal(guest)}
              data-testid={`guest-qr-btn-${guest.id}`}
              title={`Generate, preview, or print RSVP QR code for ${guest.name}`}
              aria-label={`Generate RSVP QR code for ${guest.name}`}
              className="p-1 rounded text-[#B85C3A] dark:text-[#D48668] hover:bg-[#FAF0EB] dark:hover:bg-[#2E2222] transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>

            {/* Copy RSVP Link */}
            <button
              onClick={() => onCopyRsvpLink(guest)}
              title="Copy dedicated RSVP link to clipboard"
              aria-label={`Copy RSVP link for ${guest.name}`}
              className="px-2 py-0.5 text-[10px] font-semibold rounded border border-border-subtle hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer"
            >
              {isCopied ? 'Copied!' : 'Copy Link'}
            </button>

            {/* Edit Guest */}
            <button
              onClick={() => onOpenEditModal(guest)}
              disabled={isReadOnly}
              title="Edit guest information"
              aria-label={`Edit ${guest.name}`}
              className="p-1 rounded text-tertiary hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] transition cursor-pointer disabled:opacity-40"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Delete Guest */}
            <button
              onClick={() => onDelete(guest.id, guest.name)}
              disabled={isReadOnly}
              title="Remove guest"
              aria-label={`Delete ${guest.name}`}
              className="p-1 rounded text-tertiary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }
);

GuestTableRow.displayName = 'GuestTableRow';
