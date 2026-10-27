import { importGpx } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { purposeToSport, savedRouteTimeText } from '../lib/gpx-route';
import { demoGpxText } from '../lib/demo-gpx';
import { createLoopStore, savedLoopSchema, toSavedGpxRoute } from '../lib/loop-store.types';
import { createMemoryProtectedStore } from './protected-store';

/**
 * GPX-Import (Sportarten Stufe 1 · Wandern, 27.10.2026): Datei → gemerkte Strecke nur auf dem Gerät, mit Höhen und
 * Gehzeit. Beispiel-Tour = ausgedachte Daten (keine Nutzerdaten).
 */
describe('GPX-Import als gemerkte Strecke', () => {
  const NOW = '2026-10-27T10:00:00.000Z';

  function demo() {
    const result = importGpx(demoGpxText());
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it('Beispiel-Tour: ca. 6–7 km, ca. 450 Hm hinauf und hinunter, Name aus der Datei', () => {
    const tour = demo();
    expect(tour.name).toBe('Beispiel-Tour zur Alm');
    expect(tour.distanceM).toBeGreaterThan(6_000);
    expect(tour.distanceM).toBeLessThan(7_500);
    expect(tour.ascentM).toBeGreaterThan(400);
    expect(tour.descentM).toBeGreaterThan(400);
    expect(tour.maxAltitudeM).toBeGreaterThan(1_300);
  });

  it('Wofür? Wandern/Bergwandern/Gehen → Gehen mit Art, Laufen/Rad ohne Art', () => {
    expect(purposeToSport('hike')).toEqual({ sport: 'walk', walkKind: 'hike' });
    expect(purposeToSport('mountain_hike')).toEqual({ sport: 'walk', walkKind: 'mountain_hike' });
    expect(purposeToSport('walk')).toEqual({ sport: 'walk', walkKind: null });
    expect(purposeToSport('run')).toEqual({ sport: 'run', walkKind: null });
    expect(purposeToSport('bike')).toEqual({ sport: 'bike', walkKind: null });
  });

  it('merken (nur Gerät, Schema geprüft) und wieder lesen – mit Abstieg, höchstem Punkt, Profil und Gehzeit', async () => {
    const store = createLoopStore(createMemoryProtectedStore());
    const route = toSavedGpxRoute(demo(), {
      name: '  Almtour  ',
      sport: 'walk',
      walkKind: 'mountain_hike',
      id: 'gpx-1',
      now: NOW,
    });
    expect(savedLoopSchema.safeParse(route).success).toBe(true);
    const [saved] = await store.save('u', route);
    expect(saved).toMatchObject({
      name: 'Almtour',
      source: 'gpx',
      sport: 'walk',
      walk_kind: 'mountain_hike',
      surface: null,
    });
    expect(saved?.profile?.length).toBeGreaterThan(2);
    expect(savedRouteTimeText(saved!)).toMatch(/^ca\. \d h \d{2} min$/);
  });

  it('Laufen/Rad: keine Art der Geh-Einheit; leerer Name → „GPX-Strecke“', () => {
    const route = toSavedGpxRoute(demo(), {
      name: ' ',
      sport: 'run',
      walkKind: 'hike',
      id: 'gpx-2',
      now: NOW,
    });
    expect(route.walk_kind).toBeNull();
    expect(route.name).toBe('GPX-Strecke');
  });

  it('ältere gemerkte Runden ohne die neuen Felder bleiben gültig; zu lange Strecken nicht', () => {
    const old = {
      id: 'loop-a',
      name: 'Runde',
      polyline: '_p~iF~ps|U_ulLnnqC',
      distance_m: 5_000,
      ascent_m: null,
      surface: null,
      saved_at: NOW,
    };
    expect(savedLoopSchema.safeParse(old).success).toBe(true);
    expect(savedLoopSchema.safeParse({ ...old, distance_m: 300_001 }).success).toBe(false);
    expect(savedRouteTimeText({ distance_m: 100, ascent_m: null })).toBeNull();
  });
});
