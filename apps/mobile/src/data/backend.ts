import type {
  ConsentType,
  CustomMeal,
  DataExportFile,
  FoodLogEntry,
  MealPlanWeek,
  RecipeRating,
  StoredShoppingList,
  NutritionLibrary,
  PreferenceChange,
  PlanLibrary,
  PlanSafetyRules,
  SavePlanPayload,
  SavePlanSession,
  SessionLogPayload,
} from '@fitnessapp/core';

import type { FavoriteChange } from './food-log-rows';
import type { LogRows } from './log-rows';
import type { ConsentVersions } from './mapping';
import type {
  AuthSession,
  ConsentDocument,
  OnboardingAnswers,
  ReminderSettings,
  StepSave,
  UserRows,
} from './types';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';

/**
 * Gemeinsame Schnittstelle der beiden Betriebsarten:
 * - local-backend.ts: Testmodus (ohne Supabase), alle Daten nur auf dem Gerät,
 * - supabase-backend.ts: echte Datenbank in Frankfurt mit Login per E-Mail-Code.
 * Die Bildschirme kennen nur diese Schnittstelle.
 */
export type BackendMode = 'local' | 'supabase';

export type SignIn =
  | { kind: 'test_mode'; start: () => Promise<AuthSession> }
  | {
      kind: 'email_code';
      requestCode: (email: string) => Promise<void>;
      verifyCode: (email: string, code: string) => Promise<AuthSession>;
    };

export interface SnapshotResult {
  rows: UserRows;
  /** true = Server nicht erreichbar, angezeigt wird der zwischengespeicherte Stand (ohne Gesundheitsdaten). */
  offline: boolean;
  /**
   * Nur offline: zuletzt wirksame Sicherheitsregeln aus dem geschützten Zwischenspeicher (Frage 14), damit strengere
   * Deckel auch ohne Netz greifen (die Gesundheits-Checks selbst liegen nie auf dem Gerät).
   */
  cachedSafetyRules?: PlanSafetyRules | null;
}

/** Einheit verschieben oder streichen (nur Datum und Status, wie der Datenbank-Trigger es erlaubt). */
export interface SessionUpdate {
  sessionId: string;
  planId: string;
  /** Plan mit Gesundheitsbezug → sofort senden, nie Warteschlange. */
  usesHealthData: boolean;
  scheduledOn: string;
  status: 'planned' | 'skipped';
}

/** Zwei geplante Einheiten desselben (aktiven) Plans tauschen (Etappe A1a, A-G4). */
export interface SessionSwap {
  sessionId: string;
  otherSessionId: string;
  /**
   * Tage, an denen beide Einheiten laut App GERADE liegen (geprüfter Stand, Wächter A1a S1). Der Server tauscht nur,
   * wenn sie noch stimmen – sonst „Plan hat sich geändert“; eine Wiederholung tauscht nie zurück.
   */
  sessionOn: string;
  otherSessionOn: string;
  planId: string;
  /** Plan mit Gesundheitsbezug → Fehler als „sensibel“ behandeln (wie beim Verschieben). */
  usesHealthData: boolean;
}

/** Ereignisse aus dem Hintergrund (Warteschlange). */
export type BackendEvent =
  /** Eine wartende Verschiebung wurde vom Server abgelehnt und verworfen → Plan neu laden + Meldung. */
  | { kind: 'plan_change_dropped' }
  /** Ein Training wurde übertragen (neu laden). `orphaned` = Plan hatte sich geändert (B4). */
  | { kind: 'log_saved'; orphaned: boolean; key: string; writeId: string }
  /** Ein Training kam als Konflikt bzw. Ablehnung zurück – es liegt als Entwurf vor (4.3). */
  | { kind: 'log_conflict'; key: string; writeId: string }
  | { kind: 'log_rejected'; reason: LogRejectReason; key: string; writeId: string }
  /** Senden scheiterte an der abgelaufenen Sitzung – erneut anmelden, Einträge bleiben (R5). */
  | { kind: 'session_expired' };

/** Ergebnis von „Training speichern“ (docs/PLAN-PHASE-4.md 4.3, 6.3). */
export type LogSaveOutcome =
  /** Gespeichert; `orphaned` = Plan hatte sich geändert, Training trotzdem gespeichert (B4). */
  | { kind: 'saved'; orphaned: boolean }
  /** Offline bzw. noch nicht übertragen – liegt verschlüsselt in der Warteschlange. */
  | { kind: 'queued' }
  /** Auf einem anderen Gerät geändert – die eigene Fassung liegt als Entwurf vor (W3). */
  | { kind: 'conflict' }
  /** Abgelehnt – liegt als Entwurf vor (nie stilles Verwerfen). */
  | { kind: 'rejected'; reason: LogRejectReason };

