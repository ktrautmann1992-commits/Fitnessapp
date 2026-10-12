/**
 * Wochen-Essensplan (docs/PLAN-PHASE-5.md 6.2–6.4, 12.1, 12.2): W2 (Planband-Eigenschaftstest über die AUSGABE von
 * `buildMealPlanWeek`), Eigenschaftstest „kein ausgeschlossenes Rezept erscheint je im Plan“, W15 (Meal-Prep ohne
 * Einfrieren), Grenzfälle (1 vs. 7 Trainingstage, 1–8 Mahlzeiten, sehr kleiner/großer Bedarf, `no_targets`,
 * `maintenance_only`, keine passenden Rezepte), Determinismus, Wiederholungsgrenzen, Tauschen, vergangene Tage.
 *
 * Die Prüfungen rechnen UNABHÄNGIG nach: Ausschlüsse direkt aus den Katalog-Angaben der verwendeten Zutaten
 * (Gruppen, Tierart, Schwein, Schwangerschaft, Ernährungsform), Haltbarkeit aus `max_fridge_days`/`freezable`,
 * Band aus den Tageszielen (`band`, `floorKcal`).
 */
import { describe, expect, it } from 'vitest';

import { PORTION_SCALE_LIMITS } from '../constants';
import type { Food } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import { daysBetween } from '../dates';
import { GOAL_TYPES } from '../enums';
import type { FoodGroupId } from '../food-groups';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { HealthFlag } from '../health-screening';
import {
  buildMealPlanWeekDetailed,
  type MealPlanInput,
  type MealPlanWeek,
  swapMealRecipe,
} from './meal-plan';
import { independentBand, N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import { toMealPlanPayload } from './meal-plan-payload';
import { needsAutomaticReplan } from './replan';
import { type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';
import { nutritionTargetsForWeek, type NutritionWeekTargets } from './targets';
import { inputs, MONDAY, run, seededRandom, session } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const EPS = 1e-6;

function pick<T>(rnd: () => number, values: readonly T[]): T {
  return values[Math.floor(rnd() * values.length)] as T;
}

function build(
  targets: NutritionWeekTargets,
  profile: MealPlanProfileInput,
  extra: Partial<MealPlanInput> = {},
): MealPlanWeek {
  const { aboveCeilingDays, plan } = buildMealPlanWeekDetailed({
    targets,
    profile,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
    ...extra,
  });
  expect(aboveCeilingDays).toEqual([]);
  return plan;
}

/** Unabhängige Prüfung aller harten Ausschlüsse an den TATSÄCHLICH verwendeten Zutaten (eigene Regeln, S5c). */
function exclusionViolations(
  plan: MealPlanWeek,
  targets: NutritionWeekTargets,
  rawProfile: MealPlanProfileInput,
  recipes: readonly Recipe[] = N3_RECIPES,
  from = '0000-00-00',
): string[] {
  const profile = mealPlanProfileSchema.parse(rawProfile);
  const problems: string[] = [];
  for (const day of plan.days) {
    if (day.date < from) continue;
    const pregnancy =
      targets.days
        .find((d) => d.date === day.date)
        ?.recipeExclusions.includes('pregnancy_caution') ?? true;
    for (const meal of day.meals) {
      const recipe = recipes.find((r) => r.id === meal.recipeId) as Recipe;
      for (const p of usedFoodViolations(recipe, meal.ingredients, profile, pregnancy)) {
        problems.push(`${day.date} ${meal.slot} ${meal.recipeId}: ${p}`);
      }
    }
  }
  return problems;
}

/** Unabhängig: Planband, Faktoren, Mengen, Haltbarkeit (R9) eines Tages. */
function bandProblems(plan: MealPlanWeek, targets: NutritionWeekTargets, from = '0000-00-00') {
  const problems: string[] = [];
  for (const day of plan.days) {
    if (day.date < from) continue;
    const t = targets.days.find((d) => d.date === day.date);
    if (t === undefined) continue;
    const kcal = day.totals.kcal;
    for (const meal of day.meals) {
      if (
        meal.factor < PORTION_SCALE_LIMITS.min - EPS ||
        meal.factor > PORTION_SCALE_LIMITS.max + EPS
      ) {
        problems.push(`${day.date}: Faktor ${meal.factor}`);
      }
      if (meal.ingredients.some((i) => !(i.amount > 0))) problems.push(`${day.date}: Menge 0`);
      // Keine verwaisten Reste (Wächter N3 S2): Kochtag in der Woche → dort eine Kochtag-Mahlzeit desselben Rezepts.
      if (meal.prepKind === 'leftover' && meal.cookDate >= plan.weekStart) {
        const cookDay = plan.days.find((d) => d.date === meal.cookDate);
        const cooked = cookDay?.meals.some(
          (m) => m.prepKind === 'cook' && m.slot === meal.slot && m.recipeId === meal.recipeId,
        );
        if (cooked !== true) problems.push(`${day.date}: Rest ${meal.recipeId} ohne Kochtag`);
      }
      if (meal.storage !== null) {
        const days = daysBetween(meal.cookDate, day.date);
        const recipe = N3_RECIPES.find((r) => r.id === meal.recipeId) as Recipe;
        const used = meal.ingredients.map((i) => N3_FOODS.get(i.foodId) as Food);
        const fridge = Math.min(
          recipe.meal_prep.fridge_days,
          ...used.map((f) => f.max_fridge_days),
          3,
        );
        if (meal.storage === 'fridge' && days > fridge) {
          problems.push(
            `${day.date}: ${meal.recipeId} ${days} Tage im Kühlschrank (max. ${fridge})`,
          );
        }
        if (
          meal.storage === 'freeze' &&
          !(recipe.meal_prep.freezable && used.every((f) => f.freezable))
        ) {
          problems.push(`${day.date}: ${meal.recipeId} eingefroren, aber nicht einfrierbar`);
        }
      }
    }
    if (t.band === null) {
      if (day.status !== 'no_targets') problems.push(`${day.date}: Status ${day.status} ohne Ziel`);
      if (!day.notices.includes('no_targets_portions')) problems.push(`${day.date}: Hinweis fehlt`);
      if (day.meals.some((m) => !m.fixed && m.factor !== 1))
        problems.push(`${day.date}: Faktor ≠ 1`);
      continue;
    }
    const [min, max] = independentBand(t);
    const withOptional = kcal + day.meals.reduce((n, m) => n + m.optionalKcal, 0);
    if (Math.abs(t.band.min - min) > EPS)
      problems.push(`${day.date}: Band-Untergrenze ${t.band.min} ≠ ${min}`);
    if (withOptional > max + EPS) {
      problems.push(
        `${day.date}: ${withOptional} (mit optionalen Zutaten) über der Obergrenze ${max}`,
      );
    }
    if (day.status === 'complete') {
      if (kcal < t.band.min - EPS)
        problems.push(`${day.date}: vollständig, aber ${kcal} < ${t.band.min}`);
      if (t.floorKcal !== null && kcal < t.floorKcal - EPS)
        problems.push(`${day.date}: unter Untergrenze`);
    } else if (day.status === 'below_floor') {
      if (!(kcal < min)) problems.push(`${day.date}: below_floor, aber im Band`);
      if (!day.notices.includes('day_below_floor')) problems.push(`${day.date}: Hinweis fehlt`);
    } else {
      problems.push(`${day.date}: Status ${day.status} mit Ziel`);
    }
  }
  return problems;
}

const GROUP_POOL: FoodGroupId[] = [
  'peanuts',
  'gluten',
  'dairy',
  'lactose',
  'eggs',
  'fish',
  'mushrooms',
  'soy',
  'poultry',
  'onion_garlic',
];
const FLAG_SETS: (readonly HealthFlag[] | null)[] = [
  null,
  [],
  ['medication', 'conservative_plan'],
  ['pregnancy', 'conservative_plan'],
];
const BODIES = [
  { weightKg: 30, heightCm: 150 },
  { weightKg: 45, heightCm: 150 },
  { weightKg: 200, heightCm: 190 },
  { weightKg: 300, heightCm: 250 },
  { weightKg: 70, heightCm: 170 },
];

function randomProfile(rnd: () => number): MealPlanProfileInput {
  const diet = pick(rnd, ['omnivore', 'vegetarian', 'vegan'] as const);
  const groups = GROUP_POOL.filter(() => rnd() < 0.15);
  const intolerances = groups.filter(() => rnd() < 0.5);
  const dislikes = groups.filter((g) => !intolerances.includes(g));
  const mealPrep = rnd() < 0.5;
  return {
    diet,
    eatsPork: diet === 'omnivore' ? pick(rnd, [true, false, null]) : pick(rnd, [false, null]),
    cookingMode: mealPrep ? 'meal_prep' : 'daily',
    mealprepDays: mealPrep ? 1 + Math.floor(rnd() * 7) : null,
    mealprepSlots: pick(rnd, ['lunch', 'lunch_dinner'] as const),
    intolerances,
    dislikes,
    likes: GROUP_POOL.filter((g) => !dislikes.includes(g) && rnd() < 0.1),
    maxPrepMinutesWeekday: rnd() < 0.2 ? 20 : null,
  };
}

describe('W2 – Planband über die Ausgabe von buildMealPlanWeek (B1)', () => {
  it('jeder Tag im Planband oder below_floor mit Hinweis; nie über der Obergrenze (Raster + Zufall)', () => {
    const rnd = seededRandom(20261012);
    const pools: { name: string; recipes: readonly Recipe[] }[] = [
      { name: 'alle', recipes: N3_RECIPES },
      // Leere Kandidatenpools für einzelne Plätze (keine Snacks bzw. kein Frühstück).
      { name: 'ohne Snacks', recipes: N3_RECIPES.filter((r) => !r.meal_types.includes('snack')) },
      {
        name: 'ohne Frühstück',
        recipes: N3_RECIPES.filter((r) => !r.meal_types.includes('breakfast')),
      },
      {
        name: 'nur Hauptgerichte',
        recipes: N3_RECIPES.filter((r) => r.meal_types.includes('main')),
      },
      { name: 'leer', recipes: [] },
    ];
    let checkedDays = 0;
    let belowFloor = 0;
    let complete = 0;
    for (let i = 0; i < 160; i += 1) {
      const body = i < 40 ? (BODIES[i % 4] as (typeof BODIES)[number]) : pick(rnd, BODIES);
      const mealsPerDay = 1 + (i % 8);
      const goal = GOAL_TYPES[i % GOAL_TYPES.length] as (typeof GOAL_TYPES)[number];
      const trainingDays = Math.floor(rnd() * 8);
      const sessions = Array.from({ length: trainingDays }, (_, d) =>
        rnd() < 0.5
          ? session(`2026-10-${String(12 + d).padStart(2, '0')}`)
          : run(`2026-10-${String(12 + d).padStart(2, '0')}`, pick(rnd, [30, 90, 240])),
      );
      const flags = pick(rnd, FLAG_SETS);
      const targets = nutritionTargetsForWeek(
        inputs({
          today: SUNDAY_BEFORE,
          birthDate: pick(rnd, ['1990-01-01', '2010-05-01', '1950-03-03']),
          sex: pick(rnd, ['male', 'female', 'diverse', null] as const),
          goalType: goal,
          healthDataConsent: rnd() < 0.9,
          healthFlags: flags === null ? null : { flags: [...flags] },
          bodyMetricsRows: [{ measuredOn: '2026-10-01', ...body }],
          mealsPerDay,
          trainingTime: pick(rnd, ['early', 'midday', 'evening', 'varies', null] as const),
          activityLevel: pick(rnd, ['sedentary', 'very_active', null] as const),
          sessions,
        }),
        MONDAY,
      );
      const profile = randomProfile(rnd);
      const pool = i % 9 === 0 ? pick(rnd, pools) : (pools[0] as (typeof pools)[number]);
      const plan = build(targets, profile, { recipes: pool.recipes, variant: i % 3 });
      const context = `Fall ${i} (${pool.name}, ${mealsPerDay} Mahlzeiten, ${body.weightKg} kg, ${goal})`;
      expect(bandProblems(plan, targets), context).toEqual([]);
      // Ein frisch erzeugter Plan braucht keine automatische Neuplanung (Wächter N3 NB1).
      expect(
        needsAutomaticReplan(plan, {
          targets,
          profile,
          recipes: pool.recipes,
          foods: N3_FOODS,
          allowDrafts: true,
          today: SUNDAY_BEFORE,
        }).needed,
        context,
      ).toBe(false);
      expect(exclusionViolations(plan, targets, profile, pool.recipes), context).toEqual([]);
      for (const day of plan.days) {
        checkedDays += 1;
        if (day.status === 'below_floor') belowFloor += 1;
        if (day.status === 'complete') complete += 1;
      }
    }
    expect(checkedDays).toBe(160 * 7);
    // Beide Zweige kommen im Raster vor (sonst prüft der Test nichts).
    expect(complete).toBeGreaterThan(300);
    expect(belowFloor).toBeGreaterThan(0);
  });

  it('Meal-Prep 1–7 Kochtage mit festen Resten aus dem bisherigen Plan (Neuplanung mitten in der Woche)', () => {
    for (let days = 1; days <= 7; days += 1) {
      for (const weightKg of [45, 200]) {
        const profile: MealPlanProfileInput = {
          diet: 'omnivore',
          eatsPork: true,
          cookingMode: 'meal_prep',
          mealprepDays: days,
          mealprepSlots: 'lunch_dinner',
        };
        const before = nutritionTargetsForWeek(
          inputs({
            today: SUNDAY_BEFORE,
            mealsPerDay: 4,
            bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 175, weightKg }],
          }),
          MONDAY,
        );
        const first = build(before, profile);
        // Donnerstag: Gewicht gesunken, Ziel kleiner → gekochte Reste bleiben fest, Rest gleicht aus.
        const today = '2026-10-15';
        const after = nutritionTargetsForWeek(
          inputs({
            today,
            mealsPerDay: 4,
            goalType: 'fat_loss',
            bodyMetricsRows: [
              { measuredOn: '2026-10-01', heightCm: 175, weightKg },
              { measuredOn: '2026-10-14', weightKg: weightKg * 0.9 },
            ],
          }),
          MONDAY,
        );
        const second = build(after, profile, { today, existingPlan: first });
        expect(bandProblems(second, after, today), `${days} Kochtage, ${weightKg} kg`).toEqual([]);
        // Vergangene Tage unverändert.
        expect(second.days.slice(0, 3)).toEqual(first.days.slice(0, 3));
        // Schon gekochte Reste (Kochtag vor heute) bleiben mit gleicher Portion.
        for (const day of second.days.filter((d) => d.date >= today)) {
          for (const meal of day.meals.filter((m) => m.fixed)) {
            const old = first.days
              .find((d) => d.date === day.date)
              ?.meals.find((m) => m.slot === meal.slot);
            expect(old?.recipeId).toBe(meal.recipeId);
            expect(old?.factor).toBe(meal.factor);
            expect(meal.cookDate < today).toBe(true);
          }
        }
      }
    }
  });
});

