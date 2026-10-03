import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { estimateSessionMinutes } from '@fitnessapp/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateRepository } from '../validate';
import {
  buildSeedPackage,
  findMassArchive,
  type PublishedIds,
  runSeed,
  type SeedFetch,
  type SeedPackage,
} from './seed';
import { createTempRepo, type TempRepo } from './test-helpers';

const repos: TempRepo[] = [];
afterEach(() => {
  while (repos.length > 0) {
    repos.pop()!.cleanup();
  }
});

function repo(): TempRepo {
  const created = createTempRepo();
  repos.push(created);
  return created;
}

function edit(r: TempRepo, path: string, change: (data: Record<string, unknown>) => void) {
  const full = join(r.root, path);
  const data = JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>;
  change(data);
  writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
}

function publish(data: Record<string, unknown>) {
  data.status = 'published';
  data.meta = { ...(data.meta as object), reviewed_by: 'KT', reviewed_at: '2026-10-03' };
}

/**
 * Gefälschte Supabase-REST-Schnittstelle: GET exercises/plan_templates liefert den freigegebenen Bestand,
 * POST rpc/seed_content die Antwort der Datenbank-Funktion.
 */
function okFetch(
  body: unknown = { exercises: 1, plan_templates: 0 },
  published: Partial<PublishedIds> = {},
  seedStatus = 200,
) {
  return vi.fn<SeedFetch>(async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/rpc/seed_content')) {
      return new Response(JSON.stringify(body), { status: seedStatus });
    }
    const table = path.endsWith('/plan_templates') ? 'plan_templates' : 'exercises';
    return new Response(JSON.stringify((published[table] ?? []).map((id) => ({ id }))), {
      status: 200,
    });
  });
}

function seedCalls(fetchImpl: ReturnType<typeof okFetch>) {
  return fetchImpl.mock.calls.filter(([url]) => url.endsWith('/rpc/seed_content'));
}

const SUPABASE = { url: 'https://abc.supabase.co', secretKey: 'sb_secret_test' };

describe('Einspiel-Paket', () => {
  it('enthält nur freigegebene Inhalte; Einheiten bekommen estimated_minutes', () => {
    const r = repo();
    edit(r, 'content/exercises/goblet-kniebeuge.json', publish);
    edit(r, 'content/exercises/liegestuetz.json', (data) => {
      publish(data);
      data.status = 'archived';
    });
    const pkg = buildSeedPackage(validateRepository({ cwd: r.root }).result);
    expect(pkg.exercises.map((exercise) => exercise.id)).toEqual(['goblet-kniebeuge']);
    expect(pkg.plan_templates).toEqual([]);
  });

  it('berechnet die Dauer je Einheit mit estimateSessionMinutes', () => {
    const r = repo();
    const report = validateRepository({ cwd: r.root });
    const template = report.result.templates[0]!;
    const published = {
      ...report.result,
      templates: [{ ...template, status: 'published' as const }],
    };
    const pkg = buildSeedPackage(published);
    expect(pkg.plan_templates[0]!.sessions.map((s) => s.estimated_minutes)).toEqual(
      template.sessions.map((session) => estimateSessionMinutes(session)),
    );
    expect(
      pkg.plan_templates[0]!.sessions.every((s) => Number.isInteger(s.estimated_minutes)),
    ).toBe(true);
  });
});

