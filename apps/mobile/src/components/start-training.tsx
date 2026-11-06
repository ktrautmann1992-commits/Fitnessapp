import { startTrainingMenu, type StartMenuEntry, type WeekStatusDay } from '@fitnessapp/core';
import { cardColors, radius, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { startCandidatesFor, startEntryHref } from '@/data/start-training';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';

import { Icon, type IconName, MIN_ROW } from './design';

const S = t.startTraining;

/**
 * Einträge des Start-Blatts für heute (Regel: packages/core `startTrainingMenu`). `day` = Tag „heute“ aus dem
 * Wochen-Status (null = noch nicht geladen bzw. kein Plan → nur die freien Wege).
 */
export function useStartEntries(day: WeekStatusDay | null, today: string): StartMenuEntry[] {
  const app = useApp();
  const rows = app.rows;
  const draftKeys = useMemo(() => app.drafts.map((d) => d.key), [app.drafts]);
  // Live-GPS gibt es in der App; im Web-Browser nur im Testmodus (Demo-Aufzeichnung, wie /ausdauer).
  const gpsAvailable = Platform.OS !== 'web' || app.backend.mode === 'local';
  return useMemo(
    () =>
      startTrainingMenu({
        candidates: rows ? startCandidatesFor(rows, day, draftKeys, today) : [],
        gpsAvailable,
      }),
    [rows, day, draftKeys, today, gpsAvailable],
  );
}

function entryText(entry: StartMenuEntry): { label: string; hint: string; icon: IconName } {
  switch (entry.kind) {
    case 'planned':
      return {
        label: entry.resume ? S.plannedResume(entry.name_de) : S.planned(entry.name_de),
        hint: S.plannedHint,
        icon: 'play',
      };
    case 'free_strength':
      return { label: S.freeStrength, hint: S.freeStrengthHint, icon: 'dumbbell' };
    case 'gps':
      return { label: S.gps, hint: S.gpsHint, icon: 'map' };
    case 'other_sport':
      return { label: S.otherSport, hint: S.otherSportHint, icon: 'run' };
    case 'backfill':
      return { label: S.backfill, hint: S.backfillHint, icon: 'edit' };
  }
}

function entryTestId(entry: StartMenuEntry): string {
  return entry.kind === 'planned'
    ? `start-sheet-planned-${entry.sessionId}`
    : `start-sheet-${entry.kind}`;
}

/**
 * Blatt „Training starten“ (Gründer-Wunsch 06.11.2026) – Blatt von unten wie das ⋯-Menü (Radius 24, Griff, Zeilen
 * mit Icon, „Schließen“). Ein Tipp auf einen Eintrag schließt das Blatt und öffnet das Ziel.
 */
export function StartTrainingSheet({
  visible,
  onClose,
  entries,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  entries: readonly StartMenuEntry[];
  today: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={S.close}
          onPress={onClose}
          testID="start-sheet-backdrop"
        />
        <View
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: card.border }]}
          testID="start-sheet"
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={S.sheetTitle}
        >
          <View style={[styles.grabber, { backgroundColor: card.divider }]} aria-hidden />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text
              role="heading"
              accessibilityRole="header"
              style={[styles.title, appFont('bold'), { color: theme.text }]}
            >
              {S.sheetTitle}
            </Text>
            {entries.map((entry) => {
              const text = entryText(entry);
              const primary = entry.kind === 'planned';
              const color = primary ? theme.primaryText : theme.text;
              return (
                <Pressable
                  key={entryTestId(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`${text.label}. ${text.hint}`}
                  onPress={() => {
                    onClose();
                    router.push(startEntryHref(entry, today) as Href);
                  }}
                  testID={entryTestId(entry)}
                  style={({ pressed }) => [
                    styles.row,
                    primary
                      ? { backgroundColor: theme.primary }
                      : { borderColor: card.divider, borderBottomWidth: StyleSheet.hairlineWidth },
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Icon name={text.icon} size={22} color={color} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, appFont('semibold'), { color }]}>
                      {text.label}
                    </Text>
                    <Text
                      style={[
                        styles.rowHint,
                        appFont('regular'),
                        { color: primary ? theme.primaryText : theme.textMuted },
                      ]}
                    >
                      {text.hint}
                    </Text>
                  </View>
                  <Icon name="chevron" size={18} color={primary ? color : theme.textMuted} />
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              testID="start-sheet-close"
              style={({ pressed }) => [styles.closeRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.rowLabel, appFont('bold'), { color: theme.link }]}>
                {S.close}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * „+ Training starten“ oben rechts im Seitenkopf von „Heute“ (Screen `headerAction`): Pille in der Hauptfarbe mit
 * „+“ – gut sichtbar, 44 px hoch, öffnet das Start-Blatt.
 */
export function StartTrainingButton({
  onPress,
  expanded,
}: {
  onPress: () => void;
  expanded: boolean;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={S.plusA11y}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      testID="today-start-plus"
      hitSlop={4}
      style={({ pressed }) => [
        styles.plus,
        { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name="plus" size={20} color={theme.primaryText} strokeWidth={2.5} />
      <Text style={[styles.plusText, appFont('bold'), { color: theme.primaryText }]}>{S.plus}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    width: '100%',
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 8 },
  title: { fontSize: 20, lineHeight: 26, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontSize: 17, lineHeight: 23 },
  rowHint: { fontSize: 14, lineHeight: 19 },
  closeRow: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 12 },
  plus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_ROW,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  plusText: { fontSize: 15, lineHeight: 20 },
});
