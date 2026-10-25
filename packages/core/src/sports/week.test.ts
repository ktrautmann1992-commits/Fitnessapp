import { describe, expect, it } from 'vitest';

import { type SportWeekLog, sportWeekSummary } from './week';

const log = (
  id: string,
  performed_on: string,
  extra: Partial<SportWeekLog> = {},
): SportWeekLog => ({
  id,
  performed_on,
  sport: 'padel',
  durationS: 3600,
  distanceM: null,
  effort: 6,
  kcal: 545,
  ...extra,
});

describe('sportWeekSummary', () => {
  it('Summen je Sportart (Einheiten, Minuten, kcal, Belastung), meiste Minuten zuerst', () => {
    const summary = sportWeekSummary({
      weekOf: '2026-10-22',
      logs: [
        log('a', '2026-10-20'),
        log('b', '2026-10-22', { durationS: 1800, kcal: 270 }),
        log('c', '2026-10-21', { sport: 'football', durationS: 5400, effort: 7, kcal: 900 }),
        log('d', '2026-10-23', {
          sport: 'sup',
          durationS: 2400,
          distanceM: 6000,
          effort: null,
          kcal: null,
        }),
        log('e', '2026-10-24', {
          sport: 'sup',
          durationS: 1200,
          distanceM: null,
          effort: 3,
          kcal: 150,
        }),
        // Kraft: zählt nur zur Gesamt-Belastung
        log('f', '2026-10-24', { sport: null, durationS: 3000, effort: null, kcal: 300 }),
        // andere Woche
        log('g', '2026-10-26'),
        log('h', '2026-10-18'),
      ],
    });
    expect(summary.weekStart).toBe('2026-10-19');
    expect(summary.sports).toEqual([
      { sport: 'football', sessions: 1, durationS: 5400, distanceM: null, kcal: 900, load: 630 },
      { sport: 'padel', sessions: 2, durationS: 5400, distanceM: null, kcal: 815, load: 540 },
      { sport: 'sup', sessions: 2, durationS: 3600, distanceM: 6000, kcal: 150, load: 160 + 60 },
    ]);
    expect(summary.sportLoad).toBe(630 + 540 + 220);
    expect(summary.totalLoad).toBe(630 + 540 + 220 + 250);
  });

  it('Woche ohne Sportart: leere Liste, Belastung nur aus Kraft/Ausdauer; leere Woche 0', () => {
    expect(
      sportWeekSummary({ weekOf: '2026-10-22', logs: [log('a', '2026-10-20', { sport: null })] }),
    ).toEqual({ weekStart: '2026-10-19', sports: [], sportLoad: 0, totalLoad: 360 });
    expect(sportWeekSummary({ weekOf: '2026-10-22', logs: [] })).toEqual({
      weekStart: '2026-10-19',
      sports: [],
      sportLoad: 0,
      totalLoad: 0,
    });
  });

  it('ohne Dauer: Einheit zählt, Minuten/Belastung 0; ohne kcal bleibt kcal null', () => {
    const summary = sportWeekSummary({
      weekOf: '2026-10-19',
      logs: [log('a', '2026-10-25', { durationS: null, kcal: null })],
    });
    expect(summary.sports).toEqual([
      { sport: 'padel', sessions: 1, durationS: 0, distanceM: null, kcal: null, load: 0 },
    ]);
  });
});
