import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type Food, type SourceNutrientRow, sourceRowKey } from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import { validateRepository } from '../validate';
import { findCandidates, formatCandidates, mappingCandidates, matchesSearch } from './candidates';
import { downloadOriginal, type DownloadFetch } from './download';
import {
  BOT_LOGIN,
  commitProvenance,
  type FetchLike,
  githubApi,
  importRunProvenance,
} from './github-api';
import {
  alpha5Deviations,
  canonicalJson,
  formatImportReport,
  importFoods,
  type ImportInput,
} from './import-source';
import type { FoodMapping, MappingItem } from './mapping';
import { extractSourceRows, readOriginalRecords } from './extract-source';
import { TEST_SOURCE, testOriginal } from './test-helpers';

const ROW: SourceNutrientRow = {
  db: 'bls',
  version: '4.0',
  ref: 'F110100',
  name: 'Apfel, roh',
  nutrients_per_100g: {
    kcal: 54,
    protein_g: 0.3,
    carbs_g: 12,
    sugar_g: 10,
    fat_g: 0.2,
    sat_fat_g: 0,
    fiber_g: 2,
    salt_g: 0.0025,
  },
};

function mappingItem(extra: Partial<MappingItem> = {}): MappingItem {
  return {
    alpha5_id: extra.food_id ?? 'apfel',
    food_id: 'apfel',
    alpha5_name: 'Apfel',
    source: {
      db: 'bls',
      version: '4.0',
      ref: 'F110100',
      search: ['Apfel'],
      state_de: 'roh',
      category: 'fruit',
    },
    name_de: 'Apfel',
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
    reason_de: 'Apfel roh, Grundlebensmittel.',
    ...extra,
  };
}

function mapping(items: MappingItem[]): FoodMapping {
  return {
    format: 'alpha5-food-mapping',
    version: 1,
    status: 'unbestaetigt',
    origin: 'claude_session',
    model: 'claude-opus-5-5',
    created_on: '2026-10-11',
    note_de: 'Test der Zuordnung.',
    items,
  };
}

function input(extra: Partial<ImportInput> = {}): ImportInput {
  return {
    mapping: mapping([mappingItem()]),
    def: TEST_SOURCE,
    sourceRows: new Map([[sourceRowKey(ROW), ROW]]),
    retrievedOn: '2026-10-11',
    existing: new Map(),
    alpha5: new Map(),
    today: '2026-10-11',
    ...extra,
  };
}

