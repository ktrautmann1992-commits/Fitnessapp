import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { toSavePlanPayload, type SavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { localBackendOn, planPersonRows, seededBackend, TODAY, VERSIONS } from '../test/fixtures';
import { isValidPlanOp } from './local-rules';
import {
  activePlan,
  generatePlanFromRows,
  movableSessions,
  moveTargetsInRows,
  validateMoveInRows,
} from './training-plan';
import type { UserRows } from './types';
import {
  applyHealthDataRevocation,
  applyWriteOps,
  cacheableRows,
  isDirectOp,
  isSensitiveOp,
  needsHealthConsent,
  type WriteOp,
} from './write-ops';

/**
 * Trainingspläne in der Datenebene (Etappe C): Regeln des Testmodus wie die Datenbank, Widerruf, was auf das
 * Gerät darf, allowDrafts nur im Testmodus.
 */

async function generated(rows: UserRows, today = TODAY) {
  const { backend, store } = seededBackend(rows, today, `${today}T08:00:00.000Z`);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(rows, VERSIONS, library, today);
  if (!result.ok) throw new Error(result.error);
  return { backend, store, library, payload: toSavePlanPayload(result.plan) };
}

describe('allowDrafts nur im Testmodus', () => {
  it('„allowDrafts: true“ steht ausschließlich in createLocalBackend (local-backend.ts)', () => {
    const root = join(__dirname, '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== 'generated' && name !== 'test') walk(path);
        } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          if (/allowDrafts:\s*true/.test(readFileSync(path, 'utf8'))) hits.push(name);
        }
      }
    };
    walk(root);
    expect(hits).toEqual(['local-backend.ts']);
  });
});

