import {
  EMPTY_WORKOUT_FILTER,
  filterWorkouts,
  WORKOUT_CATEGORIES,
  WORKOUT_DURATION_FILTERS,
  type WorkoutCategory,
  type WorkoutDurationFilter,
  type WorkoutFilter,
  workoutsDoneOn,
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
  Heading,
  LoadingState,
  Notice,
  OptionButton,
} from '@/components/ui';
import { WorkoutCard } from '@/components/workouts';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useWorkoutLibrary } from '@/state/use-workouts';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Reiter „Workouts“ (docs/PLAN-WORKOUTS.md Abschnitt 4, Gründer-Wunsch „eigenes Menü“): Liste mit Filtern nach
 * Sternen, Dauer, Ziel und „ohne Geräte“; Karte mit Sternen und Wort. Filter und Sortierung aus packages/core
 * (filterWorkouts); heute Erledigtes über workoutsDoneOn.
 */
export default function WorkoutsScreen() {
  const router = useRouter();
  const app = useApp();
  const library = useWorkoutLibrary();
  const [filter, setFilter] = useState<WorkoutFilter>(EMPTY_WORKOUT_FILTER);
  const [live, setLive] = useState({ text: '', version: 0 });
  const today = berlinTodayIso();

  const workouts = library.kind === 'ready' ? library.workouts : null;
  const shown = useMemo(
    () => (workouts ? filterWorkouts(workouts, filter) : []),
    [workouts, filter],
  );
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
  }, [shown.length, filter, workouts]);

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
    <Screen title={t.workouts.title} intro={t.workouts.intro} testID="workouts">
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
          <Card>
            <View style={styles.section} testID="workouts-filters">
              <Heading level={2}>{t.workouts.filters.title}</Heading>
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
                  setFilter((current) => ({ ...current, duration: value === 'all' ? null : value }))
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
                  setFilter((current) => ({ ...current, category: value === 'all' ? null : value }))
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
          <Body testID="workouts-count">{t.workouts.count(shown.length)}</Body>
          {shown.length === 0 ? (
            <Notice testID="workouts-no-match">{t.workouts.noMatch}</Notice>
          ) : null}
          <View style={styles.list} testID="workouts-list">
            {shown.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                doneToday={done.has(workout.id)}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm + 4 },
});
