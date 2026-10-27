import { SESSION_LOG_LIMITS, WORKOUT_LIMITS } from '../constants';
import type { CautionTag, LoadType } from '../enums';
import { requiredEquipmentIds } from '../equipment';
import { codePointLength } from '../log/schemas';
import type { LoggedSet } from '../log/types';
import type { Workout, WorkoutCategory, WorkoutFormat } from './schema';
import type { WorkoutRunSummary } from './timer';

/**
 * Workout-Bibliothek in der App (docs/PLAN-WORKOUTS.md Abschnitte 4–5): Filter der Liste, Sicherheitshinweise und der
 * Tagebuch-Eintrag nach dem Timer. Reine Funktionen – die App bildet nur ab.
 */

/** Mindestangaben einer Übung aus der Bibliothek. */
export interface WorkoutExerciseInfo {
  readonly id: string;
  readonly name_de: string;
  readonly load_type: LoadType;
  readonly equipment_ids: readonly string[];
  readonly caution_tags: readonly CautionTag[];
  readonly unilateral: boolean;
}

export type WorkoutExerciseLookup = ReadonlyMap<string, WorkoutExerciseInfo>;

// ---------------------------------------------------------------------------------------------------------
// Liste und Filter
// ---------------------------------------------------------------------------------------------------------

/** Dauer-Filter: kurz bis 15 Min., mittel 16–30 Min., lang über 30 Min. */
export const WORKOUT_DURATION_FILTERS = ['short', 'medium', 'long'] as const;
export type WorkoutDurationFilter = (typeof WORKOUT_DURATION_FILTERS)[number];

export function workoutDurationBucket(minutes: number): WorkoutDurationFilter {
  if (minutes <= 15) return 'short';
  if (minutes <= 30) return 'medium';
  return 'long';
}

export interface WorkoutFilter {
  /** Sterne (leer = alle). */
  readonly stars: readonly number[];
  readonly duration: WorkoutDurationFilter | null;
  readonly category: WorkoutCategory | null;
  /** Nur Workouts ohne Geräte. */
  readonly noEquipment: boolean;
}

export const EMPTY_WORKOUT_FILTER: WorkoutFilter = {
  stars: [],
  duration: null,
  category: null,
  noEquipment: false,
};

/**
 * Entwürfe dieser Kategorien erscheinen in der Liste (als „Testinhalt“) – nur im Testmodus, denn im Supabase-Modus
 * liefert die Datenbank (RLS) ausschließlich freigegebene Workouts. Sportarten Stufe 1 · Etappe R: Rudern-Workouts,
 * damit sie vor der Freigabe im Vorschau-Link prüfbar sind (docs/PLAN-SPORTARTEN-STUFE-1.md 4).
 */
export const WORKOUT_LIST_DRAFT_CATEGORIES: readonly WorkoutCategory[] = ['rowing'];

/**
 * Freigegebene Workouts (und Entwürfe aus WORKOUT_LIST_DRAFT_CATEGORIES), gefiltert und sortiert: Sterne, Dauer,
 * Titel. `includeDrafts` (Sportarten Stufe 1 · Etappe Y): alle Entwürfe – nur für Listen, deren Quelle Entwürfe schon
 * bewusst zulässt (Testmodus-Bündel, workoutsFromBundle).
 */
export function filterWorkouts<W extends Workout>(
  workouts: readonly W[],
  filter: WorkoutFilter,
  options: { readonly includeDrafts?: boolean } = {},
): W[] {
  return workouts
    .filter(
      (w) =>
        w.status === 'published' ||
        (w.status === 'draft' &&
          (options.includeDrafts === true || WORKOUT_LIST_DRAFT_CATEGORIES.includes(w.category))),
    )
    .filter((w) => filter.stars.length === 0 || filter.stars.includes(w.difficulty))
    .filter((w) => filter.duration === null || workoutDurationBucket(w.minutes) === filter.duration)
    .filter((w) => filter.category === null || w.category === filter.category)
    .filter((w) => !filter.noEquipment || requiredEquipmentIds(w.equipment_ids).length === 0)
    .sort(
      (a, b) =>
        a.difficulty - b.difficulty ||
        a.minutes - b.minutes ||
        a.title_de.localeCompare(b.title_de, 'de'),
    );
}

