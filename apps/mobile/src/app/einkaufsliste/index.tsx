import {
  addDays,
  isoDateSchema,
  mealPlanWeekEditable,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  type ShoppingListItem,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
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
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { shoppingCategoryLabel, shoppingItemText } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import {
  type ShoppingActionOutcome,
  useNutritionWeek,
  useShoppingListActions,
} from '@/state/use-nutrition';

/**
 * Einkaufsliste (docs/PLAN-PHASE-5.md 6.5, 8.2 Nr. 5, Etappe N5b): Abteilungen, Häkchen (gehen ohne Netz und bleiben
 * nach dem Neuladen), „Erledigte ausblenden“, Vorrat eingeklappt, eigene Einträge, Zeitraum wählen, über „Zur
 * Einkaufsliste“ hinzugefügte Rezepte, Markierungen „Menge geändert“/„nicht mehr im Plan“ nach einer Neuplanung
 * (W22). Laufende und nächste Woche. Rechnet nichts selbst – alles aus packages/core (shopping-list-store.ts).
 * Keine kcal, keine Gründe (Unverträglichkeiten stehen nirgends).
 */
export default function ShoppingListScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ woche?: string }>();
  const [requested] = useState(() =>
    isoDateSchema.safeParse(params.woche).success ? startOfIsoWeek(params.woche as string) : null,
  );
  const [weekChoice, setWeekChoice] = useState<string | null>(requested);
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  // Nur laufende und nächste Woche (wie der Plan); nach Mitternacht ggf. automatisch die neue Woche (K5).
  const weekStart =
    weekChoice !== null && mealPlanWeekEditable(weekChoice, today) ? weekChoice : currentWeek;
  const view = useNutritionWeek(weekStart);
  const actions = useShoppingListActions(view.week);
  const [hideChecked, setHideChecked] = useState(false);
  const [showPantry, setShowPantry] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [label, setLabel] = useState('');
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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.nutrition.shopping;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={texts.title} testID="shopping-list" footer={footer}>
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
  if (view.setupMissing) {
    return shell(
      <Card>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
          testID="nutrition-setup"
        />
      </Card>,
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  if (view.week.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }
  const { demo } = view.library.result;
  const shopping = view.week.shopping;
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
  if (view.week.plan === null || shopping === null) {
    return shell(
      <>
        {weekSwitch}
        <Card>
          <Body testID="shopping-no-plan">{texts.noPlan}</Body>
          <Button
            label={t.nutrition.title}
            variant="secondary"
            onPress={() => router.push('/ernaehrung' as Href)}
          />
        </Card>
      </>,
    );
  }

  const list = shopping.list;
  const recipes = view.library.result.library.recipes;
  const recipeTitle = (id: string) => recipes.find((r) => r.id === id)?.title_de ?? id;
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
    const outcome = await run('add', () => actions.addManual(label, category));
    if (outcome?.kind === 'ok') setLabel('');
    if (outcome?.kind === 'invalid') setLabelError(outcome.message || texts.saveFailed);
  }

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
      {/* Bis „Verstanden“ beim Plan (6.6): Plan und Liste wurden im selben Schritt angepasst (W22). */}
      {view.week.planState?.autoAdjusted === true ||
      (shopping.action === 'rebuilt' && shopping.planChanged) ? (
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
  disabled,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
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
