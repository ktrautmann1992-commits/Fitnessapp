import {
  type CardioInput,
  type CardioInputResult,
  cardioLogFromInput,
  CONSERVATIVE_PLAN_RULES,
  type EnduranceModality,
  exerciseLogStatusFor,
  type ExerciseLogPayload,
  type IncrementKind,
  initialSets,
  type LoadType,
  type LoggedSet,
  type PlannedExerciseDraft,
  type ProgressHint,
  type ProgressSource,
  type SessionLogPayload,
  sessionLogPayloadSchema,
  sessionLogStatus,
  type SetEntryWarning,
  setEntryWarnings,
  splitDuration,
  type StoredSession,
  type WorkoutExercisePlan,
  type WorkoutItem,
} from '@fitnessapp/core';

import { formatDecimal, parseDecimal } from '../lib/format';
import type { UserRows } from './types';

/**
 * Entwurf einer laufenden Einheit (docs/PLAN-PHASE-4.md 4.2): Jeder Tipp schreibt ihn sofort in den geschützten
 * Entwurfs-Speicher. Er enthält nur die Einträge, die Vorgabe und den Zustand aus 3.3 und lokal das Kennzeichen
 * `fromHealthPlan` (wird nie gesendet) – NICHT source_exercise_id, Arzt-Hinweis oder Sicherheitsregeln.
 * Abgelehnte Fassungen und Konflikte bleiben ebenfalls als Entwurf erhalten (nie stilles Verwerfen, 4.3).
 * Hier nur Abbildung und Zustandsänderungen – Vorgaben, Zustände, Status und Warnungen kommen aus packages/core.
 */

export const DRAFT_FORMAT = 1;

export type DraftState = 'open' | 'conflict' | 'rejected';
export type LogRejectReason =
  | 'day_taken'
  | 'date_window'
  | 'daily_limit'
  | 'invalid'
  /** Nach mehreren Versuchen bzw. 24 h nicht übertragbar (Nachprüfung C1 N1) – als Entwurf gesichert. */
  | 'not_transferred';

/** Vorgabe-Felder des Eintrags (Schnappschuss der Anzeige, 3.3). */
export type DraftTargets = Pick<
  ExerciseLogPayload,
  | 'target_sets'
  | 'reps_min'
  | 'reps_max'
  | 'target_reps'
  | 'target_extra_set'
  | 'target_weight_kg'
  | 'target_duration_s'
  | 'target_rpe'
  | 'is_return'
>;

/** Progressions-Zustand VOR der Einheit (`state_*`, W4). */
export type DraftProgressState = Pick<
  ExerciseLogPayload,
  'state_weight_kg' | 'state_target_reps' | 'state_extra_set' | 'state_duration_s'
>;

/** Eine Übung, wie sie heute angezeigt und gespeichert wird (geplante Übung oder Alternative). */
export interface DraftTarget {
  exerciseId: string;
  nameDe: string;
  loadType: LoadType;
  incrementKind: IncrementKind;
  /** Gewicht je Stück: Kurzhantel bzw. Kettlebell (Anzeige „je Hantel“/„je Kugel“). */
  perPiece: 'dumbbell' | 'kettlebell' | null;
  /** Gewichtsstufen am Ort (−/+). */
  steps: number[];
  targets: DraftTargets;
  state: DraftProgressState;
  /** Bezug der Warnungen (max(Zustand, Anzeige) bzw. Zustand). */
  heavierReferenceKg: number | null;
  lighterReferenceKg: number | null;
  /** Zustand hat ein Gewicht, aber keine Stufe am Ort ist leicht genug. */
  chooseLightest: boolean;
  /** Woher die Vorgabe kommt (Anzeige „Vorschlag aus deinem Startgewicht“). */
  source: ProgressSource;
  /** Hinweis der Progression – `harder_variant` nur MIT Variantenname (progressHintForDisplay). */
  hint: ProgressHint | null;
  harderVariantName: string | null;
}

