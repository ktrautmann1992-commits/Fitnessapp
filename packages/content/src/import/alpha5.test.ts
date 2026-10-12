import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  CARB_LOADING_NOTICE_DE,
  checkMealPrepPlan,
  checkRecipeCategories,
  type Food,
  guideSchema,
  mealPrepPlanSchema,
  type Recipe,
  recipeSchema,
} from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type Alpha5File,
  Alpha5InputError,
  type ExistingFiles,
  importAlpha5,
  importHash,
  parseAlpha5File,
  parseZeroAmount,
} from './alpha5';
import { runAlpha5Import } from './alpha5-run';

/**
 * Etappe N2c – DoD (docs/PLAN-PHASE-5.md 19.2, K8): Zweitlauf byte-gleich; Schemafehler → Abbruch ohne Schreiben;
 * `published` nie überschrieben; fehlende ID nicht gelöscht; von Hand geänderter Entwurf nicht überschrieben (S5);
 * keine Datei unter `content/foods/` (S3); Zählbericht 242/236/4/2; `heated`-Vorgabe `false` und Annahmen im Bericht.
 *
 * ACHTUNG: Alle Nährwerte hier sind TESTWERTE, keine Quelldaten.
 */

const REAL_FILE = join(__dirname, '../../seed/alpha5-rezepte.json');

function testFood(id: string, overrides: Partial<Food> = {}): Food {
  return {
    id,
    version: 1,
    status: 'draft',
    name_de: id,
    aliases_de: [],
    shopping_category: 'other',
    pantry: false,
    nutrients_per_100g: {
      kcal: 100,
      protein_g: 5,
      carbs_g: 15,
      sugar_g: 1,
      fat_g: 2,
      sat_fat_g: 0.5,
      fiber_g: 1,
      salt_g: 0.1,
    },
    units: {},
    groups: [],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    source: {
      db: 'bls',
      version: 'test',
      ref: `T-${id}`,
      name: id,
      category: 'other',
      license: 'Testdaten (keine Quelldaten)',
      retrieved_at: '2026-10-11',
    },
    meta: {
      origin: 'claude_session',
      model: 'test',
      batch_id: null,
      created_on: '2026-10-11',
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      catalog_reviewed_by: null,
      catalog_reviewed_at: null,
    },
    ...overrides,
  };
}

const FOODS: Food[] = [
  testFood('haferflocken', {
    name_de: 'Haferflocken',
    groups: ['gluten'],
    shopping_category: 'cereal_breakfast',
    nutrients_per_100g: {
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    },
  }),
  testFood('huehnerei', {
    name_de: 'Hühnerei',
    aliases_de: ['Ei'],
    groups: ['eggs'],
    animal: ['egg'],
    shopping_category: 'chilled_dairy_eggs',
    max_fridge_days: 2,
    nutrients_per_100g: {
      kcal: 137,
      protein_g: 12.9,
      carbs_g: 0.7,
      sugar_g: 0.7,
      fat_g: 9.3,
      sat_fat_g: 2.7,
      fiber_g: 0,
      salt_g: 0.35,
    },
  }),
  testFood('lachsfilet', {
    name_de: 'Lachsfilet',
    groups: ['fish'],
    animal: ['fish'],
    shopping_category: 'fish',
    max_fridge_days: 1,
    freezable: true,
    nutrients_per_100g: {
      kcal: 200,
      protein_g: 20,
      carbs_g: 0,
      sugar_g: 0,
      fat_g: 13,
      sat_fat_g: 3,
      fiber_g: 0,
      salt_g: 0.1,
    },
  }),
  testFood('basmatireis-trocken', {
    name_de: 'Basmatireis',
    shopping_category: 'pasta_rice_grains',
    max_fridge_days: 1,
  }),
  testFood('salz', {
    name_de: 'Salz',
    shopping_category: 'spices_baking',
    nutrients_per_100g: {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      sugar_g: 0,
      fat_g: 0,
      sat_fat_g: 0,
      fiber_g: 0,
      salt_g: 100,
    },
  }),
  testFood('wasser', {
    name_de: 'Wasser',
    shopping_category: 'drinks',
    units: { ml_to_g: 1 },
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
  }),
];
const CATALOG = new Map(FOODS.map((food) => [food.id, food]));

const per100 = (kcal: number, e: number, k: number, f: number) => ({
  kcal,
  eiweiss_g: e,
  kohlenhydrate_g: k,
  fett_g: f,
});

