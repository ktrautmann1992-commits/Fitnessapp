import {
  addDays,
  calorieRing,
  competitionGuideId,
  evaluationMealPlanUsable,
  isoDateSchema,
  isoWeekNumber,
  MEAL_CARD_GROUPS,
  macroProgress,
  mealCardEntrySlot,
  mealCardGroup,
  mealCardIntake,
  mealCardTargets,
  type MealSlotId,
  mealsInDayOrder,
  type NutritionNoticeCode,
  type PlannedMeal,
  type PlannedMealDay,
  thawHints,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  CapsExplanation,
  ConsentBlockedNotice,
  DemoBanner,
  EatingHelpNotice,
  EmptySlotRow,
  MealPlanStateNotices,
  UnavailableMealRows,
  MealRow,
  NutritionNotices,
} from '@/components/nutrition';
import { CompetitionNutritionCard } from '@/components/competition-nutrition';
import { CustomMealDaySection } from '@/components/custom-meals';
import { DayOverviewCard, MealCard } from '@/components/nutrition-day-overview';
import { FoodLogDaySection, PlanMealEaten } from '@/components/food-log';
import { useReadableGuides } from '@/components/guides';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { showEnergyNumbers } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { mealCardPreview, mealCardTitle } from '@/lib/nutrition-day-format';
import { useOnline } from '@/lib/use-online';
import { useToday } from '@/lib/use-today';
import {
  leftoverHintsBySlot,
  leftoverHintView,
  slotLabel,
  visibleNotices,
} from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { useMealPlanActions, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung – Tag (docs/PLAN-PHASE-5.md 8.2 Nr. 2, Etappe N4): Ziel + Makro-Balken (ausblendbar), Mahlzeiten mit
 * Portion, Nährwerten und Rolle, Ergänzungs-Snacks gekennzeichnet, Hinweise (Schutzgrenzen in einfachen Worten),
 * Blättern über die Woche, alle Zustände (8.3). Rechnet nichts selbst – Ziele und Plan kommen aus packages/core.
 * Etappe N5: gespeicherter Plan, „Rezept tauschen“ (ab heute, nur Hauptplätze), Hinweis bei automatischer
 * Neuplanung (6.6), „Plan aktualisieren“, Link zur Wochenansicht. Etappe N5b: Auftau-Hinweis für morgen, Links zur
 * Einkaufsliste und zu den Meal-Prep-Plänen, Hinweis „neu erstellt“ (K-b), „Erneut versuchen“ (K7). Etappe N5c:
 * Links „Rezepte suchen“ und „Ratgeber“. Etappe N14: Hinweis „Nutzt deinen Rest“ an der Mahlzeit (ohne Mengen und
 * Packungszahlen, G-N13-4/N11-G3 offen). Etappe E1: Ernährungstagebuch – „Gegessen“ je Mahlzeit (Portion ½ … 2) und
 * Abschnitt „Gegessen“ mit allen Einträgen des Tages (docs/PLAN-AUSWERTUNG.md Abschnitt 5). Etappe E2: Abschnitt
 * „Eigene Gerichte“ (Portion wählen, mit einem Tipp eintragen; Abschnitt 7).
 */
export default function NutritionDayScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ tag?: string }>();
  const today = useToday();
  // Ohne gewählten Tag folgt die Ansicht „heute“ – auch über Mitternacht (Wächter N5b K2).
  const [picked, setSelected] = useState<string | null>(() =>
    isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : null,
  );
  const selected = picked ?? today;
  const navigation = useNavigation();
  // Reiter bleibt geladen: Ein neuer Tag über die Adresse (`?tag=`, z. B. aus Kalender oder „Dein Tag“) gilt sofort.
  const tagParam = params.tag;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Adresse → angezeigter Tag (kein Folge-Render-Zyklus)
    setSelected(isoDateSchema.safeParse(tagParam).success ? (tagParam as string) : null);
  }, [tagParam]);
  // Reiter „Ernährung“ antippen springt auf heute (Wächter N7).
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        setSelected(null);
        router.setParams({ tag: undefined });
      }),
    [navigation, router],
  );
  const showToday = () => {
    setSelected(null);
    router.setParams({ tag: undefined });
  };
  const view = useNutritionWeek(selected);
  const actions = useMealPlanActions(view.week);
  // Knopf „Ratgeber“ nur, wenn es anzeigbare Ratgeber gibt (Wächter N5c K6).
  const readable = useReadableGuides(view);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<{
    text: string;
    tone: 'success' | 'warning' | 'danger';
  } | null>(null);
  // Ernährungstagebuch (Etappe E1): Einträge des angezeigten Tages, „Gegessen“, Löschen, Favoriten.
  // Derselbe Tag wie die Anzeige (dayTargets.date, Wächter E1 H5) – fällt die Woche auf ihren ersten Tag zurück,
  // zeigt auch das Tagebuch diesen Tag.
  const shownDate =
    view.week?.kind === 'ready'
      ? ((view.week.targets.days.find((d) => d.date === selected) ?? view.week.targets.days[0])
          ?.date ?? selected)
      : selected;
  const foodLog = useFoodLogDay(shownDate, view.showNumbers);
  const foodLogActions = useFoodLogActions();
  const online = useOnline();
  const [eatenMessage, setEatenMessage] = useState<{
    text: string;
    tone: 'success' | 'danger';
  } | null>(null);

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
  const consent = healthConsentStatus(rows, app.versions);
  // Reiter „Ernährung“ der Menüleiste (docs/PLAN-DASHBOARD.md 3) – kein „Zurück“, die Leiste führt weiter.
  // Anderer Tag gewählt (z. B. aus Kalender, Woche oder „Dein Tag“): „Zu heute“ und – falls möglich – „Zurück“.
  const footer =
    picked !== null && picked !== today ? (
      <View style={{ gap: 8 }}>
        <Button
          label={t.nutrition.toToday}
          variant="secondary"
          onPress={showToday}
          testID="nutrition-to-today"
        />
        {router.canGoBack() ? (
          <Button
            label={t.nutrition.back}
            variant="secondary"
            onPress={() => router.back()}
            testID="nutrition-back"
          />
        ) : null}
      </View>
    ) : undefined;
  const shell = (children: ReactNode) => (
    <Screen title={t.nutrition.title} testID="nutrition-day" footer={footer}>
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

  const { targets, plan, planState, leftoverHints } = view.week;
  const leftoverBySlot = leftoverHintsBySlot(leftoverHints);
  const { demo, demoAvailable } = view.library.result;
  const dayTargets = targets.days.find((d) => d.date === selected) ?? targets.days[0];
  if (!dayTargets) return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  const day: PlannedMealDay | null = plan?.days.find((d) => d.date === dayTargets.date) ?? null;
  const first = targets.weekStart;
  const last = addDays(first, 6);
  const foods = view.library.result.library.foods;
  const foodName = (id: string) => foods.get(id)?.name_de ?? id;
  const notices = visibleNotices(dayTargets.notices, view.showNumbers);
  const competitionGuide = competitionGuideId(readable ?? []);
  const numbers = view.showNumbers && dayTargets.targetKcal !== null;
  const status = day?.status ?? (dayTargets.mode === 'no_targets' ? 'no_targets' : null);
  const dayDate = dayTargets.date;
  // „Gegessen“ nur an einem gespeicherten Plan (bzw. laufende Woche ab heute) – nie an einem erst jetzt erzeugten Plan
  // für einen vergangenen Tag (Wächter A2 S1, Regel in core).
  const eatenAllowed = evaluationMealPlanUsable({
    planStored: planState?.action === 'stored',
    weekEditable: planState?.editable === true,
    date: dayDate,
    today,
  });
  const isToday = dayDate === today;
  // Tagesübersicht (Ring, Makros, Mahlzeiten-Karten): alle Werte aus packages/core (nutrition/day-ring.ts).
  const future = foodLog.dateStatus === 'future';
  const logEntries = foodLog.supported && foodLog.consentValid ? foodLog.entries : [];
  const intake =
    foodLog.supported && foodLog.consentValid && foodLog.intake.kind === 'numbers'
      ? foodLog.intake
      : null;
  const ring = numbers
    ? calorieRing({
        targetKcal: dayTargets.targetKcal,
        eatenKcal: future ? 0 : (intake?.kcal ?? 0),
      })
    : ({ kind: 'no_target' } as const);
  const cardTargets = mealCardTargets(numbers ? dayTargets.targetKcal : null, dayTargets.slots);
  const cardIntake = mealCardIntake(logEntries);
  const slotIds = dayTargets.slots.map((s) => s.slot);
  const mainOnly = slotIds.includes('main') && !slotIds.includes('lunch');
  const canAdd = foodLog.supported && foodLog.consentValid && foodLog.dateStatus === 'ok';
  const orderedMeals = day ? mealsInDayOrder(day) : [];
  const hasPlanMeals = day !== null && (day.meals.length > 0 || day.emptySlots.length > 0);
  const canSwap = (meal: PlannedMeal) =>
    actions !== null && !meal.isFill && dayDate >= today && !meal.slot.startsWith('extra');

  async function swap(meal: PlannedMeal) {
    if (!actions) return;
    setSwapping(meal.slot);
    setSwapMessage(null);
    try {
      const result = await actions.swap(dayDate, meal.slot as MealSlotId);
      setSwapMessage(
        result.kind === 'swapped'
          ? { text: t.nutrition.plan.swapped(result.title), tone: 'success' }
          : { text: t.nutrition.plan.swapFailed[result.reason], tone: 'warning' },
      );
    } catch {
      setSwapMessage({ text: t.nutrition.plan.actionFailed, tone: 'danger' });
    } finally {
      setSwapping(null);
    }
  }

  return shell(
    <>
      {demo ? <DemoBanner onDisable={() => void app.setNutritionDemo(false)} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t.nutrition.previousDay}
            variant="secondary"
            disabled={dayTargets.date <= first}
            onPress={() => setSelected(addDays(dayTargets.date, -1))}
            testID="nutrition-prev"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t.nutrition.nextDay}
            variant="secondary"
            disabled={dayTargets.date >= last}
            onPress={() => setSelected(addDays(dayTargets.date, 1))}
            testID="nutrition-next"
          />
        </View>
      </View>
      <View style={{ gap: 4 }} testID="nutrition-day-header">
        <Heading level={2}>{isToday ? t.nutritionDay.today : dayLabel(dayDate)}</Heading>
        <Body muted testID="nutrition-day-date">
          {isToday
            ? t.nutritionDay.dateLine(dayLabel(dayDate), isoWeekNumber(dayDate))
            : t.nutritionDay.weekLine(isoWeekNumber(dayDate))}
        </Body>
        {status ? <Body muted>{t.nutrition.dayStatus[status]}</Body> : null}
      </View>
      {!online ? (
        <Notice tone="info" testID="nutrition-offline">
          {t.nutritionDay.offline}
        </Notice>
      ) : null}
      {/* Etappe W1: Wettkampf-Ernährung (Carb-Loading, Vorabend, Renntag mit Zeitleiste, Nach dem Rennen). */}
      <CompetitionNutritionCard
        day={dayTargets}
        showNumbers={view.showNumbers}
        onOpenGuide={
          competitionGuide === null
            ? null
            : () => router.push(`/ratgeber/${encodeURIComponent(competitionGuide)}` as Href)
        }
      />
      <MealPlanStateNotices
        state={planState}
        actions={actions}
        saveFailed={view.saveFailed}
        saveConsentMissing={view.saveConsentMissing}
        onRetry={view.retrySave}
      />

      {ring.kind === 'ring' ? (
        <DayOverviewCard
          ring={ring}
          future={future}
          trainingKcal={dayTargets.trainingKcal}
          macros={{
            carbs: macroProgress(intake?.carbs_g ?? 0, dayTargets.carbsG),
            protein: macroProgress(intake?.protein_g ?? 0, dayTargets.proteinG),
            fat: macroProgress(intake?.fat_g ?? 0, dayTargets.fatG),
          }}
          plannedKcal={day && day.status === 'complete' ? day.totals.kcal : null}
          macrosIncomplete={intake !== null && intake.count > 0 && !intake.macrosComplete}
          hint={
            !future && (intake === null || intake.count === 0) ? t.nutritionDay.nothingYet : null
          }
        />
      ) : !showEnergyNumbers(rows) ? (
        <Body muted testID="nutrition-numbers-hidden">
          {t.nutrition.numbersHidden}
        </Body>
      ) : null}

      <NutritionNotices
        notices={notices}
        planNotices={[...(day?.notices ?? []), ...(plan?.notices ?? [])]}
        showNumbers={view.showNumbers}
      />
      <NoticeActions notices={notices} consentValid={consent === 'valid'} />
      {view.showNumbers ? <CapsExplanation caps={dayTargets.appliedCaps} /> : null}

      <Heading level={2}>{t.nutritionDay.mealsTitle}</Heading>
      {plan === null ? (
        <Card>
          <Body testID="nutrition-no-recipes">
            {demoAvailable
              ? t.nutrition.noRecipesTestMode
              : view.library.result.awaitingReview === true
                ? t.nutrition.noRecipesReview
                : t.nutrition.noRecipes}
          </Body>
          {demoAvailable && app.backend.mode === 'local' ? (
            <Button
              label={t.nutrition.demoUse}
              variant="secondary"
              onPress={() => void app.setNutritionDemo(true)}
              testID="nutrition-demo-use"
            />
          ) : null}
        </Card>
      ) : !hasPlanMeals ? (
        <Body muted>{t.nutrition.noMeals}</Body>
      ) : null}
      {/* Je Mahlzeit eine Karte (Frühstück, Mittagessen, Abendessen, Snacks) mit Ring, Ziel, Vorschau und „+“. */}
      <View style={{ gap: 8 }} testID={hasPlanMeals ? 'nutrition-meals' : 'nutrition-meal-cards'}>
        {MEAL_CARD_GROUPS.map((group) => {
          const meals = orderedMeals.filter((meal) => mealCardGroup(meal.slot) === group);
          const empties = (day?.emptySlots ?? []).filter(
            (empty) => mealCardGroup(empty.slot) === group,
          );
          const entries = logEntries.filter((entry) => mealCardGroup(entry.slot) === group);
          const title = mealCardTitle(group, mainOnly);
          return (
            <MealCard
              key={group}
              group={group}
              title={title}
              eatenKcal={cardIntake[group].kcal}
              targetKcal={cardTargets[group]}
              showNumbers={view.showNumbers}
              preview={mealCardPreview(entries.map((entry) => foodLog.displayTitle(entry)))}
              onAdd={
                canAdd
                  ? () =>
                      router.push(
                        `/ernaehrung/eintragen?tag=${dayDate}&platz=${mealCardEntrySlot(group)}` as Href,
                      )
                  : null
              }
              addA11y={t.nutritionDay.addA11y(
                title,
                isToday ? t.nutritionDay.addA11yToday : dayLabel(dayDate),
              )}
            >
              {day !== null
                ? meals.map((meal) => (
                    <View key={meal.slot} style={{ gap: 4 }}>
                      <MealRow
                        meal={meal}
                        showNumbers={view.showNumbers && day.status !== 'no_targets'}
                        foodName={foodName}
                        leftover={(() => {
                          const hint = leftoverBySlot.get(`${day.date}|${meal.slot}`);
                          return hint ? leftoverHintView(hint, foodName) : undefined;
                        })()}
                        onOpen={() =>
                          router.push(
                            `/rezept/${encodeURIComponent(meal.recipeId)}?tag=${day.date}&platz=${meal.slot}` as Href,
                          )
                        }
                      />
                      {eatenAllowed ? (
                        <PlanMealEaten
                          meal={meal}
                          date={day.date}
                          view={foodLog}
                          actions={foodLogActions}
                          onMessage={setEatenMessage}
                        />
                      ) : null}
                      {canSwap(meal) ? (
                        <Button
                          label={t.nutrition.plan.swap}
                          accessibilityLabel={t.nutrition.plan.swapA11y(
                            slotLabel(meal.slot),
                            meal.titleDe,
                          )}
                          variant="secondary"
                          loading={swapping === meal.slot}
                          disabled={swapping !== null && swapping !== meal.slot}
                          onPress={() => void swap(meal)}
                          testID={`swap-${meal.slot}`}
                        />
                      ) : null}
                    </View>
                  ))
                : null}
              {empties.map((empty) => (
                <EmptySlotRow key={empty.slot} empty={empty} />
              ))}
            </MealCard>
          );
        })}
        {day !== null ? (
          <UnavailableMealRows meals={view.week.unavailableMeals} date={day.date} />
        ) : null}
      </View>
      {plan !== null && day !== null && !eatenAllowed && foodLog.supported ? (
        <Body muted testID="nutrition-plan-not-stored">
          {t.foodLog.planNotStored}
        </Body>
      ) : null}
      {eatenMessage ? (
        <Notice tone={eatenMessage.tone} testID="nutrition-eaten-message">
          {eatenMessage.text}
        </Notice>
      ) : null}
      <FoodLogDaySection
        date={dayDate}
        dayText={dayTargets.date === today ? t.nutrition.today : dayLabel(dayDate)}
        view={foodLog}
        actions={foodLogActions}
        showNumbers={view.showNumbers}
      />
      {/* Etappe E2: eigene Gerichte mit einem Tipp eintragen. */}
      <CustomMealDaySection
        date={dayDate}
        view={foodLog}
        actions={foodLogActions}
        showNumbers={view.showNumbers}
      />
      {day !== null && leftoverHints.some((h) => h.date === day.date) ? (
        <Body muted testID="nutrition-leftover-explain">
          {t.nutrition.leftovers.explain}
        </Body>
      ) : null}
      {swapMessage ? (
        <Notice tone={swapMessage.tone} testID="nutrition-swap-message">
          {swapMessage.text}
        </Notice>
      ) : null}
      {plan !== null && dayDate >= today && thawHints(plan, dayDate).length > 0 ? (
        <Notice tone="info" testID="nutrition-thaw">
          <Body>{t.nutrition.thaw.title}</Body>
          {thawHints(plan, dayDate).map((hint) => (
            <Body key={`${hint.forDate}-${hint.slot}`}>
              {t.nutrition.thaw.line(hint.titleDe, dayLabel(hint.forDate))}
            </Body>
          ))}
        </Notice>
      ) : null}
      {plan !== null ? (
        <Button
          label={t.nutrition.plan.weekView}
          variant="secondary"
          onPress={() => router.push(`/ernaehrung/woche?woche=${targets.weekStart}` as Href)}
          testID="nutrition-week-view"
        />
      ) : null}
      {plan !== null && planState?.editable === true ? (
        <Button
          label={t.nutrition.shopping.open}
          variant="secondary"
          onPress={() => router.push(`/einkaufsliste?woche=${targets.weekStart}` as Href)}
          testID="nutrition-shopping"
        />
      ) : null}
      {plan !== null && view.library.result.library.mealPrepPlans.length > 0 ? (
        <Button
          label={t.nutrition.mealPrep.open}
          variant="secondary"
          onPress={() => router.push('/meal-prep' as Href)}
          testID="nutrition-meal-prep"
        />
      ) : null}
      {view.library.result.library.recipes.length > 0 ? (
        <Button
          label={t.nutrition.search.open}
          variant="secondary"
          onPress={() => router.push('/rezepte' as Href)}
          testID="nutrition-recipe-search"
        />
      ) : null}
      {view.library.result.library.recipes.length > 0 ? (
        <Button
          label={t.nutrition.fridge.open}
          variant="secondary"
          onPress={() => router.push('/rezepte/kuehlschrank' as Href)}
          testID="nutrition-fridge-search"
        />
      ) : null}
      {(readable?.length ?? 0) > 0 ? (
        <Button
          label={t.nutrition.guides.open}
          variant="secondary"
          onPress={() => router.push('/ratgeber' as Href)}
          testID="nutrition-guides"
        />
      ) : null}

      <EatingHelpNotice />
      <Body muted>{t.nutrition.hfiCoeliac}</Body>
      <Body muted>{t.nutrition.disclaimer}</Body>
      <Button
        label={t.nutrition.changeSettings}
        variant="secondary"
        onPress={() => router.push('/settings')}
        testID="nutrition-settings"
      />
    </>,
  );
}

