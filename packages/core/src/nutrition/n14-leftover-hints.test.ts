/**
 * Etappe N14 – Resteplanung in der App, sicherer Teil (docs/PLAN-PHASE-5.md 19.7 N14, Umsetzungsstand N14):
 * `leftoverPlanningInput` (Reste-Score aus den ausgewählten Packungsgrößen) und `leftoverMealHints` (Hinweis „Nutzt
 * deinen Rest“). Keine Mengen, keine Packungszahlen – die hängen an G-N13-4/N11-G3. Lebensmittelsicherheit: ein
 * Hinweis nie für einen abgelaufenen Rest, rohe tierische Reste nur vom Vortag (S9).
 */
import { describe, expect, it } from 'vitest';

import { LEFTOVER_RAW_DAYS } from '../constants';
import type { PackageSize } from '../content/package-size-schema';
import type { Recipe } from '../content/recipe-schema';
import { addDays } from '../dates';
import { DEMO_PACKAGE_SIZES, withDemoRoles } from '../demo-nutrition';
import {
  isRawAnimalLeftover,
  leftoverKeepDays,
  planLeftovers,
  shoppingListPackages,
  leftoverMealHints,
  leftoverPlanningInput,
  LeftoverTracker,
} from './leftovers';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import type { MealPlanProfileInput, NutritionInputsInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';

const SUNDAY_BEFORE = addDays(MONDAY, -1);
const TUE = addDays(MONDAY, 1);
const WED = addDays(MONDAY, 2);
const THU = addDays(MONDAY, 3);
const RECIPES = N3_RECIPES.map(withDemoRoles);
/** Testmodus: Entwürfe (Beispiel-Packungen) erlaubt. */
const DRAFTS = { allowDrafts: true } as const;

function entry(foodId: string, grams: number, status: PackageSize['status'] = 'published') {
  const base = DEMO_PACKAGE_SIZES[0] as PackageSize;
  return { ...base, id: `packung-${foodId}`, food_id: foodId, package_size_g: grams, status };
}

/** Packungsgrößen der Tests: Beispiel-Bestand (Entwürfe) + freigegebene Einträge. */
const ENTRIES: readonly PackageSize[] = [
  ...DEMO_PACKAGE_SIZES,
  entry('hackfleisch-gemischt', 500),
  entry('lachs', 250),
  entry('huehnerei', 360),
];

type TestMeal = {
  slot: string;
  recipeId: string;
  cookDate: string;
  prepKind: 'fresh' | 'cook' | 'leftover';
  ingredients: { foodId: string; grams: number }[];
};

/** Kleiner Plan von Hand (nur die Felder, die die Reste-Rechnung liest). */
function handPlan(days: { date: string; meals: TestMeal[] }[]): Pick<MealPlanWeek, 'days'> {
  return { days } as unknown as Pick<MealPlanWeek, 'days'>;
}

function meal(
  slot: string,
  cookDate: string,
  ingredients: [string, number][],
  prepKind: TestMeal['prepKind'] = 'fresh',
): TestMeal {
  return {
    slot,
    recipeId: `r-${slot}-${cookDate}`,
    cookDate,
    prepKind,
    ingredients: ingredients.map(([foodId, grams]) => ({ foodId, grams })),
  };
}

function planInput(
  overrides: Partial<NutritionInputsInput>,
  profile: MealPlanProfileInput,
  entries: readonly PackageSize[] | null,
): MealPlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, ...overrides }),
      MONDAY,
    ),
    profile,
    recipes: RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
    leftovers: entries === null ? undefined : leftoverPlanningInput(entries, DRAFTS),
  };
}

