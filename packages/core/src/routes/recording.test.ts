import { describe, expect, it } from 'vitest';

import { ROUTE_RECORDING } from '../constants';
import {
  addRecordingPoints,
  diaryValuesFromSummary,
  gpsSignal,
  pauseRecording,
  plannedEnduranceForRecording,
  recordingElapsedS,
  recordingLimitReached,
  recordingLiveStats,
  recordingSaveCheck,
  recordingStateSchema,
  recordingSummary,
  resumeRecording,
  startRecording,
  stopRecording,
} from './recording';
import { sessionLogFitsRoute, summarizeTrack } from './schema';
import { last, line, offset, T0 } from './test-helpers';

const ID = '00000000-0000-4000-8000-000000000001';
const start = () => startRecording({ id: ID, ownerUserId: 'user-1', sport: 'run', now: T0 });

describe('Aufzeichnung: Start, Pause, Fortsetzen, Stopp', () => {
  it('Punkte nur während „Aufzeichnen“, Zeit vorwärts, ab Beginn des Teilstücks', () => {
    let s = start();
    const a = line({ speedMps: 3, count: 60 });
    s = addRecordingPoints(s, a);
    expect(s.segments[0]?.points).toHaveLength(60);
    // doppelt/rückwärts → ignoriert
    expect(addRecordingPoints(s, a.slice(0, 5))).toBe(s);
    s = pauseRecording(s, last(a).t + 1_000);
    expect(s.status).toBe('paused');
    // in der Pause → ignoriert
    const during = line({ speedMps: 3, count: 10, t0: last(a).t + 2_000 });
    expect(addRecordingPoints(s, during)).toBe(s);
    s = resumeRecording(s, last(a).t + 600_000);
    expect(s.segments).toHaveLength(2);
    // vor Beginn des neuen Teilstücks → ignoriert
    expect(addRecordingPoints(s, during).segments[1]?.points).toHaveLength(0);
    s = stopRecording(s, last(a).t + 700_000);
    expect(s.status).toBe('stopped');
    expect(stopRecording(s, 0)).toBe(s);
    expect(pauseRecording(s, 0)).toBe(s);
    expect(resumeRecording(s, 0)).toBe(s);
  });

  it('Zeit ohne Pausen; Live-Werte wie beim Speichern', () => {
    let s = start();
    const a = line({ speedMps: 3, count: 301 }); // 300 s, 900 m
    s = addRecordingPoints(s, a);
    s = pauseRecording(s, T0 + 300_000);
    s = resumeRecording(s, T0 + 900_000);
    const b = line({ speedMps: 3, count: 301, start: offset(last(a), 2_000, 0), t0: T0 + 900_000 });
    s = addRecordingPoints(s, b);
    expect(recordingElapsedS(s, T0 + 1_200_000)).toBe(600);
    const live = recordingLiveStats(s, T0 + 1_200_000);
    expect(live.distanceM).toBeGreaterThan(1_750);
    expect(live.distanceM).toBeLessThan(1_850);
    const summary = recordingSummary(s);
    // Der Weg während der Pause (2 km) zählt nicht.
    expect(summary.distanceM).toBe(live.distanceM);
    expect(summary.durationS).toBe(600);
    expect(summary.kmSplits).toHaveLength(1);
  });

  it(`höchstens ${ROUTE_RECORDING.maxRawPoints} Rohpunkte; 12 h → Grenze erreicht`, () => {
    let s = start();
    s = addRecordingPoints(s, line({ speedMps: 2, count: ROUTE_RECORDING.maxRawPoints + 10 }));
    expect(s.segments[0]?.points).toHaveLength(ROUTE_RECORDING.maxRawPoints);
    expect(recordingLimitReached(s, T0)).toBe(true);
    expect(recordingLimitReached(start(), T0 + 43_200_000)).toBe(true);
    expect(recordingLimitReached(start(), T0 + 43_199_000)).toBe(false);
  });

  it('GPS: suchen, schwach, ok; in der Pause ok', () => {
    let s = start();
    expect(gpsSignal(s, T0)).toBe('searching');
    s = addRecordingPoints(s, [{ lat: 50, lng: 7, t: T0 + 1_000, accuracyM: 50 }]);
    expect(gpsSignal(s, T0 + 2_000)).toBe('weak');
    s = addRecordingPoints(s, [{ lat: 50, lng: 7.0001, t: T0 + 3_000, accuracyM: 5 }]);
    expect(gpsSignal(s, T0 + 4_000)).toBe('ok');
    expect(gpsSignal(s, T0 + 3_000 + ROUTE_RECORDING.gpsSearchingAfterS * 1000 + 1)).toBe(
      'searching',
    );
    expect(gpsSignal(pauseRecording(s, T0 + 5_000), T0 + 99_000)).toBe('ok');
  });

  it('Sicherung prüfen: gültig, kaputt, fremdes Format', () => {
    const s = addRecordingPoints(start(), line({ speedMps: 3, count: 5 }));
    expect(recordingStateSchema.safeParse(JSON.parse(JSON.stringify(s))).success).toBe(true);
    expect(recordingStateSchema.safeParse({ ...s, format: 2 }).success).toBe(false);
    expect(recordingStateSchema.safeParse({ ...s, segments: [] }).success).toBe(false);
    expect(recordingStateSchema.safeParse({ ...s, extra: 1 }).success).toBe(false);
    expect(recordingStateSchema.safeParse(null).success).toBe(false);
  });
});

