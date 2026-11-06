import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { FreeExercisePicker, useFreeExerciseSelection } from '@/components/free-exercise-picker';
import { Screen } from '@/components/screen';
import { Body, Button, FieldError, LoadingState, Notice } from '@/components/ui';
import { backfillDayFromRows } from '@/data/backfill';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useStartFreeSession } from '@/state/use-start-free';

const S = t.startTraining;

/**
 * „Krafttraining starten“ aus dem Start-Blatt (Gründer-Wunsch 06.11.2026): freie Krafteinheit HEUTE im normalen
 * Trainingsmodus (Pausentimer, offline) – Übungen aus der Bibliothek wählen, „Training starten“. Dieselben Regeln
 * wie „Einheit eintragen“ (Tageslimit aus packages/core backfillOptions, freie Einheit ändert nie den Plan).
 */
export default function StrengthStartScreen() {
  const router = useRouter();
  const app = useApp();
  const today = berlinTodayIso();
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => setLive((current) => ({ text, version: current.version + 1 }));
  const { selected, toggle, error, setError, exercisesOf } = useFreeExerciseSelection(announce);
  const freeStart = useStartFreeSession();
  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

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
  if (route !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={route as Href} />;
  }
  const day = backfillDayFromRows(app.rows, today, today);

  async function start() {
    const exercises = exercisesOf(library);
    if (exercises.length === 0) {
      setError(t.backfill.chooseExercise);
      announce(t.backfill.chooseExercise);
      return;
    }
    setError(undefined);
    const ok = await freeStart.start({
      kind: 'strength',
      modality: 'run',
      exercises,
      performedOn: today,
    });
    if (!ok) {
      setError(t.backfill.saveFailed);
      announce(t.backfill.saveFailed);
    }
  }

  const footer = (
    <View style={styles.footer}>
      {day.block === null ? (
        <Button
          label={S.strengthStart(selected.length)}
          icon="play"
          loading={freeStart.busy}
          disabled={library.kind !== 'ready'}
          onPress={() => void start()}
          testID="strength-start"
        />
      ) : null}
      <Button
        label={S.back}
        variant="secondary"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/today' as Href))}
        testID="strength-start-back"
      />
    </View>
  );

  return (
    <Screen
      area="training"
      icon="dumbbell"
      title={S.strengthTitle}
      testID="strength-start-screen"
      footer={footer}
    >
      <LiveRegion text={live.text} version={live.version} />
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {day.block ? (
        <Notice tone="warning" title={S.blockedTitle} testID="strength-start-blocked">
          <Body>{t.backfill.blocked[day.block]}</Body>
        </Notice>
      ) : (
        <>
          <Body muted>{S.strengthIntro}</Body>
          <FreeExercisePicker library={library} selected={selected} onToggle={toggle} />
          <FieldError message={error} testID="strength-start-error" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
});