/** Kurzangaben für die Kachel „Workouts“ auf der Übersicht. */
export interface WorkoutTileSummary {
  readonly total: number;
  readonly withoutEquipment: number;
  /** Heute als Workout eingetragen (Quelle „workout“). */
  readonly doneToday: number;
}

export function workoutTileSummary(
  workouts: readonly Pick<Workout, 'status' | 'equipment_ids'>[],
  logs: readonly { readonly performed_on: string; readonly source: string }[],
  today: string,
): WorkoutTileSummary {
  const published = workouts.filter((w) => w.status === 'published');
  return {
    total: published.length,
    withoutEquipment: published.filter((w) => requiredEquipmentIds(w.equipment_ids).length === 0)
      .length,
    doneToday: logs.filter((l) => l.source === 'workout' && l.performed_on === today).length,
  };
}

/**
 * Welche Workouts sind an `day` schon eingetragen? Einträge mit Herkunft „workout“, deren Notiz mit
 * „Workout „<Titel>““ beginnt (workoutLogNote). Übergang, bis session_logs eine eigene workout_id hat
 * (docs/PLAN-WORKOUTS.md, offener Punkt W-O1) – freie Einträge sind nicht nachträglich änderbar, die Notiz bleibt.
 */
export function workoutsDoneOn(
  workouts: readonly Pick<Workout, 'id' | 'title_de'>[],
  logs: readonly {
    readonly performed_on: string;
    readonly source: string;
    readonly notes: string | null;
  }[],
  day: string,
): Set<string> {
  const notes = logs
    .filter((l) => l.source === 'workout' && l.performed_on === day && l.notes !== null)
    .map((l) => l.notes as string);
  return new Set(
    workouts
      .filter((w) => notes.some((n) => n.startsWith(`${WORKOUT_NOTE_PREFIX}„${w.title_de}“`)))
      .map((w) => w.id),
  );
}

/** Anfang der Notiz eines Workout-Eintrags. */
export const WORKOUT_NOTE_PREFIX = 'Workout ';

// ---------------------------------------------------------------------------------------------------------
// Sicherheitshinweise (Hinweis, kein Verbot)
// ---------------------------------------------------------------------------------------------------------

export type WorkoutSafetyHint =
  /** Immer: vorher aufwärmen. */
  | 'warmup'
  /** Ab WORKOUT_LIMITS.hardStars für Einsteiger (bzw. vorsichtigen Plan). */
  | 'hard_for_beginner'
  /** Gesundheits-Check mit Auffälligkeiten: vorher ärztlich abklären, leichtere Workouts bevorzugen. */
  | 'medical'
  /** Schwangerschaft: nicht dafür entwickelt. */
  | 'pregnancy'
  /** Enthält Übungen, die der Plan wegen der Angaben auslässt (z. B. Sprünge). */
  | 'excluded_exercises';

export interface WorkoutSafetyInput {
  /** Einsteiger oder vorsichtiger Plan (PlanSafetyRules.beginnerTemplatesOnly); unbekannt = true (sichere Richtung). */
  readonly beginner: boolean;
  readonly medicalNotice: boolean;
  readonly pregnancyNotice: boolean;
  readonly excludedCautionTags: readonly CautionTag[];
}

export function workoutSafetyHints(
  workout: Pick<Workout, 'difficulty' | 'exercises'>,
  input: WorkoutSafetyInput,
  exercises: WorkoutExerciseLookup,
): WorkoutSafetyHint[] {
  const hints: WorkoutSafetyHint[] = ['warmup'];
  if (input.beginner && workout.difficulty >= WORKOUT_LIMITS.hardStars) {
    hints.push('hard_for_beginner');
  }
  if (input.medicalNotice) hints.push('medical');
  if (input.pregnancyNotice) hints.push('pregnancy');
  const excluded = workout.exercises.some((item) =>
    (exercises.get(item.exercise_id)?.caution_tags ?? []).some((tag) =>
      input.excludedCautionTags.includes(tag),
    ),
  );
  if (excluded) hints.push('excluded_exercises');
  return hints;
}

// ---------------------------------------------------------------------------------------------------------
// Tagebuch-Eintrag nach dem Timer (freie Einheit, Quelle „workout“)
// ---------------------------------------------------------------------------------------------------------

