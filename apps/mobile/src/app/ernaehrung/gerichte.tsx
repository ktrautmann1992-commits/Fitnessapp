import { canAddCustomMeal, type CustomMeal } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { customMealDetailText } from '@/lib/custom-meal-format';
import { errorText } from '@/lib/error-text';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, resolveEntryRoute } from '@/state/flow';
import { useCustomMealActions, useCustomMeals } from '@/state/use-custom-meals';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung → „Eigene Gerichte“ (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7, KONZEPT 6.2): Liste (zuletzt
 * eingetragen zuerst), Anlegen, Ändern, Löschen (mit Rückfrage; eingetragene Tage behalten ihre Werte). Höchstens 100
 * Gerichte. Nur mit Einwilligung health_data (Name = Freitext, sichere Voreinstellung E2). Bei „Kalorienzahlen aus“
 * keine kcal. testIDs nur mit Position, nie mit dem Namen.
 */
export default function CustomMealsScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const view = useNutritionWeek(today);
  const meals = useCustomMeals();
  const actions = useCustomMealActions();
  const [deleting, setDeleting] = useState<CustomMeal | null>(null);
  const [busy, setBusy] = useState(false);
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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const rows = app.rows;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href));
  const shell = (children: ReactNode) => (
    <Screen
      title={t.customMeals.title}
      testID="custom-meals"
      footer={
        <Button
          label={t.foodLog.done}
          variant="secondary"
          onPress={back}
          testID="custom-meals-done"
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
  const showNumbers = view.showNumbers;
  const canAdd = canAddCustomMeal(meals);

  return shell(
    <>
      <Body>{t.customMeals.intro}</Body>
      {!showNumbers ? <Body muted>{t.foodLog.numbersHidden}</Body> : null}
      <Button
        label={t.customMeals.create}
        disabled={!canAdd}
        onPress={() => router.push('/ernaehrung/gericht' as Href)}
        testID="custom-meals-create"
      />
      {!canAdd ? (
        <Notice tone="info" testID="custom-meals-limit">
          {t.customMeals.limitReached}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="custom-meals-message">
          {message.text}
        </Notice>
      ) : null}
      {meals.length === 0 ? (
        <Body muted testID="custom-meals-empty">
          {t.customMeals.empty}
        </Body>
      ) : (
        <View style={{ gap: 8 }} testID="custom-meals-list">
          <Body muted testID="custom-meals-count">
            {t.customMeals.count(meals.length)}
          </Body>
          {meals.map((meal, index) => (
            <Card key={meal.id}>
              <Heading level={2}>{meal.name_de}</Heading>
              <Body muted>{customMealDetailText(meal, showNumbers)}</Body>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t.customMeals.edit}
                    accessibilityLabel={t.customMeals.editA11y(meal.name_de)}
                    variant="secondary"
                    disabled={busy}
                    onPress={() =>
                      router.push(`/ernaehrung/gericht?id=${encodeURIComponent(meal.id)}` as Href)
                    }
                    testID={`custom-meals-edit-${index}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t.customMeals.delete}
                    accessibilityLabel={t.customMeals.deleteA11y(meal.name_de)}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setDeleting(meal)}
                    testID={`custom-meals-delete-${index}`}
                  />
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
      <Body muted>{t.customMeals.privacy}</Body>
      <ConfirmDialog
        visible={deleting !== null}
        title={t.customMeals.deleteTitle}
        message={t.customMeals.deleteText}
        confirmLabel={t.customMeals.delete}
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const meal = deleting;
          setDeleting(null);
          if (!meal) return;
          setBusy(true);
          setMessage(null);
          actions
            .remove(meal.id)
            .then(() => setMessage({ text: t.customMeals.deleted, tone: 'success' }))
            .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
            .finally(() => setBusy(false));
        }}
        testID="custom-meals-delete-dialog"
      />
    </>,
  );
}
