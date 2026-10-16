import {
  type CompetitionFeasibilityResult,
  type CompetitionGoal,
  type CompetitionInput,
  type CompetitionOwnStart,
  type CompetitionRequest,
  type CompetitionStartReference,
  competitionFeasibility,
  competitionFollowUpBlock,
  competitionToShow,
  dropPastSessions,
  experienceLevelSchema,
  type ExperienceLevel,
  type GenerateCompetitionPlanResult,
  generateCompetitionPlan,
  isCompetitionDiscipline,
  isBodyweightTemplateId,
  loadWeeksBeforeDeload,
  nextPlanBlock,
  type PlanInputsInput,
  type PlanLibrary,
  type PlanSafetyRules,
  planSnapshot,
  profilesFor,
  recentCompetitionStartReference,
  type SaveCompetitionPayload,
  type SavePlanSession,
  type StoredCompetition,
  storedCompetitionFromRow,
  toAppendBlockPayload,
  toSaveCompetitionPayload,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { type ActivePlan, planInputsFromRows, startGroupOf } from './training-plan';
import type { CompetitionRow, UserRows } from './types';

/**
 * Wettkampf in der App (docs/PLAN-PHASE-10.md Abschnitt 8, Etappe WP4): Zeilen → Engine (packages/core:
 * competitionFeasibility, generateCompetitionPlan, competitionFollowUpBlock) → Eingaben für save_competition und
 * save_training_plan bzw. append_plan_block. Nur Abbildung und Zusammensetzen; alle Regeln stehen in packages/core.
 * Rein und getestet (competition.test.ts).
 */

/** Gespeicherter Wettkampf mit lesbaren Engine-Eingaben. */
export interface CompetitionEntry {
  row: CompetitionRow;
  stored: StoredCompetition;
}

/** Wettkampf für Anzeige (Countdown, „Mein Wettkampf“): geplanter bzw. erledigter in der Erholung. */
export function competitionEntry(rows: UserRows, today: string): CompetitionEntry | null {
  const row = competitionToShow(rows.competitions, today);
  const stored = row ? storedCompetitionFromRow(row) : null;
  return row && stored ? { row, stored } : null;
}

/** Der (eine) geplante Wettkampf (W-G9). */
export function plannedCompetition(rows: UserRows): CompetitionEntry | null {
  const row = rows.competitions.find((c) => c.status === 'planned');
  const stored = row ? storedCompetitionFromRow(row) : null;
  return row && stored ? { row, stored } : null;
}

/** Ist der aktive Plan ein Wettkampfplan (Einheiten mit Art und Phase, WP3)? */
export function isCompetitionPlan(active: ActivePlan | null): boolean {
  return active !== null && active.sessions.some((s) => s.training_phase !== undefined);
}

/** Eingetragene Ausdauer-Minuten je geplanter Einheit (Tagebuch, für min(geplant, eingetragen)). */
export function loggedEnduranceMinutes(rows: UserRows): Map<string, number> {
  const durations = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c.duration_s] as const));
  const minutes = new Map<string, number>();
  for (const log of rows.sessionLogs) {
    if (log.kind !== 'endurance' || log.planned_session_id === null) continue;
    const seconds = durations.get(log.id);
    if (seconds === undefined) continue;
    minutes.set(log.planned_session_id, Math.floor(seconds / 60));
  }
  return minutes;
}

/**
 * Bezug aus dem Tagebuch der letzten 4 Wochen (Plan 3.2, Wächter H1): Einheiten des aktiven Plans vor heute, je Einheit
 * min(geplant, eingetragen), Startgruppe des bisherigen Plans aus planStartGroup(). null = Startumfang der Gruppe.
 */
export function startReferenceFromRows(
  rows: UserRows,
  active: ActivePlan | null,
  today: string,
): CompetitionStartReference | null {
  if (!active || !rows.profile) return null;
  return recentCompetitionStartReference(
    active.sessions,
    startGroupOf(active, rows.profile.birth_date),
    loggedEnduranceMinutes(rows),
    today,
  );
}

/** Angaben im Formular „Mein Wettkampf“ (vor Zod; Prüfung in packages/core). */
export interface CompetitionDraft {
  competition: CompetitionInput;
  longRunWeekday: number | null;
  ownStart: CompetitionOwnStart | null;
}

/** Warum kein Wettkampfplan möglich ist, auch wenn der Wettkampf selbst gespeichert werden kann. */
export type PlanBlocker =
  /** Angaben fehlen (Onboarding). */
  | 'incomplete'
  /** Hauptziel ist nicht Ausdauer (Nebenziel mit Datum folgt später, PLAN-ZIELE F15). */
  | 'goal_not_endurance';

export type DraftFeasibility =
  | { kind: 'blocked'; blocker: PlanBlocker }
  | { kind: 'result'; result: CompetitionFeasibilityResult; inputs: PlanInputsInput };

