/**
 * Gespeicherter Wettkampf und Wettkampf-Einheiten in der Datenbank-Eingabe (docs/PLAN-PHASE-10.md Abschnitt 7, Etappe
 * WP3): Abbildung Wettkampf ↔ save_competition ↔ Zeile, Zod-Grenzen wie die CHECKs, und „jeder Wettkampfplan der
 * Engine passt durch die Eingabe-Prüfung von save_training_plan/append_plan_block“ (Eigenschaftstest über ganze Pläne).
 * Erwartungen bewusst als feste Zahlen (Plan 3.3, Wächter N2), nicht aus constants.ts.
 */
import { describe, expect, it } from 'vitest';

import { startOfIsoWeek } from '../dates';
import {
  competitionDistanceM,
  type CompetitionRow,
  saveCompetitionPayloadSchema,
  storedCompetitionFromRow,
  toSaveCompetitionPayload,
} from './competition-record';
import type { CompetitionDiscipline } from './competition-schema';
import { fullPlan, request, runner } from './competition-test-helpers';
import { generateTrainingPlan } from './generate';
import { isHardSession, isHardWorkoutType, stepsFitWorkoutType } from './intensity';
import {
  appendPlanBlockSchema,
  savePlanPayloadSchema,
  savePlanSessionSchema,
  toAppendBlockPayload,
  toSavePlanPayload,
  toSavePlanSession,
} from './payload';
import type { GeneratedSession } from './schedule';
import { library } from './competition-test-helpers';
import { person } from './test-library';

const TODAY = '2026-10-07';
const base = {
  id: null,
  competition: { name: '  Stadtlauf Köln ', discipline: '10k' as const, raceDate: '2027-01-10' },
  plan: null,
};

function row(payload: ReturnType<typeof toSaveCompetitionPayload>): CompetitionRow {
  return {
    ...payload,
    id: 'c0000000-0000-4000-8000-000000000001',
    user_id: 'u1',
    distance_m: competitionDistanceM(payload.discipline, payload.distance_km ?? null),
    status: 'planned',
    result_session_log_id: null,
    uses_health_data: payload.effective_goal !== null,
    created_at: '2026-10-07T10:00:00Z',
    updated_at: '2026-10-07T10:00:00Z',
  };
}