describe('Eigenschaftstest: kein ausgeschlossenes Rezept erscheint im Plan', () => {
  it('Erdnuss, Schwangerschaft, Schwein, „mag ich nicht“ – über viele Profile', () => {
    const rnd = seededRandom(4711);
    let mealsChecked = 0;
    for (let i = 0; i < 80; i += 1) {
      const profile = randomProfile(rnd);
      const pregnant = rnd() < 0.4;
      const targets = nutritionTargetsForWeek(
        inputs({
          today: SUNDAY_BEFORE,
          sex: 'female',
          healthFlags: pregnant ? { flags: ['pregnancy', 'conservative_plan'] } : { flags: [] },
          mealsPerDay: 1 + (i % 8),
        }),
        MONDAY,
      );
      const plan = build(targets, profile, { variant: i });
      expect(exclusionViolations(plan, targets, profile), `Fall ${i}`).toEqual([]);
      mealsChecked += plan.days.reduce((n, d) => n + d.meals.length, 0);
    }
    expect(mealsChecked).toBeGreaterThan(500);
  });

  it('feste Fälle: Erdnuss-Unverträglichkeit, Schwangerschaft, eats_pork = false, Pilze „mag ich nicht“', () => {
    const cases: { profile: MealPlanProfileInput; pregnant: boolean; forbidden: string[] }[] = [
      {
        profile: { diet: 'vegan', intolerances: ['peanuts'] },
        pregnant: false,
        forbidden: ['erdnuss-banane', 'tofu-erdnuss-curry'],
      },
      {
        profile: { diet: 'omnivore', eatsPork: true },
        pregnant: true,
        forbidden: [
          'mascarponecreme-roh',
          'brot-raeucherlachs',
          'salami-brot',
          'lachs-reis-annahme',
        ],
      },
      {
        profile: { diet: 'omnivore', eatsPork: false },
        pregnant: false,
        forbidden: ['hack-spaghetti', 'salami-brot', 'milch-gelee'],
      },
      {
        profile: { diet: 'vegetarian', dislikes: ['mushrooms'] },
        pregnant: false,
        forbidden: ['omelett-champignons', 'champignon-reis'],
      },
    ];
    for (const c of cases) {
      for (const mealsPerDay of [1, 3, 8]) {
        const targets = nutritionTargetsForWeek(
          inputs({
            today: SUNDAY_BEFORE,
            sex: 'female',
            mealsPerDay,
            healthFlags: c.pregnant ? { flags: ['pregnancy', 'conservative_plan'] } : { flags: [] },
          }),
          MONDAY,
        );
        for (let variant = 0; variant < 4; variant += 1) {
          const plan = build(targets, c.profile, { variant });
          const used = plan.days.flatMap((d) => d.meals.map((m) => m.recipeId));
          expect(used.filter((id) => c.forbidden.includes(id))).toEqual([]);
          expect(exclusionViolations(plan, targets, c.profile)).toEqual([]);
        }
      }
    }
  });
});

