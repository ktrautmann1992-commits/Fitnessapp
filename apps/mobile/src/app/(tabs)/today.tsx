import {
  addDays,
  blockWeekFor,
  competitionCountdown,
  type DaySwap,
  nextPlannedSession,
  planInfoNotices,
  type PreferenceChange,
  sessionOn,
  type StoredSession,
  type WeekStatusDay,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CycleTodayCard } from '@/components/cycle-entry';
import { CountdownCard, PhaseBand } from '@/components/competition';
import { FewerDaysCard, SessionAdjustedNotice } from '@/components/live-adjust';
import { NutritionTodayCard } from '@/components/nutrition';
import { HeroCard, Tile } from '@/components/design';
import { MedicalNotice, SessionCard } from '@/components/plan';
import { Text } from '@/components/text';
import {
  CrossDayDialog,
  DaySheet,
  type SheetMessage,
  StripLegend,
  TrainingToolbar,
  useWeekStatus,
  WeekStrip,
} from '@/components/training-week';
import { ConfirmDialog, Screen } from '@/components/screen';
import { focusTestId, SwapDialog, type SwapDecision, SwapFeedback } from '@/components/swap';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { BackendError, type PreferenceSwapContext } from '@/data/backend';
import {
  canSwapIn,
  newDaySwap,
  preferenceContextOf,
  preferenceSaveFor,
  sessionDisplay,
  type SwapTarget,
  swapTargetFor,
} from '@/data/exercise-swap';
import { competitionEntry, competitionPlanView, displayedSessionNames } from '@/data/competition';
import { stateOverridesFor } from '@/data/live-adjust';
import { logForSession } from '@/data/log-rows';
import type { WorkoutDraft } from '@/data/workout-draft';
import { startKind, trainedTodayOther, workoutView } from '@/data/workout-session';
import { planNoticeFor } from '@/data/training-attention';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import { formatDateDe, todayIso } from '@/lib/format';
import { workoutTargetLines } from '@/lib/workout-format';
import { dayLabel, weekdayName, weekdayShort } from '@/lib/plan-format';
import { appFont } from '@/lib/fonts';
import { isoDateParam } from '@/lib/route-param';
import { useThemeColors } from '@/lib/theme';
import { entryStats, entryTitle, weekCountText } from '@/lib/week-status-format';
import { planNameLine, planTitleText } from '@/lib/plan-title';
import { WeightGoalLifecycleCard, weightGoalOverviewFromRows } from '@/components/weight-goal';
import {
  COMPETITION_GOAL_UNREACHABLE,
  COMPETITION_PLAN_ENDED,
  GOALS_REJECTED,
  PLAN_CHANGE_DROPPED,
  PLAN_RECREATE_NEEDED,
  useApp,
} from '@/state/app-state';
import { HydrationCard } from '@/components/hydration';
import { healthConsentStatus, isReminderDue, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { MeasurementNotificationOffer } from '@/components/notifications';
import { useLargeView } from '@/lib/accessibility';

const W = t.trainingWeek;

/** Browser: zum Abschnitt springen (z. B. „Übungen ansehen“ im Tages-Blatt). */
function scrollToTestId(testID: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-testid="${testID}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, 350);
}

/**
 * „Heute“ (docs/PLAN-PHASE-3.md 10.2/10.3): heutige Einheit mit Arzt-Hinweis, Wochenübersicht, Verschieben,
 * Hinweise und alle Zustände. Vor dem Anzeigen JEDER Einheit wendet prepareSessionForDisplay() die aktuellen
 * Sicherheitsregeln an (Kraft und Ausdauer).
 */
export default function TodayScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const today = todayIso();
  const clock = new Date();
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
  const params = useLocalSearchParams<{ tag?: string }>();
  const dayParam = isoDateParam(params.tag);
  const [selected, setSelected] = useState(dayParam ?? today);
  /** Tages-Blatt (Training-Übersicht, docs/PLAN-AUSWERTUNG.md „Training-Übersicht“): offener Tag oder null. */
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [answerBusy, setAnswerBusy] = useState(false);
  const week = useWeekStatus(today);
  // „Übungen ansehen“ aus der Woche: /today?tag=… zeigt die Einheit dieses Tages (Zustand beim Rendern angleichen).
  const [paramSeen, setParamSeen] = useState(dayParam);
  if (dayParam !== paramSeen) {
    setParamSeen(dayParam);
    if (dayParam) setSelected(dayParam);
  }
  useEffect(() => {
    if (dayParam) scrollToTestId('today-detail');
  }, [dayParam]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [declineDialog, setDeclineDialog] = useState(false);
  const [discardDraftKey, setDiscardDraftKey] = useState<string | null>(null);
  const [foreignDialog, setForeignDialog] = useState(false);
  const largeView = useLargeView();
  const [showMore, setShowMore] = useState(false);
  /** Offener Tausch-Dialog (Etappe T2) und Rückmeldung mit „Rückgängig“ (ohne Zeitlimit, Wächter K4). */
  const [swapTarget, setSwapTarget] = useState<{ target: SwapTarget; index: number } | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState<string>();
  // Fokus-Ziel nach dem Schließen des Tausch-Dialogs (Wächter M2): erst nach dem Ende der Animation setzen.
  const focusAfterSwap = useRef<string | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<{
    text: string;
    tone: 'success' | 'danger' | 'info';
    undo:
      | { kind: 'preference'; changes: readonly PreferenceChange[]; at: PreferenceSwapContext }
      | { kind: 'day_swap'; sessionId: string; storedOrderNo: number }
      | null;
  } | null>(null);

  const { ensureLibrary, appendNextBlockIfDue, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  useEffect(() => {
    // Folgeblock automatisch, sobald die letzte Woche des Blocks beginnt (5.10).
    if (library.kind === 'ready') void appendNextBlockIfDue();
  }, [appendNextBlockIfDue, library.kind]);

  const rows = app.rows;
  const active = useMemo(() => (rows ? activePlan(rows) : null), [rows]);
  // Stand des Abnehmziels heute (Etappe Z5) – nur neu rechnen, wenn sich Angaben oder Tag ändern (Wächter Z5 N8).
  const { versions } = app;
  const weightGoal = useMemo(
    () => (rows ? weightGoalOverviewFromRows(rows, versions, today) : null),
    [rows, versions, today],
  );
  // Bildschirm verlassen → „Rückgängig“ verschwindet (8.2; rückgängig geht dann über die Einstellungen).
  useFocusEffect(useCallback(() => () => setSwapFeedback(null), []));
  // Frage und Tages-Blatt nur auf dem sichtbaren Bildschirm (Tabs bleiben im Hintergrund geladen).
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setSheetDate(null);
      };
    }, []),
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
  if (route !== HOME_ROUTE || !rows) {
    return <Redirect href={route as Href} />;
  }
  const consent = healthConsentStatus(rows, app.versions);
  const outdated = consent === 'outdated';
  const revoked = rows.consents.some(
    (c) => c.consent_type === 'health_data' && c.revoked_at !== null,
  );
  const lib = library.kind === 'ready' ? library.library : null;
  const rules = app.safetyRules;
  const competition = competitionEntry(rows, today);
  const countdown = competition
    ? competitionCountdown(
        {
          status: competition.row.status,
          discipline: competition.stored.competition.discipline,
          raceDate: competition.stored.competition.raceDate,
          resultSessionLogId: competition.stored.resultSessionLogId,
        },
        today,
      )
    : null;

  async function create() {
    setBusy(true);
    setMessage(undefined);
    const outcome = await app.createPlan();
    setBusy(false);
    setSelected(today);
    setMessage(
      outcome.ok
        ? {
            tone: 'success',
            text:
              outcome.withoutCompetition === 'not_feasible'
                ? t.competition.createdWithoutCompetition
                : outcome.withoutCompetition === 'not_possible'
                  ? t.competition.createdWithoutCompetitionOther
                  : t.plan.created,
          }
        : { tone: 'danger', text: createPlanErrorText(outcome.code) },
    );
  }

  async function submitDraft(draft: WorkoutDraft) {
    setBusy(true);
    try {
      await app.submitWorkout({ ...draft, state: 'open', rejectReason: null });
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function keepDraft(draft: WorkoutDraft) {
    setBusy(true);
    try {
      await app.keepMyVersion(draft);
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      {/* Gründer-Rückmeldung 20.10.2026: Wettkampfplan deutlich oben im Training, wenn ein Wettkampf existiert. */}
      {competition ? (
        // Design 20.10.2026: Kachel in Wettkampf-Orange mit Pokal (ganz antippbar, Link).
        <Tile
          variant="row"
          area="wettkampf"
          icon="trophy"
          title={t.competition.trainingLink}
          role="link"
          accessibilityLabel={t.competition.trainingLinkA11y(competition.stored.competition.name)}
          accessibilityHint={t.competition.trainingLinkHint}
          onPress={() => router.navigate('/wettkampf' as Href)}
          testID="today-competition-plan"
        />
      ) : null}
      {outdated ? (
        <Notice tone="warning" title={t.steps.healthConsent.reconsentTitle} testID="plan-reconsent">
          <Body>{t.today.healthReconsent}</Body>
          <Button
            label={t.today.reconsentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
          <Button
            label={t.today.reconsentDecline}
            variant="secondary"
            onPress={() => setDeclineDialog(true)}
          />
        </Notice>
      ) : null}
      {app.backend.mode === 'local' || lib?.containsDrafts ? (
        <Notice tone="info" testID="plan-test-content">
          {t.plan.testContent}
        </Notice>
      ) : null}
      {app.planMessage === GOALS_REJECTED ? (
        <Notice tone="warning" testID="goals-rejected">
          <Body>{t.steps.goal.rejected}</Body>
          <Button label={t.common.close} variant="link" onPress={app.clearPlanMessage} />
        </Notice>
      ) : null}
      {app.planMessage === PLAN_CHANGE_DROPPED ? (
        <Notice tone="warning">
          <Body>{t.plan.droppedChange}</Body>
          <Button label={t.common.close} variant="link" onPress={app.clearPlanMessage} />
        </Notice>
      ) : null}
      {app.planMessage === COMPETITION_GOAL_UNREACHABLE ? (
        <Notice
          tone="warning"
          title={t.competition.goalUnreachableTitle}
          testID="competition-goal-unreachable"
        >
          <Body>{t.competition.goalUnreachableText}</Body>
          <Button label={t.plan.recreate} onPress={() => void create()} loading={busy} />
        </Notice>
      ) : null}
      {app.planMessage === COMPETITION_PLAN_ENDED ? (
        <Notice tone="info" title={t.competition.planEndedTitle} testID="competition-plan-ended">
          <Body>{t.competition.planEndedText}</Body>
          <Button label={t.plan.recreate} onPress={() => void create()} loading={busy} />
        </Notice>
      ) : null}
      {app.planMessage === PLAN_RECREATE_NEEDED ? (
        <Notice tone="warning" testID="plan-recreate-needed">
          <Body>{t.plan.recreateNeeded}</Body>
          <Button label={t.plan.recreate} onPress={() => void create()} loading={busy} />
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="plan-message">
          {message.text}
        </Notice>
      ) : null}
      {app.workoutMessage ? (
        <Notice
          tone={
            app.workoutMessage.kind === 'saved' || app.workoutMessage.kind === 'orphaned'
              ? 'success'
              : app.workoutMessage.kind === 'queued'
                ? 'info'
                : 'warning'
          }
          testID="workout-message"
        >
          <Body>{workoutMessageText(app.workoutMessage)}</Body>
          <Button label={t.common.close} variant="link" onPress={app.clearWorkoutMessage} />
        </Notice>
      ) : null}
      {app.sessionExpired ? (
        <Notice tone="warning" testID="session-expired">
          {t.settings.sessionExpired}
        </Notice>
      ) : null}
      {app.foreignData ? (
        <Notice tone="warning" title={t.settings.foreignTitle} testID="foreign-data">
          <Body>{t.settings.foreignText}</Body>
          <Button
            label={t.settings.foreignConfirm}
            variant="danger"
            onPress={() => setForeignDialog(true)}
          />
        </Notice>
      ) : null}
      {app.drafts.map((draft) => (
        <DraftNotice
          key={draft.key}
          draft={draft}
          busy={busy}
          onOpen={() => router.push(`/workout/${draft.key}` as Href)}
          onSave={() => void submitDraft(draft)}
          onKeep={() => void keepDraft(draft)}
          onDiscard={() => setDiscardDraftKey(draft.key)}
        />
      ))}
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {isReminderDue(rows, today) ? <Notice tone="info">{t.today.measurementDue}</Notice> : null}
      {/* Etappe E: einmaliges Angebot nach der ersten Messung (nur App, nie im Onboarding). */}
      <MeasurementNotificationOffer />
      {/* Etappe Z5 (F10): Karte nur bei „erreicht“ bzw. „Zeitraum vorbei“ – ohne Zahlen, kein Fortschritt (F13). */}
      {weightGoal ? <WeightGoalLifecycleCard overview={weightGoal} zurueck="heute" /> : null}
      {/* Wettkampf (WP4): Countdown bzw. Einladung, wenn im Onboarding ein Datum angegeben wurde. */}
      {competition && countdown ? (
        <CountdownCard
          countdown={countdown}
          discipline={competition.stored.competition.discipline}
          distanceKm={competition.stored.competition.distanceKm}
          name={competition.stored.competition.name}
          onOpen={() => router.push('/wettkampf' as Href)}
        />
      ) : rows.goals?.goal_type === 'endurance' &&
        rows.goals.target_date !== null &&
        rows.goals.target_date > today &&
        !rows.competitions.some((c) => c.status === 'planned') ? (
        <Notice tone="info" title={t.competition.invite} testID="competition-invite">
          <Body>{t.competition.inviteText(dayLabel(rows.goals.target_date))}</Body>
          <Button
            label={t.competition.add}
            variant="secondary"
            onPress={() => router.push('/wettkampf?neu=1' as Href)}
            testID="competition-invite-open"
          />
        </Notice>
      ) : null}
    </>
  );

  const footer = (
    <Button label={t.today.settings} variant="secondary" onPress={() => router.push('/settings')} />
  );

  const dialogs = (
    <>
      <ConfirmDialog
        visible={discardDraftKey !== null}
        title={t.workout.discardTitle}
        message={t.workout.discardText}
        confirmLabel={t.workout.discardConfirm}
        onConfirm={() => {
          if (discardDraftKey) void app.discardDraft(discardDraftKey);
          setDiscardDraftKey(null);
        }}
        onCancel={() => setDiscardDraftKey(null)}
      />
      <ConfirmDialog
        visible={foreignDialog}
        title={t.settings.foreignTitle}
        message={t.settings.foreignText}
        confirmLabel={t.settings.foreignConfirm}
        onConfirm={() => {
          setForeignDialog(false);
          void app.discardForeignData();
        }}
        onCancel={() => setForeignDialog(false)}
      />
      <ConfirmDialog
        visible={declineDialog}
        title={t.today.reconsentDeclineTitle}
        message={t.today.reconsentDeclineText}
        confirmLabel={t.today.reconsentDeclineConfirm}
        confirmVariant="primary"
        onConfirm={() => {
          setDeclineDialog(false);
          void create();
        }}
        onCancel={() => setDeclineDialog(false)}
        loading={busy}
      />
    </>
  );

  // --- Kein Plan ------------------------------------------------------------------------------------------
  if (!active) {
    return (
      <Screen area="training" icon="dumbbell" title={t.today.title} testID="today" footer={footer}>
        <Body muted>{t.today.greeting}</Body>
        {header}
        <Card>
          <Heading level={2}>{t.plan.emptyTitle}</Heading>
          <Body muted>
            {revoked && consent !== 'valid' ? t.plan.emptyAfterRevoke : t.plan.emptyText}
          </Body>
          {busy ? <LoadingState label={t.plan.creating} /> : null}
          <Button
            label={revoked ? t.plan.createNew : t.plan.create}
            onPress={() => void create()}
            loading={busy}
          />
        </Card>
        <NutritionTodayCard nowMinutes={nowMinutes} />
        {/* Tagesauswertung (Etappe A2): Essen und Training heute. */}
        <Button
          label={t.day.openToday}
          accessibilityLabel={t.day.openA11y(t.day.today)}
          variant="secondary"
          onPress={() => router.push(`/tag/${today}` as Href)}
          testID="today-day"
        />
        {rows.sessionLogs.length > 0 ? (
          // Das Tagebuch bleibt auch ohne Plan (z. B. nach dem Widerruf) – Verlauf erreichbar.
          <Button
            label={t.today.openHistory}
            variant="secondary"
            onPress={() => router.push('/history' as Href)}
            testID="today-history"
          />
        ) : null}
        <Button
          label={t.glossary.allExercises}
          variant="secondary"
          onPress={() => router.push('/uebungen' as Href)}
          testID="today-glossary"
        />
        {dialogs}
      </Screen>
    );
  }

  // --- Plan vorhanden -------------------------------------------------------------------------------------
  const plan = active.plan;
  const ownerUserId = app.session?.userId ?? null;
  const blockWeek = blockWeekFor(active.sessions, today);
  const displayedNames = displayedSessionNames(rows, active, rules);
  const selectedSession = sessionOn(active.sessions, selected);
  // Nächste Einheit nach dem gewählten Tag – frühestens heute (vergangene Tage verweisen auf heute und später).
  const next = nextPlannedSession(
    active.sessions,
    selected < today ? addDays(today, -1) : selected,
  );
  const nextFromToday = nextPlannedSession(active.sessions, today);
  // Wettkampfplan (WP4): Phasen-Band „Aufbau · Woche 6 von 14“ für den gewählten Tag, Pace aus der Referenzzeit.
  // Nur ein passender Wettkampfplan zeigt Phasen-Band und Pace (Regel in data/competition.ts, Wächter WP4 H1).
  const planView = competitionPlanView(rows, active, selected, app.offline, rules);
  const planWeek = planView.week;
  const paceProfile = planView.paceProfile;
  // „Plan neu erstellen?“ – dieselbe Auswertung wie die Übersicht (data/training-attention.ts, Wächter H1).
  const notice = planNoticeFor({
    rows,
    versions: app.versions,
    active,
    rules,
    library: lib,
    today,
  });

  /** Anzeige, Vorgabe und Start einer Einheit – für den gewählten Tag (Details) und für heute (Hero-Karte). */
  function sessionInfo(session: StoredSession | null): SessionInfo | null {
    if (!session || !rows || !active) return null;
    // EIN Anzeigeweg (prepareSessionForDisplay im Core): Sicherheitsregeln → Präferenzen → „Nur heute“-Tausche.
    const display = rules
      ? sessionDisplay({
          rows,
          active,
          library: lib,
          rules,
          session,
          today,
          daySwaps: app.daySwaps,
          ownerUserId,
        })
      : null;
    // Phase 4: berechnete Vorgabe aus dem Tagebuch (packages/core planWorkout) – nur Kraft, mit Bibliothek.
    const view =
      session.kind === 'strength' && lib && rules
        ? workoutView(rows, lib, rules, session.id, today, {
            excludeLogId: logForSession(rows, session.id)?.id ?? null,
            daySwaps: app.daySwaps,
            ownerUserId,
            // Live-Anpassung (Phase 4b): wirksame Zustands-Vorgaben (Testmodus mit „Premium simulieren“).
            stateOverrides: stateOverridesFor(rows, app.liveAdjust.adjustments),
          })
        : null;
    return {
      display,
      view,
      start: startKind(rows, session, today),
      hasDraft: app.drafts.some((d) => d.key === session.id),
    };
  }

  const selectedInfo = sessionInfo(selectedSession);
  const display = selectedInfo?.display ?? null;
  const shown = display?.shown ?? null;
  const context = display?.context ?? null;
  const view = selectedInfo?.view ?? null;
  const targets = view?.items.map(workoutTargetLines);
  const log = selectedSession ? logForSession(rows, selectedSession.id) : null;
  const hasDraft = selectedInfo?.hasDraft ?? false;
  const pendingUpload =
    selectedSession !== null && app.pendingLogSessionIds.includes(selectedSession.id);
  const swapEnabled =
    selectedSession !== null &&
    display !== null &&
    canSwapIn(selectedSession, display, hasDraft, app.backend.supportsExercisePreferences);
  const supportsPreferences = app.backend.supportsExercisePreferences;
  const viewExclusions = supportsPreferences
    ? () => router.push('/ausgeschlossene-uebungen' as Href)
    : null;
  const firstSession = active.sessions.find((s) => s.status === 'planned');

  // Heute (Hero-Karte): Stand aus dem Wochen-Status – erledigt steht immer am tatsächlichen Tag.
  const todayDay = week.status?.days.find((d) => d.isToday) ?? null;
  const todaySession = sessionOn(active.sessions, today);
  const todayOpen =
    todaySession && todayDay?.open.some((o) => o.sessionId === todaySession.id)
      ? todaySession
      : null;
  const todayInfo =
    todayOpen && selectedSession?.id === todayOpen.id ? selectedInfo : sessionInfo(todayOpen);
  const question =
    focused && week.assignmentsReady && sheetDate === null && swapTarget === null
      ? (week.status?.questions[0] ?? null)
      : null;

  function showMessage(next: SheetMessage) {
    setMessage({ tone: next.tone === 'danger' ? 'danger' : 'success', text: next.text });
    scrollToTestId('today');
  }

  function openDay(date: string) {
    // Andere Aktion → „Rückgängig“ verschwindet (8.2).
    setSwapFeedback(null);
    setMessage(undefined);
    setSelected(date);
    setSheetDate(date);
  }

  /** „Tauschen“: Blatt der heutigen bzw. nächsten offenen Einheit dieser Woche (dort die Tag-Chips). */
  function openSwapDay() {
    const days = week.status?.days ?? [];
    const target =
      days.find((d) => d.isToday && d.open.length > 0) ??
      days.find((d) => d.date >= today && d.open.length > 0) ??
      days.find((d) => d.open.length > 0) ??
      todayDay;
    if (target) openDay(target.date);
  }

  async function answer(sessionId: string | null) {
    if (!question) return;
    setAnswerBusy(true);
    try {
      await week.decide(question.logId, sessionId);
      setMessage({
        tone: 'success',
        text:
          sessionId !== null
            ? W.sheet.countsFor(weekdayShort(question.sessionDate), question.sessionName)
            : W.sheet.extraUnit,
      });
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) });
    } finally {
      setAnswerBusy(false);
    }
  }

  function openSwap(index: number) {
    if (!selectedSession || !display || !lib || !rows) return;
    const target = swapTargetFor(selectedSession, display, lib, rows, index, today);
    if (!target) return;
    setSwapFeedback(null);
    setSwapError(undefined);
    setSwapTarget({ target, index });
  }

  function closeSwap() {
    const index = swapTarget?.index;
    setSwapTarget(null);
    setSwapError(undefined);
    // Fokus zurück auf „Tauschen“ (8.3) – gesetzt in onClosed, wenn der Dialog wirklich zu ist.
    focusAfterSwap.current = index !== undefined ? `plan-swap-${index}` : null;
  }

  function swapClosed() {
    const id = focusAfterSwap.current;
    focusAfterSwap.current = null;
    if (id) focusTestId(id);
  }

  async function confirmSwap(decision: SwapDecision) {
    if (!swapTarget || !selectedSession || !ownerUserId || !rows) return;
    const { target } = swapTarget;
    const toName =
      target.choices.today.find((c) => c.id === decision.candidateId)?.name_de ??
      decision.candidateId;
    const text = t.swap.done(target.shownName, toName);
    setSwapBusy(true);
    setSwapError(undefined);
    try {
      if (decision.duration === 'always') {
        // Nie still auf „Nur heute“ ausweichen (Wächter T2-K3) – der Dialog verlangt Ort und Grund.
        if (!decision.location || !decision.kind) throw new BackendError('unknown');
        const save = preferenceSaveFor(target, rows, {
          location: decision.location,
          kind: decision.kind,
          replacementId: decision.candidateId,
          now: new Date().toISOString(),
        });
        const at = preferenceContextOf(target);
        await app.updateExercisePreferences(save.changes, at);
        setSwapFeedback({
          text: `${text} ${t.swap.doneAlwaysHint}`,
          tone: 'success',
          undo: { kind: 'preference', changes: save.undo, at },
        });
      } else {
        const swap = newDaySwap(target, {
          ownerUserId,
          planId: active?.plan.id ?? '',
          scheduledOn: selectedSession.scheduled_on,
          alternativeId: decision.candidateId,
          now: new Date().toISOString(),
        });
        if (!swap) throw new BackendError('unknown');
        await app.addDaySwap(swap);
        setSwapFeedback({
          text,
          tone: 'success',
          undo: {
            kind: 'day_swap',
            sessionId: target.sessionId,
            storedOrderNo: target.storedOrderNo,
          },
        });
      }
      // Fokus auf die Rückmeldung (K6), wenn der Dialog zu ist.
      focusAfterSwap.current = 'swap-feedback';
      setSwapTarget(null);
    } catch (caught) {
      setSwapError(caught instanceof BackendError ? errorText(caught) : t.swap.failed);
    } finally {
      setSwapBusy(false);
    }
  }

  async function undoSwap() {
    const undo = swapFeedback?.undo;
    if (!undo || !ownerUserId) return;
    setSwapBusy(true);
    try {
      if (undo.kind === 'preference') {
        await app.updateExercisePreferences(undo.changes, undo.at);
      } else {
        await app.removeDaySwaps([
          { ownerUserId, sessionId: undo.sessionId, storedOrderNo: undo.storedOrderNo },
        ]);
      }
      setSwapFeedback({ text: t.swap.undone, tone: 'info', undo: null });
    } catch (caught) {
      setSwapFeedback({ text: errorText(caught), tone: 'danger', undo: null });
    } finally {
      setSwapBusy(false);
    }
  }

  async function undoDaySwap(index: number) {
    const orderNo = shown?.storedOrderNos?.[index];
    if (!selectedSession || !ownerUserId || orderNo === undefined) return;
    try {
      await app.removeDaySwaps([
        { ownerUserId, sessionId: selectedSession.id, storedOrderNo: orderNo },
      ]);
      setSwapFeedback({ text: t.swap.undone, tone: 'info', undo: null });
    } catch (caught) {
      setSwapFeedback({ text: errorText(caught), tone: 'danger', undo: null });
    }
  }

  const toolbar = (
    <TrainingToolbar
      items={[
        {
          key: 'calendar',
          icon: 'calendar',
          label: W.toolbar.calendar,
          accessibilityLabel: t.calendar.openA11y,
          onPress: () => router.push('/kalender' as Href),
          testID: 'today-calendar',
        },
        {
          key: 'history',
          icon: 'trend',
          label: W.toolbar.history,
          onPress: () => router.push('/history' as Href),
          testID: 'today-history',
        },
        {
          key: 'swap',
          icon: 'swap',
          label: W.toolbar.swap,
          accessibilityLabel: W.toolbar.swapA11y,
          role: 'button',
          onPress: openSwapDay,
          testID: 'today-swap',
        },
        {
          key: 'exercises',
          icon: 'book',
          label: W.toolbar.exercises,
          accessibilityLabel: t.glossary.allExercises,
          onPress: () => router.push('/uebungen' as Href),
          testID: 'today-glossary',
        },
      ]}
    />
  );

  return (
    <Screen area="training" icon="dumbbell" title={t.today.title} testID="today" footer={footer}>
      <Body muted testID="today-date">
        {dayLabel(today)}
      </Body>
      {header}
      {/* Live-Anpassung (Phase 4b, 8.1): offener Vorschlag „Weniger Trainingstage?“ oben. */}
      <FewerDaysCard today={today} />
      {/* Phase 9: neutraler Kurzweg zum Tages-Check (ohne Zyklus-Wort, nur bei aktivem Modul, K7). */}
      <CycleTodayCard />
      {notice.kind !== 'none' ? (
        <Notice
          tone={notice.kind === 'offer' ? 'info' : 'danger'}
          title={
            notice.kind === 'ended'
              ? t.plan.endedTitle
              : notice.kind === 'stricter'
                ? t.plan.offerStricterTitle
                : t.plan.offerTitle
          }
          testID="plan-offer"
        >
          <Body>
            {notice.kind === 'ended'
              ? t.plan.endedText
              : notice.kind === 'stricter'
                ? t.plan.offerStricterText
                : notice.versionOnly
                  ? t.plan.offerVersion
                  : t.plan.offerText}
          </Body>
          <Button label={t.plan.recreate} onPress={() => void create()} loading={busy} />
        </Notice>
      ) : null}

      {planWeek ? <PhaseBand week={planWeek} shortDays={planView.shortDays} /> : null}
      {planView.mismatch ? (
        <Notice tone="warning" testID="competition-plan-mismatch">
          <Body>{t.competition.planMismatch}</Body>
          <Button
            label={t.competition.openCompetition}
            variant="secondary"
            onPress={() => router.push('/wettkampf' as Href)}
          />
        </Notice>
      ) : null}

      {/* Arzt-Hinweis vor JEDER Einheit – das Feld liegt am Plan (auch offline). */}
      {plan.medical_notice && (todayOpen || selectedSession) ? <MedicalNotice /> : null}
      <TodayHero
        day={todayDay}
        session={todayOpen}
        displayName={todayOpen ? (displayedNames.get(todayOpen.id) ?? todayOpen.name_de) : null}
        info={todayInfo}
        exerciseCount={
          todayOpen ? rows.plannedExercises.filter((e) => e.session_id === todayOpen.id).length : 0
        }
        nextText={
          nextFromToday
            ? firstSession &&
              firstSession.id === nextFromToday.id &&
              firstSession.scheduled_on > today
              ? t.plan.firstSession(dayLabel(nextFromToday.scheduled_on))
              : t.plan.nextSession(dayLabel(nextFromToday.scheduled_on), nextFromToday.name_de)
            : t.plan.noUpcoming
        }
        onStart={(id) => router.push(`/workout/${id}` as Href)}
        onView={(logId) => router.push(`/log/${logId}` as Href)}
      />

      {/* Deine Woche (Entwurf s1): 7 Tage mit Zustand, Legende, „statt Sa“; Tippen öffnet das Tages-Blatt. */}
      <View style={styles.weekHead}>
        <View style={styles.weekTitle} testID="plan-week-title">
          <Heading level={2}>{W.weekTitle}</Heading>
          {week.status ? (
            <Text
              style={[styles.weekCount, appFont('bold'), { color: theme.textMuted }]}
              testID="plan-week-count"
            >
              · {weekCountText(week.status.summary)}
            </Text>
          ) : null}
        </View>
      </View>
      {week.status ? (
        <>
          <WeekStrip days={week.status.days} onSelect={openDay} />
          <StripLegend />
        </>
      ) : null}
      <View style={styles.links}>
        <View style={styles.linkItem}>
          <Button
            label={W.openWeek}
            accessibilityLabel={W.openWeekA11y}
            variant="link"
            onPress={() => router.push('/week' as Href)}
            testID="today-week"
          />
        </View>
        <View style={styles.linkItem}>
          {/* Tagesauswertung (Etappe A2): Essen und Training heute. */}
          <Button
            label={t.day.openToday}
            accessibilityLabel={t.day.openA11y(t.day.today)}
            variant="link"
            onPress={() => router.push(`/tag/${today}` as Href)}
            testID="today-day"
          />
        </View>
      </View>

      {/* Große Ansicht (FA5, Plan 12 Nr. 2): weniger Elemente – Kalender, Verlauf, Tauschen und Übungen liegen hinter
          „Mehr anzeigen“. */}
      {largeView ? (
        <Button
          label={showMore ? t.accessibility.todayLess : t.accessibility.todayMore}
          variant="link"
          expanded={showMore}
          onPress={() => setShowMore((v) => !v)}
          testID="today-more"
        />
      ) : null}
      {!largeView || showMore ? toolbar : null}
      {/* Woche im Block (Einstiegs-/Erholungswoche) – unter der Leiste, damit die Woche oben ruhig bleibt. */}
      {blockWeek ? (
        <View style={styles.blockWeek} testID="plan-week-header">
          <Heading level={2}>
            {blockWeek.weekNo === 0
              ? t.plan.week0
              : t.plan.weekHeader(blockWeek.weekNo, blockWeek.weeksInBlock)}
          </Heading>
          {blockWeek.isIntroWeek ? (
            <Body muted>
              {t.plan.introWeek}: {t.plan.introWeekText}
            </Body>
          ) : null}
          {blockWeek.isDeload ? (
            <Body muted>
              {t.plan.deloadWeek}: {t.plan.deloadWeekText}
            </Body>
          ) : null}
        </View>
      ) : null}

      {/* Ernährung (Phase 5, Etappe N4): Karte „Essen heute“. */}
      <NutritionTodayCard nowMinutes={nowMinutes} />

      {/* Einheit des gewählten Tages mit Übungen (Tauschen einzelner Übungen, Vorgaben) – Standard: heute. */}
      <View testID="today-detail" style={styles.detail}>
        {selectedSession && shown ? (
          <>
            <SessionCard
              original={selectedSession}
              shown={shown}
              rules={rules}
              context={context ?? { library: null }}
              heading={
                selected === today ? t.plan.todaySession : t.plan.sessionOn(dayLabel(selected))
              }
              {...(targets && selectedSession.status === 'planned' ? { targets } : {})}
              paceProfile={paceProfile}
              onOpenExercise={(exerciseId) =>
                router.push(`/uebungen/${encodeURIComponent(exerciseId)}` as Href)
              }
              swap={{
                enabled: swapEnabled,
                later: selectedSession.scheduled_on > today,
                onSwap: openSwap,
                onUndoDaySwap: (index) => void undoDaySwap(index),
                onViewExclusions: viewExclusions,
              }}
            />
            {/* Live-Anpassung (Phase 4b, 8.1): Kennzeichen „angepasst“ mit Link zur Erklärung. */}
            {selectedSession.status === 'planned' ? (
              <SessionAdjustedNotice session={selectedSession} />
            ) : null}
            {/* Vom Core verworfene „Nur heute“-Tausche still aus dem Speicher räumen (8.2). */}
            <DaySwapCleanup dropped={shown.droppedDaySwaps ?? []} />
            {swapFeedback ? (
              <SwapFeedback
                text={swapFeedback.text}
                tone={swapFeedback.tone}
                onUndo={swapFeedback.undo ? () => void undoSwap() : null}
                undoBusy={swapBusy}
              />
            ) : null}
            {hasDraft &&
            selectedSession.kind === 'strength' &&
            selectedSession.status === 'planned' ? (
              <Body muted testID="plan-swap-draft-hint">
                {t.swap.draftRunning}
              </Body>
            ) : null}
            {selectedSession.status === 'completed' ? (
              <Notice tone="success" testID="plan-completed">
                <Body>
                  {log?.status === 'partial' ? t.today.completedPartly : t.today.completed}
                </Body>
                {log && log.performed_on !== selectedSession.scheduled_on ? (
                  <Body muted>{t.week.caughtUpFrom(dayLabel(log.performed_on))}</Body>
                ) : null}
                {pendingUpload ? <Body muted>{t.today.pendingUpload}</Body> : null}
                {log && !hasDraft ? (
                  <Button
                    label={t.today.viewWorkout}
                    variant="secondary"
                    onPress={() => router.push(`/workout/${selectedSession.id}?edit=1` as Href)}
                    testID="workout-view"
                  />
                ) : null}
              </Notice>
            ) : null}
            {selectedSession.status === 'planned' &&
            selected === today &&
            trainedTodayOther(rows, selectedSession, today) ? (
              <Notice tone="info" testID="plan-trained-today">
                {t.today.alreadyTrained}
              </Notice>
            ) : null}
            {selected !== today && selectedSession.status === 'planned' ? (
              <Button
                label={W.detailActions(weekdayName(selected))}
                variant="secondary"
                onPress={() => openDay(selected)}
                testID="today-detail-actions"
              />
            ) : null}
          </>
        ) : selectedSession ? (
          <LoadingState label={t.plan.loading} />
        ) : selected !== today ? (
          <Card>
            <Heading level={2}>{`${dayLabel(selected)}: ${t.plan.restShort}`}</Heading>
            <Body muted>{t.plan.restDayTip}</Body>
            {next ? (
              <Body>
                {firstSession && firstSession.id === next.id && firstSession.scheduled_on > today
                  ? t.plan.firstSession(dayLabel(next.scheduled_on))
                  : t.plan.nextSession(dayLabel(next.scheduled_on), next.name_de)}
              </Body>
            ) : (
              <Body>{t.plan.noUpcoming}</Body>
            )}
          </Card>
        ) : null}
      </View>

      {/* Trinken (25.10.2026): Ring, +250/+500 ml, 7 Tage. */}
      <HydrationCard today={today} testID="today-hydration" />

      <Card>
        {planNameLine(plan) ? <Body testID="plan-name">{planNameLine(plan)}</Body> : null}
        <Body muted>{planTitleText(plan)}</Body>
        <Body>{t.plan.quality[plan.match_quality]}</Body>
        {plan.uses_health_data ? (
          plan.medical_notice ? (
            <Body>{t.plan.cautious}</Body>
          ) : null
        ) : (
          <Body>{t.plan.noCheck}</Body>
        )}
        {rules?.pregnancyNotice ? <Body>{t.plan.pregnancy}</Body> : null}
        {plan.notes.length > 0 ? (
          <View style={styles.blockWeek} testID="plan-notes">
            <Heading level={2}>{t.plan.notesTitle}</Heading>
            {plan.notes.map((note) => (
              <Body key={note} muted>
                • {t.plan.notes[note]}
              </Body>
            ))}
          </View>
        ) : null}
      </Card>
      {planInfoNotices(plan, lib).map((notice) => (
        <Notice
          key={notice}
          title={t.plan.infoNotices[notice].title}
          testID={`plan-info-${notice}`}
        >
          <Body>{t.plan.infoNotices[notice].text}</Body>
        </Notice>
      ))}
      {/* Plan als PDF (docs/PLAN-PDF-EXPORT.md P3): Hinweis bei Gesundheitsbezug zeigt die Druckansicht. */}
      <Button
        label={t.printView.button}
        variant="secondary"
        accessibilityHint={t.printView.buttonHint}
        onPress={() => router.push('/plan/drucken' as Href)}
        testID="plan-print"
      />
      {dialogs}
      <DaySheet
        date={sheetDate}
        status={week.status}
        onClose={() => setSheetDate(null)}
        onSelectDate={(date) => {
          setSelected(date);
          setSheetDate(date);
        }}
        onShowExercises={(date) => {
          setSelected(date);
          scrollToTestId('today-detail');
        }}
        onMessage={showMessage}
        decide={week.decide}
      />
      <CrossDayDialog question={question} busy={answerBusy} onAnswer={(id) => void answer(id)} />
      <SwapDialog
        target={swapTarget?.target ?? null}
        allowAlways={supportsPreferences}
        busy={swapBusy}
        error={swapError}
        onConfirm={(decision) => void confirmSwap(decision)}
        onCancel={closeSwap}
        onClosed={swapClosed}
        onOpenGuide={(exerciseId) => {
          setSwapTarget(null);
          router.push(`/uebungen/${encodeURIComponent(exerciseId)}` as Href);
        }}
        onAdjustEquipment={() => {
          setSwapTarget(null);
          router.push('/onboarding/equipment?edit=1' as Href);
        }}
      />
    </Screen>
  );
}

