/**
 * Gespeicherter Essensplan (docs/PLAN-PHASE-5.md 6.3 Nr. 7, 6.6, 8.2 Nr. 3, Etappe N5): Gerätespeicher prüfen,
 * Plan beim Öffnen auflösen (neu / gespeichert / automatisch neu geplant, W11), „Andere Vorschläge“, „Plan
 * aktualisieren“ (≥ 5 %), Datumsrahmen. Grenzfälle: 1 vs. 8 Mahlzeiten, `no_targets`, vergangene Tage, Sonntag,
 * höchste Variante.
 */
import { describe, expect, it } from 'vitest';

import { MEAL_PLAN_ENGINE_VERSION, MEAL_PLAN_UPDATE_MIN_CHANGE } from '../constants';
import type { Food } from '../content/food-schema';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  mealPlanMatchesRecipes,
  mealPlanUpdateSuggested,
  mealPlanWeekEditable,
  mealPlanWithOtherSuggestions,
  nextMealPlanVariant,
  parseStoredMealPlanWeek,
  refreshedMealPlan,
  resolveMealPlanWeek,
} from './meal-plan-store';
import { automaticReplan, needsAutomaticReplan } from './replan';
import { swapMealRecipe } from './meal-plan';
import type { MealPlanProfileInput, NutritionInputsInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const THURSDAY = '2026-10-15';
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const female = { sex: 'female' as const, healthFlags: { flags: [] } };

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

function input(
  overrides: Partial<NutritionInputsInput> = {},
  profile: MealPlanProfileInput = omni,
  today = SUNDAY_BEFORE,
): PlanInput {
  return {
    targets: nutritionTargetsForWeek(inputs({ today, mealsPerDay: 4, ...overrides }), MONDAY),
    profile,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
  };
}

/** Wie im Gerätespeicher: JSON hin und zurück. */
function viaStorage(plan: MealPlanWeek): unknown {
  return JSON.parse(JSON.stringify(plan)) as unknown;
}

const caution = (food: Food | undefined) => food?.pregnancy_caution === true;

describe('parseStoredMealPlanWeek (Gerätespeicher, 7.5)', () => {
  it('ein gespeicherter Plan kommt unverändert zurück – 1, 4 und 8 Mahlzeiten, no_targets', () => {
    for (const mealsPerDay of [1, 4, 8]) {
      const plan = buildMealPlanWeek(input({ ...female, mealsPerDay }));
      expect(parseStoredMealPlanWeek(viaStorage(plan))).toEqual(plan);
    }
    const noTargets = buildMealPlanWeek(input({ ...female, healthDataConsent: false }));
    expect(noTargets.days.every((d) => d.status === 'no_targets')).toBe(true);
    expect(parseStoredMealPlanWeek(viaStorage(noTargets))).toEqual(noTargets);
  });

  it('ungültige oder fremde Stände gelten als nicht vorhanden', () => {
    const plan = buildMealPlanWeek(input(female));
    const stored = viaStorage(plan) as Record<string, unknown>;
    expect(parseStoredMealPlanWeek(null)).toBeNull();
    expect(parseStoredMealPlanWeek('Plan')).toBeNull();
    expect(
      parseStoredMealPlanWeek({ ...stored, engineVersion: MEAL_PLAN_ENGINE_VERSION + 1 }),
    ).toBeNull();
    expect(parseStoredMealPlanWeek({ ...stored, unknownField: 1 })).toBeNull();
    expect(parseStoredMealPlanWeek({ ...stored, weekStart: '2026-10-13' })).toBeNull();
    expect(
      parseStoredMealPlanWeek({ ...stored, days: (stored.days as unknown[]).slice(1) }),
    ).toBeNull();
    const days = structuredClone(stored.days) as { date: string }[];
    [days[0], days[1]] = [days[1] as { date: string }, days[0] as { date: string }];
    expect(parseStoredMealPlanWeek({ ...stored, days })).toBeNull();
    const broken = structuredClone(stored) as { days: { meals: { factor: unknown }[] }[] };
    const meal = broken.days[0]?.meals[0];
    if (meal) meal.factor = 'doppelt';
    expect(parseStoredMealPlanWeek(broken)).toBeNull();
  });
});

describe('mealPlanWeekEditable (Datumsrahmen wie save_meal_plan)', () => {
  it('laufende und nächste Woche ja, vorige und übernächste nein', () => {
    expect(mealPlanWeekEditable(MONDAY, THURSDAY)).toBe(true);
    expect(mealPlanWeekEditable('2026-10-19', THURSDAY)).toBe(true);
    expect(mealPlanWeekEditable('2026-10-05', THURSDAY)).toBe(false);
    expect(mealPlanWeekEditable('2026-10-26', THURSDAY)).toBe(false);
  });

  it('Sonntag gehört zur laufenden Woche (Mo–So)', () => {
    expect(mealPlanWeekEditable('2026-10-05', SUNDAY_BEFORE)).toBe(true);
    expect(mealPlanWeekEditable(MONDAY, SUNDAY_BEFORE)).toBe(true);
    expect(mealPlanWeekEditable('2026-10-19', SUNDAY_BEFORE)).toBe(false);
  });
});

describe('nextMealPlanVariant', () => {
  it('+ 1, nach der höchsten wieder 0', () => {
    expect(nextMealPlanVariant(0)).toBe(1);
    expect(nextMealPlanVariant(41)).toBe(42);
    expect(nextMealPlanVariant(10_000)).toBe(0);
  });
});

describe('resolveMealPlanWeek (6.6 beim Öffnen, W11 App-Logik)', () => {
  it('kein Plan oder Plan einer anderen Woche → neu erstellt (Variante 0)', () => {
    const data = input(female);
    const created = resolveMealPlanWeek(null, data);
    expect(created.action).toBe('created');
    expect(created.plan).toEqual(buildMealPlanWeek(data));
    const otherWeek = buildMealPlanWeek({
      ...data,
      targets: nutritionTargetsForWeek(
        inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, ...female }),
        '2026-10-19',
      ),
    });
    expect(resolveMealPlanWeek(otherWeek, data).action).toBe('created');
  });

  it('unveränderte Angaben → gespeicherter Plan, kein „Plan aktualisieren“', () => {
    const stored = buildMealPlanWeek(input(female));
    const result = resolveMealPlanWeek(stored, input(female, omni, THURSDAY));
    expect(result).toEqual({ action: 'stored', plan: stored, updateSuggested: false });
  });

  it('Schwangerschaft gesetzt → automatisch ab heute neu, vergangene Tage gleich, ohne pregnancy_caution (W11)', () => {
    const stored = buildMealPlanWeek(input(female));
    const pregnant = input(
      { sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } },
      omni,
      THURSDAY,
    );
    const result = resolveMealPlanWeek(stored, pregnant);
    expect(result.action).toBe('replanned');
    if (result.action !== 'replanned') return;
    expect(result.reasons).toContain('mode_changed');
    expect(result.plan.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
    for (const day of result.plan.days.slice(3)) {
      expect(day.status).toBe('no_targets');
      for (const meal of day.meals) {
        expect(meal.ingredients.some((i) => caution(N3_FOODS.get(i.foodId)))).toBe(false);
      }
    }
    // Keine Schleife: der neu geplante Plan wird beim nächsten Öffnen so übernommen.
    expect(resolveMealPlanWeek(result.plan, pregnant).action).toBe('stored');
  });

  it('neue Unverträglichkeit (vegan + Erdnuss) → neu geplant, kein Erdnuss-Rezept ab heute', () => {
    const vegan: MealPlanProfileInput = { diet: 'vegan' };
    const stored = buildMealPlanWeek(input(female, vegan));
    const peanuts = (plan: MealPlanWeek, from: number) =>
      plan.days
        .slice(from)
        .flatMap((d) => d.meals)
        .filter((m) =>
          m.ingredients.some((i) => N3_FOODS.get(i.foodId)?.groups.includes('peanuts')),
        );
    expect(peanuts(stored, 0).length).toBeGreaterThan(0);
    const result = resolveMealPlanWeek(
      stored,
      input(female, { ...vegan, intolerances: ['peanuts'] }, THURSDAY),
    );
    expect(result.action).toBe('replanned');
    expect(peanuts(result.plan, 3)).toEqual([]);
    expect(result.plan.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
  });

  it('Sonntag nach der Woche: alles vergangen → nichts mehr neu geplant', () => {
    const stored = buildMealPlanWeek(input(female));
    const result = resolveMealPlanWeek(
      stored,
      input(
        { sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } },
        omni,
        '2026-10-19',
      ),
    );
    expect(result.action).toBe('stored');
    expect(result.plan).toBe(stored);
  });
});

