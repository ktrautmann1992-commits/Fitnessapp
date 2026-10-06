import {
  canCatchUp,
  type EquipmentProfile,
  experienceLevelSchema,
  type PlanLibrary,
  type PlanSafetyRules,
  planWorkout,
  prepareSessionForDisplay,
  sessionLocation,
  startOfIsoWeek,
  type DisplaySession,
  type PlanExerciseContext,
  planWorkoutExercise,
  type StoredSession,
  weeklySetRange,
  type WorkoutItem,
} from '@fitnessapp/core';

import { logEntriesFromRows, startWeightsFromRows } from './log-rows';
import {
  type ActivePlan,
  activePlan,
  allSessions,
  planSnapshot,
  profilesFor,
  startGroupOf,
} from './training-plan';
import type { UserRows } from './types';
import {
  createEnduranceDraft,
  createWorkoutDraft,
  type DraftExercise,
  type DraftTarget,
  draftTargetFrom,
  type WorkoutDraft,
} from './workout-draft';

/**
 * Trainingsmodus in der App (docs/PLAN-PHASE-4.md 6.1): setzt die gespeicherte Einheit, die aktuellen
 * Sicherheitsregeln, den Ort und das Tagebuch zusammen und ruft planWorkout() aus packages/core. Nur Zusammensetzen –
 * gleiche Schritte wie „Heute“ (prepareSessionForDisplay vor JEDER Anzeige). Rein und getestet.
 */

export interface WorkoutView {
  active: ActivePlan;
  stored: StoredSession;
  shown: DisplaySession<StoredSession>;
  profile: EquipmentProfile;
  items: WorkoutItem[];
  /** Kontext der Progression (für eine später gewählte Alternative). */
  context: PlanExerciseContext;
}

export function workoutView(
  rows: UserRows,
  library: PlanLibrary,
  rules: PlanSafetyRules,
  sessionId: string,
  today: string,
  options: { excludeLogId?: string | null } = {},
): WorkoutView | null {
  const active = activePlan(rows);
  const stored = active?.sessions.find((s) => s.id === sessionId);
  const birthDate = rows.profile?.birth_date;
  const level = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  if (!active || !stored || !birthDate || !level.success) return null;
  const snapshot = planSnapshot(active.plan);
  const profiles = profilesFor(snapshot);
  const lookup = library.displayExercises ?? library.exercises;
  const location = sessionLocation(stored, snapshot?.schedule ?? null, {
    library: lookup,
    homeProfile: profiles.get('home'),
  });
  const profile = profiles.get(location) as EquipmentProfile;
  const shown = prepareSessionForDisplay(stored, {
    rules,
    previousStartGroup: startGroupOf(active, birthDate),
    library: lookup,
    substituteLibrary: library.exercises,
    profile,
  });
  const template = library.templates.find((tpl) => tpl.id === active.plan.template_id);
  const weekStart = startOfIsoWeek(stored.original_date ?? stored.scheduled_on);
  const weekSessions = active.sessions.filter(
    (s) => startOfIsoWeek(s.original_date ?? s.scheduled_on) === weekStart,
  );
  const context: PlanExerciseContext = {
    library: lookup,
    engineLibrary: library.exercises,
    profile,
    rules,
    experienceLevel: level.data,
    entries: logEntriesFromRows(rows, options.excludeLogId ?? null),
    startWeights: startWeightsFromRows(rows),
    today,
    isDeload: stored.is_deload,
    weekSessions,
    weeklySetMax: template ? weeklySetRange(template).max : null,
  };
  const items = planWorkout(stored, shown, active.sessions, context);
  return { active, stored, shown, profile, items, context };
}

/**
 * Vorgabe und Zustand einer ALTERNATIVE (R2): eigener Verlauf unter ihrer exercise_id, Dosierung des Termins.
 * null = Übung unbekannt.
 */
