import {
  LARGE_MUSCLE_GROUPS,
  REST_RANGES_S,
  SESSION_FIT,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { estimateSessionMinutes, weeklySetRange, weeklySetsByMuscle } from '../content/analysis';
import type { Exercise, PlanTemplate, TemplateExercise, TemplateSession } from '../content/schemas';
import type { MovementPattern, PlanNote, SessionFocus } from '../enums';
import { type EquipmentProfile, findSubstitute } from './equipment-profile';
import type { PlanSafetyRules } from './safety';

/**
 * Vorlage an Person anpassen (docs/PLAN-PHASE-3.md Abschnitte 5.4–5.6): Übungen tauschen, Dosierung auf die
 * Sicherheitsregeln begrenzen, auf das Zeitbudget kürzen. Felder in snake_case = Spalten der Datenbank.
 */
export interface PlannedExerciseDraft extends TemplateExercise {
  /** Übung laut Vorlage (vor einem Tausch). */
  readonly source_exercise_id: string;
  /** Schnappschuss des Namens. */
  readonly exercise_name_de: string;
  /** In Phase 3 immer null („Startgewicht finden“, Abschnitt 5.8). */
  readonly target_weight_kg: number | null;
}

export interface AdaptedSession {
  readonly template_day_index: number;
  readonly name_de: string;
  readonly focus: SessionFocus;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  readonly exercises: readonly PlannedExerciseDraft[];
}

export interface AdaptResult {
  readonly sessions: readonly AdaptedSession[];
  readonly notes: ReadonlySet<PlanNote>;
  /** Alle Übungen ohne Tausch und ohne Lücke (für die Güte „exact“). */
  readonly unchanged: boolean;
}

export interface AdaptContext {
  readonly library: ReadonlyMap<string, Exercise>;
  readonly profile: Pick<EquipmentProfile, 'available'>;
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious' | 'rpeMax'>;
  /**
   * Zeitbudget je Einheit. Seit Engine-Version 2 meist weggelassen: Gekürzt wird erst beim Platzieren je Termin
   * (schedule.ts, Erweiterungsplan 5.3), weil derselbe Vorlagen-Tag an verschiedenen Tagen verschieden lang ist.
   */
  readonly minutesPerSession?: number;
}

const PULL_PATTERNS: readonly MovementPattern[] = ['horizontal_pull', 'vertical_pull'];

/** RPE auf den Deckel begrenzen, nie unter 5 (Regel V4, 0,5er-Schritte bleiben erhalten). */
export function clampRpe(rpe: number, rpeMax: number): number {
  return Math.max(TEMPLATE_DOSAGE_LIMITS.rpe.min, Math.min(rpe, rpeMax));
}

/** Supersatz-Gruppen mit nur noch einer Übung auflösen, Reihenfolge lückenlos 1…n nummerieren. */
function normalize(exercises: readonly PlannedExerciseDraft[]): PlannedExerciseDraft[] {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    if (e.superset_group !== null) {
      counts.set(e.superset_group, (counts.get(e.superset_group) ?? 0) + 1);
    }
  }
  return exercises.map((e, i) => ({
    ...e,
    order_no: i + 1,
    superset_group:
      e.superset_group !== null && (counts.get(e.superset_group) ?? 0) > 1
        ? e.superset_group
        : null,
  }));
}

