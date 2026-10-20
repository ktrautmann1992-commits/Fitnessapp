import {
  ENDURANCE_MODALITIES,
  type EnduranceModality,
  type PlannedSessionKind,
  SESSION_LOG_LIMITS,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { backfillDayFromRows, freeExerciseCandidates } from '@/data/backfill';
import { newId } from '@/data/create-backend';
import { createFreeDraft } from '@/data/workout-draft';
import { startKind } from '@/data/workout-session';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { dayLabel } from '@/lib/plan-format';
import { isoDateParam } from '@/lib/route-param';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * „+ Einheit“ aus dem Kalender (docs/PLAN-AUSWERTUNG.md 4, Etappe A1b): für einen Tag (heute bis 14 Tage zurück)
 * eine geplante Einheit nachtragen ODER eine freie Einheit eintragen – Kraft mit Übungen aus der Bibliothek oder
 * Ausdauer (Art; Dauer, Distanz und Anstrengung im Trainingsmodus). Was erlaubt ist, rechnet backfillOptions() in
 * packages/core; gespeichert wird über den Trainingsmodus (geschützter Entwurf, Tagebuch-Warteschlange, offline).
 */
export default function BackfillScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const app = useApp();
  // „Heute“ wie der Server (Europe/Berlin, Wächter H4).
  const today = berlinTodayIso();
  const date = isoDateParam(params.date) ?? today;
  const [kind, setKind] = useState<PlannedSessionKind | null>(null);
  const [modality, setModality] = useState<EnduranceModality>('run');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => setLive((current) => ({ text, version: current.version + 1 }));

  const { ensureLibrary, library } = app;
  useEffect(() => {
    if (kind === 'strength') void ensureLibrary();
  }, [ensureLibrary, kind]);
  const lib = library.kind === 'ready' ? library.library : null;
  const candidates = useMemo(
    () => (lib ? freeExerciseCandidates(lib.exercises, query, selected) : null),
    [lib, query, selected],
  );

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
  const rows = app.rows;
  const ownerUserId = app.session.userId;
  const day = backfillDayFromRows(rows, date, today);
  const back = (
    <Button
      label={t.backfill.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/kalender' as Href))}
    />
  );
  const max = SESSION_LOG_LIMITS.exercisesPerSession.max;

  function toggle(id: string, name: string) {
    setError(undefined);
    if (selected.includes(id)) {
      setSelected((current) => current.filter((x) => x !== id));
      announce(t.backfill.selected(selected.length - 1));
      return;
    }
    if (selected.length >= max) {
      const text = t.backfill.maxReached(max);
      setError(text);
      announce(text);
      return;
    }
    setSelected((current) => [...current, id]);
    announce(`${name}: ${t.backfill.selected(selected.length + 1)}`);
  }

  async function startFree() {
    if (!kind) return;
    const exercises =
      kind === 'strength' && lib
        ? selected.flatMap((id) => {
            const exercise = lib.exercises.get(id);
            return exercise ? [exercise] : [];
          })
        : [];
    if (kind === 'strength' && exercises.length === 0) {
      setError(t.backfill.chooseExercise);
      announce(t.backfill.chooseExercise);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const draft = createFreeDraft({
        ownerUserId,
        kind,
        modality,
        exercises,
        performedOn: date,
        today,
        now: new Date().toISOString(),
        newId,
      });
      await app.saveDraft(draft);
      router.replace(`/workout/${draft.key}` as Href);
    } catch {
      setError(t.backfill.saveFailed);
      announce(t.backfill.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen area="training" icon="plus" title={t.backfill.title} testID="backfill" footer={back}>
      <LiveRegion text={live.text} version={live.version} />
      <Body testID="backfill-day">{t.backfill.forDay(dayLabel(date))}</Body>
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {day.block ? (
        <Notice tone="warning" testID="backfill-blocked">
          {t.backfill.blocked[day.block]}
        </Notice>
      ) : (
        <>
          <Card>
            <View style={styles.section} testID="backfill-planned">
              <Heading level={2}>{t.backfill.plannedTitle}</Heading>
              <Body muted>{t.backfill.plannedIntro}</Body>
              {day.options.length === 0 ? <Body muted>{t.backfill.plannedNone}</Body> : null}
              {day.options.map((option) => {
                // Heute (Wächter G2/H2): normales Training mit Pausentimer und denselben Prüfungen wie live
                // (startKind) – nachtragen nur für vergangene Tage.
                const isToday = date === today;
                const planned = activePlan(rows)?.sessions.find((x) => x.id === option.sessionId);
                const liveOk =
                  !isToday || (planned !== undefined && startKind(rows, planned, today) !== null);
                return option.allowed && liveOk ? (
                  <Button
                    key={option.sessionId}
                    label={
                      isToday
                        ? t.backfill.plannedTodayButton(option.name_de)
                        : t.backfill.plannedButton(option.name_de)
                    }
                    variant="secondary"
                    onPress={() =>
                      router.replace(
                        (isToday
                          ? `/workout/${option.sessionId}`
                          : `/workout/${option.sessionId}?date=${date}`) as Href,
                      )
                    }
                    testID={`backfill-planned-${option.sessionId}`}
                  />
                ) : (
                  <Body key={option.sessionId} muted testID="backfill-planned-blocked">
                    {t.backfill.plannedBlocked(
                      option.name_de,
                      t.backfill.reasons[
                        option.allowed ? 'not_today' : (option.reason ?? 'window')
                      ],
                    )}
                  </Body>
                );
              })}
            </View>
          </Card>

          <Card>
            <View style={styles.section} testID="backfill-free">
              <Heading level={2}>{t.backfill.freeTitle}</Heading>
              <Body muted>{t.backfill.freeIntro}</Body>
              <ChoiceList<PlannedSessionKind>
                label={t.backfill.kindLabel}
                options={[
                  { value: 'strength', label: t.backfill.kinds.strength },
                  { value: 'endurance', label: t.backfill.kinds.endurance },
                ]}
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  setError(undefined);
                }}
              />
              {kind === 'endurance' ? (
                <ChoiceList<EnduranceModality>
                  label={t.backfill.modalityLabel}
                  options={ENDURANCE_MODALITIES.map((value) => ({
                    value,
                    label: t.workout.cardio.modalities[value],
                  }))}
                  value={modality}
                  onChange={setModality}
                  horizontal
                />
              ) : null}
              {kind === 'strength' ? (
                library.kind === 'missing' ? (
                  <Notice tone="warning" testID="backfill-library-missing">
                    {t.backfill.libraryMissing}
                  </Notice>
                ) : !candidates ? (
                  <LoadingState label={t.backfill.libraryLoading} />
                ) : (
                  <View style={styles.section}>
                    <TextField
                      label={t.backfill.searchLabel}
                      hint={t.backfill.searchHint}
                      value={query}
                      onChangeText={setQuery}
                      testID="backfill-search"
                    />
                    <Body testID="backfill-selected">{t.backfill.selected(selected.length)}</Body>
                    {candidates.items.length === 0 ? (
                      <Body muted>{t.backfill.noResults}</Body>
                    ) : null}
                    {candidates.items.map((exercise) => {
                      const isSelected = selected.includes(exercise.id);
                      return (
                        <OptionButton
                          key={exercise.id}
                          role="checkbox"
                          label={exercise.name_de}
                          selected={isSelected}
                          accessibilityLabel={t.backfill.pickA11y(exercise.name_de, isSelected)}
                          onPress={() => toggle(exercise.id, exercise.name_de)}
                        />
                      );
                    })}
                    {candidates.more > 0 ? (
                      <Body muted>{t.backfill.moreResults(candidates.more)}</Body>
                    ) : null}
                  </View>
                )
              ) : null}
              <FieldError message={error} testID="backfill-error" />
              {kind !== null ? (
                <Button
                  label={
                    kind === 'strength'
                      ? t.backfill.startStrength(selected.length)
                      : t.backfill.startEndurance
                  }
                  loading={busy}
                  disabled={kind === 'strength' && library.kind === 'missing'}
                  onPress={() => void startFree()}
                  testID="backfill-start"
                />
              ) : null}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
