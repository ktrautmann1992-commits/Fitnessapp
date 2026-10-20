import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { JAKARTA_FILES } from './fonts';

// Metro bindet Schriftdateien nur über require() ein. Einzeln, damit nur die vier genutzten Stärken ins App-Paket
// kommen (der Paket-Index würde alle 14 Schnitte einbinden).
/* eslint-disable @typescript-eslint/no-require-imports */
const files: Record<string, number> = {
  [JAKARTA_FILES.regular]: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
  [JAKARTA_FILES.semibold]: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
  [JAKARTA_FILES.bold]: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
  [JAKARTA_FILES.extrabold]: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Spätestens nach dieser Zeit startet die App auch ohne Schrift (Systemschrift), falls das Laden hängt. */
export const FONT_TIMEOUT_MS = 3000;

/**
 * Lädt Plus Jakarta Sans (OFL) aus dem App-Paket – keine Verbindung ins Netz.
 * Gibt true zurück, sobald die Schrift bereitsteht, das Laden fehlgeschlagen ist oder nach FONT_TIMEOUT_MS
 * (dann Systemschrift) – der Startbildschirm bleibt nie hängen.
 */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(files);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return loaded || error != null || timedOut;
}
