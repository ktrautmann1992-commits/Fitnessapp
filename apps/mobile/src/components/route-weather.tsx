import {
  type RouteWeather,
  type TrackedRouteRow,
  weatherCodeText,
  weatherDetails,
  weatherLine,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';

import { SectionLabel } from '@/components/design';
import { ToggleRow } from '@/components/my-routes';
import { Text } from '@/components/text';
import { Body, Button, Card } from '@/components/ui';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';
import { useRouteWeatherSetting } from '@/state/use-route-weather';
import { forgetTrackedRoutes } from '@/state/use-tracked-routes';

const W = t.endurance.weather;

/** Kurze Wetter-Zeile („🌦️ 12 °C · Wind 18 km/h · leichter Regen“); Symbol für Bildschirmleser ausgeblendet. */
export function WeatherLine({
  weather,
  details = false,
  testID = 'route-weather',
}: {
  weather: RouteWeather;
  details?: boolean;
  testID?: string;
}) {
  const theme = useThemeColors();
  const line = weatherLine(weather);
  const icon = weatherCodeText(weather.code)?.icon ?? '🌡️';
  const more = details ? weatherDetails(weather) : [];
  return (
    <View accessible accessibilityLabel={W.a11y([line, ...more].join(', '))} testID={testID}>
      <Text style={[styles.line, appFont('semibold'), { color: theme.text }]}>
        <Text aria-hidden>{`${icon} `}</Text>
        {line}
      </Text>
      {more.length > 0 ? (
        <Text style={[styles.small, { color: theme.textMuted }]}>{more.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

/**
 * Lauf-Detail: Wetter zum Start. Noch nicht gefragt → einmaliger Hinweis mit Ja/Nein; abgelehnt → nichts; an und
 * kein Wetter → „Wetter nicht verfügbar“ (still, kein Fehlerton).
 */
export function RouteWeatherSection({ route }: { route: TrackedRouteRow }) {
  const theme = useThemeColors();
  const setting = useRouteWeatherSetting();
  if (!setting.loaded) return null;
  if (route.weather) {
    return (
      <Card>
        <View style={styles.gap}>
          <SectionLabel>{W.title}</SectionLabel>
          <WeatherLine weather={route.weather} details />
          <Text style={[styles.tiny, { color: theme.textMuted }]}>{W.attribution}</Text>
        </View>
      </Card>
    );
  }
  if (setting.enabled === null) {
    return (
      <Card>
        <View style={styles.gap} testID="weather-ask">
          <SectionLabel>{W.askTitle}</SectionLabel>
          <Body>{W.askText}</Body>
          <Button
            label={W.askYes}
            onPress={() =>
              void setting.set(true).then(() => {
                forgetTrackedRoutes();
              })
            }
            testID="weather-ask-yes"
          />
          <Button
            label={W.askNo}
            variant="secondary"
            onPress={() => void setting.set(false)}
            testID="weather-ask-no"
          />
        </View>
      </Card>
    );
  }
  if (setting.enabled === false) return null;
  return (
    <Body muted testID="route-weather-unavailable">
      {W.unavailable}
    </Body>
  );
}

/** Einstellungen: Schalter „Wetter zu Läufen anzeigen“. */
export function WeatherSettings() {
  const setting = useRouteWeatherSetting();
  return (
    <>
      <SectionLabel>{W.settingsTitle}</SectionLabel>
      <Card>
        <ToggleRow
          label={W.settingsToggle}
          value={setting.enabled === true}
          disabled={!setting.loaded}
          onChange={(value) =>
            void setting.set(value).then(() => {
              if (value) forgetTrackedRoutes();
            })
          }
          testID="settings-weather"
        />
        <Body muted>{W.settingsText}</Body>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  line: { fontSize: fontSize.md },
  small: { fontSize: fontSize.sm },
  tiny: { fontSize: fontSize.xs },
});