export function alternativeTarget(
  view: WorkoutView,
  exercise: Pick<DraftExercise, 'dosage' | 'reference'>,
  alternativeId: string,
): DraftTarget | null {
  const alternative = view.context.engineLibrary.get(alternativeId);
  if (!alternative) return null;
  const dosage = {
    order_no: 1,
    exercise_id: alternative.id,
    source_exercise_id: alternative.id,
    exercise_name_de: alternative.name_de,
    sets: exercise.dosage.sets,
    reps_min: exercise.dosage.reps_min,
    reps_max: exercise.dosage.reps_max,
    duration_s: exercise.dosage.duration_s,
    rest_s: exercise.dosage.rest_s,
    rpe_target: exercise.dosage.rpe_target,
    superset_group: exercise.dosage.superset_group,
    notes_de: null,
    target_weight_kg: null,
  };
  const plan = planWorkoutExercise(alternative, dosage, exercise.reference, view.context);
  return draftTargetFrom(plan, dosage);
}

/** Geplante Übung nach geändertem Startgewicht neu berechnen (gleiche gespeicherte Übung des Termins). */
export function replannedTarget(view: WorkoutView, exercise: DraftExercise): DraftTarget | null {
  const item = view.items.find(
    (candidate) =>
      candidate.storedExerciseId === exercise.storedExerciseId &&
      candidate.shown.exercise_id === exercise.planned.exerciseId,
  );
  return item?.plan ? draftTargetFrom(item.plan, item.shown) : null;
}

/** Wann darf die Einheit HEUTE trainiert werden? Heute geplant – oder „Heute nachholen“ (canCatchUp, W2). */
export type StartKind = 'today' | 'catch_up' | null;

/**
 * „Nie stapeln“ (save_session_log): Ist heute schon eine ANDERE geplante Einheit eingetragen (z. B. aus dem vorigen
 * Plan)? Dann kein zweites Training anbieten – „Heute“ sagt warum (K4).
 */
export function trainedTodayOther(rows: UserRows, session: StoredSession, today: string): boolean {
  return rows.sessionLogs.some(
    (l) =>
      l.performed_on === today &&
      l.planned_session_id !== null &&
      l.planned_session_id !== session.id,
  );
}

export function startKind(rows: UserRows, session: StoredSession, today: string): StartKind {
  // Kraft und Ausdauer (Etappe C2) – gleiche Regeln (heute bzw. nachholen, nie stapeln).
  if (session.status !== 'planned') return null;
  if (trainedTodayOther(rows, session, today)) return null;
  if (session.scheduled_on === today) return 'today';
  return canCatchUp(allSessions(rows), session.id, today) ? 'catch_up' : null;
}

/** Neuer Entwurf für die Einheit (null = Übungen nicht prüfbar). */
export function newWorkoutDraft(
  rows: UserRows,
  view: WorkoutView,
  meta: { ownerUserId: string; today: string; now: string; newId: () => string },
): WorkoutDraft | null {
  const plannedExerciseIds = new Map(
    rows.plannedExercises
      .filter((e) => e.session_id === view.stored.id)
      .map((e) => [e.order_no, e.id] as const),
  );
  return createWorkoutDraft({
    ownerUserId: meta.ownerUserId,
    session: view.stored,
    items: view.items,
    plannedExerciseIds,
    fromHealthPlan: view.active.plan.uses_health_data,
    performedOn: meta.today,
    now: meta.now,
    newId: meta.newId,
  });
}

/**
 * Neuer Ausdauer-Entwurf (Etappe C2) – braucht keine Übungs-Bibliothek (keine Übungen, nichts zu prüfen).
 * null = Einheit gehört nicht zum aktiven Plan oder ist keine Ausdauer-Einheit.
 */
export function newEnduranceDraft(
  rows: UserRows,
  sessionId: string,
  meta: { ownerUserId: string; today: string; now: string; newId: () => string },
): WorkoutDraft | null {
  const active = activePlan(rows);
  const session = active?.sessions.find((s) => s.id === sessionId);
  if (!active || !session || session.kind !== 'endurance') return null;
  return createEnduranceDraft({
    ownerUserId: meta.ownerUserId,
    session,
    fromHealthPlan: active.plan.uses_health_data,
    performedOn: meta.today,
    now: meta.now,
    newId: meta.newId,
  });
}
