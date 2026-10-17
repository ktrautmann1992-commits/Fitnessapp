import type {
  CompetitionErrorReason,
  ConsentType,
  CustomMeal,
  FoodPhotoResponse,
  PhotoLimitState,
  ProductLookupResponse,
  UserFoodProduct,
  DataExportFile,
  FoodLogEntry,
  MealPlanWeek,
  RecipeRating,
  StoredShoppingList,
  NutritionLibrary,
  PreferenceChange,
  PlanLibrary,
  PlanSafetyRules,
  SaveCompetitionPayload,
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

/**
 * Stand der Ernährungs-Warteschlange (Supabase-Modus, Etappe N7 Teil 2): Tagebuch-Einträge und eigene Gerichte, die
 * noch nicht übertragen bzw. abgelehnt wurden (Gründer-Frage G3 aus E1: abgelehnte bleiben lokal mit Hinweis).
 * Testmodus: immer 0.
 */
export interface NutritionSyncState {
  queued: number;
  rejected: number;
  /** Browser: geschützter Speicher nur sessionStorage – endet mit dem Tab (Hinweis). */
  sessionOnly: boolean;
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
  /**
   * Supabase-Modus (N7 Teil 2): In der Datenbank gibt es noch keine freigegebenen Rezepte (Fachprüfung offen, G-N7-3) –
   * klarer Leer-Zustand statt Beispiel-Rezepten.
   */
  awaitingReview?: boolean;
}

/** Widerruf health_data mit Umwandlung der Unverträglichkeiten (docs/PLAN-PHASE-5.md 7.4, R2-K4). */
export interface IntoleranceConversion {
  /**
   * Aktueller Stand (nur im Arbeitsspeicher): Daraus liest das Backend die Gruppen der Unverträglichkeiten – NUR, weil
   * die Person der Umwandlung aktiv zugestimmt hat. Ohne Zustimmung wird `null` übergeben und nichts eingelesen.
   */
  rows: UserRows;
}

/**
 * Gericht per Foto (Etappe E3, docs/PLAN-AUSWERTUNG.md Abschnitt 9): Ist die Foto-Auswertung für diese Person
 * freigeschaltet? Die Wahrheit prüft der Server bei jeder Auswertung erneut (Premium/Flag/Einwilligung/Limit).
 * - `available`: freigeschaltet (Testmodus: immer, mit Attrappe),
 * - `not_configured`: Supabase-Modus ohne Adresse der Website (EXPO_PUBLIC_WEB_URL) – Funktion nicht verfügbar,
 * - `flag_off`: Funktion gerade abgeschaltet (Feature-Flag), `no_entitlement`: kein Premium/keine Beta-Freischaltung.
 */
export type FoodPhotoAvailability = 'available' | 'not_configured' | 'flag_off' | 'no_entitlement';

export interface FoodPhotoStatus {
  readonly availability: FoodPhotoAvailability;
  /** Stand der Limits (aus ai_usage, nur Zeitpunkt/Status); null = nicht verfügbar. */
  readonly limit: PhotoLimitState | null;
  /** true = Testversion mit Attrappe (feste Beispielantworten, keine echte KI). */
  readonly mock: boolean;
}

export interface Backend {
  readonly mode: BackendMode;
  /**
   * Ernährung (Phase 5): Testmodus ab Etappe N4, Supabase-Modus seit Etappe N7 Teil 2 (Essensplan/Einkaufsliste aus der
   * Datenbank ohne Planband, Bestand aus der Datenbank, Tagebuch und eigene Gerichte mit verschlüsselter Warteschlange).
   * Steuert den Onboarding-Schritt `nutrition_setup` (R2-S3) und die Ernährungs-Bildschirme.
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
  // --- Wettkampf (Phase 10, Etappe WP4) ------------------------------------------------------------------
  /**
   * Wettkampf anlegen (`id` null) bzw. den eigenen GEPLANTEN als Ganzes ändern (public.save_competition; Testmodus:
   * checkSaveCompetition aus packages/core). Mit Plan-Bezug zwingend VOR savePlan des Wettkampfplans (Wächter WP3 M2).
   * Nur online (Supabase), nie Warteschlange. Fehler `competition_rejected` mit Grund.
   */
  saveCompetition(payload: SaveCompetitionPayload, rows: UserRows): Promise<UserRows>;
  /** Geplanten Wettkampf absagen (public.cancel_competition). Nur online. */
  cancelCompetition(id: string, rows: UserRows): Promise<UserRows>;
  /** Wettkampf abschließen, optional mit eigenem Ausdauer-Eintrag vom Renntag (public.complete_competition). */
  completeCompetition(id: string, sessionLogId: string | null, rows: UserRows): Promise<UserRows>;
  /** Wettkampf endgültig löschen (public.delete_competition, Recht auf Löschung). */
  deleteCompetition(id: string, rows: UserRows): Promise<UserRows>;
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
   * (Löschen braucht keine). Supabase: sofort, nur online (Gesundheitsdaten nie in die Warteschlange) – über
   * `delete_stored_intolerances`, das im selben Schritt Essenspläne/Einkaufslisten mit Gesundheitsbezug löscht. Fehlt die
   * Funktion noch (vor `db-migrate`), Fehler `delete_unavailable` – nie halb löschen (N7 Teil 2 Nr. 7).
   */
  deleteStoredIntolerances(): Promise<void>;
  /**
   * Ernährungs-Bestand (Phase 5): Testmodus aus dem Bündel (Entwürfe erlaubt, `selectNutritionContent`), auf Wunsch
   * Beispiel-Rezepte mit Testwerten (`demo`); Supabase-Modus seit N7 Teil 2 aus der Datenbank (nur freigegebene, fachlich
   * geprüfte Inhalte; offline der zuletzt geladene Stand).
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
   * Testmodus: Gerätespeicher mit denselben Regeln wie `save_meal_plan` (meal-plan-rows.ts); Supabase-Modus seit N7
   * Teil 2 über `save_meal_plan` (braucht Verbindung; G-W3 und die Löschfrist prüft der Server). `autoAdjusted` =
   * automatisch neu geplant
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
   * Einkaufsliste“. Testmodus: Gerätespeicher (meal-plan-rows.ts, geht ohne Netz); Supabase-Modus seit N7 Teil 2:
   * nur Häkchen → Spalte `checked` (ohne Gesundheitsbezug offline über die Warteschlange), sonst `replace_shopping_list`.
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
   * Supabase-Modus seit N7 Teil 2: verschlüsselte Ernährungs-Warteschlange → `save_food_log_entries` (offline möglich,
   * abgelehnte Fassungen bleiben lokal mit Hinweis). Fehler `consent_required`, `food_log_out_of_range`, `food_log_day_full`,
   * `food_log_rejected` – immer ohne Werte (Gesundheitsdaten).
   */
  saveFoodLogEntries(entries: readonly FoodLogEntry[], rows: UserRows): Promise<UserRows>;
  /** Eintrag löschen – geht immer (auch ohne Einwilligung, auch alte Einträge; Recht auf Löschung). */
  deleteFoodLogEntry(id: string, rows: UserRows): Promise<UserRows>;
  /** Stern setzen bzw. entfernen (`food_log_favorites`, kein Gesundheitsdatum). Fehler `favorite_limit`. */
  changeFoodLogFavorite(change: FavoriteChange, rows: UserRows): Promise<UserRows>;
  /**
   * Eigenes Gericht anlegen bzw. ganz ersetzen (Etappe E2, docs/PLAN-AUSWERTUNG.md 7). Testmodus: Gerätespeicher mit
   * denselben Regeln wie save_custom_meal (custom-meal-rows.ts) – geht ohne Netz. Supabase-Modus seit N7 Teil 2 über
   * die Ernährungs-Warteschlange → `save_custom_meal` (Werte aus Zutaten rechnet der Server). Fehler `consent_required`, `custom_meal_limit`,
   * `custom_meal_rejected` – immer ohne Namen und ohne Werte.
   */
  saveCustomMeal(meal: CustomMeal, rows: UserRows): Promise<UserRows>;
  /**
   * Gericht per Foto (Etappe E3): Freischaltung und Kontingent. Supabase-Modus: braucht Verbindung (sonst Fehler
   * `network`). Testmodus: immer verfügbar (Attrappe), Kontingent aus dem Gerätespeicher.
   */
  foodPhotoStatus(): Promise<FoodPhotoStatus>;
  /**
   * Ein Foto auswerten lassen (Etappe E3). Supabase-Modus: POST /api/ernaehrung/foto in apps/web (Login-Token,
   * Premium/Limit/Einwilligung prüft der Server); Testmodus: dieselbe Kette mit der Attrappe auf dem Gerät. Das Foto
   * wird nie gespeichert. Antwort = feste Codes bzw. geprüfte Bestandteile (Zod, `foodPhotoResponseSchema`); ohne
   * Verbindung Fehler `network`.
   */
  analyzeFoodPhoto(input: { image: Uint8Array; note: string | null }): Promise<FoodPhotoResponse>;
  /** Eigenes Gericht löschen – geht immer; eingetragene Tage behalten ihre Werte (Verweis wird leer). */
  deleteCustomMeal(id: string, rows: UserRows): Promise<UserRows>;
  /**
   * Produkt per Barcode-Nummer abfragen (Etappe E4a, docs/PLAN-E4.md 3.2). Supabase-Modus: POST
   * /api/ernaehrung/produkt in apps/web (Nummer im Körper, nie in der Adresse; Login, Einwilligung health_data, Limits
   * und Feature-Flag prüft der Server; ohne EXPO_PUBLIC_WEB_URL `not_configured`). Testmodus: dieselbe Kette mit der
   * Attrappe (Testnummern, ausgedachte Testwerte, kein Netz). Antwort Zod-geprüft (`productLookupResponseSchema`);
   * ohne Verbindung Fehler `network`.
   */
  lookupFoodProduct(code: string): Promise<ProductLookupResponse>;
  /**
   * Eigenes Produkt anlegen bzw. ganz ersetzen (Etappe E4a, Plan 2.3/3.4). Testmodus: Gerätespeicher mit denselben
   * Regeln wie save_user_food_product (user-food-product-rows.ts); Supabase-Modus über die Ernährungs-Warteschlange.
   * Fehler `consent_required`, `user_product_limit`, `user_product_rejected` – ohne Namen und ohne Werte.
   */
  saveUserFoodProduct(product: UserFoodProduct, rows: UserRows): Promise<UserRows>;
  /** Eigenes Produkt löschen – geht immer; eingetragene Tage behalten ihre Werte (Verweis wird leer). */
  deleteUserFoodProduct(id: string, rows: UserRows): Promise<UserRows>;
  /** Start des Meal-Prep-Kochtags (Timer) setzen bzw. mit null zurücksetzen (Etappe N5b). */
  saveCookDayStart(weekStart: string, startedAt: string | null, rows: UserRows): Promise<UserRows>;
  /** Wartende Trainings und Entwürfe (R6). */
  pendingWorkouts(): Promise<PendingWorkouts>;
  /** Ernährungs-Warteschlange (Supabase-Modus, N7 Teil 2): wartend, abgelehnt, nur im Browser-Tab. */
  nutritionSync(): Promise<NutritionSyncState>;
  /** Abgelehnte Tagebuch-Einträge/eigene Gerichte auf diesem Gerät verwerfen (nur auf ausdrücklichen Wunsch). */
  discardRejectedNutrition(): Promise<void>;
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
  /** Produkt (E4a): nicht (mehr) im Zwischenspeicher bzw. gesperrt – „Produkt neu abrufen“. */
  | 'food_log_product_unavailable'
  /** Produkt (E4a, Wächter M1): neue Nutzung einer Nummer zählt wie eine Abfrage – Limit je Stunde/Tag erreicht. */
  | 'food_log_product_limit'
  /** Eigene Produkte (E4a): höchstens 200 (USER_FOOD_PRODUCT_LIMITS.maxProducts). */
  | 'user_product_limit'
  /** Eigene Produkte (E4a): ungültige Angaben (ohne Namen, ohne Werte gemeldet). */
  | 'user_product_rejected'
  /** Vorübergehend (Zeitlimit, Sperrkonflikt, Server 5xx, Drosselung) – „bitte gleich noch einmal“. */
  | 'temporary'
  /** Wettkampf abgelehnt (save/cancel/complete/delete_competition) – Grund in `competitionReason`. */
  | 'competition_rejected'
  /**
   * Löschen gerade nicht möglich (Etappe N7 Teil 2, ersetzt den S1-Rückfall): Die Datenbank-Funktion fehlt noch (App
   * vor `db-migrate`) – nie halb löschen, „bitte später erneut versuchen“.
   */
  | 'delete_unavailable'
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
  /** Nur bei `competition_rejected`: Grund für den passenden Text (fester Code, ohne Werte). */
  readonly competitionReason: CompetitionErrorReason | null;

  constructor(
    code: BackendErrorCode,
    options: {
      sensitive?: boolean;
      cause?: unknown;
      moveReason?: MoveRejectReason;
      competitionReason?: CompetitionErrorReason;
    } = {},
  ) {
    // Bewusst ohne Werte in der Meldung – keine Gesundheitsdaten in Fehlern oder Logs.
    super(`BackendError: ${code}`);
    this.name = 'BackendError';
    this.code = code;
    this.sensitive = options.sensitive ?? false;
    this.moveReason = options.moveReason ?? null;
    this.competitionReason = options.competitionReason ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function errorCode(error: unknown): BackendErrorCode {
  return error instanceof BackendError ? error.code : 'unknown';
}
