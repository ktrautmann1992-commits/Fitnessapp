import {
  type BasketItem,
  type CustomMeal,
  defaultFoodAmount,
  type Food,
  type FoodAmountUnit,
  FOOD_HOUSEHOLD_COUNT_CHOICES,
  foodAmountOptions,
  type FoodLogFavorite,
  resolveFoodAmount,
  standInBase,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, ChoiceList, Heading, TextField } from '@/components/ui';
import type { FoodLogEntryRow } from '@/data/types';
import { t } from '@/i18n';
import { amountUnitText, amountWithUnitText, portionNumber } from '@/lib/food-log-format';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { formatNumberDe } from '@/lib/nutrition-format';

/**
 * Freies Eintragen (Gründer-Rückmeldung Testphase 14.11.2026, docs/PLAN-ESSEN-FREI-EINTRAGEN.md): Schnellauswahl „Mit
 * einem Tipp“ (Favoriten und „Zuletzt gegessen“), Menge in Haushaltsmengen („2 Scheiben“) und der Korb „Deine
 * Mahlzeit“ (mehrere Lebensmittel auf einmal eintragen, als Favorit speichern). Nur Anzeige und Eingabe – Einheiten,
 * Gramm, Einträge und Namensvorschlag rechnet packages/core (`foodAmountOptions`, `resolveFoodAmount`,
 * `basketEntries`, `suggestBasketName`). Keine kcal in Knöpfen oder testIDs (Wächter E1 H7).
 */

