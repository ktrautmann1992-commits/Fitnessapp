import {
  adjustReps,
  adjustWeight,
  type PreferenceChange,
  cardioSpeed,
  cardioDurationS,
  codePointLength,
  findGlossaryExercise,
  ENDURANCE_MODALITIES,
  type EnduranceModality,
  isPlausibleTargetWeight,
  isValidSetWeight,
  needsWeightConfirmation as needsStartWeightConfirmation,
  restAfterCheckedSet,
  SESSION_LOG_LIMITS,
  talkTestLevel,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MedicalNotice } from '@/components/plan';
import { ConfirmDialog, Screen } from '@/components/screen';
import { focusTestId, SwapDialog, type SwapDecision, SwapFeedback } from '@/components/swap';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import {
  EffortSlider,
  ReserveChoices,
  RestAnnouncer,
  RestTimerBar,
  SetDoneButton,
  Stepper,
} from '@/components/workout';
import { BackendError, type PreferenceSwapContext } from '@/data/backend';
import { newId } from '@/data/create-backend';
import {
  preferenceContextOf,
  preferenceSaveFor,
  type SwapTarget,
  workoutSwapTarget,
} from '@/data/exercise-swap';
import { logForSession } from '@/data/log-rows';
import { activePlan } from '@/data/training-plan';
import {
  addSet,
  cardioInputOf,
  chooseAlternative,
  confirmWeight,
  currentTarget,
  draftCardioResult,
  type DraftCardio,
  draftFromLog,
  type DraftExercise,
  type DraftTarget,
  needsWeightConfirmation,
  replacePlanned,
  setCardioFields,
  setSessionFields,
  setSkipped,
  updateSet,
  warningsForSet,
  type WorkoutDraft,
} from '@/data/workout-draft';
import {
  alternativeTarget,
  newEnduranceDraft,
  newWorkoutDraft,
  replannedTarget,
  startKind,
  workoutView,
} from '@/data/workout-session';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDecimal, formatKg, parseDecimal, todayIso } from '@/lib/format';
import { useKeepAwakeSetting, useScreenAwake } from '@/lib/keep-awake';
import { useRestTimer } from '@/lib/use-rest-timer';
import {
  cardioSpeedTexts,
  targetNotes,
  targetText,
  weightText,
  perPieceText,
} from '@/lib/workout-format';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useThemeColors } from '@/lib/theme';

