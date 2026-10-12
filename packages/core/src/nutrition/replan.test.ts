/**
 * Automatische Neuplanung (docs/PLAN-PHASE-5.md 6.6, S7, R2-S4): W11 (Core) und W22 (Core) – Moduswechsel (neues
 * Flag, 18./65. Geburtstag, BMI-Klasse, Check nachgeholt, Widerruf) → Neuplanung ab heute, vergangene Tage
 * unverändert; Einkaufsliste im selben Schritt neu, danach ohne `pregnancy_caution`-Zutat.
 */
import { describe, expect, it } from 'vitest';

import type { Food } from '../content/food-schema';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { needsAutomaticReplan, automaticReplan } from './replan';
import type { MealPlanProfileInput } from './schemas';
import { buildShoppingList, setShoppingItemChecked } from './shopping-list';
import type { NutritionInputsInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const THURSDAY = '2026-10-15';
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };

function input(
  overrides: Partial<NutritionInputsInput>,
  profile: MealPlanProfileInput = omni,
  today = SUNDAY_BEFORE,
): Omit<MealPlanInput, 'existingPlan' | 'variant'> {
  return {
    targets: nutritionTargetsForWeek(inputs({ today, mealsPerDay: 4, ...overrides }), MONDAY),
    profile,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
  };
}

function plan(data: Omit<MealPlanInput, 'existingPlan' | 'variant'>): MealPlanWeek {
  return buildMealPlanWeek(data);
}

describe('needsAutomaticReplan (6.6, W11 Core)', () => {
  const female = { sex: 'female' as const, healthFlags: { flags: [] } };
  const base = plan(input(female));

  it('unverändert → keine Neuplanung', () => {
    expect(needsAutomaticReplan(base, input(female, omni, THURSDAY))).toEqual({
      needed: false,
      reasons: [],
      fromDate: null,
    });
  });

  it('Schwangerschaft neu → Modus und Rezepte ab heute', () => {
    const check = needsAutomaticReplan(
      base,
      input(
        { ...female, healthFlags: { flags: ['pregnancy', 'conservative_plan'] } },
        omni,
        THURSDAY,
      ),
    );
    expect(check.needed).toBe(true);
    expect(check.reasons).toContain('mode_changed');
    expect(check.fromDate).toBe(THURSDAY);
  });

  it('neues Flag Medikamente → Deckel geändert', () => {
    const check = needsAutomaticReplan(
      plan(input({ ...female, goalType: 'fat_loss' })),
      input(
        {
          ...female,
          goalType: 'fat_loss',
          healthFlags: { flags: ['medication', 'conservative_plan'] },
        },
        omni,
        THURSDAY,
      ),
    );
    expect(check.reasons).toContain('caps_changed');
  });

  it('18. bzw. 65. Geburtstag: Modus bzw. Deckel ändern sich → Neuplanung', () => {
    const teen = { birthDate: '2008-10-16', goalType: 'fat_loss' as const };
    // Tagesgenau gerechnet: der Plan kennt den Geburtstag schon → keine Neuplanung.
    expect(needsAutomaticReplan(plan(input(teen)), input(teen, omni, THURSDAY)).needed).toBe(false);
    // Plan mit Zielen für Erwachsene, jetzt unter 18 → kein Defizit (maintenance_only).
    const adult = plan(input({ ...teen, birthDate: '1990-01-01' }));
    expect(needsAutomaticReplan(adult, input(teen, omni, THURSDAY)).reasons).toContain(
      'mode_changed',
    );
    // 65: gleicher Modus, kleinerer Defizitdeckel (15 %).
    const senior = { goalType: 'fat_loss' as const, birthDate: '1961-01-01' };
    const younger = plan(input({ ...senior, birthDate: '1962-01-01' }));
    expect(needsAutomaticReplan(younger, input(senior, omni, THURSDAY)).reasons).toContain(
      'caps_changed',
    );
  });

  it('Check nachgeholt bzw. Widerruf → Modus geändert', () => {
    const noCheck = plan(input({ sex: 'female', healthFlags: null }));
    expect(needsAutomaticReplan(noCheck, input(female, omni, THURSDAY)).reasons).toContain(
      'mode_changed',
    );
    expect(
      needsAutomaticReplan(base, input({ ...female, healthDataConsent: false }, omni, THURSDAY))
        .reasons,
    ).toContain('mode_changed');
  });

  it('BMI-Klasse/Gewicht: Tagessumme außerhalb des neuen Bands', () => {
    const check = needsAutomaticReplan(
      base,
      input(
        {
          ...female,
          bodyMetricsRows: [{ measuredOn: '2026-10-14', heightCm: 180, weightKg: 52 }],
        },
        omni,
        THURSDAY,
      ),
    );
    expect(check.reasons).toEqual(expect.arrayContaining(['caps_changed', 'out_of_band']));
  });

  it('neue Unverträglichkeit/Abneigung verletzt den Plan → recipe_excluded; vergangene Tage zählen nicht', () => {
    const used = new Set(base.days.slice(3).flatMap((d) => d.meals.map((m) => m.recipeId)));
    expect(used.has('omelett-champignons') || used.has('champignon-reis')).toBe(true);
    const check = needsAutomaticReplan(
      base,
      input(female, { ...omni, dislikes: ['mushrooms'] }, THURSDAY),
    );
    expect(check.reasons).toEqual(['recipe_excluded']);
    // Ab Sonntag liegt alles in der Vergangenheit.
    expect(
      needsAutomaticReplan(base, input(female, { ...omni, dislikes: ['mushrooms'] }, '2026-10-19'))
        .needed,
    ).toBe(false);
  });
});

