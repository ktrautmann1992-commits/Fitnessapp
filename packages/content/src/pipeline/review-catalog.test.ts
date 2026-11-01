import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CATALOG_CHECKLIST, type Food } from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import { catalogReviewChangeErrors } from '../foods/catalog-review-guard';
import type { GitHubApi } from '../foods/github-api';
import { runContentReview } from './review-ids';
import { CATALOG_REVIEW_BRANCH_PREFIX, catalogReviewRow, runCatalogReview } from './review-catalog';
import { createTempRepo, fakeTools, REAL_REPO_ROOT, type TempRepo } from './test-helpers';

// content-review Art „katalog“ (Katalog geprüft, R19/R2-K6) gegen ein Test-Repository.
// ACHTUNG: TESTWERTE im Quellauszug, keine BLS-Daten.

const HEADER = [
  'BLS-Schlüssel',
  'Bezeichnung',
  'ENERCC [kcal/100g]',
  'PROT625 [g/100g]',
  'CHO [g/100g]',
  'SUGAR [g/100g]',
  'FAT [g/100g]',
  'FASAT [g/100g]',
  'FIBT [g/100g]',
  'NACL [g/100g]',
].join(',');
const EXTRACT = `${HEADER}\nT0001,Haferflocken,370,13.5,58.7,0.7,7,1.2,10,0.01\nT0002,Ei,137,12.5,0.7,0.7,9.3,2.7,0,0.35\nT0003,Apfel,54,0.3,11.4,10.3,0.1,0,2,0\n`;

const META = {
  origin: 'claude_session',
  model: 'test',
  batch_id: null,
  created_on: '2026-10-11',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

function food(overrides: Record<string, unknown> = {}) {
  return {
    id: 'haferflocken',
    version: 1,
    status: 'draft',
    name_de: 'Haferflocken',
    aliases_de: [],
    shopping_category: 'cereal_breakfast',
    pantry: true,
    nutrients_per_100g: {
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    },
    units: {},
    groups: ['gluten'],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    source: {
      db: 'bls',
      version: '4.0',
      ref: 'T0001',
      name: 'Haferflocken',
      category: 'cereal_products',
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-11',
    },
    meta: { ...META, catalog_reviewed_by: null, catalog_reviewed_at: null },
    ...overrides,
  };
}

/** Ei mit falschem Brennwert (≠ Quellauszug) → roter Befund R17. */
function brokenEgg() {
  const base = food();
  return {
    ...base,
    id: 'huehnerei',
    name_de: 'Ei',
    shopping_category: 'chilled_dairy_eggs',
    pantry: false,
    nutrients_per_100g: {
      kcal: 160,
      protein_g: 12.5,
      carbs_g: 0.7,
      sugar_g: 0.7,
      fat_g: 9.3,
      sat_fat_g: 2.7,
      fiber_g: 0,
      salt_g: 0.35,
    },
    units: { piece_g: 60 },
    groups: ['eggs'],
    animal: ['egg'],
    max_fridge_days: 2,
    freezable: false,
    source: { ...base.source, ref: 'T0002', name: 'Ei', category: 'eggs' },
  };
}

function apple() {
  const base = food();
  return {
    ...base,
    id: 'apfel',
    name_de: 'Apfel',
    shopping_category: 'fruit_vegetables',
    pantry: false,
    nutrients_per_100g: {
      kcal: 54,
      protein_g: 0.3,
      carbs_g: 11.4,
      sugar_g: 10.3,
      fat_g: 0.1,
      sat_fat_g: 0,
      fiber_g: 2,
      salt_g: 0,
    },
    groups: [],
    source: { ...base.source, ref: 'T0003', name: 'Apfel', category: 'fruit' },
  };
}

function recipe(id: string, foodId: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    version: 1,
    status: 'draft',
    title_de: 'Haferbrei',
    description_de: 'Haferflocken mit Wasser, schnell gemacht.',
    meal_types: ['breakfast'],
    training_tags: [],
    servings: 1,
    ingredients: [{ food_id: foodId, amount: 60, unit: 'g', optional: false, scales: true }],
    steps_de: ['Haferflocken mit Wasser aufkochen.'],
    prep_minutes: 2,
    cook_minutes: 3,
    no_cook: false,
    meal_prep: { suitable: true, fridge_days: 3, freezable: true },
    equipment_de: ['Topf'],
    declared_per_serving: { kcal: 222, protein_g: 8.1, carbs_g: 35.2, fat_g: 4.2 },
    declared_diet: 'vegan',
    declared_allergens: ['gluten'],
    contains_pork: false,
    declared_pregnancy_caution: false,
    meta: META,
    ...extra,
  };
}

