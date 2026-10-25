import { encodePolyline, haversineM, loopResponseSchema, roundStartPoint } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it, vi } from 'vitest';

import { createMemoryProtectedStore } from './protected-store';
import { BackendError } from './backend';
import { createRemoteLoopRouting, localLoopRoutes, minimizedLoopRequest } from './loop-routing';
import { createLoopStore, MAX_SAVED_LOOPS, toSavedLoop } from '../lib/loop-store.types';
import { loopGuideFor, setLoopGuide, clearLoopGuide } from '../lib/loop-guide';
import { LOOP_COLORS, loopMapHtml, parseLoopMapMessage } from '../lib/loop-map-html';

/**
 * Rundkurs-Vorschlag in der App (docs/PLAN-RUNDKURS.md): Datenzugriff (Server-Route mit Ersatz-fetch, Testmodus mit
 * Attrappe), gemerkte Runden (nur Gerät, je Konto), Leitlinie, Karten-HTML/-Nachrichten. Startpunkt: Kölner Dom
 * (öffentlicher Ort, keine Nutzerdaten).
 */

const REQUEST = {
  lat: 50.941312,
  lng: 6.958271,
  distance_km: 8,
  surface: 'unpaved' as const,
  variant: 0,
};

const client = {
  auth: {
    getSession: () =>
      Promise.resolve({ data: { session: { access_token: 'tok-123' } }, error: null }),
  },
} as unknown as AppSupabaseClient;

describe('Testmodus (Attrappe)', () => {
  it('liefert 2–3 Runden passend zum Antwort-Schema', async () => {
    const res = loopResponseSchema.parse(await localLoopRoutes(REQUEST));
    expect(res.code).toBe('ok');
    if (res.code === 'ok') {
      expect(res.routes.length).toBeGreaterThanOrEqual(2);
      expect(res.routes.length).toBeLessThanOrEqual(3);
    }
  });

  it('ungültige Anfrage → invalid_request', async () => {
    expect(await localLoopRoutes({ ...REQUEST, distance_km: 99 })).toEqual({
      code: 'invalid_request',
    });
  });
});

describe('Supabase-Modus: POST /api/strecken/rundkurs (Ersatz-fetch)', () => {
  it('nur gerundeter Start im Körper, Token als Bearer, nichts in der Adresse', async () => {
    const fetchFn = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ code: 'no_routes' }), { status: 200 })),
    );
    const remote = createRemoteLoopRouting({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await remote.planLoopRoutes(REQUEST)).toEqual({ code: 'no_routes' });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://web.example.test/api/strecken/rundkurs');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok-123' });
    const body = JSON.parse(String(init?.body)) as typeof REQUEST;
    const rounded = roundStartPoint(REQUEST);
    expect(body).toEqual({ ...REQUEST, lat: rounded.lat, lng: rounded.lng });
    expect(String(init?.body)).not.toContain('50.941312');
    expect(haversineM(REQUEST, body)).toBeLessThanOrEqual(36);
  });

  it('ohne Adresse → not_configured; kaputte Antwort → unavailable; offline → network', async () => {
    expect(await createRemoteLoopRouting({ client, webUrl: null }).planLoopRoutes(REQUEST)).toEqual(
      { code: 'not_configured' },
    );
    const bad = createRemoteLoopRouting({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: (() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'boese' })),
        )) as unknown as typeof fetch,
    });
    expect(await bad.planLoopRoutes(REQUEST)).toEqual({ code: 'unavailable' });
    const offline = createRemoteLoopRouting({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch,
    });
    await expect(offline.planLoopRoutes(REQUEST)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof BackendError && e.code === 'network' && !e.message.includes('50.9'),
    );
  });

  it('ohne Login → not_signed_in', async () => {
    const anonymous = {
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    } as unknown as AppSupabaseClient;
    await expect(
      createRemoteLoopRouting({
        client: anonymous,
        webUrl: 'https://web.example.test',
      }).planLoopRoutes(REQUEST),
    ).rejects.toSatisfy((e: unknown) => e instanceof BackendError && e.code === 'not_signed_in');
  });

  it('Datenminimierung ist idempotent', () => {
    const once = minimizedLoopRequest(REQUEST);
    expect(minimizedLoopRequest(once)).toEqual(once);
  });
});

