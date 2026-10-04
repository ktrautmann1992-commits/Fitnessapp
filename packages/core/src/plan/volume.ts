import { MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION } from '../constants';

/**
 * Ausdauer-Grenze: Wochenumfang steigt höchstens um 10 % gegenüber der Vorwoche (CLAUDE.md, KONZEPT 4.6).
 * In Phase 3 enthalten die Vorlagen keine Ausdauer-Einheiten; die Funktion ist die gemeinsame Schutzgrenze für
 * Übungen mit Muster `conditioning` und für die Ausdauer-Blöcke ab Phase 10. Ohne Vorwoche (0) gilt der Plan.
 */
export function capWeeklyIncrease(previous: number, planned: number): number {
  if (!(previous > 0)) return planned;
  return Math.min(planned, previous * (1 + MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION));
}
