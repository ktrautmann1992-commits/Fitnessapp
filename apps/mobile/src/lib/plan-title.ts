import { planTitle, scheduleTotals } from '@fitnessapp/core';

import { planSnapshot } from '@/data/training-plan';
import type { UserPlanRow } from '@/data/types';
import { t } from '@/i18n';

import { planNameText } from './plan-name';

/**
 * Angezeigter Plan-Titel („Heute“, Fertig, Einstellungen) – Regel aus packages/core (planTitle); der gespeicherte
 * Schnappschuss template_title_de bleibt unverändert. Ziel Ausdauer → „Ausdauer-Grundlage – Marathon“.
 */
export function planTitleText(plan: UserPlanRow): string {
  const title = planTitle({
    template_title_de: plan.template_title_de,
    inputs: planSnapshot(plan),
  });
  switch (title.kind) {
    case 'endurance_base':
      return t.plan.enduranceBase(
        title.discipline ? t.steps.goal.disciplines[title.discipline] : null,
      );
    case 'template':
      return t.plan.templateLine(title.title);
    default:
      return t.plan.enduranceOnly;
  }
}

/**
 * Planname mit den Zielen des Plans (Etappe Z5, docs/PLAN-ZIELE.md 4.6): „Dein Plan: Abnehmen + Muskelaufbau ·
 * 3 Tage“ auf „Heute“ und in der Woche – gleiche Formulierung wie im Trainings-PDF. Aus dem gespeicherten
 * Schnappschuss (Ziele und Trainingstage, keine Körperdaten). null = Angaben nicht lesbar.
 */
export function planNameLine(plan: UserPlanRow): string | null {
  const snapshot = planSnapshot(plan);
  if (snapshot === null) return null;
  const totals = scheduleTotals(snapshot.schedule);
  return t.plan.nameLine(
    planNameText({
      goal: snapshot.goalType,
      secondary: snapshot.secondaryGoalType ?? null,
      discipline: snapshot.discipline,
      strengthDays: totals.byKind.strength_gym + totals.byKind.strength_home,
      enduranceDays: totals.byKind.endurance,
    }),
  );
}
