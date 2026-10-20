import {
  cookDayOverview,
  cookDayProgress,
  defaultMealPrepWeekStart,
  isoDateSchema,
  mealPlanWeekEditable,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DemoBanner, NutritionGate, nutritionReady } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { storedMealPlanRow } from '@/data/meal-plan-rows';
import { t } from '@/i18n';
import {
  alertCookStep,
  type CookAlertMode,
  cookAlertNote,
  currentCookAlertMode,
  prepareCookAlerts,
} from '@/lib/cook-alerts';
import { countdownText } from '@/lib/nutrition-format';
import { dayLabel, weekdayName } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';
import { Text } from '@/components/text';

const TICK_MS = 1000;

/**
 * Meal-Prep-Kochtag mit Timern (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.7, Etappe N5b): Schritt-für-Schritt-Ablauf nach
 * den Startminuten des gewählten Plans. Der Start wird gespeichert (Testmodus: Gerätespeicher); Fortschritt und
 * Restzeit rechnet packages/core aus Zeitstempeln (`cookDayProgress`) – der Timer läuft dadurch nach dem Neuladen, im
 * Hintergrund und ohne Netz richtig weiter. Beginnt ein Schritt, gibt es einen Hinweis (Browser: Mitteilung, wenn
 * erlaubt; App: Vibration und Ansage, solange sie offen ist). Dazu: was eingefroren wird und was in den Kühlschrank
 * kommt (Auftau-Hinweise aus `storage_plan`/R9). Keine kcal.
 */
