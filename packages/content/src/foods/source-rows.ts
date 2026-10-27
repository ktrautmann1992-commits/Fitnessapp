/**
 * Quellauszug → Nährwerte je 100 g (`SourceNutrientRow` aus packages/core, Regel R17).
 *
 * Einzige Stelle, an der Zellen-Texte der Quelle in Zahlen übersetzt werden – genutzt von `import-source.ts`
 * (schreibt die Lebensmittel) UND von `content:validate` (R17 vergleicht die Lebensmittel mit dem Auszug).
 * Umrechnung nur nach `SourceNutrientColumn.convert` (z. B. Natrium mg → Salz g × 2,5 / 1000).
 */
import {
  nutrientsPer100gSchema,
  OPTIONAL_NUTRIENT_KEYS,
  type SourceNutrientRow,
  sourceNutrientRowSchema,
} from '@fitnessapp/core';

import type {
  SourceDefinition,
  SourceEnergyExtraKey,
  SourceNutrientColumn,
  SourceNutrientKey,
} from './sources';

export const NUTRIENT_KEYS: readonly SourceNutrientKey[] = [
  'kcal',
  'protein_g',
  'carbs_g',
  'sugar_g',
  'fat_g',
  'sat_fat_g',
  'fiber_g',
  'salt_g',
];

/** Ergänzende Werte: ohne Zahlenwert in der Quelle → `null` (nie geschätzt), Zeile wird trotzdem übernommen. */
const OPTIONAL_KEYS: ReadonlySet<SourceNutrientKey> = new Set(OPTIONAL_NUTRIENT_KEYS);

/** Zusätzliche Spalten nur für R4, feste Reihenfolge. */
export const ENERGY_EXTRA_SOURCE_KEYS: readonly SourceEnergyExtraKey[] = [
  'organic_acids_g',
  'alcohol_g',
  'polyols_g',
];

export interface ResolvedColumn {
  readonly index: number;
  readonly column: SourceNutrientColumn;
  readonly header: string;
}

