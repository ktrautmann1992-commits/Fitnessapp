import { toGpx } from '@fitnessapp/core';

/**
 * Beispiel-Tour für den Testmodus (GPX-Import ohne eigene Datei testbar): ausgedachte Bergwanderung, ca. 7 km hin und
 * zurück mit ca. 450 Hm – gerechnet, keine echte Aufzeichnung, keine Nutzerdaten.
 */
export function demoGpxText(): string {
  const points = [];
  const up = 40;
  for (let i = 0; i <= up * 2; i += 1) {
    const k = i <= up ? i : up * 2 - i;
    points.push({
      lat: 47.42 + k * 0.0007,
      lng: 11.1 + k * 0.0004 + (i > up ? 0.0003 : 0),
      ele: 900 + k * 11.5,
    });
  }
  return toGpx({
    name: 'Beispiel-Tour zur Alm',
    sport: 'walk',
    startedAt: null,
    points,
  });
}