/** Kleine, gültige Gründer-Datei (Aufbau wie alpha5-rezepte.json). */
function smallFile(): Alpha5File {
  return {
    format: 'alpha5-rezepte',
    version: '1.0',
    stand: '2026-10-11',
    hinweise: ['Testdatei.'],
    kategorien: [
      { id: 'vegan', name: 'Vegan', typ: 'ernaehrungsform' },
      { id: 'vegetarisch', name: 'Vegetarisch', typ: 'ernaehrungsform' },
      { id: 'fleisch', name: 'Mit Fleisch', typ: 'ernaehrungsform' },
      { id: 'ohne-schwein', name: 'Ohne Schweinefleisch', typ: 'ernaehrungsform' },
      { id: 'schnell', name: 'Fertig in 10 Minuten', typ: 'thema' },
      { id: 'meal-prep', name: 'Meal-Prep-Wochenpläne', typ: 'thema' },
    ],
    ernaehrungsformen: [
      { id: 'vegan', name: 'Vegan' },
      { id: 'vegetarisch', name: 'Vegetarisch' },
      { id: 'fleisch', name: 'Mit Fleisch' },
      { id: 'ohne-schwein', name: 'Ohne Schweinefleisch' },
    ],
    abteilungen: ['Getreide', 'Kühlregal', 'Fisch', 'Gewürze', 'Sonstiges'],
    zutaten: [
      {
        id: 'haferflocken',
        name: 'Haferflocken',
        abteilung: 'Getreide',
        pro_100g: per100(370, 13.5, 58.7, 7),
      },
      { id: 'ei', name: 'Ei', abteilung: 'Kühlregal', pro_100g: per100(137, 12.9, 0.7, 9.3) },
      // Absichtlich > 3 % daneben (Gegencheck je Zutat).
      {
        id: 'lachsfilet',
        name: 'Lachsfilet',
        abteilung: 'Fisch',
        pro_100g: per100(180, 20, 0, 13),
      },
      {
        id: 'basmatireis-trocken',
        name: 'Basmatireis (trocken)',
        abteilung: 'Getreide',
        pro_100g: per100(100, 5, 15, 2),
      },
      { id: 'salz', name: 'Salz', abteilung: 'Gewürze', pro_100g: per100(0, 0, 0, 0) },
      { id: 'wasser', name: 'Wasser', abteilung: 'Sonstiges', pro_100g: per100(0, 0, 0, 0) },
    ],
    rezepte: [
      {
        id: 'haferbrei-schnell',
        name: 'Schneller Haferbrei',
        beschreibung: 'Haferflocken mit Wasser, in fünf Minuten fertig zum Mitnehmen.',
        kategorie: 'schnell',
        abschnitt: 'Frühstück',
        ernaehrungsformen: ['vegan', 'vegetarisch', 'fleisch', 'ohne-schwein'],
        zeit_min: 5,
        portionen: 1,
        tags: ['Unter 10 Minuten', 'ohne Kochen', 'zum Mitnehmen', 'Zum Mitnehmen'],
        zutaten: [
          { zutat_id: 'haferflocken', menge_g: 60, anzeige: '60 g' },
          { zutat_id: 'wasser', menge_g: 0, anzeige: '120 ml' },
          { zutat_id: 'salz', menge_g: 0, anzeige: '1 Prise' },
        ],
        zubereitung: ['Alles verrühren und 5 Minuten quellen lassen.'],
        tipp: 'Schmeckt auch mit Zimt.',
        naehrwerte_pro_portion: per100(222, 8.1, 35.2, 4.2),
        status: 'draft',
      },
      {
        id: 'omelett-natur',
        name: 'Omelett natur',
        beschreibung: 'Zwei Eier, in der Pfanne gebraten, mit einer Prise Salz.',
        kategorie: 'vegetarisch',
        abschnitt: 'Frühstück',
        ernaehrungsformen: ['vegetarisch', 'fleisch', 'ohne-schwein'],
        zeit_min: 10,
        portionen: 1,
        tags: ['nach dem Training'],
        zutaten: [
          { zutat_id: 'ei', menge_g: 120, anzeige: '2 Eier (Größe M)' },
          { zutat_id: 'salz', menge_g: 0, anzeige: 'nach Geschmack' },
        ],
        zubereitung: [
          'Eier verquirlen.',
          'Die Eier in der Pfanne 10 Minuten braten, bis sie hart sind.',
        ],
        tipp: 'Mit Schnittlauch bestreuen.',
        naehrwerte_pro_portion: per100(164, 15.5, 0.8, 11.2),
        status: 'draft',
      },
      {
        id: 'lachs-mit-reis',
        name: 'Lachs mit Reis',
        beschreibung: 'Lachsfilet aus dem Ofen mit Basmatireis, gut vorzubereiten.',
        kategorie: 'meal-prep',
        abschnitt: 'Mittagessen',
        ernaehrungsformen: ['fleisch', 'ohne-schwein'],
        zeit_min: 30,
        portionen: 1,
        tags: ['Meal-Prep'],
        zutaten: [
          { zutat_id: 'lachsfilet', menge_g: 130, anzeige: '1 Filet (130 g)' },
          { zutat_id: 'basmatireis-trocken', menge_g: 70, anzeige: '70 g (trocken)' },
          { zutat_id: 'salz', menge_g: 0, anzeige: '1 Prise' },
        ],
        zubereitung: ['Reis nach Packung kochen.', 'Lachs im Ofen 15 Minuten garen.'],
        tipp: 'Hält gekocht nur einen Tag.',
        // Absichtlich > 3 % daneben (berechnet 330 kcal).
        naehrwerte_pro_portion: per100(300, 29.5, 10.5, 18.3),
        status: 'draft',
        meal_prep_plan: 'fisch-woche',
        kosten_eur_pro_portion: 3.2,
      },
      {
        id: 'lachs-tatar',
        name: 'Lachs-Tatar',
        beschreibung: 'Roher Lachs, fein gehackt und gewürzt – ohne Kochen.',
        kategorie: 'fleisch',
        abschnitt: 'Snack',
        // Absichtlich falsch: Datei sagt vegetarisch (berechnet: mit Fisch).
        ernaehrungsformen: ['vegetarisch', 'fleisch', 'ohne-schwein'],
        zeit_min: 10,
        portionen: 1,
        tags: ['ohne Kochen'],
        zutaten: [
          { zutat_id: 'lachsfilet', menge_g: 80, anzeige: '80 g' },
          { zutat_id: 'salz', menge_g: 0, anzeige: '1 Prise' },
        ],
        zubereitung: ['Lachs fein hacken und salzen.'],
        tipp: 'Sofort essen.',
        naehrwerte_pro_portion: per100(160, 16, 0, 10.4),
        status: 'draft',
      },
    ],
    meal_prep_plaene: [
      {
        id: 'fisch-woche',
        ernaehrungsform: 'ohne-schwein',
        titel: 'Fisch-Woche',
        beschreibung: 'Ein Kochtag mit Lachs und Reis für die ganze Woche.',
        rezepte: ['lachs-mit-reis'],
        kochtag: [
          { min: 0, schritt: 'Ofen vorheizen und Reis aufsetzen.' },
          { min: 10, schritt: 'Lachs in den Ofen schieben.' },
        ],
        aufbewahrung: ['Lachs mit Reis hält 3 Tage im Kühlschrank.'],
        abendessen_hinweis: 'Abends kochst du frisch.',
      },
    ],
    ratgeber: {
      wettkampf: [
        {
          titel: 'Carb-Loading: wann und wie viel',
          text: 'Etwa 8–10 g Kohlenhydrate pro kg Körpergewicht an den Tagen davor.',
        },
        { titel: 'Nichts Neues', text: 'Teste alles vorher im Training.' },
      ],
      unterwegs: {
        einleitung: 'Unterwegs findest du fast überall eine gute Wahl.',
        grundregeln: ['Gemüse dazu.'],
        orte: [
          {
            ort: 'Beim Bäcker',
            gut: ['Vollkornbrötchen mit Käse'],
            lieber_seltener: ['Croissants'],
            trick: 'Doppelter Belag statt zwei Brötchen.',
          },
        ],
      },
    },
  };
}

