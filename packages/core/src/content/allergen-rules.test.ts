import { describe, expect, it } from 'vitest';

import { FOOD_GROUP_IDS, type FoodGroupId } from '../food-groups';
import {
  ALLERGEN_RULES,
  type AllergenRuleKey,
  matchWordRule,
  normalizeFoodText,
  requiredFoodRules,
  satisfiesRule,
} from './allergen-rules';
import type { Food, SourceFoodCategory } from './food-schema';
import { FIXTURE_FOODS, makeFood } from './nutrition-fixtures';

/** Pflichtmerkmale für ein Lebensmittel, das nur aus Name (und optional Quellgruppe) besteht. */
function required(
  name: string,
  category: SourceFoodCategory = 'other',
  extra: Partial<Food> = {},
): AllergenRuleKey[] {
  const food = makeFood({
    name_de: name,
    groups: [],
    animal: [],
    meat_kind: [],
    ...extra,
    source: { ...makeFood().source, name, category },
  });
  return [...requiredFoodRules(food).keys()];
}

describe('R18: Regeltabelle deckt alle 23 FOOD_GROUPS ab (W19, R2-B3)', () => {
  it('jeder Schlüssel ist eine FOOD_GROUPS-ID und keine Gruppe fehlt (Laufzeit, beide Richtungen)', () => {
    const keys = Object.keys(ALLERGEN_RULES).sort();
    expect(keys).toEqual([...FOOD_GROUP_IDS].sort());
    expect(keys).toHaveLength(23);
  });

  it('nur fructose und histamine sind ausdrücklich „nur Prüfung durch Menschen“ – mit Begründung', () => {
    const humanOnly = Object.entries(ALLERGEN_RULES)
      .filter(([, rule]) => rule.kind === 'human_only')
      .map(([id]) => id);
    expect(humanOnly.sort()).toEqual(['fructose', 'histamine']);
    for (const id of humanOnly) {
      const rule = ALLERGEN_RULES[id as FoodGroupId];
      expect(rule.kind === 'human_only' && rule.reason.length > 20).toBe(true);
    }
  });

  it('jede Wortregel hat mindestens ein Pflichtwort; Muster sind normalisiert (keine Umlaute/Großbuchstaben)', () => {
    for (const [id, rule] of Object.entries(ALLERGEN_RULES)) {
      if (rule.kind !== 'rule') {
        continue;
      }
      expect(rule.words.length, id).toBeGreaterThan(0);
      for (const word of [...rule.words, ...rule.negatives]) {
        expect(word, `${id}: ${word}`).toMatch(/^=?[a-z0-9 ]+$/);
      }
    }
  });
});

describe('normalizeFoodText', () => {
  it('Umlaute, ß, Akzente, Satzzeichen', () => {
    expect(normalizeFoodText('Crème fraîche, Jalapeño')).toBe('creme fraiche jalapeno');
    expect(normalizeFoodText('Hartweizengrieß')).toBe('hartweizengriess');
    expect(normalizeFoodText('Hühnerei (Größe M)')).toBe('huehnerei groesse m');
    expect(normalizeFoodText('Kokos-Milch')).toBe('kokos-milch');
  });
});