function write(repo: TempRepo, path: string, data: unknown) {
  const full = join(repo.root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
}

function setup(): TempRepo {
  const repo = createTempRepo({ withContent: false });
  const full = join(repo.root, 'content/sources/bls/4.0/extract.csv');
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, EXTRACT);
  write(repo, 'content/foods/allergen-expectations.json', {
    haferflocken: ['gluten'],
    huehnerei: ['eggs'],
    apfel: [],
  });
  write(repo, 'content/foods/haferflocken.json', food());
  write(repo, 'content/foods/huehnerei.json', brokenEgg());
  write(repo, 'content/foods/apfel.json', apple());
  write(repo, 'content/recipes/haferbrei.json', recipe('haferbrei', 'haferflocken'));
  write(
    repo,
    'content/recipes/eierbrei.json',
    recipe('eierbrei', 'huehnerei', {
      ingredients: [
        {
          food_id: 'huehnerei',
          amount: 60,
          unit: 'g',
          optional: false,
          scales: true,
          heated: true,
        },
      ],
      declared_diet: 'vegetarian',
      declared_allergens: ['eggs'],
    }),
  );
  repo.git(['add', '-A']);
  repo.git(['commit', '--quiet', '-m', 'Ernährung']);
  repo.git(['push', '--quiet', 'origin', 'main']);
  return repo;
}

/** Gefälschte GitHub-API: hält die Dateien des Commits fest, PR-Text und gestartete Workflows. */
function fakeApi(mainSha: string) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const blobs: string[] = [];
  const commitSha = 'c'.repeat(40);
  const api: GitHubApi = {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      calls.push({ method, path, body });
      if (path.startsWith('/git/ref/heads/')) return { object: { sha: mainSha } } as T;
      if (path.startsWith('/git/commits/')) return { tree: { sha: 't' } } as T;
      if (path === '/git/blobs') {
        blobs.push(Buffer.from((body as { content: string }).content, 'base64').toString('utf8'));
        return { sha: `blob${blobs.length}` } as T;
      }
      if (path === '/git/trees') {
        for (const entry of (body as { tree: { content?: string }[] }).tree) {
          if (entry.content !== undefined) blobs.push(entry.content);
        }
        return { sha: 'tree' } as T;
      }
      if (path === '/git/commits') return { sha: commitSha } as T;
      if (path === '/git/refs') return {} as T;
      if (path === `/commits/${commitSha}`) {
        return {
          author: { login: 'github-actions[bot]' },
          commit: { verification: { verified: true } },
        } as T;
      }
      if (path === '/pulls') return { html_url: 'https://github.com/x/y/pull/12' } as T;
      return {} as T;
    },
  };
  return { api, calls, blobs };
}

const NOW = () => new Date('2026-10-20T10:00:00Z');
let repo: TempRepo | undefined;
afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