describe('Grenzfälle', () => {
  const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };

  it('deterministisch: gleiche Eingabe → gleicher Plan; andere Variante → andere Auswahl', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4 }),
      MONDAY,
    );
    const a = build(targets, omni);
    expect(build(targets, omni)).toEqual(a);
    const ids = (p: MealPlanWeek) => p.days.flatMap((d) => d.meals.map((m) => m.recipeId)).join();
    const others = [1, 2, 3, 4].map((variant) => ids(build(targets, omni, { variant })));
    expect(others.some((o) => o !== ids(a))).toBe(true);
  });

  it('1 vs. 7 Trainingstage: Trainingstag mit mehr Energie im Plan als Ruhetag', () => {
    const one = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3, sessions: [run('2026-10-14', 90)] }),
      MONDAY,
    );
    const plan = build(one, omni);
    const kcal = (date: string) => plan.days.find((d) => d.date === date)?.totals.kcal ?? 0;
    expect(kcal('2026-10-14')).toBeGreaterThan(kcal('2026-10-13'));
    const seven = nutritionTargetsForWeek(
      inputs({
        today: SUNDAY_BEFORE,
        mealsPerDay: 3,
        sessions: Array.from({ length: 7 }, (_, d) => run(`2026-10-${12 + d}`, 240)),
      }),
      MONDAY,
    );
    const busy = build(seven, omni);
    expect(bandProblems(busy, seven)).toEqual([]);
    expect(busy.days.every((d) => d.totals.kcal > 2500)).toBe(true);
  });

  it('1–8 Mahlzeiten: Plätze wie im Layout (+ höchstens 2 Ergänzungen), Rolle vor/nach dem Training', () => {
    for (let mealsPerDay = 1; mealsPerDay <= 8; mealsPerDay += 1) {
      const targets = nutritionTargetsForWeek(
        inputs({
          today: SUNDAY_BEFORE,
          mealsPerDay,
          trainingTime: 'evening',
          sessions: [session('2026-10-13')],
        }),
        MONDAY,
      );
      const plan = build(targets, omni);
      expect(bandProblems(plan, targets)).toEqual([]);
      for (const day of plan.days) {
        const regular = day.meals.filter((m) => !m.isFill);
        expect(regular.length + day.emptySlots.length).toBe(mealsPerDay);
        expect(day.meals.filter((m) => m.isFill).length).toBeLessThanOrEqual(2);
      }
      const tuesday = plan.days[1];
      if (mealsPerDay >= 2) {
        // Abends trainiert: Abendessen ist die Mahlzeit nach dem Training.
        expect(tuesday?.meals.find((m) => m.slot === 'dinner')?.role).toBe('post');
      }
    }
  });

  it('1 Mahlzeit, sehr großer Bedarf: Ergänzungs-Snacks, sonst below_floor mit Hinweis (nie still darunter)', () => {
    const targets = nutritionTargetsForWeek(
      inputs({
        today: SUNDAY_BEFORE,
        mealsPerDay: 1,
        activityLevel: 'very_active',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 250, weightKg: 300 }],
      }),
      MONDAY,
    );
    const plan = build(targets, omni);
    expect(bandProblems(plan, targets)).toEqual([]);
    for (const day of plan.days) {
      expect(day.status).toBe('below_floor');
      expect(day.notices).toContain('day_below_floor');
      expect(day.meals.filter((m) => m.isFill)).toHaveLength(2);
      expect(day.meals.every((m) => m.factor === PORTION_SCALE_LIMITS.max)).toBe(true);
    }
  });

  it('sehr kleiner Bedarf (30 kg, 8 Mahlzeiten): nie über der Obergrenze, ggf. Mahlzeit gestrichen', () => {
    const targets = nutritionTargetsForWeek(
      inputs({
        today: SUNDAY_BEFORE,
        sex: 'female',
        mealsPerDay: 8,
        goalType: 'fat_loss',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 150, weightKg: 30 }],
      }),
      MONDAY,
    );
    const plan = build(targets, { diet: 'omnivore', eatsPork: true });
    expect(bandProblems(plan, targets)).toEqual([]);
    expect(plan.days.every((d) => d.status === 'complete')).toBe(true);
  });

  it('no_targets (Schwangerschaft): Faktor 1, keine Zielsummen, Hinweis; Ergänzungs-Snack unter 1.800 kcal', () => {
    const targets = nutritionTargetsForWeek(
      inputs({
        today: SUNDAY_BEFORE,
        sex: 'female',
        mealsPerDay: 2,
        healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
      }),
      MONDAY,
    );
    const plan = build(targets, omni);
    expect(plan.usesHealthData).toBe(true);
    for (const day of plan.days) {
      expect(day.status).toBe('no_targets');
      expect(day.band).toBeNull();
      expect(day.notices).toContain('no_targets_portions');
      expect(day.meals.every((m) => m.factor === 1)).toBe(true);
      expect(day.meals.filter((m) => m.isFill).length).toBeLessThanOrEqual(1);
    }
    expect(bandProblems(plan, targets)).toEqual([]);
  });

  it('no_targets ohne Einwilligung: kein Gesundheitsdatum, solange keine Unverträglichkeit gefiltert wird', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, healthDataConsent: false, sex: 'male' }),
      MONDAY,
    );
    expect(build(targets, omni).usesHealthData).toBe(false);
    expect(build(targets, { ...omni, intolerances: ['gluten'] }).usesHealthData).toBe(true);
  });

  it('maintenance_only (kein Check, weiblich): Band ohne Defizit eingehalten, keine Schwangerschafts-Rezepte', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, sex: 'female', healthFlags: null, goalType: 'fat_loss' }),
      MONDAY,
    );
    expect(targets.days.every((d) => d.mode === 'maintenance_only')).toBe(true);
    const plan = build(targets, omni);
    expect(bandProblems(plan, targets)).toEqual([]);
    expect(exclusionViolations(plan, targets, omni)).toEqual([]);
    for (const day of plan.days) {
      if (day.status === 'complete') {
        expect(day.totals.kcal).toBeGreaterThanOrEqual((targets.days[0]?.tdeeKcal ?? 0) - 1);
      }
    }
  });

  it('keine passenden Rezepte: Plätze leer mit Grund, Tag below_floor, kein Ersatz, der etwas verletzt', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }),
      MONDAY,
    );
    const empty = build(targets, omni, { recipes: [] });
    for (const day of empty.days) {
      expect(day.meals).toEqual([]);
      expect(day.status).toBe('below_floor');
      expect(day.emptySlots.map((e) => e.slot)).toEqual(['breakfast', 'dinner', 'lunch']);
      expect(day.emptySlots.every((e) => e.reasons.includes('meal_type'))).toBe(true);
      expect(day.notices).toEqual(
        expect.arrayContaining(['day_below_floor', 'no_candidates_for_slot']),
      );
    }
    // Vegan + Gluten + Soja: Frühstück fehlt, und der Grund wird benannt.
    const strict = build(targets, { diet: 'vegan', intolerances: ['gluten', 'soy'] });
    const breakfast = strict.days[0]?.emptySlots.find((e) => e.slot === 'breakfast');
    expect(breakfast?.reasons).toEqual(expect.arrayContaining(['diet', 'intolerance']));
  });

  it('Wiederholungsgrenzen: Hauptgericht ≤ 2×/Woche und nie an Folgetagen, Frühstück ≤ 3×', () => {
    for (let variant = 0; variant < 6; variant += 1) {
      const targets = nutritionTargetsForWeek(
        inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }),
        MONDAY,
      );
      const plan = build(targets, omni, { variant });
      const uses = new Map<string, number[]>();
      plan.days.forEach((day, i) =>
        day.meals
          .filter((m) => !m.isFill && m.prepKind === 'fresh')
          .forEach((m) => {
            uses.set(`${m.slot === 'breakfast' ? 'b' : 'm'}|${m.recipeId}`, [
              ...(uses.get(`${m.slot === 'breakfast' ? 'b' : 'm'}|${m.recipeId}`) ?? []),
              i,
            ]);
          }),
      );
      if (plan.days.some((d) => d.notices.includes('recipe_repeated'))) continue;
      for (const [key, days] of uses) {
        if (key.startsWith('m|')) {
          expect(days.length, key).toBeLessThanOrEqual(2);
          expect(
            days.some((d, j) => j > 0 && d - (days[j - 1] as number) <= 1),
            key,
          ).toBe(false);
        } else {
          expect(days.length, key).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('Entwürfe werden gekennzeichnet (K6)', () => {
    const targets = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE }), MONDAY);
    expect(build(targets, omni).notices).toEqual(['drafts_used', 'drafts_allergens_unreviewed']);
  });
});

