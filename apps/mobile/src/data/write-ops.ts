import {
  addDays,
  isoDateInTimeZone,
  PLAN_SAVE_LIMITS,
  tastePreferencesAfterConversion,
  type ConsentPlatform,
  type ConsentType,
  type EquipmentLocation,
  type FoodGroupId,
  type FoodPreferenceKind,
  type SavePlanPayload,
  type SavePlanSession,
} from '@fitnessapp/core';
import type { TablesInsert, TablesUpdate } from '@fitnessapp/db';

import {
  deleteHealthPlanLogRows,
  detachLogs,
  EMPTY_LOG_ROWS,
  logRowsOf,
  type LogRows,
  neutralizeHealthPlanLogRows,
} from './log-rows';
import type {
  BodyMeasurementsRow,
  BodyMetricsRow,
  ExercisePreferenceRow,
  FoodLogFavoriteRow,
  FoodPreferenceRow,
  GoalsRow,
  MeasurementReminderRow,
  NutritionPrefsRow,
  NutritionSetupRow,
  PlannedExerciseRow,
  PlannedSessionRow,
  TrainingSlotRow,
  UserEquipmentRow,
  UserPlanRow,
  UserRows,
  WeightGoalRow,
} from './types';

/**
 * Schreib-Vorgänge, in die jeder Onboarding-Schritt zerlegt wird (siehe mapping.ts → planStepWrites).
 * Beide Betriebsarten führen dieselben Vorgänge aus:
 * - Testmodus: applyWriteOps() auf den Gerätespeicher (nach Prüfung der Datenbank-Regeln, local-backend.ts),
 * - Supabase: als Tabellen-Upsert/-Insert (supabase-backend.ts).
 * Alle Vorgänge sind JSON-serialisierbar, damit Nicht-Gesundheitsdaten offline in die Warteschlange können.
 */
