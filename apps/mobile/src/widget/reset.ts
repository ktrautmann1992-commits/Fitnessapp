import { refreshHomeWidgets } from './widget-bridge';
import { resetWidgetPrefs } from './widget-prefs';
import { widgetSnapshotStore } from './widget-store';

/**
 * Abmelden, Konto löschen, „Testdaten löschen“ (docs/PLAN-WIDGET.md 3): Schalter aus, Stand samt Schlüssel löschen,
 * Widget auf „Widget aus“ stellen. Fehler bleiben folgenlos (das Widget zeigt dann spätestens nach 24 h „App öffnen“).
 */
export async function resetHomeWidget(): Promise<void> {
  await resetWidgetPrefs().catch(() => undefined);
  await widgetSnapshotStore.clear().catch(() => undefined);
  await refreshHomeWidgets().catch(() => undefined);
}
