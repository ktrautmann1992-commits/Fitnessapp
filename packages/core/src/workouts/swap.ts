import { z } from 'zod';

import {
  CUSTOM_WORKOUT_RULES,
  GROUP_BARBELL_ONLY_EXERCISE_IDS,
  WORKOUT_LIMITS,
  WORKOUT_PLAYER,
} from '../constants';
import { contentIdSchema, type Exercise } from '../content/schemas';
import type { CautionTag, MovementPattern } from '../enums';
import { requiredEquipmentIds } from '../equipment';
import { repTimeBoxS } from './player';
import type { Workout, WorkoutContentItem } from './schema';

/**
 * Einzelne Übungen in einem Workout tauschen (Gründer-Wunsch 18.11.2026, docs/PLAN-EIGENE-WORKOUTS.md 2): Kandidaten
 * mit gleichem bzw. ähnlichem Bewegungsmuster und gleichen Hauptmuskeln, machbar mit den eigenen Geräten, nicht auf
 * der Liste „Mag ich nicht“, ähnliche Schwierigkeit, erlaubt nach den Sicherheitsregeln. Die eigenen Alternativen der
 * Übung (Inhalt `alternatives`) stehen vorn. Die Dosierung bleibt: Zeit bleibt Zeit, Wiederholungen werden umgerechnet,
 * wenn sich die Art ändert (Halteübung ↔ Wiederholungen). Rein und deterministisch.
 *
 * Getauschte Bibliotheks-Workouts speichert die App als persönliche Variante (`WorkoutVariant`): nur die Täusche je
 * Position (von → nach), angewandt auf die AKTUELLE Fassung des Workouts – passt eine Position nicht mehr (neue Fassung),
 * entfällt dieser Tausch (sichere Richtung, kein halbes Workout).
 */

/**
 * Übungen, die die Suche in Workouts (Tausch, eigenes Workout) auslässt: die Langhantel-Gruppenübungen von Barbell Burn
 * (Tempo-Choreografie, noch ohne Fachprüfung) – sie kommen nur über ihre Workouts bzw. ihre eigenen Alternativen.
 * Hyrox-, WOD- und Tiefe-Bauch-Übungen (LIBRARY_SEARCH_EXCLUDED_IDS) sperrt nur die Plan-Engine, damit Pläne
 * byte-gleich bleiben; in Workouts sind sie zu Hause (docs/PLAN-EIGENE-WORKOUTS.md 3).
 */
export const WORKOUT_SEARCH_EXCLUDED_IDS: readonly string[] = GROUP_BARBELL_ONLY_EXERCISE_IDS;

/** Muster ohne Kraft-Charakter: getauscht wird nur untereinander (Dehnen ↔ Dehnen, nie Dehnen ↔ Kniebeuge). */
const CALM_PATTERNS: readonly MovementPattern[] = ['mobility', 'balance'];

export interface WorkoutSwapContext {
  /** Woraus ein Kandidat kommen darf (nur freigegebene Übungen der Bibliothek). */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Nachschlagen der Übungen im Workout (auch Posen); Standard: `library`. */
  readonly lookup?: ReadonlyMap<string, Exercise>;
  /** Geräte laut Angaben (availableWorkoutEquipment); null = unbekannt → keine Einschränkung. */
  readonly available: ReadonlySet<string> | null;
  /** „Mag ich nicht“ (eigene Liste und Übungs-Präferenzen „mag ich nicht“). */
  readonly dislikes: ReadonlySet<string>;
  /** Ausgeschlossene Merkmale der Sicherheitsregeln (Gesundheits-Check, Fit im Alter, …). */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Höchste Übungs-Schwierigkeit (Level); fehlt = nur die Nähe zur getauschten Übung zählt. */
  readonly maxDifficulty?: number;
}

export type WorkoutSwapReason = 'alternative' | 'same_pattern' | 'same_muscles';

export interface WorkoutSwapCandidate {
  readonly exercise: Exercise;
  /** Die Position mit der neuen Übung und umgerechneter Dosierung. */
  readonly item: WorkoutContentItem;
  readonly reason: WorkoutSwapReason;
}

/** Ist die Übung mit diesen Geräten machbar (ersetzbare Hilfsmittel wie Matte/Stepbrett zählen nie)? */
export function exerciseFeasibleWith(
  exercise: Pick<Exercise, 'equipment_ids'>,
  available: ReadonlySet<string> | null,
): boolean {
  return (
    available === null ||
    requiredEquipmentIds(exercise.equipment_ids).every((id) => available.has(id))
  );
}