const NO_FILES: ExistingFiles = { recipe: new Map(), meal_prep_plan: new Map(), guide: new Map() };

function existingFrom(output: ReturnType<typeof importAlpha5>): ExistingFiles {
  const maps = { recipe: new Map(), meal_prep_plan: new Map(), guide: new Map() };
  for (const write of output.writes) {
    maps[write.kind].set(write.id, structuredClone(write.content));
  }
  return maps;
}

function run(file: Alpha5File = smallFile(), existing: ExistingFiles = NO_FILES) {
  return importAlpha5({ data: file, foods: CATALOG, existing });
}

function recipeOf(output: ReturnType<typeof importAlpha5>, id: string): Recipe {
  const recipe = output.built.recipes.find((r) => r.id === id);
  if (recipe === undefined) throw new Error(id);
  return recipe;
}

describe('Gründer-Datei (echt): Zählbericht und „Katalog fehlt“', () => {
  const data: unknown = JSON.parse(readFileSync(REAL_FILE, 'utf8'));

  it('Schema strikt gültig, 242/236/4/2', () => {
    const file = parseAlpha5File(data);
    const output = importAlpha5({ data, foods: new Map(), existing: NO_FILES });
    expect(output.report.counts).toEqual({
      recipes: 242,
      ingredients: 236,
      mealPrepPlans: 4,
      guides: 2,
    });
    expect(file.rezepte).toHaveLength(242);
  });

  it('ohne Katalog: nichts geschrieben, keine Werte erfunden, Strukturprüfung für alle Rezepte', () => {
    const output = importAlpha5({ data, foods: new Map(), existing: NO_FILES });
    expect(output.report.catalogMissing).toBe(true);
    expect(output.writes).toEqual([]);
    expect(output.built.recipes).toEqual([]);
    expect(output.built.structureOnly).toHaveLength(242);
    expect(output.report.missingFoods).toHaveLength(236);
    // Ohne Katalog keine Allergene, kein heated, keine Rolle.
    for (const recipe of output.built.structureOnly) {
      expect(recipe.declared_allergens).toEqual([]);
      expect(recipe.ingredients.every((i) => i.heated === undefined && i.role === undefined)).toBe(
        true,
      );
      expect(recipeSchema.safeParse(recipe).success).toBe(true);
      expect(checkRecipeCategories(recipe)).toEqual([]);
    }
    expect(output.report.fileCoverage.meatOnly).toBe(28);
    expect(output.report.fileCoverage.vegetarianShare).toBeCloseTo(151 / 242, 5);
  });

  it('alle Ratgeber sind schema-gültig, Carb-Loading mit festem Hinweis', () => {
    const output = importAlpha5({ data, foods: new Map(), existing: NO_FILES });
    for (const guide of output.built.guides) {
      expect(guideSchema.safeParse(guide).success).toBe(true);
    }
    const wettkampf = output.built.guides.find((g) => g.id === 'wettkampf');
    expect(wettkampf?.sections[0]?.notice_de).toBe(CARB_LOADING_NOTICE_DE);
    expect(wettkampf?.sections.filter((s) => s.notice_de !== undefined)).toHaveLength(1);
    expect(output.built.guides.find((g) => g.id === 'unterwegs')?.places).toHaveLength(10);
  });
});

