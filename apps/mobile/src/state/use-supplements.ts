import {
  buildSupplementInputs,
  EMPTY_SUPPLEMENT_USER_DATA,
  hasSupplementConsent,
  recommendSupplements,
  type RatedSupplementId,
  type SupplementContent,
  type SupplementRecommendations,
  type SupplementScreeningAnswers,
  type SupplementUserData,
  type UserSupplementStatus,
} from '@fitnessapp/core';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { type Backend, errorCode, type SupplementLibraryResult } from '@/data/backend';
import { supplementSourceFromRows } from '@/data/supplement-library';
import { useToday } from '@/lib/use-today';

import { useApp } from './app-state';
import { healthConsentStatus } from './flow';

/**
 * Supplement-Bereich für die Bildschirme (docs/PLAN-PHASE-6.md 8): Inhalte einmal je Backend laden, Nutzerdaten
 * (Supplement-Check, „Meine Supplements“) NUR im Arbeitsspeicher halten (Gesundheitsdaten – nie im Gerätespeicher des
 * Supabase-Modus), Einordnung mit den Regeln aus packages/core. Eigene Datei statt app-state.tsx.
 */

export type SupplementLibraryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | ({ readonly kind: 'ready' } & SupplementLibraryResult);

const libraryCache = new WeakMap<Backend, Promise<SupplementLibraryResult>>();

export function useSupplementLibrary(): SupplementLibraryState & { retry: () => void } {
  const { backend } = useApp();
  const [state, setState] = useState<SupplementLibraryState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let pending = libraryCache.get(backend);
    if (!pending) {
      pending = backend.loadSupplementLibrary();
      libraryCache.set(backend, pending);
    }
    pending.then(
      (result) => {
        if (alive) setState({ kind: 'ready', ...result });
      },
      () => {
        libraryCache.delete(backend);
        if (alive) setState({ kind: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, [backend, attempt]);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}

export type SupplementUserState =
  | { readonly kind: 'loading' }
  /** Nicht nötig (keine gültige Einwilligung Fassung 2) – nichts geladen. */
  | { readonly kind: 'skipped' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly data: SupplementUserData };

/** Gemeinsamer Stand im Arbeitsspeicher (Übersicht, Check und Detail sehen dieselben Daten). */
interface UserStore {
  owner: string | null;
  backend: Backend | null;
  state: SupplementUserState;
  listeners: Set<() => void>;
}
const userStore: UserStore = {
  owner: null,
  backend: null,
  state: { kind: 'loading' },
  listeners: new Set(),
};

function setUserState(state: SupplementUserState): void {
  userStore.state = state;
  for (const listener of userStore.listeners) listener();
}

function subscribe(listener: () => void): () => void {
  userStore.listeners.add(listener);
  return () => userStore.listeners.delete(listener);
}

/** Nur für Tests: Stand im Arbeitsspeicher zurücksetzen. */
export function resetSupplementUserStore(): void {
  userStore.owner = null;
  userStore.backend = null;
  setUserState({ kind: 'loading' });
}

/** Fassung der Einwilligung reicht für den Supplement-Check (gültig UND Fassung ≥ 2)? */
export type SupplementConsentState = 'ok' | 'none' | 'outdated' | 'pending';

export interface SupplementsView {
  readonly consent: SupplementConsentState;
  readonly user: SupplementUserState;
  readonly data: SupplementUserData;
  /** null = Angaben unvollständig (Onboarding nicht fertig) bzw. Regeln nicht berechenbar. */
  readonly recommendations: SupplementRecommendations | null;
  readonly rulesFailed: boolean;
  /** Gewicht nur mit gültiger Einwilligung (Koffein-Grenze). */
  readonly weightKg: number | null;
  readonly hasHealthCheck: boolean;
  readonly reloadUser: () => void;
  readonly saveScreening: (answers: SupplementScreeningAnswers) => Promise<void>;
  readonly setChoice: (id: RatedSupplementId, status: UserSupplementStatus | null) => Promise<void>;
  readonly deleteAll: () => Promise<void>;
}

export function useSupplements(): SupplementsView {
  const app = useApp();
  const today = useToday();
  const { backend, rows, versions, session } = app;
  const owner = session?.userId ?? null;
  const status = rows ? healthConsentStatus(rows, versions) : 'none';
  const consent: SupplementConsentState =
    status === 'outdated'
      ? 'outdated'
      : status === 'none'
        ? 'none'
        : hasSupplementConsent(versions.health_data)
          ? 'ok'
          : 'pending';
  const user = useSyncExternalStore(subscribe, () => userStore.state);

  const load = useCallback(() => {
    if (consent !== 'ok' || owner === null) {
      setUserState({ kind: 'skipped' });
      return;
    }
    setUserState({ kind: 'loading' });
    backend.loadSupplementUserData().then(
      (data) => {
        if (userStore.owner === owner) setUserState({ kind: 'ready', data });
      },
      (error: unknown) => {
        if (userStore.owner !== owner) return;
        setUserState({ kind: errorCode(error) === 'network' ? 'offline' : 'error' });
      },
    );
  }, [backend, consent, owner]);

  useEffect(() => {
    // Neues Konto, anderes Backend oder Einwilligung geändert → neu laden (alter Stand nie anzeigen).
    const changed = userStore.owner !== owner || userStore.backend !== backend;
    userStore.owner = owner;
    userStore.backend = backend;
    if (changed || consent !== 'ok' || userStore.state.kind === 'skipped') load();
  }, [backend, consent, load, owner]);

  const data = user.kind === 'ready' ? user.data : EMPTY_SUPPLEMENT_USER_DATA;
  const computed = useMemo(() => {
    if (!rows) return { recommendations: null, rulesFailed: false, weightKg: null };
    const source = supplementSourceFromRows(rows, versions, today, data.screening);
    if (!source) return { recommendations: null, rulesFailed: false, weightKg: null };
    try {
      const inputs = buildSupplementInputs(source);
      return {
        recommendations: recommendSupplements(inputs),
        rulesFailed: false,
        weightKg: inputs.weightKg,
      };
    } catch {
      return { recommendations: null, rulesFailed: true, weightKg: null };
    }
  }, [rows, versions, today, data.screening]);

  const run = useCallback(async (action: () => Promise<SupplementUserData>) => {
    const next = await action();
    setUserState({ kind: 'ready', data: next });
  }, []);

  return {
    consent,
    user,
    data,
    ...computed,
    hasHealthCheck: (rows?.healthScreenings.length ?? 0) > 0,
    reloadUser: load,
    saveScreening: (answers) => run(() => backend.saveSupplementScreening(answers)),
    setChoice: (id, choice) => run(() => backend.setUserSupplement(id, choice)),
    deleteAll: () => run(() => backend.deleteSupplementData()),
  };
}

/** Inhalte nach ID (für Detailseiten). */
export function supplementEntries(state: SupplementLibraryState): readonly SupplementContent[] {
  return state.kind === 'ready' ? state.entries : [];
}
