import {
  addDays,
  EMPTY_TRAINING_MODES,
  endPainEpisode,
  endTravelMode,
  hasValidConsent,
  newPainEpisode,
  newTravelMode,
  PAIN_MODE,
  PAIN_MODE_HEALTH_CONSENT_MIN_VERSION,
  painEpisodeInputSchema,
  type PainEpisode,
  type PainEpisodeInput,
  parsePainEpisodes,
  parseTravelModes,
  type TrainingModesState,
  type TravelMode,
  type TravelModeInput,
  travelModeInputSchema,
  travelOverlaps,
  withNewPainEpisode,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { z } from 'zod';

import type { Backend } from './backend';
import { consentRecordsFromRows } from './mapping';
import type { ProtectedStore } from './protected-store';
import type { ConsentRow } from './types';

/**
 * Trainings-Modi in der App (docs/PLAN-TRAINING-MODI.md 7): Schmerz-/Verletzungsmodus und Reise-Modus – eigene
 * Schnittstelle NEBEN dem Backend (wie das Zyklus-Modul), damit die großen Backend-Dateien unberührt bleiben. Keine
 * Fachlogik: Prüfen, Beenden und Zusammensetzen stehen in packages/core (modes/).
 * - Testmodus: alles im geschützten Speicher (Browser: nur sessionStorage; App: verschlüsselt), je Konto.
 * - Supabase: Tabellen pain_episodes / travel_modes (RLS; Schmerz-Einträge nur mit Einwilligung health_data
 *   Fassung ≥ 2, Server-Prüfung), Zwischenspeicher für offline im geschützten Speicher. Schreiben braucht Verbindung.
 * attachTrainingModes: Widerruf health_data leert die Schmerz-Einträge auf dem Gerät (der Server löscht sie selbst),
 * Abmelden/Konto löschen/„Gerätedaten löschen“ leeren alles, der Export bekommt im Testmodus beide Tabellen (im
 * Supabase-Modus liefert sie export_my_data). Nie Inhalte in Fehlern oder Logs.
 */

export type TrainingModesErrorCode =
  'consent_missing' | 'invalid' | 'overlap' | 'network' | 'not_signed_in' | 'unknown';

export class TrainingModesError extends Error {
  constructor(readonly code: TrainingModesErrorCode) {
    super(`TrainingModesError: ${code}`);
    this.name = 'TrainingModesError';
  }
}

export interface TrainingModesSnapshot {
  readonly state: TrainingModesState;
  /** Server nicht erreichbar – Anzeige aus dem Zwischenspeicher (nur Supabase). */
  readonly offline: boolean;
}

export interface TrainingModesBackend {
  readonly mode: 'local' | 'supabase';
  load(userId: string, today: string): Promise<TrainingModesSnapshot>;
  /** Neuer Schmerz-Eintrag (beendet einen laufenden derselben Region). `consentOk` aus hasPainConsent(). */
  addPain(
    userId: string,
    input: PainEpisodeInput,
    today: string,
    consentOk: boolean,
  ): Promise<void>;
  endPain(userId: string, id: string, today: string): Promise<void>;
  deleteAllPain(userId: string): Promise<void>;
  addTravel(userId: string, input: TravelModeInput, today: string): Promise<void>;
  endTravel(userId: string, id: string, today: string): Promise<void>;
  /** Zeilen für den Export (Testmodus). */
  exportTables(
    userId: string,
  ): Promise<{ pain_episodes: Record<string, unknown>[]; travel_modes: Record<string, unknown>[] }>;
  /** Nur Schmerz-Einträge auf DIESEM Gerät löschen (Widerruf health_data). */
  clearPainOnDevice(userId: string | null): Promise<void>;
  /** Alles auf DIESEM Gerät löschen. */
  clearDevice(): Promise<void>;
}

/** Darf die Person Schmerz-Einträge speichern? Gültige Einwilligung health_data in Fassung ≥ 2. */
export function hasPainConsent(
  consents: readonly ConsentRow[],
  currentHealthVersion: number | null,
): boolean {
  return (
    currentHealthVersion !== null &&
    currentHealthVersion >= PAIN_MODE_HEALTH_CONSENT_MIN_VERSION &&
    hasValidConsent(consentRecordsFromRows(consents), 'health_data', currentHealthVersion)
  );
}

// ---------------------------------------------------------------------------------------------------------
// Speicher (beide Betriebsarten): je Konto ein Stand
// ---------------------------------------------------------------------------------------------------------

const storedSchema = z.record(
  z.string(),
  z.object({ pain: z.array(z.unknown()), travel: z.array(z.unknown()) }),
);

async function readAll(store: ProtectedStore): Promise<Record<string, TrainingModesState>> {
  const raw = await store.read().catch(() => null);
  if (raw === null) return {};
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return {};
    return Object.fromEntries(
      Object.entries(parsed.data).map(([user, value]) => [
        user,
        { pain: parsePainEpisodes(value.pain), travel: parseTravelModes(value.travel) },
      ]),
    );
  } catch {
    return {};
  }
}

