import {
  followUpBlockState,
  type GeneratedPlan,
  type PlanLibrary,
  type PlanSafetyRules,
  REQUIRED_CONSENT_TYPES,
  type ConsentType,
  type RescheduleResult,
  toSavePlanPayload,
  generatedPlanSchema,
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

import { BackendError, errorCode, type Backend, type BackendErrorCode } from '@/data/backend';
import { createBackend, deviceStore } from '@/data/create-backend';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  nextBlockFromRows,
  rescheduleInRows,
} from '@/data/training-plan';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
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
  signOut: () => Promise<void>;
  clearDeviceData: () => Promise<void>;

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
  /** Folgeblock anhängen, wenn fällig (automatisch beim Anzeigen von „Heute“). */
  appendNextBlockIfDue: () => Promise<void>;
}

/** Meldung nach verworfener Verschiebung (Text in i18n, hier nur der Schlüssel). */
export const PLAN_CHANGE_DROPPED = 'plan_change_dropped' as const;
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
  const appendingRef = useRef(false);
  /** Plan, für den das Anhängen gescheitert ist (kein erneuter Versuch bis zum neuen Plan). */
  const appendFailedRef = useRef<string | null>(null);

  const versions = useMemo(() => versionsFromDocuments(documents), [documents]);
  const answers = useMemo(() => (rows ? answersFromRows(rows) : {}), [rows]);

  const refreshPending = useCallback(() => {
    setPendingChanges(backend.pendingChanges());
  }, [backend]);

  const loadUser = useCallback(async (): Promise<UserRows> => {
    const result = await backend.loadRows();
    setRows(result.rows);
    setOffline(result.offline);
    setCachedRules(result.offline ? (result.cachedSafetyRules ?? null) : null);
    refreshPending();
    return result.rows;
  }, [backend, refreshPending]);

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
  useEffect(() => {
    return backend.subscribe((event) => {
      if (event.kind === 'plan_change_dropped') {
        setPlanMessage(PLAN_CHANGE_DROPPED);
        void loadUser().catch(() => undefined);
      }
    });
  }, [backend, loadUser]);

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
      resolveEntryRoute({ session: current, rows: currentRows, versions }),
    [versions],
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
  }, []);

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

  const deleteAccount = useCallback(async () => {
    await backend.deleteAccount();
    resetUser();
  }, [backend, resetUser]);

  const signOut = useCallback(async () => {
    await backend.signOut();
    resetUser();
  }, [backend, resetUser]);

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
      clearDeviceData,
      library,
      ensureLibrary,
      safetyRules,
      planMessage,
      clearPlanMessage: () => setPlanMessage(null),
      createPlan,
      moveSession,
      appendNextBlockIfDue,
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
      clearDeviceData,
      library,
      ensureLibrary,
      safetyRules,
      planMessage,
      createPlan,
      moveSession,
      appendNextBlockIfDue,
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
