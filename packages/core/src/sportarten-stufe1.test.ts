import { describe, expect, it } from 'vitest';

import { FLOW_RULES, FREE_SESSION, HYROX_RESULT_LIMITS, TRACKED_ROUTE_LIMITS } from './constants';
import { HYROX_SPLIT_SEGMENTS, HYROX_STATIONS, WALK_KINDS } from './enums';
import { freeSessionPayloadIssue } from './log/free-session';
import { cardioLogSchema, hyroxSplitsSchema, sessionLogPayloadSchema } from './log/schemas';
import { saveCompetitionPayloadSchema, toSaveCompetitionPayload } from './plan/competition-record';
import {
  isHardSession,
  stepsFitWorkoutType,
  type WorkoutStep,
  workoutStepSchema,
} from './plan/intensity';
import { trackedRouteSchema, updateTrackedRouteSchema } from './routes/schema';
import { wearableSessionImportSchema } from './wearables/schema';
import { checkWorkout } from './workouts/checks';
import { workoutSchema } from './workouts/schema';
import { makeWorkout, workoutItem, workoutLibraryMap } from './workouts/test-fixtures';

/**
 * Sportarten Stufe 1 · Etappe S (docs/PLAN-SPORTARTEN-STUFE-1.md 3): nur Listen, Typen und Zod-Schemas – die Fachlogik
 * folgt in den Etappen Y, W, R und H. Grenzfälle der neuen Felder (gleiche Regeln wie die Datenbank, db-sync.test.ts).
 */

const TODAY = '2026-10-27';

const cardio = (extra: Record<string, unknown>) => ({
  modality: 'run',
  duration_s: 1800,
  distance_m: 5000,
  elevation_m: null,
  ...extra,
});

function freeLog(extra: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    write_id: '00000000-0000-4000-8000-000000000002',
    base_revision: null,
    planned_session_id: null,
    planned_date: TODAY,
    kind: 'endurance',
    performed_on: TODAY,
    started_at: null,
    finished_at: null,
    status: 'completed',
    session_rpe: 7,
    notes: null,
    name_de: 'Lauf',
    is_intro_week: false,
    is_deload: false,
    source: 'manual',
    client_updated_at: '2026-10-27T12:00:00+01:00',
    exercises: [],
    cardio: cardio({}),
    is_free: true,
    ...extra,
  };
}

describe('Rudern und Wandern im Ausdauer-Eintrag (cardioLogSchema)', () => {
  it('Rudern: Watt 1–1000, Schlagzahl 10–60, 1–30 Intervalle – nur bei row', () => {
    const row = cardio({ modality: 'row', avg_power_w: 180, stroke_rate: 24 });
    expect(cardioLogSchema.safeParse(row).success).toBe(true);
    for (const [key, ok, bad] of [
      ['avg_power_w', [1, 1000], [0, 1001, 150.5]],
      ['stroke_rate', [10, 60], [9, 61]],
    ] as const) {
      for (const value of ok) {
        expect(cardioLogSchema.safeParse({ ...row, [key]: value }).success, `${key} ${value}`).toBe(
          true,
        );
      }
      for (const value of bad) {
        expect(cardioLogSchema.safeParse({ ...row, [key]: value }).success, `${key} ${value}`).toBe(
          false,
        );
      }
    }
    const rep = { distance_m: 500, duration_s: 110 };
    expect(cardioLogSchema.safeParse({ ...row, intervals: [rep] }).success).toBe(true);
    expect(cardioLogSchema.safeParse({ ...row, intervals: Array(30).fill(rep) }).success).toBe(
      true,
    );
    expect(cardioLogSchema.safeParse({ ...row, intervals: Array(31).fill(rep) }).success).toBe(
      false,
    );
    expect(cardioLogSchema.safeParse({ ...row, intervals: [] }).success).toBe(false);
    expect(
      cardioLogSchema.safeParse({ ...row, intervals: [{ ...rep, split_s: 110 }] }).success,
    ).toBe(false);
    expect(cardioLogSchema.safeParse(cardio({ stroke_rate: 24 })).success).toBe(false);
    expect(cardioLogSchema.safeParse(cardio({ avg_power_w: 200, modality: 'bike' })).success).toBe(
      false,
    );
  });

  it('Wandern: walk_kind nur beim Gehen; fehlt/null = Gehen (ältere Fassungen gültig)', () => {
    for (const kind of WALK_KINDS) {
      expect(cardioLogSchema.safeParse(cardio({ modality: 'walk', walk_kind: kind })).success).toBe(
        true,
      );
    }
    expect(cardioLogSchema.safeParse(cardio({ modality: 'walk' })).success).toBe(true);
    expect(cardioLogSchema.safeParse(cardio({ modality: 'walk', walk_kind: null })).success).toBe(
      true,
    );
    expect(cardioLogSchema.safeParse(cardio({ walk_kind: 'hike' })).success).toBe(false);
    expect(
      cardioLogSchema.safeParse(cardio({ modality: 'walk', walk_kind: 'via_ferrata' })).success,
    ).toBe(false);
  });

  it('freier Name: „Rudern“, je Art der Geh-Einheit, sonst wie bisher', () => {
    const issue = (extra: Record<string, unknown>) =>
      freeSessionPayloadIssue(sessionLogPayloadSchema.parse(freeLog(extra)), TODAY);
    expect(issue({ name_de: 'Rudern', cardio: cardio({ modality: 'row' }) })).toBeNull();
    expect(issue({ name_de: 'Lauf', cardio: cardio({ modality: 'row' }) })).toBe('invalid');
    for (const kind of WALK_KINDS) {
      expect(
        issue({
          name_de: FREE_SESSION.names.walkKinds[kind],
          cardio: cardio({ modality: 'walk', walk_kind: kind }),
        }),
      ).toBeNull();
    }
    expect(issue({ name_de: 'Spaziergang', cardio: cardio({ modality: 'walk' }) })).toBeNull();
    expect(
      issue({ name_de: 'Spaziergang', cardio: cardio({ modality: 'walk', walk_kind: 'hike' }) }),
    ).toBe('invalid');
    expect(issue({})).toBeNull();
  });
});

