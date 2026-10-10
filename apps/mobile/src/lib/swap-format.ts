import {
  type EquipmentLocation,
  type ExerciseMark,
  missingKeyGroups,
  type MovementPattern,
} from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Texte zum Übungstausch (Etappe T2) – nur Auswahl des passenden deutschen Texts, keine Regeln. Sicherheits-Ersatz
 * („angepasst“) und Präferenz-Tausch („deine Wahl“) bleiben streng getrennt (D-4).
 */

/** Kennzeichen einer angezeigten Übung (Status nie nur über Farbe – immer als Text). */
export function markText(mark: ExerciseMark, later: boolean): string | null {
  switch (mark) {
    case 'equipment_swap':
      return t.plan.substituted;
    case 'adjusted':
      return t.plan.adjusted;
    case 'preference':
      return t.swap.markPreference;
    case 'day_swap':
      return later ? t.swap.markDaySwapLater : t.swap.markDaySwap;
    case null:
      return null;
  }
}

/** „zu Hause“ / „im Studio“. */
export function placeText(location: EquipmentLocation): string {
  return t.swap.places[location];
}

/** Hinweise „Dieser Einheit fehlt jetzt eine Rücken-/Hüft-Übung“ (je Grundbaustein-Gruppe einmal). */
export function keyPatternTexts(patterns: readonly MovementPattern[] | undefined): string[] {
  // Gruppen kommen aus packages/core (SWAP_RULES.keyPatternGroups) – hier nur der Text je Gruppe.
  return missingKeyGroups(patterns).map((group) => t.swap.keyPatternMissing[group]);
}
