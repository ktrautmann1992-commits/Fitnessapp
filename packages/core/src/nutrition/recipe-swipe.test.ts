/**
 * Rezepte entdecken – Wochenauswahl per Wischen (Gründer-Wunsch 01.11.2026, docs/PLAN-REZEPT-SWIPE.md).
 * DoD: Stapel nur mit Rezepten, die die harten Filter des Essensplans bestehen (unabhängig nachgerechnet), ohne
 * Vorliebe, ohne Daumen-runter-Sperre, ohne „neutral gesehen“; „Mag ich“ landet über `swapMealRecipe` im Plan
 * (Planband unabhängig nachgerechnet, nichts verdrängt, Training/Meal-Prep/vergangene Tage unberührt), passt es
 * nicht, bleibt der Plan unverändert. Grenzfälle: leerer Bestand, alles entschieden, 1 vs. 7 Trainingstage,
 * Mahlzeit heute vs. vergangen, Obergrenze je Tag.
 */
import { describe, expect, it } from 'vitest';

import { RECIPE_SWIPE_RULES } from '../constants';
import type { Recipe } from '../content/recipe-schema';
import { filterRecipe, mealTypeForSlot } from './filter';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { independentBand, N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  placeRecipeSwipePicks,
  recipeSwipePreferenceKind,
  recipeSwipeSeenFor,
  recipeSwipeStack,
  recipeSwipeUndoPreference,
  withRecipeSwipeSeen,
} from './recipe-swipe';
import { type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, session } from './test-helpers';
import type { MealSlotId } from './timing';

const SUNDAY_BEFORE = '2026-10-11';
const EPS = 1e-6;
const OMNI: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const VEGAN: MealPlanProfileInput = { diet: 'vegan' };

const stackBase = {
  recipes: N3_RECIPES,
  foods: N3_FOODS,
  excludePregnancyCaution: false,
  allowDrafts: true,
  weekStart: MONDAY,
};

describe('Entscheidung → Vorliebe', () => {
  it('rechts = Herz, links = „Nie wieder“, oben = nichts', () => {
    expect(recipeSwipePreferenceKind('like')).toBe('favorite');
    expect(recipeSwipePreferenceKind('dislike')).toBe('hidden');
    expect(recipeSwipePreferenceKind('neutral')).toBeNull();
    expect(() => recipeSwipePreferenceKind('super' as never)).toThrow();
  });

  it('Rückgängig stellt die vorherige Vorliebe her; neutral ändert keine Vorliebe', () => {
    expect(
      recipeSwipeUndoPreference({ recipeId: 'lachs-reis', choice: 'like', previous: null }),
    ).toBeNull();
    expect(
      recipeSwipeUndoPreference({
        recipeId: 'lachs-reis',
        choice: 'dislike',
        previous: 'favorite',
      }),
    ).toBe('favorite');
    expect(
      recipeSwipeUndoPreference({ recipeId: 'lachs-reis', choice: 'neutral', previous: null }),
    ).toBeUndefined();
  });
});

describe('„Neutral gesehen“ je Woche', () => {
  it('gilt nur für dieselbe Woche; Ungültiges → leer', () => {
    const raw = { weekStart: MONDAY, recipeIds: ['lachs-reis', 'lachs-reis', 'banane-pur'] };
    expect(recipeSwipeSeenFor(raw, '2026-10-15')).toEqual(['lachs-reis', 'banane-pur']);
    expect(recipeSwipeSeenFor(raw, '2026-10-19')).toEqual([]);
    expect(recipeSwipeSeenFor({ weekStart: 'kaputt', recipeIds: [] }, MONDAY)).toEqual([]);
    expect(recipeSwipeSeenFor(null, MONDAY)).toEqual([]);
  });

  it('merken und vergessen; Obergrenze hält die neuesten', () => {
    expect(withRecipeSwipeSeen(['a-1'], 'lachs-reis', true)).toEqual(['a-1', 'lachs-reis']);
    expect(withRecipeSwipeSeen(['lachs-reis', 'a-1'], 'lachs-reis', true)).toEqual([
      'a-1',
      'lachs-reis',
    ]);
    expect(withRecipeSwipeSeen(['lachs-reis', 'a-1'], 'lachs-reis', false)).toEqual(['a-1']);
    const full = Array.from({ length: RECIPE_SWIPE_RULES.seenMax }, (_, i) => `id-${i}`);
    const next = withRecipeSwipeSeen(full, 'neu-1', true);
    expect(next).toHaveLength(RECIPE_SWIPE_RULES.seenMax);
    expect(next.at(-1)).toBe('neu-1');
    expect(next[0]).toBe('id-1');
  });
});

