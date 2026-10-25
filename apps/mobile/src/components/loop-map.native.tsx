import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { LoopSketch } from '@/components/loop-sketch';
import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { loopMapHtml, parseLoopMapMessage } from '@/lib/loop-map-html';
import { useThemeColors } from '@/lib/theme';

import type { LoopMapProps } from './loop-map';

/**
 * Karte des Rundkurs-Vorschlags auf iPhone/Android: maplibre-gl in einer WebView wie route-map.native.tsx (öffnet
 * keine anderen Seiten, speichert nichts). Lädt die Karte nicht, zeigt sie die Skizze der Runden.
 */
export function LoopMap({
  lines,
  selected,
  start,
  onPick,
  label,
  testID = 'loop-map',
}: LoopMapProps) {
  const theme = useThemeColors();
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
  const source = useMemo(() => (html ? { html } : null), [html]);
  if (!html || !source) return null;
  return (
    <View testID={testID}>
      {status === 'failed' ? (
        <View style={styles.failed}>
          <LoopSketch lines={lines} selected={selected} start={start} testID={`${testID}-sketch`} />
          <Body muted style={styles.small}>
            {t.loop.mapFailed}
          </Body>
        </View>
      ) : (
        <View
          style={[styles.frame, { borderColor: theme.border }]}
          accessible={!onPick}
          accessibilityLabel={label ?? t.loop.mapA11y}
        >
          <WebView
            originWhitelist={['about:blank', 'https://*']}
            source={source}
            javaScriptEnabled
            domStorageEnabled={false}
            incognito
            cacheEnabled
            setSupportMultipleWindows={false}
            nestedScrollEnabled
            allowsLinkPreview={false}
            onShouldStartLoadWithRequest={(request) =>
              request.url === 'about:blank' || request.url.startsWith('data:')
            }
            onMessage={(event) => {
              const message = parseLoopMapMessage(event.nativeEvent.data);
              if (!message) return;
              if (message.kind === 'pick') onPick?.(message.point);
              else setStatus(message.kind);
            }}
            onError={() => setStatus('failed')}
            onHttpError={() => undefined}
            style={styles.web}
          />
        </View>
      )}
      <Body muted style={styles.small}>
        {t.loop.attribution}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 300, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  small: { fontSize: 12 },
  failed: { gap: 6 },
});
