import { Redirect, useRouter, type Href } from 'expo-router';

import { ConsentSettings } from '@/components/consent-settings';
import { Screen } from '@/components/screen';
import { Button, LoadingState } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

/** Einwilligungen aus „Mein Konto“ (docs/PLAN-DASHBOARD.md 2.3) – derselbe Block wie in den Einstellungen. */
export default function ConsentsOverviewScreen() {
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
  return (
    <Screen
      area="training"
      icon="info"
      title={t.consentsPage.title}
      testID="consents-page"
      footer={
        <Button
          label={t.consentsPage.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/konto' as Href))}
        />
      }
    >
      <ConsentSettings rows={app.rows} showHeading={false} />
    </Screen>
  );
}
