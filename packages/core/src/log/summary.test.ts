import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { ReschedulableSession } from '../plan/reschedule';
import {
  canCatchUp,
  exerciseHistory,
  historyByWeek,
  isWithinLogDateWindow,
  logEditability,
  summaryWeekBounds,
  type SummaryLog,
  type SummarySession,
  weekLogSummary,
  weekPager,
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

describe('Etappe D: erledigt + geplant am selben Tag (Wächter B S4)', () => {
  it('Eintrag des alten Plans und geplante Einheit des neuen Plans stehen beide am Tag, erledigt zuerst', () => {
    const w = weekLogSummary(
      [
        session('alt', '2026-10-07', { status: 'completed', plan_active: false }),
        session('neu', '2026-10-07'),
      ],
      [log('l', '2026-10-07', { planned_session_id: 'alt', done_sets: 9 })],
      '2026-10-07',
      '2026-10-07',
    );
    expect(w.days[2]?.items.map((i) => [i.status, i.sessionId])).toEqual([
      ['done', 'alt'],
      ['planned', 'neu'],
    ]);
    expect(w.days[2]?.status).toBe('done');
    expect(w).toMatchObject({ sessionsDone: 1, sessionsPlanned: 1, strengthSets: 9 });
  });

  it('erledigte Einheit ohne Eintrag auf dem Gerät (z. B. älter als der Zwischenspeicher) zählt als erledigt', () => {
    const w = weekLogSummary(
      [session('s', '2026-10-05', { status: 'completed' })],
      [],
      '2026-10-05',
      '2026-10-09',
    );
    expect(w.days[0]?.items[0]).toMatchObject({ status: 'done', logId: null });
  });

  it('1 und 7 Trainingstage je Woche', () => {
    const one = weekLogSummary([session('a', '2026-10-05')], [], '2026-10-05', '2026-10-04');
    expect(one.days.filter((d) => d.status !== 'rest')).toHaveLength(1);
    const seven = Array.from({ length: 7 }, (_, i) => session(`d${i}`, addDays('2026-10-05', i)));
    const all = weekLogSummary(seven, [], '2026-10-05', '2026-10-08');
    expect(all.days.map((d) => d.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'planned',
      'planned',
      'planned',
      'planned',
    ]);
    expect(all.sessionsPlanned).toBe(7);
  });
});

describe('summaryWeekBounds und weekPager (Blättern)', () => {
  it('von der frühesten Woche mit Eintrag/Einheit bis zur letzten Einheit, mindestens die laufende Woche', () => {
    const bounds = summaryWeekBounds(
      [session('s', '2026-11-20')],
      [log('l', '2026-09-02')],
      '2026-10-07',
    );
    expect(bounds).toEqual({ first: '2026-08-31', last: '2026-11-16' });
    expect(summaryWeekBounds([], [], '2026-10-07')).toEqual({
      first: '2026-10-05',
      last: '2026-10-05',
    });
  });

  it('nicht vor den vollständig geladenen Zeitraum (Supabase: 12 Wochen), nie hinter die laufende Woche', () => {
    expect(
      summaryWeekBounds([], [log('alt', '2026-01-05')], '2026-10-07', { earliest: '2026-07-15' }),
    ).toEqual({ first: '2026-07-13', last: '2026-10-05' });
    expect(
      summaryWeekBounds([], [log('alt', '2026-01-05')], '2026-10-07', { earliest: '2026-12-01' })
        .first,
    ).toBe('2026-10-05');
  });

  it('Vor- und Folgewoche, Ränder und Klemmen', () => {
    const bounds = { first: '2026-09-28', last: '2026-10-12' };
    expect(weekPager('2026-10-07', bounds)).toEqual({
      weekStart: '2026-10-05',
      previous: '2026-09-28',
      next: '2026-10-12',
    });
    expect(weekPager('2026-09-28', bounds)).toMatchObject({ previous: null });
    expect(weekPager('2026-10-18', bounds)).toMatchObject({ weekStart: '2026-10-12', next: null });
    expect(weekPager('2025-01-01', bounds).weekStart).toBe('2026-09-28');
  });

  it('Jahreswechsel: Woche 53 → Woche 1', () => {
    const pager = weekPager('2026-12-31', { first: '2026-12-21', last: '2027-01-04' });
    expect(pager).toEqual({ weekStart: '2026-12-28', previous: '2026-12-21', next: '2027-01-04' });
  });
});

describe('logEditability (Ändern aus dem Verlauf)', () => {
  const s = { id: 's', scheduled_on: '2026-10-07', original_date: null };

  it('im Datumsfenster änderbar, danach „zu alt“ (W2)', () => {
    const l = { planned_session_id: 's', performed_on: '2026-10-07' };
    expect(logEditability(l, s, '2026-10-07')).toBe('editable');
    expect(logEditability(l, s, '2026-10-21')).toBe('editable');
    expect(logEditability(l, s, '2026-10-22')).toBe('too_old');
  });

  it('nachgeholt: Fenster nach dem ursprünglichen Termin', () => {
    const moved = { ...s, scheduled_on: '2026-10-09', original_date: '2026-10-06' };
    expect(
      logEditability({ planned_session_id: 's', performed_on: '2026-10-09' }, moved, '2026-10-09'),
    ).toBe('editable');
  });

  it('verwaist oder Einheit nicht (mehr) geladen → nicht änderbar', () => {
    expect(
      logEditability({ planned_session_id: null, performed_on: '2026-10-07' }, s, '2026-10-07'),
    ).toBe('unlinked');
    expect(
      logEditability({ planned_session_id: 's', performed_on: '2026-10-07' }, null, '2026-10-07'),
    ).toBe('unlinked');
    expect(
      logEditability({ planned_session_id: 'x', performed_on: '2026-10-07' }, s, '2026-10-07'),
    ).toBe('unlinked');
  });
});