export interface DraftExercise {
  /** id des Übungs-Eintrags (vom Gerät erzeugt). */
  id: string;
  orderNo: number;
  /** planned_exercises.id; null = ohne Planbezug (z. B. Eintrag eines gelöschten Plans). */
  plannedExerciseId: string | null;
  /** Gespeicherte Übung des Termins (vor den Sicherheitsregeln) – Bezug für `alternative`. */
  storedExerciseId: string | null;
  /** Dosierung des Termins (für eine Alternative dieselbe) und Bezug der Progression. */
  dosage: Pick<
    PlannedExerciseDraft,
    'sets' | 'reps_min' | 'reps_max' | 'duration_s' | 'rpe_target' | 'rest_s' | 'superset_group'
  >;
  reference: { templateSets: number; rpeTarget: number };
  planned: DraftTarget;
  alternative: DraftTarget | null;
  /** „Nicht gemacht“ – ohne Grund (S3). */
  skipped: boolean;
  sets: LoggedSet[];
  /** Plausibilitäts-Warnung beim Gewicht bestätigt (W5). */
  weightConfirmed: boolean;
}

export interface WorkoutDraft {
  format: typeof DRAFT_FORMAT;
  /** Konto, dem der Entwurf gehört (R5). */
  ownerUserId: string;
  /** Schlüssel = planned_session_id (eine Einheit, ein Entwurf). */
  key: string;
  state: DraftState;
  rejectReason: LogRejectReason | null;
  /** Lokal: Einheit gehört zu einem Plan mit Gesundheits-Check (S1, nie gesendet). */
  fromHealthPlan: boolean;
  /** Ändern eines vorhandenen Eintrags: Übungen nicht tauschbar (nur Sätze, Status, Belastung, Notiz). */
  editing: boolean;
  logId: string;
  /** Revision der zuletzt bestätigten Fassung (W3); null = neu. */
  baseRevision: number | null;
  /** Konflikt: Revision auf dem Server. */
  serverRevision: number | null;
  plannedSessionId: string;
  plannedDate: string;
  kind: StoredSession['kind'];
  nameDe: string;
  isIntroWeek: boolean;
  isDeload: boolean;
  performedOn: string;
  startedAt: string | null;
  sessionRpe: number | null;
  notes: string;
  exercises: DraftExercise[];
  /**
   * Ausdauer-Eintrag (Etappe C2); null bei Kraft. Fehlt in Entwürfen aus C1 (nur Kraft) – gilt dann als null.
   */
  cardio?: DraftCardio | null;
  updatedAt: string;
}

/**
 * Ausdauer-Eingabe, wie getippt (Text – ein halb getipptes „5,“ geht beim Sichern des Entwurfs nicht verloren).
 * Umwandeln und Prüfen: cardioLogFromInput() in packages/core.
 */
export interface DraftCardio {
  modality: EnduranceModality;
  hours: string;
  minutes: string;
  /** Distanz in km mit Komma. */
  distanceKm: string;
  elevationM: string;
}

// ---------------------------------------------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------------------------------------------

export function draftTargetFrom(
  plan: WorkoutExercisePlan,
  shown: PlannedExerciseDraft,
): DraftTarget {
  const p = plan.prescription;
  return {
    exerciseId: plan.exerciseId,
    nameDe: plan.nameDe,
    loadType: plan.loadType,
    incrementKind: plan.incrementKind,
    perPiece:
      plan.loadType !== 'weight'
        ? null
        : plan.equipmentIds.includes('kettlebells')
          ? 'kettlebell'
          : plan.equipmentIds.includes('dumbbells')
            ? 'dumbbell'
            : null,
    steps: [...plan.steps],
    targets: {
      target_sets: p.sets,
      reps_min: shown.reps_min,
      reps_max: shown.reps_max,
      target_reps: p.targetReps,
      target_extra_set: p.extraSet,
      target_weight_kg: p.weightKg,
      target_duration_s: p.durationS,
      target_rpe: p.rpeTarget,
      is_return: p.isReturn,
    },
    state: {
      state_weight_kg: plan.state?.weightKg ?? null,
      state_target_reps: plan.state?.targetReps ?? null,
      state_extra_set: plan.state ? plan.state.extraSet : null,
      state_duration_s: plan.state?.durationS ?? null,
    },
    heavierReferenceKg: plan.heavierReferenceKg,
    lighterReferenceKg: plan.lighterReferenceKg,
    chooseLightest: p.chooseLightest,
    source: plan.progress.source,
    hint: plan.hint.hint,
    harderVariantName: plan.hint.harderVariant?.nameDe ?? null,
  };
}

function setsFor(target: DraftTarget): LoggedSet[] {
  return initialSets(
    {
      sets: target.targets.target_sets ?? 1,
      extraSet: target.targets.target_extra_set ?? false,
      isReturn: target.targets.is_return,
      targetReps: target.targets.target_reps,
      weightKg: target.targets.target_weight_kg,
      chooseLightest: target.chooseLightest,
      durationS: target.targets.target_duration_s,
      rpeTarget: target.targets.target_rpe ?? 0,
    },
    target.loadType,
  );
}

