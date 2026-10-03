/**
 * Prüfskript `content:validate`: liest alle Inhalte unter `content/` und prüft sie mit den Regeln aus
 * packages/core (Schema Ü1, Plausibilitäts-Checks Ü2–Ü6 und V1–V11, Datei- und Versionsregeln).
 *
 * - Ausgabe auf Deutsch, rot = Fehler, gelb = Hinweis (docs/PLAN-PHASE-2.md Abschnitt 7).
 * - Exit-Code 1 bei Schema-/Dateifehlern jeder Art und bei roten Fehlern an FREIGEGEBENEN Inhalten.
 *   Entwürfe dürfen andere rote Fehler haben (damit man sie korrigieren kann) – sie werden nur gemeldet.
 * - Mit `--base <git-ref>` (z. B. origin/main) wird zusätzlich geprüft, ob geänderte freigegebene Inhalte
 *   eine höhere Version haben.
 * - In GitHub Actions steht der Bericht zusätzlich in der Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import {
  type ContentFile,
  type ContentFileKind,
  type ContentIssue,
  type ContentStatus,
  type ContentValidationResult,
  isBlockingIssue,
  validateContent,
} from '@fitnessapp/core';

/** Ordner unter `content/` je Inhaltsart. */
export const CONTENT_FOLDERS: Record<ContentFileKind, string> = {
  exercise: 'exercises',
  plan_template: 'plan-templates',
};

/** Liest den Stand einer Datei (Pfad relativ zum Repository) im Vergleichsstand; undefined = nicht vorhanden. */
export type PreviousReader = (repoPath: string) => string | undefined;

export interface LoadedContent {
  readonly files: ContentFile[];
  /** Dateien, die nicht als Inhalt gelten (z. B. falsche Endung) – werden als Fehler gemeldet. */
  readonly strayFiles: string[];
}

/**
 * Liest alle JSON-Dateien aus `contentDir/exercises` und `contentDir/plan-templates`.
 * `repoRoot` + `readPrevious` liefern optional den Vergleichsstand je Datei (Versionsregel).
 */
export function loadContentFiles(
  contentDir: string,
  options: { repoRoot?: string; readPrevious?: PreviousReader } = {},
): LoadedContent {
  const files: ContentFile[] = [];
  const strayFiles: string[] = [];
  for (const [kind, folder] of Object.entries(CONTENT_FOLDERS) as [ContentFileKind, string][]) {
    const dir = join(contentDir, folder);
    if (!existsSync(dir)) {
      continue;
    }
    for (const fileName of readdirSync(dir).sort()) {
      if (fileName.startsWith('.')) {
        continue;
      }
      if (!fileName.endsWith('.json')) {
        strayFiles.push(`${folder}/${fileName}`);
        continue;
      }
      const fullPath = join(dir, fileName);
      const repoPath = options.repoRoot ? relative(options.repoRoot, fullPath) : fullPath;
      const previousText = options.readPrevious?.(repoPath);
      let previous: unknown;
      if (previousText !== undefined) {
        try {
          previous = JSON.parse(previousText);
        } catch {
          previous = undefined;
        }
      }
      try {
        const data: unknown = JSON.parse(readFileSync(fullPath, 'utf8'));
        files.push({ kind, fileName, data, ...(previous === undefined ? {} : { previous }) });
      } catch (error) {
        files.push({ kind, fileName, jsonError: (error as Error).message });
      }
    }
  }
  return { files, strayFiles };
}

