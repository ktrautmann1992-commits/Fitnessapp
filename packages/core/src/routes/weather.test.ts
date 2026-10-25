import { describe, expect, it } from 'vitest';

import { ROUTE_WEATHER } from '../constants';
import { encodePolyline } from './polyline';
import {
  parseWeatherResponse,
  routesNeedingWeather,
  routeWeatherSchema,
  weatherCodeText,
  weatherDetails,
  weatherLine,
  weatherRequest,
} from './weather';

const poly = encodePolyline([
  { lat: 50.93654, lng: 6.93981 },
  { lat: 50.94, lng: 6.95 },
]);

describe('weatherRequest (Datenschutz: nur gerundete Startposition, Tag, Stunde)', () => {
  it('Forecast für die letzten Tage, Position auf 0,1° gerundet, Stunde gerundet', () => {
    const r = weatherRequest(
      { started_at: '2026-10-24T16:12:00Z', polyline: poly },
      '2026-10-25T09:00:00Z',
    );
    expect(r).toMatchObject({
      source: 'forecast',
      lat: 50.9,
      lng: 6.9,
      hour: '2026-10-24T16:00:00Z',
    });
    expect(r?.url.startsWith(`${ROUTE_WEATHER.forecastUrl}?`)).toBe(true);
    expect(r?.url).toContain('latitude=50.9&longitude=6.9');
    expect(r?.url).toContain('start_date=2026-10-24&end_date=2026-10-24');
    // Keine genauen Koordinaten und keine zweite Position in der Adresse.
    expect(r?.url).not.toContain('50.93');
    expect(r?.url).not.toContain('6.95');
  });

  it('älter als 5 Tage → Archiv; 16:40 → 17 Uhr', () => {
    const r = weatherRequest(
      { started_at: '2026-10-10T16:40:00Z', polyline: poly },
      '2026-10-25T09:00:00Z',
    );
    expect(r?.source).toBe('archive');
    expect(r?.url.startsWith(ROUTE_WEATHER.archiveUrl)).toBe(true);
    expect(r?.hour).toBe('2026-10-10T17:00:00Z');
  });

  it('Grenzfälle: ohne Linie, Zukunft, ungültiges Datum → null; Südhalbkugel/West gerundet', () => {
    expect(
      weatherRequest({ started_at: '2026-10-24T16:00:00Z', polyline: '' }, '2026-10-25T00:00:00Z'),
    ).toBeNull();
    expect(
      weatherRequest(
        { started_at: '2026-10-26T16:00:00Z', polyline: poly },
        '2026-10-25T00:00:00Z',
      ),
    ).toBeNull();
    expect(
      weatherRequest({ started_at: 'kaputt', polyline: poly }, '2026-10-25T00:00:00Z'),
    ).toBeNull();
    const south = encodePolyline([
      { lat: -33.8688, lng: -151.2093 },
      { lat: -33.87, lng: -151.21 },
    ]);
    expect(
      weatherRequest(
        { started_at: '2026-10-24T16:00:00Z', polyline: south },
        '2026-10-25T00:00:00Z',
      ),
    ).toMatchObject({ lat: -33.9, lng: -151.2 });
  });
});

const response = {
  hourly: {
    time: ['2026-10-24T15:00', '2026-10-24T16:00', '2026-10-24T17:00'],
    temperature_2m: [12.9, 12.4, 11.8],
    apparent_temperature: [10.1, 9.36, 9],
    relative_humidity_2m: [80, 84.4, 88],
    precipitation: [0, 0.3, 0.1],
    weather_code: [3, 61, 61],
    wind_speed_10m: [15, 18.2, 20],
  },
};

describe('parseWeatherResponse', () => {
  it('liest die Werte der Stunde', () => {
    const w = parseWeatherResponse(response, { hour: '2026-10-24T16:00:00Z', source: 'forecast' });
    expect(w).toEqual({
      hour: '2026-10-24T16:00:00Z',
      temp_c: 12.4,
      feels_c: 9.4,
      wind_kmh: 18.2,
      precip_mm: 0.3,
      humidity_pct: 84,
      code: 61,
      source: 'forecast',
    });
    expect(routeWeatherSchema.safeParse(w).success).toBe(true);
  });

  it('fehlende Stunde, kaputte Antwort, fehlende Temperatur, Werte außerhalb → null; fehlende Nebenwerte → null-Felder', () => {
    const req = { hour: '2026-10-24T20:00:00Z', source: 'forecast' as const };
    expect(parseWeatherResponse(response, req)).toBeNull();
    expect(parseWeatherResponse({ error: true }, req)).toBeNull();
    expect(parseWeatherResponse(null, req)).toBeNull();
    const at16 = { hour: '2026-10-24T16:00:00Z', source: 'archive' as const };
    expect(
      parseWeatherResponse({ hourly: { ...response.hourly, temperature_2m: [1, null, 1] } }, at16),
    ).toBeNull();
    expect(
      parseWeatherResponse({ hourly: { ...response.hourly, temperature_2m: [1, 99, 1] } }, at16),
    ).toBeNull();
    const minimal = parseWeatherResponse(
      { hourly: { time: response.hourly.time, temperature_2m: [1, -2.25, 3] } },
      at16,
    );
    expect(minimal).toMatchObject({ temp_c: -2.3, feels_c: null, wind_kmh: null, code: null });
  });
});

describe('Texte', () => {
  it('Zeile „12 °C · Wind 18 km/h · leichter Regen“ und Details', () => {
    const w = parseWeatherResponse(response, { hour: '2026-10-24T16:00:00Z', source: 'forecast' });
    expect(w && weatherLine(w)).toBe('12 °C · Wind 18 km/h · leichter Regen');
    expect(w && weatherDetails(w)).toEqual([
      'gefühlt 9 °C',
      'Luftfeuchte 84 %',
      'Niederschlag 0,3 mm',
    ]);
  });

  it('Wettercodes: alle WMO-Codes von Open-Meteo haben einen Text, unbekannt → null', () => {
    for (const c of [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
      86, 95, 96, 99,
    ]) {
      expect(weatherCodeText(c)?.text, String(c)).toBeTruthy();
    }
    expect(weatherCodeText(4)).toBeNull();
    expect(weatherCodeText(null)).toBeNull();
  });
});

describe('routesNeedingWeather', () => {
  it('eigene ohne Wetter, nicht Zukunft, nicht schon versucht, neueste zuerst, höchstens maxPerPass', () => {
    const base = { user_id: 'me', weather: null };
    const routes = [
      { ...base, id: 'a', started_at: '2026-10-20T07:00:00Z' },
      { ...base, id: 'b', started_at: '2026-10-24T07:00:00Z' },
      { ...base, id: 'c', started_at: '2026-10-30T07:00:00Z' },
      { ...base, id: 'd', started_at: '2026-10-22T07:00:00Z', user_id: 'other' },
      { ...base, id: 'e', started_at: '2026-10-21T07:00:00Z' },
    ];
    expect(
      routesNeedingWeather('me', routes, '2026-10-25T00:00:00Z', new Set(['e'])).map((r) => r.id),
    ).toEqual(['b', 'a']);
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...base,
      id: `x${i}`,
      started_at: '2026-10-01T07:00:00Z',
    }));
    expect(routesNeedingWeather('me', many, '2026-10-25T00:00:00Z')).toHaveLength(
      ROUTE_WEATHER.maxPerPass,
    );
  });
});
