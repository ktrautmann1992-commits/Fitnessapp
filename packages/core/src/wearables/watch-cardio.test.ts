import { describe, expect, it } from 'vitest';

import { CARDIO_LOG_LIMITS } from '../constants';
import { mergedCardioValues, watchCardioForRoute, type WatchCardioInput } from './watch-cardio';

// Echtes Beispiel (06.11.2026): App 23,88 km / 2:41:35 Bewegungszeit, Samsung-Uhr 25,26 km / 2:42:41.
const appRun = { durationS: 2 * 3600 + 41 * 60 + 35, distanceM: 23_880 };
const watchRun = { durationS: 2 * 3600 + 42 * 60 + 41, distanceM: 25_260 };

const input = (over: Partial<WatchCardioInput> = {}): WatchCardioInput => ({
  logSource: 'gps',
  modality: 'run',
  app: appRun,
  watch: watchRun,
  ...over,
});

describe('mergedCardioValues', () => {
  it('GPS-Aufzeichnung + Uhr: Distanz und Dauer der Uhr gewinnen', () => {
    expect(mergedCardioValues(input())).toEqual({ ...watchRun, fromWatch: true });
  });

  it('Rad und Gehen genauso', () => {
    for (const modality of ['bike', 'walk'] as const) {
      expect(
        mergedCardioValues(input({ modality, watch: { durationS: 3600, distanceM: 8000 } })),
      ).toEqual({ durationS: 3600, distanceM: 8000, fromWatch: true });
    }
  });

  it('Uhr ohne Distanz (null oder 0) → App-Werte bleiben (auch die Dauer)', () => {
    for (const distanceM of [null, 0, -5]) {
      expect(mergedCardioValues(input({ watch: { durationS: 9761, distanceM } }))).toEqual({
        ...appRun,
        fromWatch: false,
      });
    }
  });

  it('unplausible Distanz der Uhr (zu schnell für die Dauer) → App-Werte bleiben', () => {
    // Laufen: höchstens 37,5 km/h im Schnitt → 1 h, 40 km ist unplausibel, 37,5 km gerade noch.
    expect(
      mergedCardioValues(input({ watch: { durationS: 3600, distanceM: 40_000 } })).fromWatch,
    ).toBe(false);
    expect(
      mergedCardioValues(input({ watch: { durationS: 3600, distanceM: 37_500 } })).fromWatch,
    ).toBe(true);
    // Gehen: höchstens 15 km/h.
    expect(
      mergedCardioValues(input({ modality: 'walk', watch: { durationS: 3600, distanceM: 15_001 } }))
        .fromWatch,
    ).toBe(false);
  });

  it('Distanz außerhalb der Grenzen bzw. nicht ganzzahlig → App-Werte bleiben', () => {
    const max = CARDIO_LOG_LIMITS.distanceM.max;
    expect(
      mergedCardioValues(
        input({ modality: 'bike', watch: { durationS: 43_200, distanceM: max + 1 } }),
      ).fromWatch,
    ).toBe(false);
    expect(
      mergedCardioValues(input({ watch: { durationS: 9761, distanceM: 25_260.5 } })).fromWatch,
    ).toBe(false);
    expect(
      mergedCardioValues(input({ watch: { durationS: 9761, distanceM: Number.NaN } })).fromWatch,
    ).toBe(false);
  });

  it('Dauer der Uhr fehlt oder außerhalb 1 min – 12 h → App-Werte bleiben', () => {
    for (const durationS of [null, 0, 59, CARDIO_LOG_LIMITS.durationS.max + 1, 100.5]) {
      expect(mergedCardioValues(input({ watch: { durationS, distanceM: 200 } })).fromWatch).toBe(
        false,
      );
    }
    // Grenzen selbst sind erlaubt.
    expect(mergedCardioValues(input({ watch: { durationS: 60, distanceM: 200 } })).fromWatch).toBe(
      true,
    );
    expect(
      mergedCardioValues(
        input({ watch: { durationS: CARDIO_LOG_LIMITS.durationS.max, distanceM: 100_000 } }),
      ).fromWatch,
    ).toBe(true);
  });

  it('andere Herkunft (manuell, GPX-Import, Workout) → Eintrag bleibt führend', () => {
    for (const logSource of ['manual', 'gpx_import', 'workout', 'health_connect'] as const) {
      expect(mergedCardioValues(input({ logSource }))).toEqual({ ...appRun, fromWatch: false });
    }
  });

  it('Arten ohne GPS-Aufzeichnung (Schwimmen, Rudern) → Eintrag bleibt führend', () => {
    for (const modality of ['swim', 'row'] as const) {
      expect(
        mergedCardioValues(input({ modality, watch: { durationS: 1800, distanceM: 1500 } }))
          .fromWatch,
      ).toBe(false);
    }
  });

  it('App-Eintrag ohne Distanz bekommt die der Uhr', () => {
    expect(mergedCardioValues(input({ app: { durationS: 9000, distanceM: null } }))).toEqual({
      ...watchRun,
      fromWatch: true,
    });
  });
});

describe('watchCardioForRoute', () => {
  const route = { distance_m: 23_880, moving_s: 9695 };
  const cardio = { duration_s: 9761, distance_m: 25_260 };

  it('zusammengeführter GPS-Eintrag mit Uhr-Werten → Werte des Eintrags', () => {
    expect(watchCardioForRoute({ logSource: 'gps', merged: true, cardio, route })).toEqual({
      distanceM: 25_260,
      durationS: 9761,
    });
  });

  it('Werte gleich der Strecke (ältere Zusammenführung) → null', () => {
    expect(
      watchCardioForRoute({
        logSource: 'gps',
        merged: true,
        cardio: { duration_s: 9695, distance_m: 23_880 },
        route,
      }),
    ).toBeNull();
  });

  it('nicht zusammengeführt, andere Herkunft, ohne Eintrag oder ohne Distanz → null', () => {
    expect(watchCardioForRoute({ logSource: 'gps', merged: false, cardio, route })).toBeNull();
    expect(watchCardioForRoute({ logSource: 'manual', merged: true, cardio, route })).toBeNull();
    expect(watchCardioForRoute({ logSource: null, merged: true, cardio, route })).toBeNull();
    expect(watchCardioForRoute({ logSource: 'gps', merged: true, cardio: null, route })).toBeNull();
    expect(
      watchCardioForRoute({
        logSource: 'gps',
        merged: true,
        cardio: { duration_s: 9761, distance_m: null },
        route,
      }),
    ).toBeNull();
    expect(
      watchCardioForRoute({
        logSource: 'gps',
        merged: true,
        cardio: { duration_s: 9761, distance_m: 0 },
        route,
      }),
    ).toBeNull();
  });
});
