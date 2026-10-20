import { fontFamily, fontWeight } from '@fitnessapp/ui';
import { isLoaded } from 'expo-font';
import { Platform, type TextStyle } from 'react-native';

/**
 * App-Schrift Plus Jakarta Sans (OFL, Entwurf „Übersicht neu“, 20.10.2026) – ohne Verbindung zu Google (DSGVO).
 *
 * - Browser: variable Schrift aus public/fonts (200–800), eingebunden in public/index.html für ALLE Texte der App.
 *   Hier genügt die Schriftstärke.
 * - iPhone/Android: je Stärke eine eigene Datei aus @expo-google-fonts/plus-jakarta-sans (400/600/700/800), geladen
 *   über expo-font (use-brand-fonts.native.ts). Eigene Schriften kennen dort keine „fontWeight“ – darum je Stärke
 *   ein eigener Name und fontWeight 'normal'. Ist die Datei (noch) nicht geladen: Systemschrift in der Stärke.
 */
export type FontWeightName = keyof typeof fontWeight;

/** Name der Schriftdatei je Stärke (so registriert expo-font sie in use-brand-fonts.native.ts). */
export const JAKARTA_FILES = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const satisfies Record<FontWeightName, string>;

/** Familie aus theme.css (--font-family-base), für Prüfungen und Dokumentation. */
export const APP_FONT_FAMILY = fontFamily.base;

/**
 * Schrift-Stil für eine Stärke. Immer NACH eigenen Stilen mit fontWeight anhängen:
 * `style={[styles.title, appFont('bold')]}`.
 */
export function appFont(weight: FontWeightName = 'regular'): TextStyle {
  if (Platform.OS === 'web') {
    return { fontWeight: fontWeight[weight] };
  }
  const file = JAKARTA_FILES[weight];
  return isLoaded(file)
    ? { fontFamily: file, fontWeight: 'normal' }
    : { fontWeight: fontWeight[weight] };
}

/** Große Überschriften (Bildschirmtitel, Willkommen, große Zahlen): extra fett, leicht enger gesetzt. */
export function displayFont(): TextStyle {
  return { ...appFont('extrabold'), letterSpacing: -0.5 };
}
