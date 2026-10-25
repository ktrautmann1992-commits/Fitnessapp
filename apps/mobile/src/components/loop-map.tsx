import type { LatLng } from '@fitnessapp/core';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoopSketch } from '@/components/loop-sketch';
import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { type LoopMapLine, loopMapHtml, parseLoopMapMessage } from '@/lib/loop-map-html';
import { useThemeColors } from '@/lib/theme';

/**
 * Karte des Rundkurs-Vorschlags im Browser: abgeschottetes iframe (`sandbox="allow-scripts"`) mit maplibre-gl wie
 * route-map.tsx. Nachrichten nur aus DIESEM iframe (event.source). Lädt die Karte nicht, zeigt sie die Skizze der
 * Runden (ohne Kacheln). Gegenstück für iPhone/Android: loop-map.native.tsx.
 */
export interface LoopMapProps {
  lines: readonly LoopMapLine[];
  selected: number | null;
  start: LatLng | null;
  /** Tipp auf die Karte setzt den Startpunkt. */
  onPick?: (point: LatLng) => void;
  label?: string;
  testID?: string;
}

export function LoopMap({
  lines,
  selected,
  start,
  onPick,
  label,
  testID = 'loop-map',
}: LoopMapProps) {
  const theme = useThemeColors();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(
    () =>
      loopMapHtml({
        lines,
        selected,
        start,
        pickable: Boolean(onPick),
        label: label ?? t.loop.mapA11y,
      }),
    [lines, selected, start, onPick, label],
  );
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = parseLoopMapMessage(event.data);
      if (!message) return;
      if (message.kind === 'pick') pickRef.current?.(message.point);
      else setStatus(message.kind);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  if (!html) return null;
  return (
    <View testID={testID}>
      {status === 'failed' ? (
        <View style={styles.failed}>
          <LoopSketch lines={lines} selected={selected} start={start} testID={`${testID}-sketch`} />
          <Body muted style={styles.small} testID={`${testID}-failed`}>
            {t.loop.mapFailed}
          </Body>
        </View>
      ) : (
        <View style={[styles.frame, { borderColor: theme.border }]}>
          {createElement('iframe', {
            ref: frame,
            srcDoc: html,
            title: label ?? t.loop.mapA11y,
            sandbox: 'allow-scripts',
            referrerPolicy: 'no-referrer',
            style: { border: 0, width: '100%', height: '100%' },
            'data-testid': `${testID}-frame`,
          })}
        </View>
      )}
      <Body muted style={styles.small} testID={`${testID}-attribution`}>
        {t.loop.attribution}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 300, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  small: { fontSize: 12 },
  failed: { gap: 6 },
});
