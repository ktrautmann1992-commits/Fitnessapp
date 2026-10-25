/**
 * Prüft die Vorschlagsdatei `content/food-mapping/alpha5-zuordnung.json` (Plan 19.3): alle 266 Zutaten der
 * Gründer-Datei genau einmal, keine Nährwerte, Schema gültig, Vorschläge widersprechen R18 (Pflichtgruppen aus
 * Namen und Quellgruppe) und R9 (Haltbarkeit) nicht.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkFoodFridgeDays, type Food, requiredFoodRules, satisfiesRule } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { FOOD_MAPPING_PATH, parseFoodMapping } from './mapping';

/** Format eines BLS-4.0-Schlüssels (geprüft an allen Codes der Summary des Laufs „kandidaten“ vom 12.10.2026). */
const BLS_REF = /^[A-Z][0-9A-Z]{6}$/;
/** Schweizer Nährwertdatenbank: Quell-ID wie `keyPattern` in sources.ts (bis zur Prüfung an der Datei angenommen). */
const CH_REF = /^[0-9]{1,7}$/;

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
  it('enthält jede der 266 Zutaten genau einmal, mit dem Namen aus der Gründer-Datei', () => {
    expect(alpha5.zutaten).toHaveLength(266);
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
      // Hauptquelle BLS 4.0; Zweitquelle Schweizer Nährwertdatenbank 7.1 nur für Zutaten ohne BLS-Zeile (Plan 19.3).
      expect([`${item.source.db} ${item.source.version}`], item.food_id).toEqual([
        expect.stringMatching(/^(bls 4\.0|ch_naehrwertdatenbank 7\.1)$/),
      ]);
      expect(item.source.search.length).toBeGreaterThan(0);
      expect(item.reason_de.length).toBeGreaterThan(20);
      const ref = item.source.ref;
      if (ref !== null) {
        // BLS-4.0-Schlüssel: Großbuchstabe + 6 Ziffern/Großbuchstaben (z. B. „F110100“, „F3B4902“).
        expect(ref, item.food_id).toMatch(item.source.db === 'bls' ? BLS_REF : CH_REF);
        // Jede eingetragene Quell-ID ist begründet (Herkunft aus dem Kandidatenlauf, Rohzustand).
        expect(item.reason_de, item.food_id).toContain(`Quell-ID ${ref} `);
      }
    }
  });

  it('BLS-Format der Quell-IDs: Gegenproben', () => {
    for (const ok of ['F110100', 'F3B4902', 'Y9A1050', 'M0A1000']) {
      expect(ok).toMatch(BLS_REF);
    }
    for (const bad of ['f110100', 'F11010', 'F1101000', '1110100', 'F110 100', 'offen', '']) {
      expect(bad).not.toMatch(BLS_REF);
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
