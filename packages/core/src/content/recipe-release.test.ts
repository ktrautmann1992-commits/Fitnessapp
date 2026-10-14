import { describe, expect, it } from 'vitest';

import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import type { Food } from './food-schema';
import type { Guide } from './guide-schema';
import { importAssumptionsFingerprint, importAssumptionsState } from './import-meta';
import type { MealPrepPlan } from './meal-prep-plan-schema';
import {
  catalogFor,
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  foodLookup,
  RECIPE_META,
} from './nutrition-fixtures';
import type { Recipe } from './recipe-schema';
import {
  planNutritionRelease,
  planRecipeRelease,
  recipeReleaseBlockerText,
  recipesInCategory,
  releasedRecipe,
  type RecipeReleaseOptions,
} from './recipe-release';
import type { NutritionContentFile } from './validate';

const OPTIONS: RecipeReleaseOptions = {
  reviewer: 'KT',
  date: '2026-10-13',
  expertReviewed: false,
  confirmAssumptions: false,
};

/** Freigegebene, katalog-geprüfte Lebensmittel (Voraussetzung für freigegebene Rezepte, R19). */
const PUBLISHED_FOODS: Food[] = FIXTURE_FOODS.map((food) => ({
  ...food,
  status: 'published',
  meta: { ...food.meta, reviewed_by: 'KT', reviewed_at: '2026-10-12' },
}));

function recipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  const base = FIXTURE_RECIPES.find((r) => r.id === id);
  if (base === undefined) throw new Error(`Fixture ${id} fehlt`);
  return { ...base, categories: ['post-workout'], ...overrides };
}

/** Omelett mit Import-Annahme „Ei durchgegart“ (unbestätigt → zählt für die Schwangerschaft wie ungegart). */
function omelettWithAssumption(): Recipe {
  const base = recipe('omelett-champignons');
  return {
    ...base,
    declared_pregnancy_caution: true,
    meta: {
      ...base.meta,
      import_assumptions: [
        {
          ingredient_index: 0,
          food_id: 'huehnerei',
          field: 'heated',
          value: true,
          reason_de: 'Schritt „stocken lassen“ mit Hitze-Verb.',
        },
      ],
      import_assumptions_confirmed_by: null,
    },
  };
}

function files(
  foods: readonly Food[],
  recipes: readonly Recipe[],
  plans: readonly MealPrepPlan[] = [],
  guides: readonly Guide[] = [],
): NutritionContentFile[] {
  return [
    ...foods.map((food) => ({ kind: 'food' as const, fileName: `${food.id}.json`, data: food })),
    ...recipes.map((r) => ({ kind: 'recipe' as const, fileName: `${r.id}.json`, data: r })),
    ...plans.map((p) => ({ kind: 'meal_prep_plan' as const, fileName: `${p.id}.json`, data: p })),
    ...guides.map((g) => ({ kind: 'guide' as const, fileName: `${g.id}.json`, data: g })),
  ];
}

function plan(
  foods: readonly Food[],
  recipes: readonly Recipe[],
  options: Partial<RecipeReleaseOptions> = {},
) {
  return planRecipeRelease(
    files(foods, recipes),
    catalogFor(foods),
    (r) => (r.categories ?? []).includes('post-workout'),
    { ...OPTIONS, ...options },
  );
}

