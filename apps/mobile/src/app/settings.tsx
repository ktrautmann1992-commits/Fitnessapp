import {
  activeConsentVersion,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  measurementReminderIntervalSchema,
  nextMeasurementDue,
  type ConsentType,
} from '@fitnessapp/core';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { consentRecordsFromRows } from '@/data/mapping';
import { activePlan } from '@/data/training-plan';
import type { ConsentRow } from '@/data/types';
import { t } from '@/i18n';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import { formatDateDe, formatTimestampDe } from '@/lib/format';
import { planTitleText } from '@/lib/plan-title';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, lastMeasurementDate } from '@/state/flow';

type DialogKind = 'revoke' | 'delete' | 'clear' | 'recreate' | 'signout' | null;

const LISTED_CONSENTS = [
  'terms',
  'privacy',
  'health_data',
] as const satisfies readonly ConsentType[];

function consentLine(rows: readonly ConsentRow[], type: ConsentType): string {
  const ofType = rows.filter((row) => row.consent_type === type);
  const active = ofType
    .filter((row) => row.revoked_at === null)
    .sort((a, b) => b.version - a.version)[0];
  if (active) {
    return t.settings.consentGranted(active.version, formatTimestampDe(active.granted_at));
  }
  const revoked = ofType
    .filter((row) => row.revoked_at !== null)
    .sort((a, b) => (b.revoked_at ?? '').localeCompare(a.revoked_at ?? ''))[0];
  return revoked?.revoked_at
    ? t.settings.consentRevoked(formatTimestampDe(revoked.revoked_at))
    : t.settings.consentNone;
}

