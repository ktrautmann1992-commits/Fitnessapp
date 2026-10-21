import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CycleSetupForm } from '@/components/cycle';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Checkbox, Heading, LoadingState, Notice } from '@/components/ui';
import { hasActiveCycleConsent } from '@/data/cycle-backend';
import { deCycle as C } from '@/i18n/de-cycle';
import { cycleErrorText } from '@/lib/cycle-format';
import { useApp } from '@/state/app-state';
import { forgetCycle, useCycle } from '@/state/use-cycle';

type Dialog = 'delete_all' | 'end' | null;

/**
 * Einstellungen des Zyklus-Moduls (Plan 9.1 Nr. 7, 7.5): Status ändern, Pausieren/Fortsetzen, Alle Einträge löschen,
 * Modul beenden (= Widerruf cycle_data, löscht alles auf Server und Gerät), Hinweis auf den Datenexport. Bleibt
 * erreichbar, solange Einwilligung oder Daten bestehen – auch nach Wechsel auf „männlich“ (S8). Testmodus:
 * Beispieldaten und „Warnungen aus“.
 */
export default function CycleSettingsScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useCycle();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [editStatus, setEditStatus] = useState(false);

  if (app.status.kind === 'loading' || view.load.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows) return <Redirect href="/" />;

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

  async function confirm() {
    setBusy(true);
    setDialogError(undefined);
    try {
      if (dialog === 'delete_all') {
        await view.cycle?.deleteAllEntries();
        forgetCycle();
        setMessage({ tone: 'success', text: C.settings.deletedAll });
      } else if (dialog === 'end') {
        // Widerruf: Server-Trigger löscht alles; attachCycle leert die Gerätespeicher.
        await app.revokeConsent('cycle_data');
        forgetCycle();
        setMessage({ tone: 'success', text: C.settings.ended });
      }
      setDialog(null);
    } catch (error) {
      setDialogError(cycleErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  const consentActive = hasActiveCycleConsent(app.rows.consents);
  const canWrite = view.consentGrantedAt !== null;
  const outdated = consentActive && !canWrite;
  const settings = view.settings;
  const local = view.cycle?.mode === 'local';
  const testMode = view.cycle?.testMode;

  return (
    <Screen title={C.settings.title} area="zyklus" icon="settings" testID="cycle-settings">
      {message ? (
        <Notice tone={message.tone} testID="cycle-settings-message">
          {message.text}
        </Notice>
      ) : null}
      {outdated ? (
        <Notice tone="warning">
          <Body>{C.settings.reconsentHint}</Body>
          <Button
            label={C.settings.reconsent}
            variant="secondary"
            onPress={() =>
              run(async () => {
                await app.grantConsents(['cycle_data']);
                forgetCycle();
              })
            }
          />
        </Notice>
      ) : null}

      {canWrite && settings ? (
        <View style={styles.stack}>
          {editStatus ? (
            <CycleSetupForm
              initialStatus={settings.status}
              initialSleep={settings.sleepTracking}
              askLastPeriod={false}
              busy={busy}
              onSave={(value) =>
                run(async () => {
                  await view.saveSettings({
                    status: value.status,
                    sleepTracking: value.sleepTracking,
                  });
                  setEditStatus(false);
                })
              }
            />
          ) : (
            <Button
              label={C.settings.status}
              variant="secondary"
              onPress={() => setEditStatus(true)}
              testID="cycle-change-status"
            />
          )}
          <Button
            label={settings.paused ? C.settings.resume : C.settings.pause}
            variant="secondary"
            loading={busy}
            onPress={() => run(() => view.saveSettings({ paused: !settings.paused }))}
            testID="cycle-toggle-pause"
          />
        </View>
      ) : null}

      <Body muted>{C.settings.export}</Body>
      <Button
        label={C.settings.deleteAll}
        variant="danger"
        onPress={() => setDialog('delete_all')}
        disabled={view.entries.length === 0}
        testID="cycle-delete-all"
      />
      {consentActive ? (
        <Button
          label={C.settings.end}
          variant="danger"
          onPress={() => setDialog('end')}
          testID="cycle-end"
        />
      ) : null}

      {local && testMode ? (
        <Card>
          <View style={styles.stack} testID="cycle-test-mode">
            <Heading level={2}>{C.settings.testMode}</Heading>
            <Body muted>{C.settings.testModeNotice}</Body>
            <Button
              label={C.settings.sample}
              variant="secondary"
              disabled={!canWrite}
              onPress={() =>
                run(async () => {
                  await testMode.loadSampleData(view.today);
                  forgetCycle();
                }, C.settings.sampleLoaded)
              }
              testID="cycle-sample-data"
            />
            <Checkbox
              label={C.settings.warningsOff}
              checked={view.load.kind === 'ready' && !view.load.access.warnings}
              onChange={(off) =>
                void run(async () => {
                  await testMode.setWarningsOff(off);
                  forgetCycle();
                })
              }
              testID="cycle-warnings-off"
            />
          </View>
        </Card>
      ) : null}

      <Button label={C.title} variant="link" onPress={() => router.push('/zyklus' as Href)} />

      <ConfirmDialog
        visible={dialog === 'delete_all'}
        title={C.settings.deleteAllTitle}
        message={C.settings.deleteAllMessage}
        confirmLabel={C.settings.deleteAll}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID="cycle-delete-all-dialog"
      />
      <ConfirmDialog
        visible={dialog === 'end'}
        title={C.settings.endTitle}
        message={C.settings.endMessage}
        notes={C.settings.endNotes}
        confirmLabel={C.settings.end}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID="cycle-end-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