/** Erlaubt nach den Sicherheitsregeln (kein ausgeschlossenes Merkmal)? */
export function exerciseAllowedBy(
  exercise: Pick<Exercise, 'caution_tags'>,
  excluded: readonly CautionTag[],
): boolean {
  return !exercise.caution_tags.some((tag) => excluded.includes(tag));
}

function sharesPrimary(a: Exercise, b: Exercise): boolean {
  return a.primary_muscles.some((m) => b.primary_muscles.includes(m));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Rundung der Sekunden beim Umrechnen (wie WORKOUT_PLAYER.timeBox.roundToS). */
const ROUND_S = WORKOUT_PLAYER.timeBox.roundToS;

/**
 * Dosierung beim Tausch: Sätze, Pause und Hinweis bleiben. Zeit bleibt Zeit – außer die neue Übung braucht
 * Wiederholungen (mit Gewicht, Regel W4) und das Format erlaubt sie: dann Sekunden ÷ 3 s je Wiederholung (einseitig
 * je Seite). Wiederholungen bleiben Wiederholungen – außer die neue Übung ist eine Halteübung: dann das Zeitfenster
 * des Players (repTimeBoxS). Seitenwechsel (`side`) nur bei Zeit.
 * Einseitige Übungen laufen im Player je Seite (Gründer-Feedback 18.11.2026): Die Gesamtzeit bleibt etwa gleich –
 * aus 40 s beidseitig werden 20 s je Seite (auf 5 s gerundet, innerhalb von WORKOUT_LIMITS.workS) und umgekehrt.
 * Flow-Routinen regeln Seiten über `side` – dort bleibt die Zeit.
 */
export function mapWorkoutItem(
  item: WorkoutContentItem,
  from: Pick<Exercise, 'unilateral'> | undefined,
  to: Pick<Exercise, 'id' | 'load_type' | 'unilateral'>,
  format: Workout['format'],
): WorkoutContentItem {
  const base = { ...item, exercise_id: to.id };
  const flow = format === 'flow';
  const fromSides = !flow && from?.unilateral === true ? 2 : 1;
  const toSides = !flow && to.unilateral ? 2 : 1;
  const perSideS = (totalS: number) =>
    clamp(
      Math.round(totalS / toSides / ROUND_S) * ROUND_S,
      WORKOUT_LIMITS.workS.min,
      WORKOUT_LIMITS.workS.max,
    );
  if (item.duration_s !== null) {
    const totalS = item.duration_s * fromSides;
    if (to.load_type === 'weight' && format !== 'interval' && !flow) {
      const reps = clamp(
        Math.round(totalS / (WORKOUT_LIMITS.secondsPerRep * toSides)),
        WORKOUT_LIMITS.reps.min,
        WORKOUT_LIMITS.reps.max,
      );
      return { ...base, reps, duration_s: null, side: null };
    }
    return fromSides === toSides ? base : { ...base, duration_s: perSideS(totalS) };
  }
  if (to.load_type === 'time') {
    const seconds = perSideS(repTimeBoxS(item.reps ?? 0, from?.unilateral === true));
    return { ...base, reps: null, duration_s: seconds };
  }
  return base;
}

/**
 * Tausch-Kandidaten für die Übung an Position `index` (Rangliste, höchstens CUSTOM_WORKOUT_RULES.swap.maxCandidates):
 * 1. eigene Alternativen der Übung (nach Priorität) – sie dürfen auch Übungen sein, die die Suche sonst auslässt
 *    (WORKOUT_SEARCH_EXCLUDED_IDS),
 * 2. gleiches Bewegungsmuster mit gemeinsamem Hauptmuskel,
 * 3. gemeinsamer Hauptmuskel (ähnliches Muster; Dehnen/Gleichgewicht nur untereinander).
 * Innerhalb einer Stufe: Schwierigkeit am nächsten, gleiche Belastungsart, dann ID. Nie: dieselbe Übung, eine Übung,
 * die schon im Workout steht, „Mag ich nicht“, fehlende Geräte, ausgeschlossene Merkmale, Schwierigkeit mehr als
 * ±1 daneben bzw. über `maxDifficulty`. Flow-Routinen (Yoga/Pilates) haben ihren eigenen Sicherheitsfilter – kein Tausch.
 */
export function workoutSwapCandidates(
  workout: Pick<Workout, 'format' | 'exercises'>,
  index: number,
  ctx: WorkoutSwapContext,
): WorkoutSwapCandidate[] {
  const item = workout.exercises[index];
  if (!item || workout.format === 'flow') return [];
  const lookup = ctx.lookup ?? ctx.library;
  const current = lookup.get(item.exercise_id) ?? ctx.library.get(item.exercise_id);
  if (!current) return [];
  const inWorkout = new Set(workout.exercises.map((e) => e.exercise_id));
  const calm = CALM_PATTERNS.includes(current.movement_pattern);
  const delta = CUSTOM_WORKOUT_RULES.swap.difficultyDelta;
  const searchAllowed = (c: Exercise) =>
    !WORKOUT_SEARCH_EXCLUDED_IDS.includes(c.id) || WORKOUT_SEARCH_EXCLUDED_IDS.includes(current.id);
  const ok = (c: Exercise | undefined): c is Exercise =>
    c !== undefined &&
    ctx.library.get(c.id) === c &&
    c.status === 'published' &&
    c.id !== current.id &&
    !inWorkout.has(c.id) &&
    !ctx.dislikes.has(c.id) &&
    exerciseFeasibleWith(c, ctx.available) &&
    exerciseAllowedBy(c, ctx.excludedCautionTags) &&
    Math.abs(c.difficulty - current.difficulty) <= delta &&
    (ctx.maxDifficulty === undefined || c.difficulty <= ctx.maxDifficulty) &&
    CALM_PATTERNS.includes(c.movement_pattern) === calm;

  const seen = new Set<string>();
  const result: WorkoutSwapCandidate[] = [];
  const push = (c: Exercise | undefined, reason: WorkoutSwapReason) => {
    if (!ok(c) || seen.has(c.id)) return;
    seen.add(c.id);
    result.push({ exercise: c, item: mapWorkoutItem(item, current, c, workout.format), reason });
  };
  const rank = (a: Exercise, b: Exercise) =>
    Math.abs(a.difficulty - current.difficulty) - Math.abs(b.difficulty - current.difficulty) ||
    Number(b.load_type === current.load_type) - Number(a.load_type === current.load_type) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  [...current.alternatives]
    .sort((a, b) => a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1))
    .forEach((alt) => push(ctx.library.get(alt.alternative_id), 'alternative'));
  const pool = [...ctx.library.values()]
    .filter(searchAllowed)
    .filter((c) => sharesPrimary(c, current));
  pool
    .filter((c) => c.movement_pattern === current.movement_pattern)
    .sort(rank)
    .forEach((c) => push(c, 'same_pattern'));
  pool.sort(rank).forEach((c) => push(c, 'same_muscles'));
  return result.slice(0, CUSTOM_WORKOUT_RULES.swap.maxCandidates);
}

