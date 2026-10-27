/**
 * Sportarten Stufe 1 · Etappe R – Indoor-Rudern (docs/PLAN-SPORTARTEN-STUFE-1.md 2.3, 5, 9 R1): Split/Watt,
 * Plausibilität, Eingabe, MET, Plan-Engine (nur mit Rudergerät, 10-%-Regel, Deload, Start-Deckel, 80/20, harte erst ab
 * Aufbau), aktuelle Sicherheitsregeln und Modi. Erwartete Zahlen bewusst fest (nicht aus constants.ts gerechnet).
 */
import { describe, expect, it } from 'vitest';

import { checkWeekInvariants } from '../adjust/invariants';
import { stored } from '../adjust/test-helpers';
import { addDays } from '../dates';
import { cardioLogFromInput, cardioSpeed } from '../log/cardio';
import { cardioLogSchema } from '../log/schemas';
import { applyModesToEndurance, modeNotices } from '../modes/layer';
import type { PainEffect } from '../modes/pain';
import { travelOnDay } from '../modes/travel';
import { metForSession } from '../nutrition/energy';
import { applyCurrentEnduranceRules, enduranceVariantOf } from '../plan/apply-safety';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { ENDURANCE_TEXTS_DE, enduranceVariant } from '../plan/endurance';
import {
  easyWorkout,
  hardTypesFor,
  rowIntervalKind,
  rowTechniqueWorkout,
  structuredWorkout,
  type WeekEnduranceDay,
  type WeekWorkoutInput,
  weekWorkouts,
} from '../plan/endurance-workouts';
import { generateTrainingPlan, type GeneratedPlan } from '../plan/generate';
import { type HardWorkoutLimits, hardSeconds, stepsFitWorkoutType } from '../plan/intensity';
import { MULTISPORT_TEXTS_DE, sportOfVariant } from '../plan/multisport';
import { planSafetyRules } from '../plan/safety';
import { FULL_HOME, MONDAY, person, repoLibrary } from '../plan/test-library';
import { mapExerciseType, sportForExerciseType } from '../wearables/exercise-types';
import { wearableSessionImportSchema } from '../wearables/schema';
import { sessionFromHc } from '../wearables/sessions';
import { EMPTY_WORKOUT_FILTER, filterWorkouts } from '../workouts/library';
import { makeWorkout } from '../workouts/test-fixtures';
import { parseRowClock, rowValuesFromInput } from './input';
import {
  formatRowSplit,
  hasRowingMachine,
  rowIntervalSummary,
  rowMet,
  rowPlausibility,
  rowSplitFromWatts,
  rowSplitSeconds,
  rowWattsFromSplit,
} from './metrics';

const library = repoLibrary();
const ROWER = { equipmentId: 'rowing_machine' as const, weightsKg: [] as number[] };
type Kind = 'strength_gym' | 'strength_home' | 'endurance';
const fixed = (...days: [number, Kind, number][]) => ({
  mode: 'fixed' as const,
  slots: days.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
});

function plan(overrides: Parameters<typeof person>[0] = {}): GeneratedPlan {
  const result = generateTrainingPlan(person(overrides), library, MONDAY);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}
const endurance = (p: GeneratedPlan) => p.sessions.filter((s) => s.kind === 'endurance');
const rows = (p: GeneratedPlan) => endurance(p).filter((s) => s.endurance_modality === 'row');

