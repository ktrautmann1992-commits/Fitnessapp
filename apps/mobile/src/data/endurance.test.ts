import {
  summarizeTrack,
  type TrackPoint,
  toTrackedRoutePayload,
  type TrackedRoutePayload,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, TODAY, USER_ID, uuidBackend } from '../test/fixtures';
import { BackendError } from './backend';
import { activitiesFromRows, enduranceLogsFromRows } from './endurance-rows';
import { plannedCandidate, recordingDiaryDraft } from './route-diary';
import { storyForLog, storyForRoute } from './story-input';
import { draftToPayload } from './workout-draft';

/** Gerade Strecke nach Norden: `count` Punkte alle 2 s mit `speed` m/s, Ende vor NOW. */
function track(count = 900, speed = 2.8, endBeforeNowS = 600): TrackPoint[] {
  const end = Date.parse(NOW) - endBeforeNowS * 1000;
  const start = end - (count - 1) * 2000;
  const mPerDegLat = 111_195;
  return Array.from({ length: count }, (_, i) => ({
    lat: 50.9 + (i * 2 * speed) / mPerDegLat,
    lng: 6.95,
    t: start + i * 2000,
    accuracyM: 4,
    altitudeM: 50 + (i % 100) / 10,
  }));
}

let uuid = 900;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`;

function payloadFor(
  points: TrackPoint[],
  patch: Partial<{ id: string; sessionLogId: string | null; favorite: boolean }> = {},
): TrackedRoutePayload {
  const summary = summarizeTrack(points, 'run');
  const payload = toTrackedRoutePayload(summary, {
    id: patch.id ?? nextUuid(),
    name: 'Runde',
    difficulty: null,
    isFavorite: patch.favorite ?? false,
    note: null,
    baseRouteId: null,
    sessionLogId: patch.sessionLogId ?? null,
    source: 'recorded',
  });
  if (!payload) throw new Error('kein Payload');
  return payload;
}

async function diaryEntry(
  backend: ReturnType<typeof uuidBackend>['backend'],
  points: TrackPoint[],
) {
  const rows = (await backend.loadRows()).rows;
  const summary = summarizeTrack(points, 'run');
  const draft = recordingDiaryDraft(rows, summary, {
    plannedSessionId: null,
    ownerUserId: USER_ID,
    today: TODAY,
    now: NOW,
    newId: nextUuid,
  });
  if (!draft) throw new Error('kein Entwurf');
  const payload = draftToPayload(draft, { writeId: nextUuid(), now: NOW, today: TODAY });
  const outcome = await backend.submitWorkout(draft, payload);
  return { draft, outcome };
}

describe('Ausdauer im Testmodus: Tagebuch + Strecke (gleiche Regeln wie save_tracked_route)', () => {
  it('freier Eintrag aus der Strecke, dann Strecke mit Verweis: Herkunft gps, Revision + 1, einmal gezählt', async () => {
    const { backend } = uuidBackend(planPersonRows());
    const points = track();
    const { draft, outcome } = await diaryEntry(backend, points);
    expect(outcome).toEqual({ kind: 'saved', orphaned: false });
    const payload = payloadFor(points, { sessionLogId: draft.logId });
    await expect(backend.saveTrackedRoute(payload)).resolves.toBe('saved');
    // Erneut senden (Warteschlange) → keine zweite Strecke.
    await expect(backend.saveTrackedRoute(payload)).resolves.toBe('saved');
    const { routes, pending, offline } = await backend.loadTrackedRoutes();
    expect(routes).toHaveLength(1);
    expect(pending).toEqual([]);
    expect(offline).toBe(false);
    expect(routes[0]).toMatchObject({
      session_log_id: draft.logId,
      user_id: USER_ID,
      point_count: expect.any(Number),
    });
    expect(routes[0]?.elevation_profile?.length).toBeGreaterThan(2);
    const rows = (await backend.loadRows()).rows;
    const log = rows.sessionLogs.find((l) => l.id === draft.logId);
    expect(log).toMatchObject({ source: 'gps', revision: 2, is_free: true, name_de: 'Lauf' });
    expect(enduranceLogsFromRows(rows)).toHaveLength(1);
    const activities = activitiesFromRows(rows, routes, []);
    expect(activities).toHaveLength(1);
    expect(activities[0]?.source).toBe('route');
  });

  it('Eintrag passt nicht (andere Distanz) → abgelehnt ohne Werte; fremde/fehlende Einträge ebenso', async () => {
    const { backend } = uuidBackend(planPersonRows());
    const points = track();
    const { draft } = await diaryEntry(backend, points);
    const other = payloadFor(track(400), { sessionLogId: draft.logId });
    await expect(backend.saveTrackedRoute(other)).rejects.toMatchObject({ code: 'route_rejected' });
    await expect(
      backend.saveTrackedRoute(payloadFor(points, { sessionLogId: nextUuid() })),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it('Zukunft, ungültig und Tageslimit 20', async () => {
    const { backend } = uuidBackend(planPersonRows());
    await expect(
      backend.saveTrackedRoute(payloadFor(track(900, 2.8, -3600))),
    ).rejects.toMatchObject({ code: 'route_rejected' });
    await expect(
      backend.saveTrackedRoute({ ...payloadFor(track()), name: '' }),
    ).rejects.toMatchObject({ code: 'route_rejected' });
    for (let i = 0; i < 20; i += 1) await backend.saveTrackedRoute(payloadFor(track()));
    await expect(backend.saveTrackedRoute(payloadFor(track()))).rejects.toMatchObject({
      code: 'route_limit',
    });
  });

  it('Ändern, Favorit, Löschen (Verweise leer), Eintrag löschen leert den Verweis, alle löschen, Export', async () => {
    const { backend } = uuidBackend(planPersonRows());
    const points = track();
    const { draft } = await diaryEntry(backend, points);
    const fav = payloadFor(points, { sessionLogId: draft.logId });
    await backend.saveTrackedRoute(fav);
    await backend.updateTrackedRoute({
      id: fav.id,
      name: 'Rheinrunde',
      difficulty: 'easy',
      is_favorite: true,
      note: 'nur für mich',
    });
    const again = { ...payloadFor(points), base_route_id: fav.id };
    await backend.saveTrackedRoute(again);
    let { routes } = await backend.loadTrackedRoutes();
    expect(routes.find((r) => r.id === fav.id)).toMatchObject({
      name: 'Rheinrunde',
      is_favorite: true,
    });
    await expect(
      backend.updateTrackedRoute({
        id: fav.id,
        name: '',
        difficulty: null,
        is_favorite: false,
        note: null,
      }),
    ).rejects.toMatchObject({ code: 'route_rejected' });

    const rows = (await backend.loadRows()).rows;
    const revision = rows.sessionLogs.find((l) => l.id === draft.logId)?.revision ?? 0;
    await backend.deleteSessionLog(draft.logId, revision);
    ({ routes } = await backend.loadTrackedRoutes());
    expect(routes.find((r) => r.id === fav.id)?.session_log_id).toBeNull();

    const exported = await backend.exportMyData();
    expect(JSON.stringify(exported)).toContain('Rheinrunde');

    await backend.deleteTrackedRoute(fav.id);
    ({ routes } = await backend.loadTrackedRoutes());
    expect(routes).toHaveLength(1);
    expect(routes[0]?.base_route_id).toBeNull();
    await expect(backend.deleteAllTrackedRoutes()).resolves.toBe(1);
    expect((await backend.loadTrackedRoutes()).routes).toEqual([]);
  });

  it('Aufzeichnung sichern/lesen/löschen (geschützter Speicher)', async () => {
    const { backend } = uuidBackend(planPersonRows());
    expect(await backend.readRecording()).toBeNull();
    await backend.writeRecording('{"v":1}');
    expect(await backend.readRecording()).toBe('{"v":1}');
    await backend.clearRecording();
    expect(await backend.readRecording()).toBeNull();
  });

  it('keine geplante Einheit → freie Einheit; zu kurz → kein Eintrag', () => {
    const rows = planPersonRows();
    const summary = summarizeTrack(track(), 'run');
    expect(plannedCandidate(rows, summary, TODAY)).toBeNull();
    const short = summarizeTrack(track(40, 1), 'run');
    expect(
      recordingDiaryDraft(rows, short, {
        plannedSessionId: null,
        ownerUserId: USER_ID,
        today: TODAY,
        now: NOW,
        newId: nextUuid,
      }),
    ).toBeNull();
  });
});

describe('Story-Bild: Eingaben nur aus der Positivliste', () => {
  it('Strecke und Eintrag ohne GPS', async () => {
    const { backend } = uuidBackend(planPersonRows());
    const points = track();
    const { draft } = await diaryEntry(backend, points);
    const payload = payloadFor(points, { sessionLogId: draft.logId });
    await backend.saveTrackedRoute({ ...payload, note: 'GEHEIM' });
    const { routes } = await backend.loadTrackedRoutes();
    const options = { showLine: true, showDate: true };
    const card = storyForRoute(payload.id, routes, [], options);
    expect(card?.kind).toBe('endurance');
    expect(JSON.stringify(card)).not.toContain('GEHEIM');
    // Verknüpfter Eintrag nutzt die Linie der Strecke.
    const rows = (await backend.loadRows()).rows;
    const viaLog = storyForLog(draft.logId, rows, routes, options);
    expect(viaLog).toEqual(card);
    // Ohne Strecke: keine Linie.
    const noRoute = storyForLog(draft.logId, rows, [], options);
    expect(noRoute).toMatchObject({ kind: 'endurance', line: null, lineState: 'none' });
    expect(storyForLog('fehlt', rows, routes, options)).toBeNull();
    expect(storyForRoute('fehlt', routes, [], options)).toBeNull();
  });
});
