import { brandColors, fontSize, fontWeight, maxContentWidth, spacing } from '@fitnessapp/ui';
import type { NavArea } from '@fitnessapp/core';
import { createContext, useContext } from 'react';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { useAppLayout } from '@/state/use-app-layout';
import { useThemeColors } from '@/lib/theme';

/**
 * Untere Menüleiste (docs/PLAN-DASHBOARD.md 3; seit 20.10.2026 docs/PLAN-EINKAUFEN-AUSDAUER.md EA-1 und 4): die
 * Knöpfe kommen aus der Anordnung der Person (`useAppLayout`, Regeln in packages/core/src/layout.ts) – Standard
 * Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr (Workouts nur, wenn der Bereich vorhanden ist).
 * „Fortschritt“ steht als Kachel und unter „Mehr“. Ist ein Bereich ohne Knopf geöffnet, ist kein Knopf markiert.
 * Bei 6 Knöpfen etwas kleinere Schrift und Symbol-Fläche, damit es auch auf 320 px breiten Handys passt. Farben aus
 * den Design-Tokens (hell/dunkel), Tippfläche ≥ 56 px, für Bildschirmleser Rolle „Tab“ mit „ausgewählt“.
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
    case 'ernaehrung':
      return t.tabs.nutrition;
    case 'einkaufsliste':
      return t.tabs.shopping;
    case 'workouts':
      return t.tabs.workouts;
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
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { layout } = useAppLayout();
  const routes = layout.tabs
    .map((name) => state.routes.find((route) => route.name === name))
    .filter((route): route is { key: string; name: TabName } => route !== undefined);
  const compact = routes.length >= 6;
  const focusedName = state.routes[state.index]?.name;
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
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 0 : spacing.xs),
        },
      ]}
    >
      <View style={styles.inner}>
        {routes.map((route) => {
          const focused = route.name === focusedName;
          const color = focused ? theme.link : theme.textMuted;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
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
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[
                  styles.pill,
                  compact && styles.pillCompact,
                  focused && {
                    backgroundColor: dark ? brandColors.graphitHell : brandColors.eisblau,
                  },
                ]}
              >
                <TabIcon name={route.name} color={color} />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  compact && styles.labelCompact,
                  { color: focused ? theme.text : theme.textMuted },
                  focused && styles.labelFocused,
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

/** Svg ist für Bildschirmleser unsichtbar – die Beschriftung trägt der Knopf. */
const HIDDEN = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Einfache Linien-Symbole (24 × 24), eigene Vektoren statt Symbol-Schrift. */
function TabIcon({ name, color }: { name: TabName; color: string }) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;
  return (
    <Svg {...HIDDEN} width={24} height={24} viewBox="0 0 24 24">
      {name === 'uebersicht' ? (
        <>
          <Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} {...stroke} />
          <Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} {...stroke} />
          <Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} {...stroke} />
          <Rect x={13.5} y={13.5} width={7} height={7} rx={1.5} {...stroke} />
        </>
      ) : name === 'today' ? (
        <>
          <Path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" {...stroke} />
        </>
      ) : name === 'ernaehrung' ? (
        <>
          <Path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" {...stroke} />
          <Path d="M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17" {...stroke} />
        </>
      ) : name === 'workouts' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M10 8.5v7l5.5-3.5z" {...stroke} />
        </>
      ) : name === 'einkaufsliste' ? (
        <>
          <Path
            d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6.4"
            {...stroke}
          />
          <Circle cx={9.5} cy={19.5} r={1.4} fill={color} />
          <Circle cx={17} cy={19.5} r={1.4} fill={color} />
        </>
      ) : name === 'fortschritt' ? (
        <>
          <Path d="M4 20h16" {...stroke} />
          <Path d="M7 16v-4M12 16V8M17 16V5" {...stroke} />
        </>
      ) : (
        <>
          <Circle cx={5.5} cy={12} r={1.6} fill={color} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
          <Circle cx={18.5} cy={12} r={1.6} fill={color} />
        </>
      )}
    </Svg>
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
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.sm - 2,
    fontWeight: fontWeight.semibold,
  },
  pillCompact: {
    width: 44,
  },
  labelCompact: {
    fontSize: fontSize.sm - 3,
  },
  labelFocused: {
    fontWeight: fontWeight.bold,
  },
});