describe('content-seed', () => {
  it('ohne Supabase-Secrets: prüft trotzdem alles und endet grün mit Hinweis', async () => {
    const r = repo();
    const fetchImpl = okFetch();
    const result = await runSeed({ repoRoot: r.root, env: {}, fetchImpl });
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('skipped');
    expect(result.markdown).toContain('übersprungen – Supabase fehlt');
    expect(result.markdown).toContain('0 Übungen, 0 Plan-Vorlagen');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('bei einem roten Fehler an einem freigegebenen Inhalt wird NICHTS eingespielt', async () => {
    const r = repo();
    // Freigegebene Vorlage mit Übungen im Entwurf → V3 rot.
    edit(r, 'content/plan-templates/fitness-einsteiger-3t-zuhause.json', publish);
    const fetchImpl = okFetch();
    const result = await runSeed({
      repoRoot: r.root,
      env: { url: 'https://abc.supabase.co', secretKey: 'sb_secret_test' },
      fetchImpl,
    });
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('blocked');
    expect(result.markdown).toContain('V3');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('auch Schema-Fehler an Entwürfen blockieren das Einspielen', async () => {
    const r = repo();
    edit(r, 'content/exercises/dead-bug.json', (data) => {
      data.difficulty = 9;
    });
    const fetchImpl = okFetch();
    const result = await runSeed({
      repoRoot: r.root,
      env: { url: 'https://abc.supabase.co', secretKey: 'sb_secret_test' },
      fetchImpl,
    });
    expect(result.status).toBe('blocked');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ruft seed_content mit dem Paket auf (neuer Secret Key nur im apikey-Header)', async () => {
    const r = repo();
    edit(r, 'content/exercises/goblet-kniebeuge.json', publish);
    const fetchImpl = okFetch({
      exercises: 1,
      plan_templates: 0,
      archived_exercises: 2,
      archived_plan_templates: 0,
    });
    const result = await runSeed({
      repoRoot: r.root,
      env: { url: 'https://abc.supabase.co/', secretKey: 'sb_secret_test' },
      fetchImpl,
    });
    expect(result.status).toBe('seeded');
    expect(result.markdown).toContain('Eingespielt: 1 Übungen, 0 Plan-Vorlagen');
    expect(result.markdown).toContain('Zurückgezogen (archived): 2 Übungen');
    // Vorher wird der freigegebene Bestand gelesen (nur IDs), dann genau einmal seed_content.
    const [readUrl, readInit] = fetchImpl.mock.calls[0]!;
    expect(readUrl).toBe('https://abc.supabase.co/rest/v1/exercises?select=id&status=eq.published');
    expect(readInit.method).toBe('GET');
    expect(seedCalls(fetchImpl)).toHaveLength(1);
    const [url, init] = seedCalls(fetchImpl)[0]!;
    expect(url).toBe('https://abc.supabase.co/rest/v1/rpc/seed_content');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_test');
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String(init.body)) as { p_content: { exercises: { id: string }[] } };
    expect(body.p_content.exercises.map((exercise) => exercise.id)).toEqual(['goblet-kniebeuge']);
  });

  it('alter service_role-Schlüssel (JWT) zusätzlich als Bearer', async () => {
    const r = repo();
    const fetchImpl = okFetch();
    await runSeed({
      repoRoot: r.root,
      env: { url: 'https://abc.supabase.co', secretKey: 'eyJhbGciOi.test.sig' },
      fetchImpl,
    });
    const headers = fetchImpl.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer eyJhbGciOi.test.sig');
  });

  it('Fehler der Datenbank → rot, mit Meldung (nur Inhalts-IDs)', async () => {
    const r = repo();
    const fetchImpl = okFetch(
      { message: 'Vorlage x enthält eine nicht freigegebene Übung.' },
      {},
      400,
    );
    const result = await runSeed({
      repoRoot: r.root,
      env: { url: 'https://abc.supabase.co', secretKey: 'sb_secret_test' },
      fetchImpl,
    });
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('failed');
    expect(result.markdown).toContain('HTTP 400');
    expect(result.markdown).toContain('nicht freigegebene Übung');
  });

  it('lehnt unverschlüsselte Adressen ab', async () => {
    const r = repo();
    const fetchImpl = okFetch();
    const result = await runSeed({
      repoRoot: r.root,
      env: { url: 'http://abc.supabase.co', secretKey: 'sb_secret_test' },
      fetchImpl,
    });
    expect(result.status).toBe('failed');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('content-seed: Schutz vor Massen-Archivierung', () => {
  const pkg = (exercises: string[], templates: string[] = []): SeedPackage =>
    ({
      exercises: exercises.map((id) => ({ id })),
      plan_templates: templates.map((id) => ({ id })),
    }) as unknown as SeedPackage;

  it('findMassArchive: über 50 % je Inhaltsart → Befund, genau 50 % noch erlaubt', () => {
    const current = { exercises: ['a', 'b', 'c', 'd'], plan_templates: ['t1', 't2'] };
    // 2 von 4 Übungen (50 %) und 1 von 2 Vorlagen (50 %) → erlaubt.
    expect(findMassArchive(current, pkg(['a', 'b'], ['t1']))).toEqual([]);
    // 3 von 4 Übungen → Befund; Vorlagen unverändert.
    expect(findMassArchive(current, pkg(['a'], ['t1', 't2']))).toEqual([
      { table: 'exercises', published: 4, wouldArchive: ['b', 'c', 'd'] },
    ]);
    // Alle Vorlagen weg → Befund auch bei vollständigen Übungen.
    expect(findMassArchive(current, pkg(['a', 'b', 'c', 'd'], []))).toMatchObject([
      { table: 'plan_templates', published: 2, wouldArchive: ['t1', 't2'] },
    ]);
    // Leere Datenbank (erster Lauf) → nie ein Befund.
    expect(findMassArchive({ exercises: [], plan_templates: [] }, pkg([]))).toEqual([]);
    // Neue Inhalte zählen nicht als Archivierung.
    expect(findMassArchive({ exercises: ['a'], plan_templates: [] }, pkg(['a', 'x']))).toEqual([]);
  });

  it('würde mehr als die Hälfte archivieren → Exit 1, Warnung, seed_content wird NICHT aufgerufen', async () => {
    const r = repo();
    edit(r, 'content/exercises/goblet-kniebeuge.json', publish);
    const fetchImpl = okFetch(undefined, {
      exercises: ['goblet-kniebeuge', 'liegestuetz', 'dead-bug'],
    });
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('mass_archive_blocked');
    expect(result.markdown).toContain('nichts eingespielt');
    expect(result.markdown).toContain('2 von 3');
    expect(result.markdown).toContain('`dead-bug`, `liegestuetz`');
    expect(result.markdown).toContain('allow_mass_archive');
    expect(seedCalls(fetchImpl)).toHaveLength(0);
  });

  it('mit allow_mass_archive (nur per Hand) wird trotzdem eingespielt', async () => {
    const r = repo();
    const fetchImpl = okFetch(
      { exercises: 0, plan_templates: 0, archived_exercises: 2 },
      { exercises: ['liegestuetz', 'dead-bug'] },
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await runSeed({
      repoRoot: r.root,
      env: { ...SUPABASE, allowMassArchive: true },
      fetchImpl,
    });
    warn.mockRestore();
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('seeded');
    expect(seedCalls(fetchImpl)).toHaveLength(1);
  });

  it('höchstens die Hälfte → normal einspielen', async () => {
    const r = repo();
    edit(r, 'content/exercises/goblet-kniebeuge.json', publish);
    const fetchImpl = okFetch(undefined, { exercises: ['goblet-kniebeuge', 'liegestuetz'] });
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.status).toBe('seeded');
    expect(seedCalls(fetchImpl)).toHaveLength(1);
  });

  it('Bestand nicht lesbar → rot, nichts eingespielt', async () => {
    const r = repo();
    const fetchImpl = vi.fn<SeedFetch>(async () => new Response('kaputt', { status: 500 }));
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('failed');
    expect(result.markdown).toContain('nicht lesbar');
    expect(fetchImpl.mock.calls.every(([url]) => !url.endsWith('/rpc/seed_content'))).toBe(true);
  });
});