describe('Schemafehler → Abbruch, nichts geschrieben', () => {
  const cases: [string, (file: Alpha5File) => unknown, RegExp][] = [
    ['unbekanntes Feld', (f) => ({ ...f, extra: 1 }), /extra|Unrecognized|unbekannt/i],
    [
      'fehlendes Pflichtfeld',
      (f) => ({ ...f, rezepte: f.rezepte.map(({ tipp: _t, ...r }) => r) }),
      /tipp/,
    ],
    [
      'doppelte Rezept-ID',
      (f) => ({ ...f, rezepte: [...f.rezepte, f.rezepte[0]] }),
      /Rezept „haferbrei-schnell“ doppelt/,
    ],
    [
      'unbekannte zutat_id',
      (f) => {
        const r = structuredClone(f.rezepte);
        r[0]?.zutaten.push({ zutat_id: 'gibt-es-nicht', menge_g: 5, anzeige: '5 g' });
        return { ...f, rezepte: r };
      },
      /Unbekannte Zutat „gibt-es-nicht“/,
    ],
    [
      'unbekannte Kategorie',
      (f) => ({ ...f, rezepte: f.rezepte.map((r) => ({ ...r, kategorie: 'bbq' })) }),
      /Unbekannte Kategorie „bbq“/,
    ],
    [
      'unbekannter Abschnitt',
      (f) => ({ ...f, rezepte: f.rezepte.map((r) => ({ ...r, abschnitt: 'Mitternacht' })) }),
      /Unbekannter Abschnitt „Mitternacht“/,
    ],
    [
      'Meal-Prep-Plan mit unbekanntem Rezept',
      (f) => ({
        ...f,
        meal_prep_plaene: f.meal_prep_plaene.map((p) => ({ ...p, rezepte: ['fehlt-noch'] })),
      }),
      /unbekanntes Rezept „fehlt-noch“/,
    ],
    [
      'Menge 0 ohne umwandelbare Anzeige',
      (f) => {
        const r = structuredClone(f.rezepte);
        if (r[0]?.zutaten[0] !== undefined)
          r[0].zutaten[0] = { zutat_id: 'haferflocken', menge_g: 0, anzeige: 'etwas' };
        return { ...f, rezepte: r };
      },
      /nicht umwandelbar/,
    ],
    ['falsches Format', (f) => ({ ...f, format: 'anders' }), /format/],
  ];

  it.each(cases)('%s', (_name, mutate, message) => {
    expect(() => run(mutate(smallFile()) as Alpha5File)).toThrow(Alpha5InputError);
    expect(() => run(mutate(smallFile()) as Alpha5File)).toThrow(message);
  });
});