/** Wartende Trainings (Abmelde-Nachfrage R6, Anzeige). */
export interface PendingWorkouts {
  /** In der Tagebuch-Warteschlange (noch nicht übertragen). */
  queued: number;
  /** Offene Entwürfe sowie abgelehnte und Konflikt-Fassungen. */
  drafts: number;
}

/** Online nachgeladene ältere Tagebuch-Einträge (Verlauf, Etappe D) – nur im Arbeitsspeicher, nie im Gerätespeicher. */
export interface OlderLogsPage {
  logs: LogRows;
  /** Für die nächste Seite: Einträge vor diesem Datum; null = keine älteren mehr. */
  nextBefore: string | null;
}

/**
 * Wo „Ab jetzt immer“ gewählt wurde (für die Prüfung canExclude im Testmodus, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 9):
 * Einheit des aktiven Plans, gespeicherte Position und die Übungen, die dort gerade angezeigt werden.
 */
export interface PreferenceSwapContext {
  sessionId: string;
  storedOrderNo: number;
  inSession: readonly string[];
  /** Ort der Einheit nur geraten (4.4) – Ausschlüsse beider Orte zählen. */
  ambiguousLocation: boolean;
}

/** Ernährungs-Bestand (Phase 5, Etappe N4). */
export interface NutritionLibraryResult {
  library: NutritionLibrary;
  /** true = Beispiel-Rezepte mit TESTWERTEN (Testmodus, nur auf Wunsch, solange das Bündel keine Rezepte hat). */
  demo: boolean;
  /**
   * Testmodus: Das Bündel hat noch keine verwendbaren Rezepte (echter Katalog fehlt, Workflow foods-import/alpha5-
   * import) – Angebot „Beispiel-Rezepte mit Testwerten verwenden“.
   */
  demoAvailable: boolean;
}

/** Widerruf health_data mit Umwandlung der Unverträglichkeiten (docs/PLAN-PHASE-5.md 7.4, R2-K4). */
export interface IntoleranceConversion {
  /**
   * Aktueller Stand (nur im Arbeitsspeicher): Daraus liest das Backend die Gruppen der Unverträglichkeiten – NUR, weil
   * die Person der Umwandlung aktiv zugestimmt hat. Ohne Zustimmung wird `null` übergeben und nichts eingelesen.
   */
  rows: UserRows;
}

export interface Backend {
  readonly mode: BackendMode;
  /**
   * Ernährung (Phase 5): Testmodus ab Etappe N4. Supabase-Modus: Datenbank seit Etappe N7 (Teil 1: Tabellen, RLS,
   * Funktionen, Spalten von nutrition_prefs, Bewertungen/Abneigungen); die Bildschirme schaltet erst N7 Teil 2 frei
   * (Essensplan/Einkaufsliste aus der Datenbank ohne Planband, geschützter Speicher, Warteschlange). Steuert den
   * Onboarding-Schritt `nutrition_setup` (R2-S3) und die Ernährungs-Bildschirme.
   */
  readonly supportsNutrition: boolean;
  /**
   * „Ab jetzt immer“ und „Ausgeschlossene Übungen“ (Etappe T2): Testmodus ja; Supabase-Modus erst mit Etappe T3
   * (Tabelle exercise_preferences) – bis dahin nur „Nur heute“, kein halbfertiger Zustand (8.2).
   */
  readonly supportsExercisePreferences: boolean;
  readonly signIn: SignIn;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  /** Aktuelle Einwilligungstexte (terms, privacy, health_data). */
  loadConsentDocuments(): Promise<ConsentDocument[]>;
  /** Profil mit Geburtsdatum anlegen – Voraussetzung für Einwilligungen und alle weiteren Daten. */
  createProfile(birthDate: string): Promise<void>;
  loadRows(): Promise<SnapshotResult>;
  grantConsents(types: readonly ConsentType[], versions: ConsentVersions): Promise<void>;
  /** Widerruf aller aktiven Einwilligungen dieser Art; bei health_data werden alle Gesundheitsdaten gelöscht. */
  revokeConsent(type: ConsentType): Promise<void>;
  /** Speichert einen Onboarding-Schritt und liefert den neuen Stand (inkl. Fortschritt im Profil). */
  saveStep(save: StepSave, context: SaveContext): Promise<UserRows>;
  saveReminder(
    settings: ReminderSettings,
    nextDueOn: string | null,
    rows: UserRows,
  ): Promise<UserRows>;
  deleteAccount(): Promise<void>;
  /** Wartende Änderungen (nur Supabase-Modus, offline). */
  pendingChanges(): number;
  /** Wartende Änderungen senden; false = weiterhin offline. */
  flush(): Promise<boolean>;
  /** Testmodus: alles auf dem Gerät löschen. Supabase-Modus: lokale Zwischenspeicher löschen. */
  clearDeviceData(): Promise<void>;

