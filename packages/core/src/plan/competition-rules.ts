import { ageInYears } from '../age';
import {
  AGE_PLAN_RULES,
  COMPETITION_INPUT_LIMITS,
  COMPETITION_INTENSITY,
  COMPETITION_LEAD_WEEKS,
  COMPETITION_LONG_RUN,
  COMPETITION_RECORD_LIMITS,
} from '../constants';
import { minimumLeadWeeks, minorPlanAllowed } from './competition';
import { addDays, startOfIsoWeek } from '../dates';
import type { ExperienceLevel } from '../enums';
import {
  competitionDistanceM,
  type SaveCompetitionPayload,
  saveCompetitionPayloadSchema,
} from './competition-record';
import type { CompetitionDiscipline, CompetitionStatus } from './competition-schema';
import { isHardSession, isHardWorkoutType, type WorkoutStep, type WorkoutType } from './intensity';

/**
 * Regeln der Datenbank-Funktionen zum Wettkampf als reine Funktionen (docs/PLAN-PHASE-10.md Abschnitt 7, WP3 →
 * Testmodus in WP4): `save_competition`, `cancel_competition`, `complete_competition` und die Regeln je Person aus
 * `private.insert_plan_sessions`. Der Testmodus (apps/mobile local-backend) prüft damit genau wie der Server; die
 * Gründe entsprechen den festen Fehlertexten der Migration (20261016140200_competition_rpcs.sql), die App zeigt für
 * beide Betriebsarten denselben deutschen Text.
 */

export const COMPETITION_ERROR_REASONS = [
  /** Es gibt schon einen geplanten Wettkampf (W-G9). */
  'competition_exists',
  /** Renntag nicht nach heute, mehr als 52 Wochen entfernt oder unter dem Mindestvorlauf der lockersten Spalte. */
  'race_date',
  /** Referenzzeit in der Zukunft oder älter als 183 Tage. */
  'reference_date',
  /** Plan-Bezug ohne gültige Einwilligung bzw. ohne Gesundheits-Check. */
  'health_check_required',
  /**
   * Tabelle 3.3: Schwangerschaft, unter 18 kein Marathon (WP5: kein Triathlon Olympisch, Rad höchstens 100 km),
   * Zielzeit nicht erlaubt.
   */
  'not_allowed',
  /** Wettkampf fehlt, gehört jemand anderem, ist nicht (mehr) geplant bzw. schon abgesagt. */
  'not_found',
  'not_planned',
  /** Ergebnis: Renntag in der Zukunft bzw. Eintrag passt nicht (kein eigener Ausdauer-Eintrag vom Renntag). */
  'result_rejected',
  /** Ungültige Angaben (Form, Grenzen). */
  'invalid',
] as const;
export type CompetitionErrorReason = (typeof COMPETITION_ERROR_REASONS)[number];

export type CompetitionCheck =
  { readonly ok: true } | { readonly ok: false; readonly reason: CompetitionErrorReason };

const OK: CompetitionCheck = { ok: true };
const fail = (reason: CompetitionErrorReason): CompetitionCheck => ({ ok: false, reason });

/** Was save_competition über die Person weiß (Profil, Einwilligung, neuester Check). */
export interface SaveCompetitionContext {
  readonly today: string;
  readonly birthDate: string;
  /** private.plan_health_basis(): gültige Einwilligung health_data UND Gesundheits-Check vorhanden. */
  readonly usesHealthData: boolean;
  readonly medicalNotice: boolean;
  /** Neuester Check meldet Schwangerschaft. */
  readonly pregnancy: boolean;
  /** Alle eigenen Wettkämpfe. */
  readonly existing: readonly {
    readonly id: string;
    readonly status: CompetitionStatus;
    readonly discipline: CompetitionDiscipline;
    /** Distanz in Metern (Rad: frei, WP5) – eine Änderung prüft den Renntag neu (Mindestvorlauf je Distanzklasse). */
    readonly distance_m: number;
    readonly race_date: string;
    readonly reference_discipline: CompetitionDiscipline | null;
    readonly reference_time_s: number | null;
    readonly reference_date: string | null;
  }[];
}

/**
 * Server-Mindestvorlauf: lockerste Spalte (Leistungssport, COMPETITION_RECORD_LIMITS.leadWeeksServerColumn); Rad je
 * Distanzklasse (WP5).
 */