describe('Kartenstapel', () => {
  /** Unabhängig: besteht das Rezept den Filter des Essensplans mit der Profil-Ernährungsform? */
  function passesPlanFilter(recipe: Recipe, profile: MealPlanProfileInput): boolean {
    return filterRecipe(recipe, N3_FOODS, {
      profile: mealPlanProfileSchema.parse(profile),
      excludePregnancyCaution: false,
      allowDrafts: true,
    }).ok;
  }

  it('nur Rezepte, die zum Profil passen (vegan, omnivor) – nie außerhalb der Profil-Ernährungsform', () => {
    for (const profile of [OMNI, VEGAN]) {
      const cards = recipeSwipeStack({ ...stackBase, profile });
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        const recipe = N3_RECIPES.find((r) => r.id === card.recipeId) as Recipe;
        expect(passesPlanFilter(recipe, profile)).toBe(true);
      }
      const expected = N3_RECIPES.filter((r) => passesPlanFilter(r, profile)).map((r) => r.id);
      expect(cards.map((c) => c.recipeId).sort()).toEqual(
        expected.slice(0, RECIPE_SWIPE_RULES.stackMax).sort(),
      );
    }
    const vegan = recipeSwipeStack({ ...stackBase, profile: VEGAN }).map((c) => c.recipeId);
    expect(vegan).not.toContain('hack-spaghetti');
    expect(vegan).not.toContain('lachs-reis');
  });

  it('ohne Vorliebe, ohne „neutral gesehen“, ohne Daumen-runter-Sperre in der Woche', () => {
    const all = recipeSwipeStack({ ...stackBase, profile: OMNI }).map((c) => c.recipeId);
    const [fav, hidden, seen, down] = all as [string, string, string, string];
    const cards = recipeSwipeStack({
      ...stackBase,
      profile: OMNI,
      preferences: [
        { recipeId: fav, kind: 'favorite', setOn: '2026-10-01' },
        { recipeId: hidden, kind: 'hidden', setOn: '2026-10-01' },
      ],
      seen: [seen],
      ratings: [{ recipeId: down, value: 'down', ratedOn: '2026-10-01' }],
    }).map((c) => c.recipeId);
    expect(cards).toEqual(all.filter((id) => ![fav, hidden, seen, down].includes(id)));
    // Daumen runter vor über 8 Wochen: wieder im Stapel.
    expect(
      recipeSwipeStack({
        ...stackBase,
        profile: OMNI,
        ratings: [{ recipeId: down, value: 'down', ratedOn: '2026-07-01' }],
      }).map((c) => c.recipeId),
    ).toContain(down);
  });

  it('feste Reihenfolge je Woche (kein Zufall), Obergrenze, Nährwerte inkl. Fett', () => {
    const a = recipeSwipeStack({ ...stackBase, profile: OMNI });
    expect(recipeSwipeStack({ ...stackBase, profile: OMNI })).toEqual(a);
    // Ein anderer Tag derselben Woche ergibt denselben Stapel.
    expect(recipeSwipeStack({ ...stackBase, profile: OMNI, weekStart: '2026-10-16' })).toEqual(a);
    expect(recipeSwipeStack({ ...stackBase, profile: OMNI, limit: 2 })).toEqual(a.slice(0, 2));
    expect(() => recipeSwipeStack({ ...stackBase, profile: OMNI, limit: 0 })).toThrow();
    for (const card of a) {
      expect(card.perServing).not.toBeNull();
      expect(card.perServing?.kcal).toBeGreaterThan(0);
      expect(card.perServing?.fat_g).toBeGreaterThanOrEqual(0);
    }
  });

  it('leerer Bestand bzw. alles entschieden → leerer Stapel', () => {
    expect(recipeSwipeStack({ ...stackBase, profile: OMNI, recipes: [] })).toEqual([]);
    const all = recipeSwipeStack({ ...stackBase, profile: OMNI });
    expect(
      recipeSwipeStack({
        ...stackBase,
        profile: OMNI,
        seen: all.map((c) => c.recipeId),
      }),
    ).toEqual([]);
  });
});

