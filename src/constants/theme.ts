// SafeRoute Modern Theme - Dark & Light
export const Colors = {
  // Primary palette
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4F46E5',
  primaryFaded: 'rgba(108, 99, 255, 0.12)',

  // Accent
  accent: '#00D9FF',
  accentLight: '#67E8F9',
  accentDark: '#0891B2',

  // Safety colors
  safeGreen: '#10B981',
  safeGreenLight: '#34D399',
  safeGreenFaded: 'rgba(16, 185, 129, 0.12)',

  warningOrange: '#F59E0B',
  warningOrangeFaded: 'rgba(245, 158, 11, 0.12)',

  dangerRed: '#EF4444',
  dangerRedLight: '#F87171',
  dangerRedFaded: 'rgba(239, 68, 68, 0.12)',

  // Dark theme base
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceLight: '#334155',
    card: '#1E293B',
    border: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    inputBg: '#1E293B',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  // Light theme base
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceLight: '#F1F5F9',
    card: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    inputBg: '#F1F5F9',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  }),
};