describe('Split, Watt und Plausibilität', () => {
  it('Split je 500 m aus Distanz und Zeit; ohne Werte null', () => {
    expect(rowSplitSeconds(480, 2000)).toBe(120);
    expect(rowSplitSeconds(473, 2000)).toBe(118.3);
    expect(rowSplitSeconds(0, 2000)).toBeNull();
    expect(rowSplitSeconds(600, null)).toBeNull();
    expect(rowSplitSeconds(600, 0)).toBeNull();
    expect(rowSplitSeconds(Number.NaN, 500)).toBeNull();
    expect(formatRowSplit(118.3)).toBe('1:58,3');
    expect(formatRowSplit(120)).toBe('2:00');
    expect(formatRowSplit(70)).toBe('1:10');
  });

  it('Concept2-Formel: 2:00 /500 m ≈ 203 W, 1:45 ≈ 302 W; Umkehrung passt', () => {
    expect(rowWattsFromSplit(120)).toBe(203);
    expect(rowWattsFromSplit(105)).toBe(302);
    expect(rowWattsFromSplit(null)).toBeNull();
    expect(rowWattsFromSplit(0)).toBeNull();
    expect(rowSplitFromWatts(203)).toBeCloseTo(120, 0);
    expect(rowSplitFromWatts(0)).toBeNull();
  });

  it('Split 1:10–4:00, Schlagzahl 10–60, höchstens 30 Wiederholungen – sonst nur Hinweis', () => {
    expect(rowPlausibility({ durationS: 480, distanceM: 2000, strokeRate: 24 })).toEqual([]);
    expect(rowPlausibility({ durationS: 140, distanceM: 1000 })).toEqual([]); // 1:10 genau
    expect(rowPlausibility({ durationS: 139, distanceM: 1000 })).toEqual(['split_too_fast']);
    expect(rowPlausibility({ durationS: 480, distanceM: 1000 })).toEqual([]); // 4:00 genau
    expect(rowPlausibility({ durationS: 481, distanceM: 1000 })).toEqual(['split_too_slow']);
    expect(rowPlausibility({ durationS: 600, distanceM: null, strokeRate: 9 })).toEqual([
      'stroke_rate_range',
    ]);
    expect(rowPlausibility({ durationS: 600, distanceM: null, strokeRate: 61 })).toEqual([
      'stroke_rate_range',
    ]);
    expect(rowPlausibility({ durationS: 600, distanceM: null, avgPowerW: 1001 })).toEqual([
      'power_range',
    ]);
    const rep = { distance_m: 500, duration_s: 100 };
    expect(
      rowPlausibility({ durationS: 600, distanceM: null, intervals: Array(31).fill(rep) }),
    ).toEqual(['too_many_intervals']);
    expect(
      rowPlausibility({
        durationS: 600,
        distanceM: null,
        intervals: [rep, { distance_m: 500, duration_s: 30 }],
      }),
    ).toEqual(['split_too_fast']);
  });

  it('Intervall-Ergebnis: je Wiederholung Split, Summe, Durchschnitt, schnellste', () => {
    const summary = rowIntervalSummary([
      { distance_m: 500, duration_s: 120 },
      { distance_m: 500, duration_s: 115 },
      { distance_m: 500, duration_s: 115 },
    ]);
    expect(summary.rows.map((r) => r.splitS)).toEqual([120, 115, 115]);
    expect(summary.totalDistanceM).toBe(1500);
    expect(summary.totalDurationS).toBe(350);
    expect(summary.averageSplitS).toBe(116.7);
    expect(summary.bestNo).toBe(2);
    expect(rowIntervalSummary([]).bestNo).toBeNull();
  });

  it('Live-Anzeige: Rudern zeigt Split je 500 m (kein km/h-Pace)', () => {
    const speed = cardioSpeed('row', 480, 2000);
    expect(speed?.kind).toBe('per_500m');
    expect(speed?.paceS).toBe(120);
    expect(speed?.check).toBe(false);
    expect(cardioSpeed('run', 1800, 5000)?.kind).toBe('per_km');
  });
});