describe('Umwandlung', () => {
  const output = run();

  it('Zählung, alles Entwurf mit Herkunft und gültigem Schema', () => {
    expect(output.report.built).toEqual({ recipes: 4, mealPrepPlans: 1, guides: 2 });
    expect(output.writes).toHaveLength(7);
    for (const write of output.writes) {
      expect(write.content.status).toBe('draft');
      expect(write.content.version).toBe(1);
      expect(write.content.meta.origin).toBe('manual');
      expect(write.content.meta.source_file).toBe('alpha5-rezepte.json@1.0');
      expect(write.content.meta.import_hash).toBe(importHash(write.content));
      const schema =
        write.kind === 'recipe'
          ? recipeSchema
          : write.kind === 'guide'
            ? guideSchema
            : mealPrepPlanSchema;
      expect(schema.safeParse(write.content).success).toBe(true);
    }
  });

  it('Felder: Abschnitt, Mahlzeit, Gesamtzeit, ohne Kochen, Tags zusammengeführt, Kategorien nach R22', () => {
    const oats = recipeOf(output, 'haferbrei-schnell');
    expect(oats.section_de).toBe('Frühstück');
    expect(oats.meal_types).toEqual(['breakfast']);
    expect(oats.no_cook).toBe(true);
    expect([oats.total_minutes, oats.prep_minutes, oats.cook_minutes]).toEqual([5, 5, 0]);
    expect(oats.tags_de).toEqual(['Unter 10 Minuten', 'zum Mitnehmen']);
    expect(oats.categories).toEqual(['schnell']);
    expect(oats.declared_diet).toBe('vegan');
    expect(oats.contains_pork).toBe(false);
    const omelett = recipeOf(output, 'omelett-natur');
    expect(omelett.training_tags).toEqual(['nach_training']);
    expect(omelett.categories).toEqual(['schnell', 'post-workout']);
    expect([omelett.prep_minutes, omelett.cook_minutes]).toEqual([1, 9]);
    for (const recipe of output.built.recipes) {
      expect(checkRecipeCategories(recipe)).toEqual([]);
    }
  });

  it('Mengen 0 g: ml, Prise, „nach Geschmack“ (skaliert nicht); Rolle als Vorschlag', () => {
    const oats = recipeOf(output, 'haferbrei-schnell');
    expect(oats.ingredients.map((i) => [i.food_id, i.amount, i.unit, i.scales, i.role])).toEqual([
      ['haferflocken', 60, 'g', true, 'carb'],
      ['wasser', 120, 'ml', true, 'seasoning'],
      ['salz', 1, 'pinch', true, 'seasoning'],
    ]);
    const omelett = recipeOf(output, 'omelett-natur');
    expect(omelett.ingredients[1]).toMatchObject({ unit: 'pinch', amount: 1, scales: false });
    expect(omelett.ingredients[0]?.food_id).toBe('huehnerei');
    expect(output.report.zeroAmounts).toMatchObject({ ml: 1, pinch: 4 });
  });

  it('heated: Vorgabe false, true nur bei eindeutigem Schritt – mit Annahme im Bericht', () => {
    const omelett = recipeOf(output, 'omelett-natur');
    expect(omelett.ingredients[0]?.heated).toBe(true);
    expect(omelett.meta.import_assumptions).toEqual([
      {
        ingredient_index: 0,
        food_id: 'huehnerei',
        field: 'heated',
        value: true,
        reason_de:
          'Schritt 2 gart die Zutat durch: „Die Eier in der Pfanne 10 Minuten braten, bis sie hart sind.“',
      },
    ]);
    expect(omelett.meta.import_assumptions_confirmed_by).toBeNull();
    // Unbestätigte Annahme zählt für die Schwangerschaft wie nicht erhitzt (Wächter N2c, B1).
    expect(omelett.declared_pregnancy_caution).toBe(true);

    const tatar = recipeOf(output, 'lachs-tatar');
    expect(tatar.ingredients[0]?.heated).toBe(false);
    expect(tatar.declared_pregnancy_caution).toBe(true);
    expect(tatar.meta.import_assumptions).toEqual([]);
    // Salz braucht kein heated.
    expect(tatar.ingredients[1]?.heated).toBeUndefined();

    expect(output.report.heatedAssumptions.map((a) => a.id)).toEqual([
      'omelett-natur',
      'lachs-mit-reis',
    ]);
    expect(output.report.heatedFalseCount).toBe(1);
  });

  it('deklarierte Allergene und Schwangerschaft = berechnet (S4); Ernährungsform/Schwein aus der Datei', () => {
    const lachs = recipeOf(output, 'lachs-mit-reis');
    expect(lachs.declared_allergens).toEqual(['fish']);
    expect(lachs.declared_diet).toBe('omnivore');
    expect(lachs.contains_pork).toBe(false);
    expect(output.report.dietMismatches).toEqual([
      { id: 'lachs-tatar', file: 'vegetarian', computed: 'omnivore' },
    ]);
    expect(output.report.porkMismatches).toEqual([]);
  });

  it('Meal-Prep: Haltbarkeit aus den Zutaten (R9), Aufbewahrungsplan nach R9, R20 meldet den Datei-Text', () => {
    const lachs = recipeOf(output, 'lachs-mit-reis');
    expect(lachs.meal_prep).toEqual({ suitable: true, fridge_days: 1, freezable: true });
    expect(lachs.meal_prep_plan_id).toBe('fisch-woche');
    expect(lachs.cost_estimate).toEqual({
      eur_per_serving: 3.2,
      as_of: '2026-10-11',
      basis: 'estimate',
    });
    const plan = output.built.mealPrepPlans[0];
    expect(plan?.storage_plan.map((e) => e.method)).toEqual([
      'fridge',
      'freeze',
      'freeze',
      'freeze',
      'freeze',
    ]);
    const issues = checkMealPrepPlan(
      plan as never,
      new Map(output.built.recipes.map((r) => [r.id, r])),
    );
    expect(issues.map((i) => [i.rule, i.path])).toEqual([['R20', 'storage_de.0']]);
  });

  it('Nährwerte: Abweichung > 3 % je Rezept und je Zutat gemeldet', () => {
    const recipeDev = output.report.deviations.filter((d) => d.scope === 'recipe');
    expect(recipeDev.map((d) => [d.id, d.field])).toContainEqual(['lachs-mit-reis', 'kcal']);
    expect(recipeDev.some((d) => d.id === 'omelett-natur')).toBe(false);
    const ingredientDev = output.report.deviations.filter((d) => d.scope === 'ingredient');
    expect(ingredientDev.map((d) => [d.id, d.field])).toEqual([['lachsfilet', 'kcal']]);
  });

  it('Ratgeber: Carb-Loading-Hinweis, Orte', () => {
    const wettkampf = output.built.guides.find((g) => g.id === 'wettkampf');
    expect(wettkampf?.sections[0]?.notice_de).toBe(CARB_LOADING_NOTICE_DE);
    expect(wettkampf?.sections[1]?.notice_de).toBeUndefined();
  });
});

