import { describe, expect, it } from 'vitest';

import { FLOW_RULES, FLOW_SAFETY, RECOVERY_ROUTINE, WORKOUT_LIMITS } from '../constants';
import type { Exercise } from '../content/schemas';
import { makeExercise } from '../content/test-fixtures';
import { painEffectOn, type PainEpisode } from '../modes/pain';
import { isFlowPoseId, planLibraryFromContent } from '../plan/content-pool';
import { planSafetyRules, type SafetyInputs } from '../plan/safety';
import { checkWorkout } from './checks';
import {
  buildFlowTimerSteps,
  type FlowSafetyInput,
  flowHoldCap,
  isPoseAllowed,
  prepareFlowWorkout,
  visibleWorkouts,
} from './flow';
import { workoutLogNote } from './library';
import {
  isRecoveryRoutineCandidate,
  recentMainMuscles,
  recoveryRoutineDay,
  recoveryRoutineEnabled,
  suggestRecoveryRoutine,
} from './recovery-routine';
import type { Workout } from './schema';
import { makeWorkout, workoutItem } from './test-fixtures';
import {
  advanceWorkoutRun,
  buildWorkoutTimerPlan,
  estimateWorkoutSeconds,
  startWorkoutRun,
  workoutRunSummary,
} from './timer';

/**
 * Sportarten Stufe 1 · Etappe Y (docs/PLAN-SPORTARTEN-STUFE-1.md 2.4, 5): Flow-Ablauf mit Seitenwechsel,
 * Sicherheitsfilter für Posen (Tausch gegen Stuhl-/Wand-Variante, Ausblenden unter 80 %), Halteposen ab 65 und der
 * Vorschlag „Erholungstag: Mobility“.
 */

const pose = (overrides: Partial<Exercise>): Exercise =>
  makeExercise({
    status: 'draft',
    movement_pattern: 'mobility',
    load_type: 'time',
    equipment_ids: [],
    difficulty: 1,
    caution_tags: [],
    alternatives: [],
    primary_muscles: ['hamstrings'],
    secondary_muscles: [],
    ...overrides,
  });

const LIB: Exercise[] = [
  pose({ id: 'berg', primary_muscles: ['abs'] }),
  pose({
    id: 'hund',
    caution_tags: ['inversion', 'floor_transfer'],
    primary_muscles: ['hamstrings', 'calves'],
    alternatives: [{ alternative_id: 'hund-wand', reason: 'easier', priority: 1 }],
  }),
  pose({ id: 'hund-wand', primary_muscles: ['hamstrings', 'lats'] }),
  pose({
    id: 'drehung',
    caution_tags: ['trunk_rotation', 'floor_transfer'],
    primary_muscles: ['obliques'],
    alternatives: [
      { alternative_id: 'gibt-es-nicht', reason: 'easier', priority: 1 },
      { alternative_id: 'drehung-stuhl', reason: 'easier', priority: 2 },
    ],
  }),
  pose({ id: 'drehung-stuhl', primary_muscles: ['obliques'] }),
  pose({
    id: 'beine-wand',
    caution_tags: ['inversion', 'long_supine'],
    primary_muscles: ['calves'],
  }),
  pose({ id: 'katze', load_type: 'bodyweight', primary_muscles: ['lower_back'] }),
  pose({ id: 'ausfall', primary_muscles: ['quadriceps', 'glutes'], secondary_muscles: ['calves'] }),
  pose({ id: 'schulter', primary_muscles: ['upper_back'], movement_pattern: 'mobility' }),
];
const LOOKUP = new Map(LIB.map((e) => [e.id, e] as const));

const item = (id: string, duration = 60, side: 'both' | null = null) =>
  workoutItem(id, { reps: null, duration_s: duration, rest_s: 0, ...(side ? { side } : {}) });

function flow(overrides: Partial<Workout> = {}): Workout {
  return makeWorkout({
    id: 'flow-test',
    status: 'draft',
    category: 'yoga',
    format: 'flow',
    difficulty: 1,
    rounds: 1,
    round_rest_s: 0,
    minutes: 10,
    exercises: [
      item('berg'),
      item('hund'),
      item('drehung', 45, 'both'),
      item('katze', 90),
      item('ausfall', 60, 'both'),
      item('berg', 90),
      item('berg', 60),
      item('katze', 60),
      item('berg', 30),
      item('berg', 30),
    ],
    ...overrides,
  });
}