describe('matchWordRule: ganze Wortteile statt Teilzeichenketten (R2-S1)', () => {
  const rule = { words: ['=ei', 'eier', 'milch'], negatives: ['kokosmilch'] };
  it('trifft eigenes Wort, Wortanfang, Wortende und Bindestrich-Teile', () => {
    expect(matchWordRule(['Ei'], rule)).toHaveLength(1);
    expect(matchWordRule(['Eiernudeln'], rule)).toHaveLength(1);
    expect(matchWordRule(['Hühnereier'], rule)).toHaveLength(1);
    expect(matchWordRule(['Vollmilch'], rule)).toHaveLength(1);
    expect(matchWordRule(['Milchreis'], rule)).toHaveLength(1);
    expect(matchWordRule(['Ei-Nudeln'], rule)).toHaveLength(1);
  });
  it('trifft nie in der Wortmitte', () => {
    for (const text of ['Weizen', 'Reis', 'Fleisch', 'Eisbergsalat', 'Brei', 'Eis']) {
      expect(matchWordRule([text], rule), text).toEqual([]);
    }
  });
  it('Negativliste hebt Treffer auf – auch mit Bindestrich', () => {
    expect(matchWordRule(['Kokosmilch'], rule)).toEqual([]);
    expect(matchWordRule(['Kokos-Milch'], rule)).toEqual([]);
    expect(matchWordRule(['Kokosmilch und Vollmilch'], rule)).toHaveLength(1);
  });
  it('Wortfolgen', () => {
    expect(
      matchWordRule(['Crème fraîche'], { words: ['creme fraiche'], negatives: [] }),
    ).toHaveLength(1);
    expect(matchWordRule(['Creme'], { words: ['creme fraiche'], negatives: [] })).toEqual([]);
  });
});

