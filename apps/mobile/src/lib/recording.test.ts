import { addRecordingPoints, recordingSummary, startRecording } from '@fitnessapp/core';
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
    expect(parsePersistedRecording(JSON.stringify({ v: 2, state: base }), 'user-a')).toBeNull();
    expect(
      parsePersistedRecording(
        text.replace('"diaryLogId":null', '"diaryLogId":"kein-uuid"'),
        'user-a',
      ),
    ).toBeNull();
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
