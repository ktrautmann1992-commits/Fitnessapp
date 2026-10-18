import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { Body, Button, Notice, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { announceCountdown, resendSecondsLeft } from '@/lib/otp-cooldown';
import { useApp } from '@/state/app-state';

const emailSchema = z.email();
const codeSchema = z.string().regex(/^\d{6}$/);

/**
 * Schritt C: Konto – Testmodus-Start oder Login per 6-stelligem E-Mail-Code. Auch „Anmelden“ vom Startbildschirm
 * (`?login=1`, docs/PLAN-DASHBOARD.md 2.2): „Code erneut senden“ erst nach 60 s mit sichtbarem Countdown, Hinweis auf
 * den Spam-Ordner, verständliche Fehler (Rate-Limit, falscher/abgelaufener Code). Profil vorhanden → Übersicht.
 */
export default function AccountScreen() {
  const router = useRouter();
  const app = useApp();
  const { login } = useLocalSearchParams<{ login?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  /** Zeitpunkt des letzten gesendeten Codes (Sperre für „erneut senden“) und Uhr für den Countdown. */
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);
  const secondsLeft = resendSecondsLeft(sentAt, now);
  useEffect(() => {
    if (sentAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  useEffect(() => {
    // Bildschirmleser: nur grobe Schritte ansagen (nicht jede Sekunde).
    if (sentAt !== null && announceCountdown(secondsLeft)) {
      AccessibilityInfo.announceForAccessibility(
        secondsLeft === 0 ? t.account.resend : t.account.resendInA11y(secondsLeft),
      );
    }
  }, [secondsLeft, sentAt]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  if (app.backend.signIn.kind === 'test_mode') {
    const { start } = app.backend.signIn;
    return (
      <Screen
        title={t.account.testTitle}
        footer={
          <View style={{ gap: 8 }}>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button
              label={t.account.startTest}
              loading={busy}
              onPress={() =>
                void run(async () => {
                  const session = await start();
                  router.replace((await app.completeSignIn(session)) as Href);
                })
              }
            />
            <Button label={t.common.back} variant="secondary" onPress={goBack} disabled={busy} />
          </View>
        }
      >
        <Notice tone="warning" title={t.banner.testMode}>
          {t.account.testIntro}
        </Notice>
      </Screen>
    );
  }

  const { requestCode, verifyCode } = app.backend.signIn;
  const isLogin = login === '1';

  const sendCode = () =>
    run(async () => {
      const trimmed = (codeSentTo ?? email).trim().toLowerCase();
      if (!emailSchema.safeParse(trimmed).success) {
        setError(t.account.emailInvalid);
        return;
      }
      if (resendSecondsLeft(sentAt, Date.now()) > 0) return;
      const again = codeSentTo !== null;
      setResent(false);
      await requestCode(trimmed);
      const at = Date.now();
      setSentAt(at);
      setNow(at);
      setCodeSentTo(trimmed);
      setResent(again);
    });

  const verify = () =>
    run(async () => {
      if (!codeSentTo) {
        return;
      }
      if (!codeSchema.safeParse(code.trim()).success) {
        setError(t.account.codeInvalid);
        return;
      }
      const session = await verifyCode(codeSentTo, code.trim());
      router.replace((await app.completeSignIn(session)) as Href);
    });

  return (
    <Screen
      title={isLogin ? t.account.loginTitle : t.account.title}
      intro={isLogin ? t.account.loginIntro : t.account.intro}
      testID="account"
      footer={
        <View style={{ gap: 8 }}>
          {codeSentTo ? (
            <Button label={t.account.verify} onPress={() => void verify()} loading={busy} />
          ) : (
            <Button label={t.account.sendCode} onPress={() => void sendCode()} loading={busy} />
          )}
          <Button label={t.common.back} variant="secondary" onPress={goBack} disabled={busy} />
        </View>
      }
    >
      {codeSentTo ? (
        <>
          <Body>{t.account.codeSent(codeSentTo)}</Body>
          <TextField
            label={t.account.code}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            error={error}
            onSubmitEditing={() => void verify()}
          />
          <Body muted testID="account-spam-hint">
            {t.account.spamHint}
          </Body>
          {resent ? (
            <Notice tone="success" testID="account-resent">
              {t.account.resent}
            </Notice>
          ) : null}
          <Button
            label={secondsLeft > 0 ? t.account.resendIn(secondsLeft) : t.account.resend}
            accessibilityLabel={
              secondsLeft > 0 ? t.account.resendInA11y(secondsLeft) : t.account.resend
            }
            variant="link"
            disabled={secondsLeft > 0 || busy}
            onPress={() => void sendCode()}
            testID="account-resend"
          />
          <Button
            label={t.account.otherEmail}
            variant="link"
            disabled={busy}
            onPress={() => {
              setCodeSentTo(null);
              setCode('');
              setError(undefined);
              setResent(false);
              // Andere Adresse: eigene Sperre bei Supabase – hier wieder sofort senden.
              setSentAt(null);
            }}
          />
        </>
      ) : (
        <TextField
          label={t.account.email}
          value={email}
          onChangeText={setEmail}
          placeholder={t.account.emailPlaceholder}
          keyboardType="email-address"
          autoComplete="email"
          error={error}
          onSubmitEditing={() => void sendCode()}
        />
      )}
    </Screen>
  );
}
