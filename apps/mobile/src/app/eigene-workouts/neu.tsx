import {
  buildCustomWorkout,
  type CustomBuildResult,
  CUSTOM_WORKOUT_AREAS,
  CUSTOM_WORKOUT_RULES,
  type CustomWorkoutArea,
  EQUIPMENT,
  type Exercise,
  isOptionalAid,
  searchCustomExercises,
  suggestCustomWorkoutName,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CustomWorkoutEditor } from '@/components/custom-workout-editor';
import { ExerciseChoice, ExerciseSearchSheet } from '@/components/my-workouts';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  OptionButton,
} from '@/components/ui';
import { newId } from '@/data/create-backend';
import { customBuildContextFor } from '@/data/my-workouts-view';
import { deMyWorkouts } from '@/i18n/de-my-workouts';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useMyWorkouts } from '@/state/use-my-workouts';
import { useWorkoutEquipment } from '@/state/use-workouts';

const D = deMyWorkouts;
const STEPS = 5;

/**
 * „Eigenes Workout erstellen“ (Gründer-Wunsch 18.11.2026, docs/PLAN-EIGENE-WORKOUTS.md 1): fünf kurze Schritte – Dauer,
 * Muskelgruppen, Geräte (vorausgewählt aus dem Profil), Lieblingsübungen, „Mag ich nicht“ – dann baut packages/core
 * (buildCustomWorkout) das Workout und die Vorschau zeigt es zum Annehmen oder Bearbeiten. „Mag ich nicht“ wird auch
 * als Vorliebe gespeichert (exercise_dislikes), damit Tausch und eigene Workouts die Übung künftig auslassen.
 */
