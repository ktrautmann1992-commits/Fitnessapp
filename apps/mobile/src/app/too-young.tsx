import { useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { Body, Button, Notice } from '@/components/ui';
import { t } from '@/i18n';

/** Freundlicher Stopp unter 16 Jahren. Es wurde nichts gespeichert. */
export default function TooYoungScreen() {
  const router = useRouter();
  return (
    <Screen
      title={t.tooYoung.title}
      testID="too-young"
      footer={<Button label={t.tooYoung.back} onPress={() => router.replace('/welcome')} />}
    >
      <Notice tone="info">{t.tooYoung.text}</Notice>
      <Body muted>{t.tooYoung.tip}</Body>
    </Screen>
  );
}
