import type { TrackPoint } from '@fitnessapp/core';

/**
 * Standort für die Aufzeichnung (Etappe E3/E4): gemeinsamer Vertrag für iPhone/Android (location-driver.native.ts,
 * expo-location + Vordergrund-Dienst) und Browser (location-driver.ts: keine Aufzeichnung, W-G14).
 */
export type LocationPermission =
  /** Erlaubt („Beim Verwenden der App“ reicht). */
  | 'granted'
  /** Noch nie gefragt → erst der eigene Erklär-Bildschirm, dann die Systemabfrage. */
  | 'undetermined'
  /** Abgelehnt, erneute Abfrage möglich. */
  | 'denied'
  /** Abgelehnt, das System fragt nicht mehr → Weg zu den Einstellungen. */
  | 'blocked'
  /** Standort am Gerät ausgeschaltet. */
  | 'services_off'
  /** Plattform kann nicht aufzeichnen (Browser). */
  | 'unsupported';

export interface LocationDriver {
  readonly supported: boolean;
  check(): Promise<LocationPermission>;
  /** Systemabfrage „Beim Verwenden“ (nie „Immer“). */
  request(): Promise<LocationPermission>;
  /** Aufzeichnung starten (nur aus der geöffneten App; Android: Vordergrund-Dienst mit Benachrichtigung). */
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  openSettings(): Promise<void>;
  /** Empfänger neuer Punkte (null = abmelden; Punkte bis dahin werden gepuffert). */
  setListener(listener: ((points: TrackPoint[]) => void) | null): void;
}
