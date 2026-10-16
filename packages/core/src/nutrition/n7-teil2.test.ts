/**
 * Etappe N7 Teil 2 (docs/PLAN-PHASE-5.md „Umsetzungsstand N7 Teil 2“): Essensplan aus den Datenbank-Zeilen ohne
 * Planband/`safetyKey` (`mealPlanWeekFromRecord`, `resolveMealPlanRecord`, G-N7-1, Wächter N5a S4, N7 H5/H9),
 * Löschfrist (`MEAL_PLAN_RETENTION_WEEKS`, G-N7-2), Mindest-Plausibilität der Tageskalorien wie auf dem Server
 * (`serverDayKcalFloor`, `mealPlanDaysBelowFloor`, G-W3) und die Einkaufsliste aus der Datenbank.
 * Grenzfälle: sehr leicht/schwer, 16/95 Jahre, divers, Körperfett 90/91 Tage, Schwangerschaft, keine Einwilligung,
 * 1 vs. 8 Mahlzeiten, vergangene Tage, Rezept archiviert, Modus gewechselt.
 */
import { describe, expect, it } from 'vitest';

import { ageInYears } from '../age';
import {
  MEAL_PLAN_DAY_KCAL_CHECK,
  MEAL_PLAN_ENGINE_VERSION,
  MEAL_PLAN_RETENTION_WEEKS,
  MIN_INTAKE_RELATIVE_TO_BMR,
} from '../constants';
import type { Recipe } from '../content/recipe-schema';
import { addDays } from '../dates';
import { DEMO_SUBSTITUTIONS, withDemoRoles } from '../demo-nutrition';
import { dayEnergy } from './energy';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { type MealPlanPayload, toMealPlanPayload } from './meal-plan-payload';
import {
  mealPlanPayloadMatches,
  type MealPlanRecord,
  mealPlanWeekFromRecord,
  RECONSTRUCTED_INCOMPLETE_KEY,
  parseMealPlanRecord,
  resolveMealPlanRecord,
} from './meal-plan-record';
import {
  mealPlanRetentionStart,
  nutritionWeekRetained,
  resolveMealPlanWeek,
} from './meal-plan-store';
import {
  mealPlanDaysBelowFloor,
  serverDayKcalFloor,
  type ServerDayKcalFloorInput,
} from './plausibility';
import type { MealPlanProfileInput, NutritionInputsInput } from './schemas';
import { shoppingListFromPayload, toShoppingListPayload } from './shopping-list-payload';
import { newShoppingList } from './shopping-list-store';
import { applyIngredientSwap } from './substitute';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';
import type { MealSlotId } from './timing';

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

const SUNDAY_BEFORE = addDays(MONDAY, -1);
const THURSDAY = addDays(MONDAY, 3);
const RECIPES = N3_RECIPES.map(withDemoRoles);
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const PAYLOAD_INPUTS: MealPlanPayload['inputs'] = {
  diet: 'omnivore',
  meals_per_day: 4,
  cooking_mode: 'daily',
  mealprep_days: null,
  mealprep_slots: 'lunch',
};

function input(
  options: {
    readonly overrides?: Partial<NutritionInputsInput>;
    readonly profile?: MealPlanProfileInput;
    readonly today?: string;
    readonly recipes?: readonly Recipe[];
    readonly meals?: number;
  } = {},
): PlanInput {
  const today = options.today ?? SUNDAY_BEFORE;
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today, mealsPerDay: options.meals ?? 4, ...options.overrides }),
      MONDAY,
    ),
    profile: options.profile ?? omni,
    recipes: options.recipes ?? RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
    substitutions: DEMO_SUBSTITUTIONS,
  };
}

/** Wie aus der Datenbank: Payload (gerundet) + uses_health_data, JSON hin und zurück. */
function asRecord(plan: MealPlanWeek, meals = 4): MealPlanRecord {
  const payload = toMealPlanPayload(plan, { ...PAYLOAD_INPUTS, meals_per_day: meals });
  return JSON.parse(
    JSON.stringify({ usesHealthData: plan.usesHealthData, payload }),
  ) as MealPlanRecord;
}

function mealsOf(plan: MealPlanWeek) {
  return plan.days.map((d) => d.meals);
}

