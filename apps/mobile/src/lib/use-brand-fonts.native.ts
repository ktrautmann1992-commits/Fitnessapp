import { useFonts } from 'expo-font';

import { ARCHIVO_BOLD } from './fonts';

// Metro bindet Schriftdateien nur über require() ein.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archivoBoldFile: number = require('../../assets/fonts/Archivo-Bold.ttf');

/**
 * Lädt Archivo Bold (OFL, Lizenz in assets/fonts/OFL.txt) aus dem App-Paket – keine Verbindung ins Netz.
 * Gibt true zurück, sobald die Schrift bereitsteht oder das Laden fehlgeschlagen ist (dann Systemschrift).
 */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({ [ARCHIVO_BOLD]: archivoBoldFile });
  return loaded || error != null;
}
