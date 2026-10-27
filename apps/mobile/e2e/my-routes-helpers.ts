import { boundingBox, encodePolyline, type TrackedRouteRow } from '@fitnessapp/core';
import type { Page } from '@playwright/test';

/**
 * Demo-Daten „Meine Strecken“ (E2E und Bildschirmfotos, 25.10.2026): erfundene Läufe um einen öffentlichen Ort
 * (Stadtpark Köln-Mitte) – keine echten Nutzerdaten. Werden nach dem Onboarding direkt in den Testmodus-Speicher
 * geschrieben (Zeilen wie tracked_routes).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const ORIGIN = { lat: 50.9365, lng: 6.9398 };
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;

function offset(north: number, east: number, origin = ORIGIN) {
  return {
    lat: origin.lat + north / M_PER_DEG,
    lng: origin.lng + east / (M_PER_DEG * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

/** Rundkurs (Ellipse, ca. 5,2 km) – `shiftM` verschiebt die Linie (GPS-Abweichung), `reverse` andersherum. */
function park(shiftM = 0, wobble = 0) {
  const pts = [];
  for (let i = 0; i <= 160; i += 1) {
    const a = (i / 160) * Math.PI * 2;
    const w = wobble ? Math.sin(i * 1.7) * wobble : 0;
    pts.push(offset(Math.sin(a) * 650 + shiftM + w, (1 - Math.cos(a)) * 1000 + w));
  }
  return pts;
}

function riverside() {
  const pts = [];
  for (let i = 0; i <= 52; i += 1) pts.push(offset(i * 100, i * 20, { lat: 50.93, lng: 6.97 }));
  for (let i = 52; i >= 0; i -= 1)
    pts.push(offset(i * 100 + 15, i * 20 + 15, { lat: 50.93, lng: 6.97 }));
  return pts;
}

function commute() {
  const pts = [];
  for (let i = 0; i <= 8; i += 1) {
    pts.push(offset(i * 500, Math.floor(i / 2) * 400, { lat: 50.95, lng: 6.9 }));
    pts.push(offset(i * 500, Math.floor(i / 2) * 400 + 200, { lat: 50.95, lng: 6.9 }));
  }
  return pts;
}

function elsewhere() {
  const pts = [];
  for (let i = 0; i <= 70; i += 1)
    pts.push(offset(i * 50, Math.sin(i / 5) * 300, { lat: 50.98, lng: 7.02 }));
  return pts;
}

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

function route(
  userId: string,
  pts: { lat: number; lng: number }[],
  o: {
    id?: string;
    name: string;
    sport?: TrackedRouteRow['sport'];
    startedAt: string;
    distanceM: number;
    movingS: number;
    splits?: number[];
    favorite?: boolean;
    base?: string | null;
    match?: TrackedRouteRow['route_match'];
    source?: TrackedRouteRow['source'];
    elevation?: number | null;
    weather?: TrackedRouteRow['weather'];
  },
): TrackedRouteRow {
  const km = Math.floor(o.distanceM / 1000);
  const even = Math.floor(o.movingS / (o.distanceM / 1000));
  const splits = o.splits ?? Array.from({ length: km }, () => even);
  return {
    id: o.id ?? uuid(),
    user_id: userId,
    name: o.name,
    sport: o.sport ?? 'run',
    started_at: o.startedAt,
    duration_s: o.movingS + 30,
    moving_s: o.movingS,
    distance_m: o.distanceM,
    elevation_gain_m: o.elevation ?? 38,
    polyline: encodePolyline(pts),
    point_count: pts.length,
    bbox: [...(boundingBox(pts) ?? [0, 0, 0, 0])],
    km_splits: splits,
    difficulty: null,
    is_favorite: o.favorite ?? false,
    base_route_id: o.base ?? null,
    note: null,
    session_log_id: null,
    source: o.source ?? 'recorded',
    elevation_profile: null,
    wearable_session_log_id: o.source === 'watch' ? uuid() : null,
    e_bike: false,
    route_match: o.match ?? (o.base ? 'repeat' : null),
    match_rejected_ids: [],
    auto_match: true,
    weather: o.weather ?? null,
    walk_kind: null,
    elevation_loss_m: null,
    max_altitude_m: null,
    sac_grade: null,
    created_at: o.startedAt,
    updated_at: o.startedAt,
  };
}

export const DEMO_IDS = {
  park: '00000000-0000-4000-8000-0000000000a1',
  river: '00000000-0000-4000-8000-0000000000a2',
  commute: '00000000-0000-4000-8000-0000000000a3',
  watchRun: '00000000-0000-4000-8000-0000000000b1',
  openRun: '00000000-0000-4000-8000-0000000000b2',
  otherRun: '00000000-0000-4000-8000-0000000000b3',
  previous: '00000000-0000-4000-8000-0000000000b4',
} as const;

