/**
 * Lauf-Kraft & Lauf-ABC (docs/PLAN-CALISTHENICS-SCHLINGE.md 4, RUN_STRENGTH_RULES): 1–2 Einheiten pro Woche an
 * lockeren Lauftagen, nie am Tag vor einer Schlüsseleinheit, Einstiegs-/Erholungswoche nur 1 sanfte, behutsame
 * Steigerung, Schon-Modus lässt belastende Übungen weg. Grenzfälle: 1 vs. 7 Lauftage, nur Gehen, keine Läufe.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { RUN_STRENGTH_RULES } from '../constants';
import { addDays } from '../dates';
import { painEffectOn, type PainEpisode } from '../modes/pain';
import { type Workout, workoutSchema } from '../workouts/schema';
import { generateTrainingPlan } from './generate';
import {
  planRunStrength,
  type RunStrengthContext,
  type RunStrengthSessionInput,
  runStrengthOn,
  runStrengthUnit,
} from './run-strength';
import { planSafetyRules } from './safety';
import { loadPendingWorkoutData, MONDAY, person, repoLibrary } from './test-library';

/**
 * Workouts aus content/workouts (echter Inhaltsstand) plus die Lauf-Kraft-Einheiten, die erst mit
 * claude/calisthenics-inhalte-2 nach content/ kommen (siehe test-library).
 */
function loadRepoWorkouts(): Workout[] {
  const dir = new URL('../../../../content/workouts/', import.meta.url);
  return [
    ...readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as unknown),
    ...loadPendingWorkoutData(),
  ].map((data) => workoutSchema.parse(data));
}

const ctx = (
  group: RunStrengthContext['rules']['enduranceStartGroup'],
  extra: Partial<RunStrengthContext['rules']> = {},
): RunStrengthContext => ({
  rules: {
    enduranceStartGroup: group,
    enduranceWalkOnly: false,
    excludedCautionTags: [],
    ...extra,
  },
});

function run(
  offset: number,
  overrides: Partial<RunStrengthSessionInput> = {},
): RunStrengthSessionInput {
  return {
    scheduled_on: addDays(MONDAY, offset),
    kind: 'endurance',
    endurance_modality: 'run',
    workout_type: null,
    estimated_minutes: 30,
    is_deload: false,
    is_intro_week: false,
    week_no: 2,
    ...overrides,
  };
}

/** Woche (Mo = 0) mit Läufen an Di, Do, So (So = langer Lauf). */
const WEEK = (week: number, extra: Partial<RunStrengthSessionInput> = {}) => [
  run(week * 7 + 1, extra),
  run(week * 7 + 3, extra),
  run(week * 7 + 6, { estimated_minutes: 70, ...extra }),
];

