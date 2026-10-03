import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { Body, Button, Notice, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { useApp } from '@/state/app-state';

const emailSchema = z.email();
const codeSchema = z.string().regex(/^\d{6}$/);

/** Schritt C: Konto – Testmodus-Start oder Login per 6-stelligem E-Mail-Code. */
export default function AccountScreen() {
  const router = useRouter();
  const app = useApp();
  const { login } = useLocalSearchParams<{ login?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

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
      const trimmed = email.trim().toLowerCase();
      if (!emailSchema.safeParse(trimmed).success) {
        setError(t.account.emailInvalid);
        return;
      }
      await requestCode(trimmed);
      setCodeSentTo(trimmed);
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
      intro={t.account.intro}
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
          <Button label={t.account.resend} variant="link" onPress={() => void sendCode()} />
          <Button
            label={t.account.otherEmail}
            variant="link"
            onPress={() => {
              setCodeSentTo(null);
              setCode('');
              setError(undefined);
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
      <Body muted>{t.account.laterProviders}</Body>
    </Screen>
  );
}