export type WriteOp =
  | { kind: 'update_profile'; patch: ProfilePatch }
  | { kind: 'grant_consent'; consentType: ConsentType; version: number; platform: ConsentPlatform }
  | { kind: 'upsert_goals'; row: GoalsRow }
  /** Alle Trainingstage ersetzen (public.replace_training_slots) – kein Gesundheitsdatum. */
  | { kind: 'replace_training_slots'; rows: TrainingSlotRow[] }
  | { kind: 'replace_user_equipment'; location: 'home' | 'gym'; rows: UserEquipmentRow[] }
  | { kind: 'upsert_nutrition_prefs'; row: NutritionPrefsRow }
  /**
   * Antworten des Schritts `nutrition_setup` (Etappe N4). Bis Etappe N7 NUR im Testmodus – der Supabase-Modus zeigt den
   * Schritt nicht (R2-S3) und lehnt den Vorgang ab, falls er doch entsteht. Kein Gesundheitsdatum.
   */
  | { kind: 'upsert_nutrition_setup'; row: NutritionSetupRow }
  | { kind: 'replace_food_preferences'; scope: FoodPreferenceScope; rows: FoodPreferenceRow[] }
  | { kind: 'upsert_body_metrics'; row: BodyMetricsInsert }
  | { kind: 'upsert_body_measurements'; row: BodyMeasurementsInsert }
  | { kind: 'insert_health_screening'; row: HealthScreeningInsert }
  | { kind: 'upsert_measurement_reminder'; row: MeasurementReminderRow }
  /**
   * Wunschgewicht anlegen bzw. ersetzen (Etappe Z3, Tabelle weight_goals). Gesundheitsdatum: nur mit Einwilligung, nie
   * in die Warteschlange. `start_date` = Tag des Speicherns (Wächter S15, setzt packages/core). Nur mit Abnehmziel
   * (Wächter S13; Datenbank-Trigger, im Testmodus local-rules.ts).
   */
  | { kind: 'upsert_weight_goal'; row: WeightGoalRow }
  /** Wunschgewicht löschen („ohne festes Ziel“). Sofort gesendet, braucht keine Einwilligung (Recht auf Löschung). */
  | { kind: 'delete_weight_goal' }
  /**
   * Neuen Trainingsplan speichern (public.save_training_plan) – ersetzt den aktiven Plan. Nie in die Warteschlange
   * (Erzeugen braucht einmal Verbindung). `payload` = toSavePlanPayload() aus packages/core (nur Plan-Spalten).
   */
  | { kind: 'save_training_plan'; payload: SavePlanPayload }
  /** Folgeblock anhängen (public.append_plan_block). Nie in die Warteschlange. */
  | {
      kind: 'append_plan_block';
      planId: string;
      usesHealthData: boolean;
      sessions: SavePlanSession[];
    }
  /**
   * Einheit verschieben bzw. streichen (Update von planned_sessions: nur Datum und Status). Pläne ohne
   * Gesundheitsdaten dürfen offline in die Warteschlange (Schlüssel update_planned_session:<id>), Pläne mit
   * Gesundheitsdaten werden sofort gesendet (Abschnitt 9).
   */
  | {
      kind: 'update_planned_session';
      sessionId: string;
      planId: string;
      usesHealthData: boolean;
      scheduledOn: string;
      status: PlannedSessionRow['status'];
    }
  /**
   * Zwei geplante Einheiten tauschen (public.swap_planned_sessions, Etappe A1a, A-G4). Nie in die Warteschlange: Der
   * Tausch braucht den Server-Stand beider Einheiten (eine wartende Verschiebung könnte ihn sonst überholen) – ohne
   * Verbindung „Dafür brauchst du kurz Verbindung“; Verschieben auf freie Tage geht weiter offline.
   */
  | {
      kind: 'swap_planned_sessions';
      sessionId: string;
      otherSessionId: string;
      /** Erwartete aktuelle Tage beider Einheiten (an den geprüften Stand gebunden). */
      sessionOn: string;
      otherSessionOn: string;
      planId: string;
      usesHealthData: boolean;
    }
  /**
   * Eigenes Startgewicht (exercise_start_weights, direkt per PostgREST – bewusste Ausnahme W14); null = entfernen.
   * Kein Tagebuch-Inhalt: darf über die normale Warteschlange (Schlüssel set_exercise_start_weight:<exercise_id>).
   */
  | { kind: 'set_exercise_start_weight'; exerciseId: string; weightKg: number | null }
  /**
   * Übungs-Präferenz „Ab jetzt immer“ anlegen bzw. ersetzen (Schlüssel Übung + Ort; docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md
   * 9, Etappe T2). Kein Gesundheitsdatum: ab T3 über die normale Warteschlange
   * (Schlüssel exercise_preference:<exercise_id>:<location>, letzte Änderung gewinnt).
   */
  | { kind: 'upsert_exercise_preference'; row: ExercisePreferenceRow }
  /** Übungs-Präferenz entfernen („Wieder zulassen“, „Entfernen“, Rückgängig). */
  | { kind: 'delete_exercise_preference'; exerciseId: string; location: EquipmentLocation }
  /**
   * Eintrag der Einkaufsliste abhaken bzw. zurücksetzen (Etappe N7 Teil 2: Spalte `shopping_list_items.checked`, direkt
   * per PostgREST). Listen OHNE Gesundheitsbezug offline über die Warteschlange (Schlüssel je Liste und Eintrag), mit
   * Gesundheitsbezug sofort (Ersatzprodukte lassen auf Unverträglichkeiten schließen).
   */
  | {
      kind: 'set_shopping_item_checked';
      listId: string;
      weekStart: string;
      itemKey: string;
      checked: boolean;
      usesHealthData: boolean;
    }
  /**
   * Start des Meal-Prep-Kochtags setzen bzw. zurücksetzen (Etappe N7 Teil 2: Spalte `meal_plans.cook_day_started_at`).
   * Pläne ohne Gesundheitsbezug offline über die Warteschlange, sonst sofort.
   */
  | {
      kind: 'set_cook_day_start';
      planId: string;
      weekStart: string;
      startedAt: string | null;
      usesHealthData: boolean;
    }
  /**
   * Favorit (Stern) des Ernährungstagebuchs setzen (Etappe N7 Teil 2: `food_log_favorites`, direkt per PostgREST). Kein
   * Gesundheitsdatum (A-G14) – außer Schnell-Favoriten (Bezeichnung + kcal, Wächter E1 G1): die sofort.
   */
  | { kind: 'upsert_food_log_favorite'; row: FoodLogFavoriteRow }
  /** Favorit entfernen (Schlüssel eines Schnell-Favoriten enthält kcal → sofort, nie in die Warteschlange). */
  | { kind: 'delete_food_log_favorite'; favKey: string };

