import {
  type PantryItem,
  searchFoodLogCatalog,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  sortPantry,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { NutritionGate } from '@/components/nutrition';
import { PantryItemRow, PantryScanPanel } from '@/components/pantry';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { shoppingCategoryLabel } from '@/lib/nutrition-format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung → „Vorratsschrank“ (Gründer-Freigabe 25.10.2026, KONZEPT 6.13): Lebensmittel aus dem Katalog, wahlweise
 * mit Menge in Kaufeinheiten und „fast leer“. Hinzufügen per Suche oder Strichcode. Sensibel (Konsum): nur mit
 * Einwilligung health_data; ohne gültige Einwilligung nur Löschen. Offline-first (Supabase-Modus über die
 * verschlüsselte Ernährungs-Warteschlange). Alle Regeln in packages/core (`pantry.ts`).
 */
export default function PantryScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const view = useNutritionWeek(today);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const library = view.library.kind === 'ready' ? view.library.result.library : null;
  const pantry: PantryItem[] = useMemo(
    () =>
      (app.rows?.pantryItems ?? []).map((p) => ({
        food_id: p.food_id,
        count: p.count,
        pack_size: p.pack_size,
        low: p.low,
      })),
    [app.rows?.pantryItems],
  );

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
  const texts = t.pantry;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href));
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="box"
      title={texts.title}
      testID="pantry"
      footer={
        <Button label={t.foodLog.done} variant="secondary" onPress={back} testID="pantry-done" />
      }
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.foodLog.unsupported}</Notice>);
  }
  if (library === null) return shell(<NutritionGate view={view} />);
  const consentValid = healthConsentStatus(app.rows, app.versions) === 'valid';
  const foods = library.foods;
  const nameOf = (id: string) => foods.get(id)?.name_de ?? id;

  async function save(items: PantryItem[], success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await app.savePantryItems(items);
      if (success) setMessage({ text: success, tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }
  async function remove(foodIds: readonly string[], success: string) {
    setBusy(true);
    setMessage(null);
    try {
      for (const id of foodIds) await app.deletePantryItem(id);
      setMessage({ text: success, tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }
  const add = (foodId: string) =>
    void save(
      [{ food_id: foodId, count: null, pack_size: null, low: false }],
      texts.added(nameOf(foodId)),
    );

  const inPantry = new Set(pantry.map((p) => p.food_id));
  const hits = consentValid ? searchFoodLogCatalog({ foods, recipes: [] }, query).foods : [];
  const sorted = sortPantry(pantry, foods, SHOPPING_CATEGORIES);
  const groups = new Map<ShoppingCategory | 'unknown', PantryItem[]>();
  for (const item of sorted) {
    const key = foods.get(item.food_id)?.shopping_category ?? 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return shell(
    <>
      <Body>{texts.intro}</Body>
      <Body muted>{texts.privacy}</Body>
      {!consentValid ? (
        <Notice tone="info" testID="pantry-consent">
          <Body>{texts.consentNeeded}</Body>
          <Button
            label={texts.consentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent' as Href)}
            testID="pantry-consent-button"
          />
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="pantry-message">
          {message.text}
        </Notice>
      ) : null}

      <Heading level={2}>
        <Body testID="pantry-count">{texts.count(pantry.length)}</Body>
      </Heading>
      {pantry.length === 0 ? (
        <Body muted testID="pantry-empty">
          {texts.empty}
        </Body>
      ) : null}
      {[...groups.entries()].map(([category, items]) => (
        <Card key={category}>
          <View style={styles.column} testID={`pantry-group-${category}`}>
            <Heading level={2}>
              {category === 'unknown' ? texts.unknownGroup : shoppingCategoryLabel(category)}
            </Heading>
            {items.map((item) => (
              <PantryItemRow
                key={item.food_id}
                item={item}
                food={foods.get(item.food_id)}
                busy={busy || !consentValid}
                onChange={(next) => void save([next])}
                onRemove={() => void remove([item.food_id], texts.removed(nameOf(item.food_id)))}
              />
            ))}
          </View>
        </Card>
      ))}
      {pantry.length > 0 ? <Body muted>{texts.stockNote}</Body> : null}

      {consentValid ? (
        <Card>
          <View style={styles.column} testID="pantry-add">
            <Heading level={2}>{texts.addTitle}</Heading>
            <TextField
              label={texts.searchLabel}
              hint={texts.searchHint}
              value={query}
              onChangeText={setQuery}
              maxLength={40}
              testID="pantry-search"
            />
            {query.trim().length > 0 && query.trim().length < 2 ? (
              <Body muted>{texts.searchShort}</Body>
            ) : null}
            {query.trim().length >= 2 && hits.length === 0 ? (
              <Body muted testID="pantry-search-none">
                {texts.searchNone}
              </Body>
            ) : null}
            {hits.map((food) => (
              <Button
                key={food.id}
                label={
                  inPantry.has(food.id) ? `${food.name_de} – ${texts.alreadyIn}` : food.name_de
                }
                accessibilityLabel={texts.addA11y(food.name_de)}
                variant="secondary"
                disabled={busy || inPantry.has(food.id)}
                onPress={() => add(food.id)}
                testID={`pantry-add-${food.id}`}
              />
            ))}
          </View>
        </Card>
      ) : null}
      {consentValid ? <PantryScanPanel foods={foods} busy={busy} onAdd={add} /> : null}

      <Button
        label={texts.toRecipes}
        variant="secondary"
        onPress={() => router.push('/rezepte/kuehlschrank' as Href)}
        testID="pantry-to-recipes"
      />
      {pantry.length > 0 ? (
        <Button
          label={texts.clearAll}
          variant="secondary"
          disabled={busy}
          onPress={() => setConfirmClear(true)}
          testID="pantry-clear"
        />
      ) : null}
      <ConfirmDialog
        visible={confirmClear}
        title={texts.clearTitle}
        message={texts.clearText}
        confirmLabel={texts.clearConfirm}
        loading={busy}
        onConfirm={() => {
          setConfirmClear(false);
          void remove(
            pantry.map((p) => p.food_id),
            texts.cleared,
          );
        }}
        onCancel={() => setConfirmClear(false)}
        testID="pantry-clear-dialog"
      />
    </>,
  );
}

const styles = StyleSheet.create({
  column: { gap: 4 },
});
