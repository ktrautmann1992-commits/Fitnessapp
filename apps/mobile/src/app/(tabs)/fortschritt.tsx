import { weekTrainingProgress } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';

import { DashboardTile } from '@/components/dashboard';
import { Screen } from '@/components/screen';
import { StrengthTileRows } from '@/components/strength-chart';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { EMPTY_LOG_ROWS, logRowsOf } from '@/data/log-rows';
import { historyLogRows } from '@/data/log-summary';
import { strengthTileItems, type StrengthTileItem } from '@/data/strength-progress';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Reiter „Fortschritt“ (docs/PLAN-DASHBOARD.md 2.5): Wochenzahlen und Wege zu Wochenauswertung, Trainingswoche,
 * Verlauf und Kalender. Kein Wunschgewicht, keine Kurve zum Ziel (docs/PLAN-ZIELE.md F13). Alles bleibt privat.
 * Seit 25.10.2026 die Kachel „Kraft-Entwicklung“: die meist trainierten Übungen mit Mini-Kurve (packages/core
 * `strengthOverview`) – nur eigene Werte, keine Bestleistung, keine Abzeichen.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
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
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.progressHub;
  const active = activePlan(app.rows);
  const week = active ? weekTrainingProgress(active.sessions, today) : null;
  let strength: StrengthTileItem[] | null;
  try {
    strength = strengthTileItems(
      historyLogRows(
        logRowsOf(app.rows),
        app.olderLogs?.logs ?? EMPTY_LOG_ROWS,
        app.backend.logHistoryStart(),
      ),
      today,
    );
  } catch {
    strength = null;
  }
  return (
    <Screen
      area="fortschritt"
      icon="trend"
      title={texts.title}
      intro={texts.intro}
      testID="progress"
    >
      <DashboardTile title={texts.weekTitle} area="fortschritt" icon="trend" testID="progress-week">
        <Body>
          {week
            ? t.dashboard.progress.week(week.completed, week.planned)
            : t.dashboard.progress.noPlan}
        </Body>
        {week && week.planned > 0 ? <Body muted>{texts.open(week.open)}</Body> : null}
        <Button
          label={texts.weekEvaluation}
          onPress={() => router.push('/wochenauswertung' as Href)}
          testID="progress-week-eval"
        />
      </DashboardTile>
      <DashboardTile
        title={t.strength.title}
        area="fortschritt"
        icon="dumbbell"
        testID="progress-strength"
      >
        {strength === null ? (
          <Notice tone="warning">{t.strength.failed}</Notice>
        ) : (
          <>
            {strength.length > 0 ? <Body muted>{t.strength.tileIntro}</Body> : null}
            <StrengthTileRows
              items={strength}
              onOpen={(id) => router.push(`/history/${encodeURIComponent(id)}` as Href)}
            />
          </>
        )}
      </DashboardTile>
      <Button
        label={texts.trainingWeek}
        variant="secondary"
        onPress={() => router.push('/week' as Href)}
        testID="progress-training-week"
      />
      <Button
        label={texts.history}
        variant="secondary"
        onPress={() => router.push('/history' as Href)}
        testID="progress-history"
      />
      <Button
        label={texts.calendar}
        variant="secondary"
        onPress={() => router.push('/kalender' as Href)}
        testID="progress-calendar"
      />
      <Button
        label={texts.day}
        variant="secondary"
        onPress={() => router.push(`/tag/${today}` as Href)}
        testID="progress-day"
      />
    </Screen>
  );
}
