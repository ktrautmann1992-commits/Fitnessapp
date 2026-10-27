import {
  ageInYears,
  CONSERVATIVE_PLAN_RULES,
  type Exercise,
  type FlowSafetyInput,
  flowHoldCap,
  painEffectOn,
} from '@fitnessapp/core';
import { useMemo } from 'react';

import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { useTrainingModes } from '@/state/use-training-modes';

/**
 * Sicherheitsfilter für Yoga-/Pilates-/Mobility-Routinen (Sportarten Stufe 1 · Etappe Y): wirksame Plan-Regeln
 * (Schwangerschaft, vorsichtig, Fit im Alter …), Schon-Modus von heute und Halteposen ab 65. Die Regeln selbst stehen
 * in packages/core (prepareFlowWorkout). Ohne geladene Regeln gilt die vorsichtige Richtung.
 */
export function useFlowSafety(): FlowSafetyInput {
  const app = useApp();
  const today = useToday();
  const modes = useTrainingModes().state;
  const rules = app.safetyRules;
  const birthDate = app.rows?.profile?.birth_date ?? null;
  return useMemo(() => {
    const age = birthDate && birthDate <= today ? ageInYears(birthDate, today) : 0;
    return {
      excludedCautionTags:
        rules?.excludedCautionTags ?? CONSERVATIVE_PLAN_RULES.excludedCautionTags,
      pain: modes ? painEffectOn(modes.pain, today) : null,
      holdCap: flowHoldCap({ age, activeAging: rules?.activeAging ?? false }),
    };
  }, [birthDate, modes, rules, today]);
}

/** Übungen inkl. Posen (Posen stehen nur in `displayExercises`, isFlowPoseId); null = Bibliothek noch nicht da. */
export function useExerciseLookup(): ReadonlyMap<string, Exercise> | null {
  const app = useApp();
  return app.library.kind === 'ready'
    ? (app.library.library.displayExercises ?? app.library.library.exercises)
    : null;
}
