import type { WearableConnectionStatus, WearableProvider } from '../enums';
import type { WearableDataType, WearableOrigin } from './schema';

/**
 * Zeilen der Smartwatch-Tabellen (Phase 8, 20261021120100_wearables.sql) – gleiche Spalten wie die Datenbank, Werte-
 * Listen enger (Prüfung zur Übersetzungszeit in apps/mobile/src/data/row-types.test.ts).
 */

export interface WearableConnectionRow {
  user_id: string;
  provider: WearableProvider;
  status: WearableConnectionStatus;
  granted_types: WearableDataType[];
  connected_at: string;
  last_sync_at: string | null;
  last_sync_count: number | null;
  updated_at: string;
}

export interface WearableSessionRow {
  session_log_id: string;
  user_id: string;
  provider: WearableProvider;
  external_id: string;
  origin: WearableOrigin;
  started_at: string;
  finished_at: string;
  kcal: number | null;
  merged: boolean;
  duplicate_of: string | null;
  imported_at: string;
  updated_at: string;
}

export interface HeartRateSummaryRow {
  session_log_id: string;
  user_id: string;
  avg_bpm: number;
  max_bpm: number;
  zone_s: number[];
  hf_max_used: number;
  updated_at: string;
}

export interface DailyMetricRow {
  user_id: string;
  day: string;
  provider: WearableProvider;
  resting_hr_bpm: number | null;
  sleep_min: number | null;
  steps: number | null;
  updated_at: string;
}

/** Alle Smartwatch-Zeilen des Kontos (Anzeige in der App). */
export interface WearableRows {
  connection: WearableConnectionRow | null;
  sessions: WearableSessionRow[];
  heartRates: HeartRateSummaryRow[];
  dailyMetrics: DailyMetricRow[];
}

export const EMPTY_WEARABLE_ROWS: WearableRows = {
  connection: null,
  sessions: [],
  heartRates: [],
  dailyMetrics: [],
};

/**
 * Anteil je Pulszone (0–1) an der gezählten Zeit – für die Zonen-Balken. Ohne gezählte Zeit alles 0.
 */
export function zoneShares(zoneS: readonly number[]): number[] {
  const total = zoneS.reduce((sum, s) => sum + Math.max(0, s), 0);
  return zoneS.map((s) => (total > 0 ? Math.max(0, s) / total : 0));
}
