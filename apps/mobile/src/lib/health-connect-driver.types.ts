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
 * Testmodus (health-connect-demo.ts). NUR lesen (W8-3), kein Hintergrund-Lesen (W8-7). Routen (GPS) der Ausdauer-
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
  /** Systemdialog mit genau den Leserechten aus WEARABLE_DATA_TYPES; Ergebnis = freigegebene Datentypen. */
  requestPermissions(): Promise<WearableDataType[]>;
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
  /** Health-Connect-Einstellungen bzw. Berechtigungen öffnen (Zugriff zurückgeben/entziehen). */
  openSettings(): void;
  /** Play Store: Health Connect installieren/aktualisieren. */
  openInstall(): void;
}
