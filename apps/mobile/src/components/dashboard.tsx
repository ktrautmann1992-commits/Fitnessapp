import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Heading, MIN_TOUCH } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';

/**
 * Bausteine der Übersicht (docs/PLAN-DASHBOARD.md 2.4): Kachel mit Überschrift, Inhalt und Knöpfen sowie kleine
 * Schnellzugriffe. Nur Darstellung – die Daten kommen aus packages/core (dashboard.ts) und den vorhandenen Hooks.
 */
export function DashboardTile({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Card>
      <View style={styles.tile} testID={testID}>
        <Heading level={2}>{title}</Heading>
        {children}
      </View>
    </Card>
  );
}

/** Schnellzugriff (zwei je Zeile): große Tippfläche, Rolle „Link“, weil er nur in einen Bereich führt. */
export function ShortcutTile({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.shortcut,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.shortcutText, { color: theme.text }]}>{label}</Text>
      <Text aria-hidden style={[styles.shortcutArrow, { color: theme.link }]}>
        ›
      </Text>
    </Pressable>
  );
}

export function ShortcutGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View role="list" aria-label={label} style={styles.grid}>
      {children}
    </View>
  );
}

export function ShortcutCell({ children }: { children: ReactNode }) {
  return (
    <View role="listitem" style={styles.cell}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: spacing.sm + 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 4 },
  cell: { flexBasis: '46%', flexGrow: 1 },
  shortcut: {
    minHeight: MIN_TOUCH + 16,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shortcutText: { flexShrink: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  shortcutArrow: { fontSize: fontSize.lg + 4, fontWeight: fontWeight.bold },
});