export default function NewCustomWorkoutScreen() {
  const router = useRouter();
  const app = useApp();
  const mine = useMyWorkouts();
  const profileEquipment = useWorkoutEquipment();
  const { ensureLibrary } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  const [step, setStep] = useState(1);
  const [minutes, setMinutes] = useState<number>(30);
  const [areas, setAreas] = useState<CustomWorkoutArea[]>([]);
  const [equipment, setEquipment] = useState<string[] | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[] | null>(null);
  const [search, setSearch] = useState<'favorites' | 'dislikes' | null>(null);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string>();
  const [built, setBuilt] = useState<{ result: CustomBuildResult; rowId: string } | null>(null);
  const [buildError, setBuildError] = useState<string>();

  const lib = app.library.kind === 'ready' ? app.library.library : null;
  const library = lib?.exercises ?? null;
  const savedDislikes = useMemo(
    () => (mine.data?.dislikes ?? []).map((d) => d.exercise_id),
    [mine.data],
  );
  const chosenEquipment =
    equipment ?? [...(profileEquipment ?? [])].filter((id) => !isOptionalAid(id));
  const chosenDislikes = dislikes ?? savedDislikes;
  const equipmentOptions = useMemo(() => {
    const preset = new Set(profileEquipment ?? []);
    return EQUIPMENT.filter(
      (item) =>
        !isOptionalAid(item.id) &&
        item.id !== 'other' &&
        (item.homeSelectable || preset.has(item.id)),
    );
  }, [profileEquipment]);
  const results = useMemo(
    () => (library ? searchCustomExercises(library, query, { limit: 30 }) : []),
    [library, query],
  );

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
  const toList = () => (router.canGoBack() ? router.back() : router.replace('/workouts' as Href));

  if (built?.result.definition) {
    return (
      <Screen
        area="workouts"
        icon="stopwatch"
        title={D.preview.title}
        testID="custom-preview"
        footer={
          <Button
            label={D.preview.backToList}
            variant="secondary"
            onPress={toList}
            testID="custom-back"
          />
        }
      >
        <CustomWorkoutEditor
          key={built.rowId}
          rowId={built.rowId}
          initialDefinition={built.result.definition}
          initialIssues={built.result.issues}
          initialName={suggestCustomWorkoutName(built.result.definition.input)}
          existing={false}
        />
      </Screen>
    );
  }

  const names = (ids: readonly string[]) =>
    ids.map((id) => lib?.exercises.get(id)).filter((e): e is Exercise => e !== undefined);

  async function create() {
    if (!library || !app.rows) return;
    setBuildError(undefined);
    // „Mag ich nicht“ als Vorliebe merken (geht offline; Fehler hier verhindern das Bauen nicht).
    const before = new Set(savedDislikes);
    const after = new Set(chosenDislikes);
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    try {
      if (added.length > 0) await mine.setDislikes(added, true);
      if (removed.length > 0) await mine.setDislikes(removed, false);
    } catch {
      // Die Auswahl gilt trotzdem für dieses Workout (input.dislike_ids).
    }
    const ctx = customBuildContextFor(app.rows, app.safetyRules, new Set(chosenDislikes));
    const result = buildCustomWorkout(
      {
        minutes,
        areas,
        equipment_ids: chosenEquipment,
        favorite_ids: favorites,
        dislike_ids: chosenDislikes.slice(0, CUSTOM_WORKOUT_RULES.maxDislikes),
        seed: Math.floor(Math.random() * 1_000_000_000),
      },
      library,
      ctx,
    );
    if (!result.definition) {
      setBuildError(D.preview.noWork);
      return;
    }
    setBuilt({ result, rowId: newId() });
  }

  function next() {
    if (step === 2 && areas.length === 0) {
      setProblem(D.wizard.chooseArea);
      return;
    }
    setProblem(undefined);
    if (step < STEPS) setStep(step + 1);
    else void create();
  }

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const pickFromSearch = (exercise: Exercise) => {
    if (search === 'favorites') {
      setFavorites((list) => (list.length >= 12 ? list : toggle(list, exercise.id)));
      setDislikes((list) => (list ?? savedDislikes).filter((id) => id !== exercise.id));
    } else {
      setDislikes((list) => toggle(list ?? savedDislikes, exercise.id));
      setFavorites((list) => list.filter((id) => id !== exercise.id));
    }
  };

  const chosenList = (ids: readonly string[], onRemove: (id: string) => void, prefix: string) =>
    names(ids).length > 0 ? (
      <View style={styles.list} testID={`${prefix}-chosen`}>
        <Body muted>{D.wizard.chosen}</Body>
        {names(ids).map((exercise) => (
          <ExerciseChoice
            key={exercise.id}
            exercise={exercise}
            selected
            onPress={() => onRemove(exercise.id)}
            accessibilityLabel={D.wizard.remove(exercise.name_de)}
            testID={`${prefix}-chosen-${exercise.id}`}
          />
        ))}
      </View>
    ) : null;

  return (
    <Screen
      area="workouts"
      icon="stopwatch"
      title={D.wizard.title}
      progress={{ current: step, total: STEPS }}
      testID="custom-wizard"
      footer={
        <View style={styles.footer}>
          <Button
            label={step < STEPS ? D.wizard.next : D.wizard.build}
            onPress={next}
            disabled={step === STEPS && !library}
            testID="custom-next"
          />
          <Button
            label={step > 1 ? D.wizard.back : D.wizard.cancel}
            variant="secondary"
            onPress={() => (step > 1 ? setStep(step - 1) : toList())}
            testID="custom-step-back"
          />
        </View>
      }
    >
      {step === 1 ? (
        <View style={styles.section} testID="custom-step-duration">
          <Heading level={2}>{D.wizard.durationTitle}</Heading>
          <View style={styles.chips}>
            {CUSTOM_WORKOUT_RULES.minutes.map((m) => (
              <OptionButton
                key={m}
                role="radio"
                compact
                label={D.wizard.durationChip(m)}
                selected={minutes === m}
                onPress={() => setMinutes(m)}
                testID={`custom-minutes-${m}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      {step === 2 ? (
        <View style={styles.section} testID="custom-step-areas">
          <Heading level={2}>{D.wizard.areasTitle}</Heading>
          <Body muted>{D.wizard.areasHint}</Body>
          <View style={styles.chips}>
            {CUSTOM_WORKOUT_AREAS.map((area) => (
              <OptionButton
                key={area}
                role="checkbox"
                compact
                label={D.areas[area]}
                selected={areas.includes(area)}
                onPress={() => {
                  setAreas((list) => toggle(list, area));
                  setProblem(undefined);
                }}
                testID={`custom-area-${area}`}
              />
            ))}
          </View>
          <FieldError message={problem} />
        </View>
      ) : null}
      {step === 3 ? (
        <View style={styles.section} testID="custom-step-equipment">
          <Heading level={2}>{D.wizard.equipmentTitle}</Heading>
          <Body muted>{D.wizard.equipmentHint}</Body>
          <View style={styles.chips}>
            {equipmentOptions.map((item) => (
              <OptionButton
                key={item.id}
                role="checkbox"
                compact
                label={item.nameDe}
                selected={chosenEquipment.includes(item.id)}
                onPress={() => setEquipment(toggle(chosenEquipment, item.id))}
                testID={`custom-equipment-${item.id}`}
              />
            ))}
          </View>
          <Button
            label={D.wizard.noEquipment}
            variant="link"
            onPress={() => setEquipment([])}
            testID="custom-equipment-none"
          />
        </View>
      ) : null}
      {step === 4 ? (
        <View style={styles.section} testID="custom-step-favorites">
          <Heading level={2}>{D.wizard.favoritesTitle}</Heading>
          <Body muted>{D.wizard.favoritesHint}</Body>
          <Button
            label={D.wizard.search}
            icon="plus"
            variant="secondary"
            onPress={() => {
              setQuery('');
              setSearch('favorites');
            }}
            testID="custom-favorites-search"
          />
          {chosenList(
            favorites,
            (id) => setFavorites((list) => list.filter((x) => x !== id)),
            'custom-favorites',
          )}
        </View>
      ) : null}
      {step === 5 ? (
        <View style={styles.section} testID="custom-step-dislikes">
          <Heading level={2}>{D.wizard.dislikesTitle}</Heading>
          <Body muted>{D.wizard.dislikesHint}</Body>
          <Button
            label={D.wizard.search}
            icon="plus"
            variant="secondary"
            onPress={() => {
              setQuery('');
              setSearch('dislikes');
            }}
            testID="custom-dislikes-search"
          />
          {chosenList(
            chosenDislikes,
            (id) => setDislikes((chosenDislikes as string[]).filter((x) => x !== id)),
            'custom-dislikes',
          )}
          {buildError ? (
            <Notice tone="warning" testID="custom-build-error">
              {buildError}
            </Notice>
          ) : null}
          {!library ? <LoadingState /> : null}
        </View>
      ) : null}
      <ExerciseSearchSheet
        visible={search !== null}
        title={search === 'favorites' ? D.wizard.favoritesTitle : D.wizard.dislikesTitle}
        query={query}
        onQuery={setQuery}
        results={results}
        onPick={pickFromSearch}
        onClose={() => setSearch(null)}
        emptyText={D.wizard.searchEmpty}
        selectedIds={new Set(search === 'favorites' ? favorites : chosenDislikes)}
        testID="custom-search"
        needsQuery
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
});
