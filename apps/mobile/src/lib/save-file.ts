/**
 * Datei auf dem Gerät speichern – Browser (Web-Export). Für den Datenexport „Meine Daten“ (docs/PLAN-PHASE-4.md 3.7,
 * Etappe D): Der Browser lädt die Datei in den Download-Ordner herunter. Kein Teilen-Dialog (CLAUDE.md „Kein
 * Teilen“), kein Upload, keine Zwischen-Datei – der Inhalt liegt nur als Blob im Arbeitsspeicher, die Adresse wird
 * nach dem Anstoßen wieder freigegeben. Gegenstück für iPhone/Android: save-file.native.ts.
 */
export type SaveFileResult = 'saved' | 'cancelled';

export const SAVE_TARGET = 'download' as const;

export async function saveTextFile(
  name: string,
  text: string,
  mimeType = 'application/json',
): Promise<SaveFileResult> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('save_failed');
  }
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Erst nach dem Start des Downloads freigeben (sofortiges Freigeben bricht ihn in manchen Browsern ab).
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'saved';
}
