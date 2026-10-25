import {
  entryDateBlock,
  isSportId,
  SPORT_CATALOGUE,
  type SportEntryError,
  type SportId,
  sessionTrainingLoad,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AreaButton } from '@/components/design';
import { Screen } from '@/components/screen';
import { kcalFor, useSessionKcalContext } from '@/components/session-kcal';
import { SportPicker } from '@/components/sport-picker';
import { rememberGpsSportart } from '@/components/sport-recording';
import {
  Body,
  Button,
  Card,
  FieldError,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { EffortSlider } from '@/components/workout';
import { newId } from '@/data/create-backend';
import { createSportDraft, recentSportsFromRows, sportDraftResult } from '@/data/sport-entry';
import { t } from '@/i18n';
import { berlinTodayIso } from '@/lib/format';
import { formatKcal } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { isoDateParam } from '@/lib/route-param';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const S = t.sports;

/**
 * „Sportart eintragen“ (Sportarten Stufe 2, docs/PLAN-SPORTARTEN.md): Sportart wählen (Suche, zuletzt genutzt,
 * Gruppen), Dauer, Distanz (nur GPS-Sportarten), Anstrengung 0–10 und Notiz – heute bzw. bis 14 Tage zurück. Mit
 * `?gps=1` nur GPS-Sportarten und „Aufzeichnung starten“. Gespeichert wird über den normalen Tagebuch-Weg
 * (submitWorkout → Warteschlange, offline); Regeln, kcal und Belastung rechnet packages/core.
 */
export default function SportEntryScreen() {
  const params = useLocalSearchParams<{ date?: string; gps?: string; sport?: string }>();
  const router = useRouter();
  const app = useApp();
  const today = berlinTodayIso();
  const date = isoDateParam(params.date) ?? today;
  const gpsMode = params.gps === '1';
  const [sport, setSport] = useState<SportId | null>(
    isSportId(params.sport) && (!gpsMode || SPORT_CATALOGUE[params.sport].gps)
      ? params.sport
      : null,
  );
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<readonly SportEntryError[] | 'choose'>([]);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const kcalContext = useSessionKcalContext();
  const recent = useMemo(
    () => (app.rows ? recentSportsFromRows(app.rows, { onlyGps: gpsMode }) : []),
    [app.rows, gpsMode],
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
  const ownerUserId = app.session.userId;
  const isWeb = Platform.OS === 'web';
  const testMode = app.backend.mode === 'local';
  const block = entryDateBlock(date, today);
  const def = sport ? SPORT_CATALOGUE[sport] : null;

  const draftFor = (chosen: SportId) =>
    createSportDraft({
      ownerUserId,
      sport: { sport: chosen, hours, minutes, distanceKm: def?.gps ? distanceKm : '' },
      performedOn: date,
      today,
      effort,
      notes,
      now: new Date().toISOString(),
      newId,
    });
  // Vorschau (kcal, Belastung) aus denselben Regeln wie beim Speichern.
  const preview = (() => {
    if (!sport) return null;
    const result = sportDraftResult(draftFor(sport), {
      writeId: newId(),
      now: new Date().toISOString(),
      today,
    });
    if (!result.ok || !result.payload.sport) return null;
    const durationS = result.payload.sport.duration_s;
    const kcal = kcalFor(kcalContext, {
      kind: 'strength',
      enduranceModality: null,
      effortTarget: null,
      durationS,
      measuredKcal: null,
      sport,
      effort,
    });
    return { kcal: kcal?.kcal ?? null, load: sessionTrainingLoad({ durationS, effort, sport }) };
  })();

  async function save() {
    if (!sport) {
      setErrors('choose');
      return;
    }
    const draft = draftFor(sport);
    const check = sportDraftResult(draft, {
      writeId: newId(),
      now: new Date().toISOString(),
      today,
    });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    setMessage(undefined);
    setBusy(true);
    try {
      const outcome = await app.submitWorkout(draft);
      if (outcome.kind === 'saved' || outcome.kind === 'queued') {
        router.replace(`/tag/${date}` as Href);
        return;
      }
      // Abgelehnt: Eingaben bleiben im Formular, kein liegengebliebener Entwurf.
      await app.discardDraft(draft.key).catch(() => undefined);
      setMessage(outcome.kind === 'invalid' ? S.errors.invalid : S.errors.rejected);
    } catch {
      setMessage(S.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording(demo: boolean) {
    if (!sport || !def?.gpsProfile) {
      setErrors('choose');
      return;
    }
    await rememberGpsSportart(sport);
    router.push(
      `/ausdauer/aufzeichnen?sport=${def.gpsProfile}&sportart=${sport}${demo ? '&demo=1' : ''}` as Href,
    );
  }

  const errorText = (field: 'duration' | 'distance' | 'effort' | 'notes' | 'date') => {
    if (errors === 'choose') return undefined;
    const found = errors.find((e) =>
      field === 'duration'
        ? e.startsWith('duration')
        : field === 'distance'
          ? e.startsWith('distance')
          : field === 'effort'
            ? e === 'effort_invalid'
            : field === 'notes'
              ? e === 'notes_too_long'
              : e.startsWith('date') || e === 'invalid',
    );
    return found ? S.errors[found] : undefined;
  };
  const back = (
    <Button
      label={t.backfill.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/kalender' as Href))}
    />
  );

  return (
    <Screen
      area="ausdauer"
      icon="ball"
      title={gpsMode ? S.titleGps : S.title}
      testID="sport-entry"
      footer={back}
    >
      <Body testID="sport-entry-day">{S.forDay(dayLabel(date))}</Body>
      <Body muted>{gpsMode ? S.introGps : S.intro}</Body>
      {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
      {block ? (
        <Notice tone="warning" testID="sport-entry-blocked">
          {S.errors[block === 'future' ? 'date_future' : 'date_too_old']}
        </Notice>
      ) : (
        <>
          <Card>
            <View style={styles.section}>
              <Heading level={2}>{S.picker.label}</Heading>
              <SportPicker
                value={sport}
                onChange={(value) => {
                  setSport(value);
                  setErrors([]);
                  if (!SPORT_CATALOGUE[value].gps) setDistanceKm('');
                }}
                recent={recent}
                onlyGps={gpsMode}
              />
              <FieldError
                message={errors === 'choose' ? S.errors.choose : undefined}
                testID="sport-entry-choose-error"
              />
            </View>
          </Card>
          {gpsMode && sport && date === today ? (
            <Card>
              <View style={styles.section}>
                {!isWeb ? (
                  <AreaButton
                    area="ausdauer"
                    icon="play"
                    label={S.form.startRecording}
                    onPress={() => void startRecording(false)}
                    testID="sport-entry-record"
                  />
                ) : testMode ? (
                  <>
                    <AreaButton
                      area="ausdauer"
                      icon="play"
                      label={S.form.startDemo}
                      onPress={() => void startRecording(true)}
                      testID="sport-entry-demo"
                    />
                    <Body muted>{S.form.demoHint}</Body>
                  </>
                ) : (
                  <Notice tone="info">{S.form.noGpsWeb}</Notice>
                )}
              </View>
            </Card>
          ) : null}
          {sport ? (
            <Card>
              <View style={styles.section} testID="sport-entry-form">
                <Heading level={2}>{S.form.durationTitle}</Heading>
                {sport === 'alpine_skiing' || sport === 'snowboarding' ? (
                  <Notice tone="info" testID="sport-entry-lift">
                    {S.form.liftHint}
                  </Notice>
                ) : null}
                <View style={styles.row}>
                  <View style={styles.half}>
                    <TextField
                      label={S.form.hours}
                      value={hours}
                      onChangeText={(v) => {
                        setHours(v);
                        setErrors([]);
                      }}
                      keyboardType="number-pad"
                      testID="sport-entry-hours"
                    />
                  </View>
                  <View style={styles.half}>
                    <TextField
                      label={S.form.minutes}
                      value={minutes}
                      onChangeText={(v) => {
                        setMinutes(v);
                        setErrors([]);
                      }}
                      keyboardType="number-pad"
                      testID="sport-entry-minutes"
                    />
                  </View>
                </View>
                <FieldError message={errorText('duration')} testID="sport-entry-duration-error" />
                {def?.gps ? (
                  <TextField
                    label={S.form.distance}
                    hint={S.form.distanceHint}
                    value={distanceKm}
                    onChangeText={(v) => {
                      setDistanceKm(v);
                      setErrors([]);
                    }}
                    keyboardType="decimal-pad"
                    error={errorText('distance')}
                    testID="sport-entry-distance"
                  />
                ) : null}
                <Body muted>{S.form.effortIntro}</Body>
                <EffortSlider
                  label={S.form.effortLabel}
                  value={effort}
                  onChange={setEffort}
                  testID="sport-entry-effort"
                />
                {effort !== null ? (
                  <Button
                    label={t.workout.effortSkip}
                    variant="link"
                    onPress={() => setEffort(null)}
                  />
                ) : null}
                <TextField
                  label={S.form.notes}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  error={errorText('notes')}
                  testID="sport-entry-notes"
                />
                {preview ? (
                  <View style={styles.preview} testID="sport-entry-preview">
                    {preview.kcal !== null ? (
                      <Body testID="sport-entry-kcal">
                        {S.form.kcalPreview(formatKcal(preview.kcal))}
                      </Body>
                    ) : null}
                    {preview.load !== null ? (
                      <Body muted testID="sport-entry-load">
                        {S.form.loadPreview(preview.load)}
                      </Body>
                    ) : null}
                  </View>
                ) : null}
                <FieldError message={errorText('date') ?? message} testID="sport-entry-error" />
                <Button
                  label={busy ? S.form.saving : S.form.save}
                  loading={busy}
                  onPress={() => void save()}
                  testID="sport-entry-save"
                />
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  preview: { gap: 2 },
});
