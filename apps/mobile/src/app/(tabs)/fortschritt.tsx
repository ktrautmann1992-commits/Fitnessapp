import { weekTrainingProgress } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';

import { DashboardTile } from '@/components/dashboard';
import { MonthReviewTile } from '@/components/month-review-tile';
import { Screen } from '@/components/screen';
import { Body, Button, LoadingState } from '@/components/ui';
import { WeightTrendSection } from '@/components/weight-trend';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Reiter „Fortschritt“ (docs/PLAN-DASHBOARD.md 2.5): Wochenzahlen und Wege zu Wochenauswertung, Trainingswoche,
 * Verlauf und Kalender, dazu Monatsrückblick und Gewichtstrend (Gründer-Freigabe 25.10.2026, ersetzt hier F13 aus
 * docs/PLAN-ZIELE.md: Trend ohne Ziellinie, Schätzung nur unter den Schutzregeln). Alles bleibt privat.
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
      {/* Monatsrückblick und Gewichtstrend (docs/PLAN-TREND-RUECKBLICK-KALENDER.md, Gründer-Freigabe 25.10.2026). */}
      <MonthReviewTile />
      <WeightTrendSection />
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
