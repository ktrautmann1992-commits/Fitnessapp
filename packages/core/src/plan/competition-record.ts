import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  COMPETITION_DISTANCE_M,
  COMPETITION_INPUT_LIMITS,
  COMPETITION_OWN_START,
  COMPETITION_START_REFERENCE,
  TRAINING_LIMITS,
} from '../constants';
import { type CompetitionStartReference, competitionStartReferenceSchema } from './competition';
import {
  type Competition,
  type CompetitionDiscipline,
  competitionDisciplineSchema,
  type CompetitionGoal,
  type CompetitionInput,
  competitionInputSchema,
  type CompetitionOwnStart,
  COMPETITION_GOALS,
  type CompetitionStatus,
} from './competition-schema';
import { ENDURANCE_START_GROUPS, type EnduranceStartGroup } from './safety';

/**
 * Gespeicherter Wettkampf (Tabelle `competitions`, docs/PLAN-PHASE-10.md Abschnitt 7, Etappe WP3): Zeile, Eingabe von
 * `save_competition` und die Rück-Abbildung für Folgeblöcke. Nur Abbildung und Zod – die Regeln (Ampel, Makrozyklus)
 * bleiben in competition.ts/periodization.ts.
 *
 * Kein Gesundheitsdatum: Name (nur Anzeige), Disziplin, Datum, Ziel, Referenzzeit. Der **Plan-Bezug**
 * (`effective_goal`, eigener Startumfang, Tagebuch-Bezug mit Startgruppe) ist aus dem Gesundheits-Check abgeleitet
 * (vorsichtige Startgruppe, „nur Ankommen“ bei Flag/Alter) und wird deshalb wie ein Trainingsplan behandelt: nur mit
 * gültiger Einwilligung health_data und vorhandenem Check (`uses_health_data = true`, Server bestimmt das), beim
 * Widerruf geleert – der Wettkampf selbst bleibt (wie Strecken, W-G15). Ohne Plan-Bezug kein Wettkampfplan, der
 * Wettkampf (Countdown) bleibt gratis und ohne Einwilligung speicherbar.
 */

/** Spalten des Plan-Bezugs (beim Widerruf health_data geleert, private.consents_after_revoke). */
export const COMPETITION_PLAN_BASIS_COLUMNS = [
  'own_start_weekly_minutes',
  'start_reference_volume',
  'start_reference_session_cap',
  'start_reference_start_group',
  'effective_goal',
] as const;

/** Zeile aus `competitions` (= packages/db database.types.ts, Abgleich apps/mobile row-types.test.ts). */
export interface CompetitionRow {
  id: string;
  user_id: string;
  name: string;
  discipline: CompetitionDiscipline;
  /** Aus der Disziplin (COMPETITION_DISTANCE_M), setzt der Server. */
  distance_m: number;
  race_date: string;
  goal_kind: CompetitionGoal;
  target_time_s: number | null;
  reference_discipline: CompetitionDiscipline | null;
  reference_time_s: number | null;
  reference_date: string | null;
  long_run_weekday: number | null;
  status: CompetitionStatus;
  result_session_log_id: string | null;
  own_start_weekly_minutes: number | null;
  start_reference_volume: number | null;
  start_reference_session_cap: number | null;
  start_reference_start_group: EnduranceStartGroup | null;
  effective_goal: CompetitionGoal | null;
  uses_health_data: boolean;
  created_at: string;
  updated_at: string;
}

/** Eingabe von `save_competition` – genau die Felder von competition_keys (db-sync.test.ts). */
export interface SaveCompetitionPayload {
  /** null = neu anlegen; sonst einen eigenen GEPLANTEN Wettkampf ändern. */
  readonly id: string | null;
  readonly name: string;
  readonly discipline: CompetitionDiscipline;
  readonly race_date: string;
  readonly goal_kind: CompetitionGoal;
  readonly target_time_s: number | null;
  readonly reference_discipline: CompetitionDiscipline | null;
  readonly reference_time_s: number | null;
  readonly reference_date: string | null;
  readonly long_run_weekday: number | null;
  readonly own_start_weekly_minutes: number | null;
  readonly start_reference_volume: number | null;
  readonly start_reference_session_cap: number | null;
  readonly start_reference_start_group: EnduranceStartGroup | null;
  readonly effective_goal: CompetitionGoal | null;
}

const R = COMPETITION_START_REFERENCE;

function inputFromPayload(p: {
  readonly name: string;
  readonly discipline: CompetitionDiscipline;
  readonly race_date: string;
  readonly goal_kind: CompetitionGoal;
  readonly target_time_s: number | null;
  readonly reference_discipline: CompetitionDiscipline | null;
  readonly reference_time_s: number | null;
  readonly reference_date: string | null;
}): CompetitionInput {
  return {
    name: p.name,
    discipline: p.discipline,
    raceDate: p.race_date,
    goal: p.goal_kind,
    targetTimeS: p.target_time_s,
    reference:
      p.reference_discipline === null || p.reference_time_s === null || p.reference_date === null
        ? null
        : { discipline: p.reference_discipline, timeS: p.reference_time_s, date: p.reference_date },
  };
}

