/**
 * Erreichbarkeits-Ampel (docs/PLAN-ZIELE.md 3.1–3.3, Etappe Z2). Die Rechenbeispiele A–I aus 3.3 laufen WÖRTLICH als
 * Tests – gerechnet mit den echten Funktionen (`weightGoalFeasibility` → `dayEnergy`, `nutritionEligibility`,
 * `clampCalorieTarget`). Die Erwartungswerte (Grundbedarf, Untergrenzen, D, v_C, C, N, Stufe, Zeiger) sind aus dem
 * Plan abgeschrieben, nicht aus der Implementierung.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { NutritionInputsInput } from '../nutrition/schemas';
import { inputs as nutritionInputs } from '../nutrition/test-helpers';
import {
  hasPlannableDeficit,
  minTargetBmiFor,
  pointerZone,
  restDayStandardDeficitKcal,
  weightGoalAvailability,
  weightGoalCapacity,
  weightGoalFeasibility,
  type WeightGoalFeasibility,
  type WeightGoalLevel,
  weightGoalLevel,
  weightGoalPointer,
  type WeightGoalRated,
  zoneOfLevel,
} from './weight-goal-feasibility';

/** Montag 12.10.2026; Geburtstage so gewählt, dass sich das Alter im ganzen Zeitraum (≤ 46 Wochen) nicht ändert. */
const TODAY = '2026-10-12';

function person(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return nutritionInputs({
    today: TODAY,
    birthDate: '1991-09-01', // 35 J. bis 31.08.2027
    sex: 'male',
    goalType: 'fat_loss',
    activityLevel: 'sedentary',
    healthFlags: { flags: [] },
    bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 }],
    ...overrides,
  });
}

function rate(p: NutritionInputsInput, targetWeightKg: number, weeks: number) {
  return weightGoalFeasibility(p, { targetWeightKg, targetDate: addDays(TODAY, weeks * 7) });
}

function rated(result: WeightGoalFeasibility): WeightGoalRated {
  if (result.state !== 'rated') throw new Error(`erwartet „rated“, erhalten „${result.state}“`);
  return result;
}

// Beispiel-Personen aus Plan 3.3
const A = person();
const B = person({
  sex: 'female',
  birthDate: '1996-09-01', // 30 J.
  bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 165, weightKg: 70 }],
});
const C = person({ birthDate: '1960-09-01' }); // 66 J. bis 31.08.2027 (Geburtstag nach dem Zieldatum)
const G = person({
  bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: 39.3 }],
  healthFlags: { flags: ['medication'] },
});
const H = person({
  sex: 'female',
  birthDate: '1996-09-01',
  activityLevel: 'very_active',
  bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 165, weightKg: 62 }],
});

