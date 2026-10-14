/**
 * Etappe N13 – Reste-Score und Aufrunden auf Packungen (docs/PLAN-PHASE-5.md 19.7 N13, KONZEPT 6.11, Wächter-Befund
 * S9): Packungen aus N11, Rest je Zutat, rohe tierische Reste nur bis zum Folgetag (danach „einfrieren“), übrige nach
 * `LEFTOVER_RAW_DAYS` je Abteilung; der Reste-Score ändert NUR die Reihenfolge. Eigenschaftstest „Reste-Score an/aus →
 * gleiche Kandidatenmenge, jeder Tag im Band oder `below_floor`“.
 */
import { describe, expect, it } from 'vitest';

import { LEFTOVER_RAW_DAYS, LEFTOVER_SCORING, MEAL_PLAN_SCORING } from '../constants';
import { SHOPPING_CATEGORIES } from '../content/food-schema';
import { packageSizeLookup } from '../content/package-size-checks';
import type { Recipe } from '../content/recipe-schema';
import { DEMO_PACKAGE_SIZES, withDemoRoles } from '../demo-nutrition';
import { addDays } from '../dates';
import {
  isRawAnimalLeftover,
  leftoverKeepDays,
  leftoverScore,
  leftoverScoreBonus,
  LeftoverTracker,
  planLeftovers,
  recordDayLeftovers,
  shoppingListPackages,
} from './leftovers';
import {
  buildMealPlanWeek,
  CandidatePool,
  dayWithinPlanBand,
  type MealPlanInput,
  type MealPlanWeek,
  rankSlotCandidates,
  WeekState,
} from './meal-plan';
import { N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import {
  mealPlanProfileSchema,
  type MealPlanProfileInput,
  type NutritionInputsInput,
} from './schemas';
import { buildShoppingList } from './shopping-list';
import { nutritionTargetsForWeek } from './targets';
import { independentLimits, inputs, MONDAY, seededRandom } from './test-helpers';

const SUNDAY_BEFORE = addDays(MONDAY, -1);
const RECIPES = N3_RECIPES.map(withDemoRoles);
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const TUE = addDays(MONDAY, 1);
const WED = addDays(MONDAY, 2);
const food = (id: string) => N3_FOODS.get(id)!;

/** Packungsgrößen für die Tests (Beispiel-Bestand + Hackfleisch, Eier im 6er, Lachs, Milch). */
const SIZES = new Map<string, number>([
  ...packageSizeLookup(DEMO_PACKAGE_SIZES),
  ['hackfleisch-gemischt', 500],
  ['huehnerei', 360],
  ['lachs', 250],
  ['vollmilch', 1000],
  ['champignons', 250],
]);

function planInput(
  overrides: Partial<NutritionInputsInput> = {},
  options: {
    readonly profile?: MealPlanProfileInput;
    readonly recipes?: readonly Recipe[];
    readonly sizes?: ReadonlyMap<string, number> | null;
  } = {},
): MealPlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, ...overrides }),
      MONDAY,
    ),
    profile: options.profile ?? omni,
    recipes: options.recipes ?? RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
    ...(options.sizes === null ? {} : { leftovers: { packageSizes: options.sizes ?? SIZES } }),
  };
}