describe('Idempotenz und Schutz (S5, R15)', () => {
  it('Zweitlauf mit der eigenen Ausgabe → nichts zu schreiben', () => {
    const first = run();
    const second = run(smallFile(), existingFrom(first));
    expect(second.writes).toEqual([]);
    expect(second.report.written).toEqual({ new: 0, updated: 0, unchanged: 7 });
  });

  it('geänderte Dateifassung + unberührter Entwurf → überschrieben mit höherer Version', () => {
    const first = run();
    const changed = smallFile();
    changed.rezepte[0] = { ...changed.rezepte[0]!, name: 'Schneller Haferbrei mit Salz' };
    const second = run(changed, existingFrom(first));
    expect(second.writes.map((w) => [w.id, w.action, w.content.version])).toEqual([
      ['haferbrei-schnell', 'updated', 2],
    ]);
  });

  it('von Hand geänderter Entwurf → nicht überschrieben, Bericht mit Unterschied', () => {
    const first = run();
    const existing = existingFrom(first);
    const edited = structuredClone(existing.recipe.get('lachs-mit-reis')) as Recipe;
    edited.declared_per_serving = { ...edited.declared_per_serving, kcal: 330 };
    (existing.recipe as Map<string, unknown>).set('lachs-mit-reis', edited);
    const changed = smallFile();
    changed.rezepte[2] = { ...changed.rezepte[2]!, tipp: 'Neuer Tipp aus der Datei.' };
    const second = run(changed, existing);
    expect(second.writes).toEqual([]);
    expect(second.report.handEdited).toEqual([
      {
        kind: 'recipe',
        id: 'lachs-mit-reis',
        reason:
          'von Hand geändert, nicht überschrieben – Unterschied zur neuen Dateifassung in: declared_per_serving, tip_de',
      },
    ]);
  });

  it('freigegeben oder zurückgezogen → nie überschrieben', () => {
    const first = run();
    const existing = existingFrom(first);
    const published = {
      ...(existing.guide.get('wettkampf') as object),
      status: 'published',
    };
    (existing.guide as Map<string, unknown>).set('wettkampf', published);
    const archived = { ...(existing.recipe.get('lachs-tatar') as object), status: 'archived' };
    (existing.recipe as Map<string, unknown>).set('lachs-tatar', archived);
    const changed = smallFile();
    changed.ratgeber.wettkampf[1] = { titel: 'Nichts Neues', text: 'Anderer Text.' };
    changed.rezepte[3] = { ...changed.rezepte[3]!, tipp: 'Anderer Tipp.' };
    const second = run(changed, existing);
    expect(second.writes).toEqual([]);
    expect(second.report.protectedFiles.map((s) => [s.id, s.reason])).toEqual([
      ['lachs-tatar', 'vorhandene Datei ist „archived“ – wird nie überschrieben (R15)'],
      ['wettkampf', 'vorhandene Datei ist „published“ – wird nie überschrieben (R15)'],
    ]);
  });

  it('ID fehlt in neuer Dateifassung → nichts gelöscht, nur gemeldet', () => {
    const first = run();
    const changed = smallFile();
    changed.rezepte = changed.rezepte.filter((r) => r.id !== 'lachs-tatar');
    const second = run(changed, existingFrom(first));
    expect(second.writes).toEqual([]);
    expect(second.report.removedIds).toEqual([{ kind: 'recipe', id: 'lachs-tatar' }]);
  });

  it('Zutat fehlt im Katalog → Rezept und abhängiger Plan nicht importiert', () => {
    const foods = new Map(CATALOG);
    foods.delete('basmatireis-trocken');
    const output = importAlpha5({ data: smallFile(), foods, existing: NO_FILES });
    expect(output.report.notImported).toEqual([
      {
        kind: 'recipe',
        id: 'lachs-mit-reis',
        reason: 'Zutat fehlt im Katalog: basmatireis-trocken',
      },
      {
        kind: 'meal_prep_plan',
        id: 'fisch-woche',
        reason: 'Rezept nicht importiert: lachs-mit-reis',
      },
    ]);
    expect(output.writes.map((w) => w.id).sort()).toEqual([
      'haferbrei-schnell',
      'lachs-tatar',
      'omelett-natur',
      'unterwegs',
      'wettkampf',
    ]);
  });
});

