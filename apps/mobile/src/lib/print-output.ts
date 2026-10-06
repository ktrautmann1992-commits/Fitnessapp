import type { PrintTarget } from './print-plan';

/**
 * Drucken im Browser (Web-Export, docs/PLAN-PDF-EXPORT.md §3 „Web“, Wächter B5): Die Druckansicht
 * (components/print-preview.tsx) hängt das Dokument für den Druck an die Seite; hier wird nur der
 * Druckdialog des Browsers geöffnet („Als PDF speichern“). Kein unsichtbares iframe (iOS-Safari).
 * Gegenstück für iPhone/Android: print-output.native.ts (expo-print).
 */
export const PRINT_TARGET: PrintTarget = 'web';

export type PrintOutcome = 'started' | 'cancelled';

export function printHtml(html: string): Promise<PrintOutcome> {
  void html; // Im Web druckt die Seite selbst (Druck-Kopie der Vorschau).
  window.print();
  return Promise.resolve('started');
}
