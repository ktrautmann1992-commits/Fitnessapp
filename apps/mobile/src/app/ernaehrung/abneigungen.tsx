import { removeFoodDislike } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { dislikedFoodsFromRows } from '@/data/rating-rows';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Einstellungen → „Abgelehnte Lebensmittel und Bewertungen“ (KONZEPT 6.10, Etappe N10): „mag ich nicht“ je
 * Lebensmittel mit „Wieder zulassen“ und „Alle Bewertungen löschen“ (Recht auf Löschung). Bewertungen selbst werden
 * hier nicht aufgelistet (privat, nie ausgewertet). Die Regeln stehen in packages/core (`removeFoodDislike`).
 */
export default function FoodDislikesScreen() {
  const router = useRouter();
  const app = useApp();
  const { ensureNutritionLibrary, nutritionLibrary } = app;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  useEffect(() => {
    void ensureNutritionLibrary();
  }, [ensureNutritionLibrary]);

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
  const texts = t.nutrition.foodDislikes;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings' as Href));
  const footer = <Button label={texts.back} variant="secondary" onPress={back} />;

  if (!app.backend.supportsNutrition) {
    return (
      <Screen
        area="ernaehrung"
        icon="utensils"
        title={texts.title}
        testID="food-dislikes"
        footer={footer}
      >
        <Notice tone="info">{t.nutrition.unsupported}</Notice>
      </Screen>
    );
  }

  const foods = nutritionLibrary.kind === 'ready' ? nutritionLibrary.result.library.foods : null;
  // Während des Ladens bzw. ohne Bestand nie die rohe ID zeigen (Wächter N10 H7).
  const nameOf = (id: string) =>
    foods === null ? texts.loadingName : (foods.get(id)?.name_de ?? texts.unknownFood);
  const dislikes = dislikedFoodsFromRows(rows);

  async function allow(foodId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await app.saveFoodDislikes(removeFoodDislike(dislikes, foodId));
      setMessage({ text: texts.allowed(nameOf(foodId)), tone: 'success' });
    } catch {
      setMessage({ text: texts.failed, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRatings() {
    setBusy(true);
    setDialogError(undefined);
    try {
      await app.deleteRecipeRatings();
      setConfirmDelete(false);
      setMessage({ text: texts.ratingsDeleted, tone: 'success' });
    } catch {
      setDialogError(texts.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      area="ernaehrung"
      icon="utensils"
      title={texts.title}
      intro={texts.intro}
      testID="food-dislikes"
      footer={footer}
    >
      {message ? (
        <Notice tone={message.tone} testID="food-dislikes-message">
          {message.text}
        </Notice>
      ) : null}
      {nutritionLibrary.kind === 'idle' || nutritionLibrary.kind === 'loading' ? (
        <LoadingState label={t.nutrition.loading} />
      ) : null}
      {nutritionLibrary.kind === 'error' ? (
        <Notice tone="warning">{t.nutrition.loadFailed}</Notice>
      ) : null}
      {dislikes.length === 0 ? (
        <Notice tone="info" testID="food-dislikes-empty">
          {texts.empty}
        </Notice>
      ) : (
        <Card>
          {dislikes.map((foodId) => (
            <View
              key={foodId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              testID={`food-dislike-${foodId}`}
            >
              <View style={{ flex: 1 }}>
                <Body>{nameOf(foodId)}</Body>
              </View>
              <Button
                label={texts.allow}
                accessibilityLabel={texts.allowA11y(nameOf(foodId))}
                variant="secondary"
                disabled={busy}
                onPress={() => void allow(foodId)}
                testID={`food-dislike-allow-${foodId}`}
              />
            </View>
          ))}
        </Card>
      )}

      <Heading level={2}>{texts.ratingsHeading}</Heading>
      <Card>
        <Body muted>{texts.ratingsText}</Body>
        {rows.recipeRatings.length === 0 ? (
          <Body muted testID="food-dislikes-no-ratings">
            {texts.ratingsNone}
          </Body>
        ) : (
          <Button
            label={texts.deleteRatings}
            variant="danger"
            disabled={busy}
            onPress={() => {
              setDialogError(undefined);
              setConfirmDelete(true);
            }}
            testID="food-dislikes-delete-ratings"
          />
        )}
      </Card>
      <ConfirmDialog
        visible={confirmDelete}
        title={texts.deleteRatings}
        message={texts.deleteRatingsConfirm}
        confirmLabel={texts.deleteRatings}
        onConfirm={() => void deleteRatings()}
        onCancel={() => setConfirmDelete(false)}
        loading={busy}
        error={dialogError}
        testID="food-dislikes-confirm"
      />
    </Screen>
  );
}
