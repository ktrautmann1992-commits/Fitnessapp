/**
 * Lebensmittel-Katalog für `content:validate` laden (docs/PLAN-PHASE-5.md 5.1.1 b/c, R17, R18): Lebensmittel
 * aus `content/foods/`, Quellauszüge aus `content/sources/<db>/<version>/extract.csv` (über dieselbe Umrechnung
 * wie der Import, `source-rows.ts`), Erwartungs- und Ausnahmeliste. Das Übersetzen der Texte macht
 * `catalog-texts.ts` (auch von der App genutzt, N2c).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NutritionCatalogContext, NutritionContentFile } from '@fitnessapp/core';

import { buildNutritionCatalog, type CatalogExtractText } from './catalog-texts';

export const FOODS_FOLDER = 'foods';
export const EXPECTATIONS_FILE = 'allergen-expectations.json';
/**
 * Ausnahmeliste (R18) liegt in `content/food-mapping/`, NICHT in `content/foods/`: Sie pflegen Menschen per Pull
 * Request, unter `content/foods/**` sind aber nur verifizierte Bot-Commits erlaubt (Wächter N2b, S4).
 */
export const EXCEPTIONS_FILE = 'allergen-exceptions.json';
export const MAPPING_FOLDER = 'food-mapping';

export interface LoadedNutritionCatalog {
  readonly files: NutritionContentFile[];
  /** undefined = kein Lebensmittel-Ordner (Katalog noch nicht importiert). */
  readonly catalog: NutritionCatalogContext | undefined;
  /** Datei- und Lesefehler (blockieren wie fremde Dateien). */
  readonly problems: string[];
}

function readJsonFile(path: string): { data?: unknown; error?: string } {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Liest `contentDir/foods` und `contentDir/sources`. Ohne `foods`-Ordner: leer, Katalog undefined. */
export function loadNutritionCatalog(contentDir: string): LoadedNutritionCatalog {
  const foodsDir = join(contentDir, FOODS_FOLDER);
  const problems: string[] = [];
  if (!existsSync(foodsDir)) {
    return { files: [], catalog: undefined, problems };
  }
  const files: NutritionContentFile[] = [];
  for (const fileName of readdirSync(foodsDir).sort()) {
    if (fileName.startsWith('.') || fileName === EXPECTATIONS_FILE) {
      continue;
    }
    if (fileName === EXCEPTIONS_FILE) {
      problems.push(
        `${FOODS_FOLDER}/${EXCEPTIONS_FILE}: gehört nach ${MAPPING_FOLDER}/ (von Menschen gepflegt).`,
      );
      continue;
    }
    if (!fileName.endsWith('.json')) {
      problems.push(`${FOODS_FOLDER}/${fileName}: keine JSON-Datei.`);
      continue;
    }
    const { data, error } = readJsonFile(join(foodsDir, fileName));
    files.push(
      error === undefined
        ? { kind: 'food', fileName, data }
        : { kind: 'food', fileName, jsonError: error },
    );
  }

  const sourcesDir = join(contentDir, 'sources');
  const extracts: CatalogExtractText[] = [];
  if (existsSync(sourcesDir)) {
    for (const db of readdirSync(sourcesDir).sort()) {
      for (const version of readdirSync(join(sourcesDir, db)).sort()) {
        const extractPath = join(sourcesDir, db, version, 'extract.csv');
        extracts.push({
          db,
          version,
          csv: existsSync(extractPath) ? readFileSync(extractPath, 'utf8') : null,
        });
      }
    }
  }
  const expectationsPath = join(foodsDir, EXPECTATIONS_FILE);
  const exceptionsPath = join(contentDir, MAPPING_FOLDER, EXCEPTIONS_FILE);
  const built = buildNutritionCatalog({
    extracts,
    expectations: existsSync(expectationsPath) ? readFileSync(expectationsPath, 'utf8') : undefined,
    exceptions: existsSync(exceptionsPath) ? readFileSync(exceptionsPath, 'utf8') : undefined,
  });
  problems.push(...built.problems);
  const catalog = built.catalog;
  return { files, catalog, problems };
}
