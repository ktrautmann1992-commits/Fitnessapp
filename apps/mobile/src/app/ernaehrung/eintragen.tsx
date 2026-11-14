import {
  addDays,
  CUSTOM_MEAL_PORTION_CHOICES,
  type CustomMeal,
  defaultFoodLogSlot,
  entryFromCustomMeal,
  foodLogDisplayTitle,
  entryFromRecipe,
  entryFromFavorite,
  entryFromTemplate,
  favoriteAvailable,
  FOOD_LOG_MANUAL_SLOTS,
  FOOD_LOG_PORTION_CHOICES,
  foodLogDateStatus,
  type FoodLogBuild,
  type FoodLogEntry,
  type FoodLogFavorite,
  type FoodLogManualSlot,
  isFavoriteEntry,
  isoDateSchema,
  moveEntry,
  needsFoodLogConfirmation,
  orderFavorites,
  QUICK_ENTRY_LABELS,
  type QuickEntryLabel,
  quickEntry,
  recentEntries,
  rebuildEntry,
  searchFoodLogCatalog,
  type Food,
  type Recipe,
  entryFromUserProduct,
  normalizeFoodText,
  productEntryDisplayTitle,
  addToBasket,
  basketCustomMealInput,
  basketEntries,
  type BasketItem,
  buildCustomMeal,
  canAddCustomMeal,
  entryFromFoodAmount,
  FOOD_HOUSEHOLD_LIMITS,
  FOOD_LOG_SLOTS,
  type FoodAmountUnit,
  type FoodLogSlot,
  orderCustomMealsForSlot,
  removeFromBasket,
  suggestBasketName,
  withStandIns,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { CustomMealPicker } from '@/components/custom-meals';
import { EatingOutTab } from '@/components/eating-out';
import { BasketCard, FoodAmountPicker, QuickPicks } from '@/components/food-log-free';
import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { TestPhaseBadge } from '@/components/test-phase';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { BackendError } from '@/data/backend';
import { newId } from '@/data/create-backend';
import { entryFromRow } from '@/data/food-log-rows';
import type { FoodLogEntryRow, UserFoodProductRow } from '@/data/types';
import { t } from '@/i18n';
import { recentDetailText } from '@/lib/custom-meal-format';
import { errorText } from '@/lib/error-text';
import {
  buildErrorText,
  confirmText,
  entryDetailText,
  foodLogDayText,
  manualSlotLabel,
  manualSlotOf,
  portionNumber,
  templateDetailText,
  unitText,
} from '@/lib/food-log-format';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { setProductHandoff } from '@/lib/product-handoff';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useCustomMealActions, useCustomMeals } from '@/state/use-custom-meals';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';

type Tab = 'recent' | 'favorites' | 'search' | 'out' | 'quick';
const TABS: readonly Tab[] = ['recent', 'favorites', 'search', 'out', 'quick'];

type Message = { text: string; tone: 'success' | 'danger' | 'warning' };

/**
 * Ernährung → „Eintragen“ (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5): Reiter Zuletzt · Favoriten · Suche ·
 * Schnell, dazu Tag (heute bis 14 Tage zurück) und Mahlzeit. Mit `bearbeiten=<id>` ändert der Bildschirm einen
 * Eintrag (Menge/Portion, Mahlzeit, Tag; Schnelleintrag: Bezeichnung und kcal). Mit `platz=` (z. B. vom „+“ einer
 * Mahlzeiten-Karte) ist die Mahlzeit vorbelegt. Alle Werte rechnet packages/core
 * (`entryFromFood`, `entryFromRecipe`, `quickEntry`, `rebuildEntry`); ab 1.500 kcal fragt die App „Stimmt die Menge?“
 * (keine Sperre). Bei „Kalorienzahlen aus“ keine kcal und kein kcal-Feld. Ohne Einwilligung health_data kein Eintragen
 * (A-G12). Kein Essensplan nötig. Etappe E2: unter „Favoriten“ die eigenen Gerichte (Portion 0,25–3), unter „Zuletzt“
 * auch eingetragene eigene Gerichte (neu aus dem aktuellen Gericht gerechnet); Titel im Tagebuch bleibt „Eigenes
 * Gericht“, angezeigt wird der Name.
 */
