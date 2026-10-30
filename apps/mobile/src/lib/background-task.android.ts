import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

/**
 * Abgleich im Hintergrund (Gründer-Freigabe 30.10.2026, docs/PLAN-PHASE-8.md 13.6) – ANDROID: expo-background-task
 * (WorkManager, nur mit Netz; den Takt bestimmt das Betriebssystem, mindestens 15 min) + expo-task-manager.
 * iPhone und Browser nutzen background-task.ts (still): Auf dem iPhone gibt es kein Health Connect; das native Modul
 * ist dort vom Autolinking ausgenommen (package.json → expo.autolinking.ios.exclude), weil es sonst beim Start eine
 * BGTask-Kennung ohne Eintrag in der Info.plist anmelden würde (kein Plugin, kein iOS-Hintergrundmodus „processing“).
 * Gelesene Werte nie loggen: Die Aufgabe meldet nur Erfolg/Fehler ohne Inhalt.
 */
export const WEARABLE_BACKGROUND_TASK = 'alpha5-wearable-background-sync';

/**
 * Beim Start des JS-Bündels (index.ts) die Aufgabe bekannt machen – Pflicht, damit Android sie auch ohne geöffnete
 * App ausführen kann. `run` liefert true = erledigt (auch „nichts zu tun“), false = fehlgeschlagen.
 */
export function defineWearableBackgroundTask(run: () => Promise<boolean>): void {
  if (TaskManager.isTaskDefined(WEARABLE_BACKGROUND_TASK)) return;
  TaskManager.defineTask(WEARABLE_BACKGROUND_TASK, async () => {
    try {
      return (await run())
        ? BackgroundTask.BackgroundTaskResult.Success
        : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      // Ohne Inhalt (Art. 9): kein Fehlertext, keine Werte.
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Anmelden (Intervall in Minuten, Untergrenze 15) bzw. abmelden. Schon angemeldet → bleibt unverändert (der Takt
 * läuft weiter; expo-background-task meldet nicht doppelt an).
 */
export async function setWearableBackgroundTask(
  register: boolean,
  minimumIntervalMinutes: number,
): Promise<void> {
  if (register) {
    if (!TaskManager.isTaskDefined(WEARABLE_BACKGROUND_TASK)) return;
    await BackgroundTask.registerTaskAsync(WEARABLE_BACKGROUND_TASK, {
      minimumInterval: minimumIntervalMinutes,
    });
  } else {
    await BackgroundTask.unregisterTaskAsync(WEARABLE_BACKGROUND_TASK);
  }
}
