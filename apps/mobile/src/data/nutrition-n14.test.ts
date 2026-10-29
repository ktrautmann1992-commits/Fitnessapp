/**
 * Etappe N14 – Resteplanung in der App, sicherer Teil (Testmodus; docs/PLAN-PHASE-5.md 19.7 N14, Umsetzungsstand
 * N14): Der Wochenplan nutzt den Reste-Score (nur Reihenfolge), die Mahlzeit zeigt „Nutzt deinen Rest“ – ohne Mengen
 * und ohne Packungszahlen (G-N13-4/N11-G3 offen). Plan deterministisch, jeder Tag im Band oder `below_floor`,
 * gespeicherte Pläne bleiben, ohne Packungsgrößen alles wie vorher. Die Regeln selbst testet packages/core
 * (n13-leftovers, n14-leftover-hints).
 */
import {
  addDays,
  buildMealPlanWeek,
  dayWithinPlanBand,
  type MealPlanWeek,
  type NutritionLibrary,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { t } from '@/i18n';
import { leftoverAccessibilityText, leftoverHintView } from '@/lib/nutrition-format';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { applyMealPlanSave } from './meal-plan-rows';
import {
  computeNutritionWeek,
  type NutritionWeekResult,
  safeLeftoverMealHints,
  safeLeftoverPlanningInput,
} from './nutrition-plan';
import type { UserRows } from './types';

const LIBRARY: NutritionLibrary = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();
const NO_PACKAGES: NutritionLibrary = { ...LIBRARY, packageSizes: [] };
const NEXT_WEEK = '2026-10-05'; // TODAY = Samstag 03.10.2026 → nächste Woche ganz in der Zukunft

type Diet = 'omnivore' | 'vegetarian' | 'vegan';

function rows(
  options: {
    diet?: Diet;
    meals?: number;
    mealPrep?: boolean;
    consent?: 'valid' | 'none';
  } = {},
): UserRows {
  const base = planPersonRows({ consent: options.consent ?? 'valid', goal: 'fat_loss' });
  const diet = options.diet ?? 'omnivore';
  return {
    ...base,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: diet,
      eats_pork: diet === 'omnivore' ? true : null,
      meals_per_day: options.meals ?? 4,
      cooking_mode: options.mealPrep === true ? 'meal_prep' : 'daily',
      mealprep_days: options.mealPrep === true ? 3 : null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: true,
    },
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-09-20',
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }> & { plan: MealPlanWeek };

function week(data: UserRows, library = LIBRARY, weekStart = NEXT_WEEK): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart,
    library,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
  return result as Ready;
}

const PROFILES = [
  {},
  { diet: 'vegetarian' as const },
  { diet: 'vegan' as const },
  { meals: 2 },
  { meals: 6 },
  { mealPrep: true },
  { consent: 'none' as const },
];

