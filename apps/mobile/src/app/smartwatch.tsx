import { hasValidConsent, WEARABLE_DATA_TYPES, type WearableDataType } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { StepGoalCard } from '@/components/steps';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { consentRecordsFromRows } from '@/data/mapping';
import type { WearableSyncOutcome } from '@/data/wearable-sync';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatTimestampDe, todayIso } from '@/lib/format';
import type { HcAvailability } from '@/lib/health-connect-driver.types';
import { dateTimeText, recentDailyLines } from '@/lib/wearable-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import {
  forgetWearables,
  syncWearables,
  useWearables,
  wearableConsentsValid,
  wearableDriver,
} from '@/state/use-wearables';

const W = t.wearables;

type Message = { text: string; tone: 'success' | 'info' | 'warning' | 'danger' };

/** Text zum Ergebnis eines Abgleichs (ohne Werte). */
function syncMessage(outcome: WearableSyncOutcome | null): Message | null {
  if (!outcome) return null;
  switch (outcome.kind) {
    case 'imported': {
      const r = outcome.result;
      const parts = [W.syncDone(r.created, r.merged)];
      if (r.skipped > 0) parts.push(W.syncSkipped(r.skipped));
      if (r.created + r.merged + r.updated === 0 && r.days === 0) parts.push(W.noData);
      return { text: parts.join(' '), tone: 'success' };
    }
    case 'queued':
      return { text: W.syncQueued, tone: 'info' };
    case 'permission_missing':
      return { text: W.permissionMissing, tone: 'warning' };
    case 'unavailable':
      return outcome.availability === 'unsupported'
        ? { text: W.onlyAndroid, tone: 'info' }
        : { text: W.installText, tone: 'warning' };
  }
}

/**
 * Einstellungen → „Smartwatch verbinden“ (Phase 8 Etappe H3, docs/PLAN-PHASE-8.md 7.2): Erklärung, eigene Einwilligung
 * „Smartwatch-Daten“, DANN der Systemdialog von Health Connect (nur Leserechte). Danach Stand, letzter Abgleich,
 * freigegebene Daten, Tageswerte, „Jetzt abgleichen“ und „Trennen“ (behalten/löschen, Puls immer gelöscht, W8-12).
 * Browser/iPhone: Hinweis „nur in der Android-App“; im Testmodus eine Beispiel-Uhr.
 */
