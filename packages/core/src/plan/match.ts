import { MAX_STRENGTH_SESSIONS_PER_WEEK, PLAN_MATCH_WEIGHTS } from '../constants';
import type { PlanTemplate } from '../content/schemas';
import {
  GOAL_TEMPLATE_MAPPING,
  LEVEL_TEMPLATE_MAPPING,
  type PlanMatchQuality,
  type PlanNote,
  type TrainingLocation,
} from '../enums';
import type { PlanLibrary } from './content-pool';
import { type EquipmentProfile, findSubstitute } from './equipment-profile';
import type { PlanInputs } from './inputs';
import type { PlanSafetyRules } from './safety';

/**
 * Vorlagen-Matching mit Punkten (docs/PLAN-PHASE-3.md Abschnitt 5.3).
 */

/** Krafteinheiten pro Woche, die tatsächlich geplant werden (höchstens MAX_STRENGTH_SESSIONS_PER_WEEK). */
export function plannedSessionsPerWeek(wish: number): number {
  return Math.min(wish, MAX_STRENGTH_SESSIONS_PER_WEEK);
}

export interface TemplateScore {
  readonly template: PlanTemplate;
  readonly score: number;
  readonly breakdown: Readonly<Record<keyof typeof PLAN_MATCH_WEIGHTS, number>>;
  /** Anteil der Übungen, die direkt oder per Ersatz machbar sind (0–1). */
  readonly coverage: number;
}

/**
 * Eingaben des Matchings (Erweiterungsplan 5.3): `sessionsPerWeek` = Zahl der gewünschten Kraft-Tage,
 * `minutesPerSession` = LÄNGSTE Kraft-Dauer der Woche (lange Tage bekommen die volle Vorlage, kürzere werden je
 * Termin gekürzt), `trainingLocation` = abgeleiteter Ort der Kraft-Tage.
 */
export interface MatchInputs {
  readonly goalType: PlanInputs['goalType'];
  readonly experienceLevel: PlanInputs['experienceLevel'];
  readonly sessionsPerWeek: number;
  readonly minutesPerSession: number;
  readonly trainingLocation: TrainingLocation;
  readonly sex: PlanInputs['sex'];
}

export interface MatchContext {
  readonly library: PlanLibrary;
  readonly profile: EquipmentProfile;
  readonly rules: PlanSafetyRules;
}

/** Harte Ausschlüsse: Geschlecht der Vorlage, Einsteiger/vorsichtig nur Einsteiger-Vorlagen. */
export function isTemplateEligible(
  template: PlanTemplate,
  inputs: Pick<MatchInputs, 'sex'>,
  rules: Pick<PlanSafetyRules, 'beginnerTemplatesOnly'>,
): boolean {
  if (template.sex !== null && template.sex !== inputs.sex) {
    return false;
  }
  if (rules.beginnerTemplatesOnly && template.experience_level !== 'beginner') {
    return false;
  }
  return true;
}

function isAllFullBody(template: PlanTemplate): boolean {
  return template.sessions.every((s) => s.focus === 'full_body');
}

function daysScore(template: PlanTemplate, wish: number): number {
  const max = PLAN_MATCH_WEIGHTS.days;
  const n = template.sessions_per_week;
  if (n === wish && n <= MAX_STRENGTH_SESSIONS_PER_WEEK) return max;
  if (wish <= 2) {
    return n === 3 && isAllFullBody(template) ? 12 : 0;
  }
  if (wish > MAX_STRENGTH_SESSIONS_PER_WEEK) {
    if (n === MAX_STRENGTH_SESSIONS_PER_WEEK) return 12;
    return n === 3 ? 5 : 0;
  }
  return 5;
}

/** Punkte einer Vorlage für eine Person (0–100). */
export function scoreTemplate(
  template: PlanTemplate,
  inputs: MatchInputs,
  ctx: MatchContext,
): TemplateScore {
  const W = PLAN_MATCH_WEIGHTS;
  const goalMap = GOAL_TEMPLATE_MAPPING[inputs.goalType];
  const goal =
    template.goal_type === goalMap.goal ? (goalMap.kind === 'fallback' ? 15 : W.goal) : 0;
  const wantedLevel = LEVEL_TEMPLATE_MAPPING[inputs.experienceLevel];
  const level = template.experience_level === wantedLevel ? W.level : 12;
  const days = daysScore(template, inputs.sessionsPerWeek);
  const location =
    template.location === ctx.profile.location
      ? W.location
      : inputs.trainingLocation === 'both' && template.location === 'home'
        ? 6
        : 0;
  const items = template.sessions.flatMap((s) => s.exercises);
  const coveredCount = items.filter((item) => {
    const exercise = ctx.library.exercises.get(item.exercise_id);
    return (
      exercise !== undefined &&
      findSubstitute(exercise, {
        library: ctx.library.exercises,
        profile: ctx.profile,
        rules: ctx.rules,
      }) !== null
    );
  }).length;
  const coverage = items.length === 0 ? 0 : coveredCount / items.length;
  const equipment = coverage * W.equipment;
  const budget = inputs.minutesPerSession;
  const duration =
    budget >= template.minutes_min ? W.duration : (W.duration * budget) / template.minutes_min;
  const breakdown = { goal, level, days, location, equipment, duration };
  const score = goal + level + days + location + equipment + duration;
  return { template, score, breakdown, coverage };
}

export interface MatchResult {
  readonly template: PlanTemplate;
  readonly score: number;
  readonly quality: PlanMatchQuality;
  readonly notes: ReadonlySet<PlanNote>;
}

/**
 * Wählt die Vorlage mit den meisten Punkten (bei Gleichstand die alphabetisch erste ID) und bestimmt Güte und
 * Hinweise (ohne die Hinweise aus der Anpassung – die ergänzt generateTrainingPlan). null = keine Vorlage.
 */
export function matchTemplate(inputs: MatchInputs, ctx: MatchContext): MatchResult | null {
  const scored = ctx.library.templates
    .filter((t) => isTemplateEligible(t, inputs, ctx.rules))
    .map((t) => scoreTemplate(t, inputs, ctx))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.template.id < b.template.id ? -1 : a.template.id > b.template.id ? 1 : 0),
    );
  const best = scored[0];
  if (!best) {
    return null;
  }
  const template = best.template;
  const notes = new Set<PlanNote>();
  const goalMap = GOAL_TEMPLATE_MAPPING[inputs.goalType];
  // Ausdauer-Hinweise (goal_endurance_not_yet / endurance_basic_only) setzt generateTrainingPlan.
  const goalOk = template.goal_type === goalMap.goal && goalMap.kind !== 'fallback';
  const locationOk = template.location === ctx.profile.location;
  if (!locationOk) {
    notes.add('location_mismatch');
  }
  const planned = plannedSessionsPerWeek(inputs.sessionsPerWeek);
  if (planned < template.sessions_per_week) {
    notes.add('days_rotated');
  }
  if (inputs.sessionsPerWeek > template.sessions_per_week) {
    notes.add('days_capped');
  }
  const levelOk = template.experience_level === LEVEL_TEMPLATE_MAPPING[inputs.experienceLevel];
  const daysOk = template.sessions_per_week === inputs.sessionsPerWeek;
  const minutesOk =
    inputs.minutesPerSession >= template.minutes_min &&
    inputs.minutesPerSession <= template.minutes_max;
  const quality: PlanMatchQuality =
    !goalOk || !locationOk ? 'fallback' : levelOk && daysOk && minutesOk ? 'exact' : 'close';
  return { template, score: best.score, quality, notes };
}
