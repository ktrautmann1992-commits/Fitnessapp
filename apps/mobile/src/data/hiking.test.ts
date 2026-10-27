import { summarizeTrack, type TrackPoint, toTrackedRoutePayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, TODAY, USER_ID, uuidBackend } from '../test/fixtures';
import { recordingDiaryDraft } from './route-diary';
import { legLoadHintsFromRows } from './sport-entry';
import { draftToPayload } from './workout-draft';

/**
 * Sportarten Stufe 1 · Etappe W im Testmodus: gleiche Regeln wie save_tracked_route/update_tracked_route/
 * save_session_log (Art der Geh-Einheit folgt zwischen Strecke und Eintrag, Name der freien Einheit je Art).
 */

/** Gehen bergauf und bergab: `count` Punkte alle 2 s mit 1,3 m/s, 0,5 m Höhe je Punkt auf/ab, Ende vor NOW. */
function hikeTrack(count = 1200): TrackPoint[] {
  const end = Date.parse(NOW) - 600 * 1000;
  const start = end - (count - 1) * 2000;
  const mPerDegLat = 111_195;
  const half = Math.floor(count / 2);
  return Array.from({ length: count }, (_, i) => ({
    lat: 47.4 + (i * 2 * 1.3) / mPerDegLat,
    lng: 11.0,
    t: start + i * 2000,
    accuracyM: 4,
    altitudeM: i <= half ? 1500 + i * 0.5 : 1500 + half * 0.5 - (i - half) * 0.5,
  }));
}

