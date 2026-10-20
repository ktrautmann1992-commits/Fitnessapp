import {
  buildCustomMeal,
  canAddCustomMeal,
  checkCustomMealDirectValues,
  CUSTOM_MEAL_LIMITS,
  type CustomMeal,
  type CustomMealBuild,
  customMealComputable,
  type CustomMealItem,
  type CustomMealMode,
  customMealNutrients,
  customMealValuesNeedConfirmation,
  type Food,
  foodLogUnitsFor,
  type FoodLogUnit,
  type FoodLookup,
  isValidFoodLogAmount,
  renameCustomMeal,
  searchFoodLogCatalog,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { newId } from '@/data/create-backend';
import { customMealFromRows } from '@/data/custom-meal-rows';
import { t } from '@/i18n';
import { customMealBuildErrorText, customMealValuesText } from '@/lib/custom-meal-format';
import { errorText } from '@/lib/error-text';
import { entryAmountText, unitText } from '@/lib/food-log-format';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useCustomMealActions } from '@/state/use-custom-meals';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Eigenes Gericht anlegen bzw. ändern (`?id=…`, Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7): Name (bis 60
 * Zeichen) und entweder (a) Werte je Portion direkt oder (b) Zutaten aus dem Katalog + Anzahl Portionen – die Werte
 * rechnet packages/core (`buildCustomMeal`, gleiche Rechnung wie Rezepte). Bei „Kalorienzahlen aus“ nur über Zutaten
 * (Werte im Hintergrund) oder ohne Werte – nirgends kcal. Direkte Werte, die mehr als 20 % von den Makros abweichen,
 * lösen eine Rückfrage aus (keine Sperre). Fehlertexte ohne Namen und ohne Werte.
 */
export default function CustomMealFormScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const view = useNutritionWeek(today);

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
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/ernaehrung/gerichte' as Href);
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="recipe"
      title={editId ? t.customMeals.editTitle : t.customMeals.newTitle}
      testID="custom-meal-form"
      footer={
        <Button
          label={t.customMeals.cancel}
          variant="secondary"
          onPress={back}
          testID="custom-meal-cancel"
        />
      }
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.customMeals.unsupported}</Notice>);
  }
  if (!nutritionReady(view) || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  if (healthConsentStatus(rows, app.versions) !== 'valid') {
    return shell(
      <Notice tone="info" testID="custom-meals-consent">
        <Body>{t.customMeals.consentNeeded}</Body>
        <Button
          label={t.foodLog.consentButton}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
          testID="custom-meals-consent-button"
        />
      </Notice>,
    );
  }
  const existing = editId ? customMealFromRows(rows, editId) : null;
  if (editId && existing === null) {
    return shell(<Notice tone="info">{t.customMeals.notFound}</Notice>);
  }
  if (!existing && !canAddCustomMeal(rows.customMeals)) {
    return shell(<Notice tone="info">{t.customMeals.limitReached}</Notice>);
  }
  return shell(
    <MealForm
      key={existing?.id ?? 'neu'}
      existing={existing}
      foods={view.library.result.library.foods}
      showNumbers={view.showNumbers}
      onDone={back}
    />,
  );
}