describe('R18: Treffer, Negativliste und Grenzfall je Gruppe (Plan 5.1.3, W19)', () => {
  // [Name, muss enthalten, darf NICHT enthalten]
  const cases: [string, AllergenRuleKey[], AllergenRuleKey[]][] = [
    // gluten
    ['Weizenmehl Type 405', ['gluten'], []],
    ['Spaghetti', ['gluten'], ['eggs']],
    ['Nudeln', ['gluten'], []],
    ['Vollkornbrot', ['gluten'], []],
    ['Mehl', ['gluten'], []],
    ['Paniermehl', ['gluten'], []],
    ['Semmelbrösel', ['gluten'], []],
    ['Haferflocken', ['gluten'], []],
    ['Haferdrink', ['gluten'], ['dairy']],
    ['Dinkelbrötchen', ['gluten'], []],
    ['Sojasauce', ['gluten', 'soy'], []],
    ['Reismehl', [], ['gluten']],
    ['Buchweizenmehl', [], ['gluten']],
    ['Maistortilla', [], ['gluten']],
    ['Glasnudeln', [], ['gluten']],
    ['Reisnudeln', [], ['gluten']],
    ['Kichererbsenmehl', ['legumes'], ['gluten']],
    // dairy / lactose
    ['Vollmilch', ['dairy', 'lactose'], []],
    ['Mozzarella', ['dairy', 'lactose'], []],
    ['Parmesan', ['dairy'], []],
    ['Feta', ['dairy'], []],
    ['Skyr', ['dairy'], []],
    ['Crème fraîche', ['dairy'], []],
    ['Gouda', ['dairy'], []],
    ['Hüttenkäse', ['dairy'], []],
    ['Topfen', ['dairy'], []],
    ['Schlagrahm', ['dairy'], []],
    ['Kokosmilch', [], ['dairy', 'lactose']],
    ['Sojasahne', ['soy'], ['dairy']],
    ['Hafermilch', ['gluten'], ['dairy']],
    ['Mandelmilch', ['tree_nuts'], ['dairy']],
    ['Erdnussbutter', ['peanuts'], ['dairy']],
    ['Kakaobutter', [], ['dairy']],
    ['Butternusskürbis', [], ['dairy']],
    ['Leberkäse', ['pork', 'meat'], ['dairy', 'lactose']],
    ['Fleischkäse', ['meat', 'pork'], ['dairy', 'lactose']],
    // eggs
    ['Ei', ['eggs'], ['poultry']],
    ['Hühnerei', ['eggs'], ['poultry']],
    ['Eiernudeln', ['eggs', 'gluten'], []],
    ['Rührei', ['eggs'], []],
    ['Mayonnaise', ['eggs', 'mustard'], []],
    ['Weizen', ['gluten'], ['eggs']],
    ['Reis', [], ['eggs']],
    ['Rindfleisch', ['beef'], ['eggs']],
    ['Eisbergsalat', [], ['eggs']],
    ['Haferbrei', ['gluten'], ['eggs']],
    ['Eierschwammerl', ['mushrooms'], ['eggs']],
    ['Eiweißpulver', [], ['eggs']],
    // fish / shellfish
    ['Lachs', ['fish'], []],
    ['Kabeljau', ['fish'], []],
    ['Sardellen', ['fish'], []],
    ['Worcestersauce', ['fish'], []],
    ['Tintenfisch', ['shellfish'], ['fish']],
    ['Tintenfischringe', ['shellfish'], ['fish']],
    ['Garnelen', ['shellfish'], []],
    ['Miesmuscheln', ['shellfish'], []],
    ['Muschelnudeln', ['gluten'], ['shellfish']],
    ['Austernpilze', ['mushrooms'], ['shellfish']],
    ['Lachsschinken', ['pork', 'pregnancy_caution'], ['fish']],
    // poultry / beef / lamb
    ['Hähnchenbrust', ['poultry', 'meat'], []],
    ['Putenschnitzel', ['poultry'], []],
    ['Hendl', ['poultry'], []],
    ['Rinderhackfleisch', ['beef'], ['mixed_mince']],
    ['Kalbsschnitzel', ['beef'], []],
    ['Hackfleisch', ['beef', 'pork', 'meat', 'mixed_mince'], []],
    ['Faschiertes', ['beef', 'pork', 'mixed_mince'], []],
    ['Lammkeule', ['lamb', 'meat'], []],
    ['Schafskäse', ['dairy'], ['lamb']],
    ['Schafsmilch', ['dairy'], ['lamb']],
    // legumes / soy / peanuts / tree nuts
    ['Rote Linsen', ['legumes'], []],
    ['Kichererbsen', ['legumes'], []],
    ['Kidneybohnen', ['legumes'], []],
    ['Hummus', ['legumes'], []],
    ['Kaffeebohnen', [], ['legumes']],
    ['Tofu', ['soy'], []],
    ['Tempeh', ['soy'], []],
    ['Erdnüsse', ['peanuts'], ['tree_nuts']],
    ['Mandeln', ['tree_nuts'], []],
    ['Haselnüsse', ['tree_nuts'], []],
    ['Walnusskerne', ['tree_nuts'], []],
    ['Cashewkerne', ['tree_nuts'], []],
    ['Muskatnuss', [], ['tree_nuts']],
    ['Kokosnuss', [], ['tree_nuts']],
    // sesame / celery / mustard / lupin / sulphites
    ['Sesam', ['sesame'], []],
    ['Tahini', ['sesame'], []],
    ['Knollensellerie', ['celery'], []],
    ['Gemüsebrühe', ['celery'], []],
    ['Senf mittelscharf', ['mustard', 'spicy'], []],
    ['Lupinenmehl', ['lupin'], ['gluten']],
    ['Weinessig', ['sulphites'], ['alcohol']],
    ['Aceto Balsamico', ['sulphites'], []],
    ['Aprikosen getrocknet', ['sulphites'], []],
    ['Aprikose', [], ['sulphites']],
    // mushrooms / onion_garlic / spicy
    ['Champignons', ['mushrooms'], []],
    ['Steinpilze', ['mushrooms'], []],
    ['Hefeflocken', [], ['mushrooms']],
    ['Knoblauch', ['onion_garlic'], []],
    ['Frühlingszwiebeln', ['onion_garlic'], []],
    ['Schnittlauch', ['onion_garlic'], []],
    ['Chili', ['spicy'], []],
    ['Jalapeño', ['spicy'], []],
    ['Paprika edelsüß', [], ['spicy']],
    ['Pfeffer schwarz', [], ['spicy']],
    // Schwein, Gelatine, Schwangerschaft, Alkohol
    ['Speck', ['pork', 'meat'], []],
    ['Putenspeck', ['poultry'], ['pork']],
    ['Butterschmalz', ['dairy'], ['pork', 'meat']],
    ['Gelatine', ['gelatin'], []],
    ['Salami', ['pork', 'pregnancy_caution'], []],
    ['Rohmilchkäse', ['dairy', 'pregnancy_caution'], []],
    ['Räucherlachs', ['fish', 'pregnancy_caution'], []],
    ['Graved Lachs', ['fish', 'pregnancy_caution'], []],
    ['Parmaschinken', ['pork', 'pregnancy_caution'], []],
    ['Kalbsleber', ['beef', 'pregnancy_caution'], []],
    ['Leberwurst', ['pregnancy_caution', 'meat'], []],
    ['Sushi', ['pregnancy_caution'], []],
    ['Kochschinken', ['pork'], ['pregnancy_caution']],
    ['Rotwein', ['alcohol'], []],
    ['Bierschinken', ['pork'], ['alcohol']],
  ];

  it.each(cases)('„%s“', (name, must, mustNot) => {
    const keys = required(name);
    for (const key of must) {
      expect(keys, `${name} → ${key}`).toContain(key);
    }
    for (const key of mustNot) {
      expect(keys, `${name} ↛ ${key}`).not.toContain(key);
    }
  });

  it('jede Gruppe mit Wortregel kommt in den Testfällen als Treffer vor', () => {
    const hit = new Set(cases.flatMap(([, must]) => must));
    for (const [id, rule] of Object.entries(ALLERGEN_RULES)) {
      if (rule.kind === 'rule') {
        expect(hit.has(id as FoodGroupId), id).toBe(true);
      }
    }
  });

  it('Aliase und Bezeichnung der Quelle werden mitgeprüft', () => {
    const food = makeFood({
      name_de: 'Pasta-Mix',
      aliases_de: ['Topfen-Creme'],
      groups: [],
      source: { ...makeFood().source, name: 'Teigwaren mit Ei', category: 'other' },
    });
    const keys = [...requiredFoodRules(food).keys()];
    expect(keys).toEqual(expect.arrayContaining(['gluten', 'dairy', 'eggs']));
  });
});