export function serverMinimumLeadWeeks(
  discipline: CompetitionDiscipline,
  distanceKm: number | null = null,
): number {
  const column = COMPETITION_RECORD_LIMITS.leadWeeksServerColumn;
  if (discipline === 'cycling') return minimumLeadWeeks(discipline, column, distanceKm);
  return COMPETITION_LEAD_WEEKS.minimum[discipline][column];
}

/** = public.save_competition (Reihenfolge der Prüfungen wie dort). */
export function checkSaveCompetition(
  payload: SaveCompetitionPayload,
  ctx: SaveCompetitionContext,
): CompetitionCheck {
  if (!saveCompetitionPayloadSchema.safeParse(payload).success) return fail('invalid');
  const age = ageInYears(ctx.birthDate, ctx.today);
  if (payload.effective_goal !== null) {
    if (!ctx.usesHealthData) return fail('health_check_required');
    if (ctx.pregnancy) return fail('not_allowed');
    if (
      age < AGE_PLAN_RULES.minor.belowAge &&
      !minorPlanAllowed(payload.discipline, payload.distance_km ?? null)
    ) {
      return fail('not_allowed');
    }
    if (
      payload.effective_goal === 'time' &&
      (ctx.medicalNotice ||
        age < AGE_PLAN_RULES.minor.belowAge ||
        age >= AGE_PLAN_RULES.senior.fromAge)
    ) {
      return fail('not_allowed');
    }
  }
  let datesChanged = true;
  let referenceChanged = true;
  if (payload.id !== null) {
    const existing = ctx.existing.find((c) => c.id === payload.id);
    if (!existing) return fail('not_found');
    if (existing.status !== 'planned') return fail('not_planned');
    datesChanged =
      existing.race_date !== payload.race_date ||
      existing.discipline !== payload.discipline ||
      existing.distance_m !== competitionDistanceM(payload.discipline, payload.distance_km ?? null);
    referenceChanged =
      existing.reference_discipline !== payload.reference_discipline ||
      existing.reference_time_s !== payload.reference_time_s ||
      existing.reference_date !== payload.reference_date;
  }
  if (datesChanged) {
    const latest = addDays(ctx.today, COMPETITION_LEAD_WEEKS.maxLeadWeeks * 7);
    if (payload.race_date <= ctx.today || payload.race_date > latest) return fail('race_date');
    if (
      payload.race_date <
      addDays(
        ctx.today,
        serverMinimumLeadWeeks(payload.discipline, payload.distance_km ?? null) * 7,
      )
    ) {
      return fail('race_date');
    }
  }
  if (
    referenceChanged &&
    payload.reference_date !== null &&
    (payload.reference_date > ctx.today ||
      payload.reference_date < addDays(ctx.today, -COMPETITION_INPUT_LIMITS.referenceMaxAgeDays))
  ) {
    return fail('reference_date');
  }
  if (payload.id === null && ctx.existing.some((c) => c.status === 'planned')) {
    return fail('competition_exists');
  }
  return OK;
}

/** = public.cancel_competition. */
export function checkCancelCompetition(
  id: string,
  existing: readonly { readonly id: string; readonly status: CompetitionStatus }[],
): CompetitionCheck {
  const c = existing.find((x) => x.id === id);
  if (!c) return fail('not_found');
  return c.status === 'planned' ? OK : fail('not_planned');
}

/** = public.complete_competition (Ergebnis: eigener Ausdauer-Eintrag vom Renntag, optional). */
export function checkCompleteCompetition(
  id: string,
  logId: string | null,
  ctx: {
    readonly today: string;
    readonly existing: readonly {
      readonly id: string;
      readonly status: CompetitionStatus;
      readonly race_date: string;
    }[];
    readonly logs: readonly {
      readonly id: string;
      readonly kind: string;
      readonly performed_on: string;
    }[];
  },
): CompetitionCheck {
  const c = ctx.existing.find((x) => x.id === id);
  if (!c) return fail('not_found');
  if (c.status === 'cancelled') return fail('not_planned');
  if (c.race_date > ctx.today) return fail('result_rejected');
  if (
    logId !== null &&
    !ctx.logs.some(
      (l) => l.id === logId && l.kind === 'endurance' && l.performed_on === c.race_date,
    )
  ) {
    return fail('result_rejected');
  }
  return OK;
}

