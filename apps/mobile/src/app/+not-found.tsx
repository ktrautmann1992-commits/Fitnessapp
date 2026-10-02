import { fontSize, spacing } from '@fitnessapp/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/lib/theme';

export default function NotFoundScreen() {
  const theme = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Diese Seite gibt es nicht.</Text>
      <Link href="/" style={[styles.link, { color: theme.primary }]}>
        Zur Startseite
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
  },
  link: {
    fontSize: fontSize.md,
  },
});
