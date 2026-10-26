/**
 * Zuordnungsdatei „Auswärts essen“ (G-AV2): Prüfung in content:validate (blockierend: Schema, Begründung, unbekannte
 * Lebensmittel, doppelte Zuordnung; Hinweis: „wartet auf Import“), Übergabe an foods-import und Vorschläge für neue
 * Lebensmittel gegen R18/R9 (wie alpha5-zuordnung.json in mapping.test.ts).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkFoodFridgeDays,
  EATING_OUT_MAPPING_PATH,
  type Food,
  parseEatingOutMapping,
  requiredFoodRules,
  satisfiesRule,
} from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { blockingCount, formatMarkdownSummary, validateRepository } from '../validate';
import {
  checkEatingOutMapping,
  eatingOutFoodAsMappingItem,
  withEatingOutFoods,
} from './eating-out-mapping';
import { loadImportMapping } from './foods-import';
import { FOOD_MAPPING_PATH, mappingItemSchema, parseFoodMapping } from './mapping';

const raw: unknown = JSON.parse(
  readFileSync(join(REAL_REPO_ROOT, EATING_OUT_MAPPING_PATH), 'utf8'),
);
const parsed = parseEatingOutMapping(raw);
if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
const mapping = parsed.mapping;
const alpha5 = parseFoodMapping(
  JSON.parse(readFileSync(join(REAL_REPO_ROOT, FOOD_MAPPING_PATH), 'utf8')),
);

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Inhalts-Ordner mit Zuordnungsdateien (ohne Katalog). */
function contentDir(eatingOut: unknown, alpha5Items: { food_id: string }[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'auswaerts-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'food-mapping'), { recursive: true });
  writeFileSync(
    join(dir, 'food-mapping/auswaerts-zuordnung.json'),
    typeof eatingOut === 'string' ? eatingOut : JSON.stringify(eatingOut),
  );
  writeFileSync(
    join(dir, 'food-mapping/alpha5-zuordnung.json'),
    JSON.stringify({ items: alpha5Items }),
  );
  return dir;
}

// Fixture: erstes Lebensmittel der echten Datei, aber immer ohne Quell-ID (unabhängig vom Import-Stand).
const firstFood = mapping.foods[0] as (typeof mapping.foods)[number];
const newFood = { ...firstFood, source: { ...firstFood.source, ref: null } };
function file(items: { food_id: string; g: number }[], extra: Record<string, unknown> = {}) {
  return {
    format: 'alpha5-auswaerts-zuordnung',
    version: 1,
    status: 'entwurf',
    fachpruefung_de: 'VOR LIVEGANG FACHLICH PRÜFEN',
    origin: 'claude_session',
    model: 'claude-opus-5-5',
    created_on: '2026-10-26',
    note_de: 'Testzuordnung (erfunden).',
    foods: [newFood],
    dishes: [
      {
        id: 'auswaerts-test',
        name_de: 'Testgericht',
        category: 'imbiss',
        portion: 'plate',
        basis_de: '1 Teller',
        items,
        source_de: 'Annahme: Testportion.',
        status: 'draft',
        ...extra,
      },
    ],
  };
}

/** Lebensmittel-Attrappe aus einem Vorschlag (Nährwerte 0, Quell-Bezeichnung = Name) – wie mapping.test.ts. */
function asFood(food: (typeof mapping.foods)[number]): Food {
  return {
    id: food.food_id,
    version: 1,
    status: 'draft',
    name_de: food.name_de,
    aliases_de: food.aliases_de,
    shopping_category: food.shopping_category,
    pantry: food.pantry,
    nutrients_per_100g: {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      sugar_g: 0,
      fat_g: 0,
      sat_fat_g: 0,
      fiber_g: 0,
      salt_g: 0,
    },
    units: food.units,
    groups: food.groups,
    animal: food.animal,
    meat_kind: food.meat_kind,
    pregnancy_caution: food.pregnancy_caution,
    alcohol: food.alcohol,
    max_fridge_days: food.max_fridge_days,
    freezable: food.freezable,
    substitutes: food.substitutes,
    source: {
      db: food.source.db,
      version: food.source.version,
      ref: 'offen',
      name: food.name_de,
      category: food.source.category,
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-26',
    },
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-26',
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      catalog_reviewed_by: null,
      catalog_reviewed_at: null,
    },
  };
}

