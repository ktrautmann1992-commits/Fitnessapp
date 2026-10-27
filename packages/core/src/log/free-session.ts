import { FREE_SESSION, SESSION_LOG_LIMITS, SPORT_CATALOGUE } from '../constants';
import { addDays, isoDateInTimeZone } from '../dates';
import type { EnduranceModality, LoadType, PlannedSessionKind } from '../enums';
import type { IncrementKind } from '../plan/loads';
import {
  type CardioInput,
  type CardioInputError,
  type CardioInputField,
  cardioLogFromInput,
  cardioPlausibility,
} from './cardio';
import { needsWeightConfirmation, type SetEntryWarning, setEntryWarnings } from './plausibility';
import {
  codePointLength,
  type ExerciseLogPayload,
  type SessionLogPayload,
  sessionLogPayloadSchema,
} from './schemas';
import type { LoggedSet } from './types';
import { sessionLogStatus } from './workout';

/**
 * Freie Einheit und „nachgetragen“ (docs/PLAN-AUSWERTUNG.md 2.6 und 4, Etappe A1b). Eine freie Einheit ist ein
 * Tagebuch-Eintrag OHNE geplante Einheit: heute oder bis SESSION_LOG_LIMITS.backdateDays Tage zurück, nie in der
 * Zukunft; Kraft mit Übungen aus der Bibliothek oder Ausdauer (Art, Dauer, Distanz, Anstrengung). Sie zählt nie für
 * Progression, Kalibrierung und den 10-%-Bezug (isCountingEntry, entriesForExercise, loggedEnduranceMinutes), wohl
 * aber in Woche/Verlauf und – über ihre Trainingsenergie – fürs Tagesziel (A-G7, freeSessionNutritionSessions).
 * Dieselben Regeln prüft save_session_log (Migration 20261015140000) und der Testmodus (local-rules.ts).
 */

// ---------------------------------------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------------------------------------

/** Grund, warum an einem Datum nichts eingetragen werden kann; null = möglich. */
export type EntryDateBlock = 'future' | 'too_old';

/** Datum für eine freie Einheit bzw. zum Nachtragen: heute bis backdateDays Tage zurück (Grenzen eingeschlossen). */
export function entryDateBlock(date: string, today: string): EntryDateBlock | null {
  if (date > today) return 'future';
  if (date < addDays(today, -SESSION_LOG_LIMITS.backdateDays)) return 'too_old';
  return null;
}

/** Alle Tage, an denen eine freie Einheit eingetragen werden darf – heute zuerst. */
export function freeSessionDates(today: string): string[] {
  return Array.from({ length: SESSION_LOG_LIMITS.backdateDays + 1 }, (_, i) => addDays(today, -i));
}

/**
 * „Nachgetragen“ (2.6, ohne eigene Spalte): erst an einem späteren Kalendertag (Europe/Berlin, wie „heute“ der
 * Datenbank) angelegt, als trainiert wurde. Ungültiger Zeitstempel → false.
 */
export function isBackfilledLog(log: {
  readonly performed_on: string;
  readonly created_at: string;
  /** Phase 8: von der Smartwatch übernommene Einheiten sind nie „nachgetragen“ (Abgleich kommt immer später). */
  readonly source?: string;
}): boolean {
  if (log.source === 'health_connect') return false;
  try {
    return isoDateInTimeZone(log.created_at) > log.performed_on;
  } catch {
    return false;
  }
}

/**
 * Wie viele Einträge wurden heute (Europe/Berlin) angelegt? Untergrenze für das Tageslimit
 * SESSION_LOG_LIMITS.maxLogsPerDay – die Datenbank zählt zusätzlich gelöschte Einträge.
 */
export function logsCreatedOn(
  logs: readonly { readonly created_at: string }[],
  day: string,
): number {
  return logs.filter((log) => {
    try {
      return isoDateInTimeZone(log.created_at) === day;
    } catch {
      return false;
    }
  }).length;
}

/** Tageslimit erreicht (Schutz gegen Missbrauch, K1)? */
export function dailyLogLimitReached(createdToday: number): boolean {
  return createdToday >= SESSION_LOG_LIMITS.maxLogsPerDay;
}

// ---------------------------------------------------------------------------------------------------------
// Name aus fester Liste
// ---------------------------------------------------------------------------------------------------------

export function freeSessionName(
  kind: PlannedSessionKind,
  modality: EnduranceModality | null,
): string {
  return kind === 'strength'
    ? FREE_SESSION.names.strength
    : FREE_SESSION.names.endurance[modality ?? 'run'];
}