const PUBLISHED_META = {
  origin: 'claude_session' as const,
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-27',
  expert_reviewed: false,
  reviewed_by: 'Test',
  reviewed_at: '2026-10-27',
  review_note: null,
};

const OPEN: FlowSafetyInput = { excludedCautionTags: [], pain: null, holdCap: false };
const rulesFor = (inputs: Partial<SafetyInputs>) =>
  planSafetyRules(
    {
      experienceLevel: 'advanced',
      birthDate: '1990-01-01',
      healthScreening: { flags: [] },
      ...inputs,
    },
    '2026-10-27',
  );
const safety = (inputs: Partial<SafetyInputs>, holdCap = false): FlowSafetyInput => ({
  excludedCautionTags: rulesFor(inputs).excludedCautionTags,
  pain: null,
  holdCap,
});

describe('Flow-Ablauf (buildFlowTimerSteps, buildWorkoutTimerPlan)', () => {
  it('Vorbereitung, dann Pose für Pose ohne Pausen; side both → rechts, dann links', () => {
    const steps = buildWorkoutTimerPlan(flow());
    expect(steps[0]).toEqual({ kind: 'prepare', seconds: WORKOUT_LIMITS.prepareS });
    expect(steps.some((s) => s.kind === 'rest')).toBe(false);
    const twist = steps.filter((s) => s.kind === 'work' && s.exerciseId === 'drehung');
    expect(twist.map((s) => (s.kind === 'work' ? s.side : null))).toEqual(['right', 'left']);
    // Ohne Seitenwechsel fehlt das Feld (Pläne anderer Formate bleiben byte-gleich).
    expect(steps.find((s) => s.kind === 'work' && s.exerciseId === 'berg')).not.toHaveProperty(
      'side',
    );
    expect(steps).toEqual(buildFlowTimerSteps(flow()));
  });

  it('Dauer-Schätzung: Seiten zählen doppelt (10 Posen, 2 mit Seitenwechsel)', () => {
    const seconds = estimateWorkoutSeconds(buildWorkoutTimerPlan(flow()));
    expect(seconds).toBe(60 + 60 + 90 + 90 + 120 + 90 + 60 + 60 + 30 + 30);
  });

  it('mehrere Runden: jede Pose je Runde, keine Rundenpause', () => {
    const steps = buildWorkoutTimerPlan(
      flow({ rounds: 2, exercises: [item('berg'), item('katze')] }),
    );
    expect(steps.filter((s) => s.kind === 'work')).toHaveLength(4);
    expect(steps.some((s) => s.kind === 'rest')).toBe(false);
  });

  it('andere Formate unverändert (keine Seite, Pausen wie bisher)', () => {
    const steps = buildWorkoutTimerPlan(makeWorkout());
    expect(steps.some((s) => s.kind === 'rest')).toBe(true);
    expect(steps.every((s) => !('side' in s))).toBe(true);
  });

  it('Tagebuch: „x/y Posen“ in der Notiz; rechts/links sind zwei Durchgänge derselben Pose', () => {
    const workout = flow({ exercises: [item('drehung', 30, 'both')] });
    const steps = buildWorkoutTimerPlan(workout);
    const at = (WORKOUT_LIMITS.prepareS + 61) * 1000;
    const run = advanceWorkoutRun(steps, startWorkoutRun(steps, 0), at);
    const summary = workoutRunSummary(steps, run, at);
    expect(summary.items[0]?.done).toHaveLength(2);
    const note = workoutLogNote({
      title: 'Test',
      difficulty: 1,
      format: 'flow',
      summary,
      userNote: '',
    });
    expect(note).toContain('2/2 Posen');
  });

  it('W6: Schätzung mit Seitenwechsel passt zur angegebenen Dauer', () => {
    const w6 = checkWorkout(flow(), LOOKUP).filter((i) => i.rule === 'W6');
    expect(w6).toEqual([]);
    expect(checkWorkout(flow({ minutes: 5 }), LOOKUP).some((i) => i.rule === 'W6')).toBe(true);
  });
});