interface SessionInfo {
  readonly display: ReturnType<typeof sessionDisplay> | null;
  readonly view: ReturnType<typeof workoutView> | null;
  readonly start: ReturnType<typeof startKind>;
  readonly hasDraft: boolean;
}

/**
 * Hero-Karte „Heute“ (Entwurf s1): offene Einheit mit „Training starten“, erledigte Einheit mit Werten und „statt Sa“
 * bzw. Ruhetag mit der nächsten Einheit. Erledigt steht immer am tatsächlichen Tag (Wochen-Status aus dem Core).
 */
function TodayHero({
  day,
  session,
  displayName,
  info,
  exerciseCount,
  nextText,
  onStart,
  onView,
}: {
  day: WeekStatusDay | null;
  session: StoredSession | null;
  displayName: string | null;
  info: SessionInfo | null;
  exerciseCount: number;
  nextText: string;
  onStart: (sessionId: string) => void;
  onView: (logId: string) => void;
}) {
  if (session && info) {
    const shown = info.display?.shown ?? null;
    const meta = [
      W.hero.minutes(session.estimated_minutes),
      session.kind === 'strength' && exerciseCount > 0 ? W.hero.exercises(exerciseCount) : null,
    ].filter((v): v is string => v !== null);
    const startLabel =
      session.kind === 'endurance'
        ? info.start === 'today'
          ? t.today.startEndurance
          : t.today.catchUpEndurance
        : info.start === 'today'
          ? t.today.startWorkout
          : t.today.catchUp;
    const emptyStart = session.kind === 'strength' && shown?.emptyByPreference === true;
    const libraryMissing =
      session.kind === 'strength' && (shown === null || shown.libraryMissing || !info.view);
    const canStart = info.start !== null && !info.hasDraft;
    return (
      <HeroCard
        eyebrow={W.hero.eyebrowTraining}
        eyebrowIcon={session.kind === 'endurance' ? 'run' : 'dumbbell'}
        title={displayName ?? session.name_de}
        subtitle={meta.join(' · ')}
        testID="today-hero"
        note={
          canStart && emptyStart
            ? t.swap.emptyStartDisabled
            : canStart && libraryMissing
              ? t.today.libraryMissingStart
              : null
        }
        noteTestID={emptyStart ? 'plan-start-disabled' : 'today-hero-note'}
        {...(canStart && !emptyStart && !libraryMissing
          ? {
              actionLabel: startLabel,
              onAction: () => onStart(session.id),
              actionTestID: 'workout-start',
            }
          : {})}
      >
        {canStart && emptyStart ? (
          <Button label={startLabel} onPress={() => undefined} disabled testID="workout-start" />
        ) : null}
      </HeroCard>
    );
  }
  const entry = day?.entries[0] ?? null;
  if (day && entry) {
    const moved = entry.fulfils && entry.fulfils.shift !== 'same' ? entry.fulfils : null;
    const stats = entryStats(entry).join(' · ');
    return (
      <HeroCard
        eyebrow={
          entry.partial
            ? W.hero.eyebrowPartial
            : entry.fromWatch
              ? W.hero.eyebrowDoneWatch
              : W.hero.eyebrowDone
        }
        title={entryTitle(entry)}
        {...(stats ? { subtitle: stats } : {})}
        titleIsHeading
        testID="today-hero"
        {...(entry.logId
          ? {
              secondaryLabel: W.hero.view,
              onSecondary: () => (entry.logId ? onView(entry.logId) : undefined),
              secondaryTestID: 'today-hero-view',
            }
          : {})}
      >
        {moved ? (
          <View style={styles.heroTag}>
            <Text style={[styles.heroTagText, appFont('bold')]} testID="today-hero-instead">
              {W.insteadOfName(weekdayShort(moved.plannedOn), moved.name_de)}
            </Text>
          </View>
        ) : null}
        {day.entries.length > 1 ? (
          <Text style={[styles.heroMore, appFont('regular')]}>
            {day.entries
              .slice(1)
              .map((e) => entryTitle(e))
              .join(' · ')}
          </Text>
        ) : null}
      </HeroCard>
    );
  }
  const moved = day?.doneElsewhere[0] ?? null;
  return (
    <HeroCard
      eyebrow={W.hero.eyebrowToday}
      eyebrowIcon="moon"
      title={moved ? W.hero.freeTitle : t.plan.restDay}
      subtitle={
        moved
          ? moved.shift === 'early'
            ? W.hero.movedEarly(moved.name_de, weekdayShort(moved.doneOn))
            : W.hero.movedLate(moved.name_de, weekdayShort(moved.doneOn))
          : t.plan.restDayTip
      }
      titleIsHeading
      testID="today-hero"
    >
      <Text style={[styles.heroNext, appFont('semibold')]} testID="today-hero-next">
        {nextText}
      </Text>
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  weekHead: { gap: spacing.xs },
  weekTitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  weekCount: { fontSize: 16, lineHeight: 22 },
  blockWeek: { gap: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  linkItem: { flexGrow: 1 },
  detail: { gap: spacing.md },
  heroTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroTagText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  heroMore: { color: '#B4BDD0', fontSize: 15, lineHeight: 21 },
  heroNext: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
});

/** Räumt verworfene Day-Swaps einmal je Änderung aus dem Speicher (keine Meldung – die Anzeige ist schon richtig). */
function DaySwapCleanup({ dropped }: { dropped: readonly DaySwap[] }) {
  const { dropDaySwaps } = useApp();
  const key = dropped.map((d) => `${d.sessionId}:${d.storedOrderNo}:${d.createdAt}`).join('|');
  useEffect(() => {
    if (dropped.length === 0) return;
    void dropDaySwaps(dropped).catch(() => undefined);
    // Nur bei geänderter Liste (key) – `dropped` ist bei jeder Anzeige ein neues Array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dropDaySwaps]);
  return null;
}

function workoutMessageText(message: NonNullable<ReturnType<typeof useApp>['workoutMessage']>) {
  switch (message.kind) {
    case 'saved':
      return t.workout.saved;
    case 'queued':
      // Browser: nur bis zum Schließen des Tabs auf dem Gerät (K5).
      return Platform.OS === 'web' ? t.workout.queuedBrowser : t.workout.queued;
    case 'orphaned':
      return t.workout.orphaned;
    case 'conflict':
      return t.workout.conflictTitle;
    case 'rejected':
      return t.workout.rejected[message.reason];
    case 'invalid':
      return t.workout.invalid;
  }
}

/** Entwurf gefunden / Konflikt / abgelehnt (6.3) – nie stilles Verwerfen. */
function DraftNotice({
  draft,
  busy,
  onOpen,
  onSave,
  onKeep,
  onDiscard,
}: {
  draft: WorkoutDraft;
  busy: boolean;
  onOpen: () => void;
  onSave: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const date = formatDateDe(draft.performedOn);
  if (draft.state === 'conflict') {
    return (
      <Notice tone="warning" title={t.workout.conflictTitle} testID="workout-conflict">
        <Body muted>{draft.nameDe}</Body>
        <Button label={t.workout.conflictKeep} onPress={onKeep} loading={busy} />
        <Button label={t.workout.conflictTakeOther} variant="secondary" onPress={onDiscard} />
      </Notice>
    );
  }
  if (draft.state === 'rejected') {
    return (
      <Notice tone="danger" title={t.workout.rejectedTitle(date)} testID="workout-rejected">
        {draft.rejectReason ? <Body>{t.workout.rejected[draft.rejectReason]}</Body> : null}
        <Button label={t.workout.open} variant="secondary" onPress={onOpen} />
        <Button label={t.workout.retry} variant="secondary" onPress={onSave} loading={busy} />
        <Button label={t.workout.draftDiscard} variant="danger" onPress={onDiscard} />
      </Notice>
    );
  }
  return (
    <Notice tone="info" title={t.workout.draftTitle(date)} testID="workout-draft">
      <Body>{t.workout.draftText}</Body>
      <Button label={t.workout.draftContinue} onPress={onOpen} testID="workout-draft-continue" />
      <Button
        label={t.workout.draftSave}
        variant="secondary"
        onPress={onSave}
        loading={busy}
        testID="workout-draft-save"
      />
      <Button
        label={t.workout.draftDiscard}
        variant="danger"
        onPress={onDiscard}
        testID="workout-draft-discard"
      />
    </Notice>
  );
}
