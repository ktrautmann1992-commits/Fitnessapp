import type { DaySwap } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { rowsWith, USER_ID } from '../test/fixtures';
import { createDaySwapStore, prunedDaySwaps, withoutHealthPlanSwaps } from './day-swaps';
import { createMemoryStore, STORAGE_KEYS } from './kv';
import type { PlannedSessionRow, UserPlanRow } from './types';

/** Gerätespeicher der „Nur heute“-Tausche (Etappe T2, Wächter S5) – nur Speicher, Regeln im Core. */

const OTHER = '00000000-0000-4000-8000-000000000002';
const PLAN = '11111111-1111-4111-8111-111111111111';
const HEALTH_PLAN = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';

function swap(patch: Partial<DaySwap> = {}): DaySwap {
  return {
    ownerUserId: USER_ID,
    planId: PLAN,
    sessionId: SESSION,
    scheduledOn: '2026-10-05',
    storedOrderNo: 1,
    storedExerciseId: 'liegestuetz',
    alternativeId: 'knie-liegestuetz',
    createdAt: '2026-10-05T08:00:00.000Z',
    ...patch,
  };
}

function plan(id: string, patch: Partial<UserPlanRow> = {}): UserPlanRow {
  return {
    id,
    user_id: USER_ID,
    status: 'active',
    template_id: 'tpl',
    template_title_de: 'Vorlage',
    template_version: 1,
    engine_version: 3,
    match_quality: 'exact',
    notes: [],
    uses_health_data: false,
    medical_notice: false,
    inputs: {},
    start_date: '2026-10-05',
    created_at: '2026-10-05T08:00:00.000Z',
    replaced_at: null,
    ...patch,
  } as UserPlanRow;
}

function plannedSession(patch: Partial<PlannedSessionRow> = {}): PlannedSessionRow {
  return {
    id: SESSION,
    plan_id: PLAN,
    user_id: USER_ID,
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'strength',
    template_day_index: 0,
    scheduled_on: '2026-10-05',
    original_date: null,
    status: 'planned',
    name_de: 'Ganzkörper A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: '',
    cooldown_de: '',
    ...patch,
  } as PlannedSessionRow;
}

describe('createDaySwapStore', () => {
  it('eigener Schlüssel in STORAGE_KEYS; lesen nur eigene, schreiben behält fremde Konten', async () => {
    expect(STORAGE_KEYS.daySwaps).toBe('fitnessapp.day-swaps.v1');
    const kv = createMemoryStore({
      [STORAGE_KEYS.daySwaps]: JSON.stringify([swap(), swap({ ownerUserId: OTHER })]),
    });
    const store = createDaySwapStore(kv);
    expect(await store.load(USER_ID)).toEqual([swap()]);
    await store.save(USER_ID, [swap({ storedOrderNo: 2 })]);
    expect(await store.load(USER_ID)).toEqual([swap({ storedOrderNo: 2 })]);
    expect(await store.load(OTHER)).toEqual([swap({ ownerUserId: OTHER })]);
    // Fremde Einträge in der Liste des eigenen Kontos werden nie geschrieben.
    await store.save(USER_ID, [swap({ ownerUserId: OTHER, storedOrderNo: 3 })]);
    expect(await store.load(OTHER)).toEqual([swap({ ownerUserId: OTHER })]);
    await store.removeOwner(USER_ID);
    expect(await store.load(USER_ID)).toEqual([]);
    await store.removeOwner(OTHER);
    expect(kv.dump()[STORAGE_KEYS.daySwaps]).toBeUndefined();
  });

  it('kaputter Speicher: ungültiges JSON, kein Array, kaputte Einträge → verworfen, nie angezeigt', async () => {
    for (const raw of ['{kaputt', '42', JSON.stringify({ a: 1 })]) {
      const store = createDaySwapStore(createMemoryStore({ [STORAGE_KEYS.daySwaps]: raw }));
      expect(await store.load(USER_ID)).toEqual([]);
    }
    const store = createDaySwapStore(
      createMemoryStore({
        [STORAGE_KEYS.daySwaps]: JSON.stringify([
          swap(),
          { ...swap(), storedOrderNo: 99 },
          { ...swap(), alternativeId: 'liegestuetz' },
          { ...swap(), extra: true },
        ]),
      }),
    );
    expect(await store.load(USER_ID)).toEqual([swap()]);
  });
});

describe('Aufräumen', () => {
  it('prunedDaySwaps: Einheit fehlt, erledigt, vorbei oder Plan ersetzt → weg', () => {
    const rows = rowsWith({ plans: [plan(PLAN)], plannedSessions: [plannedSession()] });
    expect(prunedDaySwaps(rows, [swap()], '2026-10-05')).toEqual([swap()]);
    expect(prunedDaySwaps(rows, [swap({ sessionId: OTHER })], '2026-10-05')).toEqual([]);
    expect(prunedDaySwaps(rows, [swap({ planId: HEALTH_PLAN })], '2026-10-05')).toEqual([]);
    const done = rowsWith({
      plans: [plan(PLAN)],
      plannedSessions: [plannedSession({ status: 'completed' })],
    });
    expect(prunedDaySwaps(done, [swap()], '2026-10-05')).toEqual([]);
    // Nächste Woche: Termin vorbei und nicht mehr nachholbar.
    expect(prunedDaySwaps(rows, [swap()], '2026-10-13')).toEqual([]);
    expect(prunedDaySwaps(rowsWith(), [swap()], '2026-10-05')).toEqual([]);
  });

  it('withoutHealthPlanSwaps: Widerruf health_data entfernt Tausche zu Plänen mit Gesundheitsbezug', () => {
    const rows = rowsWith({
      plans: [plan(PLAN), plan(HEALTH_PLAN, { uses_health_data: true, status: 'replaced' })],
    });
    expect(withoutHealthPlanSwaps(rows, [swap(), swap({ planId: HEALTH_PLAN })])).toEqual([swap()]);
  });
});
