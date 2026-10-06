/**
 * Minimaler Schlüssel-Wert-Speicher (wie AsyncStorage). In der App: AsyncStorage (auf Web localStorage),
 * in Tests: createMemoryStore().
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  dump(): Record<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}

export async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  await store.setItem(key, JSON.stringify(value));
}

/** Alle Speicher-Schlüssel der App (zentral, damit „Testdaten löschen“ nichts vergisst). */
export const STORAGE_KEYS = {
  /** Testmodus: kompletter Datenbestand (inkl. Gesundheitsdaten – bewusst, nur Gründer-Test). */
  localDb: 'fitnessapp.local.v1',
  /** Supabase-Modus: Warteschlange für Nicht-Gesundheitsdaten. */
  syncQueue: 'fitnessapp.queue.v1',
  /** Supabase-Modus: zwischengespeicherte Nicht-Gesundheitsdaten (für offline). */
  rowsCache: 'fitnessapp.cache.v1',
  /** Supabase-Modus: zuletzt geladene Einwilligungstexte und -versionen (keine Nutzerdaten, für offline). */
  documentsCache: 'fitnessapp.documents.v1',
  /** Geburtsdatum aus Schritt „Alter“ bis zum Login (nur wenn ≥ 16, keine Gesundheitsdaten). */
  pendingBirthDate: 'fitnessapp.pending-birth-date.v1',
  /**
   * Supabase-Modus: Übungs-Bibliothek (nur Inhalte, keine Nutzerdaten) – damit die Sicherheitsregeln beim Anzeigen
   * auch offline prüfbar sind.
   */
  planLibrary: 'fitnessapp.plan-library.v1',
  /**
   * Supabase-Modus: Plan mit Gesundheitsbezug + wirksame Sicherheitsregeln (Frage 14) – App: verschlüsselt in
   * AsyncStorage, Browser: NUR sessionStorage (protected-store.ts).
   */
  healthPlanCache: 'fitnessapp.health-plan.v1',
  /** App: Name des Schlüssels im sicheren Schlüsselspeicher (expo-secure-store), nicht in AsyncStorage. */
  healthPlanKey: 'fitnessapp.health-plan-key.v1',
  /**
   * Trainingstagebuch (PLAN-PHASE-4 4.1, Gründer-Entscheidung Frage 3 = verschlüsselt): drei EIGENE geschützte
   * Speicher (App: AES-256-GCM, Schlüssel im Keychain/Keystore; Browser: nur sessionStorage) – nie mit dem Plan-Cache
   * geteilt. Entwurf = laufende Einheit(en) und abgelehnte/Konflikt-Fassungen.
   */
  workoutDraft: 'fitnessapp.workout-draft.v1',
  workoutDraftKey: 'fitnessapp.workout-draft-key.v1',
  /** Wartende save_session_log-Vorgänge (eigene LogQueue, nie die normale SyncQueue). */
  logQueue: 'fitnessapp.log-queue.v1',
  logQueueKey: 'fitnessapp.log-queue-key.v1',
  /** Geladene Tagebuch-Einträge (Supabase-Modus, für offline). */
  logCache: 'fitnessapp.log-cache.v1',
  logCacheKey: 'fitnessapp.log-cache-key.v1',
} as const;
