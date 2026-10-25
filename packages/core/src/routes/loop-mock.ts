import { LOOP_ROUTE } from '../constants';
import type { LoopCandidate, LoopSurface } from './loop';
import { loopSeeds } from './loop';
import type { LatLng } from './polyline';
import { EARTH_RADIUS_M, trackDistance } from './track';

/**
 * ATTRAPPE des Routing-Diensts für Rundkurs-Vorschläge (Testmodus der App, Unit- und E2E-Tests): erzeugt ohne Netz
 * ausgedachte, aber realistisch geformte Runden um den Startpunkt – gewellte Schleifen, die genau am Start beginnen und
 * enden, mit ausgedachten Höhenmetern und Untergrund-Anteilen. Jede vierte Runde ist absichtlich „hin und zurück“
 * (gleicher Weg zurück), damit die Bewertung sie aussortiert. Fest, ohne Zufall (gleiche Eingabe → gleiche Runden).
 * KEINE echten Wege – die Linien können über Häuser und Wasser laufen.
 */

const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;

function offset(from: LatLng, north: number, east: number): LatLng {
  return {
    lat: from.lat + north / M_PER_DEG_LAT,
    lng: from.lng + east / (M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** Kleiner fester Pseudo-Zufall (0–1) aus einer ganzen Zahl. */
function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function wavyLoop(start: LatLng, lengthM: number, seed: number): LatLng[] {
  const heading = unit(seed, 1) * 2 * Math.PI;
  const wobble = 0.08 + unit(seed, 2) * 0.14;
  const lobes = 2 + Math.floor(unit(seed, 3) * 3);
  const steps = Math.max(48, Math.min(600, Math.round(lengthM / 40)));
  const shape = (radius: number) => {
    // Mittelpunkt liegt `radius` in Richtung `heading` vom Start; der Start ist der Punkt gegenüber (φ = heading + π).
    const center = offset(start, Math.cos(heading) * radius, Math.sin(heading) * radius);
    const points: LatLng[] = [start];
    for (let i = 1; i < steps; i += 1) {
      const phi = heading + Math.PI + (2 * Math.PI * i) / steps;
      const taper = Math.sin((Math.PI * i) / steps); // am Start keine Welle → Linie schließt sauber
      const r = radius * (1 + wobble * taper * Math.sin(lobes * phi + seed));
      points.push(offset(center, Math.cos(phi) * r, Math.sin(phi) * r));
    }
    points.push(start);
    return points;
  };
  const first = shape(lengthM / (2 * Math.PI));
  const scale = lengthM / Math.max(1, trackDistance(first));
  return shape((lengthM / (2 * Math.PI)) * scale);
}

function outAndBack(start: LatLng, lengthM: number, seed: number): LatLng[] {
  const heading = unit(seed, 4) * 2 * Math.PI;
  const steps = Math.max(20, Math.round(lengthM / 80));
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const d = (lengthM / 2) * (i / steps);
    out.push(offset(start, Math.cos(heading) * d, Math.sin(heading) * d));
  }
  return [...out, ...out.slice(0, -1).reverse()];
}

/** Ausgedachte Runden für Startpunkt, Distanz und Variante (wie der Dienst: je Variante neue Zufallswerte). */
export function mockLoopCandidates(input: {
  readonly start: LatLng;
  readonly distanceKm: number;
  readonly surface: LoopSurface;
  readonly variant: number;
}): LoopCandidate[] {
  const target = input.distanceKm * 1000;
  return loopSeeds(input.variant, LOOP_ROUTE.providerCandidates).map((seed) => {
    // Länge streut wie beim echten Dienst um ±12 %.
    const lengthM = target * (0.9 + unit(seed, 5) * 0.22);
    const points =
      seed % 4 === 3
        ? outAndBack(input.start, lengthM, seed)
        : wavyLoop(input.start, lengthM, seed);
    const paved = Math.round((0.2 + unit(seed, 6) * 0.7) * 100) / 100;
    const unknown = 0.05;
    return {
      id: `mock-${seed}`,
      points,
      distanceM: Math.round(trackDistance(points)),
      ascentM: Math.round(input.distanceKm * (3 + unit(seed, 7) * 9)),
      surface: { paved, unpaved: Math.round((1 - paved - unknown) * 100) / 100, unknown },
    };
  });
}
