import { z } from 'zod';

import { isoDateSchema } from '../age';
import { EXERCISE_MEDIA_ORIGINS, exerciseMediaLicenseSchema } from './exercise-media';
import { RECIPE_MEDIA_FILE_SUFFIX, RECIPE_MEDIA_KINDS } from './recipe-media';
import { contentIdSchema } from './schemas';

/**
 * Workout-Bilder (Gründer-Auftrag 14.11.2026, docs/PLAN-BARBELL-BURN.md – zuerst „Barbell Burn 60/30“). Gleiches Muster
 * wie die Rezeptfotos (`recipe-media.ts`): je Workout höchstens eine Zuordnungsdatei
 * `content/workout-media/<workout-id>.json`, die Bilddateien liegen unter `apps/mobile/assets/workout-media/` und werden
 * mit der App ausgeliefert (Metro-Asset, Web-Export und APK – keine externen Aufrufe zur Laufzeit). Ohne Datei zeigt die
 * App das bisherige Workout-Symbol – Workouts ohne Bild funktionieren unverändert.
 *
 * Zwei Größen je Workout: `thumbnail` (quadratisch, Kachel in der Workout-Liste) und `banner` (21:9, Kopf der
 * Workout-Ansicht). Pflicht für jedes Bild: Lizenz und Quelle; KI-Bilder tragen zusätzlich den sichtbaren Hinweis
 * `ai_notice_de`. Die Bilder sind Stimmungsbilder (keine Technik-Anleitung) – die Ausführung zeigen die Übungsbilder.
 */

/** Ordner unter `content/` mit den Zuordnungsdateien. */
export const WORKOUT_MEDIA_FOLDER = 'workout-media';
/** Ordner der Bilddateien relativ zur Repository-Wurzel. */
export const WORKOUT_MEDIA_ASSET_DIR = 'apps/mobile/assets/workout-media';

/** Bildarten wie bei den Rezeptfotos. */
export const WORKOUT_MEDIA_KINDS = RECIPE_MEDIA_KINDS;
export type WorkoutMediaKind = (typeof WORKOUT_MEDIA_KINDS)[number];

/**
 * Zielgrößen in Pixeln (WebP). Thumbnail 320 × 320: Kachel in der Liste (bis 64 pt) × ~3 mit Reserve für größere
 * Kacheln; Banner wie bei den Rezepten 1080 × 463 (21:9, volle Handy-Breite).
 */
export const WORKOUT_MEDIA_SIZES: Readonly<
  Record<WorkoutMediaKind, { readonly width: number; readonly height: number }>
> = {
  thumbnail: { width: 320, height: 320 },
  banner: { width: 1080, height: 463 },
};

/** Erwarteter Dateiname eines Bildes: `<workout-id>-thumb.webp`, `<workout-id>-banner.webp`. */
export function workoutMediaFileName(workoutId: string, kind: WorkoutMediaKind): string {
  return `${workoutId}${RECIPE_MEDIA_FILE_SUFFIX[kind]}`;
}

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

export const workoutMediaImageSchema = z.strictObject({
  kind: z.enum(WORKOUT_MEDIA_KINDS),
  /** Dateiname unter `apps/mobile/assets/workout-media/`. */
  file: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/,
      'Dateiname: Kleinbuchstaben, Ziffern, Bindestriche und Endung .webp.',
    ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type WorkoutMediaImage = z.infer<typeof workoutMediaImageSchema>;

export const workoutMediaSchema = z
  .strictObject({
    workout_id: contentIdSchema,
    /** Bildbeschreibung für Screenreader (was zu sehen ist). */
    alt_de: text(10, 300),
    origin: z.enum(EXERCISE_MEDIA_ORIGINS),
    /** Sichtbarer Hinweis auf dem Banner; Pflicht bei KI-Bildern (z. B. „KI-Bild, Higgsfield“). */
    ai_notice_de: text(3, 80).nullable(),
    license: exerciseMediaLicenseSchema,
    source: z.strictObject({
      /** Urheber bzw. Werkzeug. */
      creator: text(2, 160),
      /** Herkunft der Quelldatei, falls vorhanden. */
      file: text(3, 200).optional(),
      obtained_on: isoDateSchema,
    }),
    /** Wer das Bild angesehen und dem Workout zugeordnet bestätigt hat; null = noch niemand. */
    reviewed_by: text(2, 80).nullable(),
    images: z.array(workoutMediaImageSchema).length(WORKOUT_MEDIA_KINDS.length),
  })
  .superRefine((media, ctx) => {
    if (media.origin === 'ai_generated' && media.ai_notice_de === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['ai_notice_de'],
        message: 'KI-generiertes Bild ohne sichtbaren Hinweis – ai_notice_de ist Pflicht.',
      });
    }
    const kinds = media.images.map((image) => image.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Jede Bildart (thumbnail, banner) genau einmal je Workout.',
      });
    }
    media.images.forEach((image, index) => {
      const expected = workoutMediaFileName(media.workout_id, image.kind);
      if (image.file !== expected) {
        ctx.addIssue({
          code: 'custom',
          path: ['images', index, 'file'],
          message: `Dateiname muss „${expected}“ sein.`,
        });
      }
      const size = WORKOUT_MEDIA_SIZES[image.kind];
      if (image.width !== size.width || image.height !== size.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['images', index],
          message: `Größe ${image.kind}: ${size.width} × ${size.height} px erwartet.`,
        });
      }
    });
  });
export type WorkoutMedia = z.infer<typeof workoutMediaSchema>;

/** Eine gelesene Zuordnungsdatei (wie die übrigen Inhaltsdateien). */
export interface WorkoutMediaFile {
  readonly fileName: string;
  readonly data?: unknown;
  readonly jsonError?: string;
}

export interface WorkoutMediaCheckContext {
  /** IDs aller Workouts im Inhaltsstand (`content/workouts`). */
  readonly workoutIds: ReadonlySet<string>;
  /** Gibt es die Bilddatei? Fehlt die Funktion, wird nicht geprüft. */
  readonly assetExists?: (file: string) => boolean;
}

/**
 * Prüft die Zuordnungsdateien. Jeder Befund ist blockierend (Datei-Fehler in `content:validate`): kaputtes JSON,
 * Schemafehler (u. a. fehlende Lizenz, KI-Bild ohne Hinweis, falsche Größe), Dateiname ≠ Workout-ID, unbekanntes
 * Workout, fehlende Bilddatei.
 */
export function checkWorkoutMediaFiles(
  files: readonly WorkoutMediaFile[],
  ctx: WorkoutMediaCheckContext,
): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const where = `${WORKOUT_MEDIA_FOLDER}/${file.fileName}`;
    if (file.jsonError !== undefined) {
      problems.push(`${where}: kein gültiges JSON (${file.jsonError}).`);
      continue;
    }
    const parsed = workoutMediaSchema.safeParse(file.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        problems.push(`${where}: ${path ? `${path}: ` : ''}${issue.message}`);
      }
      continue;
    }
    const media = parsed.data;
    if (`${media.workout_id}.json` !== file.fileName) {
      problems.push(
        `${where}: Dateiname muss der Workout-ID entsprechen („${media.workout_id}.json“).`,
      );
    }
    if (!ctx.workoutIds.has(media.workout_id)) {
      problems.push(`${where}: Workout „${media.workout_id}“ gibt es nicht.`);
    }
    for (const image of media.images) {
      if (ctx.assetExists && !ctx.assetExists(image.file)) {
        problems.push(`${where}: Bilddatei ${WORKOUT_MEDIA_ASSET_DIR}/${image.file} fehlt.`);
      }
    }
  }
  return problems;
}
