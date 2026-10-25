import type { WorkoutItem } from '../log/workout';
import { isBlockedByPain } from './pain';
import type { DisplayModes } from './layer';

/**
 * Trainingsmodus an Modus-Tagen (docs/PLAN-TRAINING-MODI.md 6.3): Die Übungen kommen schon aus der Anzeige
 * (prepareSessionForDisplay mit `modes`). Zusätzlich gilt hier:
 * - Alternativen im Tausch-Dialog: nie eine im Schmerz-Modus gesperrte und auf Reisen nur mit den Reise-Geräten
 *   machbare Übung,
 * - Schmerz-Modus: kein Steigerungs-Hinweis (schwerere Variante, stärkeres Band) und kein Zusatzsatz – die Sätze
 *   bleiben bei der (gesenkten) Vorgabe des Termins.
 * Ohne Modus wird nichts verändert (gleiche Objekte).
 */
export function restrictWorkoutItems(
  items: readonly WorkoutItem[],
  modes: DisplayModes,
): WorkoutItem[] {
  const pain = modes.pain ?? null;
  const travel = modes.travel ?? null;
  if (!pain && !travel) return [...items];
  return items.map((item) => {
    const alternatives = item.alternatives.filter(
      (a) =>
        !(pain && isBlockedByPain(a, pain)) &&
        !(travel && !a.equipment_ids.every((id) => travel.available.has(id))),
    );
    if (!pain || !item.plan) return { ...item, alternatives };
    const hint = item.plan.hint;
    const progressHint =
      hint.hint === 'harder_variant' || hint.hint === 'stronger_band' ? null : hint.hint;
    const sets = Math.min(item.plan.prescription.sets, item.shown.sets);
    return {
      ...item,
      alternatives,
      plan: {
        ...item.plan,
        hint: { hint: progressHint, harderVariant: null },
        prescription: { ...item.plan.prescription, sets, extraSet: false },
      },
    };
  });
}
