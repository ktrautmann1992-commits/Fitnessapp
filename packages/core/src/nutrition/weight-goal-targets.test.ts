/**
 * Abnehmziel in der Ernährungs-Engine (docs/PLAN-ZIELE.md 2.4, Etappe Z2): `nutritionTargetsForWeek` mit
 * `weightGoal`. Rechenbeispiel A (3.3) wörtlich: Die Engine plant am ersten Tag 538 / 423 / 500 / 524 kcal Defizit
 * (12 / 26 / 22 / 21 Wochen) – nie mehr als die Standard-Anpassung (F5).
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { WeightGoal } from '../goals/weight-goal-schema';
import { weightGoalFeasibility } from '../goals/weight-goal-feasibility';
import type { NutritionInputsInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, run, session } from './test-helpers';

const BASE_NEEDS_A = (10 * 90 + 6.25 * 180 - 5 * 35 + 5) * 1.45; // 2.689,75

function personA(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return inputs({
    birthDate: '1991-09-01',
    goalType: 'fat_loss',
    bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 }],
    ...overrides,
  });
}

function goalIn(weeks: number, targetWeightKg = 80, startDate = MONDAY): WeightGoal {
  return {
    targetWeightKg,
    startDate,
    targetDate: addDays(startDate, weeks * 7),
    amountMode: 'kg_to_lose',
    timeMode: 'weeks',
  };
}

const week = (p: NutritionInputsInput, monday = MONDAY, adjustmentKcal = 0) =>
  nutritionTargetsForWeek(p, monday, { adjustmentKcal });

describe('Rechenbeispiel A in der Engine (Plan 3.3, 2.4)', () => {
  it.each([
    [12, 537.95, 2150, true],
    [26, 423.08, 2270, false],
    [22, 500, 2190, false],
    [21, 523.81, 2170, false],
  ] as const)(
    '%i Wochen: Defizit am ersten Tag ≈ %f kcal, Ziel %i kcal',
    (weeks, deficit, target, cappedDay1) => {
      const day = week(personA({ weightGoal: goalIn(weeks) })).days[0]!;
      expect(day.weightGoalStatus).toBe('active');
      expect(-day.goalAdjustment! * BASE_NEEDS_A).toBeCloseTo(deficit, 2);
      expect(day.targetKcal).toBe(target);
      expect(day.weightGoalPaceCapped).toBe(cappedDay1);
    },
  );

  it('ohne konkretes Ziel unverändert: Standard −20 %, kein Status, keine Hinweise', () => {
    const plain = week(personA());
    expect(plain.weightGoalNotices).toEqual([]);
    for (const day of plain.days) {
      expect(day.goalAdjustment).toBe(-0.2);
      expect(day.weightGoalStatus).toBeNull();
      expect(day.weightGoalPaceCapped).toBe(false);
      expect(day.targetKcal).toBe(2150);
    }
    // `weightGoal: null` ist gleichbedeutend mit „fehlt“ (Wächter B1)
    expect(week(personA({ weightGoal: null }))).toEqual(plain);
  });

  it('Ampel und Engine passen zusammen (Wächter S4, Z2 S-1): Grün / Gelb / Orange „ruhiger“ → in der Woche ab dem Speichern kein `pace_capped` an Ruhetagen', () => {
    const H = inputs({
      goalType: 'fat_loss',
      sex: 'female',
      birthDate: '1996-09-01',
      activityLevel: 'very_active',
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 165, weightKg: 62 }],
    });
    for (const [person, target, weeks, level] of [
      [personA(), 80, 26, 'green'],
      [personA(), 80, 22, 'yellow'],
      [H, 59, 6, 'orange_calmer'],
      [H, 59, 7, 'yellow'],
    ] as const) {
      const goal = goalIn(weeks, target);
      const rating = weightGoalFeasibility(person, goal);
      expect(rating.state === 'rated' && rating.level).toBe(level);
      const w = week({ ...person, weightGoal: goal });
      const first = w.days[0]!.goalAdjustment!;
      for (const day of w.days) {
        expect(day.weightGoalStatus).toBe('active');
        expect(day.weightGoalPaceCapped).toBe(false);
        // ohne neue Messung kein schleichendes Verschärfen
        expect(day.goalAdjustment).toBe(first);
      }
      expect(w.weightGoalNotices).toEqual([]);
    }
  });

  it('Orange „langsamer“ / Rot: die Engine bremst und meldet es – sofort (12 / 6 Wochen) bzw. sobald v_S unter v_r fällt (21 Wochen)', () => {
    for (const weeks of [12, 6]) {
      const w = week(personA({ weightGoal: goalIn(weeks) }));
      expect(w.days[0]!.weightGoalPaceCapped).toBe(true);
      expect(w.weightGoalNotices).toEqual(['weight_goal_pace_capped']);
    }
    // 21 Wochen: Woche 1 im Wunschtempo (524 < 538 kcal) …
    expect(week(personA({ weightGoal: goalIn(21) })).weightGoalNotices).toEqual([]);
    // … nach 15 Wochen mit 84 kg (frisch gemessen) sind 4 kg in 6 Wochen nötig (733 kcal/Tag), der Standard liefert
    // nur 20 % des kleineren Grundbedarfs → die Engine bremst, Hinweis einmal je Woche.
    const monday = addDays(MONDAY, 15 * 7);
    const later = week(
      personA({
        today: monday,
        bodyMetricsRows: [{ measuredOn: monday, heightCm: 180, weightKg: 84 }],
        weightGoal: goalIn(21),
      }),
      monday,
    );
    for (const day of later.days) {
      expect(day.weightGoalPaceCapped).toBe(true);
      expect(day.goalAdjustment).toBe(-0.2);
    }
    expect(later.weightGoalNotices).toEqual(['weight_goal_pace_capped']);
  });

  it('Tage vor dem Start des Ziels: kein Ziel (Wächter Z2 K-1)', () => {
    const w = week(personA({ today: '2026-10-15', weightGoal: goalIn(26, 80, '2026-10-15') }));
    for (const day of w.days.slice(0, 3)) {
      expect(day.weightGoalStatus).toBeNull();
      expect(day.goalAdjustment).toBe(-0.2);
    }
    for (const day of w.days.slice(3)) expect(day.weightGoalStatus).toBe('active');
  });

  it('`pace_capped` auch, wenn eine Schutzgrenze das Defizit weiter verkleinert (15-%-Deckel ab 65, Beispiel C)', () => {
    const c = personA({ birthDate: '1960-09-01', weightGoal: goalIn(26) });
    const w = week(c);
    // r ≈ 0,385 kg/Woche = 423 kcal/Tag < Standard (493), aber 15 % unter TagesbedarfGrenze (2.465) = 369,75
    const day = w.days[0]!;
    expect(day.weightGoalPaceCapped).toBe(true);
    expect(day.appliedCaps).toContain('special_case_cap');
    expect(w.weightGoalNotices).toEqual(['weight_goal_pace_capped']);
  });
});

describe('Lebenszyklus des Ziels (Plan 2.4, 6 Nr. 4)', () => {
  it('erreicht → Erhalt (Anpassung 0) bis zur Wahl; Gewicht danach wieder höher bleibt „erreicht“ (S8)', () => {
    const rows = [
      { measuredOn: '2026-10-10', heightCm: 180, weightKg: 80.3 },
      { measuredOn: '2026-10-13', weightKg: 79.9 },
      { measuredOn: '2026-10-15', weightKg: 80.2 },
    ];
    const p = personA({
      today: '2026-10-16',
      bodyMetricsRows: rows,
      weightGoal: goalIn(20, 80, '2026-10-01'),
    });
    const w = week(p);
    expect(w.days[0]!.weightGoalStatus).toBe('active'); // Mo 12.10.: noch keine Messung ≤ 80
    for (const day of w.days.slice(1)) {
      expect(day.weightGoalStatus).toBe('reached');
      expect(day.goalAdjustment).toBe(0);
    }
    expect(w.weightGoalNotices).toEqual(['weight_goal_reached']);
  });

  it('Datum abgelaufen → Standard-Anpassung wie „ohne festes Ziel“ und Hinweis', () => {
    const p = personA({
      today: '2027-01-04',
      bodyMetricsRows: [{ measuredOn: '2027-01-01', heightCm: 180, weightKg: 86 }],
      weightGoal: goalIn(12, 80, '2026-10-12'), // Zieldatum 04.01.2027
    });
    const w = week(p, '2027-01-04');
    const plain = week({ ...p, weightGoal: null }, '2027-01-04');
    for (const [i, day] of w.days.entries()) {
      expect(day.weightGoalStatus).toBe('date_passed');
      expect(day.targetKcal).toBe(plain.days[i]!.targetKcal);
    }
    expect(w.weightGoalNotices).toEqual(['weight_goal_date_passed']);
  });

  it('am Tag vor dem Zieldatum aktiv, am Zieldatum abgelaufen (S7)', () => {
    const p = personA({ weightGoal: { ...goalIn(4), targetDate: addDays(MONDAY, 31) } }); // Do 12.11.
    const w = week(p, '2026-11-09');
    expect(w.days[2]!.weightGoalStatus).toBe('active'); // Mi 11.11. (Anker = Start: 10 kg in 31 Tagen → gebremst)
    expect(w.days[3]!.weightGoalStatus).toBe('date_passed'); // Do 12.11.
    expect(w.weightGoalNotices).toEqual(['weight_goal_date_passed', 'weight_goal_pace_capped']);
  });

  it('Größe nachträglich geändert → Ziel-BMI unzulässig → ignoriert, Hinweis, keine Ampel (S14)', () => {
    const rows = [
      { measuredOn: '2026-10-01', heightCm: 180, weightKg: 75 },
      { measuredOn: '2026-10-10', heightCm: 195 },
    ];
    const goal = goalIn(20, 70); // BMI 21,6 bei 180 cm, aber 18,4 bei 195 cm
    const p = personA({ bodyMetricsRows: rows, weightGoal: goal });
    const w = week(p);
    const plain = week({ ...p, weightGoal: null });
    for (const [i, day] of w.days.entries()) {
      expect(day.weightGoalStatus).toBe('invalid');
      expect(day.targetKcal).toBe(plain.days[i]!.targetKcal);
    }
    expect(w.weightGoalNotices).toEqual(['weight_goal_invalid']);
    expect(weightGoalFeasibility(p, goal)).toEqual({
      state: 'invalid',
      reasons: ['target_bmi_too_low'],
    });
  });

  it('bestehendes Ziel gerät zur Laufzeit in `no_deficit` (Medikament neu, Körperfett gemessen) → sicher weiter, Hinweis (K-d)', () => {
    const p = personA({
      bodyMetricsRows: [
        { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: 39.3 },
      ],
      healthFlags: { flags: ['medication'] },
      weightGoal: goalIn(30),
    });
    const w = week(p);
    const plain = week({ ...p, weightGoal: null });
    for (const [i, day] of w.days.entries()) {
      expect(day.weightGoalStatus).toBe('no_deficit');
      expect(day.targetKcal).toBe(plain.days[i]!.targetKcal);
      expect(day.targetKcal!).toBeGreaterThanOrEqual(day.floorKcal! - 1e-9);
    }
    expect(w.weightGoalNotices).toEqual(['weight_goal_no_deficit']);
  });

  it('Schwangerschaft → Ziel ruht (keine Zahlen); ohne Einwilligung wird das Ziel nicht gelesen', () => {
    const pregnant = week(
      personA({ weightGoal: goalIn(20), healthFlags: { flags: ['pregnancy'] } }),
    );
    for (const day of pregnant.days) {
      expect(day.weightGoalStatus).toBe('paused');
      expect(day.targetKcal).toBeNull();
    }
    expect(pregnant.weightGoalNotices).toEqual([]);
    // Einheitliche Reihenfolge (Wächter Z2 K-3): ein ungültiges Ziel ist auch an Tagen ohne Zahlen `invalid`.
    const pregnantInvalid = week(
      personA({
        goalType: 'definition',
        weightGoal: goalIn(20),
        healthFlags: { flags: ['pregnancy'] },
      }),
    );
    for (const day of pregnantInvalid.days) expect(day.weightGoalStatus).toBe('invalid');
    expect(pregnantInvalid.weightGoalNotices).toEqual(['weight_goal_invalid']);
    const noConsent = week(personA({ weightGoal: goalIn(20), healthDataConsent: false }));
    for (const day of noConsent.days) expect(day.weightGoalStatus).toBeNull();
    expect(noConsent.weightGoalNotices).toEqual([]);
  });

  it('unter 18 (Geburtstag in der Woche) → Erhalt, Ziel ruht bis zum 18. Geburtstag', () => {
    const w = week(personA({ birthDate: '2008-10-14', weightGoal: goalIn(20) }));
    expect(w.days[0]!.weightGoalStatus).toBe('paused');
    expect(w.days[0]!.mode).toBe('maintenance_only');
    expect(w.days[2]!.weightGoalStatus).toBe('active');
  });

  it('Abnehmen nicht mehr Ziel → Ziel ungültig (Hinweis), Standard des Profils', () => {
    const w = week(personA({ goalType: 'definition', weightGoal: goalIn(20) }));
    for (const day of w.days) {
      expect(day.weightGoalStatus).toBe('invalid');
      expect(day.goalAdjustment).toBe(-0.1);
    }
    expect(w.weightGoalNotices).toEqual(['weight_goal_invalid']);
  });
});

describe('F5 „nie schneller als heute“ mit zwei Zielen und an Trainingstagen', () => {
  it('Muskelaufbau → Abnehmen (−10 %): ein ehrgeiziges Ziel bleibt bei −10 %', () => {
    const w = week(
      personA({ goalType: 'muscle_gain', secondaryGoalType: 'fat_loss', weightGoal: goalIn(8) }),
    );
    for (const day of w.days) expect(day.goalAdjustment).toBe(-0.1);
    expect(w.weightGoalNotices).toEqual(['weight_goal_pace_capped']);
  });

  it('Trainingstage: Defizit bezieht sich auf den Grundbedarf ohne Training, Trainingsenergie kommt dazu', () => {
    const sessions = [session(MONDAY), run(addDays(MONDAY, 2), 60)];
    const withGoal = week(personA({ weightGoal: goalIn(26), sessions }));
    const plain = week(personA({ sessions }));
    for (const [i, day] of withGoal.days.entries()) {
      expect(day.targetKcal!).toBeGreaterThanOrEqual(plain.days[i]!.targetKcal!);
      expect(day.goalAdjustment!).toBeGreaterThanOrEqual(plain.days[i]!.goalAdjustment!);
    }
    expect(withGoal.days[0]!.trainingKcal).toBe(plain.days[0]!.trainingKcal);
  });
});
