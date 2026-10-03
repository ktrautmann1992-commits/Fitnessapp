/**
 * `content-seed` (docs/PLAN-PHASE-2.md Abschnitte 4 Schritt 4 und 5 Punkt 5):
 * 1. ALLE Inhalte selbst prüfen (content:validate) – bei einem einzigen blockierenden Fehler wird NICHTS
 *    eingespielt.
 * 2. Einspiel-Paket bauen: nur `published`, je Einheit einer Vorlage `estimated_minutes`
 *    (estimateSessionMinutes aus packages/core).
 * 3. `seed_content(p_content)` per Supabase-Service-Key aufrufen (eine Transaktion, idempotent).
 * Ohne SUPABASE_URL/SUPABASE_SECRET_KEY endet es nach der Prüfung grün mit Hinweis.
 */
import {
  type ContentValidationResult,
  estimateSessionMinutes,
  type Exercise,
  type PlanTemplate,
} from '@fitnessapp/core';

import {
  blockingCount,
  formatMarkdownSummary,
  type ReportInput,
  validateRepository,
} from '../validate';

export interface SeedPackage {
  readonly exercises: Exercise[];
  readonly plan_templates: (Omit<PlanTemplate, 'sessions'> & {
    sessions: (PlanTemplate['sessions'][number] & { estimated_minutes: number })[];
  })[];
}

/** Nur freigegebene Inhalte; Vorlagen mit geschätzter Dauer je Einheit. */
export function buildSeedPackage(result: ContentValidationResult): SeedPackage {
  return {
    exercises: result.exercises.filter((exercise) => exercise.status === 'published'),
    plan_templates: result.templates
      .filter((template) => template.status === 'published')
      .map((template) => ({
        ...template,
        sessions: template.sessions.map((session) => ({
          ...session,
          estimated_minutes: estimateSessionMinutes(session),
        })),
      })),
  };
}

export interface SeedEnv {
  readonly url?: string;
  readonly secretKey?: string;
}

export type SeedFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface SeedResult {
  readonly exitCode: number;
  readonly status: 'blocked' | 'skipped' | 'seeded' | 'failed';
  readonly markdown: string;
  readonly package?: SeedPackage;
}

/** Legacy-Schlüssel (`service_role`) sind JWTs; neue Secret Keys (`sb_secret_…`) nur im `apikey`-Header. */
function authHeaders(secretKey: string): Record<string, string> {
  return secretKey.startsWith('eyJ')
    ? { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
    : { apikey: secretKey };
}

/** Ruft `public.seed_content` über die REST-Schnittstelle (PostgREST) auf. */
export async function callSeedContent(
  env: Required<SeedEnv>,
  pkg: SeedPackage,
  fetchImpl: SeedFetch,
): Promise<unknown> {
  const base = new URL(env.url);
  if (
    base.protocol !== 'https:' &&
    base.hostname !== 'localhost' &&
    base.hostname !== '127.0.0.1'
  ) {
    throw new Error('SUPABASE_URL muss mit https:// beginnen.');
  }
  const endpoint = new URL('/rest/v1/rpc/seed_content', base);
  const response = await fetchImpl(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(env.secretKey) },
    body: JSON.stringify({ p_content: pkg }),
  });
  const text = await response.text();
  if (!response.ok) {
    // Fehlermeldungen von seed_content enthalten nur Inhalts-IDs (keine Nutzerdaten).
    let message = text.slice(0, 1000);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message ?? message;
    } catch {
      // Text bleibt wie geliefert.
    }
    throw new Error(`seed_content: HTTP ${response.status} – ${message}`);
  }
  return text === '' ? null : (JSON.parse(text) as unknown);
}

export async function runSeed(options: {
  repoRoot: string;
  env: SeedEnv;
  fetchImpl?: SeedFetch;
}): Promise<SeedResult> {
  const report: ReportInput = validateRepository({ cwd: options.repoRoot });
  const blocking = blockingCount(report);
  if (blocking > 0) {
    return {
      exitCode: 1,
      status: 'blocked',
      markdown: [
        `### ❌ content-seed: ${blocking} blockierende Fehler – nichts eingespielt`,
        '',
        formatMarkdownSummary(report),
      ].join('\n'),
    };
  }
  const pkg = buildSeedPackage(report.result);
  const counts = `${pkg.exercises.length} Übungen, ${pkg.plan_templates.length} Plan-Vorlagen (nur „published“)`;
  const url = options.env.url?.trim();
  const secretKey = options.env.secretKey?.trim();
  if (!url || !secretKey) {
    return {
      exitCode: 0,
      status: 'skipped',
      package: pkg,
      markdown: [
        '### ⏭️ content-seed übersprungen – Supabase fehlt',
        '',
        `Inhalte geprüft ✅ · Einspiel-Paket: ${counts}.`,
        'Es fehlen die GitHub-Secrets SUPABASE_URL und/oder SUPABASE_SECRET_KEY (docs/SETUP.md Teile A und B).',
        '',
      ].join('\n'),
    };
  }
  try {
    const response = await callSeedContent(
      { url, secretKey },
      pkg,
      options.fetchImpl ?? ((input, init) => fetch(input, init)),
    );
    const r = (response ?? {}) as Record<string, unknown>;
    return {
      exitCode: 0,
      status: 'seeded',
      package: pkg,
      markdown: [
        '### ✅ content-seed: Inhalte eingespielt',
        '',
        `Eingespielt: ${String(r.exercises ?? pkg.exercises.length)} Übungen, ${String(r.plan_templates ?? pkg.plan_templates.length)} Plan-Vorlagen.`,
        `Zurückgezogen (archived): ${String(r.archived_exercises ?? 0)} Übungen, ${String(r.archived_plan_templates ?? 0)} Plan-Vorlagen.`,
        '',
      ].join('\n'),
    };
  } catch (error) {
    return {
      exitCode: 1,
      status: 'failed',
      package: pkg,
      markdown: `### ❌ content-seed fehlgeschlagen – nichts eingespielt (eine Transaktion)\n\n${(error as Error).message}\n`,
    };
  }
}