export type ProfilePatch = Pick<
  TablesUpdate<'profiles'>,
  | 'sex'
  | 'cycle_module_interest'
  | 'experience_level'
  | 'onboarding_step'
  | 'onboarding_completed_at'
>;

/** „taste“ = mag / mag nicht, „intolerance“ = Unverträglichkeiten (Gesundheitsdaten). */
export type FoodPreferenceScope = 'taste' | 'intolerance';

export type BodyMetricsInsert = Omit<BodyMetricsRow, 'id'>;
export type BodyMeasurementsInsert = Omit<BodyMeasurementsRow, 'id'>;
export type HealthScreeningInsert = Required<
  Pick<TablesInsert<'health_screening'>, 'user_id' | 'answers' | 'medical_notice_acknowledged_at'>
>;

export function kindsForScope(scope: FoodPreferenceScope): FoodPreferenceKind[] {
  return scope === 'intolerance' ? ['intolerance'] : ['like', 'dislike'];
}

/**
 * Gesundheitsdaten (Art. 9 DSGVO)? Diese Vorgänge werden im Supabase-Modus nie in die Offline-Warteschlange gelegt.
 * Pläne zählen dazu, wenn sie auf dem Gesundheits-Check beruhen (uses_health_data, PLAN-PHASE-3 Abschnitt 9).
 */
export function isSensitiveOp(op: WriteOp): boolean {
  switch (op.kind) {
    case 'upsert_body_metrics':
    case 'upsert_body_measurements':
    case 'insert_health_screening':
    case 'upsert_weight_goal':
    case 'delete_weight_goal':
      return true;
    case 'replace_food_preferences':
      return op.scope === 'intolerance';
    case 'save_training_plan':
      return op.payload.uses_health_data;
    case 'append_plan_block':
    case 'update_planned_session':
    case 'swap_planned_sessions':
    case 'set_shopping_item_checked':
    case 'set_cook_day_start':
      return op.usesHealthData;
    case 'upsert_food_log_favorite':
      return op.row.source === 'quick';
    case 'delete_food_log_favorite':
      return op.favKey.startsWith('quick|');
    default:
      return false;
  }
}

/**
 * Braucht der Vorgang eine gültige Einwilligung health_data (wie die RLS-Regeln bzw. Funktionen der Datenbank)?
 * Verschieben und Tauschen nicht – Trigger bzw. swap_planned_sessions prüfen nur Datum und Status; Speichern und Folgeblock prüfen
 * Gesundheitsbezug und Einwilligung selbst (local-rules.ts).
 */
export function needsHealthConsent(op: WriteOp): boolean {
  return (
    isSensitiveOp(op) &&
    op.kind !== 'update_planned_session' &&
    op.kind !== 'swap_planned_sessions' &&
    // Abhaken, Kochtag-Start und Entfernen eines Favoriten ändern nur Vorhandenes bzw. löschen (Recht auf Löschung).
    op.kind !== 'set_shopping_item_checked' &&
    op.kind !== 'set_cook_day_start' &&
    op.kind !== 'delete_food_log_favorite' &&
    op.kind !== 'delete_weight_goal'
  );
}

/**
 * Muss sofort gesendet werden (nicht über die Warteschlange)? Gesundheitsdaten, Einwilligungen (eine Einwilligung
 * muss in der Datenbank stehen, bevor Gesundheitsdaten gespeichert werden dürfen) sowie neue Pläne und
 * Folgeblöcke (die Datenbank prüft beim Speichern Vorlagen, Gesundheitsbezug und Datumsrahmen).
 */
export function isDirectOp(op: WriteOp): boolean {
  return (
    isSensitiveOp(op) ||
    op.kind === 'grant_consent' ||
    op.kind === 'save_training_plan' ||
    op.kind === 'append_plan_block' ||
    op.kind === 'swap_planned_sessions'
  );
}

