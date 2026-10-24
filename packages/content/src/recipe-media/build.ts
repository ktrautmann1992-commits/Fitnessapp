import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RECIPE_MEDIA_ASSET_DIR,
  RECIPE_MEDIA_FOLDER,
  RECIPE_MEDIA_KINDS,
  RECIPE_MEDIA_SIZES,
  type RecipeMedia,
  recipeMediaFileName,
  recipeMediaSchema,
} from '@fitnessapp/core';
import * as prettier from 'prettier';

/**
 * Rezeptfotos für die App (Gründer-Wunsch 24.10.2026, docs/PLAN-PHASE-5.md Nachtrag „Rezeptbilder“).
 *
 * Quelle sind die Rezeptbuch-Fotos (Higgsfield, 1800 × 771 JPG) unter `content/rezeptbuch/fotos/<datei>.jpg` auf dem
 * Branch `rezeptbuch-baukasten`, Zuordnung über `content/rezeptbuch/foto-auftraege.json` (`rezept`, `kapitel`,
 * `datei`). Der Dateiname ist die Rezept-ID aus `packages/content/seed/alpha5-rezepte.json` – nur bei doppeltem
 * Rezepttitel steht das Kapitel davor (z. B. `vegan-schoko-proteinpudding` → Rezept `schoko-proteinpudding`).
 * Der alpha5-Import übernimmt die IDs unverändert (`id: rezept.id`), die Bilder hängen also nach dem Import
 * automatisch am Rezept.
 *
 * Übernommen werden nur ausgewählte Rezepte (App-Größe): die IDs aus `content/rezeptbuch-app-auswahl.json`, sonst
 * ausdrücklich genannte IDs. Erzeugt je Rezept zwei WebP-Bilder (`RECIPE_MEDIA_SIZES`) unter
 * `apps/mobile/assets/recipe-media/`, die Zuordnung `content/recipe-media/<id>.json` und das App-Modul
 * `apps/mobile/src/data/recipe-media.generated.ts` (require() je Bild – Metro bündelt sie für Web und APK).
 */

export const RECIPE_MEDIA_MODULE = 'apps/mobile/src/data/recipe-media.generated.ts';
/** Auswahl der Rezeptbuch-Rezepte für die App (Gründer-Entscheidung 24.10.2026: ~150 von 306). */
export const APP_SELECTION_FILE = 'content/rezeptbuch-app-auswahl.json';
export const PHOTO_DIR = 'content/rezeptbuch/fotos';
export const PHOTO_ORDERS_FILE = 'content/rezeptbuch/foto-auftraege.json';
/** Stand der Rezeptbuch-Fotos (README des Rezeptbuchs: „Alle 306 Rezepte haben ein Foto (Stand 23.10.2026)“). */
export const PHOTO_DATE = '2026-10-23';
export const AI_NOTICE = 'KI-Bild, Higgsfield';

/** WebP-Qualität je Bildart (Banner ≈ 50 KB, Vorschaubild ≈ 5 KB). */
export const WEBP_QUALITY = { thumbnail: 70, banner: 60 } as const;

export interface BookRecipe {
  readonly id: string;
  readonly name: string;
  readonly kategorie: string;
}

export interface PhotoOrder {
  readonly rezept: string;
  readonly kapitel: string;
  readonly datei: string;
}

/**
 * Foto-Datei (ohne .jpg) je Rezept-ID. Regel: Datei = Rezept-ID; gibt es sie nicht, der Auftrag mit gleichem
 * Rezepttitel UND gleichem Kapitel (doppelte Titel im Rezeptbuch). Jede Datei höchstens einem Rezept.
 * Unklare Fälle sind Fehler – nie raten.
 */
export function photoFileByRecipe(
  recipes: readonly BookRecipe[],
  orders: readonly PhotoOrder[],
  files: ReadonlySet<string>,
): { readonly byRecipe: ReadonlyMap<string, string>; readonly problems: readonly string[] } {
  const byRecipe = new Map<string, string>();
  const problems: string[] = [];
  const used = new Map<string, string>();
  for (const recipe of recipes) {
    let file: string | undefined;
    if (files.has(recipe.id)) {
      const order = orders.find((o) => o.datei === recipe.id);
      if (order && order.rezept !== recipe.name) {
        problems.push(
          `${recipe.id}: Foto-Auftrag nennt „${order.rezept}“, Rezept heißt „${recipe.name}“.`,
        );
        continue;
      }
      file = recipe.id;
    } else {
      const candidates = orders.filter(
        (o) => o.rezept === recipe.name && o.kapitel === recipe.kategorie && files.has(o.datei),
      );
      if (candidates.length !== 1) {
        problems.push(
          candidates.length === 0
            ? `${recipe.id}: kein Foto gefunden.`
            : `${recipe.id}: mehrere Fotos passen (${candidates.map((c) => c.datei).join(', ')}).`,
        );
        continue;
      }
      file = candidates[0]!.datei;
    }
    const previous = used.get(file);
    if (previous !== undefined) {
      problems.push(`${recipe.id}: Foto „${file}“ gehört schon zu ${previous}.`);
      continue;
    }
    used.set(file, recipe.id);
    byRecipe.set(recipe.id, file);
  }
  return { byRecipe, problems };
}

