import {
  addDays,
  ageInYears,
  HYDRATION,
  type HydrationEntry,
  type HydrationGoal,
  hydrationGoal,
  isoDateInTimeZone,
  trainingMinutesOfDay,
  type TrackedRouteRow,
} from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { newId } from '@/data/create-backend';
import { activitiesFromRows } from '@/data/endurance-rows';
import { HydrationError, hydrationBackendFor } from '@/data/hydration';
import type { UserRows } from '@/data/types';
import { useApp } from '@/state/app-state';

/**
 * Trinken-Tracker (25.10.2026): Einträge der letzten Tage laden, schnell eintragen, letzten zurücknehmen; Ziel aus
 * packages/core (hydrationGoal) mit Gewicht, Alter, Trainingsminuten und Wärme des Tages. Alle offenen Ansichten
 * folgen einer Änderung.
 */

export type HydrationState =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: HydrationEntry[]; offline: boolean }
  | { kind: 'error' }
  | { kind: 'unsupported' };

const listeners = new Set<() => void>();

/** Ziel-Eingaben aus den Zeilen der App (nur Zusammensetzen). */
export function hydrationGoalFromRows(
  rows: UserRows,
  today: string,
  options: { routes: readonly Pick<TrackedRouteRow, 'started_at' | 'weather'>[]; kidney: boolean },
): HydrationGoal {
  const weight =
    [...rows.bodyMetrics]
      .filter((m) => m.weight_kg !== null && m.measured_on <= today)
      .sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0]?.weight_kg ?? null;
  const birth = rows.profile?.birth_date ?? null;
  const screening = [...rows.healthScreenings].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const answers = (screening?.answers ?? {}) as Record<string, unknown>;
  const activities = activitiesFromRows(rows, [], []);
  const strength = rows.sessionLogs
    .filter((l) => l.kind === 'strength' && l.started_at && l.finished_at)
    .map((l) => ({
      day: l.performed_on,
      durationS: (Date.parse(l.finished_at as string) - Date.parse(l.started_at as string)) / 1000,
    }));
  const minutes = trainingMinutesOfDay(
    [...activities.map((a) => ({ day: a.day, durationS: a.movingS })), ...strength],
    today,
  );
  const temps = options.routes
    .filter((r) => r.weather && isoDateInTimeZone(r.started_at) === today)
    .map((r) => r.weather?.temp_c ?? null)
    .filter((t): t is number => t !== null);
  return hydrationGoal({
    weightKg: weight,
    ageYears: birth ? ageInYears(birth, today) : null,
    trainingMinutes: minutes,
    maxTempC: temps.length > 0 ? Math.max(...temps) : null,
    medicalRestriction: answers.heart_condition === true || options.kidney,
  });
}

export function useHydration(today: string): {
  state: HydrationState;
  add: (amountMl: number) => Promise<'saved' | 'queued'>;
  undoLast: () => Promise<boolean>;
  reload: () => Promise<void>;
} {
  const app = useApp();
  const hydration = hydrationBackendFor(app.backend);
  const [state, setState] = useState<HydrationState>(
    hydration ? { kind: 'loading' } : { kind: 'unsupported' },
  );
  const from = useMemo(() => addDays(today, -(HYDRATION.historyDays - 1)), [today]);
  const reload = useCallback(async () => {
    if (!hydration || !app.session) return;
    try {
      const result = await hydration.load(from, today);
      setState({ kind: 'ready', entries: result.entries, offline: result.offline });
    } catch {
      setState((s) => (s.kind === 'ready' ? s : { kind: 'error' }));
    }
  }, [app.session, from, hydration, today]);
  useEffect(() => {
    const l = () => void reload();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [reload]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const notify = () => {
    for (const l of listeners) l();
  };
  const add = useCallback(
    async (amountMl: number) => {
      if (!hydration) throw new HydrationError('unknown');
      const result = await hydration.add({ id: newId(), day: today, amount_ml: amountMl });
      notify();
      return result;
    },
    [hydration, today],
  );
  const undoLast = useCallback(async () => {
    if (!hydration || state.kind !== 'ready') return false;
    const last = state.entries.filter((e) => e.day === today).at(-1);
    if (!last) return false;
    await hydration.remove(last.id);
    notify();
    return true;
  }, [hydration, state, today]);
  return { state, add, undoLast, reload };
}