describe('mealPlanUpdateSuggested („Plan aktualisieren“, ≥ 5 %)', () => {
  const mid = (band: { min: number; max: number } | null) =>
    band === null ? null : (band.min + band.max) / 2;

  it('angeboten genau dann, wenn sich die Bandmitte eines Tages ab heute um ≥ 5 % ändert', () => {
    const stored = buildMealPlanWeek(input(female));
    let suggested = 0;
    let quiet = 0;
    for (let weight = 60; weight <= 100; weight += 1) {
      const changed = input(
        {
          ...female,
          bodyMetricsRows: [{ measuredOn: '2026-10-14', heightCm: 180, weightKg: weight }],
        },
        omni,
        THURSDAY,
      );
      // Unabhängig gerechnet: größte relative Änderung der Bandmitte ab heute.
      const change = Math.max(
        ...stored.days.slice(3).map((day) => {
          const before = mid(day.band);
          const after = mid(changed.targets.days.find((d) => d.date === day.date)?.band ?? null);
          return before === null || after === null ? 0 : Math.abs(after - before) / before;
        }),
      );
      expect(mealPlanUpdateSuggested(stored, changed.targets, THURSDAY)).toBe(
        change >= MEAL_PLAN_UPDATE_MIN_CHANGE,
      );
      const resolved = resolveMealPlanWeek(stored, changed);
      if (resolved.action === 'stored') {
        if (resolved.updateSuggested) suggested += 1;
        else quiet += 1;
      }
    }
    // Es gibt beides: kleine Änderungen ohne Knopf, größere mit Knopf (noch im Band, also nicht automatisch).
    expect(suggested).toBeGreaterThan(0);
    expect(quiet).toBeGreaterThan(0);
  });

  it('vergangene Tage und Tage ohne Band (no_targets) zählen nicht', () => {
    const stored = buildMealPlanWeek(input(female));
    const heavier = input(
      { ...female, bodyMetricsRows: [{ measuredOn: '2026-10-14', heightCm: 180, weightKg: 95 }] },
      omni,
      THURSDAY,
    );
    expect(mealPlanUpdateSuggested(stored, heavier.targets, THURSDAY)).toBe(true);
    // Ab Montag danach liegt alles in der Vergangenheit.
    expect(mealPlanUpdateSuggested(stored, heavier.targets, '2026-10-19')).toBe(false);
    const noTargets = input({ ...female, healthDataConsent: false }, omni, THURSDAY);
    expect(mealPlanUpdateSuggested(stored, noTargets.targets, THURSDAY)).toBe(false);
    const storedNoTargets = buildMealPlanWeek(input({ ...female, healthDataConsent: false }));
    expect(mealPlanUpdateSuggested(storedNoTargets, heavier.targets, THURSDAY)).toBe(false);
  });
});

