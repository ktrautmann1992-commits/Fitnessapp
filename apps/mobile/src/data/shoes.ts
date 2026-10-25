import {
  EMPTY_SHOE_DATA,
  type EnduranceLogInput,
  parseShoeData,
  type ShoeData,
  shoeDataSchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';

import { BackendError, type Backend } from './backend';
import type { KeyValueStore } from './kv';

/**
 * Schuh-Kilometerzähler in der App (docs/PLAN-PHASE-10.md Abschnitt 22). Eigene Schnittstelle neben dem Backend (wie das
 * Zyklus-Modul, `attachShoes` in create-backend.ts) – so bleiben backend.ts, local-backend.ts und supabase-backend.ts
 * unberührt.
 *
 * - Testmodus: Stand je Konto im Gerätespeicher (Schlüssel SHOE_STORAGE_KEY).
 * - Supabase: Lesen per RLS (shoes, shoe_defaults, shoe_assignments), Speichern über save_shoe_data (ersetzt den
 *   ganzen Stand). OFFLINE-FIRST: Jede Änderung landet sofort im Gerätespeicher (kein Gesundheitsdatum) und wird als
 *   „wartend“ markiert; beim nächsten Laden bzw. Speichern mit Verbindung wird der neueste Stand gesendet (der neueste
 *   gewinnt – Schuhe ändert man selten, Reihenfolge-Probleme einzelner Vorgänge gibt es so nicht).
 * - Ältere Ausdauer-Einträge (vor dem Tagebuch-Fenster der App, LOG_CACHE_WEEKS) lädt `load` nur online und nur ab dem
 *   ersten Schuh-Tag nach (nur Datum, Art und Distanz; nie gespeichert).
 */

export const SHOE_STORAGE_KEY = 'fitnessapp.shoes.v1';

export interface ShoeLoadResult {
  readonly data: ShoeData;
  /** Ausdauer-Einträge vor dem Tagebuch-Fenster (nur online; sonst []). */
  readonly olderLogs: readonly EnduranceLogInput[];
  /** Stand aus dem Gerätespeicher, Server nicht erreichbar. */
  readonly offline: boolean;
  /** Änderungen warten noch auf Verbindung. */
  readonly pending: boolean;
}

export interface ShoeBackend {
  /** `historyFrom`: ab diesem Tag ältere Einträge nachladen (null = keine). */
  load(historyFrom: string | null): Promise<ShoeLoadResult>;
  /** Neuen Stand speichern: `saved` (Server) bzw. `queued` (offline, wird nachgereicht). */
  save(data: ShoeData): Promise<'saved' | 'queued'>;
  /** Alle Schuh-Angaben löschen (Recht auf Löschung) – braucht im Supabase-Modus Verbindung. */
  deleteAll(): Promise<void>;
  /** Gerätespeicher leeren (Abmelden, Konto löschen, Gerätedaten löschen). */
  clearDevice(): Promise<void>;
  /** Für den Export im Testmodus (Spalten wie die Tabellen); Supabase liefert sie über export_my_data. */
  exportTables(): Promise<Record<string, Record<string, unknown>[]> | null>;
}

interface Stored {
  readonly userId: string;
  readonly data: ShoeData;
  readonly pending: boolean;
}

async function readStored(store: KeyValueStore, userId: string): Promise<Stored | null> {
  try {
    const raw = await store.getItem(SHOE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const data = parseShoeData(parsed.data);
    if (parsed.userId !== userId || data === null) return null;
    return { userId, data, pending: parsed.pending === true };
  } catch {
    return null;
  }
}

async function writeStored(store: KeyValueStore, value: Stored): Promise<void> {
  await store.setItem(SHOE_STORAGE_KEY, JSON.stringify(value));
}

/** Zeilen wie export_my_data (Testmodus). */
export function shoeExportTables(
  data: ShoeData,
  userId: string,
): Record<'shoes' | 'shoe_defaults' | 'shoe_assignments', Record<string, unknown>[]> {
  return {
    shoes: data.shoes.map((s) => ({ ...s, user_id: userId })),
    shoe_defaults: data.defaults.map((d) => ({ ...d, user_id: userId })),
    shoe_assignments: [...data.assignments]
      .sort((a, b) => a.activity_key.localeCompare(b.activity_key))
      .map((a) => ({ ...a, user_id: userId })),
  };
}

async function requireUserId(backend: Pick<Backend, 'getSession'>): Promise<string> {
  const session = await backend.getSession();
  if (!session) throw new BackendError('not_signed_in');
  return session.userId;
}

/** Testmodus: alles im Gerätespeicher (dokumentierte Ausnahme wie alle Testmodus-Daten). */
export function createLocalShoes(
  store: KeyValueStore,
  backend: Pick<Backend, 'getSession'>,
): ShoeBackend {
  return {
    load: async () => {
      const userId = await requireUserId(backend);
      const stored = await readStored(store, userId);
      return {
        data: stored?.data ?? EMPTY_SHOE_DATA,
        olderLogs: [],
        offline: false,
        pending: false,
      };
    },
    save: async (raw) => {
      const userId = await requireUserId(backend);
      const data = shoeDataSchema.parse(raw);
      await writeStored(store, { userId, data, pending: false });
      return 'saved';
    },
    deleteAll: async () => {
      const userId = await requireUserId(backend);
      await writeStored(store, { userId, data: EMPTY_SHOE_DATA, pending: false });
    },
    clearDevice: async () => {
      await store.removeItem(SHOE_STORAGE_KEY);
    },
    exportTables: async () => {
      const userId = await requireUserId(backend);
      const stored = await readStored(store, userId);
      return shoeExportTables(stored?.data ?? EMPTY_SHOE_DATA, userId);
    },
  };
}

interface ErrorLike {
  readonly message?: string;
  readonly code?: string;
  readonly status?: number;
  readonly name?: string;
}

const NETWORK =
  /failed to fetch|fetch failed|network request failed|networkerror|load failed|timeout|offline/i;

/** Netzfehler (wie classifySupabaseError in supabase-backend.ts, hier ohne Abhängigkeit davon). */
export function isNetworkError(error: unknown): boolean {
  const e = (error ?? {}) as ErrorLike;
  return e.name === 'TypeError' || e.status === 0 || NETWORK.test(e.message ?? '');
}

/** Tabellen bzw. Funktion fehlen (App-Stand vor `db-migrate`). */
function isMissing(error: unknown): boolean {
  const code = (error as ErrorLike | null)?.code;
  return code === 'PGRST205' || code === '42P01' || code === 'PGRST202' || code === '42883';
}

const toPayload = (data: ShoeData) => ({
  shoes: data.shoes.map((s) => ({
    id: s.id,
    sport: s.sport,
    name: s.name,
    brand: s.brand,
    start_km: s.start_km,
    replace_km: s.replace_km,
    in_use_since: s.in_use_since,
    retired_on: s.retired_on,
  })),
  defaults: data.defaults.map((d) => ({
    sport: d.sport,
    valid_from: d.valid_from,
    shoe_id: d.shoe_id,
  })),
  assignments: data.assignments.map((a) => ({ activity_key: a.activity_key, shoe_id: a.shoe_id })),
});

/** Supabase-Modus. `logWindowStart`: ab hier hat die App das Tagebuch ohnehin (LOG_CACHE_WEEKS). */
export function createRemoteShoes(options: {
  client: AppSupabaseClient;
  store: KeyValueStore;
  backend: Pick<Backend, 'getSession'>;
  logWindowStart: () => string;
}): ShoeBackend {
  const { client, store, backend } = options;

  async function send(userId: string, data: ShoeData): Promise<'saved' | 'queued'> {
    const { error } = await client.rpc('save_shoe_data', { p_data: toPayload(data) });
    if (!error) {
      await writeStored(store, { userId, data, pending: false });
      return 'saved';
    }
    if (isNetworkError(error)) return 'queued';
    // Abgelehnt (ungültig) oder vor `db-migrate`: nicht endlos neu senden – Stand bleibt auf dem Gerät.
    await writeStored(store, { userId, data, pending: false });
    if (isMissing(error)) return 'saved';
    throw new BackendError('unknown', { cause: error });
  }

  async function fetchRemote(userId: string): Promise<ShoeData> {
    const [shoes, defaults, assignments] = await Promise.all([
      client
        .from('shoes')
        .select('id, sport, name, brand, start_km, replace_km, in_use_since, retired_on')
        .eq('user_id', userId)
        .order('created_at'),
      client.from('shoe_defaults').select('sport, valid_from, shoe_id').eq('user_id', userId),
      client.from('shoe_assignments').select('activity_key, shoe_id').eq('user_id', userId),
    ]);
    for (const result of [shoes, defaults, assignments]) {
      if (result.error) throw result.error;
    }
    const data = parseShoeData({
      shoes: shoes.data ?? [],
      defaults: defaults.data ?? [],
      assignments: assignments.data ?? [],
    });
    return data ?? EMPTY_SHOE_DATA;
  }

  async function fetchOlderLogs(userId: string, from: string): Promise<EnduranceLogInput[]> {
    const before = options.logWindowStart();
    if (from >= before) return [];
    const { data, error } = await client
      .from('session_logs')
      .select(
        'id, name_de, performed_on, started_at, cardio_logs(modality, duration_s, distance_m, elevation_m, e_bike)',
      )
      .eq('user_id', userId)
      .eq('kind', 'endurance')
      .gte('performed_on', from)
      .lt('performed_on', before)
      .limit(3000);
    if (error) throw error;
    type Row = {
      id: string;
      name_de: string;
      performed_on: string;
      started_at: string | null;
      cardio_logs:
        | {
            modality: EnduranceLogInput['modality'];
            duration_s: number;
            distance_m: number | null;
            elevation_m: number | null;
            e_bike?: boolean;
          }[]
        | null;
    };
    return ((data ?? []) as unknown as Row[]).flatMap((row) => {
      const c = row.cardio_logs?.[0];
      if (!c) return [];
      return [
        {
          id: row.id,
          name_de: row.name_de,
          performed_on: row.performed_on,
          started_at: row.started_at,
          modality: c.modality,
          duration_s: c.duration_s,
          distance_m: c.distance_m,
          elevation_m: c.elevation_m,
          e_bike: c.e_bike === true,
        },
      ];
    });
  }

  return {
    load: async (historyFrom) => {
      const userId = await requireUserId(backend);
      const stored = await readStored(store, userId);
      try {
        if (stored?.pending) {
          const outcome = await send(userId, stored.data);
          if (outcome === 'queued') throw new TypeError('offline');
        }
        const data = await fetchRemote(userId);
        await writeStored(store, { userId, data, pending: false });
        const olderLogs =
          historyFrom === null ? [] : await fetchOlderLogs(userId, historyFrom).catch(() => []);
        return { data, olderLogs, offline: false, pending: false };
      } catch (error) {
        if (isMissing(error)) {
          return {
            data: stored?.data ?? EMPTY_SHOE_DATA,
            olderLogs: [],
            offline: false,
            pending: false,
          };
        }
        if (stored) {
          return { data: stored.data, olderLogs: [], offline: true, pending: stored.pending };
        }
        if (isNetworkError(error)) {
          return { data: EMPTY_SHOE_DATA, olderLogs: [], offline: true, pending: false };
        }
        throw new BackendError('unknown', { cause: error });
      }
    },
    save: async (raw) => {
      const userId = await requireUserId(backend);
      const data = shoeDataSchema.parse(raw);
      // Zuerst auf dem Gerät (offline-first), dann senden.
      await writeStored(store, { userId, data, pending: true });
      try {
        return await send(userId, data);
      } catch (error) {
        if (isNetworkError(error)) return 'queued';
        throw error;
      }
    },
    deleteAll: async () => {
      const userId = await requireUserId(backend);
      const { error } = await client.rpc('delete_my_shoe_data');
      if (error && !isMissing(error)) {
        throw new BackendError(isNetworkError(error) ? 'online_only' : 'unknown', { cause: error });
      }
      await writeStored(store, { userId, data: EMPTY_SHOE_DATA, pending: false });
    },
    clearDevice: async () => {
      await store.removeItem(SHOE_STORAGE_KEY);
    },
    exportTables: async () => null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Verbindung mit dem Backend (eine Stelle, create-backend.ts)
// ---------------------------------------------------------------------------------------------------------
const registry = new WeakMap<Backend, ShoeBackend>();

/** Schuh-Schnittstelle zu einem Backend (null = nicht verbunden, z. B. in Tests). */
export function shoeBackendFor(backend: Backend): ShoeBackend | null {
  return registry.get(backend) ?? null;
}

/**
 * Verbindet die Schuhe mit dem Backend: Gerätespeicher leeren bei Abmelden, Konto löschen und Gerätedaten löschen;
 * im Testmodus die drei Tabellen in den Export. Gibt dasselbe Backend-Objekt zurück.
 */
export function attachShoes(backend: Backend, shoes: ShoeBackend): Backend {
  registry.set(backend, shoes);
  const clear = () => shoes.clearDevice().catch(() => undefined);
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
  const exportMyData = backend.exportMyData.bind(backend);
  backend.exportMyData = async () => {
    const file = await exportMyData();
    const tables = await shoes.exportTables().catch(() => null);
    return tables ? { ...file, data: { ...file.data, ...tables } } : file;
  };
  return backend;
}
