import { useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { Button } from '@/components/ui';
import { t } from '@/i18n';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen title={t.notFound.title}>
      <Button label={t.common.toStart} onPress={() => router.replace('/')} />
    </Screen>
  );
}
