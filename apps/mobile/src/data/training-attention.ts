import {
  followUpBlockState,
  type PlanLibrary,
  planNotice,
  type PlanNotice,
  type PlanSafetyRules,
  type TrainingAttentionReason,
  trainingAttentionReasons,
  weightGoalCard,
  type WeightGoalOverview,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import { competitionPlanView } from './competition';
import type { ConsentVersions } from './mapping';
import { type ActivePlan, activePlan, planOffer } from './training-plan';
import type { UserRows } from './types';

/**
 * Gemeinsame Auswertung für „Heute“ (Reiter Training) und die Übersicht (docs/PLAN-DASHBOARD.md 2.4, Wächter H1):
 * „Plan neu erstellen?“ (Angebot, strenger, abgelaufen) und alles, was auf „Heute“ wartet. Die Regeln selbst stehen in
 * packages/core (`planNotice`, `trainingAttentionReasons`).
 */
export function planNoticeFor(input: {
  rows: UserRows;
  versions: ConsentVersions;
  active: ActivePlan;
  rules: PlanSafetyRules | null;
  library: PlanLibrary | null;
  today: string;
}): PlanNotice {
  const { rows, versions, active, rules, library, today } = input;
  const templateVersion = library?.templates.find(
    (tpl) => tpl.id === active.plan.template_id,
  )?.version;
  const offer = rules ? planOffer(rows, versions, active, rules, today, templateVersion) : null;
  return planNotice(offer, followUpBlockState(active.sessions, today));
}

export function trainingAttention(input: {
  rows: UserRows;
  versions: ConsentVersions;
  rules: PlanSafetyRules | null;
  library: PlanLibrary | null;
  today: string;
  offline: boolean;
  drafts: number;
  workoutMessage: TrainingAttentionReasonInput['workoutMessage'];
  planMessage: string | null;
  foreignData: boolean;
  sessionExpired: boolean;
  weightGoal: WeightGoalOverview | null;
}): { planNotice: PlanNotice; reasons: TrainingAttentionReason[] } {
  const { rows, versions, today } = input;
  const active = activePlan(rows);
  const notice: PlanNotice = active
    ? planNoticeFor({ rows, versions, active, rules: input.rules, library: input.library, today })
    : { kind: 'none' };
  const reasons = trainingAttentionReasons({
    planNotice: notice,
    drafts: input.drafts,
    workoutMessage: input.workoutMessage,
    planMessage: input.planMessage !== null,
    reconsent: healthConsentStatus(rows, versions) === 'outdated',
    foreignData: input.foreignData,
    sessionExpired: input.sessionExpired,
    competitionMismatch:
      active !== null &&
      competitionPlanView(rows, active, today, input.offline, input.rules).mismatch,
    weightGoalCard: input.weightGoal !== null && weightGoalCard(input.weightGoal) !== null,
  });
  return { planNotice: notice, reasons };
}

type TrainingAttentionReasonInput = Parameters<typeof trainingAttentionReasons>[0];
