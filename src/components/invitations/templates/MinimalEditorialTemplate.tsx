import React from 'react';
import { InvitationDesign } from '../../../types';

interface TemplateProps {
  invitation: InvitationDesign;
  className?: string;
  isPrintMode?: boolean;
}

export const MinimalEditorialTemplate: React.FC<TemplateProps> = ({
  invitation,
  className = '',
  isPrintMode = false,
}) => {
  const {
    title,
    hostNames,
    invitationHeading,
    bodyText,
    eventDate,
    startTime,
    venueName,
    venueAddress,
    rsvpDeadline,
    contactInfo,
    dressCode,
    additionalDetails,
    isBilingual,
    bilingualTitle,
    bilingualHeading,
    bilingualBody,
    bilingualDate,
    bilingualVenue,
    bilingualFooter,
    palette = 'pearl-charcoal',
  } = invitation;

  const colors = {
    'pearl-charcoal': {
      bg: '#FFFFFF',
      text: '#1C1917',
      muted: '#57534E',
      accent: '#292524',
      border: '#E7E5E4',
    },
    'cream-terracotta': {
      bg: '#FAF8F5',
      text: '#26221F',
      muted: '#786259',
      accent: '#B85C3A',
      border: '#E6DFD5',
    },
    'forest-gold': {
      bg: '#F9FAF9',
      text: '#16221A',
      muted: '#4A5B4F',
      accent: '#223828',
      border: '#D2DBD4',
    },
    'sage-blush': {
      bg: '#FAFBF9',
      text: '#222923',
      muted: '#5F7061',
      accent: '#586E58',
      border: '#D5DFD6',
    },
    'terracotta-sand': {
      bg: '#FCFAF7',
      text: '#261C18',
      muted: '#755F55',
      accent: '#9E4B2D',
      border: '#E8D9CE',
    },
  }[palette];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-8 sm:p-14 select-none ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        boxShadow: isPrintMode
          ? 'none'
          : '0 16px 36px -10px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.02)',
      }}
    >
      {/* Top Botanical Insignia & Hosts */}
      <div className="relative z-10 pt-2">
        <div className="flex items-center justify-between border-b pb-4 mb-8" style={{ borderColor: colors.border }}>
          {/* Subtle Small Botanical Insignia */}
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8L16 26L26 8" stroke={colors.accent} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="12" r="2" fill={colors.accent} />
          </svg>

          {hostNames && (
            <span
              className="text-[10px] uppercase tracking-[0.25em] font-medium"
              style={{ color: colors.muted }}
            >
              {hostNames}
            </span>
          )}
        </div>

        {invitationHeading && (
          <p
            className="text-xs font-serif italic mb-3 tracking-wide"
            style={{ color: colors.muted }}
          >
            {invitationHeading}
          </p>
        )}

        <h2
          className="font-serif-heading text-3xl sm:text-5xl font-light tracking-tight leading-tight mb-4"
          style={{ color: colors.accent }}
        >
          {title}
        </h2>

        {bodyText && (
          <p
            className="text-xs sm:text-sm font-sans max-w-lg leading-relaxed text-stone-600"
            style={{ color: colors.muted }}
          >
            {bodyText}
          </p>
        )}
      </div>

      {/* Optional Authentic Bilingual Section */}
      {isBilingual && (
        <div
          className="relative z-10 my-4 py-3 pl-4 border-l-2"
          style={{ borderColor: colors.accent }}
        >
          {bilingualTitle && (
            <h3 className="font-serif-heading text-base sm:text-lg font-medium" style={{ color: colors.accent }}>
              {bilingualTitle}
            </h3>
          )}
          {bilingualHeading && (
            <p className="text-[11px] sm:text-xs italic mt-0.5" style={{ color: colors.muted }}>
              {bilingualHeading}
            </p>
          )}
          {bilingualBody && (
            <p className="text-xs sm:text-[13px] leading-relaxed mt-1" style={{ color: colors.text }}>
              {bilingualBody}
            </p>
          )}
          {(bilingualDate || bilingualVenue) && (
            <div className="flex flex-wrap items-center gap-x-3 text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: colors.muted }}>
              {bilingualDate && <span>{bilingualDate}</span>}
              {bilingualDate && bilingualVenue && <span>—</span>}
              {bilingualVenue && <span>{bilingualVenue}</span>}
            </div>
          )}
          {bilingualFooter && (
            <p className="text-[10px] mt-1" style={{ color: colors.muted }}>
              {bilingualFooter}
            </p>
          )}
        </div>
      )}

      {/* Clean Grid of Schedule & Venue Details */}
      <div className="relative z-10 my-4 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t" style={{ borderColor: colors.border }}>
        <div>
          <span className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: colors.muted }}>
            When
          </span>
          <p className="font-serif text-base sm:text-lg font-medium" style={{ color: colors.text }}>
            {eventDate || 'Date to be announced'}
          </p>
          <p className="text-xs font-sans mt-0.5" style={{ color: colors.muted }}>
            {startTime || 'Evening reception'}
          </p>
        </div>

        <div>
          <span className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: colors.muted }}>
            Where
          </span>
          <p className="font-serif text-base sm:text-lg font-medium" style={{ color: colors.text }}>
            {venueName || 'Venue location'}
          </p>
          {venueAddress && (
            <p className="text-xs font-sans mt-0.5 max-w-xs" style={{ color: colors.muted }}>
              {venueAddress}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Minimal Footer */}
      <div className="relative z-10 pt-4 border-t flex flex-wrap items-center justify-between gap-3 text-[10px] sm:text-xs" style={{ borderColor: colors.border, color: colors.muted }}>
        <div>
          {rsvpDeadline && (
            <span>
              <strong>RSVP</strong> • {rsvpDeadline}
            </span>
          )}
          {rsvpDeadline && contactInfo && <span className="mx-2">•</span>}
          {contactInfo && <span>{contactInfo}</span>}
        </div>

        {dressCode && (
          <div>
            <span>Attire: {dressCode}</span>
          </div>
        )}

        {additionalDetails && (
          <div className="w-full text-right italic text-[9px]">
            <span>{additionalDetails}</span>
          </div>
        )}
      </div>
    </div>
  );
};
