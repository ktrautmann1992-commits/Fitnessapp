import type { z } from 'zod';

import { CONTENT_STATUSES, type ContentStatus } from '../enums';
import type { ExerciseLookup } from './analysis';
import { checkExercise, checkLibraryCoverage, checkPlanTemplate } from './checks';
import { type ContentIssue, isBlockingIssue, makeIssue } from './rules';
import { type Exercise, exerciseSchema, type PlanTemplate, planTemplateSchema } from './schemas';

/**
 * Prüft einen kompletten Inhaltsstand (alle Dateien unter `content/`): Datei-Regeln, Schema (Ü1),
 * Versionen, Übungs- und Vorlagen-Checks. Wird vom Prüfskript `content:validate` (packages/content) und
 * später vom Admin-Bereich genutzt – rein, ohne Dateisystem.
 */

export type ContentFileKind = 'exercise' | 'plan_template';

export interface ContentFile {
  readonly kind: ContentFileKind;
  /** Dateiname ohne Ordner, z. B. `kniebeuge-langhantel.json`. */
  readonly fileName: string;
  /** Geparstes JSON (undefined, wenn `jsonError` gesetzt ist). */
  readonly data?: unknown;
  /** Fehlertext, wenn die Datei kein gültiges JSON ist. */
  readonly jsonError?: string;
  /** Stand derselben Datei im Vergleichsstand (z. B. `main`), falls vorhanden – für die Versionsregel. */
  readonly previous?: unknown;
}

export interface ContentValidationResult {
  /** Übungen mit gültigem Schema (bei doppelter ID nur die erste). */
  readonly exercises: readonly Exercise[];
  /** Plan-Vorlagen mit gültigem Schema (bei doppelter ID nur die erste). */
  readonly templates: readonly PlanTemplate[];
  /** Alle Befunde (rot und gelb). */
  readonly issues: readonly ContentIssue[];
  /** Befunde, die das Prüfskript fehlschlagen lassen (siehe isBlockingIssue). */
  readonly blocking: readonly ContentIssue[];
}

function readStatus(data: unknown): ContentStatus | null {
  const status = (data as { status?: unknown } | null)?.status;
  return CONTENT_STATUSES.includes(status as ContentStatus) ? (status as ContentStatus) : null;
}

function readId(data: unknown, fallback: string): string {
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id.length > 0 ? id : fallback;
}

/** JSON mit sortierten Schlüsseln – für den Vergleich „hat sich der Inhalt geändert?“. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Fachlicher Inhalt ohne Status, Version und Herkunft/Prüfvermerk. */
function contentBody(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return canonicalJson(value);
  }
  const ignored = new Set(['status', 'version', 'meta']);
  const rest = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => !ignored.has(key)),
  );
  return canonicalJson(rest);
}

/**
 * Versionsregel (Plan Abschnitt 5, Punkt 6): War der Inhalt im Vergleichsstand freigegeben und hat sich der
 * fachliche Inhalt geändert, muss `version` steigen. Eine Version darf nie sinken.
 */
export function checkVersionChange(
  kind: ContentFileKind,
  previous: unknown,
  current: Pick<Exercise, 'id' | 'status' | 'version'>,
): ContentIssue[] {
  if (previous === null || typeof previous !== 'object') {
    return [];
  }
  const prevVersion = (previous as { version?: unknown }).version;
  if (typeof prevVersion !== 'number') {
    return [];
  }
  const target = { kind, id: current.id, status: current.status };
  if (current.version < prevVersion) {
    return [
      makeIssue(
        'VERSION',
        target,
        `Version ${current.version} ist kleiner als vorher (${prevVersion}).`,
        'version',
      ),
    ];
  }
  if (
    readStatus(previous) === 'published' &&
    current.version === prevVersion &&
    contentBody(previous) !== contentBody(current)
  ) {
    return [
      makeIssue(
        'VERSION',
        target,
        `Freigegebener Inhalt wurde geändert – bitte „version“ auf ${prevVersion + 1} erhöhen.`,
        'version',
      ),
    ];
  }
  return [];
}

function schemaIssues(file: ContentFile, error: z.ZodError): ContentIssue[] {
  const target = {
    kind: file.kind,
    id: readId(file.data, file.fileName),
    status: readStatus(file.data),
  };
  return error.issues.map((issue) =>
    makeIssue(
      'Ü1',
      target,
      issue.message,
      issue.path.length > 0 ? issue.path.join('.') : undefined,
    ),
  );
}

/** Prüft alle Inhaltsdateien gemeinsam. */
export function validateContent(files: readonly ContentFile[]): ContentValidationResult {
  const issues: ContentIssue[] = [];
  const exercises: Exercise[] = [];
  const templates: PlanTemplate[] = [];
  const seenIds = new Map<string, string>();

  for (const file of files) {
    const fileTarget = { kind: file.kind, id: file.fileName, status: null };
    if (file.jsonError !== undefined) {
      issues.push(makeIssue('DATEI', fileTarget, `Kein gültiges JSON: ${file.jsonError}`));
      continue;
    }
    const parsed =
      file.kind === 'exercise'
        ? exerciseSchema.safeParse(file.data)
        : planTemplateSchema.safeParse(file.data);
    if (!parsed.success) {
      issues.push(...schemaIssues(file, parsed.error));
      continue;
    }
    const content = parsed.data;
    const target = { kind: file.kind, id: content.id, status: content.status };
    if (file.fileName !== `${content.id}.json`) {
      issues.push(
        makeIssue(
          'DATEI',
          target,
          `Dateiname „${file.fileName}“ passt nicht zur ID – erwartet „${content.id}.json“.`,
        ),
      );
    }
    const key = `${file.kind}:${content.id}`;
    const firstFile = seenIds.get(key);
    if (firstFile !== undefined) {
      issues.push(
        makeIssue('DATEI', target, `ID „${content.id}“ ist doppelt (auch in „${firstFile}“).`),
      );
      continue;
    }
    seenIds.set(key, file.fileName);
    issues.push(...checkVersionChange(file.kind, file.previous, content));
    if (file.kind === 'exercise') {
      exercises.push(content as Exercise);
    } else {
      templates.push(content as PlanTemplate);
    }
  }

  const library: ExerciseLookup = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  for (const exercise of exercises) {
    issues.push(...checkExercise(exercise, library));
  }
  issues.push(...checkLibraryCoverage(exercises));
  for (const template of templates) {
    issues.push(...checkPlanTemplate(template, library));
  }

  return { exercises, templates, issues, blocking: issues.filter(isBlockingIssue) };
}
