import { widgetView, type WidgetView } from '@fitnessapp/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayIso } from '@/lib/format';

import { readWidgetEnabled } from './widget-prefs';
import { widgetSnapshotStore } from './widget-store';

/**
 * Was das Widget JETZT zeigt (docs/PLAN-WIDGET.md 2.3): Schalter und gespeicherten Stand lesen, Regeln aus
 * packages/core (`widgetView`: aus, „App öffnen zum Aktualisieren“ nach 24 h, neuer Tag ohne Zahlen von gestern).
 * Läuft auch ohne geöffnete App (Hintergrund-Aufgabe des Widgets). Lesefehler → „App öffnen zum Aktualisieren“.
 */
export async function currentWidgetView(now: Date = new Date()): Promise<WidgetView> {
  const enabled = await readWidgetEnabled(AsyncStorage).catch(() => false);
  if (!enabled) return { kind: 'off' };
  const snapshot = await widgetSnapshotStore
    .read()
    .then((text) => (text === null ? null : (JSON.parse(text) as unknown)))
    .catch(() => null);
  return widgetView({ enabled, snapshot, nowMs: now.getTime(), today: todayIso(now) });
}
