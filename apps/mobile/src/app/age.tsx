import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import { DateInput, Screen, StepFooter } from '@/components/screen';
import { t } from '@/i18n';
import { checkBirthDate } from '@/lib/birth-date';
import { errorText } from '@/lib/error-text';
import { datePartsFromIso, todayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';

/** Schritt B: Geburtsdatum – noch vor dem Konto. Unter 16 → Stopp-Seite, nichts wird gespeichert. */
export default function AgeScreen() {
  const router = useRouter();
  const app = useApp();
  const [parts, setParts] = useState(() => datePartsFromIso(app.pendingBirthDate));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit() {
    const check = checkBirthDate(parts, todayIso());
    if (check.kind === 'incomplete') {
      setError(t.age.incomplete);
      return;
    }
    if (check.kind === 'invalid') {
      setError(check.message);
      return;
    }
    if (check.kind === 'too_young') {
      await app.setPendingBirthDate(null);
      router.replace('/too-young');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      if (app.session && !app.rows?.profile) {
        // Schon angemeldet (z. B. „Ich habe schon ein Konto“, aber noch kein Profil): Profil jetzt anlegen.
        const route = await app.createProfile(check.birthDate);
        router.replace(route as Href);
      } else {
        await app.setPendingBirthDate(check.birthDate);
        router.push('/account');
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={t.age.title}
      intro={t.age.intro}
      footer={
        <StepFooter
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
          onNext={() => void submit()}
          loading={saving}
        />
      }
    >
      <DateInput label={t.age.label} value={parts} onChange={setParts} error={error} />
    </Screen>
  );
}
