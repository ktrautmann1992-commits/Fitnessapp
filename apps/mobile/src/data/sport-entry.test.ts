import { randomUUID } from 'node:crypto';

import { toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, USER_ID, VERSIONS } from '../test/fixtures';
import type { Backend } from './backend';
import { createLocalBackend } from './local-backend';
import { checkSessionLog } from './local-rules';
import { createMemoryProtectedStore } from './protected-store';
import {
  createSportDraft,
  legLoadHintsFromRows,
  recentSportsFromRows,
  sportDraftResult,
  sportWeekFromRows,
} from './sport-entry';
import { generatePlanFromRows } from './training-plan';
import type { SessionLogRow, UserRows } from './types';
import { weekStatusFromRows } from './week-status';
import { draftToPayload, isValidPayload } from './workout-draft';

/**
 * Sportarten Stufe 2 im Testmodus (docs/PLAN-SPORTARTEN.md): Sportart eintragen (Entwurf → Eintrag → Regeln wie
 * save_session_log), Woche, Summen je Sportart, zuletzt genutzt und Plan-Hinweis nach Sport mit hoher Beinbelastung.
 */

const MONDAY = '2026-10-05';
const NOW = `${MONDAY}T17:00:00.000Z`;

async function setup(): Promise<{ backend: Backend; rows: UserRows }> {
  const person = planPersonRows();
  const seeded = seededBackend(person, MONDAY, `${MONDAY}T08:00:00.000Z`);
  const backend = createLocalBackend(seeded.store, {
    platform: 'web',
    today: () => MONDAY,
    now: () => NOW,
    newId: randomUUID,
    draftStore: createMemoryProtectedStore(),
  });
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(person, VERSIONS, library, MONDAY);
  if (!result.ok) throw new Error(result.error);
  await backend.savePlan(toSavePlanPayload(result.plan), person);
  const { rows } = await backend.loadRows();
  return { backend, rows };
}

const padelDraft = (performedOn = MONDAY, extra: { hours?: string; minutes?: string } = {}) =>
  createSportDraft({
    ownerUserId: USER_ID,
    sport: {
      sport: 'padel',
      hours: extra.hours ?? '1',
      minutes: extra.minutes ?? '0',
      distanceKm: '',
    },
    performedOn,
    today: MONDAY,
    effort: 6,
    notes: '',
    now: NOW,
    newId: randomUUID,
  });

function padelRow(): SessionLogRow {
  return {
    id: 'p1',
    user_id: USER_ID,
    planned_session_id: null,
    kind: 'strength',
    performed_on: MONDAY,
    started_at: null,
    finished_at: null,
    status: 'completed',
    session_rpe: 6,
    notes: null,
    name_de: 'Padel',
    is_intro_week: false,
    is_deload: false,
    from_health_plan: false,
    is_free: true,
    revision: 1,
    last_write_id: 'w',
    source: 'manual',
    client_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    sport: 'padel',
    sport_duration_s: 3600,
    sport_distance_m: null,
    hyrox_splits: null,
  };
}

describe('Entwurf → Eintrag', () => {
  it('Padel 60 min: freie Einheit „strength“ ohne Übungen mit Sportart (Zod-gültig)', () => {
    const draft = padelDraft();
    expect(draft).toMatchObject({ kind: 'strength', isFree: true, nameDe: 'Padel', exercises: [] });
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(isValidPayload(payload)).toBe(true);
    expect(payload.sport).toEqual({ sport: 'padel', duration_s: 3600, distance_m: null });
    expect(payload.session_rpe).toBe(6);
  });

  it('ungültige Eingabe → Eintrag, den das Schema ablehnt (nie ungeprüft gesendet)', () => {
    const draft = padelDraft(MONDAY, { hours: '', minutes: '' });
    expect(sportDraftResult(draft, { writeId: 'w', now: NOW, today: MONDAY })).toEqual({
      ok: false,
      errors: ['duration_missing'],
    });
    expect(
      isValidPayload(draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY })),
    ).toBe(false);
  });

  it('GPS-Sportart mit Distanz „12,5“', () => {
    const draft = createSportDraft({
      ownerUserId: USER_ID,
      sport: { sport: 'cross_country_skiing', hours: '1', minutes: '30', distanceKm: '12,5' },
      performedOn: MONDAY,
      today: MONDAY,
      effort: null,
      notes: '',
      now: NOW,
      newId: randomUUID,
    });
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(payload.sport).toEqual({
      sport: 'cross_country_skiing',
      duration_s: 5400,
      distance_m: 12_500,
    });
  });
});

