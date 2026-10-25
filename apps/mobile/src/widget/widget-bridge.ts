/**
 * Verbindung zum Widget auf dem Startbildschirm (docs/PLAN-WIDGET.md). Browser und iPhone: kein Widget (iPhone folgt,
 * docs/PLAN-WIDGET.md 7) – alles ohne Wirkung. Android: widget-bridge.android.ts.
 */
export const WIDGET_SUPPORTED = false;

/** Alle Widgets „Alpha5 – Heute“ neu zeichnen (aus Schalter und gespeichertem Stand). */
export async function refreshHomeWidgets(): Promise<void> {
  // Kein Widget auf dieser Plattform.
}
