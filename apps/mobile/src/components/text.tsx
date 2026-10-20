import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text as NativeText } from 'react-native';

import { appFont, fontWeightName } from '@/lib/fonts';

/**
 * Text mit App-Schrift (Plus Jakarta Sans) – Ersatz für `Text` aus react-native in allen Bildschirmen.
 *
 * Im Browser gilt die Schrift ohnehin für alles (public/index.html), hier ändert sich nichts. Auf iPhone/Android hat
 * jede Stärke einen eigenen Schriftnamen: Dieser Baustein liest die Stärke aus dem Stil (`fontWeight`) und hängt den
 * passenden Namen an (`appFont`). Hat der Stil schon eine eigene Schrift (`fontFamily`), bleibt sie.
 */
export function Text(props: ComponentProps<typeof NativeText>) {
  if (Platform.OS === 'web') return <NativeText {...props} />;
  const flat = StyleSheet.flatten(props.style);
  if (flat?.fontFamily) return <NativeText {...props} />;
  return <NativeText {...props} style={[props.style, appFont(fontWeightName(flat?.fontWeight))]} />;
}