describe('Eingabe (rowValuesFromInput, cardioLogFromInput)', () => {
  it('Zeit „m:ss“ und Sekunden lesen', () => {
    expect(parseRowClock('1:58')).toBe(118);
    expect(parseRowClock('95')).toBe(95);
    expect(parseRowClock('1:02:03')).toBe(3723);
    expect(parseRowClock('')).toBeNull();
    expect(parseRowClock('1:75')).toBeNaN();
    expect(parseRowClock('abc')).toBeNaN();
  });

  it('Watt/Schlagzahl in den Grenzen, halbe Zeilen sind Fehler, leere zählen nicht', () => {
    const ok = rowValuesFromInput({
      avgPowerW: 180,
      strokeRate: 24,
      intervals: [
        { distanceM: 500, durationS: 118 },
        { distanceM: null, durationS: null },
      ],
    });
    expect(ok).toEqual({
      ok: true,
      avgPowerW: 180,
      strokeRate: 24,
      intervals: [{ distance_m: 500, duration_s: 118 }],
    });
    expect(rowValuesFromInput({ avgPowerW: null, strokeRate: null, intervals: [] })).toEqual({
      ok: true,
      avgPowerW: null,
      strokeRate: null,
      intervals: null,
    });
    const bad = rowValuesFromInput({
      avgPowerW: 0,
      strokeRate: 61,
      intervals: [{ distanceM: 500, durationS: null }],
    });
    expect(bad).toEqual({
      ok: false,
      errors: {
        power: 'power_invalid',
        strokeRate: 'stroke_rate_invalid',
        intervals: 'intervals_invalid',
      },
    });
    const many = rowValuesFromInput({
      avgPowerW: null,
      strokeRate: 9.5,
      intervals: Array(31).fill({ distanceM: 500, durationS: 120 }),
    });
    expect(many.ok ? null : many.errors).toEqual({
      strokeRate: 'stroke_rate_invalid',
      intervals: 'intervals_too_many',
    });
  });

  it('cardioLogFromInput: Ruder-Werte nur bei row; ohne Angaben byte-gleich wie bisher', () => {
    const base = { hours: 0, minutes: 20, distanceKm: 5, elevationM: null };
    const result = cardioLogFromInput({
      ...base,
      modality: 'row',
      row: { avgPowerW: 200, strokeRate: 22, intervals: [{ distanceM: 500, durationS: 120 }] },
    });
    expect(result).toEqual({
      ok: true,
      cardio: {
        modality: 'row',
        duration_s: 1200,
        distance_m: 5000,
        elevation_m: null,
        avg_power_w: 200,
        stroke_rate: 22,
        intervals: [{ distance_m: 500, duration_s: 120 }],
      },
    });
    if (result.ok) expect(cardioLogSchema.safeParse(result.cardio).success).toBe(true);
    const plain = cardioLogFromInput({ ...base, modality: 'row' });
    expect(plain).toEqual({
      ok: true,
      cardio: { modality: 'row', duration_s: 1200, distance_m: 5000, elevation_m: null },
    });
    // Beim Laufen bleiben Ruder-Felder unbeachtet (Wechsel der Art im Formular).
    expect(
      cardioLogFromInput({
        ...base,
        modality: 'run',
        row: { avgPowerW: 200, strokeRate: 22, intervals: [] },
      }),
    ).toEqual({
      ok: true,
      cardio: { modality: 'run', duration_s: 1200, distance_m: 5000, elevation_m: null },
    });
    const invalid = cardioLogFromInput({
      ...base,
      modality: 'row',
      row: { avgPowerW: 2000, strokeRate: null, intervals: [] },
    });
    expect(invalid).toEqual({ ok: false, errors: { power: 'power_invalid' } });
  });
});

describe('kcal: MET nach Anstrengung (Entscheidung 8)', () => {
  it('bis 3 niedrig, ab 8 hoch, dazwischen linear; ohne Angabe hoch', () => {
    expect(rowMet(1)).toBe(4.8);
    expect(rowMet(3)).toBe(4.8);
    expect(rowMet(4)).toBe(5.5);
    expect(rowMet(8)).toBe(8.5);
    expect(rowMet(10)).toBe(8.5);
    expect(rowMet(null)).toBe(8.5);
    expect(metForSession({ kind: 'endurance', enduranceModality: 'row', effortTarget: 4 })).toBe(
      5.5,
    );
    // Andere Arten unverändert.
    expect(metForSession({ kind: 'endurance', enduranceModality: 'run', effortTarget: 4 })).toBe(7);
  });
});

