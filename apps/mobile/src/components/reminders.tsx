import { nudgeReminderTime, REMINDERS, type ReminderKind } from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { SectionLabel } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Button, Card, Checkbox, ChoiceList, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { clock } from '@/i18n/de-reminders';
import { appNotifications } from '@/lib/app-notifications';
import { appFont } from '@/lib/fonts';
import { deviceTimeZone } from '@/lib/notifications';
import { updateReminderPrefs, useReminderPrefs } from '@/lib/reminder-prefs';
import { reminderNotifications } from '@/lib/reminders';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md, Gründer-Wunsch 29.10.2026):
 * - `ReminderScheduler` (im Wurzel-Layout): plant beim App-Start, bei Rückkehr in die App, bei jeder Änderung des Plans
 *   (Zeilen) und der Einstellung neu – nur lokal, die nächsten 7 Tage. Im Browser ein No-op.
 * - `ReminderSettingsCard`: drei Schalter mit Optionen in Einstellungen → Benachrichtigungen. Die System-Erlaubnis kommt
 *   erst beim Einschalten (Tipp der Person).
 */
const R = t.reminders;

export function ReminderScheduler(): null {
  const app = useApp();
  const prefs = useReminderPrefs();
  const today = useToday();
  const [wake, setWake] = useState(0);
  useEffect(() => {
    if (!appNotifications.supported) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setWake((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);
  const loading = app.status.kind === 'loading';
  const rows = app.session ? app.rows : null;
  const signedIn = app.session !== null;
  useEffect(() => {
    if (!appNotifications.supported || !prefs.loaded || loading) return;
    const items = signedIn
      ? reminderNotifications({
          rows,
          settings: prefs.settings,
          today,
          nowMs: Date.now(),
          timeZone: deviceTimeZone(),
        })
      : [];
    void appNotifications.syncReminders(items).catch(() => undefined);
  }, [rows, prefs, today, wake, loading, signedIn]);
  return null;
}

function TimeStepper({
  label,
  value,
  min,
  max,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (minutes: number) => void;
  testID: string;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.stepper}>
      <Text
        style={[styles.stepperValue, appFont('semibold'), { color: theme.text }]}
        testID={`${testID}-value`}
      >
        {R.timeValue(label, value)}
      </Text>
      <View style={styles.stepperButtons}>
        <Button
          label={R.earlier}
          variant="secondary"
          compact
          accessibilityLabel={R.earlierA11y(label)}
          disabled={value <= min}
          onPress={() => onChange(nudgeReminderTime(value, -1, min, max))}
          testID={`${testID}-earlier`}
        />
        <Button
          label={R.later}
          variant="secondary"
          compact
          accessibilityLabel={R.laterA11y(label)}
          disabled={value >= max}
          onPress={() => onChange(nudgeReminderTime(value, 1, min, max))}
          testID={`${testID}-later`}
        />
      </View>
    </View>
  );
}

export function ReminderSettingsCard() {
  const prefs = useReminderPrefs();
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(false);
  const { settings } = prefs;

  async function toggle(kind: ReminderKind, enabled: boolean) {
    setError(false);
    try {
      await updateReminderPrefs({ [kind]: { enabled } });
      if (enabled && appNotifications.supported) {
        const permission = await appNotifications.allowReminders();
        setDenied(permission !== 'granted');
      }
    } catch {
      setError(true);
    }
  }

  function change(update: Parameters<typeof updateReminderPrefs>[0]) {
    setError(false);
    void updateReminderPrefs(update).catch(() => setError(true));
  }

  const drink = settings.drink;
  return (
    <Card>
      <View style={styles.gap} testID="reminder-settings">
        <Heading level={2}>{R.title}</Heading>
        <Body muted>{R.intro}</Body>
        {appNotifications.supported ? null : (
          <Notice tone="info" testID="reminder-settings-web">
            {R.webTest}
          </Notice>
        )}

        <Checkbox
          label={R.training.label}
          checked={settings.training.enabled}
          onChange={(value) => void toggle('training', value)}
          testID="reminder-training"
        />
        {settings.training.enabled ? (
          <View style={styles.options}>
            <Body muted>{R.training.hint}</Body>
            <ChoiceList
              label={R.training.leadGroup}
              horizontal
              value={settings.training.leadMinutes}
              onChange={(leadMinutes) => change({ training: { leadMinutes } })}
              options={REMINDERS.trainingLeadOptions.map((m) => ({
                value: m,
                label: R.training.lead(m),
                testID: `reminder-training-lead-${m}`,
              }))}
            />
          </View>
        ) : null}

        <Checkbox
          label={R.meals.label}
          checked={settings.meals.enabled}
          onChange={(value) => void toggle('meals', value)}
          testID="reminder-meals"
        />
        {settings.meals.enabled ? (
          <View style={styles.options}>
            <Body muted>{R.meals.hint}</Body>
            <Body>{R.meals.times}</Body>
            {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
              <TimeStepper
                key={meal}
                label={R.meals[meal]}
                value={settings.meals[meal]}
                min={REMINDERS.mealMinMinutes}
                max={REMINDERS.mealMaxMinutes}
                onChange={(minutes) => change({ meals: { [meal]: minutes } })}
                testID={`reminder-meals-${meal}`}
              />
            ))}
          </View>
        ) : null}

        <Checkbox
          label={R.drink.label}
          checked={drink.enabled}
          onChange={(value) => void toggle('drink', value)}
          testID="reminder-drink"
        />
        {drink.enabled ? (
          <View style={styles.options}>
            <Body muted>{R.drink.hint}</Body>
            <TimeStepper
              label={R.drink.from}
              value={drink.fromMinutes}
              min={REMINDERS.quietToMinutes}
              max={drink.toMinutes - REMINDERS.timeStepMinutes}
              onChange={(fromMinutes) => change({ drink: { fromMinutes } })}
              testID="reminder-drink-from"
            />
            <TimeStepper
              label={R.drink.to}
              value={drink.toMinutes}
              min={drink.fromMinutes + REMINDERS.timeStepMinutes}
              max={REMINDERS.quietFromMinutes}
              onChange={(toMinutes) => change({ drink: { toMinutes } })}
              testID="reminder-drink-to"
            />
            <ChoiceList
              label={R.drink.everyGroup}
              horizontal
              value={drink.everyMinutes}
              onChange={(everyMinutes) => change({ drink: { everyMinutes } })}
              options={REMINDERS.drinkEveryOptions.map((m) => ({
                value: m,
                label: R.drink.every(m),
                testID: `reminder-drink-every-${m}`,
              }))}
            />
            <Body muted style={styles.small} testID="reminder-drink-window">
              {`${clock(drink.fromMinutes)}–${clock(drink.toMinutes)} Uhr`}
            </Body>
          </View>
        ) : null}

        {denied ? (
          <>
            <Notice tone="warning" testID="reminder-denied">
              {R.denied}
            </Notice>
            <Button
              label={t.notifications.openSystemSettings}
              variant="secondary"
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          </>
        ) : null}
        {error ? <Notice tone="danger">{R.saveFailed}</Notice> : null}
      </View>
    </Card>
  );
}

/** Abschnitt im Browser ohne Testmodus: nur der Hinweis „nur in der App“. */
export function ReminderWebNotice() {
  return (
    <>
      <SectionLabel>{R.title}</SectionLabel>
      <Card>
        <Notice tone="info" testID="reminder-web">
          {R.web}
        </Notice>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  options: { gap: spacing.sm, paddingLeft: spacing.md },
  stepper: { gap: spacing.xs },
  stepperValue: { fontSize: fontSize.md },
  stepperButtons: { flexDirection: 'row', gap: spacing.sm },
  small: { fontSize: fontSize.sm, lineHeight: 20 },
});
