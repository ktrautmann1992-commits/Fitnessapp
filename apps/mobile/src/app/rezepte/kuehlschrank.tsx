import {
  FRIDGE_SEARCH,
  type FridgeFoodOption,
  isSeasoningFood,
  normalizeFoodText,
  SHOPPING_CATEGORY_LABELS_DE,
  type ShoppingCategory,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ConsentBlockedNotice,
  DemoBanner,
  NutritionGate,
  nutritionReady,
} from '@/components/nutrition';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  Heading,
  LoadingState,
  MIN_TOUCH,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import {
  type FridgeSearchCard,
  fridgeSearchResults,
  prepareFridgeSearch,
} from '@/data/fridge-search';
import { t } from '@/i18n';
import { formatKcal } from '@/lib/nutrition-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/** Auswahl nach Abteilung gruppiert (Reihenfolge der Abteilungen kommt sortiert aus dem Core). */
function groupByCategory(
  options: readonly FridgeFoodOption[],
): [ShoppingCategory, FridgeFoodOption[]][] {
  const groups = new Map<ShoppingCategory, FridgeFoodOption[]>();
  for (const option of options) {
    const list = groups.get(option.category) ?? [];
    list.push(option);
    groups.set(option.category, list);
  }
  return [...groups.entries()];
}

/**
 * Kühlschrank-Suche „Was habe ich da?“ (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11): gratis und regelbasiert (keine
 * Echtzeit-KI). Zutaten antippen → Rezepte nach Übereinstimmung (Menge gewichtet, Vorrat/Gewürze wenig). Alle harten
 * Ausschlüsse (Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“, Schwangerschaft) wirken über
 * `filter.ts` und sind nicht abschaltbar. Die Auswahl lebt nur im Zustand dieser Ansicht – nicht in der Adresse,
 * nicht im Gerätespeicher. „Kalorienzahlen aus“: keine kcal auf den Karten; sortiert wird nie nach kcal.
 */