describe('R18: Quell-Lebensmittelgruppe (R2-S1)', () => {
  it('Getreide → gluten, begründete Ausnahmen Reis/Mais/Hirse/Buchweizen/Quinoa', () => {
    expect(required('Graupen-Mix', 'cereal_products')).toContain('gluten');
    expect(required('Frühstücksflocken', 'cereal_products')).toContain('gluten');
    expect(required('Brötchen', 'bread_bakery')).toContain('gluten');
    for (const name of ['Reis parboiled', 'Maisgrieß', 'Hirse', 'Buchweizen', 'Quinoa']) {
      expect(required(name, 'cereal_products'), name).not.toContain('gluten');
    }
  });
  it('Milchprodukte → dairy + lactose; „laktosefrei“ nur in der Bezeichnung der Quelle', () => {
    expect(required('Hartkäse gerieben', 'dairy')).toEqual(
      expect.arrayContaining(['dairy', 'lactose']),
    );
    const viaName = makeFood({
      name_de: 'Laktosefreie Milch',
      groups: ['dairy'],
      animal: ['dairy'],
      source: { ...makeFood().source, name: 'Milch 1,5 % Fett', category: 'dairy' },
    });
    expect([...requiredFoodRules(viaName).keys()]).toContain('lactose');
    const viaSource = makeFood({
      name_de: 'Laktosefreie Milch',
      groups: ['dairy'],
      animal: ['dairy'],
      source: { ...makeFood().source, name: 'Milch laktosefrei 1,5 % Fett', category: 'dairy' },
    });
    const keys = [...requiredFoodRules(viaSource).keys()];
    expect(keys).toContain('dairy');
    expect(keys).not.toContain('lactose');
  });
  it('Fisch, Krebs-/Weichtiere, Fleisch nach Tierart, Eier, Pilze, Hülsenfrüchte', () => {
    expect(required('Filet', 'fish')).toContain('fish');
    expect(required('Filet', 'crustaceans_molluscs')).toContain('shellfish');
    expect(required('Filet', 'meat_pork')).toEqual(expect.arrayContaining(['pork', 'meat']));
    expect(required('Filet', 'meat_beef_veal')).toEqual(expect.arrayContaining(['beef', 'meat']));
    expect(required('Filet', 'meat_poultry')).toEqual(expect.arrayContaining(['poultry', 'meat']));
    expect(required('Keule', 'meat_lamb')).toEqual(expect.arrayContaining(['lamb', 'meat']));
    expect(required('Pulver', 'eggs')).toContain('eggs');
    expect(required('Kräuterseitlinge', 'mushrooms')).toContain('mushrooms');
    expect(required('Edamame', 'soy_products')).toEqual(expect.arrayContaining(['soy', 'legumes']));
  });
  it('Nüsse/Samen sind keine automatische Pflicht für tree_nuts (Einzelprüfung)', () => {
    expect(required('Kokosraspeln', 'nuts_seeds')).not.toContain('tree_nuts');
    const rule = ALLERGEN_RULES.tree_nuts;
    expect(rule.kind === 'rule' && rule.humanReview !== undefined).toBe(true);
  });
});

