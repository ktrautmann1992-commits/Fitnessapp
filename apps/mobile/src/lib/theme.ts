import { colors, type ColorScheme } from '@fitnessapp/ui';
import { useColorScheme } from 'react-native';

/** Aktuelle Farbpalette passend zum Hell-/Dunkelmodus des Geräts. */
export function useThemeColors() {
  const scheme = useColorScheme();
  const resolved: ColorScheme = scheme === 'dark' ? 'dark' : 'light';
  return colors[resolved];
}
