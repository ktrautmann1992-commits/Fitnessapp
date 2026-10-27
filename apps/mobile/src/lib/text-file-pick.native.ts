import { File, type PickSingleFileResult } from 'expo-file-system';

/**
 * Textdatei wählen und lesen – iPhone/Android (GPX-Import, Sportarten Stufe 1 · Wandern): System-Dateiauswahl über
 * expo-file-system (File.pickFileAsync, iPhone liest eine Kopie), Größe vor dem Lesen geprüft, Inhalt nur im
 * Arbeitsspeicher – nichts wird hochgeladen. Alle Dateiarten zulassen: GPX hat auf vielen Geräten keinen eigenen
 * MIME-Typ; ob es GPX ist, prüft packages/core (parseGpx). Gegenstück für den Browser: text-file-pick.ts.
 */
export type TextFilePick =
  | { readonly kind: 'ok'; readonly text: string; readonly name: string }
  | { readonly kind: 'cancelled' | 'unreadable' | 'too_large' | 'unsupported' };

export const TEXT_FILE_PICK_SUPPORTED = true;

export const TEXT_FILE_INPUT_TEST_ID = 'gpx-file-input';

export async function pickTextFile(options: {
  readonly accept: string;
  readonly maxBytes: number;
}): Promise<TextFilePick> {
  let picked: PickSingleFileResult;
  try {
    picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  } catch {
    return { kind: 'unreadable' };
  }
  if (picked.canceled) return { kind: 'cancelled' };
  const file = picked.result;
  try {
    if (typeof file.size === 'number' && file.size > options.maxBytes) return { kind: 'too_large' };
    return { kind: 'ok', text: await file.text(), name: file.name };
  } catch {
    return { kind: 'unreadable' };
  }
}
