import type {
  DailyStepsInput,
  HcExerciseSessionInput,
  HeartRateVariabilityInput,
  HcRouteRead,
  HcSessionExtras,
  RestingHeartRateInput,
  SleepSessionInput,
  WearableDataType,
} from '@fitnessapp/core';

/**
 * Health Connect (Phase 8, docs/PLAN-PHASE-8.md 2, 7.1): gemeinsamer Vertrag für Android (health-connect-driver.native.ts,
 * react-native-health-connect), Browser/iPhone (health-connect-driver.ts: nicht verfügbar) und die Beispiel-Uhr im
 * Testmodus (health-connect-demo.ts). NUR lesen (W8-3). Lesen im Hintergrund nur mit eigenem Recht
 * (READ_HEALTH_DATA_IN_BACKGROUND, Gründer-Freigabe 30.10.2026, docs/PLAN-PHASE-8.md 13.6, ändert W8-7). Routen (GPS) der Ausdauer-
 * Einheiten seit 23.10.2026 (Gründer-Entscheidung „Routen lesen“, docs/PLAN-PHASE-8.md 14). Gelesene Werte sind
 * Gesundheits- bzw. Standortdaten: nie loggen, nie in Fehlermeldungen.
 */
export type HcAvailability =
  /** Health Connect da und aktuell. */
  | 'available'
  /** Nicht installiert (Android 9–13: App aus dem Play Store). */
  | 'not_installed'
  /** Veraltet – im Play Store aktualisieren. */
  | 'update_required'
  /** Plattform ohne Health Connect (Browser, iPhone). */
  | 'unsupported';

/** Gelesene Rohdaten eines Zeitraums – die App rechnet sie mit packages/core zu Import-Datensätzen um. */
export interface HcReadResult {
  readonly sessions: readonly { record: HcExerciseSessionInput; extras: HcSessionExtras }[];
  readonly restingHeartRates: readonly RestingHeartRateInput[];
  readonly sleepSessions: readonly SleepSessionInput[];
  readonly steps: readonly DailyStepsInput[];
  /** HRV (RMSSD) je Messung – die App rechnet daraus einen Tageswert (aggregateDailyMetrics), seit 25.10.2026. */
  readonly heartRateVariabilities: readonly HeartRateVariabilityInput[];
}

export interface HealthConnectDriver {
  /** `native` = echtes Health Connect, `demo` = Beispiel-Uhr (Testmodus), `none` = nicht verfügbar. */
  readonly kind: 'native' | 'demo' | 'none';
  availability(): Promise<HcAvailability>;
  /**
   * Systemdialog mit den Leserechten aus WEARABLE_DATA_TYPES (bzw. nur `types`, z. B. „Nur Schritte vom Handy“ =
   * `['steps']`); Ergebnis = freigegebene Datentypen.
   */
  requestPermissions(types?: readonly WearableDataType[]): Promise<WearableDataType[]>;
  /** Aktuell freigegebene Datentypen (ohne Dialog). */
  grantedTypes(): Promise<WearableDataType[]>;
  /** Daten im Zeitraum lesen (nur freigegebene Typen). `days` = Kalendertage für die Schritte (Europe/Berlin). */
  read(
    window: { from: string; to: string },
    granted: readonly WearableDataType[],
    days: readonly string[],
  ): Promise<HcReadResult>;
  /**
   * Trainingsrouten für ALLE Einheiten erlaubt (READ_EXERCISE_ROUTES)? Sonst fragt Health Connect je Einheit
   * („Route freigeben“).
   */
  routeAccess(): Promise<boolean>;
  /**
   * „Route freigeben“: Health-Connect-Dialog für genau diese Einheit (metadata.id = external_id) → Route. Nur auf
   * ausdrücklichen Tipp der Person aufrufen.
   */
  requestRoute(externalId: string): Promise<HcRouteRead>;
  /**
   * Abgleich im Hintergrund (30.10.2026): Recht „Daten im Hintergrund lesen“ (READ_HEALTH_DATA_IN_BACKGROUND) erteilt?
   * Ohne das Recht liest die App nur im Vordergrund.
   */
  backgroundAccess(): Promise<boolean>;
  /**
   * Systemdialog von Health Connect NUR für das Hintergrund-Recht (auf ausdrücklichen Tipp der Person). Ergebnis =
   * erteilt. Ältere Health-Connect-Versionen kennen das Recht nicht → false (Vordergrund bleibt).
   */
  requestBackgroundAccess(): Promise<boolean>;
  /** Health-Connect-Einstellungen bzw. Berechtigungen öffnen (Zugriff zurückgeben/entziehen). */
  openSettings(): void;
  /** Play Store: Health Connect installieren/aktualisieren. */
  openInstall(): void;
}
