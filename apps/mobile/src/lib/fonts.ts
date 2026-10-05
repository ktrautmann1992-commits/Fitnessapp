import { isLoaded } from 'expo-font';
import { Platform, type TextStyle } from 'react-native';

/**
 * Markenschrift Archivo (OFL) – wie auf der Landingpage.
 *
 * - Browser: variable Schrift aus public/fonts, eingebunden in public/index.html (gilt für alle Texte).
 *   Überschriften schmal (Breite 75) und extra fett – wie `.titel-gross` der Landingpage.
 * - iPhone/Android: Archivo Bold aus assets/fonts, geladen über expo-font (use-brand-fonts.native.ts),
 *   nur für Überschriften. Fließtext bleibt in der gut lesbaren Systemschrift.
 */
export const ARCHIVO_BOLD = 'Archivo-Bold';

const WEB_DISPLAY = { fontWeight: '800', fontVariationSettings: "'wdth' 75" } as TextStyle;
const NATIVE_DISPLAY: TextStyle = { fontFamily: ARCHIVO_BOLD, fontWeight: 'normal' };
const NATIVE_FALLBACK: TextStyle = { fontWeight: '800' };

/**
 * Große Überschriften (Willkommen, Bildschirmtitel). In der App nur mit Archivo, wenn die Schrift wirklich
 * geladen ist – sonst kräftige Systemschrift (kein unbekannter Schriftname, keine Warnung).
 */
export function displayFont(): TextStyle {
  if (Platform.OS === 'web') {
    return WEB_DISPLAY;
  }
  return isLoaded(ARCHIVO_BOLD) ? NATIVE_DISPLAY : NATIVE_FALLBACK;
}
