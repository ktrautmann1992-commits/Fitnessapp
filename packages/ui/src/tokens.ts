/**
 * Design-Tokens. Reine Werte ohne Plattform-Abhängigkeit, damit React Native und Next.js sie teilen können.
 */

export const colors = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#4B5563',
    primary: '#0F9D58',
    primaryText: '#FFFFFF',
    border: '#E5E7EB',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
  },
  dark: {
    background: '#0B0F14',
    surface: '#151B23',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    primary: '#34D399',
    primaryText: '#04130C',
    border: '#253041',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];

/** Abstände in Pixeln (4er-Raster). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/** Maximale Inhaltsbreite, damit die Web-Version auf Tablets/Desktop nicht zu breit wird. */
export const maxContentWidth = 560;
