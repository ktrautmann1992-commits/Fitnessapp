import {
  addDays,
  isoDateSchema,
  mealsInDayOrder,
  mealPlanWeekEditable,
  type PlannedMealDay,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner, MealPlanStateNotices } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ErrorState,
  Heading,
  LoadingState,
  MIN_TOUCH,
  Notice,
} from '@/components/ui';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { formatKcal, formatNumberDe, slotLabel } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useMealPlanActions, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung – Woche (docs/PLAN-PHASE-5.md 8.2 Nr. 3, Etappe N5): Mo–So × Mahlzeiten, Tagessummen (nur mit
 * „Kalorienzahlen anzeigen“ und nur bei vollständigen Tagen), „Andere Vorschläge“ (Variante + 1 ab heute, mit
 * Nachfrage), „Plan aktualisieren“ (≥ 5 %), Hinweis bei automatischer Neuplanung (6.6). Laufende und nächste Woche;
 * vergangene Tage bleiben unverändert. Rechnet nichts selbst – alles aus packages/core.
 * Etappe N6: „Als PDF speichern“ öffnet die Druckansicht `ernaehrung/drucken` (PDF P5).
 */
export default function NutritionWeekScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ woche?: string }>();
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : currentWeek;
  // Nur laufende und nächste Woche (gespeichert/änderbar wie save_meal_plan).
  const [weekStart, setWeekStart] = useState(() =>
    mealPlanWeekEditable(requested, today) ? requested : currentWeek,
  );
  const view = useNutritionWeek(weekStart);
  const actions = useMealPlanActions(view.week);
  const [confirmOther, setConfirmOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);

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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={t.nutrition.week.title} testID="nutrition-week" footer={footer}>
      {children}
    </Screen>
  );

  if (view.library.kind === 'unsupported') {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error') {
    return shell(
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />,
    );
  }
  if (view.setupMissing) {
    return shell(
      <Card>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
          testID="nutrition-setup"
        />
      </Card>,
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  if (view.week.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }

  const { plan, planState } = view.week;
  const { demo, demoAvailable } = view.library.result;
  const last = addDays(weekStart, 6);
  const texts = t.nutrition.week;

  async function other() {
    if (!actions) return;
    setBusy(true);
    setError(undefined);
    try {
      await actions.otherSuggestions();
      setConfirmOther(false);
      setMessage(t.nutrition.plan.otherDone);
    } catch {
      setError(t.nutrition.plan.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={texts.thisWeek}
            variant={weekStart === currentWeek ? 'primary' : 'secondary'}
            onPress={() => {
              setMessage(null);
              setWeekStart(currentWeek);
            }}
            testID="nutrition-week-current"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={texts.nextWeek}
            variant={weekStart !== currentWeek ? 'primary' : 'secondary'}
            onPress={() => {
              setMessage(null);
              setWeekStart(addDays(currentWeek, 7));
            }}
            testID="nutrition-week-next"
          />
        </View>
      </View>
      <Heading level={2}>{texts.range(formatDateDe(weekStart), formatDateDe(last))}</Heading>

      {plan === null ? (
        <Card>
          <Body>{demoAvailable ? t.nutrition.noRecipesTestMode : t.nutrition.noRecipes}</Body>
          {demoAvailable && app.backend.mode === 'local' ? (
            <Button
              label={t.nutrition.demoUse}
              variant="secondary"
              onPress={() => void app.setNutritionDemo(true)}
              testID="nutrition-demo-use"
            />
          ) : null}
        </Card>
      ) : (
        <>
          <MealPlanStateNotices
            state={planState}
            actions={actions}
            saveFailed={view.saveFailed}
            onRetry={view.retrySave}
          />
          {message ? (
            <Notice tone="success" testID="nutrition-week-message">
              {message}
            </Notice>
          ) : null}
          {actions ? (
            <Button
              label={t.nutrition.plan.other}
              variant="secondary"
              onPress={() => {
                setError(undefined);
                setConfirmOther(true);
              }}
              testID="nutrition-other"
            />
          ) : null}
          {/* PDF P5 (11, Etappe N6): Druckansicht mit Hinweis-Dialog bei Gesundheitsbezug. */}
          <Button
            label={t.nutrition.printView.button}
            variant="secondary"
            accessibilityHint={t.nutrition.printView.planHint}
            onPress={() => router.push(`/ernaehrung/drucken?woche=${weekStart}` as Href)}
            testID="nutrition-week-print"
          />
          <View style={styles.list} testID="nutrition-week-days">
            {plan.days.map((day) => (
              <WeekDayCard
                key={day.date}
                day={day}
                today={today}
                showNumbers={view.showNumbers}
                onOpenDay={() => router.push(`/ernaehrung?tag=${day.date}` as Href)}
                onOpenRecipe={(recipeId, slot) =>
                  router.push(
                    `/rezept/${encodeURIComponent(recipeId)}?tag=${day.date}&platz=${slot}` as Href,
                  )
                }
              />
            ))}
          </View>
        </>
      )}
      <Body muted>{t.nutrition.disclaimer}</Body>
      <ConfirmDialog
        visible={confirmOther}
        title={t.nutrition.plan.otherTitle}
        message={t.nutrition.plan.otherText}
        confirmLabel={t.nutrition.plan.otherConfirm}
        confirmVariant="primary"
        onConfirm={() => void other()}
        onCancel={() => setConfirmOther(false)}
        loading={busy}
        error={error}
        testID="dialog-other-suggestions"
      />
    </>,
  );
}

/** Ein Tag der Woche: Status, Tagessumme (nur mit Zahlen und bei vollständigem Tag), Mahlzeiten. */
function WeekDayCard({
  day,
  today,
  showNumbers,
  onOpenDay,
  onOpenRecipe,
}: {
  day: PlannedMealDay;
  today: string;
  showNumbers: boolean;
  onOpenDay: () => void;
  onOpenRecipe: (recipeId: string, slot: string) => void;
}) {
  const theme = useThemeColors();
  const texts = t.nutrition.week;
  const label =
    day.date === today ? `${t.nutrition.today}, ${dayLabel(day.date)}` : dayLabel(day.date);
  const meals = mealsInDayOrder(day);
  return (
    <Card>
      <View style={styles.list} testID={`week-day-${day.date}`}>
        <Heading level={2}>{label}</Heading>
        <Body muted>
          {day.date < today
            ? `${t.nutrition.dayStatus[day.status]} · ${texts.past}`
            : t.nutrition.dayStatus[day.status]}
        </Body>
        {showNumbers && day.status === 'complete' ? (
          <Body testID={`week-day-total-${day.date}`}>
            {texts.dayTotal(formatKcal(day.totals.kcal))}
          </Body>
        ) : null}
        {meals.length === 0 ? <Body muted>{texts.noMeals}</Body> : null}
        {meals.map((meal) => (
          <Pressable
            key={meal.slot}
            accessibilityRole="button"
            accessibilityLabel={t.nutrition.openRecipe(meal.titleDe)}
            onPress={() => onOpenRecipe(meal.recipeId, meal.slot)}
            testID={`week-meal-${day.date}-${meal.slot}`}
            style={({ pressed }) => [
              styles.meal,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.background : theme.surface,
              },
            ]}
          >
            <Text style={[styles.slot, { color: theme.textMuted }]}>{slotLabel(meal.slot)}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{meal.titleDe}</Text>
            <Text style={[styles.detail, { color: theme.textMuted }]}>
              {meal.isFill
                ? `${t.nutrition.portion(formatNumberDe(meal.factor))} · ${t.nutrition.fill}`
                : t.nutrition.portion(formatNumberDe(meal.factor))}
            </Text>
          </Pressable>
        ))}
        <Button
          label={texts.openDay(dayLabel(day.date))}
          variant="secondary"
          onPress={onOpenDay}
          testID={`week-open-${day.date}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  meal: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  slot: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
});
