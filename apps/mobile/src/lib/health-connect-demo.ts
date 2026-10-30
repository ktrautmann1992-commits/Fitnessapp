import {
  addDays,
  EARTH_RADIUS_M,
  type HcRouteLocation,
  type HcRouteRead,
  WEARABLE_DATA_TYPES,
  type WearableDataType,
} from '@fitnessapp/core';

import type { HcReadResult, HealthConnectDriver } from './health-connect-driver.types';

/**
 * Beispiel-Uhr für den TESTMODUS (Phase 8, docs/PLAN-PHASE-8.md 9 „Browser: Testmodus mit Beispieldaten“): liefert
 * ausgedachte Daten der letzten 7 Tage – drei Läufe mit Puls, eine Kraft-Einheit, eine Wanderung, Yoga und Schritte – sowie Ruhepuls,
 * Schlaf und HRV der letzten 21 Tage („Erholung aus der Uhr“, 25.10.2026: genug für die persönliche Basis; HEUTE kurze
 * Nacht, Ruhepuls höher und HRV niedriger als üblich → Erholung „niedrig“). Feste IDs je Tag: ein erneuter Abgleich
 * ändert, legt nie doppelt an. Kein Netz, keine echten Daten.
 * Routen (23.10.2026): Die Läufe haben eine feste, ausgedachte Runde um das Tempelhofer Feld in Berlin (öffentlicher
 * Park) mit wechselndem Tempo und leichter Steigung – die Route ist ca. 5 % länger als die Distanz laut Health Connect
 * (wie beim Gründer-Test). Der älteste Lauf verlangt wie Android 14 eine Freigabe je Einheit („Route freigeben“).
 */

/** Mitte der Beispiel-Runde: Tempelhofer Feld, Berlin (öffentlicher Ort, keine echten Nutzerdaten). */
const DEMO_ROUTE_CENTER = { lat: 52.4731, lng: 13.4018 };
const M_PER_DEG = (Math.PI / 180) * EARTH_RADIUS_M;

/** Ellipse 1.050 m × 700 m (Umfang ca. 5,55 km) als feine Linie mit aufsummierter Länge. */
function demoLoop(): { lat: number; lng: number; at: number }[] {
  const out: { lat: number; lng: number; at: number }[] = [];
  let at = 0;
  for (let i = 0; i <= 2000; i += 1) {
    const a = (2 * Math.PI * i) / 2000;
    // Leichte Wellen, damit die Linie nicht wie gezeichnet aussieht.
    const north = 700 * Math.sin(a) + 25 * Math.sin(7 * a);
    const east = 1050 * Math.cos(a) + 20 * Math.cos(5 * a);
    const p = {
      lat: DEMO_ROUTE_CENTER.lat + north / M_PER_DEG,
      lng:
        DEMO_ROUTE_CENTER.lng +
        east / (M_PER_DEG * Math.cos((DEMO_ROUTE_CENTER.lat * Math.PI) / 180)),
    };
    const prev = out.at(-1);
    if (prev) {
      const dn = (p.lat - prev.lat) * M_PER_DEG;
      const de = (p.lng - prev.lng) * M_PER_DEG * Math.cos((DEMO_ROUTE_CENTER.lat * Math.PI) / 180);
      at += Math.hypot(dn, de);
    }
    out.push({ ...p, at });
  }
  return out;
}

const LOOP = demoLoop();

/**
 * Route eines Beispiel-Laufs: ein Punkt je Sekunde, einmal die Runde (ca. 5,55 km) in `minutes` Minuten; Tempo
 * schwankt im 8-Minuten-Takt um ±10 %, Höhe 38–52 m (zwei Anstiege). Deterministisch.
 */
export function demoRoute(start: string, minutes: number): HcRouteLocation[] {
  const t0 = Date.parse(start);
  const total = minutes * 60;
  const length = (LOOP.at(-1) as { at: number }).at;
  const wave = (t: number) => (480 / (2 * Math.PI)) * 0.1 * (1 - Math.cos((2 * Math.PI * t) / 480));
  const scale = length / (total + wave(total));
  const points: HcRouteLocation[] = [];
  let k = 0;
  for (let t = 0; t <= total; t += 1) {
    const s = Math.min(length, scale * (t + wave(t)));
    while (k < LOOP.length - 2 && (LOOP[k + 1] as { at: number }).at < s) k += 1;
    const a = LOOP[k] as { lat: number; lng: number; at: number };
    const b = LOOP[k + 1] as { lat: number; lng: number; at: number };
    const f = b.at > a.at ? (s - a.at) / (b.at - a.at) : 0;
    const share = s / length;
    points.push({
      time: new Date(t0 + t * 1000).toISOString(),
      latitude: a.lat + (b.lat - a.lat) * f,
      longitude: a.lng + (b.lng - a.lng) * f,
      altitudeM: Math.round((45 + 7 * Math.sin(4 * Math.PI * share)) * 10) / 10,
      accuracyM: 4,
    });
  }
  return points;
}

