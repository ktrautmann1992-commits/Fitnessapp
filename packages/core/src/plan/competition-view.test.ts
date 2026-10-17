import { describe, expect, it } from 'vitest';

import {
  competitionCountdown,
  competitionPaceProfile,
  competitionPlanWeek,
  competitionToShow,
  isRaceWeek,
  postRaceRecoveryEnd,
  recentCompetitionStartReference,
  sessionPaceInfo,
} from './competition-view';
import type { PreviousSession } from './schedule';

/**
 * Anzeige eines Wettkampfs (Etappe WP4): Countdown, Rennwoche, Woche im Plan, Erholung, Pace, Tagebuch-Bezug.
 * Erwartungen bewusst als feste Werte (Kalender Oktober 2026: 12.10. = Montag).
 */

const base = {
  status: 'planned' as const,
  discipline: 'half_marathon' as const,
  raceDate: '2026-11-08', // Sonntag
  resultSessionLogId: null,
};

describe('competitionCountdown', () => {
  it('Renntag in der Zukunft: Tage bis zum Rennen, Rennwoche nur in derselben Kalenderwoche', () => {
    expect(competitionCountdown(base, '2026-10-16')).toEqual({
      kind: 'upcoming',
      daysLeft: 23,
      raceWeek: false,
    });
    // Sonntag davor: noch nicht Rennwoche (Woche Mo 02.11. – So 08.11.).
    expect(competitionCountdown(base, '2026-11-01')).toMatchObject({ raceWeek: false });
    expect(competitionCountdown(base, '2026-11-02')).toEqual({
      kind: 'upcoming',
      daysLeft: 6,
      raceWeek: true,
    });
    expect(competitionCountdown(base, '2026-11-07')).toEqual({
      kind: 'upcoming',
      daysLeft: 1,
      raceWeek: true,
    });
  });

  it('Rennen am Montag: Rennwoche ist nur der Montag selbst', () => {
    const monday = { ...base, raceDate: '2026-11-09' };
    expect(isRaceWeek('2026-11-09', '2026-11-08')).toBe(false);
    expect(competitionCountdown(monday, '2026-11-08')).toMatchObject({ raceWeek: false });
    expect(competitionCountdown(monday, '2026-11-09')).toEqual({ kind: 'race_day' });
  });

  it('Renntag, danach ohne Ergebnis, erledigt, abgesagt', () => {
    expect(competitionCountdown(base, '2026-11-08')).toEqual({ kind: 'race_day' });
    expect(competitionCountdown(base, '2026-11-10')).toEqual({
      kind: 'awaiting_result',
      daysSince: 2,
    });
    expect(competitionCountdown({ ...base, status: 'done' }, '2026-11-10')).toEqual({
      kind: 'done',
      hasResult: false,
      recovery: true,
    });
    expect(
      competitionCountdown({ ...base, status: 'done', resultSessionLogId: 'x' }, '2026-11-30'),
    ).toEqual({ kind: 'done', hasResult: true, recovery: false });
    expect(competitionCountdown({ ...base, status: 'cancelled' }, '2026-10-16')).toEqual({
      kind: 'cancelled',
    });
  });
});

describe('postRaceRecoveryEnd (Erholung nach dem Rennen = Wochen des Makrozyklus)', () => {
  it('Halbmarathon am Sonntag: Rest der Rennwoche + 1 Woche', () => {
    expect(postRaceRecoveryEnd('half_marathon', '2026-11-08')).toBe('2026-11-15');
  });
  it('Marathon: 2 Wochen, auch bei einem Rennen am Montag', () => {
    expect(postRaceRecoveryEnd('marathon', '2026-11-09')).toBe('2026-11-29');
  });
  it('5 km am Samstag', () => {
    expect(postRaceRecoveryEnd('5k', '2026-11-07')).toBe('2026-11-15');
  });
});

describe('competitionToShow', () => {
  const row = (status: 'planned' | 'done' | 'cancelled', race_date: string) => ({
    status,
    discipline: '10k' as const,
    race_date,
  });
  it('geplanter Wettkampf hat Vorrang', () => {
    const planned = row('planned', '2027-01-10');
    expect(competitionToShow([row('done', '2026-10-11'), planned], '2026-10-16')).toBe(planned);
  });
  it('erledigt nur während der Erholung, abgesagt nie', () => {
    const done = row('done', '2026-10-11');
    expect(competitionToShow([done], '2026-10-16')).toBe(done);
    expect(competitionToShow([done], '2026-10-19')).toBeNull();
    expect(competitionToShow([row('cancelled', '2026-12-06')], '2026-10-16')).toBeNull();
    expect(competitionToShow([], '2026-10-16')).toBeNull();
  });
});

