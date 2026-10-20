/**
 * Herkunftsprüfung `sources-integrity` (docs/PLAN-PHASE-5.md 5.1.1 b, R2-B2, H1, Test W18).
 *
 * Je Quelle unter `content/sources/<db>/<version>/`:
 *  1. `SOURCE.json` gültig; Quelle steht in der Allowlist `sources.ts` VON `main` (nie aus dem Pull Request);
 *     `SOURCE.json.url` = Allowlist-Adresse.
 *  2. Original-Datei wird IMMER neu geladen – über den Allowlist-Eintrag aus `main` (feste Datei-Adresse bzw.
 *     feste Download-Seite + der eine Link daraus, gleicher Host) – und muss `original_sha256` haben (eine
 *     eingecheckte `original.*` ebenso). Weil der Link einer Download-Seite wechselt, sichert diese Prüfsumme die
 *     Echtheit. Wer Original UND Prüfsumme im selben PR ändert, fällt hier auf.
 *  3. SHA-256 von `extract.csv` = `extract_sha256`; Kopfzeile = Kopfzeile der Original-Datei; JEDE Zeile ist eine
 *     unveränderte Zeile der Original-Datei; Anzahl = `extract_rows`.
 *  4. Pull Request/Branch: Änderungen unter `content/sources/**` nur auf `foods-import/<run-id>`; unter
 *     `content/foods/**` zusätzlich auf `content-review/katalog-<run-id>` (Katalog geprüft, R2-K6) – dort nur Status,
 *     Prüfvermerk und `catalog_reviewed_*` (catalog-review-guard.ts); foods-import darf `catalog_reviewed_*` nur
 *     zurücksetzen. Jeder Commit, der `content/sources/**` oder `content/foods/**` berührt, ist von GitHub „verified“
 *     und von `github-actions[bot]` (gefälschter Bot-Autor per git config ist nicht verified → rot).
 * Jede Abweichung → rot.
 */
import { serializeCsv, serializeRecord } from './csv';
import {
  canonicalRecordSet,
  readExtractRecords,
  readOriginalRecords,
  sha256Hex,
  sourceManifestSchema,
  SOURCES_DIR,
} from './extract-source';
import {
  CATALOG_REVIEW_BRANCH,
  catalogReviewChangeErrors,
  importCatalogFieldErrors,
} from './catalog-review-guard';
import type { SourceDefinition } from './sources';

/** Pfade, deren Änderung die volle Prüfung (mit Neuladen) auslöst (Plan 5.1.1 b). */
export const INTEGRITY_TRIGGER_PATHS = [
  'content/sources/',
  'content/foods/',
  'content/food-mapping/',
  'packages/content/src/foods/',
] as const;

/** Geschützte Ordner: Commits hier nur verifiziert vom Bot. */
export const PROTECTED_CONTENT_PATHS = ['content/sources/', 'content/foods/'] as const;

/** Ordner, in denen symbolische Links verboten sind (Wächter N2b, GK2): Sie könnten auf Dateien außerhalb zeigen. */
export const NO_SYMLINK_PATHS = [
  'content/sources',
  'content/foods',
  'content/food-mapping',
] as const;

/** Branch-Muster für Änderungen unter content/sources (Plan 5.1 Schritt 4). */
export const FOODS_IMPORT_BRANCH = /^foods-import\/(\d+)$/;

const ALLOWED_SOURCE_FILES = new Set(['SOURCE.json', 'extract.csv', 'ATTRIBUTION.md']);

