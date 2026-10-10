import { exerciseHistory, findGlossaryExercise } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { EMPTY_LOG_ROWS, logEntriesFromRows, logRowsOf } from '@/data/log-rows';
import { historyExercises, historyLogRows } from '@/data/log-summary';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { bestSetText } from '@/lib/history-format';
import { dayLabel } from '@/lib/plan-format';
import { decodeRouteParam } from '@/lib/route-param';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Verlauf je Übung (docs/PLAN-PHASE-4.md 5.6/6.1 Punkt 5, Etappe D): je Training der beste Satz als
 * „Gewicht × Wiederholungen“ (exerciseHistory() aus packages/core, keine 1RM-Anzeige). Grundlage wie im
 * Einheiten-Verlauf (Wächter D K1): der vollständig geladene Zeitraum (Supabase: 12 Wochen) plus online nachgeladene
 * ältere Einträge – keine einzelnen älteren Einträge aus recent_exercise_logs (sonst sichtbare Lücken).
 */
export default function ExerciseHistoryScreen() {
  const params = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = decodeRouteParam(params.exerciseId);
  const router = useRouter();
  const app = useApp();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string>();
  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

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
  const rows = historyLogRows(logRowsOf(app.rows), app.olderLogs?.logs ?? EMPTY_LOG_ROWS, since);
  const canLoadOlder = since !== null && app.olderLogs?.nextBefore !== null;

  async function loadOlder() {
    setLoadingOlder(true);
    setError(undefined);
    try {
      await app.loadOlderLogs();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoadingOlder(false);
    }
  }
  const entries = exerciseHistory(exerciseId, logEntriesFromRows(rows));
  const name = historyExercises(rows).find((e) => e.exerciseId === exerciseId)?.name ?? null;
  // Anleitung im Glossar – auch archivierte Übungen (displayExercises, Etappe G1).
  const hasGuide =
    findGlossaryExercise(library.kind === 'ready' ? library.library : null, exerciseId) !== null;

  return (
    <Screen
      title={name ?? t.history.exercisesTitle}
      testID="exercise-history"
      footer={
        <Button
          label={t.history.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/history' as Href))}
        />
      }
    >
      {hasGuide ? (
        <Button
          label={t.glossary.guide}
          variant="link"
          accessibilityLabel={t.glossary.guideA11y(name ?? exerciseId)}
          onPress={() => router.push(`/uebungen/${encodeURIComponent(exerciseId)}` as Href)}
          testID="exercise-history-guide"
        />
      ) : null}
      {entries.length === 0 ? (
        <Card>
          <Body>{t.history.exerciseEmpty}</Body>
        </Card>
      ) : (
        <>
          <Body muted>{t.history.exerciseIntro}</Body>
          {entries.map((entry, index) => {
            const best = bestSetText(entry.best);
            return (
              <Card key={`${entry.performedOn}-${index}`}>
                <View testID="exercise-history-entry" style={{ gap: 2 }}>
                  <Heading level={2}>{dayLabel(entry.performedOn)}</Heading>
                  <Body accessibilityLabel={best.a11y}>{best.text}</Body>
                  <Body muted>{t.history.setsDone(entry.sets)}</Body>
                </View>
              </Card>
            );
          })}
        </>
      )}
      {canLoadOlder ? (
        <Button
          label={t.history.loadOlder}
          variant="secondary"
          onPress={() => void loadOlder()}
          loading={loadingOlder}
          testID="exercise-history-load-older"
        />
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Screen>
  );
}
