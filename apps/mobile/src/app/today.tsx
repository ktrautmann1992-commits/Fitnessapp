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
import { View } from 'react-native';

import { MedicalNotice, SessionCard, WeekOverview } from '@/components/plan';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { BackendError } from '@/data/backend';
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
import { todayIso } from '@/lib/format';
import { dayLabel, weekdayName } from '@/lib/plan-format';
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
  const context = selectedSession
    ? {
        // Nachschlagen auch archivierter Übungen des laufenden Plans; Ersatz nur aus freigegebenen.
        library: lib ? (lib.displayExercises ?? lib.exercises) : null,
        profile: profiles.get(sessionLocation(selectedSession, snapshot?.schedule ?? null)),
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
          />
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

      <Card>
        <Body muted>
          {plan.template_title_de
            ? t.plan.templateLine(plan.template_title_de)
            : t.plan.enduranceOnly}
        </Body>
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
      {dialogs}
    </Screen>
  );
}
