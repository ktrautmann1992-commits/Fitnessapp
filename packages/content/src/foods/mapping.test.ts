/**
 * Prüft die Vorschlagsdatei `content/food-mapping/alpha5-zuordnung.json` (Plan 19.3): alle 236 Zutaten der
 * Gründer-Datei genau einmal, keine Nährwerte, Schema gültig, Vorschläge widersprechen R18 (Pflichtgruppen aus
 * Namen und Quellgruppe) und R9 (Haltbarkeit) nicht.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkFoodFridgeDays, type Food, requiredFoodRules, satisfiesRule } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { FOOD_MAPPING_PATH, parseFoodMapping } from './mapping';

const raw: unknown = JSON.parse(readFileSync(join(REAL_REPO_ROOT, FOOD_MAPPING_PATH), 'utf8'));
const mapping = parseFoodMapping(raw);
const alpha5 = JSON.parse(
  readFileSync(join(REAL_REPO_ROOT, 'packages/content/seed/alpha5-rezepte.json'), 'utf8'),
) as { zutaten: { id: string; name: string }[] };

/** Lebensmittel-Attrappe aus einem Vorschlag – Nährwerte 0, Quell-Bezeichnung = Name (Quelle noch offen). */
function asFood(item: (typeof mapping.items)[number]): Food {
  return {
    id: item.food_id,
    version: 1,
    status: 'draft',
    name_de: item.name_de,
    aliases_de: item.aliases_de,
    shopping_category: item.shopping_category,
    pantry: item.pantry,
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
    units: item.units,
    groups: item.groups,
    animal: item.animal,
    meat_kind: item.meat_kind,
    pregnancy_caution: item.pregnancy_caution,
    alcohol: item.alcohol,
    max_fridge_days: item.max_fridge_days,
    freezable: item.freezable,
    substitutes: item.substitutes,
    source: {
      db: item.source.db,
      version: item.source.version,
      ref: 'offen',
      name: item.name_de,
      category: item.source.category,
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-11',
    },
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-11',
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      catalog_reviewed_by: null,
      catalog_reviewed_at: null,
    },
  };
}

describe('Zuordnung alpha5 → Quelle (Vorschlag, unbestätigt)', () => {
  it('enthält jede der 236 Zutaten genau einmal, mit dem Namen aus der Gründer-Datei', () => {
    expect(alpha5.zutaten).toHaveLength(236);
    expect(mapping.items.map((i) => i.alpha5_id)).toEqual(alpha5.zutaten.map((z) => z.id));
    expect(mapping.items.find((i) => i.alpha5_id === 'ei')?.food_id).toBe('huehnerei');
    for (const [index, item] of mapping.items.entries()) {
      expect(item.alpha5_name).toBe(alpha5.zutaten[index]?.name);
    }
  });

  it('ist als KI-Vorschlag gekennzeichnet und enthält keine Nährwerte', () => {
    expect(mapping.status).toBe('unbestaetigt');
    expect(mapping.origin).toBe('claude_session');
    const text = JSON.stringify(raw);
    for (const key of [
      'kcal',
      'protein',
      'eiweiss',
      'carbs',
      'kohlenhydrate',
      'fett_g',
      'fat_g',
      'pro_100g',
      'nutrients',
    ]) {
      expect(text).not.toContain(`"${key}`);
    }
  });

  it('Quell-IDs werden nicht geraten: offen (null) oder aus einem Kandidatenlauf eingetragen', () => {
    for (const item of mapping.items) {
      expect(item.source.db).toBe('bls');
      expect(item.source.version).toBe('4.0');
      expect(item.source.search.length).toBeGreaterThan(0);
      expect(item.reason_de.length).toBeGreaterThan(20);
    }
  });

  it('Vorschläge erfüllen die Pflichtregeln R18 (Namen, Quellgruppe, Tierart) und R9', () => {
    const problems: string[] = [];
    for (const item of mapping.items) {
      const food = asFood(item);
      for (const [rule, reasons] of requiredFoodRules(food)) {
        if (!satisfiesRule(food, rule)) {
          problems.push(`${item.food_id}: ${rule} (${reasons.map((r) => r.detail).join(', ')})`);
        }
      }
      for (const issue of checkFoodFridgeDays(food)) {
        problems.push(`${item.food_id}: ${issue.message}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
