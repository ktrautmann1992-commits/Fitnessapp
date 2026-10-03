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
} as const;
