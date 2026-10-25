import { z } from 'zod';

import { ROUTE_WEATHER } from '../constants';
import { decodePolyline } from './polyline';

/**
 * Wetter je Lauf (Gründer-Wunsch 25.10.2026): Abruf bei Open-Meteo zum Startzeitpunkt, gespeichert in
 * tracked_routes.weather (set_route_weather). Datenschutz: nur die auf ROUTE_WEATHER.roundDeg gerundete Startposition,
 * Tag und Stunde verlassen das Gerät – nie die Strecke. Kein Gesundheitsdatum, nie in Logs. Fehler → null (die App
 * zeigt „Wetter nicht verfügbar“ bzw. nichts).
 */

const W = ROUTE_WEATHER;
const num = (r: { min: number; max: number }) => z.number().finite().min(r.min).max(r.max);

/** Gespeichertes Wetter (Spalte weather, CHECK private.route_weather_valid). */
export const routeWeatherSchema = z.strictObject({
  /** Stunde (UTC, ISO „JJJJ-MM-TTTHH:00:00Z“), auf die sich die Werte beziehen. */
  hour: z.iso.datetime(),
  temp_c: num(W.tempC),
  feels_c: num(W.tempC).nullable(),
  wind_kmh: num(W.windKmh).nullable(),
  precip_mm: num(W.precipMm).nullable(),
  humidity_pct: num(W.humidityPct).nullable(),
  code: z.number().int().min(W.code.min).max(W.code.max).nullable(),
  source: z.enum(['forecast', 'archive']),
});

export type RouteWeather = z.infer<typeof routeWeatherSchema>;

export interface WeatherRequest {
  readonly url: string;
  /** Stunde (UTC, ISO), deren Werte gelesen werden. */
  readonly hour: string;
  readonly source: 'forecast' | 'archive';
  /** Gerundete Position (zur Prüfung in Tests – das ist alles, was Open-Meteo erfährt). */
  readonly lat: number;
  readonly lng: number;
}

const round = (x: number) => Math.round(x / W.roundDeg) * W.roundDeg;
const fix = (x: number) => Number(x.toFixed(1));

/**
 * Abruf für einen Lauf bauen: Startpunkt = erster Punkt der Linie, gerundet; Stunde = Beginn gerundet auf die volle
 * Stunde (UTC). Bis forecastMaxAgeDays Tage zurück die Forecast-API, sonst das Archiv. null ohne Linie, mit Beginn in
 * der Zukunft oder ungültigem Datum.
 */
export function weatherRequest(
  route: { started_at: string; polyline: string },
  now: string,
): WeatherRequest | null {
  const start = decodePolyline(route.polyline)?.[0];
  const t = Date.parse(route.started_at);
  const n = Date.parse(now);
  if (!start || !Number.isFinite(t) || !Number.isFinite(n) || t > n) return null;
  const hourMs = Math.round(t / 3_600_000) * 3_600_000;
  const hour = new Date(hourMs).toISOString().replace('.000Z', 'Z');
  const day = hour.slice(0, 10);
  const lat = fix(round(start.lat));
  const lng = fix(round(start.lng));
  const ageDays = (n - t) / 86_400_000;
  const source = ageDays <= W.forecastMaxAgeDays ? 'forecast' : 'archive';
  const params = [
    `latitude=${lat}`,
    `longitude=${lng}`,
    'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    `start_date=${day}`,
    `end_date=${day}`,
    'timezone=UTC',
    'wind_speed_unit=kmh',
  ].join('&');
  return {
    url: `${source === 'forecast' ? W.forecastUrl : W.archiveUrl}?${params}`,
    hour,
    source,
    lat,
    lng,
  };
}

const responseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    apparent_temperature: z.array(z.number().nullable()).optional(),
    relative_humidity_2m: z.array(z.number().nullable()).optional(),
    precipitation: z.array(z.number().nullable()).optional(),
    weather_code: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()).optional(),
  }),
});

