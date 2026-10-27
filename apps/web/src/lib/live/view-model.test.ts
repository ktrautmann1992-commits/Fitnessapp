import { readFileSync } from 'node:fs';

import { liveViewSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { demoLiveView, demoPoint } from './demo';
import * as map from './map';
import { LIVE_TEXTS, liveScreen } from './view-model';

const T0 = Date.parse('2026-10-27T17:00:00Z'); // 18:00 in Berlin
const base = {
  display_name: 'Karsten',
  sport: 'run' as const,
  started_at: '2026-10-27T17:00:00+00:00',
  server_time: '2026-10-27T17:25:00+00:00',
};
const position = {
  lat: 50.94133,
  lon: 6.95828,
  accuracy_m: 8,
  recorded_at: '2026-10-27T17:24:40+00:00',
};

describe('liveScreen', () => {
  it('aktiv: Name, Sportart, seit, zuletzt aktualisiert, Karte', () => {
    const s = liveScreen({ state: 'active', ...base, position }, T0 + 25 * 60_000);
    expect(s.kind).toBe('open');
    expect(s.heading).toBe('Karsten ist unterwegs');
    expect(s.sport).toBe('Laufen');
    expect(s.since).toBe('läuft seit 25 Min (Start 18:00)');
    expect(s.updated).toBe('zuletzt aktualisiert vor 20 s');
    expect(s.staleness).toBe('fresh');
    expect(s.warning).toBeNull();
    expect(s.position).toEqual({ lat: 50.94133, lon: 6.95828, accuracyM: 8 });
    expect(s.mapUrl).toContain('openstreetmap.org/?mlat=50.94133&mlon=6.95828');
  });

  it('alte Position (ab 3 min): Warnung', () => {
    const s = liveScreen({ state: 'active', ...base, position }, T0 + 29 * 60_000);
    expect(s.staleness).toBe('stale');
    expect(s.warning).toBe('Seit 4 Min keine neue Position – evtl. Funkloch oder Akku leer.');
  });

  it('noch keine Position: Hinweis, keine Karte', () => {
    const s = liveScreen({ state: 'active', ...base, position: null }, T0);
    expect(s.position).toBeNull();
    expect(s.warning).toBe(LIVE_TEXTS.noPosition);
    expect(s.updated).toBeNull();
  });

  it('pausiert', () => {
    const s = liveScreen({ state: 'paused', ...base, sport: 'bike', position }, T0 + 25 * 60_000);
    expect(s.heading).toBe('Karsten macht gerade Pause');
    expect(s.paused).toBe(true);
    expect(s.sport).toBe('Rad');
  });

  it('angekommen/beendet: Uhrzeit, OHNE Karte', () => {
    const arrived = liveScreen(
      { state: 'arrived', ...base, ended_at: '2026-10-27T18:32:00+00:00' },
      T0 + 2 * 3_600_000,
    );
    expect(arrived.kind).toBe('closed');
    expect(arrived.heading).toBe('Karsten ist angekommen (19:32)');
    expect(arrived.position).toBeNull();
    expect(arrived.mapUrl).toBeNull();
    const ended = liveScreen({ state: 'ended', ...base, ended_at: base.server_time }, T0);
    expect(ended.heading).toBe('Karsten hat die Live-Begleitung beendet (18:25)');
  });

  it('ungültig/abgelaufen: eine einzige Meldung ohne Ort', () => {
    const s = liveScreen({ state: 'invalid' }, T0);
    expect(s.kind).toBe('gone');
    expect(s.heading).toBe('Diese Live-Begleitung ist beendet.');
    expect(s.position).toBeNull();
  });

  it('lädt, gebremst, Fehler, nicht eingerichtet', () => {
    expect(liveScreen(null, T0).kind).toBe('loading');
    expect(liveScreen({ state: 'rate_limited' }, T0).kind).toBe('rate_limited');
    expect(liveScreen({ state: 'error' }, T0).kind).toBe('error');
    expect(liveScreen({ state: 'unavailable' }, T0).kind).toBe('unavailable');
  });

  it('Hinweis 112 / 144 / 140 und „kein Notruf-Ersatz“', () => {
    expect(LIVE_TEXTS.emergency).toMatch(/112.*144.*140/);
    expect(LIVE_TEXTS.notEmergencyService).toContain('kein Notruf-Ersatz');
  });
});

describe('Demo', () => {
  it('gültige Ansicht, bewegt sich, ausgedachter Name', () => {
    const a = demoLiveView(T0, T0 + 10 * 60_000);
    const b = demoLiveView(T0, T0 + 11 * 60_000);
    expect(liveViewSchema.safeParse(a).success).toBe(true);
    expect(
      a.state === 'active' && b.state === 'active' && a.position?.lat !== b.position?.lat,
    ).toBe(true);
    expect(a.state === 'active' && a.display_name).toContain('Demo');
  });

  it('Punkt bleibt auf der Runde (auch nach vielen Runden)', () => {
    for (const m of [0, 1000, 4400, 123_456]) {
      const p = demoPoint(m);
      expect(p.lat).toBeGreaterThan(50.94);
      expect(p.lat).toBeLessThan(50.956);
      expect(p.lon).toBeGreaterThan(6.957);
      expect(p.lon).toBeLessThan(6.975);
    }
  });
});

describe('Karte = Karten-Lösung der App', () => {
  it('gleiche Version, Prüfsummen und Kacheln wie apps/mobile/src/lib/route-map-html.ts', () => {
    const mobile = readFileSync(
      new URL('../../../../mobile/src/lib/route-map-html.ts', import.meta.url),
      'utf8',
    );
    expect(mobile).toContain(`MAPLIBRE_VERSION = '${map.MAPLIBRE_VERSION}'`);
    expect(mobile).toContain(`'${map.MAPLIBRE_JS_SRI}'`);
    expect(mobile).toContain(`'${map.MAPLIBRE_CSS_SRI}'`);
    expect(mobile).toContain(`OPENFREEMAP_STYLE = '${map.OPENFREEMAP_STYLE}'`);
    expect(mobile).toContain(`MAP_ATTRIBUTION = '${map.MAP_ATTRIBUTION}'`);
  });

  it('Genauigkeitskreis: geschlossen, Radius ungefähr richtig, mindestens 5 m', () => {
    const ring = map.accuracyRing(50, 7, 100, 8);
    expect(ring[0]).toEqual(ring.at(-1));
    const [lon] = ring[0] as [number, number];
    expect((lon - 7) * 111_320 * Math.cos((50 * Math.PI) / 180)).toBeCloseTo(100, 0);
    const tiny = map.accuracyRing(50, 7, null, 8);
    expect(
      ((tiny[0] as [number, number])[0] - 7) * 111_320 * Math.cos((50 * Math.PI) / 180),
    ).toBeCloseTo(5, 0);
  });
});