  // --- Trainingsplan (Phase 3) ---------------------------------------------------------------------------
  /**
   * Inhalte für die Plan-Engine. Testmodus: gebündelte Entwürfe (allowDrafts nur hier); Supabase: nur
   * freigegebene Inhalte. `allowCached` = offline den zwischengespeicherten Stand (nur Übungen, für die Anzeige)
   * zulassen; null = nichts vorhanden.
   */
  loadPlanLibrary(options: { allowCached: boolean }): Promise<PlanLibrary | null>;
  /** Neuen Plan speichern (ersetzt den aktiven). Braucht Verbindung. Liefert den neuen Stand. */
  savePlan(payload: SavePlanPayload, rows: UserRows): Promise<UserRows>;
  /** Folgeblock anhängen. Braucht Verbindung. */
  appendPlanBlock(
    planId: string,
    usesHealthData: boolean,
    sessions: SavePlanSession[],
    rows: UserRows,
  ): Promise<UserRows>;
  /**
   * Einheit verschieben/streichen. Pläne ohne Gesundheitsbezug offline über die Warteschlange, mit
   * Gesundheitsbezug sofort (ohne Netz → Fehler „Erneut versuchen“).
   */
  updatePlannedSession(update: SessionUpdate, rows: UserRows): Promise<UserRows>;
  /**
   * Zwei Einheiten tauschen (public.swap_planned_sessions). Immer sofort, nie über die Warteschlange; wartende
   * Verschiebungen werden vorher gesendet. Ohne Verbindung → BackendError „online_only“.
   */
  swapPlannedSessions(swap: SessionSwap, rows: UserRows): Promise<UserRows>;
  /** Hintergrund-Ereignisse abonnieren; Rückgabe = abbestellen. */
  subscribe(listener: (event: BackendEvent) => void): () => void;

