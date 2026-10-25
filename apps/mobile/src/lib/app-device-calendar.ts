import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';

import { calendarDriver } from './calendar-driver';
import {
  createDeviceCalendar,
  DEFAULT_DEVICE_CALENDAR_PREFS,
  type DeviceCalendarPrefs,
} from './device-calendar';

/** Eine Instanz für die ganze App (Browser: kein Gerätekalender, iPhone/Android: expo-calendar). */
export const deviceCalendar = createDeviceCalendar(calendarDriver, deviceStore);

const listeners = new Set<() => void>();

/** Nach Ein-/Ausschalten oder neuer Uhrzeit: offene Ansichten und der Abgleich lesen die Einstellung neu. */
export function notifyDeviceCalendarChanged(): void {
  for (const listener of listeners) listener();
}

export function useDeviceCalendarPrefs(): {
  readonly loaded: boolean;
  readonly prefs: DeviceCalendarPrefs;
  reload(): Promise<void>;
} {
  const [prefs, setPrefs] = useState<DeviceCalendarPrefs>(DEFAULT_DEVICE_CALENDAR_PREFS);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      setPrefs(await deviceCalendar.loadPrefs());
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    const listener = () => void reload();
    listeners.add(listener);
    void reload();
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);
  return { loaded, prefs, reload };
}
