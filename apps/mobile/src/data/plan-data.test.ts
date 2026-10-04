import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { toSavePlanPayload, type SavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { localBackendOn, planPersonRows, seededBackend, TODAY, VERSIONS } from '../test/fixtures';
import { isValidPlanOp } from './local-rules';
import { activePlan, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';
import { applyHealthDataRevocation, cacheableRows, isDirectOp, isSensitiveOp } from './write-ops';

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
