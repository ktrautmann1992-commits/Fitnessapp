import type { LocationDriver } from './location-driver.types';

export type { LocationDriver, LocationPermission } from './location-driver.types';

/**
 * Browser (Web-Export): KEINE echte Aufzeichnung (W-G14) – navigator.geolocation stoppt, sobald der Bildschirm aus
 * ist. Die Web-Version zeigt „Aufzeichnen geht in der App“ und im Testmodus eine Demo-Aufzeichnung.
 */
export const locationDriver: LocationDriver = {
  supported: false,
  check: async () => 'unsupported',
  request: async () => 'unsupported',
  start: async () => {
    throw new Error('unsupported');
  },
  stop: async () => undefined,
  isRunning: async () => false,
  openSettings: async () => undefined,
  setListener: () => undefined,
};
