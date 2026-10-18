import {
  type DataExportFile,
  type DaySwap,
  followUpBlockState,
  isAllowedGoalPair,
  type PreferenceChange,
  removeDaySwap as removeDaySwapEntry,
  upsertDaySwap,
  type GeneratedPlan,
  type MealPlanWeek,
  type RecipeRating,
  type StoredShoppingList,
  type PlanLibrary,
  type PlanSafetyRules,
  REQUIRED_CONSENT_TYPES,
  type ConsentType,
  type MoveBlockReason,
  moveRequestSchema,
  type RescheduleResult,
  swapRequestSchema,
  toSavePlanPayload,
  generatedPlanSchema,
  generatedCompetitionPlanSchema,
  type CompetitionFeasibility,
  type SaveCompetitionPayload,
  type CustomMeal,
  type UserFoodProduct,
  type FoodLogEntry,
} from '@fitnessapp/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  BackendError,
  errorCode,
  type Backend,
  type BackendErrorCode,
  type LogSaveOutcome,
  type NutritionLibraryResult,
  type NutritionSyncState,
  type PreferenceSwapContext,
} from '@/data/backend';
import {
  buildCompetitionPlan,
  type CompetitionDraft,
  competitionFollowUpFromRows,
  draftFromStored,
  type PlanBlocker,
  plannedCompetition,
} from '@/data/competition';
import { createBackend, deviceStore, newId } from '@/data/create-backend';
import { createDaySwapStore, prunedDaySwaps, withoutHealthPlanSwaps } from '@/data/day-swaps';
import type { FavoriteChange } from '@/data/food-log-rows';
import {
  draftToPayload,
  isValidPayload,
  refreshFreeDraft,
  type LogRejectReason,
  type WorkoutDraft,
} from '@/data/workout-draft';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  nextBlockFromRows,
  rescheduleInRows,
  validateMoveInRows,
} from '@/data/training-plan';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import { EMPTY_LOG_ROWS, type LogRows, mergeLogRows, removeSessionLog } from '@/data/log-rows';
import { answersFromRows, versionsFromDocuments, type ConsentVersions } from '@/data/mapping';
import type {
  AuthSession,
  ConsentDocument,
  OnboardingAnswers,
  ReminderSettings,
  StepSave,
  UserRows,
} from '@/data/types';
import { appNotifications } from '@/lib/app-notifications';
import { berlinTodayIso, todayIso } from '@/lib/format';
import { deviceTimeZone } from '@/lib/notifications';
import { supabaseConfig } from '@/lib/supabase';

import { healthConsentStatus, resolveEntryRoute, type EntryRoute } from './flow';

/**
 * Zentraler App-Zustand: Betriebsart, Sitzung, Einwilligungstexte und die Zeilen des Nutzers.
 * Enthält keine Fachlogik – Regeln kommen aus packages/core (über flow.ts, mapping.ts und das Backend).
 * Gesundheitsdaten liegen hier nur im Arbeitsspeicher; dauerhaft gespeichert wird nur über das Backend.
 */

type LoadStatus =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: BackendErrorCode };

/** Ergebnis von „Plan erstellen“ (Fehler als fester Code, Texte in i18n). */
export type CreatePlanOutcome =
  | {
      ok: true;
      plan: GeneratedPlan;
      /**
       * Es gibt einen geplanten Wettkampf mit Plan-Bezug, die Ampel passt aber gerade nicht – deshalb ein Grundlagen-Plan
       * (nie gestaucht, WP4). Hinweis auf „Mein Wettkampf“.
       */
      withoutCompetition?: 'not_feasible' | 'not_possible';
    }
  | { ok: false; code: BackendErrorCode | 'incomplete' | 'invalid_inputs' };

/** Ergebnis von „Wettkampfplan erstellen“ (Etappe WP4). */
export type CompetitionPlanOutcome =
  | { ok: true; plan: GeneratedPlan }
  /** Ampel „zu kurz“/„nicht möglich“ – kein Plan (nie gestaucht). */
  | { ok: false; kind: 'not_feasible'; feasibility: CompetitionFeasibility }
  | { ok: false; kind: 'blocked'; blocker: PlanBlocker | 'invalid_inputs' | 'no_template' }
  /** Fehler vom Backend (Text über errorText). */
  | { ok: false; kind: 'error'; error: unknown };

/** Rückmeldung nach dem Speichern eines Trainings (Texte in i18n workout.*). */
export type WorkoutMessage =
  | { kind: 'saved' }
  | { kind: 'queued' }
  | { kind: 'orphaned' }
  | { kind: 'conflict' }
  | { kind: 'rejected'; reason: LogRejectReason }
  | { kind: 'invalid' };

/** Abmelden (R6): wartende Trainings/Entwürfe → Nachfrage statt sofort abmelden. */
export type SignOutResult = { kind: 'signed_out' } | { kind: 'pending'; count: number };

/** Online nachgeladene ältere Einträge (Verlauf, Etappe D) – nur im Arbeitsspeicher. */
export interface OlderLogs {
  logs: LogRows;
  /** Nächste Seite: Einträge vor diesem Datum; null = keine älteren mehr. */
  nextBefore: string | null;
}

/** Ernährungs-Bestand (Phase 5, Etappe N4). */
export type NutritionLibraryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: NutritionLibraryResult }
  /** Supabase-Modus vor Etappe N7. */
  | { kind: 'unsupported' }
  | { kind: 'error' };

/** Bibliothek der Plan-Engine (für Anzeige und Folgeblock). */
type LibraryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; library: PlanLibrary }
  | { kind: 'missing' };

export interface AppContextValue {
  backend: Backend;
  status: LoadStatus;
  /** Supabase-Konfiguration vorhanden, aber fehlerhaft → Testmodus mit Hinweis. */
  invalidConfig: boolean;
  documents: ConsentDocument[];
  versions: ConsentVersions;
  session: AuthSession | null;
  rows: UserRows | null;
  answers: OnboardingAnswers;
  /** Geburtsdatum aus Schritt „Alter“, solange noch kein Konto existiert. */
  pendingBirthDate: string | null;
  offline: boolean;
  pendingChanges: number;
  reload: () => Promise<void>;
  entryRoute: () => EntryRoute;
  setPendingBirthDate: (birthDate: string | null) => Promise<void>;
  /** Nach Login/Testmodus-Start: Profil anlegen (falls Geburtsdatum vorhanden), Daten laden, Ziel-Route. */
  completeSignIn: (session: AuthSession) => Promise<EntryRoute>;
  createProfile: (birthDate: string) => Promise<EntryRoute>;
  grantConsents: (types: readonly ConsentType[]) => Promise<EntryRoute>;
  revokeConsent: (type: ConsentType) => Promise<void>;
  saveStep: (save: StepSave) => Promise<EntryRoute>;
  saveReminder: (settings: ReminderSettings, nextDueOn: string | null) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /**
   * Abmelden (R6): Liegen noch nicht übertragene Trainings, offene Entwürfe oder Konflikte vor, wird ohne `force`
   * nicht abgemeldet, sondern die Zahl gemeldet; „Jetzt senden“ = sendPending() und erneut fragen.
   */
  signOut: (force?: boolean) => Promise<SignOutResult>;
  /** Wartendes senden; Rest = noch offene Trainings (Warteschlange + Entwürfe). */
  sendPending: () => Promise<number>;
  clearDeviceData: () => Promise<void>;

