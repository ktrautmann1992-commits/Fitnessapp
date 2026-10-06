import { Directory } from 'expo-file-system';

/**
 * Datei auf dem Gerät speichern – iPhone/Android (docs/PLAN-PHASE-4.md 3.7, Etappe D). Die Person wählt im
 * System-Dialog einen Ordner (iPhone: „Dateien“, z. B. „Auf meinem iPhone“ oder iCloud Drive; Android: Speicher-
 * Auswahl, z. B. „Downloads“), dorthin wird die Datei geschrieben (expo-file-system, Directory.pickDirectoryAsync).
 *
 * Bewusst KEIN Teilen-Dialog (expo-sharing): CLAUDE.md „Kein Teilen“ und Gleichstand mit dem PDF-Export (Wächter
 * B2) – der Teilen-Dialog böte Nachrichten-, Mail- und Social-Apps direkt an. So entsteht auch keine Zwischen-Datei
 * im App-Speicher, die danach gelöscht werden müsste (Abweichung vom Plan 6.1 Punkt 6, dort begründet). Was die
 * Person mit der gespeicherten Datei macht, entscheidet sie selbst (Datenübertragbarkeit, Art. 20 DSGVO).
 *
 * Gibt es den Namen im Ordner schon (zweiter Export am selben Tag), wird ein Zähler angehängt
 * („…-2026-10-07-2.json“): Das iPhone überschreibt nie und würfe sonst FileAlreadyExists (Wächter D S1); Android
 * benennt zwar selbst um, bekommt aber denselben Namen.
 */
export type SaveFileResult = 'saved' | 'cancelled';

export const SAVE_TARGET = 'folder' as const;

function isCancel(error: unknown): boolean {
  const e = (error ?? {}) as { code?: unknown; message?: unknown };
  return /cancel/i.test(`${String(e.code ?? '')} ${String(e.message ?? '')}`);
}

/** Freier Dateiname: „name.json“, sonst „name-2.json“, „name-3.json“ … */
export function uniqueFileName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function existingNames(directory: Directory): Set<string> {
  try {
    return new Set(directory.list().map((entry) => entry.name));
  } catch {
    // Ordner nicht lesbar – dann gilt der Name wie gewählt (Android benennt selbst um).
    return new Set();
  }
}

export async function saveTextFile(
  name: string,
  text: string,
  mimeType = 'application/json',
): Promise<SaveFileResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    // Ohne Inhalte in der Meldung und bewusst ohne `cause` (die Datei enthält Gesundheitsdaten, keine Inhalte in Logs).
    // eslint-disable-next-line preserve-caught-error
    throw new Error('save_failed');
  }
  try {
    const file = directory.createFile(uniqueFileName(name, existingNames(directory)), mimeType);
    file.write(text);
  } catch {
    throw new Error('save_failed');
  }
  return 'saved';
}