function MealForm({
  existing,
  foods,
  showNumbers,
  onDone,
}: {
  existing: CustomMeal | null;
  foods: FoodLookup;
  showNumbers: boolean;
  onDone: () => void;
}) {
  const actions = useCustomMealActions();
  const [name, setName] = useState(existing?.name_de ?? '');
  const [mode, setMode] = useState<CustomMealMode>(existing?.mode ?? 'ingredients');
  const [items, setItems] = useState<CustomMealItem[]>(existing?.items ?? []);
  const [servings, setServings] = useState(existing?.servings ?? 1);
  const [kcal, setKcal] = useState(formatDecimal(existing?.kcal ?? null));
  const [protein, setProtein] = useState(formatDecimal(existing?.protein_g ?? null));
  const [carbs, setCarbs] = useState(formatDecimal(existing?.carbs_g ?? null));
  const [fat, setFat] = useState(formatDecimal(existing?.fat_g ?? null));
  const [errors, setErrors] = useState<{
    name?: string;
    kcal?: string;
    protein_g?: string;
    carbs_g?: string;
    fat_g?: string;
  }>({});
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'warning' } | null>(null);
  const [pending, setPending] = useState<CustomMeal | null>(null);
  const [busy, setBusy] = useState(false);
  const id = existing?.id ?? null;
  const [newMealId] = useState(() => newId());
  const mealId = id ?? newMealId;
  // Zutaten, die nicht mehr im Bestand sind (archiviert): Werte bleiben aus dem Schnappschuss, nur Umbenennen geht.
  const itemsUnchanged =
    existing !== null &&
    existing.mode === mode &&
    existing.servings === servings &&
    JSON.stringify(existing.items) === JSON.stringify(items);
  const computable = customMealComputable({ items }, foods);
  const preview = useMemo(
    () =>
      mode === 'ingredients' && items.length > 0
        ? customMealNutrients({ items, servings }, foods)
        : null,
    [foods, items, mode, servings],
  );

  async function store(meal: CustomMeal, confirmed = false) {
    if (!confirmed && meal.mode === 'direct' && customMealValuesNeedConfirmation(meal)) {
      setPending(meal);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await actions.save(meal);
      onDone();
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    setMessage(null);
    let build: CustomMealBuild;
    if (existing && mode === 'ingredients' && itemsUnchanged && !computable) {
      build = renameCustomMeal(existing, name);
    } else if (mode === 'ingredients') {
      build = buildCustomMeal({ id: mealId, name, mode, servings, items }, foods);
    } else if (!showNumbers) {
      // Ohne Zahlen: neu ohne Werte; vorhandene direkte Werte bleiben (sie sind nur ausgeblendet).
      const keep = existing?.mode === 'direct' && existing.kcal !== null ? existing : null;
      build = buildCustomMeal(
        {
          id: mealId,
          name,
          mode: 'direct',
          values: keep
            ? {
                kcal: keep.kcal ?? 0,
                protein_g: keep.protein_g,
                carbs_g: keep.carbs_g,
                fat_g: keep.fat_g,
              }
            : null,
        },
        foods,
      );
    } else {
      // Feldprüfung mit den Grenzen aus constants.ts (packages/core, Wächter E2 H4); Fehler je Feld (H5).
      const parsed = {
        kcal: parseDecimal(kcal),
        protein_g: parseDecimal(protein),
        carbs_g: parseDecimal(carbs),
        fat_g: parseDecimal(fat),
      };
      const fieldErrors = checkCustomMealDirectValues(parsed);
      setErrors({
        ...(fieldErrors.kcal ? { kcal: t.customMeals.kcalInvalid } : {}),
        ...(fieldErrors.protein_g ? { protein_g: t.customMeals.macroInvalid } : {}),
        ...(fieldErrors.carbs_g ? { carbs_g: t.customMeals.macroInvalid } : {}),
        ...(fieldErrors.fat_g ? { fat_g: t.customMeals.macroInvalid } : {}),
      });
      if (Object.keys(fieldErrors).length > 0 || parsed.kcal === null) return;
      const value = parsed.kcal;
      const macros = [parsed.protein_g, parsed.carbs_g, parsed.fat_g];
      build = buildCustomMeal(
        {
          id: mealId,
          name,
          mode: 'direct',
          values: {
            kcal: value,
            protein_g: macros[0] ?? null,
            carbs_g: macros[1] ?? null,
            fat_g: macros[2] ?? null,
          },
        },
        foods,
      );
    }
    if (!build.ok) {
      if (build.reason === 'name') {
        setErrors({ name: t.customMeals.nameInvalid });
        return;
      }
      setErrors({});
      setMessage({ text: customMealBuildErrorText(build.reason), tone: 'warning' });
      return;
    }
    setErrors({});
    void store(build.meal);
  }

  const foodName = (foodId: string) =>
    foods.get(foodId)?.name_de ?? t.customMeals.ingredientMissing;
  return (
    <View style={{ gap: 12 }}>
      <TextField
        label={t.customMeals.nameLabel}
        hint={t.customMeals.nameHint}
        value={name}
        onChangeText={setName}
        maxLength={CUSTOM_MEAL_LIMITS.nameMaxChars}
        error={errors.name}
        testID="custom-meal-name"
      />
      <ChoiceList
        label={t.customMeals.modeLabel}
        horizontal
        options={[
          { value: 'ingredients' as const, label: t.customMeals.modes.ingredients },
          {
            value: 'direct' as const,
            label: showNumbers ? t.customMeals.modes.direct : t.customMeals.modeDirectNoNumbers,
          },
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setMessage(null);
        }}
      />
      {mode === 'direct' ? (
        showNumbers ? (
          <View style={{ gap: 8 }} testID="custom-meal-direct">
            <TextField
              label={t.customMeals.directKcal}
              value={kcal}
              onChangeText={setKcal}
              keyboardType="number-pad"
              maxLength={5}
              error={errors.kcal}
              testID="custom-meal-kcal"
            />
            <Body muted>{t.customMeals.directMacrosTitle}</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextField
                label={t.foodLog.quickProtein}
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
                maxLength={5}
                style={{ flex: 1 }}
                error={errors.protein_g}
                testID="custom-meal-protein"
              />
              <TextField
                label={t.foodLog.quickCarbs}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
                maxLength={5}
                style={{ flex: 1 }}
                error={errors.carbs_g}
                testID="custom-meal-carbs"
              />
              <TextField
                label={t.foodLog.quickFat}
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
                maxLength={5}
                style={{ flex: 1 }}
                error={errors.fat_g}
                testID="custom-meal-fat"
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 4 }} testID="custom-meal-direct">
            <Body muted>{t.customMeals.directNoNumbers}</Body>
            {existing?.mode === 'direct' && existing.kcal !== null ? (
              <Body muted>{t.customMeals.directKeepValues}</Body>
            ) : null}
          </View>
        )
      ) : (
        <View style={{ gap: 8 }} testID="custom-meal-ingredients">
          <Heading level={2}>{t.customMeals.ingredientsTitle}</Heading>
          {items.length === 0 ? (
            <Body muted testID="custom-meal-items-empty">
              {t.customMeals.ingredientsEmpty}
            </Body>
          ) : (
            items.map((item, index) => (
              <Card key={`${index}-${item.food_id}`}>
                <Body>{foodName(item.food_id)}</Body>
                <Body muted>{entryAmountText({ ...item, portion: null })}</Body>
                <Button
                  label={t.customMeals.removeIngredient}
                  accessibilityLabel={t.customMeals.removeIngredientA11y(foodName(item.food_id))}
                  variant="link"
                  disabled={busy}
                  onPress={() => setItems(items.filter((_, i) => i !== index))}
                  testID={`custom-meal-item-remove-${index}`}
                />
              </Card>
            ))
          )}
          {!computable && existing !== null ? (
            <Notice tone="info">{t.customMeals.missingFood}</Notice>
          ) : null}
          {items.length < CUSTOM_MEAL_LIMITS.maxItems ? (
            <IngredientSearch
              foods={foods}
              busy={busy}
              onAdd={(item) => setItems([...items, item])}
            />
          ) : (
            <Body muted>{t.customMeals.ingredientsMax}</Body>
          )}
          <ChoiceList
            label={t.customMeals.servingsLabel}
            horizontal
            options={Array.from(
              { length: CUSTOM_MEAL_LIMITS.servings.max - CUSTOM_MEAL_LIMITS.servings.min + 1 },
              (_, i) => CUSTOM_MEAL_LIMITS.servings.min + i,
            ).map((value) => ({ value, label: String(value) }))}
            value={servings}
            onChange={setServings}
          />
          <Card>
            <Heading level={2}>{t.customMeals.valuesTitle}</Heading>
            {!showNumbers ? (
              <Body muted>{t.customMeals.valuesHidden}</Body>
            ) : preview === null ? (
              <Body muted>{t.customMeals.valuesPending}</Body>
            ) : preview.ok ? (
              <Body testID="custom-meal-values">{customMealValuesText(preview.perServing)}</Body>
            ) : existing && itemsUnchanged && existing.kcal !== null ? (
              <Body testID="custom-meal-values">
                {customMealValuesText({
                  kcal: existing.kcal,
                  protein_g: existing.protein_g ?? 0,
                  carbs_g: existing.carbs_g ?? 0,
                  fat_g: existing.fat_g ?? 0,
                })}
              </Body>
            ) : (
              <Body muted>{customMealBuildErrorText(preview.reason)}</Body>
            )}
          </Card>
        </View>
      )}
      {message ? (
        <Notice tone={message.tone} testID="custom-meal-message">
          {message.text}
        </Notice>
      ) : null}
      <Button
        label={t.customMeals.save}
        loading={busy}
        onPress={submit}
        testID="custom-meal-save"
      />
      <Body muted>{t.customMeals.privacy}</Body>
      <ConfirmDialog
        visible={pending !== null}
        title={t.customMeals.confirmTitle}
        message={t.customMeals.confirmText}
        confirmLabel={t.customMeals.confirmYes}
        confirmVariant="primary"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const meal = pending;
          setPending(null);
          if (meal) void store(meal, true);
        }}
        testID="custom-meal-confirm"
      />
    </View>
  );
}

