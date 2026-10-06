import { describe, expect, it } from 'vitest';

import { isSameIsoWeek, rescheduleSession, type ReschedulableSession } from './reschedule';

const s = (
  id: string,
  date: string,
  overrides: Partial<ReschedulableSession> = {},
): ReschedulableSession => ({
  id,
  scheduled_on: date,
  original_date: null,
  status: 'planned',
  focus: 'full_body',
  is_deload: false,
  ...overrides,
});
// Woche 05.–11.10.2026, Mo/Mi/Fr
const WEEK = [s('mo', '2026-10-05'), s('mi', '2026-10-07'), s('fr', '2026-10-09')];

describe('rescheduleSession', () => {
  it('Montag verpasst, heute Dienstag: Di–Sa grenzen an Ganzkörper-Tage → Sonntag', () => {
    expect(rescheduleSession(WEEK, 'mo', '2026-10-06')).toEqual({
      kind: 'moved',
      date: '2026-10-11',
      originalDate: '2026-10-05',
    });
  });

  it('S4 (konservativ): eine erledigte Einheit belegt ihren Tag – dorthin wird nie verschoben', () => {
    const week = [
      s('mo', '2026-10-05'),
      s('mi', '2026-10-07', { status: 'completed', focus: 'upper' }),
      s('so', '2026-10-11', { status: 'completed', focus: 'upper' }),
    ];
    const result = rescheduleSession(week, 'mo', '2026-10-06');
    expect(result.kind === 'moved' ? result.date : null).not.toBe('2026-10-07');
    expect(result.kind === 'moved' ? result.date : null).not.toBe('2026-10-11');
  });

  it('Freitag ohne Platz bis Sonntag → gestrichen, nie in die nächste Woche', () => {
    const busy = [...WEEK, s('so', '2026-10-11')];
    expect(rescheduleSession(busy, 'fr', '2026-10-09')).toEqual({ kind: 'skipped' });
  });

  it('nie vor heute und nie stapeln: Mittwoch verschoben → Sonntag (Do/Sa grenzen an Freitag)', () => {
    expect(rescheduleSession(WEEK, 'mi', '2026-10-07')).toEqual({
      kind: 'moved',
      date: '2026-10-11',
      originalDate: '2026-10-07',
    });
  });

  it('Kollision mit dem Montag der Folgewoche: Freitag verpasst, heute Sonntag → gestrichen', () => {
    const twoWeeks = [...WEEK, s('mo2', '2026-10-12')];
    expect(rescheduleSession(twoWeeks, 'fr', '2026-10-11')).toEqual({ kind: 'skipped' });
    // Ohne Einheit am Folgemontag wäre der Sonntag frei.
    expect(rescheduleSession(WEEK, 'fr', '2026-10-11')).toMatchObject({
      kind: 'moved',
      date: '2026-10-11',
    });
  });

  it('alter Termin in der Vergangenheit (gleiche Woche) ist erlaubt, neuer Termin nie davor', () => {
    expect(rescheduleSession([s('mo', '2026-10-05')], 'mo', '2026-10-08')).toEqual({
      kind: 'moved',
      date: '2026-10-08',
      originalDate: '2026-10-05',
    });
  });

  it('Woche des URSPRÜNGLICHEN Tages zählt (mehrfaches Verschieben)', () => {
    const moved = [s('mo', '2026-10-11', { original_date: '2026-10-05' })];
    expect(rescheduleSession(moved, 'mo', '2026-10-11')).toEqual({ kind: 'skipped' });
  });

  it('Ober-/Unterkörper: anderer Schwerpunkt am Nachbartag ist erlaubt', () => {
    const ul = [
      s('o1', '2026-10-05', { focus: 'upper' }),
      s('u1', '2026-10-06', { focus: 'lower' }),
    ];
    expect(rescheduleSession(ul, 'o1', '2026-10-06')).toEqual({
      kind: 'moved',
      date: '2026-10-07',
      originalDate: '2026-10-05',
    });
  });

  it('Erholungswoche → gestrichen; gestrichen/unbekannt → nicht erlaubt', () => {
    expect(
      rescheduleSession([s('d', '2026-10-05', { is_deload: true })], 'd', '2026-10-05'),
    ).toEqual({ kind: 'skipped' });
    expect(
      rescheduleSession([s('x', '2026-10-05', { status: 'skipped' })], 'x', '2026-10-05'),
    ).toEqual({ kind: 'not_allowed', reason: 'not_planned' });
    expect(rescheduleSession([], 'x', '2026-10-05')).toEqual({
      kind: 'not_allowed',
      reason: 'not_found',
    });
  });

  it('gestrichene Einheiten anderer Pläne blockieren keinen Tag', () => {
    const other = [s('a', '2026-10-05'), s('b', '2026-10-08', { status: 'skipped' })];
    expect(rescheduleSession(other, 'a', '2026-10-07')).toMatchObject({
      kind: 'moved',
      date: '2026-10-07',
    });
  });

  it('Sonntag als heute', () => {
    expect(rescheduleSession([s('a', '2026-10-09')], 'a', '2026-10-11')).toMatchObject({
      kind: 'moved',
      date: '2026-10-11',
    });
  });

  it('isSameIsoWeek', () => {
    expect(isSameIsoWeek('2026-10-11', '2026-10-05')).toBe(true);
    expect(isSameIsoWeek('2026-10-12', '2026-10-05')).toBe(false);
  });
});

describe('rescheduleSession mit gemischten Arten (Erweiterungsplan 5.4)', () => {
  const run = (id: string, date: string) => s(id, date, { kind: 'endurance', focus: null });

  it('Ausdauer darf auf jeden freien Tag ab heute (auch neben Kraft-Tagen)', () => {
    const week = [...WEEK, run('lauf', '2026-10-06')];
    expect(rescheduleSession(week, 'lauf', '2026-10-06')).toEqual({
      kind: 'moved',
      date: '2026-10-08',
      originalDate: '2026-10-06',
    });
  });

  it('Kraft prüft nur Kraft-Nachbarn: lockere Ausdauer daneben ist kein Konflikt', () => {
    const week = [
      s('mo', '2026-10-05'),
      run('di', '2026-10-06'),
      run('do', '2026-10-08'),
      s('sa', '2026-10-10'),
    ];
    // Montag verpasst, heute Dienstag: Mi liegt zwischen zwei Ausdauer-Tagen → erlaubt.
    expect(rescheduleSession(week, 'mo', '2026-10-06')).toEqual({
      kind: 'moved',
      date: '2026-10-07',
      originalDate: '2026-10-05',
    });
  });

  it('nie zwei Einheiten am Tag; Erholungswoche → streichen', () => {
    const full = ['05', '06', '07', '08', '09', '10', '11'].map((d, i) =>
      i === 0 ? run('x', `2026-10-${d}`) : s(`k${d}`, `2026-10-${d}`),
    );
    expect(rescheduleSession(full, 'x', '2026-10-05')).toEqual({ kind: 'skipped' });
    expect(
      rescheduleSession([{ ...run('x', '2026-10-05'), is_deload: true }], 'x', '2026-10-05'),
    ).toEqual({ kind: 'skipped' });
  });
});