/**
 * Sportarten Stufe 1 · Etappe W: Route einer Beispiel-Wanderung (Health Connect 37 „Wandern“) – dieselbe ausgedachte
 * Runde, langsam (Gehtempo), mit einem großen Anstieg und Abstieg von je ca. 650 Hm (800 → 1.450 m → 800 m), damit
 * Auswertung (Abstieg, höchster Punkt, Hinweise) und Bein-Hinweis am Folgetag im Testmodus sichtbar sind.
 */
export function demoHikeRoute(start: string, minutes: number): HcRouteLocation[] {
  const points = demoRoute(start, minutes);
  const last = Math.max(1, points.length - 1);
  return points.map((p, i) => ({
    ...p,
    altitudeM: Math.round((800 + 650 * Math.sin((Math.PI * i) / last)) * 10) / 10,
  }));
}

const at = (day: string, hhmm: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm).toISOString();
};

function heartRateSamples(
  start: string,
  minutes: number,
  base: number,
): { time: string; beatsPerMinute: number }[] {
  const t0 = Date.parse(start);
  return Array.from({ length: minutes * 6 }, (_, i) => ({
    time: new Date(t0 + i * 10_000).toISOString(),
    // Aufwärmen, gleichmäßiger Teil, Endspurt.
    beatsPerMinute: Math.round(
      i < 30 ? base - 30 + i : i > minutes * 6 - 30 ? base + 20 : base + ((i * 7) % 11) - 5,
    ),
  }));
}

/**
 * Schritte der letzten 7 Tage (älteste zuerst, letzter = heute): mal über, mal unter dem Standardziel 8.000 – heute
 * 6.240 (78 %), damit die Kachel „Schritte“ im Testmodus einen halb gefüllten Ring zeigt.
 */
export const DEMO_STEPS = [7400, 9100, 5600, 10_300, 8200, 11_900, 6240] as const;

/** Tage mit Ruhepuls, Schlaf und HRV (Erholung braucht 7–14 Tage Basis). */
export const DEMO_RECOVERY_DAYS = 21;

/**
 * Erholungswerte je Tag (älteste zuerst, letzter = heute): ruhige Wochen mit leichtem Auf und Ab (Ruhepuls 53–56,
 * Schlaf 6:50–7:45, HRV 58–66 ms). Vor zwei Tagen eine kurze Nacht (5:40 → „mittel“). Heute: 5:10 Schlaf, Ruhepuls
 * 62, HRV 46 → drei auffällige Werte → „niedrig“ (Angebot „Leichter trainieren“ im Testmodus sichtbar).
 */
export function demoRecoveryDay(index: number): {
  restingHr: number;
  sleepMin: number;
  hrvMs: number;
} {
  const last = DEMO_RECOVERY_DAYS - 1;
  if (index === last) return { restingHr: 62, sleepMin: 310, hrvMs: 46 };
  if (index === last - 2) return { restingHr: 55, sleepMin: 340, hrvMs: 60 };
  return {
    restingHr: 53 + (index % 4),
    sleepMin: 410 + ((index * 17) % 56),
    hrvMs: 58 + ((index * 5) % 9),
  };
}

