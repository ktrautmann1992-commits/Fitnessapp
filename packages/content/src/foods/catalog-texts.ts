/**
 * Begleitdaten des Lebensmittel-Katalogs aus TEXTEN bauen (docs/PLAN-PHASE-5.md 5.1.1 b/c, R17, R18, Etappe N2c):
 * Quellauszüge (`extract.csv` je Quelle), Erwartungsliste und Ausnahmeliste → `NutritionCatalogContext`.
 *
 * Rein, ohne Dateisystem und ohne Node-Module – genutzt von `content:validate` (über `catalog-loader.ts`) UND von
 * der App im Testmodus (Paket-Export `@fitnessapp/content/catalog`, Texte aus dem Inhalts-Bündel von
 * `scripts/bundle-content.mjs`). So gibt es genau eine Stelle, die Zellen-Texte in Nährwerte übersetzt
 * (`source-rows.ts`).
 */
import {
  allergenExceptionsSchema,
  allergenExpectationsSchema,
  type NutritionCatalogContext,
  type SourceNutrientRow,
  sourceRowKey,
} from '@fitnessapp/core';

import { parseCsv } from './csv';
import { sourceNutrientRows } from './source-rows';
import { findSource, type SourceDefinition, SOURCES } from './sources';

export interface CatalogExtractText {
  readonly db: string;
  readonly version: string;
  /** Inhalt von `content/sources/<db>/<version>/extract.csv`; null = Datei fehlt. */
  readonly csv: string | null;
}

export interface CatalogTexts {
  readonly extracts: readonly CatalogExtractText[];
  /** Inhalt von `content/foods/allergen-expectations.json`; undefined = Datei fehlt. */
  readonly expectations?: string | undefined;
  /** Inhalt von `content/food-mapping/allergen-exceptions.json`; undefined = Datei fehlt (= leere Liste). */
  readonly exceptions?: string | undefined;
}

export interface BuiltCatalog {
  readonly catalog: NutritionCatalogContext;
  /** Datei- und Lesefehler (blockieren in `content:validate` wie fremde Dateien). */
  readonly problems: string[];
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Baut die Begleitdaten. Quellen außerhalb der Allowlist oder ohne Auszug werden als Problem gemeldet. */
export function buildNutritionCatalog(
  texts: CatalogTexts,
  sources: readonly SourceDefinition[] = SOURCES,
): BuiltCatalog {
  const problems: string[] = [];
  const sourceRows = new Map<string, SourceNutrientRow>();
  for (const extract of texts.extracts) {
    const where = `sources/${extract.db}/${extract.version}`;
    const def = findSource(sources, extract.db, extract.version);
    if (def === undefined) {
      problems.push(`${where}: Quelle nicht in der Allowlist (sources.ts).`);
      continue;
    }
    if (extract.csv === null) {
      problems.push(`${where}: extract.csv fehlt.`);
      continue;
    }
    try {
      const { rows } = sourceNutrientRows(parseCsv(extract.csv, ','), def);
      for (const row of rows.values()) {
        sourceRows.set(sourceRowKey(row), row);
      }
    } catch (error) {
      problems.push(`${where}: Quellauszug nicht lesbar – ${(error as Error).message}`);
    }
  }

  const catalog: { -readonly [K in keyof NutritionCatalogContext]: NutritionCatalogContext[K] } = {
    sourceRows,
  };
  if (texts.expectations !== undefined) {
    const parsed = allergenExpectationsSchema.safeParse(parseJson(texts.expectations));
    if (parsed.success) {
      catalog.expectations = parsed.data;
    } else {
      problems.push('foods/allergen-expectations.json: ungültig.');
    }
  }
  if (texts.exceptions !== undefined) {
    const parsed = allergenExceptionsSchema.safeParse(parseJson(texts.exceptions));
    if (parsed.success) {
      catalog.exceptions = parsed.data;
    } else {
      problems.push('food-mapping/allergen-exceptions.json: ungültig.');
    }
  } else {
    catalog.exceptions = [];
  }
  return { catalog, problems };
}
