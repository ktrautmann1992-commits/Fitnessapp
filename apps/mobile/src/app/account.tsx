import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { BackendError } from '@/data/backend';
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
  /** Text der Ansage für Bildschirmleser – wechselt nur bei 30, 10 und 0 s (Wächter M2). */
  const [announcement, setAnnouncement] = useState('');
  const counting = sentAt !== null && secondsLeft > 0;
  useEffect(() => {
    // Uhr nur, solange die Sperre läuft (Wächter N3).
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);
  useEffect(() => {
    if (sentAt === null || !announceCountdown(secondsLeft)) return;
    const text = secondsLeft === 0 ? t.account.resend : t.account.resendInA11y(secondsLeft);
    // Browser/Android: Live-Region (aria-live="polite"); iPhone-App: Ansage über VoiceOver.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ansage nur bei groben Schritten
    setAnnouncement(text);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
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
      try {
        await requestCode(trimmed);
      } catch (caught) {
        // Zu viele Versuche (429): ebenfalls 60 s sperren, damit niemand weiter ins Limit tippt (Wächter N4).
        if (caught instanceof BackendError && caught.code === 'rate_limited') {
          const at = Date.now();
          setSentAt(at);
          setNow(at);
        }
        throw caught;
      }
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
            <Button
              label={secondsLeft > 0 ? t.account.sendCodeIn(secondsLeft) : t.account.sendCode}
              onPress={() => void sendCode()}
              loading={busy}
              disabled={secondsLeft > 0}
              testID="account-send"
            />
          )}
          <Button label={t.common.back} variant="secondary" onPress={goBack} disabled={busy} />
        </View>
      }
    >
      <Text
        aria-live="polite"
        accessibilityLiveRegion="polite"
        style={styles.liveRegion}
        testID="account-countdown-live"
      >
        {announcement}
      </Text>
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

const styles = StyleSheet.create({
  // Nur für Bildschirmleser (sichtbar wäre es doppelt zum Knopf „Code erneut senden (in … s)“).
  liveRegion: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