export interface ApplyContext {
  /** Zeitstempel (ISO) für erteilte Einwilligungen und Gesundheits-Checks. */
  now: string;
  /** Erzeugt IDs für neue Zeilen. */
  newId: () => string;
  /** Flags des Gesundheits-Checks – berechnet wie der Datenbank-Trigger (evaluateHealthScreening). */
  flagsFor: (answers: HealthScreeningInsert['answers']) => string[];
  /** „Heute“ in Europe/Berlin (Stichtag wie private.berlin_today()); Standard: aus `now`. */
  today?: string;
}

/**
 * Wendet Schreib-Vorgänge auf ein Abbild der Nutzer-Zeilen an (ohne Regelprüfung – die macht der Aufrufer).
 * Verhält sich wie die Upserts in Supabase: gleiche Schlüssel (user_id bzw. user_id + measured_on) werden
 * überschrieben, „replace“ ersetzt alle Zeilen des Bereichs.
 */
export function applyWriteOps(
  rows: UserRows,
  ops: readonly WriteOp[],
  ctx: ApplyContext,
): UserRows {
  let next: UserRows = { ...rows };
  for (const op of ops) {
    next = applyOne(next, op, ctx);
  }
  return next;
}

function applyOne(rows: UserRows, op: WriteOp, ctx: ApplyContext): UserRows {
  switch (op.kind) {
    case 'update_profile':
      return rows.profile ? { ...rows, profile: { ...rows.profile, ...op.patch } } : rows;
    case 'grant_consent': {
      const alreadyActive = rows.consents.some(
        (c) =>
          c.consent_type === op.consentType && c.version === op.version && c.revoked_at === null,
      );
      if (alreadyActive || !rows.profile) {
        return rows;
      }
      return {
        ...rows,
        consents: [
          ...rows.consents,
          {
            id: ctx.newId(),
            user_id: rows.profile.user_id,
            consent_type: op.consentType,
            version: op.version,
            granted_at: ctx.now,
            revoked_at: null,
            platform: op.platform,
          },
        ],
      };
    }
    case 'upsert_goals':
      return {
        ...rows,
        goals: op.row,
        // Wie der Datenbank-Trigger goals_drop_weight_goal (Wächter S13): ohne Abnehmen kein Wunschgewicht.
        weightGoal:
          op.row.goal_type === 'fat_loss' || op.row.secondary_goal_type === 'fat_loss'
            ? rows.weightGoal
            : null,
      };
    case 'upsert_weight_goal':
      return { ...rows, weightGoal: op.row };
    case 'delete_weight_goal':
      return { ...rows, weightGoal: null };
    case 'replace_training_slots':
      return { ...rows, trainingSlots: [...op.rows] };
    case 'replace_user_equipment':
      return {
        ...rows,
        userEquipment: [
          ...rows.userEquipment.filter((row) => row.location !== op.location),
          ...op.rows,
        ],
      };
    case 'upsert_nutrition_prefs':
      return { ...rows, nutritionPrefs: op.row };
    case 'upsert_nutrition_setup':
      return { ...rows, nutritionSetup: op.row };
    case 'replace_food_preferences': {
      const kinds = kindsForScope(op.scope);
      return {
        ...rows,
        foodPreferences: [
          ...rows.foodPreferences.filter((row) => !kinds.includes(row.kind)),
          ...op.rows,
        ],
      };
    }
    case 'upsert_body_metrics': {
      const existing = rows.bodyMetrics.find((r) => r.measured_on === op.row.measured_on);
      const row = { ...op.row, id: existing?.id ?? ctx.newId() };
      return {
        ...rows,
        bodyMetrics: [...rows.bodyMetrics.filter((r) => r.measured_on !== op.row.measured_on), row],
      };
    }
    case 'upsert_body_measurements': {
      const existing = rows.bodyMeasurements.find((r) => r.measured_on === op.row.measured_on);
      const row = { ...op.row, id: existing?.id ?? ctx.newId() };
      return {
        ...rows,
        bodyMeasurements: [
          ...rows.bodyMeasurements.filter((r) => r.measured_on !== op.row.measured_on),
          row,
        ],
      };
    }
    case 'insert_health_screening':
      return {
        ...rows,
        healthScreenings: [
          ...rows.healthScreenings,
          {
            id: ctx.newId(),
            user_id: op.row.user_id,
            answers: op.row.answers,
            flags: ctx.flagsFor(op.row.answers),
            medical_notice_acknowledged_at: op.row.medical_notice_acknowledged_at,
            created_at: ctx.now,
          },
        ],
      };
    case 'upsert_measurement_reminder':
      return { ...rows, reminder: op.row };
    case 'save_training_plan':
      return applySavePlan(rows, op.payload, ctx);
    case 'append_plan_block':
      return insertSessions(rows, op.planId, op.sessions, ctx);
    case 'set_exercise_start_weight': {
      const others = rows.startWeights.filter((row) => row.exercise_id !== op.exerciseId);
      return {
        ...rows,
        startWeights:
          op.weightKg === null
            ? others
            : [
                ...others,
                {
                  user_id: rows.profile?.user_id ?? '',
                  exercise_id: op.exerciseId,
                  weight_kg: op.weightKg,
                  updated_at: ctx.now,
                },
              ],
      };
    }
    case 'upsert_exercise_preference':
      return {
        ...rows,
        exercisePreferences: [
          ...rows.exercisePreferences.filter(
            (p) => !(p.exercise_id === op.row.exercise_id && p.location === op.row.location),
          ),
          op.row,
        ],
      };
    case 'delete_exercise_preference':
      return {
        ...rows,
        exercisePreferences: rows.exercisePreferences.filter(
          (p) => !(p.exercise_id === op.exerciseId && p.location === op.location),
        ),
      };
    case 'update_planned_session':
      return {
        ...rows,
        plannedSessions: rows.plannedSessions.map((s) =>
          s.id === op.sessionId
            ? {
                ...s,
                status: op.status,
                // Wie der Trigger: Ursprungstag nur beim ERSTEN Verschieben setzen.
                original_date:
                  op.scheduledOn !== s.scheduled_on
                    ? (s.original_date ?? s.scheduled_on)
                    : s.original_date,
                scheduled_on: op.scheduledOn,
              }
            : s,
        ),
      };
    case 'set_shopping_item_checked':
      return {
        ...rows,
        shoppingLists: rows.shoppingLists.map((row) =>
          row.id === op.listId
            ? {
                ...row,
                list: {
                  ...row.list,
                  items: row.list.items.map((item) =>
                    item.itemKey === op.itemKey ? { ...item, checked: op.checked } : item,
                  ),
                },
              }
            : row,
        ),
      };
    case 'set_cook_day_start':
      return {
        ...rows,
        mealPlans: rows.mealPlans.map((row) =>
          row.id === op.planId ? { ...row, cook_day_started_at: op.startedAt } : row,
        ),
      };
    case 'upsert_food_log_favorite':
      return {
        ...rows,
        foodLogFavorites: [
          ...rows.foodLogFavorites.filter((f) => f.fav_key !== op.row.fav_key),
          op.row,
        ],
      };
    case 'delete_food_log_favorite':
      return {
        ...rows,
        foodLogFavorites: rows.foodLogFavorites.filter((f) => f.fav_key !== op.favKey),
      };
    case 'swap_planned_sessions': {
      // Wie swap_planned_sessions: Tage tauschen, Ursprungstag nur beim ERSTEN Verschieben setzen.
      const a = rows.plannedSessions.find((s) => s.id === op.sessionId);
      const b = rows.plannedSessions.find((s) => s.id === op.otherSessionId);
      if (!a || !b) return rows;
      return {
        ...rows,
        plannedSessions: rows.plannedSessions.map((s) =>
          s.id === a.id
            ? {
                ...s,
                scheduled_on: b.scheduled_on,
                original_date: a.original_date ?? a.scheduled_on,
              }
            : s.id === b.id
              ? {
                  ...s,
                  scheduled_on: a.scheduled_on,
                  original_date: b.original_date ?? b.scheduled_on,
                }
              : s,
        ),
      };
    }
  }
}

