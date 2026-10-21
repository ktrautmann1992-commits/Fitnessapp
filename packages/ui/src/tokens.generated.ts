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
    caution: '#EAB308',
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
    caution: '#FDE047',
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
  xs: 13,
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
  extrabold: '800',
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

/**
 * Bereichsfarben (--area-…), hell und dunkel: surface = Fläche des Icon-Chips, icon = Strich und Akzent-Text,
 * strong = Ring/Balken (kräftig), soft = Balken (zart, nur Deko). Regeln: docs/DESIGN.md „Bereichsfarben“.
 */
export const areaColors = {
  light: {
    training: {
      surface: '#E3EBFF',
      icon: '#1747CC',
      strong: '#1F5BFF',
      soft: '#8DB0FF',
    },
    workouts: {
      surface: '#EDE9FE',
      icon: '#6D28D9',
      strong: '#7C3AED',
      soft: '#C4B5FD',
    },
    ernaehrung: {
      surface: '#DCFCE7',
      icon: '#15803D',
      strong: '#16A34A',
      soft: '#86EFAC',
    },
    einkaufen: {
      surface: '#CFFAFE',
      icon: '#0E7490',
      strong: '#0891B2',
      soft: '#67E8F9',
    },
    ausdauer: {
      surface: '#FFEDD5',
      icon: '#C2410C',
      strong: '#EA580C',
      soft: '#FDBA74',
    },
    wettkampf: {
      surface: '#FDECD8',
      icon: '#C2410C',
      strong: '#EA580C',
      soft: '#FDBA74',
    },
    fortschritt: {
      surface: '#E3EBFF',
      icon: '#1747CC',
      strong: '#1F5BFF',
      soft: '#8DB0FF',
    },
    zyklus: {
      surface: '#FCE7F3',
      icon: '#BE185D',
      strong: '#DB2777',
      soft: '#F9A8D4',
    },
  },
  dark: {
    training: {
      surface: '#1C2A4D',
      icon: '#8DB0FF',
      strong: '#4D7DFF',
      soft: '#2E4A8F',
    },
    workouts: {
      surface: '#2A1F4A',
      icon: '#C4B5FD',
      strong: '#9F7AEA',
      soft: '#4C3A85',
    },
    ernaehrung: {
      surface: '#12321F',
      icon: '#86EFAC',
      strong: '#22C55E',
      soft: '#1F6B3D',
    },
    einkaufen: {
      surface: '#0E3038',
      icon: '#67E8F9',
      strong: '#06B6D4',
      soft: '#155E6B',
    },
    ausdauer: {
      surface: '#3A2312',
      icon: '#FF9A5C',
      strong: '#F97316',
      soft: '#7C3F17',
    },
    wettkampf: {
      surface: '#3D2614',
      icon: '#FF9A5C',
      strong: '#F97316',
      soft: '#7C3F17',
    },
    fortschritt: {
      surface: '#1C2A4D',
      icon: '#8DB0FF',
      strong: '#4D7DFF',
      soft: '#2E4A8F',
    },
    zyklus: {
      surface: '#3A1530',
      icon: '#F9A8D4',
      strong: '#EC4899',
      soft: '#831843',
    },
  },
} as const;

export type AreaId = keyof (typeof areaColors)['light'];
export type AreaColorRole = keyof (typeof areaColors)['light'][AreaId];

/** Dunkle „Hero“-Karte (--hero-…), hell und dunkel. */
export const heroColors = {
  light: {
    background: '#0A0C10',
    text: '#FFFFFF',
    muted: '#B4BDD0',
    accent: '#8DB0FF',
    border: '#0A0C10',
  },
  dark: {
    background: '#151922',
    text: '#FFFFFF',
    muted: '#B4BDD0',
    accent: '#8DB0FF',
    border: '#262C3A',
  },
} as const;

/** Karten (--card-…): Rand und Trennlinien, hell und dunkel. */
export const cardColors = {
  light: {
    border: '#E3E7EF',
    divider: '#EEF1F6',
  },
  dark: {
    border: '#262C3A',
    divider: '#1F2430',
  },
} as const;

/** Schriftfamilien (--font-family-…, nur der erste Name; Ersatzschrift ist die Systemschrift). */
export const fontFamily = {
  base: 'Plus Jakarta Sans',
} as const;
