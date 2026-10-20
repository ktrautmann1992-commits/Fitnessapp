import {
  type CompetitionFeasibility,
  type CompetitionFeasibilityResult,
  type CompetitionGoal,
  type CompetitionInput,
  type CompetitionOwnStart,
  type CompetitionRequest,
  type CompetitionStartReference,
  competitionFeasibility,
  COMPETITION_GROUP_RULES,
  competitionFollowUpBlock,
  competitionPaceProfile,
  competitionPlanFit,
  type CompetitionPlanFit,
  competitionPlanWeek,
  type CompetitionPlanWeek,
  type PaceProfile,
  prepareSessionForDisplay,
  shortDaysWithoutHard,
  startOfIsoWeek,
  hardWorkoutLimits,
  type StoredSession,
  competitionToShow,
  dropPastSessions,
  experienceLevelSchema,
  type ExperienceLevel,
  type GenerateCompetitionPlanResult,
  generateCompetitionPlan,
  isCompetitionDiscipline,
  isBodyweightTemplateId,
  isStricterGroup,
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

import { competitionDisplayLevel } from './competition-level';
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

const LEVEL_ORDER: readonly ExperienceLevel[] = ['beginner', 'advanced', 'competitive'];

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
  | {
      kind: 'ended';
      /**
       * `unreachable` (Wächter WP4 M7): Level bzw. Startgruppe sind strenger geworden und die Ampel sagt für den
       * Wettkampf jetzt „zu kurz“/„nicht möglich“ – nicht still mit kleinerem Umfang weiter, sondern Hinweis.
       */
      reason: 'cycle_finished' | 'not_available' | 'no_competition' | 'unreachable';
    };

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
  // Wächter WP4 M7: Ist die Gruppe bzw. das Level strenger als beim Erstellen, die Ampel neu prüfen – reicht die Zeit
  // nach den neuen Regeln nicht mehr, endet der Wettkampfplan mit Hinweis („Plan neu erstellen“).
  const stricter =
    isStricterGroup(rules.enduranceStartGroup, startGroupOf(active, rows.profile.birth_date)) ||
    LEVEL_ORDER.indexOf(inputs.experienceLevel) < LEVEL_ORDER.indexOf(snapshot.experienceLevel);
  if (stricter) {
    const check = competitionFeasibility(
      inputs,
      {
        competition: planned.stored.competition,
        ownStart: planned.stored.ownStart,
        startReference: startReferenceFromRows(rows, active, today),
        longRunWeekday: planned.stored.longRunWeekday,
      },
      today,
    );
    if (
      !check.ok ||
      check.feasibility.status === 'too_short' ||
      check.feasibility.status === 'not_available'
    ) {
      return { kind: 'ended', reason: 'unreachable' };
    }
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

// ---------------------------------------------------------------------------------------------------------
// Passt der Plan noch zum Wettkampf? Was darf beim Ändern gespeichert werden? (Wächter WP4 H1/M4)
// ---------------------------------------------------------------------------------------------------------

/**
 * Stand des aktiven Plans gegenüber dem geplanten Wettkampf: `null` = kein Wettkampfplan aktiv (Grundlagen-Plan) bzw.
 * kein geplanter Wettkampf; sonst `competitionPlanFit` aus packages/core (Plan-Bezug, Disziplin, Phasen zum Renntag).
 * Nur bei `fits` zeigt die App Phasen-Band und Pace.
 */
export function competitionPlanFitFromRows(
  rows: UserRows,
  active: ActivePlan | null,
): CompetitionPlanFit | null {
  if (!active || !isCompetitionPlan(active)) return null;
  const planned = plannedCompetition(rows);
  if (!planned) return null;
  return competitionPlanFit({
    sessions: active.sessions,
    planStart: active.plan.start_date,
    planDiscipline: planSnapshot(active.plan)?.discipline ?? null,
    competition: {
      discipline: planned.stored.competition.discipline,
      raceDate: planned.stored.competition.raceDate,
      effectiveGoal: planned.stored.effectiveGoal,
    },
  });
}

/**
 * Bleibt der Plan-Bezug gültig? Nur der Name darf sich ändern. Distanz (auch die Rad-Distanz in km), Renntag, Ziel,
 * Zielzeit, Referenz, eigener
 * Startumfang (immer der gespeicherte Wert, unabhängig vom aktuellen Level) und der Wunsch-Tag des langen Laufs sind
 * plan-relevant – sonst rechnete ein Folgeblock einen anderen Makrozyklus als die Ampel beim Erstellen.
 */
export function planBasisChanged(stored: StoredCompetition, draft: CompetitionDraft): boolean {
  const x = stored.competition;
  const y = draft.competition;
  return !(
    x.discipline === y.discipline &&
    // WP5: Rad-Distanz (Distanzklasse bestimmt Mindestvorlauf und Spitzenumfang).
    (x.distanceKm ?? null) === (y.distanceKm ?? null) &&
    x.raceDate === y.raceDate &&
    (x.goal ?? 'finish') === (y.goal ?? 'finish') &&
    (x.targetTimeS ?? null) === (y.targetTimeS ?? null) &&
    JSON.stringify(x.reference ?? null) === JSON.stringify(y.reference ?? null) &&
    (stored.ownStart?.weeklyMinutes ?? null) === (draft.ownStart?.weeklyMinutes ?? null) &&
    (stored.longRunWeekday ?? null) === (draft.longRunWeekday ?? null)
  );
}

/** Was „Mein Wettkampf → Ändern“ beim Speichern anbieten darf. */
export interface CompetitionSaveOptions {
  /** Nur den Wettkampf speichern (Countdown bzw. unveränderter Plan-Bezug). */
  saveOnly: 'resave' | 'countdown' | null;
  /** „Speichern und (Wettkampf-)Plan neu erstellen“ – nur bei passender Ampel. */
  recreateCompetitionPlan: boolean;
  /** „Speichern und Plan ohne Wettkampf neu erstellen“ (bei aktivem Wettkampfplan, wenn er nicht mehr passt). */
  recreateBasicPlan: boolean;
}

/**
 * Regel (Wächter WP4 H1): Läuft ein Wettkampfplan und ändern sich plan-relevante Angaben, gibt es KEIN „nur Countdown
 * speichern“ – der alte Plan passte sonst nicht mehr zum Renntag (z. B. langer Lauf am Vortag, kein Tapering). Dann nur
 * „… und Plan neu erstellen“ (Ampel grün/gelb) oder „… und Plan ohne Wettkampf neu erstellen“.
 */
export function competitionSaveOptions(params: {
  stored: StoredCompetition | null;
  draft: CompetitionDraft;
  competitionPlanActive: boolean;
  feasibilityUsable: boolean;
}): CompetitionSaveOptions {
  const { stored, draft, competitionPlanActive, feasibilityUsable } = params;
  const changed = stored === null || planBasisChanged(stored, draft);
  if (!changed) {
    return {
      saveOnly: stored?.effectiveGoal !== null ? 'resave' : 'countdown',
      recreateCompetitionPlan: feasibilityUsable,
      recreateBasicPlan: false,
    };
  }
  if (stored !== null && competitionPlanActive) {
    return {
      saveOnly: null,
      recreateCompetitionPlan: feasibilityUsable,
      recreateBasicPlan: true,
    };
  }
  return {
    saveOnly: 'countdown',
    recreateCompetitionPlan: feasibilityUsable,
    recreateBasicPlan: false,
  };
}

/** Was „Heute“ zum Wettkampfplan zeigt – nur bei `fits` Phasen-Band und Pace (Wächter WP4 H1). */
export interface CompetitionPlanView {
  fit: CompetitionPlanFit | null;
  week: CompetitionPlanWeek | null;
  paceProfile: PaceProfile | null;
  /** Wettkampfplan aktiv, passt aber nicht (mehr) zum geplanten Wettkampf → Hinweis + „Plan neu erstellen“. */
  mismatch: boolean;
  /** Aufbau/Spitze ohne harte Einheit, weil die Tage zu kurz sind (Wächter WP4 M8, G10) → erklärender Hinweis. */
  shortDays: boolean;
}

export function competitionPlanView(
  rows: UserRows,
  active: ActivePlan | null,
  date: string,
  /** Offline-Zwischenspeicher ohne Plan-Bezug: „passt nicht“ wäre falsch – dann nur nichts zeigen (Wächter N5). */
  offline = false,
  /** Aktuelle Sicherheitsregeln (für den Hinweis „Tage zu kurz“); null = kein Hinweis. */
  rules: PlanSafetyRules | null = null,
): CompetitionPlanView {
  const fit = competitionPlanFitFromRows(rows, active);
  const planned = plannedCompetition(rows);
  if (fit !== 'fits' || !planned || !active) {
    return {
      fit,
      week: null,
      paceProfile: null,
      mismatch: fit !== null && !(offline && fit === 'no_basis'),
      shortDays: false,
    };
  }
  const monday = startOfIsoWeek(date);
  const shortDays =
    rules !== null &&
    shortDaysWithoutHard(
      active.sessions.filter((s) => startOfIsoWeek(s.scheduled_on) === monday),
      hardWorkoutLimits(rules, competitionDisplayLevel(rows, planSnapshot(active.plan))).allowed,
    );
  return {
    fit,
    week: competitionPlanWeek(
      active.sessions,
      active.plan.start_date,
      planned.stored.competition.raceDate,
      date,
    ),
    paceProfile: competitionPaceProfile(planned.stored.competition),
    mismatch: false,
    shortDays,
  };
}

/**
 * Namen der Ausdauer-Einheiten so, wie sie nach den AKTUELLEN Regeln angezeigt werden (Wächter WP4 M2): Kalender und
 * Wochenübersicht zeigen dann „Lockerer Dauerlauf“ statt des gespeicherten „Intervalle“, wenn eine harte Einheit wegen
 * Flag, Schwangerschaft oder strengerem Level locker wird. Gleicher Weg wie „Heute“ (prepareSessionForDisplay mit
 * competitionWeek). Ohne Regeln (offline ohne Zwischenspeicher) bleiben die gespeicherten Namen.
 */
export function displayedSessionNames(
  rows: UserRows,
  active: ActivePlan | null,
  rules: PlanSafetyRules | null,
): Map<string, string> {
  const names = new Map<string, string>();
  if (!active || !rules || !rows.profile) return names;
  const previousStartGroup = startGroupOf(active, rows.profile.birth_date);
  const level = competitionDisplayLevel(rows, planSnapshot(active.plan));
  for (const s of active.sessions) {
    if (s.kind !== 'endurance') continue;
    const shown = prepareSessionForDisplay(s, {
      rules,
      previousStartGroup,
      library: null,
      ...(s.workout_type ? { competitionWeek: { sessions: active.sessions, level } } : {}),
    }).session;
    if (shown.name_de !== s.name_de) names.set(s.id, shown.name_de);
  }
  return names;
}

/** Einheiten mit den angezeigten Namen (nur Anzeige – IDs, Tage und Status bleiben). */
export function withDisplayedNames<T extends Pick<StoredSession, 'id' | 'name_de'>>(
  sessions: readonly T[],
  names: ReadonlyMap<string, string>,
): T[] {
  return sessions.map((s) => {
    const name = names.get(s.id);
    return name === undefined ? s : { ...s, name_de: name };
  });
}

/**
 * Ergebnis idempotent (Wächter WP4 M6): Gibt es schon den Ergebnis-Eintrag dieses Ablaufs (gemerkte ID bzw. freier
 * Ausdauer-Eintrag vom Renntag, dessen Notiz mit `resultPrefix` beginnt), wird er wiederverwendet – nie ein zweiter
 * Tagebuch-Eintrag, wenn nach dem Speichern nur das Abschließen scheiterte.
 */
export function resultLogToReuse(
  rows: Pick<UserRows, 'sessionLogs'>,
  raceDate: string,
  savedLogId: string | null,
  resultPrefix: string,
): string | null {
  if (savedLogId !== null && rows.sessionLogs.some((l) => l.id === savedLogId)) return savedLogId;
  const own = rows.sessionLogs
    .filter(
      (l) =>
        l.kind === 'endurance' &&
        l.is_free === true &&
        l.performed_on === raceDate &&
        (l.notes ?? '').startsWith(resultPrefix),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return own[0]?.id ?? null;
}

/**
 * Darf „Zielzeit“ überhaupt angeboten werden (Plan 8 „nur wenn erlaubt“, Wächter N8)? Nur Fortgeschritten/
 * Leistungssport außerhalb der vorsichtigen Startgruppe (Flag, unter 18, ab 65, ohne Check) – wie die Ampel
 * (goal_time_not_allowed). Unbekannte Regeln → nein.
 */
export function timeGoalOffered(rows: UserRows, rules: PlanSafetyRules | null): boolean {
  if (!rules || rules.enduranceStartGroup === 'cautious' || rules.medicalNotice) return false;
  return (COMPETITION_GROUP_RULES.timeGoalLevels as readonly string[]).includes(currentLevel(rows));
}

/**
 * Was die Ampel zeigt und ob ein Wettkampfplan erstellt werden darf – gleich im Formular und in der Übersicht.
 * Lehnt der Server bzw. Testmodus den Plan als „nicht machbar“ ab, hat dieses Ergebnis Vorrang.
 */
export interface ShownFeasibility {
  shown: CompetitionFeasibility | null;
  /** Ampel „Passt“ oder „Knapp“. */
  usable: boolean;
  /** „Wettkampfplan erstellen“ anbieten (Ampel passt und es gibt Engine-Angaben, kein Blocker). */
  canCreate: boolean;
}

export function shownFeasibility(
  feasibility: DraftFeasibility | null,
  rejected: CompetitionFeasibility | null,
): ShownFeasibility {
  const result = feasibility?.kind === 'result' ? feasibility.result : null;
  const shown = rejected ?? (result?.ok ? result.feasibility : null);
  const usable = shown !== null && (shown.status === 'ok' || shown.status === 'tight');
  return { shown, usable, canCreate: usable && feasibility?.kind === 'result' };
}

/** Text zum Plan-Stand in der Übersicht „Mein Wettkampf“. */
export type OverviewPlanState =
  /** Der aktive Plan ist der passende Wettkampfplan. */
  | 'competition'
  /** Grundlagen-Plan, Ampel steht darunter. */
  | 'basic'
  /** Grundlagen-Plan, Renntag ist heute oder vorbei (keine Ampel mehr). */
  | 'basic_race_over'
  /** Wettkampfplan passt nicht mehr, Ampel steht darunter. */
  | 'mismatch'
  /** Wettkampfplan passt nicht mehr, Renntag ist heute oder vorbei. */
  | 'mismatch_race_over'
  /** Offline ohne Plan-Bezug: Stand unbekannt (Wächter WP4 N5). */
  | 'offline_unknown';

export interface CompetitionOverview {
  planState: OverviewPlanState;
  /**
   * Ampel für den gespeicherten Wettkampf – dieselbe Rechnung wie im Formular (`draftFeasibility` mit den gespeicherten
   * Angaben). `null` = keine Ampel (Wettkampfplan passt, Renntag erreicht oder Stand offline unbekannt).
   */
  ampel: { draft: CompetitionDraft; feasibility: DraftFeasibility } | null;
}

/**
 * Übersicht „Mein Wettkampf“ bei geplantem Wettkampf: Ist der aktuelle Plan KEIN passender Wettkampfplan, zeigt die
 * Übersicht die Ampel direkt (Gründer-Feedback 19.10.2026: „Ampel“ war nur im Formular sichtbar). `null` = kein
 * geplanter Wettkampf.
 */
export function competitionOverview(params: {
  rows: UserRows;
  versions: ConsentVersions;
  active: ActivePlan | null;
  today: string;
  offline: boolean;
}): CompetitionOverview | null {
  const { rows, versions, active, today, offline } = params;
  const planned = plannedCompetition(rows);
  if (!planned) return null;
  const fit = competitionPlanFitFromRows(rows, active);
  if (fit === 'fits') return { planState: 'competition', ampel: null };
  if (offline && fit === 'no_basis') return { planState: 'offline_unknown', ampel: null };
  const basic = fit === null;
  if (planned.stored.competition.raceDate <= today) {
    return { planState: basic ? 'basic_race_over' : 'mismatch_race_over', ampel: null };
  }
  const draft = draftFromStored(planned.stored);
  return {
    planState: basic ? 'basic' : 'mismatch',
    ampel: { draft, feasibility: draftFeasibility(rows, versions, active, draft, today) },
  };
}
