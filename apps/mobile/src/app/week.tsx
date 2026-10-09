import {
  addDays,
  startOfIsoWeek,
  summaryWeekBounds,
  weekLogSummary,
  weekPager,
  type DayItem,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { summaryInputs } from '@/data/log-summary';
import { t } from '@/i18n';
import { formatDateDe, todayIso } from '@/lib/format';
import { dayStatusText, kmText, weekRangeText } from '@/lib/history-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Woche (docs/PLAN-PHASE-4.md 6.1 Punkt 4, Etappe D): Mo–So mit Status-Zeichen UND Text, Summen, Blättern zu früheren
 * Wochen. Status, Summen und „nachgeholt am tatsächlichen Datum“ (H2) bzw. „entfallen“ (H1) rechnet weekLogSummary()
 * in packages/core; die Grenzen fürs Blättern summaryWeekBounds()/weekPager().
 */
export default function WeekScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const today = todayIso();
  const [week, setWeek] = useState(() => startOfIsoWeek(today));

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const { sessions, logs } = summaryInputs(app.rows);
  const since = app.backend.logHistoryStart();
  const pager = weekPager(week, summaryWeekBounds(sessions, logs, today, { earliest: since }));
  const summary = weekLogSummary(sessions, logs, pager.weekStart, today);
  const pending = new Set(app.pendingLogSessionIds);
  const isCurrent = pager.weekStart === startOfIsoWeek(today);
  const empty = summary.days.every((d) => d.status === 'rest');

  const itemLines = (item: DayItem): string[] =>
    [
      item.caughtUpFrom ? t.week.caughtUpFrom(formatDateDe(item.caughtUpFrom)) : null,
      item.status === 'dropped' ? t.week.droppedHint : null,
      item.sessionId !== null && item.logId !== null && pending.has(item.sessionId)
        ? t.week.pending
        : null,
    ].filter((value): value is string => value !== null);

  return (
    <Screen
      title={t.week.title}
      testID="week"
      footer={
        <Button
          label={t.week.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      <View style={styles.header}>
        <Heading level={2}>{isCurrent ? t.week.current : t.week.title}</Heading>
        <Body testID="week-range">
          {weekRangeText(summary.weekStart, addDays(summary.weekStart, 6))}
        </Body>
      </View>
      <View style={styles.pager}>
        <View style={styles.pagerButton}>
          <Button
            label={t.week.previous}
            variant="secondary"
            accessibilityLabel={t.week.previousA11y}
            disabled={pager.previous === null}
            onPress={() => pager.previous && setWeek(pager.previous)}
            testID="week-prev"
          />
        </View>
        <View style={styles.pagerButton}>
          <Button
            label={t.week.next}
            variant="secondary"
            accessibilityLabel={t.week.nextA11y}
            disabled={pager.next === null}
            onPress={() => pager.next && setWeek(pager.next)}
            testID="week-next"
          />
        </View>
      </View>
      {pager.previous === null && since !== null ? <Body muted>{t.week.olderHint}</Body> : null}

      {empty ? <Body muted>{t.week.empty}</Body> : null}
      <View style={styles.days}>
        {summary.days.map((day) => (
          <View
            key={day.date}
            testID={`week-day-${day.date}`}
            style={[
              styles.day,
              {
                backgroundColor: theme.surface,
                borderColor: day.date === today ? theme.primary : theme.border,
                borderWidth: day.date === today ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.dayName, { color: theme.text }]}>
              {dayLabel(day.date)}
              {day.date === today ? ` · ${t.plan.todayBadge}` : ''}
            </Text>
            {day.items.length === 0 ? (
              <Body muted>{t.week.status.rest}</Body>
            ) : (
              day.items.map((item, index) => (
                <View
                  key={`${item.logId ?? item.sessionId ?? index}`}
                  style={styles.item}
                  testID="week-item"
                >
                  <Text style={[styles.itemStatus, { color: theme.text }]}>
                    {dayStatusText(item.status)}: {item.name_de}
                  </Text>
                  {itemLines(item).map((line) => (
                    <Body key={line} muted>
                      {line}
                    </Body>
                  ))}
                  {item.logId !== null ? (
                    <Button
                      label={t.week.open}
                      variant="link"
                      accessibilityLabel={`${item.name_de}, ${dayLabel(day.date)}: ${t.week.open}`}
                      onPress={() => router.push(`/log/${item.logId}` as Href)}
                    />
                  ) : null}
                </View>
              ))
            )}
          </View>
        ))}
      </View>

      <Card>
        <View testID="week-summary" style={styles.summary}>
          <Heading level={2}>{t.week.summaryTitle}</Heading>
          <Body>{t.week.sessions(summary.sessionsDone, summary.sessionsPlanned)}</Body>
          <Body>{t.week.sets(summary.strengthSets)}</Body>
          <Body
            accessibilityLabel={t.week.enduranceA11y(
              summary.enduranceMinutes,
              kmText(summary.enduranceKm * 1000),
            )}
          >
            {t.week.endurance(summary.enduranceMinutes, kmText(summary.enduranceKm * 1000))}
          </Body>
        </View>
      </Card>
      <Button
        label={t.today.openHistory}
        variant="secondary"
        onPress={() => router.push('/history' as Href)}
      />
      <Button
        label={t.glossary.allExercises}
        variant="secondary"
        onPress={() => router.push('/uebungen' as Href)}
        testID="week-glossary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  days: { gap: spacing.xs },
  day: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  dayName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 24 },
  item: { gap: 2 },
  itemStatus: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  summary: { gap: 4 },
});