describe('Gemerkte Runden (nur Gerät)', () => {
  const NOW = '2026-10-25T10:00:00.000Z';

  async function firstRoute() {
    const res = await localLoopRoutes(REQUEST);
    if (res.code !== 'ok') throw new Error('keine Runde');
    return res.routes;
  }

  it('merken, auflisten, entfernen; je Konto getrennt', async () => {
    const store = createLoopStore(createMemoryProtectedStore());
    const [a, b] = await firstRoute();
    if (!a || !b) throw new Error('zu wenige Runden');
    await store.save('user-1', toSavedLoop(a, 'Waldrunde', 'loop-a', NOW));
    await store.save('user-1', toSavedLoop(b, 'Feldrunde', 'loop-b', NOW));
    expect((await store.list('user-1')).map((l) => l.name)).toEqual(['Feldrunde', 'Waldrunde']);
    expect(await store.list('user-2')).toEqual([]);
    expect((await store.remove('user-1', 'loop-b')).map((l) => l.id)).toEqual(['loop-a']);
  });

  it('gleiche Linie ersetzt die alte; höchstens 20; leerer Name → „Rundkurs“', async () => {
    const store = createLoopStore(createMemoryProtectedStore());
    const [a] = await firstRoute();
    if (!a) throw new Error('keine Runde');
    await store.save('u', toSavedLoop(a, 'Eins', 'loop-1', NOW));
    await store.save('u', toSavedLoop(a, 'Zwei', 'loop-2', NOW));
    expect((await store.list('u')).map((l) => l.name)).toEqual(['Zwei']);
    for (let i = 0; i < 25; i += 1) {
      const polyline = encodePolyline([
        { lat: 50 + i / 100, lng: 7 },
        { lat: 50.5, lng: 7.5 },
      ]);
      await store.save('u', { ...toSavedLoop(a, `R${i}`, `loop-x${i}`, NOW), polyline });
    }
    const list = await store.list('u');
    expect(list).toHaveLength(MAX_SAVED_LOOPS);
    expect(list[0]?.name).toBe('R24');
    expect(toSavedLoop(a, '   ', 'loop-z', NOW).name).toBe('Rundkurs');
  });

  it('kaputter Speicherinhalt → leere Liste (kein Absturz)', async () => {
    const raw = createMemoryProtectedStore();
    await raw.write('{kaputt');
    expect(await createLoopStore(raw).list('u')).toEqual([]);
  });
});

describe('Leitlinie', () => {
  it('nur mit passender id; löschen', () => {
    setLoopGuide({ id: 'g1', name: 'Rundkurs 8 km', points: [REQUEST, REQUEST], distanceM: 8000 });
    expect(loopGuideFor('g1')?.name).toBe('Rundkurs 8 km');
    expect(loopGuideFor('anders')).toBeNull();
    expect(loopGuideFor(undefined)).toBeNull();
    clearLoopGuide();
    expect(loopGuideFor('g1')).toBeNull();
  });
});

describe('Karte', () => {
  const line = [
    { lat: 50.94, lng: 6.95 },
    { lat: 50.95, lng: 6.96 },
  ];

  it('HTML nur mit Zahlen und geprüften Farben, Attribution OSM + openrouteservice', () => {
    const html = loopMapHtml({
      lines: [
        { points: line, color: LOOP_COLORS[0] },
        { points: line, color: '"><script>alert(1)</script>' },
      ],
      selected: 0,
      start: line[0] ?? null,
      pickable: true,
      label: 'Karte <b>',
    });
    expect(html).not.toBeNull();
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('<b>');
    expect(html).toContain('© OpenStreetMap-Mitwirkende');
    expect(html).toContain('openrouteservice.org');
    expect(html).toContain("map.on('click'");
  });

  it('ohne Linien: Start im Mittelpunkt; ohne alles: null; nicht antippbar ohne Klick-Handler', () => {
    const html = loopMapHtml({
      lines: [],
      selected: null,
      start: line[0] ?? null,
      pickable: false,
      label: 'x',
    });
    expect(html).toContain('zoom: 14');
    expect(html).not.toContain("map.on('click'");
    expect(
      loopMapHtml({ lines: [], selected: null, start: null, pickable: false, label: 'x' }),
    ).toBeNull();
  });

  it('Nachrichten: geladen, Fehler, Tipp; Unsinn → null', () => {
    expect(parseLoopMapMessage({ alpha5Loop: 'loaded' })).toEqual({ kind: 'loaded' });
    expect(parseLoopMapMessage('{"alpha5Loop":"failed"}')).toEqual({ kind: 'failed' });
    expect(parseLoopMapMessage({ alpha5Loop: { pick: [50.9, 6.9] } })).toEqual({
      kind: 'pick',
      point: { lat: 50.9, lng: 6.9 },
    });
    expect(parseLoopMapMessage({ alpha5Loop: { pick: [500, 6.9] } })).toBeNull();
    expect(parseLoopMapMessage({ alpha5Map: 'loaded' })).toBeNull();
    expect(parseLoopMapMessage('kein json')).toBeNull();
  });
});
