import {
  addDays,
  HYDRATION,
  type HydrationEntry,
  type HydrationEntryPayload,
  hydrationEntrySchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { z } from 'zod';

import type { Backend } from './backend';
import { type KeyValueStore, readJson, writeJson } from './kv';

/**
 * Trinken-Tracker (25.10.2026): offline-first. Supabase-Modus – Einträge gehen zuerst in eine Warteschlange auf dem
 * Gerät und werden gesendet (add_hydration/delete_hydration, gleiche id = kein Doppel), die Anzeige mischt Server-Stand
 * und Warteschlange; Testmodus – alles im Gerätespeicher mit denselben Regeln. Export über export_my_data (Testmodus:
 * local-backend), Aufräumen über attachHydration. Nur Zusammensetzen; Regeln in packages/core (hydration.ts) bzw. auf dem Server. Nie
 * Mengen in Logs.
 */

export interface HydrationLoad {
  readonly entries: HydrationEntry[];
  readonly offline: boolean;
}

export interface HydrationBackend {
  /** Einträge `from` … `to` (inkl.) des angemeldeten Kontos inkl. wartender. */
  load(from: string, to: string): Promise<HydrationLoad>;
  add(entry: HydrationEntryPayload): Promise<'saved' | 'queued'>;
  remove(id: string): Promise<void>;
  deleteAll(): Promise<number>;
  clearDevice(): Promise<void>;
}

export class HydrationError extends Error {
  constructor(readonly code: 'invalid' | 'limit' | 'unknown' | 'not_signed_in') {
    super(code);
  }
}

export const HYDRATION_KEYS = {
  local: 'fitnessapp.hydration-local.v1',
  queue: 'fitnessapp.hydration-queue.v1',
  cache: 'fitnessapp.hydration-cache.v1',
} as const;

const rowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  day: z.string(),
  amount_ml: z.number(),
  created_at: z.string(),
});
const opSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    userId: z.string(),
    entry: hydrationEntrySchema,
    at: z.string(),
  }),
  z.object({ op: z.literal('delete'), userId: z.string(), id: z.string() }),
]);
type Op = z.infer<typeof opSchema>;

