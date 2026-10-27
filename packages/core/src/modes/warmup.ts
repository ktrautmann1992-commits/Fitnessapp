import { HYROX_ONLY_EXERCISE_IDS, WARMUP_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import { MUSCLE_GROUPS, type MuscleGroup, type PlannedSessionKind } from '../enums';
import type { PlannedExerciseDraft } from '../plan/adapt';
import { type EquipmentProfile, isExerciseFeasible } from '../plan/equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from '../plan/safety';
import { isBlockedByPain, type PainEffect } from './pain';

/**
 * Aufwärmen & Dehnen (docs/PLAN-TRAINING-MODI.md 5, Gründer-Freigabe 25.10.2026): Vor jeder Kraft-Einheit ~5 min
 * Aufwärmen (allgemein + speziell für die Hauptmuskeln des Tages), danach ~5 min Beweglichkeit – zusammengesetzt aus
 * der Übungs-Bibliothek, rein und deterministisch (WARMUP_RULES).
 *
 * - Allgemein: Übung mit Muster `conditioning`, Belastungsart Zeit, ohne Sprünge.
 * - Speziell: dynamische Beweglichkeit (Muster `mobility`, NICHT Zeit = Wiederholungen) mit den meisten
 *   Hauptmuskeln des Tages, dazu leichte Aufwärmsätze der ersten Grundübung der (angezeigten) Einheit.
 * - Danach: gehaltene Dehnungen (Muster `mobility`, Belastungsart Zeit), die die trainierten Muskeln abdecken.
 * Jede Übung muss nach den aktuellen Regeln erlaubt, am Ort machbar und im Schmerz-Modus nicht gesperrt sein.
 * Gibt es keine passenden (freigegebenen) Übungen, meldet das Ergebnis `…Fallback` – die App zeigt dann den
 * Aufwärm- bzw. Cool-down-Text der Vorlage (kein leerer Block, keine Fehlfunktion).
 */

export type RoutineItemKind = 'general' | 'mobility' | 'ramp' | 'stretch';

export interface RoutineItem {
  readonly kind: RoutineItemKind;
  readonly exerciseId: string;
  readonly nameDe: string;
  readonly sets: number;
  /** Wiederholungen (Beweglichkeit, Aufwärmsätze) oder null. */
  readonly reps: number | null;
  /** Sekunden (allgemein, Dehnen) oder null. */
  readonly seconds: number | null;
  /** Aufwärmsätze: „leichtes Gewicht (~50 %)“ bzw. „halbe Wiederholungen, ruhig“. */
  readonly note: 'light_weight' | 'half_reps' | null;
}

export interface SessionRoutine {
  readonly warmup: readonly RoutineItem[];
  readonly cooldown: readonly RoutineItem[];
  readonly warmupMinutes: number;
  readonly cooldownMinutes: number;
  /** Keine allgemeine/dynamische Übung gefunden → Text der Vorlage zeigen (Aufwärmsätze bleiben). */
  readonly warmupFallback: boolean;
  /** Keine Dehnung gefunden → Cool-down-Text der Vorlage zeigen. */
  readonly cooldownFallback: boolean;
  /** Hauptmuskeln des Tages (für die Überschrift „für Beine und Po“). */
  readonly mainMuscles: readonly MuscleGroup[];
}

export interface RoutineContext {
  /** Übungen, aus denen Aufwärmen/Dehnen gewählt wird (Supabase: nur freigegebene; Testmodus auch Entwürfe). */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Zum Nachschlagen der Einheit (auch archivierte); Standard `library`. */
  readonly lookup?: ReadonlyMap<string, Exercise>;
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags'>;
  /** Geräte am Ort bzw. auf Reisen; fehlt es, nur Übungen ohne Geräte. */
  readonly profile?: Pick<EquipmentProfile, 'available'> | null;
  readonly pain?: PainEffect | null;
}

const byId = (a: Exercise, b: Exercise) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Hauptmuskeln: Hauptmuskeln der Übungen nach Sätzen und Reihenfolge gewichtet (die erste Übung zählt am meisten;
 * Gleichstand: Reihenfolge MUSCLE_GROUPS).
 */
export function mainMusclesOf(
  exercises: readonly Pick<PlannedExerciseDraft, 'exercise_id' | 'sets'>[],
  lookup: ReadonlyMap<string, Exercise>,
  count: number = WARMUP_RULES.mainMuscles,
): MuscleGroup[] {
  const score = new Map<MuscleGroup, number>();
  // Frühere Übungen zählen mehr (die Hauptübung steht vorn): Gewicht = Sätze × (Übungen − Position).
  exercises.forEach((item, index) => {
    const exercise = lookup.get(item.exercise_id);
    if (!exercise) return;
    const weight = item.sets * (exercises.length - index);
    for (const m of exercise.primary_muscles) score.set(m, (score.get(m) ?? 0) + weight);
  });
  return MUSCLE_GROUPS.filter((m) => (score.get(m) ?? 0) > 0)
    .sort(
      (a, b) =>
        (score.get(b) ?? 0) - (score.get(a) ?? 0) ||
        MUSCLE_GROUPS.indexOf(a) - MUSCLE_GROUPS.indexOf(b),
    )
    .slice(0, count);
}

function usable(exercise: Exercise, ctx: RoutineContext): boolean {
  const profile = ctx.profile ?? { available: new Set<string>() };
  return (
    isExerciseAllowed(exercise, ctx.rules) &&
    isExerciseFeasible(exercise, profile) &&
    !(ctx.pain ? isBlockedByPain(exercise, ctx.pain) : false)
  );
}

function overlap(exercise: Exercise, muscles: ReadonlySet<MuscleGroup>): number {
  return (
    exercise.primary_muscles.filter((m) => muscles.has(m)).length * 2 +
    exercise.secondary_muscles.filter((m) => muscles.has(m)).length
  );
}

/**
 * Aufwärmen und Dehnen für eine ANGEZEIGTE Einheit (nach prepareSessionForDisplay). null bei Ausdauer bzw. leerer
 * Einheit (dort zählt der Ablauf der Ausdauer-Einheit).
 */
export function sessionRoutine(
  session: {
    readonly kind: PlannedSessionKind;
    readonly exercises: readonly PlannedExerciseDraft[];
  },
  ctx: RoutineContext,
): SessionRoutine | null {
  if (session.kind !== 'strength' || session.exercises.length === 0) return null;
  const lookup = ctx.lookup ?? ctx.library;
  const main = mainMusclesOf(session.exercises, lookup);
  const mainSet = new Set(main);
  const trained = new Set(mainMusclesOf(session.exercises, lookup, MUSCLE_GROUPS.length));
  // Sportarten Stufe 1: Hyrox-Übungen nie in der Aufwärm-Routine (HYROX_ONLY_EXERCISE_IDS).
  const pool = [...ctx.library.values()]
    .filter((e) => usable(e, ctx) && !HYROX_ONLY_EXERCISE_IDS.includes(e.id))
    .sort(byId);

  const general = pool
    .filter(
      (e) =>
        e.movement_pattern === 'conditioning' &&
        e.load_type === 'time' &&
        !e.caution_tags.includes('high_impact'),
    )
    .sort((a, b) => a.difficulty - b.difficulty || byId(a, b))
    .slice(0, WARMUP_RULES.maxGeneral)
    .map<RoutineItem>((e) => ({
      kind: 'general',
      exerciseId: e.id,
      nameDe: e.name_de,
      sets: 1,
      reps: null,
      seconds: WARMUP_RULES.generalSeconds,
      note: null,
    }));

  const dynamic = pool.filter((e) => e.movement_pattern === 'mobility' && e.load_type !== 'time');
  const scored = dynamic
    .map((e) => ({ e, score: overlap(e, mainSet) }))
    .sort((a, b) => b.score - a.score || byId(a.e, b.e));
  const relevant = scored.filter((s) => s.score > 0);
  const mobility = (relevant.length > 0 ? relevant : scored.slice(0, 1))
    .slice(0, WARMUP_RULES.maxMobility)
    .map<RoutineItem>(({ e }) => ({
      kind: 'mobility',
      exerciseId: e.id,
      nameDe: e.name_de,
      sets: 1,
      reps: WARMUP_RULES.mobilityReps,
      seconds: null,
      note: null,
    }));

  const ramp: RoutineItem[] = session.exercises
    .flatMap((item) => {
      const exercise = lookup.get(item.exercise_id);
      if (!exercise || exercise.mechanics !== 'compound' || exercise.load_type === 'time') {
        return [];
      }
      const weighted = exercise.load_type === 'weight';
      const reps = weighted
        ? (item.reps_min ?? WARMUP_RULES.mobilityReps)
        : Math.max(1, Math.ceil((item.reps_min ?? WARMUP_RULES.mobilityReps) / 2));
      return [
        {
          kind: 'ramp' as const,
          exerciseId: exercise.id,
          nameDe: exercise.name_de,
          sets: WARMUP_RULES.rampSets,
          reps,
          seconds: null,
          note: weighted ? ('light_weight' as const) : ('half_reps' as const),
        },
      ];
    })
    .slice(0, WARMUP_RULES.maxRampExercises);

  // Dehnen: gierig die Übung mit den meisten noch nicht abgedeckten trainierten Muskeln.
  const stretches = pool.filter((e) => e.movement_pattern === 'mobility' && e.load_type === 'time');
  const cooldown: RoutineItem[] = [];
  const uncovered = new Set(trained);
  const chosen = new Set<string>();
  while (cooldown.length < WARMUP_RULES.maxStretches && uncovered.size > 0) {
    const best = stretches
      .filter((e) => !chosen.has(e.id))
      .map((e) => ({ e, score: overlap(e, uncovered) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || byId(a.e, b.e))[0];
    if (!best) break;
    chosen.add(best.e.id);
    best.e.primary_muscles.forEach((m) => uncovered.delete(m));
    best.e.secondary_muscles.forEach((m) => uncovered.delete(m));
    cooldown.push({
      kind: 'stretch',
      exerciseId: best.e.id,
      nameDe: best.e.name_de,
      sets: 1,
      reps: null,
      seconds: WARMUP_RULES.stretchSeconds,
      note: null,
    });
  }

  const warmup = [...general, ...mobility, ...ramp];
  const warmupSeconds =
    general.length * WARMUP_RULES.generalSeconds +
    mobility.length * WARMUP_RULES.mobilitySecondsPerItem +
    ramp.reduce((sum, r) => sum + r.sets * WARMUP_RULES.rampSecondsPerSet, 0);
  const cooldownSeconds = cooldown.length * WARMUP_RULES.stretchSeconds;
  return {
    warmup,
    cooldown,
    warmupMinutes:
      general.length + mobility.length === 0
        ? WARMUP_RULES.targetMinutes
        : Math.max(1, Math.ceil(warmupSeconds / 60)),
    cooldownMinutes:
      cooldown.length === 0
        ? WARMUP_RULES.cooldownMinutes
        : Math.max(1, Math.ceil(cooldownSeconds / 60)),
    warmupFallback: general.length + mobility.length === 0,
    cooldownFallback: cooldown.length === 0,
    mainMuscles: main,
  };
}