describe('competitionPlanWeek („Aufbau · Woche 6 von 14“)', () => {
  const sessions = [
    { scheduled_on: '2026-10-14', training_phase: 'base' as const },
    { scheduled_on: '2026-10-21', training_phase: 'base' as const },
    { scheduled_on: '2026-11-25', training_phase: 'build' as const },
    { scheduled_on: '2027-01-12', training_phase: 'race_week' as const },
    { scheduled_on: '2027-01-21', training_phase: 'recovery' as const },
  ];
  it('Planstart Mittwoch: angebrochene Woche ist Woche 0', () => {
    const week = (date: string) => competitionPlanWeek(sessions, '2026-10-14', '2027-01-17', date);
    expect(week('2026-10-16')).toEqual({
      phase: 'base',
      weekNo: 0,
      totalWeeks: 13,
      raceWeek: false,
    });
    expect(week('2026-10-19')).toMatchObject({ phase: 'base', weekNo: 1 });
    expect(week('2026-11-27')).toMatchObject({ phase: 'build', weekNo: 6 });
    expect(week('2027-01-17')).toEqual({
      phase: 'race_week',
      weekNo: 13,
      totalWeeks: 13,
      raceWeek: true,
    });
    // Nach der Rennwoche: keine Wochennummer mehr (Erholung nach dem Rennen).
    expect(week('2027-01-20')).toMatchObject({ phase: 'recovery', weekNo: null });
    // Woche ohne Einheit mit Phase.
    expect(week('2026-11-02')).toMatchObject({ phase: null, weekNo: 3 });
  });
  it('Planstart Montag: erste Woche ist Woche 1', () => {
    expect(competitionPlanWeek(sessions, '2026-10-12', '2027-01-17', '2026-10-12')).toEqual({
      phase: 'base',
      weekNo: 1,
      totalWeeks: 14,
      raceWeek: false,
    });
  });
  it('ohne Wettkampf-Einheiten bzw. vor dem Planstart: null', () => {
    expect(
      competitionPlanWeek(
        [{ scheduled_on: '2026-10-14' }],
        '2026-10-14',
        '2027-01-17',
        '2026-10-16',
      ),
    ).toBeNull();
    expect(competitionPlanWeek(sessions, '2026-10-14', '2027-01-17', '2026-10-13')).toBeNull();
  });
});

describe('sessionPaceInfo (Pace nur mit Referenzzeit, nur beim Laufen)', () => {
  const profile = competitionPaceProfile({
    discipline: 'half_marathon',
    reference: { discipline: '10k', timeS: 50 * 60, date: '2026-09-01' },
  });
  const run = {
    kind: 'endurance',
    endurance_modality: 'run',
    workout_type: 'long' as const,
    target_distance_m: 12_000,
  };
  it('langer Lauf mit Referenz 10 km in 50:00 → locker 6:00–6:30 min/km, Distanz-Richtwert', () => {
    expect(sessionPaceInfo(run, profile)).toEqual({
      pace: { fastSPerKm: 360, slowSPerKm: 390 },
      distanceM: 12_000,
      hard: false,
    });
  });
  it('ohne Referenz: keine Pace (W-G6), Distanz bleibt der gespeicherte Richtwert', () => {
    expect(competitionPaceProfile({ discipline: '10k', reference: null })).toBeNull();
    expect(sessionPaceInfo({ ...run, target_distance_m: null }, null)).toEqual({
      pace: null,
      distanceM: null,
      hard: false,
    });
  });
  it('heute nur Gehen (aktuelle Regeln) bzw. ohne Art: weder Pace noch Distanz', () => {
    expect(sessionPaceInfo({ ...run, endurance_modality: 'walk' }, profile)).toEqual({
      pace: null,
      distanceM: null,
      hard: false,
    });
    expect(sessionPaceInfo({ ...run, workout_type: null }, profile).pace).toBeNull();
  });
  it('Fahrtspiel: nach Gefühl (keine Pace), aber hart', () => {
    expect(sessionPaceInfo({ ...run, workout_type: 'fartlek' }, profile)).toEqual({
      pace: null,
      distanceM: 12_000,
      hard: true,
    });
  });
});

describe('recentCompetitionStartReference (Tagebuch der letzten 4 Wochen)', () => {
  const session = (
    id: string,
    scheduled_on: string,
    minutes: number,
    week_no: number,
    is_deload = false,
  ): PreviousSession =>
    ({
      id,
      status: 'planned',
      block_no: 1,
      week_no,
      is_intro_week: false,
      is_deload,
      kind: 'endurance',
      template_day_index: null,
      scheduled_on,
      name_de: 'Lockerer Dauerlauf',
      focus: null,
      endurance_modality: 'run',
      effort_target: 3,
      estimated_minutes: minutes,
      warmup_de: '',
      cooldown_de: '',
      exercises: [],
    }) as PreviousSession;
  const previous = [
    session('a', '2026-10-06', 40, 1),
    session('b', '2026-10-08', 40, 1),
    session('c', '2026-10-13', 44, 2),
    session('d', '2026-10-15', 44, 2),
    session('e', '2026-10-20', 48, 3), // Zukunft
  ];
  it('nur Vergangenes zählt, je Einheit min(geplant, eingetragen)', () => {
    const logged = new Map([
      ['c', 30],
      ['d', 60],
      ['e', 48],
    ]);
    expect(recentCompetitionStartReference(previous, 'beginner', logged, '2026-10-16')).toEqual({
      volume: 74,
      sessionCap: 44,
      startGroup: 'beginner',
    });
  });
  it('ohne Einträge: kein Bezug (Startumfang der Gruppe)', () => {
    expect(
      recentCompetitionStartReference(previous, 'beginner', new Map(), '2026-10-16'),
    ).toBeNull();
  });
  it('älter als 28 Tage zählt nicht', () => {
    const logged = new Map([
      ['a', 40],
      ['b', 40],
    ]);
    expect(recentCompetitionStartReference(previous, 'beginner', logged, '2026-11-20')).toBeNull();
  });
});