describe('Mengen „menge_g: 0“', () => {
  it.each([
    ['1 Prise', { amount: 1, unit: 'pinch', scales: true }],
    ['1 kräftige Prise (ca. 0,3 g)', { amount: 1, unit: 'pinch', scales: true }],
    ['1 Messerspitze', { amount: 1, unit: 'pinch', scales: true }],
    ['nach Geschmack', { amount: 1, unit: 'pinch', scales: false }],
    ['½ TL', { amount: 0.5, unit: 'tsp', scales: true }],
    ['1 ½ EL', { amount: 1.5, unit: 'tbsp', scales: true }],
    ['1–2 EL', { amount: 1, unit: 'tbsp', scales: true }],
    ['3–4 EL Nudelwasser', { amount: 3, unit: 'tbsp', scales: true }],
    ['80 ml, kochend', { amount: 80, unit: 'ml', scales: true }],
    ['100 ml + 50 ml', { amount: 150, unit: 'ml', scales: true }],
    ['2 Blätter', { amount: 2, unit: 'piece', scales: true }],
    ['3–4 Eiswürfel', { amount: 3, unit: 'piece', scales: true }],
  ])('%s', (text, expected) => {
    expect(parseZeroAmount(text)).toEqual(expected);
  });

  it.each(['etwas', '1 TL + 1 EL', '0 ml', 'TL'])('nicht umwandelbar: %s', (text) => {
    expect(parseZeroAmount(text)).toBeNull();
  });
});

