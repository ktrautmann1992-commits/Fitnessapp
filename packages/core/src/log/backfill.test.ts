import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import { type BackfillLog, type BackfillSession, backfillDates, backfillOptions } from './backfill';
import { isWithinLogDateWindow } from './summary';

/** Heute: Donnerstag, 15.10.2026. Woche Mo 12.10.–So 18.10.; Vorwoche Mo 05.10.; davor Mo 28.09. */
const TODAY = '2026-10-15';

const session = (
  id: string,
  scheduled_on: string,
  extra: Partial<BackfillSession> = {},
): BackfillSession => ({
  id,
  scheduled_on,
  original_date: null,
  status: 'planned',
  kind: 'strength',
  name_de: `Einheit ${id}`,
  plan_active: true,
  ...extra,
});
const log = (planned_session_id: string | null, performed_on: string): BackfillLog => ({
  planned_session_id,
  performed_on,
});

const sessions: BackfillSession[] = [
  session('w0-mo', '2026-09-28', { status: 'skipped' }),
  session('w1-di', '2026-10-06', { status: 'skipped' }),
  session('w1-fr', '2026-10-09', { kind: 'endurance', status: 'skipped' }),
  session('w2-mo', '2026-10-12'),
  session('w2-mi', '2026-10-14'),
  session('w2-fr', '2026-10-16'),
  session('alt', '2026-10-13', { plan_active: false }),
];

const ids = (date: string, logs: BackfillLog[] = [], createdToday = 0) =>
  backfillOptions(sessions, logs, date, TODAY, { createdToday }).options.map((o) => [
    o.sessionId,
    o.allowed ? 'ok' : o.reason,
  ]);

describe('backfillOptions – Tage', () => {
  it('heute: Einheiten der Woche, kommende mit Grund', () => {
    expect(ids(TODAY)).toEqual([
      ['w2-mo', 'ok'],
      ['w2-mi', 'ok'],
      ['w2-fr', 'upcoming'],
    ]);
  });

  it('genau 14 Tage zurück (01.10.): möglich – nur die Woche des 28.09.', () => {
    const day = backfillOptions(sessions, [], '2026-10-01', TODAY);
    expect(day.block).toBeNull();
    expect(day.freeAllowed).toBe(true);
    expect(ids('2026-10-01')).toEqual([['w0-mo', 'ok']]);
  });

  it('15 Tage zurück (30.09.): gesperrt, keine Optionen, keine freie Einheit', () => {
    expect(backfillOptions(sessions, [], '2026-09-30', TODAY)).toEqual({
      date: '2026-09-30',
      block: 'too_old',
      freeAllowed: false,
      dayTaken: false,
      options: [],
    });
  });

  it('morgen: gesperrt (nie in der Zukunft)', () => {
    const day = backfillOptions(sessions, [], '2026-10-16', TODAY);
    expect(day.block).toBe('future');
    expect(day.freeAllowed).toBe(false);
    expect(day.options).toEqual([]);
  });

  it('Wochengrenze ± 1 Tag: Sonntag vor der Woche zählt zur Woche, Samstag nicht', () => {
    expect(ids('2026-10-11')).toEqual([
      ['w1-di', 'ok'],
      ['w1-fr', 'ok'],
      ['w2-mo', 'ok'],
      ['w2-mi', 'ok'],
      ['w2-fr', 'upcoming'],
    ]);
    expect(ids('2026-10-10').map(([id]) => id)).toEqual(['w1-di', 'w1-fr']);
    // Montag nach der Woche (± 1 Tag) – Vorwoche noch dabei
    expect(ids('2026-10-12').map(([id]) => id)).toEqual([
      'w1-di',
      'w1-fr',
      'w2-mo',
      'w2-mi',
      'w2-fr',
    ]);
  });

  it('Einheiten ersetzter Pläne werden nie angeboten', () => {
    expect(ids('2026-10-13').map(([id]) => id)).not.toContain('alt');
  });
});

describe('backfillOptions – Einheiten', () => {
  it('schon eingetragen: Grund „logged“ (Eintrag oder erledigt)', () => {
    expect(ids(TODAY, [log('w2-mo', '2026-10-12')])).toContainEqual(['w2-mo', 'logged']);
    const done = backfillOptions(
      [session('x', '2026-10-13', { status: 'completed' })],
      [],
      TODAY,
      TODAY,
    );
    expect(done.options[0]).toMatchObject({ allowed: false, reason: 'logged' });
  });

  it('Tag schon mit einer anderen geplanten Einheit belegt: day_taken (nie stapeln)', () => {
    const day = backfillOptions(sessions, [log('w2-mo', TODAY)], TODAY, TODAY);
    expect(day.dayTaken).toBe(true);
    expect(day.freeAllowed).toBe(true);
    expect(day.options.map((o) => [o.sessionId, o.allowed ? 'ok' : o.reason])).toEqual([
      ['w2-mo', 'logged'],
      ['w2-mi', 'day_taken'],
      ['w2-fr', 'upcoming'],
    ]);
  });

  it('freie Einträge belegen den Tag nicht', () => {
    const day = backfillOptions(sessions, [log(null, TODAY)], TODAY, TODAY);
    expect(day.dayTaken).toBe(false);
    expect(day.options.find((o) => o.sessionId === 'w2-mi')?.allowed).toBe(true);
  });

  it('Datumsfenster: Bezug ist der ursprüngliche Termin (verschoben)', () => {
    const moved = session('m', '2026-10-13', { original_date: '2026-10-08' });
    // Termin Woche 05.10. → 13.10. liegt außerhalb (Sonntag 11.10. + 1 = 12.10.)
    expect(backfillOptions([moved], [], '2026-10-13', TODAY).options).toEqual([]);
    expect(backfillOptions([moved], [], '2026-10-12', TODAY).options[0]).toMatchObject({
      allowed: true,
      referenceDate: '2026-10-08',
    });
  });

  it('gestrichene Einheit darf nachgetragen werden (wie save_session_log, W8)', () => {
    expect(ids('2026-10-07')).toContainEqual(['w1-di', 'ok']);
  });

  it('10 Einträge heute angelegt: Tageslimit; 9: möglich', () => {
    expect(backfillOptions(sessions, [], TODAY, TODAY, { createdToday: 10 })).toMatchObject({
      block: 'daily_limit',
      freeAllowed: false,
      options: [],
    });
    expect(backfillOptions(sessions, [], TODAY, TODAY, { createdToday: 9 }).block).toBeNull();
  });

  it('ohne Plan: keine Optionen, freie Einheit trotzdem möglich', () => {
    expect(backfillOptions([], [], TODAY, TODAY)).toMatchObject({
      block: null,
      freeAllowed: true,
      options: [],
    });
  });
});