describe('Testmodus: Regeln wie save_training_plan', () => {
  it('speichert einen gültigen Plan; zweiter Plan ersetzt den ersten', async () => {
    const { backend, payload } = await generated(planPersonRows());
    const first = await backend.savePlan(payload, planPersonRows());
    expect(first.plans).toHaveLength(1);
    const second = await backend.savePlan(payload, first);
    expect(second.plans.map((p) => p.status).sort()).toEqual(['active', 'replaced']);
    // Geplante Einheiten des alten Plans ab gestern entfallen, nie zwei Einheiten an einem Tag.
    const dates = second.plannedSessions
      .filter((s) => s.status !== 'skipped')
      .map((s) => s.scheduled_on);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('lehnt uses_health_data = false trotz gültigem Check ab (und umgekehrt)', async () => {
    const rows = planPersonRows();
    const { backend, payload } = await generated(rows);
    await expect(
      backend.savePlan({ ...payload, uses_health_data: false, medical_notice: false }, rows),
    ).rejects.toMatchObject({ code: 'plan_rejected' });
    await expect(
      backend.savePlan({ ...payload, medical_notice: true }, rows),
    ).rejects.toMatchObject({ code: 'plan_rejected' });
    // Ohne gültige Einwilligung: Plan mit Gesundheitsbezug braucht die Einwilligung.
    const outdated = planPersonRows({ consent: 'outdated' });
    const other = seededBackend(outdated);
    await expect(other.backend.savePlan(payload, outdated)).rejects.toMatchObject({
      code: 'consent_required',
    });
  });

  it('lehnt fremde Felder, falsche Vorlage, Datum außerhalb und Dosierung über den Grenzen ab', async () => {
    const rows = planPersonRows();
    const { library, payload } = await generated(rows);
    const ctx = { today: TODAY, rows, versions: VERSIONS, library };
    const check = (p: SavePlanPayload) =>
      isValidPlanOp({ kind: 'save_training_plan', payload: p }, ctx);
    expect(check(payload)).toBe(true);
    expect(check({ ...payload, user_id: 'x' } as unknown as SavePlanPayload)).toBe(false);
    expect(check({ ...payload, template_version: 99 })).toBe(false);
    expect(check({ ...payload, start_date: '2026-09-01' })).toBe(false);
    const [first, ...rest] = payload.sessions;
    if (!first) throw new Error();
    const tooHard = {
      ...first,
      exercises: first.exercises.map((e) => ({ ...e, rpe_target: 10 })),
    };
    expect(check({ ...payload, sessions: [tooHard, ...rest] })).toBe(false);
    const stacked = { ...first, scheduled_on: rest[0]?.scheduled_on ?? first.scheduled_on };
    expect(check({ ...payload, sessions: [stacked, ...rest] })).toBe(false);
  });
});

describe('Testmodus: Verschieben wie der Trigger', () => {
  it('nur gleiche ISO-Woche, nicht vor heute, Erholungswoche nur streichen, original_date beim ersten Mal', async () => {
    const rows = planPersonRows();
    const { backend, payload, library } = await generated(rows);
    const saved = await backend.savePlan(payload, rows);
    const active = activePlan(saved);
    if (!active) throw new Error();
    const monday = active.sessions.find((s) => s.scheduled_on === '2026-10-05');
    if (!monday) throw new Error();
    const ctx = { today: TODAY, rows: saved, versions: VERSIONS, library };
    const update = (
      scheduledOn: string,
      status: 'planned' | 'skipped' = 'planned',
      id = monday.id,
    ) =>
      isValidPlanOp(
        {
          kind: 'update_planned_session',
          sessionId: id,
          planId: active.plan.id,
          usesHealthData: true,
          scheduledOn,
          status,
        },
        ctx,
      );
    expect(update('2026-10-06')).toBe(true);
    expect(update('2026-10-12')).toBe(false); // nächste Woche
    expect(update('2026-10-02')).toBe(false); // vor heute
    expect(update('2026-10-07')).toBe(false); // Mittwoch belegt
    expect(update('2026-10-05', 'skipped')).toBe(true);
    const deload = active.sessions.find((s) => s.is_deload);
    if (!deload) throw new Error();
    // Woche der Erholungseinheit liegt in der Zukunft – Regel „nur streichen“ gilt trotzdem.
    expect(update('2026-11-15', 'planned', deload.id)).toBe(false);

    const moved = await backend.updatePlannedSession(
      {
        sessionId: monday.id,
        planId: active.plan.id,
        usesHealthData: true,
        scheduledOn: '2026-10-06',
        status: 'planned',
      },
      saved,
    );
    const again = await backend.updatePlannedSession(
      {
        sessionId: monday.id,
        planId: active.plan.id,
        usesHealthData: true,
        scheduledOn: '2026-10-08',
        status: 'planned',
      },
      moved,
    );
    expect(again.plannedSessions.find((s) => s.id === monday.id)).toMatchObject({
      scheduled_on: '2026-10-08',
      original_date: '2026-10-05',
    });
    const skipped = await backend.updatePlannedSession(
      {
        sessionId: monday.id,
        planId: active.plan.id,
        usesHealthData: true,
        scheduledOn: '2026-10-08',
        status: 'skipped',
      },
      again,
    );
    // gestrichen → nicht mehr änderbar
    await expect(
      backend.updatePlannedSession(
        {
          sessionId: monday.id,
          planId: active.plan.id,
          usesHealthData: true,
          scheduledOn: '2026-10-08',
          status: 'planned',
        },
        skipped,
      ),
    ).rejects.toMatchObject({ code: 'plan_rejected' });
  });

  it('verpasst: heute Mittwoch, Montags-Einheit auf einen freien Tag (Donnerstag) → angenommen', async () => {
    const rows = planPersonRows();
    const { store, payload, backend } = await generated(rows, '2026-10-05');
    const saved = await backend.savePlan(payload, rows);
    const active = activePlan(saved);
    const monday = active?.sessions.find((s) => s.scheduled_on === '2026-10-05');
    if (!active || !monday) throw new Error();
    const wednesday = localBackendOn(store, '2026-10-07', '2026-10-07T08:00:00.000Z');
    const library = await wednesday.loadPlanLibrary({ allowCached: false });
    if (!library) throw new Error();
    const update = {
      kind: 'update_planned_session' as const,
      sessionId: monday.id,
      planId: active.plan.id,
      usesHealthData: true,
      scheduledOn: '2026-10-08',
      status: 'planned' as const,
    };
    expect(
      isValidPlanOp(update, { today: '2026-10-07', rows: saved, versions: VERSIONS, library }),
    ).toBe(true);
    // Vor heute (Dienstag) nicht.
    expect(
      isValidPlanOp(
        { ...update, scheduledOn: '2026-10-06' },
        { today: '2026-10-07', rows: saved, versions: VERSIONS, library },
      ),
    ).toBe(false);
    const moved = await wednesday.updatePlannedSession(
      {
        sessionId: update.sessionId,
        planId: update.planId,
        usesHealthData: true,
        scheduledOn: update.scheduledOn,
        status: 'planned',
      },
      saved,
    );
    expect(moved.plannedSessions.find((s) => s.id === monday.id)).toMatchObject({
      scheduled_on: '2026-10-08',
      original_date: '2026-10-05',
      status: 'planned',
    });
  });

  it('nach vergangener Woche keine Änderung mehr', async () => {
    const rows = planPersonRows();
    const { store, payload, backend } = await generated(rows);
    const saved = await backend.savePlan(payload, rows);
    const active = activePlan(saved);
    const monday = active?.sessions.find((s) => s.scheduled_on === '2026-10-05');
    if (!active || !monday) throw new Error();
    const later = localBackendOn(store, '2026-10-12', '2026-10-12T08:00:00.000Z');
    await expect(
      later.updatePlannedSession(
        {
          sessionId: monday.id,
          planId: active.plan.id,
          usesHealthData: true,
          scheduledOn: monday.scheduled_on,
          status: 'skipped',
        },
        saved,
      ),
    ).rejects.toMatchObject({ code: 'plan_rejected' });
  });
});

describe('Testmodus: Tauschen wie swap_planned_sessions (Etappe A1a)', () => {
  async function mondayPlan() {
    const rows = planPersonRows();
    const { store, payload, backend, library } = await generated(rows, '2026-10-05');
    const saved = await backend.savePlan(payload, rows);
    const active = activePlan(saved);
    if (!active) throw new Error();
    const on = (date: string) => {
      const found = active.sessions.find((s) => s.scheduled_on === date);
      if (!found) throw new Error(date);
      return found;
    };
    return { store, backend, library, saved, active, on };
  }

  it('tauscht atomar, original_date nur beim ersten Mal; Rücktausch stellt die Tage wieder her', async () => {
    const { backend, saved, active, on } = await mondayPlan();
    const mo = on('2026-10-05');
    const mi = on('2026-10-07');
    const swap = {
      sessionId: mo.id,
      otherSessionId: mi.id,
      sessionOn: '2026-10-05',
      otherSessionOn: '2026-10-07',
      planId: active.plan.id,
      usesHealthData: active.plan.uses_health_data,
    };
    const swapped = await backend.swapPlannedSessions(swap, saved);
    expect(swapped.plannedSessions.find((s) => s.id === mo.id)).toMatchObject({
      scheduled_on: '2026-10-07',
      original_date: '2026-10-05',
      status: 'planned',
    });
    expect(swapped.plannedSessions.find((s) => s.id === mi.id)).toMatchObject({
      scheduled_on: '2026-10-05',
      original_date: '2026-10-07',
    });
    // Dieselbe Anfrage noch einmal (z. B. nach verlorener Antwort): Stand passt nicht mehr → abgelehnt, kein Rücktausch.
    await expect(backend.swapPlannedSessions(swap, swapped)).rejects.toMatchObject({
      code: 'plan_rejected',
    });
    const back = await backend.swapPlannedSessions(
      { ...swap, sessionOn: '2026-10-07', otherSessionOn: '2026-10-05' },
      swapped,
    );
    expect(back.plannedSessions.find((s) => s.id === mo.id)).toMatchObject({
      scheduled_on: '2026-10-05',
      original_date: '2026-10-05',
    });
    // Nie zwei geplante Einheiten an einem Tag.
    const dates = back.plannedSessions
      .filter((s) => s.status === 'planned')
      .map((s) => s.scheduled_on);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('Regeln wie der Server: Woche, Vergangenheit, Erholungswoche, erledigt, fremder Plan, gleiche Einheit', async () => {
    const { saved, active, on, library } = await mondayPlan();
    const mo = on('2026-10-05');
    const mi = on('2026-10-07');
    const fr = on('2026-10-09');
    const nextWeek = active.sessions.find((s) => s.scheduled_on >= '2026-10-12' && !s.is_deload);
    const deload = active.sessions.find((s) => s.is_deload);
    if (!nextWeek || !deload) throw new Error();
    const op = (
      a: string,
      b: string,
      patch: Partial<Extract<WriteOp, { kind: 'swap_planned_sessions' }>> = {},
    ): WriteOp => ({
      kind: 'swap_planned_sessions',
      sessionId: a,
      otherSessionId: b,
      sessionOn: saved.plannedSessions.find((s) => s.id === a)?.scheduled_on ?? '',
      otherSessionOn: saved.plannedSessions.find((s) => s.id === b)?.scheduled_on ?? '',
      planId: active.plan.id,
      usesHealthData: active.plan.uses_health_data,
      ...patch,
    });
    const ctx = (today: string, rows = saved) => ({ today, rows, versions: VERSIONS, library });
    expect(isValidPlanOp(op(mo.id, fr.id), ctx('2026-10-05'))).toBe(true);
    expect(isValidPlanOp(op(mo.id, mo.id), ctx('2026-10-05'))).toBe(false);
    // An den geprüften Stand gebunden (S1): erwarteter Tag weicht ab → abgelehnt.
    expect(isValidPlanOp(op(mo.id, fr.id, { sessionOn: '2026-10-06' }), ctx('2026-10-05'))).toBe(
      false,
    );
    expect(
      isValidPlanOp(op(mo.id, fr.id, { otherSessionOn: '2026-10-08' }), ctx('2026-10-05')),
    ).toBe(false);
    expect(isValidPlanOp(op(fr.id, nextWeek.id), ctx('2026-10-05'))).toBe(false);
    expect(isValidPlanOp(op(nextWeek.id, deload.id), ctx('2026-10-05'))).toBe(false);
    // Mittwoch: Montag liegt in der Vergangenheit → Freitag dürfte nicht dorthin.
    expect(isValidPlanOp(op(mo.id, fr.id), ctx('2026-10-07'))).toBe(false);
    expect(isValidPlanOp(op(mi.id, fr.id), ctx('2026-10-07'))).toBe(true);
    expect(isValidPlanOp(op(mo.id, fr.id, { planId: 'anderer-plan' }), ctx('2026-10-05'))).toBe(
      false,
    );
    expect(
      isValidPlanOp(
        op(mo.id, fr.id, { usesHealthData: !active.plan.uses_health_data }),
        ctx('2026-10-05'),
      ),
    ).toBe(false);
    const done: UserRows = {
      ...saved,
      plannedSessions: saved.plannedSessions.map((s) =>
        s.id === fr.id ? { ...s, status: 'completed' } : s,
      ),
    };
    expect(isValidPlanOp(op(mo.id, fr.id), ctx('2026-10-05', done))).toBe(false);
    const replaced: UserRows = {
      ...saved,
      plans: saved.plans.map((p) => ({ ...p, status: 'replaced' as const })),
    };
    expect(isValidPlanOp(op(mo.id, fr.id), ctx('2026-10-05', replaced))).toBe(false);
    // Erholungswoche allein (gleiche Woche, sonst alles erlaubt): nur streichen.
    const deloadFriday: UserRows = {
      ...saved,
      plannedSessions: saved.plannedSessions.map((s) =>
        s.id === fr.id ? { ...s, is_deload: true } : s,
      ),
    };
    expect(isValidPlanOp(op(mo.id, fr.id), ctx('2026-10-05', deloadFriday))).toBe(false);
    expect(isValidPlanOp(op(fr.id, mo.id), ctx('2026-10-05', deloadFriday))).toBe(false);
  });

  it('Tauschen geht nie in die Warteschlange; Einwilligung nicht nötig (wie Verschieben)', () => {
    const swap: WriteOp = {
      kind: 'swap_planned_sessions',
      sessionId: 'a',
      otherSessionId: 'b',
      sessionOn: '2026-10-05',
      otherSessionOn: '2026-10-07',
      planId: 'p',
      usesHealthData: false,
    };
    expect(isDirectOp(swap)).toBe(true);
    expect(isSensitiveOp(swap)).toBe(false);
    expect(isSensitiveOp({ ...swap, usesHealthData: true })).toBe(true);
    expect(needsHealthConsent({ ...swap, usesHealthData: true })).toBe(false);
  });

  it('applyWriteOps: unbekannte Einheit ändert nichts', async () => {
    const { saved, on } = await mondayPlan();
    const next = applyWriteOps(
      saved,
      [
        {
          kind: 'swap_planned_sessions',
          sessionId: on('2026-10-05').id,
          otherSessionId: 'gibt-es-nicht',
          sessionOn: '2026-10-05',
          otherSessionOn: '2026-10-07',
          planId: 'p',
          usesHealthData: false,
        },
      ],
      { now: '2026-10-05T08:00:00.000Z', newId: () => 'x', flagsFor: () => [] },
    );
    expect(next.plannedSessions).toEqual(saved.plannedSessions);
  });

  it('Kalender-Daten: Einheiten ersetzter Pläne sind fest, belegen aber ihren Tag', async () => {
    const { saved, on } = await mondayPlan();
    const replaced: UserRows = {
      ...saved,
      plans: saved.plans.map((p) => ({ ...p, status: 'replaced' as const })),
    };
    expect(movableSessions(saved).every((s) => s.in_active_plan)).toBe(true);
    expect(movableSessions(replaced).every((s) => s.in_active_plan === false)).toBe(true);
    const mo = on('2026-10-05');
    expect(
      moveTargetsInRows(replaced, mo.id, '2026-10-05').every((t) => t.reason === 'not_planned'),
    ).toBe(true);
    expect(validateMoveInRows(saved, mo.id, '2026-10-12', '2026-10-05')).toEqual({
      ok: false,
      reason: 'other_week',
    });
  });
});

describe('Widerruf und Gerätespeicher', () => {
  async function twoPlans() {
    // Plan ohne Gesundheitsbezug (ersetzt) + Plan mit Gesundheitsbezug (aktiv).
    const noCheck = planPersonRows({ consent: 'none', flags: null });
    const a = await generated(noCheck);
    const first = await a.backend.savePlan(a.payload, noCheck);
    const withCheck: UserRows = {
      ...first,
      consents: planPersonRows().consents,
      healthScreenings: planPersonRows().healthScreenings,
    };
    const library = a.library;
    const result = generatePlanFromRows(withCheck, VERSIONS, library, TODAY);
    if (!result.ok) throw new Error();
    a.store.setItem(
      'fitnessapp.local.v1',
      JSON.stringify({ session: { userId: first.profile?.user_id, email: null }, rows: withCheck }),
    );
    const saved = await a.backend.savePlan(toSavePlanPayload(result.plan), withCheck);
    return { ...a, rows: saved };
  }

  it('applyHealthDataRevocation löscht ALLE Pläne mit Gesundheitsbezug samt Einheiten und Übungen', async () => {
    const { rows } = await twoPlans();
    expect(rows.plans.map((p) => p.uses_health_data).sort()).toEqual([false, true]);
    const revoked = applyHealthDataRevocation(rows);
    expect(revoked.plans.every((p) => !p.uses_health_data)).toBe(true);
    const ids = new Set(revoked.plans.map((p) => p.id));
    expect(revoked.plannedSessions.every((s) => ids.has(s.plan_id))).toBe(true);
    const sessionIds = new Set(revoked.plannedSessions.map((s) => s.id));
    expect(revoked.plannedExercises.every((e) => sessionIds.has(e.session_id))).toBe(true);
    expect(revoked.healthScreenings).toEqual([]);
  });

  it('Widerruf im Testmodus löscht die Pläne mit Gesundheitsbezug', async () => {
    const { backend } = await twoPlans();
    await backend.revokeConsent('health_data');
    const { rows } = await backend.loadRows();
    expect(rows.plans).toHaveLength(1);
    expect(rows.plans[0]?.uses_health_data).toBe(false);
  });

  it('cacheableRows: nie Gesundheitsdaten; Pläne mit Gesundheitsbezug nur getrennt und nur mit Erlaubnis', async () => {
    const { rows } = await twoPlans();
    const withBody: UserRows = {
      ...rows,
      bodyMetrics: [
        {
          id: 'b',
          user_id: rows.profile?.user_id ?? '',
          measured_on: TODAY,
          height_cm: 180,
          weight_kg: 80,
          body_fat_pct: null,
          resting_heart_rate_bpm: null,
        },
      ],
    };
    const allowed = cacheableRows(withBody, { allowHealthPlanCache: true });
    expect(allowed.rows.bodyMetrics).toEqual([]);
    expect(allowed.rows.healthScreenings).toEqual([]);
    expect(allowed.rows.plans.every((p) => !p.uses_health_data)).toBe(true);
    expect(allowed.healthPlans?.plans.every((p) => p.uses_health_data)).toBe(true);
    expect(allowed.healthPlans?.plannedExercises.length).toBeGreaterThan(0);
    const denied = cacheableRows(withBody, { allowHealthPlanCache: false });
    expect(denied.healthPlans).toBeNull();
    expect(JSON.stringify(denied.rows)).not.toContain('"uses_health_data":true');
  });

  it('Pläne mit Gesundheitsbezug sind sensibel (nie Warteschlange); Speichern immer direkt', () => {
    const payload = { uses_health_data: true } as SavePlanPayload;
    expect(isSensitiveOp({ kind: 'save_training_plan', payload })).toBe(true);
    expect(
      isDirectOp({ kind: 'save_training_plan', payload: { ...payload, uses_health_data: false } }),
    ).toBe(true);
    const move = {
      kind: 'update_planned_session' as const,
      sessionId: 's',
      planId: 'p',
      scheduledOn: TODAY,
      status: 'planned' as const,
    };
    expect(isDirectOp({ ...move, usesHealthData: true })).toBe(true);
    expect(isDirectOp({ ...move, usesHealthData: false })).toBe(false);
  });
});
