import {
  completeWorkoutStep,
  endWorkoutRun,
  pauseWorkoutRun,
  resumeWorkoutRun,
  SESSION_RPE_LIMITS,
  skipWorkoutStep,
  type Workout,
  type WorkoutRun,
  workoutRunSummary,
  type WorkoutTimerStep,
  workoutRunView,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  FieldError,
  LoadingState,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { newId } from '@/data/create-backend';
import { activeRunStore, workoutLogDraft } from '@/data/workout-run';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { INTERVAL_TIMER_AWAKE_TAG, useScreenAwake } from '@/lib/keep-awake';
import { useThemeColors } from '@/lib/theme';
import { announceStep, playWorkoutSignal, useWorkoutSignals } from '@/lib/workout-signals';
import {
  clockText,
  doseText,
  passText,
  stepAnnouncement,
  stepTitle,
} from '@/lib/workout-timer-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useActiveWorkoutRun, useWorkoutLibrary } from '@/state/use-workouts';
import { Text } from '@/components/text';

const TICK_MS = 250;
const RPE_VALUES = Array.from(
  { length: SESSION_RPE_LIMITS.max - SESSION_RPE_LIMITS.min + 1 },
  (_, i) => SESSION_RPE_LIMITS.min + i,
);

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; message: string; tone: 'success' | 'warning' | 'danger' }
  | { kind: 'error'; message: string };

/**
 * Timer-Modus eines Workouts (docs/PLAN-WORKOUTS.md Abschnitt 4–5): großer Countdown je Übung bzw. Pause, Runde/Satz,
 * Vorschau „Als Nächstes“, Pausieren/Überspringen/Erledigt/Beenden, Ton/Vibration, Bildschirm bleibt an. Die ganze
 * Zeitrechnung kommt aus packages/core (workouts/timer.ts) – hier nur Neuzeichnen und Bedienung. Nach dem Ende (oder
 * vorzeitig) „Für heute speichern“: freie Kraft-Einheit über den vorhandenen Tagebuch-Weg (offline möglich).
 */