describe('Testmodus: Speichern wie save_session_log', () => {
  it('Padel gespeichert; Zeile mit Sportart, Dauer; Woche zeigt Padel, zählt für keine geplante Einheit', async () => {
    const s = await setup();
    const draft = padelDraft();
    expect(
      await s.backend.submitWorkout(
        draft,
        draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY }),
      ),
    ).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const { rows } = await s.backend.loadRows();
    const log = rows.sessionLogs.find((l) => l.id === draft.logId);
    expect(log).toMatchObject({
      kind: 'strength',
      name_de: 'Padel',
      is_free: true,
      sport: 'padel',
      sport_duration_s: 3600,
      sport_distance_m: null,
      session_rpe: 6,
    });
    const status = weekStatusFromRows(rows, {
      weekOf: MONDAY,
      today: MONDAY,
      assignments: [],
      kcalOf: () => 545,
    });
    const entry = status.days.flatMap((d) => d.entries).find((e) => e.logId === draft.logId);
    expect(entry).toMatchObject({
      name_de: 'Padel',
      sport: 'padel',
      durationS: 3600,
      kcal: 545,
      fulfils: null,
    });
    const week = sportWeekFromRows(rows, MONDAY, () => 545);
    expect(week.sports).toEqual([
      { sport: 'padel', sessions: 1, durationS: 3600, distanceM: null, kcal: 545, load: 360 },
    ]);
    expect(recentSportsFromRows(rows)).toEqual(['padel']);
  });

  it('Sportart wechselt nie zu Kraft/Ausdauer (wie der Server)', async () => {
    const s = await setup();
    const draft = padelDraft();
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    await s.backend.submitWorkout(draft, payload);
    const { rows } = await s.backend.loadRows();
    const changed = {
      ...payload,
      write_id: randomUUID(),
      base_revision: 1,
      kind: 'endurance' as const,
      name_de: 'Lauf',
      cardio: { modality: 'run' as const, duration_s: 1800, distance_m: null, elevation_m: null },
      sport: null,
    };
    expect(
      checkSessionLog(changed, {
        today: MONDAY,
        rows,
        exercises: new Map(),
        healthConsentValid: true,
        createdToday: 0,
      }),
    ).toEqual({ kind: 'reject', reason: 'invalid' });
  });
});

describe('Uhr-Einheit „Sonstige“ (Health Connect)', () => {
  it('„Tennis“ von der Uhr: Sportart aus dem Titel, Dauer aus Beginn/Ende, in Woche und Summen', async () => {
    const s = await setup();
    const watch = {
      ...padelRow(),
      id: 'hc1',
      name_de: 'Tennis',
      source: 'health_connect' as const,
      started_at: `${MONDAY}T07:00:00.000Z`,
      finished_at: `${MONDAY}T08:30:00.000Z`,
      session_rpe: null,
      sport: null,
      sport_duration_s: null,
    };
    const rows = { ...s.rows, sessionLogs: [...s.rows.sessionLogs, watch] };
    const week = sportWeekFromRows(rows, MONDAY, () => 812);
    expect(week.sports).toEqual([
      { sport: 'tennis', sessions: 1, durationS: 5400, distanceM: null, kcal: 812, load: 540 },
    ]);
    const status = weekStatusFromRows(rows, { weekOf: MONDAY, today: MONDAY, assignments: [] });
    expect(status.days.flatMap((d) => d.entries).find((e) => e.logId === 'hc1')).toMatchObject({
      sport: 'tennis',
      fromWatch: true,
      durationS: 5400,
      fulfils: null,
    });
  });
});

describe('Plan-Hinweis nach Sport mit hoher Beinbelastung', () => {
  it('Fußball am Vortag einer Bein-/Ganzkörper-Einheit → Hinweis; Klettern → keiner', async () => {
    const s = await setup();
    const target = s.rows.plannedSessions
      .filter((p) => p.status === 'planned' && p.scheduled_on >= MONDAY && p.kind === 'strength')
      .find((p) => p.focus === 'lower' || p.focus === 'full_body');
    if (!target) throw new Error('keine Bein-Einheit im Testplan');
    const dayBefore = new Date(Date.parse(`${target.scheduled_on}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const football: SessionLogRow = {
      ...padelRow(),
      id: 'f1',
      user_id: USER_ID,
      planned_session_id: null,
      kind: 'strength',
      performed_on: dayBefore,
      started_at: null,
      finished_at: null,
      status: 'completed',
      session_rpe: 7,
      notes: null,
      name_de: 'Fußball',
      is_intro_week: false,
      is_deload: false,
      from_health_plan: false,
      is_free: true,
      revision: 1,
      last_write_id: 'w',
      source: 'manual',
      client_updated_at: NOW,
      created_at: NOW,
      updated_at: NOW,
      sport: 'football',
      sport_duration_s: 5400,
      sport_distance_m: null,
      hyrox_splits: null,
    };
    const rows = { ...s.rows, sessionLogs: [...s.rows.sessionLogs, football] };
    const today = dayBefore < MONDAY ? MONDAY : dayBefore;
    expect(legLoadHintsFromRows(rows, today)).toContainEqual(
      expect.objectContaining({ sessionId: target.id, sport: 'football', reason: 'strength_legs' }),
    );
    const climbing = { ...football, sport: 'climbing' as const, name_de: 'Klettern' };
    expect(
      legLoadHintsFromRows({ ...s.rows, sessionLogs: [climbing] }, today).filter(
        (h) => h.sessionId === target.id,
      ),
    ).toEqual([]);
  });
});