describe('Meal-Prep (6.4, W15)', () => {
  it('W15: 1 Kochtag ohne einfrierbaren Kandidaten → Tage jenseits der Haltbarkeit frisch gekocht', () => {
    // Vegan ohne Erdnuss und Gluten: nur Tofu-Paprika und Champignon-Reis (Reis → 1 Tag, nicht einfrierbar).
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }),
      MONDAY,
    );
    const profile: MealPlanProfileInput = {
      diet: 'vegan',
      intolerances: ['peanuts', 'gluten'],
      cookingMode: 'meal_prep',
      mealprepDays: 1,
    };
    const plan = build(targets, profile);
    const lunches = plan.days.map((d) => d.meals.find((m) => m.slot === 'lunch'));
    expect(lunches[0]).toMatchObject({
      prepKind: 'leftover',
      storage: 'fridge',
      cookDate: SUNDAY_BEFORE,
    });
    for (const lunch of lunches.slice(1)) {
      expect(lunch).toMatchObject({ prepKind: 'fresh', storage: null });
    }
    expect(plan.days[1]?.notices).toContain('meal_prep_fresh_days');
    expect(bandProblems(plan, targets)).toEqual([]);
  });

  it('einfrierbares Gericht (Reis/Hack 1 Tag): ab Tag 2 eingefroren, nie länger als R9 im Kühlschrank', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 2 }),
      MONDAY,
    );
    const plan = build(targets, {
      diet: 'omnivore',
      eatsPork: true,
      cookingMode: 'meal_prep',
      mealprepDays: 1,
    });
    expect(bandProblems(plan, targets)).toEqual([]);
    const lunches = plan.days.map((d) => d.meals.find((m) => m.slot === 'lunch'));
    expect(lunches[0]?.storage).toBe('fridge');
    expect(lunches.slice(1).every((m) => m?.storage === 'freeze')).toBe(true);
    expect(plan.days[1]?.notices).toContain('meal_prep_freeze');
    expect(new Set(lunches.map((m) => m?.recipeId)).size).toBe(1);
  });

  it('mehrere Kochtermine wechseln das Gericht', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }),
      MONDAY,
    );
    const plan = build(targets, {
      diet: 'omnivore',
      eatsPork: true,
      cookingMode: 'meal_prep',
      mealprepDays: 2,
    });
    const monday = plan.days[0]?.meals.find((m) => m.slot === 'lunch');
    const wednesday = plan.days[2]?.meals.find((m) => m.slot === 'lunch');
    expect(wednesday?.prepKind).toBe('cook');
    expect(wednesday?.recipeId).not.toBe(monday?.recipeId);
  });
});