describe('leftoverPlanningInput', () => {
  it('ohne Packungsgrößen undefined → Engine plant genau wie ohne Resteplanung', () => {
    expect(leftoverPlanningInput([], DRAFTS)).toBeUndefined();
    const input = planInput({}, { diet: 'omnivore', eatsPork: true }, []);
    expect(input.leftovers).toBeUndefined();
    const withoutField: MealPlanInput = { ...input };
    delete (withoutField as { leftovers?: unknown }).leftovers;
    expect('leftovers' in withoutField).toBe(false);
    expect(buildMealPlanWeek(input)).toEqual(buildMealPlanWeek(withoutField));
  });

  it('je Lebensmittel der erste Eintrag nach ID; Werte unverändert (G3 nicht vorweggenommen)', () => {
    const planning = leftoverPlanningInput(
      [entry('tofu', 400), { ...entry('tofu', 200), id: 'packung-tofu-a' }, entry('paprika', 150)],
      DRAFTS,
    );
    expect(planning?.packageSizes.get('tofu')).toBe(400);
    expect(planning?.packageSizes.get('paprika')).toBe(150);
    expect(planning?.packageSizes.size).toBe(2);
  });

  it('ungültige Packungsgröße an der Grenze → Fehler (Zod)', () => {
    expect(() => leftoverPlanningInput([entry('tofu', 0)], DRAFTS)).toThrow();
    expect(() => leftoverPlanningInput([entry('tofu', 5001)], DRAFTS)).toThrow();
  });
});

describe('leftoverMealHints: „Nutzt deinen Rest“', () => {
  it('Rest von früher → Hinweis mit Anbruchstag; danach neue Packung → Hinweis vom neuen Anbruch', () => {
    // Champignons 250 g: Mo 100 (Rest 150, bis Mi), Di 100 (aus Mo), Mi 100 (50 aus Mo + neue Packung), Do 100 (aus Mi).
    const plan = handPlan([
      { date: MONDAY, meals: [meal('lunch', MONDAY, [['champignons', 100]])] },
      { date: TUE, meals: [meal('lunch', TUE, [['champignons', 100]])] },
      { date: WED, meals: [meal('lunch', WED, [['champignons', 100]])] },
      { date: THU, meals: [meal('lunch', THU, [['champignons', 100]])] },
    ]);
    const hints = leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS);
    expect(hints.map((h) => [h.date, h.foods.map((f) => [f.foodId, f.openedOn])])).toEqual([
      [TUE, [['champignons', MONDAY]]],
      [WED, [['champignons', MONDAY]]],
      [THU, [['champignons', WED]]],
    ]);
    // Beispiel-Packungen sind Entwürfe (Testwerte) → nicht geprüft; die App kennzeichnet das.
    expect(hints.every((h) => h.foods.every((f) => !f.packageReviewed))).toBe(true);
  });

  it('rohes Hackfleisch: Hinweis nur am Folgetag; übermorgen abgelaufen → kein Hinweis (S9)', () => {
    const plan = handPlan([
      { date: MONDAY, meals: [meal('dinner', MONDAY, [['hackfleisch-gemischt', 200]])] },
      { date: TUE, meals: [meal('dinner', TUE, [['hackfleisch-gemischt', 100]])] },
      { date: THU, meals: [meal('dinner', THU, [['hackfleisch-gemischt', 100]])] },
    ]);
    const hints = leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ date: TUE });
    expect(hints[0]?.foods).toEqual([
      {
        foodId: 'hackfleisch-gemischt',
        openedOn: MONDAY,
        rawAnimal: true,
        shortLived: true,
        packageReviewed: true,
      },
    ]);
  });

  it('derselbe Tag und dieselbe Kochrunde sind kein Rest „von vorher“', () => {
    const plan = handPlan([
      {
        date: MONDAY,
        meals: [
          meal('lunch', MONDAY, [['champignons', 100]]),
          meal('dinner', MONDAY, [['champignons', 100]]),
        ],
      },
    ]);
    expect(leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS)).toEqual([]);
  });

  it('vorgekochte Meal-Prep-Portionen tragen keinen Hinweis; der Kochtag selbst schon', () => {
    // Mo frisch Tofu (Packung 200 g, Rest 50); Di Kochtag (nutzt den Rest); Mi/Do Portionen vom Di.
    const plan = handPlan([
      { date: MONDAY, meals: [meal('dinner', MONDAY, [['tofu', 150]])] },
      { date: TUE, meals: [meal('lunch', TUE, [['tofu', 100]], 'cook')] },
      { date: WED, meals: [meal('lunch', TUE, [['tofu', 100]], 'leftover')] },
      { date: THU, meals: [meal('lunch', TUE, [['tofu', 100]], 'leftover')] },
    ]);
    const hints = leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS);
    expect(hints.map((h) => h.date)).toEqual([TUE]);
  });

  it('Vorrat (Reis, Nudeln) und Lebensmittel ohne Packungsgröße → kein Hinweis', () => {
    const plan = handPlan([
      {
        date: MONDAY,
        meals: [
          meal('lunch', MONDAY, [
            ['reis', 75],
            ['banane', 100],
          ]),
        ],
      },
      {
        date: TUE,
        meals: [
          meal('lunch', TUE, [
            ['reis', 75],
            ['banane', 100],
          ]),
        ],
      },
    ]);
    expect(N3_FOODS.get('reis')?.pantry).toBe(true);
    expect(N3_FOODS.get('banane')?.pantry).toBe(false);
    expect(leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS)).toEqual([]);
    expect(leftoverMealHints(plan, N3_FOODS, [], DRAFTS)).toEqual([]);
  });

  it('leerer Plan → keine Hinweise; Ergebnis deterministisch', () => {
    expect(leftoverMealHints(handPlan([]), N3_FOODS, ENTRIES, DRAFTS)).toEqual([]);
    const plan = buildMealPlanWeek(planInput({}, { diet: 'omnivore', eatsPork: true }, ENTRIES));
    expect(leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS)).toEqual(
      leftoverMealHints(plan, N3_FOODS, [...ENTRIES].reverse(), DRAFTS),
    );
  });
});

