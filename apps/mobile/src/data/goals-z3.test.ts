/**
 * Ziele · Etappe Z3 (docs/PLAN-ZIELE.md 5.1–5.3): Nebenziel in goals und Wunschgewicht (weight_goals) in beiden
 * Betriebsarten – Abbildung, Regeln wie die Datenbank (Paar-/Disziplin-CHECK, nur mit Abnehmziel, nur mit
 * Einwilligung), Widerruf, Export, Zwischenspeicher, ältere Gerätestände und Supabase-Schreibwege.
 */
import type { WeightGoal } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { BackendError } from './backend';
import { localDataExport } from './data-export';
import { STORAGE_KEYS } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { isValidOp } from './local-rules';
import {
  answersFromRows,
  applyStepToAnswers,
  planStepWrites,
  toGoalsRow,
  toWeightGoalRow,
  weightGoalFromRow,
  type PlanContext,
} from './mapping';
import { nutritionInputsFromRows } from './nutrition-plan';
import { executeWriteOp } from './supabase-backend';
import { planInputsFromRows } from './training-plan';
import type { GoalsRow, StepSave, UserRows, WeightGoalRow } from './types';
import {
  applyHealthDataRevocation,
  applyWriteOps,
  cacheableRows,
  isDirectOp,
  isSensitiveOp,
  needsHealthConsent,
  type WriteOp,
} from './write-ops';

const GOAL: WeightGoal = {
  targetWeightKg: 80,
  startDate: TODAY,
  targetDate: '2027-01-02',
  amountMode: 'kg_to_lose',
  timeMode: 'weeks',
};
const ROW: WeightGoalRow = toWeightGoalRow(USER_ID, GOAL);

function goals(patch: Partial<GoalsRow> = {}): GoalsRow {
  return {
    user_id: USER_ID,
    goal_type: 'fat_loss',
    secondary_goal_type: null,
    discipline: null,
    target_date: null,
    training_location: 'gym',
    ...patch,
  };
}

/** Fertig eingerichtete Person (Abnehmen, Einwilligung, 90 kg) im Testmodus. */
function person(patch: Partial<UserRows> = {}): UserRows {
  return {
    ...planPersonRows({ goal: 'fat_loss' }),
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-10-01',
        height_cm: 180,
        weight_kg: 90,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
    ...patch,
  };
}

const ctx = { now: NOW, newId: () => 'x', flagsFor: () => [], today: TODAY };