export interface WorkoutLogExercise {
  readonly exerciseId: string;
  readonly nameDe: string;
  readonly loadType: LoadType;
  /** Nur erledigte Durchgänge, alle abgehakt. */
  readonly sets: readonly LoggedSet[];
}

/**
 * Erledigte Durchgänge → Sätze je Übung: nach Wiederholungen mit den Wiederholungen des Workouts; Zeitübungen mit den
 * tatsächlichen Sekunden; Körpergewicht/Band nach Zeit ohne Wiederholungen (die Zeit steht in der Notiz). Übungen ohne
 * erledigten Durchgang oder, die es nicht mehr gibt, fehlen. Gewicht wird nicht erfasst (leer).
 */
export function workoutLogExercises(
  workout: Pick<Workout, 'exercises'>,
  summary: Pick<WorkoutRunSummary, 'items'>,
  exercises: WorkoutExerciseLookup,
): WorkoutLogExercise[] {
  const out: WorkoutLogExercise[] = [];
  for (const item of summary.items) {
    const content = workout.exercises[item.itemIndex];
    const exercise = exercises.get(item.exerciseId);
    if (!content || !exercise || item.done.length === 0) continue;
    const sets = item.done.slice(0, SESSION_LOG_LIMITS.setsPerExercise.max).map((d): LoggedSet => {
      if (exercise.load_type === 'time') {
        const seconds = Math.round(d.seconds > 0 ? d.seconds : (content.duration_s ?? 1));
        return {
          reps: null,
          weightKg: null,
          durationS: Math.min(
            SESSION_LOG_LIMITS.durationS.max,
            Math.max(SESSION_LOG_LIMITS.durationS.min, seconds),
          ),
          rpe: null,
          done: true,
        };
      }
      return { reps: content.reps, weightKg: null, durationS: null, rpe: null, done: true };
    });
    out.push({
      exerciseId: exercise.id,
      nameDe: exercise.name_de,
      loadType: exercise.load_type,
      sets,
    });
  }
  return out.slice(0, SESSION_LOG_LIMITS.exercisesPerSession.max);
}

/** Sterne als Zeichen (★★★☆☆) – nur Anzeige; Bildschirmleser lesen den Text aus der App. */
export function workoutStars(difficulty: number): string {
  const n = Math.min(WORKOUT_LIMITS.stars.max, Math.max(WORKOUT_LIMITS.stars.min, difficulty));
  return '★'.repeat(n) + '☆'.repeat(WORKOUT_LIMITS.stars.max - n);
}

/**
 * Notiz des Eintrags (höchstens SESSION_LOG_LIMITS.notesMaxChars Zeichen): Titel, Sterne, Runden bzw. Sätze, aktive
 * Minuten; „vorzeitig beendet“, wenn nicht alles erledigt wurde; danach die eigene Notiz (gekürzt, falls nötig).
 */
export function workoutLogNote(input: {
  readonly title: string;
  readonly difficulty: number;
  readonly format: WorkoutFormat;
  readonly summary: Pick<
    WorkoutRunSummary,
    'roundsCompleted' | 'rounds' | 'workDone' | 'workTotal' | 'complete' | 'activeS'
  >;
  readonly userNote: string;
}): string {
  const { summary } = input;
  const progress =
    input.format === 'sets_reps'
      ? `${summary.workDone}/${summary.workTotal} Sätze`
      : input.format === 'flow'
        ? `${summary.workDone}/${summary.workTotal} Posen`
        : `${summary.roundsCompleted}/${summary.rounds} Runden`;
  const minutes = Math.max(1, Math.round(summary.activeS / 60));
  const head = [
    `${WORKOUT_NOTE_PREFIX}„${input.title}“ (${workoutStars(input.difficulty)})`,
    progress,
    `${minutes} Min.`,
    ...(summary.complete ? [] : ['vorzeitig beendet']),
  ].join(' · ');
  const own = input.userNote.trim();
  const max = SESSION_LOG_LIMITS.notesMaxChars;
  if (own === '') return truncate(head, max);
  const room = max - codePointLength(head) - 1;
  return room <= 0 ? truncate(head, max) : `${head}\n${truncate(own, room)}`;
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}