describe('Auswärts-Zuordnung im Repository', () => {
  it('ist Entwurf „VOR LIVEGANG FACHLICH PRÜFEN“ und enthält keine Nährwerte', () => {
    expect(mapping.status).toBe('entwurf');
    expect(mapping.fachpruefung_de).toBe('VOR LIVEGANG FACHLICH PRÜFEN');
    expect(mapping.dishes.every((d) => d.status === 'draft')).toBe(true);
    const text = JSON.stringify(raw);
    for (const key of ['kcal', 'protein', 'eiweiss', 'carbs', 'fat_g', 'fett', 'nutrients']) {
      expect(text).not.toContain(`"${key}`);
    }
  });

  it('Quell-IDs der neuen Lebensmittel werden nicht geraten (offen bis zum Kandidatenlauf)', () => {
    for (const food of mapping.foods) {
      expect(food.source.db).toBe('bls');
      expect(food.source.version).toBe('4.0');
      if (food.source.ref !== null) {
        expect(food.reason_de, food.food_id).toContain(`Quell-ID ${food.source.ref} `);
      }
    }
  });

  it('neue Lebensmittel: von foods-import angenommen, keine doppelte Zuordnung, R18 und R9 erfüllt', () => {
    const combined = withEatingOutFoods(alpha5, mapping);
    expect(combined.items).toHaveLength(alpha5.items.length + mapping.foods.length);
    const problems: string[] = [];
    for (const food of mapping.foods) {
      expect(mappingItemSchema.safeParse(eatingOutFoodAsMappingItem(food)).success).toBe(true);
      const asCatalog = asFood(food);
      for (const [rule, reasons] of requiredFoodRules(asCatalog)) {
        if (!satisfiesRule(asCatalog, rule)) {
          problems.push(`${food.food_id}: ${rule} (${reasons.map((r) => r.detail).join(', ')})`);
        }
      }
      for (const issue of checkFoodFridgeDays(asCatalog)) {
        problems.push(`${food.food_id}: ${issue.message}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('foods-import liest beide Dateien (Stand main)', () => {
    const combined = loadImportMapping(REAL_REPO_ROOT);
    expect(combined.items.find((i) => i.food_id === 'butter')?.source.search).toContain('Butter');
  });

  it('content:validate: 0 blockierend, Hinweis „wartet auf Import“ mit Lebensmittelliste', () => {
    const report = validateRepository({ cwd: REAL_REPO_ROOT });
    expect(report.strayFiles.filter((f) => f.includes('auswaerts'))).toEqual([]);
    expect(report.notes?.some((n) => /warten auf Import/.test(n) && n.includes('butter'))).toBe(
      true,
    );
    expect(formatMarkdownSummary(report)).toContain('#### Hinweise');
  });
});

describe('checkEatingOutMapping (Fixtures)', () => {
  it('ohne Datei: keine Befunde', () => {
    const dir = mkdtempSync(join(tmpdir(), 'auswaerts-leer-'));
    dirs.push(dir);
    expect(checkEatingOutMapping(dir, new Set())).toEqual({ problems: [], notes: [] });
  });

  it('alles im Katalog → keine Befunde, keine Hinweise', () => {
    const dir = contentDir(file([{ food_id: newFood.food_id, g: 100 }]));
    expect(checkEatingOutMapping(dir, new Set([newFood.food_id]))).toEqual({
      problems: [],
      notes: [],
    });
  });

  it('wartet auf Import (Abschnitt foods oder alpha5-zuordnung) → nur Hinweis', () => {
    const dir = contentDir(
      file([
        { food_id: newFood.food_id, g: 100 },
        { food_id: 'mehl-test', g: 50 },
      ]),
      [{ food_id: 'mehl-test' }],
    );
    const check = checkEatingOutMapping(dir, new Set());
    expect(check.problems).toEqual([]);
    expect(check.notes.join('\n')).toMatch(/2 Lebensmittel warten auf Import/);
    expect(check.notes.join('\n')).toMatch(/ohne Quell-ID/);
  });

  it('blockiert: unbekanntes Lebensmittel, fehlende Begründung, kaputtes JSON, doppelte Zuordnung', () => {
    const unknown = checkEatingOutMapping(
      contentDir(file([{ food_id: 'gibt-es-nicht', g: 100 }])),
      new Set(),
    );
    expect(unknown.problems.join('\n')).toMatch(/unbekanntes Lebensmittel „gibt-es-nicht“/);

    const noSource = file([{ food_id: newFood.food_id, g: 100 }]);
    delete (noSource.dishes[0] as { source_de?: string }).source_de;
    expect(checkEatingOutMapping(contentDir(noSource), new Set()).problems.join('\n')).toMatch(
      /source_de/,
    );

    expect(checkEatingOutMapping(contentDir('{ kaputt'), new Set()).problems[0]).toMatch(
      /kein gültiges JSON/,
    );

    const doubled = checkEatingOutMapping(
      contentDir(file([{ food_id: newFood.food_id, g: 100 }]), [{ food_id: newFood.food_id }]),
      new Set(),
    );
    expect(doubled.problems.join('\n')).toMatch(/schon in alpha5-zuordnung\.json/);
  });

  it('blockierende Befunde lassen content:validate scheitern', () => {
    const dir = contentDir(file([{ food_id: 'gibt-es-nicht', g: 100 }]));
    const report = validateRepository({ cwd: dir, contentDir: dir });
    expect(blockingCount(report)).toBeGreaterThan(0);
  });

  it('freigegebenes Gericht mit wartender Zutat → Hinweis', () => {
    const dir = contentDir(
      file([{ food_id: newFood.food_id, g: 100 }], {
        status: 'released',
        reviewed_by: 'Test',
        reviewed_at: '2026-10-26',
      }),
    );
    expect(checkEatingOutMapping(dir, new Set()).notes.join('\n')).toMatch(
      /ist freigegeben, aber eine Zutat wartet auf Import/,
    );
  });
});