describe('Rechenbeispiele 3.3 (wörtlich, mit den echten Funktionen)', () => {
  it('A: Mann 35 J., 180 cm, 90 → 80 kg: D 537,95 / 508,95, v_C ≈ 0,4627, C ≈ 0,544 %, N = 22', () => {
    const r = rated(rate(A, 80, 12));
    expect(r.capacity.todayKcal).toBeCloseTo(537.95, 2);
    expect(r.capacity.atTargetKcal).toBeCloseTo(508.95, 2);
    expect(r.capacity.kcal).toBeCloseTo(508.95, 2);
    expect(r.capacityKgPerWeek).toBeCloseTo(0.4627, 4);
    expect(r.capacityPace).toBeCloseTo(0.005443, 6);
    expect(r.meanWeightKg).toBe(85);
    expect(r.safeWeeks).toBe(22);
    // 12 Wochen: r ≈ 0,980 % (≤ 1 %, > C) → Orange „langsamer“, Zeiger x ≈ 0,216
    expect(r.requiredPace).toBeCloseTo(0.0098, 5);
    expect(r.level).toBe('orange_slower');
    expect(r.zone).toBe('orange');
    expect(r.pointer.raw).toBeCloseTo(0.216, 3);
    expect(r.pointer.display).toBeCloseTo(0.216, 3);
    expect(r.suggestedWeeks).toBe(22);
  });

  it('A: Restmenge 26 / 22 / 21 / 6 Wochen → Grün / Gelb / Orange „langsamer“ (Zeiger geklemmt) / Rot', () => {
    const w26 = rated(rate(A, 80, 26));
    expect(w26.requiredPace).toBeCloseTo(0.00452, 5);
    expect(w26.level).toBe('green');
    expect(w26.suggestedWeeks).toBeNull();

    const w22 = rated(rate(A, 80, 22));
    expect(w22.requiredPace).toBeCloseTo(0.00535, 5);
    expect(w22.level).toBe('yellow');

    // 21 Wochen: r ≈ 0,560 % > C (0,544 %) → Orange „langsamer“; x ≈ 0,552 (Gelb-Zone) → in Orange geklemmt (S5)
    const w21 = rated(rate(A, 80, 21));
    expect(w21.requiredPace).toBeCloseTo(0.0056, 5);
    expect(w21.level).toBe('orange_slower');
    expect(w21.safeWeeks).toBe(22);
    expect(w21.pointer.raw).toBeCloseTo(0.552, 3);
    expect(pointerZone(w21.pointer.raw)).toBe('yellow');
    expect(pointerZone(w21.pointer.display)).toBe('orange');

    const w6 = rated(rate(A, 80, 6));
    expect(w6.requiredPace).toBeCloseTo(0.01961, 5);
    expect(w6.level).toBe('red');
    expect(w6.safeWeeks).toBe(22);
    expect(w6.suggestedWeeks).toBe(22);
  });

  it('B: Frau 30 J., 165 cm, 70 → 67 kg: D 411,87 / 403,17, v_C ≈ 0,3665, C ≈ 0,535 %, N = 9; 4 Wo. Rot → 9 Wo. Grün', () => {
    const r = rated(rate(B, 67, 4));
    expect(r.capacity.todayKcal).toBeCloseTo(411.87, 2);
    expect(r.capacity.atTargetKcal).toBeCloseTo(403.17, 2);
    expect(r.capacityKgPerWeek).toBeCloseTo(0.3665, 4);
    expect(r.capacityPace).toBeCloseTo(0.00535, 5);
    expect(r.requiredPace).toBeCloseTo(0.01095, 5);
    expect(r.level).toBe('red');
    expect(r.safeWeeks).toBe(9);
    const after = rated(rate(B, 67, 9));
    expect(after.requiredPace).toBeCloseTo(0.00487, 5);
    expect(after.level).toBe('green');
  });

  it('C: wie A, aber 66 J. (15-%-Deckel): D 369,75 / 348, v_C ≈ 0,3164, C ≈ 0,372 %, N = 32; 26 Wo. Orange (geklemmt) → 32 Wo. Grün', () => {
    const r = rated(rate(C, 80, 26));
    expect(r.capacity.todayKcal).toBeCloseTo(369.75, 2);
    expect(r.capacity.atTargetKcal).toBeCloseTo(348, 2);
    expect(r.capacity.atTargetAgeYears).toBe(66);
    expect(r.capacityKgPerWeek).toBeCloseTo(0.3164, 4);
    expect(r.capacityPace).toBeCloseTo(0.003722, 6);
    expect(r.requiredPace).toBeCloseTo(0.00452, 5);
    expect(r.level).toBe('orange_slower');
    expect(r.safeWeeks).toBe(32);
    // Zeiger stünde bei x ≈ 0,638 (Grün-Zone) und wird in die Orange-Zone geklemmt (S5)
    expect(r.pointer.raw).toBeCloseTo(0.638, 3);
    expect(pointerZone(r.pointer.display)).toBe('orange');
    const after = rated(rate(C, 80, 32));
    expect(after.requiredPace).toBeCloseTo(0.00368, 5);
    expect(after.level).toBe('green');
  });

  it('D: Ziel-BMI 18,4 und 19,9 → Fehler, keine Stufe (F8: Untergrenze 20)', () => {
    const p = person({
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 70 }],
    });
    // 180 cm: BMI 18,4 = 59,6 kg; BMI 19,9 ≈ 64,4 kg; BMI 20 = 64,8 kg
    expect(rate(p, 59.6, 30)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p, 64.4, 30)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p, 64.8, 30).state).toBe('rated');
  });

  it('E: 17 J. → gesperrt; F: Schwangerschaft → gesperrt', () => {
    expect(rate(person({ birthDate: '2009-10-13' }), 80, 30)).toEqual({
      state: 'unavailable',
      reason: 'minor',
    });
    expect(rate(person({ healthFlags: { flags: ['pregnancy'] } }), 80, 30)).toEqual({
      state: 'unavailable',
      reason: 'pregnancy',
    });
  });

  it('G: Körperfett 39,3 %, `medication` → D(heute) ≈ −38,78, D(am Ziel) ≈ −105,64, D_C ≈ −105,64 → no_deficit', () => {
    const r = rate(G, 80, 30);
    expect(r.state).toBe('no_deficit');
    if (r.state !== 'no_deficit') return;
    expect(r.capacity.todayKcal).toBeCloseTo(-38.78, 2);
    expect(r.capacity.atTargetKcal).toBeCloseTo(-105.64, 2);
    expect(r.capacity.kcal).toBeCloseTo(-105.64, 2);
    expect(r).not.toHaveProperty('level');
    expect(r).not.toHaveProperty('safeWeeks');
    // Gegenprobe ohne `medication` (Deckel 25 %): D_C ≈ 148,8, N = 74
    const without = rated(rate(person({ bodyMetricsRows: G.bodyMetricsRows }), 80, 30));
    expect(without.capacity.kcal).toBeCloseTo(148.8, 1);
    expect(without.safeWeeks).toBe(74);
  });

  it('H: Frau 62 → 59 kg, Alltagsfaktor 2,2: C ≈ 0,866 % > 0,75 % → N = 7 (nicht 6), Knopf führt in Gelb', () => {
    const r = rated(rate(H, 59, 6));
    expect(r.capacity.todayKcal).toBeCloseTo(589.71, 2);
    expect(r.capacity.atTargetKcal).toBeCloseTo(576.51, 2);
    expect(r.capacityKgPerWeek).toBeCloseTo(0.5241, 4);
    expect(r.capacityPace).toBeCloseTo(0.00866, 5);
    expect(r.requiredPace).toBeCloseTo(0.00826, 5);
    expect(r.level).toBe('orange_calmer');
    expect(r.safeWeeks).toBe(7);
    const after = rated(rate(H, 59, r.suggestedWeeks!));
    expect(after.requiredPace).toBeCloseTo(0.00708, 5);
    expect(after.level).toBe('yellow');
  });

  it('I: D_C knapp über 1 kcal (15-%-Deckel, Körperfett 35 %) bzw. N knapp über 104 (31 %) → kein N, kein Knopf', () => {
    const withBodyFat = (pct: number) =>
      person({
        bodyMetricsRows: [
          { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: pct },
        ],
        healthFlags: { flags: ['medication'] },
      });
    const tiny = rated(rate(withBodyFat(35), 80, 30));
    expect(tiny.capacity.kcal).toBeGreaterThan(1);
    expect(tiny.capacity.kcal).toBeLessThan(3);
    expect(tiny.safeWeeks).toBeNull();
    expect(tiny.safeWeeksOverMax).toBe(true);
    expect(tiny.suggestedWeeks).toBeNull();
    // D_C ≈ 102,3 kcal → v_C ≈ 0,0930 → 10 / 0,0930 = 107,5 → N = 108 > 104
    const just = rated(rate(withBodyFat(31), 80, 30));
    expect(just.capacity.kcal).toBeCloseTo(102.33, 1);
    expect(just.level).toBe('orange_slower');
    expect(just.safeWeeks).toBeNull();
    expect(just.suggestedWeeks).toBeNull();
    // 30,5 %: N = 96 ≤ 104 → Knopf vorhanden
    const below = rated(rate(withBodyFat(30.5), 80, 30));
    expect(below.safeWeeks).toBe(96);
    expect(below.suggestedWeeks).toBe(96);
  });
});