describe('mealPlanWeekFromRecord: Plan aus den Zeilen (G-N7-1)', () => {
  it('Rundweg: Mahlzeiten, Summen, Band und Schlüssel wie der Plan der Engine – 1, 4 und 8 Mahlzeiten', () => {
    for (const meals of [1, 4, 8]) {
      const i = input({ meals });
      const plan = buildMealPlanWeek({ ...i, variant: 0 });
      const rebuilt = mealPlanWeekFromRecord(asRecord(plan, meals), i);
      expect(rebuilt).not.toBeNull();
      if (rebuilt === null) return;
      expect(rebuilt.unavailable).toEqual([]);
      expect(mealsOf(rebuilt.plan)).toEqual(mealsOf(plan));
      rebuilt.plan.days.forEach((day, index) => {
        const original = plan.days[index];
        expect(day.date).toBe(original?.date);
        expect(day.mode).toBe(original?.mode);
        expect(day.status).toBe(original?.status);
        expect(day.band).toEqual(original?.band);
        expect(day.safetyKey).toBe(original?.safetyKey);
        expect(day.totals.kcal).toBeCloseTo(original?.totals.kcal ?? -1, 6);
        expect(day.emptySlots).toEqual([]);
      });
      expect(rebuilt.plan.usesHealthData).toBe(plan.usesHealthData);
      expect(rebuilt.plan.engineVersion).toBe(MEAL_PLAN_ENGINE_VERSION);
      const resolved = resolveMealPlanRecord(asRecord(plan, meals), i);
      expect(resolved.action).toBe('stored');
      expect(resolved.unavailable).toEqual([]);
      expect(mealPlanPayloadMatches(rebuilt.plan, asRecord(plan, meals).payload)).toBe(true);
    }
  });

  it('Zutaten-Tausch (N9) und no_targets bleiben beim Rundweg erhalten', () => {
    const recipes = RECIPES.filter(
      (r) => !r.meal_types.includes('main') || r.id === 'tofu-paprika',
    );
    const i = input({ recipes });
    const plan = buildMealPlanWeek({ ...i, variant: 0 });
    const day = plan.days.find(
      (d) => d.date >= MONDAY && d.meals.some((m) => m.recipeId === 'tofu-paprika'),
    );
    const meal = day?.meals.find((m) => m.recipeId === 'tofu-paprika');
    const index =
      recipes
        .find((r) => r.id === 'tofu-paprika')
        ?.ingredients.findIndex((x) => x.food_id === 'tofu') ?? -1;
    if (!day || !meal) throw new Error('Mahlzeit erwartet');
    const swapped = applyIngredientSwap(
      plan,
      { date: day.date, slot: meal.slot as MealSlotId, index },
      'haehnchenbrust',
      i,
    );
    if (!swapped.ok) throw new Error('Tausch erwartet');
    const record = asRecord(swapped.plan);
    expect(record.usesHealthData).toBe(true);
    const resolved = resolveMealPlanRecord(record, i);
    expect(resolved.action).toBe('stored');
    expect(mealsOf(resolved.plan)).toEqual(mealsOf(swapped.plan));
    // Ohne Austausch-Tabelle passt die Mahlzeit nicht mehr → ab heute neu (H5, sichere Richtung).
    const without = resolveMealPlanRecord(record, { ...i, substitutions: [] });
    expect(without.action).toBe('replanned');

    const noTargets = input({ overrides: { healthDataConsent: false } });
    const plain = buildMealPlanWeek({ ...noTargets, variant: 0 });
    expect(plain.days.every((d) => d.status === 'no_targets')).toBe(true);
    const back = resolveMealPlanRecord(asRecord(plain), noTargets);
    expect(back.action).toBe('stored');
    expect(back.plan.days.every((d) => d.mode === 'no_targets' && d.band === null)).toBe(true);
  });

  it('Modus aus day_status: Plan ohne Ziele trifft auf Ziele (und umgekehrt) → ab heute neu (mode_changed)', () => {
    const noTargets = input({ overrides: { healthDataConsent: false }, today: THURSDAY });
    const full = input({ today: THURSDAY });
    const plain = buildMealPlanWeek({ ...noTargets, variant: 0 });
    // Rekonstruktion selbst: anderer Modus als die Ziele, Schlüssel passt nie (6.6 plant sicher neu).
    const rebuilt = mealPlanWeekFromRecord(asRecord(plain), full);
    expect(rebuilt?.plan.days.every((d) => d.mode === 'no_targets')).toBe(true);
    expect(rebuilt?.plan.days.every((d) => d.safetyKey === 'reconstructed:mode_changed')).toBe(
      true,
    );
    const resolved = resolveMealPlanRecord(asRecord(plain), full);
    expect(resolved.action).toBe('replanned');
    expect(resolved.action === 'replanned' && resolved.reasons).toContain('mode_changed');
    // Vergangene Tage bleiben, wie sie waren.
    resolved.plan.days
      .filter((d) => d.date < THURSDAY)
      .forEach((d) =>
        expect(d.meals).toEqual(plain.days.find((x) => x.date === d.date)?.meals ?? []),
      );
    resolved.plan.days
      .filter((d) => d.date >= THURSDAY)
      .forEach((d) => expect(d.mode).toBe('full'));
    const withTargets = buildMealPlanWeek({ ...full, variant: 0 });
    const back = resolveMealPlanRecord(asRecord(withTargets), noTargets);
    expect(back.action).toBe('replanned');
    expect(back.action === 'replanned' && back.reasons).toContain('mode_changed');
  });

  it('M1: Tag ab heute ohne Mahlzeiten oder mit below_floor → ab heute neu (caps_changed); vergangene leere Tage bleiben', () => {
    const i = input({ today: THURSDAY });
    const plan = buildMealPlanWeek({ ...i, variant: 0 });
    const FRIDAY = addDays(MONDAY, 4);
    const TUESDAY = addDays(MONDAY, 1);
    const base = asRecord(plan);
    const without = (dates: readonly string[]): MealPlanRecord => ({
      ...base,
      payload: {
        ...base.payload,
        items: base.payload.items.filter((x) => !dates.includes(x.date)),
      },
    });
    // Freitag leer (ab heute) → markiert, 6.6 plant neu und füllt ihn wieder.
    const rebuilt = mealPlanWeekFromRecord(without([FRIDAY]), i);
    expect(rebuilt?.plan.days.find((d) => d.date === FRIDAY)?.safetyKey).toBe(
      RECONSTRUCTED_INCOMPLETE_KEY,
    );
    const resolved = resolveMealPlanRecord(without([FRIDAY]), i);
    expect(resolved.action === 'replanned' && resolved.reasons).toContain('caps_changed');
    expect(resolved.plan.days.find((d) => d.date === FRIDAY)?.meals.length).toBeGreaterThan(0);
    // Dienstag leer (vergangen) → nicht markiert, kein Neuplanen nur deswegen.
    const past = mealPlanWeekFromRecord(without([TUESDAY]), i);
    expect(past?.plan.days.find((d) => d.date === TUESDAY)?.safetyKey).not.toBe(
      RECONSTRUCTED_INCOMPLETE_KEY,
    );
    expect(resolveMealPlanRecord(without([TUESDAY]), i).action).toBe('stored');
    // below_floor ab heute (z. B. von einer veränderten App behauptet) → markiert und neu geplant.
    const low: MealPlanRecord = {
      ...base,
      payload: {
        ...base.payload,
        items: base.payload.items.map((x) =>
          x.date === FRIDAY ? { ...x, day_status: 'below_floor' as const } : x,
        ),
      },
    };
    expect(
      mealPlanWeekFromRecord(low, i)?.plan.days.find((d) => d.date === FRIDAY)?.safetyKey,
    ).toBe(RECONSTRUCTED_INCOMPLETE_KEY);
    expect(resolveMealPlanRecord(low, i).action).toBe('replanned');
  });

  it('Schwangerschaft gesetzt: Rezepte mit pregnancy_caution fallen ab heute heraus (Filter wie 6.6)', () => {
    const before = input({ overrides: { sex: 'female' }, today: THURSDAY });
    const plan = buildMealPlanWeek({ ...before, variant: 0 });
    const after = input({
      overrides: { sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } },
      today: THURSDAY,
    });
    const resolved = resolveMealPlanRecord(asRecord(plan), after);
    expect(resolved.action).toBe('replanned');
    for (const day of resolved.plan.days.filter((d) => d.date >= THURSDAY)) {
      expect(day.mode).toBe('no_targets');
    }
  });

  it('nur Deckel geändert, Plan liegt weiter im Band → auf einem neuen Gerät kein Neuplanen (dokumentierter Unterschied)', () => {
    const before = input();
    // Gesundheits-Check fehlt jetzt: Defizit-Deckel 0,15 statt 0,25 – das Band verschiebt sich nur oben.
    const after = input({ overrides: { healthFlags: null } });
    expect(after.targets.days[0]?.deficitCap).not.toBe(before.targets.days[0]?.deficitCap);
    const plan = buildMealPlanWeek({ ...before, variant: 0 });
    // Testmodus (voller Plan mit safetyKey): caps_changed → neu geplant; aus der Datenbank: bleibt.
    expect(resolveMealPlanWeek(plan, after).action).toBe('replanned');
    expect(resolveMealPlanRecord(asRecord(plan), after).action).toBe('stored');
    const rebuilt = mealPlanWeekFromRecord(asRecord(plan), after);
    expect(rebuilt?.plan.days.map((d) => d.safetyKey)).not.toEqual(
      plan.days.map((d) => d.safetyKey),
    );
  });

  it('H9: Rezept nicht mehr verfügbar – vergangen nur als Hinweis, ab heute neu geplant', () => {
    const i = input({ today: THURSDAY });
    const plan = buildMealPlanWeek({ ...input({ today: SUNDAY_BEFORE }), variant: 0 });
    const pastMeal = plan.days.find((d) => d.date === MONDAY)?.meals[0];
    if (!pastMeal) throw new Error('Mahlzeit erwartet');
    // Archiviert = für Nutzer nicht lesbar: fehlt im Bestand.
    const missing = RECIPES.filter((r) => r.id !== pastMeal.recipeId);
    const resolved = resolveMealPlanRecord(asRecord(plan), { ...i, recipes: missing });
    expect(resolved.unavailable.length).toBeGreaterThan(0);
    expect(resolved.unavailable.every((m) => m.date < THURSDAY)).toBe(true);
    expect(resolved.unavailable).toContainEqual({
      date: MONDAY,
      slot: pastMeal.slot,
      titleDe: pastMeal.titleDe,
      isFill: pastMeal.isFill,
    });
    // Kommt das Rezept ab heute vor, wird ab heute neu geplant.
    const usedLater = plan.days.some(
      (d) => d.date >= THURSDAY && d.meals.some((m) => m.recipeId === pastMeal.recipeId),
    );
    expect(usedLater).toBe(true);
    expect(resolved.action).toBe('replanned');
    expect(resolved.action === 'replanned' && resolved.reasons).toEqual(['recipe_excluded']);
    for (const day of resolved.plan.days.filter((d) => d.date >= THURSDAY)) {
      expect(day.meals.some((m) => m.recipeId === pastMeal.recipeId)).toBe(false);
    }
    // Neue Version des Rezepts ab heute: ebenfalls ab heute neu.
    const bumped = RECIPES.map((r) =>
      r.id === pastMeal.recipeId ? { ...r, version: r.version + 1 } : r,
    );
    const next = resolveMealPlanRecord(asRecord(plan), { ...i, recipes: bumped });
    expect(next.plan.days.filter((d) => d.date >= THURSDAY).flatMap((d) => d.meals)).not.toEqual(
      [],
    );
  });

  it('H5: ungültige Zeilen (Zod), fremde Woche, andere Engine-Version, gemischter Tages-Status → neu erstellt', () => {
    const i = input();
    const plan = buildMealPlanWeek({ ...i, variant: 0 });
    const record = asRecord(plan);
    expect(parseMealPlanRecord({ ...record, extra: 1 })).toBeNull();
    expect(parseMealPlanRecord({ ...record, payload: { ...record.payload, shared: true } })).toBe(
      null,
    );
    const firstItem = record.payload.items[0];
    if (!firstItem) throw new Error('Mahlzeit erwartet');
    const badDate = {
      ...record,
      payload: {
        ...record.payload,
        items: [{ ...firstItem, date: addDays(MONDAY, 9) }, ...record.payload.items.slice(1)],
      },
    };
    expect(parseMealPlanRecord(badDate)).toBeNull();
    expect(resolveMealPlanRecord(badDate as MealPlanRecord, i).action).toBe('created');
    expect(
      resolveMealPlanRecord(
        { ...record, payload: { ...record.payload, week_start: addDays(MONDAY, 7) } },
        i,
      ).action,
    ).toBe('created');
    expect(
      mealPlanWeekFromRecord(
        {
          ...record,
          payload: { ...record.payload, engine_version: MEAL_PLAN_ENGINE_VERSION + 1 },
        } as MealPlanRecord,
        i,
      ),
    ).toBeNull();
    const sameDay = record.payload.items.filter((item) => item.date === MONDAY);
    expect(sameDay.length).toBeGreaterThanOrEqual(2);
    {
      const mixed = {
        ...record,
        payload: {
          ...record.payload,
          items: record.payload.items.map((item) =>
            item === sameDay[1] ? { ...item, day_status: 'no_targets' as const } : item,
          ),
        },
      };
      expect(mealPlanWeekFromRecord(mixed, i)).toBeNull();
    }
    expect(resolveMealPlanRecord(null, i).action).toBe('created');
  });

  it('veränderte Werte in der Datenbank zählen nicht: Nährwerte kommen immer aus Rezept und Faktor', () => {
    const i = input();
    const plan = buildMealPlanWeek({ ...i, variant: 0 });
    const record = asRecord(plan);
    const tampered = {
      ...record,
      payload: {
        ...record.payload,
        items: record.payload.items.map((item) => ({ ...item, kcal: 1 })),
      },
    };
    const rebuilt = mealPlanWeekFromRecord(tampered, i);
    expect(mealsOf(rebuilt?.plan as MealPlanWeek)).toEqual(mealsOf(plan));
    expect(mealPlanPayloadMatches(plan, tampered.payload)).toBe(false);
    expect(mealPlanPayloadMatches(plan, record.payload)).toBe(true);
    const otherVariant = { ...record.payload, variant: record.payload.variant + 1 };
    expect(mealPlanPayloadMatches(plan, otherVariant)).toBe(false);
  });
});

