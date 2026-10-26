import { latestBodyWeight, weekTrainingProgress } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DashboardTile } from '@/components/dashboard';
import { StatValue } from '@/components/design';
import { MonthReviewTile } from '@/components/month-review-tile';
import { Screen } from '@/components/screen';
import { TileGrid } from '@/components/slim';
import { StrengthTileRows } from '@/components/strength-chart';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { WeightTrendSection } from '@/components/weight-trend';
import { EMPTY_LOG_ROWS, logRowsOf } from '@/data/log-rows';
import { historyLogRows } from '@/data/log-summary';
import { strengthTileItems, type StrengthTileItem } from '@/data/strength-progress';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * „Fortschritt“ (docs/PLAN-DASHBOARD.md 2.5; seit „App verschlanken“ 26.10.2026 unter Mehr › Fortschritt, Entwurf
 * 5-mehr-fortschritt): „Diese Woche“ mit drei Zahlen und Wochenauswertung, Körperdaten mit „Eintragen“ (vorher Kachel
 * auf der Übersicht), bunte Kacheln Verlauf · Kalender · Dein Tag · Trainingswoche, dazu Monatsrückblick,
 * Gewichtstrend (Gründer-Freigabe 25.10.2026: Trend ohne Ziellinie) und Kraft-Entwicklung (packages/core
 * `strengthOverview` – nur eigene Werte, keine Bestleistung, keine Abzeichen). Alles bleibt privat.
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
  const rows = app.rows;
  const texts = t.progressHub;
  const slim = t.slim.progress;
  const active = activePlan(rows);
  const week = active ? weekTrainingProgress(active.sessions, today) : null;
  const consent = healthConsentStatus(rows, app.versions);
  const latest = consent === 'valid' ? latestBodyWeight(rows.bodyMetrics) : null;
  let strength: StrengthTileItem[] | null;
  try {
    strength = strengthTileItems(
      historyLogRows(
        logRowsOf(rows),
        app.olderLogs?.logs ?? EMPTY_LOG_ROWS,
        app.backend.logHistoryStart(),
      ),
      today,
    );
  } catch {
    strength = null;
  }
  const dash = t.dashboard;
  return (
    <Screen area="fortschritt" icon="trend" title={texts.title} testID="progress">
      <DashboardTile title={texts.weekTitle} area="fortschritt" icon="trend" testID="progress-week">
        {week && week.planned > 0 ? (
          <View
            style={styles.stats}
            accessible
            accessibilityLabel={dash.progress.week(week.completed, week.planned)}
          >
            <View style={styles.stat}>
              <StatValue value={String(week.completed)} label={dash.progress.statDone} />
            </View>
            <View style={styles.stat}>
              <StatValue value={String(week.planned)} label={dash.progress.statPlanned} />
            </View>
            <View style={styles.stat}>
              <StatValue value={String(week.open)} label={dash.progress.statOpen} />
            </View>
          </View>
        ) : null}
        <Body muted={week !== null && week.planned > 0}>
          {week ? dash.progress.week(week.completed, week.planned) : dash.progress.noPlan}
        </Body>
        <Button
          label={slim.weekEvaluation}
          accessibilityLabel={texts.weekEvaluation}
          onPress={() => router.push('/wochenauswertung' as Href)}
          testID="progress-week-eval"
        />
      </DashboardTile>
      {/* Körperdaten (vorher Kachel auf der Übersicht): letztes Gewicht nur mit gültiger Einwilligung – nie Ziel. */}
      <DashboardTile title={slim.body} area="fortschritt" icon="scale" testID="progress-body">
        {consent !== 'valid' ? (
          <>
            <Body muted testID="progress-body-no-consent">
              {consent === 'outdated' ? dash.body.outdated : dash.body.noConsent}
            </Body>
            <Button
              label={dash.body.grant}
              variant="secondary"
              onPress={() => router.push('/health-consent')}
            />
          </>
        ) : (
          <>
            {latest ? (
              <Body
                testID="progress-body-weight"
                accessibilityLabel={dash.body.weightA11y(
                  latest.weightKg,
                  formatDateDe(latest.measuredOn),
                )}
              >
                {dash.body.weight(latest.weightKg, formatDateDe(latest.measuredOn))}
              </Body>
            ) : (
              <Body muted>{dash.body.none}</Body>
            )}
            <Button
              label={slim.bodyEnter}
              accessibilityLabel={dash.body.enter}
              variant="secondary"
              onPress={() =>
                router.push('/onboarding/body_metrics?edit=1&zurueck=fortschritt' as Href)
              }
              testID="progress-body-enter"
            />
          </>
        )}
      </DashboardTile>
      <TileGrid
        testID="progress-links"
        tiles={[
          {
            key: 'history',
            title: slim.history,
            subtitle: slim.historyDetail,
            area: 'fortschritt',
            icon: 'trend',
            accessibilityLabel: texts.history,
            onPress: () => router.push('/history' as Href),
            testID: 'progress-history',
          },
          {
            key: 'calendar',
            title: slim.calendar,
            subtitle: slim.calendarDetail,
            area: 'fortschritt',
            icon: 'calendar',
            accessibilityLabel: texts.calendar,
            onPress: () => router.push('/kalender' as Href),
            testID: 'progress-calendar',
          },
          {
            key: 'day',
            title: slim.day,
            subtitle: slim.dayDetail,
            area: 'ernaehrung',
            icon: 'utensils',
            accessibilityLabel: texts.day,
            onPress: () => router.push(`/tag/${today}` as Href),
            testID: 'progress-day',
          },
          {
            key: 'week',
            title: slim.week,
            subtitle: slim.weekDetail,
            area: 'training',
            icon: 'dumbbell',
            accessibilityLabel: texts.trainingWeek,
            onPress: () => router.push('/week' as Href),
            testID: 'progress-training-week',
          },
        ]}
      />
      {/* Monatsrückblick und Gewichtstrend (docs/PLAN-TREND-RUECKBLICK-KALENDER.md, Gründer-Freigabe 25.10.2026). */}
      <MonthReviewTile />
      <WeightTrendSection />
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
      <Body muted>{texts.intro}</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, minWidth: 0 },
});
