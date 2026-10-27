/**
 * Sportarten Stufe 1 (docs/PLAN-SPORTARTEN-STUFE-1.md): Datenbank, Listen und Zod-Schemas kennen die neuen Werte seit
 * Etappe S. Fachlogik, Inhalte und Oberflächen folgen je Sportart (Etappen Y, W, R, H, Abschnitt 9). Bis dahin sind
 * diese Werte in den Auswahllisten der App NICHT wählbar – so landet niemand in einer halb fertigen Sportart. Die
 * jeweilige Etappe entfernt ihre Einträge hier (gespeicherte Werte zeigt die App immer an).
 */

/** Ausdauer- bzw. Wettkampf-Disziplin Hyrox – Etappe H. */
export const PENDING_DISCIPLINES: ReadonlySet<string> = new Set(['hyrox']);

/** Ausdauer-Art Rudern (Eintragen/Nachtragen) – seit Etappe R wählbar; Liste bleibt für spätere Arten. */
export const PENDING_ENDURANCE_MODALITIES: ReadonlySet<string> = new Set([]);

/** Workout-Kategorien ohne Inhalte – Etappe Y (Yoga, Pilates); Rudern seit Etappe R wählbar. */
export const PENDING_WORKOUT_CATEGORIES: ReadonlySet<string> = new Set(['yoga', 'pilates']);

/** Sportart-Einträge Yoga und Pilates – Etappe Y. */
export const PENDING_SPORTS: ReadonlySet<string> = new Set(['yoga', 'pilates']);

/** Werte ohne die noch nicht wählbaren (Reihenfolge bleibt). */
export function selectable<T extends string>(
  values: readonly T[],
  pending: ReadonlySet<string>,
): T[] {
  return values.filter((value) => !pending.has(value));
}