describe('Löschfrist (G-N7-2, MEAL_PLAN_RETENTION_WEEKS = 4)', () => {
  it('laufende Woche und vier Wochen davor bleiben; ältere werden gelöscht', () => {
    expect(MEAL_PLAN_RETENTION_WEEKS).toBe(4);
    for (const today of [MONDAY, THURSDAY, addDays(MONDAY, 6)]) {
      expect(mealPlanRetentionStart(today)).toBe(addDays(MONDAY, -28));
      expect(nutritionWeekRetained(MONDAY, today)).toBe(true);
      expect(nutritionWeekRetained(addDays(MONDAY, 7), today)).toBe(true);
      expect(nutritionWeekRetained(addDays(MONDAY, -28), today)).toBe(true);
      expect(nutritionWeekRetained(addDays(MONDAY, -35), today)).toBe(false);
    }
    // Sonntag gehört zur alten Woche, Montag beginnt die neue Frist.
    expect(nutritionWeekRetained(addDays(MONDAY, -28), addDays(MONDAY, 7))).toBe(false);
    expect(() => nutritionWeekRetained('kein Datum', MONDAY)).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------
// G-W3: Mindest-Plausibilität der Tageskalorien
// ---------------------------------------------------------------------------------------------------------

const BASE: ServerDayKcalFloorInput = {
  birthDate: '1990-01-01',
  sex: 'male',
  today: MONDAY,
  date: MONDAY,
  healthDataConsent: true,
  healthFlags: [],
  bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 }],
};

describe('serverDayKcalFloor = bmrForFloor der Engine (G-W3)', () => {
  it('gleiche Zahl wie dayEnergy().bmrForFloor × MIN_INTAKE_RELATIVE_TO_BMR – Eigenschaftstest (600 Personen)', () => {
    const rnd = seededRandom(7303);
    const sexes = ['male', 'female', 'diverse', null] as const;
    for (let n = 0; n < 600; n += 1) {
      const weightKg = Math.round((30 + rnd() * 270) * 10) / 10;
      const heightCm = Math.round(120 + rnd() * 110);
      const age = 16 + Math.floor(rnd() * 80);
      const birthDate = addDays(MONDAY, -Math.round(age * 365.25) - Math.floor(rnd() * 300));
      const sex = sexes[Math.floor(rnd() * sexes.length)] ?? null;
      const bodyFat =
        rnd() < 0.5
          ? {
              value: Math.round(5 + rnd() * 50),
              measuredOn: addDays(MONDAY, -Math.floor(rnd() * 120)),
            }
          : null;
      const date = addDays(MONDAY, Math.floor(rnd() * 7));
      const ageYears = ageInYears(birthDate, date);
      if (ageYears > 100) continue;
      const floor = serverDayKcalFloor({
        ...BASE,
        birthDate,
        sex,
        date,
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm, weightKg },
          ...(bodyFat ? [{ measuredOn: bodyFat.measuredOn, bodyFatPct: bodyFat.value }] : []),
        ],
      });
      const energy = dayEnergy({
        day: date,
        weightKg,
        heightCm,
        ageYears,
        sex,
        bodyFat,
        activityLevel: null,
        sessions: [],
      });
      expect(floor).toBeCloseTo(energy.bmrForFloor * MIN_INTAKE_RELATIVE_TO_BMR, 9);
    }
  });

  it('kein Grundumsatz (wie no_targets): ohne Einwilligung, Schwangerschaft, ohne Größe oder Gewicht', () => {
    expect(serverDayKcalFloor({ ...BASE, healthDataConsent: false })).toBeNull();
    expect(serverDayKcalFloor({ ...BASE, healthFlags: ['pregnancy'] })).toBeNull();
    expect(serverDayKcalFloor({ ...BASE, healthFlags: null })).not.toBeNull();
    expect(
      serverDayKcalFloor({ ...BASE, bodyMetricsRows: [{ measuredOn: MONDAY, weightKg: 80 }] }),
    ).toBeNull();
    expect(
      serverDayKcalFloor({ ...BASE, bodyMetricsRows: [{ measuredOn: MONDAY, heightCm: 180 }] }),
    ).toBeNull();
    expect(serverDayKcalFloor({ ...BASE, bodyMetricsRows: [] })).toBeNull();
  });

  it('Grenzfälle: sehr leicht/schwer, 16/95 Jahre, divers = männlicher Offset, Körperfett 90 vs. 91 Tage, neuestes je Feld', () => {
    const at = (o: Partial<ServerDayKcalFloorInput>) =>
      serverDayKcalFloor({ ...BASE, ...o }) as number;
    // 80 kg, 180 cm, 36 Jahre (Geburtstag 1.1.), männlich: 800 + 1125 − 180 + 5.
    expect(at({})).toBeCloseTo(1750, 9);
    expect(at({ sex: 'female' })).toBeCloseTo(1750 - 166, 9);
    expect(at({ sex: null })).toBeCloseTo(1750, 9);
    expect(at({ sex: 'diverse' })).toBeCloseTo(1750, 9);
    expect(
      at({ bodyMetricsRows: [{ measuredOn: MONDAY, heightCm: 150, weightKg: 30 }] }),
    ).toBeCloseTo(300 + 937.5 - 180 + 5, 9);
    expect(
      at({ bodyMetricsRows: [{ measuredOn: MONDAY, heightCm: 200, weightKg: 300 }] }),
    ).toBeCloseTo(3000 + 1250 - 180 + 5, 9);
    // 16. Geburtstag am Tag selbst vs. am Tag danach.
    expect(at({ birthDate: '2010-10-12' })).toBeCloseTo(800 + 1125 - 80 + 5, 9);
    expect(at({ birthDate: '2010-10-13' })).toBeCloseTo(800 + 1125 - 75 + 5, 9);
    expect(at({ birthDate: '1931-01-01' })).toBeCloseTo(800 + 1125 - 475 + 5, 9);
    // Körperfett 10 %: Katch 370 + 21,6 × 72 = 1925,2 > Mifflin.
    const fat = (measuredOn: string) => [
      { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
      { measuredOn, bodyFatPct: 10 },
    ];
    expect(at({ bodyMetricsRows: fat(addDays(MONDAY, -90)) })).toBeCloseTo(1925.2, 9);
    expect(at({ bodyMetricsRows: fat(addDays(MONDAY, -91)) })).toBeCloseTo(1750, 9);
    // Körperfett 40 %: Katch 1406,8 < Mifflin → Mifflin (max).
    expect(
      at({
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
          { measuredOn: MONDAY, bodyFatPct: 40 },
        ],
      }),
    ).toBeCloseTo(1750, 9);
    // Messung von morgen zählt als heute; je Feld der neueste Wert.
    expect(
      at({
        bodyMetricsRows: [
          { measuredOn: '2026-09-01', heightCm: 170, weightKg: 70 },
          { measuredOn: addDays(MONDAY, 1), weightKg: 90 },
        ],
      }),
    ).toBeCloseTo(900 + 1062.5 - 180 + 5, 9);
  });
});

