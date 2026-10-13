/**
 * Gegencheck Gründer-Datei ↔ Quelle, fair seit Import-Lauf 1 (PR #47, docs/PLAN-PHASE-5.md N2b, Konstanten
 * `ALPHA5_IMPORT_TOLERANCE`): Fehlalarme durch kleine Absolutwerte, andere Kohlenhydrat-Definitionen und fehlende
 * Vergleichswerte entfallen – echte Fehlgriffe (falsches Lebensmittel, falsche Fettstufe, falsche Spalte,
 * vergiftete Datei) fallen weiter auf.
 *
 * Alle Werte sind TESTWERTE (erfunden bzw. gerundet nach dem Bericht zu PR #47), keine Katalogdaten.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sourceRowKey } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { MAX_REVIEW_SHARE, reviewShareNote } from './foods-import';
import {
  type Alpha5Per100g,
  alpha5Deviations,
  type CrossCheckValues,
  hasNoReference,
  importFoods,
  type ImportReport,
} from './import-source';
import { type FoodMapping, type MappingItem, parseFoodMapping } from './mapping';
import { sourceNutrientRows } from './source-rows';
import { SOURCES } from './sources';
import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { parseCsv } from './csv';
import { CROSSCHECK_PAIRS } from './crosscheck-fixture';
import { TEST_SOURCE } from './test-helpers';

function file(kcal: number, eiweiss_g: number, kohlenhydrate_g: number, fett_g: number) {
  return { kcal, eiweiss_g, kohlenhydrate_g, fett_g } satisfies Alpha5Per100g;
}

function review(id: string, f: Alpha5Per100g, source: CrossCheckValues) {
  return alpha5Deviations(id, f, source)
    .filter((d) => d.level === 'review')
    .map((d) => d.field);
}

describe('Gegencheck: keine Fehlalarme mehr (Befunde aus PR #47)', () => {
  it('Champignons: 0,6 g statt 2,9 g Kohlenhydrate – der Quellwert enthält 2,7 g Zuckeralkohole (Mannit)', () => {
    const source = {
      kcal: 28,
      protein_g: 3.66,
      carbs_g: 2.9,
      fat_g: 0.27,
      fiber_g: 1.9,
      polyols_g: 2.74,
    };
    const hits = alpha5Deviations('champignons', file(22, 3.1, 0.6, 0.3), source);
    expect(hits.filter((d) => d.level === 'review')).toEqual([]);
    // Ohne Polyol-Wert in der Quelle bleibt es „Zuordnung prüfen“ (2,3 g = 9 kcal = 33 % der Energie).
    expect(review('champignons', file(22, 3.1, 0.6, 0.3), { ...source, polyols_g: null })).toEqual([
      'carbs_g',
    ]);
  });

  it('Nüsse/Samen: 3 g Kohlenhydrat-Unterschied sind 2 % der Energie → nur gemeldet', () => {
    const hits = alpha5Deviations('mandeln', file(600, 21, 7, 52), {
      kcal: 544,
      protein_g: 22.33,
      carbs_g: 3.87,
      fat_g: 46.6,
      fiber_g: 10,
    });
    expect(hits.find((d) => d.field === 'carbs_g')).toMatchObject({ level: 'report' });
    expect(hits.filter((d) => d.level === 'review')).toEqual([]);
  });

  it('Knoblauch: Kohlenhydrate inklusive Ballaststoffe (Fructane) – Definition, kein Fehlgriff', () => {
    const hits = alpha5Deviations('knoblauch', file(140, 6, 28, 0.1), {
      kcal: 97,
      protein_g: 6.05,
      carbs_g: 3,
      fat_g: 0.42,
      fiber_g: 28.3,
    });
    expect(hits.filter((d) => d.level === 'review')).toEqual([]);
    expect(hits.map((d) => [d.field, d.reading])).toEqual([
      ['kcal', 'Ballaststoffe als KH (4 kcal/g)'],
      ['carbs_g', 'KH + Ballaststoffe'],
    ]);
  });

  it('Halloumi: 2 g statt 0,1 g Kohlenhydrate (1,9 g = 2 % der Energie) → kein „Zuordnung prüfen“', () => {
    expect(
      review('halloumi', file(320, 22, 2, 25), {
        kcal: 315,
        protein_g: 21.46,
        carbs_g: 0.1,
        fat_g: 25.06,
        fiber_g: 0,
      }),
    ).toEqual([]);
  });

  it('Pfeffer: Gründer-Datei 0/0/0/0 → „kein Vergleichswert“, nicht „Zuordnung prüfen“', () => {
    expect(hasNoReference(file(0, 0, 0, 0))).toBe(true);
    expect(hasNoReference(file(0, 0, 0.1, 0))).toBe(false);
    const item = (id: string, ref: string): MappingItem => ({
      alpha5_id: id,
      food_id: id,
      alpha5_name: id,
      source: { db: 'bls', version: '4.0', ref, search: [id], state_de: 'roh', category: 'fruit' },
      name_de: id,
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
      reason_de: `Testzuordnung ${ref}`,
    });
    const mapping: FoodMapping = {
      format: 'alpha5-food-mapping',
      version: 1,
      status: 'unbestaetigt',
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      created_on: '2026-10-13',
      note_de: 'Test der Zuordnung.',
      items: [item('pfeffer', 'R258100')],
    };
    const out = importFoods({
      mapping,
      def: TEST_SOURCE,
      sourceRows: new Map([
        [
          sourceRowKey({ db: 'bls', version: '4.0', ref: 'R258100' }),
          {
            db: 'bls',
            version: '4.0',
            ref: 'R258100',
            name: 'Pfeffer',
            nutrients_per_100g: {
              kcal: 304,
              protein_g: 10.9,
              carbs_g: 46,
              sugar_g: 0.6,
              fat_g: 2.8,
              sat_fat_g: 1,
              fiber_g: 25.5,
              salt_g: 0.05,
            },
          },
        ],
      ]),
      retrievedOn: '2026-10-13',
      existing: new Map(),
      alpha5: new Map([['pfeffer', file(0, 0, 0, 0)]]),
      today: '2026-10-13',
    });
    expect(out.report.skipped).toEqual([]);
    expect(out.report.written).toEqual(['pfeffer']);
    expect(out.report.noReference).toEqual(['pfeffer']);
    expect(out.report.compared).toEqual(['pfeffer']);
    expect(out.report.deviations).toEqual([]);
  });
});

describe('Gegencheck: echte Fehlgriffe fallen weiter auf', () => {
  it('Hack mit 16 % statt 5 % Fett (falsche Fettstufe) → Energie und Fett „Zuordnung prüfen“', () => {
    expect(
      review('rinderhackfleisch-5-fett', file(125, 21.5, 0, 4.5), {
        kcal: 224,
        protein_g: 19.1,
        carbs_g: 0,
        fat_g: 16.39,
        fiber_g: 0,
      }),
    ).toEqual(['kcal', 'fat_g']);
  });

  it('Apfelmus gesüßt statt Apfel (falsches Lebensmittel) → Energie und Kohlenhydrate', () => {
    expect(
      review('apfel', file(54, 0.3, 12, 0.2), {
        kcal: 77,
        protein_g: 0.2,
        carbs_g: 18.6,
        fat_g: 0.1,
        fiber_g: 1.6,
      }),
    ).toEqual(['kcal', 'carbs_g']);
  });

  it('Milch 0,3 % statt 1,5 % Fett: nur 11 kcal, aber 1,2 g Fett = 23 % der Energie → Fett', () => {
    expect(
      review('milch-1-5', file(47, 3.4, 4.9, 1.5), {
        kcal: 36,
        protein_g: 3.5,
        carbs_g: 4.8,
        fat_g: 0.3,
        fiber_g: 0,
      }),
    ).toEqual(['fat_g']);
  });

  it('falsche Spalte: Kilojoule statt Kilokalorien → Energie', () => {
    expect(
      review('apfel', file(54, 0.3, 12, 0.2), {
        kcal: 226,
        protein_g: 0.3,
        carbs_g: 12,
        fat_g: 0.2,
        fiber_g: 2,
      }),
    ).toEqual(['kcal']);
  });

  it('falsche Spalte: Eiweiß und Fett vertauscht → Fett', () => {
    expect(
      review('lachsfilet', file(200, 20, 0, 13), {
        kcal: 200,
        protein_g: 13,
        carbs_g: 0,
        fat_g: 20,
        fiber_g: 0,
      }),
    ).toContain('fat_g');
  });

  it('Ballaststoff-Lesart macht die Energie ballaststoffreicher Lebensmittel NICHT pauschal toleranter', () => {
    // KH der Datei passen zum reinen Quellwert → keine Energie-Lesart; 444 statt 370 kcal (20 %) bleibt rot.
    expect(
      review('haferflocken', file(444, 13.5, 58.7, 7), {
        kcal: 370,
        protein_g: 13.5,
        carbs_g: 58.7,
        fat_g: 7,
        fiber_g: 10,
      }),
    ).toEqual(['kcal']);
  });

  it('Weißbrot ← Vollkornbrot (mehr Ballaststoffe, weniger KH): Energie-Lesart greift nicht → Energie rot', () => {
    // KH passen zwar über „KH + Ballaststoffe“ (47 ↔ 48), die Energie-Lesart gilt aber nur für
    // ballaststoffbetonte Lebensmittel (Ballaststoffe ≥ verfügbare KH) – 210 statt 250 kcal bleibt rot.
    expect(
      review('weizenbrot', file(250, 8, 48, 3), {
        kcal: 210,
        protein_g: 7,
        carbs_g: 38,
        fat_g: 1.2,
        fiber_g: 9,
      }),
    ).toEqual(['kcal']);
    // Grenze (dokumentiert): Weißer Reis ← Vollkornreis bleibt nur gemeldet (🟡) – Netz sind R18 und R19.
    const rice = alpha5Deviations('reis', file(350, 7, 78, 0.6), {
      kcal: 350,
      protein_g: 7.5,
      carbs_g: 72,
      fat_g: 2.2,
      fiber_g: 2.2,
    });
    expect(rice.filter((d) => d.level === 'review')).toEqual([]);
    expect(rice.length).toBeGreaterThan(0);
  });
});

describe('Gegencheck: vergiftete Datei, falsche Spalten, Zeilen-Versatz (Wächter S2)', () => {
  type Pair = {
    readonly id: string;
    readonly file: Alpha5Per100g;
    readonly source: CrossCheckValues & { sugar_g: number | null; sat_fat_g: number | null };
  };
  const n = (v: number | null | undefined): number => v ?? 0;
  const PAIRS: Pair[] = CROSSCHECK_PAIRS.map((row, i) => ({
    id: `z${i}`,
    file: file(n(row[0]), n(row[1]), n(row[2]), n(row[3])),
    source: {
      kcal: n(row[4]),
      protein_g: n(row[5]),
      carbs_g: n(row[6]),
      sugar_g: row[7] ?? null,
      fat_g: n(row[8]),
      sat_fat_g: row[9] ?? null,
      fiber_g: row[10] ?? null,
      polyols_g: row[11] ?? null,
    },
  }));
  const scale = (v: number | null | undefined, k: number) =>
    v === null || v === undefined ? null : v * k;
  const share = (pairs: readonly Pair[]): number => {
    const flagged = new Set(
      pairs.flatMap((p) =>
        alpha5Deviations(p.id, p.file, p.source)
          .filter((d) => d.level === 'review')
          .map((d) => d.id),
      ),
    );
    return flagged.size / pairs.length;
  };
  const scenarios: [string, (pairs: Pair[]) => Pair[]][] = [
    ...[1.1, 0.85, 1.25].map((k): [string, (pairs: Pair[]) => Pair[]] => [
      `alle Quellwerte × ${String(k).replace('.', ',')}`,
      (pairs) =>
        pairs.map((p) => ({
          ...p,
          source: {
            kcal: p.source.kcal * k,
            protein_g: p.source.protein_g * k,
            carbs_g: p.source.carbs_g * k,
            sugar_g: scale(p.source.sugar_g, k),
            fat_g: p.source.fat_g * k,
            sat_fat_g: scale(p.source.sat_fat_g, k),
            fiber_g: scale(p.source.fiber_g, k),
            polyols_g: scale(p.source.polyols_g, k),
          },
        })),
    ]),
    [
      'Spalte KH = Zucker',
      (pairs) =>
        pairs.map((p) => ({ ...p, source: { ...p.source, carbs_g: p.source.sugar_g ?? 0 } })),
    ],
    [
      'Spalte Fett = gesättigte Fettsäuren',
      (pairs) =>
        pairs.map((p) => ({ ...p, source: { ...p.source, fat_g: p.source.sat_fat_g ?? 0 } })),
    ],
    [
      'Spalten Eiweiß ↔ Fett',
      (pairs) =>
        pairs.map((p) => ({
          ...p,
          source: { ...p.source, protein_g: p.source.fat_g, fat_g: p.source.protein_g },
        })),
    ],
    [
      'Zeilen-Versatz um 1',
      (pairs) =>
        pairs.map((p, i) => ({ ...p, source: (pairs[(i + 1) % pairs.length] as Pair).source })),
    ],
  ];

  it(`richtige Datei: ${CROSSCHECK_PAIRS.length} passende Paare → 0 % „Zuordnung prüfen“`, () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(100);
    expect(share(PAIRS)).toBe(0);
  });

  it.each(scenarios)('%s → mehr als 10 % „Zuordnung prüfen“ → NICHT MERGEN', (_name, poison) => {
    const poisoned = poison(PAIRS);
    expect(share(poisoned)).toBeGreaterThan(MAX_REVIEW_SHARE);
    const report: ImportReport = {
      written: poisoned.map((p) => p.id),
      unchanged: [],
      skipped: [],
      noReference: [],
      orphaned: [],
      compared: poisoned.map((p) => p.id),
      deviations: poisoned.flatMap((p) => alpha5Deviations(p.id, p.file, p.source)),
      confirmed: [],
      invalidConfirmations: [],
      unusedConfirmations: [],
      confirmationDrafts: [],
    };
    expect(reviewShareNote(report, poisoned.length)).toMatch(/NICHT MERGEN/);
  });
});

/**
 * Dieselben Szenarien über ALLE Lebensmittel des echten Auszugs (Wächter S2). Läuft, sobald
 * `content/sources/bls/4.0/extract.csv` im Repository liegt (nach dem Merge eines Import-PR) oder wenn
 * `ALPHA5_CROSSCHECK_EXTRACT` auf einen Auszug zeigt (lokale Prüfung); sonst übersprungen.
 */
