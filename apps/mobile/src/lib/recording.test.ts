import {
  addRecordingPoints,
  recordingSummary,
  runHighlights,
  startRecording,
  type TrackPoint,
} from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_MAX_SIM_MS, DemoRun, demoPointAt } from './demo-recording';
import { parsePersistedRecording, recordingSession, serializeRecording } from './recording-session';
import {
  MAP_ATTRIBUTION,
  MAPLIBRE_JS_SRI,
  OPENFREEMAP_STYLE,
  routeMapHtml,
} from './route-map-html';

const ID = '00000000-0000-4000-8000-000000000001';

describe('Sicherung der Aufzeichnung (Wiederaufnahme nach Absturz)', () => {
  const base = addRecordingPoints(
    startRecording({ id: ID, ownerUserId: 'user-a', sport: 'run', now: 1_000 }),
    [
      { lat: 50, lng: 7, t: 2_000, accuracyM: 5 },
      { lat: 50.001, lng: 7, t: 4_000, accuracyM: 5 },
    ],
  );

  it('Rundreise; laufende Aufzeichnung wird beim letzten Punkt pausiert', () => {
    const text = serializeRecording({ mode: 'gps', diaryLogId: null, state: base });
    const restored = parsePersistedRecording(text, 'user-a');
    expect(restored?.state.status).toBe('paused');
    expect(restored?.state.segments[0]?.endT).toBe(4_000);
    expect(restored?.state.segments[0]?.points).toHaveLength(2);
  });

  it('anderes Konto, kaputt, falsches Format → null (nie anbieten)', () => {
    const text = serializeRecording({ mode: 'gps', diaryLogId: null, state: base });
    expect(parsePersistedRecording(text, 'user-b')).toBeNull();
    expect(parsePersistedRecording('{kaputt', 'user-a')).toBeNull();
    expect(parsePersistedRecording(null, 'user-a')).toBeNull();
    expect(parsePersistedRecording(JSON.stringify({ v: 1, state: base }), 'user-a')).toBeNull();
    expect(
      parsePersistedRecording(
        text.replace('"diaryLogId":null', '"diaryLogId":"kein-uuid"'),
        'user-a',
      ),
    ).toBeNull();
  });

  it('kompakt: 12 h mit 1 Punkt je 2 s bleiben unter 1,2 MB; Werte bleiben auf ca. 0,1 m genau', () => {
    let state = startRecording({ id: ID, ownerUserId: 'user-a', sport: 'run', now: 0 });
    const points = Array.from({ length: 21_600 }, (_, i) => ({
      lat: 50.123456 + i * 0.00001,
      lng: 6.987654 + i * 0.00001,
      t: (i + 1) * 2000,
      accuracyM: 4.3,
      altitudeM: 52.37,
    }));
    state = addRecordingPoints(state, points);
    const text = serializeRecording({ mode: 'gps', diaryLogId: null, state });
    expect(text.length).toBeLessThan(1_200_000);
    const restored = parsePersistedRecording(text, 'user-a');
    const p = restored?.state.segments[0]?.points[100];
    expect(p?.lat).toBeCloseTo(points[100]!.lat, 6);
    expect(p?.t).toBe(points[100]!.t);
    expect(p?.altitudeM).toBeCloseTo(52.4, 6);
  });

  it('Sitzung: sichert höchstens alle 30 s, bei force sofort; reset löscht die Sicherung', async () => {
    const persist = vi.fn(async () => undefined);
    recordingSession.begin({ mode: 'gps', diaryLogId: null, state: base }, persist);
    await recordingSession.persist();
    await recordingSession.persist();
    expect(persist).toHaveBeenCalledTimes(1);
    await recordingSession.persist(true);
    expect(persist).toHaveBeenCalledTimes(2);
    await recordingSession.setDiaryLogId(ID);
    expect(recordingSession.get()?.diaryLogId).toBe(ID);
    await recordingSession.reset();
    expect(persist).toHaveBeenLastCalledWith(null);
    expect(recordingSession.get()).toBeNull();
  });
});