export interface CreateDraftInput {
  ownerUserId: string;
  session: StoredSession;
  /** Ergebnis von planWorkout() (packages/core); jede Übung braucht einen Plan. */
  items: readonly WorkoutItem[];
  /** planned_exercises.id je order_no der gespeicherten Einheit. */
  plannedExerciseIds: ReadonlyMap<number, string>;
  fromHealthPlan: boolean;
  performedOn: string;
  now: string;
  newId: () => string;
}

/** Neuer Entwurf aus der angezeigten Einheit. null = eine Übung ist nicht prüfbar (Bibliothek fehlt). */
export function createWorkoutDraft(input: CreateDraftInput): WorkoutDraft | null {
  if (input.items.length === 0 || input.items.some((item) => item.plan === null)) return null;
  const exercises = input.items.map((item, index): DraftExercise => {
    const plan = item.plan as WorkoutExercisePlan;
    const planned = draftTargetFrom(plan, item.shown);
    return {
      id: input.newId(),
      orderNo: index + 1,
      plannedExerciseId: input.plannedExerciseIds.get(item.plannedOrderNo) ?? null,
      storedExerciseId: item.storedExerciseId,
      dosage: {
        sets: item.shown.sets,
        reps_min: item.shown.reps_min,
        reps_max: item.shown.reps_max,
        duration_s: item.shown.duration_s,
        rpe_target: item.shown.rpe_target,
        rest_s: item.shown.rest_s,
        superset_group: item.shown.superset_group,
      },
      reference: { ...item.reference },
      planned,
      alternative: null,
      skipped: false,
      sets: setsFor(planned),
      weightConfirmed: false,
    };
  });
  return {
    format: DRAFT_FORMAT,
    ownerUserId: input.ownerUserId,
    key: input.session.id,
    state: 'open',
    rejectReason: null,
    fromHealthPlan: input.fromHealthPlan,
    editing: false,
    logId: input.newId(),
    baseRevision: null,
    serverRevision: null,
    plannedSessionId: input.session.id,
    plannedDate: input.session.original_date ?? input.session.scheduled_on,
    kind: input.session.kind,
    nameDe: input.session.name_de,
    isIntroWeek: input.session.is_intro_week,
    isDeload: input.session.is_deload,
    performedOn: input.performedOn,
    startedAt: input.now,
    sessionRpe: null,
    notes: '',
    exercises,
    updatedAt: input.now,
  };
}

/** Neuer Ausdauer-Entwurf: Art und Dauer aus der geplanten Einheit vorbelegt (die Person trägt ein, was sie tat). */
export function createEnduranceDraft(
  input: Omit<CreateDraftInput, 'items' | 'plannedExerciseIds'>,
): WorkoutDraft {
  const { hours, minutes } = splitDuration(input.session.estimated_minutes * 60);
  return {
    format: DRAFT_FORMAT,
    ownerUserId: input.ownerUserId,
    key: input.session.id,
    state: 'open',
    rejectReason: null,
    fromHealthPlan: input.fromHealthPlan,
    editing: false,
    logId: input.newId(),
    baseRevision: null,
    serverRevision: null,
    plannedSessionId: input.session.id,
    plannedDate: input.session.original_date ?? input.session.scheduled_on,
    kind: 'endurance',
    nameDe: input.session.name_de,
    isIntroWeek: input.session.is_intro_week,
    isDeload: input.session.is_deload,
    performedOn: input.performedOn,
    startedAt: input.now,
    sessionRpe: null,
    notes: '',
    exercises: [],
    cardio: {
      modality: input.session.endurance_modality ?? 'run',
      hours: String(hours),
      minutes: String(minutes),
      distanceKm: '',
      elevationM: '',
    },
    updatedAt: input.now,
  };
}

/** Gespeicherter Ausdauer-Eintrag → Eingabe-Text. */
export function draftCardioFromRow(row: {
  modality: EnduranceModality;
  duration_s: number;
  distance_m: number | null;
  elevation_m: number | null;
}): DraftCardio {
  const { hours, minutes } = splitDuration(row.duration_s);
  return {
    modality: row.modality,
    hours: String(hours),
    minutes: String(minutes),
    distanceKm: row.distance_m === null ? '' : formatDecimal(row.distance_m / 1000),
    elevationM: row.elevation_m === null ? '' : String(row.elevation_m),
  };
}

