/**
 * USDA FoodData Central als CSV-ZIP (Format `fdc_csv_zip` in sources.ts; dritte Quelle, Gründer-Entscheidung
 * 30.10.2026, docs/PLAN-PHASE-5.md Nachtrag 30.10.2026).
 *
 * FoodData Central liefert keine breite Tabelle, sondern mehrere CSV-Dateien im „langen“ Format:
 * - `food.csv` – je Lebensmittel `fdc_id` und `description` (englisch);
 * - `nutrient.csv` – je Nährstoff `id`, `name`, `unit_name` (z. B. „KCAL“, „G“, „MG“);
 * - `food_nutrient.csv` – je Lebensmittel und Nährstoff eine Zeile mit `fdc_id`, `nutrient_id`, `amount`.
 *
 * `readFdcCsvZipRecords` stellt daraus die gewohnte Tabelle her (Kopfzeile + eine Zeile je Lebensmittel), damit
 * Auszug, Spaltenprüfung und `sources-integrity` unverändert arbeiten. Das ist reine Umordnung: Jede Zelle ist der
 * Text `amount` genau so, wie er in `food_nutrient.csv` steht (keine Umrechnung, keine Rundung); fehlt ein Wert,
 * bleibt die Zelle leer. Spalten: `fdc_id`, `description`, danach je Nährstoff „<id> <name> (<einheit>)“ in
 * aufsteigender Nährstoff-ID; Zeilen in der Reihenfolge von `food.csv`. Deterministisch – `sources-integrity`
 * rechnet dieselbe Tabelle aus der neu geladenen Datei nach.
 */
import { parseCsv } from './csv';
import { readZipEntries, readZipEntry, type ZipEntry } from './xlsx';

/** Die drei Dateien, die im ZIP-Archiv genau einmal vorkommen müssen. */
export const FDC_CSV_FILES = ['food.csv', 'nutrient.csv', 'food_nutrient.csv'] as const;

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Findet je Datei genau einen Eintrag (Ordner im Archiv egal); sonst Abbruch mit Liste. */
export function fdcEntries(entries: ReadonlyMap<string, ZipEntry>): Record<string, ZipEntry> {
  const found: Record<string, ZipEntry> = {};
  const problems: string[] = [];
  for (const file of FDC_CSV_FILES) {
    const hits = [...entries.values()].filter(
      (e) => !e.name.startsWith('__MACOSX/') && basename(e.name) === file,
    );
    const hit = hits[0];
    if (hits.length !== 1 || hit === undefined) {
      problems.push(`${file}: ${hits.length === 0 ? 'fehlt' : `${hits.length}-mal vorhanden`}`);
    } else {
      found[file] = hit;
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `FoodData-Central-ZIP: ${problems.join('; ')} (Einträge: ${[...entries.keys()].slice(0, 40).join(', ')}).`,
    );
  }
  return found;
}

/** Liest eine CSV-Datei aus dem Archiv und liefert Kopfzeile + Spaltenindex je benötigtem Namen. */
function readTable(
  buffer: Buffer,
  entry: ZipEntry,
  needed: readonly string[],
): { rows: string[][]; col: Record<string, number> } {
  const [header, ...rows] = parseCsv(
    readZipEntry(buffer, entry)
      .toString('utf8')
      .replace(/^\uFEFF/, ''),
  );
  if (header === undefined) {
    throw new Error(`FoodData-Central-ZIP: ${basename(entry.name)} ist leer.`);
  }
  const col: Record<string, number> = {};
  const missing: string[] = [];
  for (const name of needed) {
    const index = header.findIndex((h) => h.trim() === name);
    if (index < 0) missing.push(name);
    else col[name] = index;
  }
  if (missing.length > 0) {
    throw new Error(
      `FoodData-Central-ZIP: ${basename(entry.name)} ohne Spalte ${missing.map((m) => `„${m}“`).join(', ')} (Kopfzeile: ${header.join(' | ')}).`,
    );
  }
  return { rows, col };
}

const cell = (row: readonly string[], index: number | undefined): string =>
  (index === undefined ? '' : (row[index] ?? '')).trim();

/** Kopfzeilen-Text einer Nährstoff-Spalte: „1008 Energy (kcal)“ (Einheit klein, für die Einheitenprüfung). */
export function fdcNutrientHeader(id: string, name: string, unit: string): string {
  return `${id} ${name} (${unit.toLowerCase()})`;
}

/** Tabelle (Kopfzeile + Zeilen) aus dem FoodData-Central-CSV-ZIP. */
export function readFdcCsvZipRecords(buffer: Buffer): string[][] {
  const files = fdcEntries(readZipEntries(buffer));
  const food = readTable(buffer, files['food.csv'] as ZipEntry, ['fdc_id', 'description']);
  const nutrient = readTable(buffer, files['nutrient.csv'] as ZipEntry, [
    'id',
    'name',
    'unit_name',
  ]);
  const values = readTable(buffer, files['food_nutrient.csv'] as ZipEntry, [
    'fdc_id',
    'nutrient_id',
    'amount',
  ]);

  const nutrientNames = new Map<string, string>();
  for (const row of nutrient.rows) {
    const id = cell(row, nutrient.col.id);
    if (id !== '') {
      nutrientNames.set(
        id,
        fdcNutrientHeader(id, cell(row, nutrient.col.name), cell(row, nutrient.col.unit_name)),
      );
    }
  }

  const byFood = new Map<string, Map<string, string>>();
  const usedNutrients = new Set<string>();
  for (const row of values.rows) {
    const fdcId = cell(row, values.col.fdc_id);
    const nutrientId = cell(row, values.col.nutrient_id);
    if (fdcId === '' || nutrientId === '') continue;
    let perFood = byFood.get(fdcId);
    if (perFood === undefined) {
      perFood = new Map();
      byFood.set(fdcId, perFood);
    }
    if (perFood.has(nutrientId)) {
      throw new Error(
        `FoodData-Central-ZIP: Nährstoff ${nutrientId} für Lebensmittel ${fdcId} mehrfach in food_nutrient.csv – nicht eindeutig.`,
      );
    }
    perFood.set(nutrientId, cell(row, values.col.amount));
    usedNutrients.add(nutrientId);
  }

  const columns = [...usedNutrients].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const unknown = columns.filter((id) => !nutrientNames.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `FoodData-Central-ZIP: Nährstoff-ID ${unknown.slice(0, 10).join(', ')} fehlt in nutrient.csv.`,
    );
  }
  const header = ['fdc_id', 'description', ...columns.map((id) => nutrientNames.get(id) as string)];
  const records: string[][] = [header];
  for (const row of food.rows) {
    const fdcId = cell(row, food.col.fdc_id);
    if (fdcId === '') continue;
    const perFood = byFood.get(fdcId);
    records.push([
      fdcId,
      cell(row, food.col.description),
      ...columns.map((id) => perFood?.get(id) ?? ''),
    ]);
  }
  return records;
}
