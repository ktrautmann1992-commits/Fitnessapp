import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';

import { renderTodayWidget, TODAY_WIDGET_NAME } from './today-widget.android';
import { currentWidgetView } from './widget-state';

/**
 * Android: Widget „Alpha5 – Heute“ (react-native-android-widget, docs/PLAN-WIDGET.md 5). Zwei Wege:
 * - Die App zeichnet alle Widgets neu, sobald sich Stand oder Schalter ändern (`refreshHomeWidgets`).
 * - Ohne geöffnete App ruft Android die Hintergrund-Aufgabe (`widgetTaskHandler`) beim Hinzufügen, bei Größenänderung
 *   und regelmäßig (updatePeriodMillis, app.config.ts) – sie liest den gespeicherten Stand und rechnet „zu alt“ bzw.
 *   „neuer Tag“ neu (packages/core `widgetView`). Kein Netz, keine Datenbank, keine Logs.
 */
export const WIDGET_SUPPORTED = true;

export async function refreshHomeWidgets(): Promise<void> {
  const view = await currentWidgetView();
  await requestWidgetUpdate({
    widgetName: TODAY_WIDGET_NAME,
    renderWidget: (info) => renderTodayWidget(view, info.width),
  });
}

export const widgetTaskHandler: WidgetTaskHandler = async ({
  widgetInfo,
  widgetAction,
  renderWidget,
}) => {
  if (widgetInfo.widgetName !== TODAY_WIDGET_NAME) return;
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const view = await currentWidgetView().catch(() => ({ kind: 'refresh' }) as const);
      renderWidget(renderTodayWidget(view, widgetInfo.width));
      return;
    }
    // Antippen öffnet die App über den Deep Link (OPEN_URI) – hier nichts zu tun; Entfernen: kein eigener Speicher.
    default:
      return;
  }
};
