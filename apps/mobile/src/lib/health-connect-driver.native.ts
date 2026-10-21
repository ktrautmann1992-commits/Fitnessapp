import { groupModality, mapExerciseType, type WearableDataType } from '@fitnessapp/core';
import { Linking, Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import type {
  HcAvailability,
  HcReadResult,
  HealthConnectDriver,
} from './health-connect-driver.types';

export type {
  HcAvailability,
  HcReadResult,
  HealthConnectDriver,
} from './health-connect-driver.types';

/**
 * Android: Health Connect über react-native-health-connect 4.1.3 (eingebautes Config-Plugin, TurboModule). NUR
 * Leserechte der Datentypen aus WEARABLE_DATA_TYPES (Manifest: app.config.ts), kein Schreiben, kein Hintergrund-Lesen,
 * keine Strecken. iPhone: nicht verfügbar (Apple Health ist eine spätere Etappe). Gelesene Werte nie loggen (Art. 9);
 * Fehler werden ohne Inhalt weitergereicht.
 */

type RecordName =
  | 'ExerciseSession'
  | 'Distance'
  | 'TotalCaloriesBurned'
  | 'HeartRate'
  | 'RestingHeartRate'
  | 'SleepSession'
  | 'Steps';

/** Datentyp der App → Health-Connect-Datensatz (je eine Leseberechtigung android.permission.health.READ_*). */
export const HC_RECORD_TYPES: Readonly<Record<WearableDataType, RecordName>> = {
  exercise: 'ExerciseSession',
  distance: 'Distance',
  calories: 'TotalCaloriesBurned',
  heart_rate: 'HeartRate',
  resting_heart_rate: 'RestingHeartRate',
  sleep: 'SleepSession',
  steps: 'Steps',
};

const TYPES = Object.keys(HC_RECORD_TYPES) as WearableDataType[];
const MAX_PAGES = 20;
const PLAY_STORE =
  'market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding';
const PLAY_STORE_WEB =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

let initialized = false;
async function ready(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!initialized) initialized = await initialize();
  return initialized;
}

function typesFrom(
  permissions: readonly { accessType: string; recordType: string }[],
): WearableDataType[] {
  return TYPES.filter((type) =>
    permissions.some((p) => p.accessType === 'read' && p.recordType === HC_RECORD_TYPES[type]),
  );
}

/** Alle Seiten eines Datensatz-Typs im Zeitraum (höchstens MAX_PAGES Seiten). */
async function readAll<T>(
  recordType: RecordName,
  from: string,
  to: string,
  dataOriginFilter?: string[],
): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = (await readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime: from, endTime: to },
      ...(dataOriginFilter ? { dataOriginFilter } : {}),
      ...(pageToken ? { pageToken } : {}),
    })) as unknown as { records: T[]; pageToken?: string };
    out.push(...result.records);
    pageToken = result.pageToken || undefined;
    if (!pageToken) break;
  }
  return out;
}

/** Beginn/Ende eines Kalendertags in der Zeitzone des Handys (DACH: Europe/Berlin). */
function localDayRange(day: string): { from: string; to: string } {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return {
    from: new Date(y, m - 1, d).toISOString(),
    to: new Date(y, m - 1, d + 1).toISOString(),
  };
}

export const healthConnectDriver: HealthConnectDriver = {
  kind: Platform.OS === 'android' ? 'native' : 'none',
  availability: async (): Promise<HcAvailability> => {
    if (Platform.OS !== 'android') return 'unsupported';
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update_required';
    }
    return 'not_installed';
  },
  requestPermissions: async () => {
    if (!(await ready())) return [];
    const granted = await requestPermission(
      TYPES.map((type) => ({ accessType: 'read' as const, recordType: HC_RECORD_TYPES[type] })),
    );
    return typesFrom(granted as { accessType: string; recordType: string }[]);
  },
  grantedTypes: async () => {
    if (!(await ready())) return [];
    const granted = await getGrantedPermissions();
    return typesFrom(granted as { accessType: string; recordType: string }[]);
  },
  read: async (window, granted, days): Promise<HcReadResult> => {
    if (!(await ready()))
      return { sessions: [], restingHeartRates: [], sleepSessions: [], steps: [] };
    const has = (type: WearableDataType) => granted.includes(type);
    const sessions: HcReadResult['sessions'][number][] = [];
    if (has('exercise')) {
      const records = await readAll<{
        startTime: string;
        endTime: string;
        exerciseType: number;
        metadata?: { id?: string; dataOrigin?: string };
      }>('ExerciseSession', window.from, window.to);
      for (const r of records) {
        const id = r.metadata?.id;
        if (!id) continue;
        const origin = r.metadata?.dataOrigin ? [r.metadata.dataOrigin] : undefined;
        const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
        const endurance = groupModality(mapExerciseType(r.exerciseType).group) !== null;
        let distanceM: number | null = null;
        if (endurance && has('distance')) {
          const agg = await aggregateRecord({
            recordType: 'Distance',
            timeRangeFilter: range,
            ...(origin ? { dataOriginFilter: origin } : {}),
          });
          distanceM = agg.DISTANCE?.inMeters ?? null;
        }
        let kcal: number | null = null;
        if (has('calories')) {
          const agg = await aggregateRecord({
            recordType: 'TotalCaloriesBurned',
            timeRangeFilter: range,
            ...(origin ? { dataOriginFilter: origin } : {}),
          });
          kcal = agg.ENERGY_TOTAL?.inKilocalories ?? null;
        }
        const heartRateSamples = has('heart_rate')
          ? (
              await readAll<{ samples: { time: string; beatsPerMinute: number }[] }>(
                'HeartRate',
                r.startTime,
                r.endTime,
                origin,
              )
            ).flatMap((h) => h.samples)
          : [];
        sessions.push({
          record: {
            id,
            exerciseType: r.exerciseType,
            startTime: r.startTime,
            endTime: r.endTime,
            dataOrigin: r.metadata?.dataOrigin ?? null,
          },
          extras: { distanceM, kcal, heartRateSamples },
        });
      }
    }
    const restingHeartRates = has('resting_heart_rate')
      ? (
          await readAll<{ time: string; beatsPerMinute: number }>(
            'RestingHeartRate',
            window.from,
            window.to,
          )
        ).map((r) => ({ time: r.time, beatsPerMinute: r.beatsPerMinute }))
      : [];
    const sleepSessions = has('sleep')
      ? (
          await readAll<{
            startTime: string;
            endTime: string;
            stages?: { startTime: string; endTime: string; stage: number }[];
          }>('SleepSession', window.from, window.to)
        ).map((s) => ({ startTime: s.startTime, endTime: s.endTime, stages: s.stages ?? [] }))
      : [];
    const steps: { day: string; count: number }[] = [];
    if (has('steps')) {
      // Aggregat je Tag: Health Connect entdoppelt Handy und Uhr selbst (nie Einzelwerte addieren).
      for (const day of days) {
        const range = localDayRange(day);
        const agg = await aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter: { operator: 'between', startTime: range.from, endTime: range.to },
        });
        if (typeof agg.COUNT_TOTAL === 'number') steps.push({ day, count: agg.COUNT_TOTAL });
      }
    }
    return { sessions, restingHeartRates, sleepSessions, steps };
  },
  openSettings: () => {
    if (Platform.OS === 'android') openHealthConnectSettings();
  },
  openInstall: () => {
    Linking.openURL(PLAY_STORE).catch(() => Linking.openURL(PLAY_STORE_WEB).catch(() => undefined));
  },
};