describe('Abbildung (mapping.ts)', () => {
  it('toGoalsRow: Nebenziel als Spalte; Disziplin bei Ausdauer als Haupt- ODER Nebenziel', () => {
    const goal = {
      goalType: 'fat_loss' as const,
      secondaryGoalType: 'endurance' as const,
      discipline: '10k' as const,
      targetDate: null,
    };
    expect(toGoalsRow(USER_ID, { goal })).toMatchObject({
      goal_type: 'fat_loss',
      secondary_goal_type: 'endurance',
      discipline: '10k',
    });
    expect(
      toGoalsRow(USER_ID, { goal: { ...goal, secondaryGoalType: 'muscle_gain' } }),
    ).toMatchObject({ secondary_goal_type: 'muscle_gain', discipline: null });
    expect(
      toGoalsRow(USER_ID, { goal: { ...goal, secondaryGoalType: null } }).secondary_goal_type,
    ).toBeNull();
  });

  it('Zeile ⇄ Abnehmziel; eine unpassende Zeile ergibt KEIN Ziel statt eines Fehlers (Wächter Z2 K-5)', () => {
    expect(ROW).toEqual({
      user_id: USER_ID,
      target_weight_kg: 80,
      start_date: TODAY,
      target_date: '2027-01-02',
      amount_mode: 'kg_to_lose',
      time_mode: 'weeks',
    });
    expect(weightGoalFromRow(ROW)).toEqual(GOAL);
    expect(weightGoalFromRow(null)).toBeNull();
    for (const bad of [
      { target_date: '2026-10-30' }, // 27 Tage
      { target_date: '2028-10-02' }, // 730 Tage
      { target_weight_kg: 29.9 },
      { target_weight_kg: 80.05 },
      { amount_mode: 'kg' },
      { start_date: '03.10.2026' },
    ]) {
      expect(
        weightGoalFromRow({ ...ROW, ...bad } as WeightGoalRow),
        JSON.stringify(bad),
      ).toBeNull();
    }
    // Grenzen genau: 28 und 728 Tage, 30 und 300 kg
    expect(weightGoalFromRow({ ...ROW, target_date: '2026-10-31' })).not.toBeNull();
    expect(weightGoalFromRow({ ...ROW, target_date: '2028-09-30' })).not.toBeNull();
    expect(weightGoalFromRow({ ...ROW, target_weight_kg: 30 })).not.toBeNull();
    expect(weightGoalFromRow({ ...ROW, target_weight_kg: 300 })).not.toBeNull();
  });

  it('Schritt weight_goal: Ziel → upsert, „ohne festes Ziel“ → löschen; Fortschritt nur im Onboarding', () => {
    const base: PlanContext = {
      userId: USER_ID,
      answers: {},
      nextStep: 'time_budget',
      now: NOW,
      platform: 'web',
      versions: VERSIONS,
      hasHealthConsent: true,
    };
    const set: StepSave = { step: 'weight_goal', weightGoal: GOAL };
    expect(planStepWrites(set, base)).toEqual([
      { kind: 'upsert_weight_goal', row: ROW },
      { kind: 'update_profile', patch: { onboarding_step: 'time_budget' } },
    ]);
    expect(planStepWrites({ step: 'weight_goal', weightGoal: null }, base)).toEqual([
      { kind: 'delete_weight_goal' },
      { kind: 'update_profile', patch: { onboarding_step: 'time_budget' } },
    ]);
    expect(planStepWrites(set, { ...base, onboardingCompleted: true })).toEqual([
      { kind: 'upsert_weight_goal', row: ROW },
    ]);
  });

  it('Antworten: Nebenziel und Wunschgewicht aus den Zeilen; Ziel ohne Abnehmen verwirft das Wunschgewicht', () => {
    const rows = person({ goals: goals({ secondary_goal_type: 'muscle_gain' }), weightGoal: ROW });
    const answers = answersFromRows(rows);
    expect(answers.goal?.secondaryGoalType).toBe('muscle_gain');
    expect(answers.weightGoal).toEqual(GOAL);
    // Ältere Zeile ohne Spalte (vor Z3): kein Nebenziel
    const old: Partial<GoalsRow> = goals();
    delete old.secondary_goal_type;
    expect(answersFromRows({ ...rows, goals: old as GoalsRow }).goal?.secondaryGoalType).toBeNull();
    const after = applyStepToAnswers(answers, {
      step: 'goal',
      goal: {
        goalType: 'muscle_gain',
        secondaryGoalType: 'endurance',
        discipline: null,
        targetDate: null,
      },
    });
    expect(after.weightGoal).toBeNull();
    const kept = applyStepToAnswers(answers, {
      step: 'goal',
      goal: {
        goalType: 'muscle_gain',
        secondaryGoalType: 'fat_loss',
        discipline: null,
        targetDate: null,
      },
    });
    expect(kept.weightGoal).toEqual(GOAL);
  });

  it('Engine-Eingaben: Nebenziel an Plan und Ernährung; Wunschgewicht nur mit Einwilligung und nur gültig', () => {
    const rows = person({
      goals: goals({ secondary_goal_type: 'endurance', discipline: '10k' }),
      weightGoal: ROW,
    });
    expect(planInputsFromRows(rows, VERSIONS)).toMatchObject({
      goalType: 'fat_loss',
      secondaryGoalType: 'endurance',
      discipline: '10k',
    });
    const inputs = nutritionInputsFromRows(rows, VERSIONS, TODAY, '2026-09-28');
    expect(inputs).toMatchObject({ secondaryGoalType: 'endurance', weightGoal: GOAL });
    const invalid = nutritionInputsFromRows(
      { ...rows, weightGoal: { ...ROW, target_date: '2026-10-05' } },
      VERSIONS,
      TODAY,
      '2026-09-28',
    );
    expect(invalid?.weightGoal).toBeNull();
    const noConsent = person({
      consents: rows.consents.filter((c) => c.consent_type !== 'health_data'),
      weightGoal: ROW,
    });
    expect(
      nutritionInputsFromRows(noConsent, VERSIONS, TODAY, '2026-09-28')?.weightGoal,
    ).toBeNull();
  });
});

