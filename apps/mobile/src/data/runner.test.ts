import {
  CURRENT_CONSENT_VERSIONS,
  DEFAULT_PULSE_ZONE_SETTINGS,
  type EnduranceActivity,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createDemoHealthConnectDriver } from '../lib/health-connect-demo';
import { createMemoryStore, STORAGE_KEYS } from './kv';
import { createLocalBackend } from './local-backend';
import {
  bodyRestingBpm,
  forgetRunnerDeviceData,
  loadRatioFromRows,
  mergeCadence,
  mergeZoneBasis,
  racePredictionFromActivities,
  readCadence,
  readPulseZoneSettings,
  readZoneBasis,
  restingBpmFromRows,
  writePulseZoneSettings,
} from './runner';
import { emptyUserRows, type UserRows } from './types';
import { runWearableSync } from './wearable-sync';

/** Lauf-Paket 2: Geräte-Einstellungen, Eingaben für packages/core und Abgleich mit Kadenz/Pulszonen. */

const TODAY = '2026-10-21';
const NOW = '2026-10-21T12:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const metric = (measured_on: string, resting: number | null) =>
  ({ measured_on, resting_heart_rate_bpm: resting }) as UserRows['bodyMetrics'][number];

describe('Geräte-Einstellungen je Konto', () => {
  it('Pulszonen: Standard, speichern, kaputt → Standard, Konten getrennt', async () => {
    const store = createMemoryStore();
    expect(await readPulseZoneSettings(store, 'a')).toEqual(DEFAULT_PULSE_ZONE_SETTINGS);
    await writePulseZoneSettings(store, 'a', { hfMaxOverride: 188, useRestingHr: false });
    await writePulseZoneSettings(store, 'b', { hfMaxOverride: null, useRestingHr: true });
    expect(await readPulseZoneSettings(store, 'a')).toEqual({
      hfMaxOverride: 188,
      useRestingHr: false,
    });
    await store.setItem(STORAGE_KEYS.pulseZones, '{"a":{"hfMaxOverride":999}}');
    expect(await readPulseZoneSettings(store, 'a')).toEqual(DEFAULT_PULSE_ZONE_SETTINGS);
    await store.setItem(STORAGE_KEYS.pulseZones, 'kein json');
    expect(await readPulseZoneSettings(store, 'a')).toEqual(DEFAULT_PULSE_ZONE_SETTINGS);
  });

  it('Kadenz: zusammenführen, nur gültige Werte; Vergessen entfernt nur dieses Konto', async () => {
    const store = createMemoryStore();
    await mergeCadence(store, 'a', { 'hc-1': 170 });
    await mergeCadence(store, 'a', { 'hc-2': 168, 'hc-1': 172 });
    await mergeCadence(store, 'b', { 'hc-9': 150 });
    await mergeCadence(store, 'a', {});
    expect(await readCadence(store, 'a')).toEqual({ 'hc-1': 172, 'hc-2': 168 });
    await writePulseZoneSettings(store, 'a', { hfMaxOverride: 190, useRestingHr: true });
    await mergeZoneBasis(store, 'a', { 'hc-1': 55, 'hc-2': null });
    await mergeZoneBasis(store, 'a', { 'hc-1': 52 });
    expect(await readZoneBasis(store, 'a')).toEqual({ 'hc-1': 52, 'hc-2': null });
    await forgetRunnerDeviceData(store, 'a');
    expect(await readZoneBasis(store, 'a')).toEqual({});
    expect(await readCadence(store, 'a')).toEqual({});
    expect(await readPulseZoneSettings(store, 'a')).toEqual(DEFAULT_PULSE_ZONE_SETTINGS);
    expect(await readCadence(store, 'b')).toEqual({ 'hc-9': 150 });
    await forgetRunnerDeviceData(store, 'nie-da');
  });
});

describe('Ruhepuls aus den Zeilen', () => {
  it('neuester Wert der Körperdaten, Uhr hat Vorrang', () => {
    const bodyMetrics = [
      metric('2026-09-01', 70),
      metric('2026-10-01', 62),
      metric('2026-10-10', null),
    ];
    expect(bodyRestingBpm({ bodyMetrics })).toBe(62);
    expect(bodyRestingBpm({ bodyMetrics: [] })).toBeNull();
    const daily = [50, 52, 54].map((v, i) => ({
      user_id: 'u',
      day: `2026-10-${String(19 + i).padStart(2, '0')}`,
      provider: 'health_connect' as const,
      resting_hr_bpm: v,
      sleep_min: null,
      steps: null,
      hrv_rmssd_ms: null,
      updated_at: NOW,
    }));
    expect(restingBpmFromRows({ bodyMetrics }, { dailyMetrics: daily }, TODAY)).toBe(52);
    expect(restingBpmFromRows({ bodyMetrics }, null, TODAY)).toBe(62);
  });
});

