import { prepareFlowWorkout, type Workout, workoutSafetyHints } from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { equipmentText, StarRating } from '@/components/workouts';
import { newId } from '@/data/create-backend';
import { activeRunStore, startActiveRun } from '@/data/workout-run';
import { t } from '@/i18n';
import { deYoga } from '@/i18n/de-yoga';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useExerciseLookup, useFlowSafety } from '@/state/use-flow-safety';
import { useActiveWorkoutRun, useWorkoutLibrary } from '@/state/use-workouts';
import { Text } from '@/components/text';

/**
 * Workout im Detail (docs/PLAN-WORKOUTS.md Abschnitt 4): Sterne, Dauer, Ablauf, Geräte, Übungen mit Dosierung,
 * Aufwärmen/Abschluss und Sicherheitshinweise (workoutSafetyHints aus packages/core – Hinweis, kein Verbot).
 * „Workout starten“ öffnet den Timer.
 */
export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const library = useWorkoutLibrary();
  const active = useActiveWorkoutRun();
  const flowSafety = useFlowSafety();
  // Inklusive Posen (Sportarten Stufe 1: Posen stehen nur in displayExercises).
  const exercises = useExerciseLookup();
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
      label={t.workouts.detail.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/workouts' as Href))}
      testID="workout-detail-back"
    />
  );
  if (library.kind !== 'ready') {
    return (
      <Screen area="workouts" icon="stopwatch" footer={back}>
        {library.kind === 'error' ? (
          <Notice tone="danger">{t.workouts.loadFailed}</Notice>
        ) : (
          <LoadingState label={t.workouts.loading} />
        )}
      </Screen>
    );
  }
  const original: Workout | undefined = library.workouts.find((w) => w.id === params.id);
  if (!original) {
    return (
      <Screen area="workouts" icon="stopwatch" footer={back} testID="workout-detail-missing">
        <Notice tone="warning">{t.workouts.detail.notFound}</Notice>
      </Screen>
    );
  }
  // Flow (Yoga/Pilates/Mobility): Sicherheitsfilter – Posen tauschen/entfallen, Halteposen kürzen (packages/core).
  const prepared =
    original.format === 'flow' && exercises
      ? prepareFlowWorkout(original, flowSafety, exercises)
      : null;
  const workout: Workout = prepared?.workout ?? original;
  const isFlow = workout.format === 'flow';
  const rules = app.safetyRules;
  const hints = workoutSafetyHints(
    workout,
    {
      // Ohne Angaben gilt die sichere Richtung (wie Einsteiger).
      beginner: rules?.beginnerTemplatesOnly ?? true,
      medicalNotice: rules?.medicalNotice ?? false,
      pregnancyNotice: rules?.pregnancyNotice ?? false,
      excludedCautionTags: rules?.excludedCautionTags ?? [],
    },
    exercises ?? new Map(),
  );
  const userId = app.session.userId;
  const resumable =
    active !== null &&
    active.workoutId === workout.id &&
    active.ownerUserId === userId &&
    !active.saved;
  const missing = workout.exercises.filter((item) => !exercises?.has(item.exercise_id));
  const hiddenFlow = prepared?.hidden === true;

  function start() {
    if (!resumable) beginRun(userId, workout);
    router.push(`/workout-timer/${workout.id}` as Href);
  }

  const how =
    workout.format === 'circuit'
      ? t.workouts.detail.circuitHow(workout.rounds)
      : workout.format === 'interval'
        ? t.workouts.detail.intervalHow(workout.rounds)
        : workout.format === 'flow'
          ? deYoga.detail.how
          : t.workouts.detail.setsHow;
  const swappedFrom = new Map(
    (prepared?.swapped ?? []).map((s) => [s.toId, exercises?.get(s.fromId)?.name_de ?? s.fromId]),
  );

  return (
    <Screen
      area="workouts"
      icon="stopwatch"
      title={workout.title_de}
      testID="workout-detail"
      footer={
        <View style={styles.footer}>
          <Button
            label={resumable ? t.workouts.detail.resume : t.workouts.detail.start}
            onPress={start}
            disabled={exercises === null || missing.length > 0 || hiddenFlow}
            testID="workout-start"
          />
          {back}
        </View>
      }
    >
      <StarRating difficulty={workout.difficulty} size="lg" testID="workout-detail-stars" />
      {workout.status === 'draft' ? (
        <Notice testID="workout-test-content">{t.workouts.testContent}</Notice>
      ) : !workout.meta.expert_reviewed ? (
        <Notice testID="workout-testphase">{t.workouts.testPhase}</Notice>
      ) : null}
      <Body>{workout.summary_de}</Body>
      {hiddenFlow ? (
        <Notice tone="warning" title={deYoga.detail.hiddenTitle} testID="workout-flow-hidden">
          <Body>{deYoga.detail.hidden}</Body>
        </Notice>
      ) : prepared && prepared.swapped.length + prepared.removed.length + prepared.shortened > 0 ? (
        <Notice title={deYoga.detail.adjustedTitle} testID="workout-flow-adjusted">
          {prepared.swapped.length > 0 ? (
            <Body>{deYoga.detail.swapped(prepared.swapped.length)}</Body>
          ) : null}
          {prepared.removed.length > 0 ? (
            <Body>{deYoga.detail.removed(prepared.removed.length)}</Body>
          ) : null}
          {prepared.shortened > 0 ? <Body>{deYoga.detail.shortened}</Body> : null}
          <Body muted>{deYoga.detail.reason}</Body>
        </Notice>
      ) : null}
      <Body muted>
        {[
          t.workouts.detail.duration(prepared ? prepared.minutes : workout.minutes),
          t.workouts.categories[workout.category],
          equipmentText(workout.equipment_ids),
        ].join(' · ')}
      </Body>
      <Notice
        tone={hints.length > 1 ? 'warning' : 'info'}
        title={t.workouts.safety.title}
        titleAsHeader
        testID="workout-safety"
      >
        {hints.map((hint) => (
          <Body key={hint} testID={`workout-safety-${hint}`}>
            {t.workouts.safety[hint]}
          </Body>
        ))}
      </Notice>
      {app.library.kind === 'missing' || (exercises !== null && missing.length > 0) ? (
        <Notice tone="warning">{t.workouts.detail.libraryMissing}</Notice>
      ) : null}
      <Card>
        <Heading level={2}>{t.workouts.detail.format}</Heading>
        <Body>{`${t.workouts.formats[workout.format]}: ${how}`}</Body>
        {workout.format !== 'sets_reps' && workout.rounds > 1 && workout.round_rest_s > 0 ? (
          <Body muted>{t.workouts.detail.roundRest(workout.round_rest_s)}</Body>
        ) : null}
      </Card>
      <Card>
        <Heading level={2}>{t.workouts.detail.warmup}</Heading>
        <Body>{workout.warmup_de}</Body>
      </Card>
      <Card>
        <Heading level={2}>{t.workouts.detail.exercises}</Heading>
        <View style={styles.list} testID="workout-exercises">
          {workout.exercises.map((item, index) => {
            const exercise = exercises?.get(item.exercise_id);
            const name = exercise?.name_de ?? item.exercise_id;
            const dose = [
              item.sets !== null ? t.workouts.detail.sets(item.sets) : null,
              item.reps !== null
                ? t.workouts.detail.reps(item.reps, exercise?.unilateral === true)
                : t.workouts.detail.seconds(item.duration_s ?? 0),
              // Flow: Seitenwechsel statt Pause (ohne Pausen-Bildschirm).
              isFlow
                ? item.side === 'both'
                  ? `${deYoga.detail.perSide} (${deYoga.detail.sides})`
                  : null
                : t.workouts.detail.rest(item.rest_s),
              swappedFrom.has(item.exercise_id)
                ? deYoga.detail.swappedFrom(swappedFrom.get(item.exercise_id) ?? '')
                : null,
            ]
              .filter((x): x is string => x !== null)
              .join(' · ');
            return (
              <View key={`${index}-${item.exercise_id}`} style={styles.item}>
                <Text
                  style={[styles.itemTitle, { color: theme.text }]}
                >{`${index + 1}. ${name}`}</Text>
                <Text style={{ color: theme.textMuted }}>{dose}</Text>
                {item.note_de ? <Body muted>{item.note_de}</Body> : null}
                {exercise ? (
                  <Button
                    label={t.workouts.detail.exerciseInfo(name)}
                    variant="link"
                    onPress={() =>
                      router.push(`/uebungen/${encodeURIComponent(item.exercise_id)}` as Href)
                    }
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>
      <Card>
        <Heading level={2}>{t.workouts.detail.cooldown}</Heading>
        <Body>{workout.cooldown_de}</Body>
      </Card>
    </Screen>
  );
}

/** Neuen Lauf beginnen (außerhalb des Renderns: Zeitpunkt und ID entstehen beim Tippen). */
function beginRun(userId: string, workout: Workout): void {
  activeRunStore.set(startActiveRun({ ownerUserId: userId, workout, nowMs: Date.now(), newId }));
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  list: { gap: spacing.md },
  item: { gap: 2 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
