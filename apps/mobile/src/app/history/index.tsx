import { historyByWeek, HISTORY_PAGE_SIZE } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, MIN_TOUCH, Notice } from '@/components/ui';
import { EMPTY_LOG_ROWS, logRowsOf } from '@/data/log-rows';
import { historyExercises, historyLogRows, summaryLogs } from '@/data/log-summary';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { logSummaryText } from '@/lib/history-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Verlauf (docs/PLAN-PHASE-4.md 6.1 Punkt 5, Etappe D): Einheiten nach Wochen, neueste zuerst, je 20 weitere
 * (HISTORY_PAGE_SIZE); ältere als der Gerätespeicher (Supabase: 12 Wochen) online nachladen (4.5). Antippen öffnet
 * den Eintrag (ansehen, ändern, löschen); darunter der Verlauf je Übung. Gruppierung: historyByWeek() (core).
 */
export default function HistoryScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string>();

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
  const since = app.backend.logHistoryStart();
  const older = app.olderLogs?.logs ?? EMPTY_LOG_ROWS;
  const own = logRowsOf(app.rows);
  const historyRows = historyLogRows(own, older, since);
  const logs = summaryLogs(historyRows);
  const weeks = historyByWeek(logs, { limit });
  // Gleiche Grundlage wie der Einheiten-Verlauf (Wächter D K1).
  const exercises = historyExercises(historyRows);
  const pending = new Set(app.pendingLogSessionIds);
  const moreOnDevice = logs.length > limit;
  const olderDone = app.olderLogs !== null && app.olderLogs.nextBefore === null;
  const canLoadOlder = since !== null && !olderDone;

  async function loadOlder() {
    setLoadingOlder(true);
    setError(undefined);
    try {
      await app.loadOlderLogs();
      setLimit((current) => current + HISTORY_PAGE_SIZE);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <Screen
      title={t.history.title}
      intro={logs.length > 0 ? t.history.intro : undefined}
      testID="history"
      footer={
        <Button
          label={t.history.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {logs.length === 0 && !canLoadOlder ? (
        <Card>
          <Body testID="history-empty">{t.history.empty}</Body>
        </Card>
      ) : null}
      {logs.length === 0 && canLoadOlder ? <Body muted>{t.history.empty}</Body> : null}

      {weeks.map((week) => (
        <View key={week.weekStart} style={styles.week} testID={`history-week-${week.weekStart}`}>
          <Heading level={2}>{t.history.weekOf(formatDateDe(week.weekStart))}</Heading>
          {week.logs.map((log) => {
            const summary = logSummaryText(log);
            const status = log.status === 'completed' ? t.history.completed : t.history.partial;
            const waiting = log.planned_session_id !== null && pending.has(log.planned_session_id);
            const label = [
              dayLabel(log.performed_on),
              log.name_de,
              status,
              summary.a11y,
              waiting ? t.history.pending : null,
            ]
              .filter((value): value is string => value !== null)
              .join(', ');
            return (
              <Pressable
                key={log.id}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => router.push(`/log/${log.id}` as Href)}
                testID="history-entry"
                style={({ pressed }) => [
                  styles.entry,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.entryDate, { color: theme.textMuted }]}>
                  {dayLabel(log.performed_on)}
                </Text>
                <Text style={[styles.entryName, { color: theme.text }]}>{log.name_de}</Text>
                <Text style={[styles.entryLine, { color: theme.text }]}>
                  {status} · {summary.text}
                </Text>
                {waiting ? (
                  <Text style={[styles.entryLine, { color: theme.textMuted }]}>
                    {t.history.pending}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {moreOnDevice ? (
        <Button
          label={t.history.showMore}
          variant="secondary"
          onPress={() => setLimit((current) => current + HISTORY_PAGE_SIZE)}
          testID="history-more"
        />
      ) : canLoadOlder ? (
        <>
          {loadingOlder ? <LoadingState label={t.history.loadingOlder} /> : null}
          <Button
            label={t.history.loadOlder}
            variant="secondary"
            onPress={() => void loadOlder()}
            loading={loadingOlder}
            testID="history-load-older"
          />
        </>
      ) : olderDone ? (
        <Body muted>{t.history.noOlder}</Body>
      ) : null}
      {error ? (
        <Notice tone="danger" testID="history-error">
          {error}
        </Notice>
      ) : null}

      {exercises.length > 0 ? (
        <View style={styles.week} testID="history-exercises">
          <Heading level={2}>{t.history.exercisesTitle}</Heading>
          {exercises.map((exercise) => (
            <Button
              key={exercise.exerciseId}
              label={`${exercise.name} (${t.history.exerciseCount(exercise.count)})`}
              variant="secondary"
              onPress={() =>
                router.push(`/history/${encodeURIComponent(exercise.exerciseId)}` as Href)
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: { gap: spacing.xs },
  entry: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  entryDate: { fontSize: fontSize.sm, lineHeight: 20 },
  entryName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  entryLine: { fontSize: fontSize.md, lineHeight: 22 },
});
