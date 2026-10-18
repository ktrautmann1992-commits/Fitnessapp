/**
 * Lebenszyklus des Abnehmziels (docs/PLAN-ZIELE.md 6 Nr. 4, F10, Etappe Z5): Stand heute, Karten „erreicht“ und
 * „Zeitraum vorbei“, Auswahl nach erreichtem Ziel und automatische Neuplanung des Essensplans bei neuem Ziel (4.6 N5).
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { GOAL_TYPES, type GoalType } from '../enums';
import { buildMealPlanWeek, daySafetyKey } from '../nutrition/meal-plan';
import { N3_FOODS, N3_RECIPES } from '../nutrition/meal-plan-fixtures';
import { automaticReplan, needsAutomaticReplan } from '../nutrition/replan';
import type { NutritionInputsInput } from '../nutrition/schemas';
import { nutritionTargetsForWeek } from '../nutrition/targets';
import { inputs as nutritionInputs } from '../nutrition/test-helpers';
import { goalEnergyDirection, hasGoal, isAllowedGoalPair } from './profile';
import {
  goalStepAfterWeightGoalReached,
  goalsAfterWeightGoalReached,
  WEIGHT_GOAL_REACHED_CHOICES,
  weightGoalCard,
  weightGoalOverview,
  weightGoalPeriodEnded,
} from './weight-goal-lifecycle';
import type { WeightGoal } from './weight-goal-schema';

const TODAY = '2026-10-12';

/** Beispiel A (Plan 3.3): Mann, 35 J., 180 cm, 90 kg, sitzend. */
function person(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return nutritionInputs({
    today: TODAY,
    birthDate: '1991-09-01',
    sex: 'male',
    goalType: 'fat_loss',
    activityLevel: 'sedentary',
    bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 }],
    ...overrides,
  });
}

/** −10 kg in 26 Wochen ab `start` (Grün). */
function goal(start = '2026-10-10', overrides: Partial<WeightGoal> = {}): WeightGoal {
  return {
    targetWeightKg: 80,
    startDate: start,
    targetDate: addDays(start, 182),
    amountMode: 'kg_to_lose',
    timeMode: 'weeks',
    ...overrides,
  };
}