function headerCode(header: string): string {
  return header.trim().split(/[\s([]/, 1)[0] ?? '';
}

/**
 * Nennt die Überschrift die Einheit? Steht dort „<Einheit>/100 g“ (z. B. „[mg/100g]“), zählt genau diese
 * Einheit (sonst würde „g“ in „/100g“ jede Spalte treffen); sonst die Einheit als eigenes Wort.
 */
export function headerHasUnit(header: string, unit: SourceNutrientColumn['unit']): boolean {
  const per100 = /(kcal|kj|mg|µg|ug|g)\s*\/\s*100\s*g/i.exec(header);
  if (per100?.[1] !== undefined) {
    return per100[1].toLowerCase() === unit;
  }
  return new RegExp(`(^|[^a-zA-Zµ])${unit}([^a-zA-Z]|$)`).test(header);
}

/** Sucht je Schlüssel die Wert-Spalte (Code am Anfang + Einheit); Probleme werden gesammelt. */
function resolveColumns<K extends string>(
  header: readonly string[],
  specs: readonly (readonly [K, readonly SourceNutrientColumn[]])[],
  problems: string[],
): Partial<Record<K, ResolvedColumn>> {
  const resolved: Partial<Record<K, ResolvedColumn>> = {};
  for (const [key, alternatives] of specs) {
    let hit: ResolvedColumn | undefined;
    for (const column of alternatives) {
      // Die Quelle kann je Nährstoff mehrere Spalten mit demselben Code haben (Wert, Datenherkunft, Referenz);
      // die Wert-Spalte ist die mit der Einheit.
      // Mit `header` zählt nur genau diese Überschrift (Quellen ohne Nährstoff-Code am Anfang, z. B. die Schweizer
      // Nährwertdatenbank: „Fettsäuren, gesättigt (g)“ neben „Fettsäuren, einfach ungesättigt (g)“).
      const sameCode = header
        .map((text, index) => ({ text, index }))
        .filter((cell) =>
          column.header === undefined
            ? headerCode(cell.text) === column.code
            : cell.text.trim() === column.header,
        );
      if (sameCode.length === 0) {
        continue;
      }
      const withUnit = sameCode.filter((cell) => headerHasUnit(cell.text, column.unit));
      if (withUnit.length > 1) {
        problems.push(
          `${key}: Spalte „${column.code}“ mit Einheit „${column.unit}“ kommt mehrfach vor.`,
        );
        break;
      }
      const match = withUnit[0];
      if (match === undefined) {
        problems.push(
          `${key}: Spalte „${sameCode[0]?.text ?? column.code}“ nennt nicht die erwartete Einheit „${column.unit}“.`,
        );
        break;
      }
      hit = { index: match.index, column, header: match.text };
      break;
    }
    if (hit === undefined) {
      if (!problems.some((p) => p.startsWith(`${key}:`))) {
        problems.push(
          `${key}: keine Spalte ${alternatives.map((c) => `„${c.code}“`).join(' oder ')} gefunden.`,
        );
      }
    } else {
      resolved[key] = hit;
    }
  }
  return resolved;
}

function throwColumnProblems(header: readonly string[], problems: readonly string[]): void {
  if (problems.length > 0) {
    const shown = header.slice(0, 60).map((h, i) => `${i}: ${h}`);
    throw new Error(
      [
        'Spalten der Quelle passen nicht zu sources.ts:',
        ...problems.map((p) => `- ${p}`),
        `Kopfzeile (erste ${shown.length} von ${header.length} Spalten): ${shown.join(' | ')}`,
      ].join('\n'),
    );
  }
}

/**
 * Findet je Nährwert die Spalte in der Kopfzeile (Code am Anfang + Einheit). Fehlt etwas, Abbruch mit der
 * Liste der Spaltenüberschriften – es wird NIE geraten.
 */
export function resolveNutrientColumns(
  header: readonly string[],
  def: Pick<SourceDefinition, 'nutrients'>,
): Record<SourceNutrientKey, ResolvedColumn> {
  const problems: string[] = [];
  const resolved = resolveColumns(
    header,
    NUTRIENT_KEYS.map((key) => [key, def.nutrients[key]] as const),
    problems,
  );
  throwColumnProblems(header, problems);
  return resolved as Record<SourceNutrientKey, ResolvedColumn>;
}

/**
 * Spalten der zusätzlichen R4-Werte (`energyExtras`). Nur eingetragene Schlüssel. Fehlt der Code in der Kopfzeile,
 * fehlt das Feld in den Lebensmitteln (R4 rechnet dann ohne diesen Anteil – sichere Richtung: eher ein Befund zu
 * viel). Ein vorhandener Code mit falscher Einheit oder doppelt bricht ab wie bei den Nährwerten (nie geraten).
 */
export function resolveEnergyExtraColumns(
  header: readonly string[],
  def: Pick<SourceDefinition, 'energyExtras'>,
): Partial<Record<SourceEnergyExtraKey, ResolvedColumn>> {
  const extras = def.energyExtras ?? {};
  const problems: string[] = [];
  const specs = ENERGY_EXTRA_SOURCE_KEYS.flatMap((key) => {
    const alternatives = extras[key];
    return alternatives === undefined ? [] : [[key, alternatives] as const];
  });
  const resolved = resolveColumns(header, specs, problems);
  throwColumnProblems(
    header,
    problems.filter((p) => !/: keine Spalte .* gefunden\.$/.test(p)),
  );
  return resolved;
}

/**
 * Zahl aus einem Zellen-Text: „12.5“, „12,5“, „1.2E-2“. Leer, „-“ oder Text (z. B. „Spuren“) → null (fehlt).
 */
export function parseSourceNumber(raw: string): number | null {
  const value = raw.trim();
  if (!/^-?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?$/.test(value)) {
    return null;
  }
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

/**
 * Schreibweisen für „gemessen, unter der Nachweis- bzw. Bestimmungsgrenze“ bzw. „Spuren“ (Gründer-Entscheidung
 * 13.10.2026, docs/PLAN-PHASE-5.md N2b): Diese Zellen gelten als **0 g** – für ALLE Nährwerte, auch Pflichtwerte
 * (übliche Praxis der Nährwertkennzeichnung, LMIV: Werte unter der Nachweisgrenze werden als 0 angegeben).
 * Nur genau diese Texte (nach Trimmen, Groß-/Kleinschreibung wie in der Quelle): BLS 4.0 schreibt „<LOD“, „<LOQ“,
 * „<LOD or <LOQ“ und „TR“ (trace, Spuren; am Auszug von Lauf 1 geprüft), „<NWG“ und „Spuren“ sind die deutschen
 * Schreibweisen für eine Zweitquelle. „-“, leer und jeder andere Text bleiben „unbekannt“ (nie geraten).
 * Die Rohzeile im Auszug bleibt unverändert; nur diese Übersetzung entscheidet (Import UND R17).
 */
export const BELOW_DETECTION_TEXTS: ReadonlySet<string> = new Set([
  '<LOD',
  '<LOQ',
  '<LOD or <LOQ',
  'TR',
  '<NWG',
  'Spuren',
]);

/** true = Zellen-Text bedeutet „unter Nachweis-/Bestimmungsgrenze“ bzw. „Spuren“ (→ 0 g). */
export function isBelowDetection(raw: string): boolean {
  return BELOW_DETECTION_TEXTS.has(raw.trim());
}

/**
 * Wert einer Nährwert-Zelle: Zahl wie `parseSourceNumber`; „unter Nachweisgrenze“ → 0; „-“, leer oder anderer
 * Text → null (unbekannt).
 */
export function sourceCellValue(raw: string): number | null {
  return isBelowDetection(raw) ? 0 : parseSourceNumber(raw);
}

/** Umrechnung in die Einheit des Katalogs; auf 6 Nachkommastellen, damit kein Gleitkomma-Rauschen entsteht. */
export function convertSourceValue(
  value: number,
  convert: SourceNutrientColumn['convert'],
): number {
  const converted = convert === 'sodium_mg_to_salt_g' ? (value * 2.5) / 1000 : value;
  return Math.round(converted * 1e6) / 1e6;
}

export interface SourceRowsResult {
  readonly rows: Map<string, SourceNutrientRow>;
  /** Zeilen, die nicht übernommen werden können (fehlender Pflichtwert, Schemafehler) – mit Grund. */
  readonly problems: { ref: string; message: string }[];
  /**
   * Übernommene Zeilen, bei denen ein ergänzender Wert (Zucker, gesättigte Fettsäuren, Ballaststoffe) keinen
   * Zahlenwert hat – steht als `null` im Lebensmittel, nie geschätzt (Import-Lauf 1, PR #47).
   */
  readonly gaps: { ref: string; message: string }[];
  /**
   * Übernommene Zeilen mit Zellen „unter Nachweisgrenze“ (z. B. „<LOD“), die als 0 g gelesen wurden
   * (Gründer-Entscheidung 13.10.2026) – im Import-Bericht sichtbar, der Original-Text steht im Auszug.
   */
  readonly belowDetection: { ref: string; message: string }[];
}

/** Liest die Datensätze eines Quellauszugs (erste = Kopfzeile) in Nährwert-Zeilen. */
export function sourceNutrientRows(
  records: readonly (readonly string[])[],
  def: Pick<
    SourceDefinition,
    'db' | 'version' | 'keyColumn' | 'nameColumn' | 'nutrients' | 'energyExtras'
  >,
): SourceRowsResult {
  const [header, ...dataRows] = records;
  if (header === undefined) {
    throw new Error('Quellauszug ohne Kopfzeile.');
  }
  const columns = resolveNutrientColumns(header, def);
  const extraColumns = resolveEnergyExtraColumns(header, def);
  const rows = new Map<string, SourceNutrientRow>();
  const problems: { ref: string; message: string }[] = [];
  const gaps: { ref: string; message: string }[] = [];
  const belowDetection: { ref: string; message: string }[] = [];
  for (const record of dataRows) {
    const ref = (record[def.keyColumn] ?? '').trim();
    const name = (record[def.nameColumn] ?? '').trim();
    const nutrients: Partial<Record<SourceNutrientKey | SourceEnergyExtraKey, number | null>> = {};
    const missing: string[] = [];
    const withoutValue: string[] = [];
    const zeroed: string[] = [];
    for (const key of NUTRIENT_KEYS) {
      const { index, column, header: title } = columns[key];
      const raw = record[index] ?? '';
      const value = sourceCellValue(raw);
      if (value !== null && isBelowDetection(raw)) {
        zeroed.push(`${key} („${raw.trim()}“)`);
      }
      if (value === null) {
        const text = `${key} („${title}“: „${raw}“)`;
        if (OPTIONAL_KEYS.has(key)) {
          // Ergänzender Wert ohne Zahl („-“, leer): `null` = unbekannt, nie 0 oder eine Schätzung.
          nutrients[key] = null;
          withoutValue.push(text);
        } else {
          missing.push(text);
        }
      } else {
        nutrients[key] = convertSourceValue(value, column.convert);
      }
    }
    if (missing.length > 0) {
      problems.push({ ref, message: `Wert fehlt oder ist keine Zahl: ${missing.join(', ')}` });
      continue;
    }
    for (const key of ENERGY_EXTRA_SOURCE_KEYS) {
      const resolved = extraColumns[key];
      if (resolved === undefined) {
        continue;
      }
      const raw = record[resolved.index] ?? '';
      const value = sourceCellValue(raw);
      if (value !== null && isBelowDetection(raw)) {
        zeroed.push(`${key} („${raw.trim()}“)`);
      }
      nutrients[key] = value === null ? null : convertSourceValue(value, resolved.column.convert);
    }
    const nutrientCheck = nutrientsPer100gSchema.safeParse(nutrients);
    if (!nutrientCheck.success) {
      problems.push({
        ref,
        message: `Nährwerte passen nicht ins Schema: ${nutrientCheck.error.issues.map((i) => i.message).join(' ')}`,
      });
      continue;
    }
    const parsed = sourceNutrientRowSchema.safeParse({
      db: def.db,
      version: def.version,
      ref,
      name,
      nutrients_per_100g: nutrientCheck.data,
    });
    if (!parsed.success) {
      problems.push({
        ref,
        message: `Zeile passt nicht ins Schema: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ')}`,
      });
      continue;
    }
    if (rows.has(ref)) {
      problems.push({ ref, message: 'Quell-ID doppelt im Auszug.' });
      continue;
    }
    rows.set(ref, parsed.data);
    if (withoutValue.length > 0) {
      gaps.push({
        ref,
        message: `ohne Zahlenwert, als „kein Wert“ (null) übernommen: ${withoutValue.join(', ')}`,
      });
    }
    if (zeroed.length > 0) {
      belowDetection.push({
        ref,
        message: `unter Nachweisgrenze, als 0 übernommen: ${zeroed.join(', ')}`,
      });
    }
  }
  return { rows, problems, gaps, belowDetection };
}
