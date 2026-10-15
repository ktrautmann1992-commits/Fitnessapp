import type { IntakeTone, WeekTrainingItem } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { t } from '@/i18n';
import { achievementView } from '@/lib/day-evaluation-format';
import { dayStatusText } from '@/lib/history-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import type { WeekDayView } from '@/lib/week-evaluation-format';

/**
 * Bausteine der Wochenauswertung (Etappe A3, docs/PLAN-AUSWERTUNG.md Abschnitt 8): je Tag ein kleiner Balken mit Farbe,
 * Zeichen und Kurztext (Farbe nie allein); Tippen öffnet „Dein Tag“. Einheiten mit Tag, Stufe und Erfüllungsgrad.
 * testIDs ohne Werte und ohne Zone – keine Gesundheitsdaten in Attributen.
 */

function useToneColor() {
  const theme = useThemeColors();
  return (tone: IntakeTone) =>
    tone === 'danger'
      ? theme.danger
      : tone === 'warning'
        ? theme.warning
        : tone === 'success'
          ? theme.success
          : theme.primary;
}

/** Ein Tag: Name, kleiner Balken (nur mit Zahlen), Kurztext. Ganze Zeile tippbar → „Dein Tag“. */
export function WeekDayRow({
  view,
  isToday,
  onOpen,
}: {
  view: WeekDayView;
  isToday: boolean;
  onOpen: () => void;
}) {
  const theme = useThemeColors();
  const toneColor = useToneColor();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={view.a11y}
      onPress={onOpen}
      testID={`week-eval-day-${view.date}`}
      style={({ pressed }) => [
        styles.day,
        {
          borderColor: isToday ? theme.primary : theme.border,
          borderWidth: isToday ? 2 : 1,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.dayName, { color: theme.text }]}>
        {dayLabel(view.date)}
        {isToday ? ` · ${t.plan.todayBadge}` : ''}
      </Text>
      {view.tone !== null && view.fillPct !== null ? (
        <View
          testID="week-eval-bar"
          style={[styles.track, { borderColor: theme.border, backgroundColor: theme.background }]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.fill,
              { width: `${view.fillPct}%`, backgroundColor: toneColor(view.tone) },
            ]}
          />
          {view.targetPct !== null ? (
            <View
              pointerEvents="none"
              style={[styles.marker, { left: `${view.targetPct}%`, backgroundColor: theme.text }]}
            />
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.short, { color: theme.text }]} testID="week-eval-day-text">
        {view.tone !== null ? (
          <Text style={{ color: toneColor(view.tone) }}>{view.short.charAt(0)}</Text>
        ) : (
          view.short.charAt(0)
        )}
        {view.short.slice(1)}
        <Text style={{ color: theme.textMuted }}> ›</Text>
      </Text>
    </Pressable>
  );
}

/** Eine Einheit der Woche: Tag, Name, Kennzeichen, Stufe und Erfüllungsgrad. */
export function WeekTrainingRow({
  entry,
  onOpenLog,
}: {
  entry: WeekTrainingItem;
  onOpenLog: (logId: string) => void;
}) {
  const theme = useThemeColors();
  const { item, achievement } = entry;
  const badges = [item.free ? t.day.free : null, item.backfilled ? t.day.backfilled : null].filter(
    (value): value is string => value !== null,
  );
  const view = achievement ? achievementView(item.name_de, achievement, []) : null;
  return (
    <View
      style={[styles.item, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID="week-eval-item"
    >
      <Body muted>{dayLabel(entry.date)}</Body>
      <Text style={[styles.itemTitle, { color: theme.text }]}>
        {item.name_de}
        {badges.length > 0 ? ` · ${badges.join(', ')}` : ''}
      </Text>
      {view ? (
        <Text
          style={[styles.level, { color: theme.text }]}
          accessibilityLabel={view.a11y}
          testID="week-eval-achievement"
        >
          {view.symbol} {view.levelText}
          {view.percentText ? ` · ${view.percentText}` : ''}
        </Text>
      ) : (
        <Body>{dayStatusText(item.status)}</Body>
      )}
      {item.performedOn ? (
        <Body muted>{t.weekEval.performedOn(dayLabel(item.performedOn))}</Body>
      ) : null}
      {item.caughtUpFrom ? (
        <Body muted>{t.week.caughtUpFrom(dayLabel(item.caughtUpFrom))}</Body>
      ) : null}
      {item.logId !== null ? (
        <Button
          label={t.day.openLog}
          variant="link"
          accessibilityLabel={t.day.openLogA11y(item.name_de)}
          onPress={() => onOpenLog(item.logId as string)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
    minHeight: 44,
  },
  dayName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 22 },
  track: {
    height: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  short: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  level: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