describe('backfillDates – Datumswahl im Trainingsmodus', () => {
  it('Mo 12.10.: heute bis Sonntag davor (Woche ± 1 Tag)', () => {
    expect(backfillDates(session('w2-mo', '2026-10-12'), [], TODAY)).toEqual([
      '2026-10-15',
      '2026-10-14',
      '2026-10-13',
      '2026-10-12',
      '2026-10-11',
    ]);
  });

  it('belegte Tage fallen weg, der eigene Eintrag nicht', () => {
    expect(
      backfillDates(
        session('w2-mo', '2026-10-12'),
        [log('w2-mi', '2026-10-14'), log('w2-mo', '2026-10-12'), log(null, '2026-10-13')],
        TODAY,
      ),
    ).toEqual(['2026-10-15', '2026-10-13', '2026-10-12', '2026-10-11']);
  });

  it('Termin vor 14 Tagen: nur Tage im Fenster (01.10. … 05.10.)', () => {
    expect(backfillDates(session('w0-mo', '2026-09-28'), [], TODAY)).toEqual([
      '2026-10-05',
      '2026-10-04',
      '2026-10-03',
      '2026-10-02',
      '2026-10-01',
    ]);
  });

  it('Einheit eines ersetzten Plans: keine Tage (wie backfillOptions, Wächter H3)', () => {
    expect(backfillDates(session('alt', '2026-10-13', { plan_active: false }), [], TODAY)).toEqual(
      [],
    );
  });

  it('kommende Einheit: keine Tage', () => {
    expect(backfillDates(session('w2-fr', '2026-10-16'), [], TODAY)).toEqual([]);
  });
});

describe('Eigenschaft: „erlaubt“ erfüllt immer die Regeln von save_session_log', () => {
  it('800 zufällige Wochen', () => {
    let seed = 42;
    const r = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 800; run += 1) {
      const today = addDays('2026-10-01', Math.floor(r() * 60));
      const list: BackfillSession[] = Array.from({ length: 1 + Math.floor(r() * 10) }, (_, i) => {
        const scheduled = addDays(today, Math.floor(r() * 30) - 22);
        return session(`s${i}`, scheduled, {
          original_date: r() < 0.2 ? addDays(scheduled, -Math.floor(r() * 3)) : null,
          status: r() < 0.2 ? 'skipped' : r() < 0.1 ? 'completed' : 'planned',
          plan_active: r() < 0.9,
        });
      });
      const logs: BackfillLog[] = list
        .filter(() => r() < 0.3)
        .map((s) => log(s.id, addDays(s.scheduled_on, Math.floor(r() * 3) - 1)));
      if (r() < 0.3) logs.push(log(null, addDays(today, -Math.floor(r() * 5))));
      const date = addDays(today, Math.floor(r() * 20) - 17);
      const day = backfillOptions(list, logs, date, today);
      for (const option of day.options) {
        const s = list.find((x) => x.id === option.sessionId) as BackfillSession;
        expect(s.plan_active).toBe(true);
        if (!option.allowed) continue;
        // Server-Regeln: Datumsfenster, nie in der Zukunft, nie stapeln, noch nicht eingetragen.
        expect(isWithinLogDateWindow(date, s.original_date ?? s.scheduled_on, today)).toBe(true);
        expect(date <= today).toBe(true);
        expect(date >= addDays(today, -14)).toBe(true);
        expect(
          logs.some(
            (l) =>
              l.performed_on === date &&
              l.planned_session_id !== null &&
              l.planned_session_id !== s.id,
          ),
        ).toBe(false);
        expect(logs.some((l) => l.planned_session_id === s.id)).toBe(false);
        expect(s.status).not.toBe('completed');
        // Gleiche Antwort wie die Datumswahl im Trainingsmodus.
        expect(backfillDates(s, logs, today)).toContain(date);
      }
      // Umgekehrt: jeder Tag der Datumswahl ist für diese Einheit erlaubt (sofern noch nicht eingetragen).
      for (const s of list.filter(
        (x) =>
          x.plan_active &&
          x.status !== 'completed' &&
          !logs.some((l) => l.planned_session_id === x.id),
      )) {
        for (const d of backfillDates(s, logs, today)) {
          expect(
            backfillOptions(list, logs, d, today).options.find((o) => o.sessionId === s.id)
              ?.allowed,
          ).toBe(true);
          expect(
            startOfIsoWeek(d) >= addDays(startOfIsoWeek(s.original_date ?? s.scheduled_on), -7),
          ).toBe(true);
        }
      }
    }
  }, 60_000);
});