describe('import-source: Lebensmittel nur mit Quellwerten', () => {
  it('neues Lebensmittel: Entwurf, Werte und Bezeichnung aus der Quelle, Katalog-Prüfung offen', () => {
    const out = importFoods(input());
    const food = out.foods.get('apfel');
    expect(food?.nutrients_per_100g).toEqual(ROW.nutrients_per_100g);
    expect(food?.source.name).toBe('Apfel, roh');
    expect(food?.status).toBe('draft');
    expect(food?.version).toBe(1);
    expect(food?.meta).toMatchObject({ origin: 'claude_session', catalog_reviewed_by: null });
    expect(out.report.written).toEqual(['apfel']);
  });

  it('unverändert → nicht neu geschrieben; geändert → Version + 1 und Katalog-Prüfung zurückgesetzt', () => {
    const first = importFoods(input()).foods.get('apfel') as Food;
    const reviewed: Food = {
      ...first,
      meta: { ...first.meta, catalog_reviewed_by: 'KT', catalog_reviewed_at: '2026-10-12' },
    };
    const same = importFoods(input({ existing: new Map([['apfel', reviewed]]) }));
    expect(same.foods.size).toBe(0);
    expect(same.report.unchanged).toEqual(['apfel']);
    expect(same.expectations).toEqual({ apfel: [] });

    // Nur ein neues Abrufdatum ändert nichts.
    const later = importFoods(
      input({ existing: new Map([['apfel', reviewed]]), retrievedOn: '2027-01-01' }),
    );
    expect(later.report.unchanged).toEqual(['apfel']);

    const changedRow = { ...ROW, nutrients_per_100g: { ...ROW.nutrients_per_100g, kcal: 55 } };
    const changed = importFoods(
      input({
        existing: new Map([['apfel', reviewed]]),
        sourceRows: new Map([[sourceRowKey(ROW), changedRow]]),
      }),
    );
    const updated = changed.foods.get('apfel');
    expect(updated?.version).toBe(2);
    expect(updated?.meta.catalog_reviewed_by).toBeNull();
    expect(updated?.nutrients_per_100g.kcal).toBe(55);
  });

  it('Fachprüfung wird bei geänderten Werten, Quell-ID, Gruppen oder Schwangerschaft zurückgesetzt, sonst nicht (S6)', () => {
    const first = importFoods(input()).foods.get('apfel') as Food;
    const expert: Food = {
      ...first,
      meta: {
        ...first.meta,
        expert_reviewed: true,
        reviewed_by: 'Fachkraft',
        reviewed_at: '2026-10-12',
        review_note: 'geprüft',
        catalog_reviewed_by: 'KT',
        catalog_reviewed_at: '2026-10-12',
      },
    };
    const existing = new Map([['apfel', expert]]);
    const changedRow = { ...ROW, nutrients_per_100g: { ...ROW.nutrients_per_100g, kcal: 55 } };
    const valueChange = importFoods(
      input({ existing, sourceRows: new Map([[sourceRowKey(ROW), changedRow]]) }),
    ).foods.get('apfel');
    expect(valueChange?.meta).toMatchObject({
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      catalog_reviewed_by: null,
    });
    const groupChange = importFoods(
      input({ existing, mapping: mapping([mappingItem({ groups: ['fructose'] })]) }),
    ).foods.get('apfel');
    expect(groupChange?.meta.expert_reviewed).toBe(false);
    const pregnancy = importFoods(
      input({ existing, mapping: mapping([mappingItem({ pregnancy_caution: true })]) }),
    ).foods.get('apfel');
    expect(pregnancy?.meta.reviewed_by).toBeNull();
    // Nur ein Alias geändert: Katalog-Prüfung neu, Fachprüfung bleibt.
    const alias = importFoods(
      input({ existing, mapping: mapping([mappingItem({ aliases_de: ['Tafelapfel'] })]) }),
    ).foods.get('apfel');
    expect(alias?.meta).toMatchObject({
      expert_reviewed: true,
      reviewed_by: 'Fachkraft',
      catalog_reviewed_by: null,
    });
  });

  it('verwaiste Lebensmittel werden gemeldet und behalten ihre Erwartungen (K7)', () => {
    const first = importFoods(input()).foods.get('apfel') as Food;
    const old = { ...first, id: 'birne', groups: ['fructose' as const] };
    const out = importFoods(input({ existing: new Map<string, unknown>([['birne', old]]) }));
    expect(out.report.orphaned).toEqual(['birne']);
    expect(out.expectations).toEqual({ apfel: [], birne: ['fructose'] });
    expect(formatImportReport(out.report, [])).toContain('verwaist (Datei vorhanden');
  });

  it('freigegebene Lebensmittel werden nie überschrieben', () => {
    const first = importFoods(input()).foods.get('apfel') as Food;
    const published: Food = {
      ...first,
      status: 'published',
      meta: { ...first.meta, reviewed_by: 'KT', reviewed_at: '2026-10-12' },
    };
    const out = importFoods(
      input({
        existing: new Map([['apfel', published]]),
        mapping: mapping([mappingItem({ name_de: 'Apfel neu' })]),
      }),
    );
    expect(out.foods.size).toBe(0);
    expect(out.report.skipped[0]?.reason).toMatch(/freigegeben/);
  });

  it('ohne Quell-ID, andere Quelle, fehlende Zeile, ungültige Datei, Schemafehler → nicht importiert', () => {
    const out = importFoods(
      input({
        mapping: mapping([
          mappingItem({ food_id: 'ohne', source: { ...mappingItem().source, ref: null } }),
          mappingItem({ food_id: 'andere', source: { ...mappingItem().source, version: '3.02' } }),
          mappingItem({ food_id: 'fehlt', source: { ...mappingItem().source, ref: 'NEIN' } }),
          mappingItem({ food_id: 'kaputt' }),
          mappingItem({ food_id: 'fleisch', animal: ['meat'], meat_kind: [] }),
        ]),
        existing: new Map([['kaputt', { id: 'kaputt' }]]),
      }),
    );
    expect(out.foods.size).toBe(0);
    expect(out.report.skipped.map((s) => s.id)).toEqual([
      'ohne',
      'andere',
      'fehlt',
      'kaputt',
      'fleisch',
    ]);
    expect(out.report.skipped[4]?.reason).toMatch(/Schemafehler/);
  });

  it('Gegencheck Gründer-Datei: > 3 % gemeldet, > 15 % „Zuordnung prüfen“, Mindestabstand', () => {
    const n = ROW.nutrients_per_100g;
    expect(
      alpha5Deviations('apfel', { kcal: 54, eiweiss_g: 0.3, kohlenhydrate_g: 12, fett_g: 0.2 }, n),
    ).toEqual([]);
    // 58 kcal statt 54: 4 kcal unter Mindestabstand 5 → nichts; 0,9 g Fett: Abstand 0,7 g < 1 g → nichts.
    expect(
      alpha5Deviations('apfel', { kcal: 58, eiweiss_g: 0.3, kohlenhydrate_g: 12, fett_g: 0.9 }, n),
    ).toEqual([]);
    const hits = alpha5Deviations(
      'apfel',
      { kcal: 60, eiweiss_g: 0.3, kohlenhydrate_g: 14, fett_g: 0.2 },
      n,
    );
    expect(hits.map((h) => [h.field, h.level])).toEqual([
      ['kcal', 'report'],
      ['carbs_g', 'review'],
    ]);
    const report = formatImportReport(
      { written: ['apfel'], unchanged: [], skipped: [], deviations: hits, orphaned: [] },
      [],
    );
    expect(report).toContain('🔴 `apfel` | carbs_g | 14 | 12 | 16,7 %');
  });

  it('canonicalJson ist unabhängig von der Schlüssel-Reihenfolge und berücksichtigt verschachtelte Werte', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3] } })).toBe(
      canonicalJson({ a: { c: [3], d: 2 }, b: 1 }),
    );
    expect(canonicalJson({ a: { kcal: 1 } })).not.toBe(canonicalJson({ a: { kcal: 2 } }));
  });
});