describe('Haltbarkeit roher Reste (S9, LEFTOVER_RAW_DAYS)', () => {
  it('rohes Fleisch, Fisch, Rohmilch → nur Folgetag; übrige nach Abteilung', () => {
    expect(isRawAnimalLeftover(food('hackfleisch-gemischt'))).toBe(true);
    expect(isRawAnimalLeftover(food('lachs'))).toBe(true);
    expect(isRawAnimalLeftover(food('bergkaese-rohmilch'))).toBe(true);
    expect(isRawAnimalLeftover(food('vollmilch'))).toBe(false);
    expect(isRawAnimalLeftover(food('tofu'))).toBe(false);
    expect(leftoverKeepDays(food('hackfleisch-gemischt'))).toBe(1);
    expect(leftoverKeepDays(food('tofu'))).toBe(LEFTOVER_RAW_DAYS.byCategory.chilled_plant_based);
    expect(leftoverKeepDays(food('champignons'))).toBe(
      LEFTOVER_RAW_DAYS.byCategory.fruit_vegetables,
    );
  });

  it('Wächter N13 H6: empfindliche pflanzliche Lebensmittel (rohe Sprossen, pregnancy_caution) → nur Folgetag', () => {
    const sprouts = { ...food('champignons'), id: 'sprossen-roh', pregnancy_caution: true };
    expect(isRawAnimalLeftover(sprouts)).toBe(false);
    expect(leftoverKeepDays(sprouts)).toBe(LEFTOVER_RAW_DAYS.sensitive);
    expect(LEFTOVER_RAW_DAYS.sensitive).toBe(1);
    const foods = new Map(N3_FOODS).set('sprossen-roh', sprouts);
    const tracker = new LeftoverTracker(foods, new Map([['sprossen-roh', 100]]));
    tracker.consume('sprossen-roh', 30, MONDAY);
    expect(tracker.available(WED).has('sprossen-roh')).toBe(false);
    expect(tracker.rests()[0]).toMatchObject({
      rawAnimal: false,
      hint: 'next_day_only',
      usableUntil: TUE,
    });
  });

  it('jede Abteilung hat einen Wert ≥ 1; Fleisch/Fisch/Sonstiges höchstens 1 Tag', () => {
    expect(Object.keys(LEFTOVER_RAW_DAYS.byCategory).sort()).toEqual(
      [...SHOPPING_CATEGORIES].sort(),
    );
    for (const days of Object.values(LEFTOVER_RAW_DAYS.byCategory))
      expect(days).toBeGreaterThanOrEqual(1);
    expect(LEFTOVER_RAW_DAYS.rawAnimal).toBe(1);
    expect(LEFTOVER_RAW_DAYS.byCategory.meat_sausage).toBe(1);
    expect(LEFTOVER_RAW_DAYS.byCategory.fish).toBe(1);
    expect(LEFTOVER_RAW_DAYS.byCategory.other).toBe(1);
  });
});

describe('LeftoverTracker: Packungen anbrechen, Rest, Ablauf', () => {
  it('rohes Hackfleisch als Rest: nur Folgetag, danach neue Packung und Hinweis „einfrieren“', () => {
    const tracker = new LeftoverTracker(N3_FOODS, SIZES);
    expect(tracker.consume('hackfleisch-gemischt', 300, MONDAY)).toBe(0);
    expect(tracker.available(MONDAY).get('hackfleisch-gemischt')).toMatchObject({
      remainingG: 200,
      daysLeft: 1,
    });
    expect(tracker.available(TUE).get('hackfleisch-gemischt')?.daysLeft).toBe(0);
    expect(tracker.available(WED).has('hackfleisch-gemischt')).toBe(false);
    const rest = tracker.rests()[0];
    expect(rest).toMatchObject({ foodId: 'hackfleisch-gemischt', rawAnimal: true, hint: 'freeze' });
    expect(rest?.usableUntil).toBe(TUE);
    // Mittwoch: der Rest ist abgelaufen → er wird NICHT verwendet, eine neue Packung wird angebrochen.
    expect(tracker.consume('hackfleisch-gemischt', 150, WED)).toBe(0);
    expect(tracker.packagesOpened('hackfleisch-gemischt')).toBe(2);
    // Dienstag (Folgetag) wäre er noch genutzt worden:
    const fresh = new LeftoverTracker(N3_FOODS, SIZES);
    fresh.consume('hackfleisch-gemischt', 300, MONDAY);
    expect(fresh.consume('hackfleisch-gemischt', 150, TUE)).toBe(150);
    expect(fresh.packagesOpened('hackfleisch-gemischt')).toBe(1);
  });

  it('nicht einfrierbarer roher Rest (Räucherlachs-Art) → „nur bis zum Folgetag“', () => {
    const tracker = new LeftoverTracker(N3_FOODS, new Map([['raeucherlachs', 100]]));
    tracker.consume('raeucherlachs', 40, MONDAY);
    expect(tracker.rests()[0]?.hint).toBe('next_day_only');
  });

  it('Zutat ohne Packungsgröße: kein Aufrunden, kein Rest', () => {
    const tracker = new LeftoverTracker(N3_FOODS, SIZES);
    expect(tracker.consume('zwiebel', 80, MONDAY)).toBe(0);
    expect(tracker.packagesOpened('zwiebel')).toBe(0);
    expect(tracker.available(MONDAY).has('zwiebel')).toBe(false);
    expect(tracker.trackedFoods()).toEqual([]);
  });

  it('Eier: 6er-Packung, 4 Eier verbraucht → 2 Eier Rest', () => {
    const tracker = new LeftoverTracker(N3_FOODS, SIZES);
    tracker.consume('huehnerei', 4 * 60, MONDAY);
    expect(tracker.rests()[0]).toMatchObject({ foodId: 'huehnerei', remainingPieces: 2 });
  });

  it('mehrere Packungen auf einmal; Rest über mehrere Tage; Verbrauch am früheren Kochtag verkürzt die Frist', () => {
    const tracker = new LeftoverTracker(N3_FOODS, SIZES);
    tracker.consume('tofu', 450, MONDAY); // 3 × 200 g
    expect(tracker.packagesOpened('tofu')).toBe(3);
    expect(tracker.available(MONDAY).get('tofu')?.remainingG).toBeCloseTo(150, 6);
    expect(tracker.consume('tofu', 100, TUE)).toBeCloseTo(100, 6);
    // Meal-Prep: Verbrauch für den Sonntag davor (vor dem Anbruch) → Anbruch rückt vor, Frist endet früher.
    tracker.consume('tofu', 10, SUNDAY_BEFORE);
    expect(tracker.available(SUNDAY_BEFORE).get('tofu')?.usableUntil).toBe(
      addDays(SUNDAY_BEFORE, LEFTOVER_RAW_DAYS.byCategory.chilled_plant_based),
    );
    // Kopie ist unabhängig.
    const copy = tracker.clone();
    copy.consume('tofu', 40, SUNDAY_BEFORE);
    expect(copy.available(SUNDAY_BEFORE).get('tofu')?.remainingG).not.toBe(
      tracker.available(SUNDAY_BEFORE).get('tofu')?.remainingG,
    );
  });
});

