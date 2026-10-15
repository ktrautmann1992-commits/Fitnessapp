import {
  type BackfillDay,
  backfillDates,
  backfillOptions,
  type Exercise,
  logsCreatedOn,
} from '@fitnessapp/core';

import { summaryInputs } from './log-summary';
import type { UserRows } from './types';

/**
 * Nachtragen und freie Einheit in der App (docs/PLAN-AUSWERTUNG.md 4, Etappe A1b): Abbildung der Zeilen auf
 * backfillOptions()/backfillDates() aus packages/core. Nur Zusammensetzen, keine Regeln. Rein, getestet.
 */

/** Was an `date` eingetragen werden kann (Tagesblock, geplante Einheiten mit Grund, freie Einheit). */
export function backfillDayFromRows(rows: UserRows, date: string, today: string): BackfillDay {
  const { sessions } = summaryInputs(rows);
  return backfillOptions(sessions, rows.sessionLogs, date, today, {
    // Untergrenze: Die Datenbank zählt auch gelöschte Einträge (Tageslimit, K1).
    createdToday: logsCreatedOn(rows.sessionLogs, today),
  });
}

/** Tage, an die die geplante Einheit nachgetragen werden darf (Datumswahl im Trainingsmodus). */
export function backfillDatesFromRows(rows: UserRows, sessionId: string, today: string): string[] {
  const session = summaryInputs(rows).sessions.find((s) => s.id === sessionId);
  return session ? backfillDates(session, rows.sessionLogs, today) : [];
}

/** Für die Suche: klein, ohne Akzente, ß → ss. */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .trim();
}

/**
 * Übungen für die freie Kraft-Einheit: aus der Bibliothek, nach Name gefiltert (alle Wörter der Suche), alphabetisch;
 * höchstens `limit`, `more` = weitere Treffer. Gewählte Übungen stehen immer vorn.
 */
export function freeExerciseCandidates(
  exercises: ReadonlyMap<string, Exercise>,
  query: string,
  selectedIds: readonly string[],
  limit = 30,
): { items: Exercise[]; more: number } {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const selected = new Set(selectedIds);
  const all = [...exercises.values()].sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'));
  const matching = all.filter(
    (e) => !selected.has(e.id) && words.every((w) => normalize(e.name_de).includes(w)),
  );
  const chosen = selectedIds
    .map((id) => exercises.get(id))
    .filter((e): e is Exercise => e !== undefined);
  const room = Math.max(0, limit - chosen.length);
  return {
    items: [...chosen, ...matching.slice(0, room)],
    more: Math.max(0, matching.length - room),
  };
}