let uuid = 7700;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`;

async function hike(kind: 'walk' | 'hike' | 'mountain_hike', sac: number | null = null) {
  const { backend } = uuidBackend(planPersonRows());
  const summary = summarizeTrack(hikeTrack(), 'walk');
  const rows = (await backend.loadRows()).rows;
  const draft = recordingDiaryDraft(rows, summary, {
    plannedSessionId: null,
    ownerUserId: USER_ID,
    today: TODAY,
    now: NOW,
    newId: nextUuid,
    walkKind: kind,
  });
  if (!draft) throw new Error('kein Entwurf');
  const payload = draftToPayload(draft, { writeId: nextUuid(), now: NOW, today: TODAY });
  await backend.submitWorkout(draft, payload);
  const route = toTrackedRoutePayload(summary, {
    id: nextUuid(),
    name: 'Hausberg',
    difficulty: null,
    isFavorite: false,
    note: null,
    baseRouteId: null,
    sessionLogId: draft.logId,
    source: 'recorded',
    walkKind: kind,
    sacGrade: sac,
  });
  if (!route) throw new Error('kein Payload');
  await backend.saveTrackedRoute(route);
  return { backend, draft, route, payload };
}

describe('Wandern im Testmodus', () => {
  it('Bergwanderung: Eintrag „Bergwanderung“ mit walk_kind, Strecke mit Art, SAC, Abstieg, höchstem Punkt', async () => {
    const { backend, draft, route, payload } = await hike('mountain_hike', 2);
    expect(payload.name_de).toBe('Bergwanderung');
    expect(payload.cardio).toMatchObject({ modality: 'walk', walk_kind: 'mountain_hike' });
    const saved = (await backend.loadTrackedRoutes()).routes.find((r) => r.id === route.id);
    expect(saved).toMatchObject({ walk_kind: 'mountain_hike', sac_grade: 2 });
    expect(saved?.elevation_loss_m).toBeGreaterThan(250);
    expect(saved?.max_altitude_m).toBeGreaterThanOrEqual(1795);
    const rows = (await backend.loadRows()).rows;
    expect(rows.cardioLogs.find((c) => c.session_log_id === draft.logId)?.walk_kind).toBe(
      'mountain_hike',
    );
  });

  it('Gehen bleibt wie bisher: „Spaziergang“, kein walk_kind im Eintrag und an der Strecke', async () => {
    const { backend, payload, route } = await hike('walk', 2);
    expect(payload.name_de).toBe('Spaziergang');
    expect(payload.cardio).not.toHaveProperty('walk_kind');
    expect(route).not.toHaveProperty('walk_kind');
    expect(route).not.toHaveProperty('sac_grade');
    expect((await backend.loadTrackedRoutes()).routes[0]).toMatchObject({
      walk_kind: null,
      sac_grade: null,
    });
  });

  it('Art nachträglich ändern → Eintrag folgt (Name, Revision + 1); weg vom Wandern entfernt die SAC-Stufe', async () => {
    const { backend, draft, route } = await hike('hike', 3);
    const before = (await backend.loadRows()).rows.sessionLogs.find((l) => l.id === draft.logId);
    const base = {
      id: route.id,
      name: 'Hausberg',
      difficulty: null,
      is_favorite: false,
      note: null,
    };
    await backend.updateTrackedRoute({ ...base, walk_kind: 'mountain_hike' });
    let rows = (await backend.loadRows()).rows;
    expect(rows.cardioLogs.find((c) => c.session_log_id === draft.logId)?.walk_kind).toBe(
      'mountain_hike',
    );
    const after = rows.sessionLogs.find((l) => l.id === draft.logId);
    expect(after?.name_de).toBe('Bergwanderung');
    expect(after?.revision).toBe((before?.revision ?? 0) + 1);
    expect((await backend.loadTrackedRoutes()).routes[0]).toMatchObject({
      walk_kind: 'mountain_hike',
      sac_grade: 3,
    });
    await backend.updateTrackedRoute({ ...base, walk_kind: null });
    rows = (await backend.loadRows()).rows;
    expect(rows.sessionLogs.find((l) => l.id === draft.logId)?.name_de).toBe('Spaziergang');
    expect((await backend.loadTrackedRoutes()).routes[0]).toMatchObject({
      walk_kind: null,
      sac_grade: null,
    });
    // SAC ohne Wandern → abgelehnt (wie der CHECK der Datenbank).
    await expect(backend.updateTrackedRoute({ ...base, sac_grade: 2 })).rejects.toMatchObject({
      code: 'route_rejected',
    });
  });

  it('Bein-Hinweis am Folgetag nach langer Wanderung (Quelle „hike“)', async () => {
    const { backend, draft } = await hike('hike');
    const rows = (await backend.loadRows()).rows;
    const log = rows.sessionLogs.find((l) => l.id === draft.logId);
    const cardio = rows.cardioLogs.find((c) => c.session_log_id === draft.logId);
    if (!log || !cardio) throw new Error('Eintrag fehlt');
    // ca. 40 min Wanderung (unter 120 min), aber 650 Hm Abstieg laut Strecke → zählt.
    const dayBefore = '2026-10-26';
    const input = {
      sessionLogs: rows.sessionLogs.map((l) =>
        l.id === log.id ? { ...l, performed_on: dayBefore } : l,
      ),
      cardioLogs: rows.cardioLogs,
      plans: [{ id: 'p1', status: 'active' }],
      plannedSessions: [
        {
          id: 's1',
          plan_id: 'p1',
          scheduled_on: '2026-10-27',
          status: 'planned',
          kind: 'strength',
          focus: 'lower',
          endurance_modality: null,
          effort_target: null,
          workout_type: null,
        },
      ],
    } as unknown as Parameters<typeof legLoadHintsFromRows>[0];
    expect(cardio.duration_s).toBeLessThan(120 * 60);
    expect(legLoadHintsFromRows(input, '2026-10-27', [])).toEqual([]);
    const withDescent = legLoadHintsFromRows(input, '2026-10-27', [
      { session_log_id: log.id, elevation_loss_m: 650 },
    ]);
    expect(withDescent).toMatchObject([
      { sessionId: 's1', sport: 'hike', reason: 'strength_legs' },
    ]);
  });
});
