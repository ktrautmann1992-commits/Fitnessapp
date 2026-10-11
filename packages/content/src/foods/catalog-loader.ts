/**
 * Lebensmittel-Katalog für `content:validate` laden (docs/PLAN-PHASE-5.md 5.1.1 b/c, R17, R18): Lebensmittel
 * aus `content/foods/`, Quellauszüge aus `content/sources/<db>/<version>/extract.csv` (über dieselbe Umrechnung
 * wie der Import, `source-rows.ts`), Erwartungs- und Ausnahmeliste.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  allergenExceptionsSchema,
  allergenExpectationsSchema,
  type NutritionCatalogContext,
  type NutritionContentFile,
  type SourceNutrientRow,
  sourceRowKey,
} from '@fitnessapp/core';

import { readExtractRecords } from './extract-source';
import { sourceNutrientRows } from './source-rows';
import { findSource, SOURCES } from './sources';

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

  const sourceRows = new Map<string, SourceNutrientRow>();
  const sourcesDir = join(contentDir, 'sources');
  if (existsSync(sourcesDir)) {
    for (const db of readdirSync(sourcesDir).sort()) {
      for (const version of readdirSync(join(sourcesDir, db)).sort()) {
        const where = `sources/${db}/${version}`;
        const def = findSource(SOURCES, db, version);
        if (def === undefined) {
          problems.push(`${where}: Quelle nicht in der Allowlist (sources.ts).`);
          continue;
        }
        const extractPath = join(sourcesDir, db, version, 'extract.csv');
        if (!existsSync(extractPath)) {
          problems.push(`${where}: extract.csv fehlt.`);
          continue;
        }
        try {
          const { rows } = sourceNutrientRows(
            readExtractRecords(readFileSync(extractPath, 'utf8')),
            def,
          );
          for (const row of rows.values()) {
            sourceRows.set(sourceRowKey(row), row);
          }
        } catch (error) {
          problems.push(`${where}: Quellauszug nicht lesbar – ${(error as Error).message}`);
        }
      }
    }
  }

  const catalog: { -readonly [K in keyof NutritionCatalogContext]: NutritionCatalogContext[K] } = {
    sourceRows,
  };
  const expectationsPath = join(foodsDir, EXPECTATIONS_FILE);
  if (existsSync(expectationsPath)) {
    const { data, error } = readJsonFile(expectationsPath);
    const parsed = allergenExpectationsSchema.safeParse(data);
    if (error !== undefined || !parsed.success) {
      problems.push(`${FOODS_FOLDER}/${EXPECTATIONS_FILE}: ungültig.`);
    } else {
      catalog.expectations = parsed.data;
    }
  }
  const exceptionsPath = join(contentDir, MAPPING_FOLDER, EXCEPTIONS_FILE);
  if (existsSync(exceptionsPath)) {
    const { data, error } = readJsonFile(exceptionsPath);
    const parsed = allergenExceptionsSchema.safeParse(data);
    if (error !== undefined || !parsed.success) {
      problems.push(`${MAPPING_FOLDER}/${EXCEPTIONS_FILE}: ungültig.`);
    } else {
      catalog.exceptions = parsed.data;
    }
  } else {
    catalog.exceptions = [];
  }
  return { files, catalog, problems };
}