  // --- Trainingstagebuch (Phase 4, Etappe C) --------------------------------------------------------------
  /** Entwürfe des angemeldeten Kontos (geschützter Entwurfs-Speicher). */
  loadDrafts(): Promise<WorkoutDraft[]>;
  /** Entwurf sofort sichern (jeder Tipp, 4.2). */
  saveDraft(draft: WorkoutDraft): Promise<void>;
  /** Entwurf verwerfen. */
  discardDraft(key: string): Promise<void>;
  /**
   * Training beenden: Testmodus speichert sofort lokal (gleiche Regeln wie save_session_log); Supabase legt die
   * Fassung in die verschlüsselte Tagebuch-Warteschlange und sendet sie, sobald möglich. Der Entwurf wird erst
   * entfernt, wenn die Fassung sicher in der Warteschlange bzw. gespeichert ist; Konflikt/Ablehnung → Entwurf.
   */
  submitWorkout(draft: WorkoutDraft, payload: SessionLogPayload): Promise<LogSaveOutcome>;
  /** Eintrag löschen (nur online, mit Revision, R4). */
  deleteSessionLog(id: string, baseRevision: number): Promise<'ok' | 'conflict'>;
  /**
   * Übungs-Präferenzen ändern (der Reihe nach, alles oder nichts): „Ab jetzt immer“ (`at` Pflicht – geprüft wie der
   * Tausch-Dialog mit canExclude), Rückgängig, „Wieder zulassen“. Entfernen braucht kein `at`. Fehler
   * `preference_rejected`. Supabase-Modus vor T3: nicht unterstützt (`supportsExercisePreferences`).
   */
  updateExercisePreferences(
    changes: readonly PreferenceChange[],
    at: PreferenceSwapContext | null,
    rows: UserRows,
  ): Promise<UserRows>;
  /** Eigenes Startgewicht (nur ohne Eintrag sinnvoll); null = entfernen. */
  setStartWeight(exerciseId: string, weightKg: number | null, rows: UserRows): Promise<UserRows>;
  /**
   * Widerruf health_data (R3): Senden der Tagebuch-Warteschlange sperren, Einträge aus Gesundheits-Plänen in
   * Warteschlange, Entwurf und Zwischenspeicher bereinigen (neutralisieren bzw. bei `deleteLogs` entfernen), dann
   * revoke_health_data(deleteLogs) in EINER Transaktion.
   */
  revokeHealthData(deleteLogs: boolean, conversion: IntoleranceConversion | null): Promise<void>;
  /**
   * Gespeicherte Unverträglichkeiten löschen (Recht auf Löschung, Wächter N4 NK2) – geht immer, auch ohne Einwilligung
   * (Löschen braucht keine). Supabase: sofort, nur online (Gesundheitsdaten nie in die Warteschlange) – seit N7 über
   * `delete_stored_intolerances`, das im selben Schritt Essenspläne/Einkaufslisten mit Gesundheitsbezug löscht.
   */
  deleteStoredIntolerances(): Promise<void>;
  /**
   * Ernährungs-Bestand (Phase 5): Testmodus aus dem Bündel (Entwürfe erlaubt, `selectNutritionContent`), auf Wunsch
   * Beispiel-Rezepte mit Testwerten (`demo`); Supabase-Modus bis Etappe N7 null.
   */
  loadNutritionLibrary(options: {
    demo: boolean;
    /**
     * Nur Testmodus und nur für die E2E-Tests (Wächter N4 K7): Beispiel-Rezepte auch dann, wenn das Bündel schon echte
     * Rezepte hat – damit die Tests nicht vom Stand des Katalogs abhängen. Kennzeichnung bleibt.
     */
    force?: boolean;
  }): Promise<NutritionLibraryResult | null>;
  /**
   * Essensplan einer Woche speichern (Etappe N5, docs/PLAN-PHASE-5.md 7.3/7.5): ersetzt den Plan derselben Woche.
   * Testmodus: Gerätespeicher mit denselben Regeln wie `save_meal_plan` (meal-plan-rows.ts); Supabase-Modus erst mit
   * N7 Teil 2 (die Datenbank-Funktion save_meal_plan gibt es seit N7 Teil 1; bis dahin nicht unterstützt,
   * `supportsNutrition = false`). `autoAdjusted` = automatisch neu geplant
   * (6.6, Hinweis bis „Verstanden“); `recipesChanged` = neu erstellt wegen neuer Rezept-Version (K-b). Mit
   * `shoppingList` wird die neu erzeugte Einkaufsliste der Woche im SELBEN Schritt gespeichert (R2-S4, W22).
   * Fehler `plan_rejected` bzw. `consent_required`.
   */
  saveMealPlan(
    plan: MealPlanWeek,
    options: {
      autoAdjusted: boolean;
      recipesChanged?: boolean;
      shoppingList?: StoredShoppingList | undefined;
    },
    rows: UserRows,
  ): Promise<UserRows>;
  /**
   * Einkaufsliste einer Woche speichern (Etappe N5b, 6.5/7.3): Abhaken, eigene Einträge, Zeitraum, „Zur
   * Einkaufsliste“. Testmodus: Gerätespeicher (meal-plan-rows.ts, geht ohne Netz); Supabase-Modus erst mit N7 Teil 2
   * (replace_shopping_list gibt es seit N7 Teil 1).
   */
  saveShoppingList(list: StoredShoppingList, rows: UserRows): Promise<UserRows>;
  /**
   * Bewertung nach dem Essen (Etappe N10, KONZEPT 6.10): `rating` setzt bzw. ersetzt die Bewertung des Rezepts (Datum =
   * heute), `null` nimmt sie zurück. Testmodus: Gerätespeicher (rating-rows.ts, geht ohne Netz); Supabase-Modus seit N7
   * Tabelle `recipe_ratings` (nur online, RLS). Der Grund „Unverträglich“ kann hier gar nicht übergeben werden (Schema in
   * packages/core).
   */
  saveRecipeRating(
    change: { recipeId: string; rating: RecipeRating | null },
    rows: UserRows,
  ): Promise<UserRows>;
  /** Alle eigenen Bewertungen löschen (Recht auf Löschung, Etappe N10). */
  deleteRecipeRatings(rows: UserRows): Promise<UserRows>;
  /**
   * „Mag ich nicht“ je Lebensmittel ersetzen (Etappe N10, `food_dislikes`): nach dem Dialog „Zutaten übernehmen?“
   * (bestätigte Auswahl) bzw. „Wieder zulassen“. Testmodus: Gerätespeicher; Supabase-Modus seit N7 über
   * `replace_food_dislikes` (nur online).
   */
  saveFoodDislikes(foodIds: readonly string[], rows: UserRows): Promise<UserRows>;
  /**
   * Ernährungstagebuch (Etappe E1, docs/PLAN-AUSWERTUNG.md 5): Einträge neu anlegen bzw. ganz ersetzen (gleiche id).
   * Testmodus: Gerätespeicher mit denselben Regeln wie save_food_log_entries (food-log-rows.ts) – geht ohne Netz.
   * Supabase-Modus erst mit N7 Teil 2 (Datenbank-Funktion seit E1; bis dahin nicht unterstützt,
   * `supportsNutrition = false`). Fehler `consent_required`, `food_log_out_of_range`, `food_log_day_full`,
   * `food_log_rejected` – immer ohne Werte (Gesundheitsdaten).
   */
  saveFoodLogEntries(entries: readonly FoodLogEntry[], rows: UserRows): Promise<UserRows>;
  /** Eintrag löschen – geht immer (auch ohne Einwilligung, auch alte Einträge; Recht auf Löschung). */
  deleteFoodLogEntry(id: string, rows: UserRows): Promise<UserRows>;
  /** Stern setzen bzw. entfernen (`food_log_favorites`, kein Gesundheitsdatum). Fehler `favorite_limit`. */
  changeFoodLogFavorite(change: FavoriteChange, rows: UserRows): Promise<UserRows>;
  /**
   * Eigenes Gericht anlegen bzw. ganz ersetzen (Etappe E2, docs/PLAN-AUSWERTUNG.md 7). Testmodus: Gerätespeicher mit
   * denselben Regeln wie save_custom_meal (custom-meal-rows.ts) – geht ohne Netz. Supabase-Modus erst mit N7 Teil 2
   * (Datenbank-Funktion seit E2; bis dahin nicht unterstützt). Fehler `consent_required`, `custom_meal_limit`,
   * `custom_meal_rejected` – immer ohne Namen und ohne Werte.
   */
  saveCustomMeal(meal: CustomMeal, rows: UserRows): Promise<UserRows>;
  /** Eigenes Gericht löschen – geht immer; eingetragene Tage behalten ihre Werte (Verweis wird leer). */
  deleteCustomMeal(id: string, rows: UserRows): Promise<UserRows>;
  /** Start des Meal-Prep-Kochtags (Timer) setzen bzw. mit null zurücksetzen (Etappe N5b). */
  saveCookDayStart(weekStart: string, startedAt: string | null, rows: UserRows): Promise<UserRows>;
  /** Wartende Trainings und Entwürfe (R6). */
  pendingWorkouts(): Promise<PendingWorkouts>;
  /** Planned-Session-IDs mit noch nicht übertragenem Training (Anzeige „wird übertragen“). */
  pendingLogSessionIds(): readonly string[];
  /** Liegen Einträge eines anderen Kontos auf dem Gerät (R5)? */
  hasForeignDeviceData(): Promise<boolean>;
  /** Einträge eines anderen Kontos löschen (nach Nachfrage). */
  discardForeignDeviceData(): Promise<void>;

