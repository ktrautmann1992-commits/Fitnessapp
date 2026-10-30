import type { DrinkProgress, HydrationEntry } from '@fitnessapp/core';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { hydrationBackendFor } from '@/data/hydration';
import {
  drinkProgressFor,
  shownHydrationGoal,
  subscribeHydrationGoal,
} from '@/lib/hydration-status';
import { useApp } from '@/state/app-state';
import { hydrationGoalFromRows, subscribeHydrationChanges } from '@/state/use-hydration';

/**
 * Trink-Tracker für die Erinnerungen (docs/PLAN-ERINNERUNGEN.md): heutige Menge und Tagesziel, damit die restlichen
 * Trink-Erinnerungen entfallen, sobald das Ziel erreicht ist. Lädt neu bei Tageswechsel, Rückkehr in die App (`wake`)
 * und bei jedem Eintrag bzw. Zurücknehmen. Ziel wie auf der Karte „Trinken“ (hydration-status), bis dahin aus den
 * Zeilen (Gewicht, Alter, Training, Herz-Angabe; ohne Wärme und Nieren-Angabe). Nur wenn `enabled` (Trink-Erinnerungen
 * an) – sonst null, nichts geladen. Fehler/kein Tracker → null (Erinnerungen wie bisher).
 */
export function useDrinkProgress(
  today: string,
  enabled: boolean,
  wake: number,
): DrinkProgress | null {
  const app = useApp();
  const hydration = hydrationBackendFor(app.backend);
  const userId = app.session?.userId ?? null;
  const active = enabled && hydration !== null && userId !== null;
  const [loaded, setLoaded] = useState<{
    userId: string;
    today: string;
    entries: HydrationEntry[];
  } | null>(null);
  const [changes, setChanges] = useState(0);
  useEffect(() => subscribeHydrationChanges(() => setChanges((n) => n + 1)), []);
  const shown = useSyncExternalStore(subscribeHydrationGoal, shownHydrationGoal);

  useEffect(() => {
    if (!active || !hydration || userId === null) return;
    let cancelled = false;
    hydration.load(today, today).then(
      (result) => {
        if (!cancelled) setLoaded({ userId, today, entries: result.entries });
      },
      () => {
        if (!cancelled) setLoaded(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, hydration, userId, today, wake, changes]);

  const rows = app.rows;
  const fallback = useMemo(
    () =>
      rows && active ? hydrationGoalFromRows(rows, today, { routes: [], kidney: false }) : null,
    [rows, today, active],
  );
  if (!active || userId === null) return null;
  const entries =
    loaded && loaded.userId === userId && loaded.today === today ? loaded.entries : null;
  return drinkProgressFor({ userId, today, entries, shown, fallback });
}
