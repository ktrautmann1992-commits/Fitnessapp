import { describe, expect, it } from 'vitest';

import {
  type EnduranceActivity,
  enduranceActivities,
  type EnduranceLogInput,
  type EnduranceRouteInput,
  enduranceTileSummary,
  enduranceWeekBars,
  enduranceTotals,
  periodRange,
  shiftPeriod,
} from './activities';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function route(
  n: number,
  startedAt: string,
  distanceM: number,
  extra: Partial<EnduranceRouteInput> = {},
): EnduranceRouteInput {
  return {
    id: uuid(n),
    name: `Runde ${n}`,
    sport: 'run',
    started_at: startedAt,
    duration_s: 1_800,
    moving_s: 1_700,
    distance_m: distanceM,
    elevation_gain_m: 20,
    session_log_id: null,
    ...extra,
  };
}

function log(
  n: number,
  day: string,
  distanceM: number | null,
  extra: Partial<EnduranceLogInput> = {},
): EnduranceLogInput {
  return {
    id: uuid(100 + n),
    name_de: 'Lauf',
    performed_on: day,
    started_at: null,
    modality: 'run',
    duration_s: 1_200,
    distance_m: distanceM,
    elevation_m: null,
    ...extra,
  };
}

describe('enduranceActivities', () => {
  it('verknüpfter Eintrag zählt nur einmal (als Strecke), neueste zuerst', () => {
    const linked = log(1, '2026-10-19', 5_000);
    const r = route(1, '2026-10-19T06:00:00Z', 5_100, { session_log_id: linked.id });
    const free = log(2, '2026-10-20', 3_000, { modality: 'swim' });
    const list = enduranceActivities([r], [linked, free]);
    expect(list.map((a) => a.key)).toEqual([`log:${free.id}`, `route:${r.id}`]);
    expect(list[1]).toMatchObject({
      source: 'route',
      logId: linked.id,
      distanceM: 5_100,
      movingS: 1_700,
    });
    expect(list[0]).toMatchObject({ source: 'log', movingS: 1_200, sport: 'swim' });
  });

  it('nur Einträge ohne GPS; leer', () => {
    expect(enduranceActivities([], [])).toEqual([]);
    expect(enduranceActivities([], [log(1, '2026-10-01', null)])).toHaveLength(1);
  });

  it('Tag einer Strecke = lokales Datum (Europe/Berlin), auch über Mitternacht und Zeitumstellung', () => {
    // 22:30 UTC im Sommer = 00:30 in Berlin am Folgetag.
    expect(enduranceActivities([route(1, '2026-07-01T22:30:00Z', 1)], [])[0]?.day).toBe(
      '2026-07-02',
    );
    // Zeitumstellung 25.10.2026 (03:00 MESZ → 02:00 MEZ): 23:30 UTC am 25. = 00:30 MEZ am 26.
    expect(enduranceActivities([route(2, '2026-10-25T23:30:00Z', 1)], [])[0]?.day).toBe(
      '2026-10-26',
    );
    expect(enduranceActivities([route(3, '2026-10-24T22:30:00Z', 1)], [])[0]?.day).toBe(
      '2026-10-25',
    );
  });
});

function activities(): EnduranceActivity[] {
  return enduranceActivities(
    [
      route(1, '2026-10-19T06:00:00Z', 5_000), // Mo
      route(2, '2026-10-25T20:00:00Z', 10_000, { sport: 'bike', elevation_gain_m: 100 }), // So 21:00 MEZ
      route(3, '2026-10-12T06:00:00Z', 3_000), // Vorwoche
    ],
    [log(1, '2026-10-21', 2_000, { modality: 'walk' }), log(2, '2026-10-26', 4_000)],
  );
}

