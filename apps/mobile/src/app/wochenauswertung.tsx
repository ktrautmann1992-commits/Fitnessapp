import {
  addDays,
  isoDateSchema,
  type NutritionNoticeCode,
  startOfIsoWeek,
  summaryWeekBounds,
  weekEvaluation,
  type WeekEvaluation,
  type WeekEvaluationInput,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConsentBlockedNotice, EatingHelpNotice } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { WeekDayRow, WeekTrainingRow } from '@/components/week-evaluation';
import { summaryInputs } from '@/data/log-summary';
import {
  firstCompleteWeek,
  weekEvaluationInput,
  weekEvaluationNavigation,
} from '@/data/week-evaluation';
import { t } from '@/i18n';
import { weekRangeText } from '@/lib/history-format';
import { decodeRouteParam } from '@/lib/route-param';
import { useToday } from '@/lib/use-today';
import {
  weekDayView,
  weekFoodLines,
  weekFoodLinesWithoutNumbers,
  weekFreeLine,
  weekHasTraining,
  weekTrainingLines,
} from '@/lib/week-evaluation-format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Wochenauswertung (docs/PLAN-AUSWERTUNG.md Abschnitt 8, Etappe A3): Mo–So, Blättern wie in „Woche“ (`weekPager`).
 * Essen: sieben kleine Tagesbalken mit Farbe UND Kurztext (Tippen öffnet „Dein Tag“), „An n Tagen eingetragen. Davon
 * …“, Ø je eingetragenem Tag gegen das Ø-Ziel dieser Tage – keine Wochen-Bilanz, keine Prognose; Muster-Hinweis mit
 * Hilfe-Stellen ab 3 Tagen unter der Untergrenze. „Zahlen aus“/Schwangerschaft: nur Anzahlen, nirgends kcal.
 * Training: Einheiten mit Tag, Stufe und Erfüllungsgrad, Summen, freie Einheiten extra. Rechnet nichts selbst
 * (`weekEvaluation()` aus packages/core). Alles aus dem Gerätespeicher. Keine Gesundheitsdaten in Logs oder testIDs.
 */
