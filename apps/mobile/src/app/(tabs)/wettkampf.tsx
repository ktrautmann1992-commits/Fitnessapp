import {
  COMPETITION_CYCLING,
  COMPETITION_DISCIPLINES,
  type CompetitionDiscipline,
  type CompetitionFeasibility,
  type CompetitionGoal,
  competitionCountdown,
  competitionDistanceM,
  competitionPlanOffer,
  defaultCompetitionDiscipline,
  type FeasibilitySuggestion,
  freeSessionDates,
  isRunCompetitionDiscipline,
  isTriathlonCompetitionDiscipline,
  CARDIO_LOG_LIMITS,
  COMPETITION_OWN_START,
  ownStartAllowedLevel,
  RUN_COMPETITION_DISCIPLINES,
  type RunCompetitionDiscipline,
  SESSION_LOG_LIMITS,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CompetitionOutlineCard, CountdownCard, FeasibilityCard } from '@/components/competition';
import { RacePaceCard } from '@/components/race-pace';
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
  competitionOverview,
  countdownPayload,
  currentLevel,
  draftFeasibility,
  type DraftFeasibility,
  draftFromStored,
  type OverviewPlanState,
  isCompetitionPlan,
  competitionSaveOptions,
  timeGoalOffered,
  plannedCompetition,
  resavePayload,
  resultLogCandidate,
  resultLogToReuse,
  shownFeasibility,
} from '@/data/competition';
import { competitionOutlineFromRows } from '@/data/competition-dashboard';
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
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

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
  /** WP5: Rad-Distanz in km (Text aus dem Feld), sonst leer. */
  distanceKm: string;
  date: Parts;
  name: string;
  goal: CompetitionGoal;
  target: Time;
  withReference: boolean;
  refDiscipline: RunCompetitionDiscipline;
  refTime: Time;
  refDate: Parts;
  longRunWeekday: number | null;
  ownStart: string;
  ownStartConfirmed: boolean;
}

type FormErrors = Partial<
  Record<'date' | 'name' | 'target' | 'refTime' | 'refDate' | 'ownStart' | 'distanceKm', string>
>;

