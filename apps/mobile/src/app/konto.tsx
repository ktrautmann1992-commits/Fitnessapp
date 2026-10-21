import { dataExportFileName, dataExportJson } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { ListGroup, ListRow, SectionLabel } from '@/components/design';
import { Body, Button, Card, LoadingState, Notice } from '@/components/ui';
import { BackendError } from '@/data/backend';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import { SAVE_TARGET, saveTextFile } from '@/lib/save-file';
import { singleFlight } from '@/lib/single-flight';
import { useApp } from '@/state/app-state';

type DialogKind = 'signout_confirm' | 'signout' | 'export' | 'delete' | null;

/**
 * Mein Konto (docs/PLAN-DASHBOARD.md 2.3, Gründer-Wahl vom 18.10.2026): angemeldete E-Mail, Abmelden mit Rückfrage,
 * Einwilligungen, Datenexport, Konto löschen, Lizenzen. Nutzt die vorhandenen Funktionen (vorher in den
 * Einstellungen) – nichts davon ist neu erfunden. E-Mail ändern ist vorgemerkt (Abschnitt 5).
 */
export default function AccountSettingsScreen() {
  const router = useRouter();
  const app = useApp();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [exportMessage, setExportMessage] = useState<{ tone: 'success' | 'info'; text: string }>();
  /** Abmelden mit Wartendem (R6): Zahl der noch nicht übertragenen Trainings bzw. Entwürfe. */
  const [pendingCount, setPendingCount] = useState(0);
  const [stillPending, setStillPending] = useState(false);
  const { exportData } = app;
  // Export holen und speichern – ein zweiter Tipp währenddessen startet keinen zweiten Export (Wächter D K2).
  const runExport = useMemo(
    () =>
      singleFlight(async () => {
        const file = await exportData();
        return saveTextFile(dataExportFileName(todayIso()), dataExportJson(file));
      }),
    [exportData],
  );

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
  const session = app.session;
  const testMode = app.backend.mode === 'local';
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/mehr' as Href));

  /** Abmelden (R6): Wartet noch etwas, kommt die vorhandene Nachfrage „Jetzt senden“ / „Trotzdem abmelden“. */
  async function signOut(force = false) {
    setBusy(true);
    setDialogError(undefined);
    try {
      const result = await app.signOut(force);
      if (result.kind === 'pending') {
        setPendingCount(result.count);
        setStillPending(false);
        setDialog('signout');
        return;
      }
      setDialog(null);
      router.replace('/welcome');
    } catch (caught) {
      setDialog(null);
      setMessage(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (dialog === 'signout_confirm') {
      await signOut();
      return;
    }
    setBusy(true);
    setDialogError(undefined);
    try {
      if (dialog === 'signout') {
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
      } else if (dialog === 'export') {
        // Datenexport (3.7): nur online; die Datei geht direkt in Download-Ordner bzw. den gewählten Ordner –
        // kein Teilen-Dialog, keine Zwischen-Datei, nichts davon in Logs.
        const result = await runExport();
        setExportMessage(
          result === 'saved'
            ? {
                tone: 'success',
                text:
                  SAVE_TARGET === 'download'
                    ? t.settings.exportSavedWeb
                    : t.settings.exportSavedNative,
              }
            : { tone: 'info', text: t.settings.exportCancelled },
        );
        setDialog(null);
      }
    } catch (caught) {
      setDialogError(
        dialog === 'export' && !(caught instanceof BackendError)
          ? t.settings.exportFailed
          : errorText(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  const dialogTexts =
    dialog === 'signout_confirm'
      ? {
          title: t.konto.signOutTitle,
          text: testMode ? t.konto.signOutTestText : t.konto.signOutText,
          confirm: t.konto.signOutConfirm,
        }
      : dialog === 'signout'
        ? {
            title: t.settings.signOutPendingTitle,
            text: stillPending
              ? `${t.settings.signOutPending(pendingCount)} ${t.settings.signOutStillPending}`
              : t.settings.signOutPending(pendingCount),
            confirm: t.settings.signOutSendNow,
          }
        : dialog === 'export'
          ? {
              title: t.settings.exportDialogTitle,
              text: t.settings.exportDialogText,
              confirm:
                SAVE_TARGET === 'download'
                  ? t.settings.exportConfirmWeb
                  : t.settings.exportConfirmNative,
            }
          : {
              title: t.settings.deleteTitle,
              text: t.settings.deleteText,
              confirm: t.settings.deleteConfirm,
            };

  return (
    <Screen
      area="training"
      icon="user"
      title={t.konto.title}
      testID="konto"
      footer={<Button label={t.konto.back} variant="secondary" onPress={goBack} />}
    >
      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Card>
        {testMode ? (
          <Body testID="konto-test-mode">{t.konto.testMode}</Body>
        ) : (
          <View style={styles.email}>
            <Body muted>{t.konto.signedInAs}</Body>
            <Body testID="konto-email">{session.email ?? t.konto.noEmail}</Body>
          </View>
        )}
      </Card>
      <ListGroup>
        <ListRow
          icon="logout"
          label={t.konto.signOut}
          role="button"
          onPress={() => {
            setDialogError(undefined);
            setDialog('signout_confirm');
          }}
          disabled={busy}
          testID="konto-signout"
          last
        />
      </ListGroup>

      <SectionLabel>{t.konto.privacy}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="shield"
          label={t.konto.consents}
          accessibilityHint={t.konto.consentsHint}
          onPress={() => router.push('/einwilligungen' as Href)}
          testID="konto-consents"
        />
        <ListRow
          icon="info"
          label={t.konto.licenses}
          onPress={() => router.push('/lizenzen' as Href)}
          testID="konto-licenses"
          last
        />
      </ListGroup>

      <SectionLabel>{t.settings.exportTitle}</SectionLabel>
      <Body muted>{t.settings.exportText}</Body>
      {testMode ? <Body muted>{t.settings.exportTestMode}</Body> : null}
      <Body muted>{t.settings.exportDeviceOnly}</Body>
      {app.offline ? <Body muted>{t.errors.onlineOnly}</Body> : null}
      {exportMessage ? (
        <Notice tone={exportMessage.tone} testID="settings-export-message">
          {exportMessage.text}
        </Notice>
      ) : null}
      <ListGroup>
        <ListRow
          icon="download"
          label={t.settings.exportButton}
          role="button"
          onPress={() => {
            setDialogError(undefined);
            setExportMessage(undefined);
            setDialog('export');
          }}
          testID="settings-export"
          last
        />
      </ListGroup>

      {/* Destruktiv: rot, abgesetzt am Ende und immer mit Rückfrage. */}
      <View style={styles.danger}>
        <SectionLabel>{t.settings.deleteAccount}</SectionLabel>
        <ListGroup>
          <ListRow
            icon="trash"
            label={t.settings.deleteAccount}
            role="button"
            tone="danger"
            onPress={() => {
              setDialogError(undefined);
              setDialog('delete');
            }}
            testID="konto-delete"
            last
          />
        </ListGroup>
      </View>

      <ConfirmDialog
        visible={dialog !== null}
        title={dialogTexts.title}
        message={dialogTexts.text}
        confirmLabel={dialogTexts.confirm}
        confirmVariant={
          dialog === 'signout' || dialog === 'export' || dialog === 'signout_confirm'
            ? 'primary'
            : 'danger'
        }
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID={dialog ? `dialog-${dialog}` : undefined}
        {...(dialog === 'export'
          ? {
              // Hinweis vor dem Herunterladen (W9) plus wohin die Datei geht und was noch fehlt.
              notes: [
                SAVE_TARGET === 'download'
                  ? t.settings.exportWhereWeb
                  : t.settings.exportWhereNative,
                ...(app.pendingLogSessionIds.length > 0
                  ? [t.settings.exportPending(app.pendingLogSessionIds.length)]
                  : []),
                // N7 Teil 2: wartende Tagebuch-Einträge/eigene Gerichte stehen erst nach dem Senden in der Datei.
                ...(app.nutritionSync.queued + app.nutritionSync.rejected > 0
                  ? [
                      t.settings.exportPendingNutrition(
                        app.nutritionSync.queued + app.nutritionSync.rejected,
                      ),
                    ]
                  : []),
              ],
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

const styles = StyleSheet.create({
  email: { gap: 2 },
  danger: { marginTop: 16, gap: 12 },
});
