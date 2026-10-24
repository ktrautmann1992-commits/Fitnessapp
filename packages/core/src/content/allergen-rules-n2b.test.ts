/**
 * Regeln, die beim Abgleich der 236 Zutaten aus alpha5-rezepte.json mit R18/R9 aufgefallen sind (Etappe N2b,
 * `content/food-mapping/alpha5-zuordnung.json`): Schweinehackfleisch ist kein Rind, Sojaskyr kein Milchprodukt,
 * Reisessig kein gekochter Reis. Gegenprobe: echte Treffer bleiben.
 */
import { describe, expect, it } from 'vitest';

import { joinSpeciesMince, requiredFoodRules } from './allergen-rules';
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

describe('Fassung 1.1: Käsealternative (Kandidatenlauf 40093377661)', () => {
  it('„Käsealternative … vegan“ ist kein Milchprodukt; Käse und Käseersatz bleiben dairy', () => {
    for (const name of [
      'Käsealternative, Basis Pflanzenfett, vegan',
      'Käsealternative, Basis Cashewkerne, vegan',
      'Vegane Käsealternative (gerieben)',
    ]) {
      expect(required(name)).not.toContain('dairy');
      expect(required(name)).not.toContain('lactose');
    }
    expect(required('Reibekäse')).toEqual(expect.arrayContaining(['dairy', 'lactose']));
    expect(required('Käseersatz')).toContain('dairy');
    expect(required('Käse gerieben')).toContain('dairy');
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

describe('N2b: BLS-Schreibweise „Tierart Hackfleisch“ (Kandidatenlauf 12.10.2026)', () => {
  it('„Schwein Hackfleisch, roh“ → Schwein, aber weder Rind noch „gemischtes Hack“', () => {
    for (const name of ['Schwein Hackfleisch, roh', 'Schwein Hack']) {
      const keys = required(name);
      expect(keys).toContain('pork');
      expect(keys).not.toContain('beef');
      expect(keys).not.toContain('mixed_mince');
    }
  });

  it('„Rind Hackfleisch, roh“ → Rind, aber weder Schwein noch „gemischtes Hack“', () => {
    const keys = required('Rind Hackfleisch, roh');
    expect(keys).toContain('beef');
    expect(keys).not.toContain('pork');
    expect(keys).not.toContain('mixed_mince');
    expect(required('Pute Hackfleisch, roh')).not.toEqual(
      expect.arrayContaining(['beef', 'pork', 'mixed_mince']),
    );
  });

  it('Gegenprobe: gemischt bleibt Rind + Schwein + gemischtes Hack', () => {
    for (const name of [
      'Rind/Schwein, Hackfleisch gemischt, roh',
      'Schwein Hackfleisch gemischt',
      'Hackfleisch gemischt',
    ]) {
      expect(required(name)).toEqual(expect.arrayContaining(['beef', 'pork', 'mixed_mince']));
    }
  });

  it('B1: „<Tierart> Hack(fleisch) gemischt / halb und halb“ bleibt Rind + Schwein (auch zusammengeschrieben)', () => {
    for (const species of ['Rind', 'Kalb', 'Pute', 'Lamm', 'Schwein']) {
      for (const name of [
        `${species} Hackfleisch gemischt`,
        `${species} Hack gemischt`,
        `${species} Hackfleisch halb und halb`,
      ]) {
        expect(required(name), name).toEqual(
          expect.arrayContaining(['beef', 'pork', 'mixed_mince']),
        );
      }
    }
    for (const name of [
      'Rinderhackfleisch gemischt',
      'Kalbshack gemischt',
      'Putenhackfleisch gemischt',
      'Lammhack halb und halb',
      'Schweinehackfleisch halb und halb',
    ]) {
      expect(required(name), name).toEqual(expect.arrayContaining(['beef', 'pork', 'mixed_mince']));
    }
  });

  it('Gegenprobe ohne „gemischt“: Tierart allein bleibt ohne gemischtes Hack', () => {
    expect(required('Pute Hackfleisch, roh')).not.toContain('mixed_mince');
    expect(required('Lamm Hackfleisch, roh')).not.toContain('pork');
    // Tierart nicht direkt davor → keine Zusammenziehung, vorsichtig Rind + Schwein.
    expect(required('Hackfleisch vom Schwein')).toContain('mixed_mince');
    expect(required('Schwein mit Hackfleisch')).toContain('mixed_mince');
  });

  it('joinSpeciesMince zieht nur direkt aufeinanderfolgende Wörter zusammen', () => {
    expect(joinSpeciesMince('schwein hackfleisch roh')).toBe('schweinehackfleisch roh');
    expect(joinSpeciesMince('rind schwein hackfleisch gemischt roh')).toBe(
      'rind schweinehackfleisch gemischt roh',
    );
    expect(joinSpeciesMince('hackfleisch vom schwein')).toBe('hackfleisch vom schwein');
    expect(joinSpeciesMince('schwein hacksteak roh')).toBe('schwein hacksteak roh');
  });
});

describe('N2b: Senf mittelscharf ist nicht „spicy“ (nur Treffer aus der Quell-Bezeichnung)', () => {
  function senf(name: string, sourceName: string, aliases: string[] = []) {
    const f = food(name, 'spices_sauces');
    return [
      ...requiredFoodRules({
        ...f,
        aliases_de: aliases,
        source: { ...f.source, name: sourceName },
      }).keys(),
    ];
  }

  it('Quelle „Senf mittelscharf“ → keine Pflicht für spicy, Senf bleibt Pflicht', () => {
    expect(senf('Senf', 'Senf mittelscharf')).not.toContain('spicy');
    expect(senf('Senf', 'Senf mittelscharf')).toContain('mustard');
    expect(senf('Senf', 'Mittelscharfer Senf')).not.toContain('spicy');
  });

  it('S1: Name, Aliase und weitere Wörter der Quelle bleiben geprüft', () => {
    expect(senf('Scharfer Senf', 'Senf mittelscharf')).toContain('spicy');
    expect(senf('Chili-Senf', 'Senf mittelscharf')).toContain('spicy');
    expect(senf('Senf', 'Senf mittelscharf', ['Senf extra scharf'])).toContain('spicy');
    expect(senf('Senf', 'Senf mittelscharf mit Chili')).toContain('spicy');
    expect(senf('Senf mittelscharf mit Chili', 'Senf mittelscharf')).toContain('spicy');
    // „mittelscharf“ im eigenen Namen wird nicht neutralisiert (nur die Quelle).
    expect(senf('Senf mittelscharf', 'Senf')).toContain('spicy');
  });

  it('Gegenprobe: scharfer Senf und andere „mittelscharf“-Quellen bleiben spicy', () => {
    expect(senf('Senf', 'Senf extra scharf')).toContain('spicy');
    expect(senf('Senf', 'Senf scharf')).toContain('spicy');
    expect(senf('Salsa', 'Salsa mittelscharf')).toContain('spicy');
  });
});

describe('Lauf 38367139392: Fleischteile „Oberschale“/„Oberschenkel“ sind kein „Obers“', () => {
  it('BLS-Fleischteile → weder Milch noch Laktose', () => {
    for (const name of [
      'Schwein Schnitzel (Oberschale) roh',
      'Schwein Roulade (Oberschale) roh',
      'Schwein Oberschale (ohne Deckel) roh',
      'Rinderoberschale',
      'Hähnchen Oberschenkel, mit Haut, roh',
      'Hähnchenoberschenkel',
    ]) {
      const keys = required(name);
      expect(keys, name).not.toContain('dairy');
      expect(keys, name).not.toContain('lactose');
    }
  });

  it('Gegenprobe: „Obers“, „Schlagobers“, „Kaffeeobers“ bleiben Milch – auch neben einer Oberschale', () => {
    for (const name of [
      'Obers',
      'Schlagobers',
      'Kaffeeobers',
      'Oberschale in Obers',
      'Schweineoberschale mit Schlagobers',
    ]) {
      expect(required(name), name).toEqual(expect.arrayContaining(['dairy', 'lactose']));
    }
    expect(required('Schwein Schnitzel (Oberschale) roh', 'dairy')).toContain('dairy');
  });
});
