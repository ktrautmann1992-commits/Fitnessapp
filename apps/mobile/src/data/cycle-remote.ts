import {
  addDays,
  CYCLE_RULES,
  cycleEntryPayloadSchema,
  cycleEntrySchema,
  cycleExportTables,
  cycleSettingsSchema,
  parseCycleExport,
  type CycleSettings,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { z } from 'zod';

import {
  CycleError,
  cycleErrorCode,
  mergeEntries,
  type CycleAccess,
  type CycleBackend,
  type CycleSnapshot,
} from './cycle-backend';
import type { CycleStores } from './cycle-store-keys';

/**
 * Zyklus-Modul im SUPABASE-MODUS (Plan ZY4, 6.3, 7.4): nur die Server-Funktionen aus
 * 20261021140100_cycle_rpcs.sql, immer per POST (supabase-js `rpc` ohne `get: true`, 6.3a) – keine Parameter in URLs
 * oder API-Logs. Offline: Einträge in die Warteschlange `cycleQueue` (mit Einwilligungszeitpunkt, S5; je Datum
 * gewinnt der neueste), Anzeige aus `cycleCache` (Einstellungen + 120 Tage). Veraltete oder abgelehnte Einträge
 * werden verworfen statt endlos neu gesendet. Fehler nur als feste Codes.
 */
const queueSchema = z.array(
  z.object({ entry: cycleEntrySchema, consentGrantedAt: z.string().min(1).max(40) }),
);
type Queue = z.infer<typeof queueSchema>;

const cacheSchema = z.object({
  settings: cycleSettingsSchema.nullable(),
  entries: z.array(cycleEntrySchema),
  access: z.object({ open: z.boolean(), warnings: z.boolean() }).nullable(),
});
type Cache = z.infer<typeof cacheSchema>;

const accessSchema = z.object({ open: z.boolean(), warnings: z.boolean() });
const settingsRowSchema = z.object({ payload: cycleSettingsSchema }).nullable();
const entriesSchema = z.array(
  z.object({ entry_date: z.string(), payload: cycleEntryPayloadSchema }),
);

/** Fehler, bei denen ein Eintrag aus der Warteschlange verworfen wird (nicht erneut senden). */
const DROP: ReadonlySet<CycleError['code']> = new Set([
  'cycle_consent_missing',
  'cycle_consent_outdated',
  'cycle_payload_invalid',
  'cycle_module_closed',
]);

export function createRemoteCycle(options: {
  client: AppSupabaseClient;
  stores: CycleStores;
}): CycleBackend {
  const { client, stores } = options;

  async function readJson<T>(store: CycleStores[keyof CycleStores], schema: z.ZodType<T>) {
    const raw = await store.read();
    if (raw === null) return null;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  const readQueue = async (): Promise<Queue> =>
    (await readJson(stores.cycleQueue, queueSchema)) ?? [];
  const readCache = async (): Promise<Cache> =>
    (await readJson(stores.cycleCache, cacheSchema)) ?? {
      settings: null,
      entries: [],
      access: null,
    };
  const writeQueue = (queue: Queue) =>
    queue.length === 0 ? stores.cycleQueue.clear() : stores.cycleQueue.write(JSON.stringify(queue));
  const writeCache = (cache: Cache) => stores.cycleCache.write(JSON.stringify(cache));

  /** RPC (POST) mit festen Fehlercodes – nie Inhalte. */
  async function call(name: string, args?: Record<string, unknown>): Promise<unknown> {
    type Rpc = (
      fn: string,
      a?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    let result: { data: unknown; error: { message?: string } | null };
    try {
      // POST (kein `get: true`): Parameter nur im Body, nie in der Adresse (6.3a).
      result = await (client.rpc.bind(client) as unknown as Rpc)(name, args);
    } catch {
      throw new CycleError('network');
    }
    if (result.error) throw new CycleError(cycleErrorCode(result.error.message));
    return result.data;
  }

  async function updateCache(today: string, change: (cache: Cache) => Cache): Promise<void> {
    const cache = change(await readCache());
    const from = addDays(today, -CYCLE_RULES.cacheDays);
    await writeCache({ ...cache, entries: cache.entries.filter((e) => e.date >= from) });
  }

  async function flush(): Promise<void> {
    let queue = await readQueue();
    while (queue.length > 0) {
      const [next] = queue;
      if (!next) break;
      try {
        await call('save_cycle_entry', {
          p_date: next.entry.date,
          p_payload: next.entry.payload,
          p_consent_granted_at: next.consentGrantedAt,
        });
      } catch (error) {
        const code = error instanceof CycleError ? error.code : 'unknown';
        if (!DROP.has(code)) return; // offline oder Ratenbegrenzung: später erneut
      }
      queue = queue.slice(1);
      await writeQueue(queue);
    }
  }

  return {
    mode: 'supabase',
    async access(): Promise<CycleAccess> {
      try {
        const parsed = accessSchema.safeParse(await call('cycle_module_access'));
        const access = parsed.success ? parsed.data : { open: false, warnings: true };
        const cache = await readCache();
        if (cache.settings !== null || cache.entries.length > 0)
          await writeCache({ ...cache, access });
        return access;
      } catch (error) {
        if (error instanceof CycleError && error.code === 'network') {
          return (await readCache()).access ?? { open: false, warnings: true };
        }
        throw error;
      }
    },
    async load(today): Promise<CycleSnapshot> {
      await flush().catch(() => undefined);
      const queue = await readQueue();
      const queued = queue.map((q) => q.entry);
      try {
        const settingsRaw = settingsRowSchema.safeParse(await call('get_cycle_settings'));
        const entriesRaw = entriesSchema.safeParse(
          await call('get_cycle_entries', {
            p_from: addDays(today, -CYCLE_RULES.maxRangeDays),
            p_to: today,
          }),
        );
        if (!settingsRaw.success || !entriesRaw.success) throw new CycleError('unknown');
        const settings = settingsRaw.data?.payload ?? null;
        const entries = entriesRaw.data.map((row) => ({
          date: row.entry_date,
          payload: row.payload,
        }));
        await updateCache(today, (cache) => ({ ...cache, settings, entries }));
        return {
          settings,
          entries: mergeEntries(entries, queued),
          pending: queue.length,
          offline: false,
        };
      } catch (error) {
        if (!(error instanceof CycleError) || error.code !== 'network') throw error;
        const cache = await readCache();
        return {
          settings: cache.settings,
          entries: mergeEntries(cache.entries, queued),
          pending: queue.length,
          offline: true,
        };
      }
    },
    async saveEntry(entry, consentGrantedAt, today) {
      if (!cycleEntrySchema.safeParse(entry).success) throw new CycleError('cycle_payload_invalid');
      try {
        await call('save_cycle_entry', {
          p_date: entry.date,
          p_payload: entry.payload,
          p_consent_granted_at: consentGrantedAt,
        });
        await updateCache(today, (cache) => ({
          ...cache,
          entries: mergeEntries(cache.entries, [entry]),
        }));
        return 'saved';
      } catch (error) {
        if (!(error instanceof CycleError) || error.code !== 'network') throw error;
        const queue = (await readQueue()).filter((q) => q.entry.date !== entry.date);
        await writeQueue([...queue, { entry, consentGrantedAt }]);
        return 'queued';
      }
    },
    async deleteEntry(date) {
      await call('delete_cycle_entry', { p_date: date });
      await writeQueue((await readQueue()).filter((q) => q.entry.date !== date));
      const cache = await readCache();
      await writeCache({ ...cache, entries: cache.entries.filter((e) => e.date !== date) });
    },
    async deleteAllEntries() {
      await call('delete_all_cycle_entries');
      await stores.cycleQueue.clear();
      await writeCache({ ...(await readCache()), entries: [] });
    },
    async saveSettings(settings: CycleSettings, consentGrantedAt) {
      if (!cycleSettingsSchema.safeParse(settings).success) {
        throw new CycleError('cycle_payload_invalid');
      }
      await call('save_cycle_settings', {
        p_payload: settings,
        p_consent_granted_at: consentGrantedAt,
      });
      await writeCache({ ...(await readCache()), settings });
    },
    async exportTables() {
      const parsed = parseCycleExport(await call('export_my_cycle_data'));
      if (parsed === null) throw new CycleError('unknown');
      return cycleExportTables(parsed);
    },
    flush,
    async clearDevice() {
      await stores.cycleQueue.clear();
      await stores.cycleCache.clear();
    },
  };
}
