import {
  addDays,
  isoDateInTimeZone,
  PLAN_SAVE_LIMITS,
  type ConsentPlatform,
  type ConsentType,
  type FoodPreferenceKind,
  type SavePlanPayload,
  type SavePlanSession,
} from '@fitnessapp/core';
import type { TablesInsert, TablesUpdate } from '@fitnessapp/db';

import type {
  BodyMeasurementsRow,
  BodyMetricsRow,
  FoodPreferenceRow,
  GoalsRow,
  MeasurementReminderRow,
  NutritionPrefsRow,
  PlannedExerciseRow,
  PlannedSessionRow,
  TrainingSlotRow,
  UserEquipmentRow,
  UserPlanRow,
  UserRows,
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
  | { kind: 'replace_food_preferences'; scope: FoodPreferenceScope; rows: FoodPreferenceRow[] }
  | { kind: 'upsert_body_metrics'; row: BodyMetricsInsert }
  | { kind: 'upsert_body_measurements'; row: BodyMeasurementsInsert }
  | { kind: 'insert_health_screening'; row: HealthScreeningInsert }
  | { kind: 'upsert_measurement_reminder'; row: MeasurementReminderRow }
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
    };

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
      return true;
    case 'replace_food_preferences':
      return op.scope === 'intolerance';
    case 'save_training_plan':
      return op.payload.uses_health_data;
    case 'append_plan_block':
    case 'update_planned_session':
      return op.usesHealthData;
    default:
      return false;
  }
}

/**
 * Braucht der Vorgang eine gültige Einwilligung health_data (wie die RLS-Regeln bzw. Funktionen der Datenbank)?
 * Verschieben einer Einheit nicht – der Trigger prüft nur Datum und Status; Speichern und Folgeblock prüfen
 * Gesundheitsbezug und Einwilligung selbst (local-rules.ts).
 */
export function needsHealthConsent(op: WriteOp): boolean {
  return isSensitiveOp(op) && op.kind !== 'update_planned_session';
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
    op.kind === 'append_plan_block'
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
      return { ...rows, goals: op.row };
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
  const next: UserRows = {
    ...rows,
    plans: remainingPlans,
    plannedSessions: sessions,
    plannedExercises: rows.plannedExercises.filter((e) => keptSessions.has(e.session_id)),
  };
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
 * Umfänge, alle Gesundheits-Checks, Unverträglichkeiten und ALLE Pläne mit uses_health_data (aktiv und ersetzt)
 * samt allen Einheiten und Übungen. Pläne ohne Gesundheitsbezug bleiben unverändert (PLAN-PHASE-3 8.2/9).
 */
export function applyHealthDataRevocation(rows: UserRows): UserRows {
  const { other } = splitPlans(rows);
  return {
    ...rows,
    bodyMetrics: [],
    bodyMeasurements: [],
    healthScreenings: [],
    foodPreferences: rows.foodPreferences.filter((row) => row.kind !== 'intolerance'),
    ...other,
  };
}

export interface CacheableRows {
  /** Für den normalen Zwischenspeicher (AsyncStorage/localStorage): ohne jede Gesundheitsangabe. */
  rows: UserRows;
  /**
   * Pläne mit Gesundheitsbezug – nur mit `allowHealthPlanCache` (Gründer-Entscheidung Frage 14) und dann NUR für
   * den geschützten Zwischenspeicher (verschlüsselt bzw. im Browser sessionStorage). Sonst null.
   */
  healthPlans: PlanRows | null;
}

/**
 * Was im Supabase-Modus auf das Gerät darf (PLAN-PHASE-3 Abschnitt 9): nie Körperdaten, Umfänge, Checks,
 * Unverträglichkeiten; Pläne mit Gesundheitsbezug nur getrennt für den geschützten Zwischenspeicher.
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
      foodPreferences: rows.foodPreferences.filter((row) => row.kind !== 'intolerance'),
      ...other,
    },
    healthPlans: options.allowHealthPlanCache && health.plans.length > 0 ? health : null,
  };
}
