import React from 'react';
import { InvitationDesign } from '../../../types';

interface TemplateProps {
  invitation: InvitationDesign;
  className?: string;
  isPrintMode?: boolean;
}

export const EmbossedBotanicalTemplate: React.FC<TemplateProps> = ({
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

  const paletteColors = {
    'pearl-charcoal': {
      bg: '#FAF8F5',
      ink: '#2B2621',
      inkMuted: '#6E665E',
      embossShadow: 'rgba(0, 0, 0, 0.08)',
      embossHighlight: 'rgba(255, 255, 255, 0.9)',
      accent: '#8C8275',
      frameBorder: '#D8D0C5',
    },
    'cream-terracotta': {
      bg: '#FDFBF7',
      ink: '#2E221D',
      inkMuted: '#786259',
      embossShadow: 'rgba(184, 92, 58, 0.12)',
      embossHighlight: 'rgba(255, 255, 255, 0.95)',
      accent: '#B85C3A',
      frameBorder: '#E6D7CB',
    },
    'forest-gold': {
      bg: '#F7F8F6',
      ink: '#1A241C',
      inkMuted: '#4C5E50',
      embossShadow: 'rgba(31, 45, 36, 0.12)',
      embossHighlight: 'rgba(255, 255, 255, 0.95)',
      accent: '#C66B49',
      frameBorder: '#CAD4CD',
    },
    'sage-blush': {
      bg: '#F9FAF8',
      ink: '#222923',
      inkMuted: '#637365',
      embossShadow: 'rgba(88, 110, 88, 0.1)',
      embossHighlight: 'rgba(255, 255, 255, 0.95)',
      accent: '#586E58',
      frameBorder: '#D5DFD6',
    },
    'terracotta-sand': {
      bg: '#FBF8F4',
      ink: '#2A1F1A',
      inkMuted: '#755F55',
      embossShadow: 'rgba(158, 75, 45, 0.1)',
      embossHighlight: 'rgba(255, 255, 255, 0.95)',
      accent: '#9E4B2D',
      frameBorder: '#E8D9CE',
    },
  }[palette];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-6 sm:p-10 select-none ${className}`}
      style={{
        backgroundColor: paletteColors.bg,
        color: paletteColors.ink,
        boxShadow: isPrintMode
          ? 'none'
          : '0 20px 45px -12px rgba(38, 34, 31, 0.12), 0 4px 12px -2px rgba(38, 34, 31, 0.05)',
      }}
    >
      {/* Debossed Letterpress Frame SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <filter id="deboss-filter" x="-10%" y="-10%" width="120%" height="120%">
            <feOffset dx="0.75" dy="0.75" result="offset" />
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
            <feFlood floodColor={paletteColors.embossShadow} />
            <feComposite in2="shadowDiff" operator="in" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        </defs>

        {/* Outer Fine Blind-Debossed Border */}
        <rect
          x="16"
          y="16"
          width="calc(100% - 32px)"
          height="calc(100% - 32px)"
          rx="1"
          fill="none"
          stroke={paletteColors.frameBorder}
          strokeWidth="1.25"
        />

        {/* Inner Hairline Inset */}
        <rect
          x="22"
          y="22"
          width="calc(100% - 44px)"
          height="calc(100% - 44px)"
          rx="1"
          fill="none"
          stroke={paletteColors.frameBorder}
          strokeWidth="0.5"
          opacity="0.7"
        />
      </svg>

      {/* Top Header & Embossed Crest */}
      <div className="relative z-10 text-center pt-2 sm:pt-4">
        {/* Blind-Embossed Botanical Crest */}
        <div className="mx-auto mb-3 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="21" stroke={paletteColors.frameBorder} strokeWidth="1" strokeDasharray="3 2" />
            {/* Serif V monogram with debossed effect */}
            <path
              d="M16 16H22L24 30L26 16H32L26 34H22L16 16Z"
              fill={paletteColors.ink}
              opacity="0.85"
            />
            {/* Olive Branch Flares */}
            <path
              d="M12 28C10 24 12 20 15 18C15 22 13 25 12 28Z"
              fill={paletteColors.accent}
              opacity="0.7"
            />
            <path
              d="M36 28C38 24 36 20 33 18C33 22 35 25 36 28Z"
              fill={paletteColors.accent}
              opacity="0.7"
            />
          </svg>
        </div>

        {hostNames && (
          <p
            className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-medium mb-1.5 px-4"
            style={{ color: paletteColors.inkMuted }}
          >
            {hostNames}
          </p>
        )}

        {invitationHeading && (
          <p
            className="font-serif italic text-xs sm:text-sm max-w-md mx-auto mb-2 px-4 leading-relaxed"
            style={{ color: paletteColors.inkMuted }}
          >
            {invitationHeading}
          </p>
        )}

        <h2
          className="font-serif-heading text-2xl sm:text-4xl font-normal tracking-tight px-4 leading-tight mb-2"
          style={{
            color: paletteColors.ink,
            textShadow: isPrintMode
              ? 'none'
              : `1px 1px 0px ${paletteColors.embossHighlight}, -0.5px -0.5px 0px ${paletteColors.embossShadow}`,
          }}
        >
          {title}
        </h2>

        {bodyText && (
          <p
            className="text-xs sm:text-sm font-serif max-w-lg mx-auto leading-relaxed px-4 pt-1"
            style={{ color: paletteColors.ink }}
          >
            {bodyText}
          </p>
        )}
      </div>

      {/* Optional Authentic Bilingual Section */}
      {isBilingual && (
        <div
          className="relative z-10 my-3 py-2 px-4 text-center max-w-lg mx-auto border-t border-b"
          style={{ borderColor: paletteColors.frameBorder }}
        >
          {bilingualTitle && (
            <h3 className="font-serif-heading text-base sm:text-lg font-semibold tracking-wide" style={{ color: paletteColors.ink }}>
              {bilingualTitle}
            </h3>
          )}
          {bilingualHeading && (
            <p className="text-[11px] sm:text-xs italic mt-0.5" style={{ color: paletteColors.inkMuted }}>
              {bilingualHeading}
            </p>
          )}
          {bilingualBody && (
            <p className="text-xs sm:text-[13px] leading-relaxed mt-1" style={{ color: paletteColors.ink }}>
              {bilingualBody}
            </p>
          )}
          {(bilingualDate || bilingualVenue) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: paletteColors.inkMuted }}>
              {bilingualDate && <span>{bilingualDate}</span>}
              {bilingualDate && bilingualVenue && <span>•</span>}
              {bilingualVenue && <span>{bilingualVenue}</span>}
            </div>
          )}
          {bilingualFooter && (
            <p className="text-[10px] sm:text-[11px] mt-1 tracking-wider" style={{ color: paletteColors.inkMuted }}>
              {bilingualFooter}
            </p>
          )}
        </div>
      )}

      {/* Formal Date & Venue Section */}
      <div className="relative z-10 my-2 sm:my-3 text-center">
        <div className="inline-block py-2 px-8 border-y" style={{ borderColor: paletteColors.frameBorder }}>
          <p className="font-serif text-sm sm:text-lg font-medium tracking-widest uppercase" style={{ color: paletteColors.ink }}>
            {eventDate || 'Date to be announced'}
          </p>
          <p className="text-xs sm:text-sm font-serif italic mt-0.5" style={{ color: paletteColors.inkMuted }}>
            at {startTime || 'the hour of twilight'}
          </p>
        </div>

        <div className="mt-2.5">
          <p className="font-serif font-semibold text-xs sm:text-base tracking-wide" style={{ color: paletteColors.ink }}>
            {venueName || 'Venue Location'}
          </p>
          {venueAddress && (
            <p className="text-[10px] sm:text-xs font-sans max-w-sm mx-auto mt-0.5" style={{ color: paletteColors.inkMuted }}>
              {venueAddress}
            </p>
          )}
        </div>
      </div>

      {/* Footer Details */}
      <div className="relative z-10 text-center pb-2 pt-2 border-t" style={{ borderColor: paletteColors.frameBorder }}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs" style={{ color: paletteColors.inkMuted }}>
          {rsvpDeadline && (
            <span>
              <strong>R.S.V.P.</strong> by {rsvpDeadline}
            </span>
          )}
          {rsvpDeadline && contactInfo && <span className="hidden sm:inline">•</span>}
          {contactInfo && <span>{contactInfo}</span>}
          {dressCode && (
            <>
              <span className="hidden sm:inline">•</span>
              <span>Attire: {dressCode}</span>
            </>
          )}
        </div>

        {additionalDetails && (
          <p className="text-[9px] sm:text-[10px] mt-1 max-w-md mx-auto italic" style={{ color: paletteColors.inkMuted }}>
            {additionalDetails}
          </p>
        )}
      </div>
    </div>
  );
};
