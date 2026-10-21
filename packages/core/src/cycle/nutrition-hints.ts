import type { DietType } from '../enums';
import { derivePeriodList, normalizeEntries } from './periods';
import type { CycleEntry } from './schemas';

/**
 * Ernährungs-Hinweise ohne neue Zahlen (docs/PLAN-PHASE-9.md 3.5): Eisen bei starker Blutung (höchstens einmal je
 * Zyklus, vegan/vegetarisch ohne Fleisch), Trinken bei Blutung mittel/stark oder Kopfschmerzen. Kein Präparat, keine
 * Dosis (ZY-G10). Kalorienziele und Schutzgrenzen bleiben unverändert – diese Funktion liefert nur Codes.
 */
export type CycleNutritionHint = 'iron' | 'iron_plant' | 'drink';

export function cycleNutritionHints(
  today: CycleEntry | null,
  recentEntries: readonly CycleEntry[],
  dietType: DietType | null,
  options: {
    /** „Weggetippt am“ des Eisen-Hinweises (cycle_settings.dismissed.iron). */
    readonly ironDismissedOn?: string | undefined;
    /** W4 ist aktiv (Eisen-Hinweis gehört dazu, Plan 3.4). */
    readonly heavyBleedingWarning?: boolean;
  } = {},
): CycleNutritionHint[] {
  if (today === null) return [];
  const hints: CycleNutritionHint[] = [];
  const bleeding = today.payload.bleeding;
  if (bleeding === 'heavy' || options.heavyBleedingWarning === true) {
    // Höchstens einmal je Zyklus: weggetippt seit Beginn der aktuellen Periode → nicht erneut.
    const periods = derivePeriodList(
      normalizeEntries([...recentEntries, today]).filter((e) => e.date <= today.date),
    );
    const currentStart = periods.at(-1)?.start ?? today.date;
    const dismissed = options.ironDismissedOn;
    if (dismissed === undefined || dismissed < currentStart) {
      hints.push(dietType === 'vegan' || dietType === 'vegetarian' ? 'iron_plant' : 'iron');
    }
  }
  if (
    bleeding === 'medium' ||
    bleeding === 'heavy' ||
    today.payload.symptoms?.headache !== undefined
  ) {
    hints.push('drink');
  }
  return hints;
}
