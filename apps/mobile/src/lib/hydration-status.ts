import { type DrinkProgress, type HydrationGoal, hydrationTotal } from '@fitnessapp/core';

/**
 * Trink-Erinnerungen stoppen, wenn das Tagesziel erreicht ist (docs/PLAN-ERINNERUNGEN.md): Die Karte „Trinken“ meldet
 * hier das Ziel, das sie zeigt (inkl. Wärme des Tages und Herz-/Nieren-Angabe) – so nutzen die Erinnerungen genau
 * dasselbe Ziel. Nur im Arbeitsspeicher (keine Mengen, kein Ziel auf dem Gerät gespeichert, nie in Logs).
 */
export interface ShownHydrationGoal {
  readonly userId: string;
  readonly date: string;
  /** null = kein Ziel (Herz/Niere, kein Gewicht). */
  readonly goalMl: number | null;
}

let shown: ShownHydrationGoal | null = null;
const listeners = new Set<() => void>();

/** Ziel melden, wie die Karte es zeigt (gleicher Stand → nichts). */
export function publishHydrationGoal(next: ShownHydrationGoal): void {
  if (
    shown &&
    shown.userId === next.userId &&
    shown.date === next.date &&
    shown.goalMl === next.goalMl
  ) {
    return;
  }
  shown = next;
  for (const listener of listeners) listener();
}

export function shownHydrationGoal(): ShownHydrationGoal | null {
  return shown;
}

export function subscribeHydrationGoal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Nur für Tests: Stand vergessen. */
export function resetHydrationGoal(): void {
  shown = null;
  for (const listener of listeners) listener();
}

/**
 * Stand des Trink-Trackers für die Erinnerungen (heute): Menge aus den Einträgen, Ziel wie auf der Karte (gleiches
 * Konto, gleicher Tag) – sonst das aus den Zeilen berechnete Ziel (`fallback`, z. B. nach einem Neustart, bevor die
 * Karte einmal angezeigt wurde). Einträge nicht geladen (kein Tracker, Fehler) → null: Erinnerungen wie bisher.
 */
export function drinkProgressFor(input: {
  readonly userId: string;
  readonly today: string;
  readonly entries: readonly { day: string; amount_ml: number }[] | null;
  readonly shown: ShownHydrationGoal | null;
  readonly fallback: HydrationGoal | null;
}): DrinkProgress | null {
  if (input.entries === null) return null;
  const fromCard =
    input.shown && input.shown.userId === input.userId && input.shown.date === input.today
      ? input.shown
      : null;
  const goalMl = fromCard
    ? fromCard.goalMl
    : input.fallback?.kind === 'goal'
      ? input.fallback.goalMl
      : null;
  return { date: input.today, totalMl: hydrationTotal(input.entries, input.today), goalMl };
}
