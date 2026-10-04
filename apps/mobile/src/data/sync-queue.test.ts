import { describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from './kv';
import { enqueue, SyncQueue } from './sync-queue';
import type { WriteOp } from './write-ops';

const KEY = 'queue';
const goals = (goal_type: 'fat_loss' | 'muscle_gain'): WriteOp => ({
  kind: 'upsert_goals',
  row: {
    user_id: 'u',
    goal_type,
    discipline: null,
    target_date: null,
    training_location: null,
  },
});
const slots: WriteOp = {
  kind: 'replace_training_slots',
  rows: [{ user_id: 'u', slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 }],
};
const step = (onboarding_step: string): WriteOp => ({
  kind: 'update_profile',
  patch: { onboarding_step },
});
const network = Object.assign(new TypeError('Failed to fetch'), {});

describe('enqueue', () => {
  it('neuere Änderung ersetzt ältere, Profil-Fortschritt wird zusammengeführt und kommt zuletzt', () => {
    let entries = enqueue([], [goals('fat_loss'), step('time_budget')]);
    entries = enqueue(entries, [
      { kind: 'update_profile', patch: { experience_level: 'beginner' } },
    ]);
    entries = enqueue(entries, [slots, goals('muscle_gain'), step('equipment')]);
    expect(entries.map((e) => e.key)).toEqual([
      'replace_training_slots',
      'upsert_goals',
      'update_profile',
    ]);
    expect(entries[1]?.op).toEqual(goals('muscle_gain'));
    expect(entries[2]?.op).toEqual({
      kind: 'update_profile',
      patch: { onboarding_step: 'equipment', experience_level: 'beginner' },
    });
    // Trainingstage: neuester Stand gewinnt.
    const newer: WriteOp = { ...slots, rows: [] };
    expect(enqueue(entries, [newer]).filter((e) => e.key === 'replace_training_slots')).toEqual([
      { key: 'replace_training_slots', op: newer },
    ]);
  });

  it('Gesundheitsdaten und Einwilligungen kommen nie in die Warteschlange', () => {
    expect(() =>
      enqueue(
        [],
        [
          {
            kind: 'insert_health_screening',
            row: { user_id: 'u', answers: {}, medical_notice_acknowledged_at: null },
          },
        ],
      ),
    ).toThrow();
    expect(() =>
      enqueue([], [{ kind: 'grant_consent', consentType: 'terms', version: 1, platform: 'web' }]),
    ).toThrow();
    expect(() =>
      enqueue([], [{ kind: 'replace_food_preferences', scope: 'intolerance', rows: [] }]),
    ).toThrow();
  });
});

describe('SyncQueue', () => {
  it('offline: bleibt gespeichert (auch nach Neustart) und wird später gesendet', async () => {
    const store = createMemoryStore();
    let online = false;
    const sent: WriteOp[] = [];
    const execute = vi.fn(async (op: WriteOp) => {
      if (!online) {
        throw network;
      }
      sent.push(op);
    });
    const options = {
      store,
      storageKey: KEY,
      execute,
      isNetworkError: (e: unknown) => e === network,
    };
    const queue = new SyncQueue(options);
    await queue.add([goals('fat_loss'), step('time_budget')]);
    expect(await queue.flush()).toBe(false);
    expect(queue.size()).toBe(2);

    // „App-Neustart“: neue Instanz liest die gespeicherte Warteschlange.
    const restarted = new SyncQueue(options);
    online = true;
    expect(await restarted.flush()).toBe(true);
    expect(sent.map((op) => op.kind)).toEqual(['upsert_goals', 'update_profile']);
    expect(restarted.size()).toBe(0);
    expect(store.dump()[KEY]).toBeUndefined();
  });

  it('vom Server abgelehnte Vorgänge werden verworfen (ohne Inhalte zu melden)', async () => {
    const dropped = vi.fn();
    const queue = new SyncQueue({
      store: createMemoryStore(),
      storageKey: KEY,
      execute: async (op) => {
        if (op.kind === 'upsert_goals') {
          throw { code: '23514', message: 'check' };
        }
      },
      isNetworkError: () => false,
      onDropped: dropped,
    });
    await queue.add([goals('fat_loss'), step('goal')]);
    expect(await queue.flush()).toBe(true);
    expect(dropped).toHaveBeenCalledTimes(1);
    expect(queue.size()).toBe(0);
  });

  it('verwirft beim Laden versehentlich gespeicherte Gesundheitsdaten', async () => {
    const store = createMemoryStore({
      [KEY]: JSON.stringify([
        {
          key: 'upsert_body_metrics',
          op: { kind: 'upsert_body_metrics', row: { user_id: 'u', measured_on: '2026-10-03' } },
        },
        { key: 'update_profile', op: step('goal') },
      ]),
    });
    const execute = vi.fn(async () => undefined);
    const queue = new SyncQueue({ store, storageKey: KEY, execute, isNetworkError: () => false });
    await queue.flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(step('goal'));
  });

  it('verwirft beim Laden still alte Ziel-Vorgänge mit Zeitbudget-Spalten (vor Etappe B2)', async () => {
    const legacy = {
      kind: 'upsert_goals',
      row: {
        ...(goals('fat_loss') as Extract<WriteOp, { kind: 'upsert_goals' }>).row,
        sessions_per_week: 3,
        minutes_per_session: 45,
        preferred_days: [1, 3, 5],
      },
    };
    const store = createMemoryStore({
      [KEY]: JSON.stringify([
        { key: 'upsert_goals', op: legacy },
        { key: 'replace_training_slots', op: slots },
        { key: 'update_profile', op: step('time_budget') },
      ]),
    });
    const execute = vi.fn(async (_op: WriteOp) => undefined);
    const dropped = vi.fn();
    const queue = new SyncQueue({
      store,
      storageKey: KEY,
      execute,
      isNetworkError: () => false,
      onDropped: dropped,
    });
    await queue.load();
    expect(queue.size()).toBe(2);
    await queue.flush();
    expect(execute.mock.calls.map(([op]) => op.kind)).toEqual([
      'replace_training_slots',
      'update_profile',
    ]);
    expect(dropped).not.toHaveBeenCalled();
  });

  it('ein neuer Ziel-Vorgang ohne die alten Spalten bleibt erhalten', async () => {
    const store = createMemoryStore({
      [KEY]: JSON.stringify([{ key: 'upsert_goals', op: goals('muscle_gain') }]),
    });
    const execute = vi.fn(async () => undefined);
    const queue = new SyncQueue({ store, storageKey: KEY, execute, isNetworkError: () => false });
    await queue.flush();
    expect(execute).toHaveBeenCalledWith(goals('muscle_gain'));
  });
});

describe('Verschieben einer Einheit (Plan ohne Gesundheitsbezug)', () => {
  const move = (sessionId: string, scheduledOn: string): WriteOp => ({
    kind: 'update_planned_session',
    sessionId,
    planId: 'p',
    usesHealthData: false,
    scheduledOn,
    status: 'planned',
  });

  it('Schlüssel update_planned_session:<id> – neuere Änderung derselben Einheit ersetzt die ältere', () => {
    const entries = enqueue(
      [],
      [move('a', '2026-10-06'), move('b', '2026-10-07'), move('a', '2026-10-08')],
    );
    expect(entries.map((e) => e.key)).toEqual([
      'update_planned_session:b',
      'update_planned_session:a',
    ]);
    expect(entries[1]?.op).toEqual(move('a', '2026-10-08'));
  });

  it('Plan mit Gesundheitsbezug kommt nie in die Warteschlange', () => {
    expect(() =>
      enqueue([], [{ ...move('a', '2026-10-06'), usesHealthData: true } as WriteOp]),
    ).toThrow();
  });

  it('neuer Plan entfernt wartende Verschiebungen ausdrücklich (remove)', async () => {
    const store = createMemoryStore();
    const queue = new SyncQueue({
      store,
      storageKey: KEY,
      execute: () => Promise.reject(network),
      isNetworkError: () => true,
    });
    await queue.add([move('a', '2026-10-06'), goals('fat_loss')]);
    await queue.remove((op) => op.kind === 'update_planned_session');
    expect(queue.snapshot().map((e) => e.key)).toEqual(['upsert_goals']);
    expect(store.dump()[KEY]).not.toContain('update_planned_session');
  });
});
