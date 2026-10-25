import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widget-bridge.android';

/**
 * Android: Hintergrund-Aufgabe des Widgets anmelden (docs/PLAN-WIDGET.md 5) – muss beim Start des JS-Bündels laufen
 * (index.ts), damit Android das Widget auch ohne geöffnete App zeichnen kann.
 */
export function registerHomeWidget(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
}