/** Geräte eines Workouts = Vereinigung der Geräte aller Übungen (Regel W3), in Reihenfolge des ersten Auftretens. */
export function workoutEquipmentUnion(
  exercises: readonly Pick<WorkoutContentItem, 'exercise_id'>[],
  lookup: ReadonlyMap<string, Pick<Exercise, 'equipment_ids'>>,
): string[] {
  const out: string[] = [];
  for (const item of exercises) {
    for (const id of lookup.get(item.exercise_id)?.equipment_ids ?? []) {
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

/**
 * Position `index` durch die (schon dosierte) Position `next` ersetzen; Geräte neu als Vereinigung. null = ungültig
 * (Position fehlt, Übung steht schon im Workout, mehr als 8 Geräte).
 */
export function replaceWorkoutItem<W extends Workout>(
  workout: W,
  index: number,
  next: WorkoutContentItem,
  lookup: ReadonlyMap<string, Pick<Exercise, 'equipment_ids'>>,
): W | null {
  const old = workout.exercises[index];
  if (!old) return null;
  if (workout.exercises.some((e, i) => i !== index && e.exercise_id === next.exercise_id))
    return null;
  const exercises = workout.exercises.map((e, i) => (i === index ? next : e));
  const equipment_ids = workoutEquipmentUnion(exercises, lookup);
  if (equipment_ids.length > 8) return null;
  return { ...workout, exercises, equipment_ids };
}

// ---------------------------------------------------------------------------------------------------------
// Persönliche Variante eines Bibliotheks-Workouts
// ---------------------------------------------------------------------------------------------------------

export const workoutVariantSwapSchema = z.strictObject({
  /** Position im Workout (0-basiert). */
  index: z
    .number()
    .int()
    .min(0)
    .max(WORKOUT_LIMITS.exercises.max - 1),
  /** Übung des Originals an dieser Position. */
  from: contentIdSchema,
  /** Gewählte Übung. */
  to: contentIdSchema,
});

/** Gespeicherte Variante (Tabelle `workout_variants.definition`): nur die Täusche, je Position höchstens einer. */
export const workoutVariantSchema = z
  .strictObject({
    version: z.literal(1),
    /** Fassung des Workouts beim Tauschen (nur zur Anzeige „neue Fassung“). */
    base_version: z.number().int().min(1).max(1000),
    swaps: z.array(workoutVariantSwapSchema).min(1).max(WORKOUT_LIMITS.exercises.max),
  })
  .superRefine((variant, ctx) => {
    const indexes = variant.swaps.map((s) => s.index);
    if (new Set(indexes).size !== indexes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['swaps'],
        message: 'Je Position höchstens ein Tausch.',
      });
    }
    const targets = variant.swaps.map((s) => s.to);
    if (new Set(targets).size !== targets.length) {
      ctx.addIssue({ code: 'custom', path: ['swaps'], message: 'Jede Übung höchstens einmal.' });
    }
    variant.swaps.forEach((s, i) => {
      if (s.from === s.to) {
        ctx.addIssue({
          code: 'custom',
          path: ['swaps', i, 'to'],
          message: 'Tausch gegen sich selbst.',
        });
      }
    });
  });
export type WorkoutVariant = z.output<typeof workoutVariantSchema>;

export interface AppliedWorkoutVariant<W extends Workout> {
  readonly workout: W;
  /** Angewandte Täusche (> 0 = „angepasst“). */
  readonly applied: number;
  /** Positionen, deren Tausch nicht mehr passt (neue Fassung, Übung fehlt) – entfallen. */
  readonly skipped: number;
  /** Getauschte Positionen (für die Anzeige „getauscht“). */
  readonly swappedIndexes: readonly number[];
}

/** Variante auf die aktuelle Fassung anwenden (passende Täusche; die anderen entfallen). */
export function applyWorkoutVariant<W extends Workout>(
  workout: W,
  variant: WorkoutVariant | null,
  lookup: ReadonlyMap<string, Exercise>,
): AppliedWorkoutVariant<W> {
  if (!variant || workout.format === 'flow') {
    return { workout, applied: 0, skipped: variant?.swaps.length ?? 0, swappedIndexes: [] };
  }
  let current: W = workout;
  const swappedIndexes: number[] = [];
  let skipped = 0;
  for (const swap of [...variant.swaps].sort((a, b) => a.index - b.index)) {
    const item = current.exercises[swap.index];
    const to = lookup.get(swap.to);
    if (!item || item.exercise_id !== swap.from || !to) {
      skipped += 1;
      continue;
    }
    const next = replaceWorkoutItem(
      current,
      swap.index,
      mapWorkoutItem(item, lookup.get(swap.from), to, current.format),
      lookup,
    );
    if (!next) {
      skipped += 1;
      continue;
    }
    current = next;
    swappedIndexes.push(swap.index);
  }
  return { workout: current, applied: swappedIndexes.length, skipped, swappedIndexes };
}

/**
 * Einen Tausch in die Variante übernehmen: Position `index` des ORIGINALS bekommt `toId`. Zurück zur Original-Übung
 * entfernt den Tausch; ohne Täusche → null („Original wiederherstellen“).
 */
export function withVariantSwap(
  original: Pick<Workout, 'version' | 'exercises'>,
  variant: WorkoutVariant | null,
  index: number,
  toId: string,
): WorkoutVariant | null {
  const from = original.exercises[index]?.exercise_id;
  if (from === undefined) return variant;
  const others = (variant?.swaps ?? []).filter((s) => s.index !== index && s.to !== toId);
  const swaps = from === toId ? others : [...others, { index, from, to: toId }];
  if (swaps.length === 0) return null;
  return workoutVariantSchema.parse({
    version: 1,
    base_version: original.version,
    swaps: swaps.sort((a, b) => a.index - b.index),
  });
}
