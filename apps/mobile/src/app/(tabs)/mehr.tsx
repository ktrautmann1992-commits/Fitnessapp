import { Redirect, useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Reiter „Mehr“ (docs/PLAN-DASHBOARD.md 2.6): Mein Konto, Einstellungen und alle weiteren Bereiche. Nur Wege in
 * vorhandene Bildschirme – nichts Neues.
 */
export default function MoreScreen() {
  const router = useRouter();
  const app = useApp();
  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.more;
  const nutrition = app.backend.supportsNutrition;
  const open = (href: string) => () => router.push(href as Href);
  return (
    <Screen title={texts.title} testID="more">
      <Heading level={2}>{texts.sections.personal}</Heading>
      <Card>
        <Button label={texts.account} onPress={open('/konto')} testID="more-account" />
        <Body muted>{texts.accountHint}</Body>
        <Button
          label={texts.settings}
          variant="secondary"
          onPress={open('/settings')}
          testID="more-settings"
        />
      </Card>
      <Heading level={2}>{texts.sections.content}</Heading>
      <Card>
        {nutrition ? (
          <Button
            label={texts.recipes}
            variant="secondary"
            onPress={open('/rezepte')}
            testID="more-recipes"
          />
        ) : null}
        <Button
          label={texts.exercises}
          variant="secondary"
          onPress={open('/uebungen')}
          testID="more-exercises"
        />
        <Button
          label={t.workouts.more}
          variant="secondary"
          onPress={open('/workouts')}
          testID="more-workouts"
        />
        {nutrition ? (
          <>
            <Button
              label={texts.guides}
              variant="secondary"
              onPress={open('/ratgeber')}
              testID="more-guides"
            />
            <Button
              label={texts.shopping}
              variant="secondary"
              onPress={open('/einkaufsliste')}
              testID="more-shopping"
            />
            <Button
              label={texts.mealPrep}
              variant="secondary"
              onPress={open('/meal-prep')}
              testID="more-meal-prep"
            />
          </>
        ) : null}
        <Button
          label={texts.competition}
          variant="secondary"
          onPress={open('/wettkampf')}
          testID="more-competition"
        />
      </Card>
      <Heading level={2}>{texts.sections.info}</Heading>
      <Card>
        <Button
          label={texts.licenses}
          variant="secondary"
          onPress={open('/lizenzen')}
          testID="more-licenses"
        />
      </Card>
    </Screen>
  );
}
