import React from 'react';
import { InvitationDesign } from '../../../types';

interface TemplateProps {
  invitation: InvitationDesign;
  className?: string;
  isPrintMode?: boolean;
}

export const BotanicalEmbroideryTemplate: React.FC<TemplateProps> = ({
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
    palette = 'cream-terracotta',
  } = invitation;

  // Curated embroidery palette definitions
  const paletteStyles = {
    'cream-terracotta': {
      bg: '#FAF7F2',
      borderThread: '#B85C3A',
      accentThread: '#6B7F6B',
      textPrimary: '#26221F',
      textSecondary: '#6B5E54',
      cardBg: '#FFFFFF',
      innerBorder: '#E6DFD5',
    },
    'forest-gold': {
      bg: '#F5F7F5',
      borderThread: '#1F2D24',
      accentThread: '#C66B49',
      textPrimary: '#16221A',
      textSecondary: '#3E5244',
      cardBg: '#FFFFFF',
      innerBorder: '#D2DBD4',
    },
    'sage-blush': {
      bg: '#F8FAF8',
      borderThread: '#586E58',
      accentThread: '#B85C3A',
      textPrimary: '#1E261E',
      textSecondary: '#5C6B5C',
      cardBg: '#FFFFFF',
      innerBorder: '#D8E2D8',
    },
    'pearl-charcoal': {
      bg: '#FAF9F7',
      borderThread: '#33302B',
      accentThread: '#8C8275',
      textPrimary: '#1C1A17',
      textSecondary: '#524E46',
      cardBg: '#FFFFFF',
      innerBorder: '#E0DDD5',
    },
    'terracotta-sand': {
      bg: '#FBF6F0',
      borderThread: '#9E4B2D',
      accentThread: '#829382',
      textPrimary: '#261C18',
      textSecondary: '#6E564E',
      cardBg: '#FFFFFF',
      innerBorder: '#E8DCCF',
    },
  }[palette];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-6 sm:p-10 select-none transition-all duration-150 ${className}`}
      style={{
        backgroundColor: paletteStyles.bg,
        color: paletteStyles.textPrimary,
        boxShadow: isPrintMode ? 'none' : '0 12px 36px -10px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Embroidery Stitch Frame (Vector running stitches and botanical corner flourishes) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer Running Stitch */}
        <rect
          x="12"
          y="12"
          width="calc(100% - 24px)"
          height="calc(100% - 24px)"
          rx="4"
          fill="none"
          stroke={paletteStyles.borderThread}
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />

        {/* Inner Solid Fine Guide Line */}
        <rect
          x="18"
          y="18"
          width="calc(100% - 36px)"
          height="calc(100% - 36px)"
          rx="2"
          fill="none"
          stroke={paletteStyles.borderThread}
          strokeWidth="0.75"
          opacity="0.6"
        />

        {/* Corner Cross-Stitch Rosettes */}
        {/* Top-Left */}
        <g transform="translate(14, 14)">
          <path d="M-4,-4 L4,4 M-4,4 L4,-4" stroke={paletteStyles.accentThread} strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.5" fill={paletteStyles.borderThread} />
        </g>
        {/* Top-Right */}
        <g transform="translate(calc(100% - 14px), 14)">
          <path d="M-4,-4 L4,4 M-4,4 L4,-4" stroke={paletteStyles.accentThread} strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.5" fill={paletteStyles.borderThread} />
        </g>
        {/* Bottom-Left */}
        <g transform="translate(14, calc(100% - 14px))">
          <path d="M-4,-4 L4,4 M-4,4 L4,-4" stroke={paletteStyles.accentThread} strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.5" fill={paletteStyles.borderThread} />
        </g>
        {/* Bottom-Right */}
        <g transform="translate(calc(100% - 14px), calc(100% - 14px))">
          <path d="M-4,-4 L4,4 M-4,4 L4,-4" stroke={paletteStyles.accentThread} strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.5" fill={paletteStyles.borderThread} />
        </g>
      </svg>

      {/* Header & Botanical Needlepoint Insignia */}
      <div className="relative z-10 text-center pt-2 sm:pt-4">
        {/* Needlepoint Botanical Monogram Motif */}
        <div className="mx-auto mb-3 flex items-center justify-center">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 36C18 36 21 28 24 16C27 28 30 36 36 36"
              stroke={paletteStyles.borderThread}
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            {/* Needlework Laurel Leaves */}
            <path
              d="M16 26C13 24 11 20 13 16C17 17 19 21 17 25"
              fill="none"
              stroke={paletteStyles.accentThread}
              strokeWidth="1.25"
              strokeDasharray="2 1.5"
            />
            <path
              d="M32 26C35 24 37 20 35 16C31 17 29 21 31 25"
              fill="none"
              stroke={paletteStyles.accentThread}
              strokeWidth="1.25"
              strokeDasharray="2 1.5"
            />
            {/* 4-point Diamond Cross */}
            <path
              d="M24 8L25.5 12L29.5 13.5L25.5 15L24 19L22.5 15L18.5 13.5L22.5 12Z"
              fill={paletteStyles.borderThread}
            />
          </svg>
        </div>

        {/* Host Names */}
        {hostNames && (
          <p
            className="text-[10px] sm:text-xs uppercase tracking-[0.22em] font-medium mb-1.5 px-4"
            style={{ color: paletteStyles.textSecondary }}
          >
            {hostNames}
          </p>
        )}

        {/* Invitation Heading */}
        {invitationHeading && (
          <p
            className="font-serif italic text-xs sm:text-sm max-w-md mx-auto mb-3 px-4 leading-relaxed"
            style={{ color: paletteStyles.textSecondary }}
          >
            {invitationHeading}
          </p>
        )}

        {/* Celebration Title */}
        <h2
          className="font-serif-heading text-xl sm:text-3xl font-semibold tracking-tight px-4 leading-tight mb-2"
          style={{ color: paletteStyles.borderThread }}
        >
          {title}
        </h2>

        {/* Main Body Passage */}
        {bodyText && (
          <p
            className="text-xs sm:text-sm font-serif max-w-lg mx-auto leading-relaxed px-4 pt-1"
            style={{ color: paletteStyles.textPrimary }}
          >
            {bodyText}
          </p>
        )}
      </div>

      {/* Optional Authentic Bilingual Section (Bengali / English) */}
      {isBilingual && (
        <div
          className="relative z-10 my-3 py-2.5 px-4 rounded-sm border border-dashed text-center max-w-lg mx-auto"
          style={{
            borderColor: paletteStyles.borderThread,
            backgroundColor: 'rgba(255,255,255,0.6)',
          }}
        >
          {bilingualTitle && (
            <h3
              className="font-serif-heading text-base sm:text-lg font-semibold tracking-wide text-amber-900"
              style={{ color: paletteStyles.borderThread }}
            >
              {bilingualTitle}
            </h3>
          )}
          {bilingualHeading && (
            <p className="text-[11px] sm:text-xs italic text-stone-700 mt-0.5" style={{ color: paletteStyles.textSecondary }}>
              {bilingualHeading}
            </p>
          )}
          {bilingualBody && (
            <p className="text-xs sm:text-[13px] leading-relaxed mt-1 text-stone-800" style={{ color: paletteStyles.textPrimary }}>
              {bilingualBody}
            </p>
          )}
          {(bilingualDate || bilingualVenue) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: paletteStyles.textSecondary }}>
              {bilingualDate && <span>{bilingualDate}</span>}
              {bilingualDate && bilingualVenue && <span>•</span>}
              {bilingualVenue && <span>{bilingualVenue}</span>}
            </div>
          )}
          {bilingualFooter && (
            <p className="text-[10px] sm:text-[11px] mt-1 text-stone-600 tracking-wider">
              {bilingualFooter}
            </p>
          )}
        </div>
      )}

      {/* Event Details Plaque */}
      <div className="relative z-10 my-2 sm:my-3 text-center">
        {/* Date & Time Ribbon */}
        <div className="inline-flex items-center justify-center gap-3 sm:gap-6 py-2 px-6 border-y" style={{ borderColor: paletteStyles.innerBorder }}>
          <div>
            <span className="block text-[9px] sm:text-[10px] uppercase tracking-widest" style={{ color: paletteStyles.textSecondary }}>
              Date
            </span>
            <span className="font-serif font-semibold text-xs sm:text-base tracking-wide" style={{ color: paletteStyles.textPrimary }}>
              {eventDate || 'Date to be announced'}
            </span>
          </div>

          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: paletteStyles.accentThread }} />

          <div>
            <span className="block text-[9px] sm:text-[10px] uppercase tracking-widest" style={{ color: paletteStyles.textSecondary }}>
              Time
            </span>
            <span className="font-serif font-semibold text-xs sm:text-base tracking-wide" style={{ color: paletteStyles.textPrimary }}>
              {startTime || 'Evening'}
            </span>
          </div>
        </div>

        {/* Venue Location */}
        <div className="mt-2.5 space-y-0.5">
          <p className="font-serif font-semibold text-xs sm:text-sm tracking-wide" style={{ color: paletteStyles.textPrimary }}>
            {venueName || 'Venue location'}
          </p>
          {venueAddress && (
            <p className="text-[10px] sm:text-xs font-sans max-w-sm mx-auto" style={{ color: paletteStyles.textSecondary }}>
              {venueAddress}
            </p>
          )}
        </div>
      </div>

      {/* Footer / RSVP / Dress Code */}
      <div className="relative z-10 text-center pb-2 pt-2 border-t" style={{ borderColor: paletteStyles.innerBorder }}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs" style={{ color: paletteStyles.textSecondary }}>
          {rsvpDeadline && (
            <span>
              <strong>RSVP:</strong> Kindly reply by {rsvpDeadline}
            </span>
          )}
          {rsvpDeadline && contactInfo && <span className="hidden sm:inline">•</span>}
          {contactInfo && <span>{contactInfo}</span>}
          {dressCode && (
            <>
              <span className="hidden sm:inline">•</span>
              <span>
                <strong>Dress:</strong> {dressCode}
              </span>
            </>
          )}
        </div>

        {additionalDetails && (
          <p className="text-[9px] sm:text-[10px] mt-1.5 max-w-md mx-auto italic" style={{ color: paletteStyles.textSecondary }}>
            {additionalDetails}
          </p>
        )}
      </div>
    </div>
  );
};
