import { cycleDayOfCycleDe, CYCLE_INTRO_DE, type CycleEntryPayload } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  CycleDayCheck,
  CycleHints,
  CycleLongGapQuestion,
  CycleMdrNotice,
  CyclePregnancyPause,
  CycleSetupForm,
  CycleStaticGuide,
  CycleUrgentNotice,
  CycleWarningCard,
  LighterOfferCard,
} from '@/components/cycle';
import { ListGroup, ListRow } from '@/components/design';
import { Screen } from '@/components/screen';
import { Body, Button, Checkbox, Heading, LoadingState, Notice } from '@/components/ui';
import { deCycle as C } from '@/i18n/de-cycle';
import { cycleErrorText } from '@/lib/cycle-format';
import { useApp } from '@/state/app-state';
import { forgetCycle, useCycle } from '@/state/use-cycle';

/**
 * Zyklus-Bildschirm (docs/PLAN-PHASE-9.md 9.1): Einführung + Einwilligung → Einrichten → Tages-Check mit Angebot,
 * Hinweisen und Warnungen; Pausen-, Schwangerschafts- und Verwaltungs-Zustand. Nur hier stehen Zyklus-Wörter –
 * „Heute“ zeigt höchstens die neutrale Karte „Wie geht’s dir heute?“ (K7).
 */
