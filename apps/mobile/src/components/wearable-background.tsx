import { backgroundAccessOffer, type WearableConnectionRow } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import type { HealthConnectDriver } from '@/lib/health-connect-driver.types';
import { updateWearableBackgroundSync, type WearableSyncContext } from '@/state/use-wearables';

const B = t.wearables.background;

/**
 * Smartwatch-Seite: Karte „Im Hintergrund aktualisieren“ (Gründer-Freigabe 30.10.2026, docs/PLAN-PHASE-8.md 13.6).
 * Erklärt, was im Hintergrund passiert und wer den Takt bestimmt (Android), und fragt erst auf Tipp das
 * Health-Connect-Recht „Daten im Hintergrund lesen“ an. Erteilt → Aufgabe anmelden; abgelehnt → Hinweis, Vordergrund
 * bleibt. Ob die Karte erscheint, entscheidet packages/core (backgroundAccessOffer). Keine Werte.
 */
export function WearableBackgroundCard({
  app,
  driver,
  connection,
  consentsValid,
}: {
  app: WearableSyncContext;
  driver: HealthConnectDriver;
  connection: Pick<WearableConnectionRow, 'status' | 'granted_types'> | null;
  consentsValid: boolean;
}) {
  const [access, setAccess] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    driver
      .backgroundAccess()
      .then((value) => active && setAccess(value))
      .catch(() => active && setAccess(false));
    return () => {
      active = false;
    };
  }, [driver, connection]);

  if (access === null) return null;
  const offer = backgroundAccessOffer({
    driverKind: driver.kind,
    signedIn: app.session !== null,
    consentsValid,
    connection,
    backgroundAccess: access,
  });
  if (offer === 'hidden') return null;

  async function allow() {
    setBusy(true);
    setDenied(false);
    try {
      const granted = await driver.requestBackgroundAccess();
      setAccess(granted);
      setDenied(!granted);
      await updateWearableBackgroundSync(app).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const demo = driver.kind === 'demo';
  return (
    <Card>
      <View style={styles.body} testID="smartwatch-background">
        <Heading level={2}>{B.title}</Heading>
        {offer === 'active' ? (
          <>
            <Body testID="smartwatch-background-active">{demo ? B.demoActive : B.active}</Body>
            {demo ? null : (
              <Button
                label={B.change}
                variant="secondary"
                onPress={() => driver.openSettings()}
                testID="smartwatch-background-change"
              />
            )}
          </>
        ) : (
          <>
            <Body>{B.intro}</Body>
            {B.how.map((line) => (
              <Body key={line} muted>{`• ${line}`}</Body>
            ))}
            {denied ? (
              <Notice tone="info" testID="smartwatch-background-denied">
                {B.denied}
              </Notice>
            ) : null}
            <Button
              label={demo ? B.demoAllow : B.allow}
              variant="secondary"
              loading={busy}
              disabled={busy}
              onPress={() => void allow()}
              testID="smartwatch-background-allow"
            />
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
