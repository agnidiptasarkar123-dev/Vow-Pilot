import React from 'react';

export interface VowPilotLogoProps {
  variant?: 'horizontal' | 'compact' | 'mark' | 'stacked';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'default' | 'dark' | 'monochrome' | 'terracotta';
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const VowPilotLogo: React.FC<VowPilotLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme = 'default',
  showTagline = false,
  className = '',
  onClick,
}) => {
  // Dimensions calibrated for optical balance
  const sizeMap = {
    xs: { mark: 20, text: 'text-base', spacing: 'gap-2', tagline: 'text-[9px]' },
    sm: { mark: 24, text: 'text-lg', spacing: 'gap-2.5', tagline: 'text-[10px]' },
    md: { mark: 32, text: 'text-xl', spacing: 'gap-3', tagline: 'text-xs' },
    lg: { mark: 44, text: 'text-2xl sm:text-3xl', spacing: 'gap-3.5', tagline: 'text-xs sm:text-sm' },
    xl: { mark: 56, text: 'text-3xl sm:text-4xl', spacing: 'gap-4', tagline: 'text-sm sm:text-base' },
  };

  const currentSize = sizeMap[size];

  // Theme colors
  const colors = {
    default: {
      primary: '#B85C3A',
      secondary: '#E8C8BD',
      text: '#26221F',
      tagline: '#5C554E',
    },
    dark: {
      primary: '#FAF8F5',
      secondary: '#E8C8BD',
      text: '#FAF8F5',
      tagline: '#D5CCC0',
    },
    monochrome: {
      primary: 'currentColor',
      secondary: 'currentColor',
      text: 'currentColor',
      tagline: 'currentColor',
    },
    terracotta: {
      primary: '#B85C3A',
      secondary: '#E8C8BD',
      text: '#B85C3A',
      tagline: '#9E4B2D',
    },
  }[theme];

  const renderMark = (markSize: number) => (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200"
      aria-hidden={variant !== 'mark'}
      role={variant === 'mark' ? 'img' : undefined}
      aria-label={variant === 'mark' ? 'VowPilot' : undefined}
    >
      {/* Left foundation ribbon (Sweeping V-stroke) */}
      <path
        d="M8 15C13.5 15 17.5 20.5 20.8 30L23.2 37.5C23.5 38.2 24.5 38.2 24.8 37.5L27.2 30C28.5 24.5 30.5 19.5 33.5 15.5C31 16.5 29 19.5 27.8 24L24 34.5L20.2 24C18 18 14 15 8 15Z"
        fill={colors.primary}
      />
      {/* Right ascending flight ribbon (Pilot path) */}
      <path
        d="M25 34L33.5 17.5C35 14.5 37.8 13.5 39.5 14.8C41 16.2 40 19 37.5 23L28 35.5L25 34Z"
        fill={colors.primary}
      />
      {/* Inner coordination fold (Sequence & depth) */}
      <path
        d="M26 25C27.8 19.5 30.5 15 34.5 14.2C36.8 13.8 37.8 15.2 36.5 17.2C34.2 20.2 31 24.5 28 28.2L26 25Z"
        fill={colors.secondary}
        fillOpacity={theme === 'monochrome' ? 0.65 : 1}
      />
    </svg>
  );

  if (variant === 'mark') {
    return (
      <div
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {renderMark(currentSize.mark)}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div
        className={`flex flex-col items-center text-center ${currentSize.spacing} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {renderMark(currentSize.mark)}
        <div className="space-y-0.5">
          <span
            className={`block font-serif-heading font-semibold tracking-tight leading-none ${currentSize.text}`}
            style={{ color: colors.text }}
          >
            VowPilot
          </span>
          {showTagline && (
            <p className={`font-sans ${currentSize.tagline} leading-snug pt-1`} style={{ color: colors.tagline }}>
              Plan with clarity. Coordinate with confidence.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Horizontal or Compact lockup
  return (
    <div
      className={`inline-flex items-center ${currentSize.spacing} select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {renderMark(currentSize.mark)}
      <div className="flex flex-col justify-center">
        <span
          className={`font-serif-heading font-semibold tracking-tight leading-none ${currentSize.text}`}
          style={{ color: colors.text }}
        >
          VowPilot
        </span>
        {showTagline && (
          <p className={`font-sans ${currentSize.tagline} leading-tight pt-1 hidden sm:block`} style={{ color: colors.tagline }}>
            Plan with clarity. Coordinate with confidence.
          </p>
        )}
      </div>
    </div>
  );
};
