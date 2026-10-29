import { isoWeekday, STEP_GOAL, stepGoalNudge, stepProgress, stepWeek } from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DashboardTile } from '@/components/dashboard';
import { MiniBars, ProgressRing, useAreaColors } from '@/components/design';
import { LiveAnnouncement } from '@/components/live-announcement';
import { Text } from '@/components/text';
import { Body, Button, Card, ChoiceList, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { useAppLayout } from '@/state/use-app-layout';
import { useWearables, wearableConsentsValid, wearableDriver } from '@/state/use-wearables';

const S = t.stepCounter;

/** Schnellauswahl beim Schrittziel (innerhalb STEP_GOAL; 8.000 = Standard). */
const PRESETS = [6000, 8000, 10_000, 12_000] as const;

/**
 * Kachel „Schritte“ auf der Übersicht (Gründer-Wunsch 22.10.2026, docs/PLAN-PHASE-8.md 13.4): Ring füllt sich mit den
 * heutigen Schritten (Handy und/oder Uhr) bis zum Tagesziel, große Zahl in der Mitte, „von 8.000“ darunter; erreicht → Ring voll in
 * Erfolgsfarbe mit „✓ Ziel erreicht“. Darunter Mini-Balken der letzten 7 Tage. Leer: ohne Uhr/Einwilligung Hinweis mit
 * „Handy nutzen“ (Schritte, die das Handy selbst zählt – über Health Connect, auch ganz ohne Uhr) und „Uhr verbinden“,
 * verbunden ohne Wert heute „Noch keine Schritte heute“. Antippen → Smartwatch (dort Schrittziel).
 * Rechnet nichts selbst (packages/core: stepProgress, stepWeek). Schritte sind Gesundheitsdaten: nur Anzeige, nie Logs.
 */
export function StepsTile({ today }: { today: string }) {
  const router = useRouter();
  const app = useApp();
  const { state } = useWearables();
  const { stepGoal } = useAppLayout();
  const theme = useThemeColors();
  const palette = useAreaColors('ausdauer');
  const metrics = state.kind === 'ready' ? state.result.rows.dailyMetrics : null;
  const week = useMemo(
    () => (metrics ? stepWeek(metrics, today, stepGoal) : null),
    [metrics, today, stepGoal],
  );
  const toSmartwatch = () => router.push('/smartwatch' as Href);
  const base = { title: S.tile.title, area: 'ausdauer' as const, icon: 'run' as const };

  if (state.kind === 'loading') {
    return (
      <DashboardTile {...base} testID="overview-steps">
        <LoadingState label={S.tile.loading} />
      </DashboardTile>
    );
  }
  const connection = state.kind === 'ready' ? state.result.rows.connection : null;
  if (!connection) {
    const unsupported = wearableDriver(app.backend.mode).kind === 'none';
    const text = unsupported
      ? S.tile.onlyAndroid
      : wearableConsentsValid(app)
        ? S.tile.noWatch
        : S.tile.noConsent;
    return (
      <DashboardTile {...base} testID="overview-steps">
        <Body muted style={styles.small} testID="overview-steps-empty">
          {text}
        </Body>
        {unsupported ? null : (
          <>
            {/* Ohne Uhr: Schritte, die das Handy selbst zählt (Health Connect, 29.10.2026). */}
            <Button
              label={S.tile.phone}
              accessibilityLabel={S.tile.phoneA11y}
              variant="secondary"
              compact
              onPress={() => router.push('/smartwatch?quelle=handy' as Href)}
              testID="overview-steps-phone"
            />
            <Button
              label={S.tile.connect}
              variant="secondary"
              compact
              onPress={toSmartwatch}
              testID="overview-steps-connect"
            />
          </>
        )}
      </DashboardTile>
    );
  }

  const bars = week ? (
    <MiniBars
      values={week.days.map((d) => d.share)}
      area="ausdauer"
      highlightIndex={week.todayIndex}
      accessibilityLabel={S.tile.barsA11y(
        week.days.map((d) => ({ weekday: isoWeekday(d.day), steps: d.steps })),
      )}
      testID="overview-steps-bars"
    />
  ) : null;

  if (!week || week.today === null) {
    return (
      <DashboardTile
        {...base}
        testID="overview-steps"
        pressTestID="overview-steps-open"
        accessibilityLabel={`${S.tile.title}: ${S.tile.noData}`}
        onPress={toSmartwatch}
      >
        <Body muted style={styles.small} testID="overview-steps-no-data">
          {S.tile.noData}
        </Body>
        {week && week.daysWithData > 0 ? bars : null}
      </DashboardTile>
    );
  }

  const progress = stepProgress({ steps: week.today, goal: stepGoal });
  const a11y = S.tile.a11y(progress.steps, progress.goal, progress.percent, progress.reached);
  const ringColor = progress.reached ? theme.success : palette.strong;
  return (
    <DashboardTile
      {...base}
      testID="overview-steps"
      pressTestID="overview-steps-open"
      accessibilityLabel={`${S.tile.title}: ${a11y}. ${S.tile.open}`}
      onPress={toSmartwatch}
    >
      <View
        style={styles.ringWrap}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11y}
        testID="overview-steps-ring"
      >
        <ProgressRing size={112} stroke={10} fraction={progress.fraction} color={ringColor}>
          <Text
            style={[styles.value, appFont('extrabold'), { color: theme.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="overview-steps-value"
          >
            {S.tile.value(progress.steps)}
          </Text>
          <Text
            style={[styles.of, appFont('regular'), { color: theme.textMuted }]}
            numberOfLines={1}
            testID="overview-steps-goal"
          >
            {S.tile.of(progress.goal)}
          </Text>
        </ProgressRing>
      </View>
      {progress.reached ? (
        <Text
          style={[styles.status, appFont('bold'), { color: theme.success }]}
          testID="overview-steps-reached"
        >
          {`✓ ${S.tile.reached}`}
        </Text>
      ) : (
        <Text
          style={[styles.status, appFont('semibold'), { color: theme.textMuted }]}
          testID="overview-steps-remaining"
        >
          {S.tile.remaining(progress.remaining)}
        </Text>
      )}
      {bars}
    </DashboardTile>
  );
}

/**
 * „Schrittziel“ auf der Smartwatch-Seite: Weniger/Mehr in 500er-Schritten (1.000–30.000) und Schnellauswahl. Speichert
 * sofort mit der Anordnung der Übersicht (offline möglich), Ansage per Live-Region. Regeln: packages/core STEP_GOAL.
 */
export function StepGoalCard() {
  const { stepGoal, saveStepGoal } = useAppLayout();
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const theme = useThemeColors();

  async function apply(goal: number) {
    if (goal === stepGoal) return;
    setError(null);
    try {
      await saveStepGoal(goal);
      setAnnounce(S.goal.saved(goal));
    } catch {
      setError(S.goal.saveFailed);
    }
  }

  return (
    <Card>
      <View style={{ gap: spacing.sm }} testID="step-goal">
        <Heading level={2}>{S.goal.title}</Heading>
        <Body muted>{S.goal.intro}</Body>
        <LiveAnnouncement text={announce} testID="step-goal-live" />
        {error ? (
          <Notice tone="danger" testID="step-goal-error">
            {error}
          </Notice>
        ) : null}
        <View style={styles.stepper}>
          <View style={styles.stepperButton}>
            <Button
              label={S.goal.less}
              variant="secondary"
              accessibilityLabel={S.goal.lessA11y(STEP_GOAL.step)}
              disabled={stepGoal <= STEP_GOAL.min}
              onPress={() => void apply(stepGoalNudge(stepGoal, -1))}
              testID="step-goal-less"
            />
          </View>
          <Text
            style={[styles.goalValue, appFont('extrabold'), { color: theme.text }]}
            testID="step-goal-value"
          >
            {S.goal.value(stepGoal)}
          </Text>
          <View style={styles.stepperButton}>
            <Button
              label={S.goal.more}
              variant="secondary"
              accessibilityLabel={S.goal.moreA11y(STEP_GOAL.step)}
              disabled={stepGoal >= STEP_GOAL.max}
              onPress={() => void apply(stepGoalNudge(stepGoal, 1))}
              testID="step-goal-more"
            />
          </View>
        </View>
        <ChoiceList
          groupLabel={S.goal.presets}
          horizontal
          value={stepGoal}
          onChange={(goal) => void apply(goal)}
          options={PRESETS.map((goal) => ({
            value: goal,
            label: S.goal.preset(goal),
            testID: `step-goal-preset-${goal}`,
          }))}
        />
        <Body muted style={styles.small}>
          {S.goal.hint}
        </Body>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: fontSize.sm, lineHeight: 20 },
  ringWrap: { alignItems: 'center', paddingVertical: spacing.xs },
  value: { fontSize: fontSize.lg, lineHeight: 24, maxWidth: 84, textAlign: 'center' },
  of: { fontSize: fontSize.xs, lineHeight: 16 },
  status: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: { flex: 1, minWidth: 0 },
  goalValue: { fontSize: fontSize.lg, textAlign: 'center', flexShrink: 0 },
});