  // --- Trainingstagebuch (Phase 4, Etappe C) ---
  /** Entwürfe des Kontos (laufende, abgelehnte, Konflikt-Fassungen). */
  drafts: WorkoutDraft[];
  /** Entwurf sofort sichern (jeder Tipp). */
  saveDraft: (draft: WorkoutDraft) => Promise<void>;
  discardDraft: (key: string) => Promise<void>;
  /** Training beenden: Eintrag bauen (Zod), speichern bzw. einreihen; Ergebnis als Meldung. */
  submitWorkout: (draft: WorkoutDraft) => Promise<LogSaveOutcome | { kind: 'invalid' }>;
  /** Konflikt: „Meine Fassung behalten“ = erneut senden auf Basis der Server-Revision. */
  keepMyVersion: (draft: WorkoutDraft) => Promise<LogSaveOutcome | { kind: 'invalid' }>;
  /** Eigenes Startgewicht speichern; liefert den neuen Stand (für die Neuberechnung der Vorgabe). */
  setStartWeight: (exerciseId: string, weightKg: number | null) => Promise<UserRows>;
  /**
   * Widerruf health_data mit Wahl „Tagebuch behalten“ / „auch löschen“ (S1, R3) und – nur bei aktiver Zustimmung –
   * Umwandlung der Unverträglichkeiten in „mag ich nicht“ (docs/PLAN-PHASE-5.md 7.4, R2-K4).
   */
  revokeHealthData: (deleteLogs: boolean, convertIntolerances: boolean) => Promise<void>;
  /** Gespeicherte Unverträglichkeiten löschen (Recht auf Löschung, geht ohne Einwilligung, NK2). */
  deleteStoredIntolerances: () => Promise<void>;
  workoutMessage: WorkoutMessage | null;
  clearWorkoutMessage: () => void;
  /** Planned-Session-IDs mit noch nicht übertragenem Training. */
  pendingLogSessionIds: readonly string[];
  /** Einträge eines anderen Kontos auf dem Gerät (R5) → Nachfrage „löschen?“. */
  foreignData: boolean;
  discardForeignData: () => Promise<void>;
  /** Senden scheiterte an der abgelaufenen Sitzung (R5) → „Bitte melde dich erneut an“. */
  sessionExpired: boolean;

  // --- Woche, Verlauf, Export (Phase 4, Etappe D) ---
  /** Nachgeladene ältere Einträge; null = noch nichts nachgeladen. */
  olderLogs: OlderLogs | null;
  /** Nächste Seite älterer Einträge laden (nur online, Fehler als BackendError). */
  loadOlderLogs: () => Promise<void>;
  /** Eintrag löschen (nur online, mit Revision R4); danach neu laden. */
  deleteLog: (logId: string, revision: number) => Promise<'ok' | 'conflict'>;
  /** Datenexport (nur online): alle eigenen Daten plus Konto-E-Mail. */
  exportData: () => Promise<DataExportFile>;

  // --- Trainingsplan (Phase 3) ---
  /** Übungs-Bibliothek (null = nicht geladen/fehlt → Zustand „Übungen können nicht geprüft werden“). */
  library: LibraryState;
  /** Bibliothek laden (offline: Zwischenspeicher). */
  ensureLibrary: () => Promise<void>;
  /** Wirksame AKTUELLE Sicherheitsregeln (offline: geschützter Zwischenspeicher, Frage 14). */
  safetyRules: PlanSafetyRules | null;
  /** Einmalige Meldung (z. B. verworfene Verschiebung). */
  planMessage: string | null;
  clearPlanMessage: () => void;
  /**
   * Plan nach den aktuellen Angaben erzeugen und speichern (ersetzt den aktiven Plan). Mit geplantem Wettkampf samt
   * Plan-Bezug als Wettkampfplan (save_competition → save_training_plan), sonst bzw. bei roter Ampel Grundlagen-Plan.
   */
  createPlan: () => Promise<CreatePlanOutcome>;
  /**
   * Wettkampfplan erstellen (WP4): ggf. Ziel-Distanz anpassen, dann save_competition MIT Plan-Bezug, dann
   * save_training_plan (Reihenfolge zwingend, Wächter WP3 M2). Nur online.
   */
  createCompetitionPlan: (
    draft: CompetitionDraft,
    competitionId: string | null,
  ) => Promise<CompetitionPlanOutcome>;
  /** Wettkampf ohne neuen Plan speichern (Countdown bzw. unveränderter Plan-Bezug). Fehler werfen. */
  saveCompetition: (payload: SaveCompetitionPayload) => Promise<void>;
  cancelCompetition: (id: string) => Promise<void>;
  completeCompetition: (id: string, sessionLogId: string | null) => Promise<void>;
  deleteCompetition: (id: string) => Promise<void>;
  /** Einheit verschieben (5.11): freier Tag dieser Woche, sonst streichen. */
  moveSession: (sessionId: string) => Promise<RescheduleResult>;
  /**
   * Kalender (Etappe A1a): Einheit auf einen gewählten Tag verschieben bzw. – ist er belegt – mit der Einheit dort
   * tauschen. Der Core prüft vorher (validateMove); der Server prüft erneut. Fehler werfen (BackendError).
   */
  moveSessionTo: (sessionId: string, targetDate: string) => Promise<MoveOutcome>;
  /** Folgeblock anhängen, wenn fällig (automatisch beim Anzeigen von „Heute“). */
  appendNextBlockIfDue: () => Promise<void>;

  // --- Ernährung (Phase 5, Etappe N4) ---
  /** Ernährungs-Bestand (Lebensmittel, Rezepte) – erst bei Bedarf geladen. */
  nutritionLibrary: NutritionLibraryState;
  ensureNutritionLibrary: () => Promise<void>;
  /** Testmodus: Beispiel-Rezepte mit Testwerten verwenden (nur solange das Bündel keine Rezepte hat). */
  setNutritionDemo: (enabled: boolean) => Promise<void>;
  /**
   * Essensplan der Woche speichern (Etappe N5: Tauschen, „Andere Vorschläge“, „Plan aktualisieren“, Hinweis
   * „Verstanden“). Fehler werfen (Anzeige im Bildschirm).
   */
  saveMealPlan: (
    plan: MealPlanWeek,
    options: {
      autoAdjusted: boolean;
      recipesChanged?: boolean;
      /** Neu erzeugte Einkaufsliste der Woche – im selben Schritt gespeichert (R2-S4, Etappe N5b). */
      shoppingList?: StoredShoppingList | undefined;
    },
  ) => Promise<void>;
  /**
   * Automatisch speichern, was `resolveMealPlanWeek`/`resolveShoppingList` beim Öffnen ergeben haben (neu erstellt bzw.
   * automatisch neu geplant, 6.6; Einkaufsliste an den Plan angepasst, W22) – je Woche und Fingerabdruck höchstens
   * einmal (keine Schleife, kein Doppel aus zwei Bildschirmen). Fehler setzen `mealPlanSaveFailed` (angezeigt wird
   * trotzdem der richtige Stand). `plan: null` = nur die Liste.
   */
  persistMealPlan: (
    plan: MealPlanWeek | null,
    options: {
      autoAdjusted: boolean;
      recipesChanged: boolean;
      inputsKey: string;
      shoppingList?: StoredShoppingList | undefined;
    },
  ) => Promise<void>;
  /** Das automatische Speichern des Essensplans ist gescheitert. */
  mealPlanSaveFailed: boolean;
  /**
   * … und zwar, weil die Einwilligung Gesundheitsdaten fehlt bzw. eine neue Fassung hat (Wächter N7 H3) – dann klarer
   * Zustand „Einwilligung erneuern oder Unverträglichkeiten löschen“ statt „Erneut versuchen“.
   */
  mealPlanSaveConsentMissing: boolean;
  /** Ernährungs-Warteschlange (Supabase-Modus, N7 Teil 2): wartend, abgelehnt, nur im Browser-Tab. */
  nutritionSync: NutritionSyncState;
  /** Abgelehnte Tagebuch-Einträge/eigene Gerichte auf diesem Gerät verwerfen (Gründer-Frage G3 aus E1). */
  discardRejectedNutrition: () => Promise<void>;
  /** „Erneut versuchen“ nach gescheitertem automatischem Speichern (Wächter N5a K7). */
  retryMealPlanSave: () => void;
  /** Zähler der Versuche (ändert sich bei „Erneut versuchen“, damit das automatische Speichern neu läuft). */
  mealPlanSaveAttempt: number;
  /** Einkaufsliste der Woche speichern (Etappe N5b: Abhaken, eigene Einträge, Zeitraum, „Zur Einkaufsliste“). */
  saveShoppingList: (list: StoredShoppingList) => Promise<void>;
  /** Start des Meal-Prep-Kochtags setzen bzw. zurücksetzen (Timer, Etappe N5b). */
  saveCookDayStart: (weekStart: string, startedAt: string | null) => Promise<void>;
  /** Bewertung nach dem Essen setzen bzw. zurücknehmen (`null`, Etappe N10). */
  saveRecipeRating: (recipeId: string, rating: RecipeRating | null) => Promise<void>;
  /** Alle eigenen Bewertungen löschen (Etappe N10). */
  deleteRecipeRatings: () => Promise<void>;
  /** „Mag ich nicht“ je Lebensmittel ersetzen (Etappe N10). */
  saveFoodDislikes: (foodIds: readonly string[]) => Promise<void>;
  /** Ernährungstagebuch (Etappe E1): Einträge neu anlegen bzw. ersetzen (Testmodus; Supabase ab N7 Teil 2). */
  saveFoodLogEntries: (entries: readonly FoodLogEntry[]) => Promise<void>;
  /** Tagebuch-Eintrag löschen (geht immer). */
  deleteFoodLogEntry: (id: string) => Promise<void>;
  /** Stern setzen bzw. entfernen. */
  changeFoodLogFavorite: (change: FavoriteChange) => Promise<void>;
  /** Eigenes Gericht anlegen bzw. ändern (Etappe E2; Testmodus, Supabase ab N7 Teil 2). */
  saveCustomMeal: (meal: CustomMeal) => Promise<void>;
  /** Eigenes Gericht löschen (geht immer). */
  deleteCustomMeal: (id: string) => Promise<void>;
  /** Eigenes Produkt anlegen bzw. ändern (Etappe E4a). */
  saveUserFoodProduct: (product: UserFoodProduct) => Promise<void>;
  /** Eigenes Produkt löschen (geht immer). */
  deleteUserFoodProduct: (id: string) => Promise<void>;