function todayOf(ctx: ApplyContext): string {
  return ctx.today ?? isoDateInTimeZone(ctx.now);
}

function insertSessions(
  rows: UserRows,
  planId: string,
  sessions: readonly SavePlanSession[],
  ctx: ApplyContext,
): UserRows {
  const userId = rows.profile?.user_id ?? '';
  const newSessions: PlannedSessionRow[] = [];
  const newExercises: PlannedExerciseRow[] = [];
  for (const s of sessions) {
    const id = ctx.newId();
    newSessions.push({
      id,
      plan_id: planId,
      user_id: userId,
      block_no: s.block_no,
      week_no: s.week_no,
      is_intro_week: s.is_intro_week,
      is_deload: s.is_deload,
      kind: s.kind as PlannedSessionRow['kind'],
      template_day_index: s.template_day_index,
      scheduled_on: s.scheduled_on,
      original_date: null,
      status: 'planned',
      name_de: s.name_de,
      focus: s.focus as PlannedSessionRow['focus'],
      endurance_modality: s.endurance_modality as PlannedSessionRow['endurance_modality'],
      effort_target: s.effort_target,
      estimated_minutes: s.estimated_minutes,
      warmup_de: s.warmup_de,
      cooldown_de: s.cooldown_de,
      // Wettkampfplan (Phase 10 WP3) – ohne Wettkampf null wie in der Datenbank.
      workout_type: (s.workout_type ?? null) as PlannedSessionRow['workout_type'],
      training_phase: (s.training_phase ?? null) as PlannedSessionRow['training_phase'],
      workout_steps:
        s.workout_steps === undefined || s.workout_steps === null
          ? null
          : s.workout_steps.map((st) => ({ ...st })),
      target_distance_m: s.target_distance_m ?? null,
    });
    for (const e of s.exercises) {
      newExercises.push({ ...e, id: ctx.newId(), session_id: id, user_id: userId });
    }
  }
  return {
    ...rows,
    plannedSessions: [...rows.plannedSessions, ...newSessions],
    plannedExercises: [...rows.plannedExercises, ...newExercises],
  };
}

