import { droppableWeekdays, type FewerDaysChange } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Body, Button, ChoiceList, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { createPlanErrorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import { decodeRouteParam } from '@/lib/route-param';
import { useApp } from '@/state/app-state';

/**
 * Bestätigungs-Dialog „Weniger Trainingstage“ (docs/PLAN-PHASE-4B.md 8.1 Punkt 3): Zahlen, vorgeschlagener
 * wegfallender Tag (änderbar), Hinweis „neuer Plan, Tagebuch bleibt“. „Umstellen“ = Tagebuch-Warteschlange senden →
 * neue Trainingstage speichern → neuen Plan erstellen → Vorschlag bestätigen; „Nein danke“ lehnt ab. Große Änderung
 * NUR nach Bestätigung (KONZEPT 4.1).
 */
export default function FewerDaysScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = decodeRouteParam(params.id);
  const today = todayIso();
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string }>();
  const [done, setDone] = useState(false);

  if (app.status.kind === 'loading' || app.liveAdjust.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows) return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  const proposal = app.liveAdjust.adjustments.find((a) => a.id === id && a.rule === 'fewer_days');
  const open =
    proposal?.status === 'pending_confirmation' &&
    (proposal.expiresOn === null || proposal.expiresOn >= today);
  const footer = <Button label={t.adjust.back} variant="secondary" onPress={back} />;

  if (!proposal || (!open && !done)) {
    return (
      <Screen
        area="training"
        icon="calendar"
        title={t.adjust.fewerTitle}
        testID="fewer-days"
        footer={footer}
      >
        {message ? (
          <Notice tone={message.tone} testID="fewer-days-message">
            <Body>{message.text}</Body>
          </Notice>
        ) : (
          <Notice tone="info" testID="fewer-days-expired">
            <Body>{proposal ? t.adjust.proposalExpired : t.adjust.fewerMissing}</Body>
          </Notice>
        )}
      </Screen>
    );
  }

  const after = proposal.changeAfter as FewerDaysChange | null;
  const suggested = after?.drop_weekday ?? null;
  const schedule = app.answers.trainingSchedule;
  const weekdays = schedule ? droppableWeekdays(schedule) : [];
  const drop = choice ?? suggested ?? weekdays.at(-1) ?? null;
  const days = after?.days ?? 0;

  async function accept() {
    if (drop === null && weekdays.length > 0) return;
    setBusy('accept');
    setMessage(undefined);
    // Nur online (8.3): im Testmodus immer erreichbar; im Supabase-Modus kommt dieser Weg erst mit Etappe B/C.
    if (app.offline) {
      setMessage({ tone: 'danger', text: t.adjust.offline });
      setBusy(null);
      return;
    }
    const outcome = await app.acceptFewerDays(proposal!.id, drop ?? 0);
    setBusy(null);
    if (outcome.ok) {
      setDone(true);
      setMessage({ tone: 'success', text: t.adjust.fewerDone(outcome.days) });
      return;
    }
    setMessage({
      tone: 'danger',
      text:
        outcome.code === 'expired'
          ? t.adjust.proposalExpired
          : outcome.code === 'not_possible'
            ? t.adjust.fewerFailed
            : `${t.adjust.fewerFailed} ${createPlanErrorText(outcome.code)}`,
    });
  }

  async function decline() {
    setBusy('decline');
    setMessage(undefined);
    try {
      const result = await app.declineProposal(proposal!.id);
      setDone(true);
      setMessage(
        result === 'declined'
          ? { tone: 'info', text: t.adjust.fewerDeclined }
          : { tone: 'info', text: t.adjust.proposalExpired },
      );
    } catch {
      setMessage({ tone: 'danger', text: t.adjust.revertFailed });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      area="training"
      icon="calendar"
      title={t.adjust.fewerTitle}
      testID="fewer-days"
      footer={
        done ? <Button label={t.adjust.back} onPress={() => router.replace('/today')} /> : footer
      }
    >
      {message ? (
        <Notice tone={message.tone} testID="fewer-days-message">
          <Body>{message.text}</Body>
        </Notice>
      ) : null}
      {done ? null : (
        <>
          <Body testID="fewer-days-numbers">
            {t.adjust.fewerNumbers(
              Number(proposal.explainParams.done ?? 0),
              Number(proposal.explainParams.planned ?? 0),
              days,
            )}
          </Body>
          {weekdays.length > 0 ? (
            <>
              <ChoiceList
                label={t.adjust.fewerDropLabel}
                options={weekdays.map((weekday) => ({
                  value: weekday,
                  label: t.adjust.weekday(weekday),
                  description: weekday === suggested ? t.adjust.fewerSuggested : undefined,
                }))}
                value={drop}
                onChange={setChoice}
              />
              <Body muted>{t.adjust.fewerDropHint}</Body>
            </>
          ) : null}
          <Notice tone="info">
            <Body>{t.adjust.fewerNewPlan}</Body>
          </Notice>
          <Button
            label={t.adjust.fewerConfirm}
            onPress={() => void accept()}
            loading={busy === 'accept'}
            disabled={busy !== null}
            testID="fewer-days-confirm"
          />
          <Button
            label={t.adjust.fewerDecline}
            variant="secondary"
            onPress={() => void decline()}
            loading={busy === 'decline'}
            disabled={busy !== null}
            testID="fewer-days-decline"
          />
        </>
      )}
    </Screen>
  );
}
