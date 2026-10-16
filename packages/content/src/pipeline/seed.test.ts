import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type ContentValidationResult,
  estimateSessionMinutes,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateRepository } from '../validate';
import {
  buildNutritionSeedPackage,
  buildSeedPackage,
  fetchPublishedIds,
  fetchPublishedNutritionIds,
  findMassArchive,
  findNutritionMassArchive,
  NUTRITION_SEED_TABLES,
  type NutritionSeedPackage,
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
  nutrition: {
    published?: Partial<Record<string, string[]>>;
    missing?: boolean;
    body?: unknown;
    status?: number;
  } = {},
) {
  return vi.fn<SeedFetch>(async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/rpc/seed_content')) {
      return new Response(JSON.stringify(body), { status: seedStatus });
    }
    if (path.endsWith('/rpc/seed_nutrition_content')) {
      return new Response(JSON.stringify(nutrition.body ?? { archived: {} }), {
        status: nutrition.status ?? 200,
      });
    }
    const nutritionTable = Object.values(NUTRITION_SEED_TABLES).find((t) =>
      path.endsWith(`/rest/v1/${t}`),
    );
    if (nutritionTable !== undefined) {
      if (nutrition.missing === true) {
        return new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 });
      }
      return new Response(
        JSON.stringify((nutrition.published?.[nutritionTable] ?? []).map((id) => ({ id }))),
        { status: 200 },
      );
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
    expect(readUrl).toBe(
      'https://abc.supabase.co/rest/v1/exercises?select=id&status=eq.published&order=id.asc&limit=1000&offset=0',
    );
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

// ---------------------------------------------------------------------------------------------------------
// Ernährung (Etappe N7 Teil 2): nur freigegeben UND fachlich geprüft, Verweise im Paket, Schutz, eigene Funktion
// ---------------------------------------------------------------------------------------------------------

/** Beispiel-Bestand (Testwerte) – alles freigegeben und geprüft, außer den genannten IDs. */
function nutritionResult(
  options: { notExpert?: string[]; draft?: string[] } = {},
): ContentValidationResult {
  const demo = demoNutritionContent();
  const result = validateContent(demo.files, { nutritionCatalog: demo.catalog });
  const release = <T extends { id: string; status: string; meta: object }>(item: T): T =>
    ({
      ...item,
      status: options.draft?.includes(item.id) ? 'draft' : 'published',
      meta: {
        ...item.meta,
        expert_reviewed: !(options.notExpert ?? []).includes(item.id),
        reviewed_by: 'KT',
        reviewed_at: '2026-10-15',
        ...('catalog_reviewed_by' in item.meta
          ? { catalog_reviewed_by: 'KT', catalog_reviewed_at: '2026-10-15' }
          : {}),
      },
    }) as T;
  return {
    ...result,
    foods: result.foods.map(release),
    recipes: result.recipes.map(release),
    substitutions: result.substitutions.map(release),
    packageSizes: result.packageSizes.map(release),
    mealPrepPlans: result.mealPrepPlans.map(release),
    guides: result.guides.map(release),
  };
}

