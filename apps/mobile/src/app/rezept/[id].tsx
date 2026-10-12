import {
  isoDateSchema,
  needsExpertReviewLabel,
  RECIPE_SERVINGS_PICKER,
  recipeContains,
  type ScaledIngredient,
  scaleRecipeForServings,
  weekHidesEnergyNumbers,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { recipeForPerson } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { todayIso } from '@/lib/format';
import {
  containsText,
  formatAmount,
  formatGrams,
  formatKcal,
  formatNumberDe,
} from '@/lib/nutrition-format';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Rezeptansicht (docs/PLAN-PHASE-5.md 8.2 Nr. 4, 19.6, Etappe N4): Titel, Kennzeichnung „KI-Entwurf – fachlich prüfen“
 * und bei Entwürfen deutlich „Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden“ (K6),
 * Zeiten, Portion (aus dem Essensplan bzw. Portionswähler 1–12), Zutaten mit Mengen, Ersatz- und Weglass-Hinweise,
 * Schritte, Nährwerte je Portion (ausblendbar), „Enthält: …“ inkl. Kokos, Spuren-Hinweis, HFI/Zöliakie, Meal-Prep-
 * Haltbarkeit, Nährwert-Quelle. Jedes Rezept läuft vorher durch den Filter der Person (recipeForPerson).
 */
export default function RecipeScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ id: string; tag?: string; platz?: string }>();
  const date = isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : null;
  const view = useNutritionWeek(date ?? todayIso());
  const [servings, setServings] = useState<number | null>(null);

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

  const { variant, plannedMeal } = found;
  const recipe = variant.recipe;
  const texts = t.nutrition.recipe;
  const foods = library.foods;
  const foodName = (id: string) => foods.get(id)?.name_de ?? id;
  // K1: In Schwangerschaft/Stillzeit (B5) auch per Deep-Link keine Energie-Zahlen.
  const showNumbers =
    view.showNumbers &&
    !weekHidesEnergyNumbers(view.week.targets) &&
    (plannedMeal === null ||
      view.week.plan?.days.find((d) => d.date === date)?.status !== 'no_targets');

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
  const sources = [
    ...new Map(
      usedFoods.map((f) => [`${f.source.db}|${f.source.version}|${f.source.license}`, f.source]),
    ).values(),
  ];

  return shell(
    recipe.title_de,
    <>
      {demo ? <DemoBanner /> : null}
      {needsExpertReviewLabel(recipe.meta) ? (
        <Notice tone="info" testID="recipe-ai-draft">
          {texts.aiDraft}
        </Notice>
      ) : recipe.status === 'draft' ? (
        <Notice tone="info">{texts.draft}</Notice>
      ) : null}
      {recipe.status === 'draft' ? (
        <Notice tone="warning" testID="recipe-allergen-warning">
          {texts.allergenWarning}
        </Notice>
      ) : null}
      <Body muted>{recipe.description_de}</Body>
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

      <Heading level={2}>{texts.ingredients}</Heading>
      <View style={{ gap: 4 }} testID="recipe-ingredients">
        {ingredients.map((ingredient) => {
          const note = recipe.ingredients[ingredient.index]?.note_de;
          const name =
            ingredient.originalFoodId !== null
              ? texts.instead(foodName(ingredient.originalFoodId), foodName(ingredient.foodId))
              : foodName(ingredient.foodId);
          return (
            <Body key={ingredient.index}>
              {`• ${formatAmount(ingredient.amount, ingredient.unit)} ${name}${
                ingredient.optional ? ` ${texts.optional}` : ''
              }${note ? ` – ${note}` : ''}`}
            </Body>
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
      {recipe.meal_prep.suitable && recipe.meal_prep.fridge_days > 0 ? (
        <Body muted>{texts.mealPrepFridge(recipe.meal_prep.fridge_days)}</Body>
      ) : null}
      {recipe.meal_prep.suitable && recipe.meal_prep.freezable ? (
        <Body muted>{texts.mealPrepFreezable}</Body>
      ) : null}
      {demo ? (
        <Body muted>{t.nutrition.demoSource}</Body>
      ) : (
        sources.map((source) => (
          <Body key={`${source.db}|${source.version}|${source.license}`} muted>
            {t.nutrition.source(t.nutrition.sourceNames[source.db], source.version, source.license)}
          </Body>
        ))
      )}
      <Body muted>{t.nutrition.disclaimer}</Body>
    </>,
  );
}