describe('weightGoalOverview: Stand heute (Plan 6 Nr. 4)', () => {
  it('ohne Ziel bzw. ohne Einwilligung → none', () => {
    expect(weightGoalOverview(person())).toEqual({ status: 'none', weightOutdated: false });
    expect(
      weightGoalOverview(person({ weightGoal: goal(), healthDataConsent: false })).status,
    ).toBe('none');
  });

  it('aktives Ziel → active, keine Karte', () => {
    const o = weightGoalOverview(person({ weightGoal: goal() }));
    expect(o).toEqual({ status: 'active', weightOutdated: false });
    expect(weightGoalCard(o)).toBeNull();
  });

  it('Wettkampfwoche (W1, Wächter N4): ruht wegen Wettkampf, danach wieder aktiv', () => {
    const race = {
      competitions: [
        {
          id: 'c1',
          status: 'planned' as const,
          discipline: '10k' as const,
          raceDate: '2026-10-18',
        },
      ],
    };
    expect(weightGoalOverview(person({ weightGoal: goal(), ...race }))).toEqual({
      status: 'paused',
      weightOutdated: false,
      pausedForCompetition: true,
    });
    expect(
      weightGoalOverview(person({ weightGoal: goal(), ...race, today: '2026-10-20' })),
    ).toEqual({ status: 'active', weightOutdated: false });
  });

  it('erreicht: 80,1 → 79,9 → 80,2 bei Ziel 80,0 bleibt „erreicht“ (S8) → Karte „reached“', () => {
    const rows = [
      { measuredOn: '2026-10-09', heightCm: 180, weightKg: 90 },
      { measuredOn: '2026-10-10', heightCm: null, weightKg: 80.1 },
      { measuredOn: '2026-10-11', heightCm: null, weightKg: 79.9 },
      { measuredOn: '2026-10-12', heightCm: null, weightKg: 80.2 },
    ];
    const o = weightGoalOverview(person({ bodyMetricsRows: rows, weightGoal: goal('2026-10-09') }));
    expect(o.status).toBe('reached');
    expect(weightGoalCard(o)).toBe('reached');
    // Erhalt bis zur Wahl: Energie-Anpassung 0, nie ein Defizit.
    const day = nutritionTargetsForWeek(
      person({ bodyMetricsRows: rows, weightGoal: goal('2026-10-09') }),
      TODAY,
    ).days[0];
    expect(day?.goalAdjustment).toBe(0);
  });

  it('Zeitraum vorbei → date_passed, Karte; Standard-Tempo, nie schneller (F10)', () => {
    const passed = goal('2026-09-01', { targetDate: '2026-10-01' });
    const o = weightGoalOverview(person({ weightGoal: passed }));
    expect(o.status).toBe('date_passed');
    expect(weightGoalCard(o)).toBe('date_passed');
    const withGoal = nutritionTargetsForWeek(person({ weightGoal: passed }), TODAY).days[0];
    const without = nutritionTargetsForWeek(person(), TODAY).days[0];
    expect(withGoal?.goalAdjustment).toBe(without?.goalAdjustment);
    expect(withGoal?.targetKcal).toBe(without?.targetKcal);
  });

  it('Zieldatum genau heute → date_passed; am Tag davor noch aktiv', () => {
    const edge = goal('2026-09-14', { targetDate: TODAY });
    expect(weightGoalPeriodEnded(edge, TODAY)).toBe(true);
    expect(weightGoalPeriodEnded(edge, addDays(TODAY, -1))).toBe(false);
    expect(weightGoalOverview(person({ weightGoal: edge })).status).toBe('date_passed');
    expect(weightGoalOverview(person({ weightGoal: edge, today: addDays(TODAY, -1) })).status).toBe(
      'active',
    );
  });

  it('Schwangerschaft → ruht (paused), keine Karte', () => {
    const o = weightGoalOverview(
      person({ weightGoal: goal(), healthFlags: { flags: ['pregnancy', 'conservative_plan'] } }),
    );
    expect(o.status).toBe('paused');
    expect(weightGoalCard(o)).toBeNull();
  });

  it('Größe nachträglich geändert → Ziel-BMI unzulässig → invalid (S14)', () => {
    const o = weightGoalOverview(
      person({
        weightGoal: goal(),
        bodyMetricsRows: [
          { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 },
          { measuredOn: '2026-10-11', heightCm: 205, weightKg: null },
        ],
      }),
    );
    expect(o.status).toBe('invalid');
  });

  it('kein Defizit mehr planbar (Beispiel G: Körperfett 39,3 %, Medikamente) → no_deficit (K-d)', () => {
    const o = weightGoalOverview(
      person({
        weightGoal: goal(),
        bodyMetricsRows: [
          { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: 39.3 },
        ],
        healthFlags: { flags: ['medication'] },
      }),
    );
    expect(o.status).toBe('no_deficit');
  });

  it('Gewicht älter als 90 Tage bei bestehendem Ziel → weightOutdated (Vormerkung Z2 K-6), 90 Tage noch nicht', () => {
    const at = (measuredOn: string) =>
      weightGoalOverview(
        person({
          today: '2027-01-08',
          weightGoal: goal('2026-10-10'),
          bodyMetricsRows: [{ measuredOn, heightCm: 180, weightKg: 90 }],
        }),
      );
    expect(at('2026-10-10')).toEqual({ status: 'active', weightOutdated: false }); // 90 Tage
    expect(at('2026-10-09').weightOutdated).toBe(true); // 91 Tage
    // Ohne Ziel kein eigener Ziel-Hinweis.
    expect(
      weightGoalOverview(
        person({
          today: '2027-01-08',
          bodyMetricsRows: [{ measuredOn: '2026-01-01', heightCm: 180, weightKg: 90 }],
        }),
      ).weightOutdated,
    ).toBe(false);
  });

  it('Grenzfälle Alter: 16 J. (gesperrt, Ziel ruht) und 100 J.; nie ein Fehler', () => {
    const young = weightGoalOverview(person({ birthDate: '2010-10-12', weightGoal: goal() }));
    expect(young.status).toBe('paused');
    const old = weightGoalOverview(person({ birthDate: '1926-10-12', weightGoal: goal() }));
    expect(['active', 'invalid', 'no_deficit']).toContain(old.status);
  });
});

