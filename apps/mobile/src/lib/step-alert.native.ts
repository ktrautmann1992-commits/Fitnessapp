import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Schrittwechsel im Intervall-Timer (Etappe WP4) – APP (iOS/Android): Vibration (expo-haptics, wie der Pausentimer)
 * und Ansage für den Bildschirmleser (nur iOS – Android nutzt die Live-Region). Läuft, solange die App offen ist; der Bildschirm bleibt im Trainingsmodus an
 * (expo-keep-awake). Hintergrund-Mitteilungen bräuchten expo-notifications (offene Gründer-Frage aus N5b).
 */
export function alertStepChange(text: string): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  // Android sagt die Live-Region des Timers schon an (accessibilityLiveRegion) – sonst käme es doppelt (Wächter N1).
  // iOS kennt keine Live-Regionen, dort sagt announceForAccessibility an.
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
}