describe('leftoverScore: Menge × Dringlichkeit, Vorrat zählt nicht, höchstens 1', () => {
  const tracker = new LeftoverTracker(N3_FOODS, SIZES);
  tracker.consume('champignons', 100, MONDAY); // 150 g Rest, 2 Tage nutzbar
  tracker.consume('reis', 100, MONDAY); // Vorrat
  it('zählt verbrauchte Rest-Menge ÷ Packung × 1 ÷ (1 + Tage)', () => {
    const available = tracker.available(MONDAY);
    expect(
      leftoverScore([{ foodId: 'champignons', grams: 75 }], available, N3_FOODS, SIZES),
    ).toBeCloseTo((75 / 250) * (1 / 3), 9);
    // Dringlicher am letzten Tag:
    const last = tracker.available(addDays(MONDAY, 2));
    expect(
      leftoverScore([{ foodId: 'champignons', grams: 75 }], last, N3_FOODS, SIZES),
    ).toBeCloseTo(75 / 250, 9);
    // Mehr als der Rest zählt nicht; Vorrat (Reis) zählt nicht; unbekannte Lebensmittel nicht.
    expect(
      leftoverScore([{ foodId: 'champignons', grams: 900 }], last, N3_FOODS, SIZES),
    ).toBeCloseTo(150 / 250, 9);
    expect(leftoverScore([{ foodId: 'reis', grams: 300 }], available, N3_FOODS, SIZES)).toBe(0);
    expect(leftoverScore([{ foodId: 'zwiebel', grams: 300 }], available, N3_FOODS, SIZES)).toBe(0);
    expect(leftoverScore([], new Map(), N3_FOODS, SIZES)).toBe(0);
  });

  it('Bonus höchstens LEFTOVER_SCORING.weight, strikt unter dem Wiederholungs-Abzug', () => {
    expect(leftoverScoreBonus(5)).toBe(LEFTOVER_SCORING.weight);
    expect(leftoverScoreBonus(-1)).toBe(0);
    expect(LEFTOVER_SCORING.weight).toBeLessThan(MEAL_PLAN_SCORING.repeat);
  });
});

