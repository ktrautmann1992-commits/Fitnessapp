import { cardColors, fontSize, radius, spacing, type AreaId } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { IconChip, type IconName } from '@/components/design';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

/**
 * Bausteine der Übersicht (docs/PLAN-DASHBOARD.md 2.4; Aussehen seit 20.10.2026 wie Entwurf „Übersicht neu“, docs/DESIGN.md):
 * Kachel mit Icon-Chip in der Bereichsfarbe, Überschrift und Inhalt sowie kleine Schnellzugriffe. Nur Darstellung –
 * die Daten kommen aus packages/core (dashboard.ts) und den vorhandenen Hooks.
 *
 * Mit `onPress` ist die ganze Kachel ein Link (dann keine Knöpfe darin – keine verschachtelten Bedienelemente); ohne
 * Pfeil, damit der Titel auch in schmalen Kacheln Platz hat.
 */
export function DashboardTile({
  title,
  children,
  testID,
  area = 'training',
  icon = 'grid',
  onPress,
  accessibilityLabel,
  pressTestID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
  area?: AreaId;
  icon?: IconName;
  onPress?: (() => void) | undefined;
  /** Name des Links für Bildschirmleser (Standard: Titel). */
  accessibilityLabel?: string;
  /** testID der antippbaren Fläche (sonst trägt sie `testID`). */
  pressTestID?: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const head = (
    <View style={styles.head}>
      <IconChip area={area} icon={icon} />
      <Text
        accessibilityRole="header"
        aria-level={2}
        style={[styles.title, appFont('bold'), { color: theme.text }]}
      >
        {title}
      </Text>
    </View>
  );
  const box = [styles.tile, { backgroundColor: theme.surface, borderColor: card.border }];
  if (onPress) {
    return (
      <View testID={testID} style={styles.flexCell}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          testID={pressTestID}
          style={({ pressed }) => [box, styles.flexCell, { opacity: pressed ? 0.85 : 1 }]}
        >
          {head}
          {children}
        </Pressable>
      </View>
    );
  }
  return (
    <View testID={testID} style={box}>
      {head}
      {children}
    </View>
  );
}

/**
 * Zwei Kacheln nebeneinander (Entwurf: 2-Spalten-Raster), auf schmalen Handys (< 360 px) untereinander. Die
 * Reihenfolge bleibt die der Person (Übersicht bearbeiten).
 */
export function TileRow({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <View style={width >= 360 ? styles.row : styles.column}>{children}</View>;
}

/** Zelle in `TileRow` (gleich breit). */
export function TileCell({ children }: { children: ReactNode }) {
  return <View style={styles.cell}>{children}</View>;
}

/** Schnellzugriff (zwei je Zeile): Icon-Chip, Name; Rolle „Link“, weil er nur in einen Bereich führt. */
export function ShortcutTile({
  label,
  onPress,
  testID,
  area = 'training',
  icon = 'chevron',
  detail,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  area?: AreaId;
  icon?: IconName;
  /** Kurzer Zusatz unter dem Namen (z. B. „7 offen“). */
  detail?: string | undefined;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.shortcut,
        { backgroundColor: theme.surface, borderColor: card.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <IconChip area={area} icon={icon} />
      <View style={styles.shortcutText}>
        <Text style={[styles.shortcutLabel, appFont('bold'), { color: theme.text }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.shortcutDetail, appFont('regular'), { color: theme.textMuted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
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
    <View role="listitem" style={styles.gridCell}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20 },
  flexCell: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  column: { gap: spacing.md },
  cell: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCell: { flexBasis: '46%', flexGrow: 1 },
  // Chip oben, Name darunter (wie „Mehr“) – so passen auch lange Wörter wie „Einkaufsliste“ auf 320 px.
  shortcut: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  shortcutText: { minWidth: 0, gap: 2 },
  shortcutLabel: { fontSize: fontSize.md - 1 },
  shortcutDetail: { fontSize: fontSize.xs },
});
