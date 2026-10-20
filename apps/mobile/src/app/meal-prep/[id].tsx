import {
  addDays,
  cookDayOverview,
  defaultMealPrepWeekStart,
  isoDateSchema,
  mealPlanWeekEditable,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { DemoBanner, NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { mealPrepOffers } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { dayLabel, weekdayName } from '@/lib/plan-format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import {
  useMealPlanActions,
  useNutritionWeek,
  useShoppingListActions,
} from '@/state/use-nutrition';

/**
 * Meal-Prep-Plan ansehen und wählen (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.7 „Plan wählen → Einkaufsliste → Kochtag“,
 * Etappe N5b): Rezepte, Aufbewahrung je Tag (Kühlschrank / einfrieren und am Vorabend auftauen / frisch – aus
 * `storage_plan` und R9, die sicherere Angabe gilt), Hinweis fürs Abendessen. „Plan für diese Woche wählen“ belegt die
 * Woche ab dem Kochtag (`applyMealPrepPlan`), danach „Zur Einkaufsliste“ und „Zum Kochtag“. Keine kcal.
 */
export default function MealPrepPlanScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ id: string; woche?: string }>();
  const today = useToday();
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : null;
  const weekStart =
    requested !== null && mealPlanWeekEditable(requested, today)
      ? requested
      : defaultMealPrepWeekStart(today);
  const view = useNutritionWeek(weekStart);
  const actions = useMealPlanActions(view.week);
  const shoppingActions = useShoppingListActions(view.week);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<'choose' | 'shopping' | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

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
  const texts = t.nutrition.mealPrep;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/meal-prep' as Href))}
    />
  );
  const shell = (title: string, children: ReactNode) => (
    <Screen title={title} testID="meal-prep-plan" footer={footer}>
      {children}
    </Screen>
  );
  if (!nutritionReady(view) || view.week?.kind !== 'ready' || view.library.kind !== 'ready') {
    return shell(texts.title, <NutritionGate view={view} />);
  }
  const { library, demo } = view.library.result;
  const offer = mealPrepOffers(view.week, library.mealPrepPlans).find(
    (o) => o.plan.id === String(params.id ?? ''),
  );
  if (offer === undefined) {
    return shell(texts.title, <Notice tone="info">{texts.notFound}</Notice>);
  }
  const plan = offer.plan;
  if (!offer.offered || offer.preview === null) {
    // Ohne Grund und ohne Rezepte (19.6 Nr. 2).
    return shell(
      plan.title_de,
      <Notice tone="info" testID="meal-prep-plan-not-offered">
        {texts.notOffered}
      </Notice>,
    );
  }
  const overview = cookDayOverview(offer.preview, plan);
  const recipeTitle = (id: string) => library.recipes.find((r) => r.id === id)?.title_de ?? id;
  const days = (dates: readonly string[]) => dates.map(weekdayName).join(', ');

  async function choose() {
    if (!actions) return;
    setBusy('choose');
    setError(undefined);
    try {
      const result = await actions.chooseMealPrepPlan(plan);
      if (result === 'chosen') {
        setConfirm(false);
        setMessage({ text: texts.chooseDone, tone: 'success' });
      } else {
        setError(texts.chooseFailed);
      }
    } catch {
      setError(t.nutrition.plan.actionFailed);
    } finally {
      setBusy(null);
    }
  }

  async function toShopping() {
    setBusy('shopping');
    setMessage(null);
    try {
      // Die Liste der Woche anlegen, falls es noch keine gibt (sie enthält den Kochtag-Einkauf).
      if (shoppingActions && view.week?.kind === 'ready' && view.week.shopping?.action === 'new') {
        const outcome = await shoppingActions.ensureSaved();
        if (outcome.kind !== 'ok') {
          setMessage({ text: t.nutrition.shopping.saveFailed, tone: 'danger' });
          return;
        }
      }
      router.dismissTo(`/einkaufsliste?woche=${weekStart}` as Href);
    } finally {
      setBusy(null);
    }
  }

  return shell(
    plan.title_de,
    <>
      {demo ? <DemoBanner /> : null}
      <Body muted>
        {texts.weekFor(formatDateDe(weekStart), formatDateDe(addDays(weekStart, 6)))}
      </Body>
      <Body>{plan.description_de}</Body>
      {offer.chosen ? (
        <Notice tone="success" testID="meal-prep-plan-chosen">
          {texts.chosen}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="meal-prep-plan-message">
          {message.text}
        </Notice>
      ) : null}

      <Heading level={2}>{texts.recipes}</Heading>
      <View style={{ gap: 8 }} testID="meal-prep-plan-recipes">
        {plan.recipe_ids.map((id) => (
          <Button
            key={id}
            label={recipeTitle(id)}
            accessibilityLabel={t.nutrition.openRecipe(recipeTitle(id))}
            variant="secondary"
            onPress={() => router.push(`/rezept/${encodeURIComponent(id)}` as Href)}
          />
        ))}
      </View>

      {overview !== null ? (
        <Card>
          <Heading level={2}>{texts.storageTitle}</Heading>
          <Body testID="meal-prep-cook-date">{texts.cookDay(dayLabel(overview.cookDate))}</Body>
          {overview.recipes.map((recipe) => (
            <View
              key={recipe.recipeId}
              style={{ gap: 2 }}
              testID={`meal-prep-storage-${recipe.recipeId}`}
            >
              <Body>{recipe.titleDe}</Body>
              {recipe.fridgeDates.length > 0 ? (
                <Body muted>{texts.fridgeDays(days(recipe.fridgeDates))}</Body>
              ) : null}
              {recipe.freezeDates.length > 0 ? (
                <Body muted>{texts.freezeDays(days(recipe.freezeDates))}</Body>
              ) : null}
              {recipe.freshDates.length > 0 ? (
                <Body muted>{texts.freshDays(days(recipe.freshDates))}</Body>
              ) : null}
            </View>
          ))}
          {plan.storage_de.map((line) => (
            <Body key={line} muted>
              {line}
            </Body>
          ))}
          <Body muted>{texts.safetyNote}</Body>
        </Card>
      ) : null}
      {plan.dinner_hint_de ? <Body muted>{plan.dinner_hint_de}</Body> : null}

      {actions === null ? (
        <Body muted>{texts.notEditable}</Body>
      ) : offer.chosen ? (
        <>
          <Button
            label={texts.toShopping}
            loading={busy === 'shopping'}
            onPress={() => void toShopping()}
            testID="meal-prep-to-shopping"
          />
          <Button
            label={texts.startCookDay}
            variant="secondary"
            onPress={() => router.push(`/meal-prep/kochtag?woche=${weekStart}` as Href)}
            testID="meal-prep-to-cook-day"
          />
        </>
      ) : (
        <Button
          label={texts.choose}
          onPress={() => {
            setError(undefined);
            setConfirm(true);
          }}
          testID="meal-prep-choose"
        />
      )}
      <ConfirmDialog
        visible={confirm}
        title={texts.chooseTitle}
        message={texts.chooseText}
        confirmLabel={texts.chooseConfirm}
        confirmVariant="primary"
        onConfirm={() => void choose()}
        onCancel={() => setConfirm(false)}
        loading={busy === 'choose'}
        error={error}
        testID="dialog-meal-prep-choose"
      />
    </>,
  );
}
