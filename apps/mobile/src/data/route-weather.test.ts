import { encodePolyline } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from './kv';
import {
  applyWeatherPass,
  fetchRouteWeather,
  readWeatherSetting,
  resetWeatherPass,
  writeWeatherSetting,
} from './route-weather';

const polyline = encodePolyline([
  { lat: 50.93654, lng: 6.93981 },
  { lat: 50.94, lng: 6.95 },
]);
const NOW = '2026-10-25T09:00:00.000Z';
const ok = (json: unknown) => async () => ({ ok: true, json: async () => json });
const response = {
  hourly: {
    time: ['2026-10-24T16:00'],
    temperature_2m: [12.4],
    weather_code: [61],
    wind_speed_10m: [18.2],
  },
};

describe('Einstellung je Konto', () => {
  it('nicht gefragt = null; speichern behält andere Konten', async () => {
    const store = createMemoryStore();
    expect(STORAGE_KEYS.routeWeather).toBe('fitnessapp.route-weather.v1');
    expect(await readWeatherSetting(store, 'a')).toBeNull();
    await writeWeatherSetting(store, 'a', true);
    await writeWeatherSetting(store, 'b', false);
    expect(await readWeatherSetting(store, 'a')).toBe(true);
    expect(await readWeatherSetting(store, 'b')).toBe(false);
  });
});

describe('fetchRouteWeather', () => {
  it('ruft nur die gerundete Position ab und liest die Stunde', async () => {
    const urls: string[] = [];
    const w = await fetchRouteWeather(
      { started_at: '2026-10-24T16:05:00Z', polyline },
      NOW,
      async (url) => {
        urls.push(url);
        return { ok: true, json: async () => response };
      },
    );
    expect(w).toMatchObject({ temp_c: 12.4, code: 61, wind_kmh: 18.2 });
    expect(urls[0]).toContain('latitude=50.9&longitude=6.9');
  });

  it('Fehler, HTTP-Fehler, kaputte Antwort → null (still)', async () => {
    const r = { started_at: '2026-10-24T16:05:00Z', polyline };
    expect(
      await fetchRouteWeather(r, NOW, async () => Promise.reject(new Error('offline'))),
    ).toBeNull();
    expect(
      await fetchRouteWeather(r, NOW, async () => ({ ok: false, json: async () => ({}) })),
    ).toBeNull();
    expect(await fetchRouteWeather(r, NOW, ok({ nope: 1 }))).toBeNull();
  });
});

describe('applyWeatherPass', () => {
  it('speichert fehlendes Wetter, je Lauf einmal je Sitzung', async () => {
    resetWeatherPass();
    const saved: string[] = [];
    const backend = {
      setRouteWeather: async (id: string) => {
        saved.push(id);
      },
    };
    const routes = [
      { id: 'r1', user_id: 'me', started_at: '2026-10-24T16:05:00Z', polyline, weather: null },
      { id: 'r2', user_id: 'other', started_at: '2026-10-24T16:05:00Z', polyline, weather: null },
    ] as unknown as Parameters<typeof applyWeatherPass>[2];
    expect(await applyWeatherPass(backend, 'me', routes, NOW, ok(response))).toBe(1);
    expect(await applyWeatherPass(backend, 'me', routes, NOW, ok(response))).toBe(0);
    expect(saved).toEqual(['r1']);
  });
});
