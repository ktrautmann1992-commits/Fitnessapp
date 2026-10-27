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