  // --- Übungstausch (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md, Etappe T2) ---
  /** „Nur heute“-Tausche vor dem Training (Gerätespeicher, nur dieses Konto; geprüft bei jeder Anzeige im Core). */
  daySwaps: readonly DaySwap[];
  /** Day-Swap anlegen bzw. ersetzen (je Einheit und Position einer). */
  addDaySwap: (swap: DaySwap) => Promise<void>;
  /** Day-Swaps entfernen (Rückgängig bzw. Aufräumen der vom Core verworfenen). */
  removeDaySwaps: (
    slots: readonly Pick<DaySwap, 'ownerUserId' | 'sessionId' | 'storedOrderNo'>[],
  ) => Promise<void>;
  /** Vom Core verworfene Day-Swaps (droppedDaySwaps) genau so aus dem Speicher räumen. */
  dropDaySwaps: (swaps: readonly DaySwap[]) => Promise<void>;
  /** „Ab jetzt immer“, Rückgängig, „Wieder zulassen“ (Testmodus; Supabase ab T3). */
  updateExercisePreferences: (
    changes: readonly PreferenceChange[],
    at: PreferenceSwapContext | null,
  ) => Promise<UserRows>;
}

/** Meldung nach verworfener Verschiebung (Text in i18n, hier nur der Schlüssel). */
export const PLAN_CHANGE_DROPPED = 'plan_change_dropped' as const;
/** Meldung: Ziel vom Server abgelehnt (23514, älterer App-Stand – Wächter Z3 N3) → „Bitte App aktualisieren“. */
export const GOALS_REJECTED = 'goals_rejected' as const;

/** Ergebnis von moveSessionTo (Kalender, Etappe A1a). */
export type MoveOutcome =
  | { kind: 'moved'; sessionId: string; from: string; to: string }
  | { kind: 'swapped'; sessionId: string; otherSessionId: string; from: string; to: string }
  | { kind: 'blocked'; reason: MoveBlockReason };