describe('Kandidatensuche', () => {
  const records = readOriginalRecords(testOriginal(), TEST_SOURCE);

  it('findet Zeilen nach Suchbegriffen (Umlaute/Groß-Klein egal), kürzeste zuerst', () => {
    expect(matchesSearch('Joghurt, 1,5 % Fett', 'joghurt fett')).toBe(true);
    expect(matchesSearch('Apfel, roh', 'Äpfel')).toBe(false);
    expect(findCandidates(records, TEST_SOURCE, ['apfel']).map((c) => c.ref)).toEqual(['F110100']);
  });

  it('Bericht: offene Zutaten mit Kandidaten, unpassende Bezeichnung wird gemeldet, keine Nährwerte', () => {
    const result = mappingCandidates(
      mapping([
        mappingItem({
          food_id: 'offen',
          source: { ...mappingItem().source, ref: null, search: ['Haferflocken'] },
        }),
        mappingItem({ food_id: 'falsch', source: { ...mappingItem().source, ref: 'T100000' } }),
        mappingItem(),
      ]),
      records,
      TEST_SOURCE,
    );
    expect(result.open[0]?.candidates).toEqual([{ ref: 'C133000', name: 'Haferflocken' }]);
    expect(result.nameChecks).toEqual([
      { id: 'falsch', ref: 'T100000', sourceName: 'Lachs "Atlantik", roh' },
    ]);
    const md = formatCandidates(result);
    expect(md).toContain('`C133000`: Haferflocken');
    expect(md).not.toContain('370');
  });
});

describe('GitHub-API: Herkunft eines Commits', () => {
  function apiReturning(data: unknown, status = 200) {
    const calls: string[] = [];
    const fetchImpl: FetchLike = (url) => {
      calls.push(url);
      return Promise.resolve({
        ok: status < 400,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      });
    };
    return { api: githubApi('geheim', 'owner/repo', fetchImpl), calls };
  }
  const sha = '1'.repeat(40);

  it('verified + Bot → ok; nicht verified (gefälschter Bot-Autor) → nicht ok; anderer Autor → nicht ok', async () => {
    const ok = apiReturning({
      author: { login: BOT_LOGIN },
      commit: { verification: { verified: true } },
    });
    expect((await commitProvenance(ok.api, sha)).ok).toBe(true);
    expect(ok.calls).toEqual([`https://api.github.com/repos/owner/repo/commits/${sha}`]);
    const fake = apiReturning({
      author: { login: BOT_LOGIN },
      commit: { verification: { verified: false, reason: 'unsigned' } },
    });
    expect(await commitProvenance(fake.api, sha)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/unsigned/) as unknown as string,
    });
    const human = apiReturning({
      author: { login: 'jemand' },
      commit: { verification: { verified: true } },
    });
    expect((await commitProvenance(human.api, sha)).reason).toMatch(/jemand/);
    expect((await commitProvenance(ok.api, 'kein-sha')).ok).toBe(false);
  });

  it('Lauf-ID: nur foods-import.yml, workflow_dispatch, main, nicht fehlgeschlagen (Wächter N2b, S1)', async () => {
    const good = {
      path: '.github/workflows/foods-import.yml',
      event: 'workflow_dispatch',
      head_branch: 'main',
      status: 'in_progress',
      conclusion: null,
    };
    const ok = apiReturning(good);
    expect(await importRunProvenance(ok.api, '4711')).toMatchObject({ ok: true });
    expect(ok.calls).toEqual(['https://api.github.com/repos/owner/repo/actions/runs/4711']);
    for (const bad of [
      { ...good, path: '.github/workflows/eigener.yml' },
      { ...good, event: 'push' },
      { ...good, head_branch: 'foods-import/4711' },
      { ...good, status: 'completed', conclusion: 'failure' },
    ]) {
      expect((await importRunProvenance(apiReturning(bad).api, '4711')).ok).toBe(false);
    }
    expect(
      (
        await importRunProvenance(
          apiReturning({ ...good, status: 'completed', conclusion: 'success' }).api,
          '1',
        )
      ).ok,
    ).toBe(true);
    expect((await importRunProvenance(ok.api, 'x1')).ok).toBe(false);
  });

  it('HTTP-Fehler → verständlicher Fehler; ungültiges Repository → Fehler', async () => {
    const failing = apiReturning({ message: 'Not Found' }, 404);
    await expect(commitProvenance(failing.api, sha)).rejects.toThrow(/HTTP 404/);
    expect(() => githubApi('t', 'kein repo')).toThrow(/owner\/name/);
  });
});

