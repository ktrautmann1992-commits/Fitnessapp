import {
  addDays,
  isoDateSchema,
  mealPlanWeekEditable,
  parseShoppingQuantity,
  planlessShoppingList,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  type ShoppingListItem,
  shoppingItemOutsideProfileDiet,
  type ShoppingListRecipe,
  shoppingRecipeOutsideProfileDiet,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { ShoppingScanPanel } from '@/components/shopping-scan';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  ErrorState,
  Heading,
  LoadingState,
  MIN_TOUCH,
  Notice,
  TextField,
} from '@/components/ui';
import { storedShoppingListRow } from '@/data/meal-plan-rows';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { shoppingCategoryLabel, shoppingItemText } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import {
  type ShoppingActionOutcome,
  useNutritionWeek,
  useShoppingListActions,
} from '@/state/use-nutrition';

/**
 * Reiter „Einkaufen“ (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Entscheidung EA-G1 vom 20.10.2026): die Einkaufsliste
 * als eigener Knopf in der Menüleiste – Adresse bleibt `/einkaufsliste` (Deep-Links, Vorschau-Links); Drucken und
 * Weitergeben bleiben Unterseiten im Stapel. Neu: „Im Laden scannen“ (components/shopping-scan.tsx), eigene Artikel mit
 * Menge, „Alle Haken zurücksetzen“ und Einkaufen ohne Essensplan (EA-2: nur eigene Artikel, `planlessShoppingList`).
 *
 * Einkaufsliste (docs/PLAN-PHASE-5.md 6.5, 8.2 Nr. 5, Etappe N5b): Abteilungen, Häkchen (gehen ohne Netz und bleiben
 * nach dem Neuladen), „Erledigte ausblenden“, Vorrat eingeklappt, eigene Einträge, Zeitraum wählen, über „Zur
 * Einkaufsliste“ hinzugefügte Rezepte, Markierungen „Menge geändert“/„nicht mehr im Plan“ nach einer Neuplanung
 * (W22). Laufende und nächste Woche. Rechnet nichts selbst – alles aus packages/core (shopping-list-store.ts).
 * Keine kcal, keine Gründe (Unverträglichkeiten stehen nirgends). Etappe N6: „Als PDF speichern“ (PDF P5); Etappe N12:
 * „Weitergeben“ (einkaufsliste/weitergeben.tsx).
 */
