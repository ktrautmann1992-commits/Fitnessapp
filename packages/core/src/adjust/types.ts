import type { ExerciseProgress } from '../log/types';

/**
 * Typen der Live-Anpassung (docs/PLAN-PHASE-4B.md Abschnitte 4.3, 4.4 und 5). Die Aufzählungen entsprechen den
 * Postgres-Enums, die Etappe B anlegt (Abgleich dann in db-sync.test.ts); bis dahin leben sie hier, damit Etappe A
 * keine Migration braucht.
 */

/** Auslöser einer Neuberechnung. `wearable_data` (Phase 8) und `competition_date_changed` (Phase 10) reserviert. */
export const ADJUSTMENT_TRIGGERS = [
  'session_logged',
  'session_missed',
  'measurement_updated',
  'goal_changed',
  'slots_changed',
  'manual_recheck',
  'wearable_data',
  'competition_date_changed',
] as const;
export type AdjustmentTrigger = (typeof ADJUSTMENT_TRIGGERS)[number];

/** Aktive Regeln R1–R5 (Plan 5.2). */
export const ACTIVE_ADJUSTMENT_RULES = [
  'fast_increase',
  'load_reduce',
  'volume_reduce',
  'deload_forward',
  'endurance_reduce',
  'stagnation_variation',
  'fewer_days',
] as const;
export type ActiveAdjustmentRule = (typeof ACTIVE_ADJUSTMENT_RULES)[number];

/** Reserviert, in 4b NICHT aktiv: Kalorien (Nachtrag nach Phase 5), Muskelaufbau-Volumen, Tagesform (Phase 8). */
export const RESERVED_ADJUSTMENT_RULES = [
  'calorie_adjust',
  'muscle_gain_volume',
  'readiness_lighter',
] as const;

export const ADJUSTMENT_RULES = [...ACTIVE_ADJUSTMENT_RULES, ...RESERVED_ADJUSTMENT_RULES] as const;
export type AdjustmentRule = (typeof ADJUSTMENT_RULES)[number];

export const ADJUSTMENT_KINDS = ['state_override', 'plan_change', 'proposal'] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const ADJUSTMENT_STATUSES = [
  'applied',
  'pending_confirmation',
  'confirmed',
  'declined',
  'expired',
  'reverted',
  'superseded',
] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

/** Vorübergehende Plan-Änderungen (restoreTemporaryChanges, Plan 5.4). Der Tausch (R4) bleibt für den Block. */
export const TEMPORARY_PLAN_RULES = [
  'volume_reduce',
  'endurance_reduce',
  'deload_forward',
] as const;

/** Art der Wirkung je Regel (Plan 4.2). */
export const RULE_KIND: Readonly<Record<ActiveAdjustmentRule, AdjustmentKind>> = {
  fast_increase: 'state_override',
  load_reduce: 'state_override',
  volume_reduce: 'plan_change',
  deload_forward: 'plan_change',
  endurance_reduce: 'plan_change',
  stagnation_variation: 'plan_change',
  fewer_days: 'proposal',
};

/** Geänderte Felder einer geplanten Übung (Schlüssel `order_no`); vorher und nachher mit denselben Schlüsseln. */
export interface ExerciseChange {
  readonly order_no: number;
  readonly sets?: number;
  readonly rpe_target?: number;
  readonly exercise_id?: string;
  readonly exercise_name_de?: string;
}

/** Geänderte Felder einer geplanten Einheit; vorher und nachher mit denselben Schlüsseln. */
export interface SessionChange {
  readonly id: string;
  readonly is_deload?: boolean;
  readonly estimated_minutes?: number;
  /** Nur Wettkampfplan (lockere Art): Schritte passend zur neuen Dauer bzw. Distanz-Richtwert. */
  readonly workout_steps?: readonly {
    readonly part: 'warmup' | 'main' | 'cooldown';
    readonly kind: 'work' | 'easy' | 'rest';
    readonly seconds: number;
    readonly effort: number;
  }[];
  readonly target_distance_m?: number | null;
  readonly exercises?: readonly ExerciseChange[];
}

/** Plan-Änderung (volume_reduce, endurance_reduce, deload_forward, stagnation_variation). */
export interface PlanChange {
  readonly sessions: readonly SessionChange[];
}

/** Vorschlag weniger Trainingstage (R5). */
export interface FewerDaysChange {
  readonly days: number;
  /** ISO-Wochentag, der wegfallen soll (nur `after`). */
  readonly drop_weekday?: number;
}

/** Erklär-Parameter: nur Zahlen, Datumsangaben und Übungs-IDs (kein Freitext, Plan 5.7). */
export type ExplainParams = Readonly<Record<string, number | string>>;

/** Ein Vorschlag der Engine (= Feldliste von apply_plan_adjustments, Plan 4.6). */
export interface AdjustmentProposal {
  readonly rule: ActiveAdjustmentRule;
  readonly kind: AdjustmentKind;
  readonly requiresConfirmation: boolean;
  readonly exerciseId: string | null;
  readonly plannedSessionIds: readonly string[];
  readonly basisSessionLogId: string | null;
  readonly basisPerformedOn: string | null;
  readonly stateBefore: ExerciseProgress | null;
  readonly stateAfter: ExerciseProgress | null;
  readonly changeBefore: PlanChange | FewerDaysChange | null;
  readonly changeAfter: PlanChange | FewerDaysChange | null;
  readonly explainParams: ExplainParams;
  /** Frühestens morgen (Wächter S1). */
  readonly effectiveFrom: string;
  /** Nur bei Vorschlägen (R5). */
  readonly expiresOn: string | null;
  readonly inputFingerprint: string;
  readonly engineVersion: number;
  readonly ruleVersion: number;
  /** In 4b liest keine aktive Regel Körperdaten. */
  readonly usesBodyData: boolean;
  readonly fromHealthPlan: boolean;
}

/** Eine gespeicherte Anpassung (plan_adjustments, camelCase). */
export interface StoredAdjustment extends AdjustmentProposal {
  readonly id: string;
  readonly status: AdjustmentStatus;
  /** ISO-Zeitstempel. */
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

/** Hinweis ohne Plan-Änderung (feste Codes; Texte in der App, Plan 5.5). */
export type AdjustmentHintCode =
  /** R3: Erholungswoche kommt in ≤ 2 Wochen. */
  | 'deload_soon'
  /** R3/R4 Fallback: keine Änderung möglich. */
  | 'rest_this_week'
  /** R5 bei 1 Trainingstag. */
  | 'shorter_sessions'
  /** Mehr als LIVE_ADJUSTMENT.maxAutomaticPerWeek automatische Änderungen. */
  | 'weekly_limit_reached';

export interface AdjustmentHint {
  readonly code: AdjustmentHintCode;
  readonly rule: ActiveAdjustmentRule;
  readonly exerciseId: string | null;
}

export interface LiveAdjustmentResult {
  readonly proposals: readonly AdjustmentProposal[];
  readonly hints: readonly AdjustmentHint[];
}