describe('Hyrox-Rennen (hyrox_splits)', () => {
  const split = (segment: string, duration_s = 300) => ({ segment, duration_s });

  it('0–17 Teilzeiten, jeder Abschnitt höchstens einmal, je 1 s–2 h', () => {
    expect(hyroxSplitsSchema.safeParse([]).success).toBe(true);
    expect(hyroxSplitsSchema.safeParse(HYROX_SPLIT_SEGMENTS.map((s) => split(s, 60))).success).toBe(
      true,
    );
    expect(HYROX_SPLIT_SEGMENTS).toHaveLength(HYROX_RESULT_LIMITS.maxSplits);
    expect(hyroxSplitsSchema.safeParse([split('run_1'), split('run_1')]).success).toBe(false);
    expect(hyroxSplitsSchema.safeParse([split('run_9')]).success).toBe(false);
    expect(hyroxSplitsSchema.safeParse([split('run_1', 0)]).success).toBe(false);
    expect(hyroxSplitsSchema.safeParse([split('run_1', 7201)]).success).toBe(false);
    expect(hyroxSplitsSchema.safeParse([split('run_1', 7200)]).success).toBe(true);
  });

  it('nur am freien „Hyrox-Rennen“ (Lauf), Summe höchstens die Gesamtzeit; fehlt = wie bisher', () => {
    const race = (extra: Record<string, unknown> = {}) =>
      freeLog({ name_de: 'Hyrox-Rennen', hyrox_splits: [split('run_1', 300)], ...extra });
    expect(sessionLogPayloadSchema.safeParse(race()).success).toBe(true);
    expect(
      freeSessionPayloadIssue(sessionLogPayloadSchema.parse(race({ hyrox_splits: [] })), TODAY),
    ).toBeNull();
    expect(
      freeSessionPayloadIssue(sessionLogPayloadSchema.parse(race({ name_de: 'Lauf' })), TODAY),
    ).toBe('invalid');
    expect(
      sessionLogPayloadSchema.safeParse(race({ hyrox_splits: [split('run_1', 1801)] })).success,
    ).toBe(false);
    expect(
      sessionLogPayloadSchema.safeParse(race({ cardio: cardio({ modality: 'bike' }) })).success,
    ).toBe(false);
    expect(sessionLogPayloadSchema.safeParse(race({ is_free: false })).success).toBe(false);
    expect(sessionLogPayloadSchema.safeParse(freeLog()).success).toBe(true);
  });
});

