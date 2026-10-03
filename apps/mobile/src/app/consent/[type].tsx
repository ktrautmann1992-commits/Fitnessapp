import { consentTypeSchema } from '@fitnessapp/core';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

/** Volltext einer Einwilligung (Link „Text lesen“). */
export default function ConsentTextScreen() {
  const router = useRouter();
  const { documents, status } = useApp();
  const { type } = useLocalSearchParams<{ type: string }>();
  const parsed = consentTypeSchema.safeParse(type);
  const doc = parsed.success ? documents.find((d) => d.type === parsed.data) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  return (
    <Screen
      title={doc?.title ?? t.consentText.title}
      footer={<Button label={t.common.close} variant="secondary" onPress={close} />}
    >
      {doc ? (
        <>
          <Body muted>{t.baseConsents.version(doc.version)}</Body>
          <Body>{doc.body}</Body>
        </>
      ) : (
        <Notice tone="warning">{t.consentText.notFound}</Notice>
      )}
    </Screen>
  );
}
