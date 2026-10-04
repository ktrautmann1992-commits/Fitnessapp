import type { ConsentPlatform, ConsentType, FoodPreferenceKind } from '@fitnessapp/core';
import type { TablesInsert, TablesUpdate } from '@fitnessapp/db';

import type {
  BodyMeasurementsRow,
  BodyMetricsRow,
  FoodPreferenceRow,
  GoalsRow,
  MeasurementReminderRow,
  NutritionPrefsRow,
  TrainingSlotRow,
  UserEquipmentRow,
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
  | { kind: 'upsert_measurement_reminder'; row: MeasurementReminderRow };

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
 * Gesundheitsdaten (Art. 9 DSGVO)? Diese Vorgänge brauchen die Einwilligung health_data und werden im
 * Supabase-Modus nie in die Offline-Warteschlange gelegt.
 */
export function isSensitiveOp(op: WriteOp): boolean {
  switch (op.kind) {
    case 'upsert_body_metrics':
    case 'upsert_body_measurements':
    case 'insert_health_screening':
      return true;
    case 'replace_food_preferences':
      return op.scope === 'intolerance';
    default:
      return false;
  }
}

/**
 * Muss sofort gesendet werden (nicht über die Warteschlange)? Gesundheitsdaten und Einwilligungen –
 * eine Einwilligung muss in der Datenbank stehen, bevor Gesundheitsdaten gespeichert werden dürfen.
 */
export function isDirectOp(op: WriteOp): boolean {
  return isSensitiveOp(op) || op.kind === 'grant_consent';
}

export interface ApplyContext {
  /** Zeitstempel (ISO) für erteilte Einwilligungen und Gesundheits-Checks. */
  now: string;
  /** Erzeugt IDs für neue Zeilen. */
  newId: () => string;
  /** Flags des Gesundheits-Checks – berechnet wie der Datenbank-Trigger (evaluateHealthScreening). */
  flagsFor: (answers: HealthScreeningInsert['answers']) => string[];
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
  }
}

/**
 * Entfernt alle Gesundheitsdaten – wie der Datenbank-Trigger beim Widerruf von health_data. Ergibt zugleich
 * das, was im Supabase-Modus auf dem Gerät zwischengespeichert werden darf.
 */
export function withoutHealthData(rows: UserRows): UserRows {
  return {
    ...rows,
    bodyMetrics: [],
    bodyMeasurements: [],
    healthScreenings: [],
    foodPreferences: rows.foodPreferences.filter((row) => row.kind !== 'intolerance'),
  };
}
