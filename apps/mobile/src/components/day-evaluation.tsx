import type { DayTrainingItem, IntakeTone } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { t } from '@/i18n';
import { achievementView, type IntakeBarView } from '@/lib/day-evaluation-format';
import { dayStatusText } from '@/lib/history-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Bausteine der Tagesauswertung „Dein Tag“ (Etappe A2, docs/PLAN-AUSWERTUNG.md Abschnitt 6): Kalorienbalken mit
 * Zielmarke und hell hinterlegten Zonen, Farbe immer mit Text und Zeichen; Training mit Status und Erfüllungsgrad.
 * Farben aus den Design-Tokens (success/warning/danger, neutral = Markenfarbe). testIDs ohne Werte und ohne Zone –
 * keine Gesundheitsdaten in Attributen.
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

/** Kalorienbalken (nur mit Zahlen – bei „Zahlen aus“ wird er gar nicht gerendert). */
export function IntakeBarCard({ view }: { view: IntakeBarView }) {
  const theme = useThemeColors();
  const toneColor = useToneColor();
  const color = toneColor(view.tone);
  return (
    <View style={styles.barBlock}>
      <Text style={[styles.headline, { color: theme.text }]} testID="day-intake">
        {view.headline}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={view.a11y}
        testID="day-bar"
        style={[styles.track, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <View style={styles.zones} pointerEvents="none">
          {view.segments.map((segment, index) => (
            <View
              key={index}
              style={{
                width: `${segment.widthPct}%`,
                backgroundColor: `${toneColor(segment.tone)}33`,
              }}
            />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[styles.fill, { width: `${view.fillPct}%`, backgroundColor: color }]}
        />
        <View
          pointerEvents="none"
          style={[styles.marker, { left: `${view.targetPct}%`, backgroundColor: theme.text }]}
        />
      </View>
      <Text style={[styles.zoneText, { color: theme.text }]} testID="day-zone">
        <Text style={{ color }}>{view.symbol}</Text> {view.zoneText}
      </Text>
      {view.detail ? <Body muted>{view.detail}</Body> : null}
    </View>
  );
}

/** Eine Einheit des Tages mit Status, Erfüllungsgrad und je Übung „3/3 Sätze“. */
export function DayTrainingRow({
  entry,
  exerciseNames,
  onOpenLog,
  kcal = null,
}: {
  entry: DayTrainingItem;
  exerciseNames: readonly string[];
  onOpenLog: (logId: string) => void;
  /** kcal der Einheit („ca. 320 kcal“ bzw. Hinweis), siehe session-kcal.tsx. */
  kcal?: ReactNode;
}) {
  const theme = useThemeColors();
  const { item, achievement } = entry;
  const badges = [item.free ? t.day.free : null, item.backfilled ? t.day.backfilled : null].filter(
    (value): value is string => value !== null,
  );
  const view = achievement ? achievementView(item.name_de, achievement, exerciseNames) : null;
  return (
    <View
      style={[styles.item, { borderColor: theme.cardBorder, backgroundColor: theme.surface }]}
      testID="day-training-item"
    >
      <Text style={[styles.itemTitle, { color: theme.text }]}>
        {item.name_de}
        {badges.length > 0 ? ` · ${badges.join(', ')}` : ''}
      </Text>
      {view ? (
        <Text
          style={[styles.level, { color: theme.text }]}
          accessibilityLabel={view.a11y}
          testID="day-achievement"
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
      {view?.lines.map((line, index) => (
        <Body key={index} muted>
          {line}
        </Body>
      ))}
      {view?.hints.map((hint) => (
        <Body key={hint} muted testID="day-achievement-hint">
          {hint}
        </Body>
      ))}
      {kcal}
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
  barBlock: { gap: spacing.xs },
  headline: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  track: {
    height: 24,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  zones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  fill: { position: 'absolute', left: 0, top: 6, bottom: 6, borderRadius: radius.sm },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  zoneText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  item: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: 4 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  level: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