const EXTRACT =
  process.env.ALPHA5_CROSSCHECK_EXTRACT ??
  join(REAL_REPO_ROOT, 'content/sources/bls/4.0/extract.csv');

type ExtractItem = {
  id: string;
  file: Alpha5Per100g;
  source: CrossCheckValues & { sugar_g: number | null; sat_fat_g: number | null };
};

/** Lädt Auszug, Zuordnung und Gründer-Werte (nur aufgerufen, wenn der Auszug existiert). */
function loadExtractItems(): ExtractItem[] {
  const def = SOURCES.find((d) => d.db === 'bls' && d.version === '4.0');
  if (def === undefined) throw new Error('BLS 4.0 fehlt in sources.ts');
  const { rows } = sourceNutrientRows(parseCsv(readFileSync(EXTRACT, 'utf8'), ','), def);
  const mapping = parseFoodMapping(
    JSON.parse(
      readFileSync(join(REAL_REPO_ROOT, 'content/food-mapping/alpha5-zuordnung.json'), 'utf8'),
    ),
  );
  const seed = JSON.parse(
    readFileSync(join(REAL_REPO_ROOT, 'packages/content/seed/alpha5-rezepte.json'), 'utf8'),
  ) as { zutaten: { id: string; pro_100g: Alpha5Per100g }[] };
  const founder = new Map(seed.zutaten.map((z) => [z.id, z.pro_100g]));
  return mapping.items.flatMap((it) => {
    const row = it.source.ref === null ? undefined : rows.get(it.source.ref);
    const f = founder.get(it.alpha5_id);
    if (row === undefined || f === undefined || hasNoReference(f)) return [];
    return [{ id: it.food_id, file: f, source: row.nutrients_per_100g }];
  });
}