describe('Sicherheitsfilter für Posen', () => {
  it('ohne Einschränkung: alles erlaubt, Routine unverändert (gleiches Objekt)', () => {
    const workout = flow();
    const prepared = prepareFlowWorkout(workout, OPEN, LOOKUP);
    expect(prepared.hidden).toBe(false);
    expect(prepared.allowedShare).toBe(1);
    expect(prepared.workout).toBe(workout);
    expect(prepared.swapped).toEqual([]);
    expect(prepared.minutes).toBe(10);
  });

  it('Schwangerschaft: Umkehrhaltung und tiefe Drehung → Stuhl-/Wand-Variante (80 % erlaubt)', () => {
    const input = safety({ healthScreening: { flags: ['pregnancy'] } });
    expect(input.excludedCautionTags).toEqual(
      expect.arrayContaining(['long_supine', 'trunk_rotation', 'inversion']),
    );
    const prepared = prepareFlowWorkout(flow(), input, LOOKUP);
    expect(prepared.allowedShare).toBe(0.8);
    expect(prepared.hidden).toBe(false);
    expect(prepared.swapped).toEqual([
      { itemIndex: 1, fromId: 'hund', toId: 'hund-wand' },
      // Erste Alternative gibt es nicht → nächste erlaubte.
      { itemIndex: 2, fromId: 'drehung', toId: 'drehung-stuhl' },
    ]);
    expect(prepared.workout.exercises[2]).toMatchObject({
      exercise_id: 'drehung-stuhl',
      side: 'both',
    });
  });

  it('unter 80 % erlaubt → ausgeblendet; ohne Alternative entfällt die Pose', () => {
    const workout = flow({
      exercises: [item('berg'), item('hund'), item('beine-wand'), item('katze'), item('ausfall')],
    });
    const prepared = prepareFlowWorkout(
      workout,
      safety({ healthScreening: { flags: ['pregnancy'] } }),
      LOOKUP,
    );
    expect(prepared.allowedShare).toBe(0.6);
    expect(prepared.hidden).toBe(true);
    expect(prepared.removed).toEqual([{ itemIndex: 2, exerciseId: 'beine-wand' }]);
    expect(prepared.workout.exercises.map((e) => e.exercise_id)).toEqual([
      'berg',
      'hund-wand',
      'katze',
      'ausfall',
    ]);
    expect(
      visibleWorkouts(
        [workout, flow()],
        safety({ healthScreening: { flags: ['pregnancy'] } }),
        LOOKUP,
      ),
    ).toHaveLength(1);
  });

  it('vorsichtiger Plan (Flag bzw. ohne Check) und Fit im Alter schließen Umkehrhaltungen aus', () => {
    for (const input of [
      { healthScreening: { flags: ['medical_clearance_recommended' as const] } },
      { healthScreening: null },
      { goalType: 'active_aging' as const, birthDate: '1950-01-01' },
    ]) {
      expect(rulesFor(input).excludedCautionTags).toContain('inversion');
    }
    expect(FLOW_SAFETY.activeAgingExcludedCautionTags).toContain('inversion');
    expect(rulesFor({}).excludedCautionTags).toEqual([]);
    // 16 Jahre: nur Technik-Übungen ausgeschlossen, Umkehrhaltungen erlaubt.
    expect(rulesFor({ birthDate: '2010-06-01' }).excludedCautionTags).not.toContain('inversion');
  });

  it('Schon-Modus: Nacken sperrt Umkehrhaltungen schon bei „leicht“; unbekannte Pose gilt als gesperrt', () => {
    const episode: PainEpisode = {
      id: '00000000-0000-4000-8000-000000000001',
      region: 'neck',
      intensity: 'mild',
      duration_days: 7,
      started_on: '2026-10-27',
      ended_early_on: null,
      created_at: '2026-10-27T08:00:00Z',
    };
    const pain = painEffectOn([episode], '2026-10-27');
    const input: FlowSafetyInput = { excludedCautionTags: [], pain, holdCap: false };
    expect(isPoseAllowed(LOOKUP.get('hund'), input)).toBe(false);
    expect(isPoseAllowed(LOOKUP.get('berg'), input)).toBe(true);
    expect(isPoseAllowed(undefined, OPEN)).toBe(false);
    const prepared = prepareFlowWorkout(flow(), input, LOOKUP);
    expect(prepared.swapped[0]).toEqual({ itemIndex: 1, fromId: 'hund', toId: 'hund-wand' });
    // Konservativer Schon-Modus (stark): Umkehrhaltung immer gesperrt.
    const severe = painEffectOn(
      [{ ...episode, region: 'knee', intensity: 'severe' }],
      '2026-10-27',
    );
    expect(severe?.conservative).toBe(true);
    expect(isPoseAllowed(LOOKUP.get('beine-wand'), { ...OPEN, pain: severe })).toBe(false);
  });

  it('ab 65 bzw. Fit im Alter: Halteposen höchstens 30 s, bewegte Posen (Körpergewicht) bleiben', () => {
    expect(flowHoldCap({ age: 64, activeAging: false })).toBe(false);
    expect(flowHoldCap({ age: 65, activeAging: false })).toBe(true);
    expect(flowHoldCap({ age: 80, activeAging: false })).toBe(true);
    expect(flowHoldCap({ age: 40, activeAging: true })).toBe(true);
    const prepared = prepareFlowWorkout(flow(), { ...OPEN, holdCap: true }, LOOKUP);
    const durations = prepared.workout.exercises.map((e) => [e.exercise_id, e.duration_s]);
    expect(durations[0]).toEqual(['berg', FLOW_RULES.seniorHoldMaxS]);
    expect(durations[3]).toEqual(['katze', 90]);
    expect(durations[8]).toEqual(['berg', 30]);
    expect(prepared.shortened).toBe(6);
    expect(prepared.minutes).toBeLessThan(10);
    expect(prepared.hidden).toBe(false);
  });

  it('andere Formate kommen unverändert zurück', () => {
    const circuit = makeWorkout();
    expect(prepareFlowWorkout(circuit, safety({ healthScreening: null }), LOOKUP).workout).toBe(
      circuit,
    );
  });
});

