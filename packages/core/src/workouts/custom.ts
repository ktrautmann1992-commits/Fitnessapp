import { z } from 'zod';

import { CUSTOM_WORKOUT_RULES, WORKOUT_LIMITS } from '../constants';
import { normalizeSearchText } from '../content/glossary';
import { contentIdSchema, equipmentSlugSchema, type Exercise } from '../content/schemas';
import type { CautionTag, ExperienceLevel, MovementPattern, MuscleGroup } from '../enums';
import { workoutPlayerPlan } from './player';
import {
  type Workout,
  type WorkoutCategory,
  type WorkoutContentItem,
  workoutItemSchema,
  workoutSchema,
} from './schema';
import {
  exerciseAllowedBy,
  exerciseFeasibleWith,
  mapWorkoutItem,
  workoutEquipmentUnion,
  WORKOUT_SEARCH_EXCLUDED_IDS,
} from './swap';
import { estimateWorkoutSeconds } from './timer';

/**
 * Eigenes Workout erstellen (Gründer-Wunsch 18.11.2026, docs/PLAN-EIGENE-WORKOUTS.md): Aus Dauer, Muskelgruppen,
 * Geräten, Lieblingsübungen und „Mag ich nicht“ baut die App ein Workout im Stil von Barbell Burn – Track 1 Aufwärmen,
 * je Muskelgruppe ein Track (große Muskeln zuerst, Bauch/Core zum Schluss), zuletzt Dehnen. Format `sets_reps`: Der
 * Workout-Player gibt jeder Wiederholungs-Übung ein Zeitfenster, das Workout läuft ohne Tippen.
 *
 * Gespeichert wird die Bauanleitung (`CustomWorkoutDefinition`: Eingaben + Tracks mit Positionen); das Workout für
 * Anzeige und Player entsteht daraus (customWorkoutFromDefinition) und ist ein normales, per workoutSchema gültiges
 * Workout. Rein und deterministisch: gleiche Eingaben (inkl. `seed`) → gleiches Workout; „Neu würfeln“ = neuer Seed.
 *
 * Sicherheit: Aufwärmen immer, Schwierigkeit nach Level (CUSTOM_WORKOUT_RULES.maxDifficulty), vorsichtiger Plan wie
 * Einsteiger, ausgeschlossene Merkmale (Gesundheits-Check, Fit im Alter …) nie, „Mag ich nicht“ nie. Lieblingsübungen
 * nur, wenn sie zu einer gewählten Muskelgruppe passen und machbar/erlaubt sind – sonst ein Hinweis.
 */

const R = CUSTOM_WORKOUT_RULES;

// ---------------------------------------------------------------------------------------------------------
// Muskelgruppen
// ---------------------------------------------------------------------------------------------------------

/** Wählbare Muskelgruppen, zugleich die Reihenfolge der Tracks: große Muskeln zuerst, Bauch/Core zum Schluss. */
export const CUSTOM_WORKOUT_AREAS = [
  'full_body',
  'legs',
  'glutes',
  'back',
  'chest',
  'shoulders',
  'arms',
  'core',
] as const;
export type CustomWorkoutArea = (typeof CUSTOM_WORKOUT_AREAS)[number];

/** Muskeln je Gruppe (MUSCLE_GROUPS); „Ganzkörper“ hat eine eigene Regel (isFullBodyExercise). */
export const CUSTOM_AREA_MUSCLES: Readonly<
  Record<Exclude<CustomWorkoutArea, 'full_body'>, readonly MuscleGroup[]>