describe('Demo-Aufzeichnung (Testmodus)', () => {
  it('Zeitraffer: Punkte alle 2 s simulierter Zeit, nie nach „jetzt“, speicherbar', () => {
    const points: { t: number }[] = [];
    const realNow = Date.parse('2026-10-03T10:00:00Z');
    const run = new DemoRun('run', (p) => points.push(...p), realNow);
    run.tick(10 * 60 * 1000);
    expect(points.length).toBeGreaterThan(290);
    expect(Math.max(...points.map((p) => p.t))).toBeLessThan(realNow);
    let state = startRecording({
      id: ID,
      ownerUserId: 'u',
      sport: 'run',
      now: realNow - DEMO_MAX_SIM_MS,
    });
    state = addRecordingPoints(state, points as never);
    const summary = recordingSummary(state);
    expect(summary.distanceM).toBeGreaterThan(1_500);
    expect(summary.tooShort).toBe(false);
    run.tick(DEMO_MAX_SIM_MS);
    expect(run.running).toBe(false);
    expect(Math.max(...points.map((p) => p.t))).toBeLessThan(realNow);
  });

  it('Demo-Lauf ist abwechslungsreich: Tempo wechselt, ein Anstieg, starker Schluss (fest, ohne Zufall)', () => {
    const realNow = Date.parse('2026-10-03T10:00:00Z');
    const record = () => {
      const points: TrackPoint[] = [];
      const run = new DemoRun('run', (p) => points.push(...p), realNow);
      run.tick(31 * 60 * 1000);
      let state = startRecording({
        id: ID,
        ownerUserId: 'u',
        sport: 'run',
        now: realNow - DEMO_MAX_SIM_MS,
      });
      state = addRecordingPoints(state, points);
      return recordingSummary(state);
    };
    const summary = record();
    expect(summary.distanceM).toBeGreaterThan(5_000);
    const splits = summary.kmSplits;
    expect(splits.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...splits) - Math.min(...splits)).toBeGreaterThan(30);
    // Schnellster Kilometer am Schluss, langsamster am Anstieg (km 4).
    expect(splits.indexOf(Math.min(...splits))).toBe(4);
    expect(splits.indexOf(Math.max(...splits))).toBe(3);
    const kinds = runHighlights({
      kmSplits: splits,
      distanceM: summary.distanceM,
      movingS: summary.movingS,
      elevationProfile: summary.elevationProfile,
    }).map((h) => h.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['fastest_km', 'negative_split', 'biggest_climb', 'highest_point']),
    );
    expect(record().kmSplits).toEqual(splits);
  });

  it('Runde ist geschlossen und hat Höhen', () => {
    const p = demoPointAt(0, 0);
    expect(p.altitudeM).toBeGreaterThan(40);
    expect(Number.isFinite(p.lat)).toBe(true);
  });
});

describe('Karte (WebView/iframe)', () => {
  it('nur Zahlen ins HTML, Attribution, OpenFreeMap, feste Version mit Prüfsumme', () => {
    const html = routeMapHtml(
      [
        { lat: 50.9, lng: 6.9 },
        { lat: 50.91, lng: 6.91 },
      ],
      'Karte <script>alert(1)</script>',
    ) as string;
    expect(html).toContain(OPENFREEMAP_STYLE);
    expect(html).toContain(MAP_ATTRIBUTION);
    expect(html).toContain(MAPLIBRE_JS_SRI);
    expect(html).toContain('[[6.9,50.9],[6.91,50.91]]');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('tile.openstreetmap.org');
  });

  it('Linie nach Tempo: nur geprüfte Hex-Farben und Zahlen', () => {
    const pts = [
      { lat: 50.9, lng: 6.9 },
      { lat: 50.91, lng: 6.91 },
    ];
    const html = routeMapHtml(pts, 'Karte', [
      { color: '#6D28D9', points: pts },
      { color: 'red;</script><script>alert(1)', points: pts },
      { color: '#FFFFFF', points: [pts[0] as { lat: number; lng: number }] },
    ]) as string;
    expect(html).toContain("'line-color': ['get', 'color']");
    expect(html).toContain('"color":"#6D28D9"');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('#FFFFFF"');
  });

  it('weniger als 2 gültige Punkte → keine Karte', () => {
    expect(routeMapHtml([], 'x')).toBeNull();
    expect(routeMapHtml([{ lat: 50, lng: 7 }], 'x')).toBeNull();
    expect(
      routeMapHtml(
        [
          { lat: 95, lng: 7 },
          { lat: Number.NaN, lng: 1 },
        ],
        'x',
      ),
    ).toBeNull();
  });
});
