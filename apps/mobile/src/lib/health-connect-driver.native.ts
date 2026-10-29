import {
  groupModality,
  type HcRouteRead,
  hcLocationsFromNative,
  hcRouteFromRecord,
  mapExerciseType,
  watchRouteSport,
  type WearableDataType,
} from '@fitnessapp/core';
import { Linking, Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecord,
  readRecords,
  requestExerciseRoute,
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
 * Android: Health Connect über react-native-health-connect 4.1.3 (eingebautes Config-Plugin, TurboModule). Schritte
 * kommen als Tagessumme über aggregateRecord OHNE Herkunfts-Filter: Health Connect zählt Handy (eigener Schrittzähler ab
 * Android 14 bzw. Samsung Health/Google Fit) und Uhr zusammen und entdoppelt selbst – so gehen „Schritte vom Handy“ auch
 * ganz ohne Uhr (docs/PLAN-PHASE-8.md 13.5). NUR
 * Leserechte der Datentypen aus WEARABLE_DATA_TYPES plus Trainingsrouten (Manifest: app.config.ts), kein Schreiben,
 * kein Hintergrund-Lesen. Routen (23.10.2026): je Ausdauer-Einheit über readRecord (nur dort liefert Health Connect die
 * Route); ohne „Trainingsrouten“-Recht meldet Health Connect „Freigabe nötig“ – dann „Route freigeben“
 * (requestExerciseRoute, Dialog je Einheit). Das Leserecht READ_EXERCISE_ROUTES fragt die App über einen kleinen Patch
 * der Bibliothek ab (patches/react-native-health-connect@4.1.3.patch). iPhone: nicht verfügbar. Gelesene Werte nie
 * loggen (Art. 9, Standort); Fehler werden ohne Inhalt weitergereicht.
 */

type RecordName =
  | 'ExerciseSession'
  | 'Distance'
  | 'TotalCaloriesBurned'
  | 'HeartRate'
  | 'RestingHeartRate'
  | 'SleepSession'
  | 'Steps'
  | 'HeartRateVariabilityRmssd';

/** Datentyp der App → Health-Connect-Datensatz (je eine Leseberechtigung android.permission.health.READ_*). */
export const HC_RECORD_TYPES: Readonly<Record<WearableDataType, RecordName>> = {
  exercise: 'ExerciseSession',
  distance: 'Distance',
  calories: 'TotalCaloriesBurned',
  heart_rate: 'HeartRate',
  resting_heart_rate: 'RestingHeartRate',
  sleep: 'SleepSession',
  steps: 'Steps',
  // „Erholung aus der Uhr“ (25.10.2026): READ_HEART_RATE_VARIABILITY (app.config.ts).
  hrv: 'HeartRateVariabilityRmssd',
};

const TYPES = Object.keys(HC_RECORD_TYPES) as WearableDataType[];

/** Leserecht „Trainingsrouten“ (READ_EXERCISE_ROUTES; über den Bibliotheks-Patch, sonst ignoriert). */
const ROUTE_PERMISSION = { accessType: 'read', recordType: 'ExerciseRoute' } as const;

/**
 * Leserecht „Leistung“ (READ_POWER, Restpunkte Rudern 27.10.2026): Ø Watt für Einheiten am Rudergerät. Getrennt
 * gefragt wie die Trainingsrouten; ohne Freigabe bleibt Watt leer.
 */
const POWER_PERMISSION = { accessType: 'read', recordType: 'Power' } as const;

function hasPowerPermission(
  permissions: readonly { accessType: string; recordType: string }[],
): boolean {
  return permissions.some((p) => p.accessType === 'read' && p.recordType === 'Power');
}

function hasRoutePermission(
  permissions: readonly { accessType: string; recordType: string }[],
): boolean {
  return permissions.some((p) => p.accessType === 'read' && p.recordType === 'ExerciseRoute');
}

/** Route einer Einheit lesen (nur readRecord liefert sie); Fehler ohne Inhalt. */
async function readRoute(id: string): Promise<HcRouteRead> {
  try {
    const record = (await readRecord('ExerciseSession', id)) as unknown as {
      exerciseRoute?: unknown;
    };
    return hcRouteFromRecord(record.exerciseRoute);
  } catch {
    return { kind: 'error' };
  }
}
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
  requestPermissions: async (types = TYPES) => {
    if (!(await ready())) return [];
    const wanted = TYPES.filter((type) => types.includes(type));
    const granted = await requestPermission(
      wanted.map((type) => ({ accessType: 'read' as const, recordType: HC_RECORD_TYPES[type] })),
    );
    // „Nur Schritte vom Handy“: keine Trainingsrouten und keine Leistung fragen (gehören zu Einheiten der Uhr).
    if (!wanted.includes('exercise')) {
      return typesFrom(granted as { accessType: string; recordType: string }[]);
    }
    // Trainingsrouten getrennt fragen: Ältere Health-Connect-Versionen kennen das Recht nicht – dann bleibt es bei der
    // Freigabe je Einheit, die übrigen Rechte sind schon erteilt.
    try {
      await requestPermission([
        ROUTE_PERMISSION as unknown as Parameters<typeof requestPermission>[0][number],
      ]);
    } catch {
      // nicht unterstützt
    }
    // Leistung (Watt) fürs Rudergerät – ebenfalls getrennt, damit eine Ablehnung nichts anderes berührt.
    try {
      await requestPermission([
        POWER_PERMISSION as unknown as Parameters<typeof requestPermission>[0][number],
      ]);
    } catch {
      // nicht unterstützt
    }
    return typesFrom(granted as { accessType: string; recordType: string }[]);
  },
  grantedTypes: async () => {
    if (!(await ready())) return [];
    const granted = await getGrantedPermissions();
    return typesFrom(granted as { accessType: string; recordType: string }[]);
  },
  read: async (window, granted, days): Promise<HcReadResult> => {
    if (!(await ready()))
      return {
        sessions: [],
        restingHeartRates: [],
        sleepSessions: [],
        steps: [],
        heartRateVariabilities: [],
      };
    const has = (type: WearableDataType) => granted.includes(type);
    // Watt nur mit Freigabe „Leistung“ (READ_POWER) und nur am Rudergerät.
    const powerAllowed = await getGrantedPermissions().then(
      (list) => hasPowerPermission(list as { accessType: string; recordType: string }[]),
      () => false,
    );
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
        // Route (GPS) nur bei Ausdauer mit Strecke (Laufen, Gehen, Rad).
        const route =
          endurance && watchRouteSport(mapExerciseType(r.exerciseType).group) !== null
            ? await readRoute(id)
            : undefined;
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
        // Lauf-Paket 2 (Kadenz): Schritte im Zeitraum der Einheit, nur Laufen/Gehen und nur mit Freigabe „Schritte“.
        // Aggregat ohne Herkunfts-Filter: Health Connect entdoppelt Handy und Uhr selbst.
        const group = mapExerciseType(r.exerciseType).group;
        let steps: number | null = null;
        if ((group === 'run' || group === 'walk') && has('steps')) {
          try {
            const agg = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: range });
            steps = typeof agg.COUNT_TOTAL === 'number' ? agg.COUNT_TOTAL : null;
          } catch {
            steps = null;
          }
        }
        let avgPowerW: number | null = null;
        if (powerAllowed && group === 'row') {
          try {
            const agg = await aggregateRecord({
              recordType: 'Power',
              timeRangeFilter: range,
              ...(origin ? { dataOriginFilter: origin } : {}),
            });
            avgPowerW = agg.POWER_AVG?.inWatts ?? null;
          } catch {
            avgPowerW = null;
          }
        }
        sessions.push({
          record: {
            id,
            exerciseType: r.exerciseType,
            startTime: r.startTime,
            endTime: r.endTime,
            dataOrigin: r.metadata?.dataOrigin ?? null,
          },
          extras: {
            distanceM,
            kcal,
            heartRateSamples,
            steps,
            ...(route ? { route } : {}),
            ...(avgPowerW !== null ? { avgPowerW } : {}),
          },
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
    // HRV (RMSSD): einzelne Messungen nur auf dem Gerät – gespeichert wird nur der Median je Tag.
    const heartRateVariabilities = has('hrv')
      ? (
          await readAll<{ time: string; heartRateVariabilityMillis: number }>(
            'HeartRateVariabilityRmssd',
            window.from,
            window.to,
          )
        ).map((h) => ({ time: h.time, rmssdMs: h.heartRateVariabilityMillis }))
      : [];
    return { sessions, restingHeartRates, sleepSessions, steps, heartRateVariabilities };
  },
  routeAccess: async () => {
    if (!(await ready())) return false;
    try {
      const granted = await getGrantedPermissions();
      return hasRoutePermission(granted as { accessType: string; recordType: string }[]);
    } catch {
      return false;
    }
  },
  requestRoute: async (externalId) => {
    if (!(await ready())) return { kind: 'error' };
    try {
      const points = hcLocationsFromNative(await requestExerciseRoute(externalId));
      return points.length > 0 ? { kind: 'points', points } : { kind: 'none' };
    } catch {
      // Abgelehnt oder Dialog geschlossen (ExerciseRouteAccessDenied) – ohne Inhalt.
      return { kind: 'not_granted' };
    }
  },
  openSettings: () => {
    if (Platform.OS === 'android') openHealthConnectSettings();
  },
  openInstall: () => {
    Linking.openURL(PLAY_STORE).catch(() => Linking.openURL(PLAY_STORE_WEB).catch(() => undefined));
  },
};