describe('Eigenschaftstest N14: Hinweise nie für abgelaufene Reste, roh tierisch nur vom Vortag', () => {
  it('zufällige Profile (Ernährungsform, 1–8 Mahlzeiten, Meal-Prep, Schwangerschaft, ohne Einwilligung)', () => {
    const random = seededRandom(1414);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const profiles: MealPlanProfileInput[] = [
      { diet: 'omnivore', eatsPork: true },
      { diet: 'vegetarian' },
      { diet: 'vegan' },
      { diet: 'omnivore', eatsPork: true, cookingMode: 'meal_prep', mealprepDays: 2 },
      {
        diet: 'vegetarian',
        cookingMode: 'meal_prep',
        mealprepDays: 3,
        mealprepSlots: 'lunch_dinner',
      },
    ];
    let hinted = 0;
    for (let run = 0; run < 30; run += 1) {
      const female = random() < 0.5;
      const overrides: Partial<NutritionInputsInput> = {
        sex: female ? 'female' : 'male',
        birthDate: `${1945 + Math.floor(random() * 64)}-05-01`,
        bodyMetricsRows: [
          {
            measuredOn: '2026-10-01',
            heightCm: 150 + Math.floor(random() * 50),
            weightKg: 40 + Math.floor(random() * 110),
          },
        ],
        mealsPerDay: 1 + Math.floor(random() * 8),
        healthDataConsent: random() > 0.15,
        healthFlags: { flags: female && random() < 0.15 ? ['pregnancy', 'conservative_plan'] : [] },
        goalType: pick(['fat_loss', 'muscle_gain', 'general_fitness', 'endurance'] as const),
      };
      const profile = pick(profiles);
      const input = planInput(overrides, profile, ENTRIES);
      const plan = buildMealPlanWeek(input);
      // Deterministisch: gleiche Eingaben → gleicher Plan und gleiche Hinweise.
      expect(buildMealPlanWeek(planInput(overrides, profile, ENTRIES))).toEqual(plan);
      const hints = leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS);
      for (const hint of hints) {
        const day = plan.days.find((d) => d.date === hint.date);
        const m = day?.meals.find((x) => x.slot === hint.slot);
        expect(m, `Lauf ${run}`).toBeDefined();
        expect(m?.prepKind).not.toBe('leftover');
        expect(m?.recipeId).toBe(hint.recipeId);
        for (const f of hint.foods) {
          const food = N3_FOODS.get(f.foodId)!;
          expect(food.pantry).toBe(false);
          expect(m?.ingredients.some((i) => i.foodId === f.foodId)).toBe(true);
          // Nie abgelaufen: Anbruch vor dem Kochtag, höchstens die Haltbarkeit je Lebensmittel zurück.
          expect(f.openedOn < m!.cookDate).toBe(true);
          expect(addDays(f.openedOn, leftoverKeepDays(food)) >= m!.cookDate).toBe(true);
          expect(f.rawAnimal).toBe(isRawAnimalLeftover(food));
          if (f.rawAnimal) {
            expect(addDays(f.openedOn, LEFTOVER_RAW_DAYS.rawAnimal)).toBe(m!.cookDate);
          }
        }
        hinted += 1;
      }
    }
    // Der Test muss wirklich Hinweise sehen (sonst prüfte er nichts).
    expect(hinted).toBeGreaterThan(5);
  }, 60_000);

  it('consumeDetailed ändert den Stand genau wie consume', () => {
    const a = new LeftoverTracker(N3_FOODS, leftoverPlanningInput(ENTRIES, DRAFTS)!.packageSizes);
    const b = new LeftoverTracker(N3_FOODS, leftoverPlanningInput(ENTRIES, DRAFTS)!.packageSizes);
    const steps: [string, number, string][] = [
      ['champignons', 100, MONDAY],
      ['champignons', 200, TUE],
      ['hackfleisch-gemischt', 300, MONDAY],
      ['hackfleisch-gemischt', 300, WED],
      ['tofu', 50, TUE],
      ['tofu', 50, SUNDAY_BEFORE],
    ];
    for (const [foodId, grams, date] of steps) {
      expect(b.consumeDetailed(foodId, grams, date).fromLeftover).toBe(
        a.consume(foodId, grams, date),
      );
    }
    expect(b.rests()).toEqual(a.rests());
    expect(b.available(TUE)).toEqual(a.available(TUE));
  });
});