describe('Ablauf mit Dateien (content:import-alpha5)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function repo(file: unknown = smallFile(), foods: readonly Food[] = FOODS): string {
    const root = mkdtempSync(join(tmpdir(), 'alpha5-'));
    dirs.push(root);
    const put = (path: string, data: unknown) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), `${JSON.stringify(data, null, 2)}\n`);
    };
    put('packages/content/seed/alpha5-rezepte.json', file);
    for (const food of foods) put(`content/foods/${food.id}.json`, food);
    return root;
  }

  const deps = (repoRoot: string) => ({ repoRoot, runId: '7', refName: 'main' });

  function snapshot(root: string, dir: string): Record<string, string> {
    const full = join(root, dir);
    if (!existsSync(full)) {
      return {};
    }
    const names = readdirSync(full);
    return Object.fromEntries(names.map((n) => [n, readFileSync(join(full, n), 'utf8')]));
  }

  it('schreiben: nur Zielordner, nie content/foods; Zweitlauf byte-gleich', async () => {
    const root = repo();
    const foodsBefore = snapshot(root, 'content/foods');
    const first = await runAlpha5Import('schreiben', deps(root));
    expect(first.exitCode).toBe(0);
    expect(first.paths.every((p) => /^content\/(recipes|meal-prep-plans|guides)\//.test(p))).toBe(
      true,
    );
    expect(first.paths).toHaveLength(7);
    expect(snapshot(root, 'content/foods')).toEqual(foodsBefore);
    const recipes = snapshot(root, 'content/recipes');
    const guides = snapshot(root, 'content/guides');
    expect(Object.keys(recipes).sort()).toEqual([
      'haferbrei-schnell.json',
      'lachs-mit-reis.json',
      'lachs-tatar.json',
      'omelett-natur.json',
    ]);

    const second = await runAlpha5Import('schreiben', deps(root));
    expect(second.paths).toEqual([]);
    expect(second.markdown).toContain('Keine Änderungen');
    expect(snapshot(root, 'content/recipes')).toEqual(recipes);
    expect(snapshot(root, 'content/guides')).toEqual(guides);
  });

  it('bericht: schreibt nichts; Bericht nennt Zahlen, Annahmen und Abweichungen', async () => {
    const root = repo();
    const result = await runAlpha5Import('bericht', deps(root));
    expect(result.exitCode).toBe(0);
    expect(snapshot(root, 'content/recipes')).toEqual({});
    expect(result.markdown).toContain('**4 Rezepte, 6 Zutaten, 1 Meal-Prep-Pläne, 2 Ratgeber**');
    expect(result.markdown).toContain('2 Annahmen');
    expect(result.markdown).toContain('`lachs-mit-reis` kcal: Datei 300');
    expect(result.markdown).toContain('Modus „bericht“: nichts geschrieben');
    expect(result.markdown).toContain('#### Abdeckung (R16)');
  });

  it('Schemafehler: Abbruch mit Meldung, nichts geschrieben', async () => {
    const root = repo({ ...smallFile(), unbekannt: true });
    const result = await runAlpha5Import('schreiben', deps(root));
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain('Import abgebrochen');
    expect(snapshot(root, 'content/recipes')).toEqual({});
    expect(snapshot(root, 'content/guides')).toEqual({});
  });

  it('Katalog fehlt: nichts geschrieben, Hinweis im Bericht', async () => {
    const root = repo(smallFile(), []);
    const result = await runAlpha5Import('schreiben', deps(root));
    expect(result.exitCode).toBe(0);
    expect(result.paths).toEqual([]);
    expect(result.markdown).toContain('Katalog fehlt');
    expect(snapshot(root, 'content/guides')).toEqual({});
  });

  it('pull-request nur auf main', async () => {
    const root = repo();
    const result = await runAlpha5Import('pull-request', { ...deps(root), refName: 'feature' });
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain('nur auf dem Branch main');
    expect(snapshot(root, 'content/recipes')).toEqual({});
  });

  function fakeApi(
    options: { mainSha?: string; openPulls?: { html_url: string; head: { ref: string } }[] } = {},
  ) {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const sha = 'c'.repeat(40);
    const api = {
      async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        calls.push({ method, path, body });
        if (path.startsWith('/pulls?')) return (options.openPulls ?? []) as T;
        if (path.startsWith('/git/ref/heads/'))
          return { object: { sha: options.mainSha ?? 'b'.repeat(40) } } as T;
        if (path.startsWith('/git/commits/')) return { tree: { sha: 't' } } as T;
        if (path === '/git/blobs') return { sha: 'blob' } as T;
        if (path === '/git/trees') return { sha: 'tree' } as T;
        if (path === '/git/commits') return { sha } as T;
        if (path === '/git/refs') return {} as T;
        if (path === `/commits/${sha}`)
          return {
            author: { login: 'github-actions[bot]' },
            commit: { verification: { verified: true } },
          } as T;
        if (path === '/pulls') return { html_url: 'https://github.com/x/y/pull/9' } as T;
        return {} as T;
      },
    };
    return { api, calls, sha };
  }

  it('pull-request: verifizierter Commit über die API, PR mit Bericht, ci gestartet', async () => {
    const root = repo();
    const { api, calls, sha } = fakeApi();
    const result = await runAlpha5Import('pull-request', {
      ...deps(root),
      baseSha: 'b'.repeat(40),
      api,
    });
    expect(result.exitCode).toBe(0);
    expect(result.prUrl).toBe('https://github.com/x/y/pull/9');
    const refs = calls.find((c) => c.path === '/git/refs');
    expect(refs?.body).toEqual({ ref: 'refs/heads/alpha5-import/7', sha });
    const commit = calls.find((c) => c.path === '/git/commits')?.body as { parents: string[] };
    expect(commit.parents).toEqual(['b'.repeat(40)]);
    const trees = calls.find((c) => c.path === '/git/trees')?.body as { tree: { path: string }[] };
    expect(trees.tree.every((t) => !t.path.startsWith('content/foods/'))).toBe(true);
    const pr = calls.find((c) => c.path === '/pulls')?.body as { body: string };
    expect(pr.body).toContain('So testest du es am Handy');
    expect(calls.some((c) => c.path.includes('/actions/workflows/ci.yml/dispatches'))).toBe(true);
  });

  it('pull-request: main hat sich seit dem Start geändert → Abbruch ohne Commit (S4)', async () => {
    const root = repo();
    const { api, calls } = fakeApi({ mainSha: 'd'.repeat(40) });
    await expect(
      runAlpha5Import('pull-request', { ...deps(root), baseSha: 'b'.repeat(40), api }),
    ).rejects.toThrow(/main hat sich seit dem Start geändert/);
    expect(calls.some((c) => c.path === '/git/commits' || c.path === '/pulls')).toBe(false);
  });

  it('pull-request: offener Import-PR → Abbruch, nichts geschrieben (S4)', async () => {
    const root = repo();
    const { api, calls } = fakeApi({
      openPulls: [
        { html_url: 'https://github.com/x/y/pull/3', head: { ref: 'alpha5-import/1' } },
        { html_url: 'https://github.com/x/y/pull/4', head: { ref: 'feature/x' } },
      ],
    });
    const result = await runAlpha5Import('pull-request', {
      ...deps(root),
      baseSha: 'b'.repeat(40),
      api,
    });
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain('https://github.com/x/y/pull/3');
    expect(result.markdown).not.toContain('pull/4');
    expect(snapshot(root, 'content/recipes')).toEqual({});
    expect(calls.some((c) => c.path === '/git/blobs')).toBe(false);
  });
});
