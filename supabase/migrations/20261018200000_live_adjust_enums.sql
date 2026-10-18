-- Phase 4b · Etappe B · Live-Anpassung des Plans (docs/PLAN-PHASE-4B.md 4.3): neue Enums in eigener Datei VOR ihrer
-- Verwendung (Muster Phase 4). Werte = packages/core/src/adjust/types.ts (ADJUSTMENT_TRIGGERS, ADJUSTMENT_RULES,
-- ADJUSTMENT_KINDS, ADJUSTMENT_STATUSES), abgeglichen in db-sync.test.ts. Nur additiv.

-- Auslöser einer Neuberechnung. Reserviert (noch ohne Schreibweg): wearable_data (Phase 8), competition_date_changed
-- (Phase 10).
create type public.adjustment_trigger as enum (
  'session_logged',
  'session_missed',
  'measurement_updated',
  'goal_changed',
  'slots_changed',
  'manual_recheck',
  'wearable_data',
  'competition_date_changed'
);

-- Regeln R1–R5 (aktiv) und reservierte Regeln (calorie_adjust, muscle_gain_volume, readiness_lighter – in 4b NICHT
-- aktiv; apply_plan_adjustments lehnt sie ab).
create type public.adjustment_rule as enum (
  'fast_increase',
  'load_reduce',
  'volume_reduce',
  'deload_forward',
  'endurance_reduce',
  'stagnation_variation',
  'fewer_days',
  'calorie_adjust',
  'muscle_gain_volume',
  'readiness_lighter'
);

-- Art der Wirkung (Plan 4.2).
create type public.adjustment_kind as enum ('state_override', 'plan_change', 'proposal');

-- Status einer Anpassung.
create type public.adjustment_status as enum (
  'applied',
  'pending_confirmation',
  'confirmed',
  'declined',
  'expired',
  'reverted',
  'superseded'
);
