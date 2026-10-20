import {
  addDays,
  dateParamSchema,
  dayEvaluation,
  type DayEvaluation,
  type DayEvaluationInput,
  evaluationMealPlanUsable,
  mealsInDayOrder,
  type PlannedMealDay,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayTrainingRow, IntakeBarCard } from '@/components/day-evaluation';
import { PlanMealEaten } from '@/components/food-log';
import { ConsentBlockedNotice } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import {
  dayAchievementInputsAround,
  dayExerciseNames,
  dayTrainingItems,
} from '@/data/day-evaluation';
import { t } from '@/i18n';
import { intakeBarView, intakeTextLine } from '@/lib/day-evaluation-format';
import { dayLabel } from '@/lib/plan-format';
import { decodeRouteParam } from '@/lib/route-param';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * „Dein Tag“ (docs/PLAN-AUSWERTUNG.md Abschnitt 6, Etappe A2): Essen (Kalorienbalken nach 2.1/2.2 mit Ist und
 * Tagesziel, Text und Zeichen zur Farbe; „Zahlen aus“/Schwangerschaft ohne Balken, nur „3 von 4 Mahlzeiten“) und
 * Training (Status und Erfüllungsgrad nach 2.5). Blättern mit ← / →, erreichbar aus Kalender, Woche und „Heute“.
 * Rechnet nichts selbst: `dayEvaluation()` aus packages/core, Ziele aus `nutritionTargetsForWeek`. Alles aus dem
 * Gerätespeicher (offline). Keine Gesundheitsdaten in Logs oder testIDs.
 */
