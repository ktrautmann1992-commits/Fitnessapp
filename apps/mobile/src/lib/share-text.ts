/**
 * Text weitergeben im Browser (Web-Export, Etappe N12, docs/PLAN-PHASE-5.md 19.7 N12): zuerst der Teilen-Dialog des
 * Systems (Web Share API, z. B. Android-Chrome, iOS-Safari), sonst Kopieren in die Zwischenablage, sonst „manuell“
 * (die Ansicht zeigt den Text zum Markieren). Nichts wird hochgeladen, gespeichert oder geloggt – der Text geht nur
 * dorthin, wohin die Person ihn selbst schickt. Gegenstück für iPhone/Android: share-text.native.ts (React-Native-
 * `Share`).
 */

/** Ob es einen eigenen „Kopieren“-Knopf gibt (nativ bietet der Teilen-Dialog selbst „Kopieren“ an). */
export const COPY_AVAILABLE = true;

/**
 * `opened` = Teilen-Dialog wurde geöffnet, ob wirklich weitergegeben wurde, ist unbekannt (Android, Wächter N12 S2).
 */
export type ShareOutcome = 'shared' | 'opened' | 'copied' | 'cancelled' | 'manual';

interface ShareNavigator {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  canShare?: (data: { title?: string; text?: string }) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

function browserNavigator(): ShareNavigator | null {
  return typeof navigator === 'undefined' ? null : (navigator as unknown as ShareNavigator);
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

/** In die Zwischenablage kopieren; ohne Zwischenablage (unsicherer Kontext, verweigert) → „manuell“. */
export async function copyText(text: string): Promise<ShareOutcome> {
  const clipboard = browserNavigator()?.clipboard;
  if (typeof clipboard?.writeText !== 'function') return 'manual';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'manual';
  }
}

/**
 * Teilen-Dialog, wenn der Browser ihn hat; Abbrechen durch die Person ist kein Fehler. Kann der Browser nicht teilen
 * (keine API, `canShare` verneint, Fehler außer Abbrechen) → Kopieren als Rückfall.
 */
export async function shareText(text: string, title: string): Promise<ShareOutcome> {
  const nav = browserNavigator();
  const data = { title, text };
  if (
    typeof nav?.share === 'function' &&
    (typeof nav.canShare !== 'function' || nav.canShare(data))
  ) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // z. B. NotAllowedError ohne Nutzer-Geste – weiter mit Kopieren.
    }
  }
  return copyText(text);
}