export default function FoodLogEntryScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{
    tag?: string;
    bearbeiten?: string;
    rezept?: string;
    /**
     * Vorbelegte Mahlzeit („+“ an der Mahlzeiten-Karte der Tagesübersicht): breakfast, lunch, dinner, other – oder
     * (14.11.2026, „Etwas anderes gegessen“) der genaue Platz der Plan-Mahlzeit, z. B. snack_morning.
     */
    platz?: string;
    /** „Etwas anderes gegessen“ an einer Plan-Mahlzeit (14.11.2026): Hinweis oben, Suche vorausgewählt. */
    anders?: string;
  }>();
  const today = useToday();
  const editId = typeof params.bearbeiten === 'string' ? params.bearbeiten : null;
  const editRow = editId ? (app.rows?.foodLogEntries.find((e) => e.id === editId) ?? null) : null;
  const [pickedDate, setPickedDate] = useState<string | null>(() => {
    const tag = isoDateSchema.safeParse(params.tag);
    return tag.success && foodLogDateStatus(tag.data, today) === 'ok' ? tag.data : null;
  });
  const date = pickedDate ?? editRow?.eaten_on ?? today;
  // Genauer Platz aus der Adresse (Plan-Mahlzeit, z. B. snack_morning) – gilt, solange die Auswahl dazu passt.
  const exactSlot: FoodLogSlot | null = FOOD_LOG_SLOTS.find((s) => s === params.platz) ?? null;
  const other = params.anders === '1' && exactSlot !== null && exactSlot !== 'other';
  const [slot, setSlot] = useState<FoodLogManualSlot>(() => {
    const now = new Date();
    if (editRow) return manualSlotOf(editRow.slot);
    if (exactSlot !== null) return manualSlotOf(exactSlot);
    return defaultFoodLogSlot(now.getHours() * 60 + now.getMinutes());
  });
  const targetSlot: FoodLogSlot =
    exactSlot !== null && manualSlotOf(exactSlot) === slot ? exactSlot : slot;
  const [tab, setTab] = useState<Tab>(
    typeof params.rezept === 'string' || other ? 'search' : 'recent',
  );
  const view = useNutritionWeek(date);
  const foodLog = useFoodLogDay(date, view.showNumbers);
  const actions = useFoodLogActions();
  const [message, setMessage] = useState<Message | null>(null);
  const [lastSaved, setLastSaved] = useState<FoodLogEntry | null>(null);
  const [pending, setPending] = useState<{
    entries: FoodLogEntry[];
    basket: boolean;
    savedName?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const meals = useCustomMeals();
  const mealActions = useCustomMealActions();
  // Korb „Deine Mahlzeit“ (14.11.2026): mehrere Lebensmittel, dann alle auf einmal eintragen bzw. als Favorit.
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [basketSaved, setBasketSaved] = useState(false);
  const [basketFavorite, setBasketFavorite] = useState(false);
  const [basketKey, setBasketKey] = useState(0);
  // E4a: Produkt zum erneuten Abrufen, wenn der Zwischenspeicher-Eintrag fehlt (Server: product_unavailable).
  const [refetch, setRefetch] = useState<{ code: string; amount: number } | null>(null);
  const userProducts: readonly UserFoodProductRow[] = app.rows?.userFoodProducts ?? [];
  const titleOf = (
    entry: Pick<FoodLogEntry, 'source' | 'custom_meal_id' | 'title_de' | 'user_product_id'>,
  ) =>
    entry.source === 'product'
      ? productEntryDisplayTitle(entry, userProducts)
      : foodLogDisplayTitle(entry, meals);

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
  const back = () =>
    router.canGoBack() ? router.back() : router.replace(`/ernaehrung?tag=${date}` as Href);
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="plus"
      title={editId ? t.foodLog.editTitle : t.foodLog.screenTitle}
      testID="food-log-entry"
      footer={
        <Button label={t.foodLog.done} variant="secondary" onPress={back} testID="food-log-done" />
      }
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.foodLog.unsupported}</Notice>);
  }
  if (!nutritionReady(view) || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  if (!foodLog.consentValid) {
    return shell(
      <Notice tone="info" testID="food-log-consent">
        <Body>{t.foodLog.consentNeeded}</Body>
        <Button
          label={t.foodLog.consentButton}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
          testID="food-log-consent-button"
        />
      </Notice>,
    );
  }
  const library = view.library.result.library;
  const showNumbers = view.showNumbers;

  /** Speichern; `basket` = alle Lebensmittel der Mahlzeit auf einmal (je Lebensmittel ein Eintrag). */
  async function store(
    input: FoodLogEntry | readonly FoodLogEntry[],
    confirmed = false,
    savedName?: string,
  ) {
    const fromBasket = Array.isArray(input);
    const list: FoodLogEntry[] = fromBasket ? [...input] : [input as FoodLogEntry];
    const entry = list[0];
    if (entry === undefined) return;
    if (!confirmed && list.some((e) => needsFoodLogConfirmation(e))) {
      setPending({
        entries: list,
        basket: fromBasket,
        ...(savedName !== undefined ? { savedName } : {}),
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    setRefetch(null);
    try {
      await actions.save(list);
      setLastSaved(editId || fromBasket ? null : entry);
      if (fromBasket) setBasketSaved(true);
      setMessage({
        text: editId
          ? t.foodLog.updated
          : fromBasket
            ? t.foodLog.free.basketSaved(list.length)
            : savedName !== undefined
              ? t.eatingOut.saved(savedName)
              : t.foodLog.saved(titleOf(entry)),
        tone: 'success',
      });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
      if (
        error instanceof BackendError &&
        error.code === 'food_log_product_unavailable' &&
        entry.product_code !== null &&
        entry.amount !== null
      ) {
        setRefetch({ code: entry.product_code, amount: entry.amount });
      }
    } finally {
      setBusy(false);
    }
  }

  /** Produktansicht öffnen (Nummer/eigenes Produkt nur im Arbeitsspeicher, nie in der Adresse). */
  function openProduct(handoff: { code?: string; ownId?: string; amount?: number }) {
    setProductHandoff(handoff);
    router.push(`/ernaehrung/produkt?tag=${date}&platz=${slot}` as Href);
  }

  function submit(build: FoodLogBuild) {
    if (!build.ok) {
      setMessage({ text: buildErrorText(build.reason), tone: 'warning' });
      return;
    }
    void store(build.entry);
  }

  const target = () => ({ id: newId(), date, slot: targetSlot });
  const pendingCheck =
    pending?.entries.find((e) => needsFoodLogConfirmation(e)) ?? pending?.entries[0] ?? null;
  const confirmDialog = (
    <ConfirmDialog
      visible={pending !== null}
      title={t.foodLog.confirmTitle}
      message={pendingCheck ? confirmText(pendingCheck, showNumbers) : ''}
      confirmLabel={t.foodLog.confirmYes}
      confirmVariant="primary"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const next = pending;
        setPending(null);
        if (next) {
          void store(
            next.basket ? next.entries : (next.entries[0] as FoodLogEntry),
            true,
            next.savedName,
          );
        }
      }}
      testID="food-log-confirm"
    />
  );
  const feedback = (
    <>
      {message ? (
        <Notice tone={message.tone} testID="food-log-entry-message">
          {message.text}
        </Notice>
      ) : null}
      {refetch ? (
        <Button
          label={t.foodProduct.search}
          variant="secondary"
          onPress={() => openProduct(refetch)}
          testID="food-log-product-refetch"
        />
      ) : null}
      {lastSaved && lastSaved.source !== 'plan_item' && lastSaved.source !== 'custom_meal' ? (
        <Button
          label={
            isFavoriteEntry(rows.foodLogFavorites, lastSaved)
              ? t.foodLog.favoriteRemove
              : t.foodLog.favoriteAdd
          }
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            actions
              .toggleFavorite(lastSaved)
              .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
              .finally(() => setBusy(false));
          }}
          testID="food-log-saved-favorite"
        />
      ) : null}
    </>
  );

  // ------------------------------------------------------------------------------------------------------
  // Bearbeiten
  // ------------------------------------------------------------------------------------------------------
  if (editId) {
    if (editRow === null) {
      return shell(<Notice tone="info">{t.foodLog.notFound}</Notice>);
    }
    return shell(
      <>
        <EditEntry
          key={`${editRow.id}-${editRow.revision}`}
          row={editRow}
          title={titleOf(editRow)}
          sources={{ foods: library.foods, recipes: library.recipes, meals }}
          today={today}
          showNumbers={showNumbers}
          busy={busy}
          onSubmit={submit}
          onDelete={async () => {
            setBusy(true);
            try {
              await actions.remove(editRow.id);
              back();
            } catch (error) {
              setMessage({ text: errorText(error), tone: 'danger' });
            } finally {
              setBusy(false);
            }
          }}
        />
        {feedback}
        {confirmDialog}
      </>,
    );
  }

  // ------------------------------------------------------------------------------------------------------
  // Neu eintragen
  // ------------------------------------------------------------------------------------------------------
  const oldest = addDays(today, -14);
  const all = rows.foodLogEntries;
  const recent = recentEntries(all);
  const favorites = orderFavorites(rows.foodLogFavorites, all);
  const mealById = (id: string | null) => meals.find((m) => m.id === id) ?? null;
  const ownById = (id: string | null) => userProducts.find((p) => p.id === id) ?? null;
  const pickCustom = (meal: CustomMeal, portion: number) =>
    submit(entryFromCustomMeal(meal, portion, target()));
  const preselectedRecipe =
    typeof params.rezept === 'string'
      ? (library.recipes.find((r) => r.id === params.rezept) ?? null)
      : null;
  const recentAvailable = (item: FoodLogEntryRow | FoodLogFavorite) =>
    (item.source !== 'custom_meal' ||
      ('custom_meal_id' in item && mealById(item.custom_meal_id) !== null)) &&
    (item.source !== 'product' ||
      item.user_product_id === null ||
      ownById(item.user_product_id) !== null);
  const pickRecent = (item: FoodLogEntryRow | FoodLogFavorite) => {
    // Eigenes Gericht (E2): neu aus dem aktuellen Gericht mit derselben Portion.
    if (item.source === 'custom_meal' && 'custom_meal_id' in item) {
      const meal = mealById(item.custom_meal_id);
      if (meal) pickCustom(meal, item.portion ?? 1);
      return;
    }
    // Eigenes Produkt (E4a): neu aus dem aktuellen Produkt mit derselben Menge.
    if (item.source === 'product' && item.user_product_id !== null) {
      const own = ownById(item.user_product_id);
      if (own && item.amount !== null) {
        submit(entryFromUserProduct(own, item.amount, target()));
      }
      return;
    }
    // Produkt aus Open Food Facts: gleiche Menge; die Werte rechnet der Server aus dem Zwischenspeicher nach
    // (fehlt er, kommt „Produkt neu abrufen“).
    submit(entryFromTemplate(templateOf(item), target()));
  };
  const favoriteTitleOf = (item: FoodLogFavorite) =>
    item.source === 'product' && item.user_product_id !== null
      ? (ownById(item.user_product_id)?.name_de ?? item.title_de)
      : item.title_de;
  const pickFavorite = (item: FoodLogEntryRow | FoodLogFavorite) => {
    // E4a: Produkt-Favoriten speichern keine Werte – über die Produktansicht (neu abfragen bzw. eigenes
    // Produkt) mit der gemerkten Menge.
    if ('fav_key' in item && item.source === 'product') {
      openProduct({
        ...(item.product_code !== null ? { code: item.product_code } : {}),
        ...(item.user_product_id !== null ? { ownId: item.user_product_id } : {}),
        ...(item.amount !== null ? { amount: item.amount } : {}),
      });
      return;
    }
    // Favoriten aus Katalog/Rezept speichern keine Werte – neu aus dem Bestand gerechnet (Wächter E1 S1).
    submit(
      'fav_key' in item
        ? entryFromFavorite(item, library, target())
        : entryFromTemplate(templateOf(item), target()),
    );
  };

  // Schnellauswahl „Mit einem Tipp“ (14.11.2026): eigene Gerichte zuerst (zuletzt zu dieser Mahlzeit gegessen vorn),
  // dann Stern-Favoriten (ohne Produkte – die brauchen die Produktansicht), dann „Zuletzt gegessen“.
  const quickMeals = orderCustomMealsForSlot(meals, all, targetSlot).slice(
    0,
    FOOD_HOUSEHOLD_LIMITS.quickChips,
  );
  const quickFavorites = favorites
    .filter((item) => item.source !== 'product' && favoriteAvailable(item, library))
    .slice(0, FOOD_HOUSEHOLD_LIMITS.quickChips);
  const quickRecent = recent
    .filter((item) => recentAvailable(item))
    .slice(0, FOOD_HOUSEHOLD_LIMITS.quickChips);

  // Katalog plus Ersatz für fehlende Alltags-Lebensmittel („Emmentaler“ → Werte wie Gouda, Richtwert; core).
  const freeFoods = withStandIns(library.foods);
  // Korb „Deine Mahlzeit“
  const basketRows = basket.map((item) => ({
    item,
    title: freeFoods.get(item.food_id)?.name_de ?? item.food_id,
  }));
  const putInBasket = (food: Food, amount: number, unit: FoodAmountUnit) => {
    const start = basketSaved ? [] : basket;
    const next = addToBasket(start, { food_id: food.id, amount, unit });
    if (next === null) {
      setMessage({ text: t.foodLog.free.basketFull, tone: 'warning' });
      return;
    }
    if (basketSaved) {
      setBasketSaved(false);
      setBasketFavorite(false);
      setBasketKey((k) => k + 1);
    }
    setBasket(next);
    setLastSaved(null);
    setMessage({ text: t.foodLog.free.basketAdded(food.name_de), tone: 'success' });
  };
  const submitBasket = () => {
    const result = basketEntries(basket, freeFoods, { date, slot: targetSlot }, newId);
    if (!result.ok) {
      const title = result.index === null ? null : basketRows[result.index]?.title;
      setMessage({
        text: title ? t.foodLog.free.basketInvalid(title) : buildErrorText('invalid'),
        tone: 'warning',
      });
      return;
    }
    void store(result.entries);
  };
  const saveBasketFavorite = async (name: string) => {
    if (!canAddCustomMeal(meals)) {
      setMessage({ text: t.foodLog.free.favoriteLimit, tone: 'warning' });
      return;
    }
    const input = basketCustomMealInput(basket, freeFoods, { id: newId(), name });
    const built = input === null ? null : buildCustomMeal(input, library.foods);
    if (built === null || !built.ok) {
      setMessage({
        text:
          built?.ok === false && built.reason === 'name'
            ? t.foodLog.free.favoriteNameInvalid
            : t.foodLog.free.favoriteInvalid,
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      await mealActions.save(built.meal);
      setBasketFavorite(true);
      setMessage({ text: t.foodLog.free.favoriteSaved(built.meal.name_de), tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const moreWays = (
    <>
      <Card>
        <TestPhaseBadge testID="food-log-photo-test-phase" />
        <Body muted>{t.foodPhoto.openHint}</Body>
        <Button
          label={t.foodPhoto.open}
          variant="secondary"
          onPress={() => router.push(`/ernaehrung/foto?tag=${date}&platz=${slot}` as Href)}
          testID="food-log-photo"
        />
      </Card>
      <Card>
        <Body muted>{t.foodProduct.openHint}</Body>
        <Button
          label={t.foodProduct.open}
          variant="secondary"
          onPress={() => openProduct({})}
          testID="food-log-product"
        />
      </Card>
    </>
  );

  return shell(
    <>
      <View style={{ gap: 4 }}>
        <Heading level={2}>{t.foodLog.dateQuestion}</Heading>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Button
              label={`← ${t.foodLog.earlier}`}
              variant="secondary"
              disabled={date <= oldest}
              onPress={() => setPickedDate(addDays(date, -1))}
              testID="food-log-date-prev"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={`${t.foodLog.later} →`}
              variant="secondary"
              disabled={date >= today}
              onPress={() => setPickedDate(addDays(date, 1))}
              testID="food-log-date-next"
            />
          </View>
        </View>
        <Body testID="food-log-date">{foodLogDayText(date, today)}</Body>
        {date === oldest ? <Body muted>{t.foodLog.tooOld}</Body> : null}
      </View>
      <ChoiceList
        label={t.foodLog.slotQuestion}
        horizontal
        options={FOOD_LOG_MANUAL_SLOTS.map((value) => ({ value, label: manualSlotLabel(value) }))}
        value={slot}
        onChange={setSlot}
      />
      {other ? (
        <Notice tone="info" testID="food-log-other-notice">
          {t.foodLog.free.otherNotice(manualSlotLabel(slot))}
        </Notice>
      ) : null}
      <QuickPicks
        meals={quickMeals}
        favorites={quickFavorites}
        recent={quickRecent}
        busy={busy}
        favoriteTitleOf={favoriteTitleOf}
        recentTitleOf={titleOf}
        onMeal={(meal) => pickCustom(meal, 1)}
        onFavorite={pickFavorite}
        onRecent={pickRecent}
      />
      {/* „Etwas anderes gegessen“: Suche zuerst, Foto und Barcode darunter (weniger Scrollen). */}
      {other ? null : moreWays}
      <ChoiceList
        label={t.foodLog.tabsLabel}
        horizontal
        options={TABS.map((value) => ({ value, label: t.foodLog.tabs[value] }))}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setMessage(null);
        }}
      />
      {!showNumbers ? <Body muted>{t.foodLog.numbersHidden}</Body> : null}
      {feedback}
      {tab === 'recent' ? (
        <TemplateList
          items={recent}
          empty={t.foodLog.recentEmpty}
          showNumbers={showNumbers}
          busy={busy}
          testID="food-log-recent"
          titleOf={titleOf}
          // Eigene Gerichte: Werte, die ein Tipp wirklich einträgt (aktuelles Gericht, Wächter E2 H2).
          detailOf={(item) =>
            'fav_key' in item
              ? templateDetailText(item, showNumbers)
              : recentDetailText(item, meals, showNumbers)
          }
          available={recentAvailable}
          onPick={pickRecent}
        />
      ) : null}
      {tab === 'favorites' ? (
        <View style={{ gap: 8 }}>
          <Heading level={2}>{t.customMeals.pickTitle}</Heading>
          {meals.length > 0 ? (
            <CustomMealPicker
              meals={meals}
              showNumbers={showNumbers}
              busy={busy}
              testID="food-log-custom-meals"
              onPick={pickCustom}
            />
          ) : null}
          <Button
            label={meals.length > 0 ? t.customMeals.manage : t.customMeals.createFirst}
            variant="secondary"
            onPress={() =>
              router.push(
                (meals.length > 0 ? '/ernaehrung/gerichte' : '/ernaehrung/gericht') as Href,
              )
            }
            testID="food-log-custom-meals-manage"
          />
          <Heading level={2}>{t.foodLog.tabs.favorites}</Heading>
        </View>
      ) : null}
      {tab === 'favorites' ? (
        <TemplateList
          items={favorites}
          empty={t.foodLog.favoritesEmpty}
          showNumbers={showNumbers}
          busy={busy}
          testID="food-log-favorites"
          titleOf={titleOf}
          favoriteTitleOf={favoriteTitleOf}
          available={(item) =>
            !('fav_key' in item) ||
            (item.source === 'product'
              ? item.user_product_id === null || ownById(item.user_product_id) !== null
              : favoriteAvailable(item, library))
          }
          onPick={pickFavorite}
        />
      ) : null}
      {basket.length > 0 ? (
        <BasketCard
          key={basketKey}
          rows={basketRows}
          suggestedName={suggestBasketName(basket, freeFoods)}
          saved={basketSaved}
          favoriteSaved={basketFavorite}
          busy={busy}
          onRemove={(index) => setBasket(removeFromBasket(basket, index))}
          onSubmit={submitBasket}
          onFavorite={(name) => void saveBasketFavorite(name)}
          onClear={() => {
            setBasket([]);
            setBasketSaved(false);
            setBasketFavorite(false);
            setBasketKey((k) => k + 1);
            setMessage(null);
          }}
        />
      ) : null}
      {tab === 'search' ? (
        <SearchTab
          foods={freeFoods}
          recipes={library.recipes}
          preselectedRecipe={preselectedRecipe}
          ownProducts={userProducts}
          onOwnProduct={(id) => openProduct({ ownId: id })}
          busy={busy}
          onQuick={() => setTab('quick')}
          onFood={(food, amount, unit) => submit(entryFromFoodAmount(food, amount, unit, target()))}
          onBasket={putInBasket}
          onRecipe={(recipe, servings) =>
            submit(entryFromRecipe(recipe, library.foods, servings, target()))
          }
        />
      ) : null}
      {/* Auswärts essen (25.10.2026): typische Gerichte mit Portion, Schätzwerte aus dem Katalog. */}
      {tab === 'out' ? (
        <EatingOutTab
          foods={library.foods}
          allowDrafts={app.backend.mode === 'local'}
          showNumbers={showNumbers}
          busy={busy}
          userId={app.session?.userId ?? null}
          target={target}
          onQuick={() => setTab('quick')}
          onSubmit={(build, name) => {
            if (!build.ok) {
              setMessage({ text: buildErrorText(build.reason), tone: 'warning' });
              return;
            }
            void store(build.entry, false, name);
          }}
        />
      ) : null}
      {tab === 'quick' ? (
        <QuickTab
          showNumbers={showNumbers}
          busy={busy}
          onSubmit={(input) => submit(quickEntry(input, target()))}
        />
      ) : null}
      {other ? moreWays : null}
      {confirmDialog}
    </>,
  );
}

/** Vorlage für einen neuen Eintrag – Plan-Mahlzeiten kommen in „Zuletzt“ nicht vor (recentEntries). */
function templateOf(item: FoodLogEntryRow | FoodLogFavorite) {
  return { ...item, source: item.source === 'plan_item' ? 'recipe' : item.source } as const;
}

function TemplateList({
  items,
  empty,
  showNumbers,
  busy,
  testID,
  titleOf,
  favoriteTitleOf = (item) => item.title_de,
  detailOf = (item) => templateDetailText(item, showNumbers),
  available = () => true,
  onPick,
}: {
  items: readonly (FoodLogEntryRow | FoodLogFavorite)[];
  empty: string;
  showNumbers: boolean;
  busy: boolean;
  testID: string;
  /** Anzeigetitel (eigene Gerichte: Name, E2; eigene Produkte: Name, E4a). */
  titleOf: (item: FoodLogEntryRow) => string;
  /** Anzeigetitel eines Favoriten (E4a: eigenes Produkt mit Namen). */
  favoriteTitleOf?: (item: FoodLogFavorite) => string;
  /** Detailzeile (Standard: Werte der Vorlage). */
  detailOf?: (item: FoodLogEntryRow | FoodLogFavorite) => string;
  available?: (item: FoodLogEntryRow | FoodLogFavorite) => boolean;
  onPick: (item: FoodLogEntryRow | FoodLogFavorite) => void;
}) {
  if (items.length === 0) {
    return (
      <Body muted testID={`${testID}-empty`}>
        {empty}
      </Body>
    );
  }
  return (
    <View style={{ gap: 8 }} testID={testID}>
      {items.map((item, index) => {
        const key = 'fav_key' in item ? item.fav_key : item.id;
        const ok = available(item);
        const title = 'fav_key' in item ? favoriteTitleOf(item) : titleOf(item);
        // testID nur mit Position – der Schlüssel enthält kcal (Wächter E1 H7, nichts davon ins DOM).
        return (
          <Card key={key}>
            <Body>{title}</Body>
            <Body muted>{detailOf(item)}</Body>
            {ok ? null : <Body muted>{t.foodLog.favoriteUnavailable}</Body>}
            <Button
              label={t.foodLog.addThis}
              accessibilityLabel={t.foodLog.addThisA11y(title)}
              disabled={busy || !ok}
              onPress={() => onPick(item)}
              testID={`${testID}-add-${index}`}
            />
          </Card>
        );
      })}
    </View>
  );
}

function SearchTab({
  foods,
  recipes,
  preselectedRecipe,
  ownProducts,
  onOwnProduct,
  busy,
  onQuick,
  onFood,
  onBasket,
  onRecipe,
}: {
  foods: ReadonlyMap<string, Food>;
  recipes: readonly Recipe[];
  preselectedRecipe: Recipe | null;
  /** E4a: „Deine Produkte“ – nur die eigenen Produkte (nie Produkte aus Open Food Facts, keine Marken anderer). */
  ownProducts: readonly UserFoodProductRow[];
  onOwnProduct: (id: string) => void;
  busy: boolean;
  onQuick: () => void;
  onFood: (food: Food, amount: number, unit: FoodAmountUnit) => void;
  /** „Zur Mahlzeit“ (14.11.2026): Lebensmittel in den Korb legen. */
  onBasket: (food: Food, amount: number, unit: FoodAmountUnit) => void;
  onRecipe: (recipe: Recipe, servings: number) => void;
}) {
  const [query, setQuery] = useState(preselectedRecipe?.title_de ?? '');
  const [selected, setSelected] = useState<
    { kind: 'food'; food: Food } | { kind: 'recipe'; recipe: Recipe } | null
  >(preselectedRecipe ? { kind: 'recipe', recipe: preselectedRecipe } : null);
  const result = useMemo(
    () => searchFoodLogCatalog({ foods, recipes }, query),
    [foods, query, recipes],
  );
  const searched = query.trim().length >= 2;
  // „Deine Produkte“ (E4a): nur eigene Produkte nach Namen – eigener Abschnitt, nie im Katalog vermischt.
  const ownHits = searched
    ? ownProducts
        .filter((p) => normalizeFoodText(p.name_de).includes(normalizeFoodText(query.trim())))
        .slice(0, 10)
    : [];
  return (
    <View style={{ gap: 8 }} testID="food-log-search">
      <TextField
        label={t.foodLog.searchLabel}
        hint={t.foodLog.searchHint}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setSelected(null);
        }}
        maxLength={60}
        testID="food-log-search-input"
      />
      {selected?.kind === 'food' ? (
        <FoodAmountPicker
          key={selected.food.id}
          food={selected.food}
          busy={busy}
          onSubmit={(amount, unit) => onFood(selected.food, amount, unit)}
          onBasket={(amount, unit) => {
            onBasket(selected.food, amount, unit);
            // Weiter suchen: Auswahl und Suchfeld leeren (nächstes Lebensmittel mit wenigen Tipps).
            setSelected(null);
            setQuery('');
          }}
        />
      ) : selected?.kind === 'recipe' ? (
        <RecipeServingsForm
          key={selected.recipe.id}
          recipe={selected.recipe}
          busy={busy}
          onSubmit={(servings) => onRecipe(selected.recipe, servings)}
        />
      ) : null}
      {selected === null && ownHits.length > 0 ? (
        <View style={{ gap: 4 }} testID="food-log-search-own-products">
          <Heading level={2}>{t.foodLog.searchOwnProducts}</Heading>
          {ownHits.map((product, index) => (
            <Button
              key={product.id}
              label={product.name_de}
              variant="secondary"
              disabled={busy}
              onPress={() => onOwnProduct(product.id)}
              testID={`food-log-search-own-product-${index}`}
            />
          ))}
        </View>
      ) : null}
      {searched && selected === null ? (
        result.foods.length === 0 && result.recipes.length === 0 && ownHits.length === 0 ? (
          <View style={{ gap: 8 }} testID="food-log-search-none">
            <Body muted>{t.foodLog.searchNone}</Body>
            <Button label={t.foodLog.searchNoneQuick} variant="secondary" onPress={onQuick} />
          </View>
        ) : (
          <>
            {result.foods.length > 0 ? <Heading level={2}>{t.foodLog.searchFoods}</Heading> : null}
            {result.foods.map((food) => (
              <Button
                key={food.id}
                label={food.name_de}
                accessibilityLabel={t.foodLog.chooseA11y(food.name_de)}
                variant="secondary"
                onPress={() => setSelected({ kind: 'food', food })}
                testID={`food-log-food-${food.id}`}
              />
            ))}
            {result.recipes.length > 0 ? (
              <Heading level={2}>{t.foodLog.searchRecipes}</Heading>
            ) : null}
            {result.recipes.map((recipe) => (
              <Button
                key={recipe.id}
                label={recipe.title_de}
                accessibilityLabel={t.foodLog.chooseA11y(recipe.title_de)}
                variant="secondary"
                onPress={() => setSelected({ kind: 'recipe', recipe })}
                testID={`food-log-recipe-${recipe.id}`}
              />
            ))}
          </>
        )
      ) : null}
    </View>
  );
}

function RecipeServingsForm({
  recipe,
  busy,
  onSubmit,
}: {
  recipe: Recipe;
  busy: boolean;
  onSubmit: (servings: number) => void;
}) {
  const [servings, setServings] = useState(1);
  return (
    <Card>
      <Heading level={2}>{recipe.title_de}</Heading>
      <ChoiceList
        label={t.foodLog.servingsLabel}
        horizontal
        options={FOOD_LOG_PORTION_CHOICES.map((value) => ({ value, label: portionNumber(value) }))}
        value={servings}
        onChange={setServings}
      />
      <Button
        label={t.foodLog.addThis}
        accessibilityLabel={t.foodLog.addThisA11y(recipe.title_de)}
        loading={busy}
        onPress={() => onSubmit(servings)}
        testID="food-log-recipe-add"
      />
    </Card>
  );
}

interface QuickInput {
  label: QuickEntryLabel;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** Felder des Schnelleintrags (auch beim Bearbeiten). Ohne Zahlen kein kcal-Feld. */
function QuickFields({
  showNumbers,
  initial,
  busy,
  submitLabel,
  onSubmit,
}: {
  showNumbers: boolean;
  initial?: Partial<QuickInput>;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: QuickInput) => void;
}) {
  const [label, setLabel] = useState<QuickEntryLabel>(initial?.label ?? 'Snack');
  const [kcal, setKcal] = useState(formatDecimal(initial?.kcal ?? null));
  const [protein, setProtein] = useState(formatDecimal(initial?.protein_g ?? null));
  const [carbs, setCarbs] = useState(formatDecimal(initial?.carbs_g ?? null));
  const [fat, setFat] = useState(formatDecimal(initial?.fat_g ?? null));
  const [errors, setErrors] = useState<{ kcal?: string; macro?: string }>({});
  const macro = (text: string) => {
    const value = parseDecimal(text);
    return value === null || (!Number.isNaN(value) && value >= 0 && value <= 750)
      ? value
      : Number.NaN;
  };
  return (
    <View style={{ gap: 8 }} testID="food-log-quick">
      <ChoiceList
        label={t.foodLog.quickLabel}
        options={QUICK_ENTRY_LABELS.map((value) => ({ value, label: value }))}
        value={label}
        onChange={setLabel}
      />
      {showNumbers ? (
        <>
          <TextField
            label={t.foodLog.quickKcal}
            value={kcal}
            onChangeText={setKcal}
            keyboardType="number-pad"
            maxLength={5}
            error={errors.kcal}
            testID="food-log-quick-kcal"
          />
          <Body muted>{t.foodLog.quickMacrosTitle}</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField
              label={t.foodLog.quickProtein}
              value={protein}
              onChangeText={setProtein}
              keyboardType="decimal-pad"
              maxLength={5}
              style={{ flex: 1 }}
            />
            <TextField
              label={t.foodLog.quickCarbs}
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="decimal-pad"
              maxLength={5}
              style={{ flex: 1 }}
            />
            <TextField
              label={t.foodLog.quickFat}
              value={fat}
              onChangeText={setFat}
              keyboardType="decimal-pad"
              maxLength={5}
              style={{ flex: 1 }}
            />
          </View>
          {errors.macro ? <Body muted>{errors.macro}</Body> : null}
        </>
      ) : (
        <Body muted>{t.foodLog.quickNoNumbers}</Body>
      )}
      <Button
        label={submitLabel}
        loading={busy}
        onPress={() => {
          if (!showNumbers) {
            onSubmit({ label, kcal: null, protein_g: null, carbs_g: null, fat_g: null });
            return;
          }
          const value = parseDecimal(kcal);
          const kcalOk = value === null || (Number.isInteger(value) && value >= 0 && value <= 3000);
          const macros = [macro(protein), macro(carbs), macro(fat)];
          const macrosOk = macros.every((m) => m === null || !Number.isNaN(m));
          setErrors({
            ...(kcalOk ? {} : { kcal: t.foodLog.quickKcalInvalid }),
            ...(macrosOk ? {} : { macro: t.foodLog.quickMacroInvalid }),
          });
          if (!kcalOk || !macrosOk) return;
          const withKcal = value !== null;
          onSubmit({
            label,
            kcal: value,
            protein_g: withKcal ? (macros[0] ?? null) : null,
            carbs_g: withKcal ? (macros[1] ?? null) : null,
            fat_g: withKcal ? (macros[2] ?? null) : null,
          });
        }}
        testID="food-log-quick-add"
      />
    </View>
  );
}

function QuickTab({
  showNumbers,
  busy,
  onSubmit,
}: {
  showNumbers: boolean;
  busy: boolean;
  onSubmit: (input: QuickInput) => void;
}) {
  return (
    <QuickFields
      showNumbers={showNumbers}
      busy={busy}
      submitLabel={t.foodLog.addThis}
      onSubmit={onSubmit}
    />
  );
}

/** Eintrag ändern: Menge/Portion, Mahlzeit und Tag (Plan-Mahlzeit nur Portion), Schnelleintrag neu; Löschen. */
function EditEntry({
  row,
  title,
  sources,
  today,
  showNumbers,
  busy,
  onSubmit,
  onDelete,
}: {
  row: FoodLogEntryRow;
  /** Anzeigetitel (eigenes Gericht: aktueller Name, E2). */
  title: string;
  /**
   * Bestand zum Neu-Rechnen beim Ändern (Wächter E2 Nachprüfung H2, `rebuildEntry`): Lebensmittel/Rezept/Gericht im
   * Bestand → neu aus der Quelle; sonst aus dem Schnappschuss (mit 2.000-g-Grenze, Wächter E1 H6).
   */
  sources: Parameters<typeof rebuildEntry>[2];
  today: string;
  showNumbers: boolean;
  busy: boolean;
  onSubmit: (build: FoodLogBuild) => void;
  onDelete: () => void;
}) {
  const entry = entryFromRow(row);
  const [slot, setSlot] = useState<FoodLogManualSlot>(manualSlotOf(row.slot));
  const [date, setDate] = useState(row.eaten_on);
  const [portion, setPortion] = useState(row.portion ?? 1);
  const [amount, setAmount] = useState(formatDecimal(row.amount));
  const [amountError, setAmountError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = foodLogDateStatus(row.eaten_on, today) === 'ok';
  const isPlan = row.source === 'plan_item';
  const oldest = addDays(today, -14);
  // Platz: unveränderte Zwischenmahlzeit behält ihren genauen Platz (z. B. snack_morning).
  const targetSlot = slot === manualSlotOf(row.slot) ? row.slot : slot;
  const relocate = (build: FoodLogBuild): FoodLogBuild =>
    build.ok
      ? moveEntry(build.entry, isPlan ? row.slot : targetSlot, isPlan ? row.eaten_on : date)
      : build;
  // Eigene Gerichte (E2): Portion 0,25–3; sonst wie bisher.
  const choices: readonly number[] =
    row.source === 'custom_meal' ? CUSTOM_MEAL_PORTION_CHOICES : FOOD_LOG_PORTION_CHOICES;
  const portions = choices.includes(portion)
    ? [...choices]
    : [...choices, portion].sort((a, b) => a - b);

  return (
    <View style={{ gap: 12 }} testID="food-log-edit">
      <Card>
        <Heading level={2}>{title}</Heading>
        <Body muted>{entryDetailText(entry, showNumbers)}</Body>
      </Card>
      {!editable ? (
        <Notice tone="info">{t.foodLog.tooOldEdit}</Notice>
      ) : (
        <>
          {isPlan ? (
            <Body muted>{t.foodLog.planItemFixed}</Body>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Heading level={2}>{t.foodLog.dateQuestion}</Heading>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={`← ${t.foodLog.earlier}`}
                      variant="secondary"
                      disabled={date <= oldest}
                      onPress={() => setDate(addDays(date, -1))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={`${t.foodLog.later} →`}
                      variant="secondary"
                      disabled={date >= today}
                      onPress={() => setDate(addDays(date, 1))}
                    />
                  </View>
                </View>
                <Body>{foodLogDayText(date, today)}</Body>
              </View>
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
            </>
          )}
          {row.source === 'quick' ? (
            <QuickFields
              showNumbers={showNumbers}
              initial={{
                label: row.title_de as QuickEntryLabel,
                kcal: row.kcal,
                protein_g: row.protein_g,
                carbs_g: row.carbs_g,
                fat_g: row.fat_g,
              }}
              busy={busy}
              submitLabel={t.foodLog.save}
              onSubmit={(input) =>
                onSubmit(
                  relocate(
                    // Ohne Zahlen bleiben vorhandene Werte erhalten (sie sind nur ausgeblendet).
                    quickEntry(
                      showNumbers
                        ? input
                        : {
                            ...input,
                            kcal: row.kcal,
                            protein_g: row.protein_g,
                            carbs_g: row.carbs_g,
                            fat_g: row.fat_g,
                          },
                      { id: row.id, date: row.eaten_on, slot: row.slot },
                    ),
                  ),
                )
              }
            />
          ) : (
            <>
              {row.amount !== null && row.unit !== null ? (
                <TextField
                  label={`${t.foodLog.amountLabel} (${unitText(row.unit)})`}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  maxLength={7}
                  error={amountError}
                  testID="food-log-edit-amount"
                />
              ) : (
                <ChoiceList
                  label={t.foodLog.servingsLabel}
                  horizontal
                  options={portions.map((value) => ({ value, label: portionNumber(value) }))}
                  value={portion}
                  onChange={setPortion}
                />
              )}
              <Button
                label={t.foodLog.save}
                loading={busy}
                onPress={() => {
                  if (row.amount !== null) {
                    const value = parseDecimal(amount);
                    if (value === null || Number.isNaN(value)) {
                      setAmountError(t.foodLog.amountInvalid);
                      return;
                    }
                    setAmountError(undefined);
                    onSubmit(
                      relocate(
                        value === row.amount
                          ? { ok: true, entry }
                          : rebuildEntry(entry, { amount: value }, sources),
                      ),
                    );
                    return;
                  }
                  onSubmit(
                    relocate(
                      portion === row.portion
                        ? { ok: true, entry }
                        : rebuildEntry(entry, { portion }, sources),
                    ),
                  );
                }}
                testID="food-log-edit-save"
              />
            </>
          )}
        </>
      )}
      <Button
        label={t.foodLog.delete}
        accessibilityLabel={t.foodLog.deleteA11y(title)}
        variant="danger"
        disabled={busy}
        onPress={() => setConfirmDelete(true)}
        testID="food-log-edit-delete"
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={t.foodLog.deleteTitle}
        message={t.foodLog.deleteText}
        confirmLabel={t.foodLog.delete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        testID="food-log-edit-delete-dialog"
      />
    </View>
  );
}
