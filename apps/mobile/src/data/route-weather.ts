import {
  parseWeatherResponse,
  type RouteWeather,
  routesNeedingWeather,
  type TrackedRouteRow,
  weatherRequest,
} from '@fitnessapp/core';

import type { Backend } from './backend';
import { type KeyValueStore, readJson, STORAGE_KEYS, writeJson } from './kv';

/**
 * Wetter je Lauf (25.10.2026): Das GERÄT fragt Open-Meteo direkt (Web und App, kein eigener Server) – nur mit der auf
 * 0,1° gerundeten Startposition sowie Tag und Stunde (weatherRequest in packages/core). Nur nach Zustimmung im
 * einmaligen Hinweis (Einstellung je Konto auf diesem Gerät). Fehler (offline, Dienst nicht erreichbar) bleiben still;
 * der nächste Durchgang (nächstes Öffnen) versucht es erneut. Nie Koordinaten oder Wetter in Logs.
 */

type Stored = Record<string, boolean>;

/** Zustimmung lesen: true/false, null = noch nicht gefragt. */
export async function readWeatherSetting(
  store: KeyValueStore,
  userId: string,
): Promise<boolean | null> {
  const raw = await readJson<Stored>(store, STORAGE_KEYS.routeWeather).catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw[userId];
  return typeof value === 'boolean' ? value : null;
}

/** Zustimmung speichern (andere Konten auf diesem Gerät bleiben). */
export async function writeWeatherSetting(
  store: KeyValueStore,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const raw = await readJson<Stored>(store, STORAGE_KEYS.routeWeather).catch(() => null);
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  await writeJson(store, STORAGE_KEYS.routeWeather, { ...base, [userId]: enabled });
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** Wetter für einen Lauf holen; null bei Fehler oder ohne Daten (still). */
export async function fetchRouteWeather(
  route: Pick<TrackedRouteRow, 'started_at' | 'polyline'>,
  now: string,
  fetchFn: FetchLike,
): Promise<RouteWeather | null> {
  const request = weatherRequest(route, now);
  if (!request) return null;
  try {
    const response = await fetchFn(request.url);
    if (!response.ok) return null;
    return parseWeatherResponse(await response.json(), request);
  } catch {
    return null;
  }
}

const tried = new Set<string>();

/**
 * Ein Durchgang: fehlendes Wetter der neuesten Läufe holen und speichern (set_route_weather) → Anzahl gespeicherter.
 * Jeder Lauf höchstens einmal je Sitzung (bei Fehlern: nächster App-Start).
 */
export async function applyWeatherPass(
  backend: Pick<Backend, 'setRouteWeather'>,
  userId: string,
  routes: readonly TrackedRouteRow[],
  now: string,
  fetchFn: FetchLike,
): Promise<number> {
  let saved = 0;
  for (const route of routesNeedingWeather(userId, routes, now, tried)) {
    tried.add(route.id);
    const weather = await fetchRouteWeather(route, now, fetchFn);
    if (!weather) continue;
    try {
      await backend.setRouteWeather(route.id, weather);
      saved += 1;
    } catch {
      // still – nächster App-Start
    }
  }
  return saved;
}

/** Nur für Tests. */
export function resetWeatherPass(): void {
  tried.clear();
}