describe('Sammelfreigabe pro Kategorie (Plan 19.5, N2d)', () => {
  it('recipesInCategory: n:m, Rezepte ohne Kategorie nie dabei', () => {
    const a = recipe('porridge-banane', { categories: ['schnell', 'post-workout'] });
    const b = recipe('haehnchen-reis', { categories: ['meal-prep'] });
    const c = { ...recipe('tofu-paprika') };
    delete (c as { categories?: unknown }).categories;
    expect(recipesInCategory([a, b, c], 'post-workout').map((r) => r.id)).toEqual([
      'porridge-banane',
    ]);
    expect(recipesInCategory([a, b, c], 'meal-prep').map((r) => r.id)).toEqual(['haehnchen-reis']);
  });

  it('Entwurf ohne roten Befund, alle Lebensmittel geprüft und freigegeben → freigegeben mit Prüfvermerk', () => {
    const [decision] = plan(PUBLISHED_FOODS, [recipe('porridge-banane')]);
    expect(decision?.blockers).toEqual([]);
    expect(decision?.released.status).toBe('published');
    expect(decision?.released.version).toBe(1);
    expect(decision?.released.meta.reviewed_by).toBe('KT');
    expect(decision?.released.meta.reviewed_at).toBe('2026-10-13');
    expect(decision?.released.meta.expert_reviewed).toBe(false);
  });

  it('Lebensmittel nur Entwurf → übersprungen (freigegebenes Rezept nur mit freigegebenen Lebensmitteln)', () => {
    const [decision] = plan(FIXTURE_FOODS, [recipe('porridge-banane')]);
    expect(decision?.blockers.map((b) => b.kind)).toContain('foods_not_published');
    expect(recipeReleaseBlockerText(decision!.blockers[0]!)).toContain('haferflocken');
  });

  it('Lebensmittel nicht katalog-geprüft → übersprungen (R19), Grund nennt das Lebensmittel', () => {
    const foods = PUBLISHED_FOODS.map((food) =>
      food.id === 'banane'
        ? { ...food, meta: { ...food.meta, catalog_reviewed_by: null, catalog_reviewed_at: null } }
        : food,
    );
    const [decision] = plan(foods, [recipe('porridge-banane')]);
    expect(decision?.blockers).toContainEqual({
      kind: 'foods_not_catalog_reviewed',
      foodIds: ['banane'],
    });
  });

  it('Lebensmittel fehlt im Katalog → übersprungen', () => {
    const foods = PUBLISHED_FOODS.filter((food) => food.id !== 'banane');
    const [decision] = plan(foods, [recipe('porridge-banane')]);
    expect(decision?.blockers).toContainEqual({ kind: 'foods_missing', foodIds: ['banane'] });
  });

  it('roter Befund (Textregel R10) → übersprungen mit Regel im Grund', () => {
    const [decision] = plan(PUBLISHED_FOODS, [
      recipe('porridge-banane', { description_de: 'Eiweißreich und schnell gemacht am Morgen.' }),
    ]);
    const red = decision?.blockers.find((b) => b.kind === 'red_issues');
    expect(red).toBeDefined();
    expect(recipeReleaseBlockerText(red!)).toContain('R10');
  });

  it('unbestätigte Import-Annahme ohne Häkchen → übersprungen, nichts bestätigt', () => {
    const [decision] = plan(PUBLISHED_FOODS, [omelettWithAssumption()]);
    expect(decision?.blockers).toContainEqual({ kind: 'unconfirmed_assumptions', count: 1 });
    expect(decision?.released.meta.import_assumptions_confirmed_by).toBeNull();
  });

  it('mit Häkchen „Import-Annahmen geprüft“: bestätigt, Schwangerschafts-Hinweis neu berechnet (B1), freigegeben', () => {
    const [decision] = plan(PUBLISHED_FOODS, [omelettWithAssumption()], {
      confirmAssumptions: true,
    });
    expect(decision?.blockers).toEqual([]);
    expect(decision?.released.meta.import_assumptions_confirmed_by).toBe('KT');
    expect(decision?.released.declared_pregnancy_caution).toBe(false);
  });

  it('Bestätigung speichert den Fingerabdruck über Zutaten, Schritte und no_cook (Gründer-Entscheidung 14.10.2026)', () => {
    const omelett = omelettWithAssumption();
    const [decision] = plan(PUBLISHED_FOODS, [omelett], { confirmAssumptions: true });
    expect(decision?.released.meta.import_assumptions_fingerprint).toBe(
      importAssumptionsFingerprint(omelett),
    );
    expect(importAssumptionsState(decision!.released)).toBe('confirmed');
    // Ohne Häkchen kein Fingerabdruck.
    const [without] = plan(PUBLISHED_FOODS, [omelett]);
    expect(without?.released.meta.import_assumptions_fingerprint).toBeUndefined();
  });

  it('S1: bestätigte Annahme + weiterer Grund (Lebensmittel mit pregnancy_caution) → Hinweis bleibt true', () => {
    const foods = PUBLISHED_FOODS.map((food) =>
      food.id === 'champignons' ? { ...food, pregnancy_caution: true } : food,
    );
    const [decision] = plan(foods, [omelettWithAssumption()], { confirmAssumptions: true });
    expect(decision?.released.meta.import_assumptions_confirmed_by).toBe('KT');
    expect(decision?.released.declared_pregnancy_caution).toBe(true);
    expect(decision?.blockers).toEqual([]);
    expect(
      computeRecipeFacts(decision!.released, foodLookup(foods)).pregnancyReasons.map((r) => r.kind),
    ).not.toContain('unconfirmed_heated');
  });

  it('S1: bestätigte Annahme + zweite Zutat „nicht durchgegart“ → Hinweis bleibt true', () => {
    const omelett = omelettWithAssumption();
    const withRaw: Recipe = {
      ...omelett,
      ingredients: omelett.ingredients.map((i) =>
        i.food_id === 'champignons' ? { ...i, heated: false } : i,
      ),
    };
    // Zweite tierische Zutat (hier Champignons als „Ei“ markiert, Testwert) ungegart → eigener Grund.
    const foods = foodLookup(
      PUBLISHED_FOODS.map((food) =>
        food.id === 'champignons' ? { ...food, animal: ['egg' as const] } : food,
      ),
    );
    const released = releasedRecipe(withRaw, foods, { ...OPTIONS, confirmAssumptions: true });
    expect(released.meta.import_assumptions_confirmed_by).toBe('KT');
    expect(released.declared_pregnancy_caution).toBe(true);
    const kinds = computeRecipeFacts(released, foods).pregnancyReasons.map((r) => r.kind);
    expect(kinds).toEqual(['not_heated']);
  });

  it('nach der Bestätigung geändert (Fingerabdruck passt nicht) → wieder Grund „nicht bestätigt“; mit Häkchen neu bestätigt', () => {
    const omelett = omelettWithAssumption();
    const confirmedDraft: Recipe = {
      ...omelett,
      declared_pregnancy_caution: false,
      meta: {
        ...omelett.meta,
        import_assumptions_confirmed_by: 'AB',
        import_assumptions_fingerprint: importAssumptionsFingerprint(omelett),
      },
    };
    expect(plan(PUBLISHED_FOODS, [confirmedDraft])[0]?.blockers).toEqual([]);
    const edited: Recipe = {
      ...confirmedDraft,
      steps_de: [...confirmedDraft.steps_de, 'Mit rohem Eigelb garnieren.'],
    };
    expect(importAssumptionsState(edited)).toBe('changed');
    const [blocked] = plan(PUBLISHED_FOODS, [edited]);
    expect(blocked?.blockers.map((b) => b.kind)).toContain('unconfirmed_assumptions');
    const [again] = plan(PUBLISHED_FOODS, [edited], { confirmAssumptions: true });
    expect(again?.blockers).toEqual([]);
    expect(again?.released.meta.import_assumptions_confirmed_by).toBe('KT');
    expect(again?.released.meta.import_assumptions_fingerprint).toBe(
      importAssumptionsFingerprint(edited),
    );
  });

  it('ohne Neuberechnung wäre R13 rot – die Neuberechnung ist nötig', () => {
    const omelett = omelettWithAssumption();
    const confirmedOnly: Recipe = {
      ...omelett,
      status: 'published',
      meta: {
        ...omelett.meta,
        reviewed_by: 'KT',
        reviewed_at: '2026-10-13',
        import_assumptions_confirmed_by: 'KT',
        import_assumptions_fingerprint: importAssumptionsFingerprint(omelett),
      },
    };
    const [decision] = planRecipeRelease(
      files(PUBLISHED_FOODS, [{ ...confirmedOnly, status: 'draft' }]),
      catalogFor(PUBLISHED_FOODS),
      () => true,
      OPTIONS,
    );
    expect(decision?.blockers.find((b) => b.kind === 'red_issues')).toMatchObject({
      rules: ['R13'],
    });
  });

  it('Häkchen „fachlich geprüft“ setzt expert_reviewed; ohne Häkchen bleibt ein vorhandenes true stehen', () => {
    const foods = foodLookup(PUBLISHED_FOODS);
    const porridge = recipe('porridge-banane');
    expect(
      releasedRecipe(porridge, foods, { ...OPTIONS, expertReviewed: true }).meta,
    ).toMatchObject({ expert_reviewed: true });
    const already = { ...porridge, meta: { ...porridge.meta, expert_reviewed: true } };
    expect(releasedRecipe(already, foods, OPTIONS).meta.expert_reviewed).toBe(true);
  });

  it('schon freigegeben oder zurückgezogen → unverändert, Grund „schon freigegeben“ / „zurückgezogen“', () => {
    const published = recipe('porridge-banane', {
      status: 'published',
      meta: { ...recipe('porridge-banane').meta, reviewed_by: 'AB', reviewed_at: '2026-10-01' },
    });
    const archived = recipe('spaghetti-tomatensauce', { status: 'archived' });
    const decisions = plan(PUBLISHED_FOODS, [published, archived]);
    expect(decisions.map((d) => recipeReleaseBlockerText(d.blockers[0]!))).toEqual([
      'schon freigegeben',
      'zurückgezogen (bleibt so)',
    ]);
    expect(decisions[0]?.released.meta.reviewed_by).toBe('AB');
  });

  it('nur die ausgewählte Kategorie wird geplant', () => {
    const decisions = plan(PUBLISHED_FOODS, [
      recipe('porridge-banane'),
      recipe('haehnchen-reis', { categories: ['meal-prep'] }),
    ]);
    expect(decisions.map((d) => d.original.id)).toEqual(['porridge-banane']);
  });
});