describe('automaticReplan (W11, W22 Core)', () => {
  it('Schwangerschaft: ab heute ohne pregnancy_caution, vergangene Tage gleich, Einkaufsliste im selben Schritt', () => {
    const before = input({ sex: 'female', healthFlags: { flags: [] } });
    const old = plan(before);
    const caution = (food: Food | undefined) => food?.pregnancy_caution === true;
    // Ausgangslage: der alte Plan enthält heikle Zutaten (Räucherlachs, Salami, rohes Ei …).
    const oldList = buildShoppingList(old, N3_FOODS);
    const risky = oldList.items.filter((i) => caution(N3_FOODS.get(i.foodId ?? '')));
    expect(risky.length).toBeGreaterThan(0);
    let list = oldList;
    for (const item of risky) list = setShoppingItemChecked(list, item.itemKey, true);

    const after = input(
      { sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } },
      omni,
      THURSDAY,
    );
    expect(needsAutomaticReplan(old, after).needed).toBe(true);
    const result = automaticReplan(old, list, after);
    expect(result.plan.days.slice(0, 3)).toEqual(old.days.slice(0, 3));
    for (const day of result.plan.days.slice(3)) {
      expect(day.status).toBe('no_targets');
      for (const meal of day.meals) {
        expect(meal.ingredients.some((i) => caution(N3_FOODS.get(i.foodId)))).toBe(false);
      }
    }
    expect(needsAutomaticReplan(result.plan, after).needed).toBe(false);

    // Einkaufsliste für ab heute: keine offene heikle Zutat; abgehakte stehen als „nicht mehr im Plan“.
    const fromToday = automaticReplan(
      old,
      buildShoppingList(old, N3_FOODS, { from: THURSDAY, to: '2026-10-18' }),
      after,
    );
    expect(
      fromToday.shoppingList?.items.filter(
        (i) => caution(N3_FOODS.get(i.foodId ?? '')) && !i.notInPlan,
      ),
    ).toEqual([]);
    for (const item of result.shoppingList?.items ?? []) {
      if (caution(N3_FOODS.get(item.foodId ?? '')) && item.checked) {
        // Nur noch aus vergangenen Tagen oder als „nicht mehr im Plan“.
        expect(
          item.notInPlan ||
            old.days
              .slice(0, 3)
              .some((d) =>
                d.meals.some((m) => m.ingredients.some((x) => x.foodId === item.foodId)),
              ),
        ).toBe(true);
      }
    }
  });

  it('ohne Einkaufsliste nur der Plan', () => {
    const data = input({});
    expect(automaticReplan(plan(data), null, data).shoppingList).toBeNull();
  });
});

describe('Wächter N3: B1 und B2', () => {
  it('B1: Liste für die ganze Woche + Schwangerschaft am Donnerstag → kein offener Eintrag mit Risiko', () => {
    const profiles: MealPlanProfileInput[] = [
      omni,
      { ...omni, cookingMode: 'meal_prep', mealprepDays: 2 },
      { ...omni, cookingMode: 'meal_prep', mealprepDays: 1, mealprepSlots: 'lunch_dinner' },
    ];
    let risky = 0;
    for (const profile of profiles) {
      for (const mealsPerDay of [3, 4, 5]) {
        const before = input({ sex: 'female', healthFlags: { flags: [] }, mealsPerDay }, profile);
        const old = plan(before);
        const list = buildShoppingList(old, N3_FOODS);
        risky += list.items.filter(
          (i) => N3_FOODS.get(i.foodId ?? '')?.pregnancy_caution === true,
        ).length;
        const after = input(
          {
            sex: 'female',
            healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
            mealsPerDay,
          },
          profile,
          THURSDAY,
        );
        const result = automaticReplan(old, list, after);
        const open = (result.shoppingList?.items ?? []).filter(
          (i) => !i.checked && N3_FOODS.get(i.foodId ?? '')?.pregnancy_caution === true,
        );
        expect(open, `${profile.cookingMode} ${mealsPerDay}`).toEqual([]);
        expect(result.shoppingList?.from).toBe(THURSDAY);
      }
    }
    expect(risky).toBeGreaterThan(0);
  });

  it('B1: Neuplanung nach dem Ende der Liste lässt die Liste unverändert', () => {
    const before = input({});
    const old = plan(before);
    const list = buildShoppingList(old, N3_FOODS, { from: MONDAY, to: '2026-10-13' });
    const result = automaticReplan(old, list, input({ goalType: 'fat_loss' }, omni, THURSDAY));
    expect(result.shoppingList).toBe(list);
  });

  it('B2: Tag über der neuen Obergrenze wird erkannt – auch mit Status below_floor (120 kg, Muskelaufbau → Fettabbau)', () => {
    const body = { bodyMetricsRows: [{ measuredOn: '2026-10-01', weightKg: 120, heightCm: 185 }] };
    const old = plan(input({ ...body, mealsPerDay: 1, goalType: 'muscle_gain' }));
    const after = input({ ...body, mealsPerDay: 1, goalType: 'fat_loss' }, omni, '2026-10-13');
    // Unabhängig: mindestens ein Tag ab heute liegt über der neuen Obergrenze (Ziel × 1,1 bzw. Decke).
    const over = old.days.filter((d) => {
      const t = after.targets.days.find((x) => x.date === d.date);
      if (d.date < '2026-10-13' || t?.targetKcal == null || t.ceilingKcal == null) return false;
      const upper = Math.max(Math.min(1.1 * t.targetKcal, t.ceilingKcal), (t.band?.min ?? 0) + 20);
      return d.totals.kcal > upper;
    });
    expect(over.length).toBeGreaterThan(0);
    expect(over.some((d) => d.status === 'below_floor')).toBe(true);
    const check = needsAutomaticReplan(old, after);
    expect(check.needed).toBe(true);
    expect(check.reasons).toContain('out_of_band');
  });
});
