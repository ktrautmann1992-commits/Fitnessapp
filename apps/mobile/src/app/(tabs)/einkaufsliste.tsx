import {
  addDays,
  isoDateSchema,
  mealPlanWeekEditable,
  type PantryItem,
  pantryAfterShopping,
  type PantryShoppingStatus,
  parseShoppingQuantity,
  planlessShoppingList,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  shoppingDefaultRange,
  type ShoppingDepartment,
  shoppingDepartments,
  type ShoppingListItem,
  shoppingItemOutsideProfileDiet,
  shoppingItemRecipeIds,
  shoppingListProgress,
  type ShoppingListRecipe,
  shoppingPantryView,
  shoppingPurchase,
  type ShoppingRangeMode,
  shoppingRangeIsAutomatic,
  shoppingRecipeOutsideProfileDiet,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { areaColors, fontSize, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaProgress, HeroSurface, Icon, type IconName, useAreaColors } from '@/components/design';
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
import { errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { appFont } from '@/lib/fonts';
import { formatAmount, shoppingCategoryLabel, shoppingItemText } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { setShoppingWeekManual, updateShoppingPrefs, useShoppingPrefs } from '@/lib/shopping-prefs';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import {
  type ShoppingActionOutcome,
  useNutritionWeek,
  useShoppingListActions,
} from '@/state/use-nutrition';
import { Text } from '@/components/text';

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
  // „Erledigte ausblenden“ (Standard: an) und zugeklappte Abteilungen merkt sich das Gerät (23.10.2026).
  const prefs = useShoppingPrefs();
  const hideChecked = prefs.hideChecked;
  // Ganz erledigte Abteilungen klappen von selbst zu; aufgeklappt bleiben sie nur in dieser Sitzung.
  const [openDone, setOpenDone] = useState<ReadonlySet<ShoppingCategory>>(() => new Set());
  // „x erledigt – anzeigen“ je Abteilung (nur diese Sitzung).
  const [showDoneIn, setShowDoneIn] = useState<ReadonlySet<ShoppingCategory>>(() => new Set());
  const theme = useThemeColors();
  const [showPantry, setShowPantry] = useState(false);
  const [showInPantry, setShowInPantry] = useState(false);
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
    <Screen area="einkaufen" icon="cart" title={texts.tabTitle} testID="shopping-list">
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
  // Wofür gebraucht (zweite Zeile „für Hähnchen-Bowl, Curry +1“) – Regeln in packages/core, nur Anzeige.
  const recipeIds =
    foods === null
      ? new Map<string, readonly string[]>()
      : shoppingItemRecipeIds(
          resolved?.plan ?? null,
          foods,
          { from: list.from, to: list.to },
          list.recipes.map((entry) => ({
            recipeId: entry.recipeId,
            foodIds:
              recipes.find((r) => r.id === entry.recipeId)?.ingredients.map((i) => i.food_id) ?? [],
          })),
        );
  const usedFor = (item: ShoppingListItem): string | null => {
    const ids = item.foodId === null ? undefined : recipeIds.get(item.foodId);
    if (ids === undefined || ids.length === 0) return null;
    // Gleich lautende Rezepte (z. B. vegetarische Fassung) nur einmal nennen.
    const titles = [...new Set(ids.map(recipeTitle))];
    return texts.forRecipes(titles.slice(0, 2), titles.length - 2);
  };
  const days = Array.from({ length: 7 }, (_, i) => addDays(list.weekStart, i));
  const dayChoices = days.map((d) => ({ value: d, label: dayLabel(d) }));
  const visible = (item: ShoppingListItem) => !hideChecked || !item.checked;
  // Vorratsschrank (25.10.2026): was laut Vorrat reicht, steht unter „Schon im Vorrat“; Restmengen und „fast leer“
  // bleiben auf der Liste. Reine Anzeige (packages/core `shoppingPantryView`) – Häkchen und Mengen der Liste bleiben.
  const consentOk = healthConsentStatus(app.rows, app.versions) === 'valid';
  const pantryItems: PantryItem[] = consentOk
    ? app.rows.pantryItems.map((p) => ({
        food_id: p.food_id,
        count: p.count,
        pack_size: p.pack_size,
        low: p.low,
      }))
    : [];
  const pantryView = shoppingPantryView(
    list.items,
    pantryItems,
    (id) => foods?.get(id)?.units.piece_g,
  );
  const pantryStatus = new Map(pantryView.toBuy.map((line) => [line.item.itemKey, line.status]));
  const buyItems = pantryView.toBuy.map((line) => line.display);
  const pantry = buyItems.filter((i) => i.isPantry);
  const departments = shoppingDepartments(buyItems);
  // Eigener Zeitraum: auf diesem Gerät gewählt oder kein automatischer Zeitraum (`shoppingRangeIsAutomatic`).
  const customRange =
    prefs.manualWeeks.includes(list.weekStart) || !shoppingRangeIsAutomatic(list.weekStart, list);
  const rangeControls = actions !== null && !actions.planless;
  const nothingToBuy = list.items.length === 0;
  const allDone = !nothingToBuy && buyItems.every((i) => i.checked);

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
  const progress = shoppingListProgress(buyItems);
  // Kennzeile auf der dunklen Hero-Fläche: Türkis der Dunkel-Palette (≥ 4,5 : 1, tokens.test.ts).
  const heroAccent = areaColors.dark.einkaufen.icon;

  async function applyRange() {
    if (!actions) return;
    const from = draftFrom ?? list.from;
    const to = draftTo ?? list.to;
    if (from > to) {
      setMessage({ text: texts.rangeInvalid, tone: 'danger' });
      return;
    }
    // Erst merken, dann speichern: sonst stellte der automatische Zeitraum die Liste sofort wieder um.
    const wasManual = prefs.manualWeeks.includes(list.weekStart);
    setShoppingWeekManual(list.weekStart, true, today);
    const outcome = await run('range', () => actions.setRange(from, to));
    if (outcome?.kind === 'ok') setRangeOpen(false);
    else if (!wasManual) setShoppingWeekManual(list.weekStart, false, today);
  }

  /** „3 Tage | Ganze Woche“: Wahl merken; die Liste stellt sich dann selbst um (Häkchen bleiben über `item_key`). */
  async function chooseMode(mode: ShoppingRangeMode) {
    if (!actions) return;
    setRangeOpen(false);
    updateShoppingPrefs(() => ({ mode }));
    setShoppingWeekManual(list.weekStart, false, today);
    // Ein selbst gewählter Zeitraum, der nicht automatisch aussieht, wird ausdrücklich umgestellt.
    if (!shoppingRangeIsAutomatic(list.weekStart, list)) {
      const range = shoppingDefaultRange(list.weekStart, today, mode);
      await run('mode', () => actions.setRange(range.from, range.to));
    }
  }

  function toggleDepartment(department: ShoppingDepartment) {
    const c = department.category;
    if (department.done) {
      setOpenDone((current) => toggled(current, c));
      return;
    }
    updateShoppingPrefs((p) => ({
      collapsed: p.collapsed.includes(c) ? p.collapsed.filter((x) => x !== c) : [...p.collapsed, c],
    }));
  }

  async function updatePantryAfterShopping() {
    if (foods === null) return;
    const result = pantryAfterShopping(pantryItems, list.items, foods);
    const changed = new Set([...result.added, ...result.updated]);
    setBusy('pantry');
    setMessage(null);
    try {
      if (changed.size > 0) {
        await app.savePantryItems(result.items.filter((i) => changed.has(i.food_id)));
      }
      setMessage({
        text: [
          t.pantry.shopping.updated(
            result.added.length,
            result.updated.length,
            result.skippedFresh.length,
          ),
          result.skippedFull.length > 0 ? t.pantry.shopping.full : null,
        ]
          .filter(Boolean)
          .join(' '),
        tone: 'success',
      });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  const itemRow = (item: ShoppingListItem) => (
    <ShoppingItemRow
      key={item.itemKey}
      item={item}
      pantryStatus={pantryStatus.get(item.itemKey) ?? 'buy'}
      usedFor={usedFor(item)}
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
      {/* Design 23.10.2026: Kopf als dunkle Hero-Karte in Einkaufs-Türkis mit Fortschritt der Liste. */}
      <HeroSurface area="einkaufen" testID="shopping-hero">
        <View style={styles.heroEyebrow}>
          <Icon name="cart" size={16} color={heroAccent} strokeWidth={2.2} />
          <Text style={[styles.heroEyebrowText, appFont('bold'), { color: heroAccent }]}>
            {texts.title}
          </Text>
        </View>
        <Heading level={2}>
          <Text testID="shopping-range">
            {texts.range(formatDateDe(list.from), formatDateDe(list.to))}
          </Text>
        </Heading>
        {progress.total > 0 ? (
          <>
            <Body muted testID="shopping-progress">
              {texts.progress(progress.checked, progress.total)}
            </Body>
            <AreaProgress
              area="einkaufen"
              current={progress.checked}
              total={progress.total}
              accessibilityLabel={texts.progress(progress.checked, progress.total)}
            />
          </>
        ) : null}
      </HeroSurface>
      {rangeControls ? (
        <ChoiceList
          label={texts.rangeModeLabel}
          options={[
            {
              value: 'days' as const,
              label: texts.rangeDays,
              accessibilityLabel: texts.rangeDaysA11y,
              testID: 'shopping-range-days',
            },
            {
              value: 'week' as const,
              label: texts.rangeWeek,
              accessibilityLabel: texts.rangeWeekA11y,
              testID: 'shopping-range-week',
            },
          ]}
          value={customRange ? null : prefs.mode}
          onChange={(mode) => void chooseMode(mode)}
          horizontal
        />
      ) : null}
      {rangeControls ? (
        <View style={styles.list}>
          {/* „Eigener Zeitraum“ als schlichter Link – die Wahl „3 Tage | Ganze Woche“ steht oben. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: rangeOpen }}
            aria-expanded={rangeOpen}
            onPress={() => {
              setDraftFrom(list.from);
              setDraftTo(list.to);
              setRangeOpen((open) => !open);
            }}
            style={styles.doneLink}
            testID="shopping-range-toggle"
          >
            <Text style={[styles.rangeLinkText, { color: theme.text }]}>
              {customRange ? texts.rangeCustomActive : texts.rangeCustom}
            </Text>
          </Pressable>
          {rangeOpen ? (
            <Card>
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
            </Card>
          ) : null}
        </View>
      ) : null}
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

      <Checkbox
        label={texts.hideChecked}
        checked={hideChecked}
        onChange={(value) => updateShoppingPrefs(() => ({ hideChecked: value }))}
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

      <View style={styles.departments} testID="shopping-items">
        {departments.map((department) => {
          const c = department.category;
          const expanded = department.done ? openDone.has(c) : !prefs.collapsed.includes(c);
          const showDone = !hideChecked || showDoneIn.has(c);
          const shown = department.items.filter((i) => showDone || !i.checked);
          return (
            <View key={c} style={styles.department} testID={`shopping-dept-${c}`}>
              <DepartmentHeader
                department={department}
                expanded={expanded}
                onPress={() => toggleDepartment(department)}
              />
              {expanded ? (
                <View testID={`shopping-dept-items-${c}`}>
                  {shown.length > 0 ? <RowGroup>{shown.map(itemRow)}</RowGroup> : null}
                  {hideChecked && department.checked > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowDoneIn((current) => toggled(current, c))}
                      style={styles.doneLink}
                      testID={`shopping-dept-show-done-${c}`}
                    >
                      <Text style={[styles.doneLinkText, { color: theme.textMuted }]}>
                        {showDoneIn.has(c) ? texts.doneHide : texts.doneShow(department.checked)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Scanner unter der Liste: zuerst kommt, was zu kaufen ist (23.10.2026). */}
      {actions ? (
        <ShoppingScanPanel
          actions={actions}
          foods={foods}
          foodsDemo={view.library.kind === 'ready' && view.library.result.demo}
          disabled={busy !== null}
        />
      ) : null}

      {pantry.length > 0 ? (
        <View style={styles.list}>
          <Heading level={2}>{texts.pantry}</Heading>
          <Button
            label={showPantry ? texts.pantryHide : texts.pantryShow(pantry.length)}
            variant="secondary"
            onPress={() => setShowPantry((v) => !v)}
            testID="shopping-pantry-toggle"
          />
          {showPantry ? (
            <View testID="shopping-pantry">
              <RowGroup>{pantry.filter(visible).map(itemRow)}</RowGroup>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Vorratsschrank (25.10.2026): was laut Vorrat reicht – eingeklappt, nur Anzeige. */}
      {pantryView.inPantry.length > 0 ? (
        <View style={styles.list} testID="shopping-in-pantry">
          <Heading level={2}>{t.pantry.shopping.inPantryTitle}</Heading>
          <Button
            label={
              showInPantry
                ? t.pantry.shopping.inPantryHide
                : t.pantry.shopping.inPantryShow(pantryView.inPantry.length)
            }
            variant="secondary"
            onPress={() => setShowInPantry((v) => !v)}
            testID="shopping-in-pantry-toggle"
          />
          {showInPantry ? (
            <View style={styles.list} testID="shopping-in-pantry-items">
              <Body muted>{t.pantry.shopping.inPantryHint}</Body>
              {pantryView.inPantry.map((line) => (
                <Body key={line.item.itemKey} testID={`shopping-in-pantry-${line.item.itemKey}`}>
                  {`${shoppingItemText(line.item)} – ${
                    line.status === 'covered'
                      ? t.pantry.shopping.covered
                      : t.pantry.shopping.checkAmount
                  }`}
                </Body>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {consentOk && anyChecked && foods !== null ? (
        <Card>
          <Body muted>{t.pantry.shopping.updateHint}</Body>
          <Button
            label={t.pantry.shopping.update}
            variant="secondary"
            loading={busy === 'pantry'}
            disabled={busy !== null}
            onPress={() => void updatePantryAfterShopping()}
            testID="shopping-pantry-update"
          />
        </Card>
      ) : null}
      <Button
        label={t.pantry.shopping.link}
        variant="secondary"
        onPress={() => router.push('/ernaehrung/vorrat' as Href)}
        testID="shopping-pantry-link"
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
      {/* Etappe N12: als Text weitergeben (System-Teilen-Dialog bzw. Kopieren), Hinweis vorher wie K4. Drucken und
          Weitergeben zeigen denselben Zeitraum wie die Liste (dieselbe aufgelöste Liste der Woche). */}
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
      <Body muted testID="shopping-offline">
        {texts.offline}
      </Body>

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

function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Symbol je Abteilung (nur Deko, der Name steht daneben). */
const DEPARTMENT_ICONS: Readonly<Record<ShoppingCategory, IconName>> = {
  fruit_vegetables: 'leaf',
  bread_bakery: 'bread',
  chilled_dairy_eggs: 'milk',
  chilled_plant_based: 'sprout',
  meat_sausage: 'drumstick',
  fish: 'fish',
  pasta_rice_grains: 'wheat',
  legumes_canned: 'can',
  cereal_breakfast: 'bowl',
  nuts_seeds_dried_fruit: 'nut',
  oils_vinegar_sauces: 'bottle',
  spices_baking: 'shaker',
  frozen: 'snowflake',
  drinks: 'cup',
  other: 'box',
};

/**
 * Kopf einer Abteilung (23.10.2026, kompakt seit 24.10.2026): Symbol, Name, „x offen“ bzw. „✓ erledigt“, Pfeil
 * (nach unten = aufgeklappt). Antippen klappt auf bzw. zu; für Bildschirmleser ein Knopf mit Zustand „aufgeklappt“.
 */
function DepartmentHeader({
  department,
  expanded,
  onPress,
}: {
  department: ShoppingDepartment;
  expanded: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const cyan = useAreaColors('einkaufen');
  const texts = t.nutrition.shopping;
  const name = shoppingCategoryLabel(department.category);
  const status = department.done ? texts.departmentDone : texts.departmentOpen(department.open);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texts.departmentA11y(
        name,
        department.done ? texts.departmentA11yDone : texts.departmentOpen(department.open),
      )}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      style={styles.departmentHeader}
      testID={`shopping-dept-toggle-${department.category}`}
    >
      <View style={[styles.departmentIcon, { backgroundColor: cyan.surface }]}>
        <Icon name={DEPARTMENT_ICONS[department.category]} size={18} color={cyan.icon} />
      </View>
      <Text style={[styles.departmentName, { color: theme.text }]} numberOfLines={2}>
        {name}
      </Text>
      <Text
        style={[styles.departmentStatus, { color: department.done ? cyan.icon : theme.textMuted }]}
        testID={`shopping-dept-status-${department.category}`}
      >
        {status}
      </Text>
      <View style={[styles.chevron, expanded && styles.chevronOpen]}>
        <Icon name="chevron" size={18} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

/** Eine Abteilung als EINE Fläche mit Trennlinien (wie Bring!/Erinnerungen) statt einzelner Karten. */
function RowGroup({ children }: { children: ReactNode }) {
  const theme = useThemeColors();
  return (
    <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
      {children}
    </View>
  );
}

/**
 * Ein Eintrag (24.10.2026, „wie eine echte Einkaufsliste“): runder Haken in Einkaufs-Türkis, fett die Kaufmenge
 * („2 Packungen“), dahinter das Produkt; klein darunter Packungsgröße, wofür gebraucht und Markierungen. Die ganze
 * Zeile ist das Tippziel (≥ 54 px). Abgehakt: durchgestrichen (die Abteilung sortiert ihn nach unten, core).
 */
function ShoppingItemRow({
  item,
  pantryStatus,
  usedFor,
  outsideDiet,
  disabled,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  /** Abgleich mit dem Vorratsschrank (Restmenge bzw. „fast leer“). */
  pantryStatus: PantryShoppingStatus;
  usedFor: string | null;
  outsideDiet: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onRemove: (() => void) | undefined;
}) {
  const theme = useThemeColors();
  const cyan = useAreaColors('einkaufen');
  const texts = t.nutrition.shopping;
  const purchase = item.isManual ? null : shoppingPurchase(item);
  const quantity =
    purchase !== null
      ? purchase.quantity
      : item.amount !== null && item.unit !== null
        ? formatAmount(item.amount, item.unit)
        : null;
  const product = purchase?.product ?? item.labelDe;
  const secondLine = [
    purchase?.detail ?? (purchase === null && !item.isManual ? texts.toTaste : null),
    // Markierungen vor den Rezepten (lange Rezeptnamen dürfen am Ende gekürzt werden).
    pantryStatus === 'partial'
      ? t.pantry.shopping.partial
      : pantryStatus === 'low'
        ? t.pantry.shopping.low
        : null,
    item.notInPlan ? texts.notInPlan : null,
    item.amountChanged ? texts.amountChanged : null,
    item.isManual ? texts.manual : null,
    outsideDiet ? texts.outsideDiet : null,
    // Vorrat (Öl, Gewürze): „Vorrat prüfen“ reicht – wofür, ist dort ohne Belang.
    purchase?.kind === 'stock' ? null : usedFor,
  ]
    .filter((m): m is string => m !== null && m !== '')
    .join(' · ');
  const text = shoppingItemText(item);
  return (
    <View
      style={[styles.item, { borderTopColor: theme.divider }]}
      testID={`shopping-item-${item.itemKey}`}
    >
      <Pressable
        accessibilityRole="checkbox"
        // Name = Kaufzeile (enthält die Packungsgröße); die zweite Zeile liest der Bildschirmleser danach als Text.
        accessibilityLabel={texts.checkA11y(text)}
        accessibilityState={{ checked: item.checked, disabled }}
        aria-checked={item.checked}
        disabled={disabled}
        onPress={() => onToggle(!item.checked)}
        style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
        testID={`shopping-check-${item.itemKey}`}
      >
        <View
          style={[
            styles.box,
            {
              // Runder Haken in Einkaufs-Türkis (Rand ≥ 3 : 1 zur Fläche), Haken in Flächenfarbe.
              borderColor: item.checked ? cyan.icon : theme.textMuted,
              backgroundColor: item.checked ? cyan.icon : 'transparent',
            },
          ]}
        >
          {item.checked ? (
            <Icon name="check" size={16} strokeWidth={3} color={theme.surface} />
          ) : null}
        </View>
        <View style={styles.flex}>
          <Text
            style={[
              styles.itemLine,
              { color: item.checked ? theme.textMuted : theme.text },
              item.checked && styles.done,
            ]}
            numberOfLines={2}
            testID={`shopping-text-${item.itemKey}`}
          >
            {quantity !== null ? <Text style={styles.itemQuantity}>{`${quantity} `}</Text> : null}
            {product}
          </Text>
          {secondLine !== '' ? (
            <Text
              style={[styles.itemSecond, { color: theme.textMuted }]}
              numberOfLines={2}
              testID={`shopping-second-${item.itemKey}`}
            >
              {secondLine}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={texts.removeManual(item.labelDe)}
          onPress={onRemove}
          disabled={disabled}
          hitSlop={4}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          testID={`shopping-remove-${item.itemKey}`}
        >
          <Icon name="trash" size={20} color={theme.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroEyebrowText: { fontSize: fontSize.xs, letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  departments: { gap: spacing.md },
  department: { gap: spacing.xs },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    // Trennlinie statt eigener Karte; die oberste Linie verschwindet unter dem Rand der Fläche.
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: -StyleSheet.hairlineWidth,
    paddingRight: spacing.xs,
  },
  itemMain: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm + 4,
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLine: { fontSize: 17, lineHeight: 22 },
  itemQuantity: { fontWeight: '800' },
  itemSecond: { fontSize: fontSize.xs, lineHeight: 17, marginTop: 1 },
  done: { textDecorationLine: 'line-through' },
  remove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  departmentHeader: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  departmentIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { width: 18, height: 18, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  departmentName: { flex: 1, fontSize: fontSize.md, fontWeight: '700' },
  departmentStatus: { fontSize: fontSize.sm, fontWeight: '600' },
  doneLink: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  doneLinkText: { fontSize: fontSize.sm, textDecorationLine: 'underline' },
  rangeLinkText: { fontSize: fontSize.md, fontWeight: '600', textDecorationLine: 'underline' },
});
