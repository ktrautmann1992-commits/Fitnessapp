import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import { t } from '@/i18n';

/**
 * Hinweis, wenn beim Kochtag ein neuer Schritt beginnt (Etappe N5b) – APP (iOS/Android): Vibration und Ansage für den
 * Bildschirmleser, solange die App geöffnet ist (wie der Pausentimer, docs/PLAN-PHASE-4.md 6.2). Mitteilungen im
 * Hintergrund bräuchten `expo-notifications` (neue native Abhängigkeit mit Mitteilungs-Erlaubnis) – offene
 * Gründer-Entscheidung, siehe docs/PLAN-PHASE-5.md Umsetzungsstand N5b. Die Timer rechnen mit Zeitstempeln und laufen
 * nach dem Öffnen richtig weiter.
 */
export type CookAlertMode = 'notify' | 'in_app';

export async function prepareCookAlerts(): Promise<CookAlertMode> {
  return 'in_app';
}

export function currentCookAlertMode(): CookAlertMode {
  return 'in_app';
}

export function alertCookStep(text: string): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  AccessibilityInfo.announceForAccessibility(`${t.nutrition.cookDay.notifyTitle}: ${text}`);
}

export function cookAlertNote(mode: CookAlertMode): string {
  return mode === 'notify' ? t.nutrition.cookDay.notifyOn : t.nutrition.cookDay.notifyOff;
}