/** Zutat suchen (gleiche Suche wie das Tagebuch, nur Lebensmittel) und mit Menge hinzufügen. */
function IngredientSearch({
  foods,
  busy,
  onAdd,
}: {
  foods: FoodLookup;
  busy: boolean;
  onAdd: (item: CustomMealItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const result = useMemo(() => searchFoodLogCatalog({ foods, recipes: [] }, query), [foods, query]);
  const searched = query.trim().length >= 2;
  return (
    <View style={{ gap: 8 }} testID="custom-meal-search">
      <TextField
        label={t.customMeals.searchLabel}
        hint={t.customMeals.searchHint}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setSelected(null);
        }}
        maxLength={60}
        testID="custom-meal-search-input"
      />
      {selected ? (
        <AmountForm
          key={selected.id}
          food={selected}
          busy={busy}
          onSubmit={(amount, unit) => {
            onAdd({ food_id: selected.id, amount, unit });
            setSelected(null);
            setQuery('');
          }}
        />
      ) : searched ? (
        result.foods.length === 0 ? (
          <Body muted testID="custom-meal-search-none">
            {t.customMeals.searchNone}
          </Body>
        ) : (
          result.foods.map((food) => (
            <Button
              key={food.id}
              label={food.name_de}
              accessibilityLabel={t.foodLog.chooseA11y(food.name_de)}
              variant="secondary"
              onPress={() => setSelected(food)}
              testID={`custom-meal-food-${food.id}`}
            />
          ))
        )
      ) : null}
    </View>
  );
}

