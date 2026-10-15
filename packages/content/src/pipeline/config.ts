/**
 * Einstellungen der Content-Pipeline (docs/PLAN-PHASE-2.md Abschnitte 4 und 10).
 *
 * Alle Werte kommen aus Umgebungsvariablen (GitHub Variables bzw. Workflow-Eingaben) und werden mit Zod
 * geprüft. Kein Wert hier ist geheim – der Gemini-Schlüssel (GEMINI_API_KEY) wird nur in `cli.ts` gelesen und
 * direkt an den Client übergeben (nie geloggt, nie in Dateien).
 *
 * KI-Anbieter seit 15.10.2026: Google Gemini (Gründer-Entscheidung 14.10.2026, docs/PLAN-PHASE-5.md N8).
 */
import { z } from 'zod';

/**
 * Modelle (Gründer-Vorgabe 15.10.2026: „günstiges Modell, nicht zu viele Kosten bei Gemini“). Standard ist je
 * Inhaltsart festgelegt (`ContentKindDefinition.defaultModel`) – jederzeit änderbar über die Workflow-Eingabe
 * „modell“ (ein Lauf) bzw. die GitHub-Variable CONTENT_MODEL (alle Läufe). Jedes Modell braucht einen Preis in
 * `pricing.ts`, sonst bricht der Lauf vor dem ersten API-Aufruf ab (Kostendeckel).
 *
 * - `gemini-3.8-flash`: Standard-Modell der offiziellen Gemini-Anleitungen (Google Gemini Cookbook
 *   `quickstarts/Get_started.ipynb`, `Batch_mode.ipynb`, Stand 15.10.2026; ohne „-preview“) – für Arten mit viel
 *   Fachlogik (Rezepte: Allergene, Schwangerschaft, Nährwerte; Übungen; Plan-Vorlagen).
 * - `gemini-3.5-flash-lite`: günstigstes Modell, das die Batch-Anleitung des Cookbooks ausdrücklich nennt („fastest,
 *   lowest-cost model in the 3.5 family“) – für einfache, eng begrenzte Arten (Packungsgrößen: eine Zahl;
 *   Austausch: bis zu 4 Katalog-IDs + Faktor).
 */
export const MODEL_FLASH = 'gemini-3.8-flash';
export const MODEL_FLASH_LITE = 'gemini-3.5-flash-lite';

/** Standardmodell für anspruchsvolle Arten (Rückfall, falls eine Art keinen eigenen Standard nennt). */
export const DEFAULT_CONTENT_MODEL = MODEL_FLASH;

/**
 * Denktiefe = Gemini `thinkingConfig.thinkingLevel`. Standard je Art so niedrig wie sinnvoll (Kosten: Denk-Token
 * zählen als Ausgabe), änderbar über die GitHub-Variable CONTENT_EFFORT (gilt dann für alle Arten).
 * `minimal` können laut Cookbook nur die Flash-Modelle.
 */
export const DEFAULT_CONTENT_EFFORT = 'medium';
export const CONTENT_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const;
export type ContentEffort = (typeof CONTENT_EFFORTS)[number];

/** Kostendeckel pro Lauf in US-Dollar (Gründer-Vorgabe 15.10.2026: 3 $ statt 15 $). */
export const DEFAULT_CONTENT_MAX_USD = 3;

/**
 * Harte Obergrenze für CONTENT_MAX_USD (Wächter-Hinweis Etappe B, gesenkt 15.10.2026): Auch per GitHub-Variable
 * lässt sich der Deckel pro Lauf nicht über 20 $ heben – ein Tippfehler (z. B. „200“) bricht ab, statt teuer zu
 * werden.
 */
export const CONTENT_MAX_USD_LIMIT = 20;

/** Standard für „Anzahl“ je Lauf (klein halten, Gründer-Vorgabe 15.10.2026; Workflow-Eingabe „anzahl“). */
export const DEFAULT_REQUEST_COUNT = 3;

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
  .regex(/^[a-z0-9][a-z0-9.-]{2,80}$/, 'CONTENT_MODEL: Modell-ID wie „gemini-3.8-flash“ erwartet.');

const maxUsdSchema = z.coerce
  .number({ error: 'CONTENT_MAX_USD: Zahl erwartet (z. B. 3).' })
  .positive('CONTENT_MAX_USD: muss größer als 0 sein.')
  .max(
    CONTENT_MAX_USD_LIMIT,
    `CONTENT_MAX_USD: höchstens ${CONTENT_MAX_USD_LIMIT} (harte Obergrenze pro Lauf).`,
  );

export interface PipelineSettings {
  /** undefined = Standard der Inhaltsart (`defaultModel`). */
  readonly model?: string | undefined;
  /** undefined = Standard der Inhaltsart (`defaultEffort`). */
  readonly effort?: ContentEffort | undefined;
  readonly maxUsd: number;
}

/** Einstellungen eines konkreten Laufs (Modell und Denktiefe aufgelöst). */
export interface RunSettings {
  readonly model: string;
  readonly effort: ContentEffort;
  readonly maxUsd: number;
}

/** Modell/Denktiefe: Eingabe bzw. GitHub-Variable vor dem Standard der Inhaltsart. */
export function resolveRunSettings(
  kind: { readonly defaultModel: string; readonly defaultEffort: ContentEffort },
  settings: PipelineSettings,
): RunSettings {
  return {
    model: settings.model ?? kind.defaultModel,
    effort: settings.effort ?? kind.defaultEffort,
    maxUsd: settings.maxUsd,
  };
}

/** Leere Werte (z. B. nicht gesetzte GitHub-Variable = leerer String) gelten als „nicht gesetzt“. */
function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Liest CONTENT_MODEL, CONTENT_EFFORT und CONTENT_MAX_USD. Nicht gesetzte Modell-/Denktiefe-Werte bleiben
 * undefined (= Standard der Inhaltsart), der Deckel hat den Standard 3 $.
 */
export function readPipelineSettings(env: NodeJS.ProcessEnv): PipelineSettings {
  const modelRaw = envValue(env, 'CONTENT_MODEL');
  const model = modelRaw === undefined ? undefined : modelSchema.parse(modelRaw);
  const effortRaw = envValue(env, 'CONTENT_EFFORT');
  const effort =
    effortRaw === undefined
      ? undefined
      : z
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
