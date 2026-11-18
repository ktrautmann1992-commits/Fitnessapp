import {
  CUSTOM_WORKOUT_RULES,
  contentIdSchema,
  type CustomWorkoutDefinition,
  customWorkoutDefinitionSchema,
  customWorkoutNameSchema,
  type WorkoutVariant,
  workoutVariantSchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient, Json } from '@fitnessapp/db';
import { z } from 'zod';

import type { Backend } from './backend';
import { type KeyValueStore, readJson, writeJson } from './kv';
import { isNetworkError } from './shoes';

/**
 * Eigene Workouts, getauschte Bibliotheks-Workouts und „Mag ich nicht“ je Übung (docs/PLAN-EIGENE-WORKOUTS.md 4):
 * offline-first wie der Trinken-Tracker. Supabase-Modus – jede Änderung gilt sofort auf dem Gerät, geht in eine
 * Warteschlange und wird gesendet (Tabellen custom_workouts, workout_variants, exercise_dislikes; RLS: nur eigene
 * Zeilen; gleiche id = kein Doppel, letzte Änderung gewinnt). Testmodus – alles im Gerätespeicher mit denselben Regeln
 * (Zod, Höchstzahlen). Kein Gesundheitsdatum; trotzdem nie loggen und nie an Analytics. Export und Löschen: über
 * attachMyWorkouts (Testmodus) bzw. export_my_data()/Kaskade (Supabase).
 */

export interface CustomWorkoutRow {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly definition: CustomWorkoutDefinition;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WorkoutVariantRow {
  readonly user_id: string;
  readonly workout_id: string;
  readonly definition: WorkoutVariant;
  readonly updated_at: string;
}

export interface ExerciseDislikeRow {
  readonly user_id: string;
  readonly exercise_id: string;
  readonly created_at: string;
}

export interface MyWorkoutsData {
  readonly custom: readonly CustomWorkoutRow[];
  readonly variants: readonly WorkoutVariantRow[];
  readonly dislikes: readonly ExerciseDislikeRow[];
}

export const EMPTY_MY_WORKOUTS: MyWorkoutsData = { custom: [], variants: [], dislikes: [] };

export interface MyWorkoutsLoad {
  readonly data: MyWorkoutsData;
  /** true = Server nicht erreichbar, gezeigt wird der zuletzt geladene Stand plus wartende Änderungen. */
  readonly offline: boolean;
  /** Noch nicht gesendete Änderungen. */
  readonly pending: number;
}

export type MyWorkoutsSaveResult = 'saved' | 'queued';

export interface MyWorkoutsBackend {
  load(): Promise<MyWorkoutsLoad>;
  /** Eigenes Workout anlegen bzw. ersetzen (gleiche id). */
  saveCustom(change: {
    id: string;
    name: string;
    definition: CustomWorkoutDefinition;
  }): Promise<MyWorkoutsSaveResult>;
  deleteCustom(id: string): Promise<MyWorkoutsSaveResult>;
  /** Variante eines Bibliotheks-Workouts setzen; null = „Original wiederherstellen“. */
  saveVariant(workoutId: string, variant: WorkoutVariant | null): Promise<MyWorkoutsSaveResult>;
  /** Übungen auf „Mag ich nicht“ setzen bzw. wieder zulassen. */
  setDislikes(exerciseIds: readonly string[], disliked: boolean): Promise<MyWorkoutsSaveResult>;
  /** Testmodus: Zeilen für den Datenexport; Supabase-Modus: null (export_my_data liefert sie). */
  exportTables(): Promise<Record<string, Record<string, unknown>[]> | null>;
  /** Konto löschen: Testmodus löscht die eigenen Zeilen; Supabase-Modus nichts (Kaskade über auth.users). */
  deleteMine(): Promise<void>;
  clearDevice(): Promise<void>;
}

export class MyWorkoutsError extends Error {
  constructor(readonly code: 'invalid' | 'limit' | 'not_signed_in' | 'unknown') {
    super(code);
  }
}

export const MY_WORKOUTS_KEYS = {
  local: 'fitnessapp.my-workouts-local.v1',
  queue: 'fitnessapp.my-workouts-queue.v1',
  cache: 'fitnessapp.my-workouts-cache.v1',
} as const;

// ---------------------------------------------------------------------------------------------------------
// Zod an der Grenze (Gerätespeicher und Server sind nicht vertrauenswürdig)
// ---------------------------------------------------------------------------------------------------------
const timestamp = z.string().min(1);
const customRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().min(1),
  name: customWorkoutNameSchema,
  definition: customWorkoutDefinitionSchema,
  created_at: timestamp,
  updated_at: timestamp,
});
const variantRowSchema = z.object({
  user_id: z.string().min(1),
  workout_id: contentIdSchema,
  definition: workoutVariantSchema,
  updated_at: timestamp,
});
const dislikeRowSchema = z.object({
  user_id: z.string().min(1),
  exercise_id: contentIdSchema,
  created_at: timestamp,
});

const opSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('save_custom'),
    userId: z.string(),
    id: z.string().uuid(),
    name: customWorkoutNameSchema,
    definition: customWorkoutDefinitionSchema,
    at: timestamp,
  }),
  z.object({ op: z.literal('delete_custom'), userId: z.string(), id: z.string().uuid() }),
  z.object({
    op: z.literal('save_variant'),
    userId: z.string(),
    workoutId: contentIdSchema,
    definition: workoutVariantSchema.nullable(),
    at: timestamp,
  }),
  z.object({
    op: z.literal('set_dislike'),
    userId: z.string(),
    exerciseId: contentIdSchema,
    disliked: z.boolean(),
    at: timestamp,
  }),
]);
export type MyWorkoutsOp = z.infer<typeof opSchema>;

function parseList<T>(raw: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Gespeicherten Stand prüfen: ungültige Zeilen fallen weg (nie halbe Workouts im Player). */
export function parseMyWorkoutsData(raw: unknown): MyWorkoutsData {
  const value = (raw ?? {}) as { custom?: unknown; variants?: unknown; dislikes?: unknown };
  return {
    custom: parseList(value.custom, customRowSchema) as CustomWorkoutRow[],
    variants: parseList(value.variants, variantRowSchema) as WorkoutVariantRow[],
    dislikes: parseList(value.dislikes, dislikeRowSchema) as ExerciseDislikeRow[],
  };
}

function onlyUser(data: MyWorkoutsData, userId: string): MyWorkoutsData {
  return {
    custom: data.custom.filter((r) => r.user_id === userId),
    variants: data.variants.filter((r) => r.user_id === userId),
    dislikes: data.dislikes.filter((r) => r.user_id === userId),
  };
}

function sorted(data: MyWorkoutsData): MyWorkoutsData {
  return {
    custom: [...data.custom].sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    ),
    variants: [...data.variants].sort((a, b) => a.workout_id.localeCompare(b.workout_id)),
    dislikes: [...data.dislikes].sort((a, b) => a.exercise_id.localeCompare(b.exercise_id)),
  };
}

/**
 * Eine Änderung auf den Stand anwenden (rein): wie die Tabellen – Upsert je id bzw. (Person, Workout) bzw. (Person,
 * Übung), Löschen entfernt. Höchstzahlen gelten nur für NEUE Zeilen (Ändern geht immer).
 */
export function applyMyWorkoutsOp(
  data: MyWorkoutsData,
  op: MyWorkoutsOp,
): { data: MyWorkoutsData; ok: boolean } {
  const userId = op.userId;
  const mine = <T extends { user_id: string }>(rows: readonly T[]) =>
    rows.filter((r) => r.user_id === userId);
  switch (op.op) {
    case 'save_custom': {
      const existing = data.custom.find((r) => r.id === op.id);
      if (existing && existing.user_id !== userId) return { data, ok: false };
      if (!existing && mine(data.custom).length >= CUSTOM_WORKOUT_RULES.maxCustom) {
        return { data, ok: false };
      }
      const row: CustomWorkoutRow = {
        id: op.id,
        user_id: userId,
        name: op.name,
        definition: op.definition,
        created_at: existing?.created_at ?? op.at,
        updated_at: op.at,
      };
      return {
        data: sorted({ ...data, custom: [...data.custom.filter((r) => r.id !== op.id), row] }),
        ok: true,
      };
    }
    case 'delete_custom':
      return {
        data: {
          ...data,
          custom: data.custom.filter((r) => !(r.id === op.id && r.user_id === userId)),
        },
        ok: true,
      };
    case 'save_variant': {
      const rest = data.variants.filter(
        (r) => !(r.user_id === userId && r.workout_id === op.workoutId),
      );
      if (op.definition === null) return { data: { ...data, variants: rest }, ok: true };
      const isNew = rest.length === data.variants.length;
      if (isNew && mine(data.variants).length >= CUSTOM_WORKOUT_RULES.maxVariants) {
        return { data, ok: false };
      }
      const row: WorkoutVariantRow = {
        user_id: userId,
        workout_id: op.workoutId,
        definition: op.definition,
        updated_at: op.at,
      };
      return { data: sorted({ ...data, variants: [...rest, row] }), ok: true };
    }
    case 'set_dislike': {
      const rest = data.dislikes.filter(
        (r) => !(r.user_id === userId && r.exercise_id === op.exerciseId),
      );
      if (!op.disliked) return { data: { ...data, dislikes: rest }, ok: true };
      if (rest.length !== data.dislikes.length) return { data, ok: true };
      if (mine(data.dislikes).length >= CUSTOM_WORKOUT_RULES.maxDislikes) {
        return { data, ok: false };
      }
      const row: ExerciseDislikeRow = {
        user_id: userId,
        exercise_id: op.exerciseId,
        created_at: op.at,
      };
      return { data: sorted({ ...data, dislikes: [...rest, row] }), ok: true };
    }
  }
}

