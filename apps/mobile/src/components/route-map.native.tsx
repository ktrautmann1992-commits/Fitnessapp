import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { isMapMessage, routeMapHtml, type MapMessage } from '@/lib/route-map-html';
import { useThemeColors } from '@/lib/theme';

/**
 * Karte auf iPhone/Android (Etappe E4): maplibre-gl in einer WebView (react-native-webview, von Expo SDK 57
 * mitgeliefert) statt eines nativen Karten-Moduls – Build-Sicherheit (E3-Entscheidung). Die WebView öffnet keine
 * anderen Seiten (Tipps auf Links werden blockiert), speichert nichts und lädt nur Karte und Kacheln.
 */
export function RouteMap({ points }: { points: readonly { lat: number; lng: number }[] }) {
  const theme = useThemeColors();
  const html = useMemo(() => routeMapHtml(points, t.endurance.detail.mapA11y), [points]);
  const [status, setStatus] = useState<'loading' | MapMessage>('loading');
  // Gleiches Objekt bei gleichem HTML – sonst lädt die WebView bei jedem Rendern neu.
  const source = useMemo(() => (html ? { html } : null), [html]);
  if (!html || !source) return null;
  return (
    <View testID="route-map">
      {status === 'failed' ? (
        <Body muted testID="route-map-failed">
          {t.endurance.detail.mapFailed}
        </Body>
      ) : (
        <View
          style={[styles.frame, { borderColor: theme.border }]}
          accessible
          accessibilityLabel={t.endurance.detail.mapA11y}
        >
          <WebView
            originWhitelist={['about:blank', 'https://*']}
            source={source}
            javaScriptEnabled
            domStorageEnabled={false}
            incognito
            cacheEnabled
            setSupportMultipleWindows={false}
            allowsLinkPreview={false}
            onShouldStartLoadWithRequest={(request) =>
              request.url === 'about:blank' || request.url.startsWith('data:')
            }
            onMessage={(event) => {
              if (isMapMessage(event.nativeEvent.data)) setStatus(event.nativeEvent.data);
            }}
            onError={() => setStatus('failed')}
            onHttpError={() => undefined}
            style={styles.web}
          />
        </View>
      )}
      <Body muted style={styles.attribution} testID="route-map-attribution">
        {t.endurance.detail.attribution}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 260, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  attribution: { fontSize: 12 },
});
