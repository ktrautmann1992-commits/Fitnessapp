/**
 * Demo der Begleit-Seite (`/begleitung#t=demo`): Der Testmodus der App (Vercel-Vorschau, ohne Konto) teilt diesen
 * Link, damit sich die Seite ohne Datenbank ansehen lässt. Ausgedachte Beispielrunde am Rhein in Köln (dieselben
 * öffentlichen Wege wie die Demo-Aufzeichnung der App, apps/mobile/src/lib/demo-recording.ts) – keine echten Daten,
 * nichts wird gesendet oder gespeichert.
 */
import type { LiveView } from '@fitnessapp/core';

const LOOP: readonly (readonly [number, number])[] = [
  [50.94133, 6.95828],
  [50.94205, 6.96455],
  [50.94402, 6.97312],
  [50.94795, 6.97455],
  [50.95318, 6.97162],
  [50.95503, 6.96468],
  [50.95212, 6.95905],
  [50.94744, 6.95712],
  [50.94133, 6.95828],
];
/** Lauf-Tempo der Demo (ca. 5:45 min/km). */
const SPEED_MPS = 2.9;
/** Die Demo „läuft“ seit so vielen Minuten, wenn die Seite geöffnet wird. */
export const DEMO_STARTED_MIN_AGO = 25;
/** Letzte Position ist so viele Sekunden alt (wie bei einem echten Update alle 30 s). */
const DEMO_AGE_S = 12;

const toRad = (d: number) => (d * Math.PI) / 180;
function distanceM(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const legs = LOOP.slice(1).map((to, i) => {
  const from = LOOP[i] as readonly [number, number];
  return { from, to, length: distanceM(from, to) };
});
const loopM = legs.reduce((sum, leg) => sum + leg.length, 0);

/** Punkt nach `meters` auf der Runde (wiederholt sich). */
export function demoPoint(meters: number): { lat: number; lon: number } {
  let rest = ((meters % loopM) + loopM) % loopM;
  for (const leg of legs) {
    if (rest <= leg.length) {
      const f = leg.length === 0 ? 0 : rest / leg.length;
      return {
        lat: Number((leg.from[0] + (leg.to[0] - leg.from[0]) * f).toFixed(5)),
        lon: Number((leg.from[1] + (leg.to[1] - leg.from[1]) * f).toFixed(5)),
      };
    }
    rest -= leg.length;
  }
  return { lat: LOOP[0]?.[0] ?? 0, lon: LOOP[0]?.[1] ?? 0 };
}

/** Ansicht der Demo zum Zeitpunkt `now` (Start = `startedAt`). */
export function demoLiveView(startedAt: number, now: number): LiveView {
  const recordedAt = now - DEMO_AGE_S * 1000;
  const point = demoPoint(Math.max(0, (recordedAt - startedAt) / 1000) * SPEED_MPS);
  return {
    state: 'active',
    display_name: 'Alex (Demo)',
    sport: 'run',
    started_at: new Date(startedAt).toISOString(),
    server_time: new Date(now).toISOString(),
    position: {
      lat: point.lat,
      lon: point.lon,
      accuracy_m: 8,
      recorded_at: new Date(recordedAt).toISOString(),
    },
  };
}
