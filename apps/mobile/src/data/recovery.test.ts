import {
  aggregateDailyMetrics,
  type DailyMetricRow,
  type WearableConnectionRow,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { DEMO_RECOVERY_DAYS, demoRead } from '../lib/health-connect-demo';
import { planPersonRows, VERSIONS } from '../test/fixtures';
import {
  clearRecoveryChoice,
  recoveryChoiceFor,
  setRecoveryChoice,
  subscribeRecoveryChoice,
} from './recovery-choice';
import { recoveryOptionsFromRows, recoveryState } from './recovery';

/** „Erholung aus der Uhr“ in der App (25.10.2026): Zustände, Optionen, Beispiel-Uhr, Wahl nur im Arbeitsspeicher. */

const TODAY = '2026-10-25';
const NOW = '2026-10-25T09:00:00.000Z';
const ADULT = { age: 36, ignoreHeartValues: false } as const;

const connection: WearableConnectionRow = {
  user_id: 'u',
  provider: 'health_connect',
  status: 'connected',
  granted_types: ['sleep', 'resting_heart_rate', 'hrv'],
  connected_at: NOW,
  last_sync_at: NOW,
  last_sync_count: 0,
  updated_at: NOW,
};

const base = {
  loading: false,
  connection,
  dailyMetrics: [] as DailyMetricRow[],
  unsupported: false,
  consentsValid: true,
  options: ADULT,
  today: TODAY,
};

/** Tageswerte der Beispiel-Uhr wie nach dem ersten Abgleich (30 Tage). */
function demoRows(): DailyMetricRow[] {
  const raw = demoRead(TODAY, '2026-09-25T00:00:00.000Z', NOW);
  return aggregateDailyMetrics({
    restingHeartRates: raw.restingHeartRates,
    sleepSessions: raw.sleepSessions,
    steps: raw.steps,
    heartRateVariabilities: raw.heartRateVariabilities,
  }).map((d) => ({ ...d, user_id: 'u', provider: 'health_connect', updated_at: NOW }));
}

describe('recoveryState', () => {
  it('Laden, Leerzustände (Android/Einwilligung/Uhr), keine Werte', () => {
    expect(recoveryState({ ...base, loading: true }).kind).toBe('loading');
    expect(recoveryState({ ...base, connection: null, unsupported: true })).toEqual({
      kind: 'empty',
      reason: 'only_android',
    });
    expect(recoveryState({ ...base, connection: null, consentsValid: false })).toEqual({
      kind: 'empty',
      reason: 'no_consent',
    });
    expect(recoveryState({ ...base, connection: null })).toEqual({
      kind: 'empty',
      reason: 'no_watch',
    });
    // Nur Schritte → keine Erholungswerte.
    const steps: DailyMetricRow[] = [
      {
        user_id: 'u',
        day: TODAY,
        provider: 'health_connect',
        resting_hr_bpm: null,
        sleep_min: null,
        steps: 5000,
        hrv_rmssd_ms: null,
        updated_at: NOW,
      },
    ];
    expect(recoveryState({ ...base, dailyMetrics: steps }).kind).toBe('no_data');
  });

  it('Beispiel-Uhr: 21 Tage Basis, vorgestern „mittel“, heute „niedrig“ (Schlaf, Ruhepuls, HRV)', () => {
    const rows = demoRows();
    expect(rows.filter((r) => r.hrv_rmssd_ms !== null)).toHaveLength(DEMO_RECOVERY_DAYS);
    const state = recoveryState({ ...base, dailyMetrics: rows });
    if (state.kind !== 'ready') throw new Error(state.kind);
    expect(state.today.status).toBe('low');
    expect(state.today.flags).toBe(3);
    expect(state.trend.map((d) => d.status)).toEqual([
      'good',
      'good',
      'good',
      'good',
      'medium',
      'good',
      'low',
    ]);
  });

  it('ältere Zeilen ohne HRV-Feld (Gerätespeicher vor 25.10.2026) gehen nicht kaputt', () => {
    const rows = demoRows().map((row) => {
      const copy: Partial<DailyMetricRow> = { ...row };
      delete copy.hrv_rmssd_ms;
      return copy;
    }) as unknown as DailyMetricRow[];
    const state = recoveryState({ ...base, dailyMetrics: rows });
    if (state.kind !== 'ready') throw new Error(state.kind);
    expect(state.today.signals[2]?.state).toBe('no_data');
    expect(state.today.status).toBe('low');
  });

  it('Medikamente: nur Schlaf zählt → höchstens „mittel“', () => {
    const state = recoveryState({
      ...base,
      dailyMetrics: demoRows(),
      options: { age: 36, ignoreHeartValues: true },
    });
    if (state.kind !== 'ready') throw new Error(state.kind);
    expect(state.today.status).toBe('medium');
    expect(state.medication).toBe(true);
  });
});

describe('recoveryOptionsFromRows', () => {
  it('Alter aus dem Profil; Medikamente nur mit gültiger Einwilligung Gesundheitsdaten', () => {
    expect(
      recoveryOptionsFromRows(planPersonRows({ birthDate: '2010-01-01' }), VERSIONS, TODAY),
    ).toEqual({ age: 16, ignoreHeartValues: false });
    expect(
      recoveryOptionsFromRows(planPersonRows({ flags: ['medication'] }), VERSIONS, TODAY)
        .ignoreHeartValues,
    ).toBe(true);
    expect(
      recoveryOptionsFromRows(
        planPersonRows({ flags: ['medication'], consent: 'none' }),
        VERSIONS,
        TODAY,
      ).ignoreHeartValues,
    ).toBe(false);
  });
});

describe('Wahl „Leichter trainieren“ (nur Arbeitsspeicher)', () => {
  it('gilt nur für Konto, Tag und Einheit; zurücknehmbar; meldet Änderungen', () => {
    let calls = 0;
    const off = subscribeRecoveryChoice(() => {
      calls += 1;
    });
    setRecoveryChoice({ userId: 'u', day: TODAY, sessionId: 's1', choice: 'lighter' });
    expect(recoveryChoiceFor('u', TODAY, 's1')).toBe('lighter');
    expect(recoveryChoiceFor('u', TODAY, 's2')).toBeNull();
    expect(recoveryChoiceFor('u', '2026-10-26', 's1')).toBeNull();
    expect(recoveryChoiceFor('anders', TODAY, 's1')).toBeNull();
    expect(recoveryChoiceFor(null, TODAY, 's1')).toBeNull();
    clearRecoveryChoice();
    expect(recoveryChoiceFor('u', TODAY, 's1')).toBeNull();
    expect(calls).toBe(2);
    off();
  });
});
