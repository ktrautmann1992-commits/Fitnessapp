import { z } from 'zod';

import type { Exercise } from '../content/schemas';
import {
  type EquipmentLocation,
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
  PLANNED_SESSION_KINDS,
  type PlannedSessionKind,
  SESSION_LOG_STATUSES,
  type SessionLogStatus,
} from '../enums';
import { logEntriesFromRows, type LogRows, type SessionLogRow } from '../log/rows';
import type { ExerciseLogEntry, ProgressionContext } from '../log/types';
import type { EquipmentProfile } from '../plan/equipment-profile';
import type { PlanSafetyRules } from '../plan/safety';
import type { StoredSession } from '../plan/view';
import { storedAdjustmentSchema } from './schemas';
import type { StoredAdjustment } from './types';

/**
 * Eingaben der Live-Anpassung (docs/PLAN-PHASE-4B.md 5.1). Dieselben Eingaben für App (Testmodus, Etappe D) und Server
 * (API-Route, Etappe C); die Tagebuch-Abbildung kommt aus `log/rows.ts` (A0). Körperdaten liest in 4b keine aktive
 * Regel – `healthConsentValid` ist für spätere Regeln Pflicht (KONZEPT 4.1).
 */

/** Eine Einheit im Tagebuch (session_logs) – was die Regeln davon brauchen. */
export interface LiveSessionLog {
  readonly id: string;
  readonly plannedSessionId: string | null;
  readonly kind: PlannedSessionKind;
  readonly performedOn: string;
  /** Reihenfolge innerhalb eines Tages (finished_at bzw. client_updated_at). */
  readonly loggedAt: string;
  readonly status: SessionLogStatus;
  /** Belastungsempfinden der Einheit (Kraft) bzw. Anstrengung (Ausdauer), 0–10; null = ohne Angabe. */
  readonly sessionRpe: number | null;
  readonly isIntroWeek: boolean;
  readonly isDeload: boolean;
  readonly isFree: boolean;
}

/** Übungs-Eintrag samt Einheit (für `basis_session_log_id`). */
export type LiveExerciseEntry = ExerciseLogEntry & { readonly sessionLogId: string };

export interface LiveAdjustmentInputs {
  readonly today: string;
  /** Premium (serverseitig geprüft bzw. Testmodus „Premium simulieren“). false → nie eine Anpassung. */
  readonly entitled: boolean;
  readonly healthConsentValid: boolean;
  readonly person: { readonly birthDate: string };
  readonly plan: {
    readonly id: string;
    readonly startDate: string;
    readonly experienceLevel: ExperienceLevel;
    /** Plan mit Gesundheits-Check (user_plans.uses_health_data) → Anpassungen sind mittelbar Gesundheitsdaten. */
    readonly fromHealthPlan: boolean;
    readonly sessions: readonly StoredSession[];
  };
  /** AKTUELLE Sicherheitsregeln (strengste gilt; Anzeige wendet sie zusätzlich zuletzt an). */
  readonly rules: PlanSafetyRules;
  readonly sessionLogs: readonly LiveSessionLog[];
  readonly exerciseEntries: readonly LiveExerciseEntry[];
  /** Progressions-Kontext je Übung (aktueller Plan, Stufen am Ort der nächsten Einheit). */
  readonly contexts: Readonly<Record<string, ProgressionContext>>;
  readonly adjustments: readonly StoredAdjustment[];
  /** Ort je Kraft-Einheit (ID); fehlt er, muss ein Tausch an JEDEM bekannten Ort machbar sein. */
  readonly sessionLocations?: Readonly<Record<string, EquipmentLocation>>;
}

/** Nicht als JSON übertragbar: Bibliothek und Geräte-Profile (laden App bzw. Route selbst). */
export interface LiveAdjustmentEnvironment {
  readonly library: ReadonlyMap<string, Exercise>;
  readonly profiles: ReadonlyMap<EquipmentLocation, Pick<EquipmentProfile, 'available'>>;
}

const isoDate = z.iso.date();

/** Zod an der Grenze der API-Route (Etappe C): Aufbau und Wertebereiche; Einheiten/Einträge locker (Zusatzfelder bleiben). */
export const liveAdjustmentInputsSchema = z.strictObject({
  today: isoDate,
  entitled: z.boolean(),
  healthConsentValid: z.boolean(),
  person: z.strictObject({ birthDate: isoDate }),
  plan: z.strictObject({
    id: z.string().min(1),
    startDate: isoDate,
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    fromHealthPlan: z.boolean(),
    sessions: z
      .array(
        z.looseObject({
          id: z.string().min(1),
          block_no: z.number().int().min(1),
          week_no: z.number().int().min(0),
          is_deload: z.boolean(),
          is_intro_week: z.boolean(),
          kind: z.enum(PLANNED_SESSION_KINDS),
          scheduled_on: isoDate,
          status: z.enum(['planned', 'skipped', 'completed']),
          estimated_minutes: z.number().int().min(1),
          exercises: z.array(
            z.looseObject({
              order_no: z.number().int(),
              exercise_id: z.string(),
              sets: z.number().int(),
              rpe_target: z.number(),
            }),
          ),
        }),
      )
      .max(500),
  }),
  rules: z.looseObject({ rpeMax: z.number(), cautious: z.boolean() }),
  sessionLogs: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        plannedSessionId: z.string().nullable(),
        kind: z.enum(PLANNED_SESSION_KINDS),
        performedOn: isoDate,
        loggedAt: z.string().min(1),
        status: z.enum(SESSION_LOG_STATUSES),
        sessionRpe: z.number().min(0).max(10).nullable(),
        isIntroWeek: z.boolean(),
        isDeload: z.boolean(),
        isFree: z.boolean(),
      }),
    )
    .max(1000),
  exerciseEntries: z
    .array(z.looseObject({ sessionLogId: z.string().min(1), exerciseId: z.string().min(1) }))
    .max(5000),
  contexts: z.record(z.string(), z.looseObject({ loadType: z.string(), templateSets: z.number() })),
  adjustments: z.array(storedAdjustmentSchema).max(1000),
  sessionLocations: z.record(z.string(), z.enum(['gym', 'home'])).optional(),
});

/** session_logs-Zeilen → LiveSessionLog (gleiche Reihenfolge-Regel wie logEntriesFromRows). */
export function liveSessionLogsFromRows(rows: readonly SessionLogRow[]): LiveSessionLog[] {
  return rows.map((l) => ({
    id: l.id,
    plannedSessionId: l.planned_session_id,
    kind: l.kind,
    performedOn: l.performed_on,
    loggedAt: l.finished_at ?? l.client_updated_at,
    status: l.status,
    sessionRpe: l.session_rpe,
    isIntroWeek: l.is_intro_week,
    isDeload: l.is_deload,
    isFree: l.is_free === true,
  }));
}

/** Tagebuch-Zeilen → Übungs-Einträge mit ID der Einheit (Abbildung aus log/rows.ts, A0). */
export function liveEntriesFromRows(
  rows: Pick<LogRows, 'sessionLogs' | 'exerciseLogs' | 'setLogs'>,
): LiveExerciseEntry[] {
  const known = new Set(rows.sessionLogs.map((l) => l.id));
  // logEntriesFromRows bildet genau die Übungs-Zeilen mit bekannter Einheit ab, in derselben Reihenfolge.
  const ids = rows.exerciseLogs
    .filter((e) => known.has(e.session_log_id))
    .map((e) => e.session_log_id);
  return logEntriesFromRows(rows).map((entry, i) => ({ ...entry, sessionLogId: ids[i] as string }));
}
