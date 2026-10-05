import { APP_NAME, brandColors } from '@fitnessapp/ui';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { TopBanner } from '@/components/screen';
import { useThemeColors } from '@/lib/theme';
import { useBrandFonts } from '@/lib/use-brand-fonts';
import { AppStateProvider } from '@/state/app-state';

// iPhone/Android: Startbildschirm stehen lassen, bis die Markenschrift geladen ist (Web unverändert).
if (Platform.OS !== 'web') {
  // Fehler (z. B. Startbildschirm schon ausgeblendet) sind harmlos – nie die App blockieren.
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/** Bildschirme, die immer dunkel sind (Markenfläche wie Startbildschirm und Landingpage-Hero). */
const DARK_ROUTES = new Set(['/welcome']);

export default function RootLayout() {
  const theme = useThemeColors();
  const pathname = usePathname();
  const fontsReady = useBrandFonts();
  const onDark = DARK_ROUTES.has(pathname);
  useEffect(() => {
    if (fontsReady && Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);
  // iPhone/Android: solange Archivo lädt (lokal, nur Millisekunden), bleibt der Startbildschirm sichtbar.
  if (!fontsReady) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style={onDark ? 'light' : 'auto'} />
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, backgroundColor: onDark ? brandColors.schwarz : theme.background }}
        >
          {/* Dunkle Bildschirme zeigen den Hinweis selbst – auf ihrer Fläche mit Schein, ohne Kante. */}
          {onDark ? null : <TopBanner />}
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                title: APP_NAME,
                headerShown: false,
                contentStyle: { backgroundColor: theme.background },
              }}
            />
          </View>
        </SafeAreaView>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
