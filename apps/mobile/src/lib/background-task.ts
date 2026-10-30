/**
 * Abgleich im Hintergrund (docs/PLAN-PHASE-8.md 13.6) – BROWSER (Web-Export) und iPhone: keine Hintergrund-Aufgabe,
 * kein Health Connect. Alles still; die Android-Fassung steht in background-task.android.ts.
 */
export const WEARABLE_BACKGROUND_TASK = 'alpha5-wearable-background-sync';

export function defineWearableBackgroundTask(_run: () => Promise<boolean>): void {
  // Absichtlich leer.
}

export async function setWearableBackgroundTask(
  _register: boolean,
  _minimumIntervalMinutes: number,
): Promise<void> {
  // Absichtlich leer.
}