describe('Rezept tauschen und vergangene Tage (6.3 Nr. 7)', () => {
  const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
  const targets = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }), MONDAY);
  const base = { targets, profile: omni, recipes: N3_RECIPES, foods: N3_FOODS, allowDrafts: true };

  it('Tausch: neues Rezept, das in der Woche noch nicht vorkommt; Tag erneut im Band', () => {
    // Plan ohne zwei Hauptgerichte, damit es noch nicht verwendete Kandidaten gibt.
    const plan = build(targets, omni, {
      recipes: N3_RECIPES.filter((r) => r.id !== 'lachs-reis' && r.id !== 'champignon-reis'),
    });
    const before = plan.days[2]?.meals.find((m) => m.slot === 'dinner');
    const result = swapMealRecipe(
      plan,
      { date: '2026-10-14', slot: 'dinner' },
      { ...base, today: SUNDAY_BEFORE },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.plan.days[2]?.meals.find((m) => m.slot === 'dinner');
    expect(after?.recipeId).not.toBe(before?.recipeId);
    const weekIds = plan.days.flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(weekIds).not.toContain(after?.recipeId);
    expect(after?.prepKind).toBe('fresh');
    expect(bandProblems(result.plan, targets)).toEqual([]);
    // Andere Tage unverändert.
    expect(result.plan.days.filter((_, i) => i !== 2)).toEqual(plan.days.filter((_, i) => i !== 2));
  });

  it('Tausch an einem vergangenen Tag geht nicht', () => {
    const plan = build(targets, omni);
    expect(
      swapMealRecipe(
        plan,
        { date: '2026-10-12', slot: 'dinner' },
        { ...base, today: '2026-10-14' },
      ),
    ).toEqual({ ok: false, reason: 'past_day' });
  });

  it('Neuplanung mit bisherigem Plan: vergangene Tage bleiben, auch wenn sich Vorlieben ändern', () => {
    const plan = build(targets, omni);
    const today = '2026-10-15';
    const next = build(targets, { diet: 'vegan' }, { today, existingPlan: plan });
    expect(next.days.slice(0, 3)).toEqual(plan.days.slice(0, 3));
    expect(exclusionViolations(next, targets, { diet: 'vegan' }, N3_RECIPES, today)).toEqual([]);
  });
});

