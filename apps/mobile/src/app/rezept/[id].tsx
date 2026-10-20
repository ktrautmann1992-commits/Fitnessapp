import {
  type DietType,
  dietTypeSchema,
  isoDateSchema,
  contentReviewMark,
  mealPrepKeeping,
  RECIPE_SERVINGS_PICKER,
  recipeContains,
  type ScaledIngredient,
  scaleRecipeForServings,
  substitutionFor,
  weekHidesEnergyNumbers,
  withoutNutrientAmounts,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { RatingCard } from '@/components/rating';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { canSwapIngredient, recipeForPerson } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import {
  containsText,
  formatAmount,
  formatGrams,
  formatKcal,
  formatNumberDe,
  nutrientSourcesText,
} from '@/lib/nutrition-format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek, useShoppingListActions } from '@/state/use-nutrition';

/**
 * Rezeptansicht (docs/PLAN-PHASE-5.md 8.2 Nr. 4, 19.6, Etappe N4): Titel, Kennzeichnung „KI-Entwurf – fachlich prüfen“
 * (Testphase 19.10.2026: freigegeben ohne Fachprüfung → „Testphase – noch nicht fachlich geprüft“)
 * und bei Entwürfen deutlich „Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden“ (K6),
 * Zeiten, Portion (aus dem Essensplan bzw. Portionswähler 1–12), Zutaten mit Mengen, Ersatz- und Weglass-Hinweise,
 * Schritte, Nährwerte je Portion (ausblendbar), „Enthält: …“ inkl. Kokos, Spuren-Hinweis, HFI/Zöliakie, Meal-Prep-
 * Haltbarkeit, Nährwert-Quelle. Jedes Rezept läuft vorher durch den Filter der Person (recipeForPerson).
 * Etappe N5b: „Zur Einkaufsliste“ mit der gewählten Portionenzahl (19.6) – aus dem Essensplan geöffnet steht das
 * Rezept schon über den Plan auf der Liste.
 * Etappe N9: Aus dem Essensplan geöffnet hat jede Zutat mit Rolle den Knopf „Austauschen“ (KONZEPT 6.9) – nur ab heute,
 * nicht für vorgekochte Portionen; getauschte Zutaten stehen mit „(ausgetauscht)“ da, „Enthält: …“ und Haltbarkeit
 * gelten für das, was tatsächlich gekocht wird.
 * Etappe N10: Aus dem Essensplan geöffnet und der Tag ist da (heute oder vorbei) – „Wie war’s?“ mit Daumen hoch/runter
 * (KONZEPT 6.10, `RatingCard`).
 */
export default function RecipeScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{
    id: string;
    tag?: string;
    platz?: string;
    form?: string;
  }>();
  const date = isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : null;
  // Aus der Rezeptsuche mit erweiterter Ernährungsform (K3, Etappe N5c); ungültige Werte zählen nicht.
  const extraDiet = dietTypeSchema.safeParse(params.form).success
    ? (params.form as DietType)
    : null;
  // Ohne Tag: heute – wechselt um Mitternacht mit (Wächter N5a K5 / N5b K2).
  const today = useToday();
  const view = useNutritionWeek(date ?? today);
  const [servings, setServings] = useState<number | null>(null);
  const shoppingActions = useShoppingListActions(view.week);
  const [shoppingBusy, setShoppingBusy] = useState(false);
  const [shoppingMessage, setShoppingMessage] = useState<{
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
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
    />
  );
  const shell = (title: string, children: ReactNode) => (
    <Screen title={title} testID="recipe" footer={footer}>
      {children}
    </Screen>
  );

  if (view.library.kind === 'unsupported') {
    return shell(t.nutrition.recipe.title, <Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error') {
    return shell(
      t.nutrition.recipe.title,
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />,
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(t.nutrition.recipe.title, <LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'blocked') {
    return shell(t.nutrition.recipe.title, <ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind !== 'ready') {
    return shell(
      t.nutrition.recipe.title,
      <Notice tone="info">
        {view.week.kind === 'incomplete' ? t.nutrition.incomplete : t.nutrition.computeFailed}
      </Notice>,
    );
  }
  const { library, demo } = view.library.result;
  const found = recipeForPerson({
    recipeId: String(params.id ?? ''),
    library,
    rows: app.rows,
    versions: app.versions,
    week: view.week,
    allowDrafts: app.backend.mode === 'local',
    from: date && params.platz ? { date, slot: params.platz } : null,
    extraDiet,
  });
  if (found.kind === 'blocked') {
    return shell(t.nutrition.recipe.title, <ConsentBlockedNotice reason={found.reason} />);
  }
  if (found.kind === 'not_found') {
    return shell(
      t.nutrition.recipe.title,
      <Notice tone="info">{t.nutrition.recipe.notFound}</Notice>,
    );
  }
  if (found.kind === 'not_for_you') {
    return shell(
      t.nutrition.recipe.title,
      <Notice tone="info" testID="recipe-not-for-you">
        {t.nutrition.recipe.notForYou}
      </Notice>,
    );
  }

  const { variant, plannedMeal, outsideProfileDiet } = found;
  const recipe = variant.recipe;
  const texts = t.nutrition.recipe;
  /** Kennzeichen (core): Testphase, KI-Entwurf, Entwurf oder keins – Allergen-Warnung unabhängig davon (nur Entwürfe). */
  const reviewMark = contentReviewMark(recipe);
  const foods = library.foods;
  const foodName = (id: string) => foods.get(id)?.name_de ?? id;
  // K1: In Schwangerschaft/Stillzeit (B5) auch per Deep-Link keine Energie-Zahlen.
  const showNumbers =
    view.showNumbers &&
    !weekHidesEnergyNumbers(view.week.targets) &&
    (plannedMeal === null ||
      view.week.plan?.days.find((d) => d.date === date)?.status !== 'no_targets');

  const description = showNumbers
    ? recipe.description_de
    : withoutNutrientAmounts(recipe.description_de);

  // Zutaten und Nährwerte je Portion: aus dem Essensplan (Portion der Person) oder Portionswähler (ohne Ziel-Bezug).
  const picked = servings ?? recipe.servings;
  const scaled = plannedMeal === null ? scaleRecipeForServings(variant, picked, foods) : null;
  const ingredients: readonly ScaledIngredient[] = plannedMeal
    ? plannedMeal.ingredients
    : (scaled?.ingredients ?? []);
  const perPortion = plannedMeal ? plannedMeal.nutrients : (scaled?.perServing ?? null);
  const usedFoods = ingredients.flatMap((i) => {
    const food = foods.get(i.foodId);
    return food ? [food] : [];
  });
  const contains = recipeContains(variant.facts, usedFoods);
  // Haltbarkeit: nach einem Zutaten-Austausch mit den tatsächlich verwendeten Zutaten (R9, B2), sonst wie im Rezept.
  const keeping =
    variant.swaps.length > 0
      ? mealPrepKeeping(variant, foods)
      : { fridgeDays: recipe.meal_prep.fridge_days, freezable: recipe.meal_prep.freezable };
  const sources = [
    ...new Map(
      usedFoods.map((f) => [`${f.source.db}|${f.source.version}|${f.source.license}`, f.source]),
    ).values(),
  ];

  const shoppingTexts = t.nutrition.shopping.fromRecipe;
  const onList = shoppingActions?.list.recipes.find((r) => r.recipeId === recipe.id) ?? null;
  const weekForList = view.week.targets.weekStart;
  async function addToShopping() {
    if (!shoppingActions) return;
    setShoppingBusy(true);
    setShoppingMessage(null);
    try {
      const outcome = await shoppingActions.addRecipe(recipe.id, picked, outsideProfileDiet);
      setShoppingMessage(
        outcome.kind === 'ok'
          ? { text: shoppingTexts.added(picked), tone: 'success' }
          : outcome.kind === 'failed'
            ? { text: t.nutrition.shopping.failed[outcome.reason], tone: 'danger' }
            : { text: outcome.message || t.nutrition.shopping.saveFailed, tone: 'danger' },
      );
    } catch {
      setShoppingMessage({ text: t.nutrition.shopping.saveFailed, tone: 'danger' });
    } finally {
      setShoppingBusy(false);
    }
  }
  const openList = (
    <Button
      label={shoppingTexts.open}
      variant="secondary"
      onPress={() => router.dismissTo(`/einkaufsliste?woche=${weekForList}` as Href)}
      testID="recipe-shopping-open"
    />
  );
  function shoppingCard(): ReactNode {
    if (plannedMeal) {
      return (
        <Card>
          <Body muted testID="recipe-shopping-in-plan">
            {shoppingTexts.inPlan}
          </Body>
          {shoppingActions ? openList : null}
        </Card>
      );
    }
    if (!shoppingActions) {
      return view.week?.kind === 'ready' && view.week.plan !== null ? (
        <Body muted>{shoppingTexts.notEditable}</Body>
      ) : null;
    }
    return (
      <Card>
        <Button
          label={shoppingTexts.add(picked)}
          loading={shoppingBusy}
          onPress={() => void addToShopping()}
          testID="recipe-shopping-add"
        />
        {onList !== null && shoppingMessage === null ? (
          <Body muted testID="recipe-shopping-on-list">
            {shoppingTexts.added(onList.servings)}
          </Body>
        ) : null}
        {shoppingMessage ? (
          <Notice tone={shoppingMessage.tone} testID="recipe-shopping-message">
            {shoppingMessage.text}
          </Notice>
        ) : null}
        {onList !== null || shoppingMessage?.tone === 'success' ? openList : null}
      </Card>
    );
  }

  return shell(
    recipe.title_de,
    <>
      {demo ? <DemoBanner /> : null}
      {/* Testphase (Gründer 19.10.2026): freigegeben, aber noch ohne Fachprüfung – dezent gekennzeichnet. */}
      {reviewMark === 'testphase' ? (
        <Notice tone="info" testID="recipe-testphase">
          {texts.testphase}
        </Notice>
      ) : reviewMark === 'ai_draft' ? (
        <Notice tone="info" testID="recipe-ai-draft">
          {texts.aiDraft}
        </Notice>
      ) : reviewMark === 'draft' ? (
        <Notice tone="info">{texts.draft}</Notice>
      ) : null}
      {/* K6, Wächter Testphase M2 (sichere Variante): Allergen-Warnung auch in der Testphase (ohne Fachprüfung). */}
      {recipe.status === 'draft' || reviewMark === 'testphase' ? (
        <Notice tone="warning" testID="recipe-allergen-warning">
          {texts.allergenWarning}
        </Notice>
      ) : null}
      {outsideProfileDiet ? (
        <Notice tone="info" testID="recipe-outside-diet">
          <Body>{t.nutrition.search.outsideDiet(t.nutrition.dietNames[outsideProfileDiet])}</Body>
          <Body muted>{t.nutrition.search.outsideDietRecipe}</Body>
        </Notice>
      ) : null}
      {/* Wächter N6 S1: bei „Zahlen aus“/Schwangerschaft ohne Sätze mit kcal- oder Makro-Mengen (Filter aus core). */}
      {description !== null ? (
        <Body muted testID="recipe-description">
          {description}
        </Body>
      ) : null}
      <Body muted>{texts.times(recipe.prep_minutes, recipe.cook_minutes)}</Body>

      <Card>
        {plannedMeal ? (
          <Body testID="recipe-portion">
            {texts.yourPortion(formatNumberDe(plannedMeal.factor))}
          </Body>
        ) : (
          <View style={{ gap: 8 }}>
            <Body testID="recipe-servings">{`${texts.servings}: ${texts.servingsValue(picked)}`}</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="−"
                  accessibilityLabel={texts.fewer}
                  variant="secondary"
                  disabled={picked <= RECIPE_SERVINGS_PICKER.min}
                  onPress={() => setServings(Math.max(RECIPE_SERVINGS_PICKER.min, picked - 1))}
                  testID="recipe-servings-less"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="+"
                  accessibilityLabel={texts.more}
                  variant="secondary"
                  disabled={picked >= RECIPE_SERVINGS_PICKER.max}
                  onPress={() => setServings(Math.min(RECIPE_SERVINGS_PICKER.max, picked + 1))}
                  testID="recipe-servings-more"
                />
              </View>
            </View>
          </View>
        )}
      </Card>

      {shoppingCard()}
      {/* Ernährungstagebuch (Etappe E1): Rezept mit Portionen eintragen (Plan-Mahlzeiten haben „Gegessen“ im Tag). */}
      {plannedMeal ? null : (
        <Button
          label={t.foodLog.add}
          accessibilityLabel={t.foodLog.addThisA11y(recipe.title_de)}
          variant="secondary"
          onPress={() =>
            router.push(`/ernaehrung/eintragen?rezept=${encodeURIComponent(recipe.id)}` as Href)
          }
          testID="recipe-food-log"
        />
      )}

      {plannedMeal !== null && date !== null && params.platz !== undefined ? (
        <RatingCard
          recipeId={recipe.id}
          title={recipe.title_de}
          date={date}
          slot={params.platz}
          today={today}
        />
      ) : null}

      <Heading level={2}>{texts.ingredients}</Heading>
      <View style={{ gap: 4 }} testID="recipe-ingredients">
        {ingredients.map((ingredient) => {
          const original = recipe.ingredients[ingredient.index];
          // Getauscht: Hinweis aus der Austausch-Tabelle statt der Notiz zur Original-Zutat.
          const note =
            ingredient.swapped === true && original?.role !== undefined
              ? substitutionFor(
                  library.substitutions,
                  original.food_id,
                  ingredient.foodId,
                  original.role,
                )?.note_de
              : original?.note_de;
          const name =
            ingredient.originalFoodId === null
              ? foodName(ingredient.foodId)
              : ingredient.swapped === true
                ? texts.swappedInstead(
                    foodName(ingredient.originalFoodId),
                    foodName(ingredient.foodId),
                  )
                : texts.instead(foodName(ingredient.originalFoodId), foodName(ingredient.foodId));
          const line = `• ${formatAmount(ingredient.amount, ingredient.unit)} ${name}${
            ingredient.optional ? ` ${texts.optional}` : ''
          }${note ? ` – ${note}` : ''}`;
          const swappable =
            plannedMeal !== null &&
            date !== null &&
            params.platz !== undefined &&
            view.week?.kind === 'ready' &&
            canSwapIngredient(view.week, {
              date,
              slot: params.platz,
              index: ingredient.index,
            });
          if (!swappable) {
            return <Body key={ingredient.index}>{line}</Body>;
          }
          return (
            <View
              key={ingredient.index}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Body testID={`recipe-ingredient-${ingredient.index}`}>{line}</Body>
              </View>
              <Button
                label={texts.swapButton}
                accessibilityLabel={texts.swapA11y(foodName(ingredient.foodId))}
                variant="secondary"
                onPress={() =>
                  router.push(
                    `/rezept/austauschen?id=${encodeURIComponent(recipe.id)}&tag=${date}&platz=${encodeURIComponent(
                      params.platz ?? '',
                    )}&zutat=${ingredient.index}` as Href,
                  )
                }
                testID={`recipe-swap-${ingredient.index}`}
              />
            </View>
          );
        })}
        {variant.omitted.map((index) => {
          const foodId = recipe.ingredients[index]?.food_id;
          return foodId ? (
            <Body key={`ohne-${index}`} muted>
              {`• ${texts.omittedLine(foodName(foodId))}`}
            </Body>
          ) : null;
        })}
      </View>
      {recipe.equipment_de.length > 0 ? (
        <Body muted>{texts.equipment(recipe.equipment_de.join(', '))}</Body>
      ) : null}

      <Heading level={2}>{texts.steps}</Heading>
      <View style={{ gap: 4 }}>
        {recipe.steps_de.map((step, index) => (
          <Body key={step}>{`${index + 1}. ${step}`}</Body>
        ))}
      </View>

      {showNumbers && perPortion ? (
        <Card>
          <Heading level={2}>{texts.nutrients}</Heading>
          <Body testID="recipe-nutrients">
            {texts.nutrientLine(
              formatKcal(perPortion.kcal),
              formatGrams(perPortion.protein_g),
              formatGrams(perPortion.carbs_g),
              formatGrams(perPortion.fat_g),
            )}
          </Body>
          <Body muted>{t.nutrition.estimate}</Body>
        </Card>
      ) : null}

      <Card>
        <Body testID="recipe-contains">{containsText(contains)}</Body>
        <Body muted>{texts.traces}</Body>
        <Body muted>{t.nutrition.hfiCoeliac}</Body>
      </Card>
      {recipe.meal_prep.suitable && keeping.fridgeDays > 0 ? (
        <Body muted testID="recipe-fridge-days">
          {texts.mealPrepFridge(keeping.fridgeDays)}
        </Body>
      ) : null}
      {recipe.meal_prep.suitable && keeping.freezable ? (
        <Body muted>{texts.mealPrepFreezable}</Body>
      ) : null}
      {demo ? (
        <Body muted>{t.nutrition.demoSource}</Body>
      ) : (
        sources.length > 0 && (
          <Body muted testID="recipe-source">
            {nutrientSourcesText(sources)}
          </Body>
        )
      )}
      <Body muted>{t.nutrition.disclaimer}</Body>
    </>,
  );
}
