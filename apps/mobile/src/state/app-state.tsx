import {
  type DataExportFile,
  type DaySwap,
  followUpBlockState,
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
  type PreferenceSwapContext,
} from '@/data/backend';
import { createBackend, deviceStore, newId } from '@/data/create-backend';
import { createDaySwapStore, prunedDaySwaps, withoutHealthPlanSwaps } from '@/data/day-swaps';
import type { FavoriteChange } from '@/data/food-log-rows';
import {
  draftToPayload,
  isValidPayload,
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
import { todayIso } from '@/lib/format';
import { supabaseConfig } from '@/lib/supabase';

import { resolveEntryRoute, type EntryRoute } from './flow';

/**
 * Zentraler App-Zustand: Betriebsart, Sitzung, Einwilligungstexte und die Zeilen des Nutzers.
 * Enthält keine Fachlogik – Regeln kommen aus packages/core (über flow.ts, mapping.ts und das Backend).
 * Gesundheitsdaten liegen hier nur im Arbeitsspeicher; dauerhaft gespeichert wird nur über das Backend.
 */

type LoadStatus =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: BackendErrorCode };

/** Ergebnis von „Plan erstellen“ (Fehler als fester Code, Texte in i18n). */
export type CreatePlanOutcome =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; code: BackendErrorCode | 'incomplete' | 'invalid_inputs' };

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
  /** Plan nach den aktuellen Angaben erzeugen und speichern (ersetzt den aktiven Plan). */
  createPlan: () => Promise<CreatePlanOutcome>;
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

/** Ergebnis von moveSessionTo (Kalender, Etappe A1a). */
export type MoveOutcome =
  | { kind: 'moved'; sessionId: string; from: string; to: string }
  | { kind: 'swapped'; sessionId: string; otherSessionId: string; from: string; to: string }
  | { kind: 'blocked'; reason: MoveBlockReason };
/** Meldung: Folgeblock ließ sich nicht anhängen → Plan neu erstellen. */
export const PLAN_RECREATE_NEEDED = 'plan_recreate_needed' as const;

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
  }, [backend]);

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
      await backend.revokeConsent(type);
      await loadUser();
    },
    [backend, loadUser],
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
      } catch {
        // Ohne Details (Gesundheitsdaten); der angezeigte Plan bleibt der nach den aktuellen Angaben.
        setMealPlanSaveFailed(true);
      }
    },
    [backend, rows],
  );

  const retryMealPlanSave = useCallback(() => {
    persistedMealPlansRef.current.clear();
    setMealPlanSaveFailed(false);
    setMealPlanSaveAttempt((n) => n + 1);
  }, []);

  const saveShoppingList = useCallback(
    async (list: StoredShoppingList) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveShoppingList(list, rows));
    },
    [backend, rows],
  );

  const saveCookDayStart = useCallback(
    async (weekStart: string, startedAt: string | null) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.saveCookDayStart(weekStart, startedAt, rows));
    },
    [backend, rows],
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
      setRows(await backend.saveFoodLogEntries(entries, rows));
    },
    [backend, rows],
  );

  const deleteFoodLogEntry = useCallback(
    async (id: string) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.deleteFoodLogEntry(id, rows));
    },
    [backend, rows],
  );

  const changeFoodLogFavorite = useCallback(
    async (change: FavoriteChange) => {
      if (!rows) {
        throw new BackendError('not_signed_in');
      }
      setRows(await backend.changeFoodLogFavorite(change, rows));
    },
    [backend, rows],
  );

  const revokeHealthData = useCallback(
    async (deleteLogs: boolean, convertIntolerances: boolean) => {
      // Day-Swaps zu Plänen mit Gesundheitsbezug mit entfernen (wie die Entwürfe, PLAN-UEBUNGEN-GLOSSAR-TAUSCH 9).
      const owner = rows?.profile?.user_id;
      if (rows && owner) {
        const kept = withoutHealthPlanSwaps(rows, await daySwapStore.load(owner));
        await daySwapStore.save(owner, kept);
        setDaySwaps(kept);
      }
      // 7.4 (R2-K4): Die Unverträglichkeiten werden nur bei aktiver Zustimmung an das Backend gegeben (Arbeitsspeicher).
      await backend.revokeHealthData(deleteLogs, convertIntolerances && rows ? { rows } : null);
      await loadUser();
    },
    [backend, daySwapStore, loadUser, rows],
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
    async (draft: WorkoutDraft): Promise<LogSaveOutcome | { kind: 'invalid' }> => {
      const payload = draftToPayload(draft, { writeId: newId(), now: new Date().toISOString() });
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
    [backend, loadUser, reloadDrafts],
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

  const createPlan = useCallback(async (): Promise<CreatePlanOutcome> => {
    if (!rows) return { ok: false, code: 'not_signed_in' };
    try {
      // Erzeugen braucht die vollständige Bibliothek (Vorlagen) – offline nicht möglich.
      const loaded = await backend.loadPlanLibrary({ allowCached: false });
      if (!loaded) return { ok: false, code: 'network' };
      setLibrary({ kind: 'ready', library: loaded });
      const result = generatePlanFromRows(rows, versions, loaded, todayIso());
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
      return { ok: true, plan: result.plan };
    } catch (error) {
      return { ok: false, code: errorCode(error) };
    }
  }, [backend, refreshPending, rows, versions]);

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
    const sessions = nextBlockFromRows(rows, active, safetyRules, library.library, today);
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
  }, [backend, library, loadUser, offline, rows, safetyRules]);

  /** Day-Swaps des Kontos vom Gerät entfernen (Abmelden, Konto löschen). */
  const forgetDaySwaps = useCallback(async () => {
    const owner = rows?.profile?.user_id ?? session?.userId;
    if (owner) await daySwapStore.removeOwner(owner).catch(() => undefined);
  }, [daySwapStore, rows, session]);

  const deleteAccount = useCallback(async () => {
    await backend.deleteAccount();
    await forgetDaySwaps();
    resetUser();
  }, [backend, forgetDaySwaps, resetUser]);

  const pendingCount = useCallback(async () => {
    const pending = await backend.pendingWorkouts();
    return pending.queued + pending.drafts;
  }, [backend]);

  const signOut = useCallback(
    async (force = false): Promise<SignOutResult> => {
      if (!force) {
        const count = await pendingCount();
        if (count > 0) return { kind: 'pending', count };
      }
      await backend.signOut();
      await forgetDaySwaps();
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
