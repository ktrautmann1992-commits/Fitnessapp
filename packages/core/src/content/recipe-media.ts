import { z } from 'zod';

import { isoDateSchema } from '../age';
import { EXERCISE_MEDIA_ORIGINS, exerciseMediaLicenseSchema } from './exercise-media';
import { contentIdSchema } from './schemas';

/**
 * Rezeptfotos (Gründer-Wunsch 24.10.2026, docs/PLAN-PHASE-5.md Nachtrag „Rezeptbilder“). Gleiches Muster wie die
 * Übungsbilder (`exercise-media.ts`): je Rezept höchstens eine Zuordnungsdatei `content/recipe-media/<rezept-id>.json`,
 * die Bilddateien liegen unter `apps/mobile/assets/recipe-media/` und werden mit der App ausgeliefert (Metro-Asset,
 * Web-Export und APK – keine externen Aufrufe zur Laufzeit). Ohne Datei zeigt die App das bisherige Rezept-Symbol.
 *
 * Zwei Größen je Rezept: `thumbnail` (quadratisch, mittig zugeschnitten, für Listen) und `banner` (21:9, Kopf der
 * Rezeptansicht). Pflicht für jedes Bild: Lizenz und Quelle; KI-Bilder tragen zusätzlich den sichtbaren Hinweis
 * `ai_notice_de` (z. B. „KI-Bild, Higgsfield“). Die Fotos zeigen Essen, keine Haltung/Technik – eine fachliche
 * Prüfung ist deshalb (anders als bei KI-Übungsbildern) keine Pflicht; `reviewed_by` hält fest, wer sie angesehen hat.
 */

/** Ordner unter `content/` mit den Zuordnungsdateien. */
export const RECIPE_MEDIA_FOLDER = 'recipe-media';
/** Ordner der Bilddateien relativ zur Repository-Wurzel. */
export const RECIPE_MEDIA_ASSET_DIR = 'apps/mobile/assets/recipe-media';

export const RECIPE_MEDIA_KINDS = ['thumbnail', 'banner'] as const;
export type RecipeMediaKind = (typeof RECIPE_MEDIA_KINDS)[number];

/**
 * Zielgrößen in Pixeln (WebP). Thumbnail: 56-px-Kachel in der Liste × ~3 (hochauflösende Handy-Displays) ≈ 160.
 * Banner: volle Breite eines Handys (≈ 390 pt) × ~2,8 ≈ 1080, Seitenverhältnis 21:9 wie die Quellbilder; WebP-Qualität so
 * gewählt, dass ein Banner ≈ 50 KB hat (App-Größe!).
 */
export const RECIPE_MEDIA_SIZES: Readonly<
  Record<RecipeMediaKind, { readonly width: number; readonly height: number }>
> = {
  thumbnail: { width: 160, height: 160 },
  banner: { width: 1080, height: 463 },
};

/** Dateiendung je Bildart: `<rezept-id>-thumb.webp`, `<rezept-id>-banner.webp`. */
export const RECIPE_MEDIA_FILE_SUFFIX: Readonly<Record<RecipeMediaKind, string>> = {
  thumbnail: '-thumb.webp',
  banner: '-banner.webp',
};

/** Erwarteter Dateiname eines Bildes. */
export function recipeMediaFileName(recipeId: string, kind: RecipeMediaKind): string {
  return `${recipeId}${RECIPE_MEDIA_FILE_SUFFIX[kind]}`;
}

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