export default function SettingsScreen() {
  const router = useRouter();
  const app = useApp();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [reminderEnabled, setReminderEnabled] = useState(app.rows?.reminder?.enabled ?? true);
  const [interval, setIntervalText] = useState(
    String(app.rows?.reminder?.interval_days ?? MEASUREMENT_REMINDER_INTERVAL_DAYS.default),
  );
  const [reminderError, setReminderError] = useState<string>();
  const [reminderSaved, setReminderSaved] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  /** Abmelden mit Wartendem (R6): Zahl der noch nicht übertragenen Trainings bzw. Entwürfe. */
  const [pendingCount, setPendingCount] = useState(0);
  const [stillPending, setStillPending] = useState(false);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows?.profile) {
    return <Redirect href="/" />;
  }
  const rows = app.rows;
  const healthStatus = healthConsentStatus(rows, app.versions);
  const records = consentRecordsFromRows(rows.consents);
  const currentPlan = activePlan(rows)?.plan ?? null;

  async function confirm() {
    setBusy(true);
    setDialogError(undefined);
    try {
      if (dialog === 'revoke') {
        // „Tagebuch behalten (empfohlen)“ – Vorgaben aus Gesundheits-Plänen werden neutralisiert (S1, R3).
        await app.revokeHealthData(false);
        setMessage(t.settings.revokeDone);
        setDialog(null);
      } else if (dialog === 'signout') {
        // „Jetzt senden“ – bleibt danach etwas übrig, wird NICHT abgemeldet, sondern erneut gefragt (R6).
        const left = await app.sendPending();
        if (left > 0) {
          setPendingCount(left);
          setStillPending(true);
        } else {
          setDialog(null);
          await app.signOut(true);
          router.replace('/welcome');
        }
      } else if (dialog === 'delete') {
        await app.deleteAccount();
        setDialog(null);
        router.replace('/welcome');
      } else if (dialog === 'clear') {
        await app.clearDeviceData();
        setDialog(null);
        router.replace('/welcome');
      } else if (dialog === 'recreate') {
        const outcome = await app.createPlan();
        if (outcome.ok) {
          setMessage(t.settings.planCreated);
          setDialog(null);
        } else {
          setDialogError(createPlanErrorText(outcome.code));
        }
      }
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder() {
    setReminderSaved(false);
    const parsed = measurementReminderIntervalSchema.safeParse(Number(interval));
    if (interval.trim() === '' || !parsed.success) {
      setReminderError(
        parsed.success ? 'Bitte eine Zahl eingeben.' : parsed.error.issues[0]?.message,
      );
      return;
    }
    setReminderError(undefined);
    setSavingReminder(true);
    try {
      const last = lastMeasurementDate(rows);
      await app.saveReminder(
        { enabled: reminderEnabled, intervalDays: parsed.data },
        last ? nextMeasurementDue(last, parsed.data) : null,
      );
      setReminderSaved(true);
    } catch (caught) {
      setReminderError(errorText(caught));
    } finally {
      setSavingReminder(false);
    }
  }

  async function signOut(force = false) {
    setBusy(true);
    try {
      const result = await app.signOut(force);
      if (result.kind === 'pending') {
        setPendingCount(result.count);
        setStillPending(false);
        setDialogError(undefined);
        setDialog('signout');
        return;
      }
      setDialog(null);
      router.replace('/welcome');
    } catch (caught) {
      setMessage(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function revokeDeletingLogs() {
    setBusy(true);
    setDialogError(undefined);
    try {
      await app.revokeHealthData(true);
      setMessage(t.settings.revokeDone);
      setDialog(null);
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const reminder = rows.reminder;
  const dialogTexts =
    dialog === 'revoke'
      ? {
          title: t.settings.revokeTitle,
          text: t.settings.revokeText,
          confirm: t.settings.revokeKeepLogs,
        }
      : dialog === 'signout'
        ? {
            title: t.settings.signOutPendingTitle,
            text: stillPending
              ? `${t.settings.signOutPending(pendingCount)} ${t.settings.signOutStillPending}`
              : t.settings.signOutPending(pendingCount),
            confirm: t.settings.signOutSendNow,
          }
        : dialog === 'delete'
          ? {
              title: t.settings.deleteTitle,
              text: t.settings.deleteText,
              confirm: t.settings.deleteConfirm,
            }
          : dialog === 'recreate'
            ? {
                title: t.plan.recreateTitle,
                text: t.plan.recreateText,
                confirm: t.plan.recreateConfirm,
              }
            : {
                title: t.settings.clearTitle,
                text: t.settings.clearText,
                confirm: t.settings.clearConfirm,
              };

  return (
    <Screen
      title={t.settings.title}
      testID="settings"
      footer={
        <Button
          label={t.settings.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {message ? <Notice tone="success">{message}</Notice> : null}

      <Heading level={2}>{t.settings.training}</Heading>
      <Card>
        {currentPlan ? <Body>{planTitleText(currentPlan)}</Body> : null}
        <Body muted>{t.settings.trainingText}</Body>
        {/* Öffnet die vorhandenen Onboarding-Schritte und kehrt danach zu „Heute“ zurück (Plan neu erstellen?). */}
        <Button
          label={t.settings.editInputs}
          variant="secondary"
          onPress={() => router.push('/onboarding/experience?edit=1')}
        />
        {healthStatus === 'valid' ? (
          <Button
            label={t.settings.repeatScreening}
            variant="secondary"
            onPress={() => router.push('/onboarding/health_screening?edit=1')}
          />
        ) : (
          <Body muted>{t.settings.repeatScreeningNeedsConsent}</Body>
        )}
        <Button
          label={t.settings.recreatePlan}
          variant="secondary"
          onPress={() => {
            setDialogError(undefined);
            setDialog('recreate');
          }}
        />
      </Card>

      <Heading level={2}>{t.settings.consents}</Heading>
      {LISTED_CONSENTS.map((type) => (
        <Card key={type}>
          <Body>{t.consentTypes[type]}</Body>
          <Body muted>{consentLine(rows.consents, type)}</Body>
          {type === 'health_data' ? (
            healthStatus === 'valid' ? (
              <>
                <Body muted>{t.settings.revokeLogsNote}</Body>
                <Button
                  label={t.settings.revoke}
                  variant="danger"
                  accessibilityLabel={`${t.consentTypes.health_data}: ${t.settings.revoke}`}
                  onPress={() => {
                    setDialogError(undefined);
                    setDialog('revoke');
                  }}
                />
              </>
            ) : (
              <>
                {healthStatus === 'outdated' ? (
                  <Notice tone="warning">{t.settings.consentOutdated}</Notice>
                ) : null}
                <Button
                  label={healthStatus === 'outdated' ? t.settings.reconsent : t.settings.grant}
                  variant="secondary"
                  accessibilityLabel={`${t.consentTypes.health_data}: ${
                    healthStatus === 'outdated' ? t.settings.reconsent : t.settings.grant
                  }`}
                  onPress={() => router.push('/health-consent')}
                />
              </>
            )
          ) : activeConsentVersion(records, type) === null ? (
            <Notice tone="warning">{t.settings.consentOutdated}</Notice>
          ) : null}
        </Card>
      ))}
      <Body muted>{t.settings.baseConsentNote}</Body>

      <Heading level={2}>{t.settings.reminder}</Heading>
      <Card>
        <Checkbox
          label={t.settings.reminderEnabled}
          checked={reminderEnabled}
          onChange={(value) => {
            setReminderEnabled(value);
            setReminderSaved(false);
          }}
        />
        <TextField
          label={t.settings.reminderInterval}
          value={interval}
          onChangeText={(text) => {
            setIntervalText(text.replace(/\D/g, '').slice(0, 2));
            setReminderSaved(false);
          }}
          keyboardType="number-pad"
          error={reminderError}
        />
        <Body muted>
          {!reminder?.enabled
            ? reminder
              ? t.settings.reminderOff
              : t.settings.reminderNoDate
            : reminder.next_due_on
              ? t.settings.reminderNext(formatDateDe(reminder.next_due_on))
              : t.settings.reminderNoDate}
        </Body>
        {reminderSaved ? <Notice tone="success">{t.settings.reminderSaved}</Notice> : null}
        <Button
          label={t.common.save}
          variant="secondary"
          onPress={() => void saveReminder()}
          loading={savingReminder}
        />
      </Card>

      <Heading level={2}>{t.settings.account}</Heading>
      <View style={{ gap: 8 }}>
        {app.session.email ? <Body muted>{app.session.email}</Body> : null}
        <Button
          label={t.settings.signOut}
          variant="secondary"
          onPress={() => void signOut()}
          disabled={busy}
        />
        <Button
          label={t.settings.deleteAccount}
          variant="danger"
          onPress={() => {
            setDialogError(undefined);
            setDialog('delete');
          }}
        />
      </View>

      {app.backend.mode === 'local' ? (
        <>
          <Heading level={2}>{t.settings.testMode}</Heading>
          <Card>
            <Body muted>{t.settings.testModeText}</Body>
            <Button
              label={t.settings.clearTestData}
              variant="danger"
              onPress={() => {
                setDialogError(undefined);
                setDialog('clear');
              }}
            />
          </Card>
        </>
      ) : null}

      <ConfirmDialog
        visible={dialog !== null}
        title={dialogTexts.title}
        message={dialogTexts.text}
        confirmLabel={dialogTexts.confirm}
        confirmVariant={dialog === 'recreate' || dialog === 'signout' ? 'primary' : 'danger'}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID={dialog ? `dialog-${dialog}` : undefined}
        {...(dialog === 'revoke'
          ? {
              // Wahl aus S1 und Hinweise (H6, R3, K4).
              notes: [
                t.settings.revokeLogs,
                t.settings.revokeOtherDevices,
                t.settings.revokeEarlier,
              ],
              alternative: {
                label: t.settings.revokeDeleteLogs,
                variant: 'danger' as const,
                onPress: () => void revokeDeletingLogs(),
              },
            }
          : dialog === 'signout'
            ? {
                alternative: {
                  label: t.settings.signOutAnyway,
                  variant: 'danger' as const,
                  onPress: () => void signOut(true),
                },
              }
            : {})}
      />
    </Screen>
  );
}
