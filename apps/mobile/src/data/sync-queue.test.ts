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
    sessions_per_week: null,
    minutes_per_session: null,
    preferred_days: [],
    training_location: null,
  },
});
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
    entries = enqueue(entries, [goals('muscle_gain'), step('training_location')]);
    expect(entries.map((e) => e.key)).toEqual(['upsert_goals', 'update_profile']);
    expect(entries[0]?.op).toEqual(goals('muscle_gain'));
    expect(entries[1]?.op).toEqual({
      kind: 'update_profile',
      patch: { onboarding_step: 'training_location', experience_level: 'beginner' },
    });
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
});
