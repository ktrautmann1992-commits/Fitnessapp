import {
  summarizeTrack,
  type TrackPoint,
  toTrackedRoutePayload,
  type TrackedRoutePayload,
  type TrackedRouteSport,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, TODAY, USER_ID, uuidBackend } from '../test/fixtures';
import type { TrackedRoutesResult } from './backend';
import { recordingDiaryDraft } from './route-diary';
import { routeById, routeFacts, routeForLog } from './route-view';
import { emptyUserRows } from './types';
import { draftToPayload } from './workout-draft';

/** Gerade Strecke nach Norden mit leichtem Auf und Ab, Ende 10 min vor NOW. */
function track(count = 900, speed = 2.8): TrackPoint[] {
  const end = Date.parse(NOW) - 600_000;
  const start = end - (count - 1) * 2000;
  return Array.from({ length: count }, (_, i) => ({
    lat: 50.9 + (i * 2 * speed) / 111_195,
    lng: 6.95,
    t: start + i * 2000,
    accuracyM: 4,
    altitudeM: 50 + (i % 100) / 10,
  }));
}

let uuid = 500;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`;

function payloadFor(
  sport: TrackedRouteSport,
  patch: Partial<{
    id: string;
    sessionLogId: string | null;
    eBike: boolean;
    walkKind: 'hike' | 'mountain_hike' | null;
  }> = {},
): TrackedRoutePayload {
  const payload = toTrackedRoutePayload(summarizeTrack(track(), sport), {
    id: patch.id ?? nextUuid(),
    name: 'Runde',
    difficulty: null,
    isFavorite: false,
    note: null,
    baseRouteId: null,
    sessionLogId: patch.sessionLogId ?? null,
    source: 'recorded',
    eBike: patch.eBike ?? false,
    walkKind: patch.walkKind ?? null,
  });
  if (!payload) throw new Error('kein Payload');
  return payload;
}

/** Testmodus: Tagebuch-Eintrag aus einer Aufzeichnung, danach die Strecke mit Verweis (wie SaveView). */
async function recordedRun() {
  const { backend } = uuidBackend(planPersonRows());
  const rows = (await backend.loadRows()).rows;
  const draft = recordingDiaryDraft(rows, summarizeTrack(track(), 'run'), {
    plannedSessionId: null,
    ownerUserId: USER_ID,
    today: TODAY,
    now: NOW,
    newId: nextUuid,
  });
  if (!draft) throw new Error('kein Entwurf');
  await backend.submitWorkout(
    draft,
    draftToPayload(draft, { writeId: nextUuid(), now: NOW, today: TODAY }),
  );
  const payload = payloadFor('run', { sessionLogId: draft.logId });
  await backend.saveTrackedRoute(payload);
  return {
    logId: draft.logId,
    routeId: payload.id,
    rows: (await backend.loadRows()).rows,
    result: await backend.loadTrackedRoutes(),
  };
}

function result(patch: Partial<TrackedRoutesResult>): TrackedRoutesResult {
  return { routes: [], pending: [], offline: false, ...patch };
}

describe('routeForLog – gehört zum Tagebuch-Eintrag eine aufgezeichnete Strecke?', () => {
  it('Aufzeichnung mit Eintrag: gespeicherte Strecke wird gefunden (volle Auswertung im Eintrag)', async () => {
    const { logId, routeId, result: loaded } = await recordedRun();
    const ref = routeForLog(loaded, logId);
    expect(ref?.saved?.id).toBe(routeId);
    expect(ref?.pending).toBeNull();
  });

  it('Eintrag ohne Strecke (manuell, Uhr ohne GPS), leere id oder nichts geladen → null (schlichte Seite)', async () => {
    const { result: loaded } = await recordedRun();
    expect(routeForLog(loaded, 'anderer-eintrag')).toBeNull();
    expect(routeForLog(loaded, '')).toBeNull();
    expect(routeForLog(null, 'x')).toBeNull();
    expect(routeForLog(result({}), 'x')).toBeNull();
  });

  it('noch nicht übertragene Strecke (offline gespeichert) zählt auch', () => {
    const logId = nextUuid();
    const payload = payloadFor('run', { sessionLogId: logId });
    const ref = routeForLog(result({ pending: [{ payload, state: 'waiting' }] }), logId);
    expect(ref?.pending?.payload.id).toBe(payload.id);
    expect(ref?.saved).toBeNull();
  });

  it('wartende Kopie einer schon gespeicherten Strecke wird ignoriert, gespeicherte gewinnt', async () => {
    const { logId, routeId, result: loaded } = await recordedRun();
    const copy = payloadFor('run', { id: routeId, sessionLogId: logId });
    const ref = routeForLog({ ...loaded, pending: [{ payload: copy, state: 'waiting' }] }, logId);
    expect(ref?.saved?.id).toBe(routeId);
    const stale = {
      ...loaded,
      routes: [],
      pending: [{ payload: copy, state: 'rejected' as const }],
    };
    expect(routeForLog(stale, logId)?.pending?.state).toBe('rejected');
  });
});

describe('routeById', () => {
  it('gespeichert, wartend, unbekannt', async () => {
    const { routeId, result: loaded } = await recordedRun();
    expect(routeById(loaded, routeId)?.saved?.id).toBe(routeId);
    const payload = payloadFor('bike');
    const withPending = { ...loaded, pending: [{ payload, state: 'waiting' as const }] };
    expect(routeById(withPending, payload.id)?.pending?.payload.id).toBe(payload.id);
    expect(routeById(withPending, 'gibt-es-nicht')).toBeNull();
    expect(routeById(withPending, null)).toBeNull();
    expect(routeById(null, routeId)).toBeNull();
  });
});

describe('routeFacts – Zahlen der Auswertung', () => {
  it('Lauf: Tag, Kilometerzeiten, Höhenprofil, kein E-Bike, keine Geh-Art', async () => {
    const { rows, routeId, logId, result: loaded } = await recordedRun();
    const facts = routeFacts(rows, routeById(loaded, routeId)!);
    expect(facts.info.id).toBe(routeId);
    expect(facts.info.session_log_id).toBe(logId);
    expect(facts.day).toBe(TODAY);
    expect(facts.kmSplits.length).toBeGreaterThan(0);
    expect(facts.profile?.length).toBeGreaterThan(2);
    expect(facts.polyline).not.toBeNull();
    expect(facts.eBike).toBe(false);
    expect(facts.walkKind).toBeNull();
    expect(facts.watch).toBe(false);
    expect(facts.gainM).not.toBeNull();
  });

  it('Rad: der verknüpfte Eintrag ist führend für E-Bike (auch gegen die Angabe der Strecke)', async () => {
    const { rows, logId } = await recordedRun();
    const bikeRows = {
      ...rows,
      cardioLogs: rows.cardioLogs.map((c) =>
        c.session_log_id === logId ? { ...c, modality: 'bike' as const, e_bike: true } : c,
      ),
    };
    const payload = payloadFor('bike', { sessionLogId: logId, eBike: false });
    const ref = { saved: null, pending: { payload, state: 'waiting' as const } };
    expect(routeFacts(bikeRows, ref).eBike).toBe(true);
    // Ohne Eintrag zählt die Strecke.
    const free = payloadFor('bike', { eBike: true });
    expect(
      routeFacts(emptyUserRows(), { saved: null, pending: { payload: free, state: 'waiting' } })
        .eBike,
    ).toBe(true);
  });

  it('Gehen/Wandern: Art aus der Strecke, sonst „Gehen“; Abstieg/höchster Punkt aus dem Profil', () => {
    const hike = payloadFor('walk', { walkKind: 'hike' });
    const facts = routeFacts(emptyUserRows(), {
      saved: null,
      pending: { payload: hike, state: 'waiting' },
    });
    expect(facts.walkKind).toBe('hike');
    expect(facts.maxAltM).not.toBeNull();
    const walk = payloadFor('walk');
    expect(
      routeFacts(emptyUserRows(), { saved: null, pending: { payload: walk, state: 'waiting' } })
        .walkKind,
    ).toBe('walk');
  });
});