export default function FridgeSearchScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [shownCount, setShownCount] = useState<number>(FRIDGE_SEARCH.pageSize);

  // Einmal je Profil/Woche/Bestand – NICHT je Antippen (Wächter N11 S2): gefilterte Rezepte und Auswahlliste.
  const result = useMemo(() => {
    if (!app.rows || view.week?.kind !== 'ready' || view.library.kind !== 'ready') return null;
    try {
      return prepareFridgeSearch({
        library: view.library.result.library,
        rows: app.rows,
        versions: app.versions,
        week: view.week,
        allowDrafts: app.backend.mode === 'local',
      });
    } catch {
      return 'error' as const;
    }
  }, [app.backend.mode, app.rows, app.versions, view.library, view.week]);

  // Je Auswahl nur noch die Übereinstimmung; Karten (mit kcal) nur für die angezeigten Treffer.
  const found = useMemo(() => {
    if (result === null || result === 'error' || result.kind !== 'ok') return null;
    try {
      return fridgeSearchResults(result, selected, shownCount);
    } catch {
      return 'error' as const;
    }
  }, [result, selected, shownCount]);

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
  const texts = t.nutrition.fridge;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/rezepte' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={texts.title} testID="fridge-search" footer={footer}>
      {children}
    </Screen>
  );
  if (!nutritionReady(view) || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  if (result === null) return shell(<LoadingState label={t.nutrition.loading} />);
  if (result === 'error' || found === 'error')
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  if (result.kind === 'blocked') return shell(<ConsentBlockedNotice reason={result.reason} />);
  if (result.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  const { demo, library } = view.library.result;
  if (library.recipes.length === 0) {
    return shell(
      <Body muted testID="fridge-no-recipes">
        {texts.emptyLibrary}
      </Body>,
    );
  }
  if (result.options.length === 0) {
    return shell(
      <Notice tone="info" testID="fridge-no-options">
        {texts.noOptions}
      </Notice>,
    );
  }

  // Nur angebotene Zutaten zählen (eine Profiländerung kann Lebensmittel aus der Auswahl entfernen).
  const offered = new Map(result.options.map((o) => [o.foodId, o]));
  const active = selected.filter((id) => offered.has(id));
  const toggle = (foodId: string) => {
    if (active.includes(foodId)) {
      setSelected(active.filter((id) => id !== foodId));
      setLimitHit(false);
      setShownCount(FRIDGE_SEARCH.pageSize);
    } else if (active.length >= FRIDGE_SEARCH.maxSelectedFoods) {
      setLimitHit(true);
    } else {
      setSelected([...active, foodId]);
      setLimitHit(false);
      setShownCount(FRIDGE_SEARCH.pageSize);
    }
  };
  const cards = found?.cards ?? [];
  const total = found?.total ?? 0;
  const needle = normalizeFoodText(filter.trim());
  const visible =
    needle === ''
      ? result.options
      : result.options.filter((o) => normalizeFoodText(o.name).includes(needle));
  const onlySeasoning =
    active.length > 0 &&
    active.every((id) => {
      const option = offered.get(id);
      return option !== undefined && isSeasoningFood({ shopping_category: option.category });
    });

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Body muted>{texts.intro}</Body>
      <Body muted testID="fridge-privacy">
        {texts.privacy}
      </Body>

      <View style={styles.group}>
        <Heading level={2}>{texts.chooseTitle}</Heading>
        <TextField
          label={texts.filterLabel}
          hint={texts.filterHint}
          value={filter}
          maxLength={60}
          onChangeText={setFilter}
          testID="fridge-filter"
        />
        <Body muted>{texts.minorHint}</Body>
        {visible.length === 0 ? (
          <Body muted testID="fridge-no-option-match">
            {texts.noOptionMatch}
          </Body>
        ) : (
          groupByCategory(visible).map(([category, options]) => (
            <View key={category} style={styles.group}>
              <Text style={styles.category}>{SHOPPING_CATEGORY_LABELS_DE[category]}</Text>
              <View style={styles.chips}>
                {options.map((option) => (
                  <OptionButton
                    key={option.foodId}
                    role="checkbox"
                    compact
                    label={option.name}
                    selected={active.includes(option.foodId)}
                    onPress={() => toggle(option.foodId)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      <Text
        accessibilityLiveRegion="polite"
        aria-live="polite"
        style={styles.count}
        testID="fridge-selected"
      >
        <Body>{texts.selected(active.length)}</Body>
      </Text>
      {limitHit ? (
        <Notice tone="info" testID="fridge-limit">
          {texts.limit(FRIDGE_SEARCH.maxSelectedFoods)}
        </Notice>
      ) : null}
      {active.length > 0 ? (
        <Button
          label={texts.clear}
          variant="link"
          onPress={() => {
            setSelected([]);
            setLimitHit(false);
            setShownCount(FRIDGE_SEARCH.pageSize);
          }}
          testID="fridge-clear"
        />
      ) : null}

      <View style={styles.group}>
        <Heading level={2}>{texts.resultsTitle}</Heading>
        {active.length === 0 ? (
          <Notice tone="info" testID="fridge-empty-selection">
            {texts.emptySelection}
          </Notice>
        ) : total === 0 ? (
          <Notice tone="info" testID="fridge-empty">
            {onlySeasoning ? texts.onlySeasoning : texts.empty}
          </Notice>
        ) : (
          <>
            <Text
              accessibilityLiveRegion="polite"
              aria-live="polite"
              style={styles.count}
              testID="fridge-count"
            >
              <Body>{texts.results(total)}</Body>
            </Text>
            {found?.hasDrafts === true ? (
              <Notice tone="warning" testID="fridge-draft-warning">
                {texts.allergenWarning}
              </Notice>
            ) : null}
            <View style={styles.list} testID="fridge-results">
              {cards.map((card) => (
                <FridgeCard
                  key={card.id}
                  card={card}
                  showNumbers={view.showNumbers}
                  onOpen={() => router.push(`/rezept/${encodeURIComponent(card.id)}` as Href)}
                />
              ))}
            </View>
            {total > cards.length ? (
              <Button
                label={texts.more(total - cards.length)}
                variant="secondary"
                onPress={() => setShownCount((n) => n + FRIDGE_SEARCH.pageSize)}
                testID="fridge-more"
              />
            ) : null}
          </>
        )}
      </View>
      <Button
        label={texts.toSearch}
        variant="secondary"
        onPress={() => router.push('/rezepte' as Href)}
        testID="fridge-to-search"
      />
      <Body muted>{t.nutrition.disclaimer}</Body>
    </>,
  );
}

function FridgeCard({
  card,
  showNumbers,
  onOpen,
}: {
  card: FridgeSearchCard;
  showNumbers: boolean;
  onOpen: () => void;
}) {
  const theme = useThemeColors();
  const texts = t.nutrition.fridge;
  const details = [
    texts.minutes(card.totalMinutes),
    showNumbers && card.kcalPerServing !== null
      ? texts.kcal(formatKcal(card.kcalPerServing))
      : null,
    card.isDraft ? texts.draft : null,
  ].filter((part): part is string => part !== null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${texts.cardA11y(card.title)}, ${texts.matchA11y(card.percent)}`}
      onPress={onOpen}
      testID={`fridge-hit-${card.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: pressed ? theme.background : theme.surface,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.title, { color: theme.text }]}>{card.title}</Text>
        <Text
          style={[styles.match, { color: theme.text, borderColor: theme.border }]}
          testID={`fridge-hit-${card.id}-match`}
        >
          {texts.match(card.percent)}
        </Text>
      </View>
      <Text style={[styles.detail, { color: theme.textMuted }]}>{details.join(' · ')}</Text>
      <Text style={[styles.detail, { color: theme.text }]}>{texts.have(card.have.join(', '))}</Text>
      <Text style={[styles.detail, { color: theme.text }]} testID={`fridge-hit-${card.id}-missing`}>
        {card.missing.length === 0
          ? texts.missingNone
          : texts.missing(card.missing.join(', '), card.missingMore)}
      </Text>
      {card.missingMinor.length > 0 ? (
        <Text style={[styles.detail, { color: theme.textMuted }]}>
          {texts.missingMinor(card.missingMinor.join(', '))}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  count: { fontSize: fontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  list: { gap: spacing.sm },
  card: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, flexShrink: 1 },
  match: {
    alignSelf: 'flex-start',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
});