function AmountForm({
  food,
  busy,
  onSubmit,
}: {
  food: Food;
  busy: boolean;
  onSubmit: (amount: number, unit: FoodLogUnit) => void;
}) {
  const units = foodLogUnitsFor(food);
  const [unit, setUnit] = useState<FoodLogUnit>(units.includes('piece') ? 'piece' : 'g');
  const [text, setText] = useState(unit === 'piece' ? '1' : '100');
  const [error, setError] = useState<string>();
  return (
    <Card>
      <Heading level={2}>{food.name_de}</Heading>
      <ChoiceList
        label={t.foodLog.unitLabel}
        horizontal
        options={units.map((value) => ({ value, label: unitText(value) }))}
        value={unit}
        onChange={(next) => {
          setUnit(next);
          setText(next === 'piece' ? '1' : '100');
          setError(undefined);
        }}
      />
      {!units.includes('piece') ? <Body muted>{t.foodLog.pieceUnavailable}</Body> : null}
      <TextField
        label={`${t.foodLog.amountLabel} (${unitText(unit)})`}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        error={error}
        maxLength={7}
        testID="custom-meal-amount"
      />
      <Button
        label={t.customMeals.addIngredient}
        accessibilityLabel={t.customMeals.addIngredientA11y(food.name_de)}
        disabled={busy}
        onPress={() => {
          const amount = parseDecimal(text);
          if (amount === null || Number.isNaN(amount)) {
            setError(t.foodLog.amountInvalid);
            return;
          }
          if (!isValidFoodLogAmount(amount, unit)) {
            setError(t.foodLog.amountRange);
            return;
          }
          setError(undefined);
          onSubmit(amount, unit);
        }}
        testID="custom-meal-add-item"
      />
    </Card>
  );
}
