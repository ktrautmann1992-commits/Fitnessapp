import {
  INGREDIENT_ROLE_LABELS_DE,
  isoDateSchema,
  type MealSlotId,
  weekHidesEnergyNumbers,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { ingredientSwapView } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { formatAmount, formatKcal } from '@/lib/nutrition-format';
import { weekdayShort } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useMealPlanActions, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Zutat austauschen (KONZEPT 6.9, docs/PLAN-PHASE-5.md 19.7 N9) – gratis, ohne KI. Zeigt nur sichere Alternativen aus
 * der Austausch-Tabelle (kompletter Filter der Person, R11, Planband, Haltbarkeit – alles in packages/core,
 * `ingredientSwapOptions`); nicht angebotene Alternativen erscheinen ohne Grund (kein Rückschluss auf
 * Unverträglichkeit oder Schwangerschaft). „Nehmen“ speichert Plan und Einkaufsliste im selben Schritt. Bei
 * „Kalorienzahlen aus“ (und Schwangerschaft/Stillzeit) keine kcal.
 */
export default function IngredientSwapScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{
    id?: string;
    tag?: string;
    platz?: string;
    zutat?: string;
  }>();
  const date = isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : null;
  const index = /^\d{1,3}$/.test(params.zutat ?? '') ? Number(params.zutat) : null;
  const slot = typeof params.platz === 'string' && params.platz.length > 0 ? params.platz : null;
  const view = useNutritionWeek(date ?? undefined);
  const actions = useMealPlanActions(view.week);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const options = useMemo(() => {
    if (view.week?.kind !== 'ready' || date === null || slot === null || index === null) {
      return null;
    }
    try {
      return ingredientSwapView(view.week, { date, slot, index });
    } catch {
      return { ok: false as const, reason: 'not_found' as const };
    }
  }, [view.week, date, slot, index]);

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
  const texts = t.nutrition.ingredientSwap;
  const recipeHref =
    `/rezept/${encodeURIComponent(params.id ?? '')}?tag=${date ?? ''}&platz=${encodeURIComponent(
      slot ?? '',
    )}` as Href;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(recipeHref));
  const footer = <Button label={t.nutrition.back} variant="secondary" onPress={goBack} />;
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="recipe"
      title={texts.title}
      testID="ingredient-swap"
      footer={footer}
    >
      {children}
    </Screen>
  );

  if (date === null || slot === null || index === null) {
    return shell(<Notice tone="info">{texts.failed.not_found}</Notice>);
  }
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
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind !== 'ready') {
    return shell(
      <Notice tone="info">
        {view.week.kind === 'incomplete' ? t.nutrition.incomplete : t.nutrition.computeFailed}
      </Notice>,
    );
  }
  if (options === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  const { library, demo } = view.library.result;
  if (!options.ok) {
    return shell(
      <Notice tone="info" testID="ingredient-swap-unavailable">
        {texts.failed[options.reason]}
      </Notice>,
    );
  }

  const foodName = (id: string) => library.foods.get(id)?.name_de ?? id;
  const day = view.week.plan?.days.find((d) => d.date === date);
  const meal = day?.meals.find((m) => m.slot === slot && !m.isFill);
  const current = meal?.ingredients.find((x) => x.index === index);
  const showNumbers =
    view.showNumbers && !weekHidesEnergyNumbers(view.week.targets) && day?.status !== 'no_targets';

  async function choose(substituteFoodId: string | null, key: string) {
    if (actions === null || date === null || slot === null || index === null) return;
    setBusy(key);
    setMessage(null);
    try {
      const outcome = await actions.swapIngredient(
        { date, slot: slot as MealSlotId, index },
        substituteFoodId,
      );
      if (outcome.kind === 'swapped') {
        goBack();
        return;
      }
      setMessage(outcome.kind === 'failed' ? texts.failed[outcome.reason] : texts.saveFailed);
    } catch {
      setMessage(texts.saveFailed);
    } finally {
      setBusy(null);
    }
  }

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Body muted>{texts.intro}</Body>
      {current ? (
        <Card>
          <Body testID="ingredient-swap-current">
            {texts.current(formatAmount(current.amount, current.unit), foodName(current.foodId))}
          </Body>
          <Body muted>{texts.role(INGREDIENT_ROLE_LABELS_DE[options.role])}</Body>
        </Card>
      ) : null}
      {message ? (
        <Notice tone="danger" testID="ingredient-swap-message">
          {message}
        </Notice>
      ) : null}
      {options.options.length === 0 ? (
        <Notice tone="info" testID="ingredient-swap-empty">
          {texts.empty}
        </Notice>
      ) : (
        <View style={{ gap: 12 }} testID="ingredient-swap-options">
          {options.options.map((option) => {
            const key = option.substituteFoodId ?? 'original';
            const name = foodName(option.foodId);
            return (
              <View key={key} testID={`ingredient-swap-option-${option.foodId}`}>
                <Card>
                  <Heading level={2}>{name}</Heading>
                  {option.substituteFoodId === null ? <Body muted>{texts.original}</Body> : null}
                  <Body>
                    {texts.amount(formatAmount(option.ingredient.amount, option.ingredient.unit))}
                  </Body>
                  {option.noteDe ? <Body muted>{texts.note(option.noteDe)}</Body> : null}
                  {showNumbers ? (
                    <Body muted testID={`ingredient-swap-kcal-${option.foodId}`}>
                      {texts.mealKcal(formatKcal(option.mealNutrients.kcal))}
                    </Body>
                  ) : null}
                  {option.affectedDates.length > 1 ? (
                    <Body muted>
                      {texts.batch(option.affectedDates.map(weekdayShort).join(', '))}
                    </Body>
                  ) : null}
                  {option.belowFloorDates.length > 0 ? (
                    <Notice tone="warning">
                      {texts.belowFloor(option.belowFloorDates.map(weekdayShort).join(', '))}
                    </Notice>
                  ) : null}
                  <Button
                    label={texts.choose}
                    accessibilityLabel={texts.chooseA11y(name)}
                    loading={busy === key}
                    disabled={busy !== null && busy !== key}
                    onPress={() => void choose(option.substituteFoodId, key)}
                    testID={`ingredient-swap-choose-${option.foodId}`}
                  />
                </Card>
              </View>
            );
          })}
        </View>
      )}
    </>,
  );
}