function startReferenceFromPayload(p: {
  readonly start_reference_volume: number | null;
  readonly start_reference_session_cap: number | null;
  readonly start_reference_start_group: EnduranceStartGroup | null;
}): CompetitionStartReference | null {
  if (p.start_reference_volume === null || p.start_reference_start_group === null) return null;
  return {
    volume: p.start_reference_volume,
    sessionCap: p.start_reference_session_cap,
    startGroup: p.start_reference_start_group,
  };
}

/**
 * Eingabe von save_competition (strikt, alle Felder Pflicht – wie private.assert_json_keys + `?&` in der Migration).
 * Gleiche Regeln wie competitionInputSchema (Name getrimmt 1–80, Zielzeit nur bei `time`, plausibel je Distanz, nur
 * mit Referenzzeit), competitionStartReferenceSchema und die CHECKs der Tabelle: Referenz ganz oder gar nicht und vor
 * dem Renntag, Plan-Bezug nur mit `effective_goal`, `effective_goal = time` nur bei Ziel `time`. Datumsfenster gegen
 * „heute“ (Renntag, Mindestvorlauf, Alter der Referenzzeit) prüfen competitionSchema und der Server.
 */
export const saveCompetitionPayloadSchema = z
  .strictObject({
    id: z.uuid().nullable(),
    name: z.string().min(1).max(COMPETITION_INPUT_LIMITS.nameMaxLength),
    discipline: competitionDisciplineSchema,
    race_date: isoDateSchema,
    goal_kind: z.enum(COMPETITION_GOALS),
    target_time_s: z.number().int().positive().nullable(),
    reference_discipline: competitionDisciplineSchema.nullable(),
    reference_time_s: z.number().int().positive().nullable(),
    reference_date: isoDateSchema.nullable(),
    long_run_weekday: z.number().int().min(1).max(7).nullable(),
    own_start_weekly_minutes: z
      .number()
      .int()
      .min(COMPETITION_OWN_START.minWeeklyMinutes)
      .max(TRAINING_LIMITS.minutesPerSession.max * 7)
      .nullable(),
    start_reference_volume: z.number().int().min(0).max(R.maxWeeklyMinutes).nullable(),
    start_reference_session_cap: z
      .number()
      .int()
      .min(R.minMinutes)
      .max(R.maxSessionMinutes)
      .nullable(),
    start_reference_start_group: z.enum(ENDURANCE_START_GROUPS).nullable(),
    effective_goal: z.enum(COMPETITION_GOALS).nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.name !== p.name.trim()) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Name mit Leerzeichen am Rand.' });
    }
    const refFields = [p.reference_discipline, p.reference_time_s, p.reference_date];
    if (refFields.some((v) => v === null) && refFields.some((v) => v !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reference_date'],
        message: 'Referenz unvollständig.',
      });
    }
    if (p.reference_date !== null && p.reference_date >= p.race_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['reference_date'],
        message: 'Die Referenzzeit liegt nicht vor dem Renntag.',
      });
    }
    const input = competitionInputSchema.safeParse(inputFromPayload(p));
    if (!input.success) {
      for (const issue of input.error.issues) {
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
    }
    const startFields = [p.start_reference_volume, p.start_reference_start_group];
    if (startFields.some((v) => v === null) && startFields.some((v) => v !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['start_reference_volume'],
        message: 'Bezug unvollständig.',
      });
    }
    if (p.start_reference_volume === null && p.start_reference_session_cap !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['start_reference_session_cap'],
        message: 'Längste Einheit ohne Bezug.',
      });
    }
    const start = startReferenceFromPayload(p);
    if (start !== null && !competitionStartReferenceSchema.safeParse(start).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['start_reference_volume'],
        message: 'Ungültiger Bezug.',
      });
    }
    if (
      p.effective_goal === null &&
      (p.own_start_weekly_minutes !== null || p.start_reference_volume !== null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['effective_goal'],
        message: 'Plan-Bezug nur zusammen mit dem wirksamen Ziel.',
      });
    }
    if (p.effective_goal === 'time' && p.goal_kind !== 'time') {
      ctx.addIssue({
        code: 'custom',
        path: ['effective_goal'],
        message: 'Zielzeit wirkt nur beim Ziel „Zielzeit“.',
      });
    }
  });

/** Was zum Wettkampfplan gespeichert wird (sonst rechnet ein Folgeblock einen anderen Makrozyklus, WP1 „Offen“). */
export interface CompetitionPlanBasis {
  /** Ampel beim Erstellen (`feasibility.effectiveGoal`). */
  readonly effectiveGoal: CompetitionGoal;
  /** Eigener Startumfang (W-G5, bestätigt) – so wie eingegeben; ob/wie hoch er gilt, rechnet Core neu. */
  readonly ownStart?: CompetitionOwnStart | null;
  /** Tagebuch-Bezug beim Erstellen (mit Startgruppe des bisherigen Plans, Wächter H1). */
  readonly startReference?: CompetitionStartReference | null;
}