describe('Plan ohne Wettkampf: Rudern nur mit Rudergerät', () => {
  const schedule = fixed(
    [1, 'strength_home', 45],
    [2, 'endurance', 30],
    [4, 'endurance', 30],
    [6, 'endurance', 40],
  );

  it('ohne Rudergerät byte-gleich wie bisher (kein Rudern)', () => {
    const without = plan({
      schedule,
      homeEquipment: FULL_HOME.map((e) => ({ ...e, weightsKg: [...e.weightsKg] })),
    });
    expect(rows(without)).toEqual([]);
    expect(hasRowingMachine(FULL_HOME)).toBe(false);
  });

  it('mit Rudergerät: jede zweite Ausdauer-Einheit „Lockeres Rudern“, gleiche Minuten wie ohne', () => {
    const without = plan({
      schedule,
      homeEquipment: FULL_HOME.map((e) => ({ ...e, weightsKg: [...e.weightsKg] })),
    });
    const withRower = plan({
      schedule,
      homeEquipment: [...FULL_HOME.map((e) => ({ ...e, weightsKg: [...e.weightsKg] })), ROWER],
    });
    const a = endurance(without);
    const b = endurance(withRower);
    expect(b.map((s) => s.estimated_minutes)).toEqual(a.map((s) => s.estimated_minutes));
    expect(b.map((s) => s.scheduled_on)).toEqual(a.map((s) => s.scheduled_on));
    b.forEach((s, i) => {
      if (i % 2 === 1) {
        expect(s.endurance_modality).toBe('row');
        expect(s.name_de).toBe('Lockeres Rudern');
        expect(s.warmup_de).toContain('Beine – Rumpf – Arme');
        expect(s.effort_target).toBeLessThanOrEqual(4);
      } else {
        expect(s.endurance_modality).not.toBe('row');
      }
    });
    expect(rows(withRower).length).toBeGreaterThan(0);
    const rules = planSafetyRules(person({ schedule }), MONDAY);
    expect(
      checkWeekInvariants(stored(withRower.sessions), {
        maxLoadWeeks: loadWeeksBeforeDeload('beginner', rules.cautious),
        planStart: withRower.start_date,
      }),
    ).toEqual([]);
  });

  it('1 vs. 7 Ausdauer-Tage, 16 Jahre, sehr leicht/schwer: Wochen-Invarianten halten', () => {
    const cases = [
      { schedule: fixed([3, 'endurance', 30]), birthDate: '2010-01-01' },
      {
        schedule: fixed(
          [1, 'endurance', 30],
          [2, 'endurance', 30],
          [3, 'endurance', 30],
          [4, 'endurance', 30],
          [5, 'endurance', 30],
          [6, 'endurance', 30],
          [7, 'endurance', 60],
        ),
        experienceLevel: 'advanced' as const,
      },
    ];
    for (const extra of cases) {
      const p = plan({ goalType: 'general_fitness', ...extra, homeEquipment: [ROWER] });
      const rules = planSafetyRules(person({ ...extra }), MONDAY);
      expect(
        checkWeekInvariants(stored(p.sessions), {
          maxLoadWeeks: loadWeeksBeforeDeload(extra.experienceLevel ?? 'beginner', rules.cautious),
          planStart: p.start_date,
        }),
      ).toEqual([]);
      expect(
        endurance(p).every((s) => s.workout_type === undefined || s.workout_type === null),
      ).toBe(true);
    }
  });

  it('kein Rudern: Schwangerschaft, Gesundheits-Flag (Arzt-Hinweis), ab 65/80, ohne Gesundheits-Check', () => {
    const flagged = [
      { healthScreening: { flags: ['pregnancy', 'conservative_plan'] as const } },
      {
        healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] as const },
      },
      { birthDate: '1946-01-01' },
      { healthScreening: null },
    ];
    for (const extra of flagged) {
      const p = plan({ schedule, homeEquipment: [ROWER], ...(extra as object) });
      expect(rows(p), JSON.stringify(extra)).toEqual([]);
    }
  });

  it('mit Disziplin (Laufziel) kein Rudern', () => {
    const p = plan({
      goalType: 'endurance',
      discipline: '10k',
      schedule: fixed([2, 'endurance', 30], [4, 'endurance', 30], [6, 'endurance', 40]),
      homeEquipment: [ROWER],
    });
    expect(rows(p)).toEqual([]);
  });

  it('enduranceVariant: nur ohne Disziplin, jede zweite Einheit', () => {
    const rules = planSafetyRules(person(), MONDAY);
    const ctx = { discipline: null, rules, experienceLevel: 'advanced' as const, rowing: true };
    expect([0, 1, 2, 3].map((i) => enduranceVariant(ctx, 3, i))).toEqual([
      'easy_run',
      'easy_row',
      'easy_run',
      'easy_row',
    ]);
    expect(enduranceVariant({ ...ctx, rowing: false }, 3, 1)).toBe('easy_run');
    expect(enduranceVariant({ ...ctx, discipline: 'cycling' }, 3, 1)).toBe('easy_bike');
  });
});