describe('mealPlanPayloadSchema', () => {
  it('Payload ohne Gesundheitsdaten; Datum außerhalb der Woche und Doppelbelegung → Fehler', () => {
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4 }),
      MONDAY,
    );
    const plan = build(targets, { diet: 'omnivore', eatsPork: true, intolerances: ['peanuts'] });
    const inputsPayload = {
      diet: 'omnivore',
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
      mealprep_slots: 'lunch',
    } as const;
    const payload = toMealPlanPayload(plan, inputsPayload);
    expect(payload.items.length).toBe(plan.days.reduce((n, d) => n + d.meals.length, 0));
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(/peanuts|intoleran|weight|pregnan|eats_pork/i);
    const item = payload.items[0];
    expect(() =>
      toMealPlanPayload(
        {
          ...plan,
          days: [{ ...(plan.days[0] as MealPlanWeek['days'][number]), date: '2026-10-30' }],
        },
        inputsPayload,
      ),
    ).toThrow();
    expect(item).toBeDefined();
    expect(() =>
      toMealPlanPayload(
        {
          ...plan,
          days: [
            plan.days[0] as MealPlanWeek['days'][number],
            plan.days[0] as MealPlanWeek['days'][number],
          ],
        },
        inputsPayload,
      ),
    ).toThrow();
  });
});

