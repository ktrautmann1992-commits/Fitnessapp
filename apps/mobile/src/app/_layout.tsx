import { APP_NAME } from '@fitnessapp/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { TopBanner } from '@/components/screen';
import { useThemeColors } from '@/lib/theme';
import { AppStateProvider } from '@/state/app-state';

export default function RootLayout() {
  const theme = useThemeColors();
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="auto" />
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
          <TopBanner />
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