describe('aktuelle Regeln auf gespeicherte Ruder-Einheiten', () => {
  const session = {
    kind: 'endurance' as const,
    name_de: ENDURANCE_TEXTS_DE.names.easy_row,
    endurance_modality: 'row' as const,
    effort_target: 4,
    estimated_minutes: 40,
    warmup_de: ENDURANCE_TEXTS_DE.warmup.easy_row,
    cooldown_de: ENDURANCE_TEXTS_DE.cooldown.easy_row,
  };

  it('Variante aus Name bzw. Art (kein Provisorium mehr „Rad“)', () => {
    expect(enduranceVariantOf(session)).toBe('easy_row');
    expect(enduranceVariantOf({ ...session, name_de: 'Ruder-Intervalle' })).toBe('easy_row');
    expect(sportOfVariant('easy_row')).toBe('row');
  });

  it('Schwangerschaft bzw. „nur Gehen“ → zügiges Gehen; sonst bleibt Rudern', () => {
    const base = planSafetyRules(person(), MONDAY);
    const pregnant = planSafetyRules(
      person({ healthScreening: { flags: ['pregnancy', 'conservative_plan'] } }),
      MONDAY,
    );
    const ctx = { previousStartGroup: base.enduranceStartGroup };
    expect(applyCurrentEnduranceRules(session, base, ctx).endurance_modality).toBe('row');
    const changed = applyCurrentEnduranceRules(session, pregnant, ctx);
    expect(changed.endurance_modality).toBe('walk');
    expect(changed.name_de).toBe(ENDURANCE_TEXTS_DE.names.brisk_walk);
  });
});