describe('Stufen mit EPS (Wächter S4, S9)', () => {
  const C_HIGH = 0.02;
  it.each([
    [0.005, 'green'],
    [0.005 + 1e-12, 'green'],
    [0.005001, 'yellow'],
    [0.0075, 'yellow'],
    [0.0075 + 1e-12, 'yellow'],
    [0.0075001, 'orange_calmer'],
    [0.01, 'orange_calmer'],
    [0.01 + 1e-12, 'orange_calmer'],
    [0.010001, 'red'],
  ] as const)('r = %s bei großer Kapazität → %s', (r, level) => {
    expect(weightGoalLevel(r, C_HIGH)).toBe(level);
  });

  it('r = C bleibt in der Zonen-Stufe, knapp darüber → Orange „langsamer“; über 1 % immer Rot', () => {
    expect(weightGoalLevel(0.004, 0.004)).toBe('green');
    expect(weightGoalLevel(0.004 + 1e-12, 0.004)).toBe('green');
    expect(weightGoalLevel(0.004001, 0.004)).toBe('orange_slower');
    expect(weightGoalLevel(0.006, 0.006)).toBe('yellow');
    expect(weightGoalLevel(0.0061, 0.006)).toBe('orange_slower');
    expect(weightGoalLevel(0.009, 0.009)).toBe('orange_calmer');
    expect(weightGoalLevel(0.0091, 0.009)).toBe('orange_slower');
    expect(weightGoalLevel(0.0101, 0.009)).toBe('red');
    expect(weightGoalLevel(0.0101, 0.05)).toBe('red');
  });

  it('die Stufen sind lückenlos und eindeutig (Raster über r und C)', () => {
    for (let r = 0; r <= 0.02; r += 0.0001) {
      for (let c = 0.0001; c <= 0.02; c += 0.0007) {
        const level = weightGoalLevel(r, c);
        if (level === 'red') expect(r).toBeGreaterThan(0.01);
        else expect(r).toBeLessThanOrEqual(0.01 + 1e-9);
        if (level === 'orange_slower') expect(r).toBeGreaterThan(c);
        if (level === 'green' || level === 'yellow' || level === 'orange_calmer') {
          expect(r).toBeLessThanOrEqual(c + 1e-9);
        }
      }
    }
  });
});

