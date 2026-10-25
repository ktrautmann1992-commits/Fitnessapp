import {
  type CadenceStore,
  type EnduranceActivity,
  type LoadRatioResult,
  loadRatio,
  parseCadenceStore,
  parsePulseZoneSettings,
  predictRaceTimes,
  type PulseZoneSettings,
  type RacePredictionResult,
  restingHeartRateFor,
  type WearableRows,
} from '@fitnessapp/core';

import { readJson, STORAGE_KEYS, type KeyValueStore, writeJson } from './kv';
import { sportWeekLogsFromRows } from './sport-entry';
import type { UserRows } from './types';

/**
 * Lauf-Paket 2 (docs/PLAN-LAUF-PAKET-2.md): Geräte-Einstellungen (Pulszonen, Kadenz je Uhr-Einheit) und das
 * Zusammensetzen der Eingaben für packages/core. Keine Regeln hier – nur Zeilen → Eingaben. Nichts davon geht an den
 * Server; Werte nie loggen.
 */

type PerUser = Record<string, unknown>;

async function readPerUser(store: KeyValueStore, key: string): Promise<PerUser> {
  const raw = await readJson<PerUser>(store, key).catch(() => null);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Pulszonen-Einstellung je Konto auf diesem Gerät (Standard: aus dem Alter, Ruhepuls einbeziehen). */
export async function readPulseZoneSettings(
  store: KeyValueStore,
  userId: string,
): Promise<PulseZoneSettings> {
  return parsePulseZoneSettings((await readPerUser(store, STORAGE_KEYS.pulseZones))[userId]);
}

export async function writePulseZoneSettings(
  store: KeyValueStore,
  userId: string,
  settings: PulseZoneSettings,
): Promise<void> {
  const base = await readPerUser(store, STORAGE_KEYS.pulseZones);
  await writeJson(store, STORAGE_KEYS.pulseZones, {
    ...base,
    [userId]: parsePulseZoneSettings(settings),
  });
}

/** Kadenz je Uhr-Einheit (Health-Connect-id → Schritte/min) dieses Kontos. */
export async function readCadence(store: KeyValueStore, userId: string): Promise<CadenceStore> {
  return parseCadenceStore((await readPerUser(store, STORAGE_KEYS.runCadence))[userId]);
}

/** Neue Kadenz-Werte dazuschreiben (gleiche id → neuer Wert). */
export async function mergeCadence(
  store: KeyValueStore,
  userId: string,
  entries: CadenceStore,
): Promise<void> {
  if (Object.keys(entries).length === 0) return;
  const base = await readPerUser(store, STORAGE_KEYS.runCadence);
  const current = parseCadenceStore(base[userId]);
  await writeJson(store, STORAGE_KEYS.runCadence, {
    ...base,
    [userId]: { ...current, ...parseCadenceStore(entries) },
  });
}

/** Abmelden, Konto löschen, Widerruf health_data: Einträge dieses Kontos entfernen (andere Konten bleiben). */
export async function forgetRunnerDeviceData(store: KeyValueStore, userId: string): Promise<void> {
  for (const key of [STORAGE_KEYS.pulseZones, STORAGE_KEYS.runCadence]) {
    const base = await readPerUser(store, key);
    if (!(userId in base)) continue;
    const rest = Object.fromEntries(Object.entries(base).filter(([id]) => id !== userId));
    await writeJson(store, key, rest);
  }
}

/** Neuester Ruhepuls aus den Körperdaten (Onboarding/Einstellungen) oder null. */
export function bodyRestingBpm(rows: Pick<UserRows, 'bodyMetrics'>): number | null {
  const latest = [...rows.bodyMetrics]
    .filter((m) => m.resting_heart_rate_bpm !== null)
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0];
  return latest?.resting_heart_rate_bpm ?? null;
}

/** Ruhepuls für die Pulszonen: Uhr (Median 14 Tage) vor Körperdaten. */
export function restingBpmFromRows(
  rows: Pick<UserRows, 'bodyMetrics'>,
  wearable: Pick<WearableRows, 'dailyMetrics'> | null,
  today: string,
): number | null {
  return restingHeartRateFor({
    daily: wearable?.dailyMetrics ?? [],
    bodyMetricBpm: bodyRestingBpm(rows),
    today,
  });
}

/** Zeitprognose aus den Läufen („Meine Läufe“: Aufzeichnungen und Einträge ohne GPS, Sportart Laufen). */
export function racePredictionFromActivities(
  activities: readonly EnduranceActivity[],
  today: string,
): RacePredictionResult {
  return predictRaceTimes({
    efforts: activities
      .filter((a) => a.sport === 'run' && a.distanceM !== null)
      .map((a) => ({ day: a.day, distanceM: a.distanceM as number, movingS: a.movingS })),
    today,
  });
}

/** Belastungs-Ampel aus allen Tagebuch-Einträgen und den Lauf-Kilometern. */
export function loadRatioFromRows(
  rows: Pick<UserRows, 'sessionLogs' | 'cardioLogs' | 'plannedSessions'>,
  activities: readonly EnduranceActivity[],
  today: string,
): LoadRatioResult {
  return loadRatio({
    logs: sportWeekLogsFromRows(rows, () => null),
    runs: activities
      .filter((a) => a.sport === 'run')
      .map((a) => ({ day: a.day, distanceM: a.distanceM })),
    today,
  });
}
