/**
 * Regressionstests aus der Wächter-Prüfung N2a (waechter-n2a.md, Probe-Skripte probe.ts/probe2.ts):
 * B1 Gruppe ⇒ tierischer Bestandteil, B2 zerlegte Umlaute (NFD), B3 geräucherter/marinierter Fisch,
 * S1 Wortlücken + Hinweis „Kernwort mitten im Wort“, S2 Schwein, S3 Quellgruppen-Ausnahme, S5, S6, K1–K8.
 */
import { describe, expect, it } from 'vitest';

import {
  ALLERGEN_RULES,
  type AllergenRuleKey,
  findMidWordHits,
  GELATIN_RULE,
  matchWordRule,
  midWordGroupHints,
  normalizeFoodText,
  PORK_RULE,
  requiredFoodRules,
} from './allergen-rules';
import type { Food, SourceFoodCategory } from './food-schema';
import { catalogFor, FIXTURE_FOODS, foodLookup, makeFood } from './nutrition-fixtures';
import { checkFood, checkFoodAllergens } from './recipe-checks';
import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import { ing, makeRecipe } from './nutrition-fixtures';

function food(name: string, extra: Partial<Food> = {}, category: SourceFoodCategory = 'other') {
  return makeFood({
    id: 'probe-lebensmittel',
    name_de: name,
    aliases_de: [],
    groups: [],
    animal: [],
    meat_kind: [],
    max_fridge_days: 1,
    ...extra,
    source: { ...makeFood().source, name, category, ...extra.source },
  });
}
const required = (name: string, extra: Partial<Food> = {}, category?: SourceFoodCategory) => [
  ...requiredFoodRules(food(name, extra, category)).keys(),
];

/** Rote Befunde von `checkFood` mit passendem Quellauszug und Erwartungsliste. */
function redIssues(f: Food) {
  const all = [...FIXTURE_FOODS.filter((x) => x.id !== f.id), f];
  return checkFood(f, foodLookup(all), catalogFor(all)).filter((i) => i.severity === 'error');
}

describe('B1: Gruppe ⇒ tierischer Bestandteil (sonst „vegan“)', () => {
  it.each([
    ['Lachs', { groups: ['fish'] }, 'fish', 'animal_fish'],
    ['Ei', { groups: ['eggs'] }, 'eggs', 'animal_egg'],
    ['Quark', { groups: ['dairy', 'lactose'] }, 'dairy', 'animal_dairy'],
    ['Garnelen', { groups: ['shellfish'] }, 'crustaceans_molluscs', 'animal_shellfish'],
  ] as const)('„%s“ mit animal [] → R18 rot', (name, extra, category, key) => {
    const f = food(name, { ...extra, groups: [...extra.groups] }, category as SourceFoodCategory);
    expect(
      redIssues(f)
        .map((i) => i.message)
        .join(),
    ).toMatch(/tierischer Bestandteil/);
    expect([...requiredFoodRules(f).keys()]).toContain(key);
  });

  it('Gruppe auch ohne Wort/Quellgruppe (z. B. Name „Filet“) ⇒ animal', () => {
    expect(required('Filet', { groups: ['fish'] })).toContain('animal_fish');
  });

  it('Honig → animal honey; Parmesan/Pecorino/Grana Padano/Gorgonzola → animal_rennet', () => {
    expect(required('Blütenhonig')).toContain('animal_honey');
    expect(required('Honigmelone')).not.toContain('animal_honey');
    for (const name of [
      'Parmesan',
      'Parmigiano Reggiano',
      'Grana Padano',
      'Pecorino',
      'Gorgonzola',
    ]) {
      expect(required(name), name).toContain('animal_rennet');
    }
    expect(required('Granatapfel')).not.toContain('animal_rennet');
    expect(required('Granatapfel')).not.toContain('dairy');
  });

  it('richtig gepflegt → grün; Ausnahme (vegetarischer Hartkäse) mit Quelle möglich', () => {
    const honey = food('Honig', { animal: ['honey'] }, 'sugar_sweets');
    expect(redIssues(honey)).toEqual([]);
    const cheese = food(
      'Hartkäse vegetarisch',
      { groups: ['dairy', 'lactose'], animal: ['dairy'] },
      'dairy',
    );
    expect(redIssues(cheese)).toEqual([]);
    const parm = food('Parmesan', { groups: ['dairy', 'lactose'], animal: ['dairy'] }, 'dairy');
    const all = [...FIXTURE_FOODS, parm];
    const ctx = {
      ...catalogFor(all),
      exceptions: [
        {
          food_id: parm.id,
          rule: 'animal_rennet' as const,
          reason: 'Hartkäse nach Parmesan-Art mit mikrobiellem Lab.',
          source: 'Herstellerangabe',
        },
      ],
    };
    expect(checkFoodAllergens(parm, foodLookup(all), ctx)).toEqual([]);
  });

  it('Rezept mit falsch gepflegtem Lachs wäre vegan – die Pflichtregel fängt das am Lebensmittel', () => {
    const salmon = food('Lachs', { id: 'lachs', groups: ['fish'] }, 'fish');
    const lookup = new Map([...foodLookup(), ['lachs', salmon]]);
    expect(
      computeRecipeFacts(
        makeRecipe({ ingredients: [ing('lachs', 100, 'g', { heated: true })] }),
        lookup,
      ).diet,
    ).toBe('vegan');
    expect(redIssues(salmon).length).toBeGreaterThan(0);
  });
});

