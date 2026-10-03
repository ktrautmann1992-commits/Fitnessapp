import { APP_NAME, APP_TAGLINE } from '@fitnessapp/ui';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

export default function WelcomeScreen() {
  const router = useRouter();
  const { backend } = useApp();
  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <Button label={t.welcome.start} onPress={() => router.push('/age')} />
          {backend.mode === 'supabase' ? (
            <Button
              label={t.welcome.haveAccount}
              variant="link"
              onPress={() => router.push('/account?login=1')}
            />
          ) : null}
        </View>
      }
    >
      <Heading>{APP_NAME}</Heading>
      <Body muted>{APP_TAGLINE}</Body>
      <Heading level={2}>{t.welcome.title}</Heading>
      <Body>{t.welcome.intro}</Body>
      {t.welcome.features.map((feature) => (
        <Card key={feature.title}>
          <Heading level={2}>{feature.title}</Heading>
          <Body muted>{feature.text}</Body>
        </Card>
      ))}
      <Body muted>{t.welcome.minAgeNote}</Body>
    </Screen>
  );
}
