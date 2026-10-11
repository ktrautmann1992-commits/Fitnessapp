/**
 * Regeln, die beim Abgleich der 236 Zutaten aus alpha5-rezepte.json mit R18/R9 aufgefallen sind (Etappe N2b,
 * `content/food-mapping/alpha5-zuordnung.json`): Schweinehackfleisch ist kein Rind, Sojaskyr kein Milchprodukt,
 * Reisessig kein gekochter Reis. Gegenprobe: echte Treffer bleiben.
 */
import { describe, expect, it } from 'vitest';

import { requiredFoodRules } from './allergen-rules';
import type { Food, SourceFoodCategory } from './food-schema';
import { makeFood } from './nutrition-fixtures';
import { checkFoodFridgeDays } from './recipe-checks';

function food(name: string, category: SourceFoodCategory = 'other', extra: Partial<Food> = {}) {
  return makeFood({
    id: 'probe-lebensmittel',
    name_de: name,
    aliases_de: [],
    groups: [],
    animal: [],
    meat_kind: [],
    max_fridge_days: 3,
    ...extra,
    source: { ...makeFood().source, name, category },
  });
}
const required = (name: string, category?: SourceFoodCategory) => [
  ...requiredFoodRules(food(name, category)).keys(),
];

describe('N2b: Schweinehackfleisch', () => {
  it('„Schweinehackfleisch“/„Schweinehack“ → Schwein, aber weder Rind noch „gemischtes Hack“', () => {
    for (const name of ['Schweinehackfleisch', 'Schweinehack', 'Schweinshackfleisch']) {
      const keys = required(name);
      expect(keys).toContain('pork');
      expect(keys).not.toContain('beef');
      expect(keys).not.toContain('mixed_mince');
    }
  });

  it('ausdrücklich gemischt (auch mit Schwein vorn) → Rind + Schwein + gemischtes Hack (Wächter N2b, K1)', () => {
    for (const name of [
      'Schweinehackfleisch gemischt',
      'Hackfleisch gemischt',
      'Gemischtes Hack',
      'Hackfleisch halb und halb',
    ]) {
      expect(required(name)).toEqual(expect.arrayContaining(['beef', 'pork', 'mixed_mince']));
    }
    expect(required('Gemischter Salat')).not.toContain('mixed_mince');
  });

  it('Gegenprobe: Hackfleisch ohne Tierart bleibt Rind + Schwein', () => {
    expect(required('Hackfleisch')).toEqual(expect.arrayContaining(['beef', 'mixed_mince']));
    expect(required('Hackfleisch vom Schwein')).toContain('mixed_mince');
  });
});

describe('N2b: Sojaskyr', () => {
  it('„Sojaskyr“/„Haferskyr“ sind keine Milchprodukte; „Skyr“ bleibt dairy', () => {
    expect(required('Sojaskyr natur')).not.toContain('dairy');
    expect(required('Haferskyr')).not.toContain('dairy');
    expect(required('Skyr natur')).toEqual(expect.arrayContaining(['dairy', 'lactose']));
  });
});

describe('N2b: Reisessig (R9)', () => {
  it('Reisessig/Reiswein ohne 1-Tag-Grenze; Reis selbst weiter 1 Tag', () => {
    expect(checkFoodFridgeDays(food('Reisessig', 'spices_sauces'))).toEqual([]);
    expect(checkFoodFridgeDays(food('Reiswein', 'alcoholic_beverages'))).toEqual([]);
    expect(checkFoodFridgeDays(food('Basmatireis', 'cereal_products'))).toHaveLength(1);
    expect(checkFoodFridgeDays(food('Milchreis', 'cereal_products'))).toHaveLength(1);
  });
});
