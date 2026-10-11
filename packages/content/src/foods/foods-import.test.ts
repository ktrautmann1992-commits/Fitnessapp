/**
 * Ende-zu-Ende-Test des Workflows `foods-import` (ohne Netz): erfundene Test-Quelle, Arbeitsordner im Temp-
 * Verzeichnis, GitHub-API als Attrappe. Prüft: nur benötigte Zeilen unverändert im Auszug, Nährwerte nur aus
 * der Quelle, Commit nur über die API (verified), Branch foods-import/<run-id>, Pull Request mit Prüfsummen,
 * Zweitlauf ohne Änderung, Abbruch außerhalb von main.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { foodSchema } from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import { runFoodsImport, type FoodsImportDeps } from './foods-import';
import { BOT_LOGIN, type GitHubApi } from './github-api';
import { integrityDepsFromEnv } from './integrity-env';
import { checkSourcesIntegrity } from './integrity';
import type { FoodMapping, MappingItem } from './mapping';
import { sha256Hex } from './extract-source';
import { TEST_SOURCE, testOriginal } from './test-helpers';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function item(food_id: string, ref: string | null, extra: Partial<MappingItem> = {}): MappingItem {
  return {
    alpha5_id: food_id,
    food_id,
    alpha5_name: food_id,
    source: {
      db: 'bls',
      version: '4.0',
      ref,
      search: [food_id],
      state_de: 'roh',
      category: 'fruit',
    },
    name_de: food_id.charAt(0).toUpperCase() + food_id.slice(1),
    aliases_de: [],
    shopping_category: 'fruit_vegetables',
    pantry: false,
    units: {},
    groups: [],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    reason_de: 'Testzuordnung ohne Bedeutung.',
    ...extra,
  };
}

const MAPPING: FoodMapping = {
  format: 'alpha5-food-mapping',
  version: 1,
  status: 'unbestaetigt',
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  created_on: '2026-10-11',
  note_de: 'Testzuordnung (erfunden).',
  items: [
    item('apfel', 'F110100'),
    item('haferflocken', 'C133000', {
      source: {
        db: 'bls',
        version: '4.0',
        ref: 'C133000',
        search: ['Haferflocken'],
        state_de: 'trocken',
        category: 'cereal_products',
      },
      groups: ['gluten'],
      shopping_category: 'cereal_breakfast',
      pantry: true,
    }),
    item('offen', null),
    item('falsche-id', 'NICHTDA'),
    item('unvollstaendig', 'X999999'),
  ],
};

function workdir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'foods-import-'));
  dirs.push(dir);
  const put = (path: string, data: unknown) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${JSON.stringify(data, null, 2)}\n`);
  };
  put('content/food-mapping/alpha5-zuordnung.json', MAPPING);
  put('packages/content/seed/alpha5-rezepte.json', {
    zutaten: [
      { id: 'apfel', pro_100g: { kcal: 54, eiweiss_g: 0.3, kohlenhydrate_g: 12, fett_g: 0.2 } },
      // 20 % mehr kcal als die Quelle → „Zuordnung prüfen“
      {
        id: 'haferflocken',
        pro_100g: { kcal: 444, eiweiss_g: 13.5, kohlenhydrate_g: 58.7, fett_g: 7 },
      },
    ],
  });
  return dir;
}

interface FakeApi extends GitHubApi {
  calls: { method: string; path: string; body?: unknown }[];
  verified: boolean;
}

function fakeApi(): FakeApi {
  let counter = 0;
  const sha = () => (++counter).toString(16).padStart(40, '0');
  const api: FakeApi = {
    calls: [],
    verified: true,
    request<T>(method: string, path: string, body?: unknown): Promise<T> {
      api.calls.push({ method, path, ...(body === undefined ? {} : { body }) });
      let result: unknown = {};
      if (path === '/git/ref/heads/main') result = { object: { sha: 'b'.repeat(40) } };
      else if (path.startsWith('/git/commits/')) result = { tree: { sha: 't'.repeat(40) } };
      else if (path === '/git/blobs' || path === '/git/trees' || path === '/git/commits')
        result = { sha: sha() };
      else if (path.startsWith('/commits/'))
        result = {
          author: { login: BOT_LOGIN },
          commit: {
            verification: { verified: api.verified, reason: api.verified ? 'valid' : 'unsigned' },
          },
        };
      else if (path === '/pulls') result = { html_url: 'https://github.com/o/r/pull/99' };
      return Promise.resolve(result as T);
    },
  };
  return api;
}

function deps(dir: string, api: FakeApi, extra: Partial<FoodsImportDeps> = {}): FoodsImportDeps {
  return {
    repoRoot: dir,
    runId: '4711',
    refName: 'main',
    now: () => new Date('2026-10-11T12:00:00.000Z'),
    download: (url) =>
      url === TEST_SOURCE.url ? Promise.resolve(testOriginal()) : Promise.reject(new Error('404')),
    api,
    sources: [TEST_SOURCE],
    ...extra,
  };
}

describe('foods-import (Ende zu Ende, Test-Quelle)', () => {
  it('Modus import: Auszug, SOURCE.json, Lebensmittel; Commit über API auf foods-import/<run-id>; PR', async () => {
    const dir = workdir();
    const api = fakeApi();
    const result = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'import' },
      deps(dir, api),
    );
    expect(result.exitCode).toBe(0);
    expect(result.markdown).toContain('https://github.com/o/r/pull/99');

    // Nur benötigte Zeilen, unverändert.
    const extract = readFileSync(join(dir, 'content/sources/bls/4.0/extract.csv'), 'utf8');
    const lines = extract.trim().split('\n');
    expect(lines).toHaveLength(4); // Kopfzeile + C133000 + F110100 + X999999 (nicht benötigte Zeilen fehlen)
    expect(extract).toContain('C133000,Haferflocken,Oat flakes,370,A,13.5,58.7,0.7,7,1.2,10,4');
    expect(extract).not.toContain('M141200');

    const manifest = JSON.parse(
      readFileSync(join(dir, 'content/sources/bls/4.0/SOURCE.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      url: TEST_SOURCE.url,
      original_sha256: sha256Hex(testOriginal()),
      extract_sha256: sha256Hex(extract),
      extract_rows: 3,
      workflow_run_id: '4711',
      retrieved_at: '2026-10-11T12:00:00Z',
    });

    // Nährwerte nur aus der Quelle (Natrium 4 mg → Salz 0,01 g).
    const oats = foodSchema.parse(
      JSON.parse(readFileSync(join(dir, 'content/foods/haferflocken.json'), 'utf8')),
    );
    expect(oats.nutrients_per_100g).toEqual({
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    });
    expect(oats.source).toEqual({
      db: 'bls',
      version: '4.0',
      ref: 'C133000',
      name: 'Haferflocken',
      category: 'cereal_products',
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-11',
    });
    expect(oats.status).toBe('draft');
    expect(oats.meta.catalog_reviewed_by).toBeNull();
    const expectations = JSON.parse(
      readFileSync(join(dir, 'content/foods/allergen-expectations.json'), 'utf8'),
    );
    expect(expectations).toEqual({ apfel: [], haferflocken: ['gluten'] });

    // Bericht: offene, falsche und unvollständige Zuordnungen; Gegencheck > 15 %.
    expect(result.markdown).toMatch(/`offen` \| noch keine Quell-ID/);
    expect(result.markdown).toMatch(/Quell-IDs ohne Zeile in der Original-Datei: NICHTDA/);
    expect(result.markdown).toMatch(/`X999999`: Wert fehlt/);
    expect(result.markdown).toMatch(/🔴 `haferflocken` \| kcal \| 444 \| 370/);

    // Commit nur über die API, ohne Autor (→ verified), Branch foods-import/4711, PR, ci.
    const commit = api.calls.find((c) => c.path === '/git/commits' && c.method === 'POST');
    expect(commit?.body).not.toHaveProperty('author');
    expect(commit?.body).not.toHaveProperty('committer');
    expect(api.calls.find((c) => c.path === '/git/refs')?.body).toMatchObject({
      ref: 'refs/heads/foods-import/4711',
    });
    const tree = api.calls.find((c) => c.path === '/git/trees')?.body as {
      tree: { path: string }[];
    };
    expect(tree.tree.map((t) => t.path).sort()).toEqual([
      'content/foods/allergen-expectations.json',
      'content/foods/apfel.json',
      'content/foods/haferflocken.json',
      'content/sources/bls/4.0/ATTRIBUTION.md',
      'content/sources/bls/4.0/SOURCE.json',
      'content/sources/bls/4.0/extract.csv',
    ]);
    const pr = api.calls.find((c) => c.path === '/pulls')?.body as { body: string; head: string };
    expect(pr.head).toBe('foods-import/4711');
    expect(pr.body).toContain(sha256Hex(testOriginal()));
    expect(pr.body).toContain(manifest.extract_sha256);
    expect(pr.body).toContain('So testest du es am Handy');
    // Beide Prüf-Workflows für den Branch gestartet (GB1: PRs mit GITHUB_TOKEN starten keine Workflows).
    const dispatches = api.calls.filter((c) => c.path.endsWith('/dispatches'));
    expect(dispatches.map((c) => [c.path, c.body])).toEqual([
      ['/actions/workflows/ci.yml/dispatches', { ref: 'foods-import/4711' }],
      ['/actions/workflows/sources-integrity-main.yml/dispatches', { ref: 'foods-import/4711' }],
    ]);
    expect(result.markdown).toContain('sources-integrity-main.yml gestartet.');

    // Der erzeugte Stand besteht die Herkunftsprüfung (Zeilen, Prüfsummen, Allowlist).
    const integrityDeps = {
      ...integrityDepsFromEnv(dir, { GITHUB_REF_NAME: 'main' }),
      loadMainSources: () => Promise.resolve([TEST_SOURCE]),
      download: () => Promise.resolve(testOriginal()),
    };
    expect((await checkSourcesIntegrity(integrityDeps)).errors).toEqual([]);

    // Zweitlauf ohne Änderung: kein Commit, kein PR.
    const again = fakeApi();
    const second = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'import' },
      deps(dir, again),
    );
    expect(second.exitCode).toBe(0);
    expect(second.markdown).toContain('Keine Änderungen');
    expect(again.calls).toEqual([]);
  });

  it('Commit nicht „verified“ → Abbruch (kein PR)', async () => {
    const dir = workdir();
    const api = fakeApi();
    api.verified = false;
    await expect(
      runFoodsImport({ source: 'bls', version: '4.0', mode: 'import' }, deps(dir, api)),
    ).rejects.toThrow(/nicht als verifizierter Bot-Commit/);
    expect(api.calls.some((c) => c.path === '/pulls')).toBe(false);
  });

  it('Modus kandidaten: listet Quell-IDs und Bezeichnungen, schreibt nichts', async () => {
    const dir = workdir();
    const api = fakeApi();
    const result = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'kandidaten' },
      deps(dir, api),
    );
    expect(result.exitCode).toBe(0);
    expect(result.markdown).toContain('| `offen` |');
    expect(result.markdown).toContain(
      '- salt_g: Spalte 11 „NA Natrium [mg/100g]“ (sodium_mg_to_salt_g)',
    );
    expect(result.markdown).not.toMatch(/370/); // keine Nährwerte im Kandidatenbericht
    expect(api.calls).toEqual([]);
  });

  it('Modus import ohne eingetragene Quell-ID → Abbruch mit Hinweis, nichts geschrieben', async () => {
    const dir = workdir();
    const empty = {
      ...MAPPING,
      items: MAPPING.items.map((i) => ({ ...i, source: { ...i.source, ref: null } })),
    };
    writeFileSync(join(dir, 'content/food-mapping/alpha5-zuordnung.json'), JSON.stringify(empty));
    const api = fakeApi();
    const result = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'import' },
      deps(dir, api),
    );
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toMatch(/noch keine Quell-ID/);
    expect(api.calls).toEqual([]);
  });

  it('nur auf main; nur Quellen aus der Allowlist; festgenagelte Prüfsumme', async () => {
    const dir = workdir();
    const onBranch = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'import' },
      deps(dir, fakeApi(), { refName: 'claude/test' }),
    );
    expect(onBranch.exitCode).toBe(1);
    expect(onBranch.markdown).toMatch(/nur auf `main`/);
    const unknown = await runFoodsImport(
      { source: 'bls', version: '9.9', mode: 'import' },
      deps(dir, fakeApi()),
    );
    expect(unknown.exitCode).toBe(1);
    const pinned = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'import' },
      deps(dir, fakeApi(), { sources: [{ ...TEST_SOURCE, originalSha256: 'c'.repeat(64) }] }),
    );
    expect(pinned.exitCode).toBe(1);
    expect(pinned.markdown).toMatch(/andere Prüfsumme/);
  });
});
