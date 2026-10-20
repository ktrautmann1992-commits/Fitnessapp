import { ROUTE_RECORDING, type TrackPoint } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking } from 'react-native';

import type { LocationDriver, LocationPermission } from './location-driver.types';

export type { LocationDriver, LocationPermission } from './location-driver.types';

/**
 * iPhone/Android (Etappe E3/E4, W-G13): Aufzeichnung über expo-location mit einer Hintergrund-Aufgabe
 * (expo-task-manager). Nur „Beim Verwenden der App“: Android startet dazu einen VORDERGRUND-DIENST mit der
 * Benachrichtigung „Aufzeichnung läuft“ (FOREGROUND_SERVICE_LOCATION, keine Berechtigung „Immer“), iOS nutzt den
 * Hintergrundmodus `location` mit blauem Standort-Hinweis. Der Standort läuft NUR zwischen Start/Fortsetzen und
 * Pause/Stopp. Keine Koordinaten in Logs.
 *
 * Die Aufgabe MUSS beim Laden der App definiert sein (expo-task-manager) – deshalb importiert app/_layout.tsx diese
 * Datei.
 */
export const RECORDING_TASK = 'alpha5-route-recording';

/** Puffer, solange kein Empfänger angemeldet ist (z. B. Bildschirm gerade gewechselt). */
const MAX_BUFFER = 5_000;
let buffer: TrackPoint[] = [];
let listener: ((points: TrackPoint[]) => void) | null = null;

function toPoint(location: Location.LocationObject): TrackPoint {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    t: location.timestamp,
    accuracyM: location.coords.accuracy ?? null,
    altitudeM: location.coords.altitude ?? null,
  };
}

if (!TaskManager.isTaskDefined(RECORDING_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
    RECORDING_TASK,
    async ({ data, error }) => {
      // Fehler still (nie Koordinaten oder Details loggen) – die App zeigt „Suche GPS …“.
      if (error || !data?.locations) return;
      const points = data.locations.map(toPoint);
      if (listener) {
        listener(points);
      } else {
        buffer = [...buffer, ...points].slice(-MAX_BUFFER);
      }
    },
  );
}

function fromResponse(response: Location.LocationPermissionResponse): LocationPermission {
  if (response.granted) return 'granted';
  if (response.status === Location.PermissionStatus.UNDETERMINED) return 'undetermined';
  return response.canAskAgain ? 'denied' : 'blocked';
}

export const locationDriver: LocationDriver = {
  supported: true,
  check: async () => {
    if (!(await Location.hasServicesEnabledAsync())) return 'services_off';
    return fromResponse(await Location.getForegroundPermissionsAsync());
  },
  request: async () => {
    const result = fromResponse(await Location.requestForegroundPermissionsAsync());
    if (result === 'granted' && !(await Location.hasServicesEnabledAsync())) return 'services_off';
    return result;
  },
  start: async () => {
    if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) return;
    await Location.startLocationUpdatesAsync(RECORDING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: ROUTE_RECORDING.gpsTimeIntervalMs,
      distanceInterval: ROUTE_RECORDING.gpsDistanceIntervalM,
      // iOS: Fitness-Aufzeichnung, nie automatisch pausieren, blauer Hinweis im Hintergrund.
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android: Vordergrund-Dienst (nur während der Aufzeichnung) – endet, wenn die App beendet wird.
      foregroundService: {
        notificationTitle: 'Alpha5 – Aufzeichnung läuft',
        notificationBody:
          'Dein Standort wird nur für diese Aufzeichnung genutzt. Tippe, um sie zu öffnen.',
        notificationColor: brandColors.blau,
        killServiceOnDestroy: true,
      },
    });
  },
  stop: async () => {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
        await Location.stopLocationUpdatesAsync(RECORDING_TASK);
      }
    } catch {
      // Aufgabe schon beendet (z. B. nach Neustart) – nichts zu tun.
    }
  },
  isRunning: async () => {
    try {
      return await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK);
    } catch {
      return false;
    }
  },
  openSettings: () => Linking.openSettings(),
  setListener: (next) => {
    listener = next;
    if (next && buffer.length > 0) {
      const pending = buffer;
      buffer = [];
      next(pending);
    }
  },
};