/** Eine Einheit, wie private.insert_plan_sessions sie für die Regeln je Person liest. */
export interface PersonRuleSession {
  readonly kind: string;
  readonly scheduled_on: string;
  readonly status?: string;
  readonly estimated_minutes: number;
  readonly effort_target: number | null;
  readonly workout_type?: WorkoutType | null;
  readonly workout_steps?: readonly WorkoutStep[] | null;
}

export interface PersonRuleContext {
  readonly today: string;
  readonly birthDate: string;
  /** Plan (user_plans): Gesundheitsbezug, Arzt-Hinweis, Level und Disziplin der Angaben. */
  readonly plan: {
    readonly usesHealthData: boolean;
    readonly medicalNotice: boolean;
    readonly level: ExperienceLevel | null;
    readonly discipline: string | null;
  };
  readonly profileLevel: ExperienceLevel | null;
  readonly pregnancy: boolean;
  /** Eigener GEPLANTER Wettkampf (null = keiner) – Plan-Bezug = uses_health_data. */
  readonly competition: {
    readonly discipline: CompetitionDiscipline;
    /** Distanz in Metern (= competitions.distance_m; Rad frei, WP5). */
    readonly distanceM: number;
    readonly usesHealthData: boolean;
  } | null;
}

/**
 * Regeln je Person für Wettkampf-Einheiten (= private.insert_plan_sessions, Wächter N2 zu WP2 und WP3 M1/M2/H1).
 * `block` = neue Einheiten; `planSessions` = ALLE Einheiten des Plans nach dem Speichern (für die Wochenzahl harter
 * Einheiten, gestrichene zählen nicht). Ohne Einheit mit Art im Block: immer ok (Pläne ohne Wettkampf).
 */
export function checkCompetitionSessions(
  block: readonly PersonRuleSession[],
  planSessions: readonly PersonRuleSession[],
  ctx: PersonRuleContext,
): CompetitionCheck {
  const typed = block.filter((s) => s.workout_type !== undefined && s.workout_type !== null);
  if (typed.length === 0) return OK;
  if (!ctx.plan.usesHealthData) return fail('health_check_required');
  if (ctx.pregnancy) return fail('not_allowed');
  const age = ageInYears(ctx.birthDate, ctx.today);
  const minor = age < AGE_PLAN_RULES.minor.belowAge;
  const senior = age >= AGE_PLAN_RULES.senior.fromAge;
  const competition = ctx.competition;
  if (!competition || !competition.usesHealthData) return fail('not_found');
  // Unter 18 höchstens Halbmarathon (W-G4); WP5: Triathlon nur Sprint, Rad höchstens 100 km (minorPlanAllowed).
  const distanceKm = competition.discipline === 'cycling' ? competition.distanceM / 1000 : null;
  if (minor && !minorPlanAllowed(competition.discipline, distanceKm)) return fail('not_allowed');
  if (ctx.plan.discipline !== competition.discipline) return fail('invalid');
  const maxMinutes = COMPETITION_LONG_RUN.maxMinutes[competition.discipline];
  if (typed.some((s) => s.estimated_minutes > maxMinutes)) return fail('invalid');
  const caps = COMPETITION_INTENSITY.hardEffortCap;
  const cap = minor ? caps.minor : senior ? caps.senior : caps.general;
  if (
    typed.some(
      (s) => (s.effort_target ?? 0) > cap || (s.workout_steps ?? []).some((st) => st.effort > cap),
    )
  ) {
    return fail('not_allowed');
  }
  if (
    ctx.plan.medicalNotice &&
    typed.some(
      (s) =>
        isHardWorkoutType(s.workout_type) ||
        (s.workout_steps ?? []).some((st) => st.effort >= COMPETITION_INTENSITY.hardEffortMin),
    )
  ) {
    return fail('not_allowed');
  }
  const perWeek =
    (ctx.plan.level !== 'advanced' && ctx.plan.level !== 'competitive') ||
    ctx.profileLevel === 'beginner' ||
    ctx.plan.medicalNotice ||
    minor ||
    senior
      ? COMPETITION_INTENSITY.hardSessionsPerWeek.strict
      : COMPETITION_INTENSITY.hardSessionsPerWeek.general;
  const counts = new Map<string, number>();
  for (const s of planSessions) {
    if (s.status === 'skipped' || !s.workout_type) continue;
    if (!isHardSession(s.workout_type, s.workout_steps)) continue;
    const week = startOfIsoWeek(s.scheduled_on);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  if ([...counts.values()].some((n) => n > perWeek)) return fail('not_allowed');
  return OK;
}
