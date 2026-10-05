import { describe, expect, it } from 'vitest';

import {
  AGE_PLAN_RULES,
  CONSERVATIVE_PLAN_RULES,
  CONTENT_SCHEMA_LIMITS,
  DELOAD_SCHEDULE,
  LOAD_PROGRESSION,
  PLAN_BLOCK_LIMITS,
  PLAN_MATCH_WEIGHTS,
  DELOAD_INTERVAL_WEEKS,
  ENDURANCE_HIGH_INTENSITY_SHARE,
  MAX_CALORIE_DEFICIT_FRACTION,
  MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION,
  MAX_WEEKLY_WEIGHT_LOSS_FRACTION,
  MIN_AGE_YEARS,
  LARGE_MUSCLE_GROUPS,
  MIN_INTAKE_RELATIVE_TO_BMR,
  PUSH_PULL_TOLERANCE,
  REST_RANGES_S,
  SESSION_DURATION_ESTIMATE,
  SMALL_MUSCLE_GROUPS,
  TEMPLATE_DOSAGE_LIMITS,
  WEEKLY_SET_CONTRIBUTION,
  WEEKLY_SETS_PER_MUSCLE,
} from './constants';
import { MUSCLE_GROUPS } from './enums';

// Diese Tests sichern die Schutzgrenzen aus CLAUDE.md ab: Wer sie lockert, muss bewusst den Test ändern.
describe('Schutzgrenzen aus CLAUDE.md', () => {
  it('Mindestalter 16 Jahre', () => {
    expect(MIN_AGE_YEARS).toBe(16);
  });

  it('Kaloriendefizit höchstens 25 % unter Gesamtumsatz', () => {
    expect(MAX_CALORIE_DEFICIT_FRACTION).toBeLessThanOrEqual(0.25);
    expect(MAX_CALORIE_DEFICIT_FRACTION).toBeGreaterThan(0);
  });

  it('Zufuhr nie unter Grundumsatz', () => {
    expect(MIN_INTAKE_RELATIVE_TO_BMR).toBeGreaterThanOrEqual(1);
  });

  it('Gewichtsverlust höchstens ca. 1 % Körpergewicht pro Woche', () => {
    expect(MAX_WEEKLY_WEIGHT_LOSS_FRACTION).toBeLessThanOrEqual(0.01);
  });

  it('Ausdauer-Wochenumfang höchstens ca. 10 % Steigerung', () => {
    expect(MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION).toBeLessThanOrEqual(0.1);
  });

  it('Deload-Intervall ist plausibel (4–6 Wochen)', () => {
    expect(DELOAD_INTERVAL_WEEKS.min).toBe(4);
    expect(DELOAD_INTERVAL_WEEKS.max).toBe(6);
  });

  it('Intensitätsverteilung ca. 80/20', () => {
    expect(ENDURANCE_HIGH_INTENSITY_SHARE).toBe(0.2);
  });
});

describe('Inhalte (Phase 2)', () => {
  it('Wochensätze: Startwerte laut Plan, min < max', () => {
    expect(WEEKLY_SETS_PER_MUSCLE).toEqual({
      muscle_gain: { beginner: { min: 6, max: 14 }, advanced: { min: 10, max: 22 } },
      fat_loss: { beginner: { min: 6, max: 14 }, advanced: { min: 8, max: 20 } },
      general_fitness: { beginner: { min: 4, max: 12 }, advanced: { min: 6, max: 16 } },
    });
    expect(WEEKLY_SET_CONTRIBUTION).toEqual({ primary: 1, secondary: 0.5 });
  });

  it('große und kleine Muskelgruppen: getrennt und bekannt', () => {
    const large: readonly string[] = LARGE_MUSCLE_GROUPS;
    for (const muscle of SMALL_MUSCLE_GROUPS) {
      expect(large).not.toContain(muscle);
    }
    for (const muscle of [...LARGE_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]) {
      expect(MUSCLE_GROUPS).toContain(muscle);
    }
    expect([...LARGE_MUSCLE_GROUPS].sort()).toEqual(
      ['chest', 'glutes', 'hamstrings', 'lats', 'quadriceps', 'upper_back'].sort(),
    );
  });

  it('fachliche Grenzen (V4) liegen innerhalb der Schema-Grenzen (Ü1)', () => {
    const d = TEMPLATE_DOSAGE_LIMITS;
    const s = CONTENT_SCHEMA_LIMITS;
    expect(d.sets.min).toBeGreaterThanOrEqual(s.sets.min);
    expect(d.sets.max).toBeLessThan(s.sets.max);
    expect(d.reps.min).toBeGreaterThan(s.reps.min);
    expect(d.reps.max).toBeLessThan(s.reps.max);
    expect(d.rpe.max).toBeLessThan(s.rpe.max);
    expect(d.beginnerRpeMax).toBeLessThan(d.rpe.max);
    expect(d.durationS.min).toBeGreaterThan(s.durationS.min);
    expect(d.maxExercisesPerSession).toBeLessThan(s.exercisesPerSession.max);
  });

  it('Pausen und Dauer laut Plan', () => {
    expect(REST_RANGES_S).toEqual({
      compound: { min: 90, max: 240 },
      isolation: { min: 45, max: 120 },
    });
    expect(SESSION_DURATION_ESTIMATE.tolerance).toBe(0.15);
    expect(PUSH_PULL_TOLERANCE).toBe(0.3);
  });
});