describe('Schreib-Vorgänge (write-ops.ts)', () => {
  it('Wunschgewicht ist Gesundheitsdatum: sofort senden, nie Warteschlange; Löschen ohne Einwilligung', () => {
    const upsert: WriteOp = { kind: 'upsert_weight_goal', row: ROW };
    const del: WriteOp = { kind: 'delete_weight_goal' };
    expect(isSensitiveOp(upsert) && isDirectOp(upsert) && needsHealthConsent(upsert)).toBe(true);
    expect(isSensitiveOp(del) && isDirectOp(del)).toBe(true);
    expect(needsHealthConsent(del)).toBe(false);
  });

  it('wie der Trigger: Ziel ohne Abnehmen löscht das Wunschgewicht, mit Abnehmen als Nebenziel bleibt es (S13)', () => {
    const rows = person({ goals: goals(), weightGoal: ROW });
    const kept = applyWriteOps(
      rows,
      [
        {
          kind: 'upsert_goals',
          row: goals({ goal_type: 'muscle_gain', secondary_goal_type: 'fat_loss' }),
        },
      ],
      ctx,
    );
    expect(kept.weightGoal).toEqual(ROW);
    const dropped = applyWriteOps(
      rows,
      [{ kind: 'upsert_goals', row: goals({ goal_type: 'muscle_gain' }) }],
      ctx,
    );
    expect(dropped.weightGoal).toBeNull();
    expect(applyWriteOps(rows, [{ kind: 'delete_weight_goal' }], ctx).weightGoal).toBeNull();
  });

  it('Widerruf löscht das Wunschgewicht, goals (mit Nebenziel) bleibt; nie im normalen Zwischenspeicher', () => {
    const rows = person({ goals: goals({ secondary_goal_type: 'muscle_gain' }), weightGoal: ROW });
    const revoked = applyHealthDataRevocation(rows);
    expect(revoked.weightGoal).toBeNull();
    expect(revoked.goals?.secondary_goal_type).toBe('muscle_gain');
    expect(cacheableRows(rows, { allowHealthPlanCache: true }).rows.weightGoal).toBeNull();
  });
});

describe('Regeln im Testmodus (local-rules.ts) = CHECKs und Trigger der Datenbank', () => {
  const profile = person().profile!;
  const valid = (op: WriteOp, g: GoalsRow | null = goals()) =>
    isValidOp(op, { today: TODAY, profile, goals: g });

  it('goals: Paar-CHECK und Disziplin-CHECK', () => {
    const op = (patch: Partial<GoalsRow>): WriteOp => ({ kind: 'upsert_goals', row: goals(patch) });
    expect(valid(op({ secondary_goal_type: 'muscle_gain' }))).toBe(true);
    expect(valid(op({ secondary_goal_type: 'general_fitness' }))).toBe(false);
    expect(valid(op({ secondary_goal_type: 'fat_loss' }))).toBe(false);
    expect(valid(op({ goal_type: 'definition', secondary_goal_type: 'muscle_gain' }))).toBe(false);
    expect(valid(op({ secondary_goal_type: 'endurance', discipline: '5k' }))).toBe(true);
    expect(valid(op({ discipline: '5k' }))).toBe(false);
    expect(valid(op({ goal_type: 'endurance', discipline: '5k' }))).toBe(true);
  });

  it('Wunschgewicht: nur eigenes Konto, nur mit Abnehmziel (Haupt oder Neben), CHECKs wie weightGoalSchema', () => {
    const op = (row: Partial<WeightGoalRow> = {}): WriteOp => ({
      kind: 'upsert_weight_goal',
      row: { ...ROW, ...row },
    });
    expect(valid(op())).toBe(true);
    expect(valid(op(), goals({ goal_type: 'muscle_gain', secondary_goal_type: 'fat_loss' }))).toBe(
      true,
    );
    expect(valid(op(), goals({ goal_type: 'muscle_gain' }))).toBe(false);
    expect(valid(op(), null)).toBe(false);
    expect(valid(op({ user_id: 'fremd' }))).toBe(false);
    expect(valid(op({ target_date: '2026-10-30' }))).toBe(false);
    expect(valid(op({ target_weight_kg: 300.1 }))).toBe(false);
    expect(valid({ kind: 'delete_weight_goal' })).toBe(true);
  });
});

