import {
  ageInYears,
  type DailyMetricRow,
  hasRecoveryData,
  type RecoveryOptions,
  type RecoveryResult,
  recoveryTrend,
  type WearableConnectionRow,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { healthScreeningForPlan } from './training-plan';
import type { UserRows } from './types';

/**
 * „Erholung aus der Uhr“ in der App (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15): setzt die Tageswerte der
 * Uhr (`daily_metrics`), Alter und Gesundheits-Check zusammen und ruft packages/core (recoveryTrend). Nur Zusammensetzen,
 * keine Regeln. Der Status wird nirgends gespeichert oder gesendet (nur Anzeige auf dem Gerät).
 */

export type RecoveryState =
  | { readonly kind: 'loading' }
  /** Keine Verbindung: Browser/iPhone ohne Beispiel-Uhr, Einwilligung fehlt bzw. keine Uhr verbunden. */
  | { readonly kind: 'empty'; readonly reason: 'only_android' | 'no_consent' | 'no_watch' }
  /** Verbunden, aber (noch) kein Schlaf, Ruhepuls oder HRV von der Uhr. */
  | { readonly kind: 'no_data' }
  | {
      readonly kind: 'ready';
      /** Heute (= letzter Eintrag von `trend`). */
      readonly today: RecoveryResult;
      /** 7 Tage, älteste zuerst. */
      readonly trend: readonly RecoveryResult[];
      /** Ruhepuls/HRV zählen nicht (Gesundheits-Check: Medikamente). */
      readonly medication: boolean;
    };

/** Alter (Schlaf-Schwelle unter 18) und Medikamente (Ruhepuls/HRV zählen nicht) aus Profil und Gesundheits-Check. */
export function recoveryOptionsFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
): RecoveryOptions {
  const birth = rows.profile?.birth_date ?? null;
  const flags = healthScreeningForPlan(rows, versions)?.flags ?? [];
  return {
    age: birth ? ageInYears(birth, today) : null,
    ignoreHeartValues: flags.includes('medication'),
  };
}

/** Zustand der Erholung aus Verbindung und Tageswerten (rein, getestet in recovery.test.ts). */
export function recoveryState(input: {
  readonly loading: boolean;
  readonly connection: WearableConnectionRow | null;
  readonly dailyMetrics: readonly DailyMetricRow[];
  /** Plattform ohne Health Connect und ohne Beispiel-Uhr (Browser/iPhone im Supabase-Modus). */
  readonly unsupported: boolean;
  readonly consentsValid: boolean;
  readonly options: RecoveryOptions;
  readonly today: string;
}): RecoveryState {
  if (input.loading) return { kind: 'loading' };
  // Vorhandene Werte (z. B. auf Android übernommen) zeigt auch der Browser – nur ohne Verbindung der Leerzustand.
  if (!input.connection) {
    return {
      kind: 'empty',
      reason: input.unsupported ? 'only_android' : input.consentsValid ? 'no_watch' : 'no_consent',
    };
  }
  // Ältere Zeilen im Gerätespeicher haben noch kein HRV-Feld (vor 25.10.2026) → als „kein Wert“ lesen.
  const rows = input.dailyMetrics.map((m) => ({ ...m, hrv_rmssd_ms: m.hrv_rmssd_ms ?? null }));
  if (!hasRecoveryData(rows)) return { kind: 'no_data' };
  const trend = recoveryTrend(rows, input.today, input.options);
  return {
    kind: 'ready',
    today: trend[trend.length - 1] as RecoveryResult,
    trend,
    medication: input.options.ignoreHeartValues ?? false,
  };
}