/** Repository-Wurzel per git (undefined ohne git). */
export function gitRepoRoot(cwd: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Leser für den Vergleichsstand `ref` (z. B. origin/main). undefined, wenn es den Stand nicht gibt
 * (z. B. flacher Checkout) – dann entfällt die Versionsprüfung mit Hinweis.
 */
export function gitPreviousReader(repoRoot: string, ref: string): PreviousReader | undefined {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch {
    return undefined;
  }
  return (repoPath) => {
    try {
      return execFileSync('git', ['show', `${ref}:${repoPath}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return undefined; // Datei ist neu
    }
  };
}

const STATUS_DE: Record<ContentStatus, string> = {
  draft: 'Entwurf',
  published: 'freigegeben',
  archived: 'zurückgezogen',
};

const KIND_DE = { exercise: 'Übung', plan_template: 'Vorlage', library: 'Bibliothek' } as const;

function countByStatus(items: readonly { status: ContentStatus }[]): string {
  const count = (status: ContentStatus) => items.filter((item) => item.status === status).length;
  return `${count('draft')} Entwürfe, ${count('published')} freigegeben, ${count('archived')} zurückgezogen`;
}

function issueLine(issue: ContentIssue): string {
  const level = issue.severity === 'error' ? 'ROT ' : 'GELB';
  const status = issue.status ? ` (${STATUS_DE[issue.status]})` : '';
  const path = issue.path ? ` · ${issue.path}` : '';
  const blocking = isBlockingIssue(issue) ? ' [blockiert]' : '';
  return `${level} ${issue.rule.padEnd(7)} ${KIND_DE[issue.kind]} ${issue.id}${status}${path}: ${issue.message}${blocking}`;
}

export interface ReportInput {
  readonly result: ContentValidationResult;
  readonly strayFiles: readonly string[];
  /** Hinweis zur Versionsprüfung (z. B. „Vergleich mit origin/main“). */
  readonly versionNote: string;
}

/** Fehler insgesamt, die das Skript fehlschlagen lassen (inkl. fremder Dateien). */
export function blockingCount(input: ReportInput): number {
  return input.result.blocking.length + input.strayFiles.length;
}

/** Prüfbericht als Text (Konsole). */
export function formatReport(input: ReportInput): string {
  const { result, strayFiles, versionNote } = input;
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');
  const blocking = blockingCount(input);
  const lines = [
    'Inhalte prüfen (content:validate)',
    `Übungen: ${result.exercises.length} (${countByStatus(result.exercises)})`,
    `Plan-Vorlagen: ${result.templates.length} (${countByStatus(result.templates)})`,
    `Versionen: ${versionNote}`,
    '',
    ...strayFiles.map(
      (file) =>
        `ROT  DATEI   ${file}: keine JSON-Datei – bitte entfernen oder umbenennen. [blockiert]`,
    ),
    ...[...errors, ...warnings].map(issueLine),
    ...(result.issues.length + strayFiles.length === 0 ? ['Keine Befunde.'] : []),
    '',
    `Ergebnis: ${blocking} blockierende Fehler · ${errors.length + strayFiles.length - blocking} rote Fehler an Entwürfen/zurückgezogenen Inhalten · ${warnings.length} gelbe Hinweise`,
    blocking === 0
      ? '✔ Bestanden.'
      : '✘ Nicht bestanden: Schema-/Dateifehler oder rote Fehler an freigegebenen Inhalten (Details oben).',
  ];
  return lines.join('\n');
}

/** Kurzfassung als Markdown für die Zusammenfassung in GitHub Actions (am Handy lesbar). */
export function formatMarkdownSummary(input: ReportInput): string {
  const { result } = input;
  const blocking = blockingCount(input);
  const rows = result.issues.map((issue) => {
    const level = issue.severity === 'error' ? '🔴' : '🟡';
    const status = issue.status ? STATUS_DE[issue.status] : '–';
    return `| ${level} ${issue.rule} | ${KIND_DE[issue.kind]} \`${issue.id}\` | ${status} | ${issue.message.replace(/\|/g, '\\|')} |`;
  });
  return [
    blocking === 0 ? '### ✅ Inhalte geprüft' : '### ❌ Inhalte: blockierende Fehler',
    '',
    `Übungen: ${result.exercises.length} (${countByStatus(result.exercises)}) · Plan-Vorlagen: ${result.templates.length} (${countByStatus(result.templates)})`,
    '',
    `Versionen: ${input.versionNote}`,
    '',
    ...(input.strayFiles.length > 0
      ? [`🔴 Keine JSON-Dateien: ${input.strayFiles.join(', ')}`, '']
      : []),
    ...(rows.length > 0
      ? ['| Regel | Inhalt | Status | Befund |', '| --- | --- | --- | --- |', ...rows]
      : ['Keine Befunde.']),
    '',
    'Rot blockiert nur bei freigegebenen Inhalten (Schema-/Dateifehler immer). Regeln: docs/PLAN-PHASE-2.md Abschnitt 7.',
    '',
  ].join('\n');
}

export interface CliResult {
  readonly exitCode: number;
  readonly output: string;
  readonly markdown: string;
}

/** Argumente: `--content <ordner>` (Standard: <repo>/content), `--base <git-ref>`. */
export function parseArgs(argv: readonly string[]): { contentDir?: string; base?: string } {
  const result: { contentDir?: string; base?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (
      (arg === '--content' || arg === '--base') &&
      value !== undefined &&
      !value.startsWith('--')
    ) {
      if (arg === '--content') {
        result.contentDir = value;
      } else {
        result.base = value;
      }
      i += 1;
    } else if (arg !== '--') {
      throw new Error(
        `Unbekanntes Argument: ${arg} (erlaubt: --content <Ordner>, --base <git-ref>)`,
      );
    }
  }
  return result;
}

/**
 * Prüft den Inhaltsstand eines Repositorys (strukturiertes Ergebnis). Wird von `content:validate` und von
 * den Workflows der Pipeline (content-collect, content-review, content-seed) genutzt.
 */
export function validateRepository(options: {
  cwd: string;
  contentDir?: string;
  base?: string;
}): ReportInput {
  const repoRoot = gitRepoRoot(options.cwd);
  const contentDir = resolve(
    options.cwd,
    options.contentDir ?? join(repoRoot ?? options.cwd, 'content'),
  );

  let readPrevious: PreviousReader | undefined;
  let versionNote = 'nicht geprüft (kein Vergleichsstand angegeben, Option --base)';
  if (options.base !== undefined) {
    readPrevious = repoRoot ? gitPreviousReader(repoRoot, options.base) : undefined;
    versionNote = readPrevious
      ? `Vergleich mit ${options.base}`
      : `nicht geprüft – Vergleichsstand „${options.base}“ nicht verfügbar`;
  }

  const loaded = loadContentFiles(contentDir, {
    ...(repoRoot === undefined ? {} : { repoRoot }),
    ...(readPrevious === undefined ? {} : { readPrevious }),
  });
  return {
    result: validateContent(loaded.files),
    strayFiles: loaded.strayFiles,
    versionNote,
  };
}

/** Führt die Prüfung aus (ohne Prozess-Ende) – testbar. */
export function runValidate(argv: readonly string[], cwd: string): CliResult {
  const args = parseArgs(argv);
  const input = validateRepository({
    cwd,
    ...(args.contentDir === undefined ? {} : { contentDir: args.contentDir }),
    ...(args.base === undefined ? {} : { base: args.base }),
  });
  return {
    exitCode: blockingCount(input) > 0 ? 1 : 0,
    output: formatReport(input),
    markdown: formatMarkdownSummary(input),
  };
}
