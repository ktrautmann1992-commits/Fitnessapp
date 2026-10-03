import { activeConsentVersion, type ConsentType } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, StepFooter } from '@/components/screen';
import { Body, Button, Checkbox, LoadingState } from '@/components/ui';
import { consentRecordsFromRows } from '@/data/mapping';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { BASE_CONSENT_TYPES, useApp } from '@/state/app-state';

/** Schritt D: Grund-Einwilligungen (Nutzungsbedingungen, Datenschutz) – je einzeln, nie vorausgewählt. */
export default function BaseConsentsScreen() {
  const router = useRouter();
  const app = useApp();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
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

  const records = consentRecordsFromRows(app.rows.consents);
  const isReconsent = BASE_CONSENT_TYPES.some(
    (type) => activeConsentVersion(records, type) !== null,
  );
  const labels: Record<(typeof BASE_CONSENT_TYPES)[number], string> = {
    terms: t.baseConsents.termsLabel,
    privacy: t.baseConsents.privacyLabel,
  };

  async function submit() {
    const missing = BASE_CONSENT_TYPES.filter((type) => !checked[type]);
    if (missing.length > 0) {
      setError(t.baseConsents.missing);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      const route = await app.grantConsents(BASE_CONSENT_TYPES as readonly ConsentType[]);
      router.replace(route as Href);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={isReconsent ? t.baseConsents.reconsentTitle : t.baseConsents.title}
      intro={t.baseConsents.intro}
      footer={
        <StepFooter
          onNext={() => void submit()}
          nextLabel={t.baseConsents.submit}
          loading={saving}
          error={error}
        />
      }
    >
      {BASE_CONSENT_TYPES.map((type) => {
        const doc = app.documents.find((d) => d.type === type);
        return (
          <View key={type} style={{ gap: 4 }}>
            <Checkbox
              label={labels[type]}
              checked={checked[type] === true}
              onChange={(value) => setChecked((prev) => ({ ...prev, [type]: value }))}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 44 }}>
              <Button
                label={t.baseConsents.readText}
                variant="link"
                accessibilityLabel={`${t.consentTypes[type]}: ${t.baseConsents.readText}`}
                onPress={() => router.push(`/consent/${type}` as Href)}
              />
              {doc ? <Body muted>{t.baseConsents.version(doc.version)}</Body> : null}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
