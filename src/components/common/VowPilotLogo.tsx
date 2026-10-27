import React from 'react';
import { useThemeSafe } from '../../context/ThemeContext';

export interface VowPilotLogoProps {
  variant?: 'horizontal' | 'compact' | 'mark' | 'stacked';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'default' | 'dark' | 'monochrome' | 'terracotta' | 'forest';
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const VowPilotLogo: React.FC<VowPilotLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme: explicitTheme,
  showTagline = false,
  className = '',
  onClick,
}) => {
  const themeCtx = useThemeSafe();
  const isDarkFromDoc = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const isDarkSystem = themeCtx?.isDark ?? isDarkFromDoc;

  const theme = explicitTheme ?? (isDarkSystem ? 'dark' : 'default');

  // Dimensions calibrated for optical balance
  const sizeMap = {
    xs: { mark: 22, text: 'text-base', spacing: 'gap-2', tagline: 'text-[9px]' },
    sm: { mark: 26, text: 'text-lg', spacing: 'gap-2.5', tagline: 'text-[10px]' },
    md: { mark: 34, text: 'text-xl', spacing: 'gap-3', tagline: 'text-xs' },
    lg: { mark: 46, text: 'text-2xl sm:text-3xl', spacing: 'gap-3.5', tagline: 'text-xs sm:text-sm' },
    xl: { mark: 58, text: 'text-3xl sm:text-4xl', spacing: 'gap-4', tagline: 'text-sm sm:text-base' },
  };

  const currentSize = sizeMap[size];

  // Coordinated theme color palettes
  const palette = {
    default: {
      vPrimary: '#B85C3A',     // Terracotta
      vSecondary: '#9E4B2D',   // Deep Terracotta
      leaf: '#6B7F6B',         // Sage
      leafDark: '#586E58',     // Deep Sage
      bud: '#E8C8BD',          // Blush
      budLight: '#F4D7CF',     // Soft Blush
      star: '#B85C3A',         // Terracotta
      text: '#26221F',         // Charcoal
      tagline: '#5C554E',      // Muted Warm Grey
    },
    dark: {
      vPrimary: '#FAF8F5',     // Warm Cream
      vSecondary: '#D48668',   // Terracotta accent
      leaf: '#8CA394',         // Restrained Botanical Sage
      leafDark: '#6B7F6B',     // Mid Sage
      bud: '#C998A2',          // Muted Rose
      budLight: '#E8C8BD',     // Soft Sand
      star: '#D48668',         // Terracotta Gold
      text: '#F1E9E3',         // Warm Cream Text
      tagline: '#C5B9B3',      // Muted Secondary Text
    },
    forest: {
      vPrimary: '#FAF8F5',     // Warm Cream
      vSecondary: '#E8D7C4',   // Sand
      leaf: '#8FA895',         // Soft Sage
      leafDark: '#6B7F6B',     // Mid Sage
      bud: '#F4D7CF',          // Soft Blush
      budLight: '#E8C8BD',     // Blush
      star: '#C66B49',         // Terracotta Gold
      text: '#FAF8F5',         // Warm Cream
      tagline: '#A2B3A6',      // Pale Sage
    },
    monochrome: {
      vPrimary: 'currentColor',
      vSecondary: 'currentColor',
      leaf: 'currentColor',
      leafDark: 'currentColor',
      bud: 'currentColor',
      budLight: 'currentColor',
      star: 'currentColor',
      text: 'currentColor',
      tagline: 'currentColor',
    },
    terracotta: {
      vPrimary: '#B85C3A',
      vSecondary: '#9E4B2D',
      leaf: '#B85C3A',
      leafDark: '#9E4B2D',
      bud: '#E8C8BD',
      budLight: '#F4D7CF',
      star: '#B85C3A',
      text: '#B85C3A',
      tagline: '#9E4B2D',
    },
  }[theme];

  const renderBotanicalMark = (markSize: number) => (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200"
      aria-hidden={variant !== 'mark'}
      role={variant === 'mark' ? 'img' : undefined}
      aria-label={variant === 'mark' ? 'VowPilot' : undefined}
    >
      {/* Botanical Stem & Leaves */}
      <path
        d="M28 88C24 74 27 58 35 46C38 41 43 36 49 32C46 38 46 45 44 51C42 57 39 63 38 70C36 78 37 86 42 93C37 92 32 91 28 88Z"
        fill={palette.leaf}
      />
      <path
        d="M22 68C14 65 12 55 16 48C23 48 27 55 27 63C25 65 23 67 22 68Z"
        fill={palette.leaf}
        opacity={theme === 'monochrome' ? 0.7 : 0.9}
      />
      <path
        d="M26 84C18 84 14 77 17 70C23 69 28 75 29 80C28 82 27 83 26 84Z"
        fill={palette.leafDark}
        opacity={theme === 'monochrome' ? 0.6 : 1}
      />
      <path
        d="M37 98C27 98 22 92 25 86C32 85 38 90 39 95C38 96 37 97 37 98Z"
        fill={palette.leaf}
      />
      <path
        d="M28 92C36 100 48 102 58 98C52 98 44 96 38 91C34 88 30 84 28 92Z"
        fill={palette.vPrimary}
        opacity={theme === 'monochrome' ? 0.8 : 0.95}
      />

      {/* The Refined Serif V Monogram */}
      <path
        d="M14 36H32C29 42 27 48 26 54L48 94L70 36H58V32H84V36L56 98C54 102 51 104 47 104C43 104 40 101 38 96L18 42C16 38 14 36 14 36Z"
        fill={palette.vPrimary}
      />
      <path
        d="M54 96L76 42C78 38 80 36 84 36H92V32H64V36H72L52 90L54 96Z"
        fill={palette.vSecondary}
        opacity={theme === 'monochrome' ? 0.85 : 1}
      />

      {/* Soft Blush Bud */}
      <path
        d="M34 50C33 42 38 35 45 36C47 42 43 49 39 52C37 53 35 52 34 50Z"
        fill={palette.bud}
        opacity={theme === 'monochrome' ? 0.5 : 1}
      />
      <path
        d="M41 46C43 39 49 35 53 38C53 45 47 49 43 50C42 50 41 48 41 46Z"
        fill={palette.budLight}
        opacity={theme === 'monochrome' ? 0.4 : 1}
      />

      {/* Upper Leaf */}
      <path
        d="M46 31C44 24 50 18 56 19C58 25 54 30 48 32C47 32 46 31 46 31Z"
        fill={palette.leaf}
      />

      {/* 4-Point Celebratory Diamond Star */}
      <path
        d="M88 18C88 23 85 27 80 27C85 27 88 31 88 36C88 31 91 27 96 27C91 27 88 23 88 18Z"
        fill={palette.star}
      />
    </svg>
  );

  if (variant === 'mark') {
    return (
      <div
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {renderBotanicalMark(currentSize.mark)}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div
        className={`flex flex-col items-center text-center ${currentSize.spacing} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {renderBotanicalMark(currentSize.mark)}
        <div className="space-y-0.5">
          <span
            className={`block font-serif-heading font-semibold tracking-tight leading-none ${currentSize.text}`}
            style={{ color: palette.text }}
          >
            VowPilot
          </span>
          {showTagline && (
            <p className={`font-sans ${currentSize.tagline} leading-snug pt-1`} style={{ color: palette.tagline }}>
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
      {renderBotanicalMark(currentSize.mark)}
      <div className="flex flex-col justify-center">
        <span
          className={`font-serif-heading font-semibold tracking-tight leading-none ${currentSize.text}`}
          style={{ color: palette.text }}
        >
          VowPilot
        </span>
        {showTagline && (
          <p className={`font-sans ${currentSize.tagline} leading-tight pt-1 hidden sm:block`} style={{ color: palette.tagline }}>
            Plan with clarity. Coordinate with confidence.
          </p>
        )}
      </div>
    </div>
  );
};