/** Beispieldaten für den Zeitraum bis `today` (lokales Datum). */
export function demoRead(today: string, from: string, to: string): HcReadResult {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
  const inWindow = (iso: string) => iso >= from && iso <= to;
  const sessions: HcReadResult['sessions'][number][] = [];
  days.forEach((day, i) => {
    if (i % 2 === 0 && i < 6) {
      const start = at(day, '07:00');
      const end = at(day, '07:35');
      // Ältester Lauf: Health Connect will eine Freigabe je Einheit (Knopf „Route freigeben“).
      const route: HcRouteRead =
        i === 0 ? { kind: 'consent_required' } : { kind: 'points', points: demoRoute(start, 35) };
      sessions.push({
        record: {
          id: `demo-run-${day}`,
          exerciseType: 56,
          startTime: start,
          endTime: end,
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: {
          distanceM: 5200 + i * 150,
          kcal: 380 + i * 5,
          heartRateSamples: heartRateSamples(start, 35, 150),
          route,
          // Lauf-Paket 2: Schritte im Zeitraum → Ø Kadenz ca. 168–172 Schritte/min.
          steps: 5880 + i * 35,
        },
      });
    }
    // Sportarten Stufe 1 · Etappe W: Wanderung vor 5 Tagen (2,5 h, ca. 650 Hm auf und ab) → Gehen mit walk_kind hike.
    // Bewusst an einem Tag ohne andere Einheit der Beispiel-Uhr: die Läufe (i = 0, 2, 4) bleiben allein an ihrem Tag,
    // damit Szenarien wie „Uhr-Lauf zählt für einen anderen Tag“ nicht durch eine zweite Einheit verfälscht werden.
    if (i === 1) {
      const start = at(day, '09:00');
      sessions.push({
        record: {
          id: `demo-hike-${day}`,
          exerciseType: 37,
          startTime: start,
          endTime: at(day, '11:30'),
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: {
          distanceM: 5300,
          kcal: 820,
          route: { kind: 'points', points: demoHikeRoute(start, 150) },
        },
      });
    }
    if (i === 3) {
      sessions.push({
        record: {
          id: `demo-kraft-${day}`,
          exerciseType: 70,
          startTime: at(day, '18:00'),
          endTime: at(day, '18:50'),
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: { kcal: 290, heartRateSamples: heartRateSamples(at(day, '18:00'), 50, 115) },
      });
    }
    if (i === 5) {
      sessions.push({
        record: {
          id: `demo-yoga-${day}`,
          exerciseType: 83,
          startTime: at(day, '19:00'),
          endTime: at(day, '19:30'),
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: { kcal: 110 },
      });
    }
  });
  const recoveryDays = Array.from({ length: DEMO_RECOVERY_DAYS }, (_, i) =>
    addDays(today, -(DEMO_RECOVERY_DAYS - 1) + i),
  );
  return {
    sessions: sessions.filter((s) => inWindow(s.record.startTime)),
    restingHeartRates: recoveryDays
      .map((day, i) => ({ time: at(day, '06:30'), beatsPerMinute: demoRecoveryDay(i).restingHr }))
      .filter((r) => inWindow(r.time)),
    sleepSessions: recoveryDays
      .map((day, i) => {
        // Aufwachen 06:30; Einschlafen so, dass die Schlafdauer passt.
        const end = Date.parse(at(day, '06:30'));
        return {
          startTime: new Date(end - demoRecoveryDay(i).sleepMin * 60_000).toISOString(),
          endTime: new Date(end).toISOString(),
          stages: [],
        };
      })
      .filter((s) => inWindow(s.endTime)),
    steps: days.map((day, i) => ({ day, count: DEMO_STEPS[i] ?? 0 })),
    // HRV: zwei Messungen je Nacht (Median = Tageswert).
    heartRateVariabilities: recoveryDays
      .flatMap((day, i) => [
        { time: at(day, '03:00'), rmssdMs: demoRecoveryDay(i).hrvMs - 1 },
        { time: at(day, '05:00'), rmssdMs: demoRecoveryDay(i).hrvMs + 1 },
      ])
      .filter((h) => inWindow(h.time)),
  };
}

/**
 * Zuletzt im Testmodus erteilte Freigaben („Nur Schritte vom Handy“ = nur `steps`). Nur im Arbeitsspeicher: nach dem
 * Neuladen der Seite gilt wieder „alles erlaubt“ wie bisher.
 */
let demoGranted: readonly WearableDataType[] | null = null;

/**
 * Hintergrund-Recht der Beispiel-Uhr (30.10.2026): nur im Arbeitsspeicher, damit die Karte „Im Hintergrund
 * aktualisieren“ im Browser testbar ist. Eine echte Hintergrund-Aufgabe gibt es im Testmodus nicht.
 */
let demoBackground = false;

/** Nur Tests: Freigaben der Beispiel-Uhr zurücksetzen. */
export function resetDemoGrantsForTests(): void {
  demoGranted = null;
  demoBackground = false;
}

export function createDemoHealthConnectDriver(today: () => string): HealthConnectDriver {
  return {
    kind: 'demo',
    availability: async () => 'available',
    requestPermissions: async (types = WEARABLE_DATA_TYPES): Promise<WearableDataType[]> => {
      demoGranted = WEARABLE_DATA_TYPES.filter((type) => types.includes(type));
      return [...demoGranted];
    },
    // Beispiel-Uhr: nach dem Verbinden ist alles erlaubt (auch nach Neuladen der Seite) – außer „nur Schritte“.
    grantedTypes: async () => [...(demoGranted ?? WEARABLE_DATA_TYPES)],
    read: async (window, granted) => {
      const raw = demoRead(today(), window.from, window.to);
      const has = (type: WearableDataType) => granted.includes(type);
      return {
        sessions: has('exercise') ? raw.sessions : [],
        restingHeartRates: has('resting_heart_rate') ? raw.restingHeartRates : [],
        sleepSessions: has('sleep') ? raw.sleepSessions : [],
        steps: has('steps') ? raw.steps : [],
        heartRateVariabilities: has('hrv') ? raw.heartRateVariabilities : [],
      };
    },
    routeAccess: async () => false,
    backgroundAccess: async () => demoBackground,
    requestBackgroundAccess: async () => {
      demoBackground = true;
      return true;
    },
    // „Route freigeben“ im Testmodus: der Lauf bekommt die Beispiel-Runde.
    requestRoute: async (externalId) => {
      const day = /^demo-run-(\d{4}-\d{2}-\d{2})$/.exec(externalId)?.[1];
      return day ? { kind: 'points', points: demoRoute(at(day, '07:00'), 35) } : { kind: 'none' };
    },
    openSettings: () => undefined,
    openInstall: () => undefined,
  };
}