export default function WorkoutTimerScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const library = useWorkoutLibrary();
  const active = useActiveWorkoutRun();
  const signals = useWorkoutSignals();
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [live, setLive] = useState({ text: '', version: 0 });

  const { ensureLibrary } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  const workout: Workout | undefined =
    library.kind === 'ready' ? library.workouts.find((w) => w.id === params.id) : undefined;
  const run = active && active.workoutId === params.id ? active : null;
  const computed = useMemo(
    () => (run ? workoutRunView(run.steps, run.run, now) : null),
    [run, now],
  );
  const view = computed?.view ?? null;
  const finished = view?.finished ?? false;
  const paused = view?.paused ?? false;

  // Neu zeichnen, solange der Timer läuft (Zeitrechnung aus Zeitstempeln, kein Zähler).
  useEffect(() => {
    if (!run || finished || paused) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [run, finished, paused]);

  // Abgelaufene Zeit-Schritte in den Lauf übernehmen.
  useEffect(() => {
    if (run && computed && computed.run !== run.run) {
      activeRunStore.set({ ...run, run: computed.run });
    }
  }, [computed, run]);

  // Bildschirm bleibt an, solange der Timer läuft (eigener Tag, unabhängig von der Einstellung im Training).
  useScreenAwake(run !== null && !finished, INTERVAL_TIMER_AWAKE_TAG);

  const exercises = app.library.kind === 'ready' ? app.library.library.exercises : null;
  const names = useMemo(() => exercises ?? new Map(), [exercises]);

  // Schrittwechsel: Ton/Vibration und Ansage.
  const lastIndex = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const key = view.finished ? -1 : view.index;
    if (lastIndex.current === key) return;
    const first = lastIndex.current === null;
    lastIndex.current = key;
    if (!first) {
      playWorkoutSignal(
        view.finished ? 'finish' : view.step?.kind === 'work' ? 'work' : 'rest',
        signals.enabled,
      );
    }
    const text = stepAnnouncement(view, names);
    announceStep(text);
    setLive((current) => ({ text, version: current.version + 1 }));
  }, [names, signals.enabled, view]);

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
  const toDetail = () => router.replace(`/workouts/${params.id ?? ''}` as Href);
  if (library.kind !== 'ready' || exercises === null) {
    return (
      <Screen>
        <LoadingState label={t.workouts.loading} />
      </Screen>
    );
  }
  if (!workout || !run || run.ownerUserId !== app.session.userId || !view || !computed) {
    return (
      <Screen
        area="workouts"
        icon="stopwatch"
        testID="workout-timer-missing"
        footer={<Button label={t.workouts.detail.back} variant="secondary" onPress={toDetail} />}
      >
        <Notice tone="warning">
          {workout ? t.workouts.timer.leaveHint : t.workouts.detail.notFound}
        </Notice>
      </Screen>
    );
  }

  const current = run;
  const currentRun = computed.run;
  const update = (
    change: (steps: readonly WorkoutTimerStep[], state: WorkoutRun, at: number) => WorkoutRun,
  ) => {
    const at = Date.now();
    setNow(at);
    activeRunStore.set({ ...current, run: change(current.steps, currentRun, at) });
  };

  async function saveLog() {
    if (!workout || !run || !exercises || save.kind === 'saving' || run.saved) return;
    const result = workoutLogDraft({
      active: run,
      workout,
      exercises,
      nowMs: Date.now(),
      today: berlinTodayIso(),
      sessionRpe: rpe,
      userNote: note,
      newId,
    });
    if (!result.ok) {
      setSave({ kind: 'error', message: t.workouts.finish.nothing });
      return;
    }
    setSave({ kind: 'saving' });
    try {
      const outcome = await app.submitWorkout(result.draft);
      const message =
        outcome.kind === 'saved'
          ? { message: t.workouts.finish.saved, tone: 'success' as const }
          : outcome.kind === 'queued'
            ? { message: t.workouts.finish.queued, tone: 'success' as const }
            : outcome.kind === 'conflict'
              ? { message: t.workouts.finish.conflict, tone: 'warning' as const }
              : outcome.kind === 'rejected'
                ? { message: t.workouts.finish.rejected, tone: 'danger' as const }
                : { message: t.workouts.finish.invalid, tone: 'danger' as const };
      // Gesendet bzw. als Entwurf gesichert: dieser Lauf wird nie ein zweites Mal gespeichert.
      if (outcome.kind !== 'invalid') activeRunStore.set({ ...run, saved: true });
      setSave({ kind: 'done', ...message });
    } catch {
      setSave({ kind: 'error', message: t.workouts.finish.failed });
    }
  }

  // ---------------------------------------------------------------------------------------------------------
  // Fertig: Zusammenfassung und Speichern
  // ---------------------------------------------------------------------------------------------------------
  if (finished) {
    const summary = workoutRunSummary(run.steps, computed.run, now);
    const minutes = Math.max(1, Math.round(summary.activeS / 60));
    const done = save.kind === 'done' || run.saved;
    return (
      <Screen
        area="workouts"
        icon="stopwatch"
        title={summary.complete ? t.workouts.finish.title : t.workouts.finish.titleEarly}
        testID="workout-finish"
        footer={
          <View style={styles.footer}>
            {done ? (
              <>
                <Button
                  label={t.workouts.finish.toDay}
                  onPress={() => router.replace(`/tag/${berlinTodayIso()}` as Href)}
                  testID="workout-finish-today"
                />
                <Button
                  label={t.workouts.finish.again}
                  variant="secondary"
                  onPress={() => {
                    activeRunStore.set(null);
                    router.replace('/workouts' as Href);
                  }}
                  testID="workout-finish-back"
                />
              </>
            ) : (
              <>
                <Button
                  label={t.workouts.finish.save}
                  onPress={() => void saveLog()}
                  loading={save.kind === 'saving'}
                  disabled={summary.workDone === 0}
                  testID="workout-save"
                />
                <Button
                  label={t.workouts.finish.discard}
                  variant="secondary"
                  onPress={() => {
                    activeRunStore.set(null);
                    router.replace('/workouts' as Href);
                  }}
                  testID="workout-discard"
                />
              </>
            )}
          </View>
        }
      >
        <LiveRegion text={live.text} version={live.version} />
        <Text style={[styles.finishTitle, { color: theme.text }]}>{workout.title_de}</Text>
        <Body testID="workout-finish-summary">
          {t.workouts.finish.summary(summary.workDone, summary.workTotal, minutes)}
        </Body>
        {workout.format !== 'sets_reps' ? (
          <Body testID="workout-finish-rounds">
            {t.workouts.finish.rounds(summary.roundsCompleted, summary.rounds)}
          </Body>
        ) : null}
        {summary.workDone === 0 ? (
          <Notice tone="warning">{t.workouts.finish.nothing}</Notice>
        ) : null}
        {save.kind === 'done' ? (
          <Notice tone={save.tone} testID="workout-saved">
            {save.message}
          </Notice>
        ) : run.saved ? (
          <Notice tone="success" testID="workout-saved">
            {t.workouts.finish.saved}
          </Notice>
        ) : null}
        <FieldError
          message={save.kind === 'error' ? save.message : undefined}
          testID="workout-save-error"
        />
        {!done && summary.workDone > 0 ? (
          <Card>
            <Body>{t.workouts.finish.rpe}</Body>
            <View style={styles.chips}>
              {RPE_VALUES.map((value) => (
                <OptionButton
                  key={value}
                  role="radio"
                  compact
                  label={String(value)}
                  selected={rpe === value}
                  onPress={() => setRpe(rpe === value ? null : value)}
                  testID={`workout-rpe-${value}`}
                />
              ))}
            </View>
            <TextField
              label={t.workouts.finish.note}
              value={note}
              onChangeText={setNote}
              maxLength={200}
              testID="workout-note"
            />
          </Card>
        ) : null}
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------------------------------------
  // Läuft
  // ---------------------------------------------------------------------------------------------------------
  const step = view.step;
  const isWork = step?.kind === 'work';
  const isReps = isWork && step.seconds === null;
  const workStep = isWork ? step : null;
  const next = view.nextWork;
  const accent = isWork ? theme.primary : theme.success;

  return (
    <Screen
      area="workouts"
      icon="stopwatch"
      title={workout.title_de}
      testID="workout-timer"
      footer={
        <View style={styles.footer}>
          {isReps ? (
            <Button
              label={
                workStep && workStep.passes > 1 && view.rounds === 1
                  ? t.workouts.timer.doneSet
                  : t.workouts.timer.done
              }
              onPress={() => update(completeWorkoutStep)}
              testID="workout-timer-done"
            />
          ) : null}
          <View style={styles.row}>
            <View style={styles.cell}>
              <Button
                label={paused ? t.workouts.timer.resume : t.workouts.timer.pause}
                variant="secondary"
                onPress={() =>
                  update((steps, state, at) =>
                    paused ? resumeWorkoutRun(state, at) : pauseWorkoutRun(steps, state, at),
                  )
                }
                testID={paused ? 'workout-timer-resume' : 'workout-timer-pause'}
              />
            </View>
            <View style={styles.cell}>
              <Button
                label={isWork ? t.workouts.timer.skip : t.workouts.timer.skipRest}
                variant="secondary"
                onPress={() => update(isWork ? skipWorkoutStep : completeWorkoutStep)}
                testID="workout-timer-skip"
              />
            </View>
          </View>
          <Button
            label={t.workouts.timer.end}
            variant="link"
            onPress={() => setConfirmEnd(true)}
            testID="workout-timer-end"
          />
        </View>
      }
    >
      <LiveRegion text={live.text} version={live.version} />
      <Body muted testID="workout-timer-progress">
        {`${passText(workStep ?? next, view)} · ${t.workouts.timer.progress(view.workDone, view.workTotal)}`}
      </Body>
      <View
        style={[styles.timerBox, { borderColor: accent, backgroundColor: theme.surface }]}
        testID="workout-timer-box"
      >
        <Text style={[styles.stepLabel, { color: accent }]} testID="workout-timer-kind">
          {step?.kind === 'work'
            ? t.workouts.timer.work
            : step?.kind === 'prepare'
              ? t.workouts.timer.prepare
              : t.workouts.timer.rest}
        </Text>
        <Text style={[styles.stepTitle, { color: theme.text }]} testID="workout-timer-step">
          {stepTitle(step, names)}
        </Text>
        {view.remainingS !== null ? (
          <Text
            style={[styles.countdown, { color: theme.text }]}
            accessibilityLabel={t.workouts.timer.remaining(view.remainingS)}
            testID="workout-timer-remaining"
          >
            {clockText(view.remainingS)}
          </Text>
        ) : workStep ? (
          <Text style={[styles.reps, { color: theme.text }]} testID="workout-timer-reps">
            {doseText(workStep, names)}
          </Text>
        ) : null}
        {paused ? (
          <Text style={[styles.paused, { color: theme.warning }]} testID="workout-timer-paused">
            {t.workouts.timer.paused}
          </Text>
        ) : null}
      </View>
      <Card>
        <Body muted>{t.workouts.timer.next}</Body>
        {next ? (
          <Body testID="workout-timer-next">
            {`${stepTitle(next, names)} · ${doseText(next, names)}`}
          </Body>
        ) : (
          <Body testID="workout-timer-next">{t.workouts.timer.nextNone}</Body>
        )}
      </Card>
      <Checkbox
        label={t.workouts.timer.signals}
        checked={signals.enabled}
        onChange={signals.setEnabled}
        testID="workout-timer-signals"
      />
      <Body muted>{`${t.workouts.timer.signalsHint} ${t.workouts.timer.keepAwake}`}</Body>
      <Body muted>{t.workouts.timer.leaveHint}</Body>
      <ConfirmDialog
        visible={confirmEnd}
        title={t.workouts.timer.endConfirmTitle}
        message={t.workouts.timer.endConfirmText}
        confirmLabel={t.workouts.timer.endConfirm}
        onConfirm={() => {
          setConfirmEnd(false);
          update(endWorkoutRun);
        }}
        onCancel={() => setConfirmEnd(false)}
        testID="workout-end-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timerBox: {
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  stepTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  countdown: {
    fontSize: 72,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  reps: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  paused: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  finishTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
