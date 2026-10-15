import {
  CUSTOM_MEAL_PORTION_CHOICES,
  type CustomMeal,
  defaultFoodLogSlot,
  FOOD_LOG_MANUAL_SLOTS,
  type FoodLogEntry,
  type FoodLogManualSlot,
  needsFoodLogConfirmation,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import { Body, Button, Card, ChoiceList, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { customMealDetailText } from '@/lib/custom-meal-format';
import { errorText } from '@/lib/error-text';
import {
  buildErrorText,
  confirmText,
  manualSlotLabel,
  portionNumber,
  portionText,
} from '@/lib/food-log-format';
import { useCustomMealActions, useCustomMeals } from '@/state/use-custom-meals';
import type { FoodLogActions, FoodLogDayView } from '@/state/use-food-log';

/**
 * Eigene Gerichte beim Eintragen (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7): Portion 0,25–3 wählen, Gericht mit
 * einem Tipp eintragen. Der Eintrag ist ein Schnappschuss mit festem Titel „Eigenes Gericht“ (packages/core
 * `entryFromCustomMeal`); der Name steht nur auf dem Bildschirm – testIDs nur mit Position, nie mit Namen.
 */
export function CustomMealPicker({
  meals,
  showNumbers,
  busy,
  limit,
  testID,
  onPick,
}: {
  meals: readonly CustomMeal[];
  showNumbers: boolean;
  busy: boolean;
  /** Höchstens so viele zeigen (Tagesverlauf); danach Link „Alle eigenen Gerichte“. */
  limit?: number;
  testID: string;
  onPick: (meal: CustomMeal, portion: number) => void;
}) {
  const router = useRouter();
  const [portion, setPortion] = useState(1);
  const shown = limit === undefined ? meals : meals.slice(0, limit);
  return (
    <View style={styles.list} testID={testID}>
      <ChoiceList
        label={t.customMeals.portionLabel}
        horizontal
        options={CUSTOM_MEAL_PORTION_CHOICES.map((value) => ({
          value,
          label: portionNumber(value),
        }))}
        value={portion}
        onChange={setPortion}
      />
      {shown.map((meal, index) => (
        <Card key={meal.id}>
          <Body>{meal.name_de}</Body>
          <Body muted>{customMealDetailText(meal, showNumbers)}</Body>
          <Button
            label={t.customMeals.add}
            accessibilityLabel={t.customMeals.addA11y(meal.name_de)}
            disabled={busy}
            onPress={() => onPick(meal, portion)}
            testID={`${testID}-add-${index}`}
          />
        </Card>
      ))}
      {limit !== undefined && meals.length > limit ? (
        <Button
          label={t.customMeals.showAll}
          variant="link"
          onPress={() => router.push('/ernaehrung/gerichte' as Href)}
          testID={`${testID}-all`}
        />
      ) : null}
    </View>
  );
}

/**
 * Abschnitt „Eigene Gerichte“ im Tagesverlauf: Mahlzeit (vorbelegt nach Uhrzeit) und Portion wählen, dann mit einem
 * Tipp eintragen; ab 1.500 kcal je Eintrag die Rückfrage wie im Tagebuch (ohne kcal bei „Zahlen aus“). Ohne Gerichte
 * nur „Eigenes Gericht anlegen“. Nur mit Einwilligung und für Tage, an denen Eintragen geht.
 */
export function CustomMealDaySection({
  date,
  view,
  actions,
  showNumbers,
}: {
  date: string;
  view: FoodLogDayView;
  actions: FoodLogActions;
  showNumbers: boolean;
}) {
  const router = useRouter();
  const meals = useCustomMeals();
  const mealActions = useCustomMealActions();
  const [slot, setSlot] = useState<FoodLogManualSlot>(() => {
    const now = new Date();
    return defaultFoodLogSlot(now.getHours() * 60 + now.getMinutes());
  });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ entry: FoodLogEntry; label: string } | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'danger' | 'warning';
  } | null>(null);
  if (!view.supported || !view.consentValid || view.dateStatus !== 'ok') return null;

  async function store(entry: FoodLogEntry, label: string, confirmed = false) {
    if (!confirmed && needsFoodLogConfirmation(entry)) {
      setPending({ entry, label });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await actions.save([entry]);
      setMessage({ text: label, tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section} testID="custom-meal-day">
      <Heading level={2}>{t.customMeals.pickTitle}</Heading>
      {meals.length === 0 ? (
        <Button
          label={t.customMeals.createFirst}
          variant="secondary"
          onPress={() => router.push('/ernaehrung/gericht' as Href)}
          testID="custom-meal-day-create"
        />
      ) : (
        <>
          <ChoiceList
            label={t.foodLog.slotQuestion}
            horizontal
            options={FOOD_LOG_MANUAL_SLOTS.map((value) => ({
              value,
              label: manualSlotLabel(value),
            }))}
            value={slot}
            onChange={setSlot}
          />
          <CustomMealPicker
            meals={meals}
            showNumbers={showNumbers}
            busy={busy}
            limit={5}
            testID="custom-meal-day-list"
            onPick={(meal, portion) => {
              const built = mealActions.entry(meal, portion, date, slot);
              if (!built.ok) {
                setMessage({ text: buildErrorText(built.reason), tone: 'warning' });
                return;
              }
              void store(built.entry, t.customMeals.saved(meal.name_de, portionText(portion)));
            }}
          />
          <Button
            label={t.customMeals.manage}
            variant="secondary"
            onPress={() => router.push('/ernaehrung/gerichte' as Href)}
            testID="custom-meal-day-manage"
          />
        </>
      )}
      {message ? (
        <Notice tone={message.tone} testID="custom-meal-day-message">
          {message.text}
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={pending !== null}
        title={t.foodLog.confirmTitle}
        message={pending ? confirmText(pending.entry, showNumbers) : ''}
        confirmLabel={t.foodLog.confirmYes}
        confirmVariant="primary"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) void store(next.entry, next.label, true);
        }}
        testID="custom-meal-day-confirm"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  list: { gap: spacing.sm },
});
