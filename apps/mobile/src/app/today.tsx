import {
  addDays,
  blockWeekFor,
  followUpBlockState,
  nextPlannedSession,
  prepareSessionForDisplay,
  sessionLocation,
  sessionOn,
  startOfIsoWeek,
  weekOverview,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { MedicalNotice, SessionCard, WeekOverview } from '@/components/plan';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { BackendError } from '@/data/backend';
import { logForSession } from '@/data/log-rows';
import type { WorkoutDraft } from '@/data/workout-draft';
import { startKind, trainedTodayOther, workoutView } from '@/data/workout-session';
import {
  activePlan,
  planOffer,
  planSnapshot,
  profilesFor,
  rescheduleInRows,
  startGroupOf,
} from '@/data/training-plan';
import { t } from '@/i18n';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import { formatDateDe, todayIso } from '@/lib/format';
import { workoutTargetLines } from '@/lib/workout-format';
import { dayLabel, weekdayName } from '@/lib/plan-format';
import { planTitleText } from '@/lib/plan-title';
import { PLAN_CHANGE_DROPPED, PLAN_RECREATE_NEEDED, useApp } from '@/state/app-state';
import { healthConsentStatus, isReminderDue, resolveEntryRoute } from '@/state/flow';

/**
 * „Heute“ (docs/PLAN-PHASE-3.md 10.2/10.3): heutige Einheit mit Arzt-Hinweis, Wochenübersicht, Verschieben,
 * Hinweise und alle Zustände. Vor dem Anzeigen JEDER Einheit wendet prepareSessionForDisplay() die aktuellen
 * Sicherheitsregeln an (Kraft und Ausdauer).
 */
export default function TodayScreen() {
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  const [selected, setSelected] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [skipDialog, setSkipDialog] = useState<string | null>(null);
  const [declineDialog, setDeclineDialog] = useState(false);
  const [discardDraftKey, setDiscardDraftKey] = useState<string | null>(null);
  const [foreignDialog, setForeignDialog] = useState(false);

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
  const consent = healthConsentStatus(rows, app.versions);
  const outdated = consent === 'outdated';
  const revoked = rows.consents.some(
    (c) => c.consent_type === 'health_data' && c.revoked_at !== null,
  );
  const lib = library.kind === 'ready' ? library.library : null;
  const rules = app.safetyRules;

  async function create() {
    setBusy(true);
    setMessage(undefined);
    const outcome = await app.createPlan();
    setBusy(false);
    setSelected(today);
    setMessage(
      outcome.ok
        ? { tone: 'success', text: t.plan.created }
        : { tone: 'danger', text: createPlanErrorText(outcome.code) },
    );
  }

  async function move(sessionId: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await app.moveSession(sessionId);
      if (result.kind === 'moved') {
        setSelected(result.date);
        setMessage({ tone: 'success', text: t.plan.moved(weekdayName(result.date)) });
      } else if (result.kind === 'skipped') {
        setMessage({ tone: 'success', text: t.plan.skippedResult });
      } else {
        setMessage({ tone: 'danger', text: t.errors.planRejected });
      }
    } catch (caught) {
      const sensitive = caught instanceof BackendError && caught.sensitive;
      setMessage({
        tone: 'danger',
        text:
          caught instanceof BackendError && caught.code === 'network' && sensitive
            ? t.errors.networkPlan
            : errorText(caught),
      });
    } finally {
      setBusy(false);
      setSkipDialog(null);
    }
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

  /** Verschieben antippen: Ergebnis vorab berechnen – wird gestrichen, erst nachfragen. */
  function requestMove(sessionId: string) {
    if (!rows) return;
    const preview = rescheduleInRows(rows, sessionId, today);
    if (preview.kind === 'skipped') {
      setSkipDialog(sessionId);
    } else {
      void move(sessionId);
    }
  }

  const header = (
    <>
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
      {app.planMessage === PLAN_CHANGE_DROPPED ? (
        <Notice tone="warning">
          <Body>{t.plan.droppedChange}</Body>
          <Button label={t.common.close} variant="link" onPress={app.clearPlanMessage} />
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
    </>
  );

  const footer = (
    <Button label={t.today.settings} variant="secondary" onPress={() => router.push('/settings')} />
  );

  const dialogs = (
    <>
      <ConfirmDialog
        visible={skipDialog !== null}
        title={t.plan.skipTitle}
        message={t.plan.skipText}
        confirmLabel={t.plan.skipConfirm}
        onConfirm={() => (skipDialog ? void move(skipDialog) : undefined)}
        onCancel={() => setSkipDialog(null)}
        loading={busy}
      />
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
      <Screen title={t.today.title} testID="today" footer={footer}>
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
        {rows.sessionLogs.length > 0 ? (
          // Das Tagebuch bleibt auch ohne Plan (z. B. nach dem Widerruf) – Verlauf erreichbar.
          <Button
            label={t.today.openHistory}
            variant="secondary"
            onPress={() => router.push('/history' as Href)}
            testID="today-history"
          />
        ) : null}
        {dialogs}
      </Screen>
    );
  }

  // --- Plan vorhanden -------------------------------------------------------------------------------------
  const plan = active.plan;
  const birthDate = rows.profile?.birth_date ?? today;
  const snapshot = planSnapshot(plan);
  const profiles = profilesFor(snapshot);
  const week = blockWeekFor(active.sessions, today);
  const days = weekOverview(active.sessions, today, selected);
  const selectedSession = sessionOn(active.sessions, selected);
  // Nächste Einheit nach dem gewählten Tag – frühestens heute (vergangene Tage verweisen auf heute und später).
  const next = nextPlannedSession(
    active.sessions,
    selected < today ? addDays(today, -1) : selected,
  );
  const followUp = followUpBlockState(active.sessions, today);
  const templateVersion = lib?.templates.find((tpl) => tpl.id === plan.template_id)?.version;
  const offer = rules ? planOffer(rows, app.versions, active, rules, today, templateVersion) : null;
  // Nachschlagen auch archivierter Übungen des laufenden Plans; Ersatz nur aus freigegebenen.
  const lookup = lib ? (lib.displayExercises ?? lib.exercises) : null;
  const context = selectedSession
    ? {
        library: lookup,
        // Ort: fester Tag bzw. bei „Tage egal“ mit zwei Orten aus der Fassung (Heim-Geräte).
        profile: profiles.get(
          sessionLocation(selectedSession, snapshot?.schedule ?? null, {
            library: lookup,
            homeProfile: profiles.get('home'),
          }),
        ),
      }
    : null;
  const shown =
    selectedSession && rules && context
      ? prepareSessionForDisplay(selectedSession, {
          rules,
          previousStartGroup: startGroupOf(active, birthDate),
          library: context.library,
          ...(lib ? { substituteLibrary: lib.exercises } : {}),
          ...(context.profile ? { profile: context.profile } : {}),
        })
      : null;
  // Verschieben/Streichen, solange die Woche des ursprünglichen Termins nicht vorbei ist – auch verpasste
  // Einheiten an vergangenen Tagen dieser Woche (Regel des Datenbank-Triggers).
  const canMove =
    selectedSession !== null &&
    selectedSession.status === 'planned' &&
    addDays(startOfIsoWeek(selectedSession.original_date ?? selectedSession.scheduled_on), 6) >=
      today;
  const missed = canMove && selectedSession !== null && selectedSession.scheduled_on < today;
  const firstSession = active.sessions.find((s) => s.status === 'planned');
  // Phase 4: berechnete Vorgabe aus dem Tagebuch (packages/core planWorkout) – nur Kraft, mit Bibliothek.
  const view =
    selectedSession && selectedSession.kind === 'strength' && lib && rules
      ? workoutView(rows, lib, rules, selectedSession.id, today, {
          excludeLogId: logForSession(rows, selectedSession.id)?.id ?? null,
        })
      : null;
  const targets = view?.items.map(workoutTargetLines);
  const start = selectedSession ? startKind(rows, selectedSession, today) : null;
  const log = selectedSession ? logForSession(rows, selectedSession.id) : null;
  const hasDraft = selectedSession ? app.drafts.some((d) => d.key === selectedSession.id) : false;
  const pendingUpload =
    selectedSession !== null && app.pendingLogSessionIds.includes(selectedSession.id);

  return (
    <Screen title={t.today.title} testID="today" footer={footer}>
      {header}
      {offer?.offer || followUp === 'ended' ? (
        <Notice
          tone={offer?.stricter || followUp === 'ended' ? 'danger' : 'info'}
          title={
            followUp === 'ended'
              ? t.plan.endedTitle
              : offer?.stricter
                ? t.plan.offerStricterTitle
                : t.plan.offerTitle
          }
          testID="plan-offer"
        >
          <Body>
            {followUp === 'ended'
              ? t.plan.endedText
              : offer?.stricter
                ? t.plan.offerStricterText
                : offer?.reasons.length === 1 && offer.reasons[0] === 'template_version'
                  ? t.plan.offerVersion
                  : t.plan.offerText}
          </Body>
          <Button label={t.plan.recreate} onPress={() => void create()} loading={busy} />
        </Notice>
      ) : null}

      {week ? (
        <View style={{ gap: 4 }} testID="plan-week-header">
          <Heading level={2}>
            {week.weekNo === 0 ? t.plan.week0 : t.plan.weekHeader(week.weekNo, week.weeksInBlock)}
          </Heading>
          {week.isIntroWeek ? (
            <Body muted>
              {t.plan.introWeek}: {t.plan.introWeekText}
            </Body>
          ) : null}
          {week.isDeload ? (
            <Body muted>
              {t.plan.deloadWeek}: {t.plan.deloadWeekText}
            </Body>
          ) : null}
        </View>
      ) : null}

      {selectedSession && shown ? (
        <>
          {/* Arzt-Hinweis vor JEDER Einheit – das Feld liegt am Plan (auch offline). */}
          {plan.medical_notice ? <MedicalNotice /> : null}
          <SessionCard
            original={selectedSession}
            shown={shown}
            rules={rules}
            context={context ?? { library: null }}
            heading={
              selected === today ? t.plan.todaySession : t.plan.sessionOn(dayLabel(selected))
            }
            {...(targets && selectedSession.status === 'planned' ? { targets } : {})}
          />
          {selectedSession.status === 'completed' ? (
            <Notice tone="success" testID="plan-completed">
              <Body>{log?.status === 'partial' ? t.today.completedPartly : t.today.completed}</Body>
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
          {start && !hasDraft ? (
            // Ausdauer braucht keine Übungs-Bibliothek (C2); Kraft erst nach geprüften Übungen (H7).
            selectedSession.kind === 'strength' && (shown.libraryMissing || !view) ? (
              <Notice tone="info">{t.today.libraryMissingStart}</Notice>
            ) : (
              <>
                {start === 'catch_up' ? <Body muted>{t.today.catchUpHint}</Body> : null}
                <Button
                  label={
                    selectedSession.kind === 'endurance'
                      ? start === 'today'
                        ? t.today.startEndurance
                        : t.today.catchUpEndurance
                      : start === 'today'
                        ? t.today.startWorkout
                        : t.today.catchUp
                  }
                  onPress={() => router.push(`/workout/${selectedSession.id}` as Href)}
                  testID="workout-start"
                />
              </>
            )
          ) : null}
          {missed ? (
            <Notice tone="info" testID="plan-missed">
              {t.plan.missed}
            </Notice>
          ) : null}
          {canMove ? (
            <Button
              label={t.plan.move}
              variant="secondary"
              onPress={() => requestMove(selectedSession.id)}
              loading={busy}
            />
          ) : null}
        </>
      ) : selectedSession ? (
        <LoadingState label={t.plan.loading} />
      ) : (
        <Card>
          <Heading level={2}>
            {selected === today ? t.plan.restDay : `${dayLabel(selected)}: ${t.plan.restShort}`}
          </Heading>
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
      )}

      <Heading level={2}>{t.plan.weekTitle}</Heading>
      <WeekOverview days={days} selected={selected} onSelect={setSelected} />
      {/* Woche und Verlauf (Etappe D) – eine Tab-Leiste kommt mit der Ernährung (Phase 5). */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t.today.openWeek}
            variant="secondary"
            onPress={() => router.push('/week' as Href)}
            testID="today-week"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t.today.openHistory}
            variant="secondary"
            onPress={() => router.push('/history' as Href)}
            testID="today-history"
          />
        </View>
      </View>

      <Card>
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
          <View style={{ gap: 4 }} testID="plan-notes">
            <Heading level={2}>{t.plan.notesTitle}</Heading>
            {plan.notes.map((note) => (
              <Body key={note} muted>
                • {t.plan.notes[note]}
              </Body>
            ))}
          </View>
        ) : null}
      </Card>
      {/* Plan als PDF (docs/PLAN-PDF-EXPORT.md P3): Hinweis bei Gesundheitsbezug zeigt die Druckansicht. */}
      <Button
        label={t.printView.button}
        variant="secondary"
        accessibilityHint={t.printView.buttonHint}
        onPress={() => router.push('/plan/drucken' as Href)}
        testID="plan-print"
      />
      {dialogs}
    </Screen>
  );
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