describe('Testmodus-Backend', () => {
  async function saveWeightGoal(
    backend: ReturnType<typeof seededBackend>['backend'],
    weightGoal: WeightGoal | null,
  ) {
    const { rows } = await backend.loadRows();
    return backend.saveStep(
      { step: 'weight_goal', weightGoal },
      { answers: answersFromRows(rows), rows, versions: VERSIONS },
    );
  }

  it('Speichern, Verlängern nach Ablauf (neuer Start), Entfernen; Export enthält beides', async () => {
    const { backend } = seededBackend(
      person({ goals: goals({ secondary_goal_type: 'muscle_gain' }) }),
    );
    let rows = await saveWeightGoal(backend, GOAL);
    expect(rows.weightGoal).toEqual(ROW);
    // Fortschritt bleibt (Onboarding abgeschlossen).
    expect(rows.profile?.onboarding_step).toBe('cooking');
    const extended = { ...GOAL, startDate: TODAY, targetDate: '2026-12-01' };
    rows = await saveWeightGoal(backend, extended);
    expect(rows.weightGoal?.target_date).toBe('2026-12-01');
    const file = localDataExport(rows, USER_ID, NOW);
    expect(file.data.weight_goals).toEqual([rows.weightGoal]);
    expect(file.data.goals).toEqual([
      expect.objectContaining({ secondary_goal_type: 'muscle_gain' }),
    ]);
    rows = await saveWeightGoal(backend, null);
    expect(rows.weightGoal).toBeNull();
    expect(localDataExport(rows, USER_ID, NOW).data.weight_goals).toEqual([]);
  });

  it('ohne Einwilligung bzw. ohne Abnehmziel abgelehnt (Wächter S13)', async () => {
    const noConsent = seededBackend(
      person({ consents: person().consents.filter((c) => c.consent_type !== 'health_data') }),
    );
    await expect(saveWeightGoal(noConsent.backend, GOAL)).rejects.toMatchObject({
      code: 'consent_required',
    });
    const noFatLoss = seededBackend(person({ goals: goals({ goal_type: 'muscle_gain' }) }));
    await expect(saveWeightGoal(noFatLoss.backend, GOAL)).rejects.toBeInstanceOf(BackendError);
    expect((await noFatLoss.backend.loadRows()).rows.weightGoal).toBeNull();
  });

  it('Widerruf health_data löscht das Wunschgewicht', async () => {
    const { backend } = seededBackend(person({ weightGoal: ROW }));
    expect((await backend.loadRows()).rows.weightGoal).toEqual(ROW);
    await backend.revokeConsent('health_data');
    expect((await backend.loadRows()).rows.weightGoal).toBeNull();
  });

  it('ältere Gerätestände: ohne Nebenziel-Spalte und ohne weightGoal laden; manipulierte Werte verworfen', async () => {
    const rows = person();
    const oldGoals: Partial<GoalsRow> = goals({ discipline: '5k' });
    delete oldGoals.secondary_goal_type;
    const old: Partial<UserRows> = { ...rows, goals: oldGoals as GoalsRow };
    delete old.weightGoal;
    const upgraded = upgradeStoredRows(old as UserRows);
    expect(upgraded.weightGoal).toBeNull();
    // Disziplin ohne Ausdauer-Ziel verworfen (CHECK), Nebenziel null
    expect(upgraded.goals).toMatchObject({ secondary_goal_type: null, discipline: null });

    const forbidden = upgradeStoredRows({
      ...rows,
      goals: goals({ secondary_goal_type: 'general_fitness' }),
    });
    expect(forbidden.goals?.secondary_goal_type).toBeNull();
    const invalidGoal = upgradeStoredRows({
      ...rows,
      weightGoal: { ...ROW, target_date: '2026-10-05' },
    });
    expect(invalidGoal.weightGoal).toBeNull();
    const foreign = upgradeStoredRows({ ...rows, weightGoal: { ...ROW, user_id: 'fremd' } });
    expect(foreign.weightGoal).toBeNull();
    const withoutFatLoss = upgradeStoredRows({
      ...rows,
      goals: goals({ goal_type: 'muscle_gain' }),
      weightGoal: ROW,
    });
    expect(withoutFatLoss.weightGoal).toBeNull();
    expect(upgradeStoredRows({ ...rows, weightGoal: ROW }).weightGoal).toEqual(ROW);

    // Über den Gerätespeicher geladen
    const { store, backend } = seededBackend(rows);
    await store.setItem(
      STORAGE_KEYS.localDb,
      JSON.stringify({ session: { userId: USER_ID, email: null }, rows: old }),
    );
    const loaded = (await backend.loadRows()).rows;
    expect(loaded.weightGoal).toBeNull();
    expect(loaded.goals?.secondary_goal_type).toBeNull();
  });
});