/** Meal-Prep-Plan mit Spaghetti: Mo–Mi Kühlschrank (R9: 3 Tage), Do/Fr eingefroren. */
function spaghettiPlan(overrides: Partial<MealPrepPlan> = {}): MealPrepPlan {
  return {
    id: 'pasta-woche',
    version: 1,
    status: 'draft',
    title_de: 'Pasta-Woche',
    description_de: 'Testplan mit Spaghetti, keine echten Inhalte.',
    recipe_ids: ['spaghetti-tomatensauce'],
    cook_steps: [{ start_min: 0, text_de: 'Sauce kochen.' }],
    storage_plan: (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((weekday, index) => ({
      recipe_id: 'spaghetti-tomatensauce',
      weekday,
      method: index < 3 ? ('fridge' as const) : ('freeze' as const),
    })),
    storage_de: [],
    meta: { ...RECIPE_META },
    ...overrides,
  };
}

function guide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'wettkampf',
    version: 1,
    status: 'draft',
    title_de: 'Wettkampf-Ernährung',
    sections: [
      {
        heading_de: 'Nichts Neues am Wettkampftag',
        body_de: ['Teste jede Mahlzeit vorher im Training.'],
      },
    ],
    meta: { ...RECIPE_META, origin: 'manual', model: null },
    ...overrides,
  };
}

