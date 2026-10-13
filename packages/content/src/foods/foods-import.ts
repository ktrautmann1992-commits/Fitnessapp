/**
 * Ablauf des Workflows `foods-import` (docs/PLAN-PHASE-5.md 5.1 Schritte 1–4, 19.3, H1).
 *
 * Modus „kandidaten“: Original laden, Kandidaten für Zutaten ohne Quell-ID in die Zusammenfassung, vollständige
 * Namensliste (Quell-ID + Bezeichnung) nur ins Log – nichts schreiben. Modus „import“: Original laden →
 * `extract.csv` (nur benötigte Zeilen, unverändert) → `SOURCE.json` + `ATTRIBUTION.md` → Lebensmittel und Erwartungsliste (`import-source.ts`) → `content:validate` → Commit über
 * die GitHub-API (verified) auf `foods-import/<run-id>` → Pull Request → ci starten.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { sourceRowKey } from '@fitnessapp/core';

import { blockingCount, formatMarkdownSummary, validateRepository } from '../validate';
import { formatJson } from '../pipeline/files';
import { PHONE_TEST_SECTION, truncateBody } from '../pipeline/pull-request';
import { formatCandidates, formatNameList, mappingCandidates, nameListMarkers } from './candidates';
import { serializeCsv } from './csv';
import {
  type CommitFile,
  createVerifiedCommit,
  dispatchWorkflow,
  type GitHubApi,
  openPullRequest,
} from './github-api';
import {
  type Alpha5Per100g,
  EXPECTATIONS_PATH,
  FOODS_DIR,
  formatImportReport,
  type ImportReport,
  importFoods,
} from './import-source';
import { FOOD_MAPPING_PATH, parseFoodMapping } from './mapping';
import {
  attributionMarkdown,
  extractSourceRows,
  readExtractRecords,
  readOriginalRecords,
  sha256Hex,
  type SourceManifest,
  sourceDir,
  sourceManifestSchema,
} from './extract-source';
import { NUTRIENT_KEYS, resolveNutrientColumns, sourceNutrientRows } from './source-rows';
import { findSource, type SourceDefinition, SOURCES } from './sources';
import type { FetchedOriginal } from './download';
import { SourceDownloadError } from './download-page';
import { diagnoseOriginal, headerLine } from './original-format';

export const ALPHA5_SEED_PATH = 'packages/content/seed/alpha5-rezepte.json';
export const FOODS_IMPORT_BRANCH_PREFIX = 'foods-import/';

/** Prüf-Workflows, die foods-import für seinen Branch startet (Pflicht-Checks, docs/SETUP.md J2). */
export const CHECK_WORKFLOWS = ['ci.yml', 'sources-integrity-main.yml'] as const;

export interface FoodsImportOptions {
  readonly source: string;
  readonly version: string;
  readonly mode: 'kandidaten' | 'import';
}

export interface FoodsImportDeps {
  readonly repoRoot: string;
  readonly runId: string;
  /** Branch, auf dem der Workflow läuft – nur `main` erlaubt (Allowlist und Skripte von main). */
  readonly refName: string;
  readonly now: () => Date;
  /** Original-Datei zum Allowlist-Eintrag laden (Standard: `fetchSourceOriginal`, auch über eine Download-Seite). */
  download(def: SourceDefinition): Promise<FetchedOriginal>;
  /** GitHub-API (nur Modus „import“). */
  readonly api?: GitHubApi;
  /** Allowlist (Standard: sources.ts). */
  readonly sources?: readonly SourceDefinition[];
}

export interface FoodsImportResult {
  readonly exitCode: number;
  readonly markdown: string;
  readonly prUrl?: string;
  /**
   * Nur Modus „kandidaten“: vollständige Namensliste der Quelle (Quell-ID<TAB>Bezeichnung, mit Markern) – nur
   * fürs Actions-Log (stdout), NICHT für die Zusammenfassung (Größenlimit). Keine Nährwerte.
   */
  readonly log?: string;
}

function readJson(repoRoot: string, path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8'));
}

function alpha5Values(repoRoot: string): Map<string, Alpha5Per100g> {
  const data = readJson(repoRoot, ALPHA5_SEED_PATH) as {
    zutaten?: { id: string; pro_100g: Alpha5Per100g }[];
  };
  return new Map((data.zutaten ?? []).map((z) => [z.id, z.pro_100g]));
}

function existingFoods(repoRoot: string): Map<string, unknown> {
  const dir = join(repoRoot, FOODS_DIR);
  const result = new Map<string, unknown>();
  if (!existsSync(dir)) {
    return result;
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || name.startsWith('allergen-')) {
      continue;
    }
    try {
      result.set(name.replace(/\.json$/, ''), readJson(repoRoot, `${FOODS_DIR}/${name}`));
    } catch {
      result.set(name.replace(/\.json$/, ''), null);
    }
  }
  return result;
}

