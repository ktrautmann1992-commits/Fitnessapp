import {
  EMPTY_WORKOUT_FILTER,
  filterWorkouts,
  visibleWorkouts,
  WORKOUT_CATEGORIES,
  WORKOUT_DURATION_FILTERS,
  WORKOUT_LIST_DRAFT_CATEGORIES,
  WORKOUT_THEMES,
  type WorkoutCategory,
  type WorkoutDurationFilter,
  type WorkoutFilter,
  type WorkoutTheme,
  workoutsDoneOn,
  workoutsForTheme,
  workoutThemeCounts,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  ErrorState,
  LoadingState,
  Notice,
  OptionButton,
} from '@/components/ui';
import { TrainingSwitch } from '@/components/training-switch';
import { WorkoutCard } from '@/components/workouts';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useExerciseLookup, useFlowSafety } from '@/state/use-flow-safety';
import { useWorkoutEquipment, useWorkoutLibrary } from '@/state/use-workouts';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Reiter „Workouts“ (docs/PLAN-WORKOUTS.md Abschnitt 4, Gründer-Wunsch „eigenes Menü“): Liste mit Filtern nach
 * Sternen, Dauer, Ziel und „ohne Geräte“; Karte mit Sternen und Wort. Filter und Sortierung aus packages/core
 * (filterWorkouts); heute Erledigtes über workoutsDoneOn. Bereiche (Gründer-Wunsch 29.10.2026: Entspannung, Yoga &
 * Pilates, Hyrox, Calisthenics, CrossFit-Stil, Neues ausprobieren) immer sichtbar über der Liste – für jeden, unabhängig
 * vom Plan (workoutsForTheme). Fehlende Geräte: Hinweis auf der Karte statt Ausblenden.
 */