describe('B2: zerlegte Umlaute (NFD) wie zusammengesetzte', () => {
  const umlautWords: [string, AllergenRuleKey][] = [
    ['Käse', 'dairy'],
    ['Hühnerei', 'eggs'],
    ['Räucherlachs', 'pregnancy_caution'],
    ['Hähnchen', 'poultry'],
    ['Geflügel', 'poultry'],
    ['Gemüsebrühe', 'celery'],
    ['Erdnüsse', 'peanuts'],
    ['Grünkern', 'gluten'],
    ['Brötchen', 'gluten'],
    ['Semmelbrösel', 'gluten'],
    ['Knäckebrot', 'gluten'],
    ['Bärlauch', 'onion_garlic'],
    ['Trüffel', 'mushrooms'],
    ['Hüttenkäse', 'dairy'],
    ['Haselnüsse', 'tree_nuts'],
    ['Frühlingszwiebeln', 'onion_garlic'],
    ['Kräuterseitlinge', 'mushrooms'],
    ['Müsli', 'gluten'],
    ['Glühwein', 'alcohol'],
    ['Löffelbiskuit', 'eggs'],
  ];
  it.each(umlautWords)('„%s“ (NFD) → %s', (name, key) => {
    const decomposed = name.normalize('NFD');
    expect(decomposed).not.toBe(name.normalize('NFC'));
    expect(normalizeFoodText(decomposed)).toBe(normalizeFoodText(name));
    expect(required(decomposed)).toContain(key);
  });
  it('NFD-Käse ohne Gruppe → R18 rot (vorher grün)', () => {
    expect(redIssues(food('Käse'.normalize('NFD'))).length).toBeGreaterThan(0);
  });
});

describe('B3: geräucherter, gebeizter, marinierter Fisch (Schreibweise der Quellen)', () => {
  it.each([
    'Lachs, geräuchert',
    'Forelle geräuchert',
    'Makrele heiß geräuchert',
    'Lachs gebeizt',
    'Hering mariniert',
    'Matjes',
    'Rollmops',
    'Bismarckhering',
    'Kaviar',
    'Forellenkaviar',
    'Lachsrogen',
    'Graved Lachs',
  ])('„%s“ → pregnancy_caution', (name) => {
    expect(required(name, {}, 'fish')).toContain('pregnancy_caution');
  });
  it('mit Fisch-Gruppe auch ohne Fischwort im Namen; ohne Fisch kein Treffer', () => {
    expect(required('Filet geräuchert', { groups: ['fish'] })).toContain('pregnancy_caution');
    expect(required('Räuchertofu')).not.toContain('pregnancy_caution');
    expect(required('Paprika geräuchert')).not.toContain('pregnancy_caution');
    expect(required('Hähnchen mariniert')).not.toContain('pregnancy_caution');
  });
  it('„Lachs, geräuchert“ ohne Flag → R18 rot', () => {
    const f = food('Lachs, geräuchert', { groups: ['fish'], animal: ['fish'] }, 'fish');
    expect(
      redIssues(f)
        .map((i) => i.message)
        .join(),
    ).toMatch(/pregnancy_caution/);
    expect(redIssues({ ...f, pregnancy_caution: true })).toEqual([]);
  });
});