describe('Resteplanung in der App (Etappe N14)', () => {
  it('Reste-Score ist eingeschaltet, sobald es Packungsgrößen gibt; ohne Packungsgrößen Plan wie vorher', () => {
    const on = week(rows());
    expect(on.planState?.input.leftovers?.packageSizes.size).toBe(LIBRARY.packageSizes.length);
    const off = week(rows(), NO_PACKAGES);
    expect(off.planState?.input.leftovers).toBeUndefined();
    expect(off.leftoverHints).toEqual([]);
    // Ohne Feld: genau der Plan der Engine ohne Resteplanung (N13 unverändert).
    const withoutField = { ...on.planState!.input };
    delete (withoutField as { leftovers?: unknown }).leftovers;
    expect(off.plan).toEqual(buildMealPlanWeek({ ...withoutField, variant: 0 }));
    // Der Fingerabdruck kennt die Packungsgrößen (Schutz vor einer Speicher-Schleife bleibt je Bestand).
    expect(on.planState?.inputsKey).not.toBe(off.planState?.inputsKey);
  });

  it('deterministisch, jeder Tag im Band oder below_floor, Hinweise passen zum Plan (über mehrere Profile)', () => {
    let hinted = 0;
    for (const profile of PROFILES) {
      const a = week(rows(profile));
      const b = week(rows(profile));
      expect(b.plan).toEqual(a.plan);
      expect(b.leftoverHints).toEqual(a.leftoverHints);
      for (const day of a.plan.days) {
        expect(dayWithinPlanBand(day, day.band)).toBe(true);
        if (day.band !== null) expect(['complete', 'below_floor']).toContain(day.status);
      }
      for (const hint of a.leftoverHints) {
        const meal = a.plan.days
          .find((d) => d.date === hint.date)
          ?.meals.find((m) => m.slot === hint.slot);
        expect(meal?.recipeId).toBe(hint.recipeId);
        expect(meal?.prepKind).not.toBe('leftover');
        for (const f of hint.foods) {
          expect(f.openedOn < meal!.cookDate).toBe(true);
          expect(LIBRARY.foods.get(f.foodId)?.pantry).toBe(false);
          // Beispiel-Packungen sind Entwürfe → als ungeprüft gekennzeichnet.
          expect(f.packageReviewed).toBe(false);
        }
        hinted += 1;
      }
    }
    // Mit dem Beispiel-Bestand entstehen wirklich Hinweise (sonst prüfte der Test nichts).
    expect(hinted).toBeGreaterThan(0);
  });

  it('vegane Woche: Reste-Score bringt nie ein ausgeschlossenes Lebensmittel', () => {
    const vegan = week(rows({ diet: 'vegan' }));
    for (const day of vegan.plan.days)
      for (const meal of day.meals)
        for (const i of meal.ingredients) {
          const food = LIBRARY.foods.get(i.foodId);
          expect(food?.animal ?? []).toEqual([]);
        }
  });

  it('gespeicherter Plan bleibt gespeichert (der Reste-Score plant nichts automatisch neu)', () => {
    const data = rows();
    const before = week(data, NO_PACKAGES);
    const saved = applyMealPlanSave(data, before.plan, {
      id: 'mp-1',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    const after = week(saved);
    expect(after.planState?.action).toBe('stored');
    expect(after.plan).toEqual(before.plan);
  });

  it('Hinweis-Text ohne Mengen und Packungszahlen; roh tierisch mit Hinweis „nur bis zum Folgetag“', () => {
    const view = leftoverHintView(
      {
        date: NEXT_WEEK,
        slot: 'dinner',
        recipeId: 'x',
        foods: [
          {
            foodId: 'haehnchenbrust',
            openedOn: addDays(NEXT_WEEK, -1),
            rawAnimal: true,
            shortLived: true,
            packageReviewed: false,
          },
          {
            foodId: 'tofu',
            openedOn: addDays(NEXT_WEEK, -2),
            rawAnimal: false,
            shortLived: false,
            packageReviewed: true,
          },
        ],
      },
      (id) => LIBRARY.foods.get(id)?.name_de ?? id,
    );
    expect(view.line).toMatch(/^Nutzt deinen Rest: /);
    expect(view.line).toContain('(seit So)');
    expect(view.line).not.toMatch(/\d/);
    expect(view.line).not.toMatch(/Packung/);
    // Keine Freigabe-Kennzeichnung der Packungsgröße mehr (Gründer-Entscheidung 27.10.2026).
    expect(view).toEqual({ line: view.line, shortLived: true });
    // Wächter N14 S3: neutraler Wortlaut – kein „roh“ (Kochschinken, Rohmilchkäse, Sprossen fallen auch darunter).
    expect(t.nutrition.leftovers.shortLived).toMatch(/Folgetag/);
    expect(t.nutrition.leftovers.shortLived).not.toMatch(/roh|Fleisch|Fisch/i);
    expect(t.nutrition.leftovers.explain).not.toMatch(/\d/);
    // Wächter N14 H3: der Erklärsatz behauptet nicht, dass der Plan Reste bevorzugt (stimmt nicht für alte Pläne).
    expect(t.nutrition.leftovers.explain).not.toMatch(/bevorzug/);
    // Wächter N14 S2: Vorlesetext enthält Hinweis und Lagerhinweis (ohne Freigabe-Kennzeichnung).
    const spoken = leftoverAccessibilityText(view);
    expect(spoken).toContain(view.line);
    expect(spoken).not.toMatch(/Entwurf|freigegeben/);
    expect(spoken).toContain(t.nutrition.leftovers.shortLived);
    expect(
      leftoverAccessibilityText({
        line: 'Nutzt deinen Rest: Tofu (seit Mo)',
        shortLived: false,
      }),
    ).toBe('Nutzt deinen Rest: Tofu (seit Mo)');
  });

  it('Wächter N14 H1: ohne allowDrafts keine Entwurfs-Packungsgrößen (kein Score, keine Hinweise)', () => {
    const result = computeNutritionWeek({
      rows: rows(),
      versions: VERSIONS,
      today: TODAY,
      weekStart: NEXT_WEEK,
      library: LIBRARY,
      allowDrafts: false,
    });
    if (result.kind !== 'ready') throw new Error('ready erwartet');
    expect(LIBRARY.packageSizes.every((p) => p.status === 'draft')).toBe(true);
    expect(result.planState?.input.leftovers).toBeUndefined();
    expect(result.leftoverHints).toEqual([]);
    const published = {
      ...LIBRARY,
      packageSizes: LIBRARY.packageSizes.map((p, i) =>
        i === 0 ? { ...p, status: 'published' as const } : p,
      ),
    };
    expect(safeLeftoverPlanningInput(published, false)?.packageSizes.size).toBe(1);
    expect(safeLeftoverPlanningInput(published, true)?.packageSizes.size).toBe(
      LIBRARY.packageSizes.length,
    );
  });

  it('Wächter N14 H2: ungültige Packungsgröße sperrt die Ansicht nicht – nur kein Score, keine Hinweise', () => {
    const broken = {
      ...LIBRARY,
      packageSizes: LIBRARY.packageSizes.map((p, i) => (i === 0 ? { ...p, package_size_g: 0 } : p)),
    };
    const ready = week(rows(), broken);
    expect(ready.planState?.input.leftovers).toBeUndefined();
    expect(ready.leftoverHints).toEqual([]);
    expect(safeLeftoverMealHints(ready.plan, broken, true)).toEqual([]);
  });

  it('Einkaufsliste unverändert: keine Packungsangaben (G-N13-4/N11-G3 offen)', () => {
    const ready = week(rows());
    expect(ready.shopping).not.toBeNull();
    expect(JSON.stringify(ready.shopping)).not.toMatch(/package|packung/i);
  });
});