export default function WorkoutsScreen() {
  const router = useRouter();
  const app = useApp();
  const library = useWorkoutLibrary();
  const [filter, setFilter] = useState<WorkoutFilter>(EMPTY_WORKOUT_FILTER);
  const [live, setLive] = useState({ text: '', version: 0 });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [theme, setTheme] = useState<WorkoutTheme | null>(null);
  const equipment = useWorkoutEquipment();
  const today = berlinTodayIso();

  const workouts = library.kind === 'ready' ? library.workouts : null;
  const flowSafety = useFlowSafety();
  const lookup = useExerciseLookup();
  // Sportarten Stufe 1 (Yoga/Pilates/Mobility): Entwürfe nur, wenn die Quelle sie zulässt (Testmodus-Bündel; Supabase
  // liefert nur freigegebene). Flow-Routinen mit zu wenigen passenden Posen blendet der Sicherheitsfilter aus.
  const listed = useMemo(() => {
    if (!workouts) return [];
    // Lauf-Kraft-Entwürfe hängen weiter nur am Laufplan (nicht in der Liste).
    const listed = filterWorkouts(workouts, filter, { includeDrafts: true }).filter(
      (w) =>
        w.status === 'published' ||
        w.format === 'flow' ||
        WORKOUT_LIST_DRAFT_CATEGORIES.includes(w.category),
    );
    return lookup ? visibleWorkouts(listed, flowSafety, lookup) : listed;
  }, [workouts, filter, flowSafety, lookup]);
  // Bereiche nach Filtern und Sicherheitsfilter: „Neues ausprobieren“ wählt nur aus, was die Person sehen darf.
  const shown = useMemo(() => workoutsForTheme(listed, theme), [listed, theme]);
  const themeCounts = useMemo(() => workoutThemeCounts(listed), [listed]);
  const done = useMemo(
    () => workoutsDoneOn(workouts ?? [], app.rows?.sessionLogs ?? [], today),
    [app.rows?.sessionLogs, today, workouts],
  );

  // Trefferzahl für Bildschirmleser ansagen, sobald sich ein Filter ändert (nicht beim ersten Laden).
  const first = useRef(true);
  useEffect(() => {
    if (!workouts) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setLive((current) => ({
      text: t.workouts.filters.resultLive(shown.length),
      version: current.version + 1,
    }));
  }, [shown.length, filter, theme, workouts]);

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

  const toggleStar = (n: number) =>
    setFilter((current) => ({
      ...current,
      stars: current.stars.includes(n)
        ? current.stars.filter((x) => x !== n)
        : [...current.stars, n].sort(),
    }));
  const filtered =
    filter.stars.length > 0 ||
    filter.duration !== null ||
    filter.category !== null ||
    filter.noEquipment;

  return (
    <Screen area="training" icon="dumbbell" title={t.today.title} testID="workouts">
      {/* „App verschlanken“ (26.10.2026): Workouts sind ein Teil des Reiters „Training“ (Umschalter oben). */}
      <TrainingSwitch selected="workouts" prefix="workouts" />
      <LiveRegion text={live.text} version={live.version} />
      {library.kind === 'loading' ? <LoadingState label={t.workouts.loading} /> : null}
      {library.kind === 'error' ? (
        <ErrorState message={t.workouts.loadFailed} onRetry={library.retry} />
      ) : null}
      {library.kind === 'ready' && library.cached ? (
        <Notice tone="warning">{t.workouts.offlineCached}</Notice>
      ) : null}
      {workouts && workouts.length === 0 ? (
        <Notice testID="workouts-empty">{t.workouts.empty}</Notice>
      ) : null}
      {workouts && workouts.length > 0 ? (
        <>
          {/* Bereiche: immer sichtbar (Gründer-Wunsch 29.10.2026), Chips mit Anzahl. */}
          <View style={styles.section} testID="workouts-themes">
            <Body muted>{t.workouts.themes.label}</Body>
            <View style={styles.chips}>
              <OptionButton
                role="radio"
                compact
                label={t.workouts.themes.all}
                selected={theme === null}
                onPress={() => setTheme(null)}
                testID="workouts-theme-all"
              />
              {WORKOUT_THEMES.map((value) => {
                const name = t.workouts.themes.names[value];
                return (
                  <OptionButton
                    key={value}
                    role="radio"
                    compact
                    label={t.workouts.themes.chip(name, themeCounts[value])}
                    accessibilityLabel={t.workouts.themes.chipA11y(name, themeCounts[value])}
                    selected={theme === value}
                    onPress={() => setTheme(theme === value ? null : value)}
                    testID={`workouts-theme-${value}`}
                  />
                );
              })}
            </View>
            {theme !== null ? (
              <Body testID="workouts-theme-intro">{t.workouts.themes.intro[theme]}</Body>
            ) : null}
          </View>
          {/* Filter zugeklappt (Entwurf 2-training: 18 Filter standen immer offen über der Liste). */}
          <View style={styles.filterRow}>
            <Button
              label={filtered ? t.workouts.filters.titleActive : t.workouts.filters.title}
              icon="filter"
              variant="secondary"
              compact
              expanded={filtersOpen}
              onPress={() => setFiltersOpen((v) => !v)}
              testID="workouts-filter-toggle"
            />
            {filtered && !filtersOpen ? (
              <Button
                label={t.workouts.resetFilters}
                variant="link"
                onPress={() => setFilter(EMPTY_WORKOUT_FILTER)}
                testID="workouts-filter-reset-top"
              />
            ) : null}
          </View>
          {filtersOpen ? (
            <Card>
              <View style={styles.section} testID="workouts-filters">
                <Body>{t.workouts.filters.stars}</Body>
                <View style={styles.chips} accessibilityLabel={t.workouts.filters.stars}>
                  {STARS.map((n) => (
                    <OptionButton
                      key={n}
                      role="checkbox"
                      compact
                      label={t.workouts.filters.starsChip(n)}
                      accessibilityLabel={t.workouts.filters.starsChipA11y(n)}
                      selected={filter.stars.includes(n)}
                      onPress={() => toggleStar(n)}
                      testID={`workouts-filter-stars-${n}`}
                    />
                  ))}
                </View>
                <ChoiceList<WorkoutDurationFilter | 'all'>
                  label={t.workouts.filters.duration}
                  horizontal
                  options={[
                    {
                      value: 'all',
                      label: t.workouts.filters.all,
                      testID: 'workouts-filter-duration-all',
                    },
                    ...WORKOUT_DURATION_FILTERS.map((value) => ({
                      value,
                      label: t.workouts.filters.durations[value],
                      testID: `workouts-filter-duration-${value}`,
                    })),
                  ]}
                  value={filter.duration ?? 'all'}
                  onChange={(value) =>
                    setFilter((current) => ({
                      ...current,
                      duration: value === 'all' ? null : value,
                    }))
                  }
                />
                <ChoiceList<WorkoutCategory | 'all'>
                  label={t.workouts.filters.category}
                  horizontal
                  options={[
                    {
                      value: 'all',
                      label: t.workouts.filters.all,
                      testID: 'workouts-filter-category-all',
                    },
                    ...WORKOUT_CATEGORIES.map((value) => ({
                      value,
                      label: t.workouts.categories[value],
                      testID: `workouts-filter-category-${value}`,
                    })),
                  ]}
                  value={filter.category ?? 'all'}
                  onChange={(value) =>
                    setFilter((current) => ({
                      ...current,
                      category: value === 'all' ? null : value,
                    }))
                  }
                />
                <Checkbox
                  label={t.workouts.filters.noEquipment}
                  checked={filter.noEquipment}
                  onChange={(checked) =>
                    setFilter((current) => ({ ...current, noEquipment: checked }))
                  }
                  testID="workouts-filter-no-equipment"
                />
                {filtered ? (
                  <Button
                    label={t.workouts.resetFilters}
                    variant="link"
                    onPress={() => setFilter(EMPTY_WORKOUT_FILTER)}
                    testID="workouts-filter-reset"
                  />
                ) : null}
              </View>
            </Card>
          ) : null}
          <Body testID="workouts-count">{t.workouts.count(shown.length)}</Body>
          {shown.length === 0 ? (
            <Notice testID="workouts-no-match">
              {theme !== null && listed.length > 0 ? t.workouts.themes.empty : t.workouts.noMatch}
            </Notice>
          ) : null}
          {shown.length === 0 && (theme !== null || filtered) ? (
            <View style={styles.filterRow}>
              {theme !== null ? (
                <Button
                  label={t.workouts.themes.showAll}
                  variant="link"
                  onPress={() => setTheme(null)}
                  testID="workouts-theme-reset"
                />
              ) : null}
              {filtered ? (
                <Button
                  label={t.workouts.resetFilters}
                  variant="link"
                  onPress={() => setFilter(EMPTY_WORKOUT_FILTER)}
                  testID="workouts-no-match-reset"
                />
              ) : null}
            </View>
          ) : null}
          <View style={styles.list} testID="workouts-list">
            {shown.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                doneToday={done.has(workout.id)}
                available={equipment}
                onPress={() => router.push(`/workouts/${workout.id}` as Href)}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm + 4 },
});