function readIfExists(repoRoot: string, path: string): Buffer | undefined {
  const full = join(repoRoot, path);
  return existsSync(full) ? readFileSync(full) : undefined;
}

/** Bericht „Spalten der Quelle“: welche Spalte je Nährwert genutzt würde (bestätigt `columnsStatus`). */
export function columnCheck(header: readonly string[], def: SourceDefinition): string {
  try {
    const columns = resolveNutrientColumns(header, def);
    return [
      '#### Spalten der Quelle (für sources.ts)',
      '',
      ...NUTRIENT_KEYS.map(
        (key) =>
          `- ${key}: Spalte ${columns[key].index} „${columns[key].header}“ (${columns[key].column.convert})`,
      ),
      '',
    ].join('\n');
  } catch (error) {
    return `#### ❌ Spalten der Quelle passen nicht zu sources.ts\n\n${(error as Error).message}\n`;
  }
}

function readPreviousManifest(repoRoot: string, dir: string): SourceManifest | undefined {
  const raw = readIfExists(repoRoot, `${dir}/SOURCE.json`);
  if (raw === undefined) {
    return undefined;
  }
  try {
    const parsed = sourceManifestSchema.safeParse(JSON.parse(raw.toString('utf8')));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Höchster Anteil der Zutaten mit „Zuordnung prüfen“, bei dem ein Import-PR gemergt werden darf (NB1). */
export const MAX_REVIEW_SHARE = 0.1;

/** Meldung, wenn für die Quelle noch keine Prüfsumme in sources.ts festgenagelt ist (NB1). */
export function pinRequiredMessage(loadedSha: string): string {
  return [
    '❌ **Kein Import: Für diese Quelle ist in `packages/content/src/foods/sources.ts` noch keine Prüfsumme (`originalSha256`) festgenagelt.**',
    '',
    'Feste Reihenfolge (docs/SETUP.md Teil J): (1) Lauf „kandidaten“, (2) Claude trägt die SHA-256 aus der Zusammenfassung per Pull Request als `originalSha256` ein, (3) ein Gründer merged, (4) erst dann Lauf „import“.',
    '',
    `Dieser Lauf hat geladen: \`${loadedSha}\``,
    '',
  ].join('\n');
}

/**
 * Merge-Sperre für den Import-PR (NB1): Sind mehr als 10 % der Zutaten mit „Zuordnung prüfen“ (> 15 % Abweichung
 * zur Gründer-Datei) markiert, wird nicht gemergt, bevor der Grund geklärt ist – eine falsche oder untergeschobene
 * Datei fiele hier massenhaft auf.
 */
export function reviewShareNote(report: ImportReport, totalItems: number): string {
  const flagged = new Set(report.deviations.filter((d) => d.level === 'review').map((d) => d.id));
  const share = totalItems === 0 ? 0 : flagged.size / totalItems;
  const percent = `${(share * 100).toFixed(1).replace('.', ',')} %`;
  if (share > MAX_REVIEW_SHARE) {
    return `⛔ **NICHT MERGEN, bevor der Grund geklärt ist:** ${flagged.size} von ${totalItems} Zutaten (${percent}) sind „Zuordnung prüfen“ – mehr als 10 %. Möglich: falsche Datei, falsche Spalten oder viele falsche Quell-IDs.`;
  }
  return `Merge-Regel: höchstens 10 % „Zuordnung prüfen“ – hier ${flagged.size} von ${totalItems} (${percent}). Darüber wird nicht gemergt, bevor der Grund geklärt ist.`;
}

/** Aufklappbarer Block mit der Beschreibung der Download-Seite (leer = nichts). */
function firstPageBlock(lines: readonly string[]): string[] {
  if (lines.length === 0) {
    return [];
  }
  return [
    '<details><summary>Diagnose: erste Seite (Download-Seite)</summary>',
    '',
    ...lines.map((l) => `- ${l}`),
    '',
    '</details>',
    '',
  ];
}

/** Bericht, wenn das Laden scheitert – mit allen Diagnose-Zeilen (Status, Typ, Größe, Dateiname, ZIP-Einträge, Links). */
export function downloadFailure(def: SourceDefinition, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostics = error instanceof SourceDownloadError ? error.diagnostics : [];
  const firstPage = error instanceof SourceDownloadError ? error.firstPage : [];
  return [
    `### ❌ foods-import: Original-Datei nicht geladen (${def.title})`,
    '',
    message,
    '',
    `- Adresse${def.downloadPage === null ? '' : ' (Download-Seite)'}: ${def.url}`,
    // Zeilen mit „  - “ sind Unterpunkte (z. B. Beschreibung der HTML-Antwort) – nicht doppelt aufzählen (K1).
    ...diagnostics.map((d) => (d.startsWith('  - ') ? d : `- ${d}`)),
    '',
    ...firstPageBlock(firstPage),
    'Bot-Sperren, Captchas und Anmeldeseiten werden nicht umgangen. Nächster Schritt: Zusammenfassung an Claude in einer Sitzung geben (docs/SETUP.md Teil J).',
    '',
  ].join('\n');
}

export async function runFoodsImport(
  options: FoodsImportOptions,
  deps: FoodsImportDeps,
): Promise<FoodsImportResult> {
  if (deps.refName !== 'main') {
    return {
      exitCode: 1,
      markdown: `### ❌ foods-import nur auf \`main\` starten\n\nGestartet auf „${deps.refName}“. Bitte in Actions → foods-import → Run workflow den Branch **main** wählen.\n`,
    };
  }
  const def = findSource(deps.sources ?? SOURCES, options.source, options.version);
  if (def === undefined) {
    return {
      exitCode: 1,
      markdown: `### ❌ Quelle ${options.source} ${options.version} steht nicht in der Allowlist (sources.ts)\n`,
    };
  }
  let fetched: FetchedOriginal;
  try {
    fetched = await deps.download(def);
  } catch (error) {
    return { exitCode: 1, markdown: downloadFailure(def, error) };
  }
  const original = fetched.data;
  const originalSha = sha256Hex(original);
  if (def.originalSha256 !== null && def.originalSha256 !== originalSha) {
    return {
      exitCode: 1,
      markdown: `### ❌ Original-Datei hat eine andere Prüfsumme als in sources.ts festgelegt\n\nGeladen: ${originalSha}\nErwartet: ${def.originalSha256}\n`,
    };
  }
  const dir = sourceDir(def);
  const previousManifest = readPreviousManifest(deps.repoRoot, dir);
  const shaChanged =
    previousManifest !== undefined && previousManifest.original_sha256 !== originalSha;
  const shaChangedMd = shaChanged
    ? `❌ **Original-Datei weicht vom ersten Import ab:** geladen \`${originalSha}\`, SOURCE.json nennt \`${previousManifest.original_sha256}\`. Version ${def.version} sollte unverändert sein – Herausgeber hat die Datei geändert oder der Download ist nicht echt. Kein Import; Gründer entscheiden (neue Version in sources.ts per PR).\n`
    : '';
  const sourceLines = [
    `- Adresse${def.downloadPage === null ? '' : ' (Download-Seite)'}: ${def.url}`,
    ...(def.downloadPage === null ? [] : [`- Geladen über: ${fetched.downloadUrl}`]),
    `- Datei: ${fetched.filename ?? def.originalFilename} (${fetched.container === 'zip' ? 'aus ZIP entpackt' : 'direkt'})`,
    `- SHA-256 Original: \`${originalSha}\` (${original.length} Bytes)`,
    `- Lizenz: ${def.license} – ${def.attribution}`,
  ];
  let records: string[][];
  try {
    records = readOriginalRecords(original, def);
  } catch (error) {
    return {
      exitCode: 1,
      markdown: [
        `### ❌ foods-import: Original-Datei nicht lesbar (${def.title})`,
        '',
        (error as Error).message,
        '',
        ...sourceLines,
        '',
        '#### Diagnose',
        '',
        ...[...fetched.details, ...diagnoseOriginal(original, def)].map((d) => `- ${d}`),
        '',
      ].join('\n'),
    };
  }
  const mapping = parseFoodMapping(readJson(deps.repoRoot, FOOD_MAPPING_PATH));
  const candidates = formatCandidates(mappingCandidates(mapping, records, def));
  const head = [
    `### foods-import: ${def.title}`,
    '',
    ...sourceLines,
    `- Zeilen: ${records.length - 1}`,
    '',
    ...(shaChangedMd === '' ? [] : [shaChangedMd]),
  ];
  if (options.mode === 'kandidaten') {
    const nameList = formatNameList(records, def);
    return {
      exitCode: shaChanged ? 1 : 0,
      log: nameList.text,
      markdown: [
        ...head,
        ...(def.originalSha256 === null
          ? [
              `➡️ **Vor dem Import Pflicht (NB1):** diese SHA-256 (\`${originalSha}\`) per Pull Request als \`originalSha256\` in sources.ts festnageln lassen und selbst mergen (docs/SETUP.md J3).`,
              '',
            ]
          : []),
        columnCheck(records[0] ?? [], def),
        candidates,
        '',
        `Vollständige Namensliste (Quell-ID + Bezeichnung) nur im Log dieses Laufs: ${nameList.written} Zeilen zwischen \`${nameListMarkers(def.db).begin}\` und \`${nameListMarkers(def.db).end}\`${nameList.skipped > 0 ? `; ${nameList.skipped} Zeilen mit leerer oder abweichender Quell-ID (Format \`${def.keyPattern}\`) nicht ausgegeben` : ''}.`,
        '',
        '<details><summary>Diagnose: Abruf und Aufbau der Datei</summary>',
        '',
        ...fetched.details.map((d) => `- ${d}`),
        `- ${headerLine(records[0] ?? [])}`,
        '',
        '</details>',
        '',
        ...firstPageBlock(fetched.firstPage ?? []),
      ].join('\n'),
    };
  }
  if (shaChanged) {
    return { exitCode: 1, markdown: head.join('\n') };
  }

  // --- Modus import ---------------------------------------------------------------------------------
  // Wächter-Nachtrag blsdb, NB1: Ohne festgenagelte Prüfsumme kein Import – sonst würde der erste Import die
  // Prüfsumme der Datei, die er gerade bekommt, selbst zum Maßstab machen.
  if (def.originalSha256 === null) {
    return { exitCode: 1, markdown: [...head, pinRequiredMessage(originalSha)].join('\n') };
  }
  const refs = mapping.items
    .filter(
      (i) => i.source.db === def.db && i.source.version === def.version && i.source.ref !== null,
    )
    .map((i) => i.source.ref as string);
  if (refs.length === 0) {
    return {
      exitCode: 1,
      markdown: [
        ...head,
        '❌ In der Zuordnung ist noch keine Quell-ID eingetragen – zuerst Modus „kandidaten“ starten und die Quell-IDs eintragen (docs/SETUP.md Teil J).',
        '',
        candidates,
      ].join('\n'),
    };
  }
  const extract = extractSourceRows(records, def, refs);
  const extractRecords = readExtractRecords(extract.csv);
  const { rows: rowsByRef, problems } = sourceNutrientRows(extractRecords, def);
  const sourceRows = new Map([...rowsByRef.values()].map((row) => [sourceRowKey(row), row]));
  const extractSha = sha256Hex(extract.csv);

  const sameExtract =
    previousManifest !== undefined &&
    previousManifest.extract_sha256 === extractSha &&
    previousManifest.original_sha256 === originalSha &&
    previousManifest.url === def.url;
  const nowIso = deps.now().toISOString();
  const manifest: SourceManifest =
    sameExtract && previousManifest !== undefined
      ? previousManifest
      : {
          db: def.db,
          version: def.version,
          title: def.title,
          url: def.url,
          original_filename: fetched.filename ?? def.originalFilename,
          original_bytes: original.length,
          original_sha256: originalSha,
          extract_sha256: extractSha,
          extract_rows: extractRecords.length - 1,
          retrieved_at: nowIso.replace(/\.\d{3}Z$/, 'Z'),
          workflow_run_id: deps.runId,
          license: def.license,
          license_url: def.licenseUrl,
          attribution: def.attribution,
        };

  const imported = importFoods({
    mapping,
    def,
    sourceRows,
    retrievedOn: manifest.retrieved_at.slice(0, 10),
    existing: existingFoods(deps.repoRoot),
    alpha5: alpha5Values(deps.repoRoot),
    today: nowIso.slice(0, 10),
  });

  // Dateien zusammenstellen (Prettier-Format wie im Repository).
  const planned = new Map<string, Buffer>();
  planned.set(`${dir}/extract.csv`, Buffer.from(serializeCsv(extractRecords)));
  planned.set(
    `${dir}/SOURCE.json`,
    Buffer.from(await formatJson(deps.repoRoot, `${dir}/SOURCE.json`, manifest)),
  );
  planned.set(`${dir}/ATTRIBUTION.md`, Buffer.from(attributionMarkdown(def)));
  for (const [id, food] of imported.foods) {
    const path = `${FOODS_DIR}/${id}.json`;
    planned.set(path, Buffer.from(await formatJson(deps.repoRoot, path, food)));
  }
  planned.set(
    EXPECTATIONS_PATH,
    Buffer.from(await formatJson(deps.repoRoot, EXPECTATIONS_PATH, imported.expectations)),
  );
  const changed: CommitFile[] = [];
  for (const [path, content] of planned) {
    const before = readIfExists(deps.repoRoot, path);
    if (before === undefined || !before.equals(content)) {
      changed.push({ path, content });
    }
  }

  const problemsMd =
    problems.length === 0
      ? ''
      : [
          '#### Quellzeilen, die nicht übernommen werden konnten',
          '',
          ...problems.map((p) => `- \`${p.ref}\`: ${p.message}`),
          '',
        ].join('\n');
  const reportMd = [
    ...head,
    `- SHA-256 Auszug: \`${extractSha}\` (${extractRecords.length - 1} Zeilen)`,
    '',
    reviewShareNote(imported.report, refs.length),
    '',
    formatImportReport(imported.report, extract.missingRefs),
    problemsMd,
    candidates,
  ].join('\n');

  if (changed.length === 0) {
    return { exitCode: 0, markdown: `${reportMd}\n\n**Keine Änderungen – kein Pull Request.**\n` };
  }

  if (deps.api === undefined) {
    return {
      exitCode: 1,
      markdown: `${reportMd}\n\n❌ Kein GITHUB_TOKEN – kein Commit möglich.\n`,
    };
  }
  const branch = `${FOODS_IMPORT_BRANCH_PREFIX}${deps.runId}`;
  const opened = await commitAndOpen(deps, def, manifest, changed, branch, reportMd);
  return { exitCode: 0, ...opened };
}

async function commitAndOpen(
  deps: FoodsImportDeps,
  def: SourceDefinition,
  manifest: SourceManifest,
  files: CommitFile[],
  branch: string,
  reportMd: string,
): Promise<{ prUrl: string; markdown: string }> {
  const api = deps.api as GitHubApi;
  // Neuen Stand in den Arbeitsordner des Workflows schreiben und mit content:validate prüfen (Lebensmittel sind
  // Entwürfe; blockierend sind Schema-/Dateifehler). Committet wird danach NUR über die GitHub-API.
  for (const file of files) {
    if (file.content !== null) {
      const full = join(deps.repoRoot, file.path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, file.content);
    }
  }
  const validation = validateRepository({ cwd: deps.repoRoot });
  const blocking = blockingCount(validation);
  if (blocking > 0) {
    throw new Error(
      `content:validate meldet ${blocking} blockierende Fehler – kein Pull Request.\n\n${formatMarkdownSummary(validation)}`,
    );
  }
  await createVerifiedCommit(api, {
    base: 'main',
    branch,
    message: `Lebensmittel aus ${def.title} (foods-import #${deps.runId})`,
    files,
  });
  const body = truncateBody(
    [
      `Automatischer Import aus der amtlichen Quelle (Workflow \`foods-import\`, Lauf ${deps.runId}). Nährwerte kommen nur aus dem Quellauszug, nie von Hand oder von einer KI (docs/PLAN-PHASE-5.md 5.1, 19.3).`,
      '',
      `- Quelle: ${def.title}`,
      `- Adresse: ${manifest.url}`,
      `- Version: ${manifest.version}`,
      `- SHA-256 Original: \`${manifest.original_sha256}\``,
      `- SHA-256 Auszug: \`${manifest.extract_sha256}\``,
      `- Lizenz: ${manifest.license} · ${manifest.attribution}`,
      '',
      reportMd,
      '',
      formatMarkdownSummary(validation),
      '',
      PHONE_TEST_SECTION,
      '',
      '**Danach:** Lebensmittel mit der Checkliste prüfen (docs/PLAN-PHASE-5.md 5.1.1 d) – markierte Zuordnungen („Zuordnung prüfen“) zuerst.',
    ].join('\n'),
  );
  const prUrl = await openPullRequest(api, {
    base: 'main',
    branch,
    title: `Lebensmittel: ${def.title} (foods-import #${deps.runId})`,
    body,
  });
  // Pull Requests mit dem GITHUB_TOKEN starten keine Workflows – beide Prüf-Workflows ausdrücklich starten
  // (ci mit sources-integrity und sources-integrity-main mit dem Code von main; Wächter N2b, GB1).
  const notes: string[] = [];
  for (const workflow of CHECK_WORKFLOWS) {
    try {
      await dispatchWorkflow(api, workflow, branch);
      notes.push(`${workflow} gestartet.`);
    } catch (error) {
      notes.push(
        `${workflow} konnte nicht gestartet werden (${(error as Error).message}) – bitte Actions → ${workflow.replace(/\.yml$/, '')} → Run workflow, Branch ${branch}.`,
      );
    }
  }
  const ciNote = notes.join(' ');
  return { prUrl, markdown: `${reportMd}\n\n**Pull Request:** ${prUrl}\n\n${ciNote}\n` };
}
