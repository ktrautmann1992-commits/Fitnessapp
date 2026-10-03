import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, FieldError, LoadingState } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';
import { HealthConsentContent } from '@/steps/profile-steps';

/** Einwilligung Gesundheitsdaten nachträglich erteilen bzw. neu erteilen (neue Textversion). */
export default function HealthConsentScreen() {
  const router = useRouter();
  const app = useApp();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

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
  const status = healthConsentStatus(app.rows, app.versions);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  async function grant() {
    if (!checked) {
      setError(t.steps.healthConsent.missing);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await app.grantConsents(['health_data']);
      close();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={
        status === 'outdated' ? t.steps.healthConsent.reconsentTitle : t.steps.healthConsent.title
      }
      footer={
        <View style={{ gap: 8 }}>
          <FieldError message={error} />
          {status === 'valid' ? null : (
            <Button label={t.settings.grant} onPress={() => void grant()} loading={saving} />
          )}
          <Button label={t.common.back} variant="secondary" onPress={close} disabled={saving} />
        </View>
      }
    >
      <HealthConsentContent
        document={app.documents.find((d) => d.type === 'health_data')}
        status={status}
        checked={checked}
        onCheck={setChecked}
        testMode={app.backend.mode === 'local'}
      />
    </Screen>
  );
}
