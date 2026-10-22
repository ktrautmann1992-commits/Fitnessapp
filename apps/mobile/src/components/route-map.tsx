import { createElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ui';
import { t } from '@/i18n';
import {
  isMapMessage,
  routeMapHtml,
  type MapColoredRun,
  type MapMessage,
} from '@/lib/route-map-html';
import { useThemeColors } from '@/lib/theme';

/**
 * Karte im Browser (Etappe E4): abgeschottetes iframe (`sandbox="allow-scripts"`, ohne Zugriff auf die App-Seite) mit
 * maplibre-gl. Gegenstück für iPhone/Android: route-map.native.tsx (WebView). Lädt die Karte nicht, bleibt ein Hinweis –
 * die Zahlen der Auswertung gelten trotzdem.
 */
export function RouteMap({
  points,
  colored = NO_RUNS,
  fallback,
}: {
  points: readonly { lat: number; lng: number }[];
  /** Linie stückweise nach Tempo eingefärbt (sonst einfarbig). */
  colored?: readonly MapColoredRun[];
  /** Ersatz, wenn die Karte nicht lädt (z. B. die Linien-Skizze) – darunter steht der Hinweis. */
  fallback?: ReactNode;
}) {
  const theme = useThemeColors();
  const html = useMemo(
    () => routeMapHtml(points, t.endurance.detail.mapA11y, colored),
    [points, colored],
  );
  const [status, setStatus] = useState<'loading' | MapMessage>('loading');
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = (event.data as { alpha5Map?: unknown } | null)?.alpha5Map;
      if (isMapMessage(message)) setStatus(message);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  if (!html) return null;
  return (
    <View testID="route-map">
      {status === 'failed' ? (
        <View style={styles.failed}>
          {fallback}
          <Body muted style={styles.attribution} testID="route-map-failed">
            {t.endurance.detail.mapFailed}
          </Body>
        </View>
      ) : (
        <View style={[styles.frame, { borderColor: theme.border }]}>
          {createElement('iframe', {
            srcDoc: html,
            title: t.endurance.detail.mapA11y,
            sandbox: 'allow-scripts',
            referrerPolicy: 'no-referrer',
            style: { border: 0, width: '100%', height: '100%' },
            'data-testid': 'route-map-frame',
          })}
        </View>
      )}
      <Body muted style={styles.attribution} testID="route-map-attribution">
        {t.endurance.detail.attribution}
      </Body>
    </View>
  );
}

const NO_RUNS: readonly MapColoredRun[] = [];

const styles = StyleSheet.create({
  frame: { height: 260, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  attribution: { fontSize: 12 },
  failed: { gap: 6 },
});