describe('Download der Original-Datei', () => {
  const ok =
    (body: string, url = 'https://example.org/a.xlsx'): DownloadFetch =>
    () =>
      Promise.resolve({
        ok: true,
        status: 200,
        url,
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer as ArrayBuffer),
      });

  it('xlsx-Adresse liefert Webseite statt Datei → verständlicher Fehler mit Antwort-Details', async () => {
    const html: DownloadFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: 'https://example.org/login',
        headers: { get: (n: string) => (n === 'content-type' ? 'text/html;charset=UTF-8' : null) },
        arrayBuffer: () =>
          Promise.resolve(
            new TextEncoder().encode('<!DOCTYPE html><html><title>Anmeldung</title>')
              .buffer as ArrayBuffer,
          ),
      });
    await expect(downloadOriginal('https://example.org/a.xlsx', html)).rejects.toThrow(
      /keine xlsx-Datei.*HTTP 200.*text\/html.*example\.org\/login.*DOCTYPE/,
    );
    const zip: DownloadFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: '',
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]).buffer),
      });
    expect((await downloadOriginal('https://example.org/a.xlsx', zip)).length).toBe(5);
  });

  it('nur HTTPS (auch nach Weiterleitung), Fehler, leere/zu große Datei', async () => {
    await expect(downloadOriginal('http://example.org/a.xlsx', ok('x'))).rejects.toThrow(/HTTPS/);
    expect((await downloadOriginal('https://example.org/a.csv', ok('abc'))).toString()).toBe('abc');
    await expect(
      downloadOriginal('https://example.org/a.xlsx', ok('x', 'http://example.org/b')),
    ).rejects.toThrow(/Nicht-HTTPS/);
    await expect(downloadOriginal('https://example.org/a.xlsx', ok(''))).rejects.toThrow(/leer/);
    await expect(downloadOriginal('https://example.org/a.xlsx', ok('abcdef'), 3)).rejects.toThrow(
      /zu groß/,
    );
    const notFound: DownloadFetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
        url: '',
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    await expect(downloadOriginal('https://example.org/a.xlsx', notFound)).rejects.toThrow(
      /HTTP 404.*sources.ts/,
    );
    const offline: DownloadFetch = () => Promise.reject(new Error('getaddrinfo ENOTFOUND'));
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    };
    await expect(
      downloadOriginal('https://example.org/a.xlsx', offline, undefined, { sleep }),
    ).rejects.toThrow(/nicht erreichbar/);
    expect(waits).toEqual([10_000, 30_000]);
  });

  it('wiederholt bei Netzfehler/5xx (K2), nicht bei 404', async () => {
    let calls = 0;
    const flaky: DownloadFetch = () => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject(new Error('ECONNRESET'));
      }
      return Promise.resolve({
        ok: calls === 3,
        status: calls === 3 ? 200 : 503,
        url: 'https://example.org/a.xlsx',
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode('ok').buffer as ArrayBuffer),
      });
    };
    const sleep = () => Promise.resolve();
    expect(
      (await downloadOriginal('https://example.org/a.csv', flaky, undefined, { sleep })).toString(),
    ).toBe('ok');
    expect(calls).toBe(3);
    let notFoundCalls = 0;
    const notFound: DownloadFetch = () => {
      notFoundCalls += 1;
      return Promise.resolve({
        ok: false,
        status: 404,
        url: '',
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    };
    await expect(
      downloadOriginal('https://example.org/a.xlsx', notFound, undefined, { sleep }),
    ).rejects.toThrow(/HTTP 404/);
    expect(notFoundCalls).toBe(1);
  });
});

