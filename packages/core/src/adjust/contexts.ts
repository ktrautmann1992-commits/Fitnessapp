import type { Exercise } from '../content/schemas';
import { startOfIsoWeek } from '../dates';
import type { EquipmentLocation } from '../enums';
import {
  extraSetAllowed,
  progressionContextFor,
  referenceDosage,
  weightStepsFor,
} from '../log/workout';
import type { ProgressionContext } from '../log/types';
import type { EquipmentProfile } from '../plan/equipment-profile';
import type { StoredSession } from '../plan/view';

/**
 * Progressions-Kontext je Übung für die Live-Anpassung (docs/PLAN-PHASE-4B.md 5.1: „aktueller Plan, Stufen am Ort der
 * nächsten Einheit“) – EINE Zusammenstellung für App (Testmodus, Etappe D) und Server (Route, Etappe C). Dieselben
 * Bausteine wie der Trainingsmodus (progressionContextFor, referenceDosage, weightStepsFor, extraSetAllowed).
 *
 * Bezugs-Einheit je Übung: die nächste geplante Kraft-Einheit ab heute mit dieser (gespeicherten) Übung, sonst die
 * zuletzt geplante. Ort: `sessionLocations` der Einheit; unbekannt → Studio (keine eigenen Stufen, 0,5-kg-Raster – die
 * Anzeige rundet ohnehin auf die Stufen des heutigen Orts). Übungen ohne Bibliotheks-Eintrag fehlen (nicht prüfbar).
 */
export function progressionContextsForPlan(params: {
  readonly sessions: readonly StoredSession[];
  readonly today: string;
  readonly library: ReadonlyMap<string, Exercise>;
  readonly profiles: ReadonlyMap<EquipmentLocation, EquipmentProfile>;
  readonly sessionLocations?: Readonly<Record<string, EquipmentLocation>>;
  /** Obergrenze Wochensätze der Vorlage (weeklySetRange(template).max); null = unbekannt → kein Zusatzsatz. */
  readonly weeklySetMax: number | null;
}): Record<string, ProgressionContext> {
  const strength = [...params.sessions]
    .filter((s) => s.kind === 'strength')
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || a.id.localeCompare(b.id));
  const reference = new Map<string, StoredSession>();
  for (const s of strength) {
    for (const e of s.exercises) {
      const current = reference.get(e.exercise_id);
      // Nach Datum aufsteigend: die erste kommende Einheit bleibt; bis dahin gewinnt die jeweils spätere.
      const currentUpcoming =
        current !== undefined &&
        current.status === 'planned' &&
        current.scheduled_on >= params.today;
      if (!currentUpcoming) reference.set(e.exercise_id, s);
    }
  }
  const out: Record<string, ProgressionContext> = {};
  for (const [exerciseId, session] of [...reference.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const exercise = params.library.get(exerciseId);
    const planned = session.exercises.find((e) => e.exercise_id === exerciseId);
    if (!exercise || !planned) continue;
    const location = params.sessionLocations?.[session.id] ?? 'gym';
    const profile = params.profiles.get(location);
    const monday = startOfIsoWeek(session.original_date ?? session.scheduled_on);
    const week = params.sessions.filter(
      (s) => startOfIsoWeek(s.original_date ?? s.scheduled_on) === monday,
    );
    out[exerciseId] = progressionContextFor({
      exercise,
      planned,
      reference: referenceDosage(params.sessions, exerciseId, planned),
      steps: profile ? weightStepsFor(exercise, profile) : [],
      allowExtraSet: extraSetAllowed(exercise, week, params.library, params.weeklySetMax),
    });
  }
  return out;
}
