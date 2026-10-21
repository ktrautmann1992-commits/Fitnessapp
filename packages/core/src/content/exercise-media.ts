import { z } from 'zod';

import { isoDateSchema } from '../age';
import { contentIdSchema } from './schemas';

/**
 * Übungsbilder „Ausgangsposition“ (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md Nachtrag „Muskelkarte“; Gründer-Entscheidung B
 * vom 21.10.2026: eigene Illustrationen, erzeugt von packages/content/src/illustrations, docs/DESIGN.md).
 * Je Übung höchstens eine Zuordnungsdatei `content/exercise-media/<übungs-id>.json`; die Bilddatei selbst liegt unter
 * `apps/mobile/assets/exercise-media/`. Ohne Datei zeigt die App nichts (kein leerer Rahmen).
 *
 * Pflicht für JEDES Bild: Lizenz und Quelle. Ein Bild ohne Lizenzangabe ist ein blockierender Fehler in
 * `content:validate` – fremde Bilder ohne geklärte Rechte dürfen nie in die App.
 */

/** Ordner unter `content/` mit den Zuordnungsdateien. */
export const EXERCISE_MEDIA_FOLDER = 'exercise-media';
/** Ordner der Bilddateien relativ zur Repository-Wurzel. */
export const EXERCISE_MEDIA_ASSET_DIR = 'apps/mobile/assets/exercise-media';

/** Bildarten je Übung. Derzeit nur die Ausgangsposition. */
export const EXERCISE_MEDIA_KINDS = ['start_position'] as const;
export type ExerciseMediaKind = (typeof EXERCISE_MEDIA_KINDS)[number];

/** Herkunft eines Bildes. Gründer-Entscheidung 21.10.2026: B – eigene Illustrationen (`own_work`). */
export const EXERCISE_MEDIA_ORIGINS = [
  'licensed_library',
  'commissioned',
  'ai_generated',
  'own_work',
] as const;
export type ExerciseMediaOrigin = (typeof EXERCISE_MEDIA_ORIGINS)[number];

/**
 * Dateiname des Bildes: Kleinbuchstaben, Ziffern, Bindestriche; SVG (eigene Illustrationen, Generator in
 * packages/content/src/illustrations) oder Web-taugliche Rasterformate.
 */
export const EXERCISE_MEDIA_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|webp|png|jpg)$/;

const httpsUrl = z
  .string()
  .regex(
    /^https:\/\/[^\s]+$/,
    'Link muss mit https:// beginnen und darf keine Leerzeichen enthalten.',
  );

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

const MISSING_LICENSE = 'Lizenzangabe fehlt – Pflicht für jedes Bild (blockierender Fehler).';

export const exerciseMediaLicenseSchema = z.strictObject(
  {
    /** z. B. „Lizenzvertrag Anbieter X vom 01.11.2026, Nutzung in App und Web“ oder „CC BY 4.0“. */
    name: text(3, 160),
    /** Lizenztext oder Vertrag (Link), falls öffentlich. */
    url: httpsUrl.optional(),
    /** Pflicht-Namensnennung, falls die Lizenz eine verlangt (wird dann unter dem Bild angezeigt). */
    attribution_de: text(3, 200).nullable(),
  },
  {
    error: (issue) => (issue.input === undefined ? MISSING_LICENSE : undefined),
  },
);

export const exerciseMediaImageSchema = z
  .strictObject({
    kind: z.enum(EXERCISE_MEDIA_KINDS),
    /** Dateiname unter `apps/mobile/assets/exercise-media/`. */
    file: z
      .string()
      .regex(
        EXERCISE_MEDIA_FILE_PATTERN,
        'Dateiname: Kleinbuchstaben, Ziffern, Bindestriche und Endung .svg, .webp, .png oder .jpg.',
      ),
    /** Bildbeschreibung für Screenreader (was zu sehen ist). */
    alt_de: text(10, 300),
    origin: z.enum(EXERCISE_MEDIA_ORIGINS),
    license: exerciseMediaLicenseSchema,
    source: z.strictObject({
      /** Urheber bzw. Anbieter. */
      creator: text(2, 160),
      url: httpsUrl.optional(),
      obtained_on: isoDateSchema,
    }),
    /** Fachliche Prüfung der dargestellten Haltung (Pflicht bei KI-Bildern). */
    reviewed_by: text(2, 80).nullable(),
  })
  .superRefine((image, ctx) => {
    if (image.origin === 'ai_generated' && image.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewed_by'],
        message: 'KI-generiertes Bild ohne fachliche Prüfung – reviewed_by ist Pflicht.',
      });
    }
  });
export type ExerciseMediaImage = z.infer<typeof exerciseMediaImageSchema>;

export const exerciseMediaSchema = z
  .strictObject({
    exercise_id: contentIdSchema,
    images: z.array(exerciseMediaImageSchema).min(1).max(EXERCISE_MEDIA_KINDS.length),
  })
  .superRefine((media, ctx) => {
    const kinds = media.images.map((image) => image.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Jede Bildart höchstens einmal je Übung.',
      });
    }
  });
export type ExerciseMedia = z.infer<typeof exerciseMediaSchema>;

/** Eine gelesene Zuordnungsdatei (wie die übrigen Inhaltsdateien). */
export interface ExerciseMediaFile {
  readonly fileName: string;
  readonly data?: unknown;
  readonly jsonError?: string;
}

export interface ExerciseMediaCheckContext {
  /** IDs aller Übungen im Inhaltsstand. */
  readonly exerciseIds: ReadonlySet<string>;
  /** Gibt es die Bilddatei? Fehlt die Funktion, wird nicht geprüft. */
  readonly assetExists?: (file: string) => boolean;
}

/**
 * Prüft die Zuordnungsdateien. Jeder Befund ist blockierend (Datei-Fehler in `content:validate`): kaputtes JSON,
 * Schemafehler (u. a. fehlende Lizenz), Dateiname ≠ Übungs-ID, unbekannte Übung, fehlende Bilddatei.
 */
export function checkExerciseMediaFiles(
  files: readonly ExerciseMediaFile[],
  ctx: ExerciseMediaCheckContext,
): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const where = `${EXERCISE_MEDIA_FOLDER}/${file.fileName}`;
    if (file.jsonError !== undefined) {
      problems.push(`${where}: kein gültiges JSON (${file.jsonError}).`);
      continue;
    }
    const parsed = exerciseMediaSchema.safeParse(file.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        problems.push(`${where}: ${path ? `${path}: ` : ''}${issue.message}`);
      }
      continue;
    }
    const media = parsed.data;
    if (`${media.exercise_id}.json` !== file.fileName) {
      problems.push(
        `${where}: Dateiname muss der Übungs-ID entsprechen („${media.exercise_id}.json“).`,
      );
    }
    if (!ctx.exerciseIds.has(media.exercise_id)) {
      problems.push(`${where}: Übung „${media.exercise_id}“ gibt es nicht.`);
    }
    for (const image of media.images) {
      if (ctx.assetExists && !ctx.assetExists(image.file)) {
        problems.push(`${where}: Bilddatei ${EXERCISE_MEDIA_ASSET_DIR}/${image.file} fehlt.`);
      }
    }
  }
  return problems;
}

/** Bild einer Art aus einer (geprüften) Zuordnung; null = keins vorhanden → die App zeigt nichts an. */
export function exerciseMediaImage(
  media: ExerciseMedia | null | undefined,
  kind: ExerciseMediaKind,
): ExerciseMediaImage | null {
  return media?.images.find((image) => image.kind === kind) ?? null;
}