describe('content:validate mit Lebensmittel-Katalog (R17/R18 in CI)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function repoWith(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'validate-foods-'));
    dirs.push(dir);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return dir;
  }

  const extract = extractSourceRows(readOriginalRecords(testOriginal(), TEST_SOURCE), TEST_SOURCE, [
    'F110100',
  ]).csv;

  it('Lebensmittel mit Quellwerten → R17 ohne Befund; geänderter Wert → R17 rot', () => {
    // Quelle „bls 4.0“ der echten Allowlist, Auszug im Format der Test-Quelle (gleiche Spalten-Codes).
    const food = importFoods(
      input({
        sourceRows: new Map([[sourceRowKey(ROW), ROW]]),
      }),
    ).foods.get('apfel') as Food;
    const files = {
      'content/sources/bls/4.0/extract.csv': extract,
      'content/foods/apfel.json': JSON.stringify(food),
      'content/foods/allergen-expectations.json': JSON.stringify({ apfel: [] }),
    };
    const good = validateRepository({ cwd: repoWith(files), contentDir: undefined });
    expect(good.result.foods).toHaveLength(1);
    expect(good.result.issues.filter((i) => i.rule === 'R17')).toEqual([]);
    expect(good.strayFiles).toEqual([]);

    const tampered = { ...food, nutrients_per_100g: { ...food.nutrients_per_100g, kcal: 40 } };
    const bad = validateRepository({
      cwd: repoWith({ ...files, 'content/foods/apfel.json': JSON.stringify(tampered) }),
    });
    expect(bad.result.issues.some((i) => i.rule === 'R17' && /kcal|Energie/.test(i.message))).toBe(
      true,
    );
  });

  it('Ausnahmeliste wird aus content/food-mapping/ gelesen; in content/foods/ ist sie ein Dateifehler (S4)', () => {
    const food = importFoods(input()).foods.get('apfel') as Food;
    const exceptions = JSON.stringify([
      {
        food_id: 'apfel',
        rule: 'fructose',
        reason: 'Testausnahme mit ausreichend langer Begründung.',
        source: 'Testquelle',
      },
    ]);
    const base = {
      'content/sources/bls/4.0/extract.csv': extract,
      'content/foods/apfel.json': JSON.stringify(food),
      'content/foods/allergen-expectations.json': JSON.stringify({ apfel: [] }),
    };
    const good = validateRepository({
      cwd: repoWith({ ...base, 'content/food-mapping/allergen-exceptions.json': exceptions }),
    });
    expect(good.strayFiles).toEqual([]);
    const wrong = validateRepository({
      cwd: repoWith({ ...base, 'content/foods/allergen-exceptions.json': exceptions }),
    });
    expect(wrong.strayFiles.join('\n')).toMatch(/gehört nach food-mapping/);
    const invalid = validateRepository({
      cwd: repoWith({ ...base, 'content/food-mapping/allergen-exceptions.json': '[{"x":1}]' }),
    });
    expect(invalid.strayFiles.join('\n')).toMatch(
      /food-mapping\/allergen-exceptions.json: ungültig/,
    );
  });

  it('ohne Ordner content/foods: unverändert (kein Katalog geladen)', () => {
    const report = validateRepository({ cwd: repoWith({ 'content/exercises/.keep': '' }) });
    expect(report.result.foods).toEqual([]);
    expect(report.strayFiles).toEqual([]);
  });

  it('Quellordner außerhalb der Allowlist oder ohne Auszug → Dateifehler (blockiert)', () => {
    const report = validateRepository({
      cwd: repoWith({
        'content/foods/allergen-expectations.json': '{}',
        'content/sources/fremd/1.0/extract.csv': 'a\n',
        'content/sources/bls/4.0/SOURCE.json': '{}',
      }),
    });
    expect(report.strayFiles.join('\n')).toMatch(/fremd\/1.0: Quelle nicht in der Allowlist/);
    expect(report.strayFiles.join('\n')).toMatch(/bls\/4.0: extract.csv fehlt/);
  });
});
