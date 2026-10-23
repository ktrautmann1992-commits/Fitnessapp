import { cardColors, colors, largeViewColors, type ColorScheme } from '@fitnessapp/ui';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useLargeView } from './accessibility';

const SchemeOverride = createContext<ColorScheme | null>(null);

/**
 * Erzwingt für alle Bausteine darin einen Modus – z. B. `dark` in der dunklen Hero-Karte (Design 23.10.2026): Texte,
 * Ringe, Balken und Knöpfe darin nehmen dann automatisch die Dunkel-Palette, deren Kontraste auf `--color-surface`
 * bzw. `--color-background` dunkel geprüft sind (gleiche Werte wie die Hero-Flächen, tokens.test.ts).
 */
export function ColorSchemeOverride({
  scheme,
  children,
}: {
  scheme: ColorScheme;
  children?: ReactNode;
}) {
  return createElement(SchemeOverride.Provider, { value: scheme }, children);
}

/** Hell oder dunkel – passend zur Einstellung des Geräts (für Farbgruppen wie areaColors, cardColors). */
export function useColorSchemeName(): ColorScheme {
  const override = useContext(SchemeOverride);
  const device = useColorScheme();
  return override ?? (device === 'dark' ? 'dark' : 'light');
}

/** Modus des Geräts – unabhängig von einer `ColorSchemeOverride` (z. B. für Flächen, die selbst dunkel sind). */
export function useDeviceSchemeName(): ColorScheme {
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
