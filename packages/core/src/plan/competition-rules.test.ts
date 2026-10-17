import { describe, expect, it } from 'vitest';

import { fullPlan, runner } from './competition-test-helpers';
import { toSaveCompetitionPayload, type SaveCompetitionPayload } from './competition-record';
import {
  checkCancelCompetition,
  checkCompetitionSessions,
  checkCompleteCompetition,
  checkSaveCompetition,
  type PersonRuleContext,
  type SaveCompetitionContext,
  serverMinimumLeadWeeks,
} from './competition-rules';
import { isHardWorkoutType } from './intensity';

/**
 * Regeln der Wettkampf-Funktionen für den Testmodus (WP4) – dieselben Fälle wie pgTAP 35/36 (Server). Feste Werte,
 * bewusst nicht aus constants.ts: Server-Mindestvorlauf 4/6/10/14 Wochen, 52 Wochen, Referenz 183 Tage.
 */

const TODAY = '2026-10-16';
const ctx = (over: Partial<SaveCompetitionContext> = {}): SaveCompetitionContext => ({
  today: TODAY,
  birthDate: '1990-05-15',
  usesHealthData: true,
  medicalNotice: false,
  pregnancy: false,
  existing: [],
  ...over,
});
const payload = (over: Partial<SaveCompetitionPayload> = {}): SaveCompetitionPayload => ({
  ...toSaveCompetitionPayload({
    id: null,
    competition: { name: 'Stadtlauf', discipline: 'half_marathon', raceDate: '2027-02-07' },
    plan: { effectiveGoal: 'finish' },
  }),
  ...over,
});

describe('checkSaveCompetition (= save_competition)', () => {
  it('gültiger Wettkampf mit Plan-Bezug', () => {
    expect(checkSaveCompetition(payload(), ctx())).toEqual({ ok: true });
  });
  it('Server-Mindestvorlauf = lockerste Spalte: genau 10 Wochen ok, 1 Tag darunter nicht', () => {
    expect(serverMinimumLeadWeeks('half_marathon')).toBe(10);
    expect(serverMinimumLeadWeeks('marathon')).toBe(14);
    expect(checkSaveCompetition(payload({ race_date: '2026-12-25' }), ctx())).toEqual({ ok: true });
    expect(checkSaveCompetition(payload({ race_date: '2026-12-24' }), ctx())).toEqual({
      ok: false,
      reason: 'race_date',
    });
  });
  it('Renntag höchstens heute + 52 Wochen', () => {
    expect(checkSaveCompetition(payload({ race_date: '2027-10-15' }), ctx()).ok).toBe(true);
    expect(checkSaveCompetition(payload({ race_date: '2027-10-16' }), ctx())).toMatchObject({
      reason: 'race_date',
    });
  });
  it('Referenzzeit höchstens 183 Tage alt, nicht in der Zukunft', () => {
    const ref = (date: string) =>
      payload({ reference_discipline: '10k', reference_time_s: 3000, reference_date: date });
    expect(checkSaveCompetition(ref('2026-04-16'), ctx()).ok).toBe(true);
    expect(checkSaveCompetition(ref('2026-04-15'), ctx())).toMatchObject({
      reason: 'reference_date',
    });
    expect(checkSaveCompetition(ref('2026-10-17'), ctx())).toMatchObject({
      reason: 'reference_date',
    });
  });
  it('Plan-Bezug nur mit Einwilligung und Check; Countdown ohne Bezug geht auch ohne', () => {
    expect(checkSaveCompetition(payload(), ctx({ usesHealthData: false }))).toMatchObject({
      reason: 'health_check_required',
    });
    expect(
      checkSaveCompetition(payload({ effective_goal: null }), ctx({ usesHealthData: false })).ok,
    ).toBe(true);
  });
  it('Tabelle 3.3: Schwangerschaft, unter 18 Marathon, Zielzeit ab 65/mit Flag', () => {
    expect(checkSaveCompetition(payload(), ctx({ pregnancy: true }))).toMatchObject({
      reason: 'not_allowed',
    });
    const marathon = payload({ discipline: 'marathon', race_date: '2027-03-07' });
    expect(checkSaveCompetition(marathon, ctx({ birthDate: '2009-11-01' }))).toMatchObject({
      reason: 'not_allowed',
    });
    expect(checkSaveCompetition(marathon, ctx({ birthDate: '2008-10-16' })).ok).toBe(true);
    const time = payload({
      goal_kind: 'time',
      target_time_s: 6600,
      reference_discipline: '10k',
      reference_time_s: 3000,
      reference_date: '2026-09-01',
      effective_goal: 'time',
    });
    expect(checkSaveCompetition(time, ctx()).ok).toBe(true);
    expect(checkSaveCompetition(time, ctx({ birthDate: '1961-10-16' }))).toMatchObject({
      reason: 'not_allowed',
    });
    expect(checkSaveCompetition(time, ctx({ medicalNotice: true }))).toMatchObject({
      reason: 'not_allowed',
    });
  });
  it('höchstens ein geplanter Wettkampf; Ändern nur eigener geplanter', () => {
    const existing = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'planned' as const,
        discipline: 'half_marathon' as const,
        race_date: '2026-11-01', // inzwischen unter dem Mindestvorlauf – Ändern ohne neues Datum bleibt erlaubt
        reference_discipline: null,
        reference_time_s: null,
        reference_date: null,
      },
    ];
    expect(checkSaveCompetition(payload(), ctx({ existing }))).toMatchObject({
      reason: 'competition_exists',
    });
    const edit = payload({ id: existing[0]?.id ?? null, race_date: '2026-11-01', name: 'Neu' });
    expect(checkSaveCompetition(edit, ctx({ existing })).ok).toBe(true);
    expect(
      checkSaveCompetition({ ...edit, race_date: '2026-11-08' }, ctx({ existing })),
    ).toMatchObject({ reason: 'race_date' });
    expect(
      checkSaveCompetition(edit, ctx({ existing: [{ ...existing[0]!, status: 'done' }] })),
    ).toMatchObject({ reason: 'not_planned' });
    expect(
      checkSaveCompetition(
        payload({ id: '22222222-2222-4222-8222-222222222222' }),
        ctx({ existing }),
      ),
    ).toMatchObject({ reason: 'not_found' });
  });
  it('ungültige Form', () => {
    expect(checkSaveCompetition(payload({ name: ' x' }), ctx())).toMatchObject({
      reason: 'invalid',
    });
  });
});

