import { describe, expect, it } from 'vitest';

import type { PlannedExerciseDraft } from '../plan/adapt';
import { equipmentProfile } from '../plan/equipment-profile';
import { swapCandidatesFor } from '../plan/preferences';
import { planSafetyRules } from '../plan/safety';
import { pref } from '../plan/swap-test-helpers';
import { FULL_HOME, MONDAY, person, repoLibrary } from '../plan/test-library';
import { prepareSessionForDisplay, type StoredSession } from '../plan/view';
import { sessionLogPayloadSchema } from './schemas';
import type { Exercise } from '../content/schemas';
import type { ExerciseLogEntry } from './types';
import {
  adjustReps,
  adjustWeight,
  alignShownExercises,
  allowedAlternatives,
  exerciseLogStatusFor,
  extraSetAllowed,
  hasLoggedSomething,
  initialSets,
  isValidSetWeight,
  neutralizeSessionLogPayload,
  neutralSessionName,
  planWorkout,
  planWorkoutExercise,
  type PlanExerciseContext,
  referenceDosage,
  reserveFromRpe,
  rpeFromReserve,
  sessionLogStatus,
  weightStepsFor,
} from './workout';

/**
 * Trainingsmodus (Etappe C1): Vorgabe, Zustand und Hinweis je Übung aus angezeigter Einheit + Tagebuch – mit den
 * echten Inhalten aus content/.
 */
const lib = repoLibrary();
const library = lib.exercises;
const ex = (id: string) => {
  const found = library.get(id);
  if (!found) throw new Error(`Übung fehlt: ${id}`);
  return found;
};
const healthy = planSafetyRules(person(), MONDAY);
const gym = equipmentProfile('gym', []);
const home = equipmentProfile('home', FULL_HOME);
const homeNothing = equipmentProfile('home', []);

function planned(
  exerciseId: string,
  overrides: Partial<PlannedExerciseDraft> = {},
): PlannedExerciseDraft {
  return {
    order_no: 1,
    exercise_id: exerciseId,
    source_exercise_id: exerciseId,
    exercise_name_de: library.get(exerciseId)?.name_de ?? exerciseId,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 90,
    rpe_target: 8,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
    ...overrides,
  };
}

function session(
  exercises: PlannedExerciseDraft[],
  overrides: Partial<StoredSession> = {},
): StoredSession {
  return {
    id: 's1',
    status: 'planned',
    original_date: null,
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'strength',
    template_day_index: 0,
    scheduled_on: MONDAY,
    name_de: 'Ganzkörper A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: 'Aufwärmen',
    cooldown_de: 'Cool-down',
    exercises,
    ...overrides,
  };
}