/** Eingabe-Text → Zahlen für packages/core (leer = null, unlesbar = NaN). */
export function cardioInputOf(cardio: DraftCardio): CardioInput {
  return {
    modality: cardio.modality,
    hours: parseDecimal(cardio.hours),
    minutes: parseDecimal(cardio.minutes),
    distanceKm: parseDecimal(cardio.distanceKm),
    elevationM: parseDecimal(cardio.elevationM),
  };
}

/** Ausdauer-Teil des Entwurfs geprüft (cardioLogFromInput); null bei Kraft. */
export function draftCardioResult(draft: WorkoutDraft): CardioInputResult | null {
  return draft.kind === 'endurance' && draft.cardio
    ? cardioLogFromInput(cardioInputOf(draft.cardio))
    : null;
}

export function setCardioFields(
  draft: WorkoutDraft,
  patch: Partial<DraftCardio>,
  now: string,
): WorkoutDraft {
  if (!draft.cardio) return draft;
  return { ...draft, cardio: { ...draft.cardio, ...patch }, updatedAt: now };
}

/**
 * Entwurf zum Ändern eines vorhandenen Eintrags (Ansehen/Ändern): Vorgabe und Zustand bleiben der gespeicherte
 * Schnappschuss (das, was die Person damals gesehen hat); Übungen sind nicht tauschbar.
 */
