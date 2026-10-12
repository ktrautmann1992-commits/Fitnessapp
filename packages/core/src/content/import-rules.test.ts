import { describe, expect, it } from 'vitest';

import {
  criteriaCategories,
  estimateCookMinutes,
  findHeatingStep,
  HEAT_VERB_FORMS,
  ingredientNameWords,
  notFullyCookedHint,
  proposeIngredientRole,
  recipeTotalMinutes,
  smallestMinutes,
  stepHeats,
} from './import-rules';
import { FIXTURE_FOODS, makeFood, makeRecipe } from './nutrition-fixtures';
import { checkRecipeCategories } from './recipe-checks';

const food = (id: string) => {
  const found = FIXTURE_FOODS.find((f) => f.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe('heated beim Import (Plan 19.2, S4): Vorgabe false, true nur eindeutig', () => {
  it('Namens-Wörter ohne Klammerzusatz und Füllwörter', () => {
    expect(ingredientNameWords(['Hähnchenbrust (roh)'])).toEqual(['haehnchenbrust']);
    expect(ingredientNameWords(['Ei', 'Hühnerei'])).toEqual(['ei', 'huehnerei']);
    expect(ingredientNameWords(['Thunfisch im eigenen Saft (abgetropft)'])).toEqual(['thunfisch']);
    expect(ingredientNameWords(['1 TK'])).toEqual([]);
  });

  it('Verb und Zutat im selben Schritt → Index des Schritts', () => {
    const steps = ['Zwiebel schneiden.', 'Die Eier in der Pfanne braten und salzen.'];
    expect(findHeatingStep(steps, ['ei'])).toBe(1);
    expect(findHeatingStep(['Brate das Hähnchenbrust-Filet scharf an.'], ['haehnchenbrust'])).toBe(
      0,
    );
    expect(findHeatingStep(['Lachs im Ofen 12 Minuten garen.'], ['lachs'])).toBe(0);
    expect(findHeatingStep(['Lass die Soße mit dem Hack köcheln.'], ['hack'])).toBe(0);
    expect(findHeatingStep(['Dünste den Fisch 8 Minuten.'], ['fisch'])).toBe(0);
    expect(findHeatingStep(['Der Auflauf wird mit Käse überbacken.'], ['kaese'])).toBe(0);
    // Kopfwort ab 4 Buchstaben: „Lachs“ für „Lachsfilet“, „Pute“ für „Putenbrust“.
    expect(findHeatingStep(['Lachs im Ofen 15 Minuten garen.'], ['lachsfilet'])).toBe(0);
    expect(findHeatingStep(['Pute scharf anbraten.'], ['putenbrust'])).toBe(0);
    // Zu kurz bzw. kein Anfang des Namens: kein Treffer.
    expect(findHeatingStep(['Eier braten.'], ['eiklar'])).toBeNull();
    expect(findHeatingStep(['Filet braten.'], ['lachsfilet'])).toBeNull();
  });

  it('kein Verb, Verb ohne Zutat oder „kochendes Wasser“ → null (sichere Richtung)', () => {
    expect(findHeatingStep(['Eier verquirlen und stocken lassen.'], ['ei'])).toBeNull();
    expect(findHeatingStep(['Reis kochen.', 'Lachs darauf legen.'], ['lachs'])).toBeNull();
    expect(
      findHeatingStep(['Gieße kochendes Wasser über den Räucherlachs.'], ['raeucherlachs']),
    ).toBeNull();
    expect(findHeatingStep(['Brate alles an.'], [])).toBeNull();
    expect(findHeatingStep([], ['ei'])).toBeNull();
  });

  it('„Ei“ trifft nicht „ein“, „einer“ oder „Weizen“', () => {
    expect(findHeatingStep(['Brate einer Pfanne Weizen an.'], ['ei'])).toBeNull();
    expect(findHeatingStep(['Brate ein Stück Tofu an.'], ['ei'])).toBeNull();
    expect(findHeatingStep(['Brate zwei Eier an.'], ['ei'])).toBe(0);
  });

  it('Wächter N2c B1: „erhitzt“ ist nicht „durchgegart“ – die sechs Sätze der Gründer-Datei → false', () => {
    const cases: [string, string[], boolean][] = [
      [
        'Backe alles weitere 12–15 Minuten, bis der Lachs innen gerade glasig-rosa ist.',
        ['lachsfilet'],
        false,
      ],
      [
        'Brate das Ei im restlichen Öl als Spiegelei und serviere es mit den Lauchzwiebelringen auf dem Reis.',
        ['ei'],
        true,
      ],
      [
        'Brate die Eier parallel im Rapsöl in einer beschichteten Pfanne bei mittlerer Hitze 3–4 Minuten als Spiegeleier.',
        ['ei'],
        true,
      ],
      [
        'Drücke zwei Mulden in die Sauce, schlage die Eier hinein und gare sie mit Deckel bei niedriger Hitze 6–8 Minuten, bis das Eiweiß fest ist.',
        ['ei'],
        true,
      ],
      [
        'Koche das Ei 6,5 Minuten in sprudelndem Wasser, schrecke es kalt ab und pelle es.',
        ['ei'],
        true,
      ],
      [
        'Koche das Ei in siedendem Wasser 7 Minuten, schrecke es kalt ab und pelle es.',
        ['ei'],
        true,
      ],
    ];
    for (const [step, names, egg] of cases) {
      expect(findHeatingStep([step], names, { egg }), step).toBeNull();
    }
  });

  it('Gegenfälle: hart gekochtes Ei, ≥ 9 Minuten, durchgegarter Fisch → true', () => {
    expect(findHeatingStep(['Koche die Eier 10 Minuten hart.'], ['ei'], { egg: true })).toBe(0);
    expect(findHeatingStep(['Koche das Ei 9 Minuten.'], ['ei'], { egg: true })).toBe(0);
    // „kurz“ allein schließt nicht aus; „hartgekocht“ zählt als hart.
    expect(findHeatingStep(['Koche die hartgekochten Eier kurz mit.'], ['ei'], { egg: true })).toBe(
      0,
    );
    expect(
      findHeatingStep(['Backe die Eier im Ofen, bis sie hart sind.'], ['ei'], { egg: true }),
    ).toBe(0);
    expect(findHeatingStep(['Lachs im Ofen 15 Minuten garen.'], ['lachsfilet'])).toBe(0);
  });

  it('Ei ohne „hart“ und unter 9 Minuten → false; Ausschluss in einem anderen Schritt zählt mit', () => {
    expect(
      findHeatingStep(['Brate die Eier 4 Minuten als Rührei.'], ['ei'], { egg: true }),
    ).toBeNull();
    expect(findHeatingStep(['Koche das Ei 8–10 Minuten.'], ['ei'], { egg: true })).toBeNull();
    expect(
      findHeatingStep(
        ['Brate den Lachs 10 Minuten.', 'Der Lachs soll innen glasig bleiben.'],
        ['lachs'],
      ),
    ).toBeNull();
    expect(findHeatingStep(['Brate den Lachs nur kurz an.'], ['lachs'])).toBeNull();
    expect(findHeatingStep(['Brate das Rinderhack medium.'], ['rinderhack'])).toBeNull();
    expect(findHeatingStep(['Pochiere die Eier 4 Minuten.'], ['ei'])).toBeNull();
    expect(findHeatingStep(['Koche die Eier wachsweich.'], ['ei'])).toBeNull();
  });

  it('Hinweis-Muster und Minuten', () => {
    expect(notFullyCookedHint('innen gerade glasig-rosa')).toBe('glasig');
    expect(notFullyCookedHint('Rosa Pfeffer darüber.')).toBe('rosa');
    expect(notFullyCookedHint('Rosenkohl kochen.')).toBeNull();
    expect(notFullyCookedHint('Brot rösten.')).toBeNull();
    expect(smallestMinutes('Koche das Ei 6,5 Minuten.')).toBe(6.5);
    expect(smallestMinutes('6–8 Min. garen, dann 2 Minuten ruhen.')).toBe(2);
    expect(smallestMinutes('Ohne Zeit.')).toBeNull();
  });

  it('Schritte mit Hitze-Verb; Kochzeit aus den Schritten (obere Zahl, höchstens Gesamtzeit − 1)', () => {
    expect(stepHeats('Brate das Gemüse an.')).toBe(true);
    expect(stepHeats('Gieße kochendes Wasser darüber.')).toBe(false);
    const steps = [
      'Gemüse 5 Minuten schneiden.',
      'Reis 10–12 Minuten kochen.',
      'Tofu 4 Min. braten.',
      'Mit 2 Minuten Ruhezeit servieren.',
    ];
    expect(estimateCookMinutes(steps, 30, false)).toBe(16);
    expect(estimateCookMinutes(steps, 10, false)).toBe(9);
    expect(estimateCookMinutes(steps, 30, true)).toBe(0);
    expect(estimateCookMinutes(['Ohne Zeitangabe braten.'], 20, false)).toBe(0);
    expect(estimateCookMinutes(steps, 1, false)).toBe(0);
  });

  it('Wortliste enthält alle Verben des Plans', () => {
    for (const verb of [
      'braten',
      'kochen',
      'backen',
      'garen',
      'duensten',
      'anbraten',
      'koecheln',
      'ueberbacken',
    ]) {
      expect(HEAT_VERB_FORMS).toContain(verb);
    }
    expect(HEAT_VERB_FORMS).not.toContain('kochend');
  });
});

describe('Rolle je Zutat (19.4, S6) – nur Vorschlag', () => {
  it('Prise → Würze, viel Zucker → Süße', () => {
    expect(proposeIngredientRole(food('haehnchenbrust'), 'pinch')).toBe('seasoning');
    expect(proposeIngredientRole(food('honig'), 'tsp')).toBe('sweet');
    expect(proposeIngredientRole(food('zucker'), 'g')).toBe('sweet');
  });

  it('Abteilung Gewürze → Würze, Obst & Gemüse → Gemüse, TK unter 100 kcal → Gemüse', () => {
    expect(proposeIngredientRole(food('salz'), 'g')).toBe('seasoning');
    expect(proposeIngredientRole(food('paprika'), 'piece')).toBe('vegetable');
    const tk = makeFood({ id: 'erbsen-tk', shopping_category: 'frozen' });
    expect(
      proposeIngredientRole(
        { ...tk, nutrients_per_100g: { ...tk.nutrients_per_100g, kcal: 80 } },
        'g',
      ),
    ).toBe('vegetable');
  });

  it('Energieanteile: Eiweiß, Fett, Kohlenhydrate, ohne Energie → Würze', () => {
    expect(proposeIngredientRole(food('haehnchenbrust'), 'g')).toBe('protein');
    expect(proposeIngredientRole(food('olivenoel'), 'tbsp')).toBe('fat');
    expect(proposeIngredientRole(food('reis'), 'g')).toBe('carb');
    const water = makeFood({
      id: 'wasser',
      shopping_category: 'drinks',
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
    });
    expect(proposeIngredientRole(water, 'ml')).toBe('seasoning');
  });

  it('Mischfall ohne klare Mehrheit → größter Anteil', () => {
    const mixed = makeFood({
      id: 'nussmus',
      shopping_category: 'nuts_seeds_dried_fruit',
      nutrients_per_100g: {
        kcal: 400,
        protein_g: 6,
        carbs_g: 40,
        sugar_g: 5,
        fat_g: 22,
        sat_fat_g: 3,
        fiber_g: 5,
        salt_g: 0,
      },
    });
    // Eiweiß 24, KH 160, Fett 198 kcal → kein Anteil über der Schwelle, Fett am größten.
    expect(proposeIngredientRole(mixed, 'g')).toBe('fat');
  });
});

describe('Kategorien aus Merkmalen und R22', () => {
  it('Gesamtzeit: total_minutes, sonst Vorbereitung + Kochzeit', () => {
    expect(recipeTotalMinutes(makeRecipe({ total_minutes: 12 }))).toBe(12);
    expect(recipeTotalMinutes(makeRecipe())).toBe(8);
  });

  it('Grenze „schnell“: 10 Minuten ja, 11 nein', () => {
    expect(criteriaCategories(makeRecipe({ total_minutes: 10 })).has('schnell')).toBe(true);
    expect(
      criteriaCategories(makeRecipe({ total_minutes: 11, prep_minutes: 5, cook_minutes: 5 })).has(
        'schnell',
      ),
    ).toBe(false);
  });

  it('Pre-/Post-Workout und Meal-Prep aus Trainings-Angabe bzw. Eignung', () => {
    const recipe = makeRecipe({
      total_minutes: 30,
      prep_minutes: 10,
      cook_minutes: 20,
      training_tags: ['vor_training', 'nach_training'],
      meal_prep: { suitable: true, fridge_days: 2, freezable: false },
    });
    expect([...criteriaCategories(recipe)].sort()).toEqual([
      'meal-prep',
      'post-workout',
      'pre-workout',
    ]);
  });

  it('R22: ohne Kategorien-Feld kein Befund; passend kein Befund', () => {
    expect(checkRecipeCategories(makeRecipe())).toEqual([]);
    expect(
      checkRecipeCategories(makeRecipe({ categories: ['schnell', 'pre-workout', 'cardio'] })),
    ).toEqual([]);
  });

  it('R22 gelb in beide Richtungen', () => {
    const issues = checkRecipeCategories(
      makeRecipe({
        categories: ['schnell', 'meal-prep'],
        total_minutes: 25,
        prep_minutes: 10,
        cook_minutes: 15,
      }),
    );
    expect(issues.map((i) => [i.rule, i.severity])).toEqual([
      ['R22', 'warning'],
      ['R22', 'warning'],
      ['R22', 'warning'],
    ]);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/Fertig in 10 Minuten.*25 Min/);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/vor dem Training.*Pre-Workout/);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/Meal-Prep“, aber nicht für/);
  });
});
