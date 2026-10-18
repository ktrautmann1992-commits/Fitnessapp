import { Tabs } from 'expo-router/tabs';

import { InTabsContext, TabBar, tabLabel } from '@/components/tab-bar';
import { useThemeColors } from '@/lib/theme';

/**
 * Hauptbereiche mit unterer Menüleiste (docs/PLAN-DASHBOARD.md 3). Die Gruppe „(tabs)“ ändert keine Adresse:
 * `/uebersicht`, `/today`, `/ernaehrung`, `/fortschritt`, `/mehr`. Alle anderen Bildschirme liegen im Stapel darüber
 * (ohne Leiste, mit „Zurück“) – Onboarding, Anmelden, Training durchführen und Druckansichten bleiben vollflächig.
 */
export default function TabsLayout() {
  const theme = useThemeColors();
  return (
    <InTabsContext.Provider value>
      <Tabs
        // Zurück-Taste (Android/Browser) wechselt zum zuletzt besuchten Reiter.
        backBehavior="history"
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background },
        }}
      >
        <Tabs.Screen name="uebersicht" options={{ title: tabLabel('uebersicht') }} />
        <Tabs.Screen name="today" options={{ title: tabLabel('today') }} />
        <Tabs.Screen name="ernaehrung" options={{ title: tabLabel('ernaehrung') }} />
        <Tabs.Screen name="fortschritt" options={{ title: tabLabel('fortschritt') }} />
        <Tabs.Screen name="mehr" options={{ title: tabLabel('mehr') }} />
      </Tabs>
    </InTabsContext.Provider>
  );
}