describe('checkCancelCompetition / checkCompleteCompetition', () => {
  const existing = [
    { id: 'a', status: 'planned' as const, race_date: '2026-10-11' },
    { id: 'b', status: 'cancelled' as const, race_date: '2026-10-11' },
    { id: 'c', status: 'planned' as const, race_date: '2026-10-20' },
  ];
  const logs = [
    { id: 'log1', kind: 'endurance', performed_on: '2026-10-11' },
    { id: 'log2', kind: 'strength', performed_on: '2026-10-11' },
    { id: 'log3', kind: 'endurance', performed_on: '2026-10-12' },
  ];
  it('absagen nur geplante', () => {
    expect(checkCancelCompetition('a', existing).ok).toBe(true);
    expect(checkCancelCompetition('b', existing)).toMatchObject({ reason: 'not_planned' });
    expect(checkCancelCompetition('x', existing)).toMatchObject({ reason: 'not_found' });
  });
  it('abschließen ab dem Renntag, Ergebnis nur eigener Ausdauer-Eintrag vom Renntag', () => {
    const c = { today: TODAY, existing, logs };
    expect(checkCompleteCompetition('a', 'log1', c).ok).toBe(true);
    expect(checkCompleteCompetition('a', null, c).ok).toBe(true);
    expect(checkCompleteCompetition('a', 'log2', c)).toMatchObject({ reason: 'result_rejected' });
    expect(checkCompleteCompetition('a', 'log3', c)).toMatchObject({ reason: 'result_rejected' });
    expect(checkCompleteCompetition('c', null, c)).toMatchObject({ reason: 'result_rejected' });
    expect(checkCompleteCompetition('b', null, c)).toMatchObject({ reason: 'not_planned' });
  });
});