function opsFor(
  userId: string,
  now: string,
  change:
    | { kind: 'custom'; id: string; name: string; definition: CustomWorkoutDefinition }
    | { kind: 'delete'; id: string }
    | { kind: 'variant'; workoutId: string; variant: WorkoutVariant | null }
    | { kind: 'dislikes'; exerciseIds: readonly string[]; disliked: boolean },
): MyWorkoutsOp[] {
  const raw: unknown[] =
    change.kind === 'custom'
      ? [
          {
            op: 'save_custom',
            userId,
            id: change.id,
            name: change.name.trim(),
            definition: change.definition,
            at: now,
          },
        ]
      : change.kind === 'delete'
        ? [{ op: 'delete_custom', userId, id: change.id }]
        : change.kind === 'variant'
          ? [
              {
                op: 'save_variant',
                userId,
                workoutId: change.workoutId,
                definition: change.variant,
                at: now,
              },
            ]
          : change.exerciseIds.map((exerciseId) => ({
              op: 'set_dislike',
              userId,
              exerciseId,
              disliked: change.disliked,
              at: now,
            }));
  return raw.map((op) => {
    const parsed = opSchema.safeParse(op);
    if (!parsed.success) throw new MyWorkoutsError('invalid');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Testmodus: Gerätespeicher
// ---------------------------------------------------------------------------------------------------------
export function createLocalMyWorkouts(options: {
  store: KeyValueStore;
  userId: () => Promise<string | null>;
  now: () => string;
}): MyWorkoutsBackend {
  const { store } = options;
  const all = async () =>
    parseMyWorkoutsData(await readJson<unknown>(store, MY_WORKOUTS_KEYS.local).catch(() => null));
  const uid = async () => {
    const id = await options.userId();
    if (!id) throw new MyWorkoutsError('not_signed_in');
    return id;
  };
  async function apply(ops: MyWorkoutsOp[]): Promise<MyWorkoutsSaveResult> {
    let data = await all();
    for (const op of ops) {
      const result = applyMyWorkoutsOp(data, op);
      if (!result.ok) throw new MyWorkoutsError('limit');
      data = result.data;
    }
    await writeJson(store, MY_WORKOUTS_KEYS.local, data);
    return 'saved';
  }
  return {
    async load() {
      const id = await uid();
      return { data: onlyUser(await all(), id), offline: false, pending: 0 };
    },
    async saveCustom(change) {
      return apply(opsFor(await uid(), options.now(), { kind: 'custom', ...change }));
    },
    async deleteCustom(id) {
      return apply(opsFor(await uid(), options.now(), { kind: 'delete', id }));
    },
    async saveVariant(workoutId, variant) {
      return apply(opsFor(await uid(), options.now(), { kind: 'variant', workoutId, variant }));
    },
    async setDislikes(exerciseIds, disliked) {
      return apply(opsFor(await uid(), options.now(), { kind: 'dislikes', exerciseIds, disliked }));
    },
    async exportTables() {
      const id = await options.userId();
      if (!id) return null;
      const mine = onlyUser(await all(), id);
      const rows = (list: readonly object[]) =>
        list.map((r) => ({ ...r }) as Record<string, unknown>);
      return {
        custom_workouts: rows(mine.custom),
        workout_variants: rows(mine.variants),
        exercise_dislikes: rows(mine.dislikes),
      };
    },
    async deleteMine() {
      const id = await options.userId();
      if (!id) return;
      const data = await all();
      await writeJson(store, MY_WORKOUTS_KEYS.local, {
        custom: data.custom.filter((r) => r.user_id !== id),
        variants: data.variants.filter((r) => r.user_id !== id),
        dislikes: data.dislikes.filter((r) => r.user_id !== id),
      });
    },
    async clearDevice() {
      // Testmodus: Daten liegen nur hier – „Gerätedaten löschen“ des Backends löscht den ganzen Speicher selbst.
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Supabase-Modus: Server + Warteschlange
// ---------------------------------------------------------------------------------------------------------
export function createRemoteMyWorkouts(options: {
  client: AppSupabaseClient;
  store: KeyValueStore;
  userId: () => Promise<string | null>;
  now: () => string;
}): MyWorkoutsBackend {
  const { client, store } = options;
  const queue = async () =>
    parseList(await readJson<unknown>(store, MY_WORKOUTS_KEYS.queue).catch(() => null), opSchema);
  const writeQueue = (ops: MyWorkoutsOp[]) => writeJson(store, MY_WORKOUTS_KEYS.queue, ops);
  const uid = async () => {
    const id = await options.userId();
    if (!id) throw new MyWorkoutsError('not_signed_in');
    return id;
  };

  async function send(op: MyWorkoutsOp): Promise<{ error: unknown }> {
    switch (op.op) {
      case 'save_custom':
        return client.from('custom_workouts').upsert(
          {
            id: op.id,
            user_id: op.userId,
            name: op.name,
            definition: op.definition as unknown as Json,
          },
          { onConflict: 'id' },
        );
      case 'delete_custom':
        return client.from('custom_workouts').delete().eq('user_id', op.userId).eq('id', op.id);
      case 'save_variant':
        return op.definition === null
          ? client
              .from('workout_variants')
              .delete()
              .eq('user_id', op.userId)
              .eq('workout_id', op.workoutId)
          : client.from('workout_variants').upsert(
              {
                user_id: op.userId,
                workout_id: op.workoutId,
                definition: op.definition as unknown as Json,
              },
              { onConflict: 'user_id,workout_id' },
            );
      case 'set_dislike':
        return op.disliked
          ? client
              .from('exercise_dislikes')
              .upsert(
                { user_id: op.userId, exercise_id: op.exerciseId },
                { onConflict: 'user_id,exercise_id', ignoreDuplicates: true },
              )
          : client
              .from('exercise_dislikes')
              .delete()
              .eq('user_id', op.userId)
              .eq('exercise_id', op.exerciseId);
    }
  }

  /** Wartende senden; bei Netzfehler aufhören (später erneut), abgelehnte verwerfen (der Server hat recht). */
  async function flush(userId: string): Promise<void> {
    let ops = await queue();
    for (const op of [...ops]) {
      if (op.userId !== userId) continue;
      const { error } = await send(op);
      if (error && isNetworkError(error)) return;
      ops = ops.filter((o) => o !== op);
      await writeQueue(ops);
    }
  }

  async function readCache(userId: string): Promise<MyWorkoutsData> {
    const cache = await readJson<{ userId?: unknown; data?: unknown }>(
      store,
      MY_WORKOUTS_KEYS.cache,
    ).catch(() => null);
    return cache?.userId === userId
      ? onlyUser(parseMyWorkoutsData(cache.data), userId)
      : EMPTY_MY_WORKOUTS;
  }

  async function overlay(base: MyWorkoutsData, userId: string) {
    const ops = (await queue()).filter((o) => o.userId === userId);
    let data = base;
    for (const op of ops) data = applyMyWorkoutsOp(data, op).data;
    return { data, pending: ops.length };
  }

  async function enqueue(userId: string, ops: MyWorkoutsOp[]): Promise<MyWorkoutsSaveResult> {
    // Höchstzahlen schon auf dem Gerät prüfen (klare Meldung statt stiller Ablehnung beim Senden).
    let data = (await overlay(await readCache(userId), userId)).data;
    for (const op of ops) {
      const result = applyMyWorkoutsOp(data, op);
      if (!result.ok) throw new MyWorkoutsError('limit');
      data = result.data;
    }
    await writeQueue([...(await queue()), ...ops]);
    await flush(userId).catch(() => undefined);
    const left = (await queue()).filter((o) => o.userId === userId);
    return ops.some(
      (op) => left.includes(op) || left.some((l) => JSON.stringify(l) === JSON.stringify(op)),
    )
      ? 'queued'
      : 'saved';
  }

  return {
    async load() {
      const id = await uid();
      await flush(id).catch(() => undefined);
      try {
        const [custom, variants, dislikes] = await Promise.all([
          client
            .from('custom_workouts')
            .select('id, user_id, name, definition, created_at, updated_at')
            .eq('user_id', id),
          client
            .from('workout_variants')
            .select('user_id, workout_id, definition, updated_at')
            .eq('user_id', id),
          client
            .from('exercise_dislikes')
            .select('user_id, exercise_id, created_at')
            .eq('user_id', id),
        ]);
        const error = custom.error ?? variants.error ?? dislikes.error;
        if (error) throw error;
        const server = sorted(
          parseMyWorkoutsData({
            custom: custom.data,
            variants: variants.data,
            dislikes: dislikes.data,
          }),
        );
        await writeJson(store, MY_WORKOUTS_KEYS.cache, { userId: id, data: server }).catch(
          () => undefined,
        );
        const { data, pending } = await overlay(server, id);
        return { data, offline: false, pending };
      } catch {
        const { data, pending } = await overlay(await readCache(id), id);
        return { data, offline: true, pending };
      }
    },
    async saveCustom(change) {
      const id = await uid();
      return enqueue(id, opsFor(id, options.now(), { kind: 'custom', ...change }));
    },
    async deleteCustom(workoutRowId) {
      const id = await uid();
      return enqueue(id, opsFor(id, options.now(), { kind: 'delete', id: workoutRowId }));
    },
    async saveVariant(workoutId, variant) {
      const id = await uid();
      return enqueue(id, opsFor(id, options.now(), { kind: 'variant', workoutId, variant }));
    },
    async setDislikes(exerciseIds, disliked) {
      const id = await uid();
      return enqueue(id, opsFor(id, options.now(), { kind: 'dislikes', exerciseIds, disliked }));
    },
    exportTables: async () => null,
    deleteMine: async () => undefined,
    async clearDevice() {
      await store.removeItem(MY_WORKOUTS_KEYS.queue).catch(() => undefined);
      await store.removeItem(MY_WORKOUTS_KEYS.cache).catch(() => undefined);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Anhängen an das Backend
// ---------------------------------------------------------------------------------------------------------
const registry = new WeakMap<Backend, MyWorkoutsBackend>();

/** Schnittstelle zu einem Backend (null = nicht verbunden, z. B. in Tests). */
export function myWorkoutsBackendFor(backend: Backend): MyWorkoutsBackend | null {
  return registry.get(backend) ?? null;
}

/** Aufräumen bei Abmelden/Konto löschen/Gerätedaten löschen und Testmodus-Export anhängen. */
export function attachMyWorkouts(backend: Backend, mine: MyWorkoutsBackend): Backend {
  registry.set(backend, mine);
  const clear = () => mine.clearDevice().catch(() => undefined);
  const signOut = backend.signOut.bind(backend);
  backend.signOut = async () => {
    await clear();
    await signOut();
  };
  const deleteAccount = backend.deleteAccount.bind(backend);
  backend.deleteAccount = async () => {
    // Testmodus: eigene Zeilen dieses Kontos löschen (Supabase: Kaskade über auth.users) – vor dem Konto, solange
    // die Anmeldung noch besteht.
    await mine.deleteMine().catch(() => undefined);
    await deleteAccount();
    await clear();
  };
  const clearDeviceData = backend.clearDeviceData.bind(backend);
  backend.clearDeviceData = async () => {
    await clear();
    await clearDeviceData();
  };
  const exportMyData = backend.exportMyData.bind(backend);
  backend.exportMyData = async () => {
    const file = await exportMyData();
    const tables = await mine.exportTables().catch(() => null);
    return tables ? { ...file, data: { ...file.data, ...tables } } : file;
  };
  return backend;
}