describe('goalsAfterWeightGoalReached: „Wie geht es weiter?“ (F10)', () => {
  const withFatLoss: [GoalType, GoalType | null][] = [];
  for (const primary of GOAL_TYPES) {
    for (const secondary of [null, ...GOAL_TYPES]) {
      if (!isAllowedGoalPair(primary, secondary)) continue;
      if (primary === 'fat_loss' || secondary === 'fat_loss')
        withFatLoss.push([primary, secondary]);
    }
  }

  it('jede Auswahl mit Abnehmen: Ergebnis erlaubt, ohne Abnehmen; „halten“ ohne Defizit, Ausdauer bleibt', () => {
    expect(withFatLoss.length).toBeGreaterThanOrEqual(6);
    for (const [primary, secondary] of withFatLoss) {
      const hadEndurance = primary === 'endurance' || secondary === 'endurance';
      for (const choice of ['maintain', 'muscle_gain'] as const) {
        const next = goalsAfterWeightGoalReached({ primary, secondary }, choice);
        expect(next).not.toBeNull();
        if (next === null) continue;
        expect(isAllowedGoalPair(next.primary, next.secondary)).toBe(true);
        expect(hasGoal(next, 'fat_loss')).toBe(false);
        expect(hasGoal(next, 'endurance')).toBe(hadEndurance);
        if (choice === 'maintain') expect(goalEnergyDirection(next)).toBe('maintenance');
        else expect(hasGoal(next, 'muscle_gain')).toBe(true);
      }
      expect(goalsAfterWeightGoalReached({ primary, secondary }, 'new_weight_goal')).toBeNull();
    }
  });

  it('feste Beispiele', () => {
    expect(goalsAfterWeightGoalReached({ primary: 'fat_loss' }, 'maintain')).toEqual({
      primary: 'general_fitness',
      secondary: null,
    });
    expect(
      goalsAfterWeightGoalReached({ primary: 'fat_loss', secondary: 'endurance' }, 'maintain'),
    ).toEqual({ primary: 'general_fitness', secondary: 'endurance' });
    expect(
      goalsAfterWeightGoalReached({ primary: 'endurance', secondary: 'fat_loss' }, 'maintain'),
    ).toEqual({ primary: 'endurance', secondary: null });
    expect(
      goalsAfterWeightGoalReached({ primary: 'endurance', secondary: 'fat_loss' }, 'muscle_gain'),
    ).toEqual({ primary: 'endurance', secondary: 'muscle_gain' });
    expect(
      goalsAfterWeightGoalReached({ primary: 'muscle_gain', secondary: 'fat_loss' }, 'muscle_gain'),
    ).toEqual({ primary: 'muscle_gain', secondary: null });
    expect(WEIGHT_GOAL_REACHED_CHOICES).toEqual(['maintain', 'muscle_gain', 'new_weight_goal']);
  });

  it('Schritt-Angaben (Wächter Z5 N3): Datum in der Vergangenheit entfällt, Disziplin nur mit Ausdauer, Zod-geprüft', () => {
    const base = {
      goalType: 'endurance' as const,
      secondaryGoalType: 'fat_loss' as const,
      discipline: '10k' as const,
    };
    // Wettkampfdatum gestern → entfällt (sonst lehnte der Schritt „Datum in der Vergangenheit“ ab).
    expect(
      goalStepAfterWeightGoalReached({ ...base, targetDate: '2026-10-11' }, 'maintain', TODAY),
    ).toEqual({
      goalType: 'endurance',
      secondaryGoalType: null,
      discipline: '10k',
      targetDate: null,
    });
    // Heute und künftig bleibt es.
    expect(
      goalStepAfterWeightGoalReached({ ...base, targetDate: TODAY }, 'muscle_gain', TODAY),
    ).toEqual({
      goalType: 'endurance',
      secondaryGoalType: 'muscle_gain',
      discipline: '10k',
      targetDate: TODAY,
    });
    // Ohne Ausdauer: Disziplin und Datum entfallen.
    expect(
      goalStepAfterWeightGoalReached(
        { goalType: 'fat_loss', secondaryGoalType: null, discipline: null, targetDate: null },
        'muscle_gain',
        TODAY,
      ),
    ).toEqual({
      goalType: 'muscle_gain',
      secondaryGoalType: null,
      discipline: null,
      targetDate: null,
    });
    // Ungültiges Datum → nichts speichern (null statt Fehler).
    expect(
      goalStepAfterWeightGoalReached({ ...base, targetDate: '2027-02-31' }, 'maintain', TODAY),
    ).toBeNull();
  });

  it('verbotene Auswahl wird abgelehnt (Zod an der Grenze)', () => {
    expect(() =>
      goalsAfterWeightGoalReached({ primary: 'definition', secondary: 'fat_loss' }, 'maintain'),
    ).toThrow();
  });
});