/**
 * Eingabe für save_competition aus dem Wettkampf (Zod-geprüft und getrimmt), dem Wunsch-Tag des langen Laufs und – nur
 * beim Erstellen eines Wettkampfplans – dem Plan-Bezug. `plan` null = nur der Wettkampf (Countdown, ohne Plan).
 * Wirft bei ungültigen Angaben (ZodError) – Programmierfehler laut melden.
 */
export function toSaveCompetitionPayload(params: {
  readonly id: string | null;
  readonly competition: CompetitionInput;
  readonly longRunWeekday?: number | null;
  readonly plan: CompetitionPlanBasis | null;
}): SaveCompetitionPayload {
  const c: Competition = competitionInputSchema.parse(params.competition);
  const plan = params.plan;
  const start = plan?.startReference ?? null;
  const payload: SaveCompetitionPayload = {
    id: params.id,
    name: c.name,
    discipline: c.discipline,
    race_date: c.raceDate,
    goal_kind: c.goal,
    target_time_s: c.targetTimeS,
    reference_discipline: c.reference?.discipline ?? null,
    reference_time_s: c.reference?.timeS ?? null,
    reference_date: c.reference?.date ?? null,
    long_run_weekday: params.longRunWeekday ?? null,
    own_start_weekly_minutes: plan?.ownStart?.weeklyMinutes ?? null,
    start_reference_volume: start?.volume ?? null,
    start_reference_session_cap: start?.sessionCap ?? null,
    start_reference_start_group: start?.startGroup ?? null,
    effective_goal: plan?.effectiveGoal ?? null,
  };
  return saveCompetitionPayloadSchema.parse(payload);
}

/** Gespeicherter Wettkampf als Eingaben der Engine (Folgeblock: competitionFollowUpBlock, Ampel, Countdown). */
export interface StoredCompetition {
  readonly id: string;
  readonly status: CompetitionStatus;
  readonly competition: Competition;
  /** Für CompetitionRequest: eigener Startumfang, Tagebuch-Bezug, Wunsch-Tag des langen Laufs. */
  readonly ownStart: CompetitionOwnStart | null;
  readonly startReference: CompetitionStartReference | null;
  readonly longRunWeekday: number | null;
  /** null = ohne Wettkampfplan gespeichert (oder Plan-Bezug nach dem Widerruf geleert). */
  readonly effectiveGoal: CompetitionGoal | null;
  readonly resultSessionLogId: string | null;
}

/**
 * Zeile → Engine-Eingaben. Unlesbare Zeilen (sollte die Datenbank nie liefern) → null, damit niemand mit falschen
 * Werten plant. Kein Datumsfenster gegen „heute“ (ein gespeicherter Wettkampf darf in der Vergangenheit liegen).
 */
export function storedCompetitionFromRow(
  row: Pick<
    CompetitionRow,
    | 'id'
    | 'status'
    | 'name'
    | 'discipline'
    | 'race_date'
    | 'goal_kind'
    | 'target_time_s'
    | 'reference_discipline'
    | 'reference_time_s'
    | 'reference_date'
    | 'long_run_weekday'
    | 'own_start_weekly_minutes'
    | 'start_reference_volume'
    | 'start_reference_session_cap'
    | 'start_reference_start_group'
    | 'effective_goal'
    | 'result_session_log_id'
  >,
): StoredCompetition | null {
  const parsed = saveCompetitionPayloadSchema.safeParse({
    id: null,
    name: row.name,
    discipline: row.discipline,
    race_date: row.race_date,
    goal_kind: row.goal_kind,
    target_time_s: row.target_time_s,
    reference_discipline: row.reference_discipline,
    reference_time_s: row.reference_time_s,
    reference_date: row.reference_date,
    long_run_weekday: row.long_run_weekday,
    own_start_weekly_minutes: row.own_start_weekly_minutes,
    start_reference_volume: row.start_reference_volume,
    start_reference_session_cap: row.start_reference_session_cap,
    start_reference_start_group: row.start_reference_start_group,
    effective_goal: row.effective_goal,
  });
  if (!parsed.success) return null;
  const p = parsed.data;
  const competition = competitionInputSchema.parse(inputFromPayload(p));
  return {
    id: row.id,
    status: row.status,
    competition,
    ownStart:
      p.own_start_weekly_minutes === null
        ? null
        : { weeklyMinutes: p.own_start_weekly_minutes, confirmed: true },
    startReference: startReferenceFromPayload(p),
    longRunWeekday: p.long_run_weekday,
    effectiveGoal: p.effective_goal,
    resultSessionLogId: row.result_session_log_id,
  };
}

/** Distanz der Disziplin in Metern (= competitions.distance_m, CHECK in der Migration). */
export function competitionDistanceM(discipline: CompetitionDiscipline): number {
  return COMPETITION_DISTANCE_M[discipline];
}
