/**
 * Liste „bestätigte Datenunterschiede“ (docs/PLAN-PHASE-5.md N2b, Leitplanken der Wächter-Prüfung Import-Lauf 1):
 * Bindung an Quelle + Werte, 🟠 im Bericht, nicht in der 10-%-Regel, Deckel 20 %, vergiftete Datei bleibt ⛔.
 *
 * Alle Werte sind TESTWERTE (erfunden bzw. aus der anonymisierten Gegencheck-Fixture), keine Katalogdaten.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type SourceNutrientRow, sourceRowKey } from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONFIRMATION_PLACEHOLDER,
  CONFIRMED_DIFFERENCES_PATH,
  type ConfirmedDifference,
  confirmationMismatches,
  MAX_CONFIRMED_SHARE,
  parseConfirmedDifferences,
} from './confirmed-differences';
import { CROSSCHECK_PAIRS } from './crosscheck-fixture';
import {
  loadConfirmations,
  MAX_REVIEW_SHARE,
  reviewShareNote,
  reviewVerdict,
} from './foods-import';
import {
  type Alpha5Per100g,
  formatImportReport,
  importFoods,
  type ImportOutput,
} from './import-source';
import { FOOD_MAPPING_PATH, type MappingItem, parseFoodMapping } from './mapping';
import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { TEST_SOURCE } from './test-helpers';

type Nutrients = SourceNutrientRow['nutrients_per_100g'];

interface Case {
  readonly id: string;
  readonly ref: string;
  readonly file: Alpha5Per100g;
  readonly source: Nutrients;
}

function item(c: Case): MappingItem {
  return {
    alpha5_id: c.id,
    food_id: c.id,
    alpha5_name: c.id,
    source: {
      db: 'bls',
      version: '4.0',
      ref: c.ref,
      search: ['Test'],
      state_de: 'roh',
      category: 'fruit',
    },
    name_de: `Testzutat ${c.id}`,
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
    reason_de: 'Testzutat ohne Bedeutung.',
  };
}

function run(cases: readonly Case[], confirmations: readonly ConfirmedDifference[] = []) {
  const rows = cases.map((c): SourceNutrientRow => ({
    db: 'bls',
    version: '4.0',
    ref: c.ref,
    name: `Testzeile ${c.ref}`,
    nutrients_per_100g: c.source,
  }));
  return importFoods({
    mapping: {
      format: 'alpha5-food-mapping',
      version: 1,
      status: 'unbestaetigt',
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      created_on: '2026-10-13',
      note_de: 'Test der Bestätigungsliste.',
      items: cases.map(item),
    },
    def: TEST_SOURCE,
    sourceRows: new Map(rows.map((r) => [sourceRowKey(r), r])),
    retrievedOn: '2026-10-13',
    existing: new Map(),
    alpha5: new Map(cases.map((c) => [c.id, c.file])),
    today: '2026-10-13',
    confirmations,
  });
}

const SOURCE: Nutrients = {
  kcal: 100,
  protein_g: 10,
  carbs_g: 10,
  sugar_g: 5,
  fat_g: 2.2,
  sat_fat_g: 1,
  fiber_g: 1,
  salt_g: 0.1,
};
const MATCHING: Alpha5Per100g = { kcal: 100, eiweiss_g: 10, kohlenhydrate_g: 10, fett_g: 2.2 };
/** 140 statt 100 kcal: 40 %, 40 kcal → „Zuordnung prüfen“. */
const DIFFERENT: Alpha5Per100g = { ...MATCHING, kcal: 140 };

/** `total` Zutaten, davon die ersten `different` mit echtem Datenunterschied. */
function cases(total: number, different: number): Case[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `zutat-${String(i).padStart(2, '0')}`,
    ref: `X1000${String(i).padStart(2, '0')}`,
    file: i < different ? DIFFERENT : MATCHING,
    source: SOURCE,
  }));
}

