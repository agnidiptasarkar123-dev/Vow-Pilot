import React from 'react';
import { InvitationDesign } from '../../../types';

interface TemplateProps {
  invitation: InvitationDesign;
  className?: string;
  isPrintMode?: boolean;
}

export const ForestSageTemplate: React.FC<TemplateProps> = ({
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
    palette = 'forest-gold',
  } = invitation;

  const themeColors = {
    'forest-gold': {
      bg: '#1F2D24',
      cardBg: '#19261E',
      textPrimary: '#FAF8F5',
      textSecondary: '#C5D1C8',
      goldAccent: '#E8D7C4',
      borderSubtle: '#2F4235',
      leafSage: '#8FA895',
    },
    'cream-terracotta': {
      bg: '#251F1C',
      cardBg: '#1E1917',
      textPrimary: '#FAF8F5',
      textSecondary: '#D6C8C0',
      goldAccent: '#CB7F64',
      borderSubtle: '#3D302A',
      leafSage: '#9E4B2D',
    },
    'sage-blush': {
      bg: '#212B23',
      cardBg: '#1A231C',
      textPrimary: '#FAF8F5',
      textSecondary: '#C2D1C5',
      goldAccent: '#F4D7CF',
      borderSubtle: '#334236',
      leafSage: '#7F9E85',
    },
    'pearl-charcoal': {
      bg: '#1C1A17',
      cardBg: '#141311',
      textPrimary: '#FAF8F5',
      textSecondary: '#C4BEB5',
      goldAccent: '#E0DDD5',
      borderSubtle: '#2E2B26',
      leafSage: '#9E988D',
    },
    'terracotta-sand': {
      bg: '#2B1E19',
      cardBg: '#211612',
      textPrimary: '#FAF8F5',
      textSecondary: '#D9C7C0',
      goldAccent: '#E8D7C4',
      borderSubtle: '#453028',
      leafSage: '#B85C3A',
    },
  }[palette];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-6 sm:p-10 select-none ${className}`}
      style={{
        backgroundColor: themeColors.bg,
        color: themeColors.textPrimary,
        boxShadow: isPrintMode
          ? 'none'
          : '0 24px 48px -12px rgba(10, 18, 13, 0.45), 0 4px 16px -2px rgba(10, 18, 13, 0.25)',
      }}
    >
      {/* Decorative Gold & Botanical Vine Frame SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer Hairline Gold Border */}
        <rect
          x="14"
          y="14"
          width="calc(100% - 28px)"
          height="calc(100% - 28px)"
          rx="2"
          fill="none"
          stroke={themeColors.goldAccent}
          strokeWidth="1"
          opacity="0.8"
        />

        {/* Inner Muted Sage Inset Frame */}
        <rect
          x="19"
          y="19"
          width="calc(100% - 38px)"
          height="calc(100% - 38px)"
          rx="1"
          fill="none"
          stroke={themeColors.borderSubtle}
          strokeWidth="0.75"
        />

        {/* Botanical Foliage Corner Flourishes */}
        {/* Top-Left */}
        <path
          d="M16 16 C 24 16, 28 20, 32 28 C 24 28, 20 24, 16 16 Z"
          fill={themeColors.leafSage}
          opacity="0.6"
        />
        {/* Top-Right */}
        <path
          d="M calc(100% - 16px) 16 C calc(100% - 24px) 16, calc(100% - 28px) 20, calc(100% - 32px) 28 C calc(100% - 24px) 28, calc(100% - 20px) 24, calc(100% - 16px) 16 Z"
          fill={themeColors.leafSage}
          opacity="0.6"
        />
        {/* Bottom-Left */}
        <path
          d="M 16 calc(100% - 16px) C 24 calc(100% - 16px), 28 calc(100% - 20px), 32 calc(100% - 28px) C 24 calc(100% - 28px), 20 calc(100% - 24px), 16 calc(100% - 16px) Z"
          fill={themeColors.leafSage}
          opacity="0.6"
        />
        {/* Bottom-Right */}
        <path
          d="M calc(100% - 16px) calc(100% - 16px) C calc(100% - 24px) calc(100% - 16px), calc(100% - 28px) calc(100% - 20px), calc(100% - 32px) calc(100% - 28px) C calc(100% - 24px) calc(100% - 28px), calc(100% - 20px) calc(100% - 24px), calc(100% - 16px) calc(100% - 16px) Z"
          fill={themeColors.leafSage}
          opacity="0.6"
        />
      </svg>

      {/* Header and Botanical Monogram */}
      <div className="relative z-10 text-center pt-2 sm:pt-4">
        {/* Botanical Gold Monogram Crest */}
        <div className="mx-auto mb-3 flex items-center justify-center">
          <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Serif V */}
            <path
              d="M12 14H18L24 32L30 14H36L27 38H21L12 14Z"
              fill={themeColors.goldAccent}
            />
            {/* Sage Vine Branch */}
            <path
              d="M18 24C15 22 14 18 16 15C19 16 20 20 18 24Z"
              fill={themeColors.leafSage}
            />
            <path
              d="M30 24C33 22 34 18 32 15C29 16 28 20 30 24Z"
              fill={themeColors.leafSage}
            />
            {/* 4-point Diamond Star */}
            <path
              d="M24 6L25.2 9.5L28.7 10.7L25.2 11.9L24 15.4L22.8 11.9L19.3 10.7L22.8 9.5Z"
              fill={themeColors.goldAccent}
            />
          </svg>
        </div>

        {hostNames && (
          <p
            className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-medium mb-1.5 px-4"
            style={{ color: themeColors.goldAccent }}
          >
            {hostNames}
          </p>
        )}

        {invitationHeading && (
          <p
            className="font-serif italic text-xs sm:text-sm max-w-md mx-auto mb-2 px-4 leading-relaxed"
            style={{ color: themeColors.textSecondary }}
          >
            {invitationHeading}
          </p>
        )}

        <h2
          className="font-serif-heading text-2xl sm:text-4xl font-semibold tracking-tight px-4 leading-tight mb-2"
          style={{ color: themeColors.textPrimary }}
        >
          {title}
        </h2>

        {bodyText && (
          <p
            className="text-xs sm:text-sm font-serif max-w-lg mx-auto leading-relaxed px-4 pt-1"
            style={{ color: themeColors.textSecondary }}
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
            borderColor: themeColors.borderSubtle,
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          {bilingualTitle && (
            <h3
              className="font-serif-heading text-base sm:text-lg font-semibold tracking-wide"
              style={{ color: themeColors.goldAccent }}
            >
              {bilingualTitle}
            </h3>
          )}
          {bilingualHeading && (
            <p className="text-[11px] sm:text-xs italic mt-0.5" style={{ color: themeColors.textSecondary }}>
              {bilingualHeading}
            </p>
          )}
          {bilingualBody && (
            <p className="text-xs sm:text-[13px] leading-relaxed mt-1" style={{ color: themeColors.textPrimary }}>
              {bilingualBody}
            </p>
          )}
          {(bilingualDate || bilingualVenue) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: themeColors.goldAccent }}>
              {bilingualDate && <span>{bilingualDate}</span>}
              {bilingualDate && bilingualVenue && <span>•</span>}
              {bilingualVenue && <span>{bilingualVenue}</span>}
            </div>
          )}
          {bilingualFooter && (
            <p className="text-[10px] sm:text-[11px] mt-1 tracking-wider opacity-80" style={{ color: themeColors.textSecondary }}>
              {bilingualFooter}
            </p>
          )}
        </div>
      )}

      {/* Date & Location Section */}
      <div className="relative z-10 my-2 sm:my-3 text-center">
        <div className="inline-flex items-center justify-center gap-4 sm:gap-6 py-2 px-6 border-y" style={{ borderColor: themeColors.borderSubtle }}>
          <span className="font-serif font-semibold text-xs sm:text-base tracking-wider" style={{ color: themeColors.goldAccent }}>
            {eventDate || 'Date to be announced'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColors.leafSage }} />
          <span className="font-serif font-semibold text-xs sm:text-base tracking-wider" style={{ color: themeColors.goldAccent }}>
            {startTime || 'Evening'}
          </span>
        </div>

        <div className="mt-2.5">
          <p className="font-serif font-semibold text-xs sm:text-base tracking-wide" style={{ color: themeColors.textPrimary }}>
            {venueName || 'Venue location'}
          </p>
          {venueAddress && (
            <p className="text-[10px] sm:text-xs font-sans max-w-sm mx-auto mt-0.5" style={{ color: themeColors.textSecondary }}>
              {venueAddress}
            </p>
          )}
        </div>
      </div>

      {/* Footer / RSVP */}
      <div className="relative z-10 text-center pb-2 pt-2 border-t" style={{ borderColor: themeColors.borderSubtle }}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs" style={{ color: themeColors.textSecondary }}>
          {rsvpDeadline && (
            <span>
              <strong>RSVP:</strong> {rsvpDeadline}
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
          <p className="text-[9px] sm:text-[10px] mt-1 max-w-md mx-auto italic" style={{ color: themeColors.textSecondary }}>
            {additionalDetails}
          </p>
        )}
      </div>
    </div>
  );
};
