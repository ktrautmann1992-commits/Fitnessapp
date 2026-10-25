import { hiddenRecipeEntries } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ListGroup } from '@/components/design';
import { RecipeThumb } from '@/components/recipe-image';
import { Screen } from '@/components/screen';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { recipePreferencesFromRows } from '@/data/recipe-preference-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Einstellungen → „Ausgeblendete Gerichte“ (Rezept-Favoriten, Gründer-Freigabe 25.10.2026): alle mit „Nie wieder“
 * ausgeblendeten Rezepte mit „Wieder zulassen“. Liste aus packages/core (`hiddenRecipeEntries`, alphabetisch);
 * unbekannte Rezepte (nicht mehr im Bestand) stehen trotzdem da, damit sie entfernt werden können.
 */
export default function HiddenRecipesScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const { ensureNutritionLibrary, nutritionLibrary } = app;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
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
  const texts = t.nutrition.favorites;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings' as Href));
  const footer = <Button label={texts.back} variant="secondary" onPress={back} />;
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="recipe"
      title={texts.hiddenTitle}
      intro={texts.hiddenIntro}
      testID="hidden-recipes"
      footer={footer}
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  const recipes =
    nutritionLibrary.kind === 'ready' ? nutritionLibrary.result.library.recipes : null;
  const entries = hiddenRecipeEntries(recipePreferencesFromRows(app.rows), recipes ?? []);

  async function allow(recipeId: string, title: string) {
    setBusy(recipeId);
    setMessage(null);
    try {
      await app.setRecipePreference(recipeId, null);
      setMessage({ text: texts.allowed(title), tone: 'success' });
    } catch (caught) {
      setMessage({ text: errorText(caught) || texts.failed, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  return shell(
    <>
      {message ? (
        <Notice tone={message.tone} testID="hidden-recipes-message">
          {message.text}
        </Notice>
      ) : null}
      {nutritionLibrary.kind === 'idle' || nutritionLibrary.kind === 'loading' ? (
        <LoadingState label={t.nutrition.loading} />
      ) : null}
      {nutritionLibrary.kind === 'error' ? (
        <Notice tone="warning">{t.nutrition.loadFailed}</Notice>
      ) : null}
      {entries.length === 0 ? (
        <Notice tone="info" testID="hidden-recipes-empty">
          {texts.hiddenEmpty}
        </Notice>
      ) : (
        <ListGroup testID="hidden-recipes-list">
          {entries.map((entry, index) => {
            // Während des Ladens nie die rohe ID zeigen.
            const title = entry.titleDe ?? (recipes === null ? '…' : texts.unknownRecipe);
            return (
              <View
                key={entry.recipeId}
                testID={`hidden-recipe-${entry.recipeId}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: index === entries.length - 1 ? 0 : 1,
                  borderColor: theme.divider,
                }}
              >
                <RecipeThumb recipeId={entry.recipeId} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Body>{title}</Body>
                  <Body muted>{texts.hiddenSince(formatDateDe(entry.setOn))}</Body>
                </View>
                <Button
                  label={texts.unhide}
                  accessibilityLabel={texts.unhideA11y(title)}
                  variant="secondary"
                  loading={busy === entry.recipeId}
                  disabled={busy !== null && busy !== entry.recipeId}
                  onPress={() => void allow(entry.recipeId, title)}
                  testID={`hidden-recipe-allow-${entry.recipeId}`}
                />
              </View>
            );
          })}
        </ListGroup>
      )}
    </>,
  );
}