describe('Ernährungs-Paket (N7 Teil 2)', () => {
  it('alles freigegeben und geprüft → alles im Paket, nichts wartet', () => {
    const result = nutritionResult();
    const { package: pkg, waiting } = buildNutritionSeedPackage(result);
    expect(waiting).toEqual([]);
    expect(pkg.foods).toHaveLength(result.foods.length);
    expect(pkg.recipes).toHaveLength(result.recipes.length);
    expect(pkg.ingredient_substitutions).toHaveLength(result.substitutions.length);
    expect(pkg.package_sizes).toHaveLength(result.packageSizes.length);
    expect(pkg.meal_prep_plans).toHaveLength(result.mealPrepPlans.length);
    expect(pkg.guides).toHaveLength(result.guides.length);
    // Inhalte unverändert (data = Datei, Wächter N2d K9).
    expect(pkg.recipes[0]).toEqual(result.recipes[0]);
  });

  it('Entwürfe zählen gar nicht; ohne Fachprüfung wartet der Inhalt – und alles, was darauf verweist', () => {
    const base = nutritionResult();
    const recipe = base.recipes.find((r) =>
      base.mealPrepPlans.some((p) => p.recipe_ids.includes(r.id)),
    );
    if (!recipe) throw new Error('Rezept im Meal-Prep-Plan erwartet');
    const food = recipe.ingredients[0]!.food_id;
    const result = nutritionResult({ notExpert: [food], draft: [base.guides[0]!.id] });
    const { package: pkg, waiting } = buildNutritionSeedPackage(result);
    expect(pkg.foods.map((f) => f.id)).not.toContain(food);
    expect(waiting).toContainEqual({ kind: 'foods', id: food, reason: 'not_expert_reviewed' });
    expect(
      pkg.recipes.every((r) =>
        r.ingredients.every((i) => pkg.foods.some((f) => f.id === i.food_id)),
      ),
    ).toBe(true);
    expect(waiting).toContainEqual({ kind: 'recipes', id: recipe.id, reason: 'reference_waiting' });
    expect(
      pkg.meal_prep_plans.every((p) =>
        p.recipe_ids.every((id) => pkg.recipes.some((r) => r.id === id)),
      ),
    ).toBe(true);
    expect(
      pkg.ingredient_substitutions.every(
        (x) =>
          pkg.foods.some((f) => f.id === x.food_id) &&
          pkg.foods.some((f) => f.id === x.substitute_food_id),
      ),
    ).toBe(true);
    expect(pkg.package_sizes.every((x) => pkg.foods.some((f) => f.id === x.food_id))).toBe(true);
    // Ersatzprodukte müssen mitkommen.
    expect(
      pkg.foods.every((f) => f.substitutes.every((x) => pkg.foods.some((g) => g.id === x.food_id))),
    ).toBe(true);
    // Der Entwurf ist weder im Paket noch in der Warteliste.
    expect(pkg.guides.map((g) => g.id)).not.toContain(base.guides[0]!.id);
    expect(waiting.some((w) => w.id === base.guides[0]!.id)).toBe(false);
  });

  it('ohne Katalog-Prüfung bzw. Prüfvermerk → wartet', () => {
    const result = nutritionResult();
    const food = result.foods[0]!;
    const entry = result.packageSizes[0]!;
    const changed: ContentValidationResult = {
      ...result,
      foods: result.foods.map((f) =>
        f.id === food.id
          ? { ...f, meta: { ...f.meta, catalog_reviewed_by: null, catalog_reviewed_at: null } }
          : f,
      ),
      packageSizes: result.packageSizes.map((x) =>
        x.id === entry.id ? { ...x, meta: { ...x.meta, reviewed_by: null, reviewed_at: null } } : x,
      ),
    };
    const { waiting } = buildNutritionSeedPackage(changed);
    expect(waiting).toContainEqual({ kind: 'foods', id: food.id, reason: 'not_catalog_reviewed' });
    expect(waiting).toContainEqual({ kind: 'package_sizes', id: entry.id, reason: 'not_reviewed' });
  });

  it('findNutritionMassArchive: je Inhaltsart über 50 % → Befund', () => {
    const empty = Object.fromEntries(
      Object.keys(NUTRITION_SEED_TABLES).map((k) => [k, []]),
    ) as unknown as NutritionSeedPackage;
    const current = {
      foods: ['a', 'b'],
      recipes: ['r1', 'r2', 'r3'],
      ingredient_substitutions: [],
      package_sizes: [],
      meal_prep_plans: [],
      guides: [],
    };
    const pkg = {
      ...empty,
      foods: [{ id: 'a' }],
      recipes: [{ id: 'r1' }],
    } as unknown as NutritionSeedPackage;
    expect(findNutritionMassArchive(current, pkg)).toEqual([
      { table: 'recipes', published: 3, wouldArchive: ['r2', 'r3'] },
    ]);
  });
});

