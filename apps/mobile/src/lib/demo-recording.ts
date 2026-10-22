import { haversineM, type TrackedRouteSport, type TrackPoint } from '@fitnessapp/core';

/**
 * Demo-Aufzeichnung (Testmodus, W-G14, Etappe E4): Eine ausgedachte Beispielrunde (öffentliche Wege am Rhein in Köln,
 * keine echten Nutzerdaten) wird im Zeitraffer als Rohpunkte abgespielt – so lässt sich „Aufzeichnen → Speichern →
 * Auswertung“ auch im Browser testen. Die Zeit läuft `SPEED_UP`-mal schneller und liegt in der Vergangenheit (endet nie
 * nach „jetzt“), damit die Regeln „nicht in der Zukunft“ wie im echten Betrieb gelten.
 */

/** Wegpunkte der Beispielrunde (ca. 4,4 km, Rundkurs; ein Demo-Lauf geht meist etwas über eine Runde). */
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

/**
 * Tempo-Verlauf der Runde (Sekunden je km beim Laufen, an Stützstellen in Metern, dazwischen linear): ruhiges
 * Einlaufen, zügiger Mittelteil, langsamer am Anstieg, schneller bergab und ein starker Schluss – damit die
 * Auswertung (farbige Linie, Kilometer-Balken, Bestwerte) im Testmodus etwas zu zeigen hat. Fest, ohne Zufall.
 */
const PACE_PROFILE: readonly (readonly [distanceM: number, secondsPerKm: number])[] = [
  [0, 372],
  [700, 350],
  [1_200, 328],
  [2_200, 320],
  [2_600, 338],
  [2_850, 388],
  [3_550, 396],
  [3_750, 312],
  [4_200, 300],
  [4_700, 284],
  [5_600, 280],
];
/** Tempo und Höhe wiederholen sich nach so vielen Metern (eigener Takt, unabhängig von der Rundenlänge). */
const PROFILE_M = 5_600;
/** Mittlere Lauf-Pace des Profils ≈ SPEED_MPS.run (andere Sportarten skalieren mit). */
const BASE_PACE_S = 1000 / SPEED_MPS.run;

function interpolate(table: readonly (readonly [number, number])[], x: number): number {
  const first = table[0] as readonly [number, number];
  if (x <= first[0]) return first[1];
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i] as readonly [number, number];
    const [x0, y0] = table[i - 1] as readonly [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return (table.at(-1) as readonly [number, number])[1];
}

/** Geschwindigkeit (m/s) nach `distanceM` Metern. */
export function demoSpeedAt(sport: TrackedRouteSport, distanceM: number): number {
  const d = ((distanceM % PROFILE_M) + PROFILE_M) % PROFILE_M;
  // Leichtes, festes Schwanken (±1,5 %) wie beim echten Laufen.
  const wobble = 1 + 0.015 * Math.sin(d / 61) + 0.008 * Math.sin(d / 17);
  return (SPEED_MPS[sport] * BASE_PACE_S * wobble) / interpolate(PACE_PROFILE, d);
}

/** Höhe (m) nach `distanceM` Metern: flach am Rhein, kleine Welle, ein Hügel (~22 m) bei km 3–4, etwas Messrauschen. */
export function demoAltitudeAt(distanceM: number): number {
  const d = ((distanceM % PROFILE_M) + PROFILE_M) % PROFILE_M;
  const bump = (center: number, width: number, height: number) =>
    height * Math.exp(-(((d - center) / width) ** 2));
  return (
    48 +
    bump(1_400, 260, 5) +
    bump(3_400, 380, 22) -
    bump(4_500, 300, 3) +
    0.3 * Math.sin(d / 37) +
    0.15 * Math.sin(d / 13.7)
  );
}

/** Punkt bei Distanz `d` entlang der (wiederholten) Runde mit Höhe. */
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
        altitudeM: demoAltitudeAt(distanceM),
      };
    }
    d -= s.length;
  }
  const last = LOOP.at(-1) as { lat: number; lng: number };
  return { ...last, t, accuracyM: 5, altitudeM: demoAltitudeAt(0) };
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
      points.push(demoPointAt(this.distanceM, this.origin + this.nextPointAt));
      this.distanceM += demoSpeedAt(this.sport, this.distanceM) * (POINT_EVERY_SIM_MS / 1000);
      this.nextPointAt += POINT_EVERY_SIM_MS;
    }
    this.simMs = end;
    if (end >= DEMO_MAX_SIM_MS - 1_000) this.pause();
    if (points.length > 0) this.emit(points);
  }
}