describe('Zeiger (Wächter S5, K-a): Zeiger-Zone = Stufe, beidseitig geklemmt', () => {
  const LEVELS: readonly WeightGoalLevel[] = [
    'green',
    'yellow',
    'orange_calmer',
    'orange_slower',
    'red',
  ];
  const BOUNDARIES = [0, 0.005, 0.0075, 0.01, 0.0125, 0.02];

  it('x = 1 − min(r / 1,25 %, 1): Grenzen 0,5 / 0,75 / 1,0 % = 0,6 / 0,4 / 0,2', () => {
    expect(weightGoalPointer(0.005, 'green').raw).toBeCloseTo(0.6, 12);
    expect(weightGoalPointer(0.0075, 'yellow').raw).toBeCloseTo(0.4, 12);
    expect(weightGoalPointer(0.01, 'orange_calmer').raw).toBeCloseTo(0.2, 12);
    expect(weightGoalPointer(0.0125, 'red').raw).toBe(0);
    expect(weightGoalPointer(0.05, 'red').raw).toBe(0);
    expect(weightGoalPointer(0, 'green').display).toBe(1);
  });

  it('jede Stufe × r an jeder Grenze ± 1e-12 (und dazwischen): Zone der Anzeige = Zone der Stufe', () => {
    const rs = BOUNDARIES.flatMap((b) => [b - 1e-12, b, b + 1e-12]).filter((r) => r >= 0);
    for (let r = 0; r <= 0.02; r += 0.00025) rs.push(r);
    for (const r of rs) {
      for (const level of LEVELS) {
        const { display } = weightGoalPointer(r, level);
        expect(pointerZone(display), `${r} ${level}`).toBe(zoneOfLevel(level));
        expect(display).toBeGreaterThanOrEqual(0);
        expect(display).toBeLessThanOrEqual(1);
      }
      // Mit der echten Stufe (C groß): Stufe Grün dank EPS bei r = 0,5 % + 1e-12, Zeiger knapp unter 0,6 → geklemmt
      const level = weightGoalLevel(r, 1);
      expect(pointerZone(weightGoalPointer(r, level).display)).toBe(zoneOfLevel(level));
    }
    const edge = weightGoalPointer(0.005 + 1e-12, weightGoalLevel(0.005 + 1e-12, 1));
    expect(edge.raw).toBeLessThan(0.6);
    expect(pointerZone(edge.raw)).toBe('yellow');
    expect(pointerZone(edge.display)).toBe('green');
  });
});