describe('enduranceTotals', () => {
  it('Woche Mo–So mit Summen je Sportart und neutralem Vergleich zur Vorwoche', () => {
    const s = enduranceTotals(activities(), { period: 'week', anchor: '2026-10-22' });
    expect(s.from).toBe('2026-10-19');
    expect(s.to).toBe('2026-10-25');
    expect(s.total).toEqual({
      count: 3,
      distanceM: 17_000,
      movingS: 1_700 * 2 + 1_200,
      elevationM: 120,
    });
    expect(s.bySport.map((x) => x.sport)).toEqual(['run', 'walk', 'bike']);
    expect(s.previous.total.distanceM).toBe(3_000);
    expect(s.distanceDiffM).toBe(14_000);
    expect(s.weeks).toEqual([]);
  });

  it('Wochenwechsel: Montag gehört zur neuen Woche', () => {
    const s = enduranceTotals(activities(), { period: 'week', anchor: '2026-10-26' });
    expect(s.total.count).toBe(1);
    expect(s.total.distanceM).toBe(4_000);
  });

  it('Monat mit Wochenbalken (nur Tage des Monats); Summe der Wochen = Monat', () => {
    const s = enduranceTotals(activities(), { period: 'month', anchor: '2026-10-05' });
    expect(s.from).toBe('2026-10-01');
    expect(s.to).toBe('2026-10-31');
    expect(s.total.count).toBe(5);
    expect(s.weeks[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-04' });
    expect(s.weeks.at(-1)).toMatchObject({ from: '2026-10-26', to: '2026-10-31' });
    expect(s.weeks.reduce((n, w) => n + w.distanceM, 0)).toBe(s.total.distanceM);
    expect(s.previous).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('leere Periode und Februar im Schaltjahr', () => {
    const s = enduranceTotals(activities(), { period: 'month', anchor: '2028-02-10' });
    expect(s.total).toEqual({ count: 0, distanceM: 0, movingS: 0, elevationM: 0 });
    expect(s.to).toBe('2028-02-29');
    expect(s.bySport).toEqual([]);
  });

  it('1 vs. 7 Aktivitäten an einem Tag', () => {
    const one = enduranceActivities([], [log(1, '2026-10-20', 1_000)]);
    const seven = enduranceActivities(
      [],
      Array.from({ length: 7 }, (_, i) => log(i, '2026-10-20', 1_000)),
    );
    expect(enduranceTotals(one, { period: 'week', anchor: '2026-10-20' }).total.count).toBe(1);
    expect(enduranceTotals(seven, { period: 'week', anchor: '2026-10-20' }).total).toMatchObject({
      count: 7,
      distanceM: 7_000,
    });
  });

  it('Blättern: Woche ±1, Monat über den Jahreswechsel', () => {
    expect(shiftPeriod('week', '2026-10-22', -1)).toBe('2026-10-12');
    expect(shiftPeriod('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftPeriod('month', '2026-12-31', 1)).toBe('2027-01-01');
    expect(periodRange('week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('Kachel: km dieser Woche und letzte Aktivität bis heute', () => {
    const tile = enduranceTileSummary(activities(), '2026-10-22');
    expect(tile.weekDistanceM).toBe(17_000);
    expect(tile.latest?.day).toBe('2026-10-21');
    expect(enduranceTileSummary([], '2026-10-22')).toEqual({
      weekDistanceM: 0,
      weekCount: 0,
      latest: null,
    });
  });
});

describe('enduranceWeekBars', () => {
  it('sieben Tage Mo–So, Anteil am stärksten Tag, heute markiert', () => {
    const bars = enduranceWeekBars(activities(), '2026-10-22');
    expect(bars.days.map((d) => d.day)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(bars.days.map((d) => d.distanceM)).toEqual([5_000, 0, 2_000, 0, 0, 0, 10_000]);
    expect(bars.days.map((d) => d.share)).toEqual([0.5, 0, 0.2, 0, 0, 0, 1]);
    expect(bars.todayIndex).toBe(3);
  });

  it('ohne Aktivitäten: alle Anteile 0 (keine Division durch 0)', () => {
    const bars = enduranceWeekBars([], '2026-10-25');
    expect(bars.days.every((d) => d.share === 0)).toBe(true);
    expect(bars.todayIndex).toBe(6);
  });
});