function entry(
  exerciseId: string,
  date: string,
  weightKg: number,
  reps: number,
  overrides: Partial<ExerciseLogEntry> = {},
): ExerciseLogEntry {
  return {
    exerciseId,
    performedOn: date,
    loggedAt: `${date}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: 3,
    targetWeightKg: weightKg,
    targetReps: 8,
    targetExtraSet: false,
    targetRpe: 8,
    state: { weightKg, targetReps: 8, extraSet: false, durationS: null },
    weightConfirmed: false,
    sets: Array.from({ length: 3 }, () => ({
      reps,
      weightKg,
      durationS: null,
      rpe: null,
      done: true,
    })),
    ...overrides,
  };
}

function context(overrides: Partial<PlanExerciseContext> = {}): PlanExerciseContext {
  return {
    library,
    engineLibrary: library,
    profile: gym,
    rules: healthy,
    experienceLevel: 'beginner',
    entries: [],
    startWeights: new Map(),
    today: '2026-10-12',
    isDeload: false,
    weekSessions: [],
    weeklySetMax: 14,
    swap: { swapRules: healthy },
    ...overrides,
  };
}

const ref = { templateSets: 3, rpeTarget: 8 };

describe('referenceDosage', () => {
  it('längste Fassung ohne Erholungs-/Einstiegswoche; RPE aus derselben Fassung', () => {
    const sessions = [
      session([planned('goblet-kniebeuge', { sets: 2, rpe_target: 8 })]),
      session([planned('goblet-kniebeuge', { sets: 4, rpe_target: 8.5 })]),
      session([planned('goblet-kniebeuge', { sets: 6, rpe_target: 6 })], { is_deload: true }),
      session([planned('goblet-kniebeuge', { sets: 5, rpe_target: 7 })], { is_intro_week: true }),
    ];
    expect(referenceDosage(sessions, 'goblet-kniebeuge', { sets: 2, rpe_target: 8 })).toEqual({
      templateSets: 4,
      rpeTarget: 8.5,
    });
  });

  it('nur in Woche 0 bzw. gar nicht im Plan → heutige Vorgabe', () => {
    const intro = [session([planned('goblet-kniebeuge')], { is_intro_week: true })];
    expect(referenceDosage(intro, 'goblet-kniebeuge', { sets: 3, rpe_target: 7 })).toEqual({
      templateSets: 3,
      rpeTarget: 7,
    });
    expect(referenceDosage([], 'x', { sets: 1, rpe_target: 6 })).toEqual({
      templateSets: 1,
      rpeTarget: 6,
    });
  });
});

describe('weightStepsFor', () => {
  it('zu Hause: eigene Kurzhantel-Stufen; im Studio: keine (0,5-kg-Raster)', () => {
    expect(weightStepsFor(ex('goblet-kniebeuge'), home)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(weightStepsFor(ex('goblet-kniebeuge'), gym)).toEqual([]);
    expect(weightStepsFor(ex('liegestuetz'), home)).toEqual([]);
  });

  it('Langhantel zu Hause: ladbare Gesamtgewichte', () => {
    const barbell = equipmentProfile('home', [
      { equipmentId: 'barbell', weightsKg: [5, 10], barKg: 20 },
      { equipmentId: 'power_rack', weightsKg: [] },
    ]);
    expect(weightStepsFor(ex('kniebeuge-langhantel'), barbell)).toEqual([20, 30, 40, 50]);
  });
});

describe('extraSetAllowed (V9)', () => {
  const week = [
    session([planned('goblet-kniebeuge', { sets: 4 }), planned('beinpresse', { sets: 4 })]),
    session([planned('goblet-kniebeuge', { sets: 4 })]),
  ];
  it('unter der Obergrenze: ja; an der Grenze: nein; ohne Grenze: nein', () => {
    const goblet = ex('goblet-kniebeuge');
    expect(extraSetAllowed(goblet, week, library, 22)).toBe(true);
    expect(extraSetAllowed(goblet, week, library, 12)).toBe(false);
    expect(extraSetAllowed(goblet, week, library, null)).toBe(false);
    // Gestrichene Einheiten zählen nicht.
    const skipped = week.map((s) => ({ ...s, status: 'skipped' as const }));
    expect(extraSetAllowed(goblet, skipped, library, 1)).toBe(true);
  });

  it('Pflicht-Test 10: gemischte Woche, Präferenz nur zu Hause → nur die Heim-Einheit nach Präferenz gezählt', () => {
    const homeSession = session([planned('tuerrahmen-rudern', { sets: 4 })], { id: 'h' });
    const gymSession = session([planned('tuerrahmen-rudern', { sets: 4 })], { id: 'g' });
    const mixed = [homeSession, gymSession];
    const rowing = ex('kurzhantelrudern-einarmig');
    const layer = (prefs: ReturnType<typeof pref>[]) => ({
      preferences: prefs,
      locations: new Map([
        ['h', { location: 'home' as const, ambiguous: false }],
        ['g', { location: 'gym' as const, ambiguous: false }],
      ]),
      profiles: new Map([
        ['home' as const, homeNothing],
        ['gym' as const, gym],
      ]),
      library,
      lookup: library,
      swapRules: healthy,
    });
    // Ohne Präferenzen identisch zu vorher: 2 × 4 Sätze oberer Rücken, +1 > 6.
    expect(extraSetAllowed(rowing, mixed, library, 6)).toBe(false);
    expect(extraSetAllowed(rowing, mixed, library, 6, layer([]))).toBe(false);
    // „Hier nicht machbar“ zu Hause ohne Kandidat → Heim-Einheit zählt 0, Studio weiter 4.
    const notFeasible = layer([pref('tuerrahmen-rudern', 'home', 'not_feasible')]);
    expect(extraSetAllowed(rowing, mixed, library, 6, notFeasible)).toBe(true);
    // Dieselbe Präferenz im Studio: dort gibt es einen Kandidaten (gleiches Muster) → Zählung bleibt.
    const atGym = layer([pref('tuerrahmen-rudern', 'gym', 'not_feasible')]);
    expect(extraSetAllowed(rowing, mixed, library, 6, atGym)).toBe(false);
  });
});

describe('planWorkoutExercise', () => {
  const goblet = ex('goblet-kniebeuge');

  it('ohne Verlauf: kein Gewicht („Startgewicht finden“), Ziel = reps_min, kein Zustand', () => {
    const plan = planWorkoutExercise(goblet, planned('goblet-kniebeuge'), ref, context());
    expect(plan.prescription).toMatchObject({ sets: 3, weightKg: null, targetReps: 8 });
    expect(plan.state).toBeNull();
    expect(plan.hint).toEqual({ hint: null, harderVariant: null });
    expect(plan.heavierReferenceKg).toBeNull();
  });

  it('eigenes Startgewicht → Vorschlag, zu Hause auf eigene Stufe abgerundet', () => {
    const plan = planWorkoutExercise(
      goblet,
      planned('goblet-kniebeuge'),
      ref,
      context({ profile: home, startWeights: new Map([['goblet-kniebeuge', 11]]) }),
    );
    expect(plan.progress.source).toBe('start_weight');
    expect(plan.prescription.weightKg).toBe(10);
    expect(plan.state?.weightKg).toBe(11);
    expect(plan.heavierReferenceKg).toBe(11);
  });

  it('nach einer geschafften Einheit: +1 Wiederholung; Erholungswoche ×0,9 ohne Schritt', () => {
    const entries = [entry('goblet-kniebeuge', '2026-10-05', 20, 8)];
    const plan = planWorkoutExercise(
      goblet,
      planned('goblet-kniebeuge'),
      ref,
      context({ entries }),
    );
    expect(plan.prescription).toMatchObject({ weightKg: 20, targetReps: 9 });
    expect(plan.state).toEqual({ weightKg: 20, targetReps: 9, extraSet: false, durationS: null });
    const deload = planWorkoutExercise(
      goblet,
      planned('goblet-kniebeuge', { sets: 2, rpe_target: 6 }),
      ref,
      context({ entries, isDeload: true }),
    );
    expect(deload.prescription).toMatchObject({ sets: 2, weightKg: 18, rpeTarget: 6 });
  });

  it('RPE-Deckel der aktuellen Regeln greift nach der Progression (vorsichtiger Plan RPE 7)', () => {
    const cautious = planSafetyRules(person({ healthScreening: null }), MONDAY);
    const plan = planWorkoutExercise(
      goblet,
      planned('goblet-kniebeuge', { rpe_target: 8 }),
      ref,
      context({ rules: cautious }),
    );
    expect(plan.prescription.rpeTarget).toBeLessThanOrEqual(cautious.rpeMax);
  });

  it('Körpergewicht am Puffer-Ende: Hinweis nur MIT Variantenname, gesperrte Variante → kein Hinweis', () => {
    const squat = ex('kniebeuge-koerpergewicht');
    const dose = planned('kniebeuge-koerpergewicht', { sets: 3, reps_min: 10, reps_max: 15 });
    // Zustand am Ende des Puffers (17 Wdh., Zusatzsatz) zweimal geschafft → harder_variant.
    const done = (date: string): ExerciseLogEntry => ({
      ...entry('kniebeuge-koerpergewicht', date, 0, 17),
      loadType: 'bodyweight',
      targetWeightKg: null,
      targetReps: 17,
      targetExtraSet: true,
      targetSets: 4,
      state: { weightKg: null, targetReps: 17, extraSet: true, durationS: null },
      sets: Array.from({ length: 4 }, () => ({
        reps: 17,
        weightKg: null,
        durationS: null,
        rpe: null,
        done: true,
      })),
    });
    const entries = [done('2026-10-05'), done('2026-10-07')];
    const plan = planWorkoutExercise(
      squat,
      dose,
      { templateSets: 3, rpeTarget: 8 },
      context({ entries, profile: homeNothing, experienceLevel: 'advanced' }),
    );
    expect(plan.progress.hint).toBe('harder_variant');
    expect(plan.hint.hint).toBe('harder_variant');
    expect(plan.hint.harderVariant?.nameDe).toBeTruthy();
    // Variante nicht machbar (z. B. Goblet braucht Kurzhanteln) bzw. gesperrt → Hinweis entfällt ganz.
    const noVariant = planWorkoutExercise(
      squat,
      dose,
      { templateSets: 3, rpeTarget: 8 },
      context({ entries, profile: homeNothing, engineLibrary: new Map([[squat.id, squat]]) }),
    );
    expect(noVariant.progress.hint).toBe('harder_variant');
    expect(noVariant.hint).toEqual({ hint: null, harderVariant: null });
  });
});

describe('allowedAlternatives', () => {
  it('nur erlaubte, machbare, nicht schwerere Alternativen; schwerere nur als vorgeschlagene Variante', () => {
    const bench = ex('bankdruecken-kurzhantel');
    const ids = allowedAlternatives(bench, { library, profile: gym, rules: healthy }).map(
      (e) => e.id,
    );
    expect(ids).toContain('bodendruecken-kurzhantel');
    expect(ids).toContain('liegestuetz');
    expect(ids).not.toContain('bankdruecken-langhantel');
    const withVariant = allowedAlternatives(bench, {
      library,
      profile: gym,
      rules: healthy,
      harderVariantId: 'bankdruecken-langhantel',
    }).map((e) => e.id);
    expect(withVariant).toContain('bankdruecken-langhantel');
  });

  it('am Ort nicht machbar bzw. schon in der Einheit → nicht angeboten', () => {
    const bench = ex('bankdruecken-kurzhantel');
    const ids = allowedAlternatives(bench, {
      library,
      profile: homeNothing,
      rules: healthy,
      exclude: new Set(['liegestuetz']),
    }).map((e) => e.id);
    // Seit Etappe T1 (bewusst): auch Bibliothek mit gleichem Muster und gemeinsamem Hauptmuskel.
    expect(ids).toEqual(['liegestuetz-erhoeht']);
    expect(
      allowedAlternatives(bench, {
        library,
        profile: homeNothing,
        rules: healthy,
        exclude: new Set(['liegestuetz', 'liegestuetz-erhoeht']),
      }),
    ).toEqual([]);
  });

  it('Etappe T1: Ausschlüsse am Ort und Schwierigkeit ≤ min(gespeichert, angezeigt)', () => {
    const bench = ex('bankdruecken-kurzhantel');
    const ids = allowedAlternatives(bench, {
      library,
      profile: gym,
      rules: healthy,
      preferences: [pref('liegestuetz', 'gym', 'dislike')],
      location: 'gym',
      harderVariantId: 'liegestuetz',
    }).map((e) => e.id);
    expect(ids).not.toContain('liegestuetz');
    const easier = allowedAlternatives(ex('liegestuetz-erhoeht'), {
      library,
      profile: gym,
      rules: healthy,
      stored: ex('liegestuetz-fuesse-erhoeht'),
    });
    for (const alt of easier) expect(alt.difficulty).toBeLessThanOrEqual(1);
  });

  it('Sicherheitsregeln: gesperrte Merkmale werden nie angeboten (ab 65 kein long_supine)', () => {
    const senior = planSafetyRules(person({ birthDate: '1950-01-01' }), MONDAY);
    const bench = ex('bankdruecken-langhantel');
    for (const alt of allowedAlternatives(bench, { library, profile: gym, rules: senior })) {
      expect(alt.caution_tags.some((tag) => senior.excludedCautionTags.includes(tag))).toBe(false);
    }
  });

  it('nie Wiederholungs- gegen Halteübung', () => {
    const plank = ex('seitstuetz');
    for (const alt of allowedAlternatives(plank, { library, profile: gym, rules: healthy })) {
      expect(alt.load_type).toBe('time');
    }
  });
});

describe('planWorkout + alignShownExercises', () => {
  it('ausgeblendete Übungen verschieben die Zuordnung zur gespeicherten Übung nicht', () => {
    const stored = session([
      planned('goblet-kniebeuge', { order_no: 1 }),
      planned('kreuzheben-unbekannt', { order_no: 2 }),
      planned('liegestuetz', { order_no: 3 }),
    ]);
    const shown = {
      session: {
        ...stored,
        exercises: [
          planned('goblet-kniebeuge', { order_no: 1 }),
          planned('liegestuetz', { order_no: 2 }),
        ],
      },
      hidden: ['kreuzheben-unbekannt'],
      replaced: [],
      libraryMissing: false,
    };
    const aligned = alignShownExercises(stored, shown);
    expect(aligned.map((a) => [a.stored.order_no, a.shown.exercise_id])).toEqual([
      [1, 'goblet-kniebeuge'],
      [3, 'liegestuetz'],
    ]);
    const items = planWorkout(stored, shown, [stored], context());
    expect(items.map((i) => i.plannedOrderNo)).toEqual([1, 3]);
    expect(items[0]?.plan?.prescription.sets).toBe(3);
    // Alternativen schließen Übungen der Einheit aus.
    expect(items[0]?.alternatives.some((a) => a.id === 'liegestuetz')).toBe(false);
  });

  it('Übung nicht in der Bibliothek → ohne Plan (nicht prüfbar)', () => {
    const stored = session([planned('goblet-kniebeuge')]);
    const shown = { session: stored, hidden: [], replaced: [], libraryMissing: false };
    const items = planWorkout(stored, shown, [stored], context({ library: new Map() }));
    expect(items[0]?.plan).toBeNull();
  });
});

describe('Eingabe-Helfer', () => {
  it('initialSets: vorbelegt aus der Vorgabe, nicht abgehakt', () => {
    const p = {
      sets: 2,
      extraSet: false,
      isReturn: false,
      targetReps: 10,
      weightKg: 12,
      chooseLightest: false,
      durationS: null,
      rpeTarget: 8,
    };
    expect(initialSets(p, 'weight')).toEqual([
      { reps: 10, weightKg: 12, durationS: null, rpe: null, done: false },
      { reps: 10, weightKg: 12, durationS: null, rpe: null, done: false },
    ]);
    expect(initialSets({ ...p, durationS: 30 }, 'time')[0]).toEqual({
      reps: null,
      weightKg: null,
      durationS: 30,
      rpe: null,
      done: false,
    });
    expect(initialSets(p, 'bodyweight')[0]?.weightKg).toBeNull();
  });

  it('adjustWeight: nächste eigene Stufe bzw. 2,5 kg, Grenzen 0 und 500 kg', () => {
    expect(adjustWeight(10, 1, [8, 10, 12])).toBe(12);
    expect(adjustWeight(12, 1, [8, 10, 12])).toBe(12);
    expect(adjustWeight(10, -1, [8, 10, 12])).toBe(8);
    expect(adjustWeight(8, -1, [8, 10, 12])).toBe(8);
    expect(adjustWeight(11, -1, [8, 10, 12])).toBe(10);
    expect(adjustWeight(20, 1, [])).toBe(22.5);
    expect(adjustWeight(1, -1, [])).toBe(0);
    expect(adjustWeight(499, 1, [])).toBe(500);
    expect(adjustWeight(null, 1, [])).toBe(2.5);
    expect(adjustWeight(null, 1, [4, 6])).toBe(4);
    expect(adjustWeight(null, -1, [4, 6])).toBeNull();
  });

  it('adjustReps: 0–100', () => {
    expect(adjustReps(0, -1)).toBe(0);
    expect(adjustReps(100, 1)).toBe(100);
    expect(adjustReps(null, 1)).toBe(1);
  });

  it('Wiederholungen in Reserve ⇄ RPE (0 → 10, 5+ → 5)', () => {
    expect(rpeFromReserve(0)).toBe(10);
    expect(rpeFromReserve(2)).toBe(8);
    expect(rpeFromReserve(5)).toBe(5);
    expect(reserveFromRpe(10)).toBe(0);
    expect(reserveFromRpe(7.5)).toBe(2);
    expect(reserveFromRpe(5)).toBe(5);
    expect(reserveFromRpe(null)).toBeNull();
  });

  it('isValidSetWeight: 0–500 kg, höchstens zwei Nachkommastellen', () => {
    expect(isValidSetWeight(0)).toBe(true);
    expect(isValidSetWeight(500)).toBe(true);
    expect(isValidSetWeight(500.5)).toBe(false);
    expect(isValidSetWeight(22.125)).toBe(false);
    expect(isValidSetWeight(Number.NaN)).toBe(false);
  });
});

describe('Status', () => {
  it('Übung: nicht gemacht / Alternative (auch Sicherheits-Ersatz) / gemacht', () => {
    expect(exerciseLogStatusFor(true, 'a', 'a')).toBe('skipped');
    expect(exerciseLogStatusFor(false, 'b', 'a')).toBe('alternative');
    expect(exerciseLogStatusFor(false, 'a', 'a')).toBe('done');
    expect(exerciseLogStatusFor(false, 'a', null)).toBe('done');
  });

  it('Einheit: alles abgehakt → completed, sonst partial; Ausdauer immer completed', () => {
    const done = { status: 'done' as const, sets: [{ done: true }, { done: true }] };
    expect(sessionLogStatus('strength', [done])).toBe('completed');
    expect(sessionLogStatus('strength', [done, { status: 'skipped', sets: [] }])).toBe('partial');
    expect(sessionLogStatus('strength', [{ status: 'done', sets: [{ done: false }] }])).toBe(
      'partial',
    );
    expect(sessionLogStatus('strength', [])).toBe('partial');
    expect(sessionLogStatus('endurance', [])).toBe('completed');
    expect(hasLoggedSomething([{ status: 'done', sets: [{ done: false }] }])).toBe(false);
    expect(hasLoggedSomething([{ status: 'skipped', sets: [] }])).toBe(true);
  });
});

describe('Neutralisieren (S1)', () => {
  it('Vorgaben und Zustand leer, Name neutral, Ist-Werte bleiben – Schema bleibt gültig', () => {
    const payload = {
      id: '11111111-1111-4111-8111-111111111111',
      write_id: '22222222-2222-4222-8222-222222222222',
      base_revision: null,
      planned_session_id: '33333333-3333-4333-8333-333333333333',
      planned_date: '2026-10-05',
      kind: 'strength' as const,
      performed_on: '2026-10-05',
      started_at: null,
      finished_at: null,
      status: 'completed' as const,
      session_rpe: 7,
      notes: 'Griffbreite eng',
      name_de: 'Zügiges Gehen',
      is_intro_week: false,
      is_deload: false,
      source: 'manual' as const,
      client_updated_at: '2026-10-05T18:00:00Z',
      exercises: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          order_no: 1,
          planned_exercise_id: null,
          exercise_id: 'goblet-kniebeuge',
          exercise_name_de: 'Goblet-Kniebeuge',
          load_type: 'weight' as const,
          status: 'done' as const,
          target_sets: 3,
          reps_min: 8,
          reps_max: 12,
          target_reps: 9,
          target_extra_set: false,
          target_weight_kg: 20,
          target_duration_s: null,
          target_rpe: 7,
          state_weight_kg: 20,
          state_target_reps: 9,
          state_extra_set: false,
          state_duration_s: null,
          weight_confirmed: false,
          is_return: false,
          sets: [{ set_no: 1, reps: 9, weight_kg: 20, duration_s: null, rpe: 8, done: true }],
        },
      ],
      cardio: null,
    };
    const neutral = neutralizeSessionLogPayload(payload);
    expect(neutral.name_de).toBe(neutralSessionName('strength'));
    expect(neutral.exercises[0]).toMatchObject({
      target_sets: null,
      target_weight_kg: null,
      target_rpe: null,
      reps_min: null,
      state_weight_kg: null,
      state_extra_set: null,
      exercise_id: 'goblet-kniebeuge',
    });
    expect(neutral.exercises[0]?.sets).toEqual(payload.exercises[0]?.sets);
    expect(neutral.notes).toBe('Griffbreite eng');
    expect(sessionLogPayloadSchema.safeParse(neutral).success).toBe(true);
    expect(neutralSessionName('endurance')).toBe('Ausdauer-Einheit');
  });
});

// ---------------------------------------------------------------------------------------------------------
// Etappe T1 (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 4.3, 7.3, 7.4)
// ---------------------------------------------------------------------------------------------------------

/** Die Alternativen-Liste VOR Etappe T1 (unverändert kopiert) – nur für den Snapshot „vorher/nachher“. */
function legacyAllowedAlternatives(
  exercise: Exercise,
  ctx: {
    library: ReadonlyMap<string, Exercise>;
    profile: { available: ReadonlySet<string> };
    rules: { excludedCautionTags: readonly string[] };
    harderVariantId?: string | null;
  },
): string[] {
  const feasible = (c: Exercise) => c.equipment_ids.every((id) => ctx.profile.available.has(id));
  const allowed = (c: Exercise) =>
    !c.caution_tags.some((tag) => ctx.rules.excludedCautionTags.includes(tag));
  const isTime = exercise.load_type === 'time';
  const result: Exercise[] = [];
  const sorted = [...exercise.alternatives].sort(
    (a, b) => a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1),
  );
  for (const alt of sorted) {
    const c = ctx.library.get(alt.alternative_id);
    if (
      !c ||
      c.id === exercise.id ||
      (c.load_type === 'time') !== isTime ||
      !feasible(c) ||
      !allowed(c)
    ) {
      continue;
    }
    if (c.difficulty > exercise.difficulty && c.id !== ctx.harderVariantId) continue;
    result.push(c);
  }
  const variant = ctx.harderVariantId ? ctx.library.get(ctx.harderVariantId) : undefined;
  if (
    variant &&
    !result.some((e) => e.id === variant.id) &&
    feasible(variant) &&
    allowed(variant)
  ) {
    result.push(variant);
  }
  return result.map((c) => c.id);
}

describe('allowedAlternatives ≡ swapCandidates(today) (Pflicht-Test 8, Wächter S1)', () => {
  const templateExerciseIds = [
    ...new Set(
      lib.templates.flatMap((t) =>
        t.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)),
      ),
    ),
  ].sort();
  const profiles = [
    ['Studio', gym],
    ['Zuhause Geräte', home],
    ['Zuhause ohne', homeNothing],
  ] as const;
  const ruleSets = [
    ['gesund', healthy],
    [
      'Schwangerschaft',
      planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY),
    ],
  ] as const;

  it('über alle Übungen aller Vorlagen gleich', () => {
    expect(templateExerciseIds.length).toBeGreaterThan(0);
    for (const id of templateExerciseIds) {
      for (const [, profile] of profiles) {
        for (const [, rules] of ruleSets) {
          const viaWrapper = allowedAlternatives(ex(id), { library, profile, rules }).map(
            (e) => e.id,
          );
          const direct = swapCandidatesFor(ex(id), ex(id), {
            library,
            profile,
            swapRules: rules,
            preferences: [],
            location: profile.location,
            inSession: new Set(),
            mode: 'today',
          }).candidates.map((e) => e.id);
          expect(viaWrapper).toEqual(direct);
        }
      }
    }
  });

  it('K4: Abbildung aller Mantel-Parameter (S ≠ X, Präferenzen, Einheit, schwerere Variante, Ort)', () => {
    const prefs = [
      pref('liegestuetz-erhoeht', 'gym', 'dislike'),
      pref('kniebeuge-stuhl', 'home', 'dislike'),
    ];
    for (const [storedId, shownId, variant] of [
      ['bankdruecken-langhantel', 'bankdruecken-kurzhantel', 'bankdruecken-langhantel'],
      ['kniebeuge-langhantel', 'goblet-kniebeuge', 'kniebeuge-pause'],
      ['liegestuetz', 'liegestuetz', 'liegestuetz-fuesse-erhoeht'],
    ] as const) {
      for (const ambiguous of [false, true]) {
        const viaWrapper = allowedAlternatives(ex(shownId), {
          library,
          profile: gym,
          rules: healthy,
          stored: ex(storedId),
          exclude: new Set(['brustpresse']),
          harderVariantId: variant,
          preferences: prefs,
          location: 'gym',
          ambiguousLocation: ambiguous,
        }).map((e) => e.id);
        const direct = swapCandidatesFor(ex(storedId), ex(shownId), {
          library,
          profile: gym,
          swapRules: healthy,
          preferences: prefs,
          location: 'gym',
          ambiguousLocation: ambiguous,
          inSession: new Set(['brustpresse']),
          mode: 'today',
          harderVariantId: variant,
        }).candidates.map((e) => e.id);
        expect(viaWrapper).toEqual(direct);
        // Unabhängig: nie Einheit, nie Ausschluss am Ort (bei Mehrdeutigkeit beide Orte), nie S oder X selbst.
        expect(viaWrapper).not.toContain('brustpresse');
        expect(viaWrapper).not.toContain('liegestuetz-erhoeht');
        if (ambiguous) expect(viaWrapper).not.toContain('kniebeuge-stuhl');
        expect(viaWrapper).not.toContain(shownId);
      }
    }
  });

  it('bewusste Änderung im Trainingsmodus: Alternativen vorher/nachher (Snapshot – bei Änderung im PR nennen)', () => {
    const lines: string[] = [];
    let unchanged = 0;
    for (const id of templateExerciseIds) {
      for (const [pLabel, profile] of profiles) {
        for (const [rLabel, rules] of ruleSets) {
          // K5: wie im Trainingsmodus mit der schwereren Variante (erste `harder`-Alternative) – Reihenfolge zählt.
          const variant =
            ex(id)
              .alternatives.filter((a) => a.reason === 'harder')
              .sort((a, b) => a.priority - b.priority)[0]?.alternative_id ?? null;
          const before = legacyAllowedAlternatives(ex(id), {
            library,
            profile,
            rules,
            harderVariantId: variant,
          });
          const after = allowedAlternatives(ex(id), {
            library,
            profile,
            rules,
            harderVariantId: variant,
          }).map((e) => e.id);
          // Sicherheit sinkt nirgends: jeder neue Kandidat erlaubt, machbar, nicht schwerer, gleiches Muster.
          for (const c of after.filter((x) => x !== variant).map(ex)) {
            expect(c.caution_tags.some((t) => rules.excludedCautionTags.includes(t))).toBe(false);
            expect(c.equipment_ids.every((e) => profile.available.has(e))).toBe(true);
            expect(c.difficulty).toBeLessThanOrEqual(ex(id).difficulty);
            expect(c.movement_pattern).toBe(ex(id).movement_pattern);
          }
          if (before.join() === after.join()) {
            unchanged += 1;
            continue;
          }
          const removed = before.filter((x) => !after.includes(x));
          lines.push(
            `${id} | ${pLabel} | ${rLabel}${variant ? ` | Variante ${variant}` : ''}: [${before.join(', ')}] → [${after.join(', ')}]${
              removed.length > 0 ? ` (weg: ${removed.join(', ')})` : ''
            }`,
          );
        }
      }
    }
    expect({ unchanged, changed: lines }).toMatchSnapshot();
  }, 30_000);
});

describe('Zuordnung und Trainingsmodus mit Präferenzen (Etappe T1)', () => {
  it('alignShownExercises nutzt storedOrderNos (Präferenz-Ausblendung in der Mitte)', () => {
    const stored = session([
      planned('liegestuetz', { order_no: 1 }),
      planned('tuerrahmen-rudern', { order_no: 2 }),
      planned('kniebeuge-koerpergewicht', { order_no: 3 }),
    ]);
    const shown = prepareSessionForDisplay(stored, {
      rules: healthy,
      previousStartGroup: 'beginner',
      library,
      profile: homeNothing,
      swap: {
        swapRules: healthy,
        preferences: [pref('tuerrahmen-rudern', 'home', 'not_feasible')],
        location: 'home',
      },
    });
    expect(shown.hiddenByPreference).toEqual(['tuerrahmen-rudern']);
    expect(
      alignShownExercises(stored, shown).map((a) => [a.stored.order_no, a.shown.exercise_id]),
    ).toEqual([
      [1, 'liegestuetz'],
      [3, 'kniebeuge-koerpergewicht'],
    ]);
    // Ohne storedOrderNos (ältere Aufrufer): Vereinigung aus hidden und hiddenByPreference.
    const legacy = { ...shown, storedOrderNos: undefined };
    expect(alignShownExercises(stored, legacy).map((a) => a.stored.order_no)).toEqual([1, 3]);
    const items = planWorkout(stored, shown, [stored], context({ profile: homeNothing }));
    expect(items.map((i) => i.plannedOrderNo)).toEqual([1, 3]);
  });

  it('planWorkout: Ausschlüsse nie als Alternative, schwerere Variante mit exclude (S2)', () => {
    const stored = session([
      planned('kniebeuge-koerpergewicht', { order_no: 1, sets: 3, reps_min: 10, reps_max: 15 }),
    ]);
    const shown = prepareSessionForDisplay(stored, {
      rules: healthy,
      previousStartGroup: 'beginner',
      library,
      profile: homeNothing,
    });
    // Zustand am Ende des Puffers zweimal geschafft → harder_variant (wie im Test oben).
    const done = (date: string): ExerciseLogEntry => ({
      ...entry('kniebeuge-koerpergewicht', date, 0, 17),
      loadType: 'bodyweight',
      targetWeightKg: null,
      targetReps: 17,
      targetExtraSet: true,
      targetSets: 4,
      state: { weightKg: null, targetReps: 17, extraSet: true, durationS: null },
      sets: Array.from({ length: 4 }, () => ({
        reps: 17,
        weightKg: null,
        durationS: null,
        rpe: null,
        done: true,
      })),
    });
    const base = { profile: homeNothing, entries: [done('2026-10-05'), done('2026-10-07')] };
    const plain = planWorkout(stored, shown, [stored], context(base));
    expect(plain[0]?.plan?.hint.harderVariant?.exerciseId).toBe('kniebeuge-pause');
    expect(plain[0]?.alternatives.map((a) => a.id).at(-1)).toBe('kniebeuge-pause');
    const excluded = planWorkout(
      stored,
      shown,
      [stored],
      context({
        ...base,
        swap: {
          swapRules: healthy,
          preferences: [pref('kniebeuge-pause', 'home', 'dislike')],
          location: 'home',
        },
      }),
    );
    expect(excluded[0]?.plan?.hint).toEqual({ hint: null, harderVariant: null });
    expect(excluded[0]?.alternatives.map((a) => a.id)).not.toContain('kniebeuge-pause');
    // Ausschluss nur im Studio → zu Hause weiter vorgeschlagen.
    const atGym = planWorkout(
      stored,
      shown,
      [stored],
      context({
        ...base,
        swap: {
          swapRules: healthy,
          preferences: [pref('kniebeuge-pause', 'gym', 'dislike')],
          location: 'home',
        },
      }),
    );
    expect(atGym[0]?.plan?.hint.harderVariant?.exerciseId).toBe('kniebeuge-pause');
  });
});

describe('Progression nach einem Tausch (4.3, R2)', () => {
  it('Ersatz ohne eigene Einträge → „Startgewicht finden“; kein Übertragen der alten Gewichte', () => {
    const entries = ['2026-10-01', '2026-10-05', '2026-10-08'].map((d) =>
      entry('goblet-kniebeuge', d, 20, 10),
    );
    const replacement = planWorkoutExercise(
      ex('ausfallschritt-rueckwaerts-kurzhantel'),
      planned('ausfallschritt-rueckwaerts-kurzhantel'),
      ref,
      context({ entries, profile: home }),
    );
    expect(replacement.state).toBeNull();
    expect(replacement.prescription.weightKg).toBeNull();
  });

  it('alte Übung kommt nach mehr als 28 Tagen zurück → RETURN_AFTER_PAUSE', () => {
    const entries = [entry('goblet-kniebeuge', '2026-09-01', 20, 10)];
    const back = planWorkoutExercise(
      ex('goblet-kniebeuge'),
      planned('goblet-kniebeuge'),
      ref,
      context({ entries, profile: home }),
    );
    expect(back.progress.returnAfterPause).toBe(true);
  });
});
