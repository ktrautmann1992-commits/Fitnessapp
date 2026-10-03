import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { summaryLines } from '@/lib/summary';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';

/** Bildschirm E: Fertig – Zusammenfassung, Plan kommt in Phase 3. */
export default function DoneScreen() {
  const router = useRouter();
  const app = useApp();
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
  const lines = summaryLines(app.answers, healthConsentStatus(app.rows, app.versions) === 'valid');
  return (
    <Screen
      title={t.done.title}
      testID="done"
      footer={<Button label={t.common.toStart} onPress={() => router.replace('/today')} />}
    >
      <Notice tone="success">{t.done.preparing}</Notice>
      <Heading level={2}>{t.done.summary}</Heading>
      <Card>
        {lines.map((line) => (
          <View key={line.label} style={{ gap: 2 }}>
            <Body muted>{line.label}</Body>
            <Body>{line.value}</Body>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
