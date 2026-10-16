import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

/**
 * Schrittwechsel im Intervall-Timer (Etappe WP4) – APP (iOS/Android): Vibration (expo-haptics, wie der Pausentimer)
 * und Ansage für den Bildschirmleser. Läuft, solange die App offen ist; der Bildschirm bleibt im Trainingsmodus an
 * (expo-keep-awake). Hintergrund-Mitteilungen bräuchten expo-notifications (offene Gründer-Frage aus N5b).
 */
export function alertStepChange(text: string): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  AccessibilityInfo.announceForAccessibility(text);
}