export default function CookDayScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const params = useLocalSearchParams<{ woche?: string }>();
  const today = useToday();
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : null;
  const weekStart =
    requested !== null && mealPlanWeekEditable(requested, today)
      ? requested
      : defaultMealPrepWeekStart(today);
  const view = useNutritionWeek(weekStart);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertMode, setAlertMode] = useState<CookAlertMode>(currentCookAlertMode);
  const lastIndex = useRef<number | null>(null);

  const row = app.rows ? storedMealPlanRow(app.rows, weekStart) : null;
  const startedAt = row?.cook_day_started_at ?? null;
  const startedMs = startedAt === null ? null : Date.parse(startedAt);
  const ready =
    nutritionReady(view) && view.week?.kind === 'ready' && view.library.kind === 'ready';
  const plan = ready && view.week?.kind === 'ready' ? view.week.plan : null;
  const mealPrepPlan =
    plan !== null && view.library.kind === 'ready'
      ? (view.library.result.library.mealPrepPlans.find((p) => p.id === plan.mealPrepPlanId) ??
        null)
      : null;
  const overview =
    plan !== null && mealPrepPlan !== null ? cookDayOverview(plan, mealPrepPlan) : null;
  const progress =
    overview !== null && startedMs !== null && !Number.isNaN(startedMs)
      ? cookDayProgress(overview.steps, startedMs, Math.max(now, 0))
      : null;

  // Zeitgeber nur zum Neuzeichnen; die Zeit selbst kommt aus Zeitstempeln.
  useEffect(() => {
    if (startedMs === null) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startedMs]);

  // Neuer Schritt → Hinweis (nicht beim ersten Anzeigen, z. B. nach dem Neuladen).
  const currentIndex = progress?.currentIndex ?? null;
  const currentText =
    currentIndex !== null && overview !== null && currentIndex >= 0
      ? (overview.steps[currentIndex]?.textDe ?? null)
      : null;
  useEffect(() => {
    if (currentIndex === null) {
      lastIndex.current = null;
      return;
    }
    if (lastIndex.current !== null && currentIndex > lastIndex.current && currentText !== null) {
      alertCookStep(currentText);
    }
    lastIndex.current = currentIndex;
  }, [currentIndex, currentText]);

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
  const texts = t.nutrition.cookDay;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/meal-prep' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen area="ernaehrung" icon="box" title={texts.title} testID="cook-day" footer={footer}>
      {children}
    </Screen>
  );
  if (!ready || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  if (overview === null || mealPrepPlan === null) {
    return shell(
      <Card>
        <Body testID="cook-day-not-chosen">{texts.notChosen}</Body>
        <Button
          label={texts.choosePlan}
          variant="secondary"
          onPress={() => router.push(`/meal-prep?woche=${weekStart}` as Href)}
        />
      </Card>,
    );
  }
  const { demo } = view.library.result;
  const days = (dates: readonly string[]) => dates.map(weekdayName).join(', ');

  async function setStart(value: string | null) {
    setBusy(true);
    setError(null);
    try {
      if (value !== null) setAlertMode(await prepareCookAlerts());
      lastIndex.current = null;
      await app.saveCookDayStart(weekStart, value);
      setNow(Date.now());
    } catch {
      setError(texts.startFailed);
    } finally {
      setBusy(false);
    }
  }

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Heading level={2}>{mealPrepPlan.title_de}</Heading>
      <Body testID="cook-day-date">
        {t.nutrition.mealPrep.cookDay(dayLabel(overview.cookDate))}
      </Body>

      {progress === null ? (
        <Card>
          <Body>{texts.notStarted}</Body>
          <Button
            label={texts.start}
            loading={busy}
            onPress={() => void setStart(new Date().toISOString())}
            testID="cook-day-start"
          />
        </Card>
      ) : (
        <Card>
          <Body testID="cook-day-running">{texts.running}</Body>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.timer, { color: theme.text }]}
            testID="cook-day-countdown"
          >
            {progress.secondsToNext === null
              ? texts.allStarted
              : progress.currentIndex < 0
                ? texts.waitingFirst(countdownText(progress.secondsToNext))
                : texts.next(countdownText(progress.secondsToNext))}
          </Text>
          <Body muted>{cookAlertNote(alertMode)}</Body>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label={texts.restart}
                variant="secondary"
                loading={busy}
                onPress={() => void setStart(new Date().toISOString())}
                testID="cook-day-restart"
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={texts.stop}
                variant="secondary"
                disabled={busy}
                onPress={() => void setStart(null)}
                testID="cook-day-stop"
              />
            </View>
          </View>
        </Card>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <View style={styles.list} testID="cook-day-steps">
        {overview.steps.map((step, index) => {
          const state =
            progress === null
              ? null
              : index === progress.currentIndex
                ? 'current'
                : index < progress.currentIndex
                  ? 'done'
                  : 'upcoming';
          return (
            <View
              key={`${step.startMin}-${index}`}
              testID={`cook-day-step-${index}`}
              accessibilityLabel={`${texts.stepAt(step.startMin)}: ${step.textDe}${
                state === null ? '' : `, ${texts[state === 'current' ? 'current' : state]}`
              }`}
              style={[
                styles.step,
                {
                  borderColor: state === 'current' ? theme.primary : theme.border,
                  borderWidth: state === 'current' ? 3 : 1,
                  backgroundColor: theme.surface,
                  opacity: state === 'done' ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.stepTime, { color: theme.textMuted }]}>
                {state === 'current'
                  ? `${texts.stepAt(step.startMin)} · ${texts.current}`
                  : state === 'done'
                    ? `${texts.stepAt(step.startMin)} · ${texts.done}`
                    : texts.stepAt(step.startMin)}
              </Text>
              <Text style={[styles.stepText, { color: theme.text }]}>{step.textDe}</Text>
            </View>
          );
        })}
      </View>

      <Card>
        <Heading level={2}>{texts.storageTitle}</Heading>
        <View style={styles.list} testID="cook-day-storage">
          {overview.recipes.map((recipe) => (
            <View key={recipe.recipeId} style={{ gap: 2 }}>
              {recipe.fridgeDates.length > 0 ? (
                <Body>{texts.fridgeLine(recipe.titleDe, days(recipe.fridgeDates))}</Body>
              ) : null}
              {recipe.freezeDates.length > 0 ? (
                <Body testID={`cook-day-freeze-${recipe.recipeId}`}>
                  {texts.freezeLine(recipe.titleDe, days(recipe.freezeDates))}
                </Body>
              ) : null}
              {recipe.freshDates.length > 0 ? (
                <Body muted>{texts.freshLine(recipe.titleDe, days(recipe.freshDates))}</Body>
              ) : null}
            </View>
          ))}
        </View>
        {overview.recipes.some((r) => r.freezeDates.length > 0) ? (
          <Body muted>{t.nutrition.storage.freeze}</Body>
        ) : null}
      </Card>
      <Body muted>{t.nutrition.mealPrep.safetyNote}</Body>
    </>,
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  timer: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  step: { borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  stepTime: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  stepText: { fontSize: fontSize.md },
});