/** Demo-Läufe für das angemeldete Konto des Testmodus. */
export function demoRoutes(userId: string): TrackedRouteRow[] {
  seq = 100;
  const P = DEMO_IDS.park;
  const ids = DEMO_IDS;
  return [
    route(userId, park(), {
      id: P,
      name: 'Hausrunde Stadtpark',
      favorite: true,
      startedAt: '2026-08-30T06:10:00Z',
      distanceM: 5200,
      movingS: 1842,
      splits: [354, 352, 356, 354, 354],
    }),
    route(userId, park(8, 4), {
      name: 'Lauf',
      base: P,
      startedAt: '2026-09-13T06:10:00Z',
      distanceM: 5180,
      movingS: 1805,
      splits: [348, 346, 350, 345, 347],
    }),
    route(userId, park(-6, 5), {
      name: 'Lauf',
      base: P,
      match: 'confirmed',
      startedAt: '2026-09-27T06:10:00Z',
      distanceM: 5210,
      movingS: 1771,
      splits: [342, 340, 343, 338, 341],
    }),
    route(userId, park(5, 6), {
      name: 'Lauf',
      base: P,
      match: 'confirmed',
      source: 'watch',
      startedAt: '2026-10-05T06:10:00Z',
      distanceM: 5190,
      movingS: 1810,
      weather: {
        hour: '2026-10-05T06:00:00Z',
        temp_c: 9.2,
        feels_c: 5.8,
        wind_kmh: 24.5,
        precip_mm: 1.2,
        humidity_pct: 91,
        code: 63,
        source: 'archive',
      },
      splits: [350, 349, 351, 348, 350],
    }),
    route(userId, park().slice(0, 120), {
      name: 'Lauf',
      base: P,
      match: 'confirmed',
      source: 'watch',
      startedAt: '2026-10-10T06:10:00Z',
      distanceM: 3900,
      movingS: 1300,
    }),
    route(userId, park(3, 3), {
      id: ids.previous,
      name: 'Lauf',
      base: P,
      startedAt: '2026-10-17T06:10:00Z',
      distanceM: 5200,
      movingS: 1757,
      weather: {
        hour: '2026-10-17T06:00:00Z',
        temp_c: 11.4,
        feels_c: 10.2,
        wind_kmh: 8.3,
        precip_mm: 0,
        humidity_pct: 76,
        code: 2,
        source: 'archive',
      },
      splits: [330, 342, 348, 335, 339],
    }),
    // Neuer Uhr-Lauf, automatisch erkannt (noch ohne Antwort).
    route(userId, park(4, 5), {
      id: ids.watchRun,
      name: 'Lauf',
      base: P,
      match: 'auto',
      source: 'watch',
      startedAt: '2026-10-24T16:12:00Z',
      distanceM: 5200,
      movingS: 1685,
      splits: [318, 322, 352, 312, 319],
    }),
    route(userId, riverside(), {
      id: ids.river,
      name: 'Mainufer hin und zurück',
      favorite: true,
      startedAt: '2026-09-20T07:00:00Z',
      distanceM: 10_400,
      movingS: 3540,
    }),
    route(userId, riverside(), {
      name: 'Lauf',
      base: ids.river,
      match: 'confirmed',
      startedAt: '2026-10-11T07:00:00Z',
      distanceM: 10_420,
      movingS: 3520,
    }),
    route(userId, commute(), {
      id: ids.commute,
      name: 'Arbeitsweg',
      sport: 'bike',
      favorite: true,
      startedAt: '2026-10-23T06:30:00Z',
      distanceM: 7800,
      movingS: 1452,
    }),
    // Neue App-Aufzeichnung auf der Hausrunde ohne „Erneut laufen“ – die Erkennung auf dem Gerät ordnet sie zu.
    route(userId, park(-4, 4), {
      id: ids.openRun,
      name: 'Morgenlauf',
      startedAt: '2026-09-06T05:50:00Z',
      distanceM: 5230,
      movingS: 1830,
    }),
    // Lauf woanders – passt zu keiner Strecke.
    route(userId, elsewhere(), {
      id: ids.otherRun,
      name: 'Lauf',
      source: 'watch',
      startedAt: '2026-10-21T17:00:00Z',
      distanceM: 7100,
      movingS: 2490,
    }),
  ];
}

/** Demo-Läufe in den Testmodus-Speicher schreiben (nach dem Onboarding). */
export async function seedDemoRoutes(page: Page): Promise<string> {
  const userId = await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      session?: { userId: string };
    };
    return db.session?.userId ?? '';
  }, LOCAL_DB);
  const routes = demoRoutes(userId);
  await page.evaluate(
    ({ key, rows }) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      db.trackedRoutes = rows;
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    { key: LOCAL_DB, rows: routes },
  );
  return userId;
}

/** Gespeicherte Strecken lesen (Prüfungen). */
export async function storedRoutes(page: Page): Promise<TrackedRouteRow[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (JSON.parse(raw ?? '{}') as { trackedRoutes?: TrackedRouteRow[] }).trackedRoutes ?? [];
}