/**
 * Angaben für die Engine: wie planInputsFromRows, aber die Disziplin des Ziels = Disziplin des Wettkampfs (wählt die
 * Person im Formular eine andere Distanz, wird das Ziel beim Erstellen des Plans mit geändert).
 */
export function competitionPlanInputs(
  rows: UserRows,
  versions: ConsentVersions,
  draft: Pick<CompetitionDraft, 'competition'>,
): PlanInputsInput | PlanBlocker {
  const inputs = planInputsFromRows(rows, versions);
  if (!inputs) return 'incomplete';
  if (inputs.goalType !== 'endurance') return 'goal_not_endurance';
  return { ...inputs, discipline: draft.competition.discipline };
}

/** Zusatzangaben für die Engine (eigener Startumfang, Tagebuch-Bezug, Wunsch-Tag). */
export function competitionRequestFor(
  draft: CompetitionDraft,
  startReference: CompetitionStartReference | null,
): CompetitionRequest {
  return {
    competition: draft.competition,
    ownStart: draft.ownStart,
    startReference,
    longRunWeekday: draft.longRunWeekday,
  };
}

/** Ampel sofort beim Datum (Plan 8) – dieselbe Rechnung wie beim Erstellen. */
export function draftFeasibility(
  rows: UserRows,
  versions: ConsentVersions,
  active: ActivePlan | null,
  draft: CompetitionDraft,
  today: string,
): DraftFeasibility {
  const inputs = competitionPlanInputs(rows, versions, draft);
  if (typeof inputs === 'string') return { kind: 'blocked', blocker: inputs };
  const request = competitionRequestFor(draft, startReferenceFromRows(rows, active, today));
  return { kind: 'result', result: competitionFeasibility(inputs, request, today), inputs };
}

export interface CompetitionPlanBuild {
  /** Für save_competition (mit Plan-Bezug) – zwingend VOR save_training_plan (Wächter WP3 M2). */
  competition: SaveCompetitionPayload;
  result: GenerateCompetitionPlanResult;
  /** Die Disziplin des Ziels muss vorher geändert werden (Ziel ≠ Distanz des Wettkampfs). */
  goalDisciplineChange: boolean;
}

/**
 * Wettkampfplan erzeugen (generateCompetitionPlan) samt Eingabe von save_competition mit Plan-Bezug (wirksames Ziel aus
 * der Ampel, eigener Startumfang so wie eingegeben, Tagebuch-Bezug mit Startgruppe). Wirft nicht; ungültige Angaben →
 * `invalid_inputs` bzw. Blocker.
 */
export function buildCompetitionPlan(
  rows: UserRows,
  versions: ConsentVersions,
  active: ActivePlan | null,
  library: PlanLibrary,
  draft: CompetitionDraft,
  competitionId: string | null,
  today: string,
): CompetitionPlanBuild | PlanBlocker | 'invalid_inputs' {
  const inputs = competitionPlanInputs(rows, versions, draft);
  if (typeof inputs === 'string') return inputs;
  const startReference = startReferenceFromRows(rows, active, today);
  const result = generateCompetitionPlan(
    inputs,
    library,
    today,
    competitionRequestFor(draft, startReference),
  );
  const effectiveGoal: CompetitionGoal | null = result.ok
    ? (result.plan.competition?.feasibility.effectiveGoal ?? null)
    : null;
  try {
    const competition = toSaveCompetitionPayload({
      id: competitionId,
      competition: draft.competition,
      longRunWeekday: draft.longRunWeekday,
      plan:
        effectiveGoal === null ? null : { effectiveGoal, ownStart: draft.ownStart, startReference },
    });
    return {
      competition,
      result,
      goalDisciplineChange: rows.goals?.discipline !== draft.competition.discipline,
    };
  } catch {
    return 'invalid_inputs';
  }
}

/** Nur den Wettkampf speichern (Countdown, ohne Plan-Bezug). Ungültig → null. */
export function countdownPayload(
  draft: CompetitionDraft,
  competitionId: string | null,
): SaveCompetitionPayload | null {
  try {
    return toSaveCompetitionPayload({
      id: competitionId,
      competition: draft.competition,
      longRunWeekday: draft.longRunWeekday,
      plan: null,
    });
  } catch {
    return null;
  }
}

/**
 * Den gespeicherten Datensatz unverändert erneut senden (z. B. Name ändern): Plan-Bezug IMMER mitschicken (WP3
 * Präzisierung 3 – save_competition ersetzt den ganzen Datensatz).
 */
export function resavePayload(
  stored: StoredCompetition,
  draft: CompetitionDraft,
): SaveCompetitionPayload | null {
  try {
    return toSaveCompetitionPayload({
      id: stored.id,
      competition: draft.competition,
      longRunWeekday: draft.longRunWeekday,
      plan:
        stored.effectiveGoal === null
          ? null
          : {
              effectiveGoal: draft.competition.goal === 'time' ? stored.effectiveGoal : 'finish',
              ownStart: stored.ownStart,
              startReference: stored.startReference,
            },
    });
  } catch {
    return null;
  }
}

