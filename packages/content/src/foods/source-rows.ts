/**
 * Quellauszug → Nährwerte je 100 g (`SourceNutrientRow` aus packages/core, Regel R17).
 *
 * Einzige Stelle, an der Zellen-Texte der Quelle in Zahlen übersetzt werden – genutzt von `import-source.ts`
 * (schreibt die Lebensmittel) UND von `content:validate` (R17 vergleicht die Lebensmittel mit dem Auszug).
 * Umrechnung nur nach `SourceNutrientColumn.convert` (z. B. Natrium mg → Salz g × 2,5 / 1000).
 */
import {
  nutrientsPer100gSchema,
  type SourceNutrientRow,
  sourceNutrientRowSchema,
} from '@fitnessapp/core';

import type { SourceDefinition, SourceNutrientColumn, SourceNutrientKey } from './sources';

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

/**
 * Findet je Nährwert die Spalte in der Kopfzeile (Code am Anfang + Einheit). Fehlt etwas, Abbruch mit der
 * Liste der Spaltenüberschriften – es wird NIE geraten.
 */
export function resolveNutrientColumns(
  header: readonly string[],
  def: Pick<SourceDefinition, 'nutrients'>,
): Record<SourceNutrientKey, ResolvedColumn> {
  const resolved: Partial<Record<SourceNutrientKey, ResolvedColumn>> = {};
  const problems: string[] = [];
  for (const key of NUTRIENT_KEYS) {
    const alternatives = def.nutrients[key];
    let hit: ResolvedColumn | undefined;
    for (const column of alternatives) {
      // Die Quelle kann je Nährstoff mehrere Spalten mit demselben Code haben (Wert, Datenherkunft, Referenz);
      // die Wert-Spalte ist die mit der Einheit.
      const sameCode = header
        .map((text, index) => ({ text, index }))
        .filter((cell) => headerCode(cell.text) === column.code);
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
  return resolved as Record<SourceNutrientKey, ResolvedColumn>;
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
  /** Zeilen, die nicht übernommen werden können (fehlender Wert, Schemafehler) – mit Grund. */
  readonly problems: { ref: string; message: string }[];
}

/** Liest die Datensätze eines Quellauszugs (erste = Kopfzeile) in Nährwert-Zeilen. */
export function sourceNutrientRows(
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'db' | 'version' | 'keyColumn' | 'nameColumn' | 'nutrients'>,
): SourceRowsResult {
  const [header, ...dataRows] = records;
  if (header === undefined) {
    throw new Error('Quellauszug ohne Kopfzeile.');
  }
  const columns = resolveNutrientColumns(header, def);
  const rows = new Map<string, SourceNutrientRow>();
  const problems: { ref: string; message: string }[] = [];
  for (const record of dataRows) {
    const ref = (record[def.keyColumn] ?? '').trim();
    const name = (record[def.nameColumn] ?? '').trim();
    const nutrients: Partial<Record<SourceNutrientKey, number>> = {};
    const missing: string[] = [];
    for (const key of NUTRIENT_KEYS) {
      const { index, column, header: title } = columns[key];
      const value = parseSourceNumber(record[index] ?? '');
      if (value === null) {
        missing.push(`${key} („${title}“: „${record[index] ?? ''}“)`);
      } else {
        nutrients[key] = convertSourceValue(value, column.convert);
      }
    }
    if (missing.length > 0) {
      problems.push({ ref, message: `Wert fehlt oder ist keine Zahl: ${missing.join(', ')}` });
      continue;
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
  }
  return { rows, problems };
}