describe('toSaveCompetitionPayload / saveCompetitionPayloadSchema', () => {
  it('Wettkampf ohne Plan: getrimmter Name, Plan-Bezug leer, alle Felder vorhanden', () => {
    const payload = toSaveCompetitionPayload(base);
    expect(payload).toEqual({
      id: null,
      name: 'Stadtlauf Köln',
      discipline: '10k',
      race_date: '2027-01-10',
      goal_kind: 'finish',
      target_time_s: null,
      reference_discipline: null,
      reference_time_s: null,
      reference_date: null,
      long_run_weekday: null,
      own_start_weekly_minutes: null,
      start_reference_volume: null,
      start_reference_session_cap: null,
      start_reference_start_group: null,
      effective_goal: null,
    });
    // WP5: ohne Rad kein Feld distance_km (ältere Server nehmen die Eingabe so weiter an).
    expect('distance_km' in payload).toBe(false);
  });

  it('mit Plan-Bezug: eigener Startumfang so wie eingegeben, Tagebuch-Bezug, wirksames Ziel, Wunsch-Tag', () => {
    const payload = toSaveCompetitionPayload({
      id: 'c0000000-0000-4000-8000-000000000001',
      competition: {
        ...base.competition,
        goal: 'time',
        targetTimeS: 3000,
        reference: { discipline: '5k', timeS: 1440, date: '2026-09-01' },
      },
      longRunWeekday: 7,
      plan: {
        effectiveGoal: 'finish',
        ownStart: { weeklyMinutes: 500, confirmed: true },
        startReference: { volume: 120, sessionCap: 40, startGroup: 'advanced' },
      },
    });
    expect(payload).toMatchObject({
      goal_kind: 'time',
      target_time_s: 3000,
      reference_discipline: '5k',
      reference_time_s: 1440,
      reference_date: '2026-09-01',
      long_run_weekday: 7,
      own_start_weekly_minutes: 500,
      start_reference_volume: 120,
      start_reference_session_cap: 40,
      start_reference_start_group: 'advanced',
      effective_goal: 'finish',
    });
  });

  it('ungültige Angaben werfen (Programmierfehler)', () => {
    expect(() =>
      toSaveCompetitionPayload({ ...base, competition: { ...base.competition, name: '   ' } }),
    ).toThrow();
    expect(() =>
      toSaveCompetitionPayload({
        ...base,
        competition: { ...base.competition, goal: 'time', targetTimeS: 3000 },
      }),
    ).toThrow();
  });

  const ok = toSaveCompetitionPayload(base);
  it.each([
    ['unbekanntes Feld', { ...ok, foo: 1 }],
    ['Name mit Leerzeichen am Rand', { ...ok, name: ' Köln' }],
    ['Name 81 Zeichen', { ...ok, name: 'x'.repeat(81) }],
    ['Disziplin ohne Wettkampfplan', { ...ok, discipline: 'cycling' }],
    ['Zielzeit ohne Ziel „Zielzeit“', { ...ok, target_time_s: 3000 }],
    ['Referenz unvollständig', { ...ok, reference_discipline: '5k', reference_time_s: 1440 }],
    [
      'Referenz nicht vor dem Renntag',
      { ...ok, reference_discipline: '5k', reference_time_s: 1440, reference_date: '2027-01-10' },
    ],
    [
      'unplausible Referenzzeit',
      { ...ok, reference_discipline: '5k', reference_time_s: 700, reference_date: '2026-09-01' },
    ],
    ['Wunsch-Tag 8', { ...ok, long_run_weekday: 8 }],
    ['eigener Start ohne wirksames Ziel', { ...ok, own_start_weekly_minutes: 200 }],
    [
      'eigener Start über 1.680 min',
      { ...ok, effective_goal: 'finish', own_start_weekly_minutes: 1681 },
    ],
    ['Bezug ohne Startgruppe', { ...ok, effective_goal: 'finish', start_reference_volume: 120 }],
    [
      'Bezug: längste Einheit länger als die Woche',
      {
        ...ok,
        effective_goal: 'finish',
        start_reference_volume: 30,
        start_reference_session_cap: 40,
        start_reference_start_group: 'beginner',
      },
    ],
    [
      'Bezug unter 10 Minuten',
      {
        ...ok,
        effective_goal: 'finish',
        start_reference_volume: 5,
        start_reference_start_group: 'beginner',
      },
    ],
    [
      'längste Einheit ohne Bezug',
      { ...ok, effective_goal: 'finish', start_reference_session_cap: 40 },
    ],
    ['wirksame Zielzeit beim Ziel „Ankommen“', { ...ok, effective_goal: 'time' }],
  ])('abgelehnt: %s', (_label, payload) => {
    expect(saveCompetitionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('fehlendes Feld abgelehnt (alle Felder Pflicht, wie `?&` in der Migration)', () => {
    const rest: Record<string, unknown> = { ...ok };
    delete rest.long_run_weekday;
    expect(saveCompetitionPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('Grenzwerte erlaubt: Name 80 Zeichen, Bezug 0 ohne längste Einheit, eigener Start 10 und 1.680', () => {
    for (const payload of [
      { ...ok, name: 'ö'.repeat(80) },
      {
        ...ok,
        effective_goal: 'finish',
        start_reference_volume: 0,
        start_reference_start_group: 'cautious',
      },
      { ...ok, effective_goal: 'finish', own_start_weekly_minutes: 10 },
      { ...ok, effective_goal: 'finish', own_start_weekly_minutes: 1680 },
    ]) {
      expect(saveCompetitionPayloadSchema.safeParse(payload).success).toBe(true);
    }
  });
});

describe('storedCompetitionFromRow', () => {
  it('Zeile → Wettkampf + Anfrage (Rundreise, Folgeblock rechnet mit denselben Eingaben)', () => {
    const payload = toSaveCompetitionPayload({
      id: null,
      competition: {
        name: 'Halbmarathon',
        discipline: 'half_marathon',
        raceDate: '2027-04-11',
        goal: 'time',
        targetTimeS: 6600,
        reference: { discipline: '10k', timeS: 2900, date: '2026-09-20' },
      },
      longRunWeekday: 6,
      plan: {
        effectiveGoal: 'time',
        ownStart: { weeklyMinutes: 200, confirmed: true },
        startReference: { volume: 150, sessionCap: null, startGroup: 'competitive' },
      },
    });
    const stored = storedCompetitionFromRow(row(payload));
    expect(stored).toEqual({
      id: 'c0000000-0000-4000-8000-000000000001',
      status: 'planned',
      competition: {
        name: 'Halbmarathon',
        discipline: 'half_marathon',
        raceDate: '2027-04-11',
        goal: 'time',
        targetTimeS: 6600,
        reference: { discipline: '10k', timeS: 2900, date: '2026-09-20' },
        distanceKm: null,
      },
      ownStart: { weeklyMinutes: 200, confirmed: true },
      startReference: { volume: 150, sessionCap: null, startGroup: 'competitive' },
      longRunWeekday: 6,
      effectiveGoal: 'time',
      resultSessionLogId: null,
    });
  });

  it('ohne Plan-Bezug (oder nach dem Widerruf geleert): effectiveGoal null, keine Zusatzangaben', () => {
    const stored = storedCompetitionFromRow(row(toSaveCompetitionPayload(base)));
    expect(stored).toMatchObject({ effectiveGoal: null, ownStart: null, startReference: null });
  });

  it('unlesbare Zeile → null (nie mit falschen Werten planen)', () => {
    const broken = {
      ...row(toSaveCompetitionPayload(base)),
      discipline: 'cycling',
    } as unknown as CompetitionRow;
    expect(storedCompetitionFromRow(broken)).toBeNull();
  });

  it('Distanz je Disziplin (= CHECK competitions_distance)', () => {
    expect((['5k', '10k', 'half_marathon', 'marathon'] as const).map(competitionDistanceM)).toEqual(
      [5000, 10000, 21097.5, 42195],
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// Wettkampf-Einheiten in der Eingabe von save_training_plan / append_plan_block
// ---------------------------------------------------------------------------------------------------------

describe('savePlanSessionSchema mit Wettkampf-Feldern (= CHECK planned_sessions_workout_fields)', () => {
  const steps = (minutes: number, effort: number) => [
    { part: 'warmup' as const, kind: 'easy' as const, seconds: 600, effort: 3 },
    { part: 'main' as const, kind: 'work' as const, seconds: minutes * 60 - 900, effort },
    { part: 'cooldown' as const, kind: 'easy' as const, seconds: 300, effort: 3 },
  ];
  const tempo = {
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'endurance' as const,
    template_day_index: null,
    scheduled_on: '2026-10-12',
    name_de: 'Tempolauf',
    focus: null,
    endurance_modality: 'run' as const,
    effort_target: 7,
    estimated_minutes: 40,
    warmup_de: 'Einlaufen.',
    cooldown_de: 'Auslaufen.',
    exercises: [],
    workout_type: 'tempo' as const,
    training_phase: 'build' as const,
    workout_steps: steps(40, 7),
    target_distance_m: null,
  };
  const ok = (s: unknown) => savePlanSessionSchema.safeParse(s).success;

  it('erlaubt: Tempo 7, Intervalle 8, harte Art im Tapering (Erholungswoche), locker ohne Art bis 4', () => {
    expect(ok(tempo)).toBe(true);
    expect(
      ok({ ...tempo, workout_type: 'intervals', effort_target: 8, workout_steps: steps(40, 8) }),
    ).toBe(true);
    expect(ok({ ...tempo, is_deload: true, training_phase: 'taper' })).toBe(true);
    const plain: Record<string, unknown> = { ...tempo, effort_target: 4 };
    for (const key of ['workout_type', 'training_phase', 'workout_steps', 'target_distance_m']) {
      delete plain[key];
    }
    expect(ok(plain)).toBe(true);
  });

  it.each([
    ['ohne Art über 4', { workout_type: null, training_phase: null, workout_steps: null }],
    ['Anstrengung 9', { effort_target: 9 }],
    ['über 4 bei lockerer Art', { workout_type: 'easy', effort_target: 5 }],
    ['harte Art in einer Erholungswoche (Aufbau)', { is_deload: true }],
    ['Art ohne Phase', { training_phase: null }],
    ['Art ohne Schritte', { workout_steps: null }],
    ['Schritte ≠ Dauer', { estimated_minutes: 41 }],
    ['Distanz unter 100 m', { target_distance_m: 99 }],
    ['Distanz nicht ganzzahlig', { target_distance_m: 7500.5 }],
  ])('abgelehnt: %s', (_label, change) => {
    expect(ok({ ...tempo, ...change })).toBe(false);
  });

  it('Kraft mit Art abgelehnt', () => {
    expect(
      ok({
        ...tempo,
        kind: 'strength',
        focus: 'full_body',
        template_day_index: 1,
        endurance_modality: null,
        effort_target: null,
      }),
    ).toBe(false);
  });
});

describe('Plan ohne Wettkampf: Eingabe byte-gleich (keine neuen Schlüssel)', () => {
  it('toSavePlanSession ohne Wettkampf-Felder liefert genau die bisherigen Schlüssel', () => {
    const result = generateTrainingPlan(
      person({
        goalType: 'endurance',
        discipline: '10k',
        schedule: {
          mode: 'fixed',
          slots: [
            { weekday: 2, kind: 'endurance', minutes: 40 },
            { weekday: 4, kind: 'strength_gym', minutes: 45 },
          ],
        },
      }),
      library,
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    for (const session of toSavePlanPayload(result.plan).sessions) {
      expect(Object.keys(session).sort()).toEqual(
        [
          'block_no',
          'week_no',
          'is_intro_week',
          'is_deload',
          'kind',
          'template_day_index',
          'scheduled_on',
          'name_de',
          'focus',
          'endurance_modality',
          'effort_target',
          'estimated_minutes',
          'warmup_de',
          'cooldown_de',
          'exercises',
        ].sort(),
      );
    }
  });
});

describe('Eigenschaft: jeder Wettkampfplan der Engine passt durch die Datenbank-Eingabe (WP3)', () => {
  // Feste Regeln je Person (Plan 3.3, Wächter N2) – unabhängig von constants.ts.
  const HARD_PER_WEEK = { beginner: 1, advanced: 2, competitive: 2 } as const;
  const cases: {
    discipline: CompetitionDiscipline;
    level: 'beginner' | 'advanced' | 'competitive';
    raceDate: string;
    birthDate?: string;
  }[] = [];
  const races: Partial<Record<CompetitionDiscipline, string[]>> = {
    '5k': ['2026-12-20', '2027-03-07'],
    '10k': ['2027-01-17', '2027-05-02'],
    half_marathon: ['2027-02-28', '2027-06-13'],
    marathon: ['2027-05-23', '2027-09-26'],
  };
  for (const discipline of Object.keys(races) as CompetitionDiscipline[]) {
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      for (const raceDate of races[discipline] ?? []) cases.push({ discipline, level, raceDate });
    }
  }
  cases.push({
    discipline: 'half_marathon',
    level: 'advanced',
    raceDate: '2027-04-11',
    birthDate: '2009-06-01',
  });
  let hardTotal = 0;

  it.each(cases)(
    '$discipline $level $raceDate $birthDate',
    ({ discipline, level, raceDate, birthDate }) => {
      const inputs = runner(discipline, level, {
        schedule: {
          mode: 'fixed',
          // Kraft am Montag (Beine), Läufe Mi/Fr/Sa, langer Lauf So – harte Einheiten sind möglich (Mi/Fr, nie neben
          // Bein-Kraft oder dem langen Lauf).
          slots: [
            { weekday: 1, kind: 'strength_home', minutes: 45 },
            { weekday: 3, kind: 'endurance', minutes: 60 },
            { weekday: 5, kind: 'endurance', minutes: 60 },
            { weekday: 6, kind: 'endurance', minutes: 40 },
            { weekday: 7, kind: 'endurance', minutes: 180 },
          ],
        },
        ...(birthDate === undefined ? {} : { birthDate }),
      });
      const { plan, sessions } = fullPlan(inputs, request(discipline, raceDate), TODAY);
      const payload = toSavePlanPayload(plan);
      expect(savePlanPayloadSchema.safeParse(payload).success).toBe(true);
      for (let block = 2; block <= Math.max(...sessions.map((s) => s.block_no)); block += 1) {
        const blockSessions = sessions.filter((s) => s.block_no === block) as GeneratedSession[];
        expect(appendPlanBlockSchema.safeParse(toAppendBlockPayload(blockSessions)).success).toBe(
          true,
        );
      }
      // Regeln je Person, die der Server zusätzlich prüft (private.insert_plan_sessions).
      const minor = birthDate !== undefined;
      const cap = minor ? 7 : 8;
      const perWeek = new Map<string, number>();
      for (const s of sessions as GeneratedSession[]) {
        const saved = toSavePlanSession(s);
        if (s.kind !== 'endurance') {
          expect(saved.workout_type ?? null).toBeNull();
          continue;
        }
        expect(saved.workout_type).not.toBeNull();
        expect(saved.effort_target ?? 0).toBeLessThanOrEqual(cap);
        for (const st of saved.workout_steps ?? []) expect(st.effort).toBeLessThanOrEqual(cap);
        if (isHardWorkoutType(s.workout_type)) {
          const week = startOfIsoWeek(s.scheduled_on);
          perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
        }
      }
      const limit = minor ? 1 : HARD_PER_WEEK[level];
      for (const count of perWeek.values()) expect(count).toBeLessThanOrEqual(limit);
      hardTotal += [...perWeek.values()].reduce((sum, n) => sum + n, 0);
    },
  );

  it('nicht leer: die Pläne enthalten harte Einheiten (sonst prüft die Eigenschaft nichts)', () => {
    expect(hardTotal).toBeGreaterThan(50);
  });
});

describe('Wächter WP3 H1: Schritte passen zur Art (stepsFitWorkoutType, isHardSession)', () => {
  const step = (kind: 'work' | 'easy', seconds: number, effort: number) => ({
    part: 'main' as const,
    kind,
    seconds,
    effort,
  });
  const strides = (n: number, seconds = 20, effort = 7) =>
    Array.from({ length: n }, () => [step('work', seconds, effort), step('easy', 60, 3)]).flat();

  it('lockere Arten nur bis Anstrengung 4', () => {
    for (const type of ['easy', 'long', 'recovery'] as const) {
      expect(stepsFitWorkoutType(type, [step('easy', 1800, 4)])).toBe(true);
      expect(stepsFitWorkoutType(type, [step('easy', 1800, 5)])).toBe(false);
    }
  });

  it('Steigerungen: höchstens 6 × 20 s als Belastung, sonst locker', () => {
    expect(stepsFitWorkoutType('strides', strides(6))).toBe(true);
    expect(stepsFitWorkoutType('strides', strides(7))).toBe(false);
    expect(stepsFitWorkoutType('strides', strides(6, 21))).toBe(false);
    expect(stepsFitWorkoutType('strides', [step('easy', 20, 7)])).toBe(false);
  });

  it('harte Arten frei; hart = harte Art oder Abschnitt ab 6 länger als 20 s', () => {
    expect(stepsFitWorkoutType('intervals', [step('work', 180, 8)])).toBe(true);
    expect(isHardSession('fartlek', [step('easy', 600, 3)])).toBe(true);
    expect(isHardSession('easy', [step('work', 21, 6)])).toBe(true);
    expect(isHardSession('strides', strides(6))).toBe(false);
    expect(isHardSession(null, null)).toBe(false);
  });
});