describe('Plan-Engine (Phase 3)', () => {
  it('Punkte des Matchings ergeben 100', () => {
    expect(Object.values(PLAN_MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('Deload-Abstände liegen im Rahmen DELOAD_INTERVAL_WEEKS', () => {
    for (const weeks of Object.values(DELOAD_SCHEDULE)) {
      expect(weeks).toBeGreaterThanOrEqual(DELOAD_INTERVAL_WEEKS.min);
      expect(weeks).toBeLessThanOrEqual(DELOAD_INTERVAL_WEEKS.max);
      // Woche 0 + Belastungswochen + Erholungswoche passt in week_no.
      expect(weeks + 1).toBeLessThanOrEqual(PLAN_BLOCK_LIMITS.weekNo.max);
    }
  });

  it('Laststeigerung höchstens 10 %, Puffer innerhalb V4', () => {
    expect(LOAD_PROGRESSION.maxIncreaseFraction).toBeLessThanOrEqual(0.1);
    expect(LOAD_PROGRESSION.holdIncrementS.max).toBeLessThanOrEqual(5);
    expect(LOAD_PROGRESSION.consecutiveSessionsForStep).toBeGreaterThanOrEqual(2);
  });

  it('Vorsichtiger Plan: RPE höchstens 7, keine Sprünge/Wirbelsäulenlast/Technik', () => {
    expect(CONSERVATIVE_PLAN_RULES.rpeMax).toBeLessThanOrEqual(7);
    expect(CONSERVATIVE_PLAN_RULES.excludedCautionTags).toEqual(
      expect.arrayContaining(['high_impact', 'spinal_loading', 'high_skill']),
    );
    expect(AGE_PLAN_RULES.minor.rpeMax).toBeLessThanOrEqual(TEMPLATE_DOSAGE_LIMITS.beginnerRpeMax);
    expect(AGE_PLAN_RULES.senior.rpeMax).toBeLessThanOrEqual(7);
  });

  it('Höchstens 8 Übungen je Einheit wie Regel V8', () => {
    expect(PLAN_BLOCK_LIMITS.exercisesPerSession).toBe(
      TEMPLATE_DOSAGE_LIMITS.maxExercisesPerSession,
    );
  });
});

describe('Trainingstagebuch (Phase 4)', () => {
  it('Tippfehler-Schutz nie lockerer als der direkte Gewichtsschritt', async () => {
    const c = await import('./constants');
    expect(c.WEIGHT_CONFIRM_LIMITS.relativeIncrease).toBeLessThanOrEqual(
      c.LOAD_PROGRESSION.maxIncreaseFraction,
    );
    expect(c.WEIGHT_CONFIRM_LIMITS.absoluteKg.free_weight).toBeLessThan(
      c.WEIGHT_CONFIRM_LIMITS.absoluteKg.barbell,
    );
  });

  it('Kalibrierung ohne RPE = keine Reserve (vorsichtigste Schätzung)', async () => {
    const c = await import('./constants');
    expect(c.CALIBRATION_MISSING_RPE).toBe(c.SET_RPE_LIMITS.max);
  });

  it('Gewicht im Tagebuch = Plausibilitätsgrenze geplanter Lasten', async () => {
    const c = await import('./constants');
    expect(c.SESSION_LOG_LIMITS.weightKg.max).toBe(c.PLANNED_LOAD_LIMITS.targetWeightKg.max);
  });
});

describe('Wiedereinstieg nach Pause (Phase 4, C1)', () => {
  it('nur Senkung in der Anzeige, nie Steigerung; Schwelle 4 Wochen', async () => {
    const c = await import('./constants');
    expect(c.RETURN_AFTER_PAUSE.pauseDays).toBe(28);
    expect(c.RETURN_AFTER_PAUSE.loadFactor).toBeLessThan(1);
    expect(c.RETURN_AFTER_PAUSE.rpeReduction).toBeGreaterThanOrEqual(1);
  });
});