export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const parsed = dateParamSchema.safeParse(decodeRouteParam(params.date));
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  // Hooks brauchen immer einen gültigen Tag – bei ungültigem Parameter zeigt die Seite den Fehlerzustand.
  const date = parsed.success ? parsed.data : today;
  const view = useNutritionWeek(date);
  const foodLog = useFoodLogDay(date, view.showNumbers);
  const foodLogActions = useFoodLogActions();
  const [eatenMessage, setEatenMessage] = useState<{
    text: string;
    tone: 'success' | 'danger';
  } | null>(null);
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
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  const footer = <Button label={t.day.back} variant="secondary" onPress={goBack} />;
  const shell = (children: ReactNode) => (
    <Screen area="training" icon="calendar" title={t.day.title} testID="day" footer={footer}>
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {children}
    </Screen>
  );

  if (!parsed.success) {
    return shell(
      <Notice tone="danger" testID="day-invalid">
        <Body>{t.day.invalidDate}</Body>
        <Button
          label={t.day.toCalendar}
          variant="secondary"
          onPress={() => router.replace('/kalender' as Href)}
        />
      </Notice>,
    );
  }

  const go = (target: string) => {
    setEatenMessage(null);
    router.replace(`/tag/${target}` as Href);
  };
  const isToday = date === today;
  const pager = (
    <View style={styles.pager}>
      <View style={styles.pagerButton}>
        <Button
          label={t.day.previous}
          accessibilityLabel={t.day.previousA11y}
          variant="secondary"
          onPress={() => go(addDays(date, -1))}
          testID="day-prev"
        />
      </View>
      <View style={styles.pagerButton}>
        <Button
          label={t.day.next}
          accessibilityLabel={t.day.nextA11y}
          variant="secondary"
          onPress={() => go(addDays(date, 1))}
          testID="day-next"
        />
      </View>
    </View>
  );
  const header = (
    <View style={styles.header}>
      <Heading level={2}>{isToday ? `${t.day.today}, ${dayLabel(date)}` : dayLabel(date)}</Heading>
    </View>
  );

  // Älter als der Gerätespeicher (Supabase: 12 Wochen) – keine vollständigen Daten für diesen Tag.
  const since = app.backend.logHistoryStart();
  if (since !== null && date < since) {
    return shell(
      <>
        {header}
        {pager}
        <Notice tone="info" testID="day-too-old">
          <Body>{t.day.tooOld}</Body>
          <Button
            label={t.day.openHistory}
            variant="secondary"
            onPress={() => router.push('/history' as Href)}
          />
        </Notice>
      </>,
    );
  }

  const week = view.week;
  const ready = week?.kind === 'ready' ? week : null;
  const targets = ready?.targets.days.find((d) => d.date === date) ?? null;
  const anyPlanDay = ready?.plan?.days.find((d) => d.date === date) ?? null;
  // Nur ein gespeicherter Essensplan (bzw. laufende Woche ab heute) – nie ein erst jetzt erzeugter Plan für einen
  // vergangenen Tag (Wächter A2 S1, Regel in core).
  const planUsable =
    anyPlanDay !== null &&
    evaluationMealPlanUsable({
      planStored: ready?.planState?.action === 'stored',
      weekEditable: ready?.planState?.editable === true,
      date,
      today,
    });
  const planDay: PlannedMealDay | null = planUsable ? anyPlanDay : null;
  const consent = healthConsentStatus(rows, app.versions);
  const foodAvailable = foodLog.supported && foodLog.consentValid;
  const libraryReady = library.kind === 'ready' || library.kind === 'missing';
  const evaluation = safeDayEvaluation({
    date,
    today,
    showNumbers: view.showNumbers,
    targets,
    foodLog: { available: foodAvailable, entries: foodLog.entries },
    mealPlan:
      planDay === null
        ? null
        : {
            slots: planDay.meals.map((m) => m.slot),
            belowFloor: planDay.status === 'below_floor',
          },
    trainingItems: dayTrainingItems(rows, date, today),
    achievements: dayAchievementInputsAround(
      rows,
      date,
      library.kind === 'ready' ? library.library : null,
    ),
  });
  if (evaluation === null) {
    return shell(
      <>
        {header}
        {pager}
        <Notice tone="danger" testID="day-error">
          {t.day.computeFailed}
        </Notice>
      </>,
    );
  }
  const hasActivePlan = rows.plans.some((p) => p.status === 'active');
  const nutritionLoading =
    foodLog.supported && (view.library.kind === 'idle' || view.library.kind === 'loading');

  return shell(
    <>
      {header}
      {pager}
      {evaluation.timing === 'future' ? (
        <Body muted testID="day-future">
          {t.day.future}
        </Body>
      ) : null}

      <Heading level={2}>{t.day.foodTitle}</Heading>
      <View style={styles.section} testID="day-food">
        {!foodLog.supported ? (
          <Notice tone="info">{t.foodLog.unsupported}</Notice>
        ) : nutritionLoading ? (
          <LoadingState label={t.nutrition.loading} />
        ) : (
          <FoodSection
            evaluation={evaluation}
            week={week}
            planDay={planDay}
            planNotStored={anyPlanDay !== null && planDay === null}
            consentValid={consent === 'valid'}
            foodLogView={foodLog}
            foodLogActions={foodLogActions}
            onMessage={setEatenMessage}
          />
        )}
        {eatenMessage ? (
          <Notice tone={eatenMessage.tone} testID="day-eaten-message">
            {eatenMessage.text}
          </Notice>
        ) : null}
        {foodLog.supported ? (
          <Button
            label={t.day.openNutrition}
            accessibilityLabel={t.day.openNutritionA11y(dayLabel(date))}
            variant="secondary"
            onPress={() => router.dismissTo(`/ernaehrung?tag=${date}` as Href)}
            testID="day-open-nutrition"
          />
        ) : null}
      </View>

      <Heading level={2}>{t.day.trainingTitle}</Heading>
      <View style={styles.section} testID="day-training">
        {!libraryReady && evaluation.training.items.some((i) => i.item.logId !== null) ? (
          <LoadingState label={t.day.loadingTraining} />
        ) : evaluation.training.items.length === 0 ? (
          <Body muted testID="day-training-empty">
            {hasActivePlan ? t.day.rest : t.day.noPlan}
          </Body>
        ) : (
          evaluation.training.items.map((entry, index) => (
            <DayTrainingRow
              key={entry.item.logId ?? entry.item.sessionId ?? index}
              entry={entry}
              exerciseNames={entry.item.logId ? dayExerciseNames(rows, entry.item.logId) : []}
              onOpenLog={(logId) => router.push(`/log/${logId}` as Href)}
            />
          ))
        )}
        <Button
          label={t.calendar.open}
          accessibilityLabel={t.calendar.openA11y}
          variant="secondary"
          onPress={() => router.push('/kalender' as Href)}
          testID="day-calendar"
        />
      </View>
    </>,
  );
}