describe('„Andere Vorschläge“ und „Plan aktualisieren“ (6.3 Nr. 7, 8.2 Nr. 3)', () => {
  it('Andere Vorschläge: Variante + 1 ab heute, vergangene Tage unverändert, sonst andere Auswahl', () => {
    const data = input(female, omni, THURSDAY);
    const stored = buildMealPlanWeek(input(female));
    const other = mealPlanWithOtherSuggestions(stored, data);
    expect(other.variant).toBe(1);
    expect(other.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
    expect(needsAutomaticReplan(other, data).needed).toBe(false);
    // Über mehrere Varianten ändert sich die Auswahl ab heute irgendwann.
    let plan = other;
    const seen = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      seen.add(
        plan.days
          .slice(3)
          .map((d) => d.meals.map((m) => m.recipeId).join(','))
          .join('|'),
      );
      plan = mealPlanWithOtherSuggestions(plan, data);
      expect(plan.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('höchste Variante → wieder 0, deterministisch', () => {
    const data = input(female, omni, THURSDAY);
    const top = buildMealPlanWeek({ ...data, variant: 10_000 });
    const next = mealPlanWithOtherSuggestions(top, data);
    expect(next.variant).toBe(0);
    expect(mealPlanWithOtherSuggestions(top, data)).toEqual(next);
  });

  it('Plan aktualisieren: gleiche Variante, neue Ziele ab heute, vergangene Tage unverändert', () => {
    const stored = buildMealPlanWeek({ ...input(female), variant: 3 });
    const heavier = input(
      { ...female, bodyMetricsRows: [{ measuredOn: '2026-10-14', heightCm: 180, weightKg: 95 }] },
      omni,
      THURSDAY,
    );
    const refreshed = refreshedMealPlan(stored, heavier);
    expect(refreshed.variant).toBe(3);
    expect(refreshed.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
    expect(mealPlanUpdateSuggested(refreshed, heavier.targets, THURSDAY)).toBe(false);
    expect(needsAutomaticReplan(refreshed, heavier).needed).toBe(false);
  });
});

describe('Wächter N5a S1: Gesundheitsbezug übernommener vergangener Tage', () => {
  const vegan: MealPlanProfileInput = { diet: 'vegan', intolerances: ['peanuts'] };

  it('Einwilligung am Donnerstag ungültig: neu geplanter Plan behält usesHealthData der vergangenen Tage', () => {
    const stored = buildMealPlanWeek(input(female, vegan));
    expect(stored.usesHealthData).toBe(true);
    expect(stored.days.slice(0, 3).some((d) => d.meals.some((m) => m.factor !== 1))).toBe(true);
    const noConsent = input({ ...female, healthDataConsent: false }, { diet: 'vegan' }, THURSDAY);
    const result = resolveMealPlanWeek(stored, noConsent);
    expect(result.action).toBe('replanned');
    expect(result.plan.days.slice(0, 3)).toEqual(stored.days.slice(0, 3));
    expect(result.plan.usesHealthData).toBe(true);
  });

  it('ohne übernommene vergangene Tage kein geerbter Gesundheitsbezug', () => {
    const stored = buildMealPlanWeek(input(female, vegan));
    const noConsent = input({ ...female, healthDataConsent: false }, { diet: 'vegan' });
    expect(automaticReplan(stored, null, noConsent).plan.usesHealthData).toBe(false);
  });
});

describe('Wächter N5a S2: Schnappschuss muss zu den Rezepten passen (mealPlanMatchesRecipes)', () => {
  type Mutable = { days: { totals: { kcal: number }; meals: Record<string, unknown>[] }[] };
  const tamper = (plan: MealPlanWeek, change: (copy: Mutable) => void): MealPlanWeek => {
    const copy = structuredClone(plan) as unknown as Mutable;
    change(copy);
    return copy as unknown as MealPlanWeek;
  };

  it('frische, getauschte und neu geplante Pläne passen (1/4/8 Mahlzeiten, Meal-Prep, Ersatz, no_targets)', () => {
    const profiles: MealPlanProfileInput[] = [
      omni,
      { diet: 'vegan', intolerances: ['peanuts'] },
      { diet: 'vegetarian', intolerances: ['lactose'], dislikes: ['mushrooms'] },
      { ...omni, cookingMode: 'meal_prep', mealprepDays: 2 },
      { ...omni, cookingMode: 'meal_prep', mealprepDays: 3, mealprepSlots: 'lunch_dinner' },
    ];
    for (const profile of profiles) {
      for (const mealsPerDay of [1, 4, 8]) {
        for (const consent of [true, false]) {
          const data = input({ ...female, mealsPerDay, healthDataConsent: consent }, profile);
          const plan = buildMealPlanWeek(data);
          const stored = JSON.parse(JSON.stringify(plan)) as MealPlanWeek;
          expect(mealPlanMatchesRecipes(stored, N3_RECIPES, N3_FOODS)).toBe(true);
          const swapDay = plan.days[4];
          const meal = swapDay?.meals.find((m) => !m.isFill);
          if (swapDay && meal) {
            const swapped = swapMealRecipe(
              plan,
              { date: swapDay.date, slot: meal.slot as 'breakfast' },
              data,
            );
            if (swapped.ok) {
              expect(mealPlanMatchesRecipes(swapped.plan, N3_RECIPES, N3_FOODS)).toBe(true);
            }
          }
          const replanned = automaticReplan(
            plan,
            null,
            input(
              { ...female, mealsPerDay, healthFlags: { flags: ['pregnancy'] } },
              profile,
              THURSDAY,
            ),
          ).plan;
          expect(mealPlanMatchesRecipes(replanned, N3_RECIPES, N3_FOODS)).toBe(true);
        }
      }
    }
  });

  it('Ersatzprodukt im Plan (laktosefreie Milch) wird erkannt und akzeptiert', () => {
    const plan = buildMealPlanWeek(
      input(female, { diet: 'vegetarian', intolerances: ['lactose'] }),
    );
    expect(plan.days.some((d) => d.meals.some((m) => m.substitutions.length > 0))).toBe(true);
    expect(mealPlanMatchesRecipes(plan, N3_RECIPES, N3_FOODS)).toBe(true);
  });

  it('manipulierter Speicher (Allergen in Zutaten, Titel, Ersatz, Weglassen, Summe, Version) → neu erstellt', () => {
    const vegan: MealPlanProfileInput = { diet: 'vegan', intolerances: ['peanuts'] };
    const plan = buildMealPlanWeek(input(female, vegan));
    const changes: ((copy: Mutable) => void)[] = [
      // Erdnüsse in die Zutaten einer VERGANGENEN Mahlzeit (Montag) geschmuggelt.
      (c) => {
        const meal = c.days[0]?.meals[0] as { ingredients: { foodId: string }[] };
        (meal.ingredients[0] as { foodId: string }).foodId = 'erdnuesse';
      },
      (c) => {
        (c.days[5]?.meals[0] as { titleDe: string }).titleDe = 'Erdnuss-Riegel';
      },
      (c) => {
        const meal = c.days[1]?.meals[0] as { substitutions: unknown[] };
        meal.substitutions = [{ index: 0, foodId: 'haferflocken', substituteFoodId: 'erdnuesse' }];
      },
      (c) => {
        const meal = c.days[2]?.meals[0] as { omittedOptional: unknown[] };
        meal.omittedOptional = [{ index: 0, foodId: 'nichts' }];
      },
      (c) => {
        (c.days[3] as { totals: { kcal: number } }).totals.kcal += 500;
      },
      (c) => {
        (c.days[6]?.meals[0] as { recipeVersion: number }).recipeVersion = 99;
      },
      (c) => {
        const meal = c.days[0]?.meals[0] as { nutrients: { kcal: number } };
        meal.nutrients.kcal += 1;
      },
    ];
    for (const change of changes) {
      const bad = tamper(plan, change);
      expect(mealPlanMatchesRecipes(bad, N3_RECIPES, N3_FOODS)).toBe(false);
      // Auch an einem Donnerstag (Montag schon vergangen): nie der manipulierte Plan, sondern neu erstellt.
      const result = resolveMealPlanWeek(bad, input(female, vegan, THURSDAY));
      expect(result.action).toBe('created');
      for (const day of result.plan.days) {
        for (const meal of day.meals) {
          expect(meal.ingredients.some((i) => i.foodId === 'erdnuesse')).toBe(false);
          expect(meal.titleDe).not.toBe('Erdnuss-Riegel');
        }
      }
    }
  });
});

describe('Wächter N5a K6: feste Grenzfälle 4,9 % / 5,0 % und Zod-Rundweg', () => {
  it('4,9 % → kein Knopf, 5,0 % → Knopf (konstruiertes Band 1.000 kcal)', () => {
    const plan = buildMealPlanWeek(input(female));
    const fixed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d) => ({ ...d, band: { min: 900, max: 1100 } })),
    };
    const targetsWith = (mid: number) => ({
      days: plan.days.map((d) => ({
        ...(input(female).targets.days.find((t) => t.date === d.date) as NonNullable<
          ReturnType<typeof input>['targets']['days'][number]
        >),
        band: { min: mid - 100, max: mid + 100 },
      })),
    });
    expect(mealPlanUpdateSuggested(fixed, targetsWith(1049), THURSDAY)).toBe(false);
    expect(mealPlanUpdateSuggested(fixed, targetsWith(1050), THURSDAY)).toBe(true);
    expect(mealPlanUpdateSuggested(fixed, targetsWith(950), THURSDAY)).toBe(true);
    expect(mealPlanUpdateSuggested(fixed, targetsWith(951), THURSDAY)).toBe(false);
  });

  it('ein über den Gerätespeicher (JSON + Zod) gelesener Plan passt weiter zu den Rezepten', () => {
    const plan = buildMealPlanWeek(
      input(female, { diet: 'vegetarian', intolerances: ['lactose'] }),
    );
    const parsed = parseStoredMealPlanWeek(viaStorage(plan));
    expect(parsed).not.toBeNull();
    expect(mealPlanMatchesRecipes(parsed as MealPlanWeek, N3_RECIPES, N3_FOODS)).toBe(true);
  });
});
