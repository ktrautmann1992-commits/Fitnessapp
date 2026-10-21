import { cardColors, colors, largeViewColors, type ColorScheme } from '@fitnessapp/ui';
import { useColorScheme } from 'react-native';

import { useLargeView } from './accessibility';

/** Hell oder dunkel – passend zur Einstellung des Geräts (für Farbgruppen wie areaColors, cardColors). */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Farbpalette je Modus: Pflicht-Farben aus theme.css plus `cardBorder` (zarter Kartenrand) und `divider`
 * (Trennlinie) aus `--card-…` (Design 20.10.2026). Feste Objekte – keine neue Palette je Render.
 */
const palettes = {
  light: {
    ...colors.light,
    cardBorder: cardColors.light.border,
    divider: cardColors.light.divider,
  },
  dark: { ...colors.dark, cardBorder: cardColors.dark.border, divider: cardColors.dark.divider },
} as const;

/**
 * „Große Ansicht“ (FA5): Text, gedämpfter Text und Links mit mindestens 7 : 1 (WCAG AAA, Tokens --large-… aus
 * theme.css, geprüft in packages/ui/src/tokens.test.ts).
 */
const largePalettes = {
  light: { ...palettes.light, ...largeViewColors.light },
  dark: { ...palettes.dark, ...largeViewColors.dark },
} as const;

/** Aktuelle Farbpalette passend zum Hell-/Dunkelmodus des Geräts. */
export function useThemeColors() {
  const scheme = useColorSchemeName();
  return useLargeView() ? largePalettes[scheme] : palettes[scheme];
}