  // --- Woche, Verlauf, Export (Phase 4, Etappe D) -----------------------------------------------------------
  /**
   * Ab diesem Datum liegt das Tagebuch VOLLSTÄNDIG auf dem Gerät (Supabase: die letzten LOG_CACHE_WEEKS Wochen);
   * null = alles (Testmodus). Ältere Einheiten aus recent_exercise_logs() sind unvollständig (nur einzelne Übungen).
   */
  logHistoryStart(): string | null;
  /** Ältere Einträge vor `before` nachladen (nur online, je bis zu 20 Einheiten; 4.5). */
  loadOlderLogs(before: string): Promise<OlderLogsPage>;
  /**
   * Datenexport (Recht auf Auskunft, 3.7): alle eigenen Zeilen aller Tabellen (export_my_data) plus Konto-E-Mail.
   * Nur online. Enthält Gesundheitsdaten – nie loggen, nie zwischenspeichern.
   */
  exportMyData(): Promise<DataExportFile>;
}

export interface SaveContext {
  /** Antworten vor diesem Schritt. */
  answers: OnboardingAnswers;
  rows: UserRows;
  versions: ConsentVersions;
}

export type BackendErrorCode =
  | 'network'
  | 'min_age'
  | 'consent_required'
  | 'not_signed_in'
  | 'profile_missing'
  | 'invalid_code'
  | 'rate_limited'
  /** Plan vom Server/den Regeln abgelehnt (z. B. Gesundheits-Check geändert, Tag belegt) → neu laden/erstellen. */
  | 'plan_rejected'
  /** Keine passende freigegebene Vorlage (no_template). */
  | 'no_template'
  /** Nur online möglich (Löschen, Export, Widerruf). */
  | 'online_only'
  /** Auf dem Gerät liegen noch nicht übertragene Trainings eines anderen Kontos (R5). */
  | 'foreign_data'
  /** Geschützter Gerätespeicher nicht beschreibbar (Browser: sessionStorage voll/gesperrt, K9). */
  | 'storage_unavailable'
  /**
   * Übungs-Präferenz abgelehnt (Etappe T2): keine gleichwertige Alternative mehr, Obergrenze erreicht oder die Auswahl
   * passt nicht mehr zum aktuellen Stand (gleiche Prüfung wie der Tausch-Dialog, canExclude).
   */
  | 'preference_rejected'
  /** Obergrenze EXERCISE_PREFERENCE_LIMITS.maxPerUser erreicht. */
  | 'preference_limit'
  /** Ernährungstagebuch (E1): Datum außerhalb von heute bis 14 Tage zurück bzw. Eintrag zu alt zum Ändern. */
  | 'food_log_out_of_range'
  /** Ernährungstagebuch (E1): höchstens 40 Einträge je Tag. */
  | 'food_log_day_full'
  /** Ernährungstagebuch (E1): ungültige Werte bzw. Plan-Mahlzeit schon eingetragen. */
  | 'food_log_rejected'
  /** Höchstens 100 Favoriten (FOOD_LOG_LIMITS.maxFavorites). */
  | 'favorite_limit'
  /** Eigene Gerichte (E2): höchstens 100 (CUSTOM_MEAL_LIMITS.maxMeals). */
  | 'custom_meal_limit'
  /** Eigene Gerichte (E2): ungültige Angaben (ohne Namen, ohne Werte gemeldet). */
  | 'custom_meal_rejected'
  /** Vorübergehend (Zeitlimit, Sperrkonflikt, Server 5xx, Drosselung) – „bitte gleich noch einmal“. */
  | 'temporary'
  | 'unknown';