// ---------------------------------------------------------------------------------------------------------
// Fertiger Eintrag: Regeln einer freien Einheit (wie save_session_log)
// ---------------------------------------------------------------------------------------------------------

export type FreeSessionIssue =
  /** Datum in der Zukunft bzw. älter als backdateDays (gleicher Text wie der Server). */
  | 'date_window'
  /** Sonst ungültig (Planbezug, Vorgaben, Name, Kennzeichen …). */
  | 'invalid';

const TARGET_KEYS = [
  'target_sets',
  'reps_min',
  'reps_max',
  'target_reps',
  'target_extra_set',
  'target_weight_kg',
  'target_duration_s',
  'target_rpe',
  'state_weight_kg',
  'state_target_reps',
  'state_extra_set',
  'state_duration_s',
] as const satisfies readonly (keyof ExerciseLogPayload)[];

/**
 * Prüft die Regeln einer freien Einheit an einem (Zod-gültigen) Eintrag: kein Planbezug, `planned_date` =
 * `performed_on`, Datum heute bis backdateDays zurück, keine Einstiegs-/Erholungswoche, Einheit „completed“, Name aus
 * FREE_SESSION.names (Ausdauer: passend zur Art), je Übung kein Planbezug, Status „done“, nur abgehakte Sätze, alle
 * Vorgaben/Zustände leer, kein Wiedereinstieg. Den Übungsnamen übernimmt der Server aus der Bibliothek. Nicht freie Einträge → null. Gleiche Reihenfolge wie save_session_log: zuerst das Datum.
 */