describe('Hyrox-Einheiten (Schritt-Typ station, harte Kombi)', () => {
  const station: WorkoutStep = {
    part: 'main',
    kind: 'station',
    seconds: 300,
    effort: 7,
    station: 'wall_balls',
  };
  const run: WorkoutStep = { part: 'main', kind: 'work', seconds: 300, effort: 7 };

  it('station genau beim Schritt-Typ station, nur bekannte Stationen', () => {
    expect(workoutStepSchema.safeParse(station).success).toBe(true);
    for (const s of HYROX_STATIONS) {
      expect(workoutStepSchema.safeParse({ ...station, station: s }).success, s).toBe(true);
    }
    expect(workoutStepSchema.safeParse({ ...station, station: 'tyre_flip' }).success).toBe(false);
    expect(workoutStepSchema.safeParse({ ...station, station: undefined }).success).toBe(false);
    expect(workoutStepSchema.safeParse({ ...run, station: 'rowing' }).success).toBe(false);
    expect(workoutStepSchema.safeParse(run).success).toBe(true);
  });

  it('Stationen nur in hyrox_combo und easy (locker); hyrox_combo zählt immer als hart', () => {
    expect(stepsFitWorkoutType('hyrox_combo', [run, station])).toBe(true);
    expect(stepsFitWorkoutType('easy', [{ ...station, effort: 4 }])).toBe(true);
    expect(stepsFitWorkoutType('easy', [station])).toBe(false);
    expect(stepsFitWorkoutType('intervals', [run, station])).toBe(false);
    expect(stepsFitWorkoutType('long', [{ ...station, effort: 3 }])).toBe(false);
    expect(isHardSession('hyrox_combo', [{ ...run, effort: 3 }])).toBe(true);
  });
});

describe('Hyrox-Wettkampf (hyrox_division)', () => {
  const base = {
    id: null,
    competition: { name: 'Hyrox Köln', discipline: 'hyrox' as const, raceDate: '2027-01-10' },
    plan: null,
  };

  it('Division genau bei Hyrox; ohne Angabe Open; andere Disziplinen ohne Feld', () => {
    expect(toSaveCompetitionPayload(base).hyrox_division).toBe('open');
    expect(toSaveCompetitionPayload({ ...base, hyroxDivision: 'pro' }).hyrox_division).toBe('pro');
    const tenK = toSaveCompetitionPayload({
      ...base,
      competition: { ...base.competition, discipline: '10k' },
    });
    expect('hyrox_division' in tenK).toBe(false);
    const payload = toSaveCompetitionPayload(base);
    expect(
      saveCompetitionPayloadSchema.safeParse({ ...payload, hyrox_division: null }).success,
    ).toBe(false);
    expect(
      saveCompetitionPayloadSchema.safeParse({ ...tenK, hyrox_division: 'open' }).success,
    ).toBe(false);
    expect(saveCompetitionPayloadSchema.safeParse({ ...payload, distance_km: 8 }).success).toBe(
      false,
    );
  });
});

describe('Wandern/Bergwandern an der Strecke (tracked_routes)', () => {
  const route = {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Hausberg',
    sport: 'walk',
    started_at: '2026-10-27T08:00:00.000Z',
    duration_s: 3600,
    moving_s: 3500,
    distance_m: 5000,
    elevation_gain_m: 420,
    polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    km_splits: [700, 700, 700, 700, 700],
    difficulty: null,
    is_favorite: false,
    base_route_id: null,
    note: null,
    session_log_id: null,
    source: 'recorded',
  };

  it('Abstieg, höchster Punkt und SAC-Stufe in den Grenzen; SAC nur bei Wandern/Bergwandern', () => {
    const ok = (extra: Record<string, unknown>) =>
      trackedRouteSchema.safeParse({ ...route, ...extra }).success;
    expect(ok({})).toBe(true);
    expect(ok({ walk_kind: 'mountain_hike', sac_grade: 3, max_altitude_m: 2650 })).toBe(true);
    expect(ok({ walk_kind: 'hike', sac_grade: 1 })).toBe(true);
    expect(ok({ sac_grade: 1 })).toBe(false);
    expect(ok({ walk_kind: 'walk', sac_grade: 1 })).toBe(false);
    expect(ok({ walk_kind: 'hike', sac_grade: 4 })).toBe(false);
    expect(ok({ max_altitude_m: TRACKED_ROUTE_LIMITS.maxAltitudeM.min })).toBe(true);
    expect(ok({ max_altitude_m: TRACKED_ROUTE_LIMITS.maxAltitudeM.max + 1 })).toBe(false);
    expect(ok({ elevation_loss_m: TRACKED_ROUTE_LIMITS.elevationLossM.max + 1 })).toBe(false);
    expect(ok({ sport: 'run', walk_kind: 'hike' })).toBe(false);
    const update = {
      id: route.id,
      name: 'Hausberg',
      difficulty: null,
      is_favorite: false,
      note: null,
    };
    expect(updateTrackedRouteSchema.safeParse(update).success).toBe(true);
    expect(
      updateTrackedRouteSchema.safeParse({ ...update, walk_kind: 'hike', sac_grade: 2 }).success,
    ).toBe(true);
  });
});