describe('Wächter N3: feste Reste, Tauschen ohne Verschlechterung, keine verwaisten Reste', () => {
  const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
  const THURSDAY = '2026-10-15';

  it('S5a: feste Reste aus dem bisherigen Plan + Schwangerschaft → nicht mehr serviert', () => {
    // Nur Lachs mit unbestätigter Erhitzung ist Meal-Prep-geeignet: Mittwoch gekocht, Donnerstag Rest.
    const recipes = N3_RECIPES.filter((r) =>
      ['lachs-reis-annahme', 'overnight-oats', 'omelett-champignons', 'banane-pur'].includes(r.id),
    );
    const profile: MealPlanProfileInput = { ...omni, cookingMode: 'meal_prep', mealprepDays: 2 };
    const before = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, sex: 'female', mealsPerDay: 3, healthFlags: { flags: [] } }),
      MONDAY,
    );
    const first = build(before, profile, { recipes });
    const thursdayLunch = first.days[3]?.meals.find((m) => m.slot === 'lunch');
    expect(thursdayLunch).toMatchObject({
      recipeId: 'lachs-reis-annahme',
      prepKind: 'leftover',
      cookDate: '2026-10-14',
    });
    const pregnant = nutritionTargetsForWeek(
      inputs({
        today: THURSDAY,
        sex: 'female',
        mealsPerDay: 3,
        healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
      }),
      MONDAY,
    );
    const next = build(pregnant, profile, { recipes, today: THURSDAY, existingPlan: first });
    const used = next.days.slice(3).flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(used).not.toContain('lachs-reis-annahme');
    expect(exclusionViolations(next, pregnant, profile, recipes, THURSDAY)).toEqual([]);
  });

  const targets = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE, mealsPerDay: 3 }), MONDAY);
  const base = { targets, profile: omni, foods: N3_FOODS, allowDrafts: true, today: SUNDAY_BEFORE };
  const riesig = makeRecipe({
    id: 'riesen-portion',
    title_de: 'Riesen-Portion',
    meal_types: ['main'],
    ingredients: [ing('olivenoel', 30, 'tbsp'), ing('reis', 1000, 'g')],
  });
  const winzig = (id: string) =>
    makeRecipe({
      id,
      title_de: `Winziges Gericht ${id}`,
      meal_types: ['main'],
      ingredients: [ing('paprika', 0.5, 'piece')],
    });

  it('S3: Tausch, der den Tag über die Obergrenze höbe, wird nicht angeboten (auch bei below_floor-Tag)', () => {
    const one = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE, mealsPerDay: 1 }), MONDAY);
    const tiny = [winzig('winzig-a'), winzig('winzig-b')];
    const plan = build(one, omni, { recipes: tiny });
    expect(plan.days[2]?.status).toBe('below_floor');
    const result = swapMealRecipe(
      plan,
      { date: '2026-10-14', slot: 'main' },
      { ...base, targets: one, recipes: [...tiny, riesig] },
    );
    expect(result).toEqual({ ok: false, reason: 'no_alternative' });
  });

  it('S3: vollständiger Tag bleibt vollständig – Kandidat, der below_floor machen würde, wird nicht angeboten', () => {
    const two = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE, mealsPerDay: 2 }), MONDAY);
    // Ohne `no_cook`-Rezepte gibt es keine Ergänzungs-Snacks.
    const mains = N3_RECIPES.filter((r) => !r.no_cook);
    const plan = build(two, omni, { recipes: mains });
    expect(plan.days[2]?.status).toBe('complete');
    const used = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
    const pool = [...mains.filter((r) => used.has(r.id)), winzig('winzig-a')];
    const result = swapMealRecipe(
      plan,
      { date: '2026-10-14', slot: 'dinner' },
      { ...base, targets: two, recipes: pool },
    );
    expect(result).toEqual({ ok: false, reason: 'no_alternative' });
  });

  it('S4: andere Mahlzeit des Tages besteht den Filter nicht mehr → Meldung statt stillem Wegfall', () => {
    const plan = build(targets, omni, { recipes: N3_RECIPES.filter((r) => r.id !== 'lachs-reis') });
    const wednesday = plan.days[2];
    const other = wednesday?.meals.find((m) => m.slot === 'breakfast');
    const blocked = N3_RECIPES.map((r) =>
      r.id === other?.recipeId ? { ...r, version: r.version + 1 } : r,
    );
    expect(
      swapMealRecipe(plan, { date: '2026-10-14', slot: 'dinner' }, { ...base, recipes: blocked }),
    ).toEqual({ ok: false, reason: 'replan_needed' });
  });

  it('S2: Tausch einer Kochtag-Mahlzeit → Reste an den Folgetagen werden frisch gekocht', () => {
    const profile: MealPlanProfileInput = { ...omni, cookingMode: 'meal_prep', mealprepDays: 2 };
    const plan = build(targets, profile, {
      recipes: N3_RECIPES.filter((r) => r.id !== 'lachs-reis'),
    });
    const cook = plan.days[2]?.meals.find((m) => m.slot === 'lunch');
    expect(cook?.prepKind).toBe('cook');
    const later = plan.days
      .slice(3)
      .filter((d) =>
        d.meals.some(
          (m) => m.slot === 'lunch' && m.prepKind === 'leftover' && m.cookDate === '2026-10-14',
        ),
      );
    expect(later.length).toBeGreaterThan(0);
    const result = swapMealRecipe(
      plan,
      { date: '2026-10-14', slot: 'lunch' },
      { ...base, profile, recipes: N3_RECIPES },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const day of result.plan.days.slice(3)) {
      const lunch = day.meals.find((m) => m.slot === 'lunch');
      if (lunch?.recipeId === cook?.recipeId) {
        expect(lunch).toMatchObject({ prepKind: 'fresh', cookDate: day.date, storage: null });
        expect(day.notices).toContain('meal_prep_fresh_days');
      }
    }
    expect(bandProblems(result.plan, targets)).toEqual([]);
  });
});