describe('Einkaufsliste auf Packungen aufrunden (shoppingListPackages)', () => {
  const plan = buildMealPlanWeek(planInput({}, { sizes: null }));

  it('Packungen ≥ aufgerundeter Bedarf, Rest = gekauft − benötigt; ohne Packungsgröße gesondert', () => {
    const result = shoppingListPackages(plan, N3_FOODS, SIZES);
    expect(result.lines.length).toBeGreaterThan(0);
    for (const line of result.lines) {
      expect(line.packages).toBeGreaterThanOrEqual(
        Math.ceil(line.neededG / line.packageSizeG - 1e-6),
      );
      expect(line.leftoverG).toBeCloseTo(line.packages * line.packageSizeG - line.neededG, 0);
      expect(line.leftoverG).toBeGreaterThanOrEqual(0);
      if (line.isPantry) {
        // Vorrat hält 30 Tage: genau aufgerundet.
        expect(line.packages).toBe(Math.ceil(line.neededG / line.packageSizeG - 1e-6));
      }
    }
    for (const id of result.withoutPackageSize) expect(SIZES.has(id)).toBe(false);
    // Bedarf passt zur Einkaufsliste (dort auf Kaufschritte AUFgerundet).
    const list = buildShoppingList(plan, N3_FOODS);
    for (const line of result.lines) {
      const item = list.items.find((i) => i.foodId === line.foodId && i.unit === 'g');
      if (item?.amount != null) expect(line.neededG).toBeLessThanOrEqual(item.amount + 1e-6);
    }
  });

  it('Zeitraum wie die Einkaufsliste; leere Packungs-Tabelle → nur „ohne Packungsgröße“', () => {
    const all = shoppingListPackages(plan, N3_FOODS, SIZES);
    const part = shoppingListPackages(plan, N3_FOODS, SIZES, { from: MONDAY, to: TUE });
    const sum = (r: typeof all) => r.lines.reduce((s, l) => s + l.neededG, 0);
    expect(sum(part)).toBeLessThan(sum(all));
    const none = shoppingListPackages(plan, N3_FOODS, new Map());
    expect(none.lines).toEqual([]);
    expect(none.withoutPackageSize.length).toBeGreaterThan(0);
    expect(() => shoppingListPackages(plan, N3_FOODS, SIZES, { from: TUE, to: MONDAY })).toThrow();
    expect(() => shoppingListPackages(plan, N3_FOODS, new Map([['tofu', 0]]))).toThrow();
    expect(() => shoppingListPackages(plan, N3_FOODS, new Map([['tofu', 5001]]))).toThrow();
  });

  it('planLeftovers: welche Mahlzeit welchen Rest verbraucht; Reste am Ende mit Haltbarkeit', () => {
    const result = planLeftovers(plan, N3_FOODS, SIZES);
    for (const use of result.uses) {
      expect(use.foodIds.length).toBeGreaterThan(0);
      for (const id of use.foodIds) expect(SIZES.has(id)).toBe(true);
    }
    for (const rest of result.rests) {
      expect(rest.remainingG).toBeGreaterThan(0);
      expect(rest.usableUntil >= rest.openedOn).toBe(true);
    }
    expect(planLeftovers(plan, N3_FOODS, SIZES)).toEqual(result);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Im Essensplan: nur Reihenfolge
// ---------------------------------------------------------------------------------------------------------

describe('Reste-Score im Essensplan (nur Reihenfolge, deterministisch)', () => {
  it('ohne Feld bzw. mit leerer Tabelle: genau der bisherige Plan', () => {
    const off = buildMealPlanWeek(planInput({}, { sizes: null }));
    expect(buildMealPlanWeek(planInput({}, { sizes: new Map() }))).toEqual(off);
  });

  it('leerer Katalog: alle Plätze leer, keine Reste, kein Absturz; ungültige Packungsgrößen werfen (Zod)', () => {
    const plan = buildMealPlanWeek(planInput({}, { recipes: [] }));
    expect(plan.days.every((d) => d.meals.length === 0 && d.emptySlots.length > 0)).toBe(true);
    expect(planLeftovers(plan, N3_FOODS, SIZES)).toEqual({ uses: [], rests: [] });
    expect(shoppingListPackages(plan, N3_FOODS, SIZES)).toEqual({
      lines: [],
      withoutPackageSize: [],
    });
    expect(() => buildMealPlanWeek(planInput({}, { sizes: new Map([['tofu', 0.5]]) }))).toThrow();
    expect(() => buildMealPlanWeek(planInput({}, { sizes: new Map([['X', 100]]) }))).toThrow();
  });

  it('deterministisch; Planband unverändert', () => {
    const on = buildMealPlanWeek(planInput());
    expect(buildMealPlanWeek(planInput())).toEqual(on);
    const off = buildMealPlanWeek(planInput({}, { sizes: null }));
    expect(on.days.map((d) => d.band)).toEqual(off.days.map((d) => d.band));
  });

  it('Reste werden häufiger verbraucht als ohne Reste-Score (über viele Profile)', () => {
    const random = seededRandom(1314);
    let usedOn = 0;
    let usedOff = 0;
    for (let run = 0; run < 12; run += 1) {
      const overrides: Partial<NutritionInputsInput> = {
        mealsPerDay: 2 + Math.floor(random() * 5),
        bodyMetricsRows: [
          {
            measuredOn: '2026-10-01',
            heightCm: 160 + Math.floor(random() * 30),
            weightKg: 50 + Math.floor(random() * 60),
          },
        ],
      };
      const rescued = (plan: MealPlanWeek) => {
        const tracker = new LeftoverTracker(N3_FOODS, SIZES);
        let grams = 0;
        for (const day of plan.days) {
          for (const meal of day.meals) {
            for (const i of meal.ingredients) {
              if (N3_FOODS.get(i.foodId)?.pantry === false)
                grams += tracker.consume(i.foodId, i.grams, meal.cookDate);
              else tracker.consume(i.foodId, i.grams, meal.cookDate);
            }
          }
        }
        return grams;
      };
      usedOn += rescued(buildMealPlanWeek(planInput(overrides)));
      usedOff += rescued(buildMealPlanWeek(planInput(overrides, { sizes: null })));
    }
    expect(usedOn).toBeGreaterThan(usedOff);
  }, 60_000);
});

describe('Eigenschaftstest (19.7 N13 DoD, S9): Reste-Score an/aus → gleiche Kandidatenmenge, jeder Tag im Band oder below_floor', () => {
  it('zufällige Profile (Ernährungsform, Schwangerschaft, 1–8 Mahlzeiten, Meal-Prep, ohne Einwilligung)', () => {
    const random = seededRandom(913);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const profiles: MealPlanProfileInput[] = [
      omni,
      { diet: 'omnivore' },
      { diet: 'vegetarian' },
      { diet: 'vegan' },
      { diet: 'omnivore', eatsPork: true, intolerances: ['lactose'], dislikes: ['mushrooms'] },
      { diet: 'omnivore', eatsPork: true, cookingMode: 'meal_prep', mealprepDays: 2 },
      {
        diet: 'vegetarian',
        cookingMode: 'meal_prep',
        mealprepDays: 3,
        mealprepSlots: 'lunch_dinner',
      },
    ];
    let checkedDays = 0;
    for (let run = 0; run < 36; run += 1) {
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
      const on = buildMealPlanWeek(planInput(overrides, { profile }));
      const off = buildMealPlanWeek(planInput(overrides, { profile, sizes: null }));
      const parsed = mealPlanProfileSchema.parse(profile);
      const input = planInput(overrides, { profile });
      const pool = new CandidatePool(RECIPES, N3_FOODS, profile, true);
      for (const [i, day] of on.days.entries()) {
        const offDay = off.days[i]!;
        const targets = input.targets.days[i]!;
        const pregnancy = targets.recipeExclusions.includes('pregnancy_caution');
        // Gleiche Kandidatenmenge: der Filter kennt den Reste-Score nicht; leere Plätze (keine Kandidaten) gleich.
        const allowed = new Set(pool.allowed(pregnancy).map((c) => c.recipe.id));
        const filterEmpty = (d: typeof day) =>
          d.emptySlots.filter((e) => !e.reasons.includes('above_ceiling'));
        expect(filterEmpty(day)).toEqual(filterEmpty(offDay));
        expect(dayWithinPlanBand(day, day.band), `Lauf ${run} ${day.date}`).toBe(true);
        // Unabhängiges Kalorien-Orakel (Wächter N13 S5).
        const limits = independentLimits(
          { today: SUNDAY_BEFORE, mealsPerDay: 4, ...overrides },
          day.date,
        );
        if (limits !== null && day.status !== 'no_targets') {
          const kcal = day.meals.reduce((sum, m) => sum + m.nutrients.kcal, 0);
          const optional = day.meals.reduce((sum, m) => sum + m.optionalKcal, 0);
          expect(kcal + optional).toBeLessThanOrEqual(limits.upper);
          if (day.status === 'complete') expect(kcal).toBeGreaterThanOrEqual(limits.lower);
        }
        expect(day.band).toEqual(offDay.band);
        if (day.band !== null) expect(['complete', 'below_floor']).toContain(day.status);
        for (const meal of day.meals) {
          if (meal.prepKind !== 'leftover') expect(allowed.has(meal.recipeId)).toBe(true);
          const recipe = RECIPES.find((r) => r.id === meal.recipeId) as Recipe;
          expect(
            usedFoodViolations(
              recipe,
              meal.ingredients.map((x) => ({ index: x.index, foodId: x.foodId })),
              parsed,
              pregnancy,
            ),
          ).toEqual([]);
          if (day.status === 'no_targets') expect(meal.factor).toBe(1);
          else {
            expect(meal.factor).toBeGreaterThanOrEqual(0.5);
            expect(meal.factor).toBeLessThanOrEqual(2);
          }
        }
        checkedDays += 1;
      }
      expect(buildMealPlanWeek(planInput(overrides, { profile }))).toEqual(on);
    }
    expect(checkedDays).toBe(36 * 7);
  }, 60_000);
});

describe('Eigenschaftstest: Reste-Score ordnet nur um (Kandidatenmenge je Platz gleich)', () => {
  it('zufällige Reste und Profile: gleiche Kandidaten, Reihenfolge darf sich ändern', () => {
    const random = seededRandom(1315);
    const profiles: MealPlanProfileInput[] = [omni, { diet: 'vegetarian' }, { diet: 'vegan' }];
    const foodsWithSize = [...SIZES.keys()];
    let reordered = 0;
    let compared = 0;
    for (let run = 0; run < 40; run += 1) {
      const profile = profiles[run % profiles.length] as MealPlanProfileInput;
      const input = planInput({ mealsPerDay: 1 + (run % 8) }, { profile });
      const pool = new CandidatePool(RECIPES, N3_FOODS, profile, true);
      const dayIndex = run % 7;
      const targets = input.targets.days[dayIndex]!;
      const tracker = new LeftoverTracker(N3_FOODS, SIZES);
      for (let k = 0; k < 4; k += 1) {
        const id = foodsWithSize[Math.floor(random() * foodsWithSize.length)] as string;
        tracker.consume(id, 20 + random() * 400, addDays(targets.date, -Math.floor(random() * 3)));
      }
      const withState = new WeekState();
      withState.leftovers = tracker;
      const base = { targets, dayIndex, weekStart: MONDAY, variant: 0, pool };
      for (const slot of targets.slots) {
        const on = rankSlotCandidates(
          { ...base, state: withState },
          slot.slot,
          slot.role,
          slot.share,
        );
        const off = rankSlotCandidates(
          { ...base, state: new WeekState() },
          slot.slot,
          slot.role,
          slot.share,
        );
        const ids = (list: typeof on) => list.map((c) => c.recipe.id);
        expect([...ids(on)].sort()).toEqual([...ids(off)].sort());
        compared += 1;
        if (ids(on).join() !== ids(off).join()) reordered += 1;
      }
    }
    expect(compared).toBeGreaterThan(40);
    // Der Reste-Score wirkt wirklich (sonst prüfte der Test nichts).
    expect(reordered).toBeGreaterThan(0);
  }, 60_000);
});

describe('Leistung mit großem Katalog (Lehre N10/N11)', () => {
  it('Reste-Score kostet höchstens wenig mehr als ohne (600 Rezepte)', () => {
    const big: Recipe[] = [];
    for (let k = 0; k < 32; k += 1) {
      for (const r of RECIPES) big.push({ ...r, id: `${r.id}-k${k}` });
    }
    const time = (sizes: ReadonlyMap<string, number> | null) => {
      const start = performance.now();
      buildMealPlanWeek(planInput({ mealsPerDay: 5 }, { recipes: big, sizes }));
      return performance.now() - start;
    };
    time(null);
    const off = time(null);
    const on = time(SIZES);
    expect(on).toBeLessThan(off * 2 + 500);
  }, 60_000);
});

describe('recordDayLeftovers: gleiche Reihenfolge wie beim Planen', () => {
  it('Plan nachrechnen ergibt dieselben Reste wie der Verbrauch Tag für Tag', () => {
    const plan = buildMealPlanWeek(planInput());
    const tracker = new LeftoverTracker(N3_FOODS, SIZES);
    for (const day of plan.days) recordDayLeftovers(tracker, day);
    expect(planLeftovers(plan, N3_FOODS, SIZES).rests).toEqual(tracker.rests());
  });
});