function FoodSection({
  evaluation,
  week,
  planDay,
  planNotStored,
  consentValid,
  foodLogView,
  foodLogActions,
  onMessage,
}: {
  evaluation: DayEvaluation;
  week: ReturnType<typeof useNutritionWeek>['week'];
  planDay: PlannedMealDay | null;
  /** Für den Tag gibt es nur einen erst jetzt erzeugten, nie gespeicherten Plan (S1). */
  planNotStored: boolean;
  consentValid: boolean;
  foodLogView: ReturnType<typeof useFoodLogDay>;
  foodLogActions: ReturnType<typeof useFoodLogActions>;
  onMessage: (message: { text: string; tone: 'success' | 'danger' } | null) => void;
}) {
  const router = useRouter();
  const { food, notices } = evaluation;
  if (week?.kind === 'blocked') return <ConsentBlockedNotice reason={week.reason} />;
  if (week?.kind === 'incomplete') return <Notice tone="info">{t.nutrition.incomplete}</Notice>;
  if (week?.kind === 'error') return <Notice tone="danger">{t.nutrition.computeFailed}</Notice>;
  const intake = food.intake;
  const textLine = intakeTextLine(intake, food.entryCount);
  return (
    <>
      {!food.available ? (
        <Notice tone="info" testID="day-consent">
          <Body>{t.foodLog.consentNeeded}</Body>
          <Button
            label={t.foodLog.consentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
        </Notice>
      ) : null}
      {/* Gleiche Einladung für „keine Einwilligung“ und „keine Körperdaten“ nur einmal. */}
      {[
        ...new Map(food.targetNotices.map((code) => [t.nutrition.notices[code], code])).values(),
      ].map((code) => (
        <Notice key={code} tone="info" testID="day-target-notice">
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
      {intake.kind === 'bar' ? (
        <Card>
          <IntakeBarCard view={intakeBarView(intake)} />
          {notices.includes('check_entries') ? (
            <Body testID="day-check-entries">{t.day.checkEntries}</Body>
          ) : notices.includes('entries_basis') ? (
            <Body testID="day-entries-basis">{t.day.entriesBasis}</Body>
          ) : null}
          {food.entriesWithoutValue > 0 ? (
            <Body muted>{t.foodLog.withoutValue(food.entriesWithoutValue)}</Body>
          ) : null}
          <Body muted>{t.day.estimate}</Body>
        </Card>
      ) : textLine !== null && food.available ? (
        <Body muted testID="day-intake-text">
          {textLine}
        </Body>
      ) : null}
      {notices.includes('training_day') ? <Body muted>{t.day.trainingDay}</Body> : null}
      {notices.includes('carb_loading_day') ? (
        <Body muted testID="day-carb-loading">
          {t.day.carbLoadingDay}
        </Body>
      ) : null}
      {notices.includes('plan_below_floor') ? (
        <Body muted testID="day-plan-below-floor">
          {t.nutrition.planNotices.day_below_floor}
        </Body>
      ) : null}
      {food.available && evaluation.timing !== 'future' ? (
        <Body testID="day-entries">{t.day.entries(t.foodLog.count(food.entryCount))}</Body>
      ) : null}
      {food.meals !== null ? (
        <Body testID="day-meals">{t.day.meals(food.meals.eaten, food.meals.planned)}</Body>
      ) : planDay !== null ? (
        // Künftiger Tag: nur der Plan, keine Abhak-Zahl (2.2, H5).
        <Body muted testID="day-planned-meals">
          {t.day.plannedMeals}
        </Body>
      ) : (
        <Body muted testID="day-no-meal-plan">
          {planNotStored ? t.day.noStoredMealPlan : t.day.noMealPlan}
        </Body>
      )}
      {planDay !== null ? (
        <View style={styles.meals} testID="day-meal-list">
          {mealsInDayOrder(planDay).map((meal) => (
            <View key={meal.slot} style={styles.meal}>
              <Body>{meal.titleDe}</Body>
              <PlanMealEaten
                meal={meal}
                date={planDay.date}
                view={foodLogView}
                actions={foodLogActions}
                onMessage={onMessage}
              />
            </View>
          ))}
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
  meals: { gap: spacing.sm },
  meal: { gap: spacing.xs },
});

/**
 * `dayEvaluation` mit Fehlerzustand statt Router-Fehlerseite (Wächter A2 H7). Ein Datenfehler (Zod/RangeError) wird
 * NICHT geloggt – die Eingaben enthalten Gesundheitsdaten.
 */
function safeDayEvaluation(input: DayEvaluationInput): DayEvaluation | null {
  try {
    return dayEvaluation(input);
  } catch {
    return null;
  }
}
