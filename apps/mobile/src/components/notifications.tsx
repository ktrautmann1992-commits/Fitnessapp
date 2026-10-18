import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Body, Button, Card, Checkbox, Heading, Notice } from '@/components/ui';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { appNotifications, useNotificationPrefs } from '@/lib/app-notifications';
import { errorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import {
  deviceTimeZone,
  measurementOfferDays,
  shouldAskRestEndNotification,
  shouldOfferMeasurementNotification,
} from '@/lib/notifications';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';

/**
 * Lokale Benachrichtigungen in der Oberfläche (docs/PLAN-PHASE-4B.md 7 und 8.1 Nr. 4, Etappe E):
 * - `MeasurementNotificationOffer`: einmaliges Angebot nach der ersten Messung (nach dem Onboarding).
 * - `RestEndNotificationOffer`: einmalige Frage beim ersten Start des Trainingsmodus.
 * - `NotificationSettings`: Abschnitt „Benachrichtigungen“ in den Einstellungen; im Browser nur ein Hinweis.
 * Die System-Erlaubnis kommt erst nach „Ja“ bzw. dem Einschalten; Ablehnen ist folgenlos.
 */

function DeniedNotice() {
  return (
    <Notice tone="warning" testID="notifications-denied">
      {t.notifications.denied}
    </Notice>
  );
}

function OpenSystemSettings() {
  return (
    <Button
      label={t.notifications.openSystemSettings}
      variant="secondary"
      onPress={() => void Linking.openSettings().catch(() => undefined)}
    />
  );
}

async function syncNow(rows: UserRows | null, versions: ReturnType<typeof useApp>['versions']) {
  await appNotifications
    .syncMeasurement({ rows, versions, nowMs: Date.now(), timeZone: deviceTimeZone() })
    .catch(() => undefined);
}

export function MeasurementNotificationOffer() {
  const app = useApp();
  const notifications = useNotificationPrefs();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  if (denied) {
    return (
      <Card>
        <DeniedNotice />
        <OpenSystemSettings />
      </Card>
    );
  }
  const today = todayIso();
  const days = measurementOfferDays(app.rows, today);
  if (
    !notifications.loaded ||
    days === null ||
    !shouldOfferMeasurementNotification({
      supported: notifications.supported,
      prefs: notifications.prefs,
      rows: app.rows,
      versions: app.versions,
      today,
    })
  ) {
    return null;
  }
  return (
    <Card>
      <Heading level={2}>{t.notifications.offerTitle}</Heading>
      <Body>{t.notifications.offerText(days)}</Body>
      <Body muted>{t.notifications.why}</Body>
      <Button
        label={t.notifications.offerYes}
        loading={busy}
        testID="notification-offer-yes"
        onPress={() => {
          setBusy(true);
          void appNotifications
            .enableMeasurement()
            .then(async (result) => {
              if (result === 'granted') await syncNow(app.rows, app.versions);
              else setDenied(true);
            })
            .catch(() => undefined)
            .finally(() => {
              setBusy(false);
              void notifications.reload();
            });
        }}
      />
      <Button
        label={t.notifications.offerNo}
        variant="secondary"
        disabled={busy}
        testID="notification-offer-no"
        onPress={() =>
          void appNotifications
            .declineMeasurementOffer()
            .catch(() => undefined)
            .finally(() => void notifications.reload())
        }
      />
    </Card>
  );
}

export function RestEndNotificationOffer() {
  const notifications = useNotificationPrefs();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  if (denied) return <DeniedNotice />;
  if (
    !notifications.loaded ||
    !shouldAskRestEndNotification({
      supported: notifications.supported,
      prefs: notifications.prefs,
    })
  ) {
    return null;
  }
  return (
    <Card>
      <Heading level={2}>{t.notifications.restOfferTitle}</Heading>
      <Body>{t.notifications.restOfferText}</Body>
      <Body muted>{t.notifications.why}</Body>
      {Platform.OS === 'android' ? <Body muted>{t.notifications.androidDelay}</Body> : null}
      <Button
        label={t.notifications.restOfferYes}
        loading={busy}
        testID="rest-notification-offer-yes"
        onPress={() => {
          setBusy(true);
          void appNotifications
            .enableRestEnd()
            .then((result) => {
              if (result !== 'granted') setDenied(true);
            })
            .catch(() => undefined)
            .finally(() => {
              setBusy(false);
              void notifications.reload();
            });
        }}
      />
      <Button
        label={t.notifications.restOfferNo}
        variant="secondary"
        disabled={busy}
        testID="rest-notification-offer-no"
        onPress={() =>
          void appNotifications
            .declineRestEndOffer()
            .catch(() => undefined)
            .finally(() => void notifications.reload())
        }
      />
    </Card>
  );
}

export function NotificationSettings({ rows }: { rows: UserRows }) {
  const app = useApp();
  const notifications = useNotificationPrefs();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [testMessage, setTestMessage] = useState<string>();

  if (!notifications.supported) {
    return (
      <>
        <Heading level={2}>{t.notifications.settingsTitle}</Heading>
        <Card>
          <Notice tone="info" testID="notifications-web">
            {t.notifications.web}
          </Notice>
        </Card>
      </>
    );
  }

  const consentValid = healthConsentStatus(rows, app.versions) === 'valid';
  const { prefs, permission } = notifications;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setMessage(undefined);
    try {
      await task();
    } catch (caught) {
      setMessage(errorText(caught));
    } finally {
      setBusy(false);
      await notifications.reload().catch(() => undefined);
    }
  }

  return (
    <>
      <Heading level={2}>{t.notifications.settingsTitle}</Heading>
      <Card>
        <Body muted>{t.notifications.settingsText}</Body>
        <Body muted>{t.notifications.why}</Body>
        {consentValid ? (
          <Checkbox
            label={t.notifications.measurement}
            checked={prefs.measurement && permission === 'granted'}
            onChange={(value) =>
              void run(async () => {
                if (value) {
                  if ((await appNotifications.enableMeasurement()) === 'granted') {
                    await syncNow(rows, app.versions);
                  }
                } else {
                  await appNotifications.disableMeasurement();
                }
              })
            }
            testID="settings-notify-measurement"
          />
        ) : (
          <Body muted>{t.notifications.measurementNeedsConsent}</Body>
        )}
        {consentValid && prefs.measurement && rows.reminder && !rows.reminder.enabled ? (
          <Body muted>{t.notifications.measurementReminderOff}</Body>
        ) : null}
        <Checkbox
          label={t.notifications.restEnd}
          checked={prefs.restEnd && permission === 'granted'}
          onChange={(value) =>
            void run(() =>
              value ? appNotifications.enableRestEnd() : appNotifications.disableRestEnd(),
            )
          }
          testID="settings-notify-rest-end"
        />
        {Platform.OS === 'android' ? <Body muted>{t.notifications.androidDelay}</Body> : null}
        {permission === 'denied' && (prefs.measurementAsked || prefs.restEndAsked) ? (
          <>
            <DeniedNotice />
            <OpenSystemSettings />
          </>
        ) : null}
        {busy ? <Body muted>{t.common.loading}</Body> : null}
        {message ? <Notice tone="danger">{message}</Notice> : null}
        {app.backend.mode === 'local' ? (
          <>
            <Button
              label={t.notifications.testButton}
              variant="secondary"
              testID="settings-notify-test"
              onPress={() =>
                void appNotifications
                  .scheduleTestMeasurement({ rows, versions: app.versions, nowMs: Date.now() })
                  .then((result) =>
                    setTestMessage(
                      result === 'scheduled'
                        ? t.notifications.testScheduled
                        : result === 'needs_consent'
                          ? t.notifications.measurementNeedsConsent
                          : t.notifications.testNeedsPermission,
                    ),
                  )
                  .catch((caught: unknown) => setTestMessage(errorText(caught)))
              }
            />
            {testMessage ? <Body muted>{testMessage}</Body> : null}
          </>
        ) : null}
      </Card>
    </>
  );
}
