import type { HealthConnectDriver } from './health-connect-driver.types';

export type {
  HcAvailability,
  HcReadResult,
  HealthConnectDriver,
} from './health-connect-driver.types';

/**
 * Browser (Web-Export): KEIN Health Connect – „Smartwatch verbinden geht nur in der Android-App“. Das native Modul wird
 * im Web-Bündel nie geladen (diese Datei statt health-connect-driver.native.ts). Im Testmodus gibt es die Beispiel-Uhr
 * (health-connect-demo.ts).
 */
export const healthConnectDriver: HealthConnectDriver = {
  kind: 'none',
  availability: async () => 'unsupported',
  requestPermissions: async () => [],
  grantedTypes: async () => [],
  read: async () => ({ sessions: [], restingHeartRates: [], sleepSessions: [], steps: [] }),
  routeAccess: async () => false,
  requestRoute: async () => ({ kind: 'error' }),
  openSettings: () => undefined,
  openInstall: () => undefined,
};
