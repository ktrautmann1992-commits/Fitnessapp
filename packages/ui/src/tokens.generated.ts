/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Quelle: packages/ui/theme.css (einzige Quelle für Farben, Abstände und Schrift).
 * Neu erzeugen: pnpm --filter @fitnessapp/ui tokens
 * Anleitung: docs/DESIGN.md
 */

export const colors = {
  light: {
    background: '#F4F6FA',
    surface: '#FFFFFF',
    text: '#0A0C10',
    textMuted: '#586173',
    primary: '#1F5BFF',
    primaryText: '#FFFFFF',
    link: '#1747CC',
    border: '#B4BDD0',
    success: '#15803D',
    warning: '#A15C00',
    danger: '#B91C1C',
  },
  dark: {
    background: '#0A0C10',
    surface: '#151922',
    text: '#F4F6FA',
    textMuted: '#B4BDD0',
    primary: '#1F5BFF',
    primaryText: '#FFFFFF',
    link: '#8DB0FF',
    border: '#262C3A',
    success: '#4ADE80',
    warning: '#FFB020',
    danger: '#F87171',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];

/** Abstände in Pixeln. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Ecken-Rundung in Pixeln. */
export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Schriftgrößen in Pixeln. */
export const fontSize = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

/** Schriftstärken (als Text, so erwartet es React Native). */
export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/** Maximale Inhaltsbreite in Pixeln, damit die Web-Version auf Tablets/Desktop nicht zu breit wird. */
export const maxContentWidth = 560;

/** Markenfarben (Palette aus theme.css, --brand-…). Gelten hell und dunkel gleich. */
export const brandColors = {
  schwarz: '#0A0C10',
  graphit: '#151922',
  graphitHell: '#262C3A',
  blau: '#1F5BFF',
  blauDunkel: '#1747CC',
  himmel: '#8DB0FF',
  eisblau: '#E3EBFF',
  hell: '#F4F6FA',
  grau: '#586173',
  grauDunkel: '#B4BDD0',
  signal: '#FFB020',
  weiss: '#FFFFFF',
} as const;

export type BrandColor = keyof typeof brandColors;
