import { describe, expect, it } from 'vitest';

import { FIXTURE_RECIPES, ing, makeRecipe, RECIPE_META } from './nutrition-fixtures';
import { recipeSchema } from './recipe-schema';

const messages = (data: unknown) => {
  const parsed = recipeSchema.safeParse(data);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('recipeSchema (R1)', () => {
  it('alle Fixture-Rezepte sind gültig', () => {
    for (const recipe of FIXTURE_RECIPES) {
      expect(messages(recipe), recipe.id).toEqual([]);
    }
  });

  it('Grenzen: Portionen 1–8, Zutaten 1–20, Schritte 1–15, Zeiten, Beschreibung ≤ 200', () => {
    expect(messages(makeRecipe({ servings: 0 })).length).toBe(1);
    expect(messages(makeRecipe({ servings: 9 })).length).toBe(1);
    expect(messages(makeRecipe({ servings: 8 }))).toEqual([]);
    expect(messages(makeRecipe({ ingredients: [] })).length).toBeGreaterThan(0);
    expect(
      messages(makeRecipe({ ingredients: Array.from({ length: 21 }, () => ing('salz', 1, 'g')) }))
        .length,
    ).toBe(1);
    expect(messages(makeRecipe({ steps_de: [] })).length).toBe(1);
    expect(messages(makeRecipe({ prep_minutes: 0 })).length).toBe(1);
    expect(messages(makeRecipe({ cook_minutes: 241 })).length).toBe(1);
    expect(messages(makeRecipe({ description_de: 'x'.repeat(201) })).length).toBe(1);
    expect(messages(makeRecipe({ meal_types: [] })).length).toBe(1);
  });

  it('Zutat: Menge > 0, bekannte Einheit, strikt', () => {
    expect(messages(makeRecipe({ ingredients: [ing('salz', 0, 'g')] })).length).toBe(1);
    expect(messages(makeRecipe({ ingredients: [ing('salz', 1, 'kg' as never)] })).length).toBe(1);
    expect(
      messages(makeRecipe({ ingredients: [{ ...ing('salz', 1, 'g'), brand: 'x' } as never] }))
        .length,
    ).toBe(1);
  });

  it('heated: true in einem Rezept ohne Kochen ist ein Schema-Fehler (Plan 5.2)', () => {
    expect(
      messages(
        makeRecipe({
          no_cook: true,
          cook_minutes: 0,
          ingredients: [ing('huehnerei', 1, 'piece', { heated: true })],
        }),
      ).join(),
    ).toMatch(/no_cook/);
  });

  it('mindestens eine Zutat ist nicht optional', () => {
    expect(
      messages(makeRecipe({ ingredients: [ing('salz', 1, 'g', { optional: true })] })).join(),
    ).toMatch(/nicht optional/);
  });

  it('Meal-Prep: ohne Eignung keine Haltbarkeit, Haltbarkeit höchstens 3 Tage', () => {
    expect(
      messages(makeRecipe({ meal_prep: { suitable: false, fridge_days: 2, freezable: false } })),
    ).toHaveLength(1);
    expect(
      messages(makeRecipe({ meal_prep: { suitable: true, fridge_days: 4, freezable: true } })),
    ).toHaveLength(1);
  });

  it('unbekannte Allergen-Gruppe, Ernährungsform oder Trainings-Markierung → Fehler', () => {
    expect(messages(makeRecipe({ declared_allergens: ['egg' as never] })).length).toBe(1);
    expect(messages(makeRecipe({ declared_diet: 'pescetarian' as never })).length).toBe(1);
    expect(messages(makeRecipe({ training_tags: ['waehrend', 'waehrend'] })).length).toBe(1);
  });

  it('freigegeben ohne Prüfer → Fehler', () => {
    expect(messages(makeRecipe({ status: 'published' })).join()).toMatch(/reviewed_by/);
    expect(
      messages(
        makeRecipe({
          status: 'published',
          meta: { ...RECIPE_META, reviewed_by: 'KT', reviewed_at: '2026-10-11' },
        }),
      ),
    ).toEqual([]);
  });

  it('optionale Felder aus alpha5-rezepte.json: Tipp, Schlagworte, Anzeige, Meal-Prep-Plan', () => {
    const recipe = makeRecipe({
      tip_de: 'Im verschlossenen Glas hält sich das Frühstück 2 Tage im Kühlschrank.',
      tags_de: ['Unter 10 Minuten', 'zum Mitnehmen'],
      meal_prep_plan_id: 'vegan',
      ingredients: [ing('haferflocken', 60, 'g', { display_de: '60 g' })],
    });
    expect(messages(recipe)).toEqual([]);
    expect(messages(makeRecipe({ tags_de: ['Meal-Prep', 'Meal-Prep'] })).length).toBe(1);
    expect(messages(makeRecipe({ tip_de: 'x'.repeat(401) })).length).toBe(1);
    expect(messages(makeRecipe({ meal_prep_plan_id: 'Vegan Woche' })).length).toBe(1);
  });
});
