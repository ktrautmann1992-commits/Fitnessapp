import {
  equipmentIdSchema,
  equipmentProfile,
  type GlossaryContext,
  isStrengthKind,
  locationOfKind,
  type PlanLibrary,
  type PlanSafetyRules,
} from '@fitnessapp/core';

import { activePlan } from './training-plan';
import type { UserRows } from './types';

/**
 * Glossar in der App (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.1/8.1, Etappe G1): baut aus den Zeilen den Kontext für
 * glossaryEntry()/searchExercises() aus packages/core – nur Abbildung, keine Regeln. Rein und getestet.
 * - Heim-Geräte aus den AKTUELLEN Angaben (user_equipment, Ort „home“), unbekannte Geräte werden übergangen.
 * - Trainingsorte aus den Trainingstagen (Kraft zu Hause / im Studio); keine Kraft-Tage → beide Orte.
 * - Übungen des aktiven Plans für „In deinem Plan“.
 */
export function glossaryContextFromRows(
  rows: UserRows | null,
  library: PlanLibrary | null,
  rules: PlanSafetyRules | null,
): GlossaryContext {
  const home = equipmentProfile(
    'home',
    (rows?.userEquipment ?? [])
      .filter((row) => row.location === 'home')
      .flatMap((row) => {
        const id = equipmentIdSchema.safeParse(row.equipment_id);
        return id.success ? [{ equipmentId: id.data, weightsKg: [...row.weights_kg] }] : [];
      }),
  );
  const gym = equipmentProfile('gym', []);
  const locations = new Set(
    (rows?.trainingSlots ?? [])
      .filter((slot) => isStrengthKind(slot.kind))
      .map((slot) => locationOfKind(slot.kind)),
  );
  const trainingProfiles =
    locations.size === 0
      ? [home, gym]
      : [...(locations.has('home') ? [home] : []), ...(locations.has('gym') ? [gym] : [])];
  const active = rows ? activePlan(rows) : null;
  return {
    library,
    rules,
    homeProfile: home,
    trainingProfiles,
    planExerciseIds: new Set(
      (active?.sessions ?? []).flatMap((s) => s.exercises.map((e) => e.exercise_id)),
    ),
  };
}
