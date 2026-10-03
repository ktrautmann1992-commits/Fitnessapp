import { REQUIRED_CONSENT_TYPES, type ConsentType } from '@fitnessapp/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { BackendError, errorCode, type Backend, type BackendErrorCode } from '@/data/backend';
import { createBackend, deviceStore } from '@/data/create-backend';
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
import { supabaseConfig } from '@/lib/supabase';

import { resolveEntryRoute, type EntryRoute } from './flow';

/**
 * Zentraler App-Zustand: Betriebsart, Sitzung, Einwilligungstexte und die Zeilen des Nutzers.
 * Enthält keine Fachlogik – Regeln kommen aus packages/core (über flow.ts, mapping.ts und das Backend).
 * Gesundheitsdaten liegen hier nur im Arbeitsspeicher; dauerhaft gespeichert wird nur über das Backend.
 */

type LoadStatus =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: BackendErrorCode };

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
}

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

  const versions = useMemo(() => versionsFromDocuments(documents), [documents]);
  const answers = useMemo(() => (rows ? answersFromRows(rows) : {}), [rows]);

  const refreshPending = useCallback(() => {
    setPendingChanges(backend.pendingChanges());
  }, [backend]);

  const loadUser = useCallback(async (): Promise<UserRows> => {
    const result = await backend.loadRows();
    setRows(result.rows);
    setOffline(result.offline);
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
  }, []);

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
