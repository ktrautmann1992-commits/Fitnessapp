import type {
  EnduranceModality,
  EquipmentLocation,
  PlannedSessionKind,
  PlannedSessionStatus,
  PlanStatus,
  SessionFocus,
} from '../enums';
import { equipmentIdSchema } from '../equipment';
import { equipmentProfile } from './equipment-profile';
import type { PlanInputsSnapshot } from './inputs';
import { savePlanInputsSchema } from './payload';
import type { StoredSession } from './view';

/**
 * Gespeicherter Trainingsplan als Zeilen (docs/PLAN-PHASE-4B.md 5.1, Etappe A0): Abbildung der Tabellen
 * user_plans/planned_sessions/planned_exercises auf die Eingaben der Plan-Engine – EINE Abbildung für App
 * (Testmodus und Supabase-Abbild) und Server. Nur Abbildung, keine Regeln; rein und ohne Speicher-/Netzzugriff.
 *
 * Die Zeilen-Typen spiegeln die Spalten der Datenbank (packages/db/src/database.types.ts); dass beide gleich
 * bleiben, prüft apps/mobile/src/data/row-types.test.ts zur Übersetzungszeit.
 */

/** Zeile aus planned_sessions (ohne created_at/updated_at). */
export interface PlannedSessionRow {
  id: string;
  user_id: string;
  plan_id: string;
  block_no: number;
  week_no: number;
  is_intro_week: boolean;
  is_deload: boolean;
  kind: PlannedSessionKind;
  template_day_index: number | null;
  scheduled_on: string;
  original_date: string | null;
  status: PlannedSessionStatus;
  name_de: string;
  focus: SessionFocus | null;
  endurance_modality: EnduranceModality | null;
  effort_target: number | null;
  estimated_minutes: number;
  warmup_de: string;
  cooldown_de: string;
}

/** Zeile aus planned_exercises. */
export interface PlannedExerciseRow {
  id: string;
  user_id: string;
  session_id: string;
  order_no: number;
  exercise_id: string;
  source_exercise_id: string;
  exercise_name_de: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  duration_s: number | null;
  rest_s: number;
  rpe_target: number;
  superset_group: string | null;
  notes_de: string | null;
  target_weight_kg: number | null;
}

/** Was die Abbildung von einer user_plans-Zeile braucht (die übrigen Spalten reicht sie unverändert durch). */
export interface PlanRowRef {
  id: string;
  status: PlanStatus;
}

/** Die Plan-Tabellen eines Nutzers. */
export interface PlanRows<P extends PlanRowRef = PlanRowRef> {
  plans: P[];
  plannedSessions: PlannedSessionRow[];
  plannedExercises: PlannedExerciseRow[];
}

/** Aktiver Plan mit seinen Einheiten (nach Datum), Übungen nach order_no. */
export interface ActivePlanRows<P extends PlanRowRef = PlanRowRef> {
  plan: P;
  sessions: StoredSession[];
}

/** Eine Zeile aus planned_sessions samt ihrer Übungen (nach order_no) als gespeicherte Einheit der Engine. */
export function storedSessionFromRows(
  plannedExercises: readonly PlannedExerciseRow[],
  s: PlannedSessionRow,
): StoredSession {
  return {
    id: s.id,
    status: s.status,
    original_date: s.original_date,
    block_no: s.block_no,
    week_no: s.week_no,
    is_intro_week: s.is_intro_week,
    is_deload: s.is_deload,
    kind: s.kind,
    template_day_index: s.template_day_index,
    scheduled_on: s.scheduled_on,
    name_de: s.name_de,
    focus: s.focus,
    endurance_modality: s.endurance_modality,
    effort_target: s.effort_target,
    estimated_minutes: s.estimated_minutes,
    warmup_de: s.warmup_de,
    cooldown_de: s.cooldown_de,
    exercises: plannedExercises
      .filter((e) => e.session_id === s.id)
      .sort((a, b) => a.order_no - b.order_no)
      .map((e) => ({
        order_no: e.order_no,
        exercise_id: e.exercise_id,
        source_exercise_id: e.source_exercise_id,
        exercise_name_de: e.exercise_name_de,
        sets: e.sets,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        duration_s: e.duration_s,
        rest_s: e.rest_s,
        rpe_target: e.rpe_target,
        superset_group: e.superset_group,
        notes_de: e.notes_de,
        target_weight_kg: e.target_weight_kg,
      })),
  };
}

const byDate = (a: { scheduled_on: string }, b: { scheduled_on: string }) =>
  a.scheduled_on.localeCompare(b.scheduled_on);

/** Aktiver Plan (status = 'active') mit seinen Einheiten; null = kein aktiver Plan. */
export function activePlan<P extends PlanRowRef>(rows: PlanRows<P>): ActivePlanRows<P> | null {
  const plan = rows.plans.find((p) => p.status === 'active');
  if (!plan) return null;
  return {
    plan,
    sessions: rows.plannedSessions
      .filter((s) => s.plan_id === plan.id)
      .sort(byDate)
      .map((s) => storedSessionFromRows(rows.plannedExercises, s)),
  };
}

/** Alle Einheiten der Person (auch früherer Pläne) nach Datum – für „nie stapeln“ beim Verschieben. */
export function allSessions(
  rows: Pick<PlanRows, 'plannedSessions' | 'plannedExercises'>,
): StoredSession[] {
  return [...rows.plannedSessions]
    .sort(byDate)
    .map((s) => storedSessionFromRows(rows.plannedExercises, s));
}

/** Angaben, mit denen der Plan erstellt wurde (user_plans.inputs, Zod an der Grenze); null = unlesbar. */
export function planSnapshot(plan: { inputs: unknown }): PlanInputsSnapshot | null {
  const parsed = savePlanInputsSchema.safeParse(plan.inputs);
  return parsed.success ? (parsed.data as PlanInputsSnapshot) : null;
}

/** Geräte-Profile je Ort aus den Angaben des Plans (Ersatz in Anzeige und Folgeblock). */
export function profilesFor(snapshot: PlanInputsSnapshot | null) {
  const home = (snapshot?.homeEquipment ?? []).flatMap((item) => {
    const id = equipmentIdSchema.safeParse(item.equipmentId);
    return id.success
      ? [{ equipmentId: id.data, weightsKg: item.weightsKg, barKg: item.barKg }]
      : [];
  });
  return new Map<EquipmentLocation, ReturnType<typeof equipmentProfile>>([
    ['gym', equipmentProfile('gym', home)],
    ['home', equipmentProfile('home', home)],
  ]);
}