/** Meldung: Folgeblock ließ sich nicht anhängen → Plan neu erstellen. */
export const PLAN_RECREATE_NEEDED = 'plan_recreate_needed' as const;
/** Meldung: Wettkampfplan endet (Zyklus fertig, Wettkampf vorbei/abgesagt, Regel neu) → Plan neu erstellen (WP4). */
export const COMPETITION_PLAN_ENDED = 'competition_plan_ended' as const;
/** Meldung: strengere Regeln, Ziel nicht mehr erreichbar → Plan neu erstellen (Wächter WP4 M7). */
export const COMPETITION_GOAL_UNREACHABLE = 'competition_goal_unreachable' as const;

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Betriebsart wird einmal beim Start gewählt (Supabase-Werte ändern sich nur mit einem neuen Build).
  const [backend] = useState<Backend>(() => createBackend());

  const [status, setStatus] = useState<LoadStatus>({ kind: 'loading' });
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<UserRows | null>(null);
  const [pendingBirthDate, setPendingBirthDateState] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [library, setLibrary] = useState<LibraryState>({ kind: 'idle' });
  const [cachedRules, setCachedRules] = useState<PlanSafetyRules | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<WorkoutDraft[]>([]);
  const [workoutMessage, setWorkoutMessage] = useState<WorkoutMessage | null>(null);
  const [pendingLogSessionIds, setPendingLogSessionIds] = useState<readonly string[]>([]);
  const [foreignData, setForeignData] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [olderLogs, setOlderLogs] = useState<OlderLogs | null>(null);
  const [daySwaps, setDaySwaps] = useState<readonly DaySwap[]>([]);
  const [daySwapStore] = useState(() => createDaySwapStore(deviceStore));
  const [nutritionLibrary, setNutritionLibrary] = useState<NutritionLibraryState>({
    kind: 'idle',
  });
  const [mealPlanSaveFailed, setMealPlanSaveFailed] = useState(false);
  const [mealPlanSaveConsentMissing, setMealPlanSaveConsentMissing] = useState(false);
  const [nutritionSync, setNutritionSync] = useState<NutritionSyncState>({
    queued: 0,
    rejected: 0,
    sessionOnly: false,
  });
  const [mealPlanSaveAttempt, setMealPlanSaveAttempt] = useState(0);
  /** Automatisch gespeicherte Essenspläne: Woche | Angaben-Fingerabdruck (nur Arbeitsspeicher, Etappe N5). */
  const persistedMealPlansRef = useRef(new Set<string>());
  const appendingRef = useRef(false);
  /** Plan, für den das Anhängen gescheitert ist (kein erneuter Versuch bis zum neuen Plan). */
  const appendFailedRef = useRef<string | null>(null);

  const versions = useMemo(() => versionsFromDocuments(documents), [documents]);
  const answers = useMemo(() => (rows ? answersFromRows(rows) : {}), [rows]);

  const refreshPending = useCallback(() => {
    setPendingChanges(backend.pendingChanges());
    setPendingLogSessionIds(backend.pendingLogSessionIds());
    void backend
      .nutritionSync()
      .then((state) =>
        setNutritionSync((before) =>
          before.queued === state.queued &&
          before.rejected === state.rejected &&
          before.sessionOnly === state.sessionOnly
            ? before
            : state,
        ),
      )
      .catch(() => undefined);
  }, [backend]);

  const discardRejectedNutrition = useCallback(async () => {
    await backend.discardRejectedNutrition();
    refreshPending();
  }, [backend, refreshPending]);

  const reloadDrafts = useCallback(async () => {
    try {
      setDrafts(await backend.loadDrafts());
      setForeignData(await backend.hasForeignDeviceData());
    } catch {
      setDrafts([]);
    }
  }, [backend]);

  /** Day-Swaps des Kontos laden und aufräumen (pruneDaySwaps); ein kaputter Gerätespeicher ergibt eine leere Liste. */
  const reloadDaySwaps = useCallback(
    async (loaded: UserRows) => {
      const owner = loaded.profile?.user_id;
      if (!owner) {
        setDaySwaps([]);
        return;
      }
      try {
        const stored = await daySwapStore.load(owner);
        const kept = prunedDaySwaps(loaded, stored, todayIso());
        if (kept.length !== stored.length) await daySwapStore.save(owner, kept);
        setDaySwaps(kept);
      } catch {
        setDaySwaps([]);
      }
    },
    [daySwapStore],
  );

  const loadUser = useCallback(async (): Promise<UserRows> => {
    const result = await backend.loadRows();
    setRows(result.rows);
    setOffline(result.offline);
    setCachedRules(result.offline ? (result.cachedSafetyRules ?? null) : null);
    refreshPending();
    await reloadDrafts();
    await reloadDaySwaps(result.rows);
    return result.rows;
  }, [backend, refreshPending, reloadDaySwaps, reloadDrafts]);

  /** Lädt Texte, Sitzung und Daten (Status bleibt bis zum Ende unverändert). */
  const load = useCallback(async () => {
    try {
      const [docs, current, pending] = await Promise.all([
        backend.loadConsentDocuments(),
        backend.getSession(),
        readJson<string>(deviceStore, STORAGE_KEYS.pendingBirthDate),
      ]);
      setDocuments(docs);
      setSession(current);
      setPendingBirthDateState(pending);
      if (current) {
        await loadUser();
      } else {
        setRows(null);
      }
      setStatus({ kind: 'ready' });
    } catch (error) {
      setStatus({ kind: 'error', code: errorCode(error) });
    }
  }, [backend, loadUser]);

  const reload = useCallback(async () => {
    setStatus({ kind: 'loading' });
    await load();
  }, [load]);

  useEffect(() => {
    // Einmaliges Laden beim Start; Zustände werden erst nach dem asynchronen Laden gesetzt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Offline-Warteschlange (nur Supabase-Modus): beim Zurückkehren in die App, bei „online“ und regelmäßig senden.
  useEffect(() => {
    if (backend.mode !== 'supabase') {
      return;
    }
    const tryFlush = () => {
      void backend.flush().then(refreshPending);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tryFlush();
      }
    });
    const interval = setInterval(() => {
      if (backend.pendingChanges() > 0) {
        tryFlush();
      } else {
        refreshPending();
      }
    }, 15000);
    const onOnline = () => tryFlush();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }
    return () => {
      subscription.remove();
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
    };
  }, [backend, refreshPending]);

  // Verworfene Verschiebung (Warteschlange) → Plan neu laden + Meldung (PLAN-PHASE-3 10.1 Punkt 5).
  // Tagebuch (4.3): übertragen / Konflikt / abgelehnt → neu laden + Meldung; Sitzung abgelaufen → Hinweis.
  useEffect(() => {
    return backend.subscribe((event) => {
      if (event.kind === 'plan_change_dropped') {
        setPlanMessage(PLAN_CHANGE_DROPPED);
        void loadUser().catch(() => undefined);
      } else if (event.kind === 'goals_rejected') {
        setPlanMessage(GOALS_REJECTED);
        void loadUser().catch(() => undefined);
      } else if (event.kind === 'session_expired') {
        setSessionExpired(true);
      } else {
        if (event.kind === 'log_saved') {
          setSessionExpired(false);
          if (event.orphaned) setWorkoutMessage({ kind: 'orphaned' });
        } else if (event.kind === 'log_conflict') {
          setWorkoutMessage({ kind: 'conflict' });
        } else if (event.kind === 'log_rejected') {
          setWorkoutMessage({ kind: 'rejected', reason: event.reason });
        }
        refreshPending();
        void loadUser().catch(() => undefined);
      }
    });
  }, [backend, loadUser, refreshPending]);

  // Browser: solange ein Entwurf oder wartende Trainings existieren, beim Schließen des Tabs warnen (4.2) –
  // sessionStorage endet mit dem Tab.
  const hasUnsent = drafts.length > 0 || pendingLogSessionIds.length > 0;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !hasUnsent) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Ältere Browser brauchen einen Rückgabewert (der Text selbst wird nicht mehr angezeigt).
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsent]);

  // Lokale Mess-Erinnerung (docs/PLAN-PHASE-4B.md 7, Etappe E): beim App-Start (nach dem Laden), nach einer Messung
  // (neues next_due_on), bei geändertem Abstand oder Schalter und nach Widerruf bzw. erneuter Einwilligung neu planen
  // bzw. stornieren. Fragt nie nach der Erlaubnis; im Browser ein No-op.
  const lastReminderSync = useRef<string | null>(null);
  useEffect(() => {
    if (status.kind !== 'ready' || !rows) {
      lastReminderSync.current = null;
      return;
    }
    const key = [
      rows.profile?.user_id ?? '',
      rows.reminder?.enabled ?? '',
      rows.reminder?.next_due_on ?? '',
      healthConsentStatus(rows, versions),
    ].join('|');
    if (key === lastReminderSync.current) return;
    lastReminderSync.current = key;
    void appNotifications
      .syncMeasurement({ rows, versions, nowMs: Date.now(), timeZone: deviceTimeZone() })
      .catch(() => undefined);
  }, [status.kind, rows, versions]);

  /** Widerruf gescheitert (Einwilligung gilt weiter): die vorher stornierte Mess-Erinnerung wieder planen (Wächter N4). */
  const replanMeasurementAfterFailedRevoke = useCallback(() => {
    lastReminderSync.current = null;
    void appNotifications
      .syncMeasurement({ rows, versions, nowMs: Date.now(), timeZone: deviceTimeZone() })
      .catch(() => undefined);
  }, [rows, versions]);

  const setPendingBirthDate = useCallback(async (birthDate: string | null) => {
    setPendingBirthDateState(birthDate);
    if (birthDate === null) {
      await deviceStore.removeItem(STORAGE_KEYS.pendingBirthDate);
    } else {
      await writeJson(deviceStore, STORAGE_KEYS.pendingBirthDate, birthDate);
    }
  }, []);

  const routeFor = useCallback(
    (current: AuthSession | null, currentRows: UserRows | null) =>
      resolveEntryRoute({
        session: current,
        rows: currentRows,
        versions,
        nutritionSetupAvailable: backend.supportsNutrition,
      }),
    [backend, versions],
  );

  const entryRoute = useCallback(() => routeFor(session, rows), [routeFor, session, rows]);

  const completeSignIn = useCallback(
    async (signedIn: AuthSession) => {
      setSession(signedIn);
      let loaded = await loadUser();
      if (!loaded.profile && pendingBirthDate) {
        await backend.createProfile(pendingBirthDate);
        await setPendingBirthDate(null);
        loaded = await loadUser();
      }
      return routeFor(signedIn, loaded);
    },
    [backend, loadUser, pendingBirthDate, routeFor, setPendingBirthDate],
  );

  const createProfile = useCallback(
    async (birthDate: string) => {
      await backend.createProfile(birthDate);
      await setPendingBirthDate(null);
      const loaded = await loadUser();
      return routeFor(session, loaded);
    },
    [backend, loadUser, routeFor, session, setPendingBirthDate],
  );

  const grantConsents = useCallback(
    async (types: readonly ConsentType[]) => {
      await backend.grantConsents(types, versions);
      const loaded = await loadUser();
      return routeFor(session, loaded);
    },
    [backend, loadUser, routeFor, session, versions],
  );

  const revokeConsent = useCallback(
    async (type: ConsentType) => {
      if (type === 'health_data') await appNotifications.cancelMeasurement().catch(() => undefined);
      try {
        await backend.revokeConsent(type);
      } catch (error) {
        if (type === 'health_data') replanMeasurementAfterFailedRevoke();
        throw error;
      }
      await loadUser();
    },
    [backend, loadUser, replanMeasurementAfterFailedRevoke],
  );

  // --- Ernährung (Etappe N4) ---------------------------------------------------------------------------------
  const loadNutrition = useCallback(async () => {
    if (!backend.supportsNutrition) {
      setNutritionLibrary({ kind: 'unsupported' });
      return;
    }
    setNutritionLibrary({ kind: 'loading' });
    try {
      // true = aktive Wahl; "force" setzen nur die E2E-Tests (Beispiel-Rezepte trotz echtem Bündel, Wächter N4 K7).
      const stored = await readJson<boolean | 'force'>(deviceStore, STORAGE_KEYS.nutritionDemo);
      const result = await backend.loadNutritionLibrary({
        demo: stored === true || stored === 'force',
        force: stored === 'force',
      });
      setNutritionLibrary(result ? { kind: 'ready', result } : { kind: 'unsupported' });
    } catch {
      setNutritionLibrary({ kind: 'error' });
    }
  }, [backend]);

  const ensureNutritionLibrary = useCallback(async () => {
    if (nutritionLibrary.kind === 'idle' || nutritionLibrary.kind === 'error') {
      await loadNutrition();
    }
  }, [loadNutrition, nutritionLibrary.kind]);

  const setNutritionDemo = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await writeJson(deviceStore, STORAGE_KEYS.nutritionDemo, true);
      } else {
        await deviceStore.removeItem(STORAGE_KEYS.nutritionDemo);
      }
      await loadNutrition();
    },
    [loadNutrition],
  );

  const saveMealPlan = useCallback(
    async (
      plan: MealPlanWeek,
      options: {
        autoAdjusted: boolean;
        recipesChanged?: boolean;
        shoppingList?: StoredShoppingList | undefined;
      },
    ) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveMealPlan(plan, options, rows));
      setMealPlanSaveFailed(false);
      setMealPlanSaveConsentMissing(false);
    },
    [backend, rows],
  );

  const persistMealPlan = useCallback(
    async (
      plan: MealPlanWeek | null,
      options: {
        autoAdjusted: boolean;
        recipesChanged: boolean;
        inputsKey: string;
        shoppingList?: StoredShoppingList | undefined;
      },
    ) => {
      const weekStart = plan?.weekStart ?? options.shoppingList?.weekStart;
      if (weekStart === undefined) return;
      const key = `${weekStart}|${options.inputsKey}|${plan === null ? '-' : 'plan'}|${
        options.shoppingList?.planKey ?? '-'
      }`;
      if (!rows || persistedMealPlansRef.current.has(key)) return;
      persistedMealPlansRef.current.add(key);
      try {
        if (plan !== null) {
          setRows(
            await backend.saveMealPlan(
              plan,
              {
                autoAdjusted: options.autoAdjusted,
                recipesChanged: options.recipesChanged,
                shoppingList: options.shoppingList,
              },
              rows,
            ),
          );
        } else if (options.shoppingList !== undefined) {
          setRows(await backend.saveShoppingList(options.shoppingList, rows));
        }
        setMealPlanSaveFailed(false);
        setMealPlanSaveConsentMissing(false);
      } catch (error) {
        // Ohne Details (Gesundheitsdaten); der angezeigte Plan bleibt der nach den aktuellen Angaben.
        setMealPlanSaveFailed(true);
        setMealPlanSaveConsentMissing(errorCode(error) === 'consent_required');
      }
    },
    [backend, rows],
  );

  const retryMealPlanSave = useCallback(() => {
    persistedMealPlansRef.current.clear();
    setMealPlanSaveFailed(false);
    setMealPlanSaveConsentMissing(false);
    setMealPlanSaveAttempt((n) => n + 1);
  }, []);

  const saveShoppingList = useCallback(
    async (list: StoredShoppingList) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveShoppingList(list, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const saveCookDayStart = useCallback(
    async (weekStart: string, startedAt: string | null) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveCookDayStart(weekStart, startedAt, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const saveRecipeRating = useCallback(
    async (recipeId: string, rating: RecipeRating | null) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveRecipeRating({ recipeId, rating }, rows));
    },
    [backend, rows],
  );

  const deleteRecipeRatings = useCallback(async () => {
    if (!rows) {
      throw new BackendError('not_signed_in');
    }
    setRows(await backend.deleteRecipeRatings(rows));
  }, [backend, rows]);

  const saveFoodDislikes = useCallback(
    async (foodIds: readonly string[]) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveFoodDislikes(foodIds, rows));
    },
    [backend, rows],
  );

  const saveFoodLogEntries = useCallback(
    async (entries: readonly FoodLogEntry[]) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      try {
        setRows(await backend.saveFoodLogEntries(entries, rows));
        refreshPending();
      } catch (error) {
        // Teilerfolg (Wächter E1 S2, Nachprüfung H2): gültige Einträge sind gespeichert, ein anderer wurde abgelehnt –
        // den gespeicherten Stand trotzdem anzeigen, dann den Fehler melden.
        const code = errorCode(error);
        if (
          code === 'food_log_rejected' ||
          code === 'food_log_out_of_range' ||
          code === 'food_log_day_full'
        ) {
          const reloaded = await backend.loadRows().catch(() => null);
          if (reloaded) setRows(reloaded.rows);
        }
        refreshPending();
        throw error;
      }
    },
    [backend, refreshPending, rows],
  );

  const deleteFoodLogEntry = useCallback(
    async (id: string) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.deleteFoodLogEntry(id, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const changeFoodLogFavorite = useCallback(
    async (change: FavoriteChange) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.changeFoodLogFavorite(change, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const saveCustomMeal = useCallback(
    async (meal: CustomMeal) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveCustomMeal(meal, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const deleteCustomMeal = useCallback(
    async (id: string) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.deleteCustomMeal(id, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const saveUserFoodProduct = useCallback(
    async (product: UserFoodProduct) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveUserFoodProduct(product, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const deleteUserFoodProduct = useCallback(
    async (id: string) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.deleteUserFoodProduct(id, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const revokeHealthData = useCallback(
    async (deleteLogs: boolean, convertIntolerances: boolean) => {
      // Etappe E (Wächter S5): Mess-Erinnerung sofort stornieren – im selben Ablauf, der auch den healthPlanCache leert.
      // measurement_reminders.enabled bleibt; nach erneuter Einwilligung plant die App sie wieder ein.
      await appNotifications.cancelMeasurement().catch(() => undefined);
      try {
        // Day-Swaps zu Plänen mit Gesundheitsbezug mit entfernen (wie die Entwürfe, PLAN-UEBUNGEN-GLOSSAR-TAUSCH 9).
        const owner = rows?.profile?.user_id;
        if (rows && owner) {
          const kept = withoutHealthPlanSwaps(rows, await daySwapStore.load(owner));
          await daySwapStore.save(owner, kept);
          setDaySwaps(kept);
        }
        // 7.4 (R2-K4): Die Unverträglichkeiten werden nur bei aktiver Zustimmung an das Backend gegeben.
        await backend.revokeHealthData(deleteLogs, convertIntolerances && rows ? { rows } : null);
      } catch (error) {
        replanMeasurementAfterFailedRevoke();
        throw error;
      }
      await loadUser();
    },
    [backend, daySwapStore, loadUser, replanMeasurementAfterFailedRevoke, rows],
  );

  const deleteStoredIntolerances = useCallback(async () => {
    await backend.deleteStoredIntolerances();
    await loadUser();
  }, [backend, loadUser]);

  const saveStep = useCallback(
    async (save: StepSave) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      const wasCompleted = rows.profile?.onboarding_completed_at != null;
      const next = await backend.saveStep(save, { answers, rows, versions });
      setRows(next);
      refreshPending();
      if (!wasCompleted && next.profile?.onboarding_completed_at != null) {
        return '/done' as const;
      }
      return routeFor(session, next);
    },
    [answers, backend, refreshPending, routeFor, rows, session, versions],
  );

  const saveReminder = useCallback(
    async (settings: ReminderSettings, nextDueOn: string | null) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveReminder(settings, nextDueOn, rows));
      refreshPending();
    },
    [backend, refreshPending, rows],
  );

  const resetUser = useCallback(() => {
    setSession(null);
    setRows(null);
    setOffline(false);
    setPendingChanges(0);
    setCachedRules(null);
    setPlanMessage(null);
    setDrafts([]);
    setWorkoutMessage(null);
    setPendingLogSessionIds([]);
    setForeignData(false);
    setSessionExpired(false);
    setOlderLogs(null);
    setDaySwaps([]);
    setNutritionLibrary({ kind: 'idle' });
    setMealPlanSaveFailed(false);
    persistedMealPlansRef.current.clear();
  }, []);

  // --- Übungstausch (Etappe T2) -----------------------------------------------------------------------------
  const addDaySwap = useCallback(
    async (swap: DaySwap) => {
      const next = upsertDaySwap(await daySwapStore.load(swap.ownerUserId), swap);
      await daySwapStore.save(swap.ownerUserId, next);
      setDaySwaps(next);
    },
    [daySwapStore],
  );

  const removeDaySwaps = useCallback(
    async (slots: readonly Pick<DaySwap, 'ownerUserId' | 'sessionId' | 'storedOrderNo'>[]) => {
      const owner = slots[0]?.ownerUserId;
      if (!owner) return;
      const next = slots.reduce<DaySwap[]>(
        (list, slot) => removeDaySwapEntry(list, slot),
        await daySwapStore.load(owner),
      );
      await daySwapStore.save(owner, next);
      setDaySwaps(next);
    },
    [daySwapStore],
  );

  const dropDaySwaps = useCallback(
    async (dropped: readonly DaySwap[]) => {
      const owner = dropped[0]?.ownerUserId;
      if (!owner) return;
      const same = (a: DaySwap, b: DaySwap) =>
        a.sessionId === b.sessionId &&
        a.storedOrderNo === b.storedOrderNo &&
        a.alternativeId === b.alternativeId &&
        a.createdAt === b.createdAt;
      const current = await daySwapStore.load(owner);
      const next = current.filter((s) => !dropped.some((d) => same(s, d)));
      if (next.length === current.length) return;
      await daySwapStore.save(owner, next);
      setDaySwaps(next);
    },
    [daySwapStore],
  );

  const updateExercisePreferences = useCallback(
    async (changes: readonly PreferenceChange[], at: PreferenceSwapContext | null) => {
      if (!rows) throw new BackendError('not_signed_in');
      const next = await backend.updateExercisePreferences(changes, at, rows);
      setRows(next);
      refreshPending();
      return next;
    },
    [backend, refreshPending, rows],
  );

  // --- Trainingstagebuch -----------------------------------------------------------------------------------
  const saveDraft = useCallback(
    async (draft: WorkoutDraft) => {
      setDrafts((current) => [...current.filter((d) => d.key !== draft.key), draft]);
      await backend.saveDraft(draft);
    },
    [backend],
  );

  const discardDraft = useCallback(
    async (key: string) => {
      setDrafts((current) => current.filter((d) => d.key !== key));
      await backend.discardDraft(key);
    },
    [backend],
  );

  const submit = useCallback(
    async (input: WorkoutDraft): Promise<LogSaveOutcome | { kind: 'invalid' }> => {
      const now = new Date().toISOString();
      // Freie Einheit (A1b, Wächter S1): Übungsnamen aus der aktuellen Bibliothek nachziehen (Umbenennung).
      const draft =
        library.kind === 'ready'
          ? refreshFreeDraft(input, library.library.exercises, now).draft
          : input;
      // Datum gegen „heute“ wie der Server (Europe/Berlin, H4) prüfen (freeSessionLogFromInput in packages/core).
      const payload = draftToPayload(draft, { writeId: newId(), now, today: berlinTodayIso() });
      // Zod an der Grenze: nur Einträge, die save_session_log annehmen würde.
      if (!isValidPayload(payload)) {
        setWorkoutMessage({ kind: 'invalid' });
        return { kind: 'invalid' };
      }
      const outcome = await backend.submitWorkout(draft, payload);
      setWorkoutMessage(
        outcome.kind === 'saved'
          ? { kind: outcome.orphaned ? 'orphaned' : 'saved' }
          : outcome.kind === 'rejected'
            ? { kind: 'rejected', reason: outcome.reason }
            : { kind: outcome.kind },
      );
      try {
        await loadUser();
      } catch {
        await reloadDrafts();
      }
      return outcome;
    },
    [backend, library, loadUser, reloadDrafts],
  );

  const keepMyVersion = useCallback(
    (draft: WorkoutDraft) =>
      submit({
        ...draft,
        state: 'open',
        rejectReason: null,
        baseRevision: draft.serverRevision,
        serverRevision: null,
      }),
    [submit],
  );

  const setStartWeight = useCallback(
    async (exerciseId: string, weightKg: number | null) => {
      if (!rows) throw new BackendError('not_signed_in');
      const next = await backend.setStartWeight(exerciseId, weightKg, rows);
      setRows(next);
      refreshPending();
      return next;
    },
    [backend, refreshPending, rows],
  );

  // --- Woche, Verlauf, Export (Etappe D) -------------------------------------------------------------------
  const loadOlderLogs = useCallback(async () => {
    const before = olderLogs ? olderLogs.nextBefore : backend.logHistoryStart();
    if (before === null) return;
    const page = await backend.loadOlderLogs(before);
    setOlderLogs((current) => ({
      logs: mergeLogRows(current?.logs ?? EMPTY_LOG_ROWS, page.logs),
      nextBefore: page.nextBefore,
    }));
  }, [backend, olderLogs]);

  const deleteLog = useCallback(
    async (logId: string, revision: number) => {
      const result = await backend.deleteSessionLog(logId, revision);
      if (result === 'ok') {
        setOlderLogs((current) =>
          current ? { ...current, logs: removeSessionLog(current.logs, logId) } : current,
        );
      }
      // Auch beim Konflikt neu laden: Der Eintrag wurde auf einem anderen Gerät geändert.
      await loadUser().catch(() => undefined);
      return result;
    },
    [backend, loadUser],
  );

  const exportData = useCallback(() => backend.exportMyData(), [backend]);

  const discardForeignData = useCallback(async () => {
    await backend.discardForeignDeviceData();
    setForeignData(false);
    await loadUser().catch(() => undefined);
  }, [backend, loadUser]);

  const ensureLibrary = useCallback(async () => {
    if (library.kind === 'loading' || library.kind === 'ready') return;
    setLibrary({ kind: 'loading' });
    try {
      const loaded = await backend.loadPlanLibrary({ allowCached: true });
      setLibrary(loaded ? { kind: 'ready', library: loaded } : { kind: 'missing' });
    } catch {
      setLibrary({ kind: 'missing' });
    }
  }, [backend, library.kind]);

  const safetyRules = useMemo(() => {
    if (!rows) return null;
    // Offline fehlen die Gesundheits-Checks (nie auf dem Gerät) → zuletzt wirksame Regeln aus dem geschützten
    // Zwischenspeicher; sonst aus Check + Alter heute berechnet.
    return cachedRules ?? effectiveSafetyRules(rows, versions, todayIso());
  }, [cachedRules, rows, versions]);

  /**
   * Wettkampfplan speichern: Ziel-Distanz (falls anders), save_competition mit Plan-Bezug, save_training_plan. Liefert
   * die neuen Zeilen; Fehler werfen. Schlägt der zweite Aufruf fehl, bleibt der Wettkampf mit Plan-Bezug stehen
   * (harmlos – beim nächsten Versuch überschrieben, WP3 „Offen für WP4“).
   */
  const saveCompetitionPlan = useCallback(
    async (
      current: UserRows,
      build: { competition: SaveCompetitionPayload; goalDisciplineChange: boolean },
      plan: GeneratedPlan,
    ): Promise<UserRows> => {
      let next = current;
      if (build.goalDisciplineChange) {
        next = await backend.saveStep(
          {
            step: 'goal',
            goal: {
              goalType: 'endurance',
              // Nebenziel (Etappe Z3) bleibt, solange es zum Hauptziel Ausdauer passt.
              secondaryGoalType:
                answers.goal?.secondaryGoalType != null &&
                isAllowedGoalPair('endurance', answers.goal.secondaryGoalType)
                  ? answers.goal.secondaryGoalType
                  : null,
              discipline: build.competition.discipline,
              targetDate: build.competition.race_date,
            },
          },
          { answers, rows: next, versions },
        );
      }
      next = await backend.saveCompetition(build.competition, next);
      return backend.savePlan(toSavePlanPayload(plan), next);
    },
    [answers, backend, versions],
  );

  const createPlan = useCallback(async (): Promise<CreatePlanOutcome> => {
    if (!rows) return { ok: false, code: 'not_signed_in' };
    try {
      // Erzeugen braucht die vollständige Bibliothek (Vorlagen) – offline nicht möglich.
      const loaded = await backend.loadPlanLibrary({ allowCached: false });
      if (!loaded) return { ok: false, code: 'network' };
      setLibrary({ kind: 'ready', library: loaded });
      const today = todayIso();
      // Geplanter Wettkampf MIT Plan-Bezug und passender Distanz → wieder ein Wettkampfplan (Ampel neu gerechnet).
      const planned = plannedCompetition(rows);
      let withoutCompetition: 'not_feasible' | 'not_possible' | null = null;
      if (
        planned &&
        planned.stored.effectiveGoal !== null &&
        rows.goals?.goal_type === 'endurance' &&
        rows.goals.discipline === planned.stored.competition.discipline
      ) {
        const build = buildCompetitionPlan(
          rows,
          versions,
          activePlan(rows),
          loaded,
          draftFromStored(planned.stored),
          planned.stored.id,
          today,
        );
        if (typeof build !== 'string' && build.result.ok) {
          if (!generatedCompetitionPlanSchema.safeParse(build.result.plan).success) {
            return { ok: false, code: 'invalid_inputs' };
          }
          const next = await saveCompetitionPlan(rows, build, build.result.plan);
          setRows(next);
          setPlanMessage(null);
          refreshPending();
          return { ok: true, plan: build.result.plan };
        }
        // Ampel rot bzw. nicht möglich: nie stauchen – Grundlagen-Plan mit Hinweis. Eigener Text, wenn gar keine Ampel
        // möglich war (Renntag vorbei, Angaben ungültig – Wächter N4).
        withoutCompetition =
          typeof build !== 'string' &&
          !build.result.ok &&
          build.result.error === 'competition_not_feasible'
            ? 'not_feasible'
            : 'not_possible';
      }
      const result = generatePlanFromRows(rows, versions, loaded, today);
      if (!result.ok) {
        return {
          ok: false,
          code: result.error === 'no_template' ? 'no_template' : result.error,
        };
      }
      // Zod an der Grenze: Datenbank-Grenzen prüfen, bevor gespeichert wird.
      if (!generatedPlanSchema.safeParse(result.plan).success) {
        return { ok: false, code: 'invalid_inputs' };
      }
      const next = await backend.savePlan(toSavePlanPayload(result.plan), rows);
      setRows(next);
      setPlanMessage(null);
      refreshPending();
      return withoutCompetition !== null
        ? { ok: true, plan: result.plan, withoutCompetition }
        : { ok: true, plan: result.plan };
    } catch (error) {
      return { ok: false, code: errorCode(error) };
    }
  }, [backend, refreshPending, rows, saveCompetitionPlan, versions]);

  const createCompetitionPlan = useCallback(
    async (
      draft: CompetitionDraft,
      competitionId: string | null,
    ): Promise<CompetitionPlanOutcome> => {
      if (!rows) return { ok: false, kind: 'error', error: new BackendError('not_signed_in') };
      try {
        const loaded = await backend.loadPlanLibrary({ allowCached: false });
        if (!loaded) return { ok: false, kind: 'error', error: new BackendError('online_only') };
        setLibrary({ kind: 'ready', library: loaded });
        const build = buildCompetitionPlan(
          rows,
          versions,
          activePlan(rows),
          loaded,
          draft,
          competitionId,
          todayIso(),
        );
        if (typeof build === 'string') return { ok: false, kind: 'blocked', blocker: build };
        const result = build.result;
        if (!result.ok) {
          if (result.error === 'competition_not_feasible') {
            return { ok: false, kind: 'not_feasible', feasibility: result.feasibility };
          }
          return { ok: false, kind: 'blocked', blocker: result.error };
        }
        // Zod an der Grenze: Wettkampf-Grenzen (Anstrengung 1–8 nur mit harter Art usw.) vor dem Senden.
        if (!generatedCompetitionPlanSchema.safeParse(result.plan).success) {
          return { ok: false, kind: 'blocked', blocker: 'invalid_inputs' };
        }
        const next = await saveCompetitionPlan(rows, build, result.plan);
        setRows(next);
        setPlanMessage(null);
        refreshPending();
        return { ok: true, plan: result.plan };
      } catch (error) {
        // Stand neu laden (z. B. Wettkampf gespeichert, Plan abgelehnt) – die Anzeige zeigt nie Veraltetes.
        await loadUser().catch(() => undefined);
        return { ok: false, kind: 'error', error };
      }
    },
    [backend, loadUser, refreshPending, rows, saveCompetitionPlan, versions],
  );

  const competitionWrite = useCallback(
    async (run: (current: UserRows) => Promise<UserRows>) => {
      if (!rows) throw new BackendError('not_signed_in');
      try {
        setRows(await run(rows));
      } catch (error) {
        await loadUser().catch(() => undefined);
        throw error;
      }
    },
    [loadUser, rows],
  );
  const saveCompetition = useCallback(
    (payload: SaveCompetitionPayload) =>
      competitionWrite((current) => backend.saveCompetition(payload, current)),
    [backend, competitionWrite],
  );
  const cancelCompetition = useCallback(
    (id: string) => competitionWrite((current) => backend.cancelCompetition(id, current)),
    [backend, competitionWrite],
  );
  const completeCompetition = useCallback(
    (id: string, sessionLogId: string | null) =>
      competitionWrite((current) => backend.completeCompetition(id, sessionLogId, current)),
    [backend, competitionWrite],
  );
  const deleteCompetition = useCallback(
    (id: string) => competitionWrite((current) => backend.deleteCompetition(id, current)),
    [backend, competitionWrite],
  );

  const moveSession = useCallback(
    async (sessionId: string): Promise<RescheduleResult> => {
      if (!rows) throw new BackendError('not_signed_in');
      const active = activePlan(rows);
      const result = rescheduleInRows(rows, sessionId, todayIso());
      if (!active || result.kind === 'not_allowed') return result;
      const session = rows.plannedSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: 'not_allowed', reason: 'not_found' };
      const next = await backend.updatePlannedSession(
        {
          sessionId,
          planId: active.plan.id,
          usesHealthData: active.plan.uses_health_data,
          scheduledOn: result.kind === 'moved' ? result.date : session.scheduled_on,
          status: result.kind === 'moved' ? 'planned' : 'skipped',
        },
        rows,
      );
      setRows(next);
      refreshPending();
      return result;
    },
    [backend, refreshPending, rows],
  );

  const moveSessionTo = useCallback(
    async (sessionId: string, targetDate: string): Promise<MoveOutcome> => {
      if (!rows) throw new BackendError('not_signed_in');
      const request = moveRequestSchema.safeParse({ sessionId, targetDate });
      if (!request.success) return { kind: 'blocked', reason: 'not_found' };
      const active = activePlan(rows);
      const session = rows.plannedSessions.find((s) => s.id === sessionId);
      if (!active || !session) return { kind: 'blocked', reason: 'not_found' };
      // Harte Sperren aus dem Core – vor jedem Senden (auch offline).
      const check = validateMoveInRows(rows, sessionId, targetDate, todayIso());
      if (!check.ok) return { kind: 'blocked', reason: check.reason };
      const from = session.scheduled_on;
      // Nach JEDEM Fehler (abgelehnt, veraltet, Netz, Zeitlimit) den Plan neu laden – so zeigt der Kalender nie einen
      // veralteten Stand und bietet keinen unmöglichen Tausch erneut an (Wächter A1a S1/S2). Der Fehler geht weiter an
      // den Bildschirm.
      const reloadAfter = async (error: unknown): Promise<never> => {
        await loadUser().catch(() => undefined);
        throw error;
      };
      if (check.kind === 'swap') {
        const swap = swapRequestSchema.parse({
          sessionId,
          otherSessionId: check.otherSessionId,
          sessionOn: from,
          otherSessionOn: targetDate,
        });
        const next = await backend
          .swapPlannedSessions(
            {
              ...swap,
              planId: active.plan.id,
              usesHealthData: active.plan.uses_health_data,
            },
            rows,
          )
          .catch(reloadAfter);
        setRows(next);
        refreshPending();
        return {
          kind: 'swapped',
          sessionId,
          otherSessionId: check.otherSessionId,
          from,
          to: targetDate,
        };
      }
      const next = await backend
        .updatePlannedSession(
          {
            sessionId,
            planId: active.plan.id,
            usesHealthData: active.plan.uses_health_data,
            scheduledOn: request.data.targetDate,
            status: 'planned',
          },
          rows,
        )
        .catch(reloadAfter);
      setRows(next);
      refreshPending();
      return { kind: 'moved', sessionId, from, to: targetDate };
    },
    [backend, loadUser, refreshPending, rows],
  );

  const appendNextBlockIfDue = useCallback(async () => {
    if (!rows || offline || appendingRef.current || library.kind !== 'ready' || !safetyRules) {
      return;
    }
    const active = activePlan(rows);
    const today = todayIso();
    if (
      !active ||
      appendFailedRef.current === active.plan.id ||
      followUpBlockState(active.sessions, today) !== 'due'
    ) {
      return;
    }
    // Wettkampfplan (WP4): Folgeblock aus dem gespeicherten Wettkampf (Makrozyklus neu gerechnet). Endet der Zyklus
    // bzw. passt der Wettkampf nicht mehr → „Plan neu erstellen“ statt eines Grundlagen-Blocks von der Spitze aus.
    const competition = competitionFollowUpFromRows(
      rows,
      versions,
      active,
      safetyRules,
      library.library,
      today,
    );
    if (competition.kind === 'ended') {
      appendFailedRef.current = active.plan.id;
      setPlanMessage(
        competition.reason === 'unreachable'
          ? COMPETITION_GOAL_UNREACHABLE
          : COMPETITION_PLAN_ENDED,
      );
      return;
    }
    if (competition.kind === 'none') return;
    const sessions =
      competition.kind === 'block'
        ? competition.sessions
        : nextBlockFromRows(rows, active, safetyRules, library.library, today);
    if (!sessions) return;
    appendingRef.current = true;
    try {
      setRows(
        await backend.appendPlanBlock(active.plan.id, active.plan.uses_health_data, sessions, rows),
      );
    } catch {
      // Abgelehnt (z. B. Gesundheits-Check geändert, inzwischen angehängt) oder offline: neu laden. Ist der
      // Folgeblock danach weiter fällig, nicht endlos erneut versuchen, sondern „Plan neu erstellen“ melden.
      appendFailedRef.current = active.plan.id;
      try {
        const fresh = await loadUser();
        const reloaded = activePlan(fresh);
        if (reloaded && followUpBlockState(reloaded.sessions, today) === 'due') {
          setPlanMessage(PLAN_RECREATE_NEEDED);
        }
      } catch {
        // offline – der Hinweis „Offline“ steht schon auf „Heute“.
      }
    } finally {
      appendingRef.current = false;
    }
  }, [backend, library, loadUser, offline, rows, safetyRules, versions]);

  /** Day-Swaps des Kontos vom Gerät entfernen (Abmelden, Konto löschen). */
  const forgetDaySwaps = useCallback(async () => {
    const owner = rows?.profile?.user_id ?? session?.userId;
    if (owner) await daySwapStore.removeOwner(owner).catch(() => undefined);
  }, [daySwapStore, rows, session]);

  const deleteAccount = useCallback(async () => {
    await backend.deleteAccount();
    await forgetDaySwaps();
    // Etappe E: alle geplanten Benachrichtigungen stornieren, Geräte-Einstellung zurücksetzen.
    await appNotifications.reset().catch(() => undefined);
    resetUser();
  }, [backend, forgetDaySwaps, resetUser]);

  const pendingCount = useCallback(async () => {
    const pending = await backend.pendingWorkouts();
    // Ernährungs-Warteschlange (N7 Teil 2): wartende und abgelehnte Tagebuch-Einträge/eigene Gerichte gingen beim
    // Abmelden verloren – deshalb mitgezählt (R6).
    const nutrition = await backend.nutritionSync().catch(() => ({ queued: 0, rejected: 0 }));
    return pending.queued + pending.drafts + nutrition.queued + nutrition.rejected;
  }, [backend]);

  const signOut = useCallback(
    async (force = false): Promise<SignOutResult> => {
      if (!force) {
        const count = await pendingCount();
        if (count > 0) return { kind: 'pending', count };
      }
      await backend.signOut();
      await forgetDaySwaps();
      await appNotifications.reset().catch(() => undefined);
      resetUser();
      return { kind: 'signed_out' };
    },
    [backend, forgetDaySwaps, pendingCount, resetUser],
  );

  const sendPending = useCallback(async () => {
    await backend.flush();
    refreshPending();
    await reloadDrafts();
    return pendingCount();
  }, [backend, pendingCount, refreshPending, reloadDrafts]);

  const clearDeviceData = useCallback(async () => {
    await backend.clearDeviceData();
    await appNotifications.reset().catch(() => undefined);
    setPendingBirthDateState(null);
    resetUser();
  }, [backend, resetUser]);

  const value = useMemo<AppContextValue>(
    () => ({
      backend,
      status,
      invalidConfig: supabaseConfig.status === 'invalid',
      documents,
      versions,
      session,
      rows,
      answers,
      pendingBirthDate,
      offline,
      pendingChanges,
      reload,
      entryRoute,
      setPendingBirthDate,
      completeSignIn,
      createProfile,
      grantConsents,
      revokeConsent,
      saveStep,
      saveReminder,
      deleteAccount,
      signOut,
      sendPending,
      clearDeviceData,
      library,
      ensureLibrary,
      safetyRules,
      planMessage,
      clearPlanMessage: () => setPlanMessage(null),
      createPlan,
      createCompetitionPlan,
      saveCompetition,
      cancelCompetition,
      completeCompetition,
      deleteCompetition,
      moveSession,
      moveSessionTo,
      appendNextBlockIfDue,
      drafts,
      saveDraft,
      discardDraft,
      submitWorkout: submit,
      keepMyVersion,
      setStartWeight,
      revokeHealthData,
      deleteStoredIntolerances,
      workoutMessage,
      clearWorkoutMessage: () => setWorkoutMessage(null),
      pendingLogSessionIds,
      foreignData,
      discardForeignData,
      sessionExpired,
      olderLogs,
      loadOlderLogs,
      deleteLog,
      exportData,
      daySwaps,
      addDaySwap,
      removeDaySwaps,
      dropDaySwaps,
      updateExercisePreferences,
      nutritionLibrary,
      ensureNutritionLibrary,
      setNutritionDemo,
      saveMealPlan,
      persistMealPlan,
      mealPlanSaveFailed,
      mealPlanSaveConsentMissing,
      nutritionSync,
      discardRejectedNutrition,
      retryMealPlanSave,
      mealPlanSaveAttempt,
      saveShoppingList,
      saveCookDayStart,
      saveRecipeRating,
      deleteRecipeRatings,
      saveFoodDislikes,
      saveFoodLogEntries,
      deleteFoodLogEntry,
      changeFoodLogFavorite,
      saveCustomMeal,
      deleteCustomMeal,
      saveUserFoodProduct,
      deleteUserFoodProduct,
    }),
    [
      backend,
      status,
      documents,
      versions,
      session,
      rows,
      answers,
      pendingBirthDate,
      offline,
      pendingChanges,
      reload,
      entryRoute,
      setPendingBirthDate,
      completeSignIn,
      createProfile,
      grantConsents,
      revokeConsent,
      saveStep,
      saveReminder,
      deleteAccount,
      signOut,
      sendPending,
      clearDeviceData,
      library,
      ensureLibrary,
      safetyRules,
      planMessage,
      createPlan,
      createCompetitionPlan,
      saveCompetition,
      cancelCompetition,
      completeCompetition,
      deleteCompetition,
      moveSession,
      moveSessionTo,
      appendNextBlockIfDue,
      drafts,
      saveDraft,
      discardDraft,
      submit,
      keepMyVersion,
      setStartWeight,
      revokeHealthData,
      deleteStoredIntolerances,
      workoutMessage,
      pendingLogSessionIds,
      foreignData,
      discardForeignData,
      sessionExpired,
      olderLogs,
      loadOlderLogs,
      deleteLog,
      exportData,
      daySwaps,
      addDaySwap,
      removeDaySwaps,
      dropDaySwaps,
      updateExercisePreferences,
      nutritionLibrary,
      ensureNutritionLibrary,
      setNutritionDemo,
      saveMealPlan,
      persistMealPlan,
      mealPlanSaveFailed,
      mealPlanSaveConsentMissing,
      nutritionSync,
      discardRejectedNutrition,
      retryMealPlanSave,
      mealPlanSaveAttempt,
      saveShoppingList,
      saveCookDayStart,
      saveRecipeRating,
      deleteRecipeRatings,
      saveFoodDislikes,
      saveFoodLogEntries,
      deleteFoodLogEntry,
      changeFoodLogFavorite,
      saveCustomMeal,
      deleteCustomMeal,
      saveUserFoodProduct,
      deleteUserFoodProduct,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp() nur innerhalb von <AppStateProvider> verwenden.');
  }
  return value;
}

/** Fehlende Pflicht-Einwilligungen werden immer gemeinsam erteilt (terms + privacy). */
export const BASE_CONSENT_TYPES = REQUIRED_CONSENT_TYPES;
