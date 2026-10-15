import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import type { SessionFocus } from '../enums';
import {
  firstMoveDay,
  type MovableSession,
  moveRequestSchema,
  moveTargets,
  swapRequestSchema,
  validateMove,
  validateSwap,
} from './move';
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

// Woche 05.–11.10.2026: Mo 05, Di 06, Mi 07, Do 08, Fr 09, Sa 10, So 11; Folgemontag 12.
const MO = '2026-10-05';
const DI = '2026-10-06';
const MI = '2026-10-07';
const DO = '2026-10-08';
const FR = '2026-10-09';
const SA = '2026-10-10';
const SO = '2026-10-11';
const MO2 = '2026-10-12';
const WEEK = [s('mo', MO), s('mi', MI), s('fr', FR)];

/** Kurzform: Tag → „ok:move“, „ok:swap:<id>“ oder Grund. */
function summary(targets: ReturnType<typeof moveTargets>) {
  return Object.fromEntries(
    targets.map((t) => [
      t.date.slice(8),
      t.allowed
        ? t.kind === 'swap'
          ? `swap:${t.otherSessionId ?? ''}`
          : 'move'
        : `${t.partner ? 'partner:' : ''}${t.reason ?? ''}`,
    ]),
  );
}

describe('moveTargets – jeder Tag der Woche erlaubt oder mit Grund', () => {
  it('3 Ganzkörper-Tage (Mo/Mi/Fr), heute Montag: Nachbartage gesperrt, belegte Tage tauschbar', () => {
    expect(summary(moveTargets(WEEK, 'mo', MO))).toEqual({
      '05': 'current',
      '06': 'recovery_48h',
      '07': 'swap:mi',
      '08': 'recovery_48h',
      '09': 'swap:fr',
      '10': 'recovery_48h',
      '11': 'move',
    });
  });

  it('Grund der 48-h-Sperre nennt die Nachbar-Einheit („Zu nah an … am Mittwoch“)', () => {
    const tuesday = moveTargets(WEEK, 'mo', MO).find((t) => t.date === DI);
    expect(tuesday).toMatchObject({
      allowed: false,
      reason: 'recovery_48h',
      conflict: { sessionId: 'mi', date: MI },
    });
  });

  it('nur ab heute: verpasster Montag, heute Mittwoch → Mo/Di „past“', () => {
    const result = summary(moveTargets(WEEK, 'mo', MI));
    expect(result['05']).toBe('past');
    expect(result['06']).toBe('past');
    // Mittwoch belegt: Tausch hieße „Mittwoch-Einheit auf Montag“ = Vergangenheit → gesperrt wegen der anderen.
    expect(result['07']).toBe('partner:past');
    expect(result['11']).toBe('move');
  });

  it('heute = Sonntag: nur noch der Sonntag', () => {
    expect(summary(moveTargets(WEEK, 'fr', SO))).toEqual({
      '05': 'past',
      '06': 'past',
      '07': 'past',
      '08': 'past',
      '09': 'past',
      '10': 'past',
      '11': 'move',
    });
  });

  it('Wochenwechsel um Mitternacht: Sonntag noch erlaubt, Montag danach ist alles vorbei', () => {
    expect(moveTargets(WEEK, 'fr', SO).find((t) => t.date === SO)?.allowed).toBe(true);
    const monday = moveTargets(WEEK, 'fr', MO2);
    expect(monday).toHaveLength(7);
    expect(monday.every((t) => !t.allowed && t.reason === 'past')).toBe(true);
    expect(rescheduleSession(WEEK, 'fr', MO2)).toEqual({ kind: 'skipped' });
  });

  it('Sonntag/Montag-Grenze: Ganzkörper am Folgemontag sperrt den Sonntag; Folgewoche ist „other_week“', () => {
    const twoWeeks = [...WEEK, s('mo2', MO2)];
    expect(moveTargets(twoWeeks, 'fr', FR).find((t) => t.date === SO)).toMatchObject({
      allowed: false,
      reason: 'recovery_48h',
      conflict: { sessionId: 'mo2', date: MO2 },
    });
    expect(validateMove(twoWeeks, 'fr', MO2, FR)).toEqual({ ok: false, reason: 'other_week' });
    expect(validateMove(twoWeeks, 'mo', '2026-10-04', MO)).toEqual({
      ok: false,
      reason: 'other_week',
    });
  });

  it('Erholungswoche: jeder Tag „nur streichen“', () => {
    const deload = [s('d', MO, { is_deload: true })];
    expect(moveTargets(deload, 'd', MO).every((t) => t.reason === 'deload_skip_only')).toBe(true);
    expect(rescheduleSession(deload, 'd', MO)).toEqual({ kind: 'skipped' });
  });

  it('erledigte und gestrichene Einheiten sind fest; ersetzter Plan ebenso', () => {
    const done = [s('x', MO, { status: 'completed' })];
    expect(moveTargets(done, 'x', MO).every((t) => t.reason === 'not_planned')).toBe(true);
    const skipped = [s('x', MO, { status: 'skipped' })];
    expect(moveTargets(skipped, 'x', MO).every((t) => t.reason === 'not_planned')).toBe(true);
    const old = [s('x', MO, { in_active_plan: false })];
    expect(moveTargets(old, 'x', MO).every((t) => t.reason === 'not_planned')).toBe(true);
  });

  it('unbekannte Einheit → keine Tage', () => {
    expect(moveTargets(WEEK, 'gibt-es-nicht', MO)).toEqual([]);
    expect(validateMove(WEEK, 'gibt-es-nicht', MO, MO)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('1 Trainingstag: alle freien Tage ab heute erlaubt', () => {
    expect(summary(moveTargets([s('a', MI)], 'a', DI))).toEqual({
      '05': 'past',
      '06': 'move',
      '07': 'current',
      '08': 'move',
      '09': 'move',
      '10': 'move',
      '11': 'move',
    });
  });

  it('7 Trainingstage: nur Tauschen – und nur, wenn danach die 48-h-Regel hält', () => {
    // Mo Oberkörper, Di Unterkörper, Mi Lauf, Do Oberkörper, Fr Unterkörper, Sa Lauf, So Lauf.
    const full = [
      s('o1', MO, { focus: 'upper' }),
      s('u1', DI, { focus: 'lower' }),
      run('l1', MI),
      s('o2', DO, { focus: 'upper' }),
      s('u2', FR, { focus: 'lower' }),
      run('l2', SA),
      run('l3', SO),
    ];
    expect(summary(moveTargets(full, 'l1', MO))).toEqual({
      // o1 (Oberkörper) auf Mi läge neben o2 (Oberkörper, Do) → 48 h verletzt.
      '05': 'partner:recovery_48h',
      // u1 auf Mi: neben Di (jetzt Lauf) und Do (Oberkörper) → ok.
      '06': 'swap:u1',
      '07': 'current',
      // o2 auf Mi: neben Di (Unterkörper) und Do (jetzt Lauf) → ok.
      '08': 'swap:o2',
      // u2 auf Mi: neben Di (Unterkörper) → 48 h verletzt.
      '09': 'partner:recovery_48h',
      '10': 'swap:l2',
      '11': 'swap:l3',
    });
    expect(rescheduleSession(full, 'l1', MO)).toEqual({ kind: 'skipped' });
    expect(firstMoveDay(moveTargets(full, 'l1', MO))).toBeNull();
  });

  it('Ganzkörper an Nachbartagen ist gesperrt, Ober-/Unterkörper daneben erlaubt', () => {
    expect(validateMove([s('a', MO), s('b', MI)], 'a', DO, MO)).toMatchObject({
      ok: false,
      reason: 'recovery_48h',
    });
    const ul = [s('o', MO, { focus: 'upper' }), s('u', MI, { focus: 'lower' })];
    expect(validateMove(ul, 'o', DO, MO)).toEqual({ ok: true, kind: 'move' });
    expect(validateMove(ul, 'o', DI, MO)).toEqual({ ok: true, kind: 'move' });
  });

  it('Ausdauer neben Kraft ist nie ein Konflikt – in beide Richtungen', () => {
    const mixed = [s('k', MO), run('l', MI)];
    expect(validateMove(mixed, 'l', DI, MO)).toEqual({ ok: true, kind: 'move' });
    expect(validateMove(mixed, 'k', DO, MO)).toEqual({ ok: true, kind: 'move' });
    expect(validateMove(mixed, 'k', DI, MO)).toEqual({ ok: true, kind: 'move' });
  });

  it('nie zwei Einheiten am Tag: erledigte Einheit belegt ihren Tag, gestrichene nicht', () => {
    const week = [
      s('a', MO, { focus: 'upper' }),
      s('done', MI, { status: 'completed', focus: 'lower' }),
      s('gone', FR, { status: 'skipped' }),
    ];
    expect(validateMove(week, 'a', MI, MO)).toEqual({
      ok: false,
      reason: 'occupied',
      otherSessionId: 'done',
      partner: true,
    });
    expect(validateMove(week, 'a', FR, MO)).toEqual({ ok: true, kind: 'move' });
  });

  it('Einheit eines ersetzten Plans am Ziel-Tag: belegt, kein Tausch', () => {
    const week = [s('a', MO, { focus: 'upper' }), s('alt', MI, { in_active_plan: false })];
    expect(validateMove(week, 'a', MI, MO)).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('zwei Einheiten am Ziel-Tag (erledigt + geplant): belegt, kein Tausch', () => {
    const week = [
      s('a', MO, { focus: 'upper' }),
      s('done', MI, { status: 'completed', focus: 'lower', in_active_plan: false }),
      s('b', MI, { focus: 'lower' }),
    ];
    expect(validateMove(week, 'a', MI, MO)).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('an einem Nachbartag zählt JEDE Einheit (erledigte des alten Plans neben einer geplanten)', () => {
    const week = [
      s('a', MO, { focus: 'upper' }),
      s('done', MI, { status: 'completed', focus: 'upper', in_active_plan: false }),
      run('l', MI),
    ];
    expect(validateMove(week, 'a', DO, MO)).toMatchObject({
      ok: false,
      reason: 'recovery_48h',
      conflict: { sessionId: 'done' },
    });
    expect(rescheduleSession(week, 'a', MO)).toEqual({
      kind: 'moved',
      date: FR,
      originalDate: MO,
    });
  });

  it('Woche des URSPRÜNGLICHEN Tages zählt (schon einmal verschoben)', () => {
    const moved = [s('a', SO, { original_date: MO })];
    expect(summary(moveTargets(moved, 'a', DI))).toEqual({
      '05': 'past',
      '06': 'move',
      '07': 'move',
      '08': 'move',
      '09': 'move',
      '10': 'move',
      '11': 'current',
    });
    expect(validateMove(moved, 'a', MO2, DI)).toEqual({ ok: false, reason: 'other_week' });
  });
});

describe('validateSwap – beide Einheiten müssen danach alle Regeln erfüllen', () => {
  it('erlaubt: Ober- und Unterkörper tauschen', () => {
    const week = [s('o', MO, { focus: 'upper' }), s('u', MI, { focus: 'lower' })];
    expect(validateSwap(week, 'o', 'u', MO)).toEqual({ ok: true });
  });

  it('Nachbartage mit Ganzkörper bleiben nach dem Tausch Nachbarn → gesperrt', () => {
    const week = [s('a', MO), s('b', DI)];
    expect(validateSwap(week, 'a', 'b', MO)).toMatchObject({
      ok: false,
      reason: 'recovery_48h',
      partner: false,
    });
  });

  it('die andere Einheit käme in die Vergangenheit → gesperrt (partner)', () => {
    expect(validateSwap(WEEK, 'mo', 'fr', MI)).toEqual({
      ok: false,
      reason: 'past',
      partner: true,
    });
    expect(validateSwap(WEEK, 'fr', 'mo', MI)).toEqual({
      ok: false,
      reason: 'past',
      partner: false,
    });
  });

  it('Erholungswoche, erledigt, unbekannt, gleiche Einheit', () => {
    const week = [s('a', MO), s('d', FR, { is_deload: true }), s('x', MI, { status: 'completed' })];
    expect(validateSwap(week, 'a', 'd', MO)).toEqual({
      ok: false,
      reason: 'deload_skip_only',
      partner: true,
    });
    expect(validateSwap(week, 'd', 'a', MO)).toEqual({
      ok: false,
      reason: 'deload_skip_only',
      partner: false,
    });
    expect(validateSwap(week, 'a', 'x', MO)).toEqual({
      ok: false,
      reason: 'occupied',
      partner: true,
    });
    expect(validateSwap(week, 'x', 'a', MO)).toEqual({
      ok: false,
      reason: 'not_planned',
      partner: false,
    });
    expect(validateSwap(week, 'a', 'nix', MO)).toEqual({
      ok: false,
      reason: 'not_found',
      partner: true,
    });
    expect(validateSwap(week, 'nix', 'a', MO)).toEqual({
      ok: false,
      reason: 'not_found',
      partner: false,
    });
    expect(validateSwap(week, 'a', 'a', MO)).toEqual({
      ok: false,
      reason: 'current',
      partner: false,
    });
  });

  it('verschiedene Wochen → „other_week“ (Tausch nur innerhalb einer Woche)', () => {
    const twoWeeks = [s('a', FR, { focus: 'upper' }), s('b', MO2, { focus: 'lower' })];
    expect(validateSwap(twoWeeks, 'a', 'b', MO)).toEqual({
      ok: false,
      reason: 'other_week',
      partner: false,
    });
  });

  it('nach dem Tausch prüft die 48-h-Regel die NEUEN Nachbarn beider Einheiten', () => {
    // Mo Ober, Mi Unter, Do Unter-Lauf? → Do Ober: Tausch Mo↔Mi legt Unter auf Mo und Ober auf Mi neben Do (Ober).
    const week = [
      s('o', MO, { focus: 'upper' }),
      s('u', MI, { focus: 'lower' }),
      s('o2', DO, { focus: 'upper' }),
    ];
    expect(validateSwap(week, 'o', 'u', MO)).toEqual({
      ok: false,
      reason: 'recovery_48h',
      partner: false,
      conflict: { sessionId: 'o2', date: DO },
    });
  });
});

describe('Zod an der Grenze', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  it('moveRequestSchema', () => {
    expect(moveRequestSchema.safeParse({ sessionId: id, targetDate: MI }).success).toBe(true);
    expect(moveRequestSchema.safeParse({ sessionId: 'x', targetDate: MI }).success).toBe(false);
    expect(moveRequestSchema.safeParse({ sessionId: id, targetDate: '2026-13-01' }).success).toBe(
      false,
    );
    expect(
      moveRequestSchema.safeParse({ sessionId: id, targetDate: MI, status: 'skipped' }).success,
    ).toBe(false);
  });
  it('swapRequestSchema', () => {
    const dates = { sessionOn: MO, otherSessionOn: MI };
    expect(
      swapRequestSchema.safeParse({ sessionId: id, otherSessionId: other, ...dates }).success,
    ).toBe(true);
    // Ohne die erwarteten Tage (geprüfter Stand, S1) bzw. mit ungültigem Tag: abgelehnt.
    expect(swapRequestSchema.safeParse({ sessionId: id, otherSessionId: other }).success).toBe(
      false,
    );
    expect(
      swapRequestSchema.safeParse({
        sessionId: id,
        otherSessionId: other,
        sessionOn: 'x',
        otherSessionOn: MI,
      }).success,
    ).toBe(false);
    expect(
      swapRequestSchema.safeParse({ sessionId: id, otherSessionId: id, ...dates }).success,
    ).toBe(false);
    expect(swapRequestSchema.safeParse({ sessionId: id }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaftstest (PLAN-AUSWERTUNG 3): UNABHÄNGIG nachgebaute Regeln des Datenbank-Triggers
// private.planned_sessions_before_update + Index planned_sessions_one_per_day_idx (nur `planned` belegt) bzw. von
// public.swap_planned_sessions und der 48-h-Regel – nicht aus move.ts übernommen.
// ---------------------------------------------------------------------------------------------------------

/** Trigger: Einheit änderbar und neues Datum zulässig? */
function triggerAllows(session: MovableSession, date: string, today: string): boolean {
  if (session.status !== 'planned') return false;
  if (session.in_active_plan === false) return false;
  const weekStart = startOfIsoWeek(session.original_date ?? session.scheduled_on);
  if (addDays(weekStart, 6) < today) return false;
  if (date !== session.scheduled_on) {
    if (session.is_deload) return false;
    if (date < today || startOfIsoWeek(date) !== weekStart) return false;
  }
  return true;
}

/** 48 h: keine Kraft-Einheit mit gleichen Muskeln (Ganzkörper = alle) an einem Nachbartag. */
function recoveryOk(placed: readonly MovableSession[], who: MovableSession): boolean {
  const kind = who.kind ?? 'strength';
  if (kind !== 'strength') return true;
  return placed.every((p) => {
    if (p.id === who.id || p.status === 'skipped') return true;
    if ((p.kind ?? 'strength') !== 'strength') return true;
    const gap = Math.abs(Date.parse(p.scheduled_on) - Date.parse(who.scheduled_on)) / 86_400_000;
    if (gap !== 1) return true;
    return !(p.focus === 'full_body' || who.focus === 'full_body' || p.focus === who.focus);
  });
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const FOCI: SessionFocus[] = ['full_body', 'upper', 'lower'];

function randomWorld(next: () => number): { sessions: MovableSession[]; today: string } {
  const sessions: MovableSession[] = [];
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  // Drei Wochen ab 28.09.2026, höchstens eine geplante Einheit je Tag (wie der Index), manchmal zusätzlich eine
  // erledigte/gestrichene oder eine Einheit eines alten Plans.
  for (let day = 0; day < 21; day += 1) {
    const date = addDays('2026-09-28', day);
    if (next() < 0.55) {
      const strength = next() < 0.7;
      const moved = next() < 0.15;
      const original = moved ? addDays(startOfIsoWeek(date), Math.floor(next() * 7)) : null;
      sessions.push(
        s(`s${day}`, date, {
          kind: strength ? 'strength' : 'endurance',
          focus: strength ? pick(FOCI) : null,
          status: pick(['planned', 'planned', 'planned', 'completed', 'skipped'] as const),
          is_deload: next() < 0.1,
          original_date: original,
          in_active_plan: next() > 0.08,
        }),
      );
    }
    if (next() < 0.08) {
      sessions.push(
        s(`x${day}`, date, {
          focus: pick(FOCI),
          status: next() < 0.5 ? 'completed' : 'skipped',
          in_active_plan: false,
        }),
      );
    }
  }
  return { sessions, today: addDays('2026-09-28', Math.floor(next() * 22)) };
}

describe('Eigenschaften (800 zufällige Wochen)', () => {
  it('jeder „erlaubt“-Tag wäre für Trigger, Index bzw. Tausch-Funktion gültig und hält die 48 h ein; rescheduleSession wählt den ersten erlaubten Tag', () => {
    const next = random(20261015);
    let moves = 0;
    let swaps = 0;
    for (let round = 0; round < 800; round += 1) {
      const { sessions, today } = randomWorld(next);
      for (const session of sessions) {
        const targets = moveTargets(sessions, session.id, today);
        expect(targets).toHaveLength(7);
        for (const target of targets) {
          if (!target.allowed) continue;
          expect(triggerAllows(session, target.date, today)).toBe(true);
          if (target.kind === 'move') {
            moves += 1;
            // Index: kein anderer geplanter Termin am Ziel-Tag (konservativ: auch kein erledigter).
            expect(
              sessions.some(
                (o) =>
                  o.id !== session.id && o.status !== 'skipped' && o.scheduled_on === target.date,
              ),
            ).toBe(false);
            const after = sessions.map((o) =>
              o.id === session.id ? { ...o, scheduled_on: target.date } : o,
            );
            expect(recoveryOk(after, { ...session, scheduled_on: target.date })).toBe(true);
          } else {
            swaps += 1;
            const other = sessions.find((o) => o.id === target.otherSessionId);
            expect(other).toBeDefined();
            if (!other) continue;
            expect(other.scheduled_on).toBe(target.date);
            expect(triggerAllows(other, session.scheduled_on, today)).toBe(true);
            const after = sessions.map((o) =>
              o.id === session.id
                ? { ...o, scheduled_on: other.scheduled_on }
                : o.id === other.id
                  ? { ...o, scheduled_on: session.scheduled_on }
                  : o,
            );
            expect(recoveryOk(after, { ...session, scheduled_on: other.scheduled_on })).toBe(true);
            expect(recoveryOk(after, { ...other, scheduled_on: session.scheduled_on })).toBe(true);
          }
        }
        // rescheduleSession (ohne Plan-Bezug) wählt immer den ersten erlaubten Tag zum Verschieben.
        if (session.in_active_plan === false || session.status !== 'planned') continue;
        const result = rescheduleSession(sessions, session.id, today);
        const first = firstMoveDay(targets);
        expect(result).toEqual(
          first === null
            ? { kind: 'skipped' }
            : {
                kind: 'moved',
                date: first,
                originalDate: session.original_date ?? session.scheduled_on,
              },
        );
      }
    }
    // Der Test prüft wirklich etwas (beide Arten kommen vor).
    expect(moves).toBeGreaterThan(400);
    expect(swaps).toBeGreaterThan(40);
  }, 30_000);
});
