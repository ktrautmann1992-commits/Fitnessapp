import {
  addDays,
  suspensionTrainerReady,
  TRAVEL_EQUIPMENT_OPTIONS,
  TRAVEL_MODE,
  type TravelEquipment,
  type TravelMode,
  travelModeInputSchema,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateInput, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  FieldError,
  Heading,
  LoadingState,
  Notice,
} from '@/components/ui';
import { TrainingModesError } from '@/data/training-modes';
import { t } from '@/i18n';
import { deModes as M } from '@/i18n/de-training-modes';
import { errorText } from '@/lib/error-text';
import { formatDateDe, isoFromDateParts } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useTrainingModes } from '@/state/use-training-modes';

type DateParts = { day: string; month: string; year: string };
const partsOf = (iso: string): DateParts => ({
  day: iso.slice(8, 10),
  month: iso.slice(5, 7),
  year: iso.slice(0, 4),
});

/**
 * Reise-Modus (docs/PLAN-TRAINING-MODI.md 4): Zeitraum, Geräte unterwegs, optional kürzere Einheiten. Der Plan bleibt
 * gespeichert; die Anzeige der Reisetage setzt packages/core neu zusammen (prepareSessionForDisplay mit `modes`),
 * danach gilt automatisch wieder der Plan. Kein Gesundheitsdatum.
 */
export default function TravelModeScreen() {
  const router = useRouter();
  const app = useApp();
  const modes = useTrainingModes();
  const today = modes.today;
  const [from, setFrom] = useState<DateParts>(() => partsOf(today));
  const [to, setTo] = useState<DateParts>(() => partsOf(addDays(today, 6)));
  const [equipment, setEquipment] = useState<TravelEquipment | null>(null);
  const [minutes, setMinutes] = useState<number | 'none'>('none');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  // Schlingentrainer-Übungen vorhanden? (Supabase: erst nach der Freigabe; docs/PLAN-CALISTHENICS-SCHLINGE.md 3.3)
  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const slingReady =
    library.kind === 'ready' && library.library
      ? suspensionTrainerReady(library.library.exercises)
      : false;

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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/today' as Href));
  const list = (modes.state?.travel ?? [])
    .filter((m) => m.ends_on >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  async function save() {
    setMessage(null);
    const startsOn = isoFromDateParts(from.day, from.month, from.year);
    const endsOn = isoFromDateParts(to.day, to.month, to.year);
    if (!startsOn || !endsOn) {
      setError(M.travel.dateInvalid);
      return;
    }
    if (!equipment) {
      setError(M.travel.equipmentRequired);
      return;
    }
    const input = {
      starts_on: startsOn,
      ends_on: endsOn,
      equipment,
      max_minutes: minutes === 'none' ? null : minutes,
    };
    const parsed = travelModeInputSchema(today).safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue?.path[0] === 'starts_on'
          ? startsOn < today
            ? M.travel.startPast
            : M.travel.tooFar
          : endsOn < startsOn
            ? M.travel.endBeforeStart
            : M.travel.tooLong,
      );
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await modes.addTravel(parsed.data);
      setMessage({
        tone: 'success',
        text: M.travel.saved(formatDateDe(startsOn), formatDateDe(endsOn)),
      });
    } catch (caught) {
      setMessage({
        tone: 'danger',
        text:
          caught instanceof TrainingModesError && caught.code === 'overlap'
            ? M.travel.overlap
            : caught instanceof TrainingModesError && caught.code === 'network'
              ? t.plan.offline
              : errorText(caught),
      });
    } finally {
      setBusy(false);
    }
  }

  async function end(mode: TravelMode) {
    setBusy(true);
    setMessage(null);
    try {
      await modes.endTravel(mode.id);
      setMessage({
        tone: 'success',
        text: mode.starts_on >= today ? M.travel.removed : M.travel.ended,
      });
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      area="training"
      icon="map"
      title={M.travel.title}
      intro={M.travel.intro}
      testID="travel-mode"
      footer={<Button label={t.common.back} variant="secondary" onPress={back} />}
    >
      {modes.load.kind === 'loading' ? <LoadingState /> : null}
      {message ? (
        <Notice tone={message.tone === 'success' ? 'success' : 'danger'} testID="travel-message">
          {message.text}
        </Notice>
      ) : null}

      {list.length > 0 ? (
        <Card>
          <Heading level={2}>{M.travel.plannedTitle}</Heading>
          {list.map((m) => (
            <View key={m.id} style={styles.row} testID="travel-item">
              <Body>
                {M.travel.line(
                  formatDateDe(m.starts_on),
                  formatDateDe(m.ends_on),
                  M.equipment[m.equipment],
                )}
              </Body>
              {m.max_minutes ? <Body muted>{M.travel.lineMinutes(m.max_minutes)}</Body> : null}
              <Button
                label={m.starts_on >= today ? M.travel.remove : M.travel.end}
                variant="secondary"
                onPress={() => void end(m)}
                disabled={busy}
                testID="travel-end"
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <DateInput label={M.travel.from} value={from} onChange={setFrom} />
        <DateInput label={M.travel.to} value={to} onChange={setTo} />
        <ChoiceList<TravelEquipment>
          label={M.travel.equipmentLabel}
          options={TRAVEL_EQUIPMENT_OPTIONS.map((e) => ({
            value: e,
            label: M.equipment[e],
            description: M.equipmentHints[e],
            testID: `travel-equipment-${e}`,
          }))}
          value={equipment}
          onChange={setEquipment}
        />
        {equipment === 'suspension_trainer' ? (
          <Notice tone="info" testID="travel-suspension-note">
            {slingReady ? t.calisthenics.travel.suspensionReady : M.travel.suspensionNote}
          </Notice>
        ) : null}
        {equipment === 'outdoor_park' ? (
          <Notice tone="info" testID="travel-park-note">
            {t.calisthenics.travel.parkNote}
          </Notice>
        ) : null}
        <ChoiceList<number | 'none'>
          label={M.travel.minutesLabel}
          options={[
            { value: 'none' as const, label: M.travel.minutesNone, testID: 'travel-minutes-none' },
            ...TRAVEL_MODE.minutesOptions.map((m) => ({
              value: m,
              label: M.travel.minutes(m),
              testID: `travel-minutes-${m}`,
            })),
          ]}
          value={minutes}
          onChange={setMinutes}
          horizontal
        />
        <FieldError message={error} testID="travel-error" />
        <Button
          label={M.travel.start}
          onPress={() => void save()}
          loading={busy}
          testID="travel-save"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
});