/** Eintrag so, wie ihn eine Claude-Sitzung aus dem Import-Bericht erzeugt (an die Werte des Laufs gebunden). */
function confirm(c: Case, extra: Partial<ConfirmedDifference> = {}): ConfirmedDifference {
  return {
    alpha5_id: c.id,
    source: { db: 'bls', version: '4.0' },
    source_ref: c.ref,
    source_values: {
      kcal: c.source.kcal,
      protein_g: c.source.protein_g,
      carbs_g: c.source.carbs_g,
      fat_g: c.source.fat_g,
    },
    file_values: { ...c.file },
    reason_de: 'Gründer-Wert ist ein grober Wert aus einer anderen Tabelle.',
    confirmed_by: 'ktrautmann1992-commits',
    confirmed_at: '2026-10-13',
    ...extra,
  };
}

const verdictOf = (out: ImportOutput) => reviewVerdict(out.report);

describe('Liste „bestätigte Datenunterschiede“: Datei und Schema', () => {
  it('eingecheckte Datei ist gültig und liegt außerhalb von content/foods/', () => {
    expect(CONFIRMED_DIFFERENCES_PATH.startsWith('content/food-mapping/')).toBe(true);
    const entries = parseConfirmedDifferences(
      JSON.parse(readFileSync(join(REAL_REPO_ROOT, CONFIRMED_DIFFERENCES_PATH), 'utf8')),
    );
    // Jeder Eintrag muss zu einer Zutat der Zuordnung mit derselben Quell-ID gehören.
    const mapping = parseFoodMapping(
      JSON.parse(readFileSync(join(REAL_REPO_ROOT, FOOD_MAPPING_PATH), 'utf8')),
    );
    for (const entry of entries) {
      const mapped = mapping.items.find((i) => i.alpha5_id === entry.alpha5_id);
      expect(mapped?.source.ref).toBe(entry.source_ref);
    }
  });

  it('steht NICHT in CODEOWNERS (Gründer-Entscheidung 13.10.2026, Option a: Gründer merged selbst)', () => {
    // Mit einem GitHub-Konto wäre ein von Claude geöffneter Bestätigungs-PR unter CODEOWNERS nicht mergebar.
    // Die Schranke ist die Regel „nur ein Gründer merged“ (docs/SETUP.md J3), nicht CODEOWNERS.
    const owners = readFileSync(join(REAL_REPO_ROOT, '.github/CODEOWNERS'), 'utf8');
    expect(owners).not.toMatch(/bestaetigte-abweichungen/);
    expect(owners).not.toMatch(/^\/content\/food-mapping\//m);
  });

  it('Platzhalter „AUSFÜLLEN“ in Grund oder Name → ungültig (nicht ausgefüllt = nie wirksam)', () => {
    const entry = confirm(cases(1, 1)[0] as Case);
    const file = (e: unknown) => ({
      format: 'alpha5-bestaetigte-abweichungen',
      version: 1,
      note_de: 'Test.',
      entries: [e],
    });
    expect(() =>
      parseConfirmedDifferences(
        file({ ...entry, reason_de: `${CONFIRMATION_PLACEHOLDER}: Grund` }),
      ),
    ).toThrow(/reason_de/);
    expect(() =>
      parseConfirmedDifferences(file({ ...entry, confirmed_by: CONFIRMATION_PLACEHOLDER })),
    ).toThrow(/confirmed_by/);
  });

  it('Schema: alle Bindungsfelder Pflicht, keine Zusatzfelder, keine doppelten Zutaten', () => {
    const entry = confirm(cases(1, 1)[0] as Case);
    const file = (entries: unknown[]) => ({
      format: 'alpha5-bestaetigte-abweichungen',
      version: 1,
      note_de: 'Test.',
      entries,
    });
    expect(parseConfirmedDifferences(file([entry]))).toEqual([entry]);
    expect(() => parseConfirmedDifferences(file([entry, entry]))).toThrow(/doppelt/);
    const withoutFile: Partial<ConfirmedDifference> = { ...entry };
    delete withoutFile.file_values;
    expect(() => parseConfirmedDifferences(file([withoutFile]))).toThrow(/file_values/);
    expect(() =>
      parseConfirmedDifferences(file([{ ...entry, source_values: { kcal: 1 } }])),
    ).toThrow(/source_values/);
    expect(() => parseConfirmedDifferences(file([{ ...entry, extra: true }]))).toThrow();
    expect(() => parseConfirmedDifferences(file([{ ...entry, reason_de: 'kurz' }]))).toThrow(
      /reason_de/,
    );
    expect(() =>
      parseConfirmedDifferences(file([{ ...entry, confirmed_at: '13.10.2026' }])),
    ).toThrow(/confirmed_at/);
    expect(() =>
      parseConfirmedDifferences({ ...file([]), format: 'alpha5-food-mapping' }),
    ).toThrow();
  });
});

describe('Liste „bestätigte Datenunterschiede“: Wirkung im Import', () => {
  it('ohne Liste: 3 von 20 (15 %) „Zuordnung prüfen“ → ⛔', () => {
    const verdict = verdictOf(run(cases(20, 3)));
    expect(verdict.open).toHaveLength(3);
    expect(verdict.blocked).toBe(true);
  });

  it('bestätigt und passend → 🟠, sichtbar im Bericht, zählt NICHT zur 10-%-Regel', () => {
    const all = cases(20, 3);
    const out = run(
      all,
      all.slice(0, 3).map((c) => confirm(c)),
    );
    const verdict = verdictOf(out);
    expect(verdict.open).toEqual([]);
    expect(verdict.confirmed).toEqual(['zutat-00', 'zutat-01', 'zutat-02']);
    expect(verdict.confirmedShare).toBeCloseTo(0.15);
    expect(verdict.blocked).toBe(false);
    // Abweichungen bleiben vollständig im Bericht (nichts verschwindet), nur die Markierung wechselt.
    expect(out.report.deviations.filter((d) => d.level === 'review')).toHaveLength(3);
    const md = formatImportReport(out.report, []);
    expect(md).toContain('🟠 `zutat-00` | kcal | 140 | 100 |');
    expect(md).not.toContain('🔴 `zutat-00`');
    expect(md).toContain('(🔴 offen: 0, 🟠 bestätigt: 3)');
    expect(md).toMatch(
      /Bestätigte Datenunterschiede.*\n\n.*\n.*\n\| 🟠 `zutat-00` \| Gründer-Wert/,
    );
    expect(reviewShareNote(out.report, 20)).toMatch(
      /^Merge-Regel: .*🔴 0 offen \(0,0 %\), 🟠 3 bestätigt \(15,0 %\) von 20/,
    );
  });

  it('nur ein Teil bestätigt: die offenen zählen weiter (2 von 20 = 10 % → kein ⛔)', () => {
    const all = cases(20, 4);
    const verdict = verdictOf(
      run(
        all,
        all.slice(0, 2).map((c) => confirm(c)),
      ),
    );
    expect(verdict.open).toEqual(['zutat-02', 'zutat-03']);
    expect(verdict.openShare).toBeCloseTo(MAX_REVIEW_SHARE);
    expect(verdict.blocked).toBe(false);
  });

  it.each<[string, (c: Case) => ConfirmedDifference, RegExp]>([
    [
      'Quellwert geändert',
      (c) => confirm(c, { source_values: { ...confirm(c).source_values, kcal: 101 } }),
      /Quelle kcal 101 ≠ 100/,
    ],
    [
      'Fett der Quelle geändert',
      (c) => confirm(c, { source_values: { ...confirm(c).source_values, fat_g: 2.3 } }),
      /Quelle fat_g 2\.3 ≠ 2\.2/,
    ],
    [
      'Gründer-Wert geändert',
      (c) => confirm(c, { file_values: { ...c.file, kohlenhydrate_g: 11 } }),
      /Gründer-Datei kohlenhydrate_g 11 ≠ 10/,
    ],
    ['andere Quell-ID', (c) => confirm(c, { source_ref: 'X999999' }), /Quell-ID X999999 ≠/],
    [
      'andere Quellversion',
      (c) => confirm(c, { source: { db: 'bls', version: '4.1' } }),
      /Quelle bls 4\.1 ≠ bls 4\.0/,
    ],
  ])('%s → Eintrag ungültig, Zutat wieder „Zuordnung prüfen“ (🔴)', (_name, make, message) => {
    const all = cases(20, 1);
    const out = run(all, [make(all[0] as Case)]);
    expect(out.report.confirmed).toEqual([]);
    expect(out.report.invalidConfirmations).toEqual([
      { id: 'zutat-00', problems: [expect.stringMatching(message) as unknown as string] },
    ]);
    expect(verdictOf(out).open).toEqual(['zutat-00']);
    const md = formatImportReport(out.report, []);
    expect(md).toContain('🔴 `zutat-00`');
    expect(md).toMatch(/Bestätigungen ungültig.*\n\n- `zutat-00`: /);
  });

  it('Einträge ohne Wirkung werden gemeldet (Zutat ohne „Zuordnung prüfen“ oder nicht verglichen)', () => {
    const all = cases(20, 0);
    const out = run(all, [
      confirm(all[0] as Case),
      { ...confirm(all[1] as Case), alpha5_id: 'gibt-es-nicht' },
    ]);
    expect(out.report.confirmed).toEqual([]);
    expect(out.report.unusedConfirmations).toEqual(['gibt-es-nicht', 'zutat-00']);
    expect(formatImportReport(out.report, [])).toMatch(/Bestätigungen ohne Wirkung.*`zutat-00`/);
  });

  it('Bericht: je 🔴-Zutat ein kopierfertiger Eintrag; kopiert + ausgefüllt ist er gültig und wirkt (Wächter LOD, S2)', () => {
    // Zutat mit Lesart: Die Gründer-Datei zählt Ballaststoffe zu den KH (Quelle 10 + 8 = 18 statt 10), dazu echter
    // kcal-Unterschied. Die Abweichungstabelle zeigt bei KH den Lesart-Wert 18 – die Bindung braucht aber 10.
    const reading: Case = {
      id: 'zutat-lesart',
      ref: 'X200000',
      file: { kcal: 140, eiweiss_g: 10, kohlenhydrate_g: 18, fett_g: 2.2 },
      source: { ...SOURCE, fiber_g: 8 },
    };
    const all = [...cases(19, 1), reading];
    // zutat-00 mit veralteter (ungültiger) Bestätigung: bekommt ebenfalls eine neue Vorlage.
    const stale = confirm(all[0] as Case, {
      source_values: { ...confirm(all[0] as Case).source_values, kcal: 99 },
    });
    const out = run(all, [stale]);
    expect(out.report.confirmationDrafts.map((d) => d.alpha5_id)).toEqual([
      'zutat-00',
      'zutat-lesart',
    ]);
    const md = formatImportReport(out.report, []);
    const block =
      /<details>\n<summary>📋 Kopierfertige Einträge für content\/food-mapping\/bestaetigte-abweichungen\.json \(🔴 offen: 2\)<\/summary>[\s\S]*?```json\n([\s\S]*?)\n```\n\n<\/details>/.exec(
        md,
      );
    expect(block).not.toBeNull();
    const copied = JSON.parse(block?.[1] ?? '[]') as ConfirmedDifference[];
    const lesart = copied.find((d) => d.alpha5_id === 'zutat-lesart');
    // Rohwerte der Quelle (carbs_g 10), nicht der Lesart-Wert (18); alle acht Werte, Quelle und Quell-ID.
    expect(lesart).toMatchObject({
      source: { db: 'bls', version: '4.0' },
      source_ref: 'X200000',
      source_values: { kcal: 100, protein_g: 10, carbs_g: 10, fat_g: 2.2 },
      file_values: { kcal: 140, eiweiss_g: 10, kohlenhydrate_g: 18, fett_g: 2.2 },
    });
    expect(lesart?.reason_de).toContain(CONFIRMATION_PLACEHOLDER);
    expect(lesart?.confirmed_by).toContain('kein Nachweis');
    const asFile = (entries: unknown[]) => ({
      format: 'alpha5-bestaetigte-abweichungen',
      version: 1,
      note_de: 'Aus dem Bericht kopiert.',
      entries,
    });
    // Unverändert kopiert: Schema lehnt die Platzhalter ab.
    expect(() => parseConfirmedDifferences(asFile(copied))).toThrow(/Platzhalter/);
    // Nur die drei Platzhalter ausgefüllt: gültig, Bindung passt exakt, beide Zutaten werden 🟠.
    const filled = parseConfirmedDifferences(
      asFile(
        copied.map((d) => ({
          ...d,
          reason_de: 'Gründer-Wert stammt aus einer anderen Tabelle.',
          confirmed_by: 'Gründer',
          confirmed_at: '2026-10-13',
        })),
      ),
    );
    const again = run(all, filled);
    expect(again.report.invalidConfirmations).toEqual([]);
    expect(again.report.confirmed.map((c) => c.id)).toEqual(['zutat-00', 'zutat-lesart']);
    expect(again.report.confirmationDrafts).toEqual([]);
    expect(formatImportReport(again.report, [])).not.toContain('Kopierfertige Einträge');
  });

  it('Deckel: höchstens 20 % bestätigt – 4 von 20 erlaubt, 5 von 20 → ⛔ trotz gültiger Liste', () => {
    expect(MAX_CONFIRMED_SHARE).toBe(0.2);
    const four = cases(20, 4);
    expect(
      verdictOf(
        run(
          four,
          four.slice(0, 4).map((c) => confirm(c)),
        ),
      ).blocked,
    ).toBe(false);
    const five = cases(20, 5);
    const out = run(
      five,
      five.slice(0, 5).map((c) => confirm(c)),
    );
    const verdict = verdictOf(out);
    expect(verdict.open).toEqual([]);
    expect(verdict.confirmed).toHaveLength(5);
    expect(verdict.blocked).toBe(true);
    expect(reviewShareNote(out.report, 20)).toMatch(
      /^⛔ \*\*NICHT MERGEN.*\n- 5 von 20 verglichenen Zutaten \(25,0 %\) sind als Datenunterschied bestätigt – mehr als 20 %/,
    );
  });
});

describe('Vergiftete Datei bleibt ⛔ (Gegencheck-Fixture, 144 passende Paare)', () => {
  const n = (v: number | null | undefined) => v ?? 0;
  const base: Case[] = CROSSCHECK_PAIRS.map((row, i) => ({
    id: `paar-${String(i).padStart(3, '0')}`,
    ref: `P${String(i).padStart(6, '0')}`,
    file: { kcal: n(row[0]), eiweiss_g: n(row[1]), kohlenhydrate_g: n(row[2]), fett_g: n(row[3]) },
    source: {
      kcal: n(row[4]),
      protein_g: n(row[5]),
      carbs_g: n(row[6]),
      sugar_g: row[7] ?? null,
      fat_g: n(row[8]),
      sat_fat_g: row[9] ?? null,
      fiber_g: row[10] ?? null,
      salt_g: 0.1,
      polyols_g: row[11] ?? null,
    },
  }));
  /** Echter Lauf: 15 % der Zutaten mit (künstlichem) Datenunterschied, alle bestätigt → mergebar. */
  const genuine: Case[] = base.map((c, i) =>
    i % 7 === 0 ? { ...c, file: { ...c.file, kcal: Math.round(c.source.kcal * 1.5) + 30 } } : c,
  );
  const confirmations = genuine.filter((_, i) => i % 7 === 0).map((c) => confirm(c));

  const scale = (v: number | null | undefined, k: number) =>
    v === null || v === undefined ? null : Math.round(v * k * 1e6) / 1e6;
  const poisonings: [string, (list: Case[]) => Case[]][] = [
    [
      'alle Quellwerte × 0,85',
      (list) =>
        list.map((c) => ({
          ...c,
          source: {
            ...c.source,
            kcal: scale(c.source.kcal, 0.85) ?? 0,
            protein_g: scale(c.source.protein_g, 0.85) ?? 0,
            carbs_g: scale(c.source.carbs_g, 0.85) ?? 0,
            sugar_g: scale(c.source.sugar_g, 0.85),
            fat_g: scale(c.source.fat_g, 0.85) ?? 0,
            sat_fat_g: scale(c.source.sat_fat_g, 0.85),
            fiber_g: scale(c.source.fiber_g, 0.85),
            polyols_g: scale(c.source.polyols_g, 0.85),
          },
        })),
    ],
    [
      'Zeilen-Versatz um 1',
      (list) =>
        list.map((c, i) => ({ ...c, source: (list[(i + 1) % list.length] as Case).source })),
    ],
  ];

  it('richtige Datei mit Liste → mergebar (Ausgangslage)', () => {
    const verdict = verdictOf(run(genuine, confirmations));
    expect(verdict.compared).toBe(base.length);
    expect(verdict.confirmed.length).toBe(confirmations.length);
    expect(verdict.confirmedShare).toBeLessThanOrEqual(MAX_CONFIRMED_SHARE);
    expect(verdict.blocked).toBe(false);
  });

  it.each(poisonings)(
    '%s: Bestätigungen passen nicht mehr → ungültig, > 10 % offen → ⛔',
    (_name, poison) => {
      const out = run(poison(genuine), confirmations);
      const verdict = verdictOf(out);
      expect(out.report.confirmed).toEqual([]);
      expect(out.report.invalidConfirmations.length).toBe(confirmations.length);
      expect(verdict.openShare).toBeGreaterThan(MAX_REVIEW_SHARE);
      expect(verdict.blocked).toBe(true);
    },
  );

  it.each(poisonings)(
    '%s: auch eine an die vergiftete Datei angepasste Liste (alles „bestätigt“) bleibt ⛔ (Deckel)',
    (_name, poison) => {
      const poisoned = poison(genuine);
      const flagged = new Set(
        run(poisoned)
          .report.deviations.filter((d) => d.level === 'review')
          .map((d) => d.id),
      );
      const whitewash = poisoned.filter((c) => flagged.has(c.id)).map((c) => confirm(c));
      const verdict = verdictOf(run(poisoned, whitewash));
      expect(verdict.open).toEqual([]);
      expect(verdict.confirmedShare).toBeGreaterThan(MAX_CONFIRMED_SHARE);
      expect(verdict.blocked).toBe(true);
    },
  );
});

describe('Laden nur aus dem Stand des Laufs (main)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const repo = (content?: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'bestaetigt-'));
    dirs.push(dir);
    if (content !== undefined) {
      const full = join(dir, CONFIRMED_DIFFERENCES_PATH);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    return dir;
  };

  it('fehlende Datei = leere Liste; ungültige Datei = Fehler (nie still ignorieren)', () => {
    expect(loadConfirmations(repo())).toEqual([]);
    expect(() => loadConfirmations(repo('{'))).toThrow(/kein gültiges JSON/);
    expect(() => loadConfirmations(repo('{"format":"x","version":1}'))).toThrow(/ungültig/);
  });

  it('confirmationMismatches: exakter Vergleich (keine Toleranz), Rundung wie der Import', () => {
    const c = cases(1, 1)[0] as Case;
    const target = { db: 'bls', version: '4.0', ref: c.ref, source: c.source, file: c.file };
    expect(confirmationMismatches(confirm(c), target)).toEqual([]);
    expect(
      confirmationMismatches(confirm(c), {
        ...target,
        source: { ...c.source, protein_g: 10.000001 },
      }),
    ).toEqual(['Quelle protein_g 10 ≠ 10.000001']);
    expect(
      confirmationMismatches(confirm(c), {
        ...target,
        source: { ...c.source, protein_g: 10.0000001 },
      }),
    ).toEqual([]);
  });
});