describe('Supabase-Modus: Schreibwege', () => {
  function fakeClient(
    respond: (table: string, attempt: number) => { error?: unknown } = () => ({}),
  ) {
    const calls: { table: string; chain: string[]; args: unknown[][] }[] = [];
    const builder = (call: (typeof calls)[number], attempt: number): unknown =>
      new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) =>
                resolve({ data: null, error: null, ...respond(call.table, attempt) });
            }
            return (...args: unknown[]) => {
              call.chain.push(prop);
              call.args.push(args);
              return builder(call, attempt);
            };
          },
        },
      );
    const client = {
      from: (table: string) => {
        const call = { table, chain: [] as string[], args: [] as unknown[][] };
        calls.push(call);
        return builder(call, calls.filter((c) => c.table === table).length);
      },
    };
    return { client: client as unknown as AppSupabaseClient, calls };
  }

  it('Wunschgewicht: Upsert je Nutzer, Löschen der eigenen Zeile', async () => {
    const { client, calls } = fakeClient();
    await executeWriteOp(client, USER_ID, { kind: 'upsert_weight_goal', row: ROW });
    await executeWriteOp(client, USER_ID, { kind: 'delete_weight_goal' });
    expect(calls[0]).toMatchObject({ table: 'weight_goals', chain: ['upsert'] });
    expect(calls[0]?.args[0]).toEqual([ROW, { onConflict: 'user_id' }]);
    expect(calls[1]).toMatchObject({ table: 'weight_goals', chain: ['delete', 'eq'] });
    expect(calls[1]?.args[1]).toEqual(['user_id', USER_ID]);
  });

  it('goals vor `db-migrate` (Spalte fehlt, PGRST204): ohne Nebenziel ein zweiter Versuch ohne die Spalte, mit Nebenziel Fehler', async () => {
    const missing = {
      code: 'PGRST204',
      message: "Could not find the 'secondary_goal_type' column",
    };
    const first = fakeClient((table, attempt) =>
      table === 'goals' && attempt === 1 ? { error: missing } : {},
    );
    await executeWriteOp(first.client, USER_ID, { kind: 'upsert_goals', row: goals() });
    expect(first.calls).toHaveLength(2);
    expect(first.calls[1]?.args[0]?.[0]).not.toHaveProperty('secondary_goal_type');
    expect(first.calls[1]?.args[0]?.[0]).toMatchObject({ goal_type: 'fat_loss' });

    const withSecondary = fakeClient(() => ({ error: missing }));
    await expect(
      executeWriteOp(withSecondary.client, USER_ID, {
        kind: 'upsert_goals',
        row: goals({ secondary_goal_type: 'muscle_gain' }),
      }),
    ).rejects.toBe(missing);
    expect(withSecondary.calls).toHaveLength(1);
  });
});