export interface IntegrityDeps {
  /** Allowlist aus `sources.ts` von `main`; null = auf main (noch) nicht vorhanden. */
  loadMainSources(): Promise<readonly SourceDefinition[] | null>;
  /**
   * Original-Datei zum Allowlist-Eintrag laden (wirft bei Fehlern): bei einer Download-Seite über dieselbe
   * Seiten-Logik wie foods-import (`fetchSourceOriginal`). Ergebnis = xlsx- bzw. csv-Datei (ZIP entpackt).
   */
  download(def: SourceDefinition): Promise<Buffer>;
  /** Ordner `content/sources/<db>/<version>` (relativ zum Repository). */
  listSourceDirs(): string[];
  /** Dateinamen in einem Quellordner. */
  listFiles(dir: string): string[];
  /** Datei relativ zum Repository; undefined = fehlt. */
  readFile(path: string): Buffer | undefined;
  /**
   * Geänderte Pfade gegenüber `main` (Pull Request/Branch). null = kein Vergleich (wöchentlicher Lauf, main) –
   * dann volle Prüfung ohne Commit-Prüfung.
   */
  changedPaths(): string[] | null;
  /** Commits des Branches (nicht auf main), die einen der Pfade berühren. */
  commitsTouching(paths: readonly string[]): string[];
  /** Herkunft eines Commits laut GitHub-API. */
  commitProvenance(sha: string): Promise<{ ok: boolean; reason: string }>;
  /** Symbolische Links unter den Daten-Ordnern (Pfade relativ zum Repository). */
  symlinks(): string[];
  /** Branch-Name des Pull Requests bzw. Laufs. */
  readonly branch: string | null;
  /** true = Pull Request aus einem Fork (Kopf-Repository ≠ dieses Repository). */
  readonly headIsFork: boolean;
  /** Prüft, ob die Lauf-ID ein Lauf von `.github/workflows/foods-import.yml` (workflow_dispatch, main) ist. */
  importRunProvenance(runId: string): Promise<{ ok: boolean; reason: string }>;
  /** Prüft, ob die Lauf-ID ein Lauf von `.github/workflows/content-review.yml` (workflow_dispatch, main) ist. */
  reviewRunProvenance(runId: string): Promise<{ ok: boolean; reason: string }>;
  /** Datei im Vergleichsstand (main); undefined = fehlt dort. */
  readBaseFile(path: string): Buffer | undefined;
}

async function runCheck(
  check: (runId: string) => Promise<{ ok: boolean; reason: string }>,
  runId: string,
): Promise<{ ok: boolean; reason: string }> {
  try {
    return await check(runId);
  } catch (error) {
    return { ok: false, reason: `Abfrage fehlgeschlagen: ${(error as Error).message}` };
  }
}

export interface IntegrityResult {
  readonly errors: string[];
  readonly notes: string[];
  /** true = Original-Dateien wurden geladen und geprüft. */
  readonly fullCheck: boolean;
}

