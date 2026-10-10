import {
  equipmentNames,
  type GlossaryEntry,
  type GlossaryGroup,
  glossaryGroupOf,
  type Exercise,
} from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Texte des Übungs-Glossars (Etappe G1): nur Formatierung der Codes aus packages/core (glossary.ts) mit i18n.
 */

/** Geräte als Kurztext („Kurzhanteln, Flachbank“ bzw. „ohne Geräte“). */
export function equipmentText(names: readonly { name: string }[]): string {
  return names.length === 0 ? t.glossary.noEquipment : names.map((e) => e.name).join(', ');
}

/** Listenzeile: „Bereich · Geräte“. */
export function listLine(exercise: Pick<Exercise, 'movement_pattern' | 'equipment_ids'>): string {
  const group: GlossaryGroup = glossaryGroupOf(exercise.movement_pattern);
  return `${t.glossary.groups[group]} · ${equipmentText(equipmentNames(exercise.equipment_ids))}`;
}

/** Merkmal-Zeile der Detailseite: Bereich · Geräte · Schwierigkeit · Wiederholungen/Halten · einseitig. */
export function featureLine(
  entry: Pick<GlossaryEntry, 'group' | 'equipment' | 'difficulty' | 'loadType' | 'unilateral'>,
): string {
  return [
    t.glossary.groups[entry.group],
    equipmentText(entry.equipment),
    t.glossary.difficultyText(t.glossary.difficulty[entry.difficulty]),
    entry.loadType === 'hold' ? t.glossary.hold : t.glossary.reps,
    entry.unilateral ? t.glossary.unilateral : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}