describe('Rudern im Wochenbau (weekWorkouts, Sportart row)', () => {
  const GENERAL: HardWorkoutLimits = {
    allowed: true,
    effortCap: 8,
    perWeek: 2,
    countWorkOnly: false,
  };
  const on = (weekday: number) => addDays(MONDAY, weekday - 1);
  const week = (days: [number, number][], overrides: Partial<WeekWorkoutInput> = {}) =>
    weekWorkouts({
      phase: 'build',
      recoveryWeek: false,
      level: 'advanced',
      limits: GENERAL,
      discipline: '10k',
      easyEffort: 4,
      days: days.map(([weekday, minutes]): WeekEnduranceDay => ({
        date: on(weekday),
        minutes,
        variant: 'easy_row',
      })),
      longRunDate: null,
      blockedDates: new Set(),
      pace: null,
      ...overrides,
    });
  const total = (steps: readonly { seconds: number }[]) =>
    steps.reduce((s, st) => s + st.seconds, 0);

  it('harte Arten: Basis keine, Aufbau Tempo + Intervalle (500 m), Spitze 1000 m, Tapering 30/30', () => {
    expect(hardTypesFor('base', 'advanced', 'row')).toEqual([]);
    expect(hardTypesFor('build', 'beginner', 'row')).toEqual(['fartlek']);
    expect(hardTypesFor('build', 'advanced', 'row')).toEqual(['tempo', 'intervals']);
    expect(rowIntervalKind('build')).toBe('m500');
    expect(rowIntervalKind('peak')).toBe('m1000');
    expect(rowIntervalKind('taper')).toBe('s30');
  });

  it('Aufbau: Ruder-Texte, Schritte = Dauer, 80/20 eingehalten, nie zwei harte Tage hintereinander', () => {
    const planned = week([
      [1, 40],
      [3, 40],
      [5, 40],
      [7, 30],
    ]);
    const hard = planned.filter((w) => ['fartlek', 'tempo', 'intervals'].includes(w.type));
    expect(hard.length).toBeGreaterThan(0);
    for (const w of planned) {
      expect(total(w.steps)).toBe(w.minutes * 60);
      expect(stepsFitWorkoutType(w.type, w.steps)).toBe(true);
      expect(Object.values(MULTISPORT_TEXTS_DE.row.names)).toContain(w.name_de);
      expect(w.target_distance_m).toBeNull();
    }
    const hardS = planned.reduce((sum, w) => sum + hardSeconds(w.steps, false), 0);
    const weekS = planned.reduce((sum, w) => sum + w.minutes * 60, 0);
    expect(hardS).toBeLessThanOrEqual(Math.floor(weekS * 0.2));
    const intervals = planned.find((w) => w.type === 'intervals');
    if (intervals) expect(intervals.main_de).toContain('500 m');
  });

  it('Erholungswoche und Woche 0: nichts Hartes; Basis: Technik', () => {
    for (const overrides of [{ recoveryWeek: true }, { weekZero: true }]) {
      const planned = week(
        [
          [1, 40],
          [3, 40],
          [5, 40],
        ],
        overrides,
      );
      expect(planned.every((w) => w.effort_target <= 4)).toBe(true);
    }
    const base = week(
      [
        [1, 40],
        [3, 40],
      ],
      { phase: 'base' },
    );
    expect(base[0]?.name_de).toBe('Rudertechnik');
    expect(base[0]?.type).toBe('easy');
    expect(base[1]?.name_de).toBe('Lockeres Rudern');
  });

  it('Intervalle: 4–8 × 500 m, 3–5 × 1000 m, 10–15 × 30/30; zu kurz → null', () => {
    const opts = (phase: 'build' | 'peak' | 'taper') => ({
      easyEffort: 4,
      limits: GENERAL,
      level: 'advanced' as const,
      discipline: '10k' as const,
      hardBudgetS: 99_999,
      sport: 'row' as const,
      phase,
    });
    const reps = (w: ReturnType<typeof structuredWorkout>) =>
      w?.steps.filter((s) => s.kind === 'work').length ?? 0;
    const m500 = structuredWorkout('intervals', 45, opts('build'));
    expect(reps(m500)).toBeGreaterThanOrEqual(4);
    expect(reps(m500)).toBeLessThanOrEqual(8);
    const m1000 = structuredWorkout('intervals', 60, opts('peak'));
    expect(reps(m1000)).toBeGreaterThanOrEqual(3);
    expect(reps(m1000)).toBeLessThanOrEqual(5);
    const s30 = structuredWorkout('intervals', 40, opts('taper'));
    expect(reps(s30)).toBeGreaterThanOrEqual(10);
    expect(reps(s30)).toBeLessThanOrEqual(15);
    expect(s30?.steps.length).toBeLessThanOrEqual(40);
    expect(structuredWorkout('intervals', 20, opts('build'))).toBeNull();
    expect(structuredWorkout('strides', 45, opts('build'))).toBeNull();
    expect(structuredWorkout('race_pace', 45, opts('build'))).toBeNull();
    expect(
      structuredWorkout('tempo', 45, { ...opts('build'), limits: { ...GENERAL, allowed: false } }),
    ).toBeNull();
  });

  it('locker/Erholung/lang mit Schlagzahl-Hinweis; Technik erst ab 20 min', () => {
    expect(easyWorkout('easy', 30, 4, 'row').main_de).toContain('18–22');
    expect(easyWorkout('recovery', 30, 4, 'row').name_de).toBe('Erholungsrudern');
    expect(easyWorkout('long', 60, 4, 'row').name_de).toBe('Langes Rudern');
    expect(rowTechniqueWorkout(19, 4)).toBeNull();
    const technique = rowTechniqueWorkout(30, 4);
    expect(technique && total(technique.steps)).toBe(1800);
    expect(technique?.steps.every((s) => s.effort <= 4)).toBe(true);
  });
});