/**
 * Trainingsmodus (docs/PLAN-PHASE-4.md 6.1 Punkte 2 und 3): Kraft (Etappe C1) Satz für Satz Gewicht und
 * Wiederholungen, abhaken, „nicht gemacht“ (ohne Grund, S3), „Alternative durchgeführt“, eigenes Startgewicht,
 * Pausentimer-Leiste (C2); Ausdauer (C2) Art, Dauer, Distanz, Höhenmeter mit Pace bzw. km/h live und Anstrengung
 * mit Gesprächstest. Abschluss mit Belastung 0–10 und Notiz. Jeder Tipp landet sofort im geschützten Entwurf (4.2);
 * der Bildschirm bleibt an (6.2, abschaltbar). Vorgaben, Zustände, Warnungen, Pausen und Pace kommen aus
 * packages/core.
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
  /** Tausch-Dialog (Etappe T2) – ersetzt „Alternative durchgeführt“. */
  const [swapFor, setSwapFor] = useState<{ index: number; target: SwapTarget } | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState<string>();
  const [swapFeedback, setSwapFeedback] = useState<{
    text: string;
    tone: 'success' | 'info' | 'danger';
    undo: {
      index: number;
      previous: DraftTarget | null;
      preferences: { changes: readonly PreferenceChange[]; at: PreferenceSwapContext } | null;
    } | null;
  } | null>(null);
  const [startWeightFor, setStartWeightFor] = useState<number | null>(null);
  const [startWeightText, setStartWeightText] = useState('');
  const [startWeightError, setStartWeightError] = useState<string>();
  const [startWeightConfirm, setStartWeightConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [discardDialog, setDiscardDialog] = useState(false);
  const rest = useRestTimer();
  const keepAwake = useKeepAwakeSetting();

  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  const rows = app.rows;
  const lib = library.kind === 'ready' ? library.library : null;
  const rules = app.safetyRules;
  const stored = app.drafts.find((d) => d.key === sessionId) ?? null;
  const ownerUserId = app.session?.userId ?? null;
  const view = useMemo(
    () =>
      rows && lib && rules
        ? workoutView(rows, lib, rules, sessionId, today, {
            excludeLogId: rows ? (logForSession(rows, sessionId)?.id ?? null) : null,
            // „Nur heute“-Tausche vor dem Training: Der neue Entwurf übernimmt die getauschte Übung (5.1).
            daySwaps: app.daySwaps,
            ownerUserId,
          })
        : null,
    [app.daySwaps, ownerUserId, lib, rows, rules, sessionId, today],
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
    const meta = {
      ownerUserId: app.session.userId,
      today,
      now: new Date().toISOString(),
      newId,
    };
    // Ausdauer braucht keine Übungs-Bibliothek (C2) – nur heute bzw. „Heute nachholen“ (startKind).
    const planned = activePlan(rows)?.sessions.find((x) => x.id === sessionId);
    if (planned?.kind === 'endurance') {
      return startKind(rows, planned, today) ? newEnduranceDraft(rows, sessionId, meta) : null;
    }
    if (!view) return null;
    return newWorkoutDraft(rows, view, meta);
  }, [app.session, editRequested, rows, sessionId, stored, today, view]);
  const draft = localDraft ?? initialDraft;
  // Bildschirm an, solange der Trainingsmodus offen ist (6.2) – abschaltbar in den Einstellungen.
  useScreenAwake(draft !== null && keepAwake.loaded && keepAwake.enabled);

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
  function update(next: WorkoutDraft, keepFeedback = false) {
    setLocalDraft(next);
    setError(undefined);
    // Jede andere Aktion beendet das Angebot „Rückgängig“ (8.2, ohne Zeitlimit).
    if (!keepFeedback) setSwapFeedback(null);
    // Jeder Tipp wird gesichert; scheitert das (Browser-Speicher voll/gesperrt), sagen wir es – nie still (B1, K9).
    app.saveDraft(next).catch(() => setError(t.workout.draftSaveFailed));
  }

  const isEndurance = current.kind === 'endurance';
  const cardioResult = draftCardioResult(current);

  /** Satz ändern; beim Abhaken startet die Pause aus packages/core (Supersätze beachtet, 5.5). */
  function changeSet(
    index: number,
    setIndex: number,
    patch: Partial<DraftExercise['sets'][number]>,
  ) {
    const before = current.exercises[index]?.sets[setIndex];
    const next = updateSet(current, index, setIndex, patch, now());
    update(next);
    // Beim nachträglichen Ändern eines gespeicherten Trainings keine Pause.
    if (patch.done === true && before && !before.done && !current.editing) {
      const restS = restAfterCheckedSet(
        next.exercises.map((e) => ({
          order_no: e.orderNo,
          rest_s: e.dosage.rest_s,
          superset_group: e.dosage.superset_group,
          setCount: e.sets.length,
          skipped: e.skipped,
        })),
        index,
        setIndex,
      );
      if (restS > 0) rest.start(restS);
      else rest.stop();
    } else if (patch.done === false) {
      rest.stop();
    }
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
  /** „So geht's“ (Etappe G1): Schritte und Sicherheitshinweis aus der Bibliothek, auch offline (Zwischenspeicher). */
  const guideFor = (exerciseId: string) => {
    const exercise = findGlossaryExercise(lib, exerciseId);
    return exercise ? { steps: exercise.steps_de, safetyNote: exercise.safety_note_de } : null;
  };

  /** Eintrag im Trainingsmodus: Paar (gespeichert, im Entwurf geplant) – der laufende Entwurf gilt (5.1). */
  function openSwap(index: number) {
    const exercise = current.exercises[index];
    if (!exercise || !view || !lib || !rows) return;
    const storedOrderNo =
      rows.plannedExercises.find((e) => e.id === exercise.plannedExerciseId)?.order_no ?? null;
    const item = view.items.find(
      (candidate) =>
        candidate.plannedOrderNo === storedOrderNo &&
        candidate.shown.exercise_id === exercise.planned.exerciseId,
    );
    const target = workoutSwapTarget({
      session: view.stored,
      display: view.display,
      library: lib,
      rows,
      storedOrderNo,
      plannedExerciseId: exercise.planned.exerciseId,
      draftExerciseIds: current.exercises
        .filter((_, i) => i !== index)
        .map((e) => currentTarget(e).exerciseId),
      harderVariantId: item?.plan?.hint.harderVariant?.exerciseId ?? null,
    });
    if (!target) return;
    setSwapFeedback(null);
    setSwapError(undefined);
    setSwapFor({ index, target });
  }

  function closeSwap() {
    const index = swapFor?.index;
    setSwapFor(null);
    setSwapError(undefined);
    if (index !== undefined) setTimeout(() => focusTestId(`workout-swap-${index}`), 50);
  }

  async function confirmSwap(decision: SwapDecision) {
    if (!swapFor || !view || !rows) return;
    const { index, target } = swapFor;
    const exercise = current.exercises[index];
    const alternative = exercise ? alternativeTarget(view, exercise, decision.candidateId) : null;
    if (!exercise || !alternative) {
      setSwapError(t.swap.failed);
      return;
    }
    setSwapBusy(true);
    setSwapError(undefined);
    try {
      let preferences: { changes: readonly PreferenceChange[]; at: PreferenceSwapContext } | null =
        null;
      if (decision.duration === 'always') {
        // Nie still auf „Nur heute“ ausweichen (Wächter T2-K3) – der Dialog verlangt Ort und Grund.
        if (!decision.location || !decision.kind) throw new BackendError('unknown');
        const save = preferenceSaveFor(target, rows, {
          location: decision.location,
          kind: decision.kind,
          replacementId: decision.candidateId,
          now: now(),
        });
        const at = preferenceContextOf(target);
        await app.updateExercisePreferences(save.changes, at);
        preferences = { changes: save.undo, at };
      }
      update(chooseAlternative(current, index, alternative, now()));
      const text = t.swap.done(currentTarget(exercise).nameDe, alternative.nameDe);
      setSwapFeedback({
        text: preferences ? `${text} ${t.swap.doneAlwaysHint}` : text,
        tone: 'success',
        undo: { index, previous: exercise.alternative, preferences },
      });
      setSwapFor(null);
    } catch (caught) {
      setSwapError(caught instanceof BackendError ? errorText(caught) : t.swap.failed);
    } finally {
      setSwapBusy(false);
    }
  }

  async function undoSwap() {
    const undo = swapFeedback?.undo;
    if (!undo) return;
    setSwapBusy(true);
    try {
      if (undo.preferences) {
        await app.updateExercisePreferences(undo.preferences.changes, undo.preferences.at);
      }
      update(chooseAlternative(current, undo.index, undo.previous, now()), true);
      setSwapFeedback({ text: t.swap.undone, tone: 'info', undo: null });
    } catch (caught) {
      setSwapFeedback({ text: errorText(caught), tone: 'danger', undo: null });
    } finally {
      setSwapBusy(false);
    }
  }

  async function save() {
    if (cardioResult && !cardioResult.ok) {
      setError(t.workout.cardio.invalid);
      return;
    }
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
      rest.stop();
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
      // Gleiche Optionen wie die Anzeige (Wächter T2-S2): sonst fände die Neuberechnung eine „nur heute“
      // getauschte Übung nicht.
      const nextView =
        lib && rules
          ? workoutView(nextRows, lib, rules, sessionId, today, {
              daySwaps: app.daySwaps,
              ownerUserId,
            })
          : null;
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
          {/* Dauerhafte Live-Region (Wächter C2 S1): nur ihr Text ändert sich beim Pausenende. */}
          {isEndurance ? null : <RestAnnouncer text={rest.over ? t.workout.rest.over : ''} />}
          {rest.active && !isEndurance ? (
            <RestTimerBar
              remaining={rest.remaining}
              over={rest.over}
              onAdjust={rest.adjust}
              onStop={rest.stop}
            />
          ) : null}
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
      {isEndurance ? null : <Body muted>{progressText}</Body>}
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

      {isEndurance && current.cardio ? (
        <EnduranceCard
          cardio={current.cardio}
          plannedMinutes={session?.estimated_minutes ?? null}
          errors={cardioResult && !cardioResult.ok ? cardioResult.errors : {}}
          onChange={(patch) => update(setCardioFields(current, patch, now()))}
        />
      ) : null}

      {current.exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          canSwitch={canSwitch}
          onSwap={() => openSwap(index)}
          guide={guideFor(currentTarget(exercise).exerciseId)}
          onOpenGuide={() =>
            router.push(
              `/uebungen/${encodeURIComponent(currentTarget(exercise).exerciseId)}` as Href,
            )
          }
          onSkip={(skipped) => update(setSkipped(current, index, skipped, now()))}
          onSet={(setIndex, patch) => changeSet(index, setIndex, patch)}
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

      {swapFeedback ? (
        <SwapFeedback
          text={swapFeedback.text}
          tone={swapFeedback.tone}
          onUndo={swapFeedback.undo ? () => void undoSwap() : null}
          undoBusy={swapBusy}
        />
      ) : null}

      <Card>
        <Heading level={2}>{t.workout.finishTitle}</Heading>
        {isEndurance ? <Body muted>{t.workout.cardio.talkTestIntro}</Body> : null}
        <EffortSlider
          label={isEndurance ? t.workout.cardio.effortLabel : t.workout.effortLabel}
          value={current.sessionRpe}
          onChange={(value) => update(setSessionFields(current, { sessionRpe: value }, now()))}
          testID="workout-effort"
        />
        {isEndurance && current.sessionRpe !== null ? (
          <Body testID="workout-talk-test">
            {t.workout.cardio.talkTest[talkTestLevel(current.sessionRpe)]}
          </Body>
        ) : null}
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

      <SwapDialog
        target={swapFor?.target ?? null}
        allowAlways={app.backend.supportsExercisePreferences}
        workout
        backToPlanned={(() => {
          const exercise = swapFor ? current.exercises[swapFor.index] : undefined;
          if (!swapFor || !exercise?.alternative) return null;
          const index = swapFor.index;
          return {
            label: t.swap.backToPlanned(exercise.planned.nameDe),
            onPress: () => {
              update(chooseAlternative(current, index, null, now()));
              closeSwap();
            },
          };
        })()}
        busy={swapBusy}
        error={swapError}
        onConfirm={(decision) => void confirmSwap(decision)}
        onCancel={closeSwap}
        onOpenGuide={(exerciseId) => {
          // Sicher: Der Entwurf ist bei jedem Tipp gespeichert (8.1).
          setSwapFor(null);
          router.push(`/uebungen/${encodeURIComponent(exerciseId)}` as Href);
        }}
        onAdjustEquipment={() => {
          setSwapFor(null);
          router.push('/onboarding/equipment?edit=1' as Href);
        }}
      />
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
  onSwap,
  guide,
  onOpenGuide,
  onSkip,
  onSet,
  onAddSet,
  onConfirmWeight,
  startWeight,
}: {
  exercise: DraftExercise;
  index: number;
  canSwitch: boolean;
  /** „Tauschen“ (Etappe T2): Dialog mit Alternativen, „Nur heute“ / „Ab jetzt immer“. */
  onSwap: () => void;
  /** Kurz-Anleitung zum Aufklappen (ohne den Trainingsmodus zu verlassen); null = Bibliothek fehlt. */
  guide: { steps: readonly string[]; safetyNote: string } | null;
  onOpenGuide: () => void;
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
  const [guideOpen, setGuideOpen] = useState(false);
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
        {guide ? (
          // Aufklappen statt Navigieren: Pausentimer und Eingaben bleiben, wo sie sind (Plan 8.1).
          <View style={styles.guide}>
            <Button
              label={t.glossary.howToShow}
              variant="secondary"
              expanded={guideOpen}
              accessibilityLabel={t.glossary.howToA11y(target.nameDe)}
              onPress={() => setGuideOpen((open) => !open)}
              testID={`workout-howto-${index}`}
            />
            {guideOpen ? (
              <View style={styles.guide} testID={`workout-howto-panel-${index}`}>
                {guide.steps.map((step, stepIndex) => (
                  <View
                    key={`${stepIndex}-${step}`}
                    style={styles.guideStep}
                    accessible
                    accessibilityLabel={t.glossary.stepA11y(
                      stepIndex + 1,
                      guide.steps.length,
                      step,
                    )}
                  >
                    <Body style={styles.guideNo}>{stepIndex + 1}.</Body>
                    <Body style={styles.guideText}>{step}</Body>
                  </View>
                ))}
                <Notice title={t.glossary.safetyTitle} titleAsHeader>
                  <Body>{guide.safetyNote}</Body>
                </Notice>
                <Button
                  label={t.glossary.fullGuide}
                  variant="link"
                  accessibilityLabel={t.glossary.guideA11y(target.nameDe)}
                  onPress={onOpenGuide}
                  testID={`workout-guide-${index}`}
                />
              </View>
            ) : null}
          </View>
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
              label={t.swap.button}
              variant="secondary"
              accessibilityLabel={t.swap.buttonA11y(target.nameDe)}
              onPress={onSwap}
              testID={`workout-swap-${index}`}
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

/**
 * Ausdauer-Eintrag (6.1 Punkt 3): tatsächliche Art, Dauer (Std/Min, Pflicht), Distanz in km mit Komma, Höhenmeter;
 * Pace bzw. km/h erscheint live (packages/core cardioSpeed), zu schnell → nur „Bitte prüfen“.
 */
function EnduranceCard({
  cardio,
  plannedMinutes,
  errors,
  onChange,
}: {
  cardio: DraftCardio;
  plannedMinutes: number | null;
  errors: Partial<
    Record<'duration' | 'distance' | 'elevation', keyof typeof t.workout.cardio.errors>
  >;
  onChange: (patch: Partial<DraftCardio>) => void;
}) {
  const input = cardioInputOf(cardio);
  const durationS = cardioDurationS(input);
  const distanceM =
    input.distanceKm !== null && Number.isFinite(input.distanceKm) && input.distanceKm > 0
      ? Math.round(input.distanceKm * 1000)
      : null;
  const speed = errors.duration ? null : cardioSpeed(cardio.modality, durationS, distanceM);
  const durationError = errors.duration ? t.workout.cardio.errors[errors.duration] : undefined;
  return (
    <Card>
      <View testID="workout-cardio" style={styles.exercise}>
        <Heading level={2}>{t.workout.cardio.title}</Heading>
        <Body muted>{t.workout.cardio.intro}</Body>
        {plannedMinutes !== null ? (
          <Body muted>{t.workout.cardio.planned(plannedMinutes)}</Body>
        ) : null}
        <ChoiceList<EnduranceModality>
          label={t.workout.cardio.modality}
          options={ENDURANCE_MODALITIES.map((value) => ({
            value,
            label: t.workout.cardio.modalities[value],
          }))}
          value={cardio.modality}
          onChange={(modality) => onChange({ modality })}
          horizontal
        />
        <Body style={styles.setLabel}>{t.workout.cardio.duration}</Body>
        <View style={styles.steppers}>
          <TextField
            label={t.workout.cardio.hours}
            value={cardio.hours}
            onChangeText={(hours) => onChange({ hours })}
            keyboardType="number-pad"
            maxLength={2}
            style={styles.durationField}
            describedBy={{ id: 'workout-cardio-duration-error', text: durationError }}
            testID="workout-cardio-hours"
          />
          <TextField
            label={t.workout.cardio.minutes}
            value={cardio.minutes}
            onChangeText={(minutes) => onChange({ minutes })}
            keyboardType="number-pad"
            maxLength={3}
            style={styles.durationField}
            describedBy={{ id: 'workout-cardio-duration-error', text: durationError }}
            testID="workout-cardio-minutes"
          />
        </View>
        <FieldError
          message={durationError}
          testID="workout-cardio-duration-error"
          nativeID="workout-cardio-duration-error"
        />
        <TextField
          label={t.workout.cardio.distance}
          hint={t.workout.cardio.distanceHint}
          value={cardio.distanceKm}
          onChangeText={(distanceKm) => onChange({ distanceKm })}
          keyboardType="decimal-pad"
          maxLength={7}
          error={errors.distance ? t.workout.cardio.errors[errors.distance] : undefined}
          testID="workout-cardio-distance"
        />
        <View accessibilityLiveRegion="polite" aria-live="polite" testID="workout-cardio-speed">
          {speed ? (
            cardioSpeedTexts(speed).map((line) => (
              <Body key={line.text} style={styles.setLabel} accessibilityLabel={line.a11y}>
                {line.text}
              </Body>
            ))
          ) : (
            <Body muted>{t.workout.cardio.noDistance}</Body>
          )}
        </View>
        {speed?.check ? (
          <Notice tone="warning" testID="workout-cardio-check">
            {t.workout.cardio.checkSpeed}
          </Notice>
        ) : null}
        <TextField
          label={t.workout.cardio.elevation}
          value={cardio.elevationM}
          onChangeText={(elevationM) => onChange({ elevationM })}
          keyboardType="number-pad"
          maxLength={5}
          error={errors.elevation ? t.workout.cardio.errors[errors.elevation] : undefined}
          testID="workout-cardio-elevation"
        />
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
  durationField: { flex: 1, minWidth: 120 },
  guide: { gap: 6 },
  guideStep: { flexDirection: 'row', gap: 8 },
  guideNo: { fontWeight: '700', minWidth: 24 },
  guideText: { flex: 1 },
});
