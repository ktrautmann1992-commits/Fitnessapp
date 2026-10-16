import {
  COMPETITION_DISCIPLINES,
  type CompetitionDiscipline,
  type CompetitionFeasibility,
  type CompetitionGoal,
  competitionCountdown,
  competitionDistanceM,
  type FeasibilitySuggestion,
  freeSessionDates,
  isCompetitionDiscipline,
  ownStartAllowedLevel,
  SESSION_LOG_LIMITS,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CountdownCard, FeasibilityCard } from '@/components/competition';
import { ConfirmDialog, DateInput, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { EffortSlider } from '@/components/workout';
import {
  type CompetitionDraft,
  competitionEntry,
  countdownPayload,
  currentLevel,
  draftFeasibility,
  draftFromStored,
  isCompetitionPlan,
  plannedCompetition,
  resavePayload,
  resultLogCandidate,
} from '@/data/competition';
import { newId } from '@/data/create-backend';
import { activePlan } from '@/data/training-plan';
import { createFreeDraft, setCardioFields, setSessionFields } from '@/data/workout-draft';
import { t } from '@/i18n';
import {
  clockText,
  disciplineText,
  kmText,
  partsFromSeconds,
  secondsFromParts,
} from '@/lib/competition-format';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import {
  berlinTodayIso,
  datePartsFromIso,
  formatDateDe,
  isoFromDateParts,
  todayIso,
} from '@/lib/format';
import { dayLabel } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * „Mein Wettkampf“ (docs/PLAN-PHASE-10.md Abschnitt 8, Etappe WP4): Wettkampf eintragen/ändern mit Ampel sofort beim
 * Datum (grün/gelb/rot immer mit Wort und Zeichen, Vorschläge), Wettkampfplan erstellen (save_competition mit
 * Plan-Bezug → save_training_plan), nur Countdown speichern, Ergebnis eintragen (freie Einheit A1b), absagen, löschen.
 * Anlegen und Ändern nur online; Plan und Timer laufen offline. Alle Regeln kommen aus packages/core.
 */

const C = t.competition;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type Parts = { day: string; month: string; year: string };
type Time = { hours: string; minutes: string; seconds: string };

interface FormState {
  discipline: CompetitionDiscipline;
  date: Parts;
  name: string;
  goal: CompetitionGoal;
  target: Time;
  withReference: boolean;
  refDiscipline: CompetitionDiscipline;
  refTime: Time;
  refDate: Parts;
  longRunWeekday: number | null;
  ownStart: string;
  ownStartConfirmed: boolean;
}

type FormErrors = Partial<
  Record<'date' | 'name' | 'target' | 'refTime' | 'refDate' | 'ownStart', string>
>;

function formFrom(
  draft: CompetitionDraft | null,
  fallback: { discipline: CompetitionDiscipline; date: string | null },
): FormState {
  const c = draft?.competition;
  const ref = c?.reference ?? null;
  return {
    discipline: c?.discipline ?? fallback.discipline,
    date: datePartsFromIso(c?.raceDate ?? fallback.date),
    name: c?.name ?? '',
    goal: c?.goal ?? 'finish',
    target: partsFromSeconds(c?.targetTimeS ?? null),
    withReference: ref !== null,
    refDiscipline: ref?.discipline ?? '10k',
    refTime: partsFromSeconds(ref?.timeS ?? null),
    refDate: datePartsFromIso(ref?.date ?? null),
    longRunWeekday: draft?.longRunWeekday ?? null,
    ownStart: draft?.ownStart ? String(draft.ownStart.weeklyMinutes) : '',
    ownStartConfirmed: draft?.ownStart !== null && draft?.ownStart !== undefined,
  };
}

/** Formular → Angaben (Zod prüft danach packages/core). Fehler je Feld auf Deutsch. */
function draftOf(
  form: FormState,
  today: string,
  ownStartAllowed: boolean,
): { draft: CompetitionDraft | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const raceDate = isoFromDateParts(form.date.day, form.date.month, form.date.year);
  if (raceDate === null || Number.isNaN(Date.parse(raceDate))) errors.date = C.errorsForm.raceDate;
  else if (raceDate <= today) errors.date = C.errorsForm.raceDatePast;
  const name = form.name.trim() === '' ? disciplineText(form.discipline) : form.name.trim();
  if (name.length > 80) errors.name = C.errorsForm.name;
  const targetTimeS =
    form.goal === 'time'
      ? secondsFromParts(form.target.hours, form.target.minutes, form.target.seconds)
      : null;
  if (form.goal === 'time' && targetTimeS === null) errors.target = C.errorsForm.time;
  let reference: { discipline: CompetitionDiscipline; timeS: number; date: string } | null = null;
  if (form.withReference) {
    const timeS = secondsFromParts(form.refTime.hours, form.refTime.minutes, form.refTime.seconds);
    const date = isoFromDateParts(form.refDate.day, form.refDate.month, form.refDate.year);
    if (timeS === null) errors.refTime = C.errorsForm.time;
    if (date === null) errors.refDate = C.errorsForm.referenceDate;
    if (timeS !== null && date !== null)
      reference = { discipline: form.refDiscipline, timeS, date };
  } else if (form.goal === 'time') {
    errors.target = C.errorsForm.referenceMissing;
  }
  let ownStart: CompetitionDraft['ownStart'] = null;
  if (ownStartAllowed && form.ownStart.trim() !== '') {
    const minutes = Number(form.ownStart.trim());
    if (!/^\d{1,4}$/.test(form.ownStart.trim()) || minutes < 10 || !form.ownStartConfirmed) {
      errors.ownStart = C.errorsForm.ownStart;
    } else {
      ownStart = { weeklyMinutes: minutes, confirmed: true };
    }
  }
  if (Object.keys(errors).length > 0 || raceDate === null) return { draft: null, errors };
  return {
    draft: {
      competition: {
        name,
        discipline: form.discipline,
        raceDate,
        goal: form.goal,
        targetTimeS,
        reference,
      },
      longRunWeekday: form.longRunWeekday,
      ownStart,
    },
    errors,
  };
}

/** Bleibt der Plan-Bezug gültig (nur Name bzw. Wunsch-Tag geändert)? */
function samePlanBasis(a: CompetitionDraft, b: CompetitionDraft): boolean {
  const x = a.competition;
  const y = b.competition;
  return (
    x.discipline === y.discipline &&
    x.raceDate === y.raceDate &&
    (x.goal ?? 'finish') === (y.goal ?? 'finish') &&
    (x.targetTimeS ?? null) === (y.targetTimeS ?? null) &&
    JSON.stringify(x.reference ?? null) === JSON.stringify(y.reference ?? null) &&
    JSON.stringify(a.ownStart) === JSON.stringify(b.ownStart)
  );
}

type Mode = 'view' | 'form' | 'result';

export default function CompetitionScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ neu?: string }>();
  const today = todayIso();
  const rows = app.rows;
  const planned = rows ? plannedCompetition(rows) : null;
  const entry = rows ? competitionEntry(rows, today) : null;
  const active = rows ? activePlan(rows) : null;
  const level = rows ? currentLevel(rows) : 'beginner';
  const goalDiscipline =
    rows?.goals?.goal_type === 'endurance' && isCompetitionDiscipline(rows.goals.discipline)
      ? rows.goals.discipline
      : 'half_marathon';
  const [mode, setMode] = useState<Mode>(() => (params.neu === '1' && !planned ? 'form' : 'view'));
  const [form, setForm] = useState<FormState>(() =>
    formFrom(planned ? draftFromStored(planned.stored) : null, {
      discipline: goalDiscipline,
      date:
        rows?.goals?.target_date && rows.goals.target_date > today ? rows.goals.target_date : null,
    }),
  );
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'info' | 'danger'; text: string }>();
  const [notFeasible, setNotFeasible] = useState<CompetitionFeasibility | null>(null);
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [recreateDialog, setRecreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  // Ergebnis
  const [resultTime, setResultTime] = useState<Time>({ hours: '', minutes: '', seconds: '' });
  const [resultEffort, setResultEffort] = useState<number | null>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [resultError, setResultError] = useState<string>();

  const ownStartAllowed = ownStartAllowedLevel(level);
  const parsed = useMemo(
    () => draftOf(form, today, ownStartAllowed),
    [form, today, ownStartAllowed],
  );
  const feasibility = useMemo(
    () =>
      rows && parsed.draft
        ? draftFeasibility(rows, app.versions, active, parsed.draft, today)
        : null,
    [active, app.versions, parsed.draft, rows, today],
  );

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState label={C.loading} />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== '/today' || !rows) return <Redirect href={route as Href} />;

  const competitionPlanActive = isCompetitionPlan(active);
  const offline = app.offline;
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  }
  const back = <Button label={t.common.back} variant="secondary" onPress={() => goBack()} />;
  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setNotFeasible(null);
    setError(undefined);
  }

  function openForm() {
    setForm(
      formFrom(planned ? draftFromStored(planned.stored) : null, {
        discipline: goalDiscipline,
        date:
          rows?.goals?.target_date && rows.goals.target_date > today
            ? rows.goals.target_date
            : null,
      }),
    );
    setTouched(false);
    setError(undefined);
    setMessage(undefined);
    setNotFeasible(null);
    setMode('form');
  }

  function applySuggestion(s: FeasibilitySuggestion) {
    if (s.kind === 'later_date') update({ date: datePartsFromIso(s.raceDate) });
    else if (s.kind === 'shorter_distance') update({ discipline: s.discipline });
    else if (s.kind === 'health_check') router.push('/onboarding/health_screening?edit=1' as Href);
    else if (s.kind === 'without_competition') {
      setMode('view');
      setMessage({ tone: 'info', text: C.planNotFeasible });
    }
  }

  async function createPlan() {
    setConfirmPlan(false);
    if (!parsed.draft) return;
    setBusy(true);
    setError(undefined);
    const outcome = await app.createCompetitionPlan(parsed.draft, planned?.stored.id ?? null);
    setBusy(false);
    if (outcome.ok) {
      setMode('view');
      setMessage({ tone: 'success', text: C.created });
      return;
    }
    if (outcome.kind === 'not_feasible') setNotFeasible(outcome.feasibility);
    else if (outcome.kind === 'blocked') {
      setError(
        outcome.blocker === 'goal_not_endurance' || outcome.blocker === 'incomplete'
          ? C.blocked[outcome.blocker]
          : createPlanErrorText(outcome.blocker),
      );
    } else setError(errorText(outcome.error));
  }

  async function saveOnly() {
    if (!parsed.draft) {
      setTouched(true);
      return;
    }
    // Plan-Bezug unverändert gültig → mitschicken (save_competition ersetzt den ganzen Datensatz, WP3).
    const payload =
      planned && samePlanBasis(parsed.draft, draftFromStored(planned.stored))
        ? resavePayload(planned.stored, parsed.draft)
        : countdownPayload(parsed.draft, planned?.stored.id ?? null);
    if (!payload) {
      setError(C.errors.invalid);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await app.saveCompetition(payload);
      setMode('view');
      setMessage({ tone: 'success', text: planned ? C.saved : C.savedCountdown });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>, success: string, after?: () => void) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      after?.();
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function recreateWithoutCompetition() {
    setRecreateDialog(false);
    setBusy(true);
    const outcome = await app.createPlan();
    setBusy(false);
    setMessage(
      outcome.ok
        ? { tone: 'success', text: t.plan.created }
        : { tone: 'danger', text: createPlanErrorText(outcome.code) },
    );
  }

  // --- Ergebnis eintragen -----------------------------------------------------------------------------------
  const raceEntry = planned ?? entry;
  const raceDate = raceEntry?.stored.competition.raceDate ?? null;
  const resultAllowedDates = freeSessionDates(berlinTodayIso());
  const resultTooOld = raceDate !== null && !resultAllowedDates.includes(raceDate);
  const existingLog = raceDate ? resultLogCandidate(rows, raceDate) : null;

  async function saveResult() {
    if (!raceEntry || !raceDate || !app.session) return;
    const total = secondsFromParts(resultTime.hours, resultTime.minutes, resultTime.seconds);
    if (total === null || total < 60 || total > 12 * 3600) {
      setResultError(C.result.timeInvalid);
      return;
    }
    if (resultNotes.length > SESSION_LOG_LIMITS.notesMaxChars) {
      setResultError(t.workout.notesTooLong(SESSION_LOG_LIMITS.notesMaxChars));
      return;
    }
    setResultError(undefined);
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const minutesTotal = Math.max(1, Math.round(total / 60));
      let draft = createFreeDraft({
        ownerUserId: app.session.userId,
        kind: 'endurance',
        modality: 'run',
        exercises: [],
        performedOn: raceDate,
        today: berlinTodayIso(),
        now,
        newId,
      });
      draft = setCardioFields(
        draft,
        {
          hours: String(Math.floor(minutesTotal / 60)),
          minutes: String(minutesTotal % 60),
          distanceKm: kmText(competitionDistanceM(raceEntry.stored.competition.discipline)),
        },
        now,
      );
      // Genaue Zeit (mit Sekunden) als Notiz – die Dauer im Tagebuch hat ganze Minuten.
      const notes = [C.result.resultLine(clockText(total)), resultNotes.trim()]
        .filter((line) => line !== '')
        .join(' · ');
      draft = setSessionFields(draft, { sessionRpe: resultEffort, notes }, now);
      const outcome = await app.submitWorkout(draft);
      if (outcome.kind === 'saved') {
        await app.completeCompetition(raceEntry.stored.id, draft.logId);
        setMode('view');
        setMessage({ tone: 'success', text: C.result.saved });
      } else if (outcome.kind === 'queued') {
        setMessage({ tone: 'info', text: C.result.queued });
        setMode('view');
      } else if (outcome.kind === 'invalid') {
        setResultError(C.result.timeInvalid);
      } else {
        setResultError(t.errors.generic);
      }
    } catch (caught) {
      setResultError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  // --- Ansichten ---------------------------------------------------------------------------------------------
  const header = (
    <>
      {offline ? <Notice tone="warning">{C.offlineCreate}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} testID="competition-message">
          {message.text}
        </Notice>
      ) : null}
    </>
  );

  if (mode === 'result' && raceEntry && raceDate) {
    return (
      <Screen title={C.result.title} testID="competition-result" footer={back}>
        {header}
        <Body muted>{`${raceEntry.stored.competition.name} · ${dayLabel(raceDate)}`}</Body>
        <Body muted>{C.result.intro}</Body>
        {resultTooOld ? (
          <Notice tone="info" testID="competition-result-too-old">
            {C.result.tooOld}
          </Notice>
        ) : (
          <Card>
            <Heading level={2}>{C.result.time}</Heading>
            <TimeFields value={resultTime} onChange={setResultTime} prefix="competition-result" />
            <EffortSlider
              label={C.result.effort}
              value={resultEffort}
              onChange={setResultEffort}
              testID="competition-result-effort"
            />
            <TextField
              label={C.result.notes}
              value={resultNotes}
              onChangeText={setResultNotes}
              multiline
              testID="competition-result-notes"
            />
            <FieldError message={resultError} testID="competition-result-error" />
            <Button
              label={C.result.save}
              onPress={() => void saveResult()}
              loading={busy}
              disabled={offline}
              testID="competition-result-save"
            />
          </Card>
        )}
        {existingLog && raceEntry.row.status === 'planned' ? (
          <Button
            label={C.result.linkLog}
            variant="secondary"
            disabled={offline || busy}
            onPress={() =>
              void run(
                () => app.completeCompetition(raceEntry.stored.id, existingLog),
                C.result.done,
                () => setMode('view'),
              )
            }
            testID="competition-result-link"
          />
        ) : null}
        {raceEntry.row.status === 'planned' ? (
          <Button
            label={C.result.withoutResult}
            variant="secondary"
            disabled={offline || busy}
            onPress={() =>
              void run(
                () => app.completeCompetition(raceEntry.stored.id, null),
                C.result.done,
                () => setMode('view'),
              )
            }
            testID="competition-result-without"
          />
        ) : null}
      </Screen>
    );
  }

  if (mode === 'form') {
    const shownErrors = touched ? parsed.errors : {};
    const result = feasibility?.kind === 'result' ? feasibility.result : null;
    const shown = notFeasible ?? (result?.ok ? result.feasibility : null);
    const usable = shown !== null && (shown.status === 'ok' || shown.status === 'tight');
    const changedBasis =
      planned !== null &&
      parsed.draft !== null &&
      !samePlanBasis(parsed.draft, draftFromStored(planned.stored));
    const goalChange =
      parsed.draft !== null &&
      rows.goals?.goal_type === 'endurance' &&
      rows.goals.discipline !== form.discipline;
    return (
      <Screen
        title={planned ? C.formTitleEdit : C.formTitleNew}
        testID="competition-form"
        footer={
          <View style={{ gap: 8 }}>
            <FieldError message={error} testID="competition-error" />
            {usable && feasibility?.kind === 'result' ? (
              <Button
                label={planned && competitionPlanActive ? C.recreatePlan : C.createPlan}
                onPress={() => (active ? setConfirmPlan(true) : void createPlan())}
                loading={busy}
                disabled={offline}
                testID="competition-create-plan"
              />
            ) : null}
            <Button
              label={planned && !changedBasis ? C.save : C.saveCountdown}
              variant="secondary"
              onPress={() => {
                setTouched(true);
                void saveOnly();
              }}
              disabled={offline || busy}
              testID="competition-save-countdown"
            />
            <Button
              label={C.cancelForm}
              variant="secondary"
              onPress={() => setMode('view')}
              disabled={busy}
            />
          </View>
        }
      >
        {header}
        <Body muted>{C.intro}</Body>
        <Card>
          <ChoiceList<CompetitionDiscipline>
            label={C.discipline}
            horizontal
            options={COMPETITION_DISCIPLINES.map((value) => ({
              value,
              label: C.disciplines[value],
            }))}
            value={form.discipline}
            onChange={(value) => update({ discipline: value })}
          />
          <Body muted>{C.disciplineHint}</Body>
          <DateInput
            label={C.raceDate}
            value={form.date}
            onChange={(date) => {
              setTouched(true);
              update({ date });
            }}
            error={shownErrors.date}
          />
          <TextField
            label={C.name}
            hint={C.nameHint}
            value={form.name}
            onChangeText={(name) => update({ name })}
            maxLength={80}
            error={shownErrors.name}
            testID="competition-name"
          />
        </Card>
        <Card>
          <ChoiceList<CompetitionGoal>
            label={C.goal}
            horizontal
            options={(['finish', 'time'] as const).map((value) => ({
              value,
              label: C.goals[value],
            }))}
            value={form.goal}
            onChange={(goal) =>
              update({ goal, ...(goal === 'time' ? { withReference: true } : {}) })
            }
          />
          {form.goal === 'time' ? (
            <>
              <Body muted>{C.goalTimeHint}</Body>
              <Body>{C.targetTime}</Body>
              <TimeFields
                value={form.target}
                onChange={(target) => update({ target })}
                prefix="competition-target"
              />
              <FieldError message={shownErrors.target} />
            </>
          ) : null}
        </Card>
        <Card>
          <Heading level={2}>{C.referenceTitle}</Heading>
          <Body muted>{C.referenceText}</Body>
          {form.withReference ? (
            <>
              <ChoiceList<CompetitionDiscipline>
                label={C.referenceDiscipline}
                horizontal
                options={COMPETITION_DISCIPLINES.map((value) => ({
                  value,
                  label: C.disciplines[value],
                }))}
                value={form.refDiscipline}
                onChange={(refDiscipline) => update({ refDiscipline })}
              />
              <Body>{C.referenceTime}</Body>
              <TimeFields
                value={form.refTime}
                onChange={(refTime) => update({ refTime })}
                prefix="competition-reference"
              />
              <FieldError message={shownErrors.refTime} />
              <DateInput
                label={C.referenceDate}
                value={form.refDate}
                onChange={(refDate) => update({ refDate })}
                error={shownErrors.refDate}
              />
              <Button
                label={C.referenceRemove}
                variant="link"
                onPress={() => update({ withReference: false, goal: 'finish' })}
              />
            </>
          ) : (
            <Button
              label={C.referenceAdd}
              variant="secondary"
              onPress={() => update({ withReference: true })}
              testID="competition-reference-add"
            />
          )}
        </Card>
        <Card>
          <ChoiceList<number>
            label={C.longRunDay}
            horizontal
            options={[
              { value: 0, label: C.longRunAuto },
              ...WEEKDAYS.map((value) => ({
                value,
                label: t.steps.trainingSchedule.weekdays[value - 1] ?? String(value),
              })),
            ]}
            value={form.longRunWeekday ?? 0}
            onChange={(value) => update({ longRunWeekday: value === 0 ? null : value })}
          />
          {ownStartAllowed ? (
            <>
              <Heading level={2}>{C.ownStartTitle}</Heading>
              <Body muted>{C.ownStartText}</Body>
              <TextField
                label={C.ownStartMinutes}
                value={form.ownStart}
                onChangeText={(ownStart) => update({ ownStart: ownStart.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={4}
                error={shownErrors.ownStart}
                testID="competition-own-start"
              />
              <Checkbox
                label={C.ownStartConfirm}
                checked={form.ownStartConfirmed}
                onChange={(ownStartConfirmed) => update({ ownStartConfirmed })}
              />
            </>
          ) : null}
        </Card>

        {/* Ampel sofort beim Datum (Plan 8). */}
        {feasibility?.kind === 'blocked' ? (
          <Notice tone="info" testID="competition-blocked">
            {C.blocked[feasibility.blocker]}
          </Notice>
        ) : result && !result.ok && !notFeasible ? (
          <Notice tone="warning" testID="competition-invalid">
            {C.errors.invalid}
          </Notice>
        ) : shown ? (
          <FeasibilityCard feasibility={shown} onSuggestion={applySuggestion} />
        ) : null}
        {usable && goalChange ? (
          <Body muted>{C.goalChange(disciplineText(form.discipline))}</Body>
        ) : null}
        {shown && !usable ? (
          <Button
            label={C.withoutCompetition}
            variant="secondary"
            onPress={() => applySuggestion({ kind: 'without_competition' })}
            testID="competition-without"
          />
        ) : null}
        <ConfirmDialog
          visible={confirmPlan}
          title={C.confirmRecreateTitle}
          message={C.confirmRecreateText}
          confirmLabel={C.confirmRecreate}
          confirmVariant="primary"
          onConfirm={() => void createPlan()}
          onCancel={() => setConfirmPlan(false)}
          loading={busy}
        />
      </Screen>
    );
  }

  // --- Übersicht --------------------------------------------------------------------------------------------
  const past = rows.competitions
    .filter((c) => c.status !== 'planned')
    .sort((a, b) => b.race_date.localeCompare(a.race_date));
  const shownEntry = planned ?? entry;
  const countdown = shownEntry
    ? competitionCountdown(
        {
          status: shownEntry.row.status,
          discipline: shownEntry.stored.competition.discipline,
          raceDate: shownEntry.stored.competition.raceDate,
          resultSessionLogId: shownEntry.stored.resultSessionLogId,
        },
        today,
      )
    : null;
  const comp = shownEntry?.stored.competition;
  return (
    <Screen title={C.title} testID="competition" footer={back}>
      {header}
      {shownEntry && countdown && comp ? (
        <>
          <CountdownCard
            countdown={countdown}
            discipline={comp.discipline}
            name={comp.name}
            onOpen={
              countdown.kind === 'race_day' || countdown.kind === 'awaiting_result'
                ? () => setMode('result')
                : countdown.kind === 'done'
                  ? () => openForm()
                  : null
            }
          />
          <Card>
            <View style={{ gap: 4 }} testID="competition-summary">
              <Heading level={2}>{comp.name}</Heading>
              <Body>{C.summaryDate(dayLabel(comp.raceDate))}</Body>
              <Body>{`${C.discipline}: ${disciplineText(comp.discipline)}`}</Body>
              <Body>{C.summaryGoal(C.goals[comp.goal])}</Body>
              {comp.targetTimeS !== null ? (
                <Body>{C.summaryTarget(clockText(comp.targetTimeS))}</Body>
              ) : null}
              {comp.reference ? (
                <Body>
                  {C.summaryReference(
                    disciplineText(comp.reference.discipline),
                    clockText(comp.reference.timeS),
                    formatDateDe(comp.reference.date),
                  )}
                </Body>
              ) : null}
              {shownEntry.row.status === 'planned' ? (
                <Body muted testID="competition-plan-state">
                  {competitionPlanActive && shownEntry.stored.effectiveGoal !== null
                    ? C.planIsCompetition
                    : C.planIsBasic}
                </Body>
              ) : null}
              {shownEntry.row.status === 'done' ? (
                <Body testID="competition-result-state">
                  {shownEntry.stored.resultSessionLogId ? C.result.saved : C.result.noResult}
                </Body>
              ) : null}
            </View>
          </Card>
          {shownEntry.row.status === 'planned' ? (
            <>
              {countdown.kind === 'race_day' || countdown.kind === 'awaiting_result' ? (
                <Button
                  label={C.result.title}
                  onPress={() => setMode('result')}
                  testID="competition-open-result"
                />
              ) : null}
              <Button
                label={C.edit}
                variant="secondary"
                onPress={openForm}
                disabled={offline}
                testID="competition-edit"
              />
              <Button
                label={C.cancel}
                variant="danger"
                onPress={() => setCancelDialog(true)}
                disabled={offline || busy}
                testID="competition-cancel"
              />
            </>
          ) : (
            <Button
              label={C.nextGoal}
              onPress={openForm}
              disabled={offline}
              testID="competition-add"
            />
          )}
        </>
      ) : (
        <Card>
          <Heading level={2}>{C.emptyTitle}</Heading>
          <Body muted>{C.emptyText}</Body>
          <Button label={C.add} onPress={openForm} disabled={offline} testID="competition-add" />
        </Card>
      )}
      {past.length > 0 ? (
        <View style={{ gap: 8 }} testID="competition-past">
          {past.map((c) => (
            <Card key={c.id}>
              <Body>{`${c.name} · ${formatDateDe(c.race_date)} · ${
                c.status === 'cancelled' ? C.cancelled : C.result.done
              }`}</Body>
              <Button
                label={C.delete}
                variant="link"
                onPress={() => setDeleteDialog(c.id)}
                disabled={offline || busy}
                testID={`competition-delete-${c.id}`}
              />
            </Card>
          ))}
        </View>
      ) : null}
      <ConfirmDialog
        visible={cancelDialog}
        title={C.cancelTitle}
        message={C.cancelText}
        confirmLabel={C.cancelConfirm}
        onConfirm={() => {
          setCancelDialog(false);
          if (!planned) return;
          void run(
            () => app.cancelCompetition(planned.stored.id),
            C.cancelled,
            competitionPlanActive ? () => setRecreateDialog(true) : undefined,
          );
        }}
        onCancel={() => setCancelDialog(false)}
        loading={busy}
      />
      <ConfirmDialog
        visible={recreateDialog}
        title={C.confirmRecreateTitle}
        message={C.planEndedText}
        confirmLabel={C.recreateAfterCancel}
        confirmVariant="primary"
        onConfirm={() => void recreateWithoutCompetition()}
        onCancel={() => setRecreateDialog(false)}
        loading={busy}
      />
      <ConfirmDialog
        visible={deleteDialog !== null}
        title={C.deleteTitle}
        message={C.deleteText}
        confirmLabel={C.deleteConfirm}
        onConfirm={() => {
          const id = deleteDialog;
          setDeleteDialog(null);
          if (id) void run(() => app.deleteCompetition(id), C.deleted);
        }}
        onCancel={() => setDeleteDialog(null)}
        loading={busy}
      />
    </Screen>
  );
}

/** Zeit als drei Felder (Stunden, Minuten, Sekunden). */
function TimeFields({
  value,
  onChange,
  prefix,
}: {
  value: Time;
  onChange: (value: Time) => void;
  prefix: string;
}) {
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['hours', 'minutes', 'seconds'] as const).map((key) => (
        <View key={key} style={{ flex: 1 }}>
          <TextField
            label={C[key]}
            value={value[key]}
            onChangeText={(text) => onChange({ ...value, [key]: digits(text) })}
            keyboardType="number-pad"
            maxLength={2}
            testID={`${prefix}-${key}`}
          />
        </View>
      ))}
    </View>
  );
}
