import { toSaveCompetitionPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  applySaveCompetition,
  cancelInRows,
  checkSaveInRows,
  completeInRows,
  deleteInRows,
  detachResultLog,
} from './competition-rows';
import type { UserRows } from './types';
import { applyHealthDataRevocation, cacheableRows, withoutPlanBasis } from './write-ops';

/** Wettkämpfe im Testmodus (WP4): Zeilen wie save/cancel/complete/delete_competition und der Widerruf. */

const base = (): UserRows => {
  const rows = planPersonRows({ goal: 'endurance', level: 'advanced' });
  return { ...rows, goals: rows.goals && { ...rows.goals, discipline: 'half_marathon' } };
};
const payload = (plan: boolean) =>
  toSaveCompetitionPayload({
    id: null,
    competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: '2027-01-31' },
    plan: plan ? { effectiveGoal: 'finish' } : null,
  });
const ctx = { userId: USER_ID, now: '2026-10-03T10:00:00.000Z', newId: () => 'c-1' };

describe('Wettkampf-Zeilen', () => {
  it('anlegen: Plan-Bezug setzt uses_health_data, Zieldatum wird mitgeführt', () => {
    const rows = base();
    expect(checkSaveInRows(rows, payload(true), { today: TODAY, versions: VERSIONS })).toEqual({
      ok: true,
    });
    const saved = applySaveCompetition(rows, payload(true), ctx);
    expect(saved.id).toBe('c-1');
    expect(saved.rows.competitions[0]).toMatchObject({
      status: 'planned',
      uses_health_data: true,
      distance_m: 21_097.5,
    });
    expect(saved.rows.goals?.target_date).toBe('2027-01-31');
  });
  it('Schwangerschaft: kein Plan-Bezug', () => {
    const rows = planPersonRows({ goal: 'endurance', flags: ['pregnancy'] });
    expect(checkSaveInRows(rows, payload(true), { today: TODAY, versions: VERSIONS })).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(checkSaveInRows(rows, payload(false), { today: TODAY, versions: VERSIONS }).ok).toBe(
      true,
    );
  });
  it('absagen leert das Zieldatum (nur wenn es der Renntag war); abschließen mit Ergebnis; löschen', () => {
    const rows = applySaveCompetition(base(), payload(false), ctx).rows;
    const cancelled = cancelInRows(rows, 'c-1', ctx.now);
    if (!cancelled.ok) throw new Error('abgelehnt');
    expect(cancelled.rows.competitions[0]?.status).toBe('cancelled');
    expect(cancelled.rows.goals?.target_date).toBeNull();
    expect(cancelInRows(cancelled.rows, 'c-1', ctx.now)).toEqual({
      ok: false,
      reason: 'not_planned',
    });
    expect(completeInRows(rows, 'c-1', null, { today: TODAY, now: ctx.now })).toEqual({
      ok: false,
      reason: 'result_rejected',
    });
    const raceDay = {
      ...rows,
      sessionLogs: [
        { id: 'log', kind: 'endurance', performed_on: '2027-01-31' },
      ] as UserRows['sessionLogs'],
    };
    const done = completeInRows(raceDay, 'c-1', 'log', { today: '2027-01-31', now: ctx.now });
    if (!done.ok) throw new Error('abgelehnt');
    expect(done.rows.competitions[0]).toMatchObject({
      status: 'done',
      result_session_log_id: 'log',
    });
    expect(detachResultLog(done.rows, 'log').competitions[0]).toMatchObject({
      status: 'done',
      result_session_log_id: null,
    });
    const deleted = deleteInRows(rows, 'c-1');
    expect(deleted.ok && deleted.rows.competitions).toEqual([]);
    expect(deleted.ok && deleted.rows.goals?.target_date).toBeNull();
    expect(deleteInRows(rows, 'x')).toEqual({ ok: false, reason: 'not_found' });
  });
  it('Widerruf und Zwischenspeicher: Wettkampf bleibt, Plan-Bezug leer', () => {
    const rows = applySaveCompetition(base(), payload(true), ctx).rows;
    const revoked = applyHealthDataRevocation(rows);
    expect(revoked.competitions[0]).toMatchObject({
      status: 'planned',
      effective_goal: null,
      uses_health_data: false,
      start_reference_volume: null,
    });
    expect(cacheableRows(rows, { allowHealthPlanCache: true }).rows.competitions[0]).toMatchObject({
      effective_goal: null,
      uses_health_data: false,
    });
    const plain = applySaveCompetition(base(), payload(false), ctx).rows.competitions[0];
    if (!plain) throw new Error('fehlt');
    expect(withoutPlanBasis(plain)).toBe(plain);
  });
});
