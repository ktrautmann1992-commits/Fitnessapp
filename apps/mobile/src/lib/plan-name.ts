import type { EnduranceDiscipline, GoalType } from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Planname aus Zielen und Tagen (Trainings-PDF, „Heute“, Woche): „Muskelaufbau · 3 Tage“, mit Nebenziel
 * „Abnehmen + Muskelaufbau · 3 Tage“ (docs/PLAN-ZIELE.md 4.3 und 4.6, Etappe Z5). Beim Hauptziel Ausdauer mit
 * Ausdauer-Tagen „Ausdauer-Grundlage – 10 km“. Nie ein Wunschgewicht oder Tempo (Regel B1, F13) – die Eingaben
 * enthalten keine Körperdaten. Nur Formulierung.
 */
export interface PlanNameParts {
  readonly goal: GoalType | null;
  readonly secondary: GoalType | null;
  readonly discipline: EnduranceDiscipline | null;
  readonly strengthDays: number;
  readonly enduranceDays: number;
}

/** Nur die Ziele: „Abnehmen + Muskelaufbau“ (ohne Tage). */
export function planGoalsText(
  parts: Pick<PlanNameParts, 'goal' | 'secondary' | 'discipline' | 'enduranceDays'>,
): string {
  const p = t.print;
  if (parts.goal === null) return p.goalFallback;
  const primary =
    parts.goal === 'endurance' && parts.enduranceDays > 0
      ? t.plan.enduranceBase(parts.discipline ? t.steps.goal.disciplines[parts.discipline] : null)
      : t.steps.goal.options[parts.goal];
  return parts.secondary === null
    ? primary
    : t.plan.goalsJoined(primary, t.steps.goal.options[parts.secondary]);
}

export function planNameText(parts: PlanNameParts): string {
  const p = t.print;
  const days =
    parts.strengthDays > 0 && parts.enduranceDays > 0
      ? p.daysMixed(parts.strengthDays, parts.enduranceDays)
      : p.days(parts.strengthDays + parts.enduranceDays);
  return p.planName(planGoalsText(parts), days);
}