export function draftFromLog(
  rows: UserRows,
  logId: string,
  meta: { ownerUserId: string; fromHealthPlan: boolean; now: string },
): WorkoutDraft | null {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  if (!log || !log.planned_session_id) return null;
  const session = rows.plannedSessions.find((s) => s.id === log.planned_session_id);
  const cardioRow =
    log.kind === 'endurance' ? rows.cardioLogs.find((c) => c.session_log_id === log.id) : undefined;
  const exercises = rows.exerciseLogs
    .filter((e) => e.session_log_id === log.id)
    .sort((a, b) => a.order_no - b.order_no)
    .map((e): DraftExercise => {
      const plannedRow = e.planned_exercise_id
        ? rows.plannedExercises.find((p) => p.id === e.planned_exercise_id)
        : undefined;
      const target: DraftTarget = {
        exerciseId: e.exercise_id,
        nameDe: e.exercise_name_de,
        loadType: e.load_type,
        incrementKind: 'none',
        perPiece: null,
        steps: [],
        targets: {
          target_sets: e.target_sets,
          reps_min: e.reps_min,
          reps_max: e.reps_max,
          target_reps: e.target_reps,
          target_extra_set: e.target_extra_set,
          target_weight_kg: e.target_weight_kg,
          target_duration_s: e.target_duration_s,
          target_rpe: e.target_rpe,
          is_return: e.is_return,
        },
        state: {
          state_weight_kg: e.state_weight_kg,
          state_target_reps: e.state_target_reps,
          state_extra_set: e.state_extra_set,
          state_duration_s: e.state_duration_s,
        },
        heavierReferenceKg:
          e.state_weight_kg === null && e.target_weight_kg === null
            ? null
            : Math.max(e.state_weight_kg ?? 0, e.target_weight_kg ?? 0),
        lighterReferenceKg: e.state_weight_kg,
        chooseLightest: false,
        source: 'logs',
        hint: null,
        harderVariantName: null,
      };
      const sets = rows.setLogs
        .filter((s) => s.exercise_log_id === e.id)
        .sort((a, b) => a.set_no - b.set_no)
        .map((s) => ({
          reps: s.reps,
          weightKg: s.weight_kg,
          durationS: s.duration_s,
          rpe: s.rpe,
          done: s.done,
        }));
      return {
        id: e.id,
        orderNo: e.order_no,
        plannedExerciseId: e.planned_exercise_id,
        storedExerciseId: plannedRow?.exercise_id ?? null,
        dosage: {
          sets: plannedRow?.sets ?? e.target_sets ?? Math.max(1, sets.length),
          reps_min: plannedRow?.reps_min ?? e.reps_min,
          reps_max: plannedRow?.reps_max ?? e.reps_max,
          duration_s: plannedRow?.duration_s ?? e.target_duration_s,
          rpe_target: plannedRow?.rpe_target ?? e.target_rpe ?? CONSERVATIVE_PLAN_RULES.rpeMax,
          rest_s: plannedRow?.rest_s ?? 90,
          superset_group: plannedRow?.superset_group ?? null,
        },
        reference: {
          templateSets: plannedRow?.sets ?? 1,
          rpeTarget: plannedRow?.rpe_target ?? CONSERVATIVE_PLAN_RULES.rpeMax,
        },
        planned: target,
        alternative: null,
        skipped: e.status === 'skipped',
        sets: e.status === 'skipped' ? setsFor(target) : sets,
        weightConfirmed: e.weight_confirmed,
      };
    });
  return {
    format: DRAFT_FORMAT,
    ownerUserId: meta.ownerUserId,
    key: log.planned_session_id,
    state: 'open',
    rejectReason: null,
    fromHealthPlan: meta.fromHealthPlan,
    editing: true,
    logId: log.id,
    baseRevision: log.revision > 0 ? log.revision : null,
    serverRevision: null,
    plannedSessionId: log.planned_session_id,
    plannedDate: session ? (session.original_date ?? session.scheduled_on) : log.performed_on,
    kind: log.kind,
    nameDe: log.name_de,
    isIntroWeek: log.is_intro_week,
    isDeload: log.is_deload,
    performedOn: log.performed_on,
    startedAt: log.started_at,
    sessionRpe: log.session_rpe,
    notes: log.notes ?? '',
    exercises,
    cardio: cardioRow ? draftCardioFromRow(cardioRow) : null,
    updatedAt: meta.now,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Ändern (jede Änderung gibt einen neuen Entwurf zurück)
// ---------------------------------------------------------------------------------------------------------

export function currentTarget(exercise: DraftExercise): DraftTarget {
  return exercise.alternative ?? exercise.planned;
}

function updateExercise(
  draft: WorkoutDraft,
  index: number,
  change: (exercise: DraftExercise) => DraftExercise,
  now: string,
): WorkoutDraft {
  return {
    ...draft,
    updatedAt: now,
    exercises: draft.exercises.map((e, i) => (i === index ? change(e) : e)),
  };
}

/**
 * Satz ändern. Gewicht bzw. Wiederholungen gelten auch für die FOLGENDEN, noch nicht abgehakten Sätze mit bisher
 * gleichem Wert (einmal einstellen statt in jedem Satz).
 */
export function updateSet(
  draft: WorkoutDraft,
  index: number,
  setIndex: number,
  patch: Partial<LoggedSet>,
  now: string,
): WorkoutDraft {
  return updateExercise(
    draft,
    index,
    (e) => {
      const before = e.sets[setIndex];
      return {
        ...e,
        sets: e.sets.map((s, i) => {
          if (i === setIndex) return { ...s, ...patch };
          if (i < setIndex || s.done || !before) return s;
          const follow: { -readonly [K in keyof LoggedSet]?: LoggedSet[K] } = {};
          if (patch.weightKg !== undefined && s.weightKg === before.weightKg) {
            follow.weightKg = patch.weightKg;
          }
          if (patch.reps !== undefined && s.reps === before.reps) follow.reps = patch.reps;
          if (patch.durationS !== undefined && s.durationS === before.durationS) {
            follow.durationS = patch.durationS;
          }
          return { ...s, ...follow };
        }),
        // Neues Gewicht → bisherige Bestätigung gilt nicht mehr.
        weightConfirmed: patch.weightKg !== undefined ? false : e.weightConfirmed,
      };
    },
    now,
  );
}

/** Weiteren Satz anhängen (Werte wie der letzte Satz), höchstens `max` Sätze. */
export function addSet(draft: WorkoutDraft, index: number, max: number, now: string): WorkoutDraft {
  return updateExercise(
    draft,
    index,
    (e) => {
      const last = e.sets.at(-1);
      if (e.sets.length >= max || !last) return e;
      return { ...e, sets: [...e.sets, { ...last, done: false, rpe: null }] };
    },
    now,
  );
}

export function setSkipped(
  draft: WorkoutDraft,
  index: number,
  skipped: boolean,
  now: string,
): WorkoutDraft {
  return updateExercise(draft, index, (e) => ({ ...e, skipped }), now);
}

/** Alternative wählen (null = zurück zur geplanten Übung): Sätze neu aus der jeweiligen Vorgabe. */
export function chooseAlternative(
  draft: WorkoutDraft,
  index: number,
  alternative: DraftTarget | null,
  now: string,
): WorkoutDraft {
  return updateExercise(
    draft,
    index,
    (e) => ({
      ...e,
      alternative,
      skipped: false,
      weightConfirmed: false,
      sets: setsFor(alternative ?? e.planned),
    }),
    now,
  );
}

/** Geplante Übung neu berechnet (z. B. nach eigenem Startgewicht): Vorgabe und Sätze neu. */
export function replacePlanned(
  draft: WorkoutDraft,
  index: number,
  planned: DraftTarget,
  now: string,
): WorkoutDraft {
  return updateExercise(
    draft,
    index,
    (e) => ({
      ...e,
      planned,
      alternative: null,
      skipped: false,
      weightConfirmed: false,
      sets: setsFor(planned),
    }),
    now,
  );
}

export function confirmWeight(draft: WorkoutDraft, index: number, now: string): WorkoutDraft {
  return updateExercise(draft, index, (e) => ({ ...e, weightConfirmed: true }), now);
}

export function setSessionFields(
  draft: WorkoutDraft,
  patch: Partial<Pick<WorkoutDraft, 'sessionRpe' | 'notes'>>,
  now: string,
): WorkoutDraft {
  return { ...draft, ...patch, updatedAt: now };
}

// ---------------------------------------------------------------------------------------------------------
// Warnungen (packages/core setEntryWarnings)
// ---------------------------------------------------------------------------------------------------------

export function warningsForSet(exercise: DraftExercise, set: LoggedSet): SetEntryWarning[] {
  const target = currentTarget(exercise);
  return setEntryWarnings(
    { weightKg: target.loadType === 'weight' ? set.weightKg : null, reps: set.reps },
    {
      stateWeightKg: target.heavierReferenceKg,
      lighterReferenceKg: target.lighterReferenceKg,
      plannedReps: target.targets.target_reps,
      incrementKind: target.incrementKind,
      steps: target.steps,
    },
  );
}

/** Braucht die Übung eine Gewichts-Bestätigung (abgehakter Satz mit Gewichts-Warnung, noch nicht bestätigt)? */
export function needsWeightConfirmation(exercise: DraftExercise): boolean {
  if (exercise.weightConfirmed || exercise.skipped) return false;
  return exercise.sets.some(
    (s) => s.done && warningsForSet(exercise, s).some((w) => w !== 'check_reps'),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Entwurf → Eintrag (save_session_log)
// ---------------------------------------------------------------------------------------------------------

function exercisePayload(e: DraftExercise): ExerciseLogPayload {
  const target = currentTarget(e);
  const status = exerciseLogStatusFor(e.skipped, target.exerciseId, e.storedExerciseId);
  return {
    id: e.id,
    order_no: e.orderNo,
    planned_exercise_id: e.plannedExerciseId,
    exercise_id: target.exerciseId,
    exercise_name_de: target.nameDe,
    load_type: target.loadType,
    status,
    ...target.targets,
    ...target.state,
    weight_confirmed: e.weightConfirmed,
    sets:
      status === 'skipped'
        ? []
        : e.sets.map((s, i) => ({
            set_no: i + 1,
            reps: target.loadType === 'time' ? null : s.reps,
            weight_kg: target.loadType === 'weight' ? s.weightKg : null,
            duration_s: target.loadType === 'time' ? s.durationS : null,
            rpe: s.rpe,
            done: s.done,
          })),
  };
}

export function draftToPayload(
  draft: WorkoutDraft,
  options: { writeId: string; now: string },
): SessionLogPayload {
  const exercises = draft.exercises.map(exercisePayload);
  const notes = draft.notes.trim();
  return {
    id: draft.logId,
    write_id: options.writeId,
    base_revision: draft.baseRevision,
    planned_session_id: draft.plannedSessionId,
    planned_date: draft.plannedDate,
    kind: draft.kind,
    performed_on: draft.performedOn,
    started_at: draft.startedAt,
    finished_at: options.now,
    status: sessionLogStatus(draft.kind, exercises),
    session_rpe: draft.sessionRpe,
    notes: notes === '' ? null : notes,
    name_de: draft.nameDe,
    is_intro_week: draft.isIntroWeek,
    is_deload: draft.isDeload,
    source: 'manual',
    client_updated_at: options.now,
    exercises,
    cardio: (() => {
      const result = draftCardioResult(draft);
      return result?.ok ? result.cardio : null;
    })(),
  };
}

/** Gültig nach den Regeln von save_session_log (Zod an der Grenze)? */
export function isValidPayload(payload: SessionLogPayload): boolean {
  return sessionLogPayloadSchema.safeParse(payload).success;
}
