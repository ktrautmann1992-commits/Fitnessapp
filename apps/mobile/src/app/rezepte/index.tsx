import {
  type DietType,
  RECIPE_CATEGORIES,
  RECIPE_SEARCH_COST_STEPS_EUR,
  type RecipeCategoryId,
  type RecipeSearchQuery,
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
import { recipeSearchForPerson, type RecipeSearchCard } from '@/data/recipe-search';
import { t } from '@/i18n';
import { formatKcal } from '@/lib/nutrition-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

const CATEGORY_NAMES = new Map(RECIPE_CATEGORIES.map((c) => [c.id, c.name_de]));

interface Filters {
  text: string;
  diets: DietType[];
  categories: RecipeCategoryId[];
  section: string | null;
  quick: boolean;
  maxCostEur: number | null;
}

const EMPTY: Filters = {
  text: '',
  diets: [],
  categories: [],
  section: null,
  quick: false,
  maxCostEur: null,
};

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Rezeptsuche (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.5, Etappe N5c): gratis und regelbasiert (keine Echtzeit-KI).
 * Ernährungsform aus dem Profil vorbelegt und erweiterbar (K3) – Treffer außerhalb sind gekennzeichnet und kommen nie
 * in den automatischen Essensplan (G4). Alle anderen Ausschlüsse (Schwein, Unverträglichkeiten, „mag ich nicht“,
 * Schwangerschaft) wirken hart über `filter.ts` und sind nicht abschaltbar. „Kalorienzahlen aus“: keine kcal auf
 * den Karten; sortiert wird nie nach kcal (alphabetisch).
 */
export default function RecipeSearchScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const query = useMemo((): RecipeSearchQuery => {
    const text = filters.text.trim();
    return {
      diets: filters.diets,
      categories: filters.categories,
      quick: filters.quick,
      ...(filters.section !== null ? { section: filters.section } : {}),
      ...(filters.maxCostEur !== null ? { maxCostEur: filters.maxCostEur } : {}),
      ...(text !== '' ? { text: text.slice(0, 100) } : {}),
    };
  }, [filters]);

  const result = useMemo(() => {
    if (!app.rows || view.week?.kind !== 'ready' || view.library.kind !== 'ready') return null;
    try {
      return recipeSearchForPerson({
        library: view.library.result.library,
        rows: app.rows,
        versions: app.versions,
        week: view.week,
        allowDrafts: app.backend.mode === 'local',
        query,
      });
    } catch {
      return 'error' as const;
    }
  }, [app.backend.mode, app.rows, app.versions, query, view.library, view.week]);

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
  const texts = t.nutrition.search;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={texts.title} testID="recipe-search" footer={footer}>
      {children}
    </Screen>
  );
  if (!nutritionReady(view) || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  if (result === null) return shell(<LoadingState label={t.nutrition.loading} />);
  if (result === 'error') return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  if (result.kind === 'blocked') return shell(<ConsentBlockedNotice reason={result.reason} />);
  if (result.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  const { demo, library } = view.library.result;
  if (library.recipes.length === 0) {
    return shell(
      <Body muted testID="recipe-search-no-recipes">
        {texts.emptyLibrary}
      </Body>,
    );
  }
  const dietName = (diet: DietType) => t.nutrition.dietNames[diet];
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered =
    filters.text.trim() !== '' ||
    filters.diets.length > 0 ||
    filters.categories.length > 0 ||
    filters.section !== null ||
    filters.quick ||
    filters.maxCostEur !== null;

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Body muted>{texts.intro}</Body>
      <TextField
        label={texts.textLabel}
        hint={texts.textHint}
        value={filters.text}
        maxLength={100}
        onChangeText={(text) => update({ text })}
        testID="recipe-search-text"
      />

      <View style={styles.group}>
        <Heading level={2}>{texts.dietTitle}</Heading>
        <Body testID="recipe-search-diet">{texts.dietOwn(dietName(result.profileDiet))}</Body>
        {result.dietOptions.length > 0 ? (
          <>
            <View style={styles.chips}>
              {result.dietOptions.map((diet) => (
                <OptionButton
                  key={diet}
                  role="checkbox"
                  compact
                  label={texts.dietAlso(dietName(diet))}
                  selected={filters.diets.includes(diet)}
                  onPress={() => update({ diets: toggle(filters.diets, diet) })}
                />
              ))}
            </View>
            <Body muted>{texts.dietHint}</Body>
          </>
        ) : null}
      </View>

      <View style={styles.chips}>
        <OptionButton
          role="checkbox"
          compact
          label={texts.quick}
          selected={filters.quick}
          onPress={() => update({ quick: !filters.quick })}
        />
      </View>

      {result.categories.length > 0 ? (
        <View style={styles.group}>
          <Heading level={2}>{texts.categoryTitle}</Heading>
          <View style={styles.chips}>
            {result.categories.map((id) => (
              <OptionButton
                key={id}
                role="checkbox"
                compact
                label={CATEGORY_NAMES.get(id) ?? id}
                selected={filters.categories.includes(id)}
                onPress={() => update({ categories: toggle(filters.categories, id) })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {result.sections.length > 0 ? (
        <View style={styles.group}>
          <Heading level={2}>{texts.sectionTitle}</Heading>
          <View style={styles.chips}>
            {result.sections.map((section) => (
              <OptionButton
                key={section}
                role="radio"
                compact
                label={section}
                selected={filters.section === section}
                onPress={() => update({ section: filters.section === section ? null : section })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {result.hasReviewedCosts ? (
        <View style={styles.group}>
          <Heading level={2}>{texts.costTitle}</Heading>
          <View style={styles.chips}>
            {RECIPE_SEARCH_COST_STEPS_EUR.map((eur) => (
              <OptionButton
                key={eur}
                role="radio"
                compact
                label={texts.costStep(eur)}
                selected={filters.maxCostEur === eur}
                onPress={() => update({ maxCostEur: filters.maxCostEur === eur ? null : eur })}
              />
            ))}
          </View>
          <Body muted>{texts.costHint}</Body>
        </View>
      ) : null}

      {filtered ? (
        <Button
          label={texts.reset}
          variant="link"
          onPress={() => setFilters(EMPTY)}
          testID="recipe-search-reset"
        />
      ) : null}

      <Text
        accessibilityLiveRegion="polite"
        aria-live="polite"
        style={styles.count}
        testID="recipe-search-count"
      >
        <Body>{texts.results(result.cards.length)}</Body>
      </Text>
      {result.cards.length === 0 ? (
        <Notice tone="info" testID="recipe-search-empty">
          {texts.empty}
        </Notice>
      ) : (
        <View style={styles.list} testID="recipe-search-results">
          {result.cards.map((card) => (
            <RecipeCard
              key={card.id}
              card={card}
              showNumbers={view.showNumbers}
              onOpen={() =>
                router.push(
                  `/rezept/${encodeURIComponent(card.id)}${
                    card.outsideProfileDiet ? `?form=${card.outsideProfileDiet}` : ''
                  }` as Href,
                )
              }
            />
          ))}
        </View>
      )}
      <Body muted>{t.nutrition.disclaimer}</Body>
    </>,
  );
}

function RecipeCard({
  card,
  showNumbers,
  onOpen,
}: {
  card: RecipeSearchCard;
  showNumbers: boolean;
  onOpen: () => void;
}) {
  const theme = useThemeColors();
  const texts = t.nutrition.search;
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
      accessibilityLabel={texts.cardA11y(card.title)}
      onPress={onOpen}
      testID={`recipe-search-hit-${card.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: pressed ? theme.background : theme.surface,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>{card.title}</Text>
      <Text style={[styles.detail, { color: theme.textMuted }]}>{details.join(' · ')}</Text>
      {card.outsideProfileDiet ? (
        <Text
          style={[styles.marker, { color: theme.text, borderColor: theme.border }]}
          testID={`recipe-search-hit-${card.id}-outside`}
        >
          {texts.outsideDiet(t.nutrition.dietNames[card.outsideProfileDiet])}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  count: { fontSize: fontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  card: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
  marker: {
    alignSelf: 'flex-start',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
});