export default function WeekEvaluationScreen() {
  const params = useLocalSearchParams<{ woche?: string }>();
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const raw = params.woche === undefined ? null : decodeRouteParam(params.woche);
  const parsed = raw === null ? null : isoDateSchema.safeParse(raw);
  const invalid = parsed !== null && !parsed.success;
  const requested = startOfIsoWeek(parsed?.success ? parsed.data : today);
  const view = useNutritionWeek(requested);
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
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/week' as Href));
  const footer = <Button label={t.weekEval.back} variant="secondary" onPress={goBack} />;
  const shell = (children: ReactNode) => (
    <Screen
      area="fortschritt"
      icon="trend"
      title={t.weekEval.title}
      testID="week-eval"
      footer={footer}
    >
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {children}
    </Screen>
  );

  if (invalid) {
    return shell(
      <Notice tone="danger" testID="week-eval-invalid">
        <Body>{t.weekEval.invalidWeek}</Body>
        <Button
          label={t.weekEval.toWeek}
          variant="secondary"
          onPress={() => router.replace('/week' as Href)}
        />
      </Notice>,
    );
  }

  const { sessions, logs } = summaryInputs(rows);
  const since = app.backend.logHistoryStart();
  const complete = firstCompleteWeek(since);
  const bounds = summaryWeekBounds(sessions, logs, today, { earliest: complete });
  const { tooOld, previous, next } = weekEvaluationNavigation(requested, bounds, complete);
  const go = (week: string) => router.replace(`/wochenauswertung?woche=${week}` as Href);
  const isCurrent = requested === startOfIsoWeek(today);
  const header = (
    <View style={styles.header}>
      <Heading level={2}>{isCurrent ? t.weekEval.current : t.week.title}</Heading>
      <Body testID="week-eval-range">{weekRangeText(requested, addDays(requested, 6))}</Body>
    </View>
  );
  const pagerView = (
    <View style={styles.pager}>
      <View style={styles.pagerButton}>
        <Button
          label={t.week.previous}
          variant="secondary"
          accessibilityLabel={t.week.previousA11y}
          disabled={previous === null}
          onPress={() => previous && go(previous)}
          testID="week-eval-prev"
        />
      </View>
      <View style={styles.pagerButton}>
        <Button
          label={t.week.next}
          variant="secondary"
          accessibilityLabel={t.week.nextA11y}
          disabled={next === null}
          onPress={() => next && go(next)}
          testID="week-eval-next"
        />
      </View>
    </View>
  );

  if (tooOld) {
    return shell(
      <>
        {header}
        {pagerView}
        <Notice tone="info" testID="week-eval-too-old">
          <Body>{t.weekEval.tooOld}</Body>
          <Button
            label={t.weekEval.openHistory}
            variant="secondary"
            onPress={() => router.push('/history' as Href)}
          />
        </Notice>
      </>,
    );
  }

  const week = view.week;
  const ready = week?.kind === 'ready' ? week : null;
  const consentValid = healthConsentStatus(rows, app.versions) === 'valid';
  const foodSupported = app.backend.supportsNutrition;
  const evaluation = safeWeekEvaluation(
    weekEvaluationInput({
      rows,
      weekStart: requested,
      today,
      showNumbers: view.showNumbers,
      nutrition:
        ready === null
          ? null
          : {
              targets: ready.targets,
              plan: ready.plan,
              planStored: ready.planState?.action === 'stored',
              weekEditable: ready.planState?.editable === true,
            },
      foodLogAvailable: foodSupported && consentValid,
      library: library.kind === 'ready' ? library.library : null,
    }),
  );
  if (evaluation === null) {
    return shell(
      <>
        {header}
        {pagerView}
        <Notice tone="danger" testID="week-eval-error">
          {t.weekEval.computeFailed}
        </Notice>
      </>,
    );
  }
  const libraryReady = library.kind === 'ready' || library.kind === 'missing';
  const nutritionLoading =
    foodSupported && (view.library.kind === 'idle' || view.library.kind === 'loading');
  const hasActivePlan = rows.plans.some((p) => p.status === 'active');
  const trainingLines = weekTrainingLines(evaluation.training);
  const freeLine = weekFreeLine(evaluation.training);
  const openDay = (date: string) => router.push(`/tag/${date}` as Href);
  const openLog = (logId: string) => router.push(`/log/${logId}` as Href);

  return shell(
    <>
      {header}
      {pagerView}
      {previous === null && since !== null ? <Body muted>{t.weekEval.olderHint}</Body> : null}
      {evaluation.timing === 'future' ? (
        <Notice tone="info" testID="week-eval-not-started">
          {t.weekEval.notStarted}
        </Notice>
      ) : null}
      {evaluation.easyWeek ? (
        <Notice tone="info" testID="week-eval-easy">
          {t.day.easyWeek[evaluation.easyWeek]}
        </Notice>
      ) : null}

      {evaluation.timing !== 'future' ? (
        <>
          <Heading level={2}>{t.weekEval.foodTitle}</Heading>
          <View style={styles.section} testID="week-eval-food">
            {!foodSupported ? (
              <Notice tone="info">{t.foodLog.unsupported}</Notice>
            ) : nutritionLoading ? (
              <LoadingState label={t.nutrition.loading} />
            ) : (
              <FoodSection
                evaluation={evaluation}
                week={week}
                today={today}
                consentValid={consentValid}
                onOpenDay={openDay}
              />
            )}
          </View>
        </>
      ) : null}

      <Heading level={2}>{t.weekEval.trainingTitle}</Heading>
      <View style={styles.section} testID="week-eval-training">
        {!libraryReady && evaluation.training.items.some((i) => i.item.logId !== null) ? (
          <LoadingState label={t.day.loadingTraining} />
        ) : !weekHasTraining(evaluation) ? (
          <Body muted testID="week-eval-training-empty">
            {hasActivePlan ? t.weekEval.noSessions : t.weekEval.noPlan}
          </Body>
        ) : (
          <>
            <Card>
              <View style={styles.lines} testID="week-eval-training-sums">
                {trainingLines.map((line) => (
                  <Body key={line.text} accessibilityLabel={line.a11y}>
                    {line.text}
                  </Body>
                ))}
                {evaluation.training.strengthSets.planned > 0 ? (
                  <Body muted>{t.weekEval.setsNote}</Body>
                ) : null}
              </View>
            </Card>
            {evaluation.training.items.map((entry, index) => (
              <WeekTrainingRow
                key={entry.item.logId ?? entry.item.sessionId ?? index}
                entry={entry}
                onOpenLog={openLog}
              />
            ))}
            {freeLine !== null ? (
              <>
                <Heading level={2}>{t.weekEval.freeTitle}</Heading>
                <Body testID="week-eval-free">{freeLine}</Body>
                <Body muted>{t.weekEval.freeNote}</Body>
                {evaluation.training.free.map((entry, index) => (
                  <WeekTrainingRow
                    key={entry.item.logId ?? index}
                    entry={entry}
                    onOpenLog={openLog}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
        <Button
          label={t.calendar.open}
          accessibilityLabel={t.calendar.openA11y}
          variant="secondary"
          onPress={() => router.push('/kalender' as Href)}
          testID="week-eval-calendar"
        />
      </View>
    </>,
  );
}

function FoodSection({
  evaluation,
  week,
  today,
  consentValid,
  onOpenDay,
}: {
  evaluation: WeekEvaluation;
  week: ReturnType<typeof useNutritionWeek>['week'];
  today: string;
  consentValid: boolean;
  onOpenDay: (date: string) => void;
}) {
  const router = useRouter();
  if (week?.kind === 'blocked') return <ConsentBlockedNotice reason={week.reason} />;
  if (week?.kind === 'incomplete') return <Notice tone="info">{t.nutrition.incomplete}</Notice>;
  if (week?.kind === 'error') return <Notice tone="danger">{t.nutrition.computeFailed}</Notice>;
  const food = evaluation.food;
  // Hinweise der Engine (Schwangerschaft, Einladung zu Körperdaten/Einwilligung) – gleicher Text nur einmal.
  const codes: NutritionNoticeCode[] = [
    ...new Set(evaluation.days.flatMap((d) => [...d.food.targetNotices])),
  ];
  const notices = [...new Map(codes.map((code) => [t.nutrition.notices[code], code])).values()];
  return (
    <>
      {!food.available ? (
        <Notice tone="info" testID="week-eval-consent">
          <Body>{t.foodLog.consentNeeded}</Body>
          <Button
            label={t.foodLog.consentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
        </Notice>
      ) : null}
      {notices.map((code) => (
        <Notice key={code} tone="info" testID="week-eval-target-notice">
          <Body>{t.nutrition.notices[code]}</Body>
          {code !== 'pregnancy_no_targets' ? (
            <Button
              label={
                consentValid ? t.nutrition.actions.updateWeight : t.nutrition.actions.grantConsent
              }
              variant="secondary"
              onPress={() =>
                router.push(
                  (consentValid ? '/onboarding/body_metrics?edit=1' : '/health-consent') as Href,
                )
              }
            />
          ) : null}
        </Notice>
      ))}
      <View style={styles.days} testID="week-eval-days">
        {evaluation.days.map((day) => (
          <WeekDayRow
            key={day.date}
            view={weekDayView(day)}
            isToday={day.date === today}
            onOpen={() => onOpenDay(day.date)}
          />
        ))}
      </View>
      {food.available ? (
        food.kind === 'numbers' ? (
          <NumbersSummary food={food} />
        ) : (
          <View style={styles.lines} testID="week-eval-food-summary">
            {weekFoodLinesWithoutNumbers(food).map((line) => (
              <Body key={line}>{line}</Body>
            ))}
            {food.todayOpen ? <Body muted>{t.weekEval.todayOpen}</Body> : null}
            {/* Wächter A3 G1: nur der feste Hilfe-Hinweis – ohne Einleitung, ohne „Mindestbedarf“, ohne Zahl. */}
            {food.helpNotice ? (
              <View testID="week-eval-help">
                <EatingHelpNotice />
              </View>
            ) : null}
          </View>
        )
      ) : null}
    </>
  );
}

function NumbersSummary({ food }: { food: Extract<WeekEvaluation['food'], { kind: 'numbers' }> }) {
  const lines = weekFoodLines(food);
  return (
    <>
      <Card>
        <View style={styles.lines} testID="week-eval-food-summary">
          <Body testID="week-eval-entry-days">{lines.entryDays}</Body>
          {lines.zones !== null ? <Body testID="week-eval-zones">{lines.zones}</Body> : null}
          {lines.average !== null ? (
            <>
              <Body accessibilityLabel={lines.average.a11y} testID="week-eval-average">
                {lines.average.text}
              </Body>
              <Body muted>{t.weekEval.averageNote}</Body>
            </>
          ) : null}
          {food.noTargetDays > 0 ? (
            <Body muted testID="week-eval-no-target">
              {t.weekEval.noTarget}
            </Body>
          ) : null}
          {food.meals !== null ? (
            <Body testID="week-eval-meals">
              {t.weekEval.meals(food.meals.eaten, food.meals.planned)}
            </Body>
          ) : null}
          {food.todayOpen ? <Body muted>{t.weekEval.todayOpen}</Body> : null}
        </View>
      </Card>
      {/* Wächter A3 G2: Lag schon der Essensplan unter dem Mindestbedarf, sagt die Woche das – kein Vorwurf. */}
      {food.planBelowFloorDays > 0 ? (
        <Body testID="week-eval-plan-below-floor">
          {t.weekEval.planBelowFloor(food.planBelowFloorDays)}
        </Body>
      ) : null}
      {food.patternNotice ? (
        <View style={styles.lines} testID="week-eval-pattern">
          <Body>{t.weekEval.patternLead}</Body>
          <EatingHelpNotice />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  section: { gap: spacing.sm },
  days: { gap: spacing.xs },
  lines: { gap: spacing.xs },
});

/**
 * `weekEvaluation` mit Fehlerzustand statt Router-Fehlerseite (wie A2 H7). Ein Datenfehler wird NICHT geloggt – die
 * Eingaben enthalten Gesundheitsdaten.
 */
function safeWeekEvaluation(input: WeekEvaluationInput): WeekEvaluation | null {
  try {
    return weekEvaluation(input);
  } catch {
    return null;
  }
}
