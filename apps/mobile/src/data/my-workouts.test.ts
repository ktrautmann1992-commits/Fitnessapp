import {
  buildCustomWorkout,
  CUSTOM_WORKOUT_RULES,
  type CustomWorkoutDefinition,
  workoutVariantSchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './kv';
import {
  applyMyWorkoutsOp,
  createLocalMyWorkouts,
  createRemoteMyWorkouts,
  EMPTY_MY_WORKOUTS,
  MY_WORKOUTS_KEYS,
  MyWorkoutsError,
  parseMyWorkoutsData,
} from './my-workouts';
import { testLibrary } from './my-workouts-test-library';

const A = 'user-a';
const B = 'user-b';
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-11-18T10:00:00.000Z';

function definition(): CustomWorkoutDefinition {
  const result = buildCustomWorkout(
    {
      minutes: 30,
      areas: ['legs', 'core'],
      equipment_ids: [],
      favorite_ids: [],
      dislike_ids: [],
      seed: 3,
    },
    testLibrary(),
    { level: 'beginner', cautious: false, excludedCautionTags: [] },
  );
  if (!result.definition) throw new Error('kein Workout');
  return result.definition;
}
const variant = workoutVariantSchema.parse({
  version: 1,
  base_version: 1,
  swaps: [{ index: 0, from: 'liegestuetz', to: 'liegestuetz-erhoeht' }],
});

describe('applyMyWorkoutsOp (wie die Tabellen)', () => {
  it('Upsert je id, eigener Besitz, Löschen nur eigene Zeilen', () => {
    const def = definition();
    let data = applyMyWorkoutsOp(EMPTY_MY_WORKOUTS, {
      op: 'save_custom',
      userId: A,
      id: ID1,
      name: 'Mein Beine 30',
      definition: def,
      at: NOW,
    }).data;
    data = applyMyWorkoutsOp(data, {
      op: 'save_custom',
      userId: A,
      id: ID1,
      name: 'Umbenannt',
      definition: def,
      at: '2026-11-18T11:00:00.000Z',
    }).data;
    expect(data.custom).toHaveLength(1);
    expect(data.custom[0]).toMatchObject({ name: 'Umbenannt', created_at: NOW });
    // Fremde Zeile: weder übernehmen noch löschen.
    expect(
      applyMyWorkoutsOp(data, {
        op: 'save_custom',
        userId: B,
        id: ID1,
        name: 'Fremd',
        definition: def,
        at: NOW,
      }).ok,
    ).toBe(false);
    expect(
      applyMyWorkoutsOp(data, { op: 'delete_custom', userId: B, id: ID1 }).data.custom,
    ).toHaveLength(1);
    expect(
      applyMyWorkoutsOp(data, { op: 'delete_custom', userId: A, id: ID1 }).data.custom,
    ).toHaveLength(0);
  });

  it('Höchstzahlen nur für neue Zeilen; Variante null = löschen; Abneigung doppelt = einmal', () => {
    const many = {
      ...EMPTY_MY_WORKOUTS,
      dislikes: Array.from({ length: CUSTOM_WORKOUT_RULES.maxDislikes }, (_, i) => ({
        user_id: A,
        exercise_id: `uebung-${i}`,
        created_at: NOW,
      })),
    };
    expect(
      applyMyWorkoutsOp(many, {
        op: 'set_dislike',
        userId: A,
        exerciseId: 'neu-x',
        disliked: true,
        at: NOW,
      }).ok,
    ).toBe(false);
    expect(
      applyMyWorkoutsOp(many, {
        op: 'set_dislike',
        userId: A,
        exerciseId: 'uebung-1',
        disliked: true,
        at: NOW,
      }).ok,
    ).toBe(true);
    let data = applyMyWorkoutsOp(EMPTY_MY_WORKOUTS, {
      op: 'save_variant',
      userId: A,
      workoutId: 'bauch-blitz',
      definition: variant,
      at: NOW,
    }).data;
    expect(data.variants).toHaveLength(1);
    data = applyMyWorkoutsOp(data, {
      op: 'save_variant',
      userId: A,
      workoutId: 'bauch-blitz',
      definition: null,
      at: NOW,
    }).data;
    expect(data.variants).toEqual([]);
  });

  it('Gerätespeicher: ungültige Zeilen fallen weg (nie halbe Workouts im Player)', () => {
    const parsed = parseMyWorkoutsData({
      custom: [
        {
          id: ID1,
          user_id: A,
          name: 'ok',
          definition: definition(),
          created_at: NOW,
          updated_at: NOW,
        },
        {
          id: ID2,
          user_id: A,
          name: 'Kaputt',
          definition: { version: 1 },
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      variants: [{ user_id: A, workout_id: 'x', definition: variant, updated_at: NOW }],
      dislikes: 'nein',
    });
    // „ok“ ist zu kurz (3–60 Zeichen), „x“ keine gültige Workout-ID.
    expect(parsed).toEqual(EMPTY_MY_WORKOUTS);
  });
});

describe('Testmodus (Gerätespeicher)', () => {
  it('speichern, laden, nur eigenes Konto, Export, Konto löschen', async () => {
    const store = createMemoryStore();
    let user: string | null = A;
    const local = createLocalMyWorkouts({ store, userId: async () => user, now: () => NOW });
    await local.saveCustom({ id: ID1, name: '  Mein Beine 30 ', definition: definition() });
    await local.saveVariant('bauch-blitz', variant);
    await local.setDislikes(['burpee-ohne-sprung', 'hampelmann'], true);
    user = B;
    await local.setDislikes(['crunch'], true);
    expect((await local.load()).data.custom).toEqual([]);
    user = A;
    const load = await local.load();
    expect(load.data.custom[0]?.name).toBe('Mein Beine 30');
    expect(load.data.variants.map((v) => v.workout_id)).toEqual(['bauch-blitz']);
    expect(load.data.dislikes.map((d) => d.exercise_id)).toEqual([
      'burpee-ohne-sprung',
      'hampelmann',
    ]);
    const exported = await local.exportTables();
    expect(Object.keys(exported ?? {})).toEqual([
      'custom_workouts',
      'workout_variants',
      'exercise_dislikes',
    ]);
    expect(exported?.exercise_dislikes).toHaveLength(2);
    await local.setDislikes(['hampelmann'], false);
    expect((await local.load()).data.dislikes).toHaveLength(1);
    await local.deleteMine();
    expect((await local.load()).data).toEqual(EMPTY_MY_WORKOUTS);
    user = B;
    expect((await local.load()).data.dislikes).toHaveLength(1);
  });

  it('ungültig bzw. Höchstzahl → Fehler, ohne Anmeldung → not_signed_in', async () => {
    const store = createMemoryStore();
    const local = createLocalMyWorkouts({ store, userId: async () => A, now: () => NOW });
    await expect(
      local.saveCustom({ id: 'keine-uuid', name: 'Name', definition: definition() }),
    ).rejects.toEqual(new MyWorkoutsError('invalid'));
    await expect(
      local.saveCustom({ id: ID1, name: 'x', definition: definition() }),
    ).rejects.toBeInstanceOf(MyWorkoutsError);
    const anonymous = createLocalMyWorkouts({ store, userId: async () => null, now: () => NOW });
    await expect(anonymous.load()).rejects.toEqual(new MyWorkoutsError('not_signed_in'));
  });
});

/** Kleiner Nachbau des Supabase-Clients: Tabellen im Speicher, auf Wunsch Netzfehler. */
function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {
    custom_workouts: [],
    workout_variants: [],
    exercise_dislikes: [],
  };
  const state = { offline: false, calls: 0 };
  const networkError = { name: 'TypeError', message: 'Failed to fetch' };
  const keys: Record<string, string[]> = {
    custom_workouts: ['id'],
    workout_variants: ['user_id', 'workout_id'],
    exercise_dislikes: ['user_id', 'exercise_id'],
  };
  const from = (table: string) => {
    const rows = tables[table] as Record<string, unknown>[];
    const result = (data: unknown) => {
      state.calls += 1;
      return Promise.resolve(
        state.offline ? { data: null, error: networkError } : { data, error: null },
      );
    };
    return {
      upsert(row: Record<string, unknown>) {
        if (!state.offline) {
          const key = keys[table] as string[];
          const i = rows.findIndex((r) => key.every((k) => r[k] === row[k]));
          const full = { created_at: NOW, updated_at: NOW, ...row };
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else rows.push(full);
        }
        return result(null);
      },
      delete() {
        const filters: [string, unknown][] = [];
        const chain = {
          eq(k: string, v: unknown) {
            filters.push([k, v]);
            return chain;
          },
          then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
            if (!state.offline) {
              const keep = rows.filter((r) => !filters.every(([fk, fv]) => r[fk] === fv));
              rows.splice(0, rows.length, ...keep);
            }
            return result(null).then(resolve, reject);
          },
        };
        return chain;
      },
      select() {
        return {
          eq(k: string, v: unknown) {
            return result(rows.filter((r) => r[k] === v));
          },
        };
      },
    };
  };
  return { client: { from } as unknown as AppSupabaseClient, tables, state };
}

describe('Supabase-Modus (Warteschlange)', () => {
  it('offline: Änderung sofort sichtbar, wartet; online: gesendet, Server-Stand geladen', async () => {
    const store = createMemoryStore();
    const fake = fakeClient();
    const remote = createRemoteMyWorkouts({
      client: fake.client,
      store,
      userId: async () => A,
      now: () => NOW,
    });
    fake.state.offline = true;
    expect(
      await remote.saveCustom({ id: ID1, name: 'Mein Beine 30', definition: definition() }),
    ).toBe('queued');
    expect(await remote.setDislikes(['hampelmann'], true)).toBe('queued');
    const offline = await remote.load();
    expect(offline.offline).toBe(true);
    expect(offline.pending).toBe(2);
    expect(offline.data.custom.map((c) => c.name)).toEqual(['Mein Beine 30']);
    expect(fake.tables.custom_workouts).toEqual([]);

    fake.state.offline = false;
    const online = await remote.load();
    expect(online).toMatchObject({ offline: false, pending: 0 });
    expect(fake.tables.custom_workouts).toHaveLength(1);
    expect(fake.tables.exercise_dislikes).toHaveLength(1);
    expect(online.data.custom[0]?.id).toBe(ID1);
    expect(await remote.saveVariant('bauch-blitz', variant)).toBe('saved');
    expect(await remote.saveVariant('bauch-blitz', null)).toBe('saved');
    expect(fake.tables.workout_variants).toEqual([]);
    expect(await remote.exportTables()).toBeNull();
    await remote.clearDevice();
    expect(await store.getItem(MY_WORKOUTS_KEYS.cache)).toBeNull();
  });
});