describe('planRunStrength', () => {
  it('Fortgeschritten: erst 1, dann 2 pro Woche (Steigerung höchstens +1), nie am langen Lauf', () => {
    const sessions = [...WEEK(0), ...WEEK(1), ...WEEK(2)];
    const result = planRunStrength(sessions, ctx('advanced'));
    const perWeek = [0, 1, 2].map(
      (w) =>
        result.filter(
          (a) => a.date >= addDays(MONDAY, w * 7) && a.date < addDays(MONDAY, w * 7 + 7),
        ).length,
    );
    expect(perWeek).toEqual([1, 2, 2]);
    for (const a of result) expect(a.date).not.toBe(addDays(MONDAY, 6));
  });

  it('nie am Tag vor dem langen Lauf; 2 Tage Abstand', () => {
    // Di, Fr, Sa (lang): Fr ist der Tag davor → nur Di.
    const sessions = [run(1), run(4), run(5, { estimated_minutes: 80 })];
    const result = planRunStrength(sessions, ctx('advanced'));
    expect(result.map((a) => a.date)).toEqual([addDays(MONDAY, 1)]);
    // Mo, Di, Mi, So(lang): Abstand 2 → Mo und Mi.
    const close = [run(0), run(1), run(2), run(6, { estimated_minutes: 90 })];
    const week2 = close.map((s) => ({ ...s, scheduled_on: addDays(s.scheduled_on, 7) }));
    const both = planRunStrength([...WEEK(0), ...week2], ctx('advanced'));
    expect(both.filter((a) => a.date >= addDays(MONDAY, 7)).map((a) => a.date)).toEqual([
      addDays(MONDAY, 7),
      addDays(MONDAY, 9),
    ]);
  });

  it('Wettkampfplan: nie an harter Einheit oder am Tag davor', () => {
    const sessions = [
      run(0, { workout_type: 'easy' }),
      run(1, { workout_type: 'intervals' }),
      run(3, { workout_type: 'easy' }),
      run(5, { workout_type: 'strides' }),
      run(6, { workout_type: 'long', estimated_minutes: 90 }),
    ];
    const result = planRunStrength(sessions, ctx('competitive'));
    // Mo ist Tag vor Intervallen, Sa Tag vor langem Lauf → nur Do.
    expect(result.map((a) => a.date)).toEqual([addDays(MONDAY, 3)]);
  });

  it('Einsteiger: höchstens 1 pro Woche, Einheiten wechseln (Waden → Hüfte → Lauf-ABC)', () => {
    const sessions = [0, 1, 2, 3].flatMap((w) => WEEK(w));
    const result = planRunStrength(sessions, ctx('beginner'));
    expect(result).toHaveLength(4);
    expect(result.map((a) => a.workoutId)).toEqual([
      'lauf-kraft-waden-fuesse',
      'lauf-kraft-huefte-rumpf',
      'lauf-abc-koordination',
      'lauf-kraft-waden-fuesse',
    ]);
  });

  it('Erholungswoche, Einstiegswoche und Woche 0: höchstens 1, nur „sanft“ (ohne Sprünge)', () => {
    for (const extra of [{ is_deload: true }, { is_intro_week: true }, { week_no: 0 }]) {
      const result = planRunStrength(WEEK(0, extra), ctx('advanced'));
      expect(result).toEqual([
        { date: addDays(MONDAY, 1), workoutId: RUN_STRENGTH_RULES.units.gentle, gentle: true },
      ]);
    }
  });

  it('Sprünge ausgeschlossen (vorsichtig/ab 65): immer die sanfte Einheit', () => {
    const result = planRunStrength(
      [...WEEK(0), ...WEEK(1)],
      ctx('cautious', {
        excludedCautionTags: ['high_impact'],
      }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.workoutId === RUN_STRENGTH_RULES.units.gentle)).toBe(true);
  });

  it('nur Gehen, Rad, Schwimmen oder ausgelassene Läufe: keine Einheit', () => {
    expect(planRunStrength(WEEK(0), ctx('cautious', { enduranceWalkOnly: true }))).toEqual([]);
    const bike = WEEK(0).map((s) => ({ ...s, endurance_modality: 'bike' as const }));
    expect(planRunStrength(bike, ctx('advanced'))).toEqual([]);
    const skipped = WEEK(0).map((s) => ({ ...s, status: 'skipped' }));
    expect(planRunStrength(skipped, ctx('advanced'))).toEqual([]);
  });

  it('1 Lauftag pro Woche: Einheit an diesem Tag (kein „Tag davor“-Problem); 7 Lauftage: höchstens 2', () => {
    const one = planRunStrength([run(2), run(9)], ctx('advanced'));
    expect(one.map((a) => a.date)).toEqual([addDays(MONDAY, 2), addDays(MONDAY, 9)]);
    const seven = (w: number) =>
      [0, 1, 2, 3, 4, 5, 6].map((d) => run(w * 7 + d, d === 6 ? { estimated_minutes: 90 } : {}));
    const result = planRunStrength([...seven(0), ...seven(1)], ctx('advanced'));
    expect(result.filter((a) => a.date >= addDays(MONDAY, 7))).toHaveLength(2);
    for (const a of result) {
      expect(a.date).not.toBe(addDays(MONDAY, 5));
      expect(a.date).not.toBe(addDays(MONDAY, 12));
    }
  });

  it('runStrengthOn findet die Zuordnung eines Tages', () => {
    const result = planRunStrength(WEEK(0), ctx('advanced'));
    expect(runStrengthOn(result, addDays(MONDAY, 1))?.workoutId).toBeDefined();
    expect(runStrengthOn(result, addDays(MONDAY, 2))).toBeNull();
  });
});