describe('Freigabe per ID (Art „ids“, Gründer-Entscheidungen 14.10.2026)', () => {
  const noCategory = () => {
    const r = recipe('porridge-banane');
    delete (r as { categories?: unknown }).categories;
    return r;
  };

  it('Rezept ohne Kategorie per ID: dieselben Regeln wie die Sammelfreigabe', () => {
    const { decisions } = planNutritionRelease(
      files(PUBLISHED_FOODS, [noCategory()]),
      catalogFor(PUBLISHED_FOODS),
      ['porridge-banane'],
      OPTIONS,
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.kind).toBe('recipe');
    expect(decisions[0]?.blockers).toEqual([]);
    expect(decisions[0]?.released.status).toBe('published');
    // Gleiche Gründe: Lebensmittel nicht freigegeben → übersprungen.
    const blocked = planNutritionRelease(
      files(FIXTURE_FOODS, [noCategory()]),
      catalogFor(FIXTURE_FOODS),
      ['porridge-banane'],
      OPTIONS,
    );
    expect(blocked.decisions[0]?.blockers.map((b) => b.kind)).toContain('foods_not_published');
  });

  it('Annahmen per ID: ohne Häkchen übersprungen, mit Häkchen bestätigt (wie Sammelfreigabe)', () => {
    const omelett = omelettWithAssumption();
    delete (omelett as { categories?: unknown }).categories;
    const run = (confirmAssumptions: boolean) =>
      planNutritionRelease(
        files(PUBLISHED_FOODS, [omelett]),
        catalogFor(PUBLISHED_FOODS),
        [omelett.id],
        { ...OPTIONS, confirmAssumptions },
      ).decisions[0];
    expect(run(false)?.blockers).toContainEqual({ kind: 'unconfirmed_assumptions', count: 1 });
    const confirmed = run(true);
    expect(confirmed?.blockers).toEqual([]);
    expect(confirmed?.kind === 'recipe' && confirmed.released.declared_pregnancy_caution).toBe(
      false,
    );
  });

  it('Lebensmittel nie über diesen Weg, unbekannte IDs gemeldet, Reihenfolge der Eingabe', () => {
    const result = planNutritionRelease(
      files(PUBLISHED_FOODS, [recipe('porridge-banane'), recipe('tofu-paprika')]),
      catalogFor(PUBLISHED_FOODS),
      ['tofu-paprika', 'haferflocken', 'gibt-es-nicht', 'porridge-banane'],
      OPTIONS,
    );
    expect(result.foodIds).toEqual(['haferflocken']);
    expect(result.unknownIds).toEqual(['gibt-es-nicht']);
    expect(result.decisions.map((d) => d.original.id)).toEqual(['tofu-paprika', 'porridge-banane']);
  });

  it('gleiche ID als Rezept und Ratgeber → mehrdeutig, nichts geplant', () => {
    const result = planNutritionRelease(
      files(PUBLISHED_FOODS, [recipe('porridge-banane')], [], [guide({ id: 'porridge-banane' })]),
      catalogFor(PUBLISHED_FOODS),
      ['porridge-banane'],
      OPTIONS,
    );
    expect(result.ambiguousIds).toEqual(['porridge-banane']);
    expect(result.decisions).toEqual([]);
  });

  it('Meal-Prep-Plan: nur wenn alle Rezepte danach freigegeben sind (vorher oder im selben Lauf)', () => {
    const spaghetti = recipe('spaghetti-tomatensauce');
    const alone = planNutritionRelease(
      files(PUBLISHED_FOODS, [spaghetti], [spaghettiPlan()]),
      catalogFor(PUBLISHED_FOODS),
      ['pasta-woche'],
      OPTIONS,
    );
    expect(alone.decisions[0]?.kind).toBe('meal_prep_plan');
    expect(alone.decisions[0]?.blockers).toContainEqual({
      kind: 'recipes_not_released',
      recipeIds: ['spaghetti-tomatensauce'],
    });
    expect(recipeReleaseBlockerText(alone.decisions[0]!.blockers[0]!)).toContain(
      'Rezepte nicht freigegeben',
    );

    const together = planNutritionRelease(
      files(PUBLISHED_FOODS, [spaghetti], [spaghettiPlan()]),
      catalogFor(PUBLISHED_FOODS),
      ['spaghetti-tomatensauce', 'pasta-woche'],
      { ...OPTIONS, expertReviewed: true },
    );
    expect(together.decisions.map((d) => [d.kind, d.blockers])).toEqual([
      ['recipe', []],
      ['meal_prep_plan', []],
    ]);
    const released = together.decisions[1]!.released;
    expect(released.status).toBe('published');
    expect(released.meta).toMatchObject({
      reviewed_by: 'KT',
      reviewed_at: '2026-10-13',
      expert_reviewed: true,
    });
  });

  it('Meal-Prep-Plan: Rezept im selben Lauf übersprungen → Plan auch übersprungen', () => {
    const foods = PUBLISHED_FOODS.map((food) =>
      food.id === 'zwiebel'
        ? { ...food, meta: { ...food.meta, catalog_reviewed_by: null, catalog_reviewed_at: null } }
        : food,
    );
    const result = planNutritionRelease(
      files(foods, [recipe('spaghetti-tomatensauce')], [spaghettiPlan()]),
      catalogFor(foods),
      ['spaghetti-tomatensauce', 'pasta-woche'],
      OPTIONS,
    );
    expect(result.decisions[0]?.blockers.map((b) => b.kind)).toContain(
      'foods_not_catalog_reviewed',
    );
    expect(result.decisions[1]?.blockers).toContainEqual({
      kind: 'recipes_not_released',
      recipeIds: ['spaghetti-tomatensauce'],
    });
  });

  it('Meal-Prep-Plan mit Aufbewahrung gegen R9 (Kühlschrank bis Freitag) → roter Befund R20', () => {
    const published = recipe('spaghetti-tomatensauce', {
      status: 'published',
      meta: {
        ...recipe('spaghetti-tomatensauce').meta,
        reviewed_by: 'KT',
        reviewed_at: '2026-10-01',
      },
    });
    const fridgeAll = spaghettiPlan({
      storage_plan: (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((weekday) => ({
        recipe_id: 'spaghetti-tomatensauce',
        weekday,
        method: 'fridge' as const,
      })),
    });
    const result = planNutritionRelease(
      files(PUBLISHED_FOODS, [published], [fridgeAll]),
      catalogFor(PUBLISHED_FOODS),
      ['pasta-woche'],
      OPTIONS,
    );
    const red = result.decisions[0]?.blockers.find((b) => b.kind === 'red_issues');
    expect(red).toMatchObject({ rules: ['R20'] });
    // Mit gültiger Aufbewahrung und schon freigegebenem Rezept: frei.
    const ok = planNutritionRelease(
      files(PUBLISHED_FOODS, [published], [spaghettiPlan()]),
      catalogFor(PUBLISHED_FOODS),
      ['pasta-woche'],
      OPTIONS,
    );
    expect(ok.decisions[0]?.blockers).toEqual([]);
  });

  it('Ratgeber: ohne roten Befund frei, mit rotem Befund (Textregel) übersprungen; schon freigegeben bleibt', () => {
    const ok = planNutritionRelease(
      files(PUBLISHED_FOODS, [], [], [guide()]),
      catalogFor(PUBLISHED_FOODS),
      ['wettkampf'],
      OPTIONS,
    );
    expect(ok.decisions[0]?.kind).toBe('guide');
    expect(ok.decisions[0]?.blockers).toEqual([]);
    expect(ok.decisions[0]?.released.status).toBe('published');

    const claim = guide({
      sections: [
        {
          heading_de: 'Wundermittel',
          body_de: ['Dieses Frühstück heilt Erkältungen und stärkt das Immunsystem garantiert.'],
        },
      ],
    });
    const red = planNutritionRelease(
      files(PUBLISHED_FOODS, [], [], [claim]),
      catalogFor(PUBLISHED_FOODS),
      ['wettkampf'],
      OPTIONS,
    );
    expect(red.decisions[0]?.blockers.map((b) => b.kind)).toEqual(['red_issues']);

    const already = guide({
      status: 'published',
      meta: { ...guide().meta, reviewed_by: 'AB', reviewed_at: '2026-10-01' },
    });
    const same = planNutritionRelease(
      files(PUBLISHED_FOODS, [], [], [already]),
      catalogFor(PUBLISHED_FOODS),
      ['wettkampf'],
      OPTIONS,
    );
    expect(same.decisions[0]?.blockers).toEqual([{ kind: 'not_draft', status: 'published' }]);
    expect(same.decisions[0]?.released.meta.reviewed_by).toBe('AB');
  });

  it('S6: Ratgeber mit gelbem R21H (Dosierung) nur mit „fachlich geprüft“', () => {
    const dosage = guide({
      sections: [
        {
          heading_de: 'Koffein',
          body_de: ['Viele nehmen 3 mg Koffein pro kg Körpergewicht vor dem Rennen.'],
        },
      ],
    });
    const run = (expertReviewed: boolean) =>
      planNutritionRelease(
        files(PUBLISHED_FOODS, [], [], [dosage]),
        catalogFor(PUBLISHED_FOODS),
        ['wettkampf'],
        { ...OPTIONS, expertReviewed },
      ).decisions[0];
    const without = run(false);
    expect(without?.blockers.map((b) => b.kind)).toEqual(['needs_expert_review']);
    expect(recipeReleaseBlockerText(without!.blockers[0]!)).toContain('fachlich geprüft');
    expect(run(true)?.blockers).toEqual([]);
  });
});