describe('Kapazität (Wächter S1, S6, N2)', () => {
  it('kein Defizit planbar: D_C negativ, 0, genau 1 kcal → nein; knapp über 1 kcal → ja', () => {
    expect(hasPlannableDeficit(-105.64)).toBe(false);
    expect(hasPlannableDeficit(0)).toBe(false);
    expect(hasPlannableDeficit(1)).toBe(false);
    expect(hasPlannableDeficit(1.000001)).toBe(true);
  });

  it('D_C = min(heute, am Ziel); D nie größer als das Defizit der Standard-Anpassung (−20 / −15 / −10 %) – für alle Paare mit Abnehmen (Wächter Z2 K-4a)', () => {
    const selections = [
      ['fat_loss', null, 0.2],
      ['fat_loss', 'muscle_gain', 0.15],
      ['fat_loss', 'endurance', 0.15],
      ['general_fitness', 'fat_loss', 0.15],
      ['muscle_gain', 'fat_loss', 0.1],
      ['endurance', 'fat_loss', 0.1],
    ] as const;
    // Grundbedarf unabhängig: Mifflin (Vorschlag, −78 bei divers/ohne Angabe) × Alltagsfaktor
    const offset = { male: 5, female: -161 } as const;
    const factor = { sedentary: 1.45, very_active: 2.2 } as const;
    let checked = 0;
    for (const [p, age, sex, level] of [
      [A, 35, 'male', 'sedentary'],
      [B, 30, 'female', 'sedentary'],
      [C, 66, 'male', 'sedentary'],
      [H, 30, 'female', 'very_active'],
    ] as const) {
      const row = p.bodyMetricsRows![0]!;
      const baseNeeds = (kg: number) =>
        (10 * kg + 6.25 * row.heightCm! - 5 * age + offset[sex]) * factor[level];
      for (const [goalType, secondaryGoalType, deficit] of selections) {
        for (const target of [row.weightKg! - 3, row.weightKg! - 8]) {
          const cap = weightGoalCapacity(
            { ...p, goalType, secondaryGoalType },
            { targetWeightKg: target, targetDate: addDays(TODAY, 140) },
          );
          expect(cap.kcal).toBe(Math.min(cap.todayKcal, cap.atTargetKcal));
          expect(cap.todayKcal).toBeLessThanOrEqual(deficit * baseNeeds(row.weightKg!) + 1e-9);
          expect(cap.atTargetKcal).toBeLessThanOrEqual(deficit * baseNeeds(target) + 1e-9);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(4 * 6 * 2);
    // A: D(heute) = 0,2 × 2.689,75 (Standard greift voll), am Ziel 0,2 × 2.544,75
    const capA = weightGoalCapacity(A, { targetWeightKg: 80, targetDate: addDays(TODAY, 84) });
    expect(capA.todayKcal).toBeCloseTo(0.2 * 2689.75, 6);
    expect(capA.atTargetKcal).toBeCloseTo(0.2 * 2544.75, 6);
  });

  it('D_C = 0 an einer echten Person: Stand am Ziel mit BMI < 18,5 (Erhalt, Untergrenze = Grundbedarf) → kein Defizit planbar (Wächter Z2 K-4c)', () => {
    const p = person({
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 70 }],
    });
    const cap = weightGoalCapacity(p, { targetWeightKg: 59, targetDate: addDays(TODAY, 140) });
    expect(cap.atTargetKcal).toBe(0);
    expect(cap.kcal).toBe(0);
    expect(hasPlannableDeficit(cap.kcal)).toBe(false);
    // Die Ampel selbst lehnt dieses Ziel schon früher ab (Ziel-BMI 18,2).
    expect(rate(p, 59, 20)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
  });

  it('Geburtstag mit 65 im Zeitraum senkt C (15-%-Deckel am Ziel)', () => {
    // 64 J. heute, 65 ab 01.03.2027 – Zieldatum 26 Wochen später (12.04.2027)
    const p = person({ birthDate: '1962-03-01' });
    const before = rated(rate(p, 80, 19)); // Zieldatum 22.02.2027, noch 64
    const after = rated(rate(p, 80, 26)); // Zieldatum 12.04.2027, schon 65
    expect(before.capacity.atTargetAgeYears).toBe(64);
    expect(after.capacity.atTargetAgeYears).toBe(65);
    expect(after.capacity.kcal).toBeLessThan(before.capacity.kcal);
    expect(after.capacityPace).toBeLessThan(before.capacityPace);
  });

  it('N mit dem Alter am Ende der sicheren Dauer: N wächst, wenn der 65. Geburtstag erst nach dem Zieldatum, aber vor N liegt', () => {
    const p = person({ birthDate: '1962-03-01' }); // 65 ab 01.03.2027
    // Zieldatum 12 Wochen (04.01.2027, 64 J.); N ohne Altersschleife 22 Wochen (15.03.2027, schon 65)
    const r = rated(rate(p, 80, 12));
    expect(r.capacity.atTargetAgeYears).toBe(64);
    const plain = Math.ceil(10 / Math.min(r.capacityKgPerWeek, 0.0075 * 85) - 1e-9);
    expect(r.safeWeeks!).toBeGreaterThan(plain);
    const at65 = restDayStandardDeficitKcal(p, { weightKg: 80, ageYears: 65 });
    expect(r.safeWeeks).toBe(Math.ceil(10 / ((at65 * 7) / 7700) - 1e-9));
  });

  it('Körperfett am Ziel: gleicher Prozentwert bei Messung ≤ 90 Tage, sonst Mifflin (genau 90 und 91 Tage)', () => {
    const withFat = (measuredOn: string) =>
      person({
        bodyMetricsRows: [
          { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 },
          { measuredOn, bodyFatPct: 25 },
        ],
      });
    const goal = { targetWeightKg: 80, targetDate: addDays(TODAY, 140) };
    const day90 = weightGoalCapacity(withFat(addDays(TODAY, -90)), goal);
    const day91 = weightGoalCapacity(withFat(addDays(TODAY, -91)), goal);
    const none = weightGoalCapacity(A, goal);
    // Katch am Ziel: 370 + 21,6 × 80 × 0,75 = 1.666 → Grundbedarf × 1,45 = 2.415,7 → 20 % = 483,14 (Untergrenzen
    // greifen nicht)
    expect(day90.atTargetKcal).toBeCloseTo(0.2 * (370 + 21.6 * 80 * 0.75) * 1.45, 6);
    expect(day90.todayKcal).toBeCloseTo(0.2 * (370 + 21.6 * 90 * 0.75) * 1.45, 6);
    expect(day91).toEqual(none);
  });

  it('divers / ohne Angabe: Grundbedarf mit −78, Untergrenzen mit +5 → kleineres oder gleiches D als männlich', () => {
    const goal = { targetWeightKg: 80, targetDate: addDays(TODAY, 140) };
    for (const sex of ['diverse', null] as const) {
      const cap = weightGoalCapacity(person({ sex }), goal);
      expect(cap.kcal).toBeLessThanOrEqual(weightGoalCapacity(A, goal).kcal);
      expect(cap.kcal).toBeGreaterThan(0);
    }
  });

  it('Sonderfall-Deckel senken C: 15 % (Medikamente, kein Check männlich, ab 65), 10 % (Ziel-BMI unter 20)', () => {
    const goal = { targetWeightKg: 80, targetDate: addDays(TODAY, 140) };
    const base = weightGoalCapacity(A, goal).kcal;
    for (const p of [
      person({ healthFlags: { flags: ['medication'] } }),
      person({ healthFlags: { flags: ['medical_clearance_recommended'] } }),
      person({ healthFlags: null }),
      C,
    ]) {
      const cap = weightGoalCapacity(p, goal);
      expect(cap.kcal).toBeLessThan(base);
      // Stand am Ziel: Untergrenze 15 % unter TagesbedarfGrenze (Mifflin für Grenzen × 1,45) – D = 0,15 × …
      expect(cap.kcal).toBeGreaterThan(0);
    }
    // Ziel BMI 19,5 bei 180 cm (63,2 kg): am Ziel 10-%-Deckel → D(am Ziel) ≤ 10 % der TagesbedarfGrenze
    const low = weightGoalCapacity(
      person({ bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 70 }] }),
      {
        targetWeightKg: 63.2,
        targetDate: addDays(TODAY, 140),
      },
    );
    const tdeeAtTarget = (10 * 63.2 + 6.25 * 180 - 5 * 35 + 5) * 1.45;
    expect(low.atTargetKcal).toBeCloseTo(0.1 * tdeeAtTarget, 6);
  });
});