> = {
  legs: ['quadriceps', 'hamstrings', 'adductors', 'calves'],
  glutes: ['glutes'],
  back: ['lats', 'upper_back', 'lower_back'],
  chest: ['chest'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs', 'obliques'],
};

/** Namen für Titel und Track-Hinweise (Inhaltstext wie summary_de; die App zeigt dieselben Namen). */
export const CUSTOM_AREA_LABELS_DE: Readonly<Record<CustomWorkoutArea, string>> = {
  full_body: 'Ganzkörper',
  legs: 'Beine',
  glutes: 'Po',
  back: 'Rücken',
  chest: 'Brust',
  shoulders: 'Schultern',
  arms: 'Arme',
  core: 'Bauch/Core',
};

const LOWER: readonly MuscleGroup[] = ['quadriceps', 'hamstrings', 'glutes', 'adductors', 'calves'];
const UPPER: readonly MuscleGroup[] = [
  'chest',
  'lats',
  'upper_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
];
const CORE_PATTERNS: readonly MovementPattern[] = [
  'core_anti_extension',
  'core_anti_rotation',
  'core_flexion',
];
/** Muster, die nie in einen Kraft-Track kommen (nur Aufwärmen/Dehnen). */
const CALM_PATTERNS: readonly MovementPattern[] = ['mobility', 'balance'];

/** Ganzkörper: Kondition/Tragen oder Hauptmuskeln oben UND unten (z. B. Thruster, Burpee). */
export function isFullBodyExercise(
  exercise: Pick<Exercise, 'id' | 'movement_pattern' | 'primary_muscles'>,
): boolean {
  // Lauf-ABC sind Technik-Übungen zum Laufplan, kein Ganzkörper-Track.
  if (exercise.id.startsWith('lauf-abc-')) return false;
  if (exercise.movement_pattern === 'conditioning' || exercise.movement_pattern === 'carry') {
    return true;
  }
  return (
    exercise.primary_muscles.some((m) => LOWER.includes(m)) &&
    exercise.primary_muscles.some((m) => UPPER.includes(m))
  );
}

/** Trainiert die Übung die Gruppe als Hauptmuskel? (Bauch/Core zusätzlich über die Rumpf-Muster.) */
export function exerciseMatchesArea(
  exercise: Pick<Exercise, 'id' | 'movement_pattern' | 'primary_muscles'>,
  area: CustomWorkoutArea,
): boolean {
  if (CALM_PATTERNS.includes(exercise.movement_pattern)) return false;
  if (area === 'full_body') return isFullBodyExercise(exercise);
  if (area === 'core' && CORE_PATTERNS.includes(exercise.movement_pattern)) return true;
  // Kondition (Hampelmann, Marschieren …) gehört nur zu Ganzkörper.
  if (exercise.movement_pattern === 'conditioning') return false;
  return exercise.primary_muscles.some((m) => CUSTOM_AREA_MUSCLES[area].includes(m));
}

// ---------------------------------------------------------------------------------------------------------
// Eingaben und gespeicherte Bauanleitung (Zod an der Grenze)
// ---------------------------------------------------------------------------------------------------------

const distinct = <T extends z.ZodType>(schema: T, max: number, min = 0) =>
  z
    .array(schema)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.');

export const CUSTOM_WORKOUT_SEED_MAX = 2_147_483_647;

export const customWorkoutInputSchema = z.strictObject({
  minutes: z
    .number()
    .int()
    .refine(
      (m) => (R.minutes as readonly number[]).includes(m),
      'Dauer: 15, 20, 30, 45 oder 60 Minuten.',
    ),
  areas: distinct(z.enum(CUSTOM_WORKOUT_AREAS), CUSTOM_WORKOUT_AREAS.length, 1),
  /** Geräte für dieses Workout (Standard: Angaben im Profil); leer = ohne Geräte. */
  equipment_ids: distinct(equipmentSlugSchema, 60),
  favorite_ids: distinct(contentIdSchema, WORKOUT_LIMITS.exercises.max),
  dislike_ids: distinct(contentIdSchema, R.maxDislikes),
  seed: z.number().int().min(0).max(CUSTOM_WORKOUT_SEED_MAX),
});
export type CustomWorkoutInput = z.output<typeof customWorkoutInputSchema>;

export const CUSTOM_TRACK_KINDS = ['warmup', 'area', 'cooldown'] as const;
export type CustomTrackKind = (typeof CUSTOM_TRACK_KINDS)[number];

/** Position im eigenen Workout: wie eine Workout-Position im Format `sets_reps` (Sätze Pflicht), ohne Hinweis. */
const customItemSchema = workoutItemSchema.superRefine((item, ctx) => {
  if (item.sets === null) {
    ctx.addIssue({ code: 'custom', path: ['sets'], message: 'Sätze angeben.' });
  }
  if (item.duration_s !== null && item.duration_s > WORKOUT_LIMITS.workS.max) {
    ctx.addIssue({ code: 'custom', path: ['duration_s'], message: 'Zu lang.' });
  }
});

export const customTrackSchema = z
  .strictObject({
    kind: z.enum(CUSTOM_TRACK_KINDS),
    area: z.enum(CUSTOM_WORKOUT_AREAS).nullable(),
    items: z.array(customItemSchema).max(WORKOUT_LIMITS.exercises.max),
  })
  .refine((t) => (t.kind === 'area') === (t.area !== null), {
    path: ['area'],
    message: 'Muskelgruppe nur bei Tracks einer Muskelgruppe.',
  });
export type CustomTrack = z.output<typeof customTrackSchema>;

/**
 * Bauanleitung (Tabelle `custom_workouts.definition`): Eingaben und Tracks. Regeln: zuerst Aufwärmen (mindestens eine
 * Übung), zuletzt Dehnen, dazwischen Tracks einer Muskelgruppe; höchstens WORKOUT_LIMITS.exercises.max Übungen, jede
 * höchstens einmal.
 */
export const customWorkoutDefinitionSchema = z
  .strictObject({
    version: z.literal(1),
    input: customWorkoutInputSchema,
    tracks: z
      .array(customTrackSchema)
      .min(2)
      .max(WORKOUT_LIMITS.exercises.max + 2),
  })
  .superRefine((def, ctx) => {
    const first = def.tracks[0];
    const last = def.tracks.at(-1);
    if (first?.kind !== 'warmup' || first.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['tracks', 0], message: 'Aufwärmen fehlt.' });
    }
    if (last?.kind !== 'cooldown') {
      ctx.addIssue({ code: 'custom', path: ['tracks'], message: 'Dehnen fehlt.' });
    }
    def.tracks.slice(1, -1).forEach((t, i) => {
      if (t.kind !== 'area') {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', i + 1],
          message: 'Track ohne Muskelgruppe.',
        });
      }
    });
    const ids = def.tracks.flatMap((t) => t.items.map((item) => item.exercise_id));
    if (ids.length < WORKOUT_LIMITS.exercises.min || ids.length > WORKOUT_LIMITS.exercises.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['tracks'],
        message: `${WORKOUT_LIMITS.exercises.min}–${WORKOUT_LIMITS.exercises.max} Übungen.`,
      });
    }
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['tracks'], message: 'Jede Übung höchstens einmal.' });
    }
  });
export type CustomWorkoutDefinition = z.output<typeof customWorkoutDefinitionSchema>;

/** Name eines eigenen Workouts (Spalte `custom_workouts.name`). */
export const customWorkoutNameSchema = z
  .string()
  .trim()
  .min(R.name.min, `Mindestens ${R.name.min} Zeichen.`)
  .max(R.name.max, `Höchstens ${R.name.max} Zeichen.`);

/** Workout-ID eines eigenen Workouts (für Player und Tagebuch): „eigen-“ + Kennung der Zeile. */
export const CUSTOM_WORKOUT_ID_PREFIX = 'eigen-';