/**
 * Wie public.save_training_plan (Testmodus; geprüft vorher in local-rules.ts): bisherigen aktiven Plan ersetzen,
 * dessen geplante Einheiten ab gestern löschen, neuen Plan anlegen, ersetzte Pläne ohne Einheiten jenseits der
 * neuesten 20 aufräumen.
 */
function applySavePlan(rows: UserRows, payload: SavePlanPayload, ctx: ApplyContext): UserRows {
  const yesterday = addDays(todayOf(ctx), -1);
  const old = rows.plans.find((p) => p.status === 'active');
  let sessions = rows.plannedSessions;
  if (old) {
    sessions = sessions.filter(
      (s) => !(s.plan_id === old.id && s.status === 'planned' && s.scheduled_on >= yesterday),
    );
  }
  const plans: UserPlanRow[] = rows.plans.map((p) =>
    p.id === old?.id ? { ...p, status: 'replaced', replaced_at: ctx.now } : p,
  );
  const planId = ctx.newId();
  plans.push({
    id: planId,
    user_id: rows.profile?.user_id ?? '',
    status: 'active',
    template_id: payload.template_id,
    template_title_de: payload.template_title_de,
    template_version: payload.template_version,
    engine_version: payload.engine_version,
    match_quality: payload.match_quality as UserPlanRow['match_quality'],
    notes: [...payload.notes] as UserPlanRow['notes'],
    uses_health_data: payload.uses_health_data,
    medical_notice: payload.medical_notice,
    inputs: payload.inputs as unknown as UserPlanRow['inputs'],
    start_date: payload.start_date,
    created_at: ctx.now,
    replaced_at: null,
  });
  const keptSessions = new Set(sessions.map((s) => s.id));
  const withSessions = new Set(sessions.map((s) => s.plan_id));
  const replacedOrder = plans
    .filter((p) => p.status === 'replaced')
    .sort((a, b) => (b.replaced_at ?? '').localeCompare(a.replaced_at ?? ''))
    .map((p) => p.id);
  const keepReplaced = new Set(replacedOrder.slice(0, PLAN_SAVE_LIMITS.keptReplacedPlans));
  const remainingPlans = plans.filter(
    (p) => p.status !== 'replaced' || withSessions.has(p.id) || keepReplaced.has(p.id),
  );
  // Gelöschte Einheiten/Übungen: Tagebuch-Einträge bleiben, nur der Verweis wird leer (on delete set null, B2).
  const next: UserRows = detachLogs({
    ...rows,
    plans: remainingPlans,
    plannedSessions: sessions,
    plannedExercises: rows.plannedExercises.filter((e) => keptSessions.has(e.session_id)),
  });
  return insertSessions(next, planId, payload.sessions, ctx);
}

