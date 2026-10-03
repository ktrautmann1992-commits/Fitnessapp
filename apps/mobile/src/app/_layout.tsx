import { APP_NAME } from '@fitnessapp/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useThemeColors } from '@/lib/theme';

export default function RootLayout() {
  const theme = useThemeColors();
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          title: APP_NAME,
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </SafeAreaProvider>
  );
}