/** Tauscht Übungen einer Einheit und begrenzt die Dosierung. */
function adaptSessionExercises(
  items: readonly TemplateExercise[],
  ctx: AdaptContext,
  notes: Set<PlanNote>,
): { exercises: PlannedExerciseDraft[]; changed: boolean } {
  const used = new Set(items.map((item) => item.exercise_id));
  const result: PlannedExerciseDraft[] = [];
  let changed = false;
  for (const item of [...items].sort((a, b) => a.order_no - b.order_no)) {
    const original = ctx.library.get(item.exercise_id);
    if (!original) {
      changed = true;
      continue;
    }
    const others = new Set([...used].filter((id) => id !== item.exercise_id));
    const substitute = findSubstitute(original, { ...ctx, exclude: others });
    if (!substitute) {
      changed = true;
      // Fehlende Geräte → Hinweis; reiner Sicherheits-Ausschluss erzeugt keinen gespeicherten Code (Abschnitt 9).
      if (!original.equipment_ids.every((id) => ctx.profile.available.has(id))) {
        notes.add('exercises_removed');
      }
      continue;
    }
    const chosen = substitute.exercise;
    if (substitute.step !== 1) {
      changed = true;
      used.add(chosen.id);
      if (substitute.reason === 'equipment') {
        notes.add('exercises_substituted');
      }
    }
    const patternChanged =
      chosen.movement_pattern !== original.movement_pattern ||
      chosen.mechanics !== original.mechanics;
    const restRange = REST_RANGES_S[chosen.mechanics];
    result.push({
      ...item,
      exercise_id: chosen.id,
      source_exercise_id: original.id,
      exercise_name_de: chosen.name_de,
      rest_s: patternChanged
        ? Math.min(restRange.max, Math.max(restRange.min, item.rest_s))
        : item.rest_s,
      rpe_target: clampRpe(item.rpe_target, ctx.rules.rpeMax),
      target_weight_kg: null,
    });
  }
  return { exercises: normalize(result), changed };
}

export interface FitResult {
  readonly exercises: readonly PlannedExerciseDraft[];
  readonly shortened: boolean;
  readonly belowMinimum: boolean;
}

/**
 * Kürzt eine Einheit auf das Zeitbudget (Abschnitt 5.6) mit estimateSessionMinutes():
 * (1) Isolationsübungen vom Ende entfernen, (2) Sätze auf 2 (Grund-) bzw. 1 (Isolationsübung) senken,
 * (3) Grundübungen vom Ende entfernen bis mindestens 3 Übungen. Längeres Budget: nichts hinzufügen.
 */
export function fitSessionToMinutes(
  exercises: readonly PlannedExerciseDraft[],
  minutes: number,
  library: ReadonlyMap<string, Exercise>,
): FitResult {
  let current = normalize(exercises);
  const fits = () => estimateSessionMinutes({ exercises: current }) <= minutes;
  if (fits()) {
    return { exercises: current, shortened: false, belowMinimum: false };
  }
  const isIsolation = (e: PlannedExerciseDraft) =>
    library.get(e.exercise_id)?.mechanics === 'isolation';
  // (1) Isolationsübungen vom Ende
  while (!fits() && current.length > SESSION_FIT.minExercises) {
    const index = current.map(isIsolation).lastIndexOf(true);
    if (index < 0) break;
    current = normalize(current.filter((_, i) => i !== index));
  }
  // (2) Sätze senken, von hinten nach vorn, je Runde ein Satz
  let reduced = true;
  while (!fits() && reduced) {
    reduced = false;
    for (let i = current.length - 1; i >= 0 && !fits(); i -= 1) {
      const e = current[i] as PlannedExerciseDraft;
      const minSets = isIsolation(e) ? SESSION_FIT.minSetsIsolation : SESSION_FIT.minSetsCompound;
      if (e.sets > minSets) {
        current = current.map((x, j) => (j === i ? { ...x, sets: x.sets - 1 } : x));
        reduced = true;
      }
    }
  }
  // (3) Grundübungen vom Ende bis mindestens 3 Übungen
  while (!fits() && current.length > SESSION_FIT.minExercises) {
    current = normalize(current.slice(0, -1));
  }
  return { exercises: current, shortened: true, belowMinimum: !fits() };
}

