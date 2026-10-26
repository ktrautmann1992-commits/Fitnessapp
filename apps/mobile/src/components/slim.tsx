import { noticeQueue, type NoticeLevel } from '@fitnessapp/core';
import { cardColors, fontSize, radius, spacing, type AreaId } from '@fitnessapp/ui';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Icon, MIN_ROW, Tile, type IconName } from '@/components/design';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

/**
 * Bausteine für „App verschlanken“ (Gründer-Freigabe 26.10.2026, docs/PLAN-DASHBOARD.md 7, docs/DESIGN.md
 * „Schlank“): Umschalter oben auf einer Seite, Hinweis-Zeile mit Zähler, Aufklapp-Zeile, ⋯-Menü als Blatt von unten,
 * Kachel-Raster. Nur Darstellung – die Vorrang-Regel der Hinweise steht in packages/core (`noticeQueue`).
 * Tippflächen ≥ 44 px, Zustände für Bildschirmleser (ausgewählt, auf-/zugeklappt).
 */

// ---------------------------------------------------------------------------------------------------------
// Umschalter (Mein Plan · Workouts · Übungen, Tag · Woche · Rezepte)
// ---------------------------------------------------------------------------------------------------------
export interface SegmentItem {
  key: string;
  label: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Pillen-Umschalter wie im Entwurf: graue Fläche, gewählter Teil weiß mit Schatten. Jeder Teil ist ein Link in einen
 * Bereich (Rolle `tab` mit „ausgewählt“); der gewählte Teil ist nicht antippbar.
 */
export function SegmentedSwitch({
  items,
  selected,
  accessibilityLabel,
  testID,
}: {
  items: readonly SegmentItem[];
  selected: string;
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const card = cardColors[scheme];
  return (
    <View
      role="tablist"
      aria-label={accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.segments, { backgroundColor: card.divider }]}
    >
      {items.map((item) => {
        const active = item.key === selected;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={active ? undefined : item.onPress}
            testID={item.testID}
            style={({ pressed }) => [
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: theme.surface }],
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                appFont(active ? 'bold' : 'semibold'),
                { color: active ? theme.text : theme.textMuted },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hinweis-Zeile
// ---------------------------------------------------------------------------------------------------------
export interface StackNotice {
  id: string;
  level: NoticeLevel;
  node: ReactNode;
}

/**
 * Höchstens EIN Hinweis vollständig (Vorrang aus packages/core `noticeQueue`), alle weiteren hinter „+N weitere
 * Hinweise“ (klappt darunter auf, Entwurf 7-hinweise). Sperrende Hinweise (Arzt, Einwilligung, Plan abgelaufen,
 * fremde Daten) stehen immer vollständig oben und werden nie zugeklappt. Einträge mit `node === null` zählen nicht.
 */
export function NoticeStack({
  items,
  testID,
}: {
  items: readonly (StackNotice | null | false | undefined)[];
  testID: string;
}) {
  const [open, setOpen] = useState(false);
  const theme = useThemeColors();
  const queue = noticeQueue(
    items.filter(
      (x): x is StackNotice =>
        Boolean(x) && x !== null && x !== undefined && x !== false && x.node !== null,
    ),
  );
  if (queue.blocking.length === 0 && queue.lead === null) return null;
  const count = queue.rest.length;
  return (
    <View style={styles.stack} testID={testID}>
      {queue.blocking.map((item) => (
        <View key={item.id}>{item.node}</View>
      ))}
      {queue.lead ? <View key={queue.lead.id}>{queue.lead.node}</View> : null}
      {count > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? t.slim.notices.less : t.slim.notices.moreA11y(count)}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => setOpen((v) => !v)}
          testID={`${testID}-more`}
          style={({ pressed }) => [
            styles.morePill,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.morePillText, appFont('bold'), { color: theme.link }]}>
            {open ? t.slim.notices.less : t.slim.notices.more(count)}
          </Text>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
            <Icon name="chevron" size={16} color={theme.link} />
          </View>
        </Pressable>
      ) : null}
      {open ? queue.rest.map((item) => <View key={item.id}>{item.node}</View>) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Aufklapp-Zeile
// ---------------------------------------------------------------------------------------------------------
/**
 * Eine Zeile mit Icon, Titel, Zusatz und Pfeil; antippen klappt den Inhalt darunter auf (Plan-Infos, Hilfe-Zeile,
 * Vorrat). Bildschirmleser hören „aufgeklappt“/„zugeklappt“.
 */
export function CollapsibleRow({
  icon,
  title,
  subtitle,
  children,
  testID,
  initiallyOpen = false,
  iconColor,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID: string;
  initiallyOpen?: boolean;
  iconColor?: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View
      style={[styles.collapsible, { backgroundColor: theme.surface, borderColor: card.border }]}
      testID={testID}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        testID={`${testID}-toggle`}
        style={({ pressed }) => [styles.collapsibleHead, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Icon name={icon} size={22} color={iconColor ?? theme.textMuted} />
        <View style={styles.collapsibleText}>
          <Text style={[styles.collapsibleTitle, appFont('bold'), { color: theme.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.collapsibleSub, appFont('regular'), { color: theme.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
          <Icon name="chevron" size={18} color={theme.textMuted} />
        </View>
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// ⋯-Menü als Blatt von unten
// ---------------------------------------------------------------------------------------------------------
export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'default' | 'danger';
  testID?: string;
  /** Schalter-Eintrag (z. B. „Erledigte ausblenden“): Zustand für Bildschirmleser. */
  checked?: boolean;
  disabled?: boolean;
}

/** Runder ⋯-Knopf (44 × 44) mit Blatt von unten (Entwurf 4-einkaufen). Antippen eines Eintrags schließt das Blatt. */
export function MoreMenu({
  items,
  accessibilityLabel,
  testID,
  icon = 'dots',
}: {
  items: readonly MenuItem[];
  accessibilityLabel: string;
  testID: string;
  icon?: IconName;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        testID={testID}
        hitSlop={4}
        style={({ pressed }) => [
          styles.roundButton,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Icon name={icon} size={20} color={theme.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t.slim.menu.close}
          onPress={() => setOpen(false)}
          testID={`${testID}-close`}
        />
        <View
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: card.border }]}
          testID={`${testID}-sheet`}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: card.divider }]} />
          {items.map((item) => {
            const danger = item.tone === 'danger';
            const color = danger ? theme.danger : theme.text;
            return (
              <Pressable
                key={item.key}
                accessibilityRole={item.checked === undefined ? 'button' : 'checkbox'}
                accessibilityState={{
                  disabled: item.disabled === true,
                  ...(item.checked !== undefined ? { checked: item.checked } : {}),
                }}
                aria-checked={item.checked}
                disabled={item.disabled}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                testID={item.testID}
                style={({ pressed }) => [
                  styles.sheetRow,
                  { opacity: item.disabled ? 0.5 : pressed ? 0.7 : 1 },
                ]}
              >
                <Icon name={item.icon} size={22} color={color} />
                <Text style={[styles.sheetLabel, appFont('semibold'), { color }]}>
                  {item.label}
                </Text>
                {item.checked !== undefined ? (
                  <Icon
                    name={item.checked ? 'check' : 'plus'}
                    size={18}
                    color={item.checked ? theme.success : theme.textMuted}
                  />
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.sheetLabel, appFont('bold'), { color: theme.link }]}>
              {t.slim.menu.close}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

/** Runder Icon-Knopf oben rechts im Seitenkopf (⚙, Kalender) – 44 × 44, Name für Bildschirmleser ist Pflicht. */
export function HeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [
        styles.roundButton,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kachel-Raster (zu zweit, bunte Kacheln wie unter „Mehr“)
// ---------------------------------------------------------------------------------------------------------
export interface GridTile {
  key: string;
  title: string;
  subtitle?: string;
  area: AreaId;
  icon: IconName;
  onPress: () => void;
  testID: string;
  accessibilityLabel?: string;
}

export function TileGrid({ tiles, testID }: { tiles: readonly GridTile[]; testID?: string }) {
  return (
    <View style={styles.grid} testID={testID}>
      {tiles.map((tile) => (
        <View key={tile.key} style={styles.cell}>
          <Tile
            variant="stacked"
            area={tile.area}
            icon={tile.icon}
            title={tile.title}
            {...(tile.subtitle ? { subtitle: tile.subtitle } : {})}
            {...(tile.accessibilityLabel ? { accessibilityLabel: tile.accessibilityLabel } : {})}
            role="link"
            onPress={tile.onPress}
            testID={tile.testID}
            style={styles.fill}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_ROW,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: fontSize.sm, lineHeight: 20 },
  stack: { gap: spacing.sm },
  morePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_ROW,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  morePillText: { fontSize: fontSize.sm, lineHeight: 20 },
  collapsible: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  collapsibleText: { flex: 1, minWidth: 0, gap: 2 },
  collapsibleTitle: { fontSize: 17, lineHeight: 23 },
  collapsibleSub: { fontSize: fontSize.xs, lineHeight: 18 },
  collapsibleBody: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  roundButton: {
    width: MIN_ROW,
    height: MIN_ROW,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: spacing.lg,
    gap: 2,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 8 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 4,
  },
  sheetLabel: { flex: 1, fontSize: 17, lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  fill: { flexGrow: 1 },
});