describe('checkCompetitionSessions (= Regeln je Person in insert_plan_sessions)', () => {
  const inputs = runner('half_marathon', 'advanced', {
    schedule: {
      mode: 'fixed',
      slots: [
        { weekday: 3, kind: 'endurance', minutes: 60 },
        { weekday: 5, kind: 'endurance', minutes: 60 },
        { weekday: 7, kind: 'endurance', minutes: 150 },
      ],
    },
  });
  // Ganzer Plan (alle Blöcke) – erst Aufbau und Spitze enthalten harte Einheiten.
  const sessions = fullPlan(
    inputs,
    { competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: '2027-03-07' } },
    TODAY,
  ).sessions;
  const person = (over: Partial<PersonRuleContext> = {}): PersonRuleContext => ({
    today: TODAY,
    birthDate: '1996-01-15',
    plan: {
      usesHealthData: true,
      medicalNotice: false,
      level: 'advanced',
      discipline: 'half_marathon',
    },
    profileLevel: 'advanced',
    pregnancy: false,
    competition: { discipline: 'half_marathon', usesHealthData: true },
    ...over,
  });

  it('der Plan der Engine passt (enthält harte Einheiten)', () => {
    expect(sessions.some((s) => isHardWorkoutType(s.workout_type))).toBe(true);
    expect(checkCompetitionSessions(sessions, sessions, person())).toEqual({ ok: true });
  });
  it('Pläne ohne Wettkampf: keine Prüfung', () => {
    const plain = sessions.map((s) => ({ ...s, workout_type: null }));
    expect(checkCompetitionSessions(plain, plain, person({ competition: null })).ok).toBe(true);
  });
  it('ohne geplanten Wettkampf mit Plan-Bezug bzw. ohne Check abgelehnt', () => {
    expect(
      checkCompetitionSessions(sessions, sessions, person({ competition: null })),
    ).toMatchObject({ reason: 'not_found' });
    expect(
      checkCompetitionSessions(
        sessions,
        sessions,
        person({ competition: { discipline: 'half_marathon', usesHealthData: false } }),
      ),
    ).toMatchObject({ reason: 'not_found' });
    expect(
      checkCompetitionSessions(
        sessions,
        sessions,
        person({ plan: { ...person().plan, usesHealthData: false } }),
      ),
    ).toMatchObject({ reason: 'health_check_required' });
    expect(checkCompetitionSessions(sessions, sessions, person({ pregnancy: true }))).toMatchObject(
      { reason: 'not_allowed' },
    );
  });
  it('Disziplin muss zum Wettkampf passen', () => {
    expect(
      checkCompetitionSessions(
        sessions,
        sessions,
        person({ competition: { discipline: '10k', usesHealthData: true } }),
      ),
    ).toMatchObject({ reason: 'invalid' });
  });
  it('Arzt-Hinweis: keine harte Einheit; unter 18 höchstens 7; Einsteiger 1 harte je Woche', () => {
    expect(
      checkCompetitionSessions(
        sessions,
        sessions,
        person({ plan: { ...person().plan, medicalNotice: true } }),
      ),
    ).toMatchObject({ reason: 'not_allowed' });
    const hardIndex = sessions.findIndex((s) => isHardWorkoutType(s.workout_type));
    const eight = sessions.map((s, i) => (i === hardIndex ? { ...s, effort_target: 8 } : s));
    expect(checkCompetitionSessions(eight, eight, person()).ok).toBe(true);
    expect(
      checkCompetitionSessions(eight, eight, person({ birthDate: '2009-11-01' })),
    ).toMatchObject({ reason: 'not_allowed' });
    // Zwei harte Einheiten in einer Woche: Fortgeschritten ok, Einsteiger (Profil) nur 1.
    const tempo = (scheduled_on: string) => ({
      kind: 'endurance',
      scheduled_on,
      estimated_minutes: 40,
      effort_target: 7,
      workout_type: 'tempo' as const,
      workout_steps: [
        { part: 'warmup' as const, kind: 'easy' as const, seconds: 600, effort: 3 },
        { part: 'main' as const, kind: 'work' as const, seconds: 1500, effort: 7 },
        { part: 'cooldown' as const, kind: 'easy' as const, seconds: 300, effort: 3 },
      ],
    });
    const two = [tempo('2026-11-03'), tempo('2026-11-05')];
    expect(checkCompetitionSessions(two, two, person()).ok).toBe(true);
    expect(checkCompetitionSessions(two, two, person({ profileLevel: 'beginner' }))).toMatchObject({
      reason: 'not_allowed',
    });
    expect(
      checkCompetitionSessions(two, two, person({ plan: { ...person().plan, level: 'beginner' } })),
    ).toMatchObject({ reason: 'not_allowed' });
    // Über die Blockgrenze: die bisherige Einheit derselben Woche zählt mit.
    expect(
      checkCompetitionSessions([two[1]!], two, person({ profileLevel: 'beginner' })),
    ).toMatchObject({ reason: 'not_allowed' });
  });
  it('gestrichene harte Einheiten zählen nicht', () => {
    const tempo = {
      kind: 'endurance',
      estimated_minutes: 40,
      effort_target: 7,
      workout_type: 'tempo' as const,
      workout_steps: null,
    };
    const week = [
      { ...tempo, scheduled_on: '2026-11-03', status: 'skipped' },
      { ...tempo, scheduled_on: '2026-11-05', status: 'planned' },
    ];
    expect(checkCompetitionSessions(week, week, person({ profileLevel: 'beginner' })).ok).toBe(
      true,
    );
  });
  it('Einheit über dem Distanz-Deckel des langen Laufs (Halbmarathon 120 min)', () => {
    const typedFirst = sessions.findIndex((s) => s.workout_type);
    const attacked = sessions.map((s, i) =>
      i === typedFirst ? { ...s, estimated_minutes: 121 } : s,
    );
    expect(checkCompetitionSessions(attacked, attacked, person())).toMatchObject({
      reason: 'invalid',
    });
  });
});
