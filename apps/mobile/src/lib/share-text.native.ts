import { Platform, Share } from 'react-native';

import type { ShareOutcome } from './share-text';

/**
 * Text weitergeben auf iPhone/Android (Etappe N12): der System-Teilen-Dialog von React Native (`Share`, keine neue
 * native Abhängigkeit). „Kopieren“ bietet der Dialog selbst an, deshalb kein eigener Knopf. Nichts wird hochgeladen,
 * gespeichert oder geloggt. Gegenstück für den Browser: share-text.ts.
 */
export type { ShareOutcome } from './share-text';

export const COPY_AVAILABLE = false;

export function copyText(text: string): Promise<ShareOutcome> {
  void text;
  return Promise.resolve('manual');
}

export async function shareText(text: string, title: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share(
      { message: text, title },
      { dialogTitle: title, subject: title },
    );
    if (result.action === Share.dismissedAction) return 'cancelled';
    // Android meldet immer „geteilt“ – auch wenn der Dialog ohne Ziel geschlossen wurde (Wächter N12 S2). Dort
    // deshalb nur neutral „Teilen-Dialog geöffnet“, nie eine Erfolgsbestätigung.
    return Platform.OS === 'android' ? 'opened' : 'shared';
  } catch {
    // Keine Details (der Text ist die Einkaufsliste der Person).
    throw new Error('share_failed');
  }
}