describe('Schon- und Reise-Modus', () => {
  const rowSession = {
    kind: 'endurance' as const,
    estimated_minutes: 30,
    effort_target: 4,
    endurance_modality: 'row' as const,
  };
  const pain = (region: 'lower_back' | 'knee' | 'wrist' | 'shoulder', intensity: string) =>
    ({
      regions: [{ region, intensity }],
      level: intensity,
      advice: [],
      conservative: false,
      until: MONDAY,
    }) as unknown as PainEffect;

  it('unterer Rücken/Knie/Handgelenk ab „mittel“ → Hinweis Rad-Ergometer oder Gehen', () => {
    for (const region of ['lower_back', 'knee', 'wrist'] as const) {
      expect(
        applyModesToEndurance(rowSession, { pain: pain(region, 'moderate') }).notices,
      ).toContain('pain_row_alternative');
      expect(applyModesToEndurance(rowSession, { pain: pain(region, 'severe') }).notices).toContain(
        'pain_row_alternative',
      );
      expect(
        applyModesToEndurance(rowSession, { pain: pain(region, 'mild') }).notices,
      ).not.toContain('pain_row_alternative');
    }
    expect(
      applyModesToEndurance(rowSession, { pain: pain('shoulder', 'severe') }).notices,
    ).not.toContain('pain_row_alternative');
    // Laufen bekommt den Ruder-Hinweis nie.
    expect(
      applyModesToEndurance(
        { ...rowSession, endurance_modality: 'run' },
        { pain: pain('knee', 'severe') },
      ).notices,
    ).not.toContain('pain_row_alternative');
  });

  it('Reise: Hotel-Gym nur mit Rudergerät, sonst Ersatz Gehen/Laufen', () => {
    const travel = (equipment: 'hotel_gym' | 'bodyweight') =>
      travelOnDay(
        [
          {
            id: '00000000-0000-4000-8000-000000000001',
            starts_on: MONDAY,
            ends_on: MONDAY,
            equipment,
            max_minutes: null,
            created_at: '2026-10-01T10:00:00Z',
          },
        ],
        MONDAY,
      );
    const gym = applyModesToEndurance(rowSession, { travel: travel('hotel_gym') });
    expect(gym.notices).toEqual(['travel_row_hotel_gym']);
    const none = applyModesToEndurance(rowSession, { travel: travel('bodyweight') });
    expect(none.notices).toEqual(['travel_row_alternative']);
    expect(
      modeNotices({
        kind: 'endurance',
        modes: { travel: travel('bodyweight') },
        travel: null,
        shortened: false,
        pain: null,
        endurance: none.notices,
      }),
    ).toEqual(['travel_active', 'travel_row_alternative']);
    expect(applyModesToEndurance(rowSession, {}).notices).toEqual([]);
  });
});

describe('Uhr: Health Connect 54 Rudergerät', () => {
  const record = {
    id: 'hc-row-1',
    exerciseType: 54,
    startTime: '2026-10-26T07:00:00Z',
    endTime: '2026-10-26T07:30:00Z',
  };

  it('54 → Rudern mit Dauer/Distanz/Watt/Schlagzahl; 53 (Boot) bleibt „Sonstige“', () => {
    expect(mapExerciseType(54)).toEqual({ group: 'row', nameDe: 'Rudern' });
    expect(mapExerciseType(53).group).toBe('other');
    expect(sportForExerciseType(54)).toBeNull();
    const result = sessionFromHc(
      record,
      { distanceM: 6123.4, avgPowerW: 181.6, strokeRate: 23.8 },
      { hfMax: null },
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.session).toMatchObject({
      group: 'row',
      name_de: 'Rudern',
      duration_s: 1800,
      distance_m: 6123,
      avg_power_w: 182,
      stroke_rate: 24,
    });
    expect(result.routeStatus).toBe('not_applicable');
    expect(
      wearableSessionImportSchema.safeParse({
        ...result.session,
        merge_into: null,
        possible_duplicate_of: null,
      }).success,
    ).toBe(true);
  });

  it('ohne bzw. außerhalb der Grenzen: Felder fehlen; andere Arten nie', () => {
    const none = sessionFromHc(record, { avgPowerW: 2000, strokeRate: 5 }, { hfMax: null });
    expect(none.kind === 'ok' && 'avg_power_w' in none.session).toBe(false);
    expect(none.kind === 'ok' && 'stroke_rate' in none.session).toBe(false);
    const run = sessionFromHc(
      { ...record, exerciseType: 56 },
      { avgPowerW: 200, strokeRate: 24 },
      { hfMax: null },
    );
    expect(run.kind === 'ok' && 'avg_power_w' in run.session).toBe(false);
  });
});

describe('Rudern-Workouts in der Liste (Testmodus)', () => {
  it('Entwürfe der Kategorie Rudern erscheinen, andere Entwürfe nicht', () => {
    const list = [
      makeWorkout({ id: 'r-rudern', title_de: 'Rudern', status: 'draft', category: 'rowing' }),
      makeWorkout({
        id: 'l-lauf',
        title_de: 'Lauf-Kraft',
        status: 'draft',
        category: 'run_strength',
      }),
      makeWorkout({ id: 'f-frei', title_de: 'Frei', status: 'published' }),
    ];
    expect(
      filterWorkouts(list, EMPTY_WORKOUT_FILTER)
        .map((w) => w.id)
        .sort(),
    ).toEqual(['f-frei', 'r-rudern']);
    expect(
      filterWorkouts(list, { ...EMPTY_WORKOUT_FILTER, category: 'rowing' }).map((w) => w.id),
    ).toEqual(['r-rudern']);
  });
});