describe('mealPlanDaysBelowFloor (Server-Regel G-W3)', () => {
  const item = (
    date: string,
    kcal: number,
    day_status: 'complete' | 'below_floor' | 'no_targets',
  ) => ({ date, kcal, day_status }) as MealPlanPayload['items'][number];

  it('complete und no_targets unter dem Grundumsatz → abgelehnt; below_floor, vergangene Tage und Spielraum nicht', () => {
    const floor = () => 1750;
    const t = MEAL_PLAN_DAY_KCAL_CHECK.roundingToleranceKcal;
    expect(
      mealPlanDaysBelowFloor(
        {
          items: [
            item(MONDAY, 900, 'complete'),
            item(MONDAY, 849.5, 'complete'),
            item(addDays(MONDAY, 1), 1000, 'no_targets'),
            item(addDays(MONDAY, 2), 500, 'below_floor'),
            item(addDays(MONDAY, -1), 100, 'complete'),
            item(addDays(MONDAY, 3), 1750 - t, 'complete'),
            item(addDays(MONDAY, 4), 1750 - t - 0.1, 'complete'),
          ],
        },
        floor,
        MONDAY,
      ),
    ).toEqual([addDays(MONDAY, 1), addDays(MONDAY, 4)]);
    expect(
      mealPlanDaysBelowFloor({ items: [item(MONDAY, 1, 'complete')] }, () => null, MONDAY),
    ).toEqual([]);
  });

  it('Eigenschaftstest: ein Plan der Engine wird nie abgelehnt (Personen, 1–8 Mahlzeiten, Ziele, Einheiten)', () => {
    const rnd = seededRandom(9731);
    const goals = ['fat_loss', 'muscle_gain', 'general_fitness', 'endurance'] as const;
    for (let n = 0; n < 40; n += 1) {
      const meals = 1 + Math.floor(rnd() * 8);
      const overrides: Partial<NutritionInputsInput> = {
        sex: rnd() < 0.5 ? 'female' : rnd() < 0.5 ? 'male' : null,
        birthDate: addDays(MONDAY, -Math.round((16 + rnd() * 75) * 365.25)),
        goalType: goals[Math.floor(rnd() * goals.length)] ?? 'general_fitness',
        bodyMetricsRows: [
          {
            measuredOn: '2026-10-01',
            heightCm: Math.round(150 + rnd() * 50),
            weightKg: Math.round(45 + rnd() * 100),
          },
        ],
      };
      const i = input({ overrides, meals, today: rnd() < 0.5 ? SUNDAY_BEFORE : THURSDAY });
      const plan = buildMealPlanWeek({ ...i, variant: Math.floor(rnd() * 5) });
      const payload = toMealPlanPayload(plan, { ...PAYLOAD_INPUTS, meals_per_day: meals });
      const sources = inputs({ today: i.today, ...overrides });
      const floorFor = (date: string) =>
        serverDayKcalFloor({
          birthDate: sources.birthDate,
          sex: sources.sex ?? null,
          today: i.today,
          date,
          healthDataConsent: true,
          healthFlags: [],
          bodyMetricsRows: sources.bodyMetricsRows ?? [],
        });
      expect(mealPlanDaysBelowFloor(payload, floorFor, i.today)).toEqual([]);
    }
  });
});

describe('Einkaufsliste aus der Datenbank', () => {
  it('Rundweg über die Payload (Zod an der Grenze); ungültig → null', () => {
    const i = input();
    const plan = buildMealPlanWeek({ ...i, variant: 0 });
    const list = newShoppingList(plan, i);
    const payload = JSON.parse(JSON.stringify(toShoppingListPayload(list))) as unknown;
    expect(shoppingListFromPayload(payload)).toEqual(list);
    const reversed = {
      ...(payload as Record<string, unknown>),
      items: [...((payload as { items: unknown[] }).items ?? [])].reverse(),
    };
    expect(shoppingListFromPayload(reversed)).toEqual(list);
    expect(shoppingListFromPayload({ ...(payload as object), extra: true })).toBeNull();
    expect(shoppingListFromPayload(null)).toBeNull();
  });
});
