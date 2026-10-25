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
  /**
   * „Nur heute“-Tausch vor dem Training (Day-Swaps, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.1/9): nur IDs und Datum,
   * kein Gesundheitsdatum, unverschlüsselt, je Konto (data/day-swaps.ts).
   */
  daySwaps: 'fitnessapp.day-swaps.v1',
  /**
   * Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“): Antworten auf „Soll diese Uhr-/freie Einheit für die geplante
   * Einheit an einem anderen Tag zählen?“ – nur IDs und Zeitpunkt, kein Gesundheitsdatum, je Konto (data/week-status.ts).
   */
  logAssignments: 'fitnessapp.log-assignments.v1',
  /** Geräte-Einstellung „Bildschirm im Training anlassen“ (true/false, keine Nutzerdaten). */
  keepAwake: 'fitnessapp.keep-awake.v1',
  /** Geräte-Einstellung „Aufwärmen & Dehnen“ (true/false, Standard an; docs/PLAN-TRAINING-MODI.md 5). */
  warmupRoutine: 'fitnessapp.warmup-routine.v1',
  /**
   * Geräte-Einstellung lokale Benachrichtigungen (docs/PLAN-PHASE-4B.md 7, Etappe E): Opt-in Mess-Erinnerung und
   * Pausenende sowie „schon gefragt“ (true/false, keine Nutzerdaten). Abmelden und Konto löschen setzen sie zurück.
   */
  notificationPrefs: 'fitnessapp.notification-prefs.v1',
  /**
   * Testmodus (Etappe N4): „Beispiel-Rezepte mit Testwerten verwenden“ (true/false), solange das Bündel noch keine
   * Rezepte hat. Der Wert "force" (nur von den E2E-Tests gesetzt) erzwingt sie auch bei echten Rezepten. Keine
   * Nutzerdaten.
   */
  nutritionDemo: 'fitnessapp.nutrition-demo.v1',
  /**
   * Supabase-Modus (Etappe N7 Teil 2): Ernährungs-Bestand aus der Datenbank (nur freigegebene Inhalte, keine
   * Nutzerdaten) – damit Rezepte und Plan auch ohne Netz angezeigt werden können.
   */
  nutritionLibrary: 'fitnessapp.nutrition-library.v1',
  /**
   * Supabase-Modus (Etappe N7 Teil 2): eigene geschützte Speicher (App: AES-256-GCM, Schlüssel im Keychain/Keystore;
   * Browser: nur sessionStorage) für die Ernährungs-Zeilen des Kontos (vollständige Essenspläne, Einkaufslisten,
   * Tagebuch, eigene Gerichte, Favoriten – teils Gesundheitsdaten) und die Ernährungs-Warteschlange (Tagebuch-Einträge
   * und eigene Gerichte offline, abgelehnte Fassungen bleiben lokal, Gründer-Frage G3 aus E1).
   */
  nutritionCache: 'fitnessapp.nutrition-cache.v1',
  nutritionCacheKey: 'fitnessapp.nutrition-cache-key.v1',
  nutritionQueue: 'fitnessapp.nutrition-queue.v1',
  nutritionQueueKey: 'fitnessapp.nutrition-queue-key.v1',
  /**
   * Live-Anpassung (Phase 4b, Etappe D, docs/PLAN-PHASE-4B.md 8.3): Anpassungen des Plans (plan_adjustments) – aus
   * Gesundheits-Plänen mittelbar Gesundheitsdaten, deshalb NUR im eigenen geschützten Speicher (App: AES-256-GCM,
   * Schlüssel im Keychain/Keystore; Browser: nur sessionStorage). Beim Widerruf health_data geleert.
   */
  liveAdjust: 'fitnessapp.live-adjust.v1',
  liveAdjustKey: 'fitnessapp.live-adjust-key.v1',
  /**
   * Ausdauer (Etappe E4): laufende Aufzeichnung (Rohpunkte mit Zeit und Genauigkeit, alle 30 s gesichert – für
   * „Fortsetzen oder speichern?“ nach einem Absturz) und Warteschlange/Zwischenspeicher der Strecken. Standortdaten:
   * NUR im eigenen geschützten Speicher (App: AES-256-GCM, Schlüssel im Keychain/Keystore; Browser: sessionStorage).
   * Nach dem Speichern bzw. Verwerfen der Aufzeichnung gelöscht; Abmelden und Konto löschen leeren beide.
   */
  routeRecording: 'fitnessapp.route-recording.v1',
  routeRecordingKey: 'fitnessapp.route-recording-key.v1',
  routeQueue: 'fitnessapp.route-queue.v1',
  routeQueueKey: 'fitnessapp.route-queue-key.v1',
  /**
   * Smartwatch (Phase 8): Warteschlange der Abgleiche und zuletzt geladener Stand (Gesundheitsdaten) – NUR im eigenen
   * geschützten Speicher. Abmelden, Konto löschen, Trennen und Widerruf leeren ihn.
   */
  wearableQueue: 'fitnessapp.wearable-queue.v1',
  wearableQueueKey: 'fitnessapp.wearable-queue-key.v1',
  /** Smartwatch: Zeitpunkt des letzten Abgleich-VERSUCHS (nur Zeitstempel, keine Werte) – „höchstens alle 15 min“. */
  wearableSyncAttempt: 'fitnessapp.wearable-sync-attempt.v1',
  /**
   * Smartwatch: Routen der letzten 30 Tage einmal nachgeladen (23.10.2026) – Konto-ID, keine Werte. Fehlt sie bzw. ist
   * es ein anderes Konto, liest der nächste Abgleich 30 Tage (nur schon übernommene Einheiten).
   */
  wearableRouteBackfill: 'fitnessapp.wearable-route-backfill.v1',
  /** Supabase-Modus: Workout-Bibliothek (nur Inhalte, keine Nutzerdaten) – für offline (docs/PLAN-WORKOUTS.md). */
  /** Supabase-Modus: Supplement-Inhalte (nur Inhalte, keine Nutzerdaten) – für offline (Phase 6 SU4). */
  supplementLibrary: 'fitnessapp.supplement-library.v1',
  workoutLibrary: 'fitnessapp.workout-library.v1',
  /** Workout-Timer: „Ton und Vibration“ an/aus (nur dieses Gerät, keine Nutzerdaten). */
  workoutSignals: 'fitnessapp.workout-signals.v1',
  /**
   * Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5): „Große Ansicht“ und „Anleitungen vorlesen“ an/aus –
   * nur dieses Gerät, keine Nutzerdaten (kein Alter, kein Grund).
   */
  accessibility: 'fitnessapp.accessibility.v1',
  /**
   * Einkaufsliste (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, 23.10.2026): „3 Tage | Ganze Woche“, Wochen mit eigenem
   * Zeitraum, „Erledigte ausblenden“, zugeklappte Abteilungen – nur dieses Gerät, keine Nutzerdaten
   * (lib/shopping-prefs.ts).
   */
  shoppingPrefs: 'fitnessapp.shopping-prefs.v1',
  /**
   * Reiter „Unterwegs“ (Auswärts essen, 25.10.2026): Favoriten und „Zuletzt“ – nur Gericht-IDs und Portion, ohne Datum
   * oder Werte, je Konto (lib/eating-out-picks.ts).
   */
  eatingOutPicks: 'fitnessapp.eating-out-picks.v1',
  /**
   * Ausdauer: zuletzt gewählt „Fahrrad“ oder „E-Bike“ (23.10.2026) – je Konto ein Wahrheitswert, nur dieses Gerät,
   * kein Gesundheitsdatum. Vorbelegung beim nächsten Rad-Eintrag bzw. der nächsten Aufzeichnung.
   */
  bikeChoice: 'fitnessapp.bike-choice.v1',
  /**
   * Widget auf dem Startbildschirm (docs/PLAN-WIDGET.md, 25.10.2026): Schalter an/aus (true/false, Standard aus) – nur
   * dieses Gerät, keine Nutzerdaten. Abmelden, Konto löschen und „Testdaten löschen“ setzen ihn zurück.
   */
  widgetEnabled: 'fitnessapp.widget-enabled.v1',
  /**
   * Widget: zuletzt geschriebener Stand (Trainingsnamen, Schritte, kcal übrig – teils Gesundheitsdaten). NUR Android
   * und NUR verschlüsselt (AES-256-GCM, eigener Schlüssel im Keystore, widget/widget-store.android.ts); gelöscht, sobald
   * das Widget ausgeschaltet wird, beim Abmelden und beim Löschen des Kontos.
   */
  widgetSnapshot: 'fitnessapp.widget-snapshot.v1',
  widgetSnapshotKey: 'fitnessapp.widget-snapshot-key.v1',
} as const;