describe('Uhr: Rudergerät und Wanderung (wearableSessionImportSchema)', () => {
  const session = {
    external_id: 'hc-1',
    origin: 'samsung_health',
    group: 'walk',
    name_de: 'Wanderung',
    started_at: '2026-10-26T08:00:00Z',
    finished_at: '2026-10-26T08:30:00Z',
    performed_on: '2026-10-26',
    duration_s: 1800,
    distance_m: 5000,
    kcal: 300,
    heart_rate: null,
    merge_into: null,
    possible_duplicate_of: null,
  };

  it('walk_kind nur bei walk, Watt/Schlagzahl nur bei row; ohne Felder wie bisher', () => {
    const ok = (extra: Record<string, unknown>) =>
      wearableSessionImportSchema.safeParse({ ...session, ...extra }).success;
    expect(ok({})).toBe(true);
    expect(ok({ walk_kind: 'hike' })).toBe(true);
    expect(ok({ group: 'run', name_de: 'Lauf', walk_kind: 'hike' })).toBe(false);
    expect(ok({ group: 'row', name_de: 'Rudern', avg_power_w: 180, stroke_rate: 24 })).toBe(true);
    expect(ok({ avg_power_w: 180 })).toBe(false);
    expect(ok({ group: 'row', name_de: 'Rudern', stroke_rate: 61 })).toBe(false);
  });
});

describe('Workout-Format flow und Seitenwechsel (Yoga/Pilates/Mobility)', () => {
  const pose = (id: string, extra: Partial<Parameters<typeof workoutItem>[1]> = {}) =>
    workoutItem(id, { reps: null, duration_s: 60, rest_s: 0, ...extra });
  const flow = (extra: Parameters<typeof makeWorkout>[0] = {}) =>
    makeWorkout({
      category: 'yoga',
      format: 'flow',
      rounds: 1,
      round_rest_s: 0,
      minutes: 5,
      exercises: [
        pose('unterarmstuetz-kg', { duration_s: FLOW_RULES.poseS.max }),
        pose('hampelmann-kg', { side: 'both', duration_s: 75 }),
      ],
      ...extra,
    });
  const issues = (value: unknown) => {
    const result = workoutSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it('Pose 15–180 s ohne Pausen, Routine 5–45 min; side nur nach Zeit; fehlt = ohne Seitenwechsel', () => {
    expect(issues(flow())).toEqual([]);
    expect(issues(flow({ category: 'pilates' }))).toEqual([]);
    expect(
      issues(
        flow({
          category: 'rowing',
          format: 'interval',
          exercises: [pose('a-a-a', { rest_s: 10 }), pose('b-b-b', { rest_s: 10 })],
        }),
      ),
    ).toEqual([]);
    expect(
      issues(flow({ exercises: [pose('a-a-a', { duration_s: 14 }), pose('b-b-b')] })),
    ).not.toEqual([]);
    expect(
      issues(flow({ exercises: [pose('a-a-a', { duration_s: 181 }), pose('b-b-b')] })),
    ).not.toEqual([]);
    expect(issues(flow({ exercises: [pose('a-a-a', { rest_s: 5 }), pose('b-b-b')] }))).not.toEqual(
      [],
    );
    expect(issues(flow({ round_rest_s: 10, rounds: 2 }))).not.toEqual([]);
    expect(issues(flow({ minutes: 46 }))).not.toEqual([]);
    expect(
      issues(flow({ exercises: [pose('a-a-a', { reps: 10, duration_s: null }), pose('b-b-b')] })),
    ).not.toEqual([]);
    expect(
      issues(
        makeWorkout({ exercises: [workoutItem('a-a-a', { side: 'both' }), workoutItem('b-b-b')] }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('Seitenwechsel')]));
    // Außerhalb von flow bleibt die Belastung höchstens 120 s.
    expect(
      issues(
        makeWorkout({
          format: 'interval',
          exercises: [
            pose('a-a-a', { duration_s: 150, rest_s: 15 }),
            pose('b-b-b', { rest_s: 15 }),
          ],
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('flow')]));
  });

  it('W5: flow mit 1–2 Sternen braucht keine Pausen (ohne Pausen-Bildschirm)', () => {
    const w5 = checkWorkout(flow({ difficulty: 1 }), workoutLibraryMap()).filter(
      (i) => i.rule === 'W5' && i.message.includes('Pause'),
    );
    expect(w5).toEqual([]);
  });
});
