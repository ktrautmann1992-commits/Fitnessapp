import { useEffect, useMemo, useRef } from 'react';

import { desiredCalendarEvents } from '@/data/review';
import { deviceCalendar, useDeviceCalendarPrefs } from '@/lib/app-device-calendar';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';

/**
 * Hält den Handy-Kalender „Alpha5 Training“ aktuell (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4): Nach jeder Änderung
 * am Plan (neu erstellt, getauscht, verschoben, erledigt, gestrichen) und beim Tageswechsel werden die Termine
 * abgeglichen – nur, wenn die Person es eingeschaltet hat. Abgemeldet bzw. Konto gelöscht → Kalender entfernen.
 * Im Browser tut die Komponente nichts (kein Gerätekalender). Fehler werden still verworfen (nie Inhalte loggen); die
 * Einstellungen zeigen den Stand.
 */
export function TrainingCalendarSync() {
  const app = useApp();
  const today = useToday();
  const { loaded, prefs } = useDeviceCalendarPrefs();
  const ready = app.status.kind === 'ready';
  const signedOut = ready && app.session === null;
  const rows = app.rows;
  const events = useMemo(
    () => (rows && prefs.enabled ? desiredCalendarEvents(rows, today, prefs.startMinutes) : null),
    [rows, prefs.enabled, prefs.startMinutes, today],
  );
  const key = events === null ? null : JSON.stringify(events);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceCalendar.supported || !loaded || !prefs.enabled) return;
    if (signedOut) {
      last.current = null;
      void deviceCalendar.disable().catch(() => undefined);
      return;
    }
    if (!ready || events === null || key === null || key === last.current) return;
    last.current = key;
    void deviceCalendar.sync(events).catch(() => {
      last.current = null;
    });
  }, [events, key, loaded, prefs.enabled, ready, signedOut]);

  return null;
}
