import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { CustomWorkoutEditor } from '@/components/custom-workout-editor';
import { Screen } from '@/components/screen';
import { Button, ErrorState, LoadingState, Notice } from '@/components/ui';
import { myCustomWorkout } from '@/data/my-workouts-view';
import { deMyWorkouts } from '@/i18n/de-my-workouts';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useExerciseLookup } from '@/state/use-flow-safety';
import { useMyWorkouts } from '@/state/use-my-workouts';

const D = deMyWorkouts;

/**
 * Ein eigenes Workout aus „Meine Workouts“ (docs/PLAN-EIGENE-WORKOUTS.md 2): dieselbe Vorschau wie nach dem Erstellen –
 * Tracks bearbeiten, Übungen tauschen/entfernen/hinzufügen, umbenennen, speichern, starten, löschen.
 */
export default function CustomWorkoutScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const app = useApp();
  const mine = useMyWorkouts();
  const lookup = useExerciseLookup();
  const { ensureLibrary } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

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
  if (route !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={route as Href} />;
  }
  const back = (
    <Button
      label={D.preview.backToList}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/workouts' as Href))}
      testID="custom-back"
    />
  );
  if (mine.state.kind === 'error') {
    return (
      <Screen area="workouts" icon="stopwatch" footer={back}>
        <ErrorState message={D.list.loadFailed} onRetry={() => void mine.reload()} />
      </Screen>
    );
  }
  if (mine.state.kind !== 'ready' || lookup === null) {
    return (
      <Screen area="workouts" icon="stopwatch" footer={back}>
        <LoadingState />
      </Screen>
    );
  }
  const custom = myCustomWorkout(mine.data, lookup, params.id);
  if (!custom) {
    return (
      <Screen area="workouts" icon="stopwatch" footer={back} testID="custom-missing">
        <Notice tone="warning">{D.preview.notFound}</Notice>
      </Screen>
    );
  }
  return (
    <Screen
      area="workouts"
      icon="stopwatch"
      title={custom.row.name}
      testID="custom-detail"
      footer={back}
    >
      {mine.state.load.offline ? <Notice tone="warning">{D.list.offline}</Notice> : null}
      <CustomWorkoutEditor
        key={custom.row.id}
        rowId={custom.row.id}
        initialDefinition={custom.row.definition}
        initialName={custom.row.name}
        existing
      />
    </Screen>
  );
}