/** Passt eine Vorlage an Geräte, Sicherheitsregeln und Zeitbudget an. */
export function adaptTemplate(template: PlanTemplate, ctx: AdaptContext): AdaptResult {
  const notes = new Set<PlanNote>();
  let unchanged = true;
  const sessions: AdaptedSession[] = [];
  for (const session of [...template.sessions].sort((a, b) => a.day_index - b.day_index)) {
    const adapted = adaptSessionExercises(session.exercises, ctx, notes);
    if (adapted.changed) unchanged = false;
    const fitted =
      ctx.minutesPerSession === undefined
        ? { exercises: adapted.exercises, shortened: false, belowMinimum: false }
        : fitSessionToMinutes(adapted.exercises, ctx.minutesPerSession, ctx.library);
    if (fitted.shortened) notes.add('minutes_shortened');
    if (fitted.belowMinimum) notes.add('minutes_below_minimum');
    if (fitted.exercises.length === 0) {
      unchanged = false;
      continue;
    }
    sessions.push({
      template_day_index: session.day_index,
      name_de: session.name_de,
      focus: session.focus,
      warmup_de: session.warmup_de,
      cooldown_de: session.cooldown_de,
      exercises: fitted.exercises,
    });
  }

  if (isVolumeReduced(template, sessions, ctx.library)) {
    notes.add('volume_reduced');
  }

  // Keine Zug-Übung mehr, obwohl die Vorlage welche hatte?
  const hasPull = (ids: string[]) =>
    ids.some((id) => {
      const pattern = ctx.library.get(id)?.movement_pattern;
      return pattern !== undefined && PULL_PATTERNS.includes(pattern);
    });
  const templateIds = template.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
  const adaptedIds = sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
  if (hasPull(templateIds) && !hasPull(adaptedIds)) {
    notes.add('no_pull_exercise');
  }
  return { sessions, notes, unchanged };
}

/**
 * Wochenumfang großer Muskelgruppen unter die Untergrenze gefallen (V10)? `sessions` = je Vorlagen-Einheit eine
 * Fassung (bei Kürzen je Termin die kürzeste – die vorsichtige Schätzung).
 */
export function isVolumeReduced(
  template: PlanTemplate,
  sessions: readonly AdaptedSession[],
  library: ReadonlyMap<string, Exercise>,
): boolean {
  const range = weeklySetRange(template);
  const before = weeklySetsByMuscle(template, library);
  const after = weeklySetsByMuscle({ sessions: sessions.map(toTemplateSession) }, library);
  return LARGE_MUSCLE_GROUPS.some((m) => before[m] >= range.min && after[m] < range.min);
}

/**
 * Bereits geplante Übungen erneut an Geräte und Regeln anpassen (Folgeblock in der Fassung eines anderen Orts):
 * wie adaptTemplate, aber die Vorlagen-Übung (`source_exercise_id`) bleibt erhalten.
 */
export function reAdaptExercises(
  exercises: readonly PlannedExerciseDraft[],
  ctx: Omit<AdaptContext, 'minutesPerSession'>,
): PlannedExerciseDraft[] {
  const sources = new Map(exercises.map((e) => [e.exercise_id, e.source_exercise_id] as const));
  const adapted = adaptSessionExercises(exercises, ctx, new Set());
  return adapted.exercises.map((e) => ({
    ...e,
    source_exercise_id: sources.get(e.source_exercise_id) ?? e.source_exercise_id,
  }));
}

/** Angepasste Einheit im Format einer Vorlagen-Einheit (für die Kennzahlen aus content/analysis.ts). */
export function toTemplateSession(session: AdaptedSession): TemplateSession {
  return {
    day_index: session.template_day_index,
    name_de: session.name_de,
    focus: session.focus,
    warmup_de: session.warmup_de,
    cooldown_de: session.cooldown_de,
    exercises: [...session.exercises],
  };
}

/** Geschätzte Dauer einer angepassten Einheit in Minuten. */
export function adaptedSessionMinutes(session: Pick<AdaptedSession, 'exercises'>): number {
  return estimateSessionMinutes({ exercises: [...session.exercises] });
}
