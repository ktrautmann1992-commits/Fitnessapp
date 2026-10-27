/**
 * Sportarten Stufe 1 (docs/PLAN-SPORTARTEN-STUFE-1.md): Datenbank, Listen und Zod-Schemas kennen die neuen Werte seit
 * Etappe S. Fachlogik, Inhalte und Oberflächen folgen je Sportart (Etappen Y, W, R, H, Abschnitt 9). Bis dahin sind
 * diese Werte in den Auswahllisten der App NICHT wählbar – so landet niemand in einer halb fertigen Sportart. Die
 * jeweilige Etappe entfernt ihre Einträge hier (gespeicherte Werte zeigt die App immer an).
 */

/** Ausdauer- bzw. Wettkampf-Disziplin Hyrox – Etappe H. */
export const PENDING_DISCIPLINES: ReadonlySet<string> = new Set(['hyrox']);

/** Ausdauer-Art Rudern (Eintragen/Nachtragen) – Etappe R. */
export const PENDING_ENDURANCE_MODALITIES: ReadonlySet<string> = new Set(['row']);

/** Workout-Kategorien ohne Inhalte – Etappe R (Rudern). Yoga und Pilates seit Etappe Y wählbar. */
export const PENDING_WORKOUT_CATEGORIES: ReadonlySet<string> = new Set(['rowing']);

/** Sportart-Einträge – Yoga und Pilates seit Etappe Y wählbar. */
export const PENDING_SPORTS: ReadonlySet<string> = new Set([]);

/** Werte ohne die noch nicht wählbaren (Reihenfolge bleibt). */
export function selectable<T extends string>(
  values: readonly T[],
  pending: ReadonlySet<string>,
): T[] {
  return values.filter((value) => !pending.has(value));
}
