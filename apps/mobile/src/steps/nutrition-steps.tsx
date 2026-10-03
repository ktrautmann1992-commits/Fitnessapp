import {
  cookingStepSchema,
  DIET_TYPES,
  FOOD_GROUPS,
  FOOD_PREFERENCE_KINDS,
  NUTRITION_LIMITS,
  nutritionStepSchema,
  type CookingMode,
  type DietType,
  type FoodPreferenceInput,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen, StepFooter } from '@/components/screen';
import { Body, Card, ChoiceList, Heading, Notice, OptionButton } from '@/components/ui';
import { t } from '@/i18n';
import { toggleFoodPreference, withoutIntolerances } from '@/lib/food-preferences';
import { fieldErrorsFromIssues, type FieldErrors } from '@/lib/validation-errors';
import { healthConsentStatus } from '@/state/flow';

import type { StepController } from './use-step';

const MEAL_OPTIONS = Array.from(
  { length: NUTRITION_LIMITS.mealsPerDay.max - NUTRITION_LIMITS.mealsPerDay.min + 1 },
  (_, index) => NUTRITION_LIMITS.mealsPerDay.min + index,
);
const MEALPREP_OPTIONS = Array.from(
  {
    length: NUTRITION_LIMITS.mealPrepDaysPerWeek.max - NUTRITION_LIMITS.mealPrepDaysPerWeek.min + 1,
  },
  (_, index) => NUTRITION_LIMITS.mealPrepDaysPerWeek.min + index,
);

export function NutritionStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.nutrition;
  // Unverträglichkeiten sind Gesundheitsdaten – nur mit gültiger Einwilligung health_data.
  const canIntolerance =
    ctl.app.rows !== null && healthConsentStatus(ctl.app.rows, ctl.app.versions) === 'valid';
  const [diet, setDiet] = useState<DietType | undefined>(saved?.dietType);
  const [pork, setPork] = useState<boolean | null>(saved?.eatsPork ?? null);
  const [meals, setMeals] = useState<number | undefined>(saved?.mealsPerDay);
  const [prefs, setPrefs] = useState<FoodPreferenceInput[]>(() =>
    canIntolerance
      ? (saved?.foodPreferences ?? [])
      : withoutIntolerances(saved?.foodPreferences ?? []),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const kinds = FOOD_PREFERENCE_KINDS.filter((kind) => canIntolerance || kind !== 'intolerance');

  function next() {
    const parsed = nutritionStepSchema.safeParse({
      dietType: diet,
      eatsPork: diet === 'omnivore' ? pork : null,
      mealsPerDay: meals,
      foodPreferences: canIntolerance ? prefs : withoutIntolerances(prefs),
    });
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          dietType: t.steps.nutrition.dietRequired,
          mealsPerDay: t.steps.nutrition.mealsRequired,
        }),
      );
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'nutrition', nutrition: parsed.data });
  }

  return (
    <Screen
      title={t.steps.nutrition.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        label={t.steps.nutrition.diet}
        options={DIET_TYPES.map((value) => ({ value, label: t.steps.nutrition.diets[value] }))}
        value={diet}
        onChange={(value) => {
          setDiet(value);
          if (value !== 'omnivore') {
            setPork(null);
          }
        }}
        error={errors.dietType}
      />
      {diet === 'omnivore' ? (
        <ChoiceList
          label={t.steps.nutrition.pork}
          horizontal
          options={[
            { value: 'yes', label: t.common.yes },
            { value: 'no', label: t.common.no },
          ]}
          value={pork === null ? null : pork ? 'yes' : 'no'}
          onChange={(value) => setPork(value === 'yes')}
          error={errors.eatsPork}
        />
      ) : null}
      <ChoiceList
        label={t.steps.nutrition.meals}
        horizontal
        options={MEAL_OPTIONS.map((value) => ({ value, label: String(value) }))}
        value={meals}
        onChange={setMeals}
        error={errors.mealsPerDay}
      />
      <Heading level={2}>{t.steps.nutrition.preferences}</Heading>
      <Body muted>{t.steps.nutrition.preferencesHint}</Body>
      {canIntolerance ? null : <Notice tone="info">{t.steps.nutrition.intoleranceLocked}</Notice>}
      {errors.foodPreferences ? <Notice tone="danger">{errors.foodPreferences}</Notice> : null}
      {FOOD_GROUPS.map((group) => (
        <Card key={group.id} style={styles.groupCard}>
          <Body>{group.nameDe}</Body>
          <View style={styles.chipRow}>
            {kinds.map((kind) => (
              <OptionButton
                key={kind}
                role="checkbox"
                compact
                label={t.steps.nutrition.kinds[kind]}
                accessibilityLabel={`${group.nameDe}: ${t.steps.nutrition.kinds[kind]}`}
                selected={prefs.some((p) => p.foodGroup === group.id && p.kind === kind)}
                onPress={() => setPrefs((prev) => toggleFoodPreference(prev, group.id, kind))}
              />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export function CookingStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.cooking;
  const [mode, setMode] = useState<CookingMode | undefined>(saved?.cookingMode);
  const [days, setDays] = useState<number | undefined>(
    saved?.cookingMode === 'meal_prep' ? saved.mealprepDays : undefined,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  function next() {
    const parsed = cookingStepSchema.safeParse(
      mode === 'meal_prep' ? { cookingMode: mode, mealprepDays: days } : { cookingMode: mode },
    );
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          cookingMode: t.steps.cooking.required,
          mealprepDays: t.steps.cooking.mealprepRequired,
          _form: t.steps.cooking.required,
        }),
      );
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'cooking', cooking: parsed.data });
  }

  return (
    <Screen
      title={t.steps.cooking.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        options={(['daily', 'meal_prep'] as const).map((value) => ({
          value,
          label: t.steps.cooking.options[value].label,
          description: t.steps.cooking.options[value].text,
        }))}
        value={mode}
        onChange={setMode}
        error={errors.cookingMode ?? errors._form}
      />
      {mode === 'meal_prep' ? (
        <ChoiceList
          label={t.steps.cooking.mealprepDays}
          horizontal
          options={MEALPREP_OPTIONS.map((value) => ({ value, label: String(value) }))}
          value={days}
          onChange={setDays}
          error={errors.mealprepDays}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupCard: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