function extractShare(list: readonly ExtractItem[]): number {
  return (
    new Set(
      list.flatMap((p) =>
        alpha5Deviations(p.id, p.file, p.source)
          .filter((d) => d.level === 'review')
          .map((d) => d.id),
      ),
    ).size / list.length
  );
}

const times =
  (f: number) =>
  (items: ExtractItem[]): ExtractItem[] => {
    const k = (v: number | null | undefined) => (v === null || v === undefined ? null : v * f);
    return items.map((p) => ({
      ...p,
      source: {
        kcal: p.source.kcal * f,
        protein_g: p.source.protein_g * f,
        carbs_g: p.source.carbs_g * f,
        sugar_g: k(p.source.sugar_g),
        fat_g: p.source.fat_g * f,
        sat_fat_g: k(p.source.sat_fat_g),
        fiber_g: k(p.source.fiber_g),
        polyols_g: k(p.source.polyols_g),
      },
    }));
  };

const EXTRACT_SCENARIOS: [string, (items: ExtractItem[]) => ExtractItem[]][] = [
  ['× 1,10', times(1.1)],
  ['× 0,85', times(0.85)],
  ['× 1,25', times(1.25)],
  [
    'KH = Zucker',
    (items) =>
      items.map((p) => ({ ...p, source: { ...p.source, carbs_g: p.source.sugar_g ?? 0 } })),
  ],
  [
    'Fett = gesättigte FS',
    (items) =>
      items.map((p) => ({ ...p, source: { ...p.source, fat_g: p.source.sat_fat_g ?? 0 } })),
  ],
  [
    'Zeilen-Versatz um 1',
    (items) =>
      items.map((p, i) => ({
        ...p,
        source: (items[(i + 1) % items.length] as ExtractItem).source,
      })),
  ],
];

describe.skipIf(!existsSync(EXTRACT))('Gegencheck am echten Auszug (alle Lebensmittel)', () => {
  it.each(EXTRACT_SCENARIOS)(
    '%s: deutlich mehr „Zuordnung prüfen“ als die richtige Datei und über 10 %',
    (_name, poison) => {
      const items = loadExtractItems();
      const base = extractShare(items);
      const poisoned = extractShare(poison(items));
      expect(items.length).toBeGreaterThan(100);
      expect(poisoned).toBeGreaterThan(MAX_REVIEW_SHARE);
      expect(poisoned).toBeGreaterThan(base + 0.05);
    },
  );
});
