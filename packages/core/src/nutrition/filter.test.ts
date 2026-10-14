import { describe, expect, it } from 'vitest';

import type { Food } from '../content/food-schema';
import { importAssumptionsFingerprint } from '../content/import-meta';
import {
  FIXTURE_FOODS,
  FOOD_META,
  foodLookup,
  ing,
  makeFood,
  makeRecipe,
} from '../content/nutrition-fixtures';
import { recipeSchema } from '../content/recipe-schema';
import { filterRecipe, type RecipeFilterContext, slotFitReasons } from './filter';
import { N3_EXTRA_RECIPES, N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';

function ctx(
  profile: MealPlanProfileInput,
  extra: Partial<Omit<RecipeFilterContext, 'profile'>> = {},
): RecipeFilterContext {
  return {
    profile: mealPlanProfileSchema.parse(profile),
    excludePregnancyCaution: false,
    allowDrafts: true,
    ...extra,
  };
}

function recipe(id: string) {
  const found = N3_RECIPES.find((r) => r.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

const omni = { diet: 'omnivore', eatsPork: true } as const;

/** Milchreis: Milch als Pflichtzutat ohne Gluten – für Ersatz-Zutaten (S4). */
const milchreis = makeRecipe({
  id: 'milchreis',
  title_de: 'Milchreis',
  description_de: 'Reis in Milch gekocht, mit etwas Zucker.',
  ingredients: [ing('reis', 60, 'g'), ing('vollmilch', 300, 'ml'), ing('zucker', 10, 'g')],
  declared_allergens: ['dairy', 'lactose'],
});

describe('N3-Fixtures', () => {
  it('alle zusätzlichen Rezepte sind schema-gültig', () => {
    for (const r of N3_EXTRA_RECIPES) {
      expect(recipeSchema.safeParse(r).success, r.id).toBe(true);
    }
  });
});

describe('filterRecipe – Ernährungsform, Schwein (W9, W10, S5)', () => {
  it('Honig ist nicht vegan, aber vegetarisch', () => {
    const honigBanane = makeRecipe({
      id: 'honig-banane',
      ingredients: [ing('banane', 1, 'piece'), ing('honig', 1, 'tsp')],
    });
    expect(filterRecipe(honigBanane, N3_FOODS, ctx({ diet: 'vegan' }))).toMatchObject({
      ok: false,
      reasons: ['diet'],
    });
    expect(filterRecipe(honigBanane, N3_FOODS, ctx({ diet: 'vegetarian' })).ok).toBe(true);
  });

  it('Parmesan (Lab) ist nicht vegetarisch – optional wird er weggelassen und neu gerechnet', () => {
    const r = filterRecipe(recipe('spaghetti-tomatensauce'), N3_FOODS, ctx({ diet: 'vegetarian' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.omitted).toEqual([5]);
    expect(r.value.facts.diet).toBe('vegan');
    expect(r.value.facts.allergens).not.toContain('dairy');
    const pflicht = makeRecipe({
      id: 'nudeln-parmesan',
      ingredients: [ing('spaghetti', 100, 'g'), ing('parmesan', 20, 'g')],
    });
    expect(filterRecipe(pflicht, N3_FOODS, ctx({ diet: 'vegetarian' }))).toMatchObject({
      ok: false,
      reasons: ['diet'],
    });
  });

  it('Gelatine (Herkunft unbekannt) zählt als Schwein: nur bei eats_pork = true', () => {
    const gelee = recipe('milch-gelee');
    expect(filterRecipe(gelee, N3_FOODS, ctx({ diet: 'omnivore', eatsPork: false }))).toMatchObject(
      { ok: false, reasons: ['pork'] },
    );
    expect(filterRecipe(gelee, N3_FOODS, ctx(omni)).ok).toBe(true);
  });

  it('W10: eats_pork = null bei Mischkost wird wie „nein“ behandelt', () => {
    for (const id of ['hack-spaghetti', 'salami-brot', 'milch-gelee']) {
      expect(filterRecipe(recipe(id), N3_FOODS, ctx({ diet: 'omnivore', eatsPork: null }))).toEqual(
        { ok: false, reasons: ['pork'] },
      );
      expect(filterRecipe(recipe(id), N3_FOODS, ctx({ diet: 'omnivore' })).ok).toBe(false);
    }
  });

  it('vegan schließt Fleisch, Fisch, Milch und Ei aus; vegetarisch nur Fleisch/Fisch', () => {
    const vegan = ctx({ diet: 'vegan' });
    expect(filterRecipe(recipe('tofu-paprika'), N3_FOODS, vegan).ok).toBe(true);
    for (const id of ['omelett-champignons', 'haehnchen-reis', 'lachs-reis', 'overnight-oats']) {
      expect(filterRecipe(recipe(id), N3_FOODS, vegan).ok, id).toBe(false);
    }
    expect(
      filterRecipe(recipe('omelett-champignons'), N3_FOODS, ctx({ diet: 'vegetarian' })).ok,
    ).toBe(true);
  });
});

describe('filterRecipe – Unverträglichkeit, „mag ich nicht“ (W9, K9)', () => {
  it('optionale Erdnüsse + Erdnuss-Unverträglichkeit → weggelassen, Allergene neu', () => {
    const r = filterRecipe(
      recipe('porridge-banane'),
      N3_FOODS,
      ctx({ diet: 'vegetarian', intolerances: ['peanuts'] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.omitted).toEqual([4]);
    expect(r.value.facts.allergens).not.toContain('peanuts');
  });

  it('Erdnuss als Pflichtzutat → Rezept raus', () => {
    expect(
      filterRecipe(
        recipe('erdnuss-banane'),
        N3_FOODS,
        ctx({ diet: 'vegan', intolerances: ['peanuts'] }),
      ),
    ).toEqual({ ok: false, reasons: ['intolerance'] });
  });

  it('K9: Unverträglichkeit und „mag ich“ derselben Gruppe → ausgeschlossen', () => {
    const r = filterRecipe(
      recipe('erdnuss-banane'),
      N3_FOODS,
      ctx({ diet: 'vegan', intolerances: ['peanuts'], likes: ['peanuts'] }),
    );
    expect(r.ok).toBe(false);
  });

  it('„mag ich nicht“ ist hart', () => {
    for (const id of ['omelett-champignons', 'champignon-reis']) {
      expect(
        filterRecipe(recipe(id), N3_FOODS, ctx({ diet: 'vegetarian', dislikes: ['mushrooms'] })),
      ).toEqual({ ok: false, reasons: ['dislike'] });
    }
  });

  it('S4: laktosefreie Milch bei Laktose, Haferdrink bei Milcheiweiß, raus bei Milch + Gluten', () => {
    const lactose = filterRecipe(
      milchreis,
      N3_FOODS,
      ctx({ diet: 'vegetarian', intolerances: ['lactose'] }),
    );
    expect(lactose.ok && lactose.value.substitutions).toEqual([
      { index: 1, foodId: 'vollmilch', substituteFoodId: 'milch-laktosefrei' },
    ]);
    // Laktosefreie Milch bleibt `dairy` → bei Milcheiweiß-Allergie nie (S4).
    const dairy = filterRecipe(
      milchreis,
      N3_FOODS,
      ctx({ diet: 'vegetarian', intolerances: ['dairy'] }),
    );
    expect(dairy.ok && dairy.value.substitutions).toEqual([
      { index: 1, foodId: 'vollmilch', substituteFoodId: 'haferdrink' },
    ]);
    expect(dairy.ok && dairy.value.facts.allergens).toEqual(['gluten']);
    // Haferdrink enthält Gluten → kompletter Filter mit Ersatz → raus.
    expect(
      filterRecipe(
        milchreis,
        N3_FOODS,
        ctx({ diet: 'vegetarian', intolerances: ['dairy', 'gluten'] }),
      ),
    ).toEqual({ ok: false, reasons: ['intolerance'] });
    // „mag ich nicht: Milch“ wird genauso ersetzt.
    const dislike = filterRecipe(
      milchreis,
      N3_FOODS,
      ctx({ diet: 'vegetarian', dislikes: ['dairy'] }),
    );
    expect(dislike.ok).toBe(true);
  });

  it('Ersatz behebt keine Ernährungsform: vegan + Vollmilch → raus', () => {
    expect(filterRecipe(milchreis, N3_FOODS, ctx({ diet: 'vegan' }))).toMatchObject({ ok: false });
  });
});

describe('filterRecipe – Schwangerschaft (W4, W20, Wächter N2c B1)', () => {
  const pregnant = (profile: MealPlanProfileInput = omni) =>
    ctx(profile, { excludePregnancyCaution: true });

  it('rohes Ei, Räucherlachs, Salami → raus; durchgegartes Ei und Lachs → ok', () => {
    for (const id of ['mascarponecreme-roh', 'brot-raeucherlachs', 'salami-brot']) {
      expect(filterRecipe(recipe(id), N3_FOODS, pregnant()).ok, id).toBe(false);
    }
    for (const id of ['omelett-champignons', 'lachs-reis', 'haehnchen-reis']) {
      expect(filterRecipe(recipe(id), N3_FOODS, pregnant()).ok, id).toBe(true);
    }
  });

  it('unbestätigte Import-Annahme „erhitzt“ zählt wie ungegart; bestätigt → ok', () => {
    const r = recipe('lachs-reis-annahme');
    expect(filterRecipe(r, N3_FOODS, pregnant())).toEqual({
      ok: false,
      reasons: ['pregnancy_caution'],
    });
    expect(filterRecipe(r, N3_FOODS, ctx(omni)).ok).toBe(true);
    const confirmed = {
      ...r,
      meta: {
        ...r.meta,
        import_assumptions_confirmed_by: 'KT',
        import_assumptions_fingerprint: importAssumptionsFingerprint(r),
      },
    };
    expect(filterRecipe(confirmed, N3_FOODS, pregnant()).ok).toBe(true);
    // Bestätigt, danach Menge geändert → wieder ausgeschlossen (sichere Richtung, Wächter N2d S2).
    const edited = {
      ...confirmed,
      ingredients: confirmed.ingredients.map((i, index) =>
        index === 0 ? { ...i, amount: i.amount + 10 } : i,
      ),
    };
    expect(filterRecipe(edited, N3_FOODS, pregnant()).ok).toBe(false);
  });

  it('optionale heikle Zutat wird weggelassen', () => {
    const r = makeRecipe({
      id: 'brot-optional-lachs',
      no_cook: true,
      cook_minutes: 0,
      ingredients: [
        ing('vollkornbrot', 2, 'piece'),
        ing('raeucherlachs', 30, 'g', { optional: true, heated: false }),
      ],
    });
    const result = filterRecipe(r, N3_FOODS, pregnant());
    expect(result.ok && result.value.omitted).toEqual([1]);
    expect(result.ok && result.value.facts.pregnancyCaution).toBe(false);
  });
});

describe('filterRecipe – Bestand (Status, roter Befund, Katalog, Alkohol)', () => {
  const base = ctx(omni);

  it('Entwurf nur im Testmodus, archiviert nie, roter Befund nie', () => {
    const r = recipe('tofu-paprika');
    expect(filterRecipe(r, N3_FOODS, { ...base, allowDrafts: false })).toEqual({
      ok: false,
      reasons: ['status'],
    });
    expect(filterRecipe({ ...r, status: 'archived' }, N3_FOODS, base).ok).toBe(false);
    expect(filterRecipe(r, N3_FOODS, { ...base, redRecipeIds: new Set([r.id]) })).toEqual({
      ok: false,
      reasons: ['red_issue'],
    });
  });

  it('Lebensmittel fehlt oder ist nicht katalog-geprüft → raus', () => {
    const r = recipe('tofu-paprika');
    const without = foodLookup(FIXTURE_FOODS.filter((f) => f.id !== 'tofu'));
    expect(filterRecipe(r, without, base)).toEqual({ ok: false, reasons: ['food_unavailable'] });
    const unreviewed = foodLookup(
      FIXTURE_FOODS.map((f) =>
        f.id === 'tofu'
          ? { ...f, meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null } }
          : f,
      ),
    );
    expect(filterRecipe(r, unreviewed, base).ok).toBe(false);
  });

  it('Alkohol (R12) → raus, auch optional', () => {
    const wein: Food = makeFood({ id: 'weisswein', name_de: 'Weißwein', alcohol: true });
    const foods = foodLookup([...FIXTURE_FOODS, wein]);
    const r = makeRecipe({
      id: 'risotto-wein',
      ingredients: [ing('reis', 60, 'g'), ing('weisswein', 50, 'g', { optional: true })],
    });
    expect(filterRecipe(r, foods, base)).toEqual({ ok: false, reasons: ['alcohol'] });
  });
});

describe('slotFitReasons', () => {
  it('Mahlzeiten-Typ, Meal-Prep, Zeitlimit, Wettkampf, Ergänzungs-Snack nur no_cook', () => {
    const tofu = recipe('tofu-paprika');
    expect(slotFitReasons(tofu, { slot: 'lunch' })).toEqual([]);
    expect(slotFitReasons(tofu, { slot: 'breakfast' })).toEqual(['meal_type']);
    expect(
      slotFitReasons(recipe('omelett-champignons'), { slot: 'lunch', mealPrep: true }),
    ).toEqual(['meal_prep_unsuitable']);
    expect(slotFitReasons(tofu, { slot: 'dinner', maxMinutes: 20 })).toEqual(['prep_time']);
    expect(slotFitReasons({ ...tofu, categories: ['wettkampf'] }, { slot: 'dinner' })).toEqual([
      'competition',
    ]);
    expect(slotFitReasons(recipe('milch-gelee'), { slot: 'snack_late', fill: true })).toEqual([
      'not_no_cook',
    ]);
    expect(slotFitReasons(recipe('banane-pur'), { slot: 'snack_late', fill: true })).toEqual([]);
  });
});

describe('mealPlanProfileSchema', () => {
  it('Schwein nur bei Mischkost, Meal-Prep braucht Kochtage, mag ↔ mag nicht', () => {
    expect(mealPlanProfileSchema.safeParse({ diet: 'vegan', eatsPork: true }).success).toBe(false);
    expect(
      mealPlanProfileSchema.safeParse({ diet: 'vegan', cookingMode: 'meal_prep' }).success,
    ).toBe(false);
    expect(
      mealPlanProfileSchema.safeParse({ diet: 'vegan', likes: ['soy'], dislikes: ['soy'] }).success,
    ).toBe(false);
    expect(
      mealPlanProfileSchema.safeParse({ diet: 'vegan', likes: ['soy'], intolerances: ['soy'] })
        .success,
    ).toBe(true);
  });
});