export const recipeMediaImageSchema = z.strictObject({
  kind: z.enum(RECIPE_MEDIA_KINDS),
  /** Dateiname unter `apps/mobile/assets/recipe-media/`. */
  file: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/,
      'Dateiname: Kleinbuchstaben, Ziffern, Bindestriche und Endung .webp.',
    ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type RecipeMediaImage = z.infer<typeof recipeMediaImageSchema>;

export const recipeMediaSchema = z
  .strictObject({
    recipe_id: contentIdSchema,
    /** Bildbeschreibung für Screenreader (was zu sehen ist). */
    alt_de: text(10, 300),
    origin: z.enum(EXERCISE_MEDIA_ORIGINS),
    /** Sichtbarer Hinweis unter dem Banner; Pflicht bei KI-Bildern (z. B. „KI-Bild, Higgsfield“). */
    ai_notice_de: text(3, 80).nullable(),
    license: exerciseMediaLicenseSchema,
    source: z.strictObject({
      /** Urheber bzw. Werkzeug. */
      creator: text(2, 160),
      /** Herkunft der Quelldatei (z. B. Rezeptbuch-Foto), falls vorhanden. */
      file: text(3, 200).optional(),
      obtained_on: isoDateSchema,
    }),
    /** Wer das Bild angesehen und dem Rezept zugeordnet bestätigt hat; null = noch niemand. */
    reviewed_by: text(2, 80).nullable(),
    images: z.array(recipeMediaImageSchema).length(RECIPE_MEDIA_KINDS.length),
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
        message: 'Jede Bildart (thumbnail, banner) genau einmal je Rezept.',
      });
    }
    media.images.forEach((image, index) => {
      const expected = recipeMediaFileName(media.recipe_id, image.kind);
      if (image.file !== expected) {
        ctx.addIssue({
          code: 'custom',
          path: ['images', index, 'file'],
          message: `Dateiname muss „${expected}“ sein.`,
        });
      }
      const size = RECIPE_MEDIA_SIZES[image.kind];
      if (image.width !== size.width || image.height !== size.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['images', index],
          message: `Größe ${image.kind}: ${size.width} × ${size.height} px erwartet.`,
        });
      }
    });
  });
export type RecipeMedia = z.infer<typeof recipeMediaSchema>;

/** Eine gelesene Zuordnungsdatei (wie die übrigen Inhaltsdateien). */
export interface RecipeMediaFile {
  readonly fileName: string;
  readonly data?: unknown;
  readonly jsonError?: string;
}

export interface RecipeMediaCheckContext {
  /**
   * IDs aller Rezepte, zu denen ein Bild gehören darf: Rezepte im Inhaltsstand und – bis der Import gelaufen ist –
   * die Rezepte des Gründer-Rezeptbuchs (`packages/content/seed/alpha5-rezepte.json`, gleiche IDs).
   */
  readonly recipeIds: ReadonlySet<string>;
  /** Gibt es die Bilddatei? Fehlt die Funktion, wird nicht geprüft. */
  readonly assetExists?: (file: string) => boolean;
}

/**
 * Prüft die Zuordnungsdateien. Jeder Befund ist blockierend (Datei-Fehler in `content:validate`): kaputtes JSON,
 * Schemafehler (u. a. fehlende Lizenz, KI-Bild ohne Hinweis, falsche Größe), Dateiname ≠ Rezept-ID, unbekanntes
 * Rezept, fehlende Bilddatei.
 */
export function checkRecipeMediaFiles(
  files: readonly RecipeMediaFile[],
  ctx: RecipeMediaCheckContext,
): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const where = `${RECIPE_MEDIA_FOLDER}/${file.fileName}`;
    if (file.jsonError !== undefined) {
      problems.push(`${where}: kein gültiges JSON (${file.jsonError}).`);
      continue;
    }
    const parsed = recipeMediaSchema.safeParse(file.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        problems.push(`${where}: ${path ? `${path}: ` : ''}${issue.message}`);
      }
      continue;
    }
    const media = parsed.data;
    if (`${media.recipe_id}.json` !== file.fileName) {
      problems.push(
        `${where}: Dateiname muss der Rezept-ID entsprechen („${media.recipe_id}.json“).`,
      );
    }
    if (!ctx.recipeIds.has(media.recipe_id)) {
      problems.push(`${where}: Rezept „${media.recipe_id}“ gibt es nicht.`);
    }
    for (const image of media.images) {
      if (ctx.assetExists && !ctx.assetExists(image.file)) {
        problems.push(`${where}: Bilddatei ${RECIPE_MEDIA_ASSET_DIR}/${image.file} fehlt.`);
      }
    }
  }
  return problems;
}

/** Bild einer Art aus einer (geprüften) Zuordnung; null = keins → die App zeigt das Rezept-Symbol. */
export function recipeMediaImage(
  media: RecipeMedia | null | undefined,
  kind: RecipeMediaKind,
): RecipeMediaImage | null {
  return media?.images.find((image) => image.kind === kind) ?? null;
}