describe('Wirkung auf den Wochenplan', () => {
  const PICKS = ['lachs-reis', 'champignon-reis'];

  function setup(extra: Parameters<typeof inputs>[0] = {}, today = SUNDAY_BEFORE) {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3, ...extra }),
      MONDAY,
    );
    const input: Omit<MealPlanInput, 'existingPlan' | 'variant'> = {
      targets,
      profile: OMNI,
      recipes: N3_RECIPES,
      foods: N3_FOODS,
      allowDrafts: true,
      today,
    };
    // Plan ohne die beiden Wunsch-Gerichte (sonst stünden sie schon drin).
    const plan = buildMealPlanWeek({
      ...input,
      today: SUNDAY_BEFORE,
      recipes: N3_RECIPES.filter((r) => !PICKS.includes(r.id)),
    });
    return { targets, input, plan };
  }

  function bandOk(plan: MealPlanWeek, targets: ReturnType<typeof setup>['targets']): string[] {
    const problems: string[] = [];
    for (const day of plan.days) {
      const t = targets.days.find((d) => d.date === day.date);
      if (t === undefined || t.band === null) continue;
      const [min, max] = independentBand(t);
      const optional = day.meals.reduce((n, m) => n + m.optionalKcal, 0);
      if (day.status === 'complete' && day.totals.kcal < min - EPS) {
        problems.push(`${day.date}: unter dem Band`);
      }
      if (day.totals.kcal + optional > max + EPS) problems.push(`${day.date}: über dem Band`);
    }
    return problems;
  }

  it('„Mag ich“ wird als selbst gewählt eingeplant, Mahlzeit-Art passt, Band unabhängig eingehalten', () => {
    const { targets, input, plan } = setup();
    const result = placeRecipeSwipePicks(plan, PICKS, input);
    expect(result.placed.map((p) => p.recipeId)).toEqual(PICKS);
    expect(result.unplaced).toEqual([]);
    for (const p of result.placed) {
      const meal = result.plan.days
        .find((d) => d.date === p.date)
        ?.meals.find((m) => m.slot === p.slot && !m.isFill);
      expect(meal?.recipeId).toBe(p.recipeId);
      expect(meal?.chosen).toBe(true);
      const recipe = N3_RECIPES.find((r) => r.id === p.recipeId) as Recipe;
      expect(recipe.meal_types).toContain(mealTypeForSlot(p.slot as MealSlotId));
    }
    // Verteilt: zwei Gerichte an zwei verschiedenen Tagen.
    expect(new Set(result.placed.map((p) => p.date)).size).toBe(2);
    expect(bandOk(result.plan, targets)).toEqual([]);
    // Vollständige Tage bleiben vollständig, keine Mahlzeit verdrängt.
    plan.days.forEach((day, i) => {
      const after = result.plan.days[i];
      if (day.status === 'complete') expect(after?.status).toBe('complete');
      expect(after?.meals.filter((m) => !m.isFill).length).toBe(
        day.meals.filter((m) => !m.isFill).length,
      );
    });
    // Deterministisch.
    expect(placeRecipeSwipePicks(plan, PICKS, input)).toEqual(result);
  });

  it('schon geplant → nichts zu tun; unpassend (vegan) → Plan unverändert, nur gemeldet', () => {
    const { input, plan } = setup();
    const inPlan = plan.days[3]?.meals.find((m) => !m.isFill)?.recipeId as string;
    const again = placeRecipeSwipePicks(plan, [inPlan], input);
    expect(again.alreadyPlanned).toEqual([inPlan]);
    expect(again.plan).toBe(plan);

    const veganPlan = buildMealPlanWeek({ ...input, profile: VEGAN });
    const result = placeRecipeSwipePicks(veganPlan, ['hack-spaghetti', 'unbekannt-1'], {
      ...input,
      profile: VEGAN,
    });
    expect(result.placed).toEqual([]);
    expect(result.unplaced).toEqual(['hack-spaghetti', 'unbekannt-1']);
    expect(result.plan).toBe(veganPlan);
  });

  it('vergangene Tage und schon selbst gewählte Mahlzeiten bleiben unberührt', () => {
    const today = '2026-10-15';
    const { input, plan } = setup({}, today);
    const first = placeRecipeSwipePicks(plan, ['lachs-reis'], input);
    expect((first.placed[0]?.date ?? '') >= today).toBe(true);
    expect(first.plan.days.filter((d) => d.date < today)).toEqual(
      plan.days.filter((d) => d.date < today),
    );
    // Zweiter Durchgang: das erste Gericht bleibt, das zweite kommt woanders hin.
    const second = placeRecipeSwipePicks(first.plan, ['champignon-reis'], input);
    const kept = second.plan.days
      .find((d) => d.date === first.placed[0]?.date)
      ?.meals.find((m) => m.slot === first.placed[0]?.slot && !m.isFill);
    expect(kept?.recipeId).toBe('lachs-reis');
  });

  it('Plätze vor/nach dem Training bleiben bei der Engine (1 vs. 7 Trainingstage)', () => {
    for (const days of [1, 7]) {
      const sessions = Array.from({ length: days }, (_, i) =>
        session(`2026-10-${String(12 + i).padStart(2, '0')}`),
      );
      const { input, plan } = setup({ trainingTime: 'evening', sessions });
      const result = placeRecipeSwipePicks(plan, PICKS, input);
      for (const p of result.placed) {
        const before = plan.days
          .find((d) => d.date === p.date)
          ?.meals.find((m) => m.slot === p.slot && !m.isFill);
        expect(before?.role ?? null).toBeNull();
      }
      plan.days.forEach((day, i) => {
        for (const meal of day.meals) {
          if (meal.role === null) continue;
          const after = result.plan.days[i]?.meals.find((m) => m.slot === meal.slot);
          expect(after?.recipeId).toBe(meal.recipeId);
        }
      });
    }
  });

  it('höchstens zwei gewählte Gerichte je Tag', () => {
    const { input, plan } = setup({}, '2026-10-18'); // Sonntag: nur noch ein Tag übrig
    const result = placeRecipeSwipePicks(
      plan,
      [...PICKS, 'hack-spaghetti', 'tofu-erdnuss-curry'],
      input,
    );
    expect(result.placed.length).toBeLessThanOrEqual(RECIPE_SWIPE_RULES.maxPicksPerDay);
    expect(result.placed.every((p) => p.date === '2026-10-18')).toBe(true);
  });
});