export default function ShoppingTabScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ woche?: string }>();
  const navigation = useNavigation();
  const [weekChoice, setWeekChoice] = useState<string | null>(() =>
    isoDateSchema.safeParse(params.woche).success ? startOfIsoWeek(params.woche as string) : null,
  );
  // Reiter bleibt geladen: Eine Woche über die Adresse (`?woche=`, z. B. aus Rezept oder Meal-Prep) gilt sofort.
  const wocheParam = params.woche;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Adresse → angezeigte Woche (kein Folge-Render-Zyklus)
    setWeekChoice(
      isoDateSchema.safeParse(wocheParam).success ? startOfIsoWeek(wocheParam as string) : null,
    );
  }, [wocheParam]);
  // Reiter „Einkaufen“ antippen springt auf die laufende Woche (wie „Ernährung“ auf heute).
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        setWeekChoice(null);
        router.setParams({ woche: undefined });
      }),
    [navigation, router],
  );
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  // Nur laufende und nächste Woche (wie der Plan); nach Mitternacht ggf. automatisch die neue Woche (K5).
  const weekStart =
    weekChoice !== null && mealPlanWeekEditable(weekChoice, today) ? weekChoice : currentWeek;
  const view = useNutritionWeek(weekStart);
  // Einkaufen ohne Essensplan (EA-2): Angaben fehlen, Ernährung nicht eingerichtet oder kein Bestand → Liste der Woche
  // nur mit eigenen Artikeln. Eine gespeicherte Liste mit Gesundheitsbezug nur mit gültiger Einwilligung (Art. 9).
  const noPlan =
    view.library.kind !== 'unsupported' &&
    (view.setupMissing ||
      view.week?.kind === 'incomplete' ||
      (view.week?.kind === 'ready' && view.week.plan === null));
  const rows = app.rows;
  const planlessList = useMemo(() => {
    if (!noPlan || rows === null) return null;
    const row = storedShoppingListRow(rows, weekStart);
    const usable =
      row !== null && (!row.uses_health_data || healthConsentStatus(rows, app.versions) === 'valid')
        ? row.list
        : null;
    return planlessShoppingList(usable, weekStart);
  }, [app.versions, noPlan, rows, weekStart]);
  const actions = useShoppingListActions(noPlan ? null : view.week, planlessList);
  const [hideChecked, setHideChecked] = useState(false);
  const [showPantry, setShowPantry] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [category, setCategory] = useState<ShoppingCategory>('other');
  const [labelError, setLabelError] = useState<string>();
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
  const texts = t.nutrition.shopping;
  // Reiter: keine „Zurück“-Leiste (die Menüleiste führt weiter).
  const shell = (children: ReactNode) => (
    <Screen title={texts.tabTitle} testID="shopping-list">
      {children}
    </Screen>
  );

  if (view.library.kind === 'unsupported') {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error') {
    return shell(
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />,
    );
  }
  if (!noPlan && (view.library.kind !== 'ready' || view.week === null)) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (!noPlan && view.week?.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (!noPlan && view.week?.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }
  const demo = view.library.kind === 'ready' && view.library.result.demo;
  const resolved = !noPlan && view.week?.kind === 'ready' ? view.week : null;
  const shopping = resolved?.shopping ?? null;
  const weekSwitch = (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Button
          label={t.nutrition.week.thisWeek}
          variant={weekStart === currentWeek ? 'primary' : 'secondary'}
          onPress={() => {
            setMessage(null);
            setRangeOpen(false);
            setWeekChoice(currentWeek);
          }}
          testID="shopping-week-current"
        />
      </View>
      <View style={styles.flex}>
        <Button
          label={t.nutrition.week.nextWeek}
          variant={weekStart !== currentWeek ? 'primary' : 'secondary'}
          onPress={() => {
            setMessage(null);
            setRangeOpen(false);
            setWeekChoice(addDays(currentWeek, 7));
          }}
          testID="shopping-week-next"
        />
      </View>
    </View>
  );
  const shownList = shopping?.list ?? planlessList;
  if (shownList === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  const list = shownList;
  const library = view.library.kind === 'ready' ? view.library.result.library : null;
  const recipes = library?.recipes ?? [];
  const recipeTitle = (id: string) => recipes.find((r) => r.id === id)?.title_de ?? id;
  // Kennzeichnung für Zutaten aus Treffern der erweiterten Suche (19.6 K3/G4, Etappe N5c).
  const profileDiet = resolved?.planState?.input.profile.diet ?? null;
  const foods = library?.foods ?? null;
  const outsideDiet = (item: ShoppingListItem) =>
    profileDiet !== null &&
    foods !== null &&
    shoppingItemOutsideProfileDiet(item, foods, profileDiet) !== null;
  const recipeOutside = (entry: ShoppingListRecipe) =>
    profileDiet === null ? null : shoppingRecipeOutsideProfileDiet(entry, profileDiet);
  const days = Array.from({ length: 7 }, (_, i) => addDays(list.weekStart, i));
  const dayChoices = days.map((d) => ({ value: d, label: dayLabel(d) }));
  const visible = (item: ShoppingListItem) => !hideChecked || !item.checked;
  const regular = list.items.filter((i) => !i.isPantry);
  const pantry = list.items.filter((i) => i.isPantry);
  const groups = SHOPPING_CATEGORIES.map((c) => ({
    category: c,
    items: regular.filter((i) => i.category === c && visible(i)),
  })).filter((g) => g.items.length > 0);
  const nothingToBuy = list.items.length === 0;
  const allDone = !nothingToBuy && list.items.every((i) => i.checked);

  async function run(key: string, action: () => Promise<ShoppingActionOutcome>) {
    setBusy(key);
    setMessage(null);
    try {
      const outcome = await action();
      if (outcome.kind === 'failed') {
        setMessage({ text: texts.failed[outcome.reason], tone: 'danger' });
      } else if (outcome.kind === 'invalid') {
        setMessage({ text: outcome.message || texts.saveFailed, tone: 'danger' });
      }
      return outcome;
    } catch {
      setMessage({ text: texts.saveFailed, tone: 'danger' });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function addManual() {
    if (!actions) return;
    if (label.trim().length === 0) {
      setLabelError(texts.addEmpty);
      return;
    }
    setLabelError(undefined);
    const parsed = parseShoppingQuantity(quantity);
    if (!parsed.ok) {
      setQuantityError(texts.quantityInvalid);
      return;
    }
    setQuantityError(undefined);
    const amount =
      parsed.amount !== null && parsed.unit !== null
        ? { amount: parsed.amount, unit: parsed.unit }
        : null;
    const outcome = await run('add', () => actions.addManual(label, category, amount));
    if (outcome?.kind === 'ok') {
      setLabel('');
      setQuantity('');
    }
    if (outcome?.kind === 'invalid') setLabelError(outcome.message || texts.saveFailed);
  }

  async function uncheckAll() {
    if (!actions) return;
    const outcome = await run('reset', () => actions.uncheckAll());
    setConfirmReset(false);
    if (outcome?.kind === 'ok') setMessage({ text: texts.uncheckAllDone, tone: 'success' });
  }
  const anyChecked = list.items.some((i) => i.checked);

  async function applyRange() {
    if (!actions) return;
    const from = draftFrom ?? list.from;
    const to = draftTo ?? list.to;
    if (from > to) {
      setMessage({ text: texts.rangeInvalid, tone: 'danger' });
      return;
    }
    const outcome = await run('range', () => actions.setRange(from, to));
    if (outcome?.kind === 'ok') setRangeOpen(false);
  }

  const itemRow = (item: ShoppingListItem) => (
    <ShoppingItemRow
      key={item.itemKey}
      item={item}
      outsideDiet={outsideDiet(item)}
      disabled={actions === null || busy !== null}
      onToggle={(checked) =>
        actions
          ? void run(`tick-${item.itemKey}`, () => actions.toggle(item.itemKey, checked))
          : undefined
      }
      onRemove={
        item.isManual && actions
          ? () => void run(`remove-${item.itemKey}`, () => actions.removeManual(item.itemKey))
          : undefined
      }
    />
  );

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      {weekSwitch}
      <Heading level={2}>
        <Text testID="shopping-range">
          {texts.range(formatDateDe(list.from), formatDateDe(list.to))}
        </Text>
      </Heading>
      {shopping === null ? (
        <Notice tone="info" testID="shopping-planless">
          <Body>{texts.planless}</Body>
          {view.setupMissing ? (
            <Button
              label={t.nutrition.setupButton}
              variant="secondary"
              onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
              testID="nutrition-setup"
            />
          ) : null}
        </Notice>
      ) : null}
      {/* Bis „Verstanden“ beim Plan (6.6): Plan und Liste wurden im selben Schritt angepasst (W22). */}
      {resolved?.planState?.autoAdjusted === true ||
      (shopping?.action === 'rebuilt' && shopping.planChanged) ? (
        <Notice tone="info" testID="shopping-adjusted">
          {texts.adjusted}
        </Notice>
      ) : null}
      {actions === null ? <Body muted>{texts.readOnly}</Body> : null}
      <Body muted testID="shopping-offline">
        {texts.offline}
      </Body>
      {view.saveFailed ? (
        <Notice tone="warning" testID="shopping-save-failed">
          <Body>{t.nutrition.plan.saveFailed}</Body>
          <Button label={t.nutrition.retrySave} variant="secondary" onPress={view.retrySave} />
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="shopping-message">
          {message.text}
        </Notice>
      ) : null}

      {actions ? (
        <ShoppingScanPanel actions={actions} foods={foods} disabled={busy !== null} />
      ) : null}

      {actions && !actions.planless ? (
        <Card>
          <Button
            label={texts.rangeTitle}
            variant="secondary"
            onPress={() => {
              setDraftFrom(list.from);
              setDraftTo(list.to);
              setRangeOpen((open) => !open);
            }}
            testID="shopping-range-toggle"
          />
          {rangeOpen ? (
            <View style={styles.list} testID="shopping-range-picker">
              <ChoiceList
                label={texts.rangeFrom}
                options={dayChoices}
                value={draftFrom ?? list.from}
                onChange={setDraftFrom}
                horizontal
              />
              <ChoiceList
                label={texts.rangeTo}
                options={dayChoices}
                value={draftTo ?? list.to}
                onChange={setDraftTo}
                horizontal
              />
              <Body muted>{texts.rangeHint}</Body>
              <Button
                label={texts.rangeApply}
                loading={busy === 'range'}
                onPress={() => void applyRange()}
                testID="shopping-range-apply"
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Etappe N12: als Text weitergeben (System-Teilen-Dialog bzw. Kopieren), Hinweis vorher wie K4. */}
      <Button
        label={t.nutrition.share.open}
        accessibilityHint={t.nutrition.share.openHint}
        onPress={() => router.push(`/einkaufsliste/weitergeben?woche=${list.weekStart}` as Href)}
        testID="shopping-share"
      />
      {/* PDF P5 (11, Etappe N6): Druckansicht mit Kästchen; Hinweis-Dialog bei Gesundheitsbezug. */}
      <Button
        label={t.nutrition.printView.button}
        variant="secondary"
        accessibilityHint={t.nutrition.printView.listHint}
        onPress={() => router.push(`/einkaufsliste/drucken?woche=${list.weekStart}` as Href)}
        testID="shopping-print"
      />
      {actions && anyChecked ? (
        <Button
          label={texts.uncheckAll}
          variant="secondary"
          onPress={() => setConfirmReset(true)}
          testID="shopping-uncheck-all"
        />
      ) : null}
      <ConfirmDialog
        visible={confirmReset}
        title={texts.uncheckAllTitle}
        message={texts.uncheckAllText}
        confirmLabel={texts.uncheckAllConfirm}
        confirmVariant="primary"
        loading={busy === 'reset'}
        onConfirm={() => void uncheckAll()}
        onCancel={() => setConfirmReset(false)}
        testID="shopping-uncheck-all-dialog"
      />
      <Checkbox
        label={texts.hideChecked}
        checked={hideChecked}
        onChange={setHideChecked}
        testID="shopping-hide-checked"
      />

      {nothingToBuy ? (
        <Body muted testID="shopping-empty">
          {texts.empty}
        </Body>
      ) : null}
      {allDone ? (
        <Notice tone="success" testID="shopping-all-done">
          {texts.allChecked}
        </Notice>
      ) : null}

      <View style={styles.list} testID="shopping-items">
        {groups.map((group) => (
          <View key={group.category} style={styles.list}>
            <Heading level={2}>{shoppingCategoryLabel(group.category)}</Heading>
            {group.items.map(itemRow)}
          </View>
        ))}
      </View>

      {pantry.length > 0 ? (
        <Card>
          <Heading level={2}>{texts.pantry}</Heading>
          <Button
            label={showPantry ? texts.pantryHide : texts.pantryShow(pantry.length)}
            variant="secondary"
            onPress={() => setShowPantry((v) => !v)}
            testID="shopping-pantry-toggle"
          />
          {showPantry ? (
            <View style={styles.list} testID="shopping-pantry">
              {pantry.filter(visible).map(itemRow)}
            </View>
          ) : null}
        </Card>
      ) : null}

      {list.recipes.length > 0 ? (
        <Card>
          <Heading level={2}>{texts.recipesTitle}</Heading>
          <View style={styles.list} testID="shopping-recipes">
            {list.recipes.map((entry) => (
              <View key={entry.recipeId} style={styles.list}>
                <Body>{texts.recipeLine(recipeTitle(entry.recipeId), entry.servings)}</Body>
                {recipeOutside(entry) !== null ? (
                  <Body muted testID={`shopping-recipe-outside-${entry.recipeId}`}>
                    {t.nutrition.search.outsideDiet(
                      t.nutrition.dietNames[recipeOutside(entry) ?? 'omnivore'],
                    )}
                  </Body>
                ) : null}
                {actions ? (
                  <Button
                    label={texts.removeRecipe(recipeTitle(entry.recipeId))}
                    variant="secondary"
                    loading={busy === `recipe-${entry.recipeId}`}
                    onPress={() =>
                      void run(`recipe-${entry.recipeId}`, () =>
                        actions.removeRecipe(entry.recipeId),
                      )
                    }
                    testID={`shopping-recipe-remove-${entry.recipeId}`}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {actions ? (
        <Card>
          <Heading level={2}>{texts.addTitle}</Heading>
          <TextField
            label={texts.addLabel}
            value={label}
            onChangeText={setLabel}
            error={labelError}
            hint={texts.addHint}
            maxLength={80}
            testID="shopping-add-label"
            onSubmitEditing={() => void addManual()}
          />
          <TextField
            label={texts.quantityLabel}
            value={quantity}
            onChangeText={setQuantity}
            error={quantityError}
            hint={texts.quantityHint}
            maxLength={30}
            testID="shopping-add-quantity"
            onSubmitEditing={() => void addManual()}
          />
          <ChoiceList
            label={texts.addCategory}
            options={SHOPPING_CATEGORIES.map((c) => ({
              value: c,
              label: shoppingCategoryLabel(c),
            }))}
            value={category}
            onChange={setCategory}
            horizontal
          />
          <Button
            label={texts.add}
            loading={busy === 'add'}
            onPress={() => void addManual()}
            testID="shopping-add"
          />
        </Card>
      ) : null}
      <Body muted>{texts.healthNote}</Body>
    </>,
  );
}

/** Ein Eintrag: Häkchen (großes Tippziel), Markierungen, bei eigenen Einträgen „löschen“. */
function ShoppingItemRow({
  item,
  outsideDiet,
  disabled,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  outsideDiet: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onRemove: (() => void) | undefined;
}) {
  const theme = useThemeColors();
  const texts = t.nutrition.shopping;
  const text = shoppingItemText(item);
  const marks = [
    item.notInPlan ? texts.notInPlan : null,
    item.amountChanged ? texts.amountChanged : null,
    item.isManual ? texts.manual : null,
    outsideDiet ? texts.outsideDiet : null,
  ].filter((m): m is string => m !== null);
  return (
    <View
      style={[styles.item, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={`shopping-item-${item.itemKey}`}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={texts.checkA11y(text)}
        accessibilityState={{ checked: item.checked, disabled }}
        aria-checked={item.checked}
        disabled={disabled}
        onPress={() => onToggle(!item.checked)}
        style={styles.itemMain}
        testID={`shopping-check-${item.itemKey}`}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: item.checked ? theme.primary : theme.textMuted,
              backgroundColor: item.checked ? theme.primary : theme.surface,
            },
          ]}
        >
          {item.checked ? <Text style={[styles.mark, { color: theme.primaryText }]}>✓</Text> : null}
        </View>
        <View style={styles.flex}>
          <Text
            style={[
              styles.itemText,
              { color: item.checked ? theme.textMuted : theme.text },
              item.checked && styles.done,
            ]}
          >
            {text}
          </Text>
          {marks.length > 0 ? (
            <Text style={[styles.itemMarks, { color: theme.textMuted }]}>{marks.join(' · ')}</Text>
          ) : null}
        </View>
      </Pressable>
      {onRemove ? (
        <Button
          label="✕"
          accessibilityLabel={texts.removeManual(item.labelDe)}
          variant="secondary"
          onPress={onRemove}
          disabled={disabled}
          testID={`shopping-remove-${item.itemKey}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  itemMain: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  itemText: { fontSize: fontSize.md },
  done: { textDecorationLine: 'line-through' },
  itemMarks: { fontSize: fontSize.sm },
});