function activity(
  day: string,
  km: number,
  paceS: number,
  sport: EnduranceActivity['sport'] = 'run',
) {
  return {
    key: `route:${day}`,
    source: 'route',
    routeId: day,
    logId: null,
    name: 'Lauf',
    sport,
    day,
    startedAt: `${day}T07:00:00Z`,
    durationS: km * paceS,
    movingS: km * paceS,
    distanceM: km * 1000,
    elevationM: null,
    isFavorite: false,
    eBike: false,
  } satisfies EnduranceActivity;
}

describe('Zeitprognose und Ampel aus den Aktivitäten', () => {
  it('nur Laufen zählt für die Prognose', () => {
    expect(
      racePredictionFromActivities(
        [activity('2026-10-20', 5, 300), activity('2026-10-18', 20, 150, 'bike')],
        TODAY,
      ),
    ).toEqual({ kind: 'insufficient', efforts: 1 });
    const ok = racePredictionFromActivities(
      [activity('2026-10-20', 5, 300), activity('2026-10-14', 10, 330)],
      TODAY,
    );
    expect(ok.kind).toBe('ok');
  });

  it('Ampel ohne Tagebuch: zu wenig Daten', () => {
    expect(loadRatioFromRows(emptyUserRows(), [], TODAY)).toEqual({
      kind: 'insufficient',
      reason: 'too_little_history',
    });
  });
});

describe('Abgleich: Kadenz und Pulszonen (Beispiel-Uhr)', () => {
  it('Kadenz je Lauf (nur Gerät) und Zonen nach Herzfrequenz-Reserve mit Ruhepuls', async () => {
    let counter = 0;
    const backend = createLocalBackend(createMemoryStore(), {
      platform: 'android',
      today: () => TODAY,
      now: () => NOW,
      newId: () => uuid(++counter),
    });
    if (backend.signIn.kind !== 'test_mode') throw new Error('Testmodus erwartet');
    await backend.signIn.start();
    await backend.createProfile('1990-05-15');
    await backend.grantConsents(
      ['terms', 'privacy', 'health_data', 'wearable_data'],
      CURRENT_CONSENT_VERSIONS,
    );
    const driver = createDemoHealthConnectDriver(() => TODAY);
    await backend.wearables.connect(await driver.requestPermissions());
    const rows = (await backend.loadRows()).rows;
    const outcome = await runWearableSync({
      driver,
      backend: backend.wearables,
      rows: { ...rows, bodyMetrics: [metric(TODAY, 50)] },
      pulseZones: { hfMaxOverride: 190, useRestingHr: true },
      wearable: (await backend.wearables.load()).rows,
      now: NOW,
      today: TODAY,
    });
    expect(outcome.kind).toBe('imported');
    if (outcome.kind !== 'imported') return;
    const cadence = Object.values(outcome.cadence ?? {});
    expect(cadence.length).toBe(3);
    expect(cadence.every((spm) => spm >= 160 && spm <= 180)).toBe(true);
    // Grundlage der Zonen je Einheit mit Puls: Ruhepuls aus den gerade gelesenen Tageswerten der Uhr (Median 14 Tage,
    // 53–56) – vor den Körperdaten (50).
    const basis = Object.values(outcome.zoneBasis ?? {});
    expect(basis).toHaveLength(4);
    expect(new Set(basis).size).toBe(1);
    expect(basis[0]).toBeGreaterThanOrEqual(53);
    expect(basis[0]).toBeLessThanOrEqual(56);
    const w = (await backend.wearables.load()).rows;
    expect(w.heartRates.every((h) => h.hf_max_used === 190)).toBe(true);
    // Demo-Lauf um 150 /min: nach Karvonen (Ruhe ca. 54, HFmax 190) liegt 150 in Zone 3 (ca. 149–162).
    const run = w.heartRates.find((h) => (h.zone_s[2] ?? 0) > 600);
    expect(run).toBeDefined();
  });
});