/** Antwort von Open-Meteo lesen (Werte der Stunde des Abrufs); ungültig oder ohne Temperatur → null. */
export function parseWeatherResponse(
  json: unknown,
  request: Pick<WeatherRequest, 'hour' | 'source'>,
): RouteWeather | null {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return null;
  const h = parsed.data.hourly;
  const key = request.hour.slice(0, 13); // „JJJJ-MM-TTTHH“
  const i = h.time.findIndex((x) => x.slice(0, 13) === key);
  if (i < 0) return null;
  const at = (arr: (number | null)[] | undefined) => {
    const v = arr?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const temp = at(h.temperature_2m);
  if (temp === null) return null;
  const code = at(h.weather_code);
  const candidate = {
    hour: request.hour,
    temp_c: fix(temp),
    feels_c: at(h.apparent_temperature) === null ? null : fix(at(h.apparent_temperature) as number),
    wind_kmh: at(h.wind_speed_10m) === null ? null : fix(at(h.wind_speed_10m) as number),
    precip_mm: at(h.precipitation) === null ? null : fix(at(h.precipitation) as number),
    humidity_pct:
      at(h.relative_humidity_2m) === null ? null : Math.round(at(h.relative_humidity_2m) as number),
    code: code === null ? null : Math.round(code),
    source: request.source,
  };
  const valid = routeWeatherSchema.safeParse(candidate);
  return valid.success ? valid.data : null;
}

/** WMO-Wettercode (Tabelle 4677, Auswahl Open-Meteo) → kurzer deutscher Text und Symbol. */
export function weatherCodeText(code: number | null): { text: string; icon: string } | null {
  if (code === null) return null;
  const T: [readonly number[], string, string][] = [
    [[0], 'klar', '☀️'],
    [[1], 'überwiegend klar', '🌤️'],
    [[2], 'teilweise bewölkt', '⛅'],
    [[3], 'bedeckt', '☁️'],
    [[45, 48], 'Nebel', '🌫️'],
    [[51], 'leichter Nieselregen', '🌦️'],
    [[53], 'Nieselregen', '🌦️'],
    [[55], 'starker Nieselregen', '🌧️'],
    [[56, 57], 'gefrierender Nieselregen', '🌧️'],
    [[61], 'leichter Regen', '🌦️'],
    [[63], 'Regen', '🌧️'],
    [[65], 'starker Regen', '🌧️'],
    [[66, 67], 'gefrierender Regen', '🌧️'],
    [[71], 'leichter Schneefall', '🌨️'],
    [[73], 'Schneefall', '🌨️'],
    [[75], 'starker Schneefall', '🌨️'],
    [[77], 'Schneegriesel', '🌨️'],
    [[80], 'leichte Regenschauer', '🌦️'],
    [[81], 'Regenschauer', '🌧️'],
    [[82], 'heftige Regenschauer', '🌧️'],
    [[85, 86], 'Schneeschauer', '🌨️'],
    [[95], 'Gewitter', '⛈️'],
    [[96, 99], 'Gewitter mit Hagel', '⛈️'],
  ];
  const hit = T.find(([codes]) => codes.includes(code));
  return hit ? { text: hit[1], icon: hit[2] } : null;
}

const de = (x: number) => String(Math.round(x));

/** Kurze Zeile „12 °C · Wind 18 km/h · leichter Regen“ (fehlende Werte fallen weg). */
export function weatherLine(w: RouteWeather): string {
  const parts = [`${de(w.temp_c)} °C`];
  if (w.wind_kmh !== null) parts.push(`Wind ${de(w.wind_kmh)} km/h`);
  const c = weatherCodeText(w.code);
  if (c) parts.push(c.text);
  return parts.join(' · ');
}

/** Ausführliche Angaben für die Seite des Laufs (gefühlt, Luftfeuchte, Niederschlag). */
export function weatherDetails(w: RouteWeather): string[] {
  const out: string[] = [];
  if (w.feels_c !== null) out.push(`gefühlt ${de(w.feels_c)} °C`);
  if (w.humidity_pct !== null) out.push(`Luftfeuchte ${w.humidity_pct} %`);
  if (w.precip_mm !== null) {
    out.push(`Niederschlag ${String(w.precip_mm).replace('.', ',')} mm`);
  }
  return out;
}

/**
 * Läufe, deren Wetter noch fehlt (neueste zuerst, höchstens ROUTE_WEATHER.maxPerPass): eigene Strecken ohne
 * `weather`, nicht in der Zukunft, ausgenommen `skip` (in dieser Sitzung schon versucht).
 */
export function routesNeedingWeather<
  T extends { id: string; user_id: string; started_at: string; weather?: RouteWeather | null },
>(userId: string, routes: readonly T[], now: string, skip: ReadonlySet<string> = new Set()): T[] {
  const n = Date.parse(now);
  return routes
    .filter(
      (r) =>
        r.user_id === userId &&
        (r.weather ?? null) === null &&
        !skip.has(r.id) &&
        Date.parse(r.started_at) <= n,
    )
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .slice(0, W.maxPerPass);
}
