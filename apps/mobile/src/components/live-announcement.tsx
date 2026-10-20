import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { Text } from '@/components/text';

/**
 * Unsichtbare Ansage für Bildschirmleser (Etappe E2: „Ernährung ist jetzt an Stelle 2 von 5“). Browser/Android:
 * Live-Region (aria-live="polite"); iPhone-App: Ansage über VoiceOver. Sichtbar bleibt nichts.
 */
export function LiveAnnouncement({ text, testID }: { text: string; testID?: string }) {
  useEffect(() => {
    if (text !== '' && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
  return (
    <Text aria-live="polite" accessibilityLiveRegion="polite" style={styles.live} testID={testID}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  live: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
