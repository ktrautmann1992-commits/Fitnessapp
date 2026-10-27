import {
  defaultTrainingStart,
  minutesToStartTime,
  startTimeToMinutes,
  stepStartMinutes,
  type TrainingTime,
} from '@fitnessapp/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { t } from '@/i18n';
import { sessionTimeText } from '@/lib/training-timeline-format';
import { useApp } from '@/state/app-state';

/**
 * Uhrzeit an der Einheit (Nährstoff-Timing 2, docs/PLAN-NAEHRSTOFF-TIMING.md 6, Entscheidung 10): Tipp auf die Uhrzeit
 * im Tages-Blatt des Training-Reiters → einstellen in 15-Minuten- bzw. Stunden-Schritten. Ohne eigene Uhrzeit gilt die
 * Angabe „Trainingszeit“ („ca.“). Gespeichert wird an der geplanten Einheit (Server bzw. Testmodus), Regeln wie beim
 * Verschieben; die Mahlzeiten rund ums Training passen sich danach an.
 */
const T = t.trainingMeals.time;

export function SessionTimeBlock({
  sessionId,
  startTime,
  trainingTime,
  onMessage,
}: {
  sessionId: string;
  /** Wert aus planned_sessions.start_time („HH:MM:SS“ bzw. „HH:MM“), null = ohne eigene Uhrzeit. */
  startTime: string | null;
  trainingTime: TrainingTime | null;
  onMessage: (message: { tone: 'success' | 'danger'; text: string }) => void;
}) {
  const app = useApp();
  const own = startTimeToMinutes(startTime);
  const current = own ?? defaultTrainingStart(trainingTime);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    try {
      await app.setSessionStartTime(sessionId, next);
      onMessage({ tone: 'success', text: next === null ? T.removed : T.saved(next) });
      setEditing(false);
    } catch {
      onMessage({ tone: 'danger', text: T.failed });
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Button
        label={`${T.label}: ${sessionTimeText(current, own === null)}`}
        accessibilityLabel={T.a11y(minutesToStartTime(current), own === null)}
        variant="secondary"
        icon="stopwatch"
        onPress={() => {
          setValue(current);
          setEditing(true);
        }}
        testID="session-time"
      />
    );
  }
  const step = (delta: number, label: string, testID: string) => (
    <Button
      key={testID}
      label={label}
      accessibilityLabel={T.stepA11y(label)}
      variant="secondary"
      compact
      disabled={busy}
      onPress={() => setValue((v) => stepStartMinutes(v, delta))}
      testID={testID}
    />
  );
  return (
    <View style={styles.block} testID="session-time-editor">
      <Body>{T.title}</Body>
      <Body testID="session-time-value" accessibilityLabel={minutesToStartTime(value)}>
        {minutesToStartTime(value)}
      </Body>
      <View style={styles.row}>
        {step(-60, T.minusHour, 'session-time-minus-hour')}
        {step(-15, T.minusQuarter, 'session-time-minus')}
        {step(15, T.plusQuarter, 'session-time-plus')}
        {step(60, T.plusHour, 'session-time-plus-hour')}
      </View>
      <Body muted>{T.hint}</Body>
      <Button
        label={T.save}
        loading={busy}
        onPress={() => void save(minutesToStartTime(value))}
        testID="session-time-save"
      />
      {own !== null ? (
        <Button
          label={T.remove}
          variant="secondary"
          disabled={busy}
          onPress={() => void save(null)}
          testID="session-time-remove"
        />
      ) : null}
      <Button
        label={T.cancel}
        variant="link"
        disabled={busy}
        onPress={() => setEditing(false)}
        testID="session-time-cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