/** Pläne mit Gesundheitsbezug samt Einheiten und Übungen (für den geschützten Zwischenspeicher). */
export interface PlanRows {
  plans: UserPlanRow[];
  plannedSessions: PlannedSessionRow[];
  plannedExercises: PlannedExerciseRow[];
}

/** Teilt die Plan-Zeilen nach uses_health_data (Pläne mit Gesundheitsbezug = Gesundheitsdaten). */
function splitPlans(rows: PlanRows): { health: PlanRows; other: PlanRows } {
  const healthIds = new Set(rows.plans.filter((p) => p.uses_health_data).map((p) => p.id));
  const healthSessions = new Set(
    rows.plannedSessions.filter((s) => healthIds.has(s.plan_id)).map((s) => s.id),
  );
  return {
    health: {
      plans: rows.plans.filter((p) => healthIds.has(p.id)),
      plannedSessions: rows.plannedSessions.filter((s) => healthSessions.has(s.id)),
      plannedExercises: rows.plannedExercises.filter((e) => healthSessions.has(e.session_id)),
    },
    other: {
      plans: rows.plans.filter((p) => !healthIds.has(p.id)),
      plannedSessions: rows.plannedSessions.filter((s) => !healthSessions.has(s.id)),
      plannedExercises: rows.plannedExercises.filter((e) => !healthSessions.has(e.session_id)),
    },
  };
}

/**
 * Widerruf von health_data – spiegelt den Datenbank-Trigger private.consents_after_revoke(): löscht Körperdaten,
 * Umfänge, alle Gesundheits-Checks, das Wunschgewicht (Etappe Z3), Unverträglichkeiten und ALLE Pläne mit uses_health_data (aktiv und ersetzt)
 * samt allen Einheiten und Übungen sowie alle Essenspläne mit uses_health_data (Etappe N5). Pläne ohne Gesundheitsbezug bleiben unverändert (PLAN-PHASE-3 8.2/9).
 */
export function applyHealthDataRevocation(
  rows: UserRows,
  options: {
    deleteLogs?: boolean;
    /**
     * Widerruf mit Umwandlung (docs/PLAN-PHASE-5.md 7.4, R2-K4): NUR bei aktiver Zustimmung gesetzt – die vorher
     * eingelesenen Gruppen der Unverträglichkeiten werden im selben Schritt als „mag ich nicht“ geschrieben (ein „mag
     * ich“ derselben Gruppe wird ersetzt). Ohne Zustimmung: undefined, es wird nichts übernommen.
     */
    dislikeGroups?: readonly FoodGroupId[];
  } = {},
): UserRows {
  // Tagebuch (PLAN-PHASE-4 S1, R3): Einträge aus Gesundheits-Plänen auf Wunsch löschen, sonst neutralisieren –
  // VOR dem Löschen der Pläne; danach werden nur die Verweise leer (on delete set null, B2).
  const logs = neutralizeHealthPlanLogRows(
    options.deleteLogs ? deleteHealthPlanLogRows(rows) : rows,
  );
  const { other } = splitPlans(logs);
  return detachLogs({
    ...logs,
    bodyMetrics: [],
    bodyMeasurements: [],
    healthScreenings: [],
    // Wunschgewicht (Etappe Z3) – wie consents_after_revoke.
    weightGoal: null,
    foodPreferences: revokedFoodPreferences(
      rows.foodPreferences,
      options.dislikeGroups,
      rows.profile?.user_id ?? '',
    ),
    // Essenspläne mit Gesundheitsbezug (Etappe N5, docs/PLAN-PHASE-5.md 7.3/7.4) – wie meal_plans ab N7.
    mealPlans: rows.mealPlans.filter((plan) => !plan.uses_health_data),
    // Einkaufslisten mit Gesundheitsbezug samt eigener Einträge (Etappe N5b, 7.3/7.4, K10) – wie shopping_lists ab N7.
    shoppingLists: rows.shoppingLists.filter((list) => !list.uses_health_data),
    // Ernährungstagebuch (Etappe E1, A-G12): alle Einträge; Schnell-Favoriten (Bezeichnung + kcal) gehen mit
    // (Wächter E1 G1), Katalog-/Rezept-Favoriten bleiben (A-G14) – wie consents_after_revoke.
    foodLogEntries: [],
    foodLogFavorites: rows.foodLogFavorites.filter((f) => f.source !== 'quick'),
    // Eigene Gerichte (Etappe E2): Name = Freitext, Werte selbst eingegeben – sichere Voreinstellung wie die
    // Schnell-Favoriten: gelöscht, samt Zutaten (wie consents_after_revoke).
    customMeals: [],
    customMealItems: [],
    ...other,
  });
}

