import { haversineM, type TrackedRouteSport, type TrackPoint } from '@fitnessapp/core';

/**
 * Demo-Aufzeichnung (Testmodus, W-G14, Etappe E4): Eine ausgedachte Beispielrunde (öffentliche Wege am Rhein in Köln,
 * keine echten Nutzerdaten) wird im Zeitraffer als Rohpunkte abgespielt – so lässt sich „Aufzeichnen → Speichern →
 * Auswertung“ auch im Browser testen. Die Zeit läuft `SPEED_UP`-mal schneller und liegt in der Vergangenheit (endet nie
 * nach „jetzt“), damit die Regeln „nicht in der Zukunft“ wie im echten Betrieb gelten.
 */

/** Wegpunkte der Beispielrunde (ca. 5,4 km, Rundkurs). */
const LOOP: readonly { lat: number; lng: number }[] = [
  { lat: 50.94133, lng: 6.95828 },
  { lat: 50.94205, lng: 6.96455 },
  { lat: 50.94402, lng: 6.97312 },
  { lat: 50.94795, lng: 6.97455 },
  { lat: 50.95318, lng: 6.97162 },
  { lat: 50.95503, lng: 6.96468 },
  { lat: 50.95212, lng: 6.95905 },
  { lat: 50.94744, lng: 6.95712 },
  { lat: 50.94133, lng: 6.95828 },
];

/** So viel schneller als echt (1 s → 40 s). */
export const DEMO_SPEED_UP = 40;
/** Simulierte Zeit beginnt so weit vor „jetzt“ (Demo endet spätestens nach dieser Dauer). */
export const DEMO_MAX_SIM_MS = 90 * 60 * 1000;
const TICK_MS = 250;
const POINT_EVERY_SIM_MS = 2_000;
const SPEED_MPS: Record<TrackedRouteSport, number> = { run: 2.9, bike: 6.5, walk: 1.4 };

const segments = LOOP.slice(1).map((to, i) => {
  const from = LOOP[i] as { lat: number; lng: number };
  return { from, to, length: haversineM(from, to) };
});
const LOOP_M = segments.reduce((sum, s) => sum + s.length, 0);

/** Punkt bei Distanz `d` entlang der (wiederholten) Runde, Höhe sanft wellig. */
export function demoPointAt(distanceM: number, t: number): TrackPoint {
  let d = ((distanceM % LOOP_M) + LOOP_M) % LOOP_M;
  for (const s of segments) {
    if (d <= s.length) {
      const f = s.length > 0 ? d / s.length : 0;
      return {
        lat: s.from.lat + (s.to.lat - s.from.lat) * f,
        lng: s.from.lng + (s.to.lng - s.from.lng) * f,
        t,
        accuracyM: 5,
        altitudeM: 52 + 9 * Math.sin((distanceM / LOOP_M) * 2 * Math.PI * 3),
      };
    }
    d -= s.length;
  }
  const last = LOOP.at(-1) as { lat: number; lng: number };
  return { ...last, t, accuracyM: 5, altitudeM: 52 };
}

/** Zeitraffer-Abspielung: liefert Punkte an `emit`, eigene Uhr (`now`) für Anzeige und Aufzeichnung. */
export class DemoRun {
  private simMs = 0;
  private distanceM = 0;
  private nextPointAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly origin: number;

  constructor(
    private readonly sport: TrackedRouteSport,
    private readonly emit: (points: TrackPoint[]) => void,
    realNow: number = Date.now(),
  ) {
    this.origin = realNow - DEMO_MAX_SIM_MS;
  }

  /** Simulierte Uhrzeit (ms). */
  now(): number {
    return this.origin + this.simMs;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(TICK_MS * DEMO_SPEED_UP), TICK_MS);
  }

  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Simulierte Zeit voranschreiten lassen (auch für Tests). */
  tick(simDeltaMs: number): void {
    const points: TrackPoint[] = [];
    const end = Math.min(this.simMs + simDeltaMs, DEMO_MAX_SIM_MS - 1_000);
    while (this.nextPointAt <= end) {
      this.distanceM = (this.nextPointAt / 1000) * SPEED_MPS[this.sport];
      points.push(demoPointAt(this.distanceM, this.origin + this.nextPointAt));
      this.nextPointAt += POINT_EVERY_SIM_MS;
    }
    this.simMs = end;
    if (end >= DEMO_MAX_SIM_MS - 1_000) this.pause();
    if (points.length > 0) this.emit(points);
  }
}