export default function SmartwatchScreen() {
  const router = useRouter();
  const app = useApp();
  const { state, reload } = useWearables();
  const mode = app.backend.mode;
  const driver = useMemo(() => wearableDriver(mode), [mode]);
  const [availability, setAvailability] = useState<HcAvailability | null>(null);
  const [busy, setBusy] = useState<'consent' | 'connect' | 'sync' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [dialog, setDialog] = useState(false);
  const [dialogError, setDialogError] = useState<string>();

  useEffect(() => {
    let active = true;
    driver
      .availability()
      .then((value) => active && setAvailability(value))
      .catch(() => active && setAvailability('unsupported'));
    return () => {
      active = false;
    };
  }, [driver]);

  if (app.status.kind === 'loading' || state.kind === 'loading' || availability === null) {
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
  if (route !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={route as Href} />;
  }
  const rows = app.rows;
  const records = consentRecordsFromRows(rows.consents);
  const healthValid = hasValidConsent(records, 'health_data', app.versions.health_data);
  const wearableValid = wearableConsentsValid(app);
  const loaded = state.kind === 'ready' ? state.result : null;
  const connection = loaded?.rows.connection ?? null;
  const back = (
    <Button
      label={t.settings.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings' as Href))}
    />
  );

  async function grantConsent() {
    setBusy('consent');
    setMessage(null);
    try {
      await app.grantConsents(['wearable_data']);
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy('connect');
    setMessage(null);
    try {
      const granted: WearableDataType[] = await driver.requestPermissions();
      await app.backend.wearables.connect(granted);
      forgetWearables();
      await reload();
      if (granted.length === 0) {
        setMessage({ text: W.permissionMissing, tone: 'warning' });
        return;
      }
      setMessage(syncMessage(await syncWearables(app, { auto: false })));
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy('sync');
    setMessage(null);
    try {
      setMessage(syncMessage(await syncWearables(app, { auto: false })));
    } catch {
      setMessage({ text: W.syncFailed, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(deleteImported: boolean) {
    setBusy('disconnect');
    setDialogError(undefined);
    try {
      const deleted = await app.backend.wearables.disconnect(deleteImported);
      forgetWearables();
      await Promise.all([app.reload(), reload()]);
      setDialog(false);
      setMessage({
        text: `${deleteImported ? W.disconnectedDelete(deleted) : W.disconnectedKeep} ${
          driver.kind === 'native' ? W.disconnectHintHc : ''
        }`.trim(),
        tone: 'success',
      });
    } catch (error) {
      setDialogError(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  const unsupported = driver.kind === 'none';
  const dailyLines = recentDailyLines(loaded?.rows.dailyMetrics ?? [], todayIso());
  const daily = (
    <>
      <Heading level={2}>{W.dailyTitle}</Heading>
      <Card>
        {dailyLines.length === 0 ? (
          <Body muted>{W.dailyEmpty}</Body>
        ) : (
          dailyLines.map((line) => (
            <Body key={line.day} testID="wearable-daily-line">
              {line.text}
            </Body>
          ))
        )}
      </Card>
    </>
  );

  return (
    <Screen area="training" icon="settings" title={W.title} footer={back} testID="smartwatch">
      {message ? (
        <Notice tone={message.tone} testID="smartwatch-message">
          {message.text}
        </Notice>
      ) : null}
      {loaded?.offline ? <Notice tone="info">{W.offline}</Notice> : null}
      {loaded && loaded.pending > 0 ? (
        <Notice tone="info">{W.pending(loaded.pending)}</Notice>
      ) : null}

      {connection ? (
        <>
          <Card>
            <Heading level={2}>{W.statusTitle}</Heading>
            <Body testID="smartwatch-connected">
              {W.connectedSince(formatTimestampDe(connection.connected_at))}
            </Body>
            <Body muted testID="smartwatch-last-sync">
              {connection.last_sync_at
                ? W.lastSync(dateTimeText(connection.last_sync_at))
                : W.neverSynced}
            </Body>
            {connection.last_sync_count !== null ? (
              <Body muted>{W.lastCount(connection.last_sync_count)}</Body>
            ) : null}
          </Card>
          {connection.status === 'permission_missing' ? (
            <Notice
              tone="warning"
              title={W.permissionMissingTitle}
              testID="smartwatch-permission-missing"
            >
              {W.permissionMissing}
            </Notice>
          ) : null}
          <Card>
            <Heading level={2}>{W.grantedTitle}</Heading>
            {WEARABLE_DATA_TYPES.map((type) => (
              <Body key={type} muted={!connection.granted_types.includes(type)}>
                {connection.granted_types.includes(type)
                  ? `✓ ${W.types[type]}`
                  : `– ${W.types[type]} (${W.notGranted})`}
              </Body>
            ))}
          </Card>
          {unsupported ? (
            <Notice tone="info" title={W.onlyAndroidTitle} testID="smartwatch-only-android">
              {W.onlyAndroid}
            </Notice>
          ) : (
            <View style={styles.actions}>
              {!wearableValid ? (
                <Notice tone="warning">{healthValid ? W.consentText : W.needsHealthConsent}</Notice>
              ) : null}
              <Button
                label={busy === 'sync' ? W.syncing : W.syncNow}
                loading={busy === 'sync'}
                disabled={busy !== null || !wearableValid}
                onPress={() => void syncNow()}
                testID="smartwatch-sync"
              />
              {connection.status === 'permission_missing' || driver.kind === 'native' ? (
                <Button
                  label={W.openPermissions}
                  variant="secondary"
                  onPress={() => driver.openSettings()}
                />
              ) : null}
            </View>
          )}
          {/* Schrittziel für die Kachel „Schritte“ auf der Übersicht (22.10.2026). */}
          <StepGoalCard />
          {daily}
          <Button
            label={W.disconnect}
            variant="danger"
            onPress={() => {
              setDialogError(undefined);
              setDialog(true);
            }}
            testID="smartwatch-disconnect"
          />
        </>
      ) : (
        <>
          <Body>{W.intro}</Body>
          <Card>
            <Heading level={2}>{W.whatTitle}</Heading>
            {W.whatList.map((line) => (
              <Body key={line}>{`• ${line}`}</Body>
            ))}
          </Card>
          <Card>
            <Heading level={2}>{W.notTitle}</Heading>
            {W.notList.map((line) => (
              <Body key={line}>{`• ${line}`}</Body>
            ))}
          </Card>
          {unsupported ? (
            <Notice tone="info" title={W.onlyAndroidTitle} testID="smartwatch-only-android">
              {W.onlyAndroid}
            </Notice>
          ) : availability === 'not_installed' || availability === 'update_required' ? (
            <>
              <Notice tone="warning" title={W.installTitle} testID="smartwatch-install">
                {W.installText}
              </Notice>
              <Button label={W.install} onPress={() => driver.openInstall()} />
            </>
          ) : !healthValid ? (
            <>
              <Notice tone="warning" testID="smartwatch-needs-health">
                {W.needsHealthConsent}
              </Notice>
              <Button
                label={t.settings.consents}
                variant="secondary"
                onPress={() => router.push('/einwilligungen' as Href)}
              />
            </>
          ) : !wearableValid ? (
            <>
              {driver.kind === 'demo' ? (
                <Notice tone="info" title={W.demoTitle}>
                  {W.demoText}
                </Notice>
              ) : null}
              <Notice tone="info" title={W.consentTitle} testID="smartwatch-consent">
                {W.consentText}
              </Notice>
              <Button
                label={W.consentRead}
                variant="link"
                onPress={() => router.push('/consent/wearable_data' as Href)}
              />
              <Button
                label={W.consentAccept}
                loading={busy === 'consent'}
                onPress={() => void grantConsent()}
                testID="smartwatch-consent-accept"
              />
            </>
          ) : (
            <>
              {driver.kind === 'demo' ? (
                <Notice tone="info" title={W.demoTitle}>
                  {W.demoText}
                </Notice>
              ) : null}
              <Body muted>{W.connectHint}</Body>
              <Button
                label={driver.kind === 'demo' ? W.demoConnect : W.connect}
                loading={busy === 'connect'}
                onPress={() => void connect()}
                testID="smartwatch-connect"
              />
            </>
          )}
          {(loaded?.rows.dailyMetrics.length ?? 0) > 0 ? daily : null}
        </>
      )}

      <ConfirmDialog
        visible={dialog}
        title={W.disconnectTitle}
        message={W.disconnectText}
        confirmLabel={W.disconnectDelete}
        alternative={{
          label: W.disconnectKeep,
          variant: 'secondary',
          onPress: () => void disconnect(false),
        }}
        loading={busy === 'disconnect'}
        error={dialogError}
        onConfirm={() => void disconnect(true)}
        onCancel={() => setDialog(false)}
        testID="smartwatch-disconnect-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
});
