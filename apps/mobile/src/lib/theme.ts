import { colors, type ColorScheme } from '@fitnessapp/ui';
import { useColorScheme } from 'react-native';

/** Hell oder dunkel – passend zur Einstellung des Geräts (für Farbgruppen wie areaColors, cardColors). */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** Aktuelle Farbpalette passend zum Hell-/Dunkelmodus des Geräts. */
export function useThemeColors() {
  return colors[useColorSchemeName()];
}
