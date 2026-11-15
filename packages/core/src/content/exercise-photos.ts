import { z } from 'zod';

import { contentIdSchema } from './schemas';

/**
 * Übungsfotos (docs/UEBUNGSFOTOS.md): fotorealistische KI-Bilder der Ausgangs- und Endposition je Übung. Sie ersetzen
 * die eigenen Illustrationen dort, wo ein Foto vorhanden ist; sonst bleibt die Illustration.
 *
 * Die Gründer erzeugen die Bilder extern und tragen ihre Adressen in `content/exercise-photos/manifest.json` ein. Der
 * Workflow `exercise-photos-import.yml` lädt sie herunter, rechnet sie auf 640×480 WebP um und erzeugt die
 * Zuordnung der App (scripts/exercise-photos.mjs).
 */

/** Manifest relativ zur Repository-Wurzel. */
export const EXERCISE_PHOTOS_MANIFEST = 'content/exercise-photos/manifest.json';
/** Bereits übernommene Adressen (vom Workflow gepflegt). */
export const EXERCISE_PHOTOS_IMPORTED = 'content/exercise-photos/imported.json';
/** Ordner der WebP-Dateien relativ zur Repository-Wurzel. */
export const EXERCISE_PHOTOS_ASSET_DIR = 'apps/mobile/assets/exercise-photos';

/** Zielgröße in der App (4:3, Mitte zugeschnitten), Qualität und Obergrenze je Datei. */
export const EXERCISE_PHOTO_FORMAT = {
  width: 640,
  height: 480,
  webpQuality: 72,
  maxBytes: 45 * 1024,
} as const;

const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: 'Adresse muss mit https:// beginnen.' })
  .max(2048, 'Adresse: höchstens 2048 Zeichen.');

/** Ein Eintrag: Adressen von Start- und Endbild plus die Auftrags-IDs des Generators (zur Nachverfolgung). */
export const exercisePhotoEntrySchema = z
  .object({
    start: httpsUrlSchema,
    end: httpsUrlSchema,
    job_start: z.guid('job_start: UUID erwartet.'),
    job_end: z.guid('job_end: UUID erwartet.'),
  })
  .strict();
export type ExercisePhotoEntry = z.infer<typeof exercisePhotoEntrySchema>;

/** Manifest: Übungs-ID → Eintrag. */
export const exercisePhotoManifestSchema = z.record(contentIdSchema, exercisePhotoEntrySchema);
export type ExercisePhotoManifest = z.infer<typeof exercisePhotoManifestSchema>;

/**
 * Prüft ein (rohes) Manifest gegen das Schema und die bekannten Übungs-IDs. Liefert deutsche Fehlermeldungen, leer =
 * in Ordnung.
 */
export function checkExercisePhotoManifest(
  data: unknown,
  exerciseIds: ReadonlySet<string>,
): string[] {
  const parsed = exercisePhotoManifestSchema.safeParse(data);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) =>
        `${EXERCISE_PHOTOS_MANIFEST}: ${issue.path.join('.') || '(Wurzel)'}: ${issue.message}`,
    );
  }
  const problems: string[] = [];
  for (const [id, entry] of Object.entries(parsed.data)) {
    if (!exerciseIds.has(id)) {
      problems.push(
        `${EXERCISE_PHOTOS_MANIFEST}: Übung „${id}“ gibt es nicht in content/exercises.`,
      );
    }
    if (entry.start === entry.end) {
      problems.push(
        `${EXERCISE_PHOTOS_MANIFEST}: ${id}: Start- und Endbild haben dieselbe Adresse.`,
      );
    }
  }
  return problems;
}