async function checkSourceDir(
  dir: string,
  allowlist: readonly SourceDefinition[] | null,
  deps: IntegrityDeps,
  errors: string[],
  notes: string[],
): Promise<void> {
  const err = (message: string) => errors.push(`${dir}: ${message}`);
  const [, , db, version] = dir.split('/');
  for (const file of deps.listFiles(dir)) {
    if (!ALLOWED_SOURCE_FILES.has(file) && !file.startsWith('original.')) {
      err(
        `unerwartete Datei „${file}“ (erlaubt: SOURCE.json, extract.csv, ATTRIBUTION.md, original.*).`,
      );
    }
  }
  const manifestRaw = deps.readFile(`${dir}/SOURCE.json`);
  if (manifestRaw === undefined) {
    err('SOURCE.json fehlt.');
    return;
  }
  let manifestData: unknown;
  try {
    manifestData = JSON.parse(manifestRaw.toString('utf8'));
  } catch (error) {
    err(`SOURCE.json ist kein gültiges JSON (${(error as Error).message}).`);
    return;
  }
  const parsed = sourceManifestSchema.safeParse(manifestData);
  if (!parsed.success) {
    err(
      `SOURCE.json ungültig: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
    return;
  }
  const manifest = parsed.data;
  if (manifest.db !== db || manifest.version !== version) {
    err(`SOURCE.json nennt ${manifest.db} ${manifest.version}, Ordner ist ${db} ${version}.`);
    return;
  }
  if (deps.readFile(`${dir}/ATTRIBUTION.md`) === undefined) {
    err('ATTRIBUTION.md (Namensnennung/Lizenz) fehlt.');
  }
  if (allowlist === null) {
    err('Allowlist packages/content/src/foods/sources.ts fehlt auf main – Quelle nicht anerkannt.');
    return;
  }
  const allowed = allowlist.find((s) => s.db === manifest.db && s.version === manifest.version);
  if (allowed === undefined) {
    err(`Quelle ${manifest.db} ${manifest.version} steht nicht in der Allowlist von main.`);
    return;
  }
  if (manifest.url !== allowed.url) {
    err(`URL in SOURCE.json („${manifest.url}“) ≠ Allowlist von main („${allowed.url}“).`);
  }
  if (manifest.license !== allowed.license || manifest.attribution !== allowed.attribution) {
    err('Lizenz bzw. Namensnennung in SOURCE.json ≠ Allowlist von main.');
  }
  if (allowed.originalSha256 !== null && manifest.original_sha256 !== allowed.originalSha256) {
    err('original_sha256 ≠ festgenagelte Prüfsumme in der Allowlist von main.');
  }

  // Original IMMER neu laden – über den Allowlist-Eintrag aus main (nie aus SOURCE.json oder dem PR).
  let original: Buffer;
  try {
    original = await deps.download(allowed);
  } catch (error) {
    err(`Original-Datei nicht geladen: ${(error as Error).message}`);
    return;
  }
  const originalSha = sha256Hex(original);
  if (originalSha !== manifest.original_sha256) {
    err(
      `Neu geladene Original-Datei hat SHA-256 ${originalSha}, SOURCE.json nennt ${manifest.original_sha256}.`,
    );
    return;
  }
  for (const file of deps.listFiles(dir).filter((f) => f.startsWith('original.'))) {
    const checkedIn = deps.readFile(`${dir}/${file}`);
    if (checkedIn === undefined || sha256Hex(checkedIn) !== originalSha) {
      err(`Eingecheckte „${file}“ weicht von der neu geladenen Original-Datei ab.`);
    }
  }

  const extract = deps.readFile(`${dir}/extract.csv`);
  if (extract === undefined) {
    err('extract.csv fehlt.');
    return;
  }
  if (sha256Hex(extract) !== manifest.extract_sha256) {
    err('SHA-256 von extract.csv passt nicht zu SOURCE.json (Auszug verändert).');
  }
  const extractText = extract.toString('utf8');
  let records: string[][];
  try {
    records = readExtractRecords(extractText);
  } catch (error) {
    err(`extract.csv nicht lesbar: ${(error as Error).message}`);
    return;
  }
  if (serializeCsv(records) !== extractText) {
    err('extract.csv ist nicht in der kanonischen Form des Workflows (von Hand bearbeitet?).');
  }
  let originalRecords: string[][];
  try {
    originalRecords = readOriginalRecords(original, allowed);
  } catch (error) {
    err(`Original-Datei nicht lesbar: ${(error as Error).message}`);
    return;
  }
  const [header, ...rows] = records;
  const originalHeader = originalRecords[0] ?? [];
  if (header === undefined || serializeRecord(header) !== serializeRecord(originalHeader)) {
    err('Kopfzeile von extract.csv ≠ Kopfzeile der Original-Datei.');
  }
  const known = canonicalRecordSet(originalRecords.slice(1));
  rows.forEach((row, index) => {
    if (!known.has(serializeRecord(row))) {
      err(
        `Zeile ${index + 2} von extract.csv (Quell-ID „${row[allowed.keyColumn] ?? ''}“) ist keine unveränderte Zeile der Original-Datei.`,
      );
    }
  });
  if (rows.length !== manifest.extract_rows) {
    err(`extract.csv hat ${rows.length} Datenzeilen, SOURCE.json nennt ${manifest.extract_rows}.`);
  }
  notes.push(
    `${dir}: Original neu geladen (SHA-256 ${originalSha.slice(0, 12)}…), ${rows.length} Zeilen geprüft.`,
  );
}

/** Führt die Herkunftsprüfung aus (rein über `deps`, testbar). */
export async function checkSourcesIntegrity(deps: IntegrityDeps): Promise<IntegrityResult> {
  const errors: string[] = [];
  const notes: string[] = [];
  const changed = deps.changedPaths();
  for (const link of deps.symlinks()) {
    errors.push(
      `Symbolischer Link „${link}“ ist unter ${NO_SYMLINK_PATHS.join(', ')} nicht erlaubt (nur echte Dateien).`,
    );
  }
  const touched = (prefixes: readonly string[]) =>
    changed?.filter((path) => prefixes.some((prefix) => path.startsWith(prefix))) ?? [];

  // 4. Herkunft der Commits (nur mit Vergleichsstand, also in Pull Requests/Branches).
  if (changed !== null) {
    const protectedChanges = touched(PROTECTED_CONTENT_PATHS);
    if (protectedChanges.length > 0) {
      // Fork-PRs dürfen die Bot-Ordner nie ändern: Ein Fork kann mit SEINEM Token ebenfalls „verified“
      // Bot-Commits erzeugen (Wächter N2b, S1).
      if (deps.headIsFork) {
        errors.push(
          `Pull Request aus einem Fork ändert content/sources bzw. content/foods – nur der Workflow foods-import dieses Repositorys darf das: ${protectedChanges.join(', ')}`,
        );
      }
      const sourcesChanges = touched(['content/sources/']);
      const foodsChanges = touched(['content/foods/']);
      const importRunId =
        deps.branch === null ? undefined : FOODS_IMPORT_BRANCH.exec(deps.branch)?.[1];
      const reviewRunId =
        deps.branch === null ? undefined : CATALOG_REVIEW_BRANCH.exec(deps.branch)?.[1];
      if (reviewRunId !== undefined && sourcesChanges.length === 0) {
        // Katalog geprüft (R2-K6): Lauf von content-review auf main, nur erlaubte Felder.
        const run = await runCheck(deps.reviewRunProvenance, reviewRunId);
        if (!run.ok) {
          errors.push(
            `Lauf ${reviewRunId} aus dem Branch-Namen ist kein Lauf von content-review.yml auf main (${run.reason}).`,
          );
        }
        for (const path of foodsChanges) {
          errors.push(
            ...catalogReviewChangeErrors(path, deps.readBaseFile(path), deps.readFile(path)),
          );
        }
        notes.push(
          `Katalog-Prüfung (content-review): ${foodsChanges.length} Datei(en) – nur Status, Prüfvermerk und catalog_reviewed_* geprüft.`,
        );
      } else if (importRunId === undefined) {
        errors.push(
          `Änderungen unter content/sources/ bzw. content/foods/ nur über den Workflow foods-import (Branch foods-import/<Lauf-ID>) – Lebensmittel zusätzlich über content-review Art „katalog“ (Branch content-review/katalog-<Lauf-ID>, nur Katalog-Prüfung) –, hier Branch „${deps.branch ?? 'unbekannt'}“: ${protectedChanges.join(', ')}`,
        );
      } else {
        const run = await runCheck(deps.importRunProvenance, importRunId);
        if (!run.ok) {
          errors.push(
            `Lauf ${importRunId} aus dem Branch-Namen ist kein Lauf von foods-import.yml auf main (${run.reason}).`,
          );
        }
        for (const path of foodsChanges) {
          errors.push(
            ...importCatalogFieldErrors(path, deps.readBaseFile(path), deps.readFile(path)),
          );
        }
      }
    }
    if (touched(PROTECTED_CONTENT_PATHS).length > 0) {
      const shas = deps.commitsTouching(PROTECTED_CONTENT_PATHS);
      for (const sha of shas) {
        let info: { ok: boolean; reason: string };
        try {
          info = await deps.commitProvenance(sha);
        } catch (error) {
          info = { ok: false, reason: `Abfrage fehlgeschlagen: ${(error as Error).message}` };
        }
        if (!info.ok) {
          errors.push(
            `Commit ${sha.slice(0, 12)} ändert content/sources bzw. content/foods, ist aber kein verifizierter Commit von github-actions[bot] (${info.reason}). Diese Ordner schreibt nur foods-import.`,
          );
        }
      }
      if (shas.length > 0) {
        notes.push(`${shas.length} Commit(s) unter content/sources bzw. content/foods geprüft.`);
      }
    }
    if (touched(['packages/content/src/foods/sources.ts']).length > 0) {
      notes.push(
        'sources.ts geändert: Diese Prüfung nutzt trotzdem die Allowlist von main; sie gilt erst nach dem Merge (Prüfung mit dem Code von main: Workflow sources-integrity-main).',
      );
    }
  }

  // 1.–3. Volle Prüfung mit Neuladen: wöchentlich/main (changed === null) oder wenn relevante Pfade geändert sind.
  const dirs = deps.listSourceDirs();
  const fullCheck = changed === null || touched(INTEGRITY_TRIGGER_PATHS).length > 0;
  if (!fullCheck) {
    notes.push('Keine Quellen, Lebensmittel oder Import-Skripte geändert – Neuladen übersprungen.');
    return { errors, notes, fullCheck };
  }
  if (dirs.length === 0) {
    notes.push(`Noch keine Quellauszüge unter ${SOURCES_DIR}/ – nichts neu zu laden.`);
    return { errors, notes, fullCheck };
  }
  const allowlist = await deps.loadMainSources();
  for (const dir of dirs) {
    await checkSourceDir(dir, allowlist, deps, errors, notes);
  }
  return { errors, notes, fullCheck };
}

/** Bericht als Markdown (Zusammenfassung des Laufs). */
export function formatIntegrityResult(result: IntegrityResult): string {
  return [
    result.errors.length === 0
      ? '### ✅ sources-integrity: Herkunft der Nährwert-Quellen geprüft'
      : `### ❌ sources-integrity: ${result.errors.length} Fehler`,
    '',
    ...result.errors.map((e) => `- 🔴 ${e}`),
    ...result.notes.map((n) => `- ${n}`),
    '',
    'Regeln: docs/PLAN-PHASE-5.md 5.1.1 (b) und H1. Quellauszüge schreibt nur der Workflow foods-import.',
    '',
  ].join('\n');
}
