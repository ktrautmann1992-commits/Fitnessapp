/**
 * `extract-source.ts` – Original-Datei lesen, Quellauszug filtern, SOURCE.json (docs/PLAN-PHASE-5.md 5.1
 * Schritte 1–3, R2-B2, H1).
 *
 * Ablage je Quelle: `content/sources/<db>/<version>/`
 * - `extract.csv`   – nur Zeilen der Original-Datei (kanonisch, siehe csv.ts), erste Zeile = Kopfzeile
 * - `SOURCE.json`   – Adresse, Version, Abrufzeit, SHA-256 von Original und Auszug, Workflow-Lauf
 * - `ATTRIBUTION.md` – Namensnennung und Lizenz der Quelle
 * Alle drei schreibt NUR der Workflow `foods-import` (verifizierte Bot-Commits, geprüft von `sources-integrity`).
 */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import { parseCsv, serializeCsv, serializeRecord } from './csv';
import type { SourceDefinition } from './sources';
import { readXlsxRows } from './xlsx';

/** Wurzelordner der Quellauszüge (relativ zum Repository). */
export const SOURCES_DIR = 'content/sources';

export function sourceDir(def: Pick<SourceDefinition, 'db' | 'version'>): string {
  return `${SOURCES_DIR}/${def.db}/${def.version}`;
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Zeilen (Zellen-Texte) der Original-Datei, erste Zeile = Kopfzeile. */
export function readOriginalRecords(
  buffer: Buffer,
  def: Pick<SourceDefinition, 'format' | 'sheet' | 'csvDelimiter'>,
): string[][] {
  const records =
    def.format === 'xlsx'
      ? readXlsxRows(buffer, def.sheet)
      : parseCsv(buffer.toString('utf8'), def.csvDelimiter);
  if (records.length < 2) {
    throw new Error('Original-Datei: keine Datenzeilen gefunden.');
  }
  return records;
}

export interface ExtractResult {
  /** Inhalt von `extract.csv`. */
  readonly csv: string;
  /** Gefundene Quell-IDs in der Reihenfolge der Original-Datei. */
  readonly foundRefs: string[];
  /** Angefragte Quell-IDs, die es in der Original-Datei nicht gibt. */
  readonly missingRefs: string[];
}

/**
 * Filtert die benötigten Quell-IDs aus der Original-Datei – Zeile für Zeile, OHNE Werte zu verändern (keine
 * Umrechnung, keine Rundung, Spalten unverändert; Plan 5.1 Schritt 3). Reihenfolge wie in der Original-Datei.
 * Abbruch, wenn eine angefragte Quell-ID in der Original-Datei mehrfach vorkommt (nicht eindeutig).
 */
export function extractSourceRows(
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'keyColumn'>,
  refs: Iterable<string>,
): ExtractResult {
  const wanted = new Set(refs);
  const [header, ...rows] = records;
  if (header === undefined) {
    throw new Error('Original-Datei ohne Kopfzeile.');
  }
  const picked: (readonly string[])[] = [header];
  const found = new Set<string>();
  const foundRefs: string[] = [];
  for (const row of rows) {
    const key = row[def.keyColumn] ?? '';
    if (!wanted.has(key)) {
      continue;
    }
    if (found.has(key)) {
      throw new Error(`Quell-ID „${key}“ kommt in der Original-Datei mehrfach vor.`);
    }
    found.add(key);
    foundRefs.push(key);
    picked.push(row);
  }
  const missingRefs = [...wanted].filter((ref) => !found.has(ref)).sort();
  return { csv: serializeCsv(picked), foundRefs, missingRefs };
}

/** Datensätze von `extract.csv` (erste = Kopfzeile). */
export function readExtractRecords(csv: string): string[][] {
  return parseCsv(csv, ',');
}

/** Menge aller kanonischen Zeilen der Original-Datei (für die Herkunftsprüfung). */
export function canonicalRecordSet(records: readonly (readonly string[])[]): Set<string> {
  return new Set(records.map((record) => serializeRecord(record)));
}

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 als 64 Hex-Zeichen erwartet.');

/** `SOURCE.json` (Plan 5.1 Schritt 2). */
export const sourceManifestSchema = z.strictObject({
  db: z.enum(['bls', 'ch_naehrwertdatenbank', 'usda_fdc']),
  version: z.string().min(1).max(40),
  title: z.string().min(2).max(200),
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), 'Nur HTTPS-Adressen.'),
  original_filename: z.string().min(1).max(200),
  original_bytes: z.number().int().positive(),
  original_sha256: sha256Schema,
  extract_sha256: sha256Schema,
  extract_rows: z.number().int().min(0),
  retrieved_at: z.iso.datetime(),
  workflow_run_id: z.string().regex(/^\d+$/, 'Workflow-Lauf-ID (Zahl) erwartet.'),
  license: z.string().min(2).max(200),
  license_url: z.string().url(),
  attribution: z.string().min(10).max(1000),
});
export type SourceManifest = z.infer<typeof sourceManifestSchema>;

/** Text von `ATTRIBUTION.md` – Namensnennung der Quelle (CC BY 4.0: Urheber, Lizenz, Änderungen). */
export function attributionMarkdown(def: SourceDefinition): string {
  return [
    `# Quelle: ${def.title}`,
    '',
    `**Namensnennung:** ${def.attribution}`,
    '',
    `**Lizenz:** ${def.license} – ${def.licenseUrl}`,
    '',
    `**Original-Datei:** ${def.url}`,
    '',
    `**Änderungen:** ${def.changesNote}`,
    '',
    'Diese Datei, `SOURCE.json` und `extract.csv` erzeugt ausschließlich der Workflow `foods-import`',
    '(docs/PLAN-PHASE-5.md 5.1). Bitte nicht von Hand ändern – die Prüfung `sources-integrity` wird sonst rot.',
    '',
  ].join('\n');
}
