import {
  adjustReps,
  adjustWeight,
  codePointLength,
  isPlausibleTargetWeight,
  isValidSetWeight,
  needsWeightConfirmation as needsStartWeightConfirmation,
  SESSION_LOG_LIMITS,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MedicalNotice } from '@/components/plan';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { EffortSlider, ReserveChoices, SetDoneButton, Stepper } from '@/components/workout';
import { newId } from '@/data/create-backend';
import { logForSession } from '@/data/log-rows';
import { activePlan } from '@/data/training-plan';
import {
  addSet,
  chooseAlternative,
  confirmWeight,
  currentTarget,
  draftFromLog,
  type DraftExercise,
  needsWeightConfirmation,
  replacePlanned,
  setSessionFields,
  setSkipped,
  updateSet,
  warningsForSet,
  type WorkoutDraft,
} from '@/data/workout-draft';
import {
  alternativeTarget,
  newWorkoutDraft,
  replannedTarget,
  startKind,
  workoutView,
} from '@/data/workout-session';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDecimal, formatKg, parseDecimal, todayIso } from '@/lib/format';
import { targetNotes, targetText, weightText, perPieceText } from '@/lib/workout-format';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useThemeColors } from '@/lib/theme';

/**
 * Trainingsmodus (docs/PLAN-PHASE-4.md 6.1 Punkt 2, Etappe C1 – Kraft): Satz für Satz Gewicht und Wiederholungen,
 * abhaken, „nicht gemacht“ (ohne Grund, S3), „Alternative durchgeführt“, eigenes Startgewicht, Abschluss mit
 * Belastung 0–10 und Notiz. Jeder Tipp landet sofort im geschützten Entwurf (4.2). Vorgaben, Zustände, Warnungen
 * und Status kommen aus packages/core.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ sessionId: string; edit?: string }>();
  const sessionId = String(params.sessionId ?? '');
  const editRequested = params.edit === '1';
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  // Zurück zu „Heute“ (der Trainingsmodus wird von dort geöffnet) – nie zwei „Heute“ im Stapel.
  const goToday = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  const [localDraft, setLocalDraft] = useState<WorkoutDraft | null>(null);
  const [alternativesFor, setAlternativesFor] = useState<number | null>(null);
  const [startWeightFor, setStartWeightFor] = useState<number | null>(null);
  const [startWeightText, setStartWeightText] = useState('');
  const [startWeightError, setStartWeightError] = useState<string>();
  const [startWeightConfirm, setStartWeightConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [discardDialog, setDiscardDialog] = useState(false);

  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  const rows = app.rows;
  const lib = library.kind === 'ready' ? library.library : null;
  const rules = app.safetyRules;
  const stored = app.drafts.find((d) => d.key === sessionId) ?? null;
  const view = useMemo(
    () =>
      rows && lib && rules
        ? workoutView(rows, lib, rules, sessionId, today, {
            excludeLogId: rows ? (logForSession(rows, sessionId)?.id ?? null) : null,
          })
        : null,
    [lib, rows, rules, sessionId, today],
  );
  // Neuer Entwurf erst beim ersten Tipp gespeichert (vorher bleibt nichts liegen, wenn man nur hineinschaut).
  const initialDraft = useMemo<WorkoutDraft | null>(() => {
    if (!rows || !app.session) return null;
    if (stored) return stored;
    const log = logForSession(rows, sessionId);
    if (editRequested || log) {
      return log
        ? draftFromLog(rows, log.id, {
            ownerUserId: app.session.userId,
            fromHealthPlan: log.from_health_plan,
            now: new Date().toISOString(),
          })
        : null;
    }
    if (!view) return null;
    return newWorkoutDraft(rows, view, {
      ownerUserId: app.session.userId,
      today,
      now: new Date().toISOString(),
      newId,
    });
  }, [app.session, editRequested, rows, sessionId, stored, today, view]);
  const draft = localDraft ?? initialDraft;

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !rows) {
    return <Redirect href={route as Href} />;
  }

  const active = activePlan(rows);
  const session = active?.sessions.find((s) => s.id === sessionId) ?? null;
  const footerBack = (
    <Button label={t.workout.back} variant="secondary" onPress={() => goToday()} />
  );

  if (!draft) {
    const waiting = library.kind === 'loading' || library.kind === 'idle';
    const notStartable = session && !editRequested && startKind(rows, session, today) === null;
    return (
      <Screen title={t.workout.title} testID="workout" footer={footerBack}>
        {waiting ? (
          <LoadingState label={t.workout.loading} />
        ) : !session ? (
          <Notice tone="warning">{t.workout.notFound}</Notice>
        ) : notStartable ? (
          <Notice tone="info">{t.workout.notStartable}</Notice>
        ) : (
          <Notice
            tone="warning"
            title={t.plan.libraryMissingTitle}
            testID="workout-library-missing"
          >
            <Body>{t.workout.libraryMissing}</Body>
          </Notice>
        )}
      </Screen>
    );
  }

  const current = draft;
  const now = () => new Date().toISOString();
  function update(next: WorkoutDraft) {
    setLocalDraft(next);
    setError(undefined);
    // Jeder Tipp wird gesichert; scheitert das (Browser-Speicher voll/gesperrt), sagen wir es – nie still (B1, K9).
    app.saveDraft(next).catch(() => setError(t.workout.draftSaveFailed));
  }

  const finishedCount = current.exercises.filter(
    (e) => e.skipped || e.sets.every((s) => s.done),
  ).length;
  const progressText =
    finishedCount >= current.exercises.length
      ? t.workout.allDone
      : t.workout.exerciseOf(finishedCount + 1, current.exercises.length);
  const notesLength = codePointLength(current.notes);
  const notesTooLong = notesLength > SESSION_LOG_LIMITS.notesMaxChars;
  const canSwitch = !current.editing && view !== null;

  async function save() {
    if (current.exercises.some(needsWeightConfirmation)) {
      setError(t.workout.confirmNeeded);
      return;
    }
    if (notesTooLong) {
      setError(t.workout.notesTooLong(SESSION_LOG_LIMITS.notesMaxChars));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const outcome = await app.submitWorkout(current);
      if (outcome.kind === 'invalid') {
        setError(t.workout.invalid);
        return;
      }
      setLocalDraft(null);
      goToday();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    setDiscardDialog(false);
    await app.discardDraft(current.key);
    setLocalDraft(null);
    goToday();
  }

  async function saveStartWeight(index: number, confirmed: boolean) {
    const exercise = current.exercises[index];
    if (!exercise) return;
    const value = parseDecimal(startWeightText);
    if (value === null || Number.isNaN(value) || !isPlausibleTargetWeight(value)) {
      setStartWeightError(t.workout.startWeightInvalid);
      return;
    }
    const target = currentTarget(exercise);
    if (!confirmed && needsStartWeightConfirmation(value, null, target.incrementKind)) {
      setStartWeightConfirm(index);
      return;
    }
    setStartWeightConfirm(null);
    setStartWeightError(undefined);
    try {
      const nextRows = await app.setStartWeight(target.exerciseId, value);
      const nextView = lib && rules ? workoutView(nextRows, lib, rules, sessionId, today) : null;
      const replanned = nextView ? replannedTarget(nextView, exercise) : null;
      if (replanned) update(replacePlanned(current, index, replanned, now()));
      setStartWeightFor(null);
      setStartWeightText('');
    } catch (caught) {
      setStartWeightError(errorText(caught));
    }
  }

  return (
    <Screen
      title={current.nameDe}
      testID="workout"
      footer={
        <View style={styles.footer}>
          <FieldError message={error} testID="workout-error" />
          <Button
            label={current.editing ? t.workout.saveChanges : t.workout.save}
            onPress={() => void save()}
            loading={saving}
            testID="workout-save"
          />
          <Button
            label={t.workout.back}
            variant="secondary"
            onPress={() => goToday()}
            disabled={saving}
          />
        </View>
      }
    >
      <Body muted>{progressText}</Body>
      {active?.plan.medical_notice ? <MedicalNotice /> : null}
      {Platform.OS === 'web' ? (
        <Notice tone="info" testID="workout-tab-hint">
          {t.workout.tabHint}
        </Notice>
      ) : null}
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {current.editing ? <Notice tone="info">{t.workout.editing}</Notice> : null}
      {current.state === 'rejected' && current.rejectReason ? (
        <Notice tone="danger" testID="workout-rejected">
          {t.workout.rejected[current.rejectReason]}
        </Notice>
      ) : null}
      {current.state === 'conflict' ? (
        <Notice tone="warning">{t.workout.conflictTitle}</Notice>
      ) : null}
      {!canSwitch && !current.editing && library.kind === 'missing' ? (
        <Notice tone="info">{t.workout.alternativesLocked}</Notice>
      ) : null}

      {current.exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          canSwitch={canSwitch}
          alternativesOpen={alternativesFor === index}
          onToggleAlternatives={() => setAlternativesFor((open) => (open === index ? null : index))}
          alternatives={
            canSwitch && view
              ? (view.items.find(
                  (item) =>
                    item.storedExerciseId === exercise.storedExerciseId &&
                    item.shown.exercise_id === exercise.planned.exerciseId,
                )?.alternatives ?? [])
              : []
          }
          onChooseAlternative={(alternativeId) => {
            if (!view) return;
            const target = alternativeId ? alternativeTarget(view, exercise, alternativeId) : null;
            if (alternativeId && !target) return;
            update(chooseAlternative(current, index, target, now()));
            setAlternativesFor(null);
          }}
          onSkip={(skipped) => update(setSkipped(current, index, skipped, now()))}
          onSet={(setIndex, patch) => update(updateSet(current, index, setIndex, patch, now()))}
          onAddSet={() =>
            update(addSet(current, index, SESSION_LOG_LIMITS.setsPerExercise.max, now()))
          }
          onConfirmWeight={() => update(confirmWeight(current, index, now()))}
          startWeight={
            canSwitch &&
            !exercise.alternative &&
            exercise.planned.loadType === 'weight' &&
            (exercise.planned.source === 'none' || exercise.planned.source === 'start_weight')
              ? {
                  open: startWeightFor === index,
                  text: startWeightText,
                  error: startWeightError,
                  onToggle: () => {
                    setStartWeightFor((open) => (open === index ? null : index));
                    setStartWeightText(
                      exercise.planned.state.state_weight_kg !== null
                        ? formatDecimal(exercise.planned.state.state_weight_kg)
                        : '',
                    );
                    setStartWeightError(undefined);
                  },
                  onChangeText: setStartWeightText,
                  onSave: () => void saveStartWeight(index, false),
                }
              : null
          }
        />
      ))}

      <Card>
        <Heading level={2}>{t.workout.finishTitle}</Heading>
        <EffortSlider
          label={t.workout.effortLabel}
          value={current.sessionRpe}
          onChange={(value) => update(setSessionFields(current, { sessionRpe: value }, now()))}
          testID="workout-effort"
        />
        {current.sessionRpe !== null ? (
          <Button
            label={t.workout.effortSkip}
            variant="link"
            onPress={() => update(setSessionFields(current, { sessionRpe: null }, now()))}
          />
        ) : null}
        <TextField
          label={t.workout.notesLabel}
          hint={t.workout.notesHint}
          value={current.notes}
          onChangeText={(text) => update(setSessionFields(current, { notes: text }, now()))}
          multiline
          error={
            notesTooLong ? t.workout.notesTooLong(SESSION_LOG_LIMITS.notesMaxChars) : undefined
          }
          testID="workout-notes"
        />
        <Body muted>{t.workout.notesCount(notesLength, SESSION_LOG_LIMITS.notesMaxChars)}</Body>
        <Button
          label={t.workout.discard}
          variant="danger"
          onPress={() => setDiscardDialog(true)}
          testID="workout-discard"
        />
      </Card>

      <ConfirmDialog
        visible={discardDialog}
        title={t.workout.discardTitle}
        message={t.workout.discardText}
        confirmLabel={t.workout.discardConfirm}
        onConfirm={() => void discard()}
        onCancel={() => setDiscardDialog(false)}
      />
      <ConfirmDialog
        visible={startWeightConfirm !== null}
        title={t.workout.confirmAbsoluteTitle}
        message={t.workout.startWeightConfirm}
        confirmLabel={t.workout.startWeightConfirmButton}
        confirmVariant="primary"
        onConfirm={() =>
          startWeightConfirm !== null ? void saveStartWeight(startWeightConfirm, true) : undefined
        }
        onCancel={() => setStartWeightConfirm(null)}
      />
    </Screen>
  );
}

function ExerciseCard({
  exercise,
  index,
  canSwitch,
  alternativesOpen,
  onToggleAlternatives,
  alternatives,
  onChooseAlternative,
  onSkip,
  onSet,
  onAddSet,
  onConfirmWeight,
  startWeight,
}: {
  exercise: DraftExercise;
  index: number;
  canSwitch: boolean;
  alternativesOpen: boolean;
  onToggleAlternatives: () => void;
  alternatives: readonly { id: string; name_de: string }[];
  onChooseAlternative: (alternativeId: string | null) => void;
  onSkip: (skipped: boolean) => void;
  onSet: (setIndex: number, patch: Partial<DraftExercise['sets'][number]>) => void;
  onAddSet: () => void;
  onConfirmWeight: () => void;
  startWeight: {
    open: boolean;
    text: string;
    error: string | undefined;
    onToggle: () => void;
    onChangeText: (text: string) => void;
    onSave: () => void;
  } | null;
}) {
  const theme = useThemeColors();
  const target = currentTarget(exercise);
  const perPiece = perPieceText(target);
  const warnings = exercise.sets.flatMap((set) => (set.done ? warningsForSet(exercise, set) : []));
  const confirmKind = exercise.weightConfirmed
    ? null
    : warnings.includes('confirm_heavier')
      ? t.workout.confirmHeavierTitle
      : warnings.includes('confirm_absolute')
        ? t.workout.confirmAbsoluteTitle
        : warnings.includes('confirm_lighter')
          ? t.workout.confirmLighterTitle
          : null;
  return (
    <Card>
      <View testID={`workout-exercise-${index}`} style={styles.exercise}>
        <Heading level={2}>
          {index + 1}. {target.nameDe}
        </Heading>
        {exercise.alternative ? (
          <Body muted>{t.workout.alternativeOf(exercise.planned.nameDe)}</Body>
        ) : null}
        {exercise.skipped ? (
          <Notice tone="info" testID={`workout-skipped-${index}`}>
            {`✕ ${t.workout.skippedLabel}`}
          </Notice>
        ) : (
          <>
            <Body testID={`workout-target-${index}`}>{targetText(target)}</Body>
            {targetNotes(target).map((line) => (
              <Body key={line} muted>
                {line}
              </Body>
            ))}
            {exercise.sets.map((set, setIndex) => (
              <View
                key={setIndex}
                style={[styles.set, { borderTopColor: theme.border }]}
                testID={`workout-set-${index}-${setIndex}`}
              >
                <Body style={styles.setLabel}>{t.workout.setLabel(setIndex + 1)}</Body>
                <View style={styles.steppers}>
                  {target.loadType === 'weight' ? (
                    <Stepper
                      label={t.workout.weight}
                      valueText={set.weightKg === null ? '–' : weightText(set.weightKg, null)}
                      valueA11y={
                        set.weightKg === null
                          ? '–'
                          : `${t.workout.weightA11y(formatKg(set.weightKg))}${perPiece ? ` ${perPiece}` : ''}`
                      }
                      onDecrease={() =>
                        onSet(setIndex, { weightKg: adjustWeight(set.weightKg, -1, target.steps) })
                      }
                      onIncrease={() =>
                        onSet(setIndex, { weightKg: adjustWeight(set.weightKg, 1, target.steps) })
                      }
                      testID={`workout-weight-${index}-${setIndex}`}
                    />
                  ) : null}
                  {target.loadType === 'time' ? (
                    <Stepper
                      label={t.workout.seconds}
                      valueText={set.durationS === null ? '–' : String(set.durationS)}
                      valueA11y={
                        set.durationS === null ? '–' : `${set.durationS} ${t.workout.seconds}`
                      }
                      onDecrease={() =>
                        onSet(setIndex, {
                          durationS: Math.max(
                            SESSION_LOG_LIMITS.durationS.min,
                            (set.durationS ?? SESSION_LOG_LIMITS.durationS.min) - 5,
                          ),
                        })
                      }
                      onIncrease={() =>
                        onSet(setIndex, {
                          durationS: Math.min(
                            SESSION_LOG_LIMITS.durationS.max,
                            (set.durationS ?? 0) + 5,
                          ),
                        })
                      }
                      testID={`workout-duration-${index}-${setIndex}`}
                    />
                  ) : (
                    <Stepper
                      label={t.workout.reps}
                      valueText={set.reps === null ? '–' : String(set.reps)}
                      valueA11y={t.workout.repsUnit(set.reps)}
                      onDecrease={() => onSet(setIndex, { reps: adjustReps(set.reps, -1) })}
                      onIncrease={() => onSet(setIndex, { reps: adjustReps(set.reps, 1) })}
                      testID={`workout-reps-${index}-${setIndex}`}
                    />
                  )}
                </View>
                <SetDoneButton
                  setNo={setIndex + 1}
                  done={set.done}
                  onPress={() =>
                    onSet(setIndex, {
                      done: !set.done,
                      // Abgehakt ohne Wiederholungen: die Vorgabe gilt als geschafft.
                      ...(target.loadType !== 'time' && set.reps === null
                        ? { reps: target.targets.target_reps ?? 0 }
                        : {}),
                      // Halteübung ohne Dauer: Vorgabe bzw. 5 s (sonst wäre der Eintrag ungültig, K7).
                      ...(target.loadType === 'time' && set.durationS === null
                        ? { durationS: target.targets.target_duration_s ?? 5 }
                        : {}),
                    })
                  }
                  testID={`workout-done-${index}-${setIndex}`}
                />
                {set.done ? (
                  <ReserveChoices
                    rpe={set.rpe}
                    setNo={setIndex + 1}
                    onChange={(rpe) => onSet(setIndex, { rpe })}
                  />
                ) : null}
              </View>
            ))}
            {target.loadType === 'weight' ? (
              <WeightInput
                index={index}
                onApply={(kg) => {
                  const open = exercise.sets.findIndex((x) => !x.done);
                  if (open >= 0) onSet(open, { weightKg: kg });
                }}
              />
            ) : null}
            {confirmKind ? (
              <Notice tone="warning" title={confirmKind} testID={`workout-confirm-${index}`}>
                <Body>{t.workout.confirmText}</Body>
                <Button
                  label={t.workout.confirmButton}
                  variant="secondary"
                  onPress={onConfirmWeight}
                />
              </Notice>
            ) : null}
            {warnings.includes('check_reps') ? (
              <Notice tone="warning">{t.workout.checkReps}</Notice>
            ) : null}
            {exercise.sets.length < SESSION_LOG_LIMITS.setsPerExercise.max ? (
              <Button label={t.workout.addSet} variant="link" onPress={onAddSet} />
            ) : null}
          </>
        )}
        <View style={styles.actions}>
          <Button
            label={exercise.skipped ? t.workout.unskip : t.workout.skip}
            variant="secondary"
            onPress={() => onSkip(!exercise.skipped)}
            testID={`workout-skip-${index}`}
          />
          {canSwitch ? (
            <Button
              label={t.workout.alternative}
              variant="secondary"
              onPress={onToggleAlternatives}
              testID={`workout-alternative-${index}`}
            />
          ) : null}
          {startWeight ? (
            <Button
              label={t.workout.startWeight}
              variant="secondary"
              onPress={startWeight.onToggle}
              testID={`workout-start-weight-${index}`}
            />
          ) : null}
        </View>
        {alternativesOpen ? (
          <View style={styles.alternatives} accessibilityRole="radiogroup">
            <Body>{t.workout.alternativeTitle}</Body>
            {alternatives.length === 0 && !exercise.alternative ? (
              <Body muted>{t.workout.alternativeNone}</Body>
            ) : null}
            {exercise.alternative ? (
              <OptionButton
                role="radio"
                label={t.workout.backToPlanned(exercise.planned.nameDe)}
                selected={false}
                onPress={() => onChooseAlternative(null)}
              />
            ) : null}
            {alternatives.map((alt) => (
              <OptionButton
                key={alt.id}
                role="radio"
                label={alt.name_de}
                selected={exercise.alternative?.exerciseId === alt.id}
                onPress={() => onChooseAlternative(alt.id)}
              />
            ))}
          </View>
        ) : null}
        {startWeight?.open ? (
          <View style={styles.alternatives}>
            <TextField
              label={t.workout.startWeightLabel}
              hint={t.workout.startWeightHint}
              value={startWeight.text}
              onChangeText={startWeight.onChangeText}
              keyboardType="decimal-pad"
              error={startWeight.error}
              testID={`workout-start-weight-input-${index}`}
            />
            <Button
              label={t.workout.startWeightSave}
              variant="secondary"
              onPress={startWeight.onSave}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** Gewicht direkt eingeben (statt vieler „+“-Tipps, K6) – gilt für den ersten offenen und alle folgenden Sätze. */
function WeightInput({ index, onApply }: { index: number; onApply: (kg: number) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  if (!open) {
    return (
      <Button
        label={t.workout.weightInput}
        variant="link"
        onPress={() => setOpen(true)}
        testID={`workout-weight-input-${index}`}
      />
    );
  }
  return (
    <View style={styles.alternatives}>
      <TextField
        label={t.workout.weightInputLabel}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        error={error}
        testID={`workout-weight-field-${index}`}
      />
      <Button
        label={t.workout.weightInputApply}
        variant="secondary"
        onPress={() => {
          const value = parseDecimal(text);
          if (value === null || Number.isNaN(value) || !isValidSetWeight(value)) {
            setError(t.workout.weightInputInvalid);
            return;
          }
          onApply(value);
          setOpen(false);
          setText('');
          setError(undefined);
        }}
        testID={`workout-weight-apply-${index}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  exercise: { gap: 8 },
  set: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  setLabel: { fontWeight: '600' },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actions: { gap: 8 },
  alternatives: { gap: 8 },
});
