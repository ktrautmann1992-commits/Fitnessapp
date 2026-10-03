import { MIN_AGE_YEARS } from '@fitnessapp/core';
import {
  APP_NAME,
  APP_TAGLINE,
  fontSize,
  fontWeight,
  maxContentWidth,
  radius,
  spacing,
} from '@fitnessapp/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabaseConfig } from '@/lib/supabase';
import { useThemeColors } from '@/lib/theme';

const FEATURES = [
  { title: 'Trainingsplan', text: 'Passend zu Ziel, Zeitbudget und deinem Equipment.' },
  { title: 'Ernährung', text: 'Wochenplan mit Rezepten und Einkaufsliste.' },
  { title: 'Tagebuch', text: 'Sätze, Gewichte und Läufe festhalten – auch offline.' },
];

export default function StartScreen() {
  const theme = useThemeColors();
  const [showHint, setShowHint] = useState(false);

  const dbStatus =
    supabaseConfig.status === 'ok'
      ? { label: 'Datenbank verbunden', color: theme.success }
      : supabaseConfig.status === 'invalid'
        ? { label: 'Datenbank-Einstellungen fehlerhaft', color: theme.danger }
        : { label: 'Datenbank noch nicht verbunden', color: theme.warning };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {APP_NAME}
          </Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>{APP_TAGLINE}</Text>

          <View style={styles.features}>
            {FEATURES.map((feature) => (
              <View
                key={feature.title}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={[styles.cardText, { color: theme.textMuted }]}>{feature.text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowHint(true)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.primaryText }]}>Los geht&apos;s</Text>
          </Pressable>

          {showHint && (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Bald geht es hier zur Anmeldung und zum Onboarding. Nutzung ab {MIN_AGE_YEARS} Jahren.
            </Text>
          )}

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: dbStatus.color }]} />
            <Text style={[styles.statusText, { color: theme.textMuted }]}>{dbStatus.label}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: maxContentWidth,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  tagline: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  features: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  cardText: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  hint: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: fontSize.sm,
  },
});