describe('Sichere Dauer N (Wächter S2, S3, S9)', () => {
  it('nach „Zeitraum übernehmen“ ist die Stufe immer Gelb oder Grün – auch bei C > 0,75 % (Raster)', () => {
    let checked = 0;
    for (const sex of ['male', 'female', 'diverse', null] as const) {
      for (const activityLevel of ['sedentary', 'light', 'active', 'very_active', null] as const) {
        for (const [cm, kg] of [
          [165, 55],
          [165, 62],
          [180, 90],
          [190, 140],
          [156, 50],
        ] as const) {
          for (const lose of [1, 3, 8, 20]) {
            for (const weeks of [4, 8, 16]) {
              const p = person({
                sex,
                activityLevel,
                bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: cm, weightKg: kg }],
              });
              const r = rate(p, kg - lose, weeks);
              if (r.state !== 'rated') continue;
              if (r.level === 'orange_calmer' || r.level === 'orange_slower' || r.level === 'red') {
                // N ≥ Wunschwochen bei Orange und Rot
                if (r.safeWeeks !== null) expect(r.safeWeeks).toBeGreaterThanOrEqual(weeks);
                if (r.suggestedWeeks === null) continue;
                const after = rated(rate(p, kg - lose, r.suggestedWeeks));
                expect(['green', 'yellow']).toContain(after.level);
                checked += 1;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('Knopf = max(N, 4) – bei Orange/Rot ist N ≥ Wunschwochen ≥ 4, der Knopf also nie unter 4 Wochen', () => {
    // Gelb-Grenze 0,75 % × m bindet (C groß): w0 = 62, Δ = 4 → m = 60, 4 / 0,45 = 8,89 → N = 9
    const p = person({
      sex: 'female',
      birthDate: '1996-09-01',
      activityLevel: 'very_active',
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 165, weightKg: 62 }],
    });
    const r = rated(rate(p, 58, 4));
    expect(r.level).toBe('red');
    expect(r.safeWeeks).toBe(9);
    expect(r.suggestedWeeks).toBe(9);
    // 1 kg: N = ceil(1 / (0,0075 × 61,5)) = ceil(2,17) = 3 < 4 – aber Grün, daher kein Knopf
    const small = rated(rate(p, 61, 4));
    expect(small.safeWeeks).toBe(3);
    expect(small.level).toBe('green');
    expect(small.suggestedWeeks).toBeNull();
  });

  it('ceil mit EPS: ein Quotient genau ganzzahlig (± Gleitkomma-Rest) ergibt keine Woche zu viel', () => {
    // Direkter Nachweis an der Formel: 9 + 1e-12 → 9, 9 + 1e-6 → 10
    const ceilEps = (q: number) => Math.ceil(q - 1e-9);
    expect(ceilEps(9)).toBe(9);
    expect(ceilEps(9 + 1e-12)).toBe(9);
    expect(ceilEps(9 + 1e-6)).toBe(10);
    // An einer echten Person mit 0,75 % × m als Bindung: Δ = 0,0675 × m exakt für m = 80 → Δ = 5,4, w0 = 82,7
    const p = person({
      sex: 'female',
      birthDate: '1996-09-01',
      activityLevel: 'very_active',
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 82.7 }],
    });
    const r = rated(rate(p, 77.3, 4));
    expect(r.capacityKgPerWeek).toBeGreaterThan(0.0075 * 80);
    expect(r.safeWeeks).toBe(9);
  });
});

describe('Verfügbarkeit und unzulässige Ziele (Plan 2.3)', () => {
  it('ohne Einwilligung, ohne Gewicht/Größe, ohne Abnehmen, altes Gewicht, Untergewicht, ohne Check (weiblich)', () => {
    expect(weightGoalAvailability(person({ healthDataConsent: false }))).toEqual({
      available: false,
      reason: 'no_consent',
    });
    expect(weightGoalAvailability(person({ bodyMetricsRows: [] }))).toEqual({
      available: false,
      reason: 'body_data_missing',
    });
    expect(weightGoalAvailability(person({ goalType: 'definition' }))).toEqual({
      available: false,
      reason: 'not_fat_loss',
    });
    // Nebenziel Abnehmen zählt
    expect(
      weightGoalAvailability(person({ goalType: 'muscle_gain', secondaryGoalType: 'fat_loss' }))
        .available,
    ).toBe(true);
    const outdated = (days: number) =>
      person({
        bodyMetricsRows: [{ measuredOn: addDays(TODAY, -days), heightCm: 180, weightKg: 90 }],
      });
    expect(weightGoalAvailability(outdated(90)).available).toBe(true);
    expect(weightGoalAvailability(outdated(91))).toEqual({
      available: false,
      reason: 'weight_outdated',
    });
    expect(
      weightGoalAvailability(
        person({ bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 59.9 }] }),
      ),
    ).toEqual({ available: false, reason: 'underweight' });
    expect(weightGoalAvailability(person({ sex: 'female', healthFlags: null }))).toEqual({
      available: false,
      reason: 'health_check_missing',
    });
    // Ohne Check, männlich: erlaubt (15-%-Deckel senkt C)
    expect(weightGoalAvailability(person({ healthFlags: null })).available).toBe(true);
  });

  it('Alter tagesgenau: 17 J. 364 Tage gesperrt, 18 J. erlaubt; 65 und 100 erlaubt', () => {
    expect(weightGoalAvailability(person({ birthDate: '2008-10-13' }))).toEqual({
      available: false,
      reason: 'minor',
    });
    expect(weightGoalAvailability(person({ birthDate: '2008-10-12' })).available).toBe(true);
    expect(weightGoalAvailability(person({ birthDate: '1961-10-12' })).available).toBe(true);
    const old = rated(rate(person({ birthDate: '1926-10-12' }), 80, 52));
    expect(old.capacity.kcal).toBeGreaterThan(0);
  });

  it('Ziel-BMI unter 70 J.: 18,5 / 19,99 → Fehler, 20 → bewertet (F8)', () => {
    const p = person({
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 200, weightKg: 100 }],
    });
    // 200 cm: BMI = kg / 4
    expect(rate(p, 74, 52)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p, 79.96, 52)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p, 80, 52).state).toBe('rated');
    expect(minTargetBmiFor(16)).toBe(20);
    expect(minTargetBmiFor(69)).toBe(20);
  });

  it('Ziel-BMI ab 70 J. (Alter am Zieldatum): 21,99 → Fehler, 22 → bewertet; mit 69 J. gilt 20 (F8)', () => {
    const body = { bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 200, weightKg: 100 }] };
    // 70 J. am 01.09.2026 – schon heute 70
    const p70 = person({ ...body, birthDate: '1956-09-01' });
    expect(rate(p70, 87.96, 52)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p70, 88, 52).state).toBe('rated');
    // 69 J. bis 31.08.2027: Zieldatum 26 Wochen später (12.04.2027) → Grenze 20
    const p69 = person({ ...body, birthDate: '1957-09-01' });
    expect(rate(p69, 80, 26).state).toBe('rated');
    expect(rate(p69, 79.96, 26)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    // dieselbe Person, Zieldatum nach dem 70. Geburtstag (52 Wochen → 11.10.2027) → Grenze 22
    expect(rate(p69, 80, 52)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(rate(p69, 88, 52).state).toBe('rated');
    expect(minTargetBmiFor(70)).toBe(22);
    expect(minTargetBmiFor(100)).toBe(22);
  });

  it('Menge: Ziel = aktuelles Gewicht, 0,9 kg und 1 kg; Zielgewicht außerhalb 30–300 kg', () => {
    expect(rate(A, 90, 12)).toEqual({ state: 'invalid', reasons: ['not_below_current'] });
    expect(rate(A, 95, 12)).toEqual({ state: 'invalid', reasons: ['not_below_current'] });
    expect(rate(A, 89.1, 12)).toEqual({ state: 'invalid', reasons: ['below_min_kg'] });
    expect(rated(rate(A, 89, 12)).kgToLose).toBeCloseTo(1, 12);
    const light = person({
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 100, weightKg: 31 }],
    });
    expect(rate(light, 29.9, 12)).toEqual({ state: 'invalid', reasons: ['target_out_of_range'] });
  });

  it('Zeitraum 3 / 4 / 104 / 105 Wochen und Datum heute + 27 / 28 Tage', () => {
    expect(rate(A, 80, 3)).toEqual({ state: 'invalid', reasons: ['period_out_of_range'] });
    expect(rate(A, 80, 4).state).toBe('rated');
    expect(rate(A, 80, 104).state).toBe('rated');
    expect(rate(A, 80, 105)).toEqual({ state: 'invalid', reasons: ['period_out_of_range'] });
    const byDate = (days: number) =>
      weightGoalFeasibility(A, { targetWeightKg: 80, targetDate: addDays(TODAY, days) });
    expect(byDate(27)).toEqual({ state: 'invalid', reasons: ['period_out_of_range'] });
    expect(byDate(28).state).toBe('rated');
    expect(byDate(0)).toEqual({ state: 'invalid', reasons: ['period_out_of_range'] });
    expect(byDate(-5)).toEqual({ state: 'invalid', reasons: ['period_out_of_range'] });
  });

  it('Gewichte 30 / 45 / 200 / 300 kg: erwarteter Zustand je Fall festgeschrieben (Wächter Z2 K-4b)', () => {
    const at = (cm: number, kg: number, target: number) =>
      rate(
        person({ bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: cm, weightKg: kg }] }),
        target,
        52,
      );
    for (const [cm, kg, target, kcal] of [
      [120, 31, 30, 253.75],
      [190, 200, 180, 815.625],
      [250, 300, 280, 1214.375],
    ] as const) {
      const r = rated(at(cm, kg, target));
      expect(r.level).toBe('green');
      expect(r.capacity.kcal).toBeCloseTo(kcal, 6);
      expect(r.capacityKgPerWeek).toBeLessThanOrEqual(0.01 * kg + 1e-9);
    }
    // 156 cm: 45 kg (BMI 18,49) und 48,6 kg (BMI 19,97) → unzulässig (F8); 48,7 kg (BMI 20,01) → bewertet
    expect(at(156, 46, 45)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(at(156, 50, 48.6)).toEqual({ state: 'invalid', reasons: ['target_bmi_too_low'] });
    expect(at(156, 50, 48.7).state).toBe('rated');
  });
});
