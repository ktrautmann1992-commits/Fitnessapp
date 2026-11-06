import type { StartMenuCandidate, StartMenuEntry, WeekStatusDay } from '@fitnessapp/core';

import { activePlan } from './training-plan';
import type { UserRows } from './types';
import { startKind } from './workout-session';

/**
 * Kandidaten für das Start-Blatt (packages/core `startTrainingMenu`): offene Einheiten des Tages aus dem
 * Wochen-Status (auch hierher verschobene), mit derselben Startprüfung wie Hero-Karte und Tages-Blatt.
 */
export function startCandidatesFor(
  rows: UserRows,
  day: WeekStatusDay | null,
  draftKeys: readonly string[],
  today: string,
): StartMenuCandidate[] {
  if (!day || day.date !== today) return [];
  const sessions = activePlan(rows)?.sessions ?? [];
  return day.open.flatMap((open) => {
    const session = sessions.find((s) => s.id === open.sessionId);
    if (!session) return [];
    return [
      {
        sessionId: open.sessionId,
        name_de: open.name_de,
        kind: open.kind,
        startable: startKind(rows, session, today) !== null,
        hasDraft: draftKeys.includes(open.sessionId),
      },
    ];
  });
}

/** Ziel eines Eintrags im Start-Blatt (Expo-Router-Pfad). */
export function startEntryHref(entry: StartMenuEntry, today: string): string {
  switch (entry.kind) {
    case 'planned':
      return `/workout/${entry.sessionId}`;
    case 'free_strength':
      return '/kraft-starten';
    case 'gps':
      // Startseite der Aufzeichnung: Sportart (Lauf, Rad, E-Bike, Wandern), Sicherheits-Hinweise, dann live.
      return '/ausdauer';
    case 'other_sport':
      return `/sportart?date=${today}`;
    case 'backfill':
      return `/nachtragen?date=${today}`;
  }
}