/** Schnellauswahl oben im Eintragen-Bildschirm: ein Tipp = eingetragen (Standardportion, kein weiterer Dialog). */
export function QuickPicks({
  meals,
  favorites,
  recent,
  busy,
  favoriteTitleOf,
  recentTitleOf,
  onMeal,
  onFavorite,
  onRecent,
}: {
  /** Eigene Gerichte (z. B. „Käsebrot“), für diesen Platz sortiert. */
  meals: readonly CustomMeal[];
  /** Favoriten (Stern) aus Katalog/Rezept/Schnelleintrag, schon auf „eintragbar“ gefiltert. */
  favorites: readonly FoodLogFavorite[];
  recent: readonly FoodLogEntryRow[];
  busy: boolean;
  favoriteTitleOf: (item: FoodLogFavorite) => string;
  recentTitleOf: (item: FoodLogEntryRow) => string;
  onMeal: (meal: CustomMeal) => void;
  onFavorite: (item: FoodLogFavorite) => void;
  onRecent: (item: FoodLogEntryRow) => void;
}) {
  if (meals.length === 0 && favorites.length === 0 && recent.length === 0) return null;
  return (
    <View style={styles.block} testID="food-log-quick-picks">
      <Heading level={2}>{t.foodLog.free.quickTitle}</Heading>
      {meals.length > 0 || favorites.length > 0 ? (
        <View style={styles.block}>
          <Body muted>{t.foodLog.free.quickFavorites}</Body>
          <View style={styles.chips} testID="food-log-quick-favorites">
            {meals.map((meal, index) => (
              <View key={meal.id} style={styles.chip}>
                <Button
                  label={meal.name_de}
                  accessibilityLabel={t.foodLog.free.quickAddA11y(meal.name_de)}
                  variant="secondary"
                  icon="plus"
                  disabled={busy}
                  onPress={() => onMeal(meal)}
                  testID={`food-log-quick-meal-${index}`}
                />
              </View>
            ))}
            {favorites.map((item, index) => {
              const title = favoriteTitleOf(item);
              return (
                <View key={item.fav_key} style={styles.chip}>
                  <Button
                    label={title}
                    accessibilityLabel={t.foodLog.free.quickAddA11y(title)}
                    variant="secondary"
                    icon="plus"
                    disabled={busy}
                    onPress={() => onFavorite(item)}
                    testID={`food-log-quick-favorite-${index}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {recent.length > 0 ? (
        <View style={styles.block}>
          <Body muted>{t.foodLog.free.quickRecent}</Body>
          <View style={styles.chips} testID="food-log-quick-recent">
            {recent.map((item, index) => {
              const title = recentTitleOf(item);
              return (
                <View key={item.id} style={styles.chip}>
                  <Button
                    label={title}
                    accessibilityLabel={t.foodLog.free.quickAddA11y(title)}
                    variant="secondary"
                    icon="plus"
                    disabled={busy}
                    onPress={() => onRecent(item)}
                    testID={`food-log-quick-recent-${index}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Menge eines Lebensmittels: Einheit (Haushaltsmengen wie „Scheibe“, „Handvoll“, „Glas“ – Vorauswahl passend zum
 * Lebensmittel –, dazu g bzw. ml), Anzahl per Tipp (½, 1, 2, 3) oder Eingabe; „Eintragen“ oder „Zur Mahlzeit“.
 */
export function FoodAmountPicker({
  food,
  busy,
  onSubmit,
  onBasket,
}: {
  food: Food;
  busy: boolean;
  onSubmit: (amount: number, unit: FoodAmountUnit) => void;
  onBasket: (amount: number, unit: FoodAmountUnit) => void;
}) {
  const options = foodAmountOptions(food);
  // Ersatz für ein fehlendes Lebensmittel (core `withStandIns`): Hinweis, mit welchen Werten gerechnet wird.
  const base = standInBase(food);
  const [unit, setUnit] = useState<FoodAmountUnit>(options[0]?.unit ?? 'g');
  const [text, setText] = useState(String(defaultFoodAmount(unit)));
  const [error, setError] = useState<string>();
  const household = unit !== 'g' && unit !== 'ml';
  const amount = parseDecimal(text);
  const resolved =
    amount === null || Number.isNaN(amount) ? null : resolveFoodAmount(food, amount, unit);
  const read = (): number | null => {
    if (amount === null || Number.isNaN(amount)) {
      setError(t.foodLog.amountInvalid);
      return null;
    }
    if (resolved !== null && !resolved.ok) {
      setError(household ? t.foodLog.free.amountRange : t.foodLog.amountRange);
      return null;
    }
    setError(undefined);
    return amount;
  };
  return (
    <Card>
      <View style={styles.block} testID="food-log-amount-picker">
        <Heading level={2}>{food.name_de}</Heading>
        {base !== null ? (
          <Body muted testID="food-log-stand-in">
            {t.foodLog.free.standInNote(base.name_de)}
          </Body>
        ) : null}
        {options.length > 1 ? (
          <ChoiceList
            label={t.foodLog.unitLabel}
            horizontal
            options={options.map((option) => ({
              value: option.unit,
              label: amountUnitText(option.unit),
              testID: `food-log-unit-${option.unit}`,
            }))}
            value={unit}
            onChange={(next) => {
              setUnit(next);
              setText(String(defaultFoodAmount(next)));
              setError(undefined);
            }}
          />
        ) : null}
        {household ? (
          <ChoiceList
            label={t.foodLog.free.countLabel}
            horizontal
            options={FOOD_HOUSEHOLD_COUNT_CHOICES.map((value) => ({
              value,
              label: portionNumber(value),
              accessibilityLabel: amountWithUnitText(value, unit),
              testID: `food-log-count-${String(value).replace('.', '-')}`,
            }))}
            value={amount}
            onChange={(next) => {
              setText(formatDecimal(next));
              setError(undefined);
            }}
          />
        ) : null}
        <TextField
          label={`${t.foodLog.amountLabel} (${amountUnitText(unit, amount ?? 1)})`}
          value={text}
          onChangeText={(next) => {
            setText(next);
            setError(undefined);
          }}
          keyboardType="decimal-pad"
          error={error}
          maxLength={7}
          testID="food-log-amount"
        />
        {household && resolved?.ok === true ? (
          <Body muted testID="food-log-amount-grams">
            {t.foodLog.free.gramsHint(formatNumberDe(Math.round(resolved.grams)))}
          </Body>
        ) : null}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Button
              label={t.foodLog.addThis}
              accessibilityLabel={t.foodLog.addThisA11y(food.name_de)}
              loading={busy}
              onPress={() => {
                const value = read();
                if (value !== null) onSubmit(value, unit);
              }}
              testID="food-log-food-add"
            />
          </View>
          <View style={styles.rowItem}>
            <Button
              label={t.foodLog.free.addToBasket}
              accessibilityLabel={t.foodLog.free.addToBasketA11y(food.name_de)}
              variant="secondary"
              icon="plus"
              disabled={busy}
              onPress={() => {
                const value = read();
                if (value !== null) onBasket(value, unit);
              }}
              testID="food-log-food-basket"
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

export interface BasketRow {
  readonly item: BasketItem;
  readonly title: string;
}

/**
 * Korb „Deine Mahlzeit“: Lebensmittel mit Menge, Entfernen, „Alle … eintragen“ (je Lebensmittel ein Eintrag) und
 * „Als Favorit speichern“ (Name vorgeschlagen, änderbar) – als eigenes Gericht „Aus Zutaten“.
 */
export function BasketCard({
  rows,
  suggestedName,
  saved,
  favoriteSaved,
  busy,
  onRemove,
  onSubmit,
  onFavorite,
  onClear,
}: {
  rows: readonly BasketRow[];
  suggestedName: string;
  /** Schon eingetragen – dann nur noch Favorit speichern oder neu beginnen. */
  saved: boolean;
  favoriteSaved: boolean;
  busy: boolean;
  onRemove: (index: number) => void;
  onSubmit: () => void;
  onFavorite: (name: string) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const shownName = name ?? suggestedName;
  return (
    <Card>
      <View style={styles.block} testID="food-log-basket">
        <Heading level={2}>{t.foodLog.free.basketTitle}</Heading>
        {rows.map(({ item, title }, index) => (
          <View key={`${item.food_id}-${item.unit}`} style={styles.basketRow}>
            <View style={styles.basketText}>
              <Body testID={`food-log-basket-item-${index}`}>
                {`${amountWithUnitText(item.amount, item.unit)} ${title}`}
              </Body>
            </View>
            {saved ? null : (
              <Button
                label={t.foodLog.free.basketRemove}
                accessibilityLabel={t.foodLog.free.basketRemoveA11y(title)}
                variant="link"
                disabled={busy}
                onPress={() => onRemove(index)}
                testID={`food-log-basket-remove-${index}`}
              />
            )}
          </View>
        ))}
        {saved ? null : (
          <>
            <Body muted>{t.foodLog.free.basketHint}</Body>
            <Button
              label={t.foodLog.free.basketSubmit(rows.length)}
              loading={busy}
              onPress={onSubmit}
              testID="food-log-basket-submit"
            />
          </>
        )}
        {favoriteSaved ? null : (
          <>
            <TextField
              label={t.foodLog.free.favoriteName}
              value={shownName}
              onChangeText={setName}
              maxLength={60}
              testID="food-log-basket-name"
            />
            <Button
              label={t.foodLog.free.favoriteSave}
              variant="secondary"
              icon="heart"
              disabled={busy}
              onPress={() => onFavorite(shownName)}
              testID="food-log-basket-favorite"
            />
          </>
        )}
        {saved ? (
          <Button
            label={t.foodLog.free.newMeal}
            variant="link"
            disabled={busy}
            onPress={() => {
              setName(null);
              onClear();
            }}
            testID="food-log-basket-new"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexGrow: 1, flexBasis: 150, maxWidth: '100%' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowItem: { flexGrow: 1, flexBasis: 150 },
  basketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  basketText: { flex: 1 },
});
