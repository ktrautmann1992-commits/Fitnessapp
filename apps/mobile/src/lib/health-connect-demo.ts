import { addDays, WEARABLE_DATA_TYPES, type WearableDataType } from '@fitnessapp/core';

import type { HcReadResult, HealthConnectDriver } from './health-connect-driver.types';

/**
 * Beispiel-Uhr für den TESTMODUS (Phase 8, docs/PLAN-PHASE-8.md 9 „Browser: Testmodus mit Beispieldaten“): liefert
 * ausgedachte Daten der letzten 7 Tage – drei Läufe mit Puls, eine Kraft-Einheit, Yoga, Ruhepuls, Schlaf und
 * Schritte. Feste IDs je Tag: ein erneuter Abgleich ändert, legt nie doppelt an. Kein Netz, keine echten Daten.
 */

const at = (day: string, hhmm: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm).toISOString();
};

function heartRateSamples(
  start: string,
  minutes: number,
  base: number,
): { time: string; beatsPerMinute: number }[] {
  const t0 = Date.parse(start);
  return Array.from({ length: minutes * 6 }, (_, i) => ({
    time: new Date(t0 + i * 10_000).toISOString(),
    // Aufwärmen, gleichmäßiger Teil, Endspurt.
    beatsPerMinute: Math.round(
      i < 30 ? base - 30 + i : i > minutes * 6 - 30 ? base + 20 : base + ((i * 7) % 11) - 5,
    ),
  }));
}

/**
 * Schritte der letzten 7 Tage (älteste zuerst, letzter = heute): mal über, mal unter dem Standardziel 8.000 – heute
 * 6.240 (78 %), damit die Kachel „Schritte“ im Testmodus einen halb gefüllten Ring zeigt.
 */
export const DEMO_STEPS = [7400, 9100, 5600, 10_300, 8200, 11_900, 6240] as const;

/** Beispieldaten für den Zeitraum bis `today` (lokales Datum). */
export function demoRead(today: string, from: string, to: string): HcReadResult {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
  const inWindow = (iso: string) => iso >= from && iso <= to;
  const sessions: HcReadResult['sessions'][number][] = [];
  days.forEach((day, i) => {
    if (i % 2 === 0 && i < 6) {
      const start = at(day, '07:00');
      const end = at(day, '07:35');
      sessions.push({
        record: {
          id: `demo-run-${day}`,
          exerciseType: 56,
          startTime: start,
          endTime: end,
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: {
          distanceM: 5200 + i * 150,
          kcal: 380 + i * 5,
          heartRateSamples: heartRateSamples(start, 35, 150),
        },
      });
    }
    if (i === 3) {
      sessions.push({
        record: {
          id: `demo-kraft-${day}`,
          exerciseType: 70,
          startTime: at(day, '18:00'),
          endTime: at(day, '18:50'),
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: { kcal: 290, heartRateSamples: heartRateSamples(at(day, '18:00'), 50, 115) },
      });
    }
    if (i === 5) {
      sessions.push({
        record: {
          id: `demo-yoga-${day}`,
          exerciseType: 83,
          startTime: at(day, '19:00'),
          endTime: at(day, '19:30'),
          dataOrigin: 'com.sec.android.app.shealth',
        },
        extras: { kcal: 110 },
      });
    }
  });
  return {
    sessions: sessions.filter((s) => inWindow(s.record.startTime)),
    restingHeartRates: days
      .map((day, i) => ({ time: at(day, '06:30'), beatsPerMinute: 54 + (i % 3) }))
      .filter((r) => inWindow(r.time)),
    sleepSessions: days
      .map((day, i) => ({
        startTime: at(addDays(day, -1), '23:00'),
        endTime: at(day, i % 2 === 0 ? '06:45' : '06:15'),
        stages: [],
      }))
      .filter((s) => inWindow(s.endTime)),
    steps: days.map((day, i) => ({ day, count: DEMO_STEPS[i] ?? 0 })),
  };
}

export function createDemoHealthConnectDriver(today: () => string): HealthConnectDriver {
  return {
    kind: 'demo',
    availability: async () => 'available',
    requestPermissions: async (): Promise<WearableDataType[]> => [...WEARABLE_DATA_TYPES],
    // Beispiel-Uhr: nach dem Verbinden ist alles erlaubt (auch nach Neuladen der Seite).
    grantedTypes: async () => [...WEARABLE_DATA_TYPES],
    read: async (window) => demoRead(today(), window.from, window.to),
    openSettings: () => undefined,
    openInstall: () => undefined,
  };
}