describe('runStrengthUnit (Schon-Modus, Regeln)', () => {
  const workouts = new Map(loadRepoWorkouts().map((w) => [w.id, w] as const));
  const library = repoLibrary().exercises;
  const rules = planSafetyRules(person(), MONDAY);

  it('alle vier Einheiten existieren (Kategorie run_strength) und sind ohne Geräte machbar', () => {
    const ids = [
      ...RUN_STRENGTH_RULES.units.strength,
      RUN_STRENGTH_RULES.units.drills,
      RUN_STRENGTH_RULES.units.gentle,
    ];
    for (const id of ids) {
      const w = workouts.get(id);
      expect(w?.category, id).toBe('run_strength');
      expect(w?.equipment_ids).toEqual([]);
      expect(runStrengthUnit(w, { library, rules })?.items).toHaveLength(w!.exercises.length);
    }
    // Die sanfte Einheit hat keine Sprünge.
    const gentle = workouts.get(RUN_STRENGTH_RULES.units.gentle)!;
    for (const item of gentle.exercises) {
      expect(library.get(item.exercise_id)?.caution_tags).not.toContain('high_impact');
    }
  });

  it('Schon-Modus Sprunggelenk „mittel“: Lauf-ABC entfällt ganz, Hüfte & Rumpf bleibt mit weniger Übungen', () => {
    const episode: PainEpisode = {
      id: '66666666-6666-4666-8666-666666666666',
      region: 'ankle',
      intensity: 'moderate',
      duration_days: 7,
      started_on: MONDAY,
      ended_early_on: null,
      created_at: `${MONDAY}T08:00:00Z`,
    };
    const pain = painEffectOn([episode], MONDAY);
    expect(
      runStrengthUnit(workouts.get('lauf-abc-koordination'), { library, rules, pain }),
    ).toBeNull();
    const hip = runStrengthUnit(workouts.get('lauf-kraft-huefte-rumpf'), { library, rules, pain });
    expect(hip).not.toBeNull();
    expect(hip!.dropped).toBeGreaterThan(0);
  });

  it('Sprünge laut Regeln ausgeschlossen: Lauf-ABC entfällt (nie halb)', () => {
    const cautious = planSafetyRules(person({ healthScreening: null }), MONDAY);
    expect(
      runStrengthUnit(workouts.get('lauf-abc-koordination'), { library, rules: cautious }),
    ).toBeNull();
    expect(runStrengthUnit(undefined, { library, rules })).toBeNull();
  });
});

describe('am echten Plan (Ziel Ausdauer, Laufen)', () => {
  it.each([
    ['beginner', 1],
    ['advanced', 2],
  ] as const)('%s: höchstens %i pro Woche, nur an Lauftagen', (level, max) => {
    const result = generateTrainingPlan(
      person({
        goalType: 'endurance',
        discipline: '10k',
        experienceLevel: level,
        schedule: {
          mode: 'fixed',
          slots: [
            { weekday: 2, kind: 'endurance', minutes: 40 },
            { weekday: 4, kind: 'endurance', minutes: 40 },
            { weekday: 7, kind: 'endurance', minutes: 60 },
            { weekday: 1, kind: 'strength_gym', minutes: 45 },
          ],
        },
      }),
      repoLibrary(),
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rules = result.plan.safety_rules;
    const assignments = planRunStrength(result.plan.sessions, { rules });
    expect(assignments.length).toBeGreaterThan(0);
    const runDates = new Set(
      result.plan.sessions
        .filter((s) => s.kind === 'endurance' && s.endurance_modality === 'run')
        .map((s) => s.scheduled_on),
    );
    const byWeek = new Map<number, number>();
    for (const a of assignments) {
      expect(runDates.has(a.date)).toBe(true);
      const week = result.plan.sessions.find((s) => s.scheduled_on === a.date)!.week_no;
      byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
    }
    for (const count of byWeek.values()) expect(count).toBeLessThanOrEqual(max);
    // Erholungswochen: höchstens 1, sanft.
    for (const a of assignments) {
      const s = result.plan.sessions.find((x) => x.scheduled_on === a.date)!;
      if (s.is_deload) expect(a.gentle).toBe(true);
    }
  });
});