export default function CycleScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useCycle();
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'warning' | 'danger';
    text: string;
  }>();
  // Zuletzt getippter Stand des heutigen Checks (jede Speicherung sendet den ganzen Eintrag – schnelles Tippen
  // verliert so keine Angabe).
  const [draft, setDraft] = useState<{ date: string; payload: CycleEntryPayload } | null>(null);

  const queued = view.load.kind === 'ready' && view.load.snapshot.pending > 0;
  // Browser (K4): solange Einträge nicht gesendet sind, vor dem Verlassen der Seite warnen.
  useEffect(() => {
    if (Platform.OS !== 'web' || !queued || typeof window === 'undefined') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = C.leaveWarning;
      return C.leaveWarning;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [queued]);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows?.profile) return <Redirect href="/" />;

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (error) {
      setMessage({ tone: 'danger', text: cycleErrorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    if (!consentChecked) {
      setConsentError(C.intro.consentRequired);
      return;
    }
    setConsentError(undefined);
    await run(async () => {
      await app.grantConsents(['cycle_data']);
      forgetCycle();
    });
  }

  const currentPayload =
    draft?.date === view.today ? draft.payload : (view.todayEntry?.payload ?? null);

  async function saveCheck(patch: Partial<CycleEntryPayload>) {
    const payload = { ...(currentPayload ?? {}), ...patch };
    setDraft({ date: view.today, payload });
    setMessage(undefined);
    try {
      const result = await view.saveEntry(view.today, payload);
      if (result === 'queued') {
        setMessage({
          tone: 'warning',
          text: Platform.OS === 'web' ? C.check.queuedBrowser : C.check.queued,
        });
      }
    } catch (error) {
      setMessage({ tone: 'danger', text: cycleErrorText(error) });
    }
  }

  const footerLinks = (
    <ListGroup>
      <ListRow
        icon="calendar"
        label={C.history.open}
        onPress={() => router.push('/zyklus/verlauf' as Href)}
        testID="cycle-open-history"
      />
      <ListRow
        icon="settings"
        label={C.settings.open}
        onPress={() => router.push('/zyklus/einstellungen' as Href)}
        testID="cycle-open-settings"
        last
      />
    </ListGroup>
  );

  const offline =
    view.load.kind === 'ready' && view.load.snapshot.offline ? (
      <Notice tone="warning">{C.offline}</Notice>
    ) : null;
  const feedback = message ? (
    <Notice tone={message.tone} testID="cycle-message">
      {message.text}
    </Notice>
  ) : null;

  let content;
  if (view.load.kind === 'loading') {
    content = <LoadingState />;
  } else if (view.load.kind === 'error' && view.state !== 'off') {
    content = <Notice tone="danger">{C.loadError}</Notice>;
  } else if (view.state === 'hidden') {
    content = (
      <View style={styles.stack} testID="cycle-hidden">
        <Notice>{view.cycle?.mode === 'supabase' ? C.intro.closed : C.manage.body}</Notice>
      </View>
    );
  } else if (view.state === 'off') {
    content = (
      <View style={styles.stack} testID="cycle-intro">
        {CYCLE_INTRO_DE.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        <Body muted>{C.intro.privacy}</Body>
        <CycleMdrNotice />
        <Checkbox
          label={C.intro.consentCheckbox}
          checked={consentChecked}
          onChange={setConsentChecked}
          error={consentError}
          testID="cycle-consent-checkbox"
        />
        <Button
          label={C.intro.readConsent}
          variant="link"
          onPress={() => router.push('/consent/cycle_data' as Href)}
        />
        <Button label={C.intro.start} onPress={grant} loading={busy} testID="cycle-start" />
      </View>
    );
  } else if (view.state === 'needs_status') {
    content = (
      <View style={styles.stack}>
        <Heading level={2}>{C.setup.title}</Heading>
        <CycleSetupForm
          initialStatus={null}
          initialSleep={false}
          askLastPeriod
          busy={busy}
          onSave={(value) =>
            run(() =>
              view.saveSettings({
                status: value.status,
                lastPeriodAtStart: value.lastPeriodAtStart,
                sleepTracking: value.sleepTracking,
                enabledOn: view.today,
                paused: false,
              }),
            )
          }
        />
      </View>
    );
  } else if (view.state === 'paused_pregnancy') {
    content = (
      <CyclePregnancyPause
        onHealthCheck={() => router.push('/onboarding/health_screening?edit=1' as Href)}
        onChangeStatus={
          view.settings?.status === 'pregnant'
            ? () => router.push('/zyklus/einstellungen' as Href)
            : undefined
        }
      />
    );
  } else if (view.state === 'paused') {
    content = (
      <View style={styles.stack} testID="cycle-paused">
        <Notice>{C.settings.paused}</Notice>
        <Button
          label={C.settings.resume}
          onPress={() => run(() => view.saveSettings({ paused: false }))}
          loading={busy}
          testID="cycle-resume"
        />
      </View>
    );
  } else if (view.state === 'manage_only') {
    content = (
      <View style={styles.stack} testID="cycle-manage">
        <Notice>{C.manage.body}</Notice>
      </View>
    );
  } else {
    // Aktiv: Tages-Check, Angebot, Hinweise, Warnungen.
    const warningsOn = view.load.kind === 'ready' && view.load.access.warnings;
    content = (
      <View style={styles.stack} testID="cycle-active">
        {view.dayOfCycle !== null ? (
          <Body muted testID="cycle-day-of-cycle">
            {cycleDayOfCycleDe(view.dayOfCycle)}
          </Body>
        ) : null}
        <Heading level={2}>{C.check.title}</Heading>
        <Body muted>{C.check.hint}</Body>
        <CycleDayCheck
          payload={currentPayload}
          sleepTracking={view.settings?.sleepTracking ?? false}
          onChange={(patch) => void saveCheck(patch)}
        />
        {feedback}
        <CycleUrgentNotice />
        {view.assessment.lighterOffer && view.context?.todaySession ? (
          <LighterOfferCard session={view.context.todaySession} />
        ) : null}
        {view.longGapDays !== null ? (
          <CycleLongGapQuestion
            days={view.longGapDays}
            onYes={() => run(() => view.saveSettings({ noBleedingConfirmedUntil: view.today }))}
            onNo={() => router.push('/zyklus/verlauf' as Href)}
          />
        ) : null}
        <CycleHints
          nutrition={view.nutritionHints}
          day={view.assessment.hints.filter(
            (hint) =>
              hint !== 'lighter_often' || view.settings?.dismissed.lighter_often === undefined,
          )}
          onDismiss={(code) => void run(() => view.dismiss(code))}
        />
        {warningsOn ? (
          view.warnings.map((code) => (
            <CycleWarningCard
              key={code}
              code={code}
              onDismiss={() => void run(() => view.dismiss(code))}
              onGoal={
                code === 'W1b' || code === 'W1c'
                  ? () => router.push('/onboarding/goal?edit=1' as Href)
                  : undefined
              }
            />
          ))
        ) : (
          <CycleStaticGuide />
        )}
      </View>
    );
  }

  return (
    <Screen title={C.title} area="zyklus" icon="calendar" testID="cycle-screen">
      {offline}
      {content}
      {view.state !== 'active' ? feedback : null}
      {view.state === 'off' || view.state === 'hidden' ? null : footerLinks}
      {view.state === 'off' || view.state === 'needs_status' ? null : <CycleMdrNotice />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