function formFrom(
  draft: CompetitionDraft | null,
  fallback: { discipline: CompetitionDiscipline; date: string | null },
): FormState {
  const c = draft?.competition;
  const ref = c?.reference ?? null;
  return {
    discipline: c?.discipline ?? fallback.discipline,
    distanceKm: c?.distanceKm !== undefined && c.distanceKm !== null ? String(c.distanceKm) : '',
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
): { draft: CompetitionDraft | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const raceDate = isoFromDateParts(form.date.day, form.date.month, form.date.year);
  if (raceDate === null || Number.isNaN(Date.parse(raceDate))) errors.date = C.errorsForm.raceDate;
  else if (raceDate <= today) errors.date = C.errorsForm.raceDatePast;
  // WP5: Rad mit Distanz (20–300 ganze km); Rad und Triathlon nur „Ankommen“ ohne Referenzzeit.
  const run = isRunCompetitionDiscipline(form.discipline);
  let distanceKm: number | null = null;
  if (form.discipline === 'cycling') {
    const text = form.distanceKm.trim();
    const km = Number(text);
    const { min, max } = COMPETITION_CYCLING.distanceKm;
    if (!/^\d{1,3}$/.test(text) || km < min || km > max) {
      errors.distanceKm = C.errorsForm.cyclingDistance;
    } else distanceKm = km;
  }
  const goal: CompetitionGoal = run ? form.goal : 'finish';
  const name =
    form.name.trim() === '' ? disciplineText(form.discipline, distanceKm) : form.name.trim();
  if (name.length > 80) errors.name = C.errorsForm.name;
  const targetTimeS =
    goal === 'time'
      ? secondsFromParts(form.target.hours, form.target.minutes, form.target.seconds)
      : null;
  if (goal === 'time' && targetTimeS === null) errors.target = C.errorsForm.time;
  let reference: { discipline: RunCompetitionDiscipline; timeS: number; date: string } | null =
    null;
  if (run && form.withReference) {
    const timeS = secondsFromParts(form.refTime.hours, form.refTime.minutes, form.refTime.seconds);
    const date = isoFromDateParts(form.refDate.day, form.refDate.month, form.refDate.year);
    if (timeS === null) errors.refTime = C.errorsForm.time;
    if (date === null) errors.refDate = C.errorsForm.referenceDate;
    if (timeS !== null && date !== null)
      reference = { discipline: form.refDiscipline, timeS, date };
  } else if (goal === 'time') {
    errors.target = C.errorsForm.referenceMissing;
  }
  let ownStart: CompetitionDraft['ownStart'] = null;
  // Auch wenn das Feld beim aktuellen Level ausgeblendet ist, bleibt die gespeicherte Angabe Teil des Datensatzes
  // (Wächter WP4 M4b) – ob sie gilt, entscheidet packages/core (ownStartMinutes, Hinweis own_start_ignored).
  if (form.ownStart.trim() !== '') {
    const minutes = Number(form.ownStart.trim());
    if (
      !/^\d{1,4}$/.test(form.ownStart.trim()) ||
      minutes < COMPETITION_OWN_START.minWeeklyMinutes ||
      !form.ownStartConfirmed
    ) {
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
        goal,
        targetTimeS,
        reference,
        distanceKm,
      },
      longRunWeekday: form.longRunWeekday,
      ownStart,
    },
    errors,
  };
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
  // Ziel-Disziplin ohne Wettkampfplan (Triathlon Mittel-/Langdistanz, Schwimmen – W-G2): Hinweis Trainer/Verein;
  // vorbelegt wird dann Triathlon Olympisch bzw. der Halbmarathon.
  const goalOffer =
    rows?.goals?.goal_type === 'endurance' ? competitionPlanOffer(rows.goals.discipline) : 'none';
  const goalDiscipline: CompetitionDiscipline = defaultCompetitionDiscipline(
    rows?.goals ? { goalType: rows.goals.goal_type, discipline: rows.goals.discipline } : null,
  );
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
  const [confirmBasic, setConfirmBasic] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [recreateDialog, setRecreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  // Ergebnis
  const [resultTime, setResultTime] = useState<Time>({ hours: '', minutes: '', seconds: '' });
  const [resultEffort, setResultEffort] = useState<number | null>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [resultError, setResultError] = useState<string>();
  /** ID des eben gespeicherten Ergebnis-Eintrags (für den erneuten Versuch ohne zweiten Eintrag, M6). */
  const [savedResultLog, setSavedResultLog] = useState<string | null>(null);

  // Seit 20.10.2026 ist /wettkampf ein Reiter und bleibt geladen: „Wettkampf planen“ (?neu=1) öffnet das Formular auch,
  // wenn die Seite schon einmal offen war (der Anfangswert von `mode` greift dann nicht mehr). Muster „Zustand beim
  // Rendern anpassen“ statt Effekt: nur ein NEUER Aufruf mit ?neu=1 wechselt ins Formular.
  const [seenNeu, setSeenNeu] = useState(params.neu);
  if (params.neu !== seenNeu) {
    setSeenNeu(params.neu);
    if (params.neu === '1' && !planned && rows) setMode('form');
  }

  const ownStartAllowed = ownStartAllowedLevel(level);
  const parsed = useMemo(() => draftOf(form, today), [form, today]);
  const feasibility = useMemo(
    () =>
      rows && parsed.draft
        ? draftFeasibility(rows, app.versions, active, parsed.draft, today)
        : null,
    [active, app.versions, parsed.draft, rows, today],
  );
  // „So ist dein Plan aufgebaut“: Phasen-Zeitleiste nur bei passendem Wettkampfplan (Regel in data/competition-dashboard).
  const outline = useMemo(
    () => (rows ? competitionOutlineFromRows(rows, active, app.safetyRules, today) : null),
    [active, app.safetyRules, rows, today],
  );
  // Übersicht: Ampel für den gespeicherten Wettkampf, wenn der Plan kein passender Wettkampfplan ist (gleiche Rechnung).
  const overview = useMemo(
    () =>
      rows
        ? competitionOverview({
            rows,
            versions: app.versions,
            active,
            today,
            offline: app.offline,
          })
        : null,
    [active, app.offline, app.versions, rows, today],
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
  if (route !== HOME_ROUTE || !rows) return <Redirect href={route as Href} />;

  const competitionPlanActive = isCompetitionPlan(active);
  const timeGoal = timeGoalOffered(rows, app.safetyRules);
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

  /** Zurück zur Übersicht; Ablehnung und Fehler gehörten zum Formular. */
  function showOverview() {
    // ?neu=1 erledigt – so öffnet ein späteres „Wettkampf planen“ das Formular wieder (Reiter bleibt geladen).
    if (params.neu !== undefined) router.setParams({ neu: undefined });
    setMode('view');
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
    else if (s.kind === 'shorter_distance') {
      update({
        discipline: s.discipline,
        ...(s.distanceKm === undefined ? {} : { distanceKm: String(s.distanceKm) }),
      });
    } else if (s.kind === 'health_check')
      router.push('/onboarding/health_screening?edit=1' as Href);
    else if (s.kind === 'without_competition') {
      showOverview();
      setMessage({ tone: 'info', text: C.planNotFeasible });
    }
  }

  /** Vorschlag aus der Ampel in der Übersicht: Datum/Distanz → Formular mit übernommenem Vorschlag. */
  function applyOverviewSuggestion(s: FeasibilitySuggestion) {
    if (s.kind === 'later_date' || s.kind === 'shorter_distance') openForm();
    applySuggestion(s);
  }

  /** Wettkampfplan erstellen – derselbe Ablauf aus dem Formular und aus der Übersicht. */
  async function createPlan(draft: CompetitionDraft | null) {
    setConfirmPlan(false);
    if (!draft) return;
    setBusy(true);
    setError(undefined);
    const outcome = await app.createCompetitionPlan(draft, planned?.stored.id ?? null);
    setBusy(false);
    if (outcome.ok) {
      showOverview();
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
    // Regel in data/competition.ts (Wächter WP4 H1/M4): unveränderter Plan-Bezug → mitschicken; bei aktivem
    // Wettkampfplan und geänderten Angaben gibt es „nur speichern“ gar nicht.
    const options = competitionSaveOptions({
      stored: planned?.stored ?? null,
      draft: parsed.draft,
      competitionPlanActive,
      feasibilityUsable: false,
    });
    if (options.saveOnly === null) return;
    const payload =
      options.saveOnly === 'resave' && planned
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
      showOverview();
      setMessage({ tone: 'success', text: planned ? C.saved : C.savedCountdown });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  /** „Speichern und Plan ohne Wettkampf neu erstellen“: Wettkampf ohne Plan-Bezug, dann Grundlagen-Plan (H1). */
  async function saveAndRecreateBasic() {
    setConfirmBasic(false);
    if (!parsed.draft) return;
    const payload = countdownPayload(parsed.draft, planned?.stored.id ?? null);
    if (!payload) {
      setError(C.errors.invalid);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await app.saveCompetition(payload);
      const outcome = await app.createPlan();
      showOverview();
      setMessage(
        outcome.ok
          ? { tone: 'success', text: C.savedWithBasicPlan }
          : { tone: 'danger', text: createPlanErrorText(outcome.code) },
      );
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
  const isTriathlonRace = isTriathlonCompetitionDiscipline(
    raceEntry?.stored.competition.discipline,
  );
  const resultAllowedDates = freeSessionDates(berlinTodayIso());
  const resultTooOld = raceDate !== null && !resultAllowedDates.includes(raceDate);
  const existingLog = raceDate ? resultLogCandidate(rows, raceDate) : null;

  async function saveResult() {
    if (!raceEntry || !raceDate || !app.session || !rows) return;
    const total = secondsFromParts(resultTime.hours, resultTime.minutes, resultTime.seconds);
    if (
      total === null ||
      total < CARDIO_LOG_LIMITS.durationS.min ||
      total > CARDIO_LOG_LIMITS.durationS.max
    ) {
      setResultError(C.result.timeInvalid);
      return;
    }
    if (resultNotes.length > SESSION_LOG_LIMITS.notesMaxChars) {
      setResultError(t.workout.notesTooLong(SESSION_LOG_LIMITS.notesMaxChars));
      return;
    }
    setResultError(undefined);
    setBusy(true);
    // Schon gespeichert (nur das Abschließen scheiterte)? Dann nur noch verknüpfen (Wächter WP4 M6).
    const reuse = resultLogToReuse(rows, raceDate, savedResultLog, C.result.resultLine(''));
    if (reuse !== null) {
      try {
        await app.completeCompetition(raceEntry.stored.id, reuse);
        showOverview();
        setMessage({ tone: 'success', text: C.result.saved });
      } catch (caught) {
        setResultError(errorText(caught));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const now = new Date().toISOString();
      const minutesTotal = Math.max(1, Math.round(total / 60));
      let draft = createFreeDraft({
        ownerUserId: app.session.userId,
        kind: 'endurance',
        // WP5: Rad und Triathlon als Rad-Eintrag (Triathlon ohne Distanz), Laufen wie bisher.
        modality: isRunCompetitionDiscipline(raceEntry.stored.competition.discipline)
          ? 'run'
          : 'bike',
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
          // Rad mit eingegebener Distanz; Triathlon ohne Distanz (eine Sportart je Eintrag, WP5).
          distanceKm: isTriathlonRace
            ? ''
            : kmText(
                competitionDistanceM(
                  raceEntry.stored.competition.discipline,
                  raceEntry.stored.competition.distanceKm,
                ),
              ),
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
        setSavedResultLog(draft.logId);
        await app.completeCompetition(raceEntry.stored.id, draft.logId);
        showOverview();
        setMessage({ tone: 'success', text: C.result.saved });
      } else if (outcome.kind === 'queued') {
        setMessage({ tone: 'info', text: C.result.queued });
        showOverview();
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
      <Screen
        area="wettkampf"
        icon="trophy"
        title={C.result.title}
        testID="competition-result"
        footer={back}
      >
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
                () => showOverview(),
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
                () => showOverview(),
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
    const { shown, usable, canCreate } = shownFeasibility(feasibility, notFeasible);
    const saveOptions = parsed.draft
      ? competitionSaveOptions({
          stored: planned?.stored ?? null,
          draft: parsed.draft,
          competitionPlanActive,
          feasibilityUsable: canCreate,
        })
      : null;
    const goalChange =
      parsed.draft !== null &&
      rows.goals?.goal_type === 'endurance' &&
      rows.goals.discipline !== form.discipline;
    return (
      <Screen
        area="wettkampf"
        icon="trophy"
        title={planned ? C.formTitleEdit : C.formTitleNew}
        testID="competition-form"
        footer={
          <View style={{ gap: 8 }}>
            <FieldError message={error} testID="competition-error" />
            {saveOptions?.recreateCompetitionPlan ? (
              <Button
                label={planned && competitionPlanActive ? C.recreatePlan : C.createPlan}
                onPress={() => (active ? setConfirmPlan(true) : void createPlan(parsed.draft))}
                loading={busy}
                disabled={offline}
                testID="competition-create-plan"
              />
            ) : null}
            {saveOptions?.recreateBasicPlan ? (
              <Button
                label={C.recreateBasicPlan}
                variant="secondary"
                onPress={() => setConfirmBasic(true)}
                disabled={offline || busy}
                testID="competition-recreate-basic"
              />
            ) : null}
            {saveOptions === null || saveOptions.saveOnly !== null ? (
              <Button
                label={saveOptions?.saveOnly === 'resave' ? C.save : C.saveCountdown}
                variant="secondary"
                onPress={() => {
                  setTouched(true);
                  void saveOnly();
                }}
                disabled={offline || busy}
                testID="competition-save-countdown"
              />
            ) : null}
            <Button
              label={C.cancelForm}
              variant="secondary"
              onPress={showOverview}
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
            onChange={(value) =>
              update({
                discipline: value,
                // Rad und Triathlon nur „Ankommen“ ohne Referenzzeit (WP5).
                ...(isRunCompetitionDiscipline(value)
                  ? {}
                  : { goal: 'finish', withReference: false }),
              })
            }
          />
          {form.discipline === 'cycling' ? (
            <TextField
              label={C.cyclingDistance}
              hint={C.cyclingDistanceHint}
              value={form.distanceKm}
              onChangeText={(distanceKm) => update({ distanceKm: distanceKm.replace(/\D/g, '') })}
              keyboardType="number-pad"
              maxLength={3}
              error={shownErrors.distanceKm}
              testID="competition-distance-km"
            />
          ) : null}
          <Body muted>{C.disciplineHint}</Body>
          {goalOffer === 'coach' && rows.goals?.discipline ? (
            <Notice tone="info" testID="competition-coach-hint">
              {C.coachHint(t.steps.goal.disciplines[rows.goals.discipline])}
            </Notice>
          ) : null}
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
        {!isRunCompetitionDiscipline(form.discipline) ? (
          <Card>
            <Heading level={2}>{C.goal}</Heading>
            <Body testID="competition-multisport-finish">{C.multisportFinishOnly}</Body>
          </Card>
        ) : null}
        {isRunCompetitionDiscipline(form.discipline) ? (
          <Card>
            <ChoiceList<CompetitionGoal>
              label={C.goal}
              horizontal
              options={(timeGoal || form.goal === 'time'
                ? (['finish', 'time'] as const)
                : (['finish'] as const)
              ).map((value) => ({
                value,
                label: C.goals[value],
              }))}
              value={form.goal}
              onChange={(goal) =>
                update({ goal, ...(goal === 'time' ? { withReference: true } : {}) })
              }
            />
            {!timeGoal ? (
              <Body muted testID="competition-time-goal-not-offered">
                {C.timeGoalNotOffered}
              </Body>
            ) : null}
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
        ) : null}
        {isRunCompetitionDiscipline(form.discipline) ? (
          <Card>
            <Heading level={2}>{C.referenceTitle}</Heading>
            <Body muted>{C.referenceText}</Body>
            {form.withReference ? (
              <>
                <ChoiceList<RunCompetitionDiscipline>
                  label={C.referenceDiscipline}
                  horizontal
                  options={RUN_COMPETITION_DISCIPLINES.map((value) => ({
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
        ) : null}
        <Card>
          <ChoiceList<number>
            label={isRunCompetitionDiscipline(form.discipline) ? C.longRunDay : C.longRideDay}
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
        <FeasibilitySection
          feasibility={feasibility}
          rejected={notFeasible}
          onSuggestion={applySuggestion}
          discipline={form.discipline}
        />
        {usable && goalChange ? (
          <Body muted>
            {C.goalChange(
              disciplineText(form.discipline, parsed.draft?.competition.distanceKm ?? null),
            )}
          </Body>
        ) : null}
        {shown && !usable ? (
          <Button
            label={C.withoutCompetition}
            variant="secondary"
            onPress={() => applySuggestion({ kind: 'without_competition' })}
            testID="competition-without"
          />
        ) : null}
        {saveOptions?.saveOnly === null ? (
          <Notice tone="info" testID="competition-plan-change">
            {C.planChangeNeedsRecreate}
          </Notice>
        ) : null}
        <ConfirmDialog
          visible={confirmBasic}
          title={C.confirmRecreateTitle}
          message={C.confirmBasicText}
          confirmLabel={C.recreateBasicPlan}
          confirmVariant="primary"
          onConfirm={() => void saveAndRecreateBasic()}
          onCancel={() => setConfirmBasic(false)}
          loading={busy}
        />
        <ConfirmDialog
          visible={confirmPlan}
          title={C.confirmRecreateTitle}
          message={C.confirmRecreateText}
          confirmLabel={C.confirmRecreate}
          confirmVariant="primary"
          onConfirm={() => void createPlan(parsed.draft)}
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
  const overviewAmpel = shownEntry?.row.status === 'planned' ? (overview?.ampel ?? null) : null;
  const overviewShown = overviewAmpel
    ? shownFeasibility(overviewAmpel.feasibility, notFeasible)
    : null;
  return (
    <Screen area="wettkampf" icon="trophy" title={C.title} testID="competition" footer={back}>
      {header}
      {shownEntry && countdown && comp ? (
        <>
          <CountdownCard
            countdown={countdown}
            discipline={comp.discipline}
            distanceKm={comp.distanceKm}
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
              <Body>{`${C.discipline}: ${disciplineText(comp.discipline, comp.distanceKm)}`}</Body>
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
              {shownEntry.row.status === 'planned' && overview ? (
                <Body muted testID="competition-plan-state">
                  {PLAN_STATE_TEXT[overview.planState]}
                </Body>
              ) : null}
              {shownEntry.row.status === 'done' ? (
                <Body testID="competition-result-state">
                  {shownEntry.stored.resultSessionLogId ? C.result.saved : C.result.noResult}
                </Body>
              ) : null}
            </View>
          </Card>
          {/* Gründer-Rückmeldung 20.10.2026: Aufbau des Plans direkt unter der Zusammenfassung. */}
          {outline && shownEntry.row.status === 'planned' ? (
            <CompetitionOutlineCard
              outline={outline}
              onOpenWeek={(monday) => router.push(`/kalender?woche=${monday}` as Href)}
            />
          ) : null}
          {/* Renn-Pace-Plan (docs/PLAN-PHASE-10.md 22): Zwischenzeiten, Grafik, Verpflegung, Druck. */}
          {shownEntry.row.status === 'planned' ? (
            <RacePaceCard competition={comp} rows={rows} raceDate={comp.raceDate} />
          ) : null}
          {/* Ampel direkt in der Übersicht (Grundlagen-Plan bzw. Plan passt nicht mehr) – wie im Formular. */}
          {overviewAmpel && overviewShown ? (
            <View style={{ gap: 8 }} testID="competition-overview-ampel">
              <FeasibilitySection
                feasibility={overviewAmpel.feasibility}
                rejected={notFeasible}
                onSuggestion={offline ? null : applyOverviewSuggestion}
                discipline={overviewAmpel.draft.competition.discipline}
              />
              {overviewShown.canCreate ? (
                <Button
                  label={C.createPlan}
                  onPress={() =>
                    active ? setConfirmPlan(true) : void createPlan(overviewAmpel.draft)
                  }
                  loading={busy}
                  disabled={offline}
                  testID="competition-overview-create-plan"
                />
              ) : null}
              <FieldError message={error} testID="competition-overview-error" />
            </View>
          ) : null}
          {shownEntry.row.status === 'planned' ? (
            <>
              {countdown.kind === 'race_day' || countdown.kind === 'awaiting_result' ? (
                <Button
                  label={C.result.title}
                  onPress={() => setMode('result')}
                  testID="competition-open-result"
                />
              ) : null}
              {/* Etappe W1: Wettkampf-Ernährung (Carb-Loading, Renntag mit Zeitleiste) – geht auch offline. */}
              {app.backend.supportsNutrition &&
              (countdown.kind === 'upcoming' || countdown.kind === 'race_day') ? (
                <Button
                  label={t.competitionNutrition.openRaceDay}
                  accessibilityLabel={t.competitionNutrition.openRaceDayA11y}
                  variant="secondary"
                  onPress={() => router.push(`/ernaehrung?tag=${shownEntry.row.race_date}` as Href)}
                  testID="competition-open-nutrition"
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
        visible={confirmPlan}
        title={C.confirmRecreateTitle}
        message={C.confirmRecreateText}
        confirmLabel={C.confirmRecreate}
        confirmVariant="primary"
        onConfirm={() => void createPlan(overviewAmpel?.draft ?? null)}
        onCancel={() => setConfirmPlan(false)}
        loading={busy}
      />
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

/** Text zum Plan-Stand in der Übersicht (Regel in data/competition.ts `competitionOverview`). */
const PLAN_STATE_TEXT: Record<OverviewPlanState, string> = {
  competition: C.planIsCompetition,
  basic: C.planIsBasic,
  basic_race_over: C.planIsBasicRaceOver,
  mismatch: C.planMismatchOverview,
  mismatch_race_over: C.planMismatchRaceOver,
  offline_unknown: C.planOfflineUnknown,
};

/**
 * Ampel mit Blocker- und Fehlerzustand – gleich im Formular und in der Übersicht: Blocker (Angaben fehlen, Ziel nicht
 * Ausdauer) → Hinweis; ungültige Angaben → Warnung; sonst Ampel mit Wort und Zeichen, Gründen und Vorschlägen.
 */
function FeasibilitySection({
  feasibility,
  rejected,
  onSuggestion,
  discipline,
}: {
  feasibility: DraftFeasibility | null;
  rejected: CompetitionFeasibility | null;
  onSuggestion: ((suggestion: FeasibilitySuggestion) => void) | null;
  discipline: CompetitionDiscipline;
}) {
  if (feasibility?.kind === 'blocked') {
    return (
      <Notice tone="info" testID="competition-blocked">
        {C.blocked[feasibility.blocker]}
      </Notice>
    );
  }
  if (feasibility?.kind === 'result' && !feasibility.result.ok && !rejected) {
    return (
      <Notice tone="warning" testID="competition-invalid">
        {C.errors.invalid}
      </Notice>
    );
  }
  const { shown } = shownFeasibility(feasibility, rejected);
  return shown ? (
    <FeasibilityCard feasibility={shown} onSuggestion={onSuggestion} discipline={discipline} />
  ) : null;
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