/**
 * Vorlieben nach dem Widerruf: Unverträglichkeiten gelöscht; mit Umwandlung (`dislikeGroups`) zusätzlich die Gruppen
 * als „mag ich nicht“ (Regel aus packages/core, tastePreferencesAfterConversion).
 */
function revokedFoodPreferences(
  rows: readonly FoodPreferenceRow[],
  dislikeGroups: readonly FoodGroupId[] | undefined,
  userId: string,
): FoodPreferenceRow[] {
  const taste = rows.filter((row) => row.kind !== 'intolerance');
  if (dislikeGroups === undefined || dislikeGroups.length === 0) return taste;
  return tastePreferencesAfterConversion(
    taste.map((row) => ({ foodGroup: row.food_group as FoodGroupId, kind: row.kind })),
    dislikeGroups,
  ).map((pref) => ({ user_id: userId, food_group: pref.foodGroup, kind: pref.kind }));
}

export interface CacheableRows {
  /** Für den normalen Zwischenspeicher (AsyncStorage/localStorage): ohne jede Gesundheitsangabe. */
  rows: UserRows;
  /**
   * Pläne mit Gesundheitsbezug – nur mit `allowHealthPlanCache` (Gründer-Entscheidung Frage 14) und dann NUR für
   * den geschützten Zwischenspeicher (verschlüsselt bzw. im Browser sessionStorage). Sonst null.
   */
  healthPlans: PlanRows | null;
  /** Tagebuch-Zeilen – NUR für den geschützten Tagebuch-Zwischenspeicher `logCache` (S4, 4.6). */
  logs: LogRows;
}

/**
 * Was im Supabase-Modus auf das Gerät darf (PLAN-PHASE-3 Abschnitt 9): nie Körperdaten, Umfänge, Checks,
 * Unverträglichkeiten; Pläne mit Gesundheitsbezug nur getrennt für den geschützten Zwischenspeicher; Ernährungs-Zeilen
 * des Kontos nie im normalen Zwischenspeicher (N7 Teil 2, eigener geschützter Speicher).
 */
export function cacheableRows(
  rows: UserRows,
  options: { allowHealthPlanCache: boolean },
): CacheableRows {
  const { health, other } = splitPlans(rows);
  return {
    rows: {
      ...rows,
      bodyMetrics: [],
      bodyMeasurements: [],
      healthScreenings: [],
      // Wunschgewicht (Etappe Z3): Gesundheitsdatum, nie im normalen Zwischenspeicher.
      weightGoal: null,
      foodPreferences: rows.foodPreferences.filter((row) => row.kind !== 'intolerance'),
      ...other,
      // Tagebuch nie im normalen Zwischenspeicher (S4) – nur getrennt im geschützten logCache.
      ...EMPTY_LOG_ROWS,
      // Ernährung (Etappe N7 Teil 2): Essenspläne/Listen (teils mit Gesundheitsbezug), Ernährungstagebuch, eigene
      // Gerichte und Favoriten (Schnell-Favoriten mit kcal) nur im geschützten Speicher `nutritionCache`.
      mealPlans: [],
      shoppingLists: [],
      foodLogEntries: [],
      foodLogFavorites: [],
      customMeals: [],
      customMealItems: [],
    },
    healthPlans: options.allowHealthPlanCache && health.plans.length > 0 ? health : null,
    logs: logRowsOf(rows),
  };
}