export function customWorkoutId(rowId: string): string {
  return `${CUSTOM_WORKOUT_ID_PREFIX}${rowId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

export function isCustomWorkoutId(id: string): boolean {
  return id.startsWith(CUSTOM_WORKOUT_ID_PREFIX);
}

// ---------------------------------------------------------------------------------------------------------
// Kontext (Person) und Auswahl
// ---------------------------------------------------------------------------------------------------------

export interface CustomBuildContext {
  /** Trainingserfahrung (Profil); null = unbekannt → wie Einsteiger. */
  readonly level: ExperienceLevel | null;
  /** Vorsichtiger Plan (Gesundheits-Check auffällig oder fehlend): wie Einsteiger. */
  readonly cautious: boolean;
  /** Ausgeschlossene Merkmale der Sicherheitsregeln. */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Weitere „Mag ich nicht“ der Person (eigene Liste, Übungs-Präferenzen) zusätzlich zu `input.dislike_ids`. */
  readonly dislikes?: ReadonlySet<string>;
}

/** Höchste und bevorzugte Übungs-Schwierigkeit für die Person. */
export function customDifficulty(ctx: Pick<CustomBuildContext, 'level' | 'cautious'>): {
  readonly max: number;
  readonly target: number;
} {
  const level: ExperienceLevel = ctx.cautious || ctx.level === null ? 'beginner' : ctx.level;
  return { max: R.maxDifficulty[level], target: R.targetDifficulty[level] };
}

/** Übungen, die nie in ein eigenes Workout kommen (WORKOUT_SEARCH_EXCLUDED_IDS: Barbell-Burn-Gruppenübungen). */
const NEVER_IDS: ReadonlySet<string> = new Set(WORKOUT_SEARCH_EXCLUDED_IDS);

/** Zahl 0 … 1 aus Seed und Übungs-ID (FNV-1a) – nur Gleichstand-Auflösung, unabhängig von der Reihenfolge. */
function seededKey(seed: number, id: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h / 4294967296;
}

export type CustomExerciseBlock =
  'not_found' | 'disliked' | 'equipment' | 'not_allowed' | 'too_hard' | 'not_eligible';

/** Warum eine Übung nicht in ein eigenes Workout kommt (null = geht). */
export function customExerciseBlock(
  exercise: Exercise | undefined,
  input: Pick<CustomWorkoutInput, 'equipment_ids' | 'dislike_ids'>,
  ctx: CustomBuildContext,
): CustomExerciseBlock | null {
  if (!exercise || exercise.status !== 'published') return 'not_found';
  if (NEVER_IDS.has(exercise.id)) return 'not_eligible';
  if (input.dislike_ids.includes(exercise.id) || ctx.dislikes?.has(exercise.id)) return 'disliked';
  if (!exerciseFeasibleWith(exercise, new Set(input.equipment_ids))) return 'equipment';
  if (!exerciseAllowedBy(exercise, ctx.excludedCautionTags)) return 'not_allowed';
  if (exercise.difficulty > customDifficulty(ctx).max) return 'too_hard';
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Dosierung und Dauer
// ---------------------------------------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Grund-Dosierung einer Übung in einem Track (vor dem Skalieren). */
export function customItemFor(
  exercise: Pick<Exercise, 'id' | 'load_type' | 'unilateral'>,
  kind: CustomTrackKind,
  restS: number = R.restS.base,
): WorkoutContentItem {
  if (kind !== 'area') {
    const seconds = kind === 'warmup' ? R.warmupS.base : R.cooldownS.base;
    return {
      exercise_id: exercise.id,
      reps: null,
      duration_s: seconds,
      sets: 1,
      rest_s: WORKOUT_LIMITS.easyMinRestS,
      note_de: null,
    };
  }
  if (exercise.load_type === 'time') {
    return {
      exercise_id: exercise.id,
      reps: null,
      duration_s: R.holdS.base,
      sets: 2,
      rest_s: restS,
      note_de: null,
    };
  }
  return {
    exercise_id: exercise.id,
    reps: exercise.unilateral ? R.unilateralReps.base : R.reps.base,
    duration_s: null,
    sets: 2,
    rest_s: restS,
    note_de: null,
  };
}

function flatItems(def: Pick<CustomWorkoutDefinition, 'tracks'>): WorkoutContentItem[] {
  return def.tracks.flatMap((t) => t.items);
}

/** Geschätzte Sekunden im Player (ohne die 10 s „Gleich geht's los“), wie Barbell Burn. */
export function customWorkoutSeconds(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  lookup: ReadonlyMap<string, Pick<Exercise, 'unilateral'>>,
): number {
  const exercises = flatItems(def);
  if (exercises.length === 0) return 0;
  const unilateral = (id: string) => lookup.get(id)?.unilateral === true;
  const steps = workoutPlayerPlan(
    { format: 'sets_reps', rounds: 1, round_rest_s: 0, exercises, minutes: 60, title_de: '' },
    unilateral,
  );
  return estimateWorkoutSeconds(
    steps.filter((s) => s.kind !== 'prepare'),
    unilateral,
  );
}

/** Geschätzte Minuten (gerundet, mindestens 1) – Anzeige „Gesamt etwa … Min.“. */
export function customWorkoutMinutes(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  lookup: ReadonlyMap<string, Pick<Exercise, 'unilateral'>>,
): number {
  return Math.max(1, Math.round(customWorkoutSeconds(def, lookup) / 60));
}

type Tracks = CustomTrack[];

function mapItems(
  tracks: Tracks,
  fn: (item: WorkoutContentItem, track: CustomTrack) => WorkoutContentItem,
): Tracks {
  return tracks.map((t) => ({ ...t, items: t.items.map((item) => fn(item, t)) }));
}

/**
 * Dosierung auf die Zieldauer bringen (±CUSTOM_WORKOUT_RULES.toleranceShare): erst verkleinern, falls schon zu lang
 * (Pausen, Sätze, Wiederholungen/Haltezeit, Aufwärmen/Dehnen, zuletzt Übungen aus großen Tracks), dann schrittweise
 * vergrößern – Sätze bis 3, Wiederholungen/Haltezeit, Sätze bis 6, Pausen, Aufwärmen/Dehnen – solange der nächste Schritt
 * nicht über die Obergrenze geht. Deterministisch (immer die Position mit dem kleinsten Wert zuerst).
 */
function scaleTracks(
  start: Tracks,
  targetS: number,
  lookup: ReadonlyMap<string, Exercise>,
  restMin: number,
): Tracks {
  const upper = targetS * (1 + R.toleranceShare);
  const seconds = (tracks: Tracks) => customWorkoutSeconds({ tracks }, lookup);
  let tracks = start;

  const repsLimits = (id: string) =>
    lookup.get(id)?.unilateral === true ? R.unilateralReps : R.reps;

  // --- Verkleinern -------------------------------------------------------------------------------------
  const shrinkSteps: ((t: Tracks) => Tracks)[] = [
    (t) => mapItems(t, (item, tr) => (tr.kind === 'area' ? { ...item, rest_s: restMin } : item)),
    (t) => mapItems(t, (item, tr) => (tr.kind === 'area' ? { ...item, sets: 1 } : item)),
    (t) =>
      mapItems(t, (item, tr) =>
        tr.kind !== 'area'
          ? item
          : item.reps !== null
            ? { ...item, reps: repsLimits(item.exercise_id).min }
            : { ...item, duration_s: R.holdS.min },
      ),
    (t) =>
      mapItems(t, (item, tr) =>
        tr.kind === 'warmup'
          ? { ...item, duration_s: R.warmupS.min }
          : tr.kind === 'cooldown'
            ? { ...item, duration_s: R.cooldownS.min }
            : item,
      ),
  ];
  for (const step of shrinkSteps) {
    if (seconds(tracks) <= upper) break;
    tracks = step(tracks);
  }
  // Immer noch zu lang: Übungen aus Tracks mit mehreren Übungen streichen (größter Track, letzte Übung), dann zweite
  // Aufwärm- und Dehn-Übung. Jede Muskelgruppe behält mindestens eine Übung.
  while (seconds(tracks) > upper) {
    const byArea = new Map<string, number>();
    tracks.forEach((t) => {
      if (t.kind === 'area' && t.area)
        byArea.set(t.area, (byArea.get(t.area) ?? 0) + t.items.length);
    });
    let best = -1;
    tracks.forEach((t, i) => {
      if (t.kind !== 'area' || !t.area || (byArea.get(t.area) ?? 0) < 2 || t.items.length === 0)
        return;
      if (best < 0 || t.items.length > (tracks[best]?.items.length ?? 0)) best = i;
    });
    if (best < 0) {
      best = tracks.findIndex((t) => t.kind !== 'area' && t.items.length > 1);
      if (best < 0) break;
    }
    tracks = tracks
      .map((t, i) => (i === best ? { ...t, items: t.items.slice(0, -1) } : t))
      .filter((t) => t.items.length > 0 || t.kind !== 'area');
  }

  // --- Vergrößern --------------------------------------------------------------------------------------
  type Grow = {
    readonly value: (item: WorkoutContentItem) => number;
    readonly next: (item: WorkoutContentItem) => WorkoutContentItem | null;
    readonly kinds: readonly CustomTrackKind[];
  };
  const growPhases: Grow[] = [
    {
      kinds: ['area'],
      value: (item) => item.sets ?? 1,
      next: (item) => ((item.sets ?? 1) < 3 ? { ...item, sets: (item.sets ?? 1) + 1 } : null),
    },
    {
      kinds: ['area'],
      value: (item) => (item.reps !== null ? item.reps * 3 : (item.duration_s ?? 0)),
      next: (item) => {
        if (item.reps !== null) {
          const max = Math.min(repsLimits(item.exercise_id).max, 15);
          return item.reps < max ? { ...item, reps: Math.min(max, item.reps + 1) } : null;
        }
        const d = item.duration_s ?? 0;
        return d < 40 ? { ...item, duration_s: Math.min(40, d + 5) } : null;
      },
    },
    {
      kinds: ['area'],
      value: (item) => item.sets ?? 1,
      next: (item) =>
        (item.sets ?? 1) < R.sets.max ? { ...item, sets: (item.sets ?? 1) + 1 } : null,
    },
    {
      kinds: ['area'],
      value: (item) => (item.reps !== null ? item.reps * 3 : (item.duration_s ?? 0)),
      next: (item) => {
        if (item.reps !== null) {
          const max = repsLimits(item.exercise_id).max;
          return item.reps < max ? { ...item, reps: item.reps + 1 } : null;
        }
        const d = item.duration_s ?? 0;
        return d < R.holdS.max ? { ...item, duration_s: Math.min(R.holdS.max, d + 5) } : null;
      },
    },
    {
      kinds: ['area'],
      value: (item) => item.rest_s,
      next: (item) =>
        item.rest_s < R.restS.max
          ? { ...item, rest_s: Math.min(R.restS.max, item.rest_s + 5) }
          : null,
    },
    {
      kinds: ['warmup', 'cooldown'],
      value: (item) => item.duration_s ?? 0,
      next: (item) => {
        const d = item.duration_s ?? 0;
        return d < R.warmupS.max ? { ...item, duration_s: Math.min(R.warmupS.max, d + 10) } : null;
      },
    },
  ];
  let current = seconds(tracks);
  // Höchstens so viele Schritte, wie es Stellschrauben gibt (Sicherheitsnetz gegen Endlosschleifen).
  for (let guard = 0; guard < 2000 && current < targetS; guard += 1) {
    let applied = false;
    for (const phase of growPhases) {
      const positions = tracks
        .flatMap((t, ti) =>
          phase.kinds.includes(t.kind) ? t.items.map((item, ii) => ({ ti, ii, item })) : [],
        )
        .sort((a, b) => phase.value(a.item) - phase.value(b.item) || a.ti - b.ti || a.ii - b.ii);
      for (const pos of positions) {
        const next = phase.next(pos.item);
        if (!next) continue;
        const candidate = tracks.map((t, ti) =>
          ti === pos.ti ? { ...t, items: t.items.map((it, ii) => (ii === pos.ii ? next : it)) } : t,
        );
        const s = seconds(candidate);
        if (s > upper) continue;
        tracks = candidate;
        current = s;
        applied = true;
        break;
      }
      if (applied) break;
    }
    if (!applied) break;
  }
  return tracks;
}

// ---------------------------------------------------------------------------------------------------------
// Bauen
// ---------------------------------------------------------------------------------------------------------

export type CustomBuildIssue =
  /** Für diese Gruppen gibt es mit den Angaben keine passende Übung. */
  | { readonly kind: 'no_candidates'; readonly areas: readonly CustomWorkoutArea[] }
  /** Lieblingsübung nicht genommen: Grund je Übung (`no_area` = passt zu keiner gewählten Gruppe). */
  | {
      readonly kind: 'favorite_skipped';
      readonly exerciseId: string;
      readonly reason: CustomExerciseBlock | 'no_area' | 'no_room';
    }
  /** Zieldauer nicht erreichbar (zu wenige Übungen) bzw. zu lang (zu viele Gruppen für die Dauer). */
  | { readonly kind: 'duration_short' | 'duration_long'; readonly minutes: number };

export interface CustomBuildResult {
  /** null = nichts zu trainieren (z. B. alles „Mag ich nicht“ oder keine Übung mit diesen Geräten). */
  readonly definition: CustomWorkoutDefinition | null;
  readonly issues: readonly CustomBuildIssue[];
  /** Geschätzte Minuten im Player. */
  readonly minutes: number;
  /** Mindestens eine Übung in einem Muskel-Track (sonst ist nichts zu trainieren – nicht speicherbar). */
  readonly hasWork: boolean;
}

function warmupCount(minutes: number): number {
  return minutes >= 60 ? 3 : 2;
}
function cooldownCount(minutes: number): number {
  return minutes >= 45 ? 2 : 1;
}

/** Ganzkörper-Track: echte Ganzkörper-Übungen (oben UND unten) vor Tragen vor reiner Kondition; sonst gleich. */
function fullBodyTier(exercise: Exercise, area: CustomWorkoutArea): number {
  if (area !== 'full_body') return 0;
  const both =
    exercise.primary_muscles.some((m) => LOWER.includes(m)) &&
    exercise.primary_muscles.some((m) => UPPER.includes(m));
  return both ? 0 : exercise.movement_pattern === 'carry' ? 1 : 2;
}

/** Aufwärm-Übungen (Puls hoch, dann Gelenke der gewählten Gruppen), ohne Sprünge und Geräte. */
const WARMUP_FIRST_IDS = ['marschieren-auf-der-stelle', 'step-jacks'] as const;

function areaMuscles(areas: readonly CustomWorkoutArea[]): Set<MuscleGroup> {
  const all = areas.includes('full_body')
    ? Object.values(CUSTOM_AREA_MUSCLES).flat()
    : areas.flatMap((a) => (a === 'full_body' ? [] : CUSTOM_AREA_MUSCLES[a]));
  return new Set(all);
}

/**
 * Eigenes Workout bauen. `library` = freigegebene Übungen (PlanLibrary.exercises, ohne Yoga-Posen). Ergebnis ist eine
 * gültige Bauanleitung (customWorkoutDefinitionSchema) und Hinweise; das Workout daraus: customWorkoutFromDefinition.
 */
export function buildCustomWorkout(
  rawInput: CustomWorkoutInput,
  library: ReadonlyMap<string, Exercise>,
  ctx: CustomBuildContext,
): CustomBuildResult {
  const input = customWorkoutInputSchema.parse(rawInput);
  const { target } = customDifficulty(ctx);
  const restMin = ctx.cautious || ctx.level !== 'competitive' ? R.restS.cautiousMin : R.restS.min;
  const issues: CustomBuildIssue[] = [];
  const used = new Set<string>();
  const equipment = new Set<string>();
  const key = (id: string) => seededKey(input.seed, id);
  const areas = CUSTOM_WORKOUT_AREAS.filter((a) => input.areas.includes(a));
  // Aufwärmen und Dehnen kürzen, wenn sonst nicht jede Gruppe eine Übung bekäme (höchstens 12 Übungen).
  let warmN = warmupCount(input.minutes);
  let coolN = cooldownCount(input.minutes);
  while (warmN + coolN + areas.length > R.maxExercises && coolN > 1) coolN -= 1;
  while (warmN + coolN + areas.length > R.maxExercises && warmN > 1) warmN -= 1;

  const usable = (e: Exercise) => customExerciseBlock(e, input, ctx) === null && !used.has(e.id);
  const fitsEquipment = (e: Exercise) => new Set([...equipment, ...e.equipment_ids]).size <= 8;
  const take = (e: Exercise) => {
    used.add(e.id);
    e.equipment_ids.forEach((id) => equipment.add(id));
  };
  const all = [...library.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- Aufwärmen ---------------------------------------------------------------------------------------
  const muscles = areaMuscles(areas);
  const calmOk = (e: Exercise) =>
    usable(e) &&
    e.difficulty === 1 &&
    e.load_type !== 'weight' &&
    e.equipment_ids.length === 0 &&
    !e.caution_tags.includes('high_impact');
  const warmPool = all.filter(
    (e) =>
      calmOk(e) &&
      ((e.movement_pattern === 'mobility' && e.load_type === 'bodyweight') ||
        (e.movement_pattern === 'conditioning' && e.load_type === 'time')),
  );
  const warmup: Exercise[] = [];
  const pulse =
    WARMUP_FIRST_IDS.map((id) => library.get(id)).find(
      (e): e is Exercise => e !== undefined && calmOk(e),
    ) ??
    warmPool
      .filter((e) => e.movement_pattern === 'conditioning')
      .sort((a, b) => key(a.id) - key(b.id))[0];
  if (pulse) {
    warmup.push(pulse);
    take(pulse);
  }
  const mobility = warmPool
    .filter((e) => e.movement_pattern === 'mobility' && usable(e))
    .sort(
      (a, b) =>
        Number(b.primary_muscles.some((m) => muscles.has(m))) -
          Number(a.primary_muscles.some((m) => muscles.has(m))) || key(a.id) - key(b.id),
    );
  for (const e of mobility) {
    if (warmup.length >= warmN) break;
    warmup.push(e);
    take(e);
  }

  // --- Dehnen (am Ende, aber jetzt reservieren, damit keine Übung doppelt vorkommt) ----------------------
  const stretches = all
    .filter((e) => calmOk(e) && e.movement_pattern === 'mobility' && e.load_type === 'time')
    .sort(
      (a, b) =>
        Number(b.primary_muscles.some((m) => muscles.has(m))) -
          Number(a.primary_muscles.some((m) => muscles.has(m))) || key(a.id) - key(b.id),
    );
  const cooldown: Exercise[] = [];
  const coveredMuscles = new Set<MuscleGroup>();
  for (const e of stretches) {
    if (cooldown.length >= coolN) break;
    if (e.primary_muscles.every((m) => coveredMuscles.has(m))) continue;
    cooldown.push(e);
    take(e);
    e.primary_muscles.forEach((m) => coveredMuscles.add(m));
  }

  // --- Muskel-Tracks -----------------------------------------------------------------------------------
  const targetS = input.minutes * 60;
  const fixedS =
    warmup.length * (R.warmupS.base + WORKOUT_LIMITS.easyMinRestS) +
    cooldown.length * (R.cooldownS.base + WORKOUT_LIMITS.easyMinRestS);
  const room = R.maxExercises - warmup.length - cooldown.length;
  const wanted = clamp(
    Math.round((targetS - fixedS) / R.trackSeconds),
    areas.length,
    Math.max(areas.length, room),
  );
  const slots = Math.min(wanted, room);
  // Plätze je Gruppe: reihum in Track-Reihenfolge (große Muskeln bekommen zuerst eine weitere Übung).
  const perArea = new Map<CustomWorkoutArea, number>(areas.map((a) => [a, 0]));
  for (let i = 0; i < slots; i += 1) {
    const area = areas[i % areas.length] as CustomWorkoutArea;
    perArea.set(area, (perArea.get(area) ?? 0) + 1);
  }

  // Lieblingsübungen zuerst einer passenden Gruppe zuordnen.
  const favoritesFor = new Map<CustomWorkoutArea, Exercise[]>();
  for (const id of input.favorite_ids) {
    const exercise = library.get(id);
    const block = customExerciseBlock(exercise, input, ctx);
    if (block !== null || !exercise) {
      issues.push({ kind: 'favorite_skipped', exerciseId: id, reason: block ?? 'not_found' });
      continue;
    }
    if (used.has(exercise.id)) continue;
    const area = areas.find((a) => exerciseMatchesArea(exercise, a));
    if (!area) {
      issues.push({ kind: 'favorite_skipped', exerciseId: id, reason: 'no_area' });
      continue;
    }
    const list = favoritesFor.get(area) ?? [];
    if (list.length >= Math.max(1, perArea.get(area) ?? 0) || !fitsEquipment(exercise)) {
      issues.push({ kind: 'favorite_skipped', exerciseId: id, reason: 'no_room' });
      continue;
    }
    list.push(exercise);
    favoritesFor.set(area, list);
    take(exercise);
  }

  const restBase = Math.max(restMin, R.restS.base);
  const areaTracks: CustomTrack[] = [];
  const empty: CustomWorkoutArea[] = [];
  for (const area of areas) {
    const count = Math.max(1, perArea.get(area) ?? 1);
    const chosen: Exercise[] = [...(favoritesFor.get(area) ?? [])];
    const ranked = all
      .filter((e) => usable(e) && exerciseMatchesArea(e, area) && fitsEquipment(e))
      .sort(
        (a, b) =>
          fullBodyTier(a, area) - fullBodyTier(b, area) ||
          Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) ||
          key(a.id) - key(b.id),
      );
    // Abwechslung: erst neue Bewegungsmuster, dann auffüllen.
    for (const pass of [true, false]) {
      for (const e of ranked) {
        if (chosen.length >= count) break;
        if (!usable(e) || !fitsEquipment(e)) continue;
        if (pass && chosen.some((c) => c.movement_pattern === e.movement_pattern)) continue;
        chosen.push(e);
        take(e);
      }
    }
    if (chosen.length === 0) {
      empty.push(area);
      continue;
    }
    // Tracks zu höchstens 3 Übungen, möglichst gleich groß („Teil 1“, „Teil 2“ …).
    const parts = Math.ceil(chosen.length / R.perTrack.max);
    const size = Math.ceil(chosen.length / parts);
    for (let p = 0; p < parts; p += 1) {
      const items = chosen
        .slice(p * size, (p + 1) * size)
        .map((e) => customItemFor(e, 'area', restBase));
      if (items.length > 0) areaTracks.push({ kind: 'area', area, items });
    }
  }
  if (empty.length > 0) issues.push({ kind: 'no_candidates', areas: empty });

  const unscaled: Tracks = [
    { kind: 'warmup', area: null, items: warmup.map((e) => customItemFor(e, 'warmup')) },
    ...areaTracks,
    { kind: 'cooldown', area: null, items: cooldown.map((e) => customItemFor(e, 'cooldown')) },
  ];
  if (areaTracks.length === 0) return { definition: null, issues, minutes: 0, hasWork: false };
  const tracks = scaleTracks(unscaled, targetS, library, restMin);
  const parsed = customWorkoutDefinitionSchema.safeParse({ version: 1, input, tracks });
  if (!parsed.success) return { definition: null, issues, minutes: 0, hasWork: false };
  const definition = parsed.data;
  const seconds = customWorkoutSeconds(definition, library);
  const hasWork = true;
  if (hasWork && seconds < targetS * (1 - R.toleranceShare)) {
    issues.push({ kind: 'duration_short', minutes: Math.round(seconds / 60) });
  }
  if (hasWork && seconds > targetS * (1 + R.toleranceShare)) {
    issues.push({ kind: 'duration_long', minutes: Math.round(seconds / 60) });
  }
  return { definition, issues, minutes: customWorkoutMinutes(definition, library), hasWork };
}

/** Neuer Seed für „Neu würfeln“ (deterministisch aus dem alten). */
export function nextCustomSeed(seed: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 1) % CUSTOM_WORKOUT_SEED_MAX;
}

/** Namensvorschlag: „Mein Beine & Po 30“, „Mein Brust, Rücken & Arme 45“; viele Gruppen → „Mein Ganzkörper 60“. */
export function suggestCustomWorkoutName(
  input: Pick<CustomWorkoutInput, 'areas' | 'minutes'>,
): string {
  const areas = CUSTOM_WORKOUT_AREAS.filter((a) => input.areas.includes(a));
  const labels =
    areas.length > 3
      ? [CUSTOM_AREA_LABELS_DE.full_body]
      : areas.map((a) => CUSTOM_AREA_LABELS_DE[a]);
  const joined =
    labels.length <= 1
      ? (labels[0] ?? CUSTOM_AREA_LABELS_DE.full_body)
      : `${labels.slice(0, -1).join(', ')} & ${labels.at(-1) ?? ''}`;
  return `Mein ${joined} ${input.minutes}`.slice(0, R.name.max);
}

// ---------------------------------------------------------------------------------------------------------
// Bauanleitung → Workout
// ---------------------------------------------------------------------------------------------------------

/** Name eines Tracks („Aufwärmen“, „Beine“, „Beine (Teil 2)“, „Dehnen“). */
export function customTrackLabel(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  trackIndex: number,
): string {
  const track = def.tracks[trackIndex];
  if (!track) return '';
  if (track.kind === 'warmup') return 'Aufwärmen';
  if (track.kind === 'cooldown') return 'Dehnen';
  const area = track.area ?? 'full_body';
  const sameArea = def.tracks.filter((t) => t.kind === 'area' && t.area === area);
  const part = def.tracks
    .slice(0, trackIndex + 1)
    .filter((t) => t.kind === 'area' && t.area === area).length;
  return sameArea.length > 1
    ? `${CUSTOM_AREA_LABELS_DE[area]} (Teil ${part})`
    : CUSTOM_AREA_LABELS_DE[area];
}

function categoryOf(areas: readonly CustomWorkoutArea[]): WorkoutCategory {
  if (areas.length === 1 && areas[0] === 'core') return 'core';
  if (areas.every((a) => a === 'legs' || a === 'glutes')) return 'legs_glutes';
  if (areas.every((a) => a === 'chest' || a === 'back' || a === 'shoulders' || a === 'arms')) {
    return 'upper_body';
  }
  return 'full_body';
}

/**
 * Sterne aus den Übungen: höchste Schwierigkeit der Muskel-Tracks, ab 45 Minuten einer mehr; Sprünge nie unter
 * 2 Sternen, hohe Technik nie unter 3 (Regel W5). 1–5.
 */
function starsOf(
  tracks: readonly CustomTrack[],
  minutes: number,
  lookup: ReadonlyMap<string, Exercise>,
): number {
  const work = tracks.filter((t) => t.kind === 'area').flatMap((t) => t.items);
  const exercises = work.map((i) => lookup.get(i.exercise_id)).filter((e): e is Exercise => !!e);
  let stars = Math.max(1, ...exercises.map((e) => e.difficulty)) + (minutes >= 45 ? 1 : 0);
  if (exercises.some((e) => e.caution_tags.includes('high_impact'))) stars = Math.max(stars, 2);
  if (exercises.some((e) => e.caution_tags.includes('high_skill'))) stars = Math.max(stars, 3);
  return clamp(stars, WORKOUT_LIMITS.stars.min, WORKOUT_LIMITS.stars.max);
}

export interface CustomWorkoutMeta {
  /** Workout-ID (customWorkoutId der Zeile). */
  readonly id: string;
  readonly name: string;
  /** Heute (ISO) – `meta.created_on`. */
  readonly today: string;
}

/**
 * Das Workout zur Bauanleitung (gültig nach workoutSchema, Format `sets_reps`): Hinweis je Übung „Track n – Name“,
 * Geräte = Vereinigung, Dauer = Schätzung im Player, Status „Entwurf“ (eigener Inhalt, nie freigegeben/geteilt).
 */
export function customWorkoutFromDefinition(
  def: CustomWorkoutDefinition,
  meta: CustomWorkoutMeta,
  lookup: ReadonlyMap<string, Exercise>,
): Workout {
  const exercises = def.tracks.flatMap((track, ti) =>
    track.items.map((item) => ({
      ...item,
      note_de: `Track ${ti + 1} – ${customTrackLabel(def, ti)}`,
    })),
  );
  const minutes = clamp(
    customWorkoutMinutes(def, lookup),
    WORKOUT_LIMITS.minutes.min,
    WORKOUT_LIMITS.minutes.max,
  );
  const areas = CUSTOM_WORKOUT_AREAS.filter((a) =>
    def.tracks.some((t) => t.kind === 'area' && t.area === a),
  );
  const labels = (areas.length > 0 ? areas : def.input.areas).map((a) => CUSTOM_AREA_LABELS_DE[a]);
  const name = customWorkoutNameSchema.safeParse(meta.name);
  return workoutSchema.parse({
    id: meta.id,
    version: 1,
    status: 'draft',
    title_de: name.success ? name.data : suggestCustomWorkoutName(def.input),
    summary_de:
      `Eigenes Workout: ${labels.join(', ')}. ${def.tracks.length} Tracks von Aufwärmen bis Dehnen, läuft komplett nach Zeit.`.slice(
        0,
        300,
      ),
    category: categoryOf(areas.length > 0 ? areas : def.input.areas),
    difficulty: starsOf(def.tracks, minutes, lookup),
    minutes,
    format: 'sets_reps',
    rounds: 1,
    round_rest_s: 0,
    equipment_ids: workoutEquipmentUnion(exercises, lookup),
    warmup_de:
      'Track 1 ist das Aufwärmen: ruhig beginnen, Gelenke bewegen, Puls langsam steigern. Gewicht erst danach wählen.',
    cooldown_de:
      'Der letzte Track ist das Dehnen. Danach ruhig durchatmen und ein paar Schritte locker gehen.',
    exercises,
    meta: {
      origin: 'manual',
      model: null,
      batch_id: null,
      created_on: meta.today,
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    },
  });
}

// ---------------------------------------------------------------------------------------------------------
// Bearbeiten (Vorschau): Entfernen, Hinzufügen, Tauschen, Verschieben
// ---------------------------------------------------------------------------------------------------------

/** Position im flachen Workout → (Track, Position im Track). */
export function customItemAt(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  flatIndex: number,
): { readonly trackIndex: number; readonly itemIndex: number } | null {
  let rest = flatIndex;
  for (let ti = 0; ti < def.tracks.length; ti += 1) {
    const n = def.tracks[ti]?.items.length ?? 0;
    if (rest < n) return { trackIndex: ti, itemIndex: rest };
    rest -= n;
  }
  return null;
}

/** (Track, Position) → Position im flachen Workout. */
export function customFlatIndex(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  trackIndex: number,
  itemIndex: number,
): number {
  return def.tracks.slice(0, trackIndex).reduce((n, t) => n + t.items.length, 0) + itemIndex;
}

/** Darf die Position entfernt werden? Aufwärmen und Dehnen behalten immer mindestens eine Übung. */
export function canRemoveCustomItem(
  def: Pick<CustomWorkoutDefinition, 'tracks'>,
  trackIndex: number,
): boolean {
  const track = def.tracks[trackIndex];
  if (!track) return false;
  return track.kind === 'area' || track.items.length > 1;
}

/** Übung entfernen; ein leerer Muskel-Track entfällt. null = nicht erlaubt. */
export function removeCustomItem(
  def: CustomWorkoutDefinition,
  trackIndex: number,
  itemIndex: number,
): CustomWorkoutDefinition | null {
  if (!canRemoveCustomItem(def, trackIndex) || !def.tracks[trackIndex]?.items[itemIndex])
    return null;
  const tracks = def.tracks
    .map((t, ti) =>
      ti === trackIndex ? { ...t, items: t.items.filter((_, ii) => ii !== itemIndex) } : t,
    )
    .filter((t) => t.kind !== 'area' || t.items.length > 0);
  const parsed = customWorkoutDefinitionSchema.safeParse({ ...def, tracks });
  return parsed.success ? parsed.data : null;
}

/** Ist noch Platz für eine Übung (WORKOUT_LIMITS.exercises.max)? */
export function customHasRoom(def: Pick<CustomWorkoutDefinition, 'tracks'>): boolean {
  return flatItems(def).length < WORKOUT_LIMITS.exercises.max;
}

/** Übung am Ende des Tracks hinzufügen (Dosierung wie die erste Übung des Tracks). null = nicht möglich. */
export function addCustomItem(
  def: CustomWorkoutDefinition,
  trackIndex: number,
  exercise: Exercise,
): CustomWorkoutDefinition | null {
  const track = def.tracks[trackIndex];
  if (!track || !customHasRoom(def)) return null;
  if (flatItems(def).some((i) => i.exercise_id === exercise.id)) return null;
  const model = track.items[0];
  const base = customItemFor(exercise, track.kind, model?.rest_s);
  const item: WorkoutContentItem =
    model && track.kind === 'area' ? { ...base, sets: model.sets, rest_s: model.rest_s } : base;
  const tracks = def.tracks.map((t, ti) =>
    ti === trackIndex ? { ...t, items: [...t.items, item] } : t,
  );
  const parsed = customWorkoutDefinitionSchema.safeParse({ ...def, tracks });
  return parsed.success ? parsed.data : null;
}

/** Übung tauschen (Dosierung umgerechnet wie beim Tausch in Bibliotheks-Workouts). */
export function replaceCustomItem(
  def: CustomWorkoutDefinition,
  trackIndex: number,
  itemIndex: number,
  exercise: Exercise,
  lookup: ReadonlyMap<string, Exercise>,
): CustomWorkoutDefinition | null {
  const item = def.tracks[trackIndex]?.items[itemIndex];
  if (!item) return null;
  if (flatItems(def).some((i) => i.exercise_id === exercise.id)) return null;
  const next = mapWorkoutItem(item, lookup.get(item.exercise_id), exercise, 'sets_reps');
  const tracks = def.tracks.map((t, ti) =>
    ti === trackIndex
      ? { ...t, items: t.items.map((it, ii) => (ii === itemIndex ? next : it)) }
      : t,
  );
  const parsed = customWorkoutDefinitionSchema.safeParse({ ...def, tracks });
  return parsed.success ? parsed.data : null;
}

/** Übung im Track nach oben (-1) bzw. unten (+1) verschieben. null = geht nicht. */
export function moveCustomItem(
  def: CustomWorkoutDefinition,
  trackIndex: number,
  itemIndex: number,
  direction: -1 | 1,
): CustomWorkoutDefinition | null {
  const track = def.tracks[trackIndex];
  const target = itemIndex + direction;
  if (!track || target < 0 || target >= track.items.length) return null;
  const items = [...track.items];
  const [moved] = items.splice(itemIndex, 1);
  if (!moved) return null;
  items.splice(target, 0, moved);
  return { ...def, tracks: def.tracks.map((t, ti) => (ti === trackIndex ? { ...t, items } : t)) };
}

/**
 * Übungen zum Hinzufügen in einen Track: passend zur Gruppe (Aufwärmen/Dehnen: ruhige Übungen), machbar, erlaubt,
 * nicht „Mag ich nicht“, nicht schon im Workout; Suche über Name und andere Namen. Sortiert nach Name.
 */
export function customAddCandidates(
  def: CustomWorkoutDefinition,
  trackIndex: number,
  library: ReadonlyMap<string, Exercise>,
  ctx: CustomBuildContext,
  query = '',
): Exercise[] {
  const track = def.tracks[trackIndex];
  if (!track) return [];
  const inWorkout = new Set(flatItems(def).map((i) => i.exercise_id));
  const q = normalizeSearchText(query);
  return [...library.values()]
    .filter((e) => !inWorkout.has(e.id) && customExerciseBlock(e, def.input, ctx) === null)
    .filter((e) =>
      track.kind === 'area'
        ? exerciseMatchesArea(e, track.area ?? 'full_body')
        : e.movement_pattern === 'mobility' ||
          (track.kind === 'warmup' &&
            e.movement_pattern === 'conditioning' &&
            !e.caution_tags.includes('high_impact')),
    )
    .filter(
      (e) =>
        q === '' ||
        [e.name_de, ...e.aliases_de].some((name) => normalizeSearchText(name).includes(q)),
    )
    .sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'));
}

/** Suche für Lieblings- und „Mag ich nicht“-Übungen im Assistenten (Kraft-Übungen der Bibliothek, nach Name). */
export function searchCustomExercises(
  library: ReadonlyMap<string, Exercise>,
  query: string,
  options: { readonly includeCalm?: boolean; readonly limit?: number } = {},
): Exercise[] {
  const q = normalizeSearchText(query);
  if (q === '') return [];
  return [...library.values()]
    .filter((e) => e.status === 'published' && !NEVER_IDS.has(e.id))
    .filter((e) => options.includeCalm === true || !CALM_PATTERNS.includes(e.movement_pattern))
    .filter((e) =>
      [e.name_de, ...e.aliases_de].some((name) => normalizeSearchText(name).includes(q)),
    )
    .sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'))
    .slice(0, options.limit ?? 20);
}