describe('Speichern einer Aufzeichnung', () => {
  it('zu kurz (unter 1 min), kurze Distanz (unter 100 m → nachfragen), ok', () => {
    expect(recordingSaveCheck(summarizeTrack(line({ speedMps: 3, count: 30 }), 'run'))).toBe(
      'too_short',
    );
    expect(recordingSaveCheck(summarizeTrack(line({ speedMps: 1, count: 70 }), 'run'))).toBe(
      'short_distance',
    );
    expect(recordingSaveCheck(summarizeTrack(line({ speedMps: 3, count: 300 }), 'run'))).toBe('ok');
  });

  it('Tagebuch-Werte passen immer zur Strecke (sessionLogFitsRoute)', () => {
    for (const [speed, count] of [
      [3, 301],
      [2.9, 3_700],
      [8, 1_000],
    ] as const) {
      const summary = summarizeTrack(line({ speedMps: speed, count }), 'run');
      const v = diaryValuesFromSummary(summary);
      expect(v).not.toBeNull();
      if (!v) continue;
      const fits = sessionLogFitsRoute(
        {
          kind: 'endurance',
          modality: v.modality,
          performedOn: '2026-10-16',
          durationS: v.hours * 3600 + v.minutes * 60,
          distanceM: v.distanceM,
        },
        {
          sport: 'run',
          started_at: summary.startedAt as string,
          duration_s: summary.durationS,
          moving_s: summary.movingS,
          distance_m: summary.distanceM,
        },
      );
      expect(fits).toBe(true);
    }
    expect(
      diaryValuesFromSummary(summarizeTrack(line({ speedMps: 1, count: 70 }), 'run')),
    ).toBeNull();
  });

  it('heute geplante Ausdauer gleicher Art ohne Eintrag', () => {
    const sessions = [
      {
        id: 'a',
        kind: 'strength' as const,
        endurance_modality: null,
        scheduled_on: '2026-10-20',
        status: 'planned',
      },
      {
        id: 'b',
        kind: 'endurance' as const,
        endurance_modality: 'bike' as const,
        scheduled_on: '2026-10-20',
        status: 'planned',
      },
      {
        id: 'c',
        kind: 'endurance' as const,
        endurance_modality: 'run' as const,
        scheduled_on: '2026-10-21',
        status: 'planned',
      },
      {
        id: 'd',
        kind: 'endurance' as const,
        endurance_modality: 'run' as const,
        scheduled_on: '2026-10-20',
        status: 'planned',
      },
    ];
    expect(plannedEnduranceForRecording(sessions, new Set(), '2026-10-20', 'run')?.id).toBe('d');
    expect(plannedEnduranceForRecording(sessions, new Set(['d']), '2026-10-20', 'run')).toBeNull();
    expect(plannedEnduranceForRecording(sessions, new Set(), '2026-10-20', 'walk')).toBeNull();
    expect(
      plannedEnduranceForRecording(
        sessions.map((s) => ({ ...s, status: 'skipped' })),
        new Set(),
        '2026-10-20',
        'bike',
      ),
    ).toBeNull();
  });
});