async function readList<T>(store: KeyValueStore, key: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await readJson<unknown>(store, key).catch(() => null);
  const parsed = z.array(schema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Server-Stand und Warteschlange zusammenführen (wartende Einträge zählen sofort, gelöschte fallen weg). */
export function mergeHydration(
  server: readonly HydrationEntry[],
  queue: readonly Op[],
  userId: string,
): HydrationEntry[] {
  const byId = new Map(server.filter((e) => e.user_id === userId).map((e) => [e.id, e] as const));
  for (const op of queue) {
    if (op.userId !== userId) continue;
    if (op.op === 'add') {
      byId.set(op.entry.id, { ...op.entry, user_id: userId, created_at: op.at });
    } else byId.delete(op.id);
  }
  return [...byId.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.created_at.localeCompare(b.created_at),
  );
}

/** Testmodus: Einträge im Gerätespeicher (alle Konten dieses Geräts, gefiltert nach user_id). */
export function createLocalHydration(options: {
  store: KeyValueStore;
  userId: () => Promise<string | null>;
  now: () => string;
  today: () => string;
}): HydrationBackend {
  const { store } = options;
  const all = () => readList(store, HYDRATION_KEYS.local, rowSchema);
  const uid = async () => {
    const id = await options.userId();
    if (!id) throw new HydrationError('not_signed_in');
    return id;
  };
  return {
    async load(from, to) {
      const id = await uid();
      const entries = (await all())
        .filter((e) => e.user_id === id && e.day >= from && e.day <= to)
        .sort((a, b) => a.day.localeCompare(b.day) || a.created_at.localeCompare(b.created_at));
      return { entries, offline: false };
    },
    async add(entry) {
      const id = await uid();
      const parsed = hydrationEntrySchema.safeParse(entry);
      const today = options.today();
      if (!parsed.success) throw new HydrationError('invalid');
      const e = parsed.data;
      if (e.day > today || e.day < addDays(today, -HYDRATION.backfillDays)) {
        throw new HydrationError('invalid');
      }
      const rows = await all();
      if (rows.some((r) => r.id === e.id && r.user_id === id)) return 'saved';
      if (
        rows.filter((r) => r.user_id === id && r.day === e.day).length >= HYDRATION.maxEntriesPerDay
      ) {
        throw new HydrationError('limit');
      }
      await writeJson(store, HYDRATION_KEYS.local, [
        ...rows,
        { ...e, user_id: id, created_at: options.now() },
      ]);
      return 'saved';
    },
    async remove(entryId) {
      const id = await uid();
      const rows = await all();
      await writeJson(
        store,
        HYDRATION_KEYS.local,
        rows.filter((r) => !(r.id === entryId && r.user_id === id)),
      );
    },
    async deleteAll() {
      const id = await uid();
      const rows = await all();
      await writeJson(
        store,
        HYDRATION_KEYS.local,
        rows.filter((r) => r.user_id !== id),
      );
      return rows.filter((r) => r.user_id === id).length;
    },
    async clearDevice() {
      // Testmodus: Daten liegen nur hier – „Gerätedaten löschen“ des Backends löscht den ganzen Speicher selbst.
    },
  };
}

/** Supabase-Modus: Warteschlange + Server (RLS: nur eigene Zeilen). */
export function createRemoteHydration(options: {
  client: AppSupabaseClient;
  store: KeyValueStore;
  userId: () => Promise<string | null>;
  now: () => string;
}): HydrationBackend {
  const { client, store } = options;
  const queue = () => readList(store, HYDRATION_KEYS.queue, opSchema);
  const writeQueue = (ops: Op[]) => writeJson(store, HYDRATION_KEYS.queue, ops);
  const uid = async () => {
    const id = await options.userId();
    if (!id) throw new HydrationError('not_signed_in');
    return id;
  };

  /** Wartende senden; bei Netzfehler aufhören (später erneut), abgelehnte verwerfen. */
  async function flush(userId: string): Promise<void> {
    let ops = await queue();
    for (const op of [...ops]) {
      if (op.userId !== userId) continue;
      const { error } =
        op.op === 'add'
          ? await client.rpc('add_hydration', { p_entry: op.entry })
          : await client.rpc('delete_hydration', { p_id: op.id });
      if (error) {
        const network = !error.code || /fetch|network/i.test(error.message ?? '');
        if (network) return;
      }
      ops = ops.filter((o) => o !== op);
      await writeQueue(ops);
    }
  }

  return {
    async load(from, to) {
      const id = await uid();
      await flush(id).catch(() => undefined);
      const ops = await queue();
      try {
        const { data, error } = await client
          .from('hydration_logs')
          .select('id, user_id, day, amount_ml, created_at')
          .eq('user_id', id)
          .gte('day', from)
          .lte('day', to)
          .order('day');
        if (error) throw error;
        const server = z.array(rowSchema).parse(data ?? []);
        await writeJson(store, HYDRATION_KEYS.cache, { userId: id, rows: server }).catch(
          () => undefined,
        );
        return { entries: mergeHydration(server, ops, id), offline: false };
      } catch {
        const cache = await readJson<{ userId: string; rows: unknown }>(
          store,
          HYDRATION_KEYS.cache,
        ).catch(() => null);
        const rows =
          cache?.userId === id ? (z.array(rowSchema).safeParse(cache.rows).data ?? []) : [];
        const inRange = rows.filter((r) => r.day >= from && r.day <= to);
        return { entries: mergeHydration(inRange, ops, id), offline: true };
      }
    },
    async add(entry) {
      const id = await uid();
      const parsed = hydrationEntrySchema.safeParse(entry);
      if (!parsed.success) throw new HydrationError('invalid');
      await writeQueue([
        ...(await queue()),
        { op: 'add', userId: id, entry: parsed.data, at: options.now() },
      ]);
      await flush(id).catch(() => undefined);
      return (await queue()).some((o) => o.op === 'add' && o.entry.id === parsed.data.id)
        ? 'queued'
        : 'saved';
    },
    async remove(entryId) {
      const id = await uid();
      const ops = await queue();
      // Noch nicht gesendet → nur aus der Warteschlange.
      if (ops.some((o) => o.op === 'add' && o.entry.id === entryId)) {
        await writeQueue(ops.filter((o) => !(o.op === 'add' && o.entry.id === entryId)));
        return;
      }
      await writeQueue([...ops, { op: 'delete', userId: id, id: entryId }]);
      await flush(id).catch(() => undefined);
    },
    async deleteAll() {
      const id = await uid();
      const { data, error } = await client.rpc('delete_all_hydration');
      if (error) throw new HydrationError('unknown');
      await writeQueue((await queue()).filter((o) => o.userId !== id));
      return typeof data === 'number' ? data : 0;
    },
    async clearDevice() {
      await store.removeItem(HYDRATION_KEYS.queue).catch(() => undefined);
      await store.removeItem(HYDRATION_KEYS.cache).catch(() => undefined);
    },
  };
}

const registry = new WeakMap<Backend, HydrationBackend>();

/** Trinken-Schnittstelle zu einem Backend (null = nicht verbunden, z. B. in Tests). */
export function hydrationBackendFor(backend: Backend): HydrationBackend | null {
  return registry.get(backend) ?? null;
}

/** Aufräumen bei Abmelden/Konto löschen/Gerätedaten löschen anhängen (Export: export_my_data bzw. Testmodus-Export). */
export function attachHydration(backend: Backend, hydration: HydrationBackend): Backend {
  registry.set(backend, hydration);
  const clear = () => hydration.clearDevice().catch(() => undefined);
  const signOut = backend.signOut.bind(backend);
  backend.signOut = async () => {
    await clear();
    await signOut();
  };
  const deleteAccount = backend.deleteAccount.bind(backend);
  backend.deleteAccount = async () => {
    await deleteAccount();
    await clear();
  };
  const clearDeviceData = backend.clearDeviceData.bind(backend);
  backend.clearDeviceData = async () => {
    await clear();
    await clearDeviceData();
  };
  return backend;
}
