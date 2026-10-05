import { describe, expect, it } from 'vitest';

import type { ReschedulableSession } from '../plan/reschedule';
import {
  canCatchUp,
  exerciseHistory,
  historyByWeek,
  isWithinLogDateWindow,
  type SummaryLog,
  type SummarySession,
  weekLogSummary,
} from './summary';

const session = (
  id: string,
  scheduled_on: string,
  extra: Partial<SummarySession> = {},
): SummarySession => ({
  id,
  scheduled_on,
  original_date: null,
  status: 'planned',
  kind: 'strength',
  name_de: `Einheit ${id}`,
  plan_active: true,
  ...extra,
});
const log = (id: string, performed_on: string, extra: Partial<SummaryLog> = {}): SummaryLog => ({
  id,
  planned_session_id: null,
  performed_on,
  kind: 'strength',
  status: 'completed',
  name_de: `Eintrag ${id}`,
  done_sets: 0,
  cardio_duration_s: null,
  cardio_distance_m: null,
  ...extra,
});

describe('weekLogSummary (Abschnitt 5.6)', () => {
  const sessions = [
    session('s1', '2026-10-05', { status: 'completed' }),
    session('s5', '2026-10-06', { status: 'skipped', kind: 'endurance' }),
    session('s2', '2026-10-07', { status: 'completed' }),
    session('s3', '2026-10-09', { kind: 'endurance' }),
    session('s4', '2026-10-10'),
    session('old', '2026-10-05', { plan_active: false }),
  ];
  const logs = [
    log('l1', '2026-10-05', { planned_session_id: 's1', done_sets: 12 }),
    log('l2', '2026-10-08', { planned_session_id: 's2', status: 'partial', done_sets: 6 }),
    log('l3', '2026-10-11', {
      kind: 'endurance',
      cardio_duration_s: 1800,
      cardio_distance_m: 5000,
    }),
    log('other-week', '2026-10-12', { done_sets: 99 }),
  ];
  const week = weekLogSummary(sessions, logs, '2026-10-07', '2026-10-09');

  it('Status je Tag inkl. nachgeholt am tatsächlichen Datum (H2) und „entfallen“ (H1)', () => {
    expect(week.weekStart).toBe('2026-10-05');
    expect(week.days.map((d) => d.status)).toEqual([
      'done',
      'skipped',
      'rest',
      'partial',
      'planned',
      'planned',
      'done',
    ]);
    expect(week.days[0]?.items.map((i) => i.status)).toEqual(['done', 'dropped']);
    expect(week.days[3]?.items[0]).toMatchObject({ logId: 'l2', caughtUpFrom: '2026-10-07' });
    expect(week.days[0]?.items[0]?.caughtUpFrom).toBeNull();
  });

  it('verpasst = vorbei, ohne Eintrag, Woche läuft', () => {
    const w = weekLogSummary([session('x', '2026-10-06')], [], '2026-10-05', '2026-10-08');
    expect(w.days[1]?.status).toBe('missed');
  });

  it('Summen: Einträge, geplante Einheiten (ohne gestrichene/entfallene), Sätze, Minuten, km', () => {
    expect(week).toMatchObject({
      sessionsDone: 3,
      sessionsPlanned: 4,
      strengthSets: 18,
      enduranceMinutes: 30,
      enduranceKm: 5,
    });
  });

  it('Jahreswechsel (ISO-Woche 53 von 2026) und Sommerzeitende (25.10.2026)', () => {
    const w53 = weekLogSummary([], [log('a', '2027-01-02')], '2027-01-01', '2027-01-05');
    expect(w53.weekStart).toBe('2026-12-28');
    expect(w53.days.map((d) => d.date).at(-1)).toBe('2027-01-03');
    expect(w53.days[5]?.status).toBe('done');
    const dst = weekLogSummary([], [log('b', '2026-10-25')], '2026-10-19', '2026-10-26');
    expect(dst.days.map((d) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(dst.days[6]?.status).toBe('done');
  });

  it('verschobene Einheit zählt in der Woche ihres ursprünglichen Termins', () => {
    const moved = session('m', '2026-10-08', { original_date: '2026-10-06' });
    const w = weekLogSummary([moved], [], '2026-10-05', '2026-10-05');
    expect(w.sessionsPlanned).toBe(1);
    expect(w.days[3]?.status).toBe('planned');
  });
});

describe('Datumsfenster (W2)', () => {
  it('gleiche ISO-Woche ± 1 Tag', () => {
    const today = '2026-10-12';
    expect(isWithinLogDateWindow('2026-10-04', '2026-10-07', today)).toBe(true);
    expect(isWithinLogDateWindow('2026-10-03', '2026-10-07', today)).toBe(false);
    expect(isWithinLogDateWindow('2026-10-12', '2026-10-07', today)).toBe(true);
    expect(isWithinLogDateWindow('2026-10-13', '2026-10-07', '2026-10-13')).toBe(false);
  });

  it('höchstens heute + 1 und heute − 14', () => {
    expect(isWithinLogDateWindow('2026-10-08', '2026-10-07', '2026-10-07')).toBe(true);
    expect(isWithinLogDateWindow('2026-10-09', '2026-10-07', '2026-10-07')).toBe(false);
    expect(isWithinLogDateWindow('2026-09-23', '2026-09-23', '2026-10-07')).toBe(true);
    expect(isWithinLogDateWindow('2026-09-22', '2026-09-23', '2026-10-07')).toBe(false);
  });
});

describe('canCatchUp', () => {
  const s = (
    id: string,
    date: string,
    extra: Partial<ReschedulableSession> = {},
  ): ReschedulableSession => ({
    id,
    scheduled_on: date,
    original_date: null,
    status: 'planned',
    kind: 'strength',
    focus: 'full_body',
    is_deload: false,
    ...extra,
  });

  it('verpasste Einheit heute nachholen, wenn der Tag frei ist', () => {
    expect(canCatchUp([s('mo', '2026-10-05')], 'mo', '2026-10-07')).toBe(true);
  });

  it('nicht bei 48-h-Konflikt, belegtem Tag, Erholungswoche, vergangener Woche', () => {
    expect(canCatchUp([s('mo', '2026-10-05'), s('do', '2026-10-08')], 'mo', '2026-10-07')).toBe(
      false,
    );
    expect(canCatchUp([s('mo', '2026-10-05'), s('mi', '2026-10-07')], 'mo', '2026-10-07')).toBe(
      false,
    );
    expect(
      canCatchUp(
        [s('mo', '2026-10-05'), s('mi', '2026-10-07', { status: 'completed' })],
        'mo',
        '2026-10-07',
      ),
    ).toBe(false);
    expect(canCatchUp([s('mo', '2026-10-05', { is_deload: true })], 'mo', '2026-10-07')).toBe(
      false,
    );
    expect(canCatchUp([s('mo', '2026-10-05')], 'mo', '2026-10-12')).toBe(false);
    expect(canCatchUp([s('mo', '2026-10-05', { status: 'skipped' })], 'mo', '2026-10-07')).toBe(
      false,
    );
  });

  it('heutige Einheit ist kein Nachholen; gestrichene Nachbarn belegen nichts', () => {
    expect(canCatchUp([s('mi', '2026-10-07')], 'mi', '2026-10-07')).toBe(false);
    expect(
      canCatchUp(
        [s('mo', '2026-10-05'), s('do', '2026-10-08', { status: 'skipped' })],
        'mo',
        '2026-10-07',
      ),
    ).toBe(true);
  });

  it('Nachholen am Sonntag', () => {
    expect(canCatchUp([s('fr', '2026-10-09')], 'fr', '2026-10-11')).toBe(true);
  });

  it('Ausdauer neben Kraft ist kein Konflikt', () => {
    const run = s('di', '2026-10-06', { kind: 'endurance', focus: null });
    expect(canCatchUp([run, s('mo', '2026-10-07')], 'di', '2026-10-08')).toBe(true);
  });
});

describe('Verlauf', () => {
  it('historyByWeek: neueste zuerst, nach ISO-Wochen, mit Grenze', () => {
    const logs = [
      log('a', '2026-10-05'),
      log('b', '2026-10-07'),
      log('c', '2026-10-13'),
      log('d', '2026-09-30'),
    ];
    expect(historyByWeek(logs).map((w) => [w.weekStart, w.logs.map((l) => l.id)])).toEqual([
      ['2026-10-12', ['c']],
      ['2026-10-05', ['b', 'a']],
      ['2026-09-28', ['d']],
    ]);
    expect(historyByWeek(logs, { limit: 2 }).flatMap((w) => w.logs.map((l) => l.id))).toEqual([
      'c',
      'b',
    ]);
    expect(historyByWeek([])).toEqual([]);
  });

  it('exerciseHistory: bester Satz je Datum, keine 1RM', () => {
    const set = (
      reps: number | null,
      weightKg: number | null,
      durationS: number | null = null,
      done = true,
    ) => ({
      reps,
      weightKg,
      durationS,
      rpe: null,
      done,
    });
    const h = exerciseHistory('bench', [
      {
        exerciseId: 'bench',
        performedOn: '2026-10-05',
        status: 'done',
        sets: [set(10, 20), set(8, 22.5), set(10, 22.5), set(12, 30, null, false)],
      },
      { exerciseId: 'bench', performedOn: '2026-10-07', status: 'skipped', sets: [] },
      {
        exerciseId: 'plank',
        performedOn: '2026-10-07',
        status: 'done',
        sets: [set(null, null, 40), set(null, null, 45)],
      },
      {
        exerciseId: 'bench',
        performedOn: '2026-10-09',
        status: 'alternative',
        sets: [set(15, null)],
      },
    ]);
    expect(h).toEqual([
      { performedOn: '2026-10-09', best: { kind: 'reps', reps: 15 }, sets: 1 },
      { performedOn: '2026-10-05', best: { kind: 'weight', weightKg: 22.5, reps: 10 }, sets: 3 },
    ]);
    expect(
      exerciseHistory('plank', [
        {
          exerciseId: 'plank',
          performedOn: '2026-10-07',
          status: 'done',
          sets: [set(null, null, 40), set(null, null, 45)],
        },
      ])[0]?.best,
    ).toEqual({ kind: 'time', durationS: 45 });
  });
});
