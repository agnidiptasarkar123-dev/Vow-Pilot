import React from 'react';
import { InvitationDesign } from '../../../types';

interface TemplateProps {
  invitation: InvitationDesign;
  className?: string;
  isPrintMode?: boolean;
}

export const CelebrationClassicTemplate: React.FC<TemplateProps> = ({
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

  const styles = {
    'cream-terracotta': {
      bg: '#FAF8F5',
      primary: '#B85C3A',
      secondary: '#6E2D1A',
      text: '#26221F',
      textMuted: '#6B5E54',
      borderOuter: '#B85C3A',
      borderInner: '#E8C8BD',
    },
    'forest-gold': {
      bg: '#F5F7F5',
      primary: '#1F2D24',
      secondary: '#C66B49',
      text: '#16221A',
      textMuted: '#4C5E50',
      borderOuter: '#1F2D24',
      borderInner: '#C5D1C8',
    },
    'sage-blush': {
      bg: '#F8FAF8',
      primary: '#586E58',
      secondary: '#B85C3A',
      text: '#1E261E',
      textMuted: '#5C6B5C',
      borderOuter: '#586E58',
      borderInner: '#F4D7CF',
    },
    'pearl-charcoal': {
      bg: '#FAF9F7',
      primary: '#33302B',
      secondary: '#8C8275',
      text: '#1C1A17',
      textMuted: '#524E46',
      borderOuter: '#33302B',
      borderInner: '#D8D0C5',
    },
    'terracotta-sand': {
      bg: '#FBF6F0',
      primary: '#9E4B2D',
      secondary: '#829382',
      text: '#261C18',
      textMuted: '#6E564E',
      borderOuter: '#9E4B2D',
      borderInner: '#E8D7C4',
    },
  }[palette];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-6 sm:p-10 select-none ${className}`}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        boxShadow: isPrintMode
          ? 'none'
          : '0 16px 40px -10px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.03)',
      }}
    >
      {/* Decorative Ornate Classic Border SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer Heavy Border */}
        <rect
          x="12"
          y="12"
          width="calc(100% - 24px)"
          height="calc(100% - 24px)"
          rx="3"
          fill="none"
          stroke={styles.borderOuter}
          strokeWidth="1.5"
        />

        {/* Inner Fine Border */}
        <rect
          x="16"
          y="16"
          width="calc(100% - 32px)"
          height="calc(100% - 32px)"
          rx="2"
          fill="none"
          stroke={styles.borderInner}
          strokeWidth="0.75"
        />

        {/* Traditional Corner Quadrants */}
        <g stroke={styles.primary} strokeWidth="1">
          <line x1="12" y1="28" x2="28" y2="12" />
          <line x1="calc(100% - 12px)" y1="28" x2="calc(100% - 28px)" y2="12" />
          <line x1="12" y1="calc(100% - 28px)" x2="28" y2="calc(100% - 12px)" />
          <line x1="calc(100% - 12px)" y1="calc(100% - 28px)" x2="calc(100% - 28px)" y2="calc(100% - 12px)" />
        </g>
      </svg>

      {/* Header Cartouche */}
      <div className="relative z-10 text-center pt-2 sm:pt-4">
        {/* Classical Embellished Header Vignette */}
        <div className="mx-auto mb-3 flex items-center justify-center gap-2">
          <div className="w-8 h-px" style={{ backgroundColor: styles.borderInner }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L14.5 9L22 12L14.5 15L12 22L9.5 15L2 12L9.5 9L12 2Z"
              fill={styles.primary}
            />
          </svg>
          <div className="w-8 h-px" style={{ backgroundColor: styles.borderInner }} />
        </div>

        {hostNames && (
          <p
            className="text-[10px] sm:text-xs uppercase tracking-[0.22em] font-medium mb-1.5 px-4"
            style={{ color: styles.textMuted }}
          >
            {hostNames}
          </p>
        )}

        {invitationHeading && (
          <p
            className="font-serif italic text-xs sm:text-sm max-w-md mx-auto mb-2 px-4 leading-relaxed"
            style={{ color: styles.textMuted }}
          >
            {invitationHeading}
          </p>
        )}

        <h2
          className="font-serif-heading text-2xl sm:text-4xl font-semibold tracking-tight px-4 leading-tight mb-2"
          style={{ color: styles.primary }}
        >
          {title}
        </h2>

        {bodyText && (
          <p
            className="text-xs sm:text-sm font-serif max-w-lg mx-auto leading-relaxed px-4 pt-1"
            style={{ color: styles.text }}
          >
            {bodyText}
          </p>
        )}
      </div>

      {/* Optional Authentic Bilingual Section */}
      {isBilingual && (
        <div
          className="relative z-10 my-3 py-2 px-4 rounded-sm border text-center max-w-lg mx-auto"
          style={{
            borderColor: styles.borderInner,
            backgroundColor: 'rgba(255,255,255,0.7)',
          }}
        >
          {bilingualTitle && (
            <h3
              className="font-serif-heading text-base sm:text-lg font-semibold tracking-wide"
              style={{ color: styles.primary }}
            >
              {bilingualTitle}
            </h3>
          )}
          {bilingualHeading && (
            <p className="text-[11px] sm:text-xs italic mt-0.5" style={{ color: styles.textMuted }}>
              {bilingualHeading}
            </p>
          )}
          {bilingualBody && (
            <p className="text-xs sm:text-[13px] leading-relaxed mt-1" style={{ color: styles.text }}>
              {bilingualBody}
            </p>
          )}
          {(bilingualDate || bilingualVenue) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: styles.textMuted }}>
              {bilingualDate && <span>{bilingualDate}</span>}
              {bilingualDate && bilingualVenue && <span>•</span>}
              {bilingualVenue && <span>{bilingualVenue}</span>}
            </div>
          )}
          {bilingualFooter && (
            <p className="text-[10px] sm:text-[11px] mt-1 tracking-wider" style={{ color: styles.textMuted }}>
              {bilingualFooter}
            </p>
          )}
        </div>
      )}

      {/* Date & Time Frame */}
      <div className="relative z-10 my-2 sm:my-3 text-center">
        <div className="inline-block py-2 px-8 border-y" style={{ borderColor: styles.borderInner }}>
          <p className="font-serif font-bold text-sm sm:text-base tracking-wider uppercase" style={{ color: styles.primary }}>
            {eventDate || 'Date to be announced'}
          </p>
          <p className="text-xs sm:text-sm font-serif italic mt-0.5" style={{ color: styles.textMuted }}>
            commencing at {startTime || 'the designated hour'}
          </p>
        </div>

        <div className="mt-2.5">
          <p className="font-serif font-semibold text-xs sm:text-base tracking-wide" style={{ color: styles.text }}>
            {venueName || 'Venue Location'}
          </p>
          {venueAddress && (
            <p className="text-[10px] sm:text-xs font-sans max-w-sm mx-auto mt-0.5" style={{ color: styles.textMuted }}>
              {venueAddress}
            </p>
          )}
        </div>
      </div>

      {/* Footer / RSVP / Dress Code */}
      <div className="relative z-10 text-center pb-2 pt-2 border-t" style={{ borderColor: styles.borderInner }}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs" style={{ color: styles.textMuted }}>
          {rsvpDeadline && (
            <span>
              <strong>RSVP:</strong> Kindly respond by {rsvpDeadline}
            </span>
          )}
          {rsvpDeadline && contactInfo && <span className="hidden sm:inline">•</span>}
          {contactInfo && <span>{contactInfo}</span>}
          {dressCode && (
            <>
              <span className="hidden sm:inline">•</span>
              <span>
                <strong>Dress Code:</strong> {dressCode}
              </span>
            </>
          )}
        </div>

        {additionalDetails && (
          <p className="text-[9px] sm:text-[10px] mt-1 max-w-md mx-auto italic" style={{ color: styles.textMuted }}>
            {additionalDetails}
          </p>
        )}
      </div>
    </div>
  );
};
