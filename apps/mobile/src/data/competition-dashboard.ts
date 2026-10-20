import {
  type CompetitionCountdown,
  competitionCountdown,
  type CompetitionDiscipline,
  type CompetitionPlanOutline,
  competitionPlanOutline,
  type CompetitionPlanWeek,
  type FeasibilityStatus,
  type PlanSafetyRules,
  planSnapshot,
} from '@fitnessapp/core';

import {
  competitionEntry,
  competitionOverview,
  competitionPlanFitFromRows,
  competitionPlanView,
  currentLevel,
  type OverviewPlanState,
  plannedCompetition,
} from './competition';
import type { ConsentVersions } from './mapping';
import { type ActivePlan, startGroupOf } from './training-plan';
import type { UserRows } from './types';

/**
 * Wettkampfplan leicht finden (Gründer-Rückmeldung vom 20.10.2026): Kachel „Mein Wettkampf“ auf der Übersicht und
 * „So ist dein Plan aufgebaut“ auf /wettkampf. Nur Zusammensetzen aus vorhandenen Regeln (packages/core:
 * competitionCountdown, competitionPlanWeek über competitionPlanView, competitionPlanOutline; Ampel über
 * competitionOverview). Rein und getestet (competition-dashboard.test.ts).
 */

/**
 * Aufbau des aktiven Wettkampfplans (Phasen-Zeitleiste) – nur, wenn der Plan zum geplanten Wettkampf passt
 * (`competitionPlanFit` = `fits`, wie Phasen-Band und Pace, Wächter WP4 H1). Level, Startgruppe und „vorsichtig“ für
 * die Vorschau späterer Erholungswochen wie ein Folgeblock (Stand heute); geplante Wochen zeigen den gespeicherten
 * Stand. null = kein passender Wettkampfplan.
 */
export function competitionOutlineFromRows(
  rows: UserRows,
  active: ActivePlan | null,
  rules: PlanSafetyRules | null,
  today: string,
): CompetitionPlanOutline | null {
  if (!active || !rows.profile || competitionPlanFitFromRows(rows, active) !== 'fits') return null;
  const planned = plannedCompetition(rows);
  const snapshot = planSnapshot(active.plan);
  if (!planned || !snapshot) return null;
  return competitionPlanOutline({
    cycle: {
      discipline: planned.stored.competition.discipline,
      raceDate: planned.stored.competition.raceDate,
      experienceLevel: currentLevel(rows),
      group: rules?.enduranceStartGroup ?? startGroupOf(active, rows.profile.birth_date),
      cautious: rules?.cautious ?? false,
    },
    planStart: active.plan.start_date,
    today,
    sessions: active.sessions,
  });
}

/** Kurz-Ampel der Kachel: Wettkampfplan aktiv bzw. Machbarkeit (Passt/Knapp/Zu kurz/Nicht möglich). */
export type CompetitionTileAmpel =
  | { readonly kind: 'plan_active' }
  | { readonly kind: 'feasibility'; readonly status: FeasibilityStatus }
  /** Plan passt nicht mehr zum Wettkampf (Renntag vorbei) bzw. Angaben fehlen: „Wettkampfplan ansehen“ erklärt. */
  | { readonly kind: 'check' }
  | null;

export type CompetitionTileView =
  /** Kein Wettkampf → „Wettkampf planen“. */
  | { readonly kind: 'none' }
  /** Geplanter Wettkampf, aber die gespeicherten Angaben sind nicht lesbar (Fehlerzustand). */
  | { readonly kind: 'unreadable' }
  | {
      readonly kind: 'competition';
      readonly name: string;
      readonly discipline: CompetitionDiscipline;
      readonly distanceKm: number | null;
      readonly raceDate: string;
      readonly countdown: CompetitionCountdown;
      /** „Phase · Woche X von Y“ – nur bei passendem Wettkampfplan. */
      readonly week: CompetitionPlanWeek | null;
      readonly planState: OverviewPlanState | null;
      readonly ampel: CompetitionTileAmpel;
    };

const ampelOf = (overview: ReturnType<typeof competitionOverview>): CompetitionTileAmpel => {
  if (!overview) return null;
  if (overview.planState === 'competition') return { kind: 'plan_active' };
  const f = overview.ampel?.feasibility;
  if (f?.kind === 'result' && f.result.ok) {
    return { kind: 'feasibility', status: f.result.feasibility.status };
  }
  if (f) return { kind: 'check' };
  return null;
};

/** Was die Kachel „Mein Wettkampf“ zeigt (geplanter bzw. erledigter Wettkampf in der Erholung wie „Heute“). */
export function competitionTileView(params: {
  rows: UserRows;
  versions: ConsentVersions;
  active: ActivePlan | null;
  rules: PlanSafetyRules | null;
  today: string;
  offline: boolean;
}): CompetitionTileView {
  const { rows, versions, active, rules, today, offline } = params;
  const entry = competitionEntry(rows, today);
  if (!entry) {
    // Ein geplanter Wettkampf, der sich nicht lesen lässt, ist ein Fehler – nicht „kein Wettkampf“.
    return rows.competitions.some((c) => c.status === 'planned')
      ? { kind: 'unreadable' }
      : { kind: 'none' };
  }
  const c = entry.stored.competition;
  const planned = entry.row.status === 'planned';
  const overview = planned ? competitionOverview({ rows, versions, active, today, offline }) : null;
  return {
    kind: 'competition',
    name: c.name,
    discipline: c.discipline,
    distanceKm: c.distanceKm ?? null,
    raceDate: c.raceDate,
    countdown: competitionCountdown(
      {
        status: entry.row.status,
        discipline: c.discipline,
        raceDate: c.raceDate,
        resultSessionLogId: entry.stored.resultSessionLogId,
      },
      today,
    ),
    week: planned ? competitionPlanView(rows, active, today, offline, rules).week : null,
    planState: overview?.planState ?? null,
    ampel: ampelOf(overview),
  };
}