/**
 * Warum ein Verschieben/Tauschen abgelehnt wurde (Kalender, Wächter A1a S2): `plan_changed` = Stand weicht ab (Einheit
 * fehlt, erledigt, anderer Plan, Tag inzwischen belegt, erwartete Tage stimmen nicht), `move_rules` = Regeln (nur ab
 * heute, gleiche Woche, Erholungswoche, Woche vorbei).
 */
export type MoveRejectReason = 'plan_changed' | 'move_rules';

/** Fehler mit festem Code – die Bildschirme zeigen dazu einen deutschen Text (i18n errors.*). */
export class BackendError extends Error {
  readonly code: BackendErrorCode;
  /** true = betraf Gesundheitsdaten (nicht auf dem Gerät zwischengespeichert). */
  readonly sensitive: boolean;
  /** Nur bei abgelehntem Verschieben/Tauschen (`plan_rejected`): Ursache für den passenden Text. */
  readonly moveReason: MoveRejectReason | null;

  constructor(
    code: BackendErrorCode,
    options: { sensitive?: boolean; cause?: unknown; moveReason?: MoveRejectReason } = {},
  ) {
    // Bewusst ohne Werte in der Meldung – keine Gesundheitsdaten in Fehlern oder Logs.
    super(`BackendError: ${code}`);
    this.name = 'BackendError';
    this.code = code;
    this.sensitive = options.sensitive ?? false;
    this.moveReason = options.moveReason ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function errorCode(error: unknown): BackendErrorCode {
  return error instanceof BackendError ? error.code : 'unknown';
}