/** Rezept-IDs aus der Auswahl-Datei: Liste von IDs, oder Objekt mit einer solchen Liste (`ids`/`rezepte`). */
export function parseAppSelection(data: unknown): string[] {
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? ((data as Record<string, unknown>).ids ?? (data as Record<string, unknown>).rezepte)
      : undefined;
  if (!Array.isArray(list)) {
    throw new Error(`${APP_SELECTION_FILE}: erwartet eine Liste von Rezept-IDs.`);
  }
  return list.map((entry: unknown) => {
    const id =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry !== null
          ? (entry as { id?: unknown }).id
          : undefined;
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`${APP_SELECTION_FILE}: ungültiger Eintrag ${JSON.stringify(entry)}.`);
    }
    return id;
  });
}

/** Zuordnungsdatei eines Rezepts (deterministisch). */
export function recipeMediaFor(recipe: BookRecipe, photoFile: string): RecipeMedia {
  return recipeMediaSchema.parse({
    recipe_id: recipe.id,
    alt_de: `Foto: ${recipe.name}`,
    origin: 'ai_generated',
    ai_notice_de: AI_NOTICE,
    license: { name: 'KI-Bild, erzeugt von den Gründern mit Higgsfield', attribution_de: null },
    source: {
      creator: 'Higgsfield (Gründer)',
      file: `${PHOTO_DIR}/${photoFile}.jpg`,
      obtained_on: PHOTO_DATE,
    },
    reviewed_by: null,
    images: RECIPE_MEDIA_KINDS.map((kind) => ({
      kind,
      file: recipeMediaFileName(recipe.id, kind),
      ...RECIPE_MEDIA_SIZES[kind],
    })),
  });
}

/** Zuordnungen, die im Repository liegen (sortiert nach Rezept-ID; ungültige Dateien → Fehler). */
export function readRecipeMediaFolder(repoRoot: string): RecipeMedia[] {
  const dir = join(repoRoot, 'content', RECIPE_MEDIA_FOLDER);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => recipeMediaSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf8'))));
}

const assetRequire = (file: string) => `require('../../assets/recipe-media/${file}')`;

/** App-Modul mit allen Zuordnungen und require() je Bild (Prettier-formatiert, deterministisch). */
export async function recipeMediaModule(
  repoRoot: string,
  media: readonly RecipeMedia[],
): Promise<string> {
  const entries = [...media]
    .sort((a, b) => a.recipe_id.localeCompare(b.recipe_id))
    .map((m) => {
      const thumb = m.images.find((i) => i.kind === 'thumbnail')!;
      const banner = m.images.find((i) => i.kind === 'banner')!;
      return `  ${JSON.stringify(m.recipe_id)}: { alt_de: ${JSON.stringify(m.alt_de)}, ai_notice_de: ${JSON.stringify(
        m.ai_notice_de,
      )}, thumbnail: ${assetRequire(thumb.file)}, banner: ${assetRequire(banner.file)} },`;
    });
  const text = `/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Bilder nur über require() */
/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Rezeptfotos (Zuordnungen aus content/${RECIPE_MEDIA_FOLDER}/, Bilder unter ${RECIPE_MEDIA_ASSET_DIR}/).
 * Neu erzeugen: pnpm recipe-media (im Hauptordner), siehe packages/content/src/recipe-media/build.ts.
 */
import type { ImageSourcePropType } from 'react-native';

/** Nur, was die App anzeigt (Lizenz und Quelle stehen in content/${RECIPE_MEDIA_FOLDER}/<id>.json – Test prüft Gleichheit). */
export interface GeneratedRecipeMedia {
  readonly alt_de: string;
  readonly ai_notice_de: string | null;
  readonly thumbnail: ImageSourcePropType;
  readonly banner: ImageSourcePropType;
}

export const GENERATED_RECIPE_MEDIA: Readonly<Record<string, GeneratedRecipeMedia>> = {
${entries.join('\n')}
};
`;
  const filepath = join(repoRoot, RECIPE_MEDIA_MODULE);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(text, { ...options, filepath });
}