/** Formular-Vorgabe aus dem gespeicherten Wettkampf. */
export function draftFromStored(stored: StoredCompetition): CompetitionDraft {
  return {
    competition: { ...stored.competition },
    longRunWeekday: stored.longRunWeekday,
    ownStart: stored.ownStart,
  };
}

/** Level aus dem Profil (für die Wochenzahl harter Einheiten, Anzeige); unbekannt → Einsteiger (strenger). */
export function currentLevel(rows: UserRows): ExperienceLevel {
  const parsed = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  return parsed.success ? parsed.data : 'beginner';
}

export type CompetitionFollowUp =
  /** Kein Wettkampfplan (normaler Folgeblock gilt). */
  | { kind: 'not_competition' }
  | { kind: 'block'; sessions: SavePlanSession[] }
  /** Nichts anzuhängen (alles schon vorbei). */
  | { kind: 'none' }
  /**
   * Wettkampfplan endet bzw. passt nicht mehr (Zyklus fertig, Wettkampf abgesagt/erledigt, Regel aus Tabelle 3.3 neu,
   * Plan-Bezug nach Widerruf leer) → „Plan neu erstellen“ statt Folgeblock von der Spitze aus (WP1 M4, sichere
   * Voreinstellung).
   */
  | { kind: 'ended'; reason: 'cycle_finished' | 'not_available' | 'no_competition' };

/**
 * Folgeblock eines Wettkampfplans (WP1/WP3): Makrozyklus aus dem gespeicherten Wettkampf (storedCompetitionFromRow) +
 * competitionFollowUpBlock, dann nextPlanBlock mit `competitionWeeks`. Sicherheitsregeln und Level nach heute.
 */
export function competitionFollowUpFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  active: ActivePlan,
  rules: PlanSafetyRules,
  library: PlanLibrary,
  today: string,
): CompetitionFollowUp {
  if (!isCompetitionPlan(active)) return { kind: 'not_competition' };
  const snapshot = planSnapshot(active.plan);
  const planned = plannedCompetition(rows);
  if (
    !snapshot ||
    !rows.profile ||
    !planned ||
    planned.stored.effectiveGoal === null ||
    !isCompetitionDiscipline(snapshot.discipline) ||
    snapshot.discipline !== planned.stored.competition.discipline
  ) {
    return { kind: 'ended', reason: 'no_competition' };
  }
  const inputs = planInputsFromRows(rows, versions);
  if (!inputs) return { kind: 'ended', reason: 'no_competition' };
  const request: CompetitionRequest = {
    competition: planned.stored.competition,
    ownStart: planned.stored.ownStart,
    startReference: planned.stored.startReference,
    longRunWeekday: planned.stored.longRunWeekday,
  };
  const follow = competitionFollowUpBlock(
    // Schedule und Level wie gespeichert (Schnappschuss), Gesundheit/Alter nach heute.
    {
      ...inputs,
      goalType: snapshot.goalType,
      discipline: snapshot.discipline,
      experienceLevel: snapshot.experienceLevel,
      schedule: snapshot.schedule,
    },
    request,
    {
      planStart: active.plan.start_date,
      today,
      previous: active.sessions,
      effectiveGoal: planned.stored.effectiveGoal,
    },
  );
  if (!follow.ok) {
    return follow.reason === 'invalid_inputs'
      ? { kind: 'ended', reason: 'no_competition' }
      : { kind: 'ended', reason: follow.reason };
  }
  const loadWeeksBefore = new Set(
    active.sessions
      .filter((s) => s.week_no >= 1 && !s.is_deload)
      .map((s) => `${s.block_no}:${s.week_no}`),
  ).size;
  const sessions = nextPlanBlock(active.sessions, {
    schedule: snapshot.schedule,
    loadWeeks: loadWeeksBeforeDeload(snapshot.experienceLevel, rules.cautious),
    rules,
    library: library.exercises,
    profiles: profilesFor(snapshot),
    endurance: {
      goalType: snapshot.goalType,
      discipline: snapshot.discipline,
      experienceLevel: snapshot.experienceLevel,
    },
    loadWeeksBefore,
    previousStartGroup: startGroupOf(active, rows.profile.birth_date),
    protectLastCore: isBodyweightTemplateId(library, active.plan.template_id),
    competitionWeeks: follow.block.specs,
  });
  const upcoming = dropPastSessions(sessions, today);
  return upcoming.length > 0
    ? { kind: 'block', sessions: toAppendBlockPayload(upcoming) }
    : { kind: 'none' };
}

/** Tagebuch-Eintrag, der als Ergebnis zählt: eigener Ausdauer-Eintrag vom Renntag (neuester). */
export function resultLogCandidate(rows: UserRows, raceDate: string): string | null {
  const logs = rows.sessionLogs
    .filter((l) => l.kind === 'endurance' && l.performed_on === raceDate)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return logs[0]?.id ?? null;
}
