import { addDays, startOfIsoWeek, summaryWeekBounds, weekPager } from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SportWeekCard } from '@/components/sport-week';
import { Text } from '@/components/text';
import { DaySheet, type SheetMessage, useWeekStatus, WeekDayRow } from '@/components/training-week';
import { Body, Button, Heading, LoadingState, Notice } from '@/components/ui';
import { summaryInputs } from '@/data/log-summary';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { todayIso } from '@/lib/format';
import { kmText, weekRangeText } from '@/lib/history-format';
import { formatKcal } from '@/lib/nutrition-format';
import { planNameLine } from '@/lib/plan-title';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const W = t.trainingWeek;

/**
 * Woche (Training-Übersicht, docs/PLAN-AUSWERTUNG.md „Training-Übersicht“, Entwurf s2): Summen-Karte (Einheiten, km, kcal), eine
 * kompakte Zeile je Tag mit Status (erledigt/geplant/vorgezogen/nachgeholt/verpasst) – die ganze Zeile öffnet das
 * Tages-Blatt (Starten, Verschieben, Eintragen, „Dein Tag“). Erledigt steht immer am tatsächlichen Tag; Status, Summen
 * und Zuordnungen rechnet weekStatus() in packages/core, die Grenzen fürs Blättern summaryWeekBounds()/weekPager().
 */
export default function WeekScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const today = todayIso();
  const [week, setWeek] = useState(() => startOfIsoWeek(today));
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [message, setMessage] = useState<SheetMessage | null>(null);
  const rows = app.rows;
  const bounds = rows
    ? summaryWeekBounds(summaryInputs(rows).sessions, summaryInputs(rows).logs, today, {
        earliest: app.backend.logHistoryStart(),
      })
    : { first: week, last: week };
  const pager = weekPager(week, bounds);
  const { status, decide } = useWeekStatus(pager.weekStart);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !rows) {
    return <Redirect href={route as Href} />;
  }
  const since = app.backend.logHistoryStart();
  const pending = new Set(app.pendingLogSessionIds);
  // Planname mit beiden Zielen (Etappe Z5) – ohne Wunschgewicht oder Tempo; nur für Wochen des aktiven Plans
  // (Wächter Z5 N7: eine vergangene Woche eines früheren Plans bekommt nicht den heutigen Namen).
  const active = activePlan(rows);
  const weekEnd = addDays(pager.weekStart, 6);
  const planName =
    active &&
    active.sessions.some((s) => s.scheduled_on >= pager.weekStart && s.scheduled_on <= weekEnd)
      ? planNameLine(active.plan)
      : null;
  const summary = status?.summary ?? null;
  const empty = status
    ? status.days.every((d) => d.state === 'rest' && d.movedAway.length === 0)
    : false;
  const km = kmText((summary?.distanceKm ?? 0) * 1000);

  return (
    <Screen
      area="training"
      icon="calendar"
      title={W.weekPage.title}
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
        <Body testID="week-range">{weekRangeText(pager.weekStart, weekEnd)}</Body>
        {planName ? (
          <Body muted testID="week-plan-name">
            {planName}
          </Body>
        ) : null}
      </View>
      {message ? (
        <Notice tone={message.tone === 'danger' ? 'danger' : 'success'} testID="week-message">
          {message.text}
        </Notice>
      ) : null}

      {summary ? (
        <View
          testID="week-summary"
          accessible
          accessibilityLabel={W.weekPage.summaryA11y(
            summary.sessionsDone,
            summary.sessionsPlanned,
            km,
            summary.enduranceMinutes,
          )}
          style={[
            styles.summary,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.stats}>
            <Stat
              value={`${summary.sessionsDone}/${summary.sessionsPlanned}`}
              label={W.weekPage.sessions}
            />
            <Stat value={km} label={W.weekPage.km} />
            {summary.kcal !== null ? (
              <Stat value={formatKcal(summary.kcal)} label={W.weekPage.kcal} />
            ) : (
              <Stat value={String(summary.enduranceMinutes)} label={W.weekPage.minutes} />
            )}
          </View>
          {summary.extraUnits > 0 || summary.strengthSets > 0 ? (
            <Text style={[styles.summaryExtra, appFont('regular'), { color: theme.textMuted }]}>
              {[
                summary.extraUnits > 0 ? W.extraUnits(summary.extraUnits) : null,
                summary.strengthSets > 0 ? W.weekPage.sets(summary.strengthSets) : null,
              ]
                .filter((v): v is string => v !== null)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {empty ? <Body muted>{t.week.empty}</Body> : null}
      <View style={styles.days}>
        {status?.days.map((day) => (
          <WeekDayRow
            key={day.date}
            day={day}
            pending={pending}
            onPress={() => {
              setMessage(null);
              setSheetDate(day.date);
            }}
          />
        ))}
      </View>
      <Body muted>{W.weekPage.tapHint}</Body>
      {/* Sportarten Stufe 2: Summen je Sportart und Trainingsbelastung der Woche. */}
      <SportWeekCard weekOf={pager.weekStart} />

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

      <Heading level={2}>{W.toolbar.label}</Heading>
      {/* Wochenauswertung (Etappe A3): Essen und Training dieser Woche. */}
      <Button
        label={t.weekEval.open}
        accessibilityLabel={t.weekEval.openA11y(weekRangeText(pager.weekStart, weekEnd))}
        onPress={() => router.push(`/wochenauswertung?woche=${pager.weekStart}` as Href)}
        testID="week-evaluation"
      />
      {/* Trainingskalender (Etappe A1a): Einheiten dieser oder kommender Wochen verschieben. */}
      <Button
        label={t.calendar.openFromWeek}
        accessibilityLabel={t.calendar.openA11y}
        variant="secondary"
        onPress={() => router.push('/kalender' as Href)}
        testID="week-calendar"
      />
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
      {/* Live-Anpassung (Phase 4b, 8.1 Punkt 2): nur, wenn es sie gibt (Testmodus mit „Premium simulieren“). */}
      {app.liveAdjust.available && app.liveAdjust.adjustments.length > 0 ? (
        <Button
          label={t.adjust.open}
          variant="secondary"
          onPress={() => router.push('/plan/changes' as Href)}
          testID="week-adjust-changes"
        />
      ) : null}
      <DaySheet
        date={sheetDate}
        status={status}
        onClose={() => setSheetDate(null)}
        onSelectDate={setSheetDate}
        onShowExercises={(date) => router.push(`/today?tag=${date}` as Href)}
        onMessage={setMessage}
        decide={decide}
      />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, appFont('extrabold'), { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, appFont('regular'), { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  days: { gap: spacing.sm },
  summary: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', rowGap: 8 },
  stat: { alignItems: 'center', minWidth: 80, gap: 2 },
  statValue: { fontSize: 26, lineHeight: 32 },
  statLabel: { fontSize: fontSize.sm, lineHeight: 20 },
  summaryExtra: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
});
