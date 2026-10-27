import { describe, expect, it } from 'vitest';

import { DAYLIGHT } from '../constants';
import { darknessHint, roundPosition, sunTimes } from './daylight';

const BERLIN = { lat: 52.52, lng: 13.405 };
const ZURICH = { lat: 47.377, lng: 8.541 };
const VIENNA = { lat: 48.208, lng: 16.373 };

/** UTC-Zeit als „HH:MM“ in Europe/Berlin. */
const local = (ms: number | null, tz = 'Europe/Berlin') =>
  ms === null
    ? null
    : new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
        new Date(ms),
      );
const minutesOf = (hhmm: string | null) => {
  const [h, m] = (hhmm ?? '0:0').split(':').map(Number) as [number, number];
  return h * 60 + m;
};
const near = (actual: string | null, expected: string, tolerance = 3) =>
  expect(Math.abs(minutesOf(actual) - minutesOf(expected))).toBeLessThanOrEqual(tolerance);

describe('sunTimes (NOAA)', () => {
  // Vergleichswerte: NOAA Solar Calculator / timeanddate.com (gerundet auf Minuten).
  it('Berlin Sommersonnenwende: Aufgang ca. 04:43, Untergang ca. 21:33 (MESZ)', () => {
    const t = sunTimes('2026-06-21', BERLIN);
    near(local(t.sunrise), '04:43');
    near(local(t.sunset), '21:33');
    expect(t.polar).toBeNull();
  });

  it('Berlin Wintersonnenwende: Aufgang ca. 08:15, Untergang ca. 15:54 (MEZ)', () => {
    const t = sunTimes('2026-12-21', BERLIN);
    near(local(t.sunrise), '08:15');
    near(local(t.sunset), '15:54');
  });

  it('Zürich und Wien Ende Oktober (MEZ): plausible Reihenfolge Dämmerung < Aufgang < Untergang < Dämmerung', () => {
    for (const p of [ZURICH, VIENNA]) {
      const t = sunTimes('2026-10-26', p);
      expect(t.dawn! < t.sunrise!).toBe(true);
      expect(t.sunrise! < t.sunset!).toBe(true);
      expect(t.sunset! < t.dusk!).toBe(true);
      // Bürgerliche Dämmerung dauert in Mitteleuropa gut eine halbe Stunde.
      expect((t.dusk! - t.sunset!) / 60_000).toBeGreaterThan(25);
      expect((t.dusk! - t.sunset!) / 60_000).toBeLessThan(45);
    }
    // Wien liegt 7,8° weiter östlich: Sonnenuntergang ca. 31 min früher (4 min je Längengrad, Breite fast gleich).
    const diff =
      (sunTimes('2026-10-26', ZURICH).sunset! - sunTimes('2026-10-26', VIENNA).sunset!) / 60_000;
    expect(diff).toBeGreaterThan(25);
    expect(diff).toBeLessThan(38);
  });

  it('Schaltjahr: 29. Februar rechnet ohne Fehler', () => {
    const t = sunTimes('2028-02-29', BERLIN);
    expect(t.sunrise).not.toBeNull();
    expect(t.sunset! - t.sunrise!).toBeGreaterThan(10 * 3_600_000);
  });

  it('Polartag und Polarnacht (Spitzbergen)', () => {
    expect(sunTimes('2026-06-21', { lat: 78.2, lng: 15.6 }).polar).toBe('day');
    const night = sunTimes('2026-12-21', { lat: 78.2, lng: 15.6 });
    expect(night.polar).toBe('night');
    expect(night.sunrise).toBeNull();
  });
});

describe('roundPosition', () => {
  it('rundet auf 0,1° (ca. 11 km) – die genaue Position bleibt nicht erhalten', () => {
    expect(DAYLIGHT.positionRoundingDeg).toBe(0.1);
    expect(roundPosition({ lat: 50.94133, lng: 6.95828 })).toEqual({ lat: 50.9, lng: 7 });
    expect(roundPosition({ lat: -33.86, lng: -151.21 })).toEqual({ lat: -33.9, lng: -151.2 });
  });
});

describe('darknessHint', () => {
  const at = (iso: string) => Date.parse(iso);
  // Der Hinweis rechnet mit der gerundeten Position – die Vergleichswerte auch.
  const sunset = sunTimes('2026-10-25', roundPosition(BERLIN)).sunset!;

  it('mitten am Tag: kein Hinweis', () => {
    expect(darknessHint({ now: at('2026-10-25T10:00:00Z'), position: BERLIN })).toBeNull();
  });

  it('Sonnenuntergang in höchstens 60 min → sunset_soon mit Minuten', () => {
    const hint = darknessHint({ now: sunset - 45 * 60_000, position: BERLIN });
    expect(hint).toEqual({ kind: 'sunset_soon', sunset, minutes: 45 });
    expect(darknessHint({ now: sunset - 61 * 60_000, position: BERLIN })).toBeNull();
    expect(darknessHint({ now: sunset - 60 * 60_000, position: BERLIN })?.kind).toBe('sunset_soon');
  });

  it('eigene Vorlaufzeit', () => {
    expect(darknessHint({ now: sunset - 90 * 60_000, position: BERLIN, leadMin: 120 })?.kind).toBe(
      'sunset_soon',
    );
  });

  it('nach Sonnenuntergang: Dämmerung, danach dunkel', () => {
    expect(darknessHint({ now: sunset + 10 * 60_000, position: BERLIN })?.kind).toBe('dusk');
    expect(darknessHint({ now: sunset + 90 * 60_000, position: BERLIN })).toEqual({
      kind: 'dark',
      sunrise: null,
    });
  });

  it('früh am Morgen: dunkel mit Sonnenaufgang, dann Morgendämmerung', () => {
    const t = sunTimes('2026-10-26', roundPosition(BERLIN));
    expect(darknessHint({ now: t.dawn! - 30 * 60_000, position: BERLIN })).toEqual({
      kind: 'dark',
      sunrise: t.sunrise,
    });
    expect(darknessHint({ now: t.sunrise! - 5 * 60_000, position: BERLIN })).toEqual({
      kind: 'dawn',
      sunrise: t.sunrise,
    });
  });

  it('ohne oder mit ungültiger Position: kein Hinweis', () => {
    expect(darknessHint({ now: sunset, position: null })).toBeNull();
    expect(darknessHint({ now: sunset, position: { lat: Number.NaN, lng: 1 } })).toBeNull();
    expect(darknessHint({ now: sunset, position: { lat: 95, lng: 1 } })).toBeNull();
    expect(darknessHint({ now: Number.NaN, position: BERLIN })).toBeNull();
  });

  it('Polarnacht → dunkel, Polartag → kein Hinweis', () => {
    expect(
      darknessHint({ now: at('2026-12-21T12:00:00Z'), position: { lat: 78.2, lng: 15.6 } })?.kind,
    ).toBe('dark');
    expect(
      darknessHint({ now: at('2026-06-21T23:00:00Z'), position: { lat: 78.2, lng: 15.6 } }),
    ).toBeNull();
  });
});
