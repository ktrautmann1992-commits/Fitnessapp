import { areaColors, cardColors, fontSize, maxContentWidth, spacing } from '@fitnessapp/ui';
import { highlightedTab, type NavArea } from '@fitnessapp/core';
import { createContext, useContext } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/design';
import { t } from '@/i18n';
import { NAV_AREA_STYLE } from '@/lib/area-style';
import { appFont } from '@/lib/fonts';
import { useAppLayout } from '@/state/use-app-layout';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Untere Menüleiste (docs/PLAN-DASHBOARD.md 3; seit 20.10.2026 docs/PLAN-EINKAUFEN-AUSDAUER.md EA-1 und 4): die
 * Knöpfe kommen aus der Anordnung der Person (`useAppLayout`, Regeln in packages/core/src/layout.ts) – Standard
 * seit „App verschlanken“ (26.10.2026) Heute · Training · Ernährung · Einkaufen · Mehr. „Workouts“, „Wettkampf“ und
 * „Fortschritt“ sind wählbar (sonst im Training bzw. unter „Mehr“). Ist ein Bereich ohne Knopf geöffnet, ist sein
 * Reiter markiert (Workouts → Training, Wettkampf/Fortschritt → Mehr, packages/core `highlightedTab`), sonst keiner.
 * Bei 6 Knöpfen etwas kleinere Schrift und Symbol-Fläche, damit es auch auf 320 px breiten Handys passt. Farben aus
 * den Design-Tokens (hell/dunkel), Tippfläche ≥ 56 px, für Bildschirmleser Rolle „Tab“ mit „ausgewählt“.
 * Aussehen seit 20.10.2026 wie Entwurf „Übersicht neu“: Strich-Icons je Bereich (lib/area-style.ts), der aktive Knopf
 * hat eine Pille in der Bereichsfarbe (Fläche `surface`, Icon und Beschriftung `icon`, fett).
 */

/** true = Bildschirm liegt in einem Reiter; die Leiste übernimmt den unteren Rand (Screen ohne Abstand unten). */
export const InTabsContext = createContext(false);

export function useInTabs(): boolean {
  return useContext(InTabsContext);
}

export type TabName = NavArea;

export function tabLabel(name: TabName): string {
  switch (name) {
    case 'uebersicht':
      return t.tabs.overview;
    case 'today':
      return t.tabs.training;
    case 'workouts':
      return t.workouts.tab;
    case 'ernaehrung':
      return t.tabs.nutrition;
    case 'einkaufsliste':
      return t.tabs.shopping;
    case 'wettkampf':
      return t.tabs.competition;
    case 'fortschritt':
      return t.tabs.progress;
    case 'mehr':
      return t.tabs.more;
  }
}

/** Mindestangaben aus BottomTabBarProps (expo-router/tabs), damit die Leiste ohne Navigator testbar bleibt. */
export interface TabBarProps {
  state: { index: number; routes: readonly { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
}

export function TabBar({ state, navigation }: TabBarProps) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const insets = useSafeAreaInsets();
  const { layout } = useAppLayout();
  const routes = layout.tabs
    .map((name) => state.routes.find((route) => route.name === name))
    .filter((route): route is { key: string; name: TabName } => route !== undefined);
  const compact = routes.length >= 6;
  // Unterbereiche markieren ihren Reiter (Workouts → Training, Wettkampf/Fortschritt → Mehr; packages/core).
  const openName = state.routes[state.index]?.name;
  const focusedName = highlightedTab(layout.tabs, openName);
  return (
    <View
      role="tablist"
      aria-label={t.tabs.label}
      accessibilityLabel={t.tabs.label}
      testID="tab-bar"
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: cardColors[scheme].border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 0 : spacing.xs),
        },
      ]}
    >
      <View style={styles.inner}>
        {routes.map((route) => {
          const focused = route.name === focusedName;
          const style = NAV_AREA_STYLE[route.name];
          const palette = areaColors[scheme][style.area];
          const color = focused ? palette.icon : theme.textMuted;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            // Markiert, aber gerade ein Unterbereich offen (z. B. Workouts unter „Training“) → zum Reiter wechseln.
            if (route.name !== openName && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tabLabel(route.name)}
              accessibilityState={{ selected: focused }}
              aria-selected={focused}
              onPress={onPress}
              testID={`tab-${route.name}`}
              style={({ pressed }) => [
                styles.item,
                compact && styles.itemCompact,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.pill,
                  compact && styles.pillCompact,
                  focused && { backgroundColor: palette.surface },
                ]}
              >
                <Icon name={style.icon} size={20} color={color} strokeWidth={focused ? 2.2 : 2} />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  // Bei 6 Knöpfen bleibt die Schrift halbfett (sonst passt z. B. „Wettkampf“ auf 320 px nicht ganz);
                  // markiert ist der Knopf dann über Fläche, Farbe und „ausgewählt“.
                  appFont(focused && !compact ? 'bold' : 'semibold'),
                  compact && styles.labelCompact,
                  { color },
                ]}
              >
                {tabLabel(route.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: maxContentWidth,
  },
  item: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs + 2,
    gap: 2,
  },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.sm - 2,
  },
  // Bei 6 Knöpfen bekommt jeder Knopf seine Wortbreite plus einen gleichen Anteil vom Rest – lange Namen wie
  // „Wettkampf“ oder „Fortschritt“ passen so auch auf 320 px (gleich breite Spalten wären dort zu schmal).
  itemCompact: {
    flexBasis: 'auto',
    minWidth: 44,
  },
  pillCompact: {
    width: 44,
  },
  labelCompact: {
    fontSize: fontSize.sm - 3,
    // Plus Jakarta Sans läuft breiter: so passen „Fortschritt“/„Wettkampf“ bei 6 Knöpfen auf 320 px.
    letterSpacing: -0.3,
  },
});
