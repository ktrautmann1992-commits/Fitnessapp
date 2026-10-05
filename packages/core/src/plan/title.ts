import type { EnduranceDiscipline, GoalType } from '../enums';

/**
 * Angezeigter Plan-Titel (nur Anzeige – der gespeicherte Schnappschuss user_plans.template_title_de bleibt
 * unverändert). Beim Ziel Ausdauer heißt der Plan „Ausdauer-Grundlage – <Disziplin>“ statt nach der Kraft-Vorlage
 * („Allgemeine Fitness“): echte Wettkampfpläne kommen erst in Phase 10. Texte liefert die App (i18n).
 * - `endurance_base`: Ziel Ausdauer UND mindestens ein Ausdauer-Tag in der Woche (mit oder ohne Kraft-Vorlage),
 *   `discipline` null = keine Disziplin gewählt. Ohne Ausdauer-Tag gibt es keine Ausdauer-Grundlage → Vorlagenname
 *   bzw. „Ausdauer-Plan“ (Wächter-Auflage 1),
 * - `template`: Name der Kraft-Vorlage,
 * - `endurance_only`: reiner Ausdauer-Plan ohne Vorlage bei einem anderen Ziel.
 */
export type PlanTitle =
  | { readonly kind: 'endurance_base'; readonly discipline: EnduranceDiscipline | null }
  | { readonly kind: 'template'; readonly title: string }
  | { readonly kind: 'endurance_only' };

export function planTitle(plan: {
  readonly template_title_de: string | null;
  /** Angaben des Plans (user_plans.inputs); null = unlesbar → Vorlagenname. */
  readonly inputs: {
    readonly goalType: GoalType;
    readonly discipline: EnduranceDiscipline | null;
    readonly schedule: { readonly slots: readonly { readonly kind: string }[] };
  } | null;
}): PlanTitle {
  if (
    plan.inputs?.goalType === 'endurance' &&
    plan.inputs.schedule.slots.some((slot) => slot.kind === 'endurance')
  ) {
    return { kind: 'endurance_base', discipline: plan.inputs.discipline };
  }
  return plan.template_title_de
    ? { kind: 'template', title: plan.template_title_de }
    : { kind: 'endurance_only' };
}