describe('Wächter N3 NB1: frischer Plan ohne Neuplanung, optionale Zutaten statt Mahlzeit weglassen', () => {
  it('Eigenschaft: needsAutomaticReplan(buildMealPlanWeek(x), x) = false – schmale Bänder (30–45 kg, Muskelaufbau)', () => {
    let plans = 0;
    let removed = 0;
    let omittedForCeiling = 0;
    for (const weightKg of [30, 35, 40, 45]) {
      for (const heightCm of [140, 150]) {
        for (const birthDate of ['1990-01-01', '2009-01-01', '1945-01-01']) {
          for (let mealsPerDay = 1; mealsPerDay <= 8; mealsPerDay += 1) {
            for (const diet of ['omnivore', 'vegetarian', 'vegan'] as const) {
              let targets: NutritionWeekTargets;
              try {
                targets = nutritionTargetsForWeek(
                  inputs({
                    today: SUNDAY_BEFORE,
                    sex: null,
                    birthDate,
                    mealsPerDay,
                    goalType: 'muscle_gain',
                    bodyMetricsRows: [{ measuredOn: '2026-10-01', weightKg, heightCm }],
                  }),
                  MONDAY,
                );
              } catch {
                continue;
              }
              const profile: MealPlanProfileInput = {
                diet,
                eatsPork: diet === 'omnivore' ? true : null,
              };
              const data = {
                targets,
                profile,
                recipes: N3_RECIPES,
                foods: N3_FOODS,
                allowDrafts: true,
                today: SUNDAY_BEFORE,
              };
              const plan = build(targets, profile);
              plans += 1;
              const context = `${weightKg} kg ${heightCm} cm ${birthDate} ${mealsPerDay} Mahlzeiten ${diet}`;
              expect(needsAutomaticReplan(plan, data), context).toEqual({
                needed: false,
                reasons: [],
                fromDate: null,
              });
              expect(bandProblems(plan, targets), context).toEqual([]);
              for (const day of plan.days) {
                if (day.notices.includes('meal_removed_ceiling')) removed += 1;
                if (day.notices.includes('optional_omitted_ceiling')) omittedForCeiling += 1;
              }
            }
          }
        }
      }
    }
    expect(plans).toBeGreaterThan(400);
    // Gleich viele Tage mit gestrichener Mahlzeit wie ohne Mitzählen optionaler Zutaten (gemessen 227); ohne das
    // Weglassen optionaler Zutaten (NB1) waren es deutlich mehr – das darf nicht wieder steigen.
    expect(removed).toBeLessThanOrEqual(227);
    expect(omittedForCeiling).toBeGreaterThan(0);
  }, 60_000);

  it('Weglassen der optionalen Zutat rettet die Mahlzeit (statt sie zu streichen)', () => {
    const nudeln = makeRecipe({
      id: 'nudeln-optional-nuss',
      title_de: 'Nudeln mit optionalen Erdnüssen',
      meal_types: ['main'],
      ingredients: [ing('spaghetti', 420, 'g'), ing('erdnuesse', 100, 'g', { optional: true })],
    });
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 1 }),
      MONDAY,
    );
    const plan = build(targets, { diet: 'vegan' }, { recipes: [nudeln] });
    for (const day of plan.days) {
      const meal = day.meals.find((m) => m.slot === 'main');
      expect(meal?.recipeId).toBe('nudeln-optional-nuss');
      expect(meal?.omittedOptional).toEqual([{ index: 1, foodId: 'erdnuesse' }]);
      expect(meal?.optionalKcal).toBe(0);
      expect(day.status).toBe('complete');
      expect(day.notices).toContain('optional_omitted_ceiling');
      expect(day.notices).not.toContain('meal_removed_ceiling');
    }
    const data = {
      targets,
      profile: { diet: 'vegan' as const },
      recipes: [nudeln],
      foods: N3_FOODS,
      allowDrafts: true,
      today: SUNDAY_BEFORE,
    };
    expect(needsAutomaticReplan(plan, data).needed).toBe(false);
    expect(bandProblems(plan, targets)).toEqual([]);
  });

  it('below_floor-Tag mit optionaler Zutat über der Obergrenze: Zutat weggelassen, keine Neuplanungs-Schleife', () => {
    const nudeln = makeRecipe({
      id: 'kleine-nudeln-nuss',
      title_de: 'Kleine Nudeln mit optionalen Erdnüssen',
      meal_types: ['main'],
      ingredients: [ing('spaghetti', 150, 'g'), ing('erdnuesse', 150, 'g', { optional: true })],
    });
    const targets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 1 }),
      MONDAY,
    );
    const plan = build(targets, { diet: 'vegan' }, { recipes: [nudeln] });
    const data = {
      targets,
      profile: { diet: 'vegan' as const },
      recipes: [nudeln],
      foods: N3_FOODS,
      allowDrafts: true,
      today: SUNDAY_BEFORE,
    };
    for (const day of plan.days) {
      expect(day.status).toBe('below_floor');
      expect(day.meals[0]?.recipeId).toBe('kleine-nudeln-nuss');
      expect(day.notices).toContain('optional_omitted_ceiling');
    }
    expect(needsAutomaticReplan(plan, data).needed).toBe(false);
    // Neuplanung ab Donnerstag erzeugt wieder einen Plan ohne Neuplanungsbedarf.
    const again = build(
      targets,
      { diet: 'vegan' },
      { recipes: [nudeln], today: '2026-10-15', existingPlan: plan },
    );
    expect(needsAutomaticReplan(again, { ...data, today: '2026-10-15' }).needed).toBe(false);
  });
});
