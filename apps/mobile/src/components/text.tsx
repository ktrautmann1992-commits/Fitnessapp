import { scaledFontSize } from '@fitnessapp/core';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text as NativeText, type TextStyle } from 'react-native';

import { useLargeView } from '@/lib/accessibility';
import { appFont, fontWeightName } from '@/lib/fonts';

/**
 * Text mit App-Schrift (Plus Jakarta Sans) – Ersatz für `Text` aus react-native in allen Bildschirmen.
 *
 * Im Browser gilt die Schrift ohnehin für alles (public/index.html), hier ändert sich nichts. Auf iPhone/Android hat
 * jede Stärke einen eigenen Schriftnamen: Dieser Baustein liest die Stärke aus dem Stil (`fontWeight`) und hängt den
 * passenden Namen an (`appFont`). Hat der Stil schon eine eigene Schrift (`fontFamily`), bleibt sie.
 *
 * „Große Ansicht“ (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5): Schriftgröße und Zeilenhöhe ×1,25 (Faktor aus
 * packages/core). Die Systemschrift-Vergrößerung (iOS Dynamic Type, Android Schriftgröße) bleibt zusätzlich wirksam.
 */
export function Text(props: ComponentProps<typeof NativeText>) {
  const largeView = useLargeView();
  const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
  const scaled: TextStyle | null = largeView ? largeStyle(flat) : null;
  const style = scaled ? [props.style, scaled] : props.style;
  if (Platform.OS === 'web' || flat?.fontFamily) return <NativeText {...props} style={style} />;
  return <NativeText {...props} style={[style, appFont(fontWeightName(flat?.fontWeight))]} />;
}

/** Größere Schrift für die große Ansicht (ohne eigene Größe: Grundschrift 16 px). */
function largeStyle(flat: TextStyle | undefined): TextStyle {
  const size = typeof flat?.fontSize === 'number' ? flat.fontSize : 16;
  const out: TextStyle = { fontSize: scaledFontSize(size, true) };
  if (typeof flat?.lineHeight === 'number') out.lineHeight = scaledFontSize(flat.lineHeight, true);
  return out;
}