describe('content-review Art „katalog“ (Katalog geprüft, R19/R2-K6)', () => {
  it('„rezepte“: Lebensmittel aus Rezept-Entwürfen ohne roten Befund → verifizierter Commit nur mit Prüf-Feldern, PR mit Checkliste', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const mainSha = repo.git(['rev-parse', 'HEAD']).trim();
    const { api, calls, blobs } = fakeApi(mainSha);
    const result = await runContentReview(
      {
        kind: 'katalog',
        ids: 'Rezepte',
        status: 'published',
        reviewer: 'KT',
        category: 'schnell',
        expertReviewed: 'true',
        confirmAssumptions: 'false',
      },
      { repoRoot: repo.root, tools, now: NOW, api, runId: '815' },
    );
    expect(result.exitCode, result.markdown).toBe(0);
    expect(result.branch).toBe(`${CATALOG_REVIEW_BRANCH_PREFIX}815`);
    expect(result.prUrl).toBe('https://github.com/x/y/pull/12');
    // Hinweise zu Eingaben ohne Wirkung.
    expect(result.markdown).toContain('Kategorie „schnell“ hat bei Art „katalog“ keine Wirkung');
    expect(result.markdown).toContain('„fachlich geprüft“ wirkt bei Art „katalog“ nicht');

    // Commit: nur haferflocken (Ei hat roten Befund R17, Apfel steckt in keinem Rezept).
    const tree = calls.find((c) => c.path === '/git/trees')?.body as { tree: { path: string }[] };
    expect(tree.tree.map((t) => t.path)).toEqual(['content/foods/haferflocken.json']);
    const commit = calls.find((c) => c.path === '/git/commits')?.body as { parents: string[] };
    expect(commit.parents).toEqual([mainSha]);
    const refs = calls.find((c) => c.path === '/git/refs')?.body as { ref: string };
    expect(refs.ref).toBe('refs/heads/content-review/katalog-815');
    const written = JSON.parse(blobs[0]!) as Record<string, unknown>;
    expect(written).toMatchObject({
      status: 'published',
      version: 1,
      meta: {
        reviewed_by: 'KT',
        reviewed_at: '2026-10-20',
        catalog_reviewed_by: 'KT',
        catalog_reviewed_at: '2026-10-20',
        expert_reviewed: false,
      },
    });
    // Dieselbe Regel wie sources-integrity: nur erlaubte Felder geändert.
    const base = readFileSync(join(repo.root, 'content/foods/haferflocken.json'));
    expect(
      catalogReviewChangeErrors('content/foods/haferflocken.json', base, Buffer.from(blobs[0]!)),
    ).toEqual([]);
    // Arbeitsordner wieder sauber (nichts lokal committet).
    expect(repo.git(['status', '--porcelain']).trim()).toBe('');

    const pr = calls.find((c) => c.path === '/pulls')?.body as { body: string; title: string };
    expect(pr.title).toBe('Katalog geprüft: 1 Lebensmittel (KT)');
    for (const item of CATALOG_CHECKLIST) expect(pr.body).toContain(`- [ ] ${item}`);
    expect(pr.body).toContain('| `haferflocken` Haferflocken | T0001 „Haferflocken“ | gluten |');
    expect(pr.body).toContain('`huehnerei` Ei | rote Befunde: R17');
    expect(pr.body).not.toContain('`apfel`');
    expect(pr.body).toContain('So testest du es am Handy');
    expect(pr.body).toContain('genehmigt nie');
    const dispatched = calls
      .filter((c) => c.path.endsWith('/dispatches'))
      .map((c) => c.path.split('/')[3]);
    expect(dispatched).toEqual(['ci.yml', 'sources-integrity-main.yml']);
    // Nie selbst mergen oder genehmigen.
    expect(calls.some((c) => c.path.includes('/merge') || c.path.includes('/reviews'))).toBe(false);
    expect(tools.ghCalls).toEqual([]);
  });

  it('IDs einzeln: nur die genannten; unbekannte ID → Abbruch ohne Änderung', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const { api, calls } = fakeApi(repo.git(['rev-parse', 'HEAD']).trim());
    const deps = { repoRoot: repo.root, tools, now: NOW, api, runId: '815' };
    const unknown = await runCatalogReview(
      { ids: 'apfel, gibt-es-nicht', status: 'published', reviewer: 'KT' },
      deps,
    );
    expect(unknown.exitCode).toBe(1);
    expect(unknown.markdown).toContain('`gibt-es-nicht`');
    expect(calls).toEqual([]);

    const ok = await runCatalogReview({ ids: 'apfel', status: 'published', reviewer: 'KT' }, deps);
    expect(ok.exitCode, ok.markdown).toBe(0);
    const tree = calls.find((c) => c.path === '/git/trees')?.body as { tree: { path: string }[] };
    expect(tree.tree.map((t) => t.path)).toEqual(['content/foods/apfel.json']);
  });

  it('nichts setzbar (nur Lebensmittel mit rotem Befund) → kein Pull Request, Grund in der Zusammenfassung', async () => {
    repo = setup();
    const { api, calls } = fakeApi(repo.git(['rev-parse', 'HEAD']).trim());
    const result = await runCatalogReview(
      { ids: 'huehnerei', status: 'published', reviewer: 'KT' },
      { repoRoot: repo.root, tools: fakeTools(repo.root), now: NOW, api, runId: '815' },
    );
    expect(result.exitCode).toBe(0);
    expect(result.markdown).toContain('nichts zu setzen – kein Pull Request');
    expect(result.markdown).toContain('R17');
    expect(calls).toEqual([]);
  });

  it('falsche Eingaben (Status, Prüfer, IDs) und fehlende API → Abbruch ohne Commit', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const deps = { repoRoot: repo.root, tools, now: NOW };
    for (const input of [
      { ids: 'apfel', status: 'draft', reviewer: 'KT' },
      { ids: 'apfel', status: 'published', reviewer: 'K' },
      { ids: 'Apfel!', status: 'published', reviewer: 'KT' },
      { ids: '', status: 'published', reviewer: 'KT' },
    ]) {
      expect((await runCatalogReview(input, deps)).exitCode).toBe(1);
    }
    const noApi = await runCatalogReview(
      { ids: 'apfel', status: 'published', reviewer: 'KT' },
      deps,
    );
    expect(noApi.exitCode).toBe(1);
    expect(noApi.markdown).toContain('Kein GITHUB_TOKEN');
    expect(repo.git(['status', '--porcelain']).trim()).toBe('');
  });

  it('Tabellenzeile: Salz-Hinweis bei verarbeiteter Ware, Schwangerschaft fett', () => {
    const base = food() as unknown as Food;
    const row = catalogReviewRow({
      ...base,
      id: 'kochschinken',
      name_de: 'Kochschinken',
      pregnancy_caution: true,
      animal: ['meat'],
      meat_kind: ['pork'],
      source: { ...base.source, category: 'sausage_meat_products', name: 'Schinken | gekocht' },
    });
    expect(row).toContain('⚠️ prüfen');
    expect(row).toContain('**ja**');
    expect(row).toContain('pork');
    expect(row).toContain('Schinken \\| gekocht');
  });

  it('Workflow content-review: Art „katalog“ wählbar, GITHUB_TOKEN gesetzt; sources-integrity-main läuft auch für Katalog-Branches', () => {
    const yml = readFileSync(join(REAL_REPO_ROOT, '.github/workflows/content-review.yml'), 'utf8');
    const art = yml.split('art:')[1]?.split('default:')[0] ?? '';
    expect(art).toContain('- katalog');
    expect(yml).toMatch(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
    const integrity = readFileSync(
      join(REAL_REPO_ROOT, '.github/workflows/sources-integrity-main.yml'),
      'utf8',
    );
    expect(integrity).toContain("startsWith(github.ref, 'refs/heads/content-review/katalog-')");
  });
});
