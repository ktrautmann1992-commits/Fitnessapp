/**
 * Einstellungen der Content-Pipeline (docs/PLAN-PHASE-2.md Abschnitte 4 und 10).
 *
 * Alle Werte kommen aus Umgebungsvariablen (GitHub Variables bzw. Workflow-Eingaben) und werden mit Zod
 * geprüft. Kein Wert hier ist geheim – der Anthropic-Schlüssel wird nur vom SDK selbst gelesen.
 */
import { z } from 'zod';

/** Standardmodell (Plan Abschnitt 10/15): Claude Opus 5.5, änderbar über die GitHub-Variable CONTENT_MODEL. */
export const DEFAULT_CONTENT_MODEL = 'claude-opus-5-5';

/** Denktiefe (Plan Abschnitt 10): `high`, weil Qualität hier wichtiger ist als Cent-Beträge. */
export const DEFAULT_CONTENT_EFFORT = 'high';
export const CONTENT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ContentEffort = (typeof CONTENT_EFFORTS)[number];

/** Kostendeckel pro Lauf in US-Dollar (Plan Abschnitt 10, Punkt 1). */
export const DEFAULT_CONTENT_MAX_USD = 15;

/**
 * Harte Obergrenze für CONTENT_MAX_USD (Wächter-Hinweis Etappe B): Auch per GitHub-Variable lässt sich der
 * Deckel pro Lauf nicht über 100 $ heben – ein Tippfehler (z. B. „1500“) bricht ab, statt teuer zu werden.
 */
export const CONTENT_MAX_USD_LIMIT = 100;

/** Höchstens so viele Anfragen pro Lauf (Plan Abschnitt 10, Punkt 2). */
export const MAX_REQUESTS_PER_RUN = 200;

/** Ordner der Merkdateien der Batch-Läufe (relativ zum Repository). */
export const BATCH_RECORD_DIR = 'content/batches';

/** Präfix der Arbeits-Branches, die `content-generate` anlegt und `content-collect` abholt. */
export const BATCH_BRANCH_PREFIX = 'content/batch-';

/** Präfix der Branches von `content-review`. */
export const REVIEW_BRANCH_PREFIX = 'content/review-';

/** Ziel-Branch der Pull Requests. */
export const BASE_BRANCH = 'main';

const modelSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9.-]{2,80}$/, 'CONTENT_MODEL: Modell-ID wie „claude-opus-5-5“ erwartet.');

const maxUsdSchema = z.coerce
  .number({ error: 'CONTENT_MAX_USD: Zahl erwartet (z. B. 15).' })
  .positive('CONTENT_MAX_USD: muss größer als 0 sein.')
  .max(
    CONTENT_MAX_USD_LIMIT,
    `CONTENT_MAX_USD: höchstens ${CONTENT_MAX_USD_LIMIT} (harte Obergrenze pro Lauf).`,
  );

export interface PipelineSettings {
  readonly model: string;
  readonly effort: ContentEffort;
  readonly maxUsd: number;
}

/** Leere Werte (z. B. nicht gesetzte GitHub-Variable = leerer String) gelten als „nicht gesetzt“. */
function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** Liest CONTENT_MODEL, CONTENT_EFFORT und CONTENT_MAX_USD (mit Standardwerten). */
export function readPipelineSettings(env: NodeJS.ProcessEnv): PipelineSettings {
  const model = modelSchema.parse(envValue(env, 'CONTENT_MODEL') ?? DEFAULT_CONTENT_MODEL);
  const effortRaw = envValue(env, 'CONTENT_EFFORT') ?? DEFAULT_CONTENT_EFFORT;
  const effort = z
    .enum(CONTENT_EFFORTS, {
      error: `CONTENT_EFFORT: erlaubt sind ${CONTENT_EFFORTS.join(', ')}.`,
    })
    .parse(effortRaw);
  const maxUsd = maxUsdSchema.parse(envValue(env, 'CONTENT_MAX_USD') ?? DEFAULT_CONTENT_MAX_USD);
  return { model, effort, maxUsd };
}

/** Wahr/falsch aus Workflow-Eingaben („true“, „false“, leer). */
export function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'ja';
}

/** Heutiges Datum (Europe/Berlin) als JJJJ-MM-TT. */
export function isoDateBerlin(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Erste Zod-Fehlermeldung (für verständliche Abbrüche). */
export function zodMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