describe('R18: Folgeregeln aus tierischen Bestandteilen und Tierart', () => {
  it('animal egg/fish/shellfish/dairy ⇒ Gruppe (Hinweis: animal „egg“, Gruppe „eggs“)', () => {
    const keys = required('Zutat X', 'other', { animal: ['egg', 'fish', 'shellfish', 'dairy'] });
    expect(keys).toEqual(expect.arrayContaining(['eggs', 'fish', 'shellfish', 'dairy', 'lactose']));
  });
  it('meat_kind beef/poultry/lamb ⇒ Gruppe und Fleisch', () => {
    const keys = required('Zutat X', 'other', {
      animal: ['meat'],
      meat_kind: ['beef', 'poultry', 'lamb'],
    });
    expect(keys).toEqual(expect.arrayContaining(['beef', 'poultry', 'lamb', 'meat']));
  });
});

describe('satisfiesRule', () => {
  const base = makeFood({ groups: [], animal: [], meat_kind: [] });
  it('Schwein: pork oder unknown, Gelatine ohne/unbekannte/Schweine-Herkunft', () => {
    expect(satisfiesRule({ ...base, animal: ['meat'], meat_kind: ['pork'] }, 'pork')).toBe(true);
    expect(satisfiesRule({ ...base, animal: ['meat'], meat_kind: ['unknown'] }, 'pork')).toBe(true);
    expect(satisfiesRule({ ...base, animal: ['meat'], meat_kind: ['beef'] }, 'pork')).toBe(false);
    expect(satisfiesRule({ ...base, animal: ['gelatin'] }, 'pork')).toBe(true);
    expect(satisfiesRule({ ...base, animal: ['gelatin'], gelatin_origin: 'beef' }, 'pork')).toBe(
      false,
    );
  });
  it('Hackfleisch ohne Angabe: beef + meat_kind beef UND pork', () => {
    const mince = {
      ...base,
      groups: ['beef'] as FoodGroupId[],
      animal: ['meat'] as Food['animal'],
    };
    expect(satisfiesRule({ ...mince, meat_kind: ['beef', 'pork'] }, 'mixed_mince')).toBe(true);
    expect(satisfiesRule({ ...mince, meat_kind: ['pork'] }, 'mixed_mince')).toBe(false);
  });
  it('Gruppen, Fleisch, Schwangerschaft, Alkohol', () => {
    expect(satisfiesRule({ ...base, groups: ['gluten'] }, 'gluten')).toBe(true);
    expect(satisfiesRule(base, 'gluten')).toBe(false);
    expect(satisfiesRule({ ...base, animal: ['meat'] }, 'meat')).toBe(false);
    expect(satisfiesRule({ ...base, pregnancy_caution: true }, 'pregnancy_caution')).toBe(true);
    expect(satisfiesRule({ ...base, alcohol: true }, 'alcohol')).toBe(true);
  });
});

describe('Fixture-Katalog erfüllt alle Pflichtregeln', () => {
  it.each(FIXTURE_FOODS.map((food) => [food.id, food] as const))('%s', (_, food) => {
    const violated = [...requiredFoodRules(food).keys()].filter((key) => !satisfiesRule(food, key));
    expect(violated).toEqual([]);
  });
});
