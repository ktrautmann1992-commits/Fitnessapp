import { activeConsentVersion, type ConsentType } from '@fitnessapp/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import { Body, Button, Card, Checkbox, Heading, Notice } from '@/components/ui';
import { consentRecordsFromRows } from '@/data/mapping';
import type { ConsentRow, UserRows } from '@/data/types';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatTimestampDe } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';
import { forgetWearables } from '@/state/use-wearables';

/**
 * Einwilligungen ansehen, erteilen und widerrufen – in den Einstellungen und unter „Mein Konto“ → „Einwilligungen“
 * (docs/PLAN-DASHBOARD.md 2.3). Aus settings.tsx ausgelagert, damit beide Stellen denselben Ablauf nutzen
 * (Widerruf health_data mit Wahl S1/R3 und Umwandlung der Unverträglichkeiten 7.4; Foto-Einwilligung E3).
 */

const LISTED_CONSENTS = [
  'terms',
  'privacy',
  'health_data',
] as const satisfies readonly ConsentType[];

export function consentLine(rows: readonly ConsentRow[], type: ConsentType): string {
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

export function ConsentSettings({
  rows,
  showHeading = true,
}: {
  rows: UserRows;
  showHeading?: boolean;
}) {
  const router = useRouter();
  const app = useApp();
  const [dialog, setDialog] = useState<'revoke' | 'revoke_photo' | 'revoke_wearable' | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<string>();
  /**
   * Widerruf (docs/PLAN-PHASE-5.md 7.4): aktive Wahl „stattdessen unter ‚mag ich nicht‘ ausschließen?“ – nie
   * vorausgewählt (R2-K4: ohne Zustimmung wird nichts eingelesen und nichts behalten).
   */
  const [convertIntolerances, setConvertIntolerances] = useState(false);
  const healthStatus = healthConsentStatus(rows, app.versions);
  const records = consentRecordsFromRows(rows.consents);
  const hasIntolerances = rows.foodPreferences.some((p) => p.kind === 'intolerance');

  async function confirm() {
    setBusy(true);
    setDialogError(undefined);
    try {
      if (dialog === 'revoke_wearable') {
        // Phase 8: Puls, Tageswerte und Verbindung werden gelöscht; übernommene Einheiten bleiben.
        await app.revokeConsent('wearable_data');
        forgetWearables();
        setMessage(t.wearables.revokeDone);
        setDialog(null);
      } else if (dialog === 'revoke_photo') {
        // Etappe E3: nur die Foto-Einwilligung; Tagebuch-Einträge bleiben (gehören zu health_data).
        await app.revokeConsent('ai_food_photo');
        setMessage(t.foodPhoto.revokeDone);
        setDialog(null);
      } else if (dialog === 'revoke') {
        // „Tagebuch behalten (empfohlen)“ – Vorgaben aus Gesundheits-Plänen werden neutralisiert (S1, R3).
        const convert = hasIntolerances && convertIntolerances;
        await app.revokeHealthData(false, convert);
        setMessage(
          convert
            ? `${t.settings.revokeDone} ${t.nutrition.revoke.converted}`
            : t.settings.revokeDone,
        );
        setDialog(null);
      }
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function revokeDeletingLogs() {
    setBusy(true);
    setDialogError(undefined);
    try {
      const convert = hasIntolerances && convertIntolerances;
      await app.revokeHealthData(true, convert);
      setMessage(
        convert
          ? `${t.settings.revokeDone} ${t.nutrition.revoke.converted}`
          : t.settings.revokeDone,
      );
      setDialog(null);
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showHeading ? <Heading level={2}>{t.settings.consents}</Heading> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
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
                    // Jedes Mal neu und nicht vorausgewählt (7.4, aktive Wahl).
                    setConvertIntolerances(false);
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
      {/* Etappe E3: eigene, getrennte Einwilligung „Gerichte per Foto auswerten“ (Widerruf jederzeit). */}
      <Card>
        <Body>{t.consentTypes.ai_food_photo}</Body>
        <Body muted testID="settings-photo-consent">
          {consentLine(rows.consents, 'ai_food_photo')}
        </Body>
        {activeConsentVersion(records, 'ai_food_photo') !== null ? (
          <Button
            label={t.settings.revoke}
            variant="danger"
            accessibilityLabel={`${t.consentTypes.ai_food_photo}: ${t.settings.revoke}`}
            onPress={() => {
              setDialogError(undefined);
              setDialog('revoke_photo');
            }}
            testID="settings-photo-revoke"
          />
        ) : (
          <Body muted>{t.foodPhoto.settingsNote}</Body>
        )}
      </Card>
      {/* Phase 8: eigene, getrennte Einwilligung „Smartwatch-Daten“ (Widerruf jederzeit). */}
      {activeConsentVersion(records, 'wearable_data') !== null ||
      rows.consents.some((c) => c.consent_type === 'wearable_data') ? (
        <Card>
          <Body>{t.consentTypes.wearable_data}</Body>
          <Body muted testID="settings-wearable-consent">
            {consentLine(rows.consents, 'wearable_data')}
          </Body>
          {activeConsentVersion(records, 'wearable_data') !== null ? (
            <Button
              label={t.settings.revoke}
              variant="danger"
              accessibilityLabel={`${t.consentTypes.wearable_data}: ${t.settings.revoke}`}
              onPress={() => {
                setDialogError(undefined);
                setDialog('revoke_wearable');
              }}
              testID="settings-wearable-revoke"
            />
          ) : null}
        </Card>
      ) : null}
      <Body muted>{t.settings.baseConsentNote}</Body>

      <ConfirmDialog
        visible={dialog !== null}
        title={
          dialog === 'revoke_wearable'
            ? t.wearables.revokeTitle
            : dialog === 'revoke_photo'
              ? t.foodPhoto.revokeTitle
              : t.settings.revokeTitle
        }
        message={
          dialog === 'revoke_wearable'
            ? t.wearables.revokeText
            : dialog === 'revoke_photo'
              ? t.foodPhoto.revokeText
              : t.settings.revokeText
        }
        confirmLabel={
          dialog === 'revoke_wearable'
            ? t.wearables.revokeConfirm
            : dialog === 'revoke_photo'
              ? t.foodPhoto.revokeConfirm
              : t.settings.revokeKeepLogs
        }
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID={dialog ? `dialog-${dialog}` : undefined}
        {...(dialog === 'revoke'
          ? {
              // Wahl aus S1 und Hinweise (H6, R3, K4); Ernährung: Unverträglichkeiten und Pläne (7.4, K10).
              notes: [
                t.nutrition.revoke.intolerances,
                t.settings.revokeLogs,
                t.settings.revokeOtherDevices,
                t.settings.revokeEarlier,
              ],
              children: hasIntolerances ? (
                <View style={{ gap: 4 }}>
                  <Checkbox
                    label={t.nutrition.revoke.convert}
                    checked={convertIntolerances}
                    onChange={setConvertIntolerances}
                    testID="revoke-convert"
                  />
                  <Body muted>{t.nutrition.revoke.convertHint}</Body>
                </View>
              ) : null,
              alternative: {
                label: t.settings.revokeDeleteLogs,
                variant: 'danger' as const,
                onPress: () => void revokeDeletingLogs(),
              },
            }
          : {})}
      />
    </>
  );
}
