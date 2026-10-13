/**
 * Ernährung mit Haupt- und Nebenziel (docs/PLAN-ZIELE.md 4.4 und 4.6, Etappe Z1): Energie-Anpassung, Richtung,
 * Sonderfälle, Eiweiß und Kohlenhydrate aus dem Ziel-Profil. Die Schutzgrenzen bleiben in `clampCalorieTarget`
 * (Eigenschaftstests in targets-properties.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { GOAL_TYPES, type GoalType } from '../enums';
import { GOAL_COMBINATIONS } from '../goals/profile';
import { nutritionEligibility } from './eligibility';
import { nutritionMacros } from './macros';
import { nutritionInputsSchema } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, run } from './test-helpers';

const week = (goalType: GoalType, secondaryGoalType: GoalType | null, extra = {}) =>
  nutritionTargetsForWeek(inputs({ goalType, secondaryGoalType, ...extra }), MONDAY);

describe('Eingaben: Nebenziel optional, Standard null (Wächter B1)', () => {
  it('fehlend → null; verbotenes Paar → Fehler', () => {
    expect(nutritionInputsSchema.parse(inputs()).secondaryGoalType).toBeNull();
    expect(() => week('definition', 'fat_loss')).toThrow();
    expect(() => week('general_fitness', 'general_fitness')).toThrow();
    for (const [primary, secondary] of GOAL_COMBINATIONS) {
      expect(() => week(primary, secondary)).not.toThrow();
    }
  });

  it('Invariante: ohne Nebenziel und mit null exakt dieselbe Woche wie vorher', () => {
    for (const goalType of GOAL_TYPES) {
      const before = nutritionTargetsForWeek(inputs({ goalType }), MONDAY);
      expect(week(goalType, null)).toEqual(before);
    }
  });
});

describe('Energie je Kombination (Tabelle 4.4)', () => {
  // Mann, 180 cm, 80 kg, geb. 1990 (36 J. im Okt. 2026), sitzend, Ruhetag, Check ohne Befund:
  // Mifflin 10·80 + 6,25·180 − 5·36 + 5 = 1.750 → Grundbedarf 1.750 × 1,45 = 2.537,5 (unabhängig gerechnet).
  const baseNeeds = (10 * 80 + 6.25 * 180 - 5 * 36 + 5) * 1.45;

  it.each([
    ['fat_loss', 'muscle_gain', -0.15],
    ['muscle_gain', 'fat_loss', -0.1],
    ['general_fitness', 'fat_loss', -0.15],
    ['endurance', 'fat_loss', -0.1],
    ['general_fitness', 'endurance', 0],
    ['endurance', 'muscle_gain', 0],
  ] as const)('%s → %s: Ruhetag ≈ Grundbedarf × (1 %s)', (primary, secondary, adjustment) => {
    const day = week(primary, secondary).days[0]!;
    expect(day.mode).toBe('full');
    // gerichtet auf 10 kcal gerundet; keine Schutzgrenze greift bei diesen Werten
    expect(Math.abs(day.targetKcal! - baseNeeds * (1 + adjustment))).toBeLessThanOrEqual(10);
  });

  it('Abnehmen → Muskelaufbau plant ein kleineres Defizit als Abnehmen allein, nie ein größeres', () => {
    const single = week('fat_loss', null).days[0]!.targetKcal!;
    const pair = week('fat_loss', 'muscle_gain').days[0]!.targetKcal!;
    expect(pair).toBeGreaterThan(single);
  });

  it('gleichwertige Paare (K3): Muskelaufbau → Abnehmen = Definition, Fitness → Ausdauer = Ausdauer (ganze Woche)', () => {
    const sessions = [run('2026-10-13', 90), run('2026-10-15', 45)];
    expect(week('muscle_gain', 'fat_loss', { sessions })).toEqual(
      week('definition', null, { sessions }),
    );
    expect(week('general_fitness', 'endurance', { sessions })).toEqual(
      week('endurance', null, { sessions }),
    );
  });

  it('Überschuss-Obergrenze nur bei Richtung „Überschuss“: Muskelaufbau → Ausdauer ja, Ausdauer → Muskelaufbau nein', () => {
    const surplus = week('muscle_gain', 'endurance').days[0]!;
    const single = week('muscle_gain', null).days[0]!;
    const maintenance = week('endurance', 'muscle_gain').days[0]!;
    const fitness = week('general_fitness', null).days[0]!;
    expect(surplus.ceilingKcal).toBe(single.ceilingKcal);
    expect(maintenance.ceilingKcal).toBe(fitness.ceilingKcal);
    expect(week('fat_loss', 'muscle_gain').days[0]!.ceilingKcal).toBe(fitness.ceilingKcal);
  });

  it('alle Auswahlen ohne Richtung „Überschuss“ haben über nutritionTargetsForWeek die Obergrenze von Erhalt (Wächter S11, Z1 K-1)', () => {
    const sessions = [run('2026-10-13', 60)];
    const reference = week('general_fitness', null, { sessions }).days.map((d) => d.ceilingKcal);
    const selections: [GoalType, GoalType | null][] = [
      ...GOAL_TYPES.map((goal): [GoalType, null] => [goal, null]),
      ...GOAL_COMBINATIONS.map(([p, s]): [GoalType, GoalType] => [p, s]),
    ];
    for (const [primary, secondary] of selections) {
      const surplus =
        primary === 'muscle_gain' && (secondary === null || secondary === 'endurance');
      const ceilings = week(primary, secondary, { sessions }).days.map((d) => d.ceilingKcal);
      if (surplus) expect(ceilings).not.toEqual(reference);
      else expect(ceilings, `${primary}>${secondary}`).toEqual(reference);
    }
  });
});

describe('Sonderfälle greifen auch bei Kombinationen (Energie-Richtung des Profils)', () => {
  const elig = (goalType: GoalType, secondaryGoalType: GoalType | null, extra = {}) =>
    nutritionEligibility({
      ageYears: 30,
      sex: 'female',
      goalType,
      secondaryGoalType,
      healthDataConsent: true,
      body: { weightKg: 70, heightCm: 170 },
      healthFlags: [],
      ...extra,
    });

  it('unter 18: jedes Defizit-Paar → maintenance_only + minor_no_deficit; Erhalt-/Überschuss-Paare bleiben voll', () => {
    for (const [primary, secondary] of GOAL_COMBINATIONS) {
      const e = elig(primary, secondary, { ageYears: 17 });
      const deficit = ['fat_loss', 'definition'].some((g) => g === primary || g === secondary);
      expect(e.mode).toBe(deficit ? 'maintenance_only' : 'full');
      expect(e.notices.includes('minor_no_deficit')).toBe(deficit);
      expect(e.deficitCap).toBe(0);
    }
  });

  it('BMI < 18,5: Fitness → Abnehmen → maintenance_only; Fitness → Ausdauer bleibt voll (ohne Defizit)', () => {
    const underweight = { body: { weightKg: 52, heightCm: 170 } };
    expect(elig('general_fitness', 'fat_loss', underweight).mode).toBe('maintenance_only');
    expect(elig('general_fitness', 'endurance', underweight)).toMatchObject({
      mode: 'full',
      deficitCap: 0,
    });
  });

  it('ohne Check (nicht männlich) → maintenance_only, unabhängig vom Paar', () => {
    for (const [primary, secondary] of GOAL_COMBINATIONS) {
      expect(elig(primary, secondary, { healthFlags: null }).mode).toBe('maintenance_only');
    }
  });

  it('verbotenes Paar → Zod-Fehler', () => {
    expect(() => elig('definition', 'muscle_gain')).toThrow();
  });
});

describe('Makros aus dem Ziel-Profil', () => {
  const macros = (goalType: GoalType, secondaryGoalType: GoalType | null, trainingMinutes = 0) =>
    nutritionMacros({
      targetKcal: 2500,
      goalType,
      secondaryGoalType,
      weightKg: 70,
      heightCm: 175,
      proteinMin: 0,
      proteinCap: 2.2,
      trainingMinutes,
    });

  it('Eiweiß je Paar (2,2 bei Abnehmen → Muskelaufbau statt 2,0)', () => {
    expect(macros('fat_loss', null).proteinGPerKg).toBe(2.0);
    expect(macros('fat_loss', 'muscle_gain').proteinGPerKg).toBe(2.2);
    expect(macros('endurance', 'muscle_gain').proteinGPerKg).toBe(1.8);
  });

  it('Kohlenhydrat-Regel nach Training auch bei Ausdauer als Nebenziel', () => {
    const withEndurance = macros('fat_loss', 'endurance', 120);
    const without = macros('fat_loss', null, 120);
    expect(withEndurance.carbsG).toBeGreaterThan(without.carbsG);
    expect(withEndurance.fatG).toBeLessThan(without.fatG);
    // ohne Training greift die Regel nicht spürbar: gleiche Werte wie ohne Ausdauer-Nebenziel
    expect(macros('fat_loss', 'endurance', 0)).toEqual(macros('fat_loss', null, 0));
  });
});