describe('Neues Abnehmziel → Essensplan wird automatisch neu geplant (Plan 4.6, N5)', () => {
  const SUNDAY = '2026-10-11';
  const THURSDAY = '2026-10-15';
  const data = (today: string, overrides: Partial<NutritionInputsInput>) => ({
    targets: nutritionTargetsForWeek(person({ today, mealsPerDay: 4, ...overrides }), TODAY),
    profile: { diet: 'omnivore' as const, eatsPork: true },
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
  });

  it('ohne Ziel geplant, dann −10 kg in 26 Wochen ab Donnerstag → Neuplanung ab heute (`weight_goal_changed`)', () => {
    const plan = buildMealPlanWeek(data(SUNDAY, {}));
    // Unverändert → keine Neuplanung.
    expect(needsAutomaticReplan(plan, data(THURSDAY, {})).needed).toBe(false);
    const check = needsAutomaticReplan(plan, data(THURSDAY, { weightGoal: goal(THURSDAY) }));
    expect(check.needed).toBe(true);
    expect(check.reasons).toContain('weight_goal_changed');
    expect(check.reasons).not.toContain('caps_changed');
    expect(check.fromDate).toBe(THURSDAY);
    // Neu geplant ab heute: danach passt der Plan, keine weitere Neuplanung.
    const next = automaticReplan(plan, null, data(THURSDAY, { weightGoal: goal(THURSDAY) }));
    expect(
      needsAutomaticReplan(next.plan, data(THURSDAY, { weightGoal: goal(THURSDAY) })).needed,
    ).toBe(false);
    // Vergangene Tage (Mo–Mi) bleiben unverändert.
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      expect(next.plan.days.find((d) => d.date === date)).toEqual(
        plan.days.find((d) => d.date === date),
      );
    }
  });

  it('ohne Abnehmziel bleibt der Abgleich-Schlüssel wie vorher (keine Neuplanung bestehender Pläne)', () => {
    const day = nutritionTargetsForWeek(person(), TODAY).days[0];
    expect(day && daySafetyKey(day)).toBe(
      day && [day.mode, `dc=${day.deficitCap}`, `sc=${day.surplusCap}`, 'ex='].join('|'),
    );
    const withGoal = nutritionTargetsForWeek(person({ weightGoal: goal() }), TODAY).days[0];
    // Mit Ziel: Stand und Kennung des Ziels (Hash) – kein Zielgewicht oder Datum im Klartext.
    const key = withGoal ? daySafetyKey(withGoal) : '';
    expect(key).toMatch(/\|wg=active:\d+$/);
    expect(key.split('wg=')[1]).not.toMatch(/\.|80|2026|2027/);
  });

  it('neues Gewicht bei aktivem Ziel → keine Neuplanung, solange im Band (Wächter Z5 H1); Gegenprobe', () => {
    const withGoal = { weightGoal: goal(SUNDAY) };
    const plan = buildMealPlanWeek(data(SUNDAY, withGoal));
    const weighed = (kg: number) =>
      needsAutomaticReplan(
        plan,
        data(THURSDAY, {
          ...withGoal,
          bodyMetricsRows: [
            { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 },
            { measuredOn: THURSDAY, heightCm: null, weightKg: kg },
          ],
        }),
      );
    // 90 → 89,8 kg: Anpassung ändert sich leicht, Ziel und Stand nicht → kein `weight_goal_changed`, keine Neuplanung.
    const small = weighed(89.8);
    expect(small.reasons).not.toContain('weight_goal_changed');
    expect(small.needed).toBe(false);
    // Gegenprobe: deutlich anderes Gewicht → Tag fällt aus dem Band → Neuplanung über `out_of_band`, nicht über das Ziel.
    const big = weighed(130);
    expect(big.reasons).toContain('out_of_band');
    expect(big.reasons).not.toContain('weight_goal_changed');
    // Gegenprobe Ziel geändert (anderer Zeitraum, gleiches Gewicht) → `weight_goal_changed`.
    const changed = needsAutomaticReplan(
      plan,
      data(THURSDAY, { weightGoal: goal(SUNDAY, { targetDate: addDays(SUNDAY, 140) }) }),
    );
    expect(changed.reasons).toContain('weight_goal_changed');
  });

  it('Ziel erreicht (Erhalt) → ebenfalls Neuplanung; entferntes Ziel → zurück zum Standard', () => {
    const withGoal = { weightGoal: goal(SUNDAY) };
    const plan = buildMealPlanWeek(data(SUNDAY, withGoal));
    const reached = needsAutomaticReplan(
      plan,
      data(THURSDAY, {
        ...withGoal,
        bodyMetricsRows: [
          { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 },
          { measuredOn: THURSDAY, heightCm: null, weightKg: 79.9 },
        ],
      }),
    );
    expect(reached.reasons).toContain('weight_goal_changed');
    const removed = needsAutomaticReplan(plan, data(THURSDAY, {}));
    expect(removed.reasons).toContain('weight_goal_changed');
  });
});