describe('S1: Wortlücken (DACH-Begriffe) geschlossen', () => {
  const cases: [string, AllergenRuleKey[], AllergenRuleKey[]][] = [
    ['Schlagobers', ['dairy', 'lactose'], []],
    ['Obers', ['dairy'], []],
    ['Kaffeeobers', ['dairy'], []],
    ['Yoghurt', ['dairy'], []],
    ['Yogurt', ['dairy'], []],
    ['Tzatziki', ['dairy'], []],
    ['Cottage Cheese', ['dairy'], []],
    ['Whey Protein', ['dairy'], []],
    ['Paneer', ['dairy'], []],
    ['Raclettekäse', ['dairy'], []],
    ['Crème-fraîche', ['dairy'], []],
    ['Crème double', ['dairy'], []],
    ['Brezel', ['gluten'], []],
    ['Laugenbrezel', ['gluten'], []],
    ['Breze', ['gluten'], []],
    ['Semmelknödel', ['gluten'], []],
    ['Germknödel', ['gluten'], []],
    ['Brösel', ['gluten'], []],
    ['Müsli', ['gluten'], []],
    ['Porridge', ['gluten'], []],
    ['Kuskus', ['gluten'], []],
    ['Udon', ['gluten'], []],
    ['Ramen', ['gluten'], []],
    ['Orzo', ['gluten'], []],
    ['Kritharaki', ['gluten'], []],
    ['Maultaschen', ['gluten'], []],
    ['Tortellini', ['gluten'], []],
    ['Pfannkuchen', ['gluten'], []],
    ['Croutons', ['gluten'], []],
    ['Pumpernickel', ['gluten'], []],
    ['Teriyakisauce', ['gluten'], []],
    ['Ciabatta', ['gluten'], []],
    ['Gipfeli', ['gluten'], []],
    ['Aioli', ['eggs', 'animal_egg'], []],
    ['Remoulade', ['eggs'], []],
    ['Sauce Hollandaise', ['eggs'], []],
    ['Spätzle', ['eggs', 'gluten'], []],
    ['Omelett', ['eggs'], []],
    ['Worcestersoße', ['fish'], []],
    ['Worcester Sauce', ['fish'], []],
    ['Worcester-Sauce', ['fish'], []],
    ['Wildlachsfilet', ['fish'], []],
    ['Seehecht', ['fish'], []],
    ['Dorade', ['fish'], []],
    ['Seezunge', ['fish'], []],
    ['Crevetten', ['shellfish', 'animal_shellfish'], []],
    ['Prawns', ['shellfish'], []],
    ['Langustinen', ['shellfish'], []],
    ['Pulpo', ['shellfish'], []],
    ['Vongole', ['shellfish'], []],
    ['Hühnchenbrust', ['poultry', 'meat'], ['pork']],
    ['Chicken Nuggets', ['poultry'], []],
    ['Hühnereintopf', ['poultry'], ['eggs']],
    ['Hackbällchen', ['beef', 'pork', 'mixed_mince'], []],
    ['Faschierte Laibchen', ['beef', 'pork', 'mixed_mince'], []],
    ['Cevapcici', ['beef', 'pork', 'mixed_mince'], []],
    ['Frikadellen', ['beef', 'pork', 'mixed_mince'], []],
    ['Rinderhackfleisch', ['beef'], ['mixed_mince', 'pork']],
    ['Putenhackfleisch', ['poultry'], ['mixed_mince', 'pork', 'beef']],
    ['Sojahack', ['soy'], ['mixed_mince', 'pork', 'beef', 'meat']],
    ['Tafelspitz', ['beef'], []],
    ['Pesto', ['dairy', 'tree_nuts', 'animal_rennet'], []],
    ['Marzipan', ['tree_nuts'], []],
    ['Nougat', ['tree_nuts'], []],
    ['Nüsse', ['tree_nuts'], []],
    ['Nussmischung', ['tree_nuts'], []],
    ['Studentenfutter', ['tree_nuts'], []],
    ['Baumnüsse', ['tree_nuts'], []],
    ['Halva', ['sesame'], []],
    ['Hummus', ['legumes', 'sesame'], []],
    ['Suppengrün', ['celery'], []],
    ['Suppengemüse', ['celery'], []],
    ['Gemüsefond', ['celery'], []],
    ['Käsefondue', ['dairy'], ['celery']],
    ['Trockenmarillen', ['sulphites'], []],
    ['Marillen getrocknet', ['sulphites'], []],
    ['Balsamessig', ['sulphites'], []],
    ['Rosinen', ['sulphites'], []],
    ['Misosuppe', ['soy'], []],
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

  it('Kernwort mitten im Wort → gelber Hinweis R18H (nicht still)', () => {
    for (const [name, group] of [
      ['Vollmilchschokolade', 'dairy'],
      ['Erdbeerjoghurtdrink', 'dairy'],
      ['Vollkornhaferflocken', 'gluten'],
      ['Vollkorntortillas', 'gluten'],
    ] as const) {
      expect(
        midWordGroupHints(food(name)).map((h) => h.group),
        name,
      ).toContain(group);
      const issues = checkFood(
        food(name),
        foodLookup(),
        catalogFor([...FIXTURE_FOODS, food(name)]),
      );
      expect(
        issues.filter((i) => i.rule === 'R18H').every((i) => i.severity === 'warning'),
        name,
      ).toBe(true);
      expect(
        issues.some((i) => i.rule === 'R18H'),
        name,
      ).toBe(true);
    }
  });
  it('kein Hinweis, wenn die Gruppe gepflegt ist, das Wort am Rand steht oder ein Negativ-Wort greift', () => {
    expect(midWordGroupHints(food('Vollmilchschokolade', { groups: ['dairy'] }))).toEqual([]);
    expect(midWordGroupHints(food('Vollmilch')).map((h) => h.group)).not.toContain('dairy');
    expect(midWordGroupHints(food('Kokosmilchreis')).map((h) => h.group)).not.toContain('dairy');
    expect(findMidWordHits(['Weizen'], { words: ['ei'], negatives: [] })).toHaveLength(1);
  });
});

describe('S2: Schwein – im Zweifel ja', () => {
  it.each([
    'Fleischkäse',
    'Wildsalami',
    'Hirschsalami',
    'Rindersalami',
    'Putensalami',
    'Bratwurst',
    'Weißwurst',
    'Leberwurst',
    'Lyoner',
    'Mortadella',
    'Käsekrainer',
    'Wienerli',
    'Cervelat',
    'Guanciale',
    'Lardo',
    'Selchfleisch',
    'Geselchtes',
  ])('„%s“ → pork', (name) => {
    expect(required(name)).toContain('pork');
  });
  it('Puten-/Geflügelschinken und -speck bleiben ohne Schwein; pflanzliche Wurst ohne Fleisch', () => {
    expect(required('Putenschinken')).not.toContain('pork');
    expect(required('Geflügelspeck')).not.toContain('pork');
    expect(required('Tofuwurst')).not.toContain('meat');
    expect(required('Tofuwurst')).not.toContain('pork');
  });
  it('Wildsalami nur mit Wild (game) → rot', () => {
    const f = food(
      'Wildsalami',
      { animal: ['meat'], meat_kind: ['game'], pregnancy_caution: true },
      'sausage_meat_products',
    );
    expect(
      redIssues(f)
        .map((i) => i.message)
        .join(),
    ).toMatch(/Schwein/);
    expect(redIssues({ ...f, meat_kind: ['game', 'pork'] })).toEqual([]);
  });
});

describe('S3: Quellgruppen-Ausnahme nur aus der Bezeichnung der Quelle', () => {
  it('Kritharaki mit Alias „griechische Reisnudeln“ bleibt gluten', () => {
    const f = food('Kritharaki', { aliases_de: ['Griechische Reisnudeln'] }, 'cereal_products');
    const reasons = requiredFoodRules({
      ...f,
      source: { ...f.source, name: 'Teigwaren Kritharaki' },
    }).get('gluten');
    expect(reasons?.map((r) => r.via)).toContain('source_category');
  });
  it('Getreide-Pflicht aus der Quellgruppe entfällt nur, wenn die QUELLE „Reis“ sagt', () => {
    const viaAlias = makeFood({
      name_de: 'Frühstücksgetreide',
      aliases_de: ['Reisflocken'],
      groups: [],
      source: { ...makeFood().source, name: 'Getreideflocken', category: 'cereal_products' },
    });
    expect([...requiredFoodRules(viaAlias).keys()]).toContain('gluten');
    const viaSource = makeFood({
      name_de: 'Frühstücksgetreide',
      groups: [],
      source: { ...makeFood().source, name: 'Reisflocken', category: 'cereal_products' },
    });
    expect([...requiredFoodRules(viaSource).keys()]).not.toContain('gluten');
  });
});

describe('S5: Wortende-Fehltreffer kurzer Wörter', () => {
  it('Schmalz/Butterschmalz ≠ gluten; Palatschinken ≠ Schwein/Fleisch', () => {
    expect(required('Schmalz')).not.toContain('gluten');
    expect(required('Butterschmalz')).not.toContain('gluten');
    expect(required('Gerstenmalz')).toContain('gluten');
    expect(required('Palatschinken')).toContain('gluten');
    expect(required('Palatschinken')).not.toContain('pork');
    expect(required('Palatschinken')).not.toContain('meat');
  });
});

describe('S6: Negativ-Wortfolgen schalten nicht den ganzen Text stumm', () => {
  it('Wortfolge in der Negativliste wird abgelehnt', () => {
    expect(() =>
      matchWordRule(['Kokos Milch und Vollmilch'], {
        words: ['milch'],
        negatives: ['kokos milch'],
      }),
    ).toThrow(/Wortfolge/);
  });
  it('keine Regel nutzt Negativ-Wortfolgen; Einzel-Negative wirken nur auf ihr Wort', () => {
    for (const [id, rule] of Object.entries(ALLERGEN_RULES)) {
      if (rule.kind === 'rule') {
        expect(
          rule.negatives.filter((n) => n.includes(' ')),
          id,
        ).toEqual([]);
      }
    }
    expect(PORK_RULE.negatives.filter((n) => n.includes(' '))).toEqual([]);
    expect(
      matchWordRule(['Kokosmilch und Vollmilch'], { words: ['milch'], negatives: ['kokosmilch'] }),
    ).toHaveLength(1);
  });
});

describe('K1: Ausnahmeliste hebt die Erwartungsliste nicht auf', () => {
  it('menschlich bestätigte Gruppe fehlt → rot, auch mit Ausnahme', () => {
    const f = food('Haferflocken glutenfrei', { id: 'hafer-gf', groups: [] }, 'cereal_products');
    const all = [...FIXTURE_FOODS, f];
    const ctx = {
      ...catalogFor(all),
      expectations: { ...catalogFor(all).expectations, 'hafer-gf': ['gluten' as const] },
      exceptions: [
        {
          food_id: 'hafer-gf',
          rule: 'gluten' as const,
          reason: 'Zertifiziert glutenfrei (< 20 mg/kg).',
          source: 'Herstellerangabe',
        },
      ],
    };
    expect(
      checkFoodAllergens(f, foodLookup(all), ctx)
        .map((i) => i.message)
        .join(),
    ).toMatch(/Erwartungsliste/);
  });
});

describe('K2–K5, K8: weitere Wörter', () => {
  it.each([
    ['Reiswein', 'alcohol'],
    ['Shaoxing', 'alcohol'],
    ['Rumrosinen', 'alcohol'],
    ['Grappa', 'alcohol'],
    ['Whisky', 'alcohol'],
    ['Gin', 'alcohol'],
    ['Wermut', 'alcohol'],
    ['Cidre', 'alcohol'],
    ['Habanero', 'spicy'],
    ['Gochujang', 'spicy'],
    ['Piri-Piri', 'spicy'],
    ['Rosenpaprika', 'spicy'],
    ['Egerlinge', 'mushrooms'],
    ['Portobello', 'mushrooms'],
    ['Enoki', 'mushrooms'],
    ['Fisolen', 'legumes'],
    ['Zuckerschoten', 'legumes'],
    ['Dal', 'legumes'],
    ['Mehlwürmer', 'animal_insect'],
    ['Grillenmehl', 'animal_insect'],
    ['Karmin', 'animal_insect'],
  ] as const)('„%s“ → %s', (name, key) => {
    expect(required(name)).toContain(key);
  });
  it('kein Fehltreffer: Ginseng, Grillgemüse, Gummibärchen = Gelatine', () => {
    expect(required('Ginseng')).not.toContain('alcohol');
    expect(required('Grillgemüse')).not.toContain('animal_insect');
    expect(matchWordRule(['Gummibärchen'], GELATIN_RULE)).toHaveLength(1);
  });
});

describe('Gegenprüfung N2a: Leber mitten im Wort, Wildhack, pflanzliche Wurst, Rohschinken', () => {
  it.each([
    'Kalbsleberwurst',
    'Gänseleberpastete',
    'Hühnerleberpastete',
    'Leberkäse',
    'Kalbsleber',
  ])('„%s“ → pregnancy_caution', (name) => {
    expect(required(name)).toContain('pregnancy_caution');
  });
  it('keine harmlosen Leber-Treffer bei üblichen Lebensmitteln', () => {
    for (const name of ['Haferflocken', 'Kleberreis', 'Erlebnisbrot', 'Lebkuchen']) {
      expect(required(name), name).not.toContain('pregnancy_caution');
    }
  });
  it('Kalbsleberwurst ohne Flag → R18 rot (Fixture mit Flag grün)', () => {
    const fixture = FIXTURE_FOODS.find((f) => f.id === 'kalbsleberwurst') as Food;
    expect(redIssues(fixture)).toEqual([]);
    expect(
      redIssues({ ...fixture, pregnancy_caution: false })
        .map((i) => i.message)
        .join(),
    ).toMatch(/pregnancy_caution/);
  });
  it('Wildhackfleisch/Wildhack → zusätzlich Schwein', () => {
    expect(required('Wildhackfleisch')).toContain('pork');
    expect(required('Wildhack')).toContain('pork');
    expect(required('Hirschhack')).toContain('pork');
    expect(required('Putenhackfleisch')).not.toContain('pork');
  });
  it('vegane/pflanzliche/vegetarische Wurst und Seitanwurst → kein Schwein, kein Fleisch', () => {
    for (const name of [
      'Vegane Salami',
      'Pflanzliche Wurst',
      'Vegetarischer Aufschnitt Salami-Art',
      'Seitanwurst',
      'Veggie-Bratwurst',
    ]) {
      const keys = required(name);
      expect(keys, name).not.toContain('pork');
      expect(keys, name).not.toContain('meat');
    }
    expect(required('Salami')).toContain('pork');
  });
  it('Serrano, Coppa → Schwein; Bündnerfleisch → Rind; Serrano-Chili nicht', () => {
    expect(required('Serrano')).toContain('pork');
    expect(required('Serranoschinken')).toContain('pork');
    expect(required('Coppa')).toContain('pork');
    expect(required('Bündnerfleisch')).toContain('beef');
    expect(required('Serrano-Chili')).not.toContain('pork');
  });
});