export function freeSessionPayloadIssue(
  payload: SessionLogPayload,
  today: string,
): FreeSessionIssue | null {
  if (payload.is_free !== true) return null;
  if (payload.planned_session_id !== null || payload.planned_date !== payload.performed_on) {
    return 'invalid';
  }
  if (entryDateBlock(payload.performed_on, today) !== null) return 'date_window';
  // Nur abgehakte Sätze, Einheit daher „completed“ (wie freeSessionLogFromInput und der Server, Wächter H1).
  if (payload.is_intro_week || payload.is_deload || payload.status !== 'completed')
    return 'invalid';
  // Sportart (Sportarten Stufe 2): Name der Sportart aus dem Katalog. Sportarten Stufe 1 (wie save_session_log):
  // Hyrox-Rennen (hyrox_splits gesetzt) bzw. Geh-Einheit je Art (walk_kind, fehlt = Gehen).
  const expectedName = payload.sport
    ? SPORT_CATALOGUE[payload.sport.sport].nameDe
    : payload.hyrox_splits != null
      ? FREE_SESSION.names.hyroxRace
      : payload.kind === 'strength'
        ? FREE_SESSION.names.strength
        : payload.cardio?.modality === 'walk'
          ? FREE_SESSION.names.walkKinds[payload.cardio.walk_kind ?? 'walk']
          : payload.cardio
            ? FREE_SESSION.names.endurance[payload.cardio.modality]
            : null;
  if (expectedName === null || payload.name_de !== expectedName) return 'invalid';
  for (const e of payload.exercises) {
    if (e.planned_exercise_id !== null || e.status !== 'done' || e.is_return) return 'invalid';
    if (e.sets.some((set) => !set.done)) return 'invalid';
    if (TARGET_KEYS.some((key) => e[key] !== null)) return 'invalid';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Eingabe → Eintrag (mit den Plausibilitätsprüfungen des Trainingsmodus)
// ---------------------------------------------------------------------------------------------------------

/** Eine Übung der freien Kraft-Einheit (aus der Bibliothek). */
export interface FreeStrengthExerciseInput {
  /** id des Übungs-Eintrags (vom Gerät erzeugt). */
  readonly id: string;
  readonly exerciseId: string;
  readonly nameDe: string;
  readonly loadType: LoadType;
  readonly incrementKind: IncrementKind;
  /** Nur abgehakte Sätze werden gespeichert. */
  readonly sets: readonly LoggedSet[];
  /** Gewichts-Warnung ausdrücklich bestätigt (W5). */
  readonly weightConfirmed: boolean;
}

export interface FreeSessionInput {
  readonly id: string;
  readonly writeId: string;
  /** Revision der zuletzt bestätigten Fassung (W3, z. B. „Meine Fassung behalten“); fehlt = neu. */
  readonly baseRevision?: number | null;
  readonly kind: PlannedSessionKind;
  readonly performedOn: string;
  /** Heute (Europe/Berlin). */
  readonly today: string;
  /** Kraft: Übungen; Ausdauer: leer. */
  readonly exercises: readonly FreeStrengthExerciseInput[];
  /** Ausdauer: Eingabe (cardioLogFromInput); Kraft: null. */
  readonly cardio: CardioInput | null;
  /** Anstrengung 0–10 (SESSION_RPE_LIMITS) bzw. null. */
  readonly sessionRpe: number | null;
  readonly notes: string;
  /** Jetzt (ISO-Zeitstempel mit Zeitzone) – client_updated_at. */
  readonly now: string;
  /**
   * Eintrag aus dem Workout-Timer (docs/PLAN-WORKOUTS.md Abschnitt 5): Körpergewicht- und Band-Übungen nach Zeit dürfen
   * ohne Wiederholungen abgehakt sein (die Zeit steht in der Notiz); Beginn und Ende kommen vom Timer. Gesendet wird
   * trotzdem mit Herkunft `manual` – „workout“ setzt danach nur mark_session_log_workout (wie save_session_log es
   * verlangt: neue Einträge immer `manual`).
   */
  readonly fromWorkout?: boolean;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export type FreeSessionError =
  | 'date_future'
  | 'date_too_old'
  | 'no_exercises'
  | 'too_many_exercises'
  | 'duplicate_exercise'
  /** Eine Übung ohne abgehakten Satz („0 Sätze“). */
  | 'no_sets'
  | 'too_many_sets'
  /** Satz passt nicht zur Belastungsart (z. B. abgehakt ohne Wiederholungen). */
  | 'invalid_set'
  /** Gewicht über der absoluten Schwelle ohne Bestätigung (needsWeightConfirmation). */
  | 'confirm_weight'
  | 'cardio_invalid'
  | 'notes_too_long'
  | 'invalid';

export interface FreeSetWarning {
  readonly exerciseIndex: number;
  readonly setIndex: number;
  readonly warnings: readonly SetEntryWarning[];
}

export interface FreeSessionWarnings {
  /** Nur Hinweise – die harten Grenzen prüft das Schema. */
  readonly sets: readonly FreeSetWarning[];
  /** Schneller als CARDIO_PLAUSIBILITY_KMH → „Bitte prüfen“ (kein Fehler). */
  readonly cardio: 'ok' | 'check_speed';
}

export type FreeSessionResult =
  | {
      readonly ok: true;
      readonly payload: SessionLogPayload;
      readonly warnings: FreeSessionWarnings;
    }
  | {
      readonly ok: false;
      readonly errors: readonly FreeSessionError[];
      readonly cardioErrors: Partial<Record<CardioInputField, CardioInputError>>;
      readonly warnings: FreeSessionWarnings;
    };

function setFitsLoadType(set: LoggedSet, loadType: LoadType, timedAllowed = false): boolean {
  if (loadType === 'weight') return set.reps !== null && set.durationS === null;
  if (loadType === 'time') return set.durationS !== null && set.weightKg === null;
  return (set.reps !== null || timedAllowed) && set.weightKg === null && set.durationS === null;
}

/** Warnungen eines Satzes ohne Vorgabe und ohne Zustand (nur die absolute Schwelle der Geräte-Art). */
export function freeSetWarnings(
  set: Pick<LoggedSet, 'weightKg' | 'reps'>,
  exercise: Pick<FreeStrengthExerciseInput, 'loadType' | 'incrementKind'>,
): SetEntryWarning[] {
  return setEntryWarnings(
    { weightKg: exercise.loadType === 'weight' ? set.weightKg : null, reps: set.reps },
    { stateWeightKg: null, plannedReps: null, incrementKind: exercise.incrementKind },
  );
}

/** Braucht die Übung eine Gewichts-Bestätigung (abgehakter Satz über der absoluten Schwelle)? */
export function freeExerciseNeedsConfirmation(exercise: FreeStrengthExerciseInput): boolean {
  if (exercise.weightConfirmed || exercise.loadType !== 'weight') return false;
  return exercise.sets.some(
    (s) =>
      s.done &&
      s.weightKg !== null &&
      s.weightKg > 0 &&
      needsWeightConfirmation(s.weightKg, null, exercise.incrementKind),
  );
}

/**
 * Eingabe einer freien Einheit prüfen und in den Eintrag für save_session_log umwandeln. Plausibilität wie im
 * Trainingsmodus: setEntryWarnings/needsWeightConfirmation (ohne Zustand → absolute Schwelle), cardioPlausibility
 * (nur Warnung), cardioLogFromInput (harte Grenzen 1 min–12 h). Vorgaben und Zustände bleiben leer, der Name kommt
 * aus der festen Liste. Ergebnis ist immer auch Zod-gültig und erfüllt freeSessionPayloadIssue().
 */
export function freeSessionLogFromInput(input: FreeSessionInput): FreeSessionResult {
  const errors = new Set<FreeSessionError>();
  let cardioErrors: Partial<Record<CardioInputField, CardioInputError>> = {};
  const setWarnings: FreeSetWarning[] = [];
  let cardioWarning: 'ok' | 'check_speed' = 'ok';

  const block = entryDateBlock(input.performedOn, input.today);
  if (block === 'future') errors.add('date_future');
  if (block === 'too_old') errors.add('date_too_old');
  if (codePointLength(input.notes.trim()) > SESSION_LOG_LIMITS.notesMaxChars) {
    errors.add('notes_too_long');
  }

  const exercises: ExerciseLogPayload[] = [];
  let cardio: SessionLogPayload['cardio'] = null;
  let modality: EnduranceModality | null = null;
  if (input.kind === 'strength') {
    const { min, max } = SESSION_LOG_LIMITS.exercisesPerSession;
    if (input.exercises.length < min) errors.add('no_exercises');
    if (input.exercises.length > max) errors.add('too_many_exercises');
    if (new Set(input.exercises.map((e) => e.exerciseId)).size !== input.exercises.length) {
      errors.add('duplicate_exercise');
    }
    input.exercises.forEach((exercise, exerciseIndex) => {
      exercise.sets.forEach((set, setIndex) => {
        if (!set.done) return;
        const warnings = freeSetWarnings(set, exercise);
        if (warnings.length > 0) setWarnings.push({ exerciseIndex, setIndex, warnings });
      });
      const done = exercise.sets.filter((s) => s.done);
      if (done.length === 0) errors.add('no_sets');
      if (done.length > SESSION_LOG_LIMITS.setsPerExercise.max) errors.add('too_many_sets');
      if (done.some((s) => !setFitsLoadType(s, exercise.loadType, input.fromWorkout === true))) {
        errors.add('invalid_set');
      }
      if (freeExerciseNeedsConfirmation(exercise)) errors.add('confirm_weight');
      exercises.push({
        id: exercise.id,
        order_no: exerciseIndex + 1,
        planned_exercise_id: null,
        exercise_id: exercise.exerciseId,
        exercise_name_de: exercise.nameDe,
        load_type: exercise.loadType,
        status: 'done',
        target_sets: null,
        reps_min: null,
        reps_max: null,
        target_reps: null,
        target_extra_set: null,
        target_weight_kg: null,
        target_duration_s: null,
        target_rpe: null,
        state_weight_kg: null,
        state_target_reps: null,
        state_extra_set: null,
        state_duration_s: null,
        weight_confirmed: exercise.weightConfirmed,
        is_return: false,
        sets: done.map((s, i) => ({
          set_no: i + 1,
          reps: exercise.loadType === 'time' ? null : s.reps,
          weight_kg: exercise.loadType === 'weight' ? s.weightKg : null,
          duration_s: exercise.loadType === 'time' ? s.durationS : null,
          rpe: s.rpe,
          done: true,
        })),
      });
    });
  } else {
    if (input.exercises.length > 0) errors.add('invalid');
    if (input.cardio === null) {
      errors.add('cardio_invalid');
      cardioErrors = { duration: 'duration_missing' };
    } else {
      modality = input.cardio.modality;
      const result = cardioLogFromInput(input.cardio);
      if (result.ok) {
        cardio = result.cardio;
        cardioWarning = cardioPlausibility(
          result.cardio.modality,
          result.cardio.duration_s,
          result.cardio.distance_m,
        );
      } else {
        errors.add('cardio_invalid');
        cardioErrors = result.errors;
      }
    }
  }

  const warnings: FreeSessionWarnings = { sets: setWarnings, cardio: cardioWarning };
  if (errors.size > 0) return { ok: false, errors: [...errors], cardioErrors, warnings };

  const notes = input.notes.trim();
  const payload: SessionLogPayload = {
    id: input.id,
    write_id: input.writeId,
    base_revision: input.baseRevision ?? null,
    planned_session_id: null,
    planned_date: input.performedOn,
    kind: input.kind,
    performed_on: input.performedOn,
    // Beim Nachtragen gibt es keine sinnvolle Uhrzeit – Reihenfolge am Tag über client_updated_at. Workout-Timer:
    // Beginn und Ende des Laufs.
    started_at: input.startedAt ?? null,
    finished_at: input.finishedAt ?? null,
    status: sessionLogStatus(input.kind, exercises),
    session_rpe: input.sessionRpe,
    notes: notes === '' ? null : notes,
    name_de: freeSessionName(input.kind, modality),
    is_intro_week: false,
    is_deload: false,
    source: 'manual',
    client_updated_at: input.now,
    exercises,
    cardio,
    is_free: true,
  };
  if (
    !sessionLogPayloadSchema.safeParse(payload).success ||
    freeSessionPayloadIssue(payload, input.today) !== null
  ) {
    return { ok: false, errors: ['invalid'], cardioErrors, warnings };
  }
  return { ok: true, payload, warnings };
}

// ---------------------------------------------------------------------------------------------------------
// Tagesziel (A-G7): Trainingsenergie freier Einheiten
// ---------------------------------------------------------------------------------------------------------

/** Eingabe für nutritionSessionSchema (nutrition/schemas.ts) – ohne Abhängigkeit auf das Ernährungs-Modul. */
export interface FreeNutritionSession {
  readonly sessionId: string;
  readonly planId: string;
  readonly planStatus: 'active';
  readonly scheduledOn: string;
  readonly kind: PlannedSessionKind;
  readonly enduranceModality: EnduranceModality | null;
  readonly effortTarget: number | null;
  readonly minutes: number;
  readonly isDeload: false;
  readonly status: 'completed';
}

/**
 * Freie Einheiten als erledigte Einheiten fürs Tagesziel (A-G7): erhöhen nur die Trainingsenergie (sichere Richtung,
 * Deckel TRAINING_KCAL_DAY_MAX bleibt). Ausdauer: tatsächliche Dauer und Art, Anstrengung 0–10 → effortTarget 1–4
 * (geklemmt; ohne Angabe null = Standardwert der Art). Kraft: abgehakte Sätze × FREE_SESSION.strengthMinutesPerSet,
 * höchstens strengthMinutesMax. Nicht freie Einträge werden ausgelassen (die zählen über ihre geplante Einheit).
 */
export function freeSessionNutritionSessions(
  logs: readonly {
    readonly id: string;
    readonly is_free?: boolean;
    readonly performed_on: string;
    readonly kind: PlannedSessionKind;
    readonly session_rpe: number | null;
    /** Sportarten Stufe 2: Dauer eines Sportart-Eintrags (fehlt bei älteren Aufrufern). */
    readonly sport_duration_s?: number | null;
  }[],
  details: {
    readonly cardio: readonly {
      readonly session_log_id: string;
      readonly modality: EnduranceModality;
      readonly duration_s: number;
    }[];
    /** Abgehakte Kraft-Sätze je Eintrag. */
    readonly doneSets: ReadonlyMap<string, number>;
  },
): FreeNutritionSession[] {
  const cardioByLog = new Map(details.cardio.map((c) => [c.session_log_id, c] as const));
  return logs.flatMap((log): FreeNutritionSession[] => {
    if (log.is_free !== true) return [];
    const cardio = log.kind === 'endurance' ? cardioByLog.get(log.id) : undefined;
    if (log.kind === 'endurance' && !cardio) return [];
    // Sportart (Stufe 2): erfasste Dauer; gerechnet wie Kraft (TRAINING_MET.strength, sichere Richtung – die
    // Sportart-MET nutzt nur die kcal-Anzeige je Einheit, docs/PLAN-SPORTARTEN.md 3).
    const sportS = log.kind === 'strength' ? (log.sport_duration_s ?? null) : null;
    const minutes = cardio
      ? Math.round(cardio.duration_s / 60)
      : sportS !== null && sportS > 0
        ? Math.min(Math.round(sportS / 60), FREE_SESSION.strengthMinutesMax)
        : Math.min(
            (details.doneSets.get(log.id) ?? 0) * FREE_SESSION.strengthMinutesPerSet,
            FREE_SESSION.strengthMinutesMax,
          );
    return [
      {
        sessionId: `free:${log.id}`,
        planId: 'free',
        planStatus: 'active',
        scheduledOn: log.performed_on,
        kind: log.kind,
        enduranceModality: cardio ? cardio.modality : null,
        effortTarget:
          cardio && log.session_rpe !== null ? Math.min(4, Math.max(1, log.session_rpe)) : null,
        minutes,
        isDeload: false,
        status: 'completed',
      },
    ];
  });
}
