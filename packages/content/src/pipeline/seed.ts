/**
 * `content-seed` (docs/PLAN-PHASE-2.md Abschnitte 4 Schritt 4 und 5 Punkt 5):
 * 1. ALLE Inhalte selbst prüfen (content:validate) – bei einem einzigen blockierenden Fehler wird NICHTS
 *    eingespielt.
 * 2. Einspiel-Paket bauen: nur `published`, je Einheit einer Vorlage `estimated_minutes`
 *    (estimateSessionMinutes aus packages/core).
 * 3. Schutz vor Massen-Archivierung: Würde der Lauf mehr als 50 % der bisher in der Datenbank freigegebenen
 *    Übungen oder Vorlagen (je Inhaltsart) auf `archived` setzen, bricht er ab (Exit 1, nichts eingespielt) –
 *    außer der Workflow wurde per Hand mit `allow_mass_archive: true` gestartet.
 * 4. `seed_content(p_content)` per Supabase-Service-Key aufrufen (eine Transaktion, idempotent).
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
  /**
   * true = Massen-Archivierung ausdrücklich erlaubt (Workflow-Eingabe `allow_mass_archive`, nur bei
   * „Run workflow“ per Hand). Standard false.
   */
  readonly allowMassArchive?: boolean;
}

/**
 * Höchstanteil des freigegebenen DB-Bestands (je Inhaltsart), den ein Lauf ohne ausdrückliche Erlaubnis
 * archivieren darf (Wächter-Hinweis Etappe B). Schützt z. B. vor einem versehentlich geleerten `content/`.
 */
export const MASS_ARCHIVE_MAX_SHARE = 0.5;

/** IDs, die in der Datenbank derzeit `published` sind. */
export interface PublishedIds {
  readonly exercises: readonly string[];
  readonly plan_templates: readonly string[];
}

export interface MassArchiveFinding {
  readonly table: keyof PublishedIds;
  readonly published: number;
  readonly wouldArchive: readonly string[];
}

/**
 * Welche bisher freigegebenen Inhalte würde der Lauf archivieren (seed_content setzt alles auf `archived`,
 * was freigegeben ist, aber nicht mehr im Paket steht)? Liefert nur Inhaltsarten über der 50-%-Grenze.
 */
export function findMassArchive(current: PublishedIds, pkg: SeedPackage): MassArchiveFinding[] {
  const next: Record<keyof PublishedIds, Set<string>> = {
    exercises: new Set(pkg.exercises.map((exercise) => exercise.id)),
    plan_templates: new Set(pkg.plan_templates.map((template) => template.id)),
  };
  const findings: MassArchiveFinding[] = [];
  for (const table of ['exercises', 'plan_templates'] as const) {
    const published = [...new Set(current[table])];
    const wouldArchive = published.filter((id) => !next[table].has(id)).sort();
    if (published.length > 0 && wouldArchive.length / published.length > MASS_ARCHIVE_MAX_SHARE) {
      findings.push({ table, published: published.length, wouldArchive });
    }
  }
  return findings;
}

export type SeedFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface SeedResult {
  readonly exitCode: number;
  readonly status: 'blocked' | 'skipped' | 'seeded' | 'failed' | 'mass_archive_blocked';
  readonly markdown: string;
  readonly package?: SeedPackage;
}

/** Legacy-Schlüssel (`service_role`) sind JWTs; neue Secret Keys (`sb_secret_…`) nur im `apikey`-Header. */
function authHeaders(secretKey: string): Record<string, string> {
  return secretKey.startsWith('eyJ')
    ? { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
    : { apikey: secretKey };
}

interface SupabaseAccess {
  readonly url: string;
  readonly secretKey: string;
}

/** Basis-Adresse; nur https (außer lokal). */
function supabaseBase(url: string): URL {
  const base = new URL(url);
  if (
    base.protocol !== 'https:' &&
    base.hostname !== 'localhost' &&
    base.hostname !== '127.0.0.1'
  ) {
    throw new Error('SUPABASE_URL muss mit https:// beginnen.');
  }
  return base;
}

/** Liest die IDs aller derzeit freigegebenen Übungen und Vorlagen (Service-Key, nur IDs). */
export async function fetchPublishedIds(
  env: SupabaseAccess,
  fetchImpl: SeedFetch,
): Promise<PublishedIds> {
  const base = supabaseBase(env.url);
  const read = async (table: keyof PublishedIds): Promise<string[]> => {
    const endpoint = new URL(`/rest/v1/${table}`, base);
    endpoint.searchParams.set('select', 'id');
    endpoint.searchParams.set('status', 'eq.published');
    const response = await fetchImpl(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders(env.secretKey) },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Bestand ${table} nicht lesbar: HTTP ${response.status} – ${text.slice(0, 300)}`,
      );
    }
    const rows = JSON.parse(text) as unknown;
    if (
      !Array.isArray(rows) ||
      !rows.every((row) => typeof (row as { id?: unknown })?.id === 'string')
    ) {
      throw new Error(`Bestand ${table}: unerwartete Antwort.`);
    }
    return rows.map((row) => (row as { id: string }).id);
  };
  return { exercises: await read('exercises'), plan_templates: await read('plan_templates') };
}

const TABLE_DE: Record<keyof PublishedIds, string> = {
  exercises: 'Übungen',
  plan_templates: 'Plan-Vorlagen',
};

function massArchiveMarkdown(findings: readonly MassArchiveFinding[]): string {
  return [
    '### ⚠️ content-seed abgebrochen – zu viele Inhalte würden zurückgezogen, nichts eingespielt',
    '',
    `Dieser Lauf würde mehr als ${MASS_ARCHIVE_MAX_SHARE * 100} % der bisher freigegebenen Inhalte auf „archived“ setzen:`,
    '',
    ...findings.map((finding) => {
      const ids = finding.wouldArchive.slice(0, 50).map((id) => `\`${id}\``);
      const more =
        finding.wouldArchive.length > 50 ? ` … (+${finding.wouldArchive.length - 50})` : '';
      return `- **${TABLE_DE[finding.table]}:** ${finding.wouldArchive.length} von ${finding.published} – ${ids.join(', ')}${more}`;
    }),
    '',
    'Das passiert z. B., wenn Inhaltsdateien versehentlich gelöscht oder auf „draft“ gesetzt wurden. Bitte prüfen.',
    'Ist das wirklich gewollt: GitHub-App → **Actions → content-seed → Run workflow** → Häkchen',
    '**allow_mass_archive** setzen → **Run workflow**.',
    '',
  ].join('\n');
}

/** Ruft `public.seed_content` über die REST-Schnittstelle (PostgREST) auf. */
export async function callSeedContent(
  env: SupabaseAccess,
  pkg: SeedPackage,
  fetchImpl: SeedFetch,
): Promise<unknown> {
  const base = supabaseBase(env.url);
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
  const fetchImpl: SeedFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  try {
    const current = await fetchPublishedIds({ url, secretKey }, fetchImpl);
    const findings = findMassArchive(current, pkg);
    if (findings.length > 0) {
      if (options.env.allowMassArchive !== true) {
        return {
          exitCode: 1,
          status: 'mass_archive_blocked',
          package: pkg,
          markdown: massArchiveMarkdown(findings),
        };
      }
      console.warn(
        `content-seed: Massen-Archivierung ausdrücklich erlaubt (allow_mass_archive) – ${findings
          .map((f) => `${f.wouldArchive.length}/${f.published} ${TABLE_DE[f.table]}`)
          .join(', ')}.`,
      );
    }
    const response = await callSeedContent({ url, secretKey }, pkg, fetchImpl);
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