/** Knöpfe zu den Hinweisen (Einwilligung, Gesundheits-Check, Gewicht) – 4.9, 8.3. */
function NoticeActions({
  notices,
  consentValid,
}: {
  notices: readonly NutritionNoticeCode[];
  consentValid: boolean;
}) {
  const router = useRouter();
  const has = (code: NutritionNoticeCode) => notices.includes(code);
  const actions = t.nutrition.actions;
  return (
    <View style={{ gap: 8 }}>
      {has('no_health_data_consent') || (!consentValid && has('body_data_missing')) ? (
        <Button
          label={actions.grantConsent}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
          testID="nutrition-action-consent"
        />
      ) : null}
      {consentValid && has('health_check_missing') ? (
        <Button
          label={actions.healthCheck}
          variant="secondary"
          onPress={() => router.push('/onboarding/health_screening?edit=1' as Href)}
          testID="nutrition-action-check"
        />
      ) : null}
      {consentValid && has('pregnancy_check_update') ? (
        <Button
          label={actions.healthCheckUpdate}
          variant="secondary"
          onPress={() => router.push('/onboarding/health_screening?edit=1' as Href)}
          testID="nutrition-action-check-update"
        />
      ) : null}
      {consentValid && (has('weight_outdated') || has('body_data_missing')) ? (
        <Button
          label={actions.updateWeight}
          variant="secondary"
          onPress={() => router.push('/onboarding/body_metrics?edit=1' as Href)}
          testID="nutrition-action-weight"
        />
      ) : null}
    </View>
  );
}