describe('content-seed: Ernährung (N7 Teil 2)', () => {
  it('ruft nach seed_content auch seed_nutrition_content auf (leeres Paket, solange nichts geprüft ist)', async () => {
    const r = repo();
    const fetchImpl = okFetch();
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.status).toBe('seeded');
    const calls = fetchImpl.mock.calls.map(([url]) => new URL(url).pathname);
    expect(calls.indexOf('/rest/v1/rpc/seed_nutrition_content')).toBeGreaterThan(
      calls.indexOf('/rest/v1/rpc/seed_content'),
    );
    const call = fetchImpl.mock.calls.find(([url]) => url.endsWith('/rpc/seed_nutrition_content'))!;
    const body = JSON.parse(String(call[1].body)) as { p_content: Record<string, unknown[]> };
    expect(Object.keys(body.p_content).sort()).toEqual(Object.keys(NUTRITION_SEED_TABLES).sort());
    expect(Object.values(body.p_content).every((list) => list.length === 0)).toBe(true);
    expect(result.markdown).toContain('Ernährung eingespielt: 0 Lebensmittel, 0 Rezepte');
  });

  it('Tabellen gibt es noch nicht (vor db-migrate) → Ernährung mit Hinweis übersprungen, Übungen eingespielt', async () => {
    const r = repo();
    const fetchImpl = okFetch(undefined, {}, 200, { missing: true });
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.status).toBe('seeded');
    expect(result.markdown).toContain('Ernährung übersprungen');
    expect(fetchImpl.mock.calls.some(([url]) => url.endsWith('/rpc/seed_nutrition_content'))).toBe(
      false,
    );
    expect(seedCalls(fetchImpl)).toHaveLength(1);
  });

  it('würde mehr als die Hälfte der freigegebenen Rezepte archivieren → nichts eingespielt (auch keine Übungen)', async () => {
    const r = repo();
    const fetchImpl = okFetch(undefined, {}, 200, { published: { recipes: ['r1', 'r2'] } });
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.status).toBe('mass_archive_blocked');
    expect(result.markdown).toContain('Rezepte');
    expect(seedCalls(fetchImpl)).toHaveLength(0);
    expect(fetchImpl.mock.calls.some(([url]) => url.endsWith('/rpc/seed_nutrition_content'))).toBe(
      false,
    );
  });

  it('Fehler von seed_nutrition_content → rot mit Meldung (nur Inhalts-IDs)', async () => {
    const r = repo();
    const fetchImpl = okFetch(undefined, {}, 200, {
      status: 400,
      body: { message: 'Inhalt x ist nicht fachlich geprüft.' },
    });
    const result = await runSeed({ repoRoot: r.root, env: SUPABASE, fetchImpl });
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('failed');
    expect(result.markdown).toContain('Ernährung nicht eingespielt');
    expect(result.markdown).toContain('nicht fachlich geprüft');
  });
});

describe('Bestand seitenweise lesen (Wächter N7 Teil 2 N2)', () => {
  const access = { url: 'https://abc.supabase.co', secretKey: 'sb_secret_test' };
  const ids = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(5, '0')}`);
  /** PostgREST-Nachbau: höchstens `cap` Zeilen je Antwort, Content-Range mit Gesamtzahl (oder ohne). */
  const pagedFetch = (all: Record<string, string[]>, cap: number, withRange = true) =>
    vi.fn(async (url: string) => {
      const u = new URL(url);
      const table = u.pathname.split('/').at(-1) ?? '';
      const rows = all[table];
      if (rows === undefined) return new Response('{"code":"PGRST205"}', { status: 404 });
      const offset = Number(u.searchParams.get('offset') ?? 0);
      const limit = Math.min(Number(u.searchParams.get('limit') ?? cap), cap);
      const page = rows.slice(offset, offset + limit);
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (withRange) {
        headers['content-range'] =
          page.length === 0
            ? `*/${rows.length}`
            : `${offset}-${offset + page.length - 1}/${rows.length}`;
      }
      return new Response(JSON.stringify(page.map((id) => ({ id }))), { status: 200, headers });
    });

  it('mehr als 1.000 freigegebene Einträge: alle IDs (auch wenn der Server je Seite weniger liefert)', async () => {
    const all = {
      exercises: ids(2500, 'ue'),
      plan_templates: ids(1000, 'pv'),
      foods: ids(1234, 'lm'),
      recipes: ids(3, 're'),
      ingredient_substitutions: [],
      food_package_sizes: ids(1001, 'pg'),
      meal_prep_plans: ids(2, 'mp'),
      guides: ids(1000, 'rg'),
    };
    const one = pagedFetch(all, 1000);
    const read = await fetchPublishedIds(access, one);
    expect(read.exercises).toEqual(all.exercises);
    expect(read.plan_templates).toEqual(all.plan_templates);
    // Server kappt bei 300 Zeilen: weiter bis zur Gesamtzahl aus Content-Range.
    const capped = pagedFetch(all, 300);
    const nutrition = await fetchPublishedNutritionIds(access, capped);
    expect(nutrition?.foods).toEqual(all.foods);
    expect(nutrition?.package_sizes).toEqual(all.food_package_sizes);
    expect(nutrition?.ingredient_substitutions).toEqual([]);
    expect(nutrition?.guides).toEqual(all.guides);
    // Ohne Content-Range: bis zur ersten kürzeren Seite.
    const plain = await fetchPublishedIds(access, pagedFetch(all, 1000, false));
    expect(plain.exercises).toHaveLength(2500);
  });

  it('Ernährungs-Tabellen fehlen (vor db-migrate) → null', async () => {
    expect(
      await fetchPublishedNutritionIds(access, pagedFetch({ exercises: [] }, 1000)),
    ).toBeNull();
  });
});