describe('Erholungstag: Mobility (RECOVERY_ROUTINE)', () => {
  const session = (
    scheduled_on: string,
    status: 'planned' | 'skipped' | 'completed' = 'planned',
    is_deload = false,
  ) => ({ scheduled_on, status, is_deload });

  it('nur an trainingsfreien Tagen bzw. in der Erholungswoche nach erledigter Einheit', () => {
    const today = '2026-10-28'; // Mittwoch
    expect(recoveryRoutineDay(null, today)).toBeNull();
    expect(recoveryRoutineDay([], today)).toBeNull();
    expect(recoveryRoutineDay([session('2026-10-27')], today)).toBe('rest');
    expect(recoveryRoutineDay([session(today, 'skipped')], today)).toBe('rest');
    expect(recoveryRoutineDay([session(today)], today)).toBeNull();
    expect(recoveryRoutineDay([session(today, 'completed')], today)).toBeNull();
    expect(recoveryRoutineDay([session(today, 'completed', true)], today)).toBe('deload');
    expect(recoveryRoutineDay([session(today, 'planned', true)], today)).toBeNull();
    // 1 Trainingstag vs. 7 Trainingstage
    const week = Array.from({ length: 7 }, (_, i) => session(`2026-10-${26 + i}`));
    expect(recoveryRoutineDay(week, today)).toBeNull();
    expect(recoveryRoutineDay([session('2026-10-26')], today)).toBe('rest');
  });

  it('Hauptmuskeln der letzten 2 Tage: Kraft-Übungen und Ausdauer-Art', () => {
    const today = '2026-10-28';
    const muscles = recentMainMuscles(
      [
        { performedOn: '2026-10-27', exerciseIds: ['ausfall'], enduranceModality: null },
        { performedOn: '2026-10-26', exerciseIds: [], enduranceModality: 'run' },
        // zu alt
        { performedOn: '2026-10-25', exerciseIds: ['schulter'], enduranceModality: 'swim' },
      ],
      LOOKUP,
      today,
    );
    expect(muscles).toEqual(['glutes', 'quadriceps', 'calves']);
    expect(muscles.length).toBeLessThanOrEqual(RECOVERY_ROUTINE.mainMuscles);
    expect(recentMainMuscles([], LOOKUP, today)).toEqual([]);
  });

  const mobility = (id: string, minutes: number, ids: string[], extra: Partial<Workout> = {}) =>
    flow({
      id,
      title_de: `Routine ${id}`,
      category: 'mobility',
      minutes,
      exercises: ids.map((x) => item(x, Math.round((minutes * 60) / ids.length))),
      ...extra,
    });
  const ROUTINES = [
    mobility('erholung-beine', 15, ['ausfall', 'hund', 'berg']),
    mobility('erholung-ruecken', 15, ['katze', 'schulter', 'berg']),
    mobility('erholung-10', 10, ['katze', 'berg']),
    mobility('zu-lang', 30, ['ausfall', 'ausfall']),
    mobility('zu-schwer', 15, ['ausfall', 'ausfall'], { difficulty: 3 }),
    flow({ id: 'yoga-15', minutes: 15 }),
  ];
  const base = {
    enabled: true,
    day: 'rest' as const,
    workoutDoneToday: false,
    workouts: ROUTINES,
    exercises: LOOKUP,
    safety: OPEN,
    muscles: [],
  };

  it('Kandidaten: Mobility im Format flow, 10–20 min, höchstens 2 Sterne', () => {
    expect(ROUTINES.filter(isRecoveryRoutineCandidate).map((w) => w.id)).toEqual([
      'erholung-beine',
      'erholung-ruecken',
      'erholung-10',
    ]);
  });

  it('wählt nach den Hauptmuskeln, dann ~15 min, dann ID', () => {
    expect(suggestRecoveryRoutine({ ...base, muscles: ['quadriceps', 'glutes'] })).toMatchObject({
      workoutId: 'erholung-beine',
      minutes: 15,
      muscles: ['quadriceps', 'glutes'],
      day: 'rest',
    });
    expect(suggestRecoveryRoutine({ ...base, muscles: ['upper_back'] })?.workoutId).toBe(
      'erholung-ruecken',
    );
    // Ohne Muskeln: am nächsten an 15 min, dann nach ID.
    expect(suggestRecoveryRoutine(base)?.workoutId).toBe('erholung-beine');
  });

  it('abgeschaltet, Trainingstag, heute schon ein Workout → kein Vorschlag', () => {
    expect(suggestRecoveryRoutine({ ...base, enabled: false })).toBeNull();
    expect(suggestRecoveryRoutine({ ...base, day: null })).toBeNull();
    expect(suggestRecoveryRoutine({ ...base, workoutDoneToday: true })).toBeNull();
    expect(suggestRecoveryRoutine({ ...base, workouts: [] })).toBeNull();
  });

  it('Sicherheitsfilter gilt: ausgeblendete Routinen werden nie vorgeschlagen', () => {
    const pregnant = safety({ healthScreening: { flags: ['pregnancy'] } });
    // erholung-beine: 1 von 3 Posen gesperrt (67 %) → ausgeblendet.
    expect(
      suggestRecoveryRoutine({ ...base, safety: pregnant, muscles: ['quadriceps', 'glutes'] })
        ?.workoutId,
    ).toBe('erholung-ruecken');
  });

  it('Einstellung: fehlt = an', () => {
    expect(recoveryRoutineEnabled(null)).toBe(true);
    expect(recoveryRoutineEnabled({})).toBe(true);
    expect(recoveryRoutineEnabled({ recovery_routine: false })).toBe(false);
  });
});

describe('Posen nie in der Plan-Engine (isFlowPoseId, selectPlanContent)', () => {
  it('Posen stehen nur in displayExercises; ohne Posen bleibt die Bibliothek wie bisher', () => {
    const posePublished = makeExercise({
      id: 'yoga-baum',
      status: 'published',
      meta: PUBLISHED_META,
    });
    const normal = makeExercise({
      id: 'kniebeuge-test',
      status: 'published',
      meta: PUBLISHED_META,
    });
    expect(isFlowPoseId('yoga-baum')).toBe(true);
    expect(isFlowPoseId('pilates-muschel')).toBe(true);
    expect(isFlowPoseId('mobility-knie-zur-wand')).toBe(true);
    expect(isFlowPoseId('katze-kuh')).toBe(false);
    const lib = planLibraryFromContent([normal, posePublished], []);
    expect([...lib.exercises.keys()]).toEqual(['kniebeuge-test']);
    expect([...(lib.displayExercises?.keys() ?? [])]).toEqual(['kniebeuge-test', 'yoga-baum']);
    expect(planLibraryFromContent([normal], [])).not.toHaveProperty('displayExercises');
  });
});
