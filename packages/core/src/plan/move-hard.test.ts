/**
 * 48-h-Regel erweitert (docs/PLAN-PHASE-10.md 3.5 und 6, Etappe WP2): harte Ausdauer ↔ Kraft mit Beinen, harte ↔ harte
 * Ausdauer, harte Ausdauer ↔ langer Lauf → Grund `hard_endurance_48h`. Verpasste harte Einheit: verschieben nur, wenn
 * die Regel passt, sonst streichen statt stapeln. Ohne Wettkampf-Arten unverändert.
 */
import { describe, expect, it } from 'vitest';

import { type MovableSession, moveTargets, validateMove, validateSwap } from './move';
import { rescheduleSession } from './reschedule';

const s = (id: string, date: string, overrides: Partial<MovableSession> = {}): MovableSession => ({
  id,
  scheduled_on: date,
  original_date: null,
  status: 'planned',
  focus: 'full_body',
  is_deload: false,
  ...overrides,
});
const run = (id: string, date: string, overrides: Partial<MovableSession> = {}) =>
  s(id, date, { kind: 'endurance', focus: null, ...overrides });

// Woche 05.–11.10.2026: Mo 05 … So 11.
const MO = '2026-10-05';
const DI = '2026-10-06';
const MI = '2026-10-07';
const DO = '2026-10-08';
const FR = '2026-10-09';
const SA = '2026-10-10';
const SO = '2026-10-11';

describe('hard_endurance_48h', () => {
  it('Intervalle neben einem Bein-Tag (Ganzkörper/Unterkörper): Verschieben gesperrt, Oberkörper erlaubt', () => {
    const week = [
      s('legs', MO, { focus: 'lower' }),
      s('upper', FR, { focus: 'upper' }),
      run('iv', MI, { workout_type: 'intervals' }),
    ];
    const targets = moveTargets(week, 'iv', MO);
    const byDay = Object.fromEntries(targets.map((t) => [t.date, t.allowed ? 'ok' : t.reason]));
    expect(byDay[DI]).toBe('hard_endurance_48h');
    expect(targets.find((t) => t.date === DI)?.conflict).toEqual({ sessionId: 'legs', date: MO });
    expect(byDay[DO]).toBe('ok'); // neben Oberkörper (Fr) ist erlaubt
    expect(byDay[SA]).toBe('ok');
    expect(validateMove(week, 'iv', DI, MO)).toMatchObject({
      ok: false,
      reason: 'hard_endurance_48h',
    });
  });

  it('Tauschen einer Intervall-Einheit neben einen Bein-Tag gesperrt (auch als Partner)', () => {
    const week = [
      s('legs', MO, { focus: 'full_body' }),
      run('easy', DI, { workout_type: 'easy' }),
      run('iv', DO, { workout_type: 'intervals' }),
    ];
    expect(validateSwap(week, 'iv', 'easy', MO)).toMatchObject({
      ok: false,
      reason: 'hard_endurance_48h',
      partner: false,
    });
    expect(validateSwap(week, 'easy', 'iv', MO)).toMatchObject({
      ok: false,
      reason: 'hard_endurance_48h',
      partner: true,
    });
  });

  it('Bein-Tag neben eine harte Einheit verschieben: ebenso gesperrt', () => {
    const week = [s('legs', MO, { focus: 'lower' }), run('tempo', DO, { workout_type: 'tempo' })];
    expect(validateMove(week, 'legs', MI, MO)).toMatchObject({
      ok: false,
      reason: 'hard_endurance_48h',
    });
    expect(validateMove(week, 'legs', DI, MO)).toEqual({ ok: true, kind: 'move' });
  });

  it('hart ↔ hart und hart ↔ langer Lauf gesperrt; locker ↔ alles frei (wie bisher)', () => {
    const week = [
      run('tempo', DI, { workout_type: 'tempo' }),
      run('iv', DO, { workout_type: 'intervals' }),
      run('long', SO, { workout_type: 'long' }),
      run('easy', FR, { workout_type: 'easy' }),
    ];
    expect(validateMove(week, 'iv', MI, MO)).toMatchObject({ reason: 'hard_endurance_48h' });
    expect(validateMove(week, 'iv', SA, MO)).toMatchObject({ reason: 'hard_endurance_48h' });
    expect(validateMove(week, 'easy', SA, MO)).toEqual({ ok: true, kind: 'move' });
    expect(validateMove(week, 'long', MO, MO)).toMatchObject({ reason: 'hard_endurance_48h' });
  });

  it('ohne Art (Pläne ohne Wettkampf): Ausdauer nie ein Konflikt – unverändert', () => {
    const week = [s('legs', MO, { focus: 'lower' }), run('r', MI)];
    expect(validateMove(week, 'r', DI, MO)).toEqual({ ok: true, kind: 'move' });
  });

  it('verpasste harte Einheit: verschieben nur auf einen erlaubten Tag, sonst streichen (nie stapeln)', () => {
    // Heute Freitag, Tempo vom Dienstag verpasst; Sa neben dem langen Lauf, So belegt → streichen.
    const week = [
      s('legs', MO, { focus: 'lower' }),
      run('tempo', DI, { workout_type: 'tempo' }),
      run('long', SO, { workout_type: 'long' }),
      s('fr', FR, { focus: 'upper' }),
    ];
    expect(rescheduleSession(week, 'tempo', FR)).toEqual({ kind: 'skipped' });
    // Ohne den langen Lauf am Sonntag: Samstag ist frei und erlaubt.
    expect(
      rescheduleSession(week.slice(0, 2).concat(week[3] as MovableSession), 'tempo', FR),
    ).toEqual({
      kind: 'moved',
      date: SA,
      originalDate: DI,
    });
  });
});
