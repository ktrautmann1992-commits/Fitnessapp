import { toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, VERSIONS } from '../test/fixtures';
import { isValidPlanOp } from './local-rules';
import { nutritionInputsFromRows, trainingMealProtectionFromRows } from './nutrition-plan';
import { activePlan, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';
import { applyWriteOps } from './write-ops';

/**
 * Nährstoff-Timing (docs/PLAN-NAEHRSTOFF-TIMING.md, Etappe T2): Uhrzeit an der Einheit im Testmodus wie der Server
 * (Trigger + CHECK), Durchreichen an die Ernährungs-Engine, gegessene Mahlzeiten als Schutz beim Verschieben.
 */
async function savedPlan(rows: UserRows) {
  const { backend } = seededBackend(rows, TODAY, `${TODAY}T08:00:00.000Z`);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(rows, VERSIONS, library, TODAY);
  if (!result.ok) throw new Error(result.error);
  const saved = await backend.savePlan(toSavePlanPayload(result.plan), rows);
  const active = activePlan(saved);
  if (!active) throw new Error('kein Plan');
  return { backend, library, saved, active };
}

describe('Uhrzeit an der Einheit (Testmodus wie der Server)', () => {
  it('setzen, prüfen, beim Verschieben mitnehmen, entfernen', async () => {
    const { backend, library, saved, active } = await savedPlan(planPersonRows());
    const future = active.sessions.find((s) => s.scheduled_on > TODAY && !s.is_deload);
    if (!future) throw new Error('keine Einheit');
    const base = {
      sessionId: future.id,
      planId: active.plan.id,
      usesHealthData: active.plan.uses_health_data,
      scheduledOn: future.scheduled_on,
      status: 'planned' as const,
    };
    const ctx = { today: TODAY, rows: saved, versions: VERSIONS, library };
    expect(
      isValidPlanOp({ kind: 'update_planned_session', ...base, startTime: '18:30' }, ctx),
    ).toBe(true);
    for (const bad of ['24:00', '7:05', '18:30:00']) {
      expect(isValidPlanOp({ kind: 'update_planned_session', ...base, startTime: bad }, ctx)).toBe(
        false,
      );
    }
    const timed = await backend.updatePlannedSession({ ...base, startTime: '18:30' }, saved);
    expect(timed.plannedSessions.find((s) => s.id === future.id)?.start_time).toBe('18:30');
    await expect(
      backend.updatePlannedSession({ ...base, startTime: '25:00' }, timed),
    ).rejects.toThrow();
    // Ohne Feld bleibt die Uhrzeit (Verschieben einer älteren App-Fassung).
    const same = applyWriteOps(timed, [{ kind: 'update_planned_session', ...base }], {
      now: `${TODAY}T08:00:00.000Z`,
      newId: () => 'x',
      flagsFor: () => [],
    });
    expect(same.plannedSessions.find((s) => s.id === future.id)?.start_time).toBe('18:30');
    const removed = await backend.updatePlannedSession({ ...base, startTime: null }, timed);
    expect(removed.plannedSessions.find((s) => s.id === future.id)?.start_time).toBeNull();
  });
});

describe('Ernährung: Uhrzeit und gegessene Mahlzeiten', () => {
  it('startMinutes nur mit eigener Uhrzeit (sonst fehlt das Feld – Engine wie bisher)', async () => {
    const { saved, active } = await savedPlan(planPersonRows());
    const first = active.sessions[0];
    if (!first) throw new Error();
    const rows: UserRows = {
      ...saved,
      plannedSessions: saved.plannedSessions.map((s) =>
        s.id === first.id ? { ...s, start_time: '06:45:00' } : s,
      ),
    };
    const week = nutritionInputsFromRows(rows, VERSIONS, TODAY, first.scheduled_on);
    const sessions = week?.sessions ?? [];
    expect(sessions.find((s) => s.sessionId === first.id)?.startMinutes).toBe(405);
    expect(
      sessions.filter((s) => s.sessionId !== first.id).every((s) => !('startMinutes' in s)),
    ).toBe(true);
  });

  it('Essen nach dem Training: erledigte Einheit mit echtem Beginn, freie Einheit (Uhr) mit Beginn', async () => {
    const { saved, active } = await savedPlan(planPersonRows());
    const [first, second] = active.sessions;
    if (!first || !second) throw new Error();
    const log = (extra: Partial<UserRows['sessionLogs'][number]>) =>
      ({
        id: 'l',
        planned_session_id: null,
        is_free: false,
        status: 'completed',
        kind: 'strength',
        performed_on: first.scheduled_on,
        session_rpe: null,
        sport_duration_s: null,
        started_at: null,
        client_updated_at: `${first.scheduled_on}T12:00:00.000Z`,
        ...extra,
      }) as UserRows['sessionLogs'][number];
    const rows: UserRows = {
      ...saved,
      plannedSessions: saved.plannedSessions.map((s) =>
        s.id === first.id
          ? { ...s, status: 'completed', start_time: '18:00:00' }
          : s.id === second.id
            ? { ...s, status: 'completed', start_time: '19:00:00' }
            : s,
      ),
      sessionLogs: [
        // Älterer Eintrag derselben Einheit zählt nicht.
        log({
          id: 'old',
          planned_session_id: first.id,
          started_at: `${first.scheduled_on}T04:00:00.000Z`,
          client_updated_at: `${first.scheduled_on}T05:00:00.000Z`,
        }),
        log({
          id: 'p1',
          planned_session_id: first.id,
          started_at: `${first.scheduled_on}T05:10:00.000Z`,
        }),
        // Erledigt ohne Beginn → geplante Uhrzeit bleibt.
        log({ id: 'p2', planned_session_id: second.id, performed_on: second.scheduled_on }),
        // Freie Einheit von der Uhr.
        log({
          id: 'w',
          is_free: true,
          source: 'health_connect',
          started_at: `${first.scheduled_on}T15:30:00.000Z`,
        }),
      ],
    };
    const week = nutritionInputsFromRows(rows, VERSIONS, TODAY, first.scheduled_on);
    const sessions = week?.sessions ?? [];
    // Oktober: Sommerzeit (UTC+2) bis 25.10. – die Fixture-Woche liegt davor.
    const offset = first.scheduled_on < '2026-10-25' ? 120 : 60;
    expect(sessions.find((s) => s.sessionId === first.id)?.startMinutes).toBe(5 * 60 + 10 + offset);
    expect(sessions.find((s) => s.sessionId === second.id)?.startMinutes).toBe(19 * 60);
    expect(sessions.find((s) => s.sessionId === 'free:w')?.startMinutes).toBe(
      15 * 60 + 30 + offset,
    );
  });

  it('Schutz mit „jetzt“: Feld nur, wenn übergeben', () => {
    const rows = planPersonRows();
    expect('now' in trainingMealProtectionFromRows(rows)).toBe(false);
    expect(trainingMealProtectionFromRows(rows, { date: TODAY, minutes: 600 }).now).toEqual({
      date: TODAY,
      minutes: 600,
    });
  });

  it('gegessen = Plan-Einträge des Tagebuchs als datum|platz', () => {
    const rows = planPersonRows();
    const entry = (source: string, slot: string | null) =>
      ({ source, slot, eaten_on: '2026-10-05' }) as unknown as UserRows['foodLogEntries'][number];
    const protection = trainingMealProtectionFromRows({
      ...rows,
      foodLogEntries: [
        entry('plan_item', 'lunch'),
        entry('quick', 'dinner'),
        entry('plan_item', null),
      ],
    });
    expect([...protection.eaten]).toEqual(['2026-10-05|lunch']);
  });
});
