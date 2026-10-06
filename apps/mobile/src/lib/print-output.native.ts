import * as Print from 'expo-print';

import type { PrintOutcome } from './print-output';
import type { PrintTarget } from './print-plan';

/**
 * Drucken auf iPhone/Android (docs/PLAN-PDF-EXPORT.md §3 „Nativ“, Wächter B2–B4): `Print.printAsync` öffnet den
 * System-Druckdialog; dort „Drucken“ oder „Als PDF sichern“. Bewusst KEIN printToFileAsync, kein Teilen-Menü der
 * App, keine Datei im Cache (kein expo-sharing/expo-file-system) – CLAUDE.md „Kein Teilen“, DSGVO Art. 9.
 * A4 = 595 × 842 pt (B3); die Ränder stehen im HTML.
 */
export const PRINT_TARGET: PrintTarget = 'native';

/** A4 hochkant in Punkt (1/72 Zoll). */
export const A4_PORTRAIT = { width: 595, height: 842 } as const;

/** iOS: Druckdialog ohne Drucken geschlossen (expo-print PrintIncompleteException). */
const CANCELLED_CODES = new Set(['ERR_PRINT_INCOMPLETE']);

export async function printHtml(html: string): Promise<PrintOutcome> {
  try {
    await Print.printAsync({ html, ...A4_PORTRAIT });
    return 'started';
  } catch (caught) {
    const code = (caught as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && CANCELLED_CODES.has(code)) return 'cancelled';
    // Nur den Code weitergeben – nie das HTML oder Plan-Inhalte (keine Gesundheitsdaten in Logs); darum bewusst
    // ohne `cause` (die Original-Meldung kann Teile des Dokuments enthalten).
    // eslint-disable-next-line preserve-caught-error
    throw new Error(typeof code === 'string' ? `print_failed:${code}` : 'print_failed');
  }
}