async function writeOwn(
  store: ProtectedStore,
  userId: string,
  state: TrainingModesState | null,
): Promise<void> {
  const all = await readAll(store);
  if (state === null || (state.pain.length === 0 && state.travel.length === 0)) delete all[userId];
  else all[userId] = state;
  if (Object.keys(all).length === 0) await store.clear();
  else await store.write(JSON.stringify(all));
}

/** Aufräumen beim Lesen: Schmerz-Einträge älter als PAIN_MODE.historyDays, Reisen, die vor 30 Tagen endeten. */
function pruned(state: TrainingModesState, today: string): TrainingModesState {
  const cutoff = addDays(today, -PAIN_MODE.historyDays);
  return {
    pain: state.pain.filter((e) => addDays(e.started_on, e.duration_days - 1) >= cutoff),
    travel: state.travel.filter((t) => t.ends_on >= addDays(today, -30)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Testmodus
// ---------------------------------------------------------------------------------------------------------

export function createLocalTrainingModes(options: {
  store: ProtectedStore;
  now: () => string;
  newId: () => string;
}): TrainingModesBackend {
  const { store } = options;
  const own = async (userId: string) => (await readAll(store))[userId] ?? EMPTY_TRAINING_MODES;
  return {
    mode: 'local',
    async load(userId, today) {
      return { state: pruned(await own(userId), today), offline: false };
    },
    async addPain(userId, input, today, consentOk) {
      if (!consentOk) throw new TrainingModesError('consent_missing');
      const parsed = painEpisodeInputSchema(today).safeParse(input);
      if (!parsed.success) throw new TrainingModesError('invalid');
      const state = await own(userId);
      const next = newPainEpisode(parsed.data, { id: options.newId(), createdAt: options.now() });
      await writeOwn(store, userId, {
        ...state,
        pain: withNewPainEpisode(state.pain, next, today),
      });
    },
    async endPain(userId, id, today) {
      const state = await own(userId);
      await writeOwn(store, userId, {
        ...state,
        pain: state.pain.map((e) => (e.id === id ? endPainEpisode(e, today) : e)),
      });
    },
    async deleteAllPain(userId) {
      const state = await own(userId);
      await writeOwn(store, userId, { ...state, pain: [] });
    },
    async addTravel(userId, input, today) {
      const parsed = travelModeInputSchema(today).safeParse(input);
      if (!parsed.success) throw new TrainingModesError('invalid');
      const state = await own(userId);
      if (travelOverlaps(state.travel, parsed.data)) throw new TrainingModesError('overlap');
      const next = newTravelMode(parsed.data, { id: options.newId(), createdAt: options.now() });
      await writeOwn(store, userId, { ...state, travel: [...state.travel, next] });
    },
    async endTravel(userId, id, today) {
      const state = await own(userId);
      await writeOwn(store, userId, {
        ...state,
        travel: state.travel.flatMap((t) => {
          if (t.id !== id) return [t];
          const ended = endTravelMode(t, today);
          return ended ? [ended] : [];
        }),
      });
    },
    async exportTables(userId) {
      const state = await own(userId);
      return {
        pain_episodes: state.pain.map((e) => ({ ...e, user_id: userId })),
        travel_modes: state.travel.map((t) => ({ ...t, user_id: userId })),
      };
    },
    async clearPainOnDevice(userId) {
      if (userId === null) return;
      const state = await own(userId);
      await writeOwn(store, userId, { ...state, pain: [] });
    },
    clearDevice: () => store.clear(),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------------------------------------

const PAIN_COLUMNS = 'id, region, intensity, duration_days, started_on, ended_early_on, created_at';
const TRAVEL_COLUMNS = 'id, starts_on, ends_on, equipment, max_minutes, created_at';

/** Fester Code aus einer Server-Antwort (nie Inhalte). */
export function trainingModesErrorCode(
  error: { message?: string; code?: string } | null,
): TrainingModesErrorCode {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`;
  if (/pain_consent_missing|42501|row-level security/i.test(text)) return 'consent_missing';
  if (/travel_overlap/.test(text)) return 'overlap';
  if (/23514|22P02|_invalid|immutable/.test(text)) return 'invalid';
  if (/failed to fetch|fetch failed|network request failed|networkerror|load failed/i.test(text)) {
    return 'network';
  }
  return 'unknown';
}

export function createRemoteTrainingModes(options: {
  client: AppSupabaseClient;
  store: ProtectedStore;
  newId: () => string;
}): TrainingModesBackend {
  const { client, store } = options;
  async function run<T>(
    request: PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>,
  ): Promise<T> {
    let result: { data: T; error: { message?: string; code?: string } | null };
    try {
      result = await request;
    } catch {
      throw new TrainingModesError('network');
    }
    if (result.error) throw new TrainingModesError(trainingModesErrorCode(result.error));
    return result.data;
  }
  async function fresh(userId: string, today: string): Promise<TrainingModesState> {
    const [pain, travel] = await Promise.all([
      run(
        client
          .from('pain_episodes')
          .select(PAIN_COLUMNS)
          .gte('started_on', addDays(today, -PAIN_MODE.historyDays - 14)),
      ),
      run(client.from('travel_modes').select(TRAVEL_COLUMNS).gte('ends_on', addDays(today, -30))),
    ]);
    const state = pruned(
      { pain: parsePainEpisodes(pain ?? []), travel: parseTravelModes(travel ?? []) },
      today,
    );
    await writeOwn(store, userId, state).catch(() => undefined);
    return state;
  }
  return {
    mode: 'supabase',
    async load(userId, today) {
      try {
        return { state: await fresh(userId, today), offline: false };
      } catch (error) {
        if (!(error instanceof TrainingModesError) || error.code !== 'network') throw error;
        const cached = (await readAll(store))[userId] ?? EMPTY_TRAINING_MODES;
        return { state: pruned(cached, today), offline: true };
      }
    },
    async addPain(userId, input, today, consentOk) {
      if (!consentOk) throw new TrainingModesError('consent_missing');
      const parsed = painEpisodeInputSchema(today).safeParse(input);
      if (!parsed.success) throw new TrainingModesError('invalid');
      // Eine Region hat höchstens einen laufenden Eintrag: den laufenden vorher beenden (wie withNewPainEpisode).
      const current = await fresh(userId, today);
      for (const e of current.pain) {
        const ended = endPainEpisode(e, today);
        if (e.region === parsed.data.region && ended !== e) {
          await run(
            client
              .from('pain_episodes')
              .update({ ended_early_on: ended.ended_early_on })
              .eq('id', e.id),
          );
        }
      }
      await run(
        client.from('pain_episodes').insert({
          id: options.newId(),
          region: parsed.data.region,
          intensity: parsed.data.intensity,
          duration_days: parsed.data.duration_days,
          started_on: parsed.data.started_on,
        }),
      );
      await fresh(userId, today);
    },
    async endPain(userId, id, today) {
      await run(client.from('pain_episodes').update({ ended_early_on: today }).eq('id', id));
      await fresh(userId, today);
    },
    async deleteAllPain(userId) {
      await run(client.from('pain_episodes').delete().gte('started_on', '1900-01-01'));
      const all = await readAll(store);
      const own = all[userId];
      if (own) await writeOwn(store, userId, { ...own, pain: [] });
    },
    async addTravel(userId, input, today) {
      const parsed = travelModeInputSchema(today).safeParse(input);
      if (!parsed.success) throw new TrainingModesError('invalid');
      await run(
        client.from('travel_modes').insert({
          id: options.newId(),
          starts_on: parsed.data.starts_on,
          ends_on: parsed.data.ends_on,
          equipment: parsed.data.equipment,
          max_minutes: parsed.data.max_minutes,
        }),
      );
      await fresh(userId, today);
    },
    async endTravel(userId, id, today) {
      const current = await fresh(userId, today);
      const mode = current.travel.find((t) => t.id === id);
      if (!mode) return;
      const ended = endTravelMode(mode, today);
      if (ended === null) await run(client.from('travel_modes').delete().eq('id', id));
      else if (ended !== mode) {
        await run(client.from('travel_modes').update({ ends_on: ended.ends_on }).eq('id', id));
      }
      await fresh(userId, today);
    },
    // Supabase: export_my_data liefert beide Tabellen selbst.
    exportTables: async () => ({ pain_episodes: [], travel_modes: [] }),
    async clearPainOnDevice(userId) {
      if (userId === null) return;
      const own = (await readAll(store))[userId];
      if (own) await writeOwn(store, userId, { ...own, pain: [] });
    },
    clearDevice: () => store.clear(),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Verbindung mit dem Backend (eine Stelle, create-backend.ts)
// ---------------------------------------------------------------------------------------------------------

const registry = new WeakMap<Backend, TrainingModesBackend>();
const changeListeners = new Set<() => void>();

/** Benachrichtigung, wenn Einträge dieses Geräts gelöscht wurden (Arbeitsspeicher-Stand verwerfen). */
export function onTrainingModesCleared(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function trainingModesFor(backend: Backend): TrainingModesBackend | null {
  return registry.get(backend) ?? null;
}

export function attachTrainingModes(backend: Backend, modes: TrainingModesBackend): Backend {
  registry.set(backend, modes);
  const notify = () => {
    for (const listener of changeListeners) listener();
  };
  const clearAll = async () => {
    await modes.clearDevice().catch(() => undefined);
    notify();
  };
  let currentUser: string | null = null;
  const loadRows = backend.loadRows.bind(backend);
  backend.loadRows = async () => {
    const result = await loadRows();
    currentUser = result.rows.profile?.user_id ?? currentUser;
    return result;
  };
  const revokeConsent = backend.revokeConsent.bind(backend);
  backend.revokeConsent = async (type) => {
    await revokeConsent(type);
    if (type === 'health_data') {
      await modes.clearPainOnDevice(currentUser).catch(() => undefined);
      notify();
    }
  };
  const signOut = backend.signOut.bind(backend);
  backend.signOut = async () => {
    await clearAll();
    await signOut();
  };
  const deleteAccount = backend.deleteAccount.bind(backend);
  backend.deleteAccount = async () => {
    await deleteAccount();
    await clearAll();
  };
  const clearDeviceData = backend.clearDeviceData.bind(backend);
  backend.clearDeviceData = async () => {
    await clearAll();
    await clearDeviceData();
  };
  const exportMyData = backend.exportMyData.bind(backend);
  backend.exportMyData = async () => {
    const file = await exportMyData();
    if (modes.mode !== 'local' || currentUser === null) return file;
    const tables = await modes.exportTables(currentUser);
    return { ...file, data: { ...file.data, ...tables } };
  };
  return backend;
}

export type { PainEpisode, TravelMode };
