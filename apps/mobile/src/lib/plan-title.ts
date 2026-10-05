import { planTitle } from '@fitnessapp/core';

import { planSnapshot } from '@/data/training-plan';
import type { UserPlanRow } from '@/data/types';
import { t } from '@/i18n';

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