describe('Wächter N14: zeitliche Verbuchung (S1), kurz haltbare Lebensmittel (S3), Entwürfe (H1)', () => {
  // Tofu 200 g: Mo Meal-Prep-Kochtag 2 × 100 g (die ganze Packung), Portion 2 am Mi; Di frisch Tofu 100 g.
  const tofuPlan = handPlan([
    { date: MONDAY, meals: [meal('lunch', MONDAY, [['tofu', 100]], 'cook')] },
    { date: TUE, meals: [meal('dinner', TUE, [['tofu', 100]])] },
    { date: WED, meals: [meal('lunch', MONDAY, [['tofu', 100]], 'leftover')] },
  ]);

  it('S1: Meal-Prep verbraucht die Packung am Kochtag → Di frisch: kein Hinweis, neue Packung', () => {
    expect(leftoverMealHints(tofuPlan, N3_FOODS, ENTRIES, DRAFTS)).toEqual([]);
    const sizes = leftoverPlanningInput(ENTRIES, DRAFTS)!.packageSizes;
    // Di nutzt keinen Rest; nur die Mi-Portion zählt (dieselbe Kochrunde vom Mo, gleiche Packung).
    expect(
      planLeftovers(tofuPlan as MealPlanWeek, N3_FOODS, sizes).uses.map((u) => u.date),
    ).toEqual([WED]);
    const packages = shoppingListPackages(
      { ...(tofuPlan as MealPlanWeek), weekStart: MONDAY },
      N3_FOODS,
      sizes,
    );
    expect(packages.lines.find((l) => l.foodId === 'tofu')).toMatchObject({
      packages: 2,
      neededG: 300,
      leftoverG: 100,
    });
  });

  it('S1: ein Rest von vor dem Kochtag erscheint am Kochtag, nicht an den Portionen', () => {
    const plan = handPlan([
      { date: SUNDAY_BEFORE, meals: [meal('dinner', SUNDAY_BEFORE, [['tofu', 150]])] },
      { date: MONDAY, meals: [meal('lunch', MONDAY, [['tofu', 50]], 'cook')] },
      { date: TUE, meals: [meal('lunch', MONDAY, [['tofu', 50]], 'leftover')] },
    ]);
    const hints = leftoverMealHints(plan, N3_FOODS, ENTRIES, DRAFTS);
    expect(hints.map((h) => [h.date, h.foods[0]?.openedOn])).toEqual([[MONDAY, SUNDAY_BEFORE]]);
  });

  it('S3: Sprossen, Kochschinken, Rohmilchkäse → shortLived (nur Folgetag); Tofu nicht', () => {
    const sprouts = {
      ...N3_FOODS.get('champignons')!,
      id: 'sprossen-roh',
      pregnancy_caution: true,
    };
    const ham = {
      ...N3_FOODS.get('haehnchenbrust')!,
      id: 'kochschinken',
      pregnancy_caution: false,
    };
    const foods = new Map(N3_FOODS).set('sprossen-roh', sprouts).set('kochschinken', ham);
    const entries = [
      ...ENTRIES,
      entry('sprossen-roh', 100),
      entry('kochschinken', 200),
      entry('bergkaese-rohmilch', 200),
    ];
    const plan = handPlan([
      {
        date: MONDAY,
        meals: [
          meal('lunch', MONDAY, [
            ['sprossen-roh', 30],
            ['kochschinken', 50],
            ['bergkaese-rohmilch', 30],
            ['tofu', 50],
          ]),
        ],
      },
      {
        date: TUE,
        meals: [
          meal('lunch', TUE, [
            ['sprossen-roh', 30],
            ['kochschinken', 50],
            ['bergkaese-rohmilch', 30],
            ['tofu', 50],
          ]),
        ],
      },
    ]);
    const [hint] = leftoverMealHints(plan, foods, entries, DRAFTS);
    const byId = new Map(hint!.foods.map((f) => [f.foodId, f]));
    expect(byId.get('sprossen-roh')).toMatchObject({ shortLived: true, rawAnimal: false });
    expect(byId.get('kochschinken')).toMatchObject({ shortLived: true });
    expect(byId.get('bergkaese-rohmilch')).toMatchObject({ shortLived: true, rawAnimal: true });
    expect(byId.get('tofu')).toMatchObject({ shortLived: false, rawAnimal: false });
    for (const f of hint!.foods) {
      expect(f.shortLived).toBe(leftoverKeepDays(foods.get(f.foodId)!) === 1);
    }
  });

  it('H1: ohne allowDrafts nur freigegebene Packungsgrößen', () => {
    expect(leftoverPlanningInput(DEMO_PACKAGE_SIZES, { allowDrafts: false })).toBeUndefined();
    const planning = leftoverPlanningInput(ENTRIES, { allowDrafts: false });
    expect([...planning!.packageSizes.keys()].sort()).toEqual([
      'hackfleisch-gemischt',
      'huehnerei',
      'lachs',
    ]);
    const champignons = handPlan([
      { date: MONDAY, meals: [meal('lunch', MONDAY, [['champignons', 100]])] },
      { date: TUE, meals: [meal('lunch', TUE, [['champignons', 100]])] },
    ]);
    expect(leftoverMealHints(champignons, N3_FOODS, ENTRIES, { allowDrafts: false })).toEqual([]);
    expect(leftoverMealHints(champignons, N3_FOODS, ENTRIES, DRAFTS)).toHaveLength(1);
  });
});

// Typ-Hilfe: die Rezepte der Tests bleiben unverändert (Rollen aus dem Beispiel-Bestand).
void (RECIPES satisfies readonly Recipe[]);
