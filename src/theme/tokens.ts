/**
 * VowPilot Design System Tokens
 * Unified single source of truth for typography, color palette, spacing,
 * elevation, radii, motion, and responsive breakpoints.
 */

export const tokens = {
  colors: {
    // Canvas & Surface
    canvas: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#FBF9F7',
    surfaceTrack: '#F4EFEA',
    surfaceMuted: '#EBE5DC',

    // Borders
    borderSubtle: '#E6DFD5',
    borderStrong: '#D5CCC0',
    borderFocus: '#A2421D',

    // Content & Typography
    textPrimary: '#1F1D1A',    // 15.9:1 on canvas
    textSecondary: '#5C554E',  // 7.07:1 on canvas
    textTertiary: '#6E665E',   // 5.38:1 on canvas (WCAG AA compliant)
    textMuted: '#8A8177',

    // Brand Accent (Terracotta)
    accent: '#A2421D',
    accentHover: '#863414',
    accentSubtle: '#FAF0EB',
    accentBorder: '#F3CEBE',
    accentLight: '#FDF3ED',

    // Semantic States (All WCAG 2.2 AA compliant >= 4.5:1 text on container)
    semantic: {
      success: {
        text: '#047857',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        dot: '#059669',
      },
      warning: {
        text: '#B45309',
        bg: '#FFFBEB',
        border: '#FDE68A',
        dot: '#D97706',
      },
      error: {
        text: '#BE123C',
        bg: '#FFF1F2',
        border: '#FECDD3',
        dot: '#E11D48',
      },
      info: {
        text: '#3730A3',
        bg: '#EEF2FF',
        border: '#C7D2FE',
        dot: '#4F46E5',
      },
      neutral: {
        text: '#5C554E',
        bg: '#F4EFEA',
        border: '#E6DFD5',
        dot: '#8A8177',
      },
    },
  },

  typography: {
    fonts: {
      serifHeading: "'Source Serif 4', Georgia, serif",
      sansBody: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      monoData: "'JetBrains Mono', ui-monospace, monospace",
    },
    sizes: {
      display: 'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight',
      h1: 'text-2xl sm:text-3xl font-bold tracking-tight',
      h2: 'text-xl sm:text-2xl font-bold tracking-tight',
      h3: 'text-base sm:text-lg font-semibold',
      bodyLg: 'text-base sm:text-lg leading-relaxed',
      body: 'text-sm sm:text-base leading-normal',
      bodySm: 'text-xs sm:text-sm text-[#5C554E]',
      caption: 'text-xs text-[#6E665E]',
      micro: 'text-[11px] font-medium',
      data: 'font-mono text-sm font-semibold tracking-tight',
    },
  },

  spacing: {
    cardPadding: 'p-5 sm:p-6 lg:p-7',
    modalPadding: 'p-6 sm:p-8',
    sectionGap: 'space-y-6 sm:space-y-8',
    containerMax: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  },

  radii: {
    badge: 'rounded-full',
    button: 'rounded-lg',
    input: 'rounded-lg',
    card: 'rounded-xl',
    modal: 'rounded-2xl',
  },

  elevation: {
    card: 'shadow-[0_1px_3px_rgba(31,29,26,0.06),0_1px_2px_rgba(31,29,26,0.04)]',
    cardHover: 'hover:shadow-[0_4px_12px_rgba(31,29,26,0.08)] hover:-translate-y-0.5 transition-all duration-200',
    popover: 'shadow-[0_10px_25px_rgba(31,29,26,0.12)]',
    modal: 'shadow-[0_20px_50px_rgba(31,29,26,0.18)]',
  },

  focusRing: 'focus-visible:outline-2 focus-visible:outline-[#A2421D] focus-visible:outline-offset-2',

  touchTarget: 'min-h-[44px] min-w-[44px]',

  breakpoints: {
    mobile: '640px',
    tablet: '768px',
    laptop: '1024px',
    desktop: '1280px',
    wide: '1536px',
  },
} as const;

export type DesignTokens = typeof tokens;
