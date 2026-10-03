import { Redirect, useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { todayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, isReminderDue, resolveEntryRoute } from '@/state/flow';

/** Startseite nach dem Onboarding (Platzhalter bis Phase 3) mit Link zu den Einstellungen. */
export default function TodayScreen() {
  const router = useRouter();
  const app = useApp();
  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const outdated = healthConsentStatus(app.rows, app.versions) === 'outdated';
  return (
    <Screen
      title={t.today.title}
      testID="today"
      footer={
        <Button
          label={t.today.settings}
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
      }
    >
      <Body muted>{t.today.greeting}</Body>
      {app.offline ? <Notice tone="warning">{t.errors.network}</Notice> : null}
      {outdated ? (
        <Notice tone="warning" title={t.steps.healthConsent.reconsentTitle}>
          <Body>{t.today.healthReconsent}</Body>
          <Button
            label={t.today.reconsentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
        </Notice>
      ) : null}
      {isReminderDue(app.rows, todayIso()) ? (
        <Notice tone="info">{t.today.measurementDue}</Notice>
      ) : null}
      <Card>
        <Heading level={2}>{t.today.placeholderTitle}</Heading>
        <Body muted>{t.today.placeholderText}</Body>
      </Card>
    </Screen>
  );
}
