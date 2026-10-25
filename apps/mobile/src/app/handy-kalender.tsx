import { trainingCalendarIcs } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Checkbox, ChoiceList, LoadingState, Notice } from '@/components/ui';
import { calendarStartMinutes, desiredCalendarEvents } from '@/data/review';
import { t } from '@/i18n';
import {
  deviceCalendar,
  notifyDeviceCalendarChanged,
  useDeviceCalendarPrefs,
} from '@/lib/app-device-calendar';
import { saveTextFile } from '@/lib/save-file';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

/**
 * Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4, opt-in): Einschalten erst nach einer Erklärung
 * (warum der Zugriff, was im Termin steht), dann die System-Abfrage. Ausschalten entfernt den Kalender „Alpha5
 * Training“ samt Terminen. Im Browser: .ics-Datei zum Herunterladen statt Zugriff auf den Kalender.
 */
const TIME_CHOICES = [360, 420, 480, 720, 1020, 1080, 1140, 1200] as const;
const SETUP = 'setup';

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

type Message = {
  tone: 'info' | 'success' | 'warning' | 'danger';
  text: string;
  settings?: boolean;
};

export default function DeviceCalendarScreen() {
  const app = useApp();
  const router = useRouter();
  const today = useToday();
  const { loaded, prefs } = useDeviceCalendarPrefs();
  const [explain, setExplain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const texts = t.deviceCalendar;

  if (app.status.kind === 'loading' || !loaded) {
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
  if (route !== HOME_ROUTE || !app.rows) return <Redirect href={route as Href} />;
  const rows = app.rows;
  const hasPlan = rows.plans.some((p) => p.status === 'active');
  const events = desiredCalendarEvents(rows, today, prefs.startMinutes);
  const setupMinutes = calendarStartMinutes(rows, null);
  const timeOptions = [
    { value: SETUP, label: texts.timeFromSetup(hhmm(setupMinutes)) },
    ...TIME_CHOICES.filter((m) => m !== setupMinutes).map((m) => ({
      value: String(m),
      label: texts.timeOption(hhmm(m)),
    })),
  ];

  async function turnOn() {
    setExplain(false);
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await deviceCalendar.enable();
      if (outcome !== 'enabled') {
        setMessage({ tone: 'warning', text: texts.permissionDenied, settings: true });
        return;
      }
      const count = await deviceCalendar.sync(
        desiredCalendarEvents(rows, today, prefs.startMinutes),
      );
      setMessage({ tone: 'success', text: texts.synced(count ?? 0) });
    } catch {
      setMessage({ tone: 'danger', text: texts.failed });
    } finally {
      notifyDeviceCalendarChanged();
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      await deviceCalendar.disable();
      setMessage({ tone: 'info', text: texts.removed });
    } catch {
      setMessage({ tone: 'danger', text: texts.failed });
    } finally {
      notifyDeviceCalendarChanged();
      setBusy(false);
    }
  }

  async function chooseTime(value: string) {
    await deviceCalendar.setStartMinutes(value === SETUP ? null : Number(value));
    notifyDeviceCalendarChanged();
  }

  async function downloadIcs() {
    setMessage(null);
    try {
      const ics = trainingCalendarIcs(events, {
        stamp: new Date().toISOString(),
        name: texts.calendarName,
      });
      await saveTextFile('alpha5-training.ics', ics, 'text/calendar');
      setMessage({ tone: 'success', text: texts.web.downloaded(events.length) });
    } catch {
      setMessage({ tone: 'danger', text: texts.failed });
    }
  }

  return (
    <Screen
      area="training"
      icon="calendar"
      title={texts.title}
      intro={texts.intro}
      testID="device-calendar"
      footer={
        <Button
          label={texts.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings' as Href))}
        />
      }
    >
      <Card>
        <Body muted testID="device-calendar-privacy">
          {texts.privacy}
        </Body>
      </Card>
      {!hasPlan ? <Notice tone="info">{texts.noPlan}</Notice> : null}
      {deviceCalendar.supported ? (
        <Card>
          <Checkbox
            label={texts.toggle}
            checked={prefs.enabled}
            onChange={(next) => {
              if (busy) return;
              if (next) setExplain(true);
              else void turnOff();
            }}
            testID="device-calendar-toggle"
          />
          {busy ? <LoadingState label={texts.syncing} /> : null}
        </Card>
      ) : (
        <Card>
          <Body testID="device-calendar-web">{texts.web.text}</Body>
          {events.length === 0 ? <Body muted>{texts.web.empty}</Body> : null}
          <Button
            label={texts.web.download}
            onPress={() => void downloadIcs()}
            disabled={events.length === 0}
            testID="device-calendar-download"
          />
        </Card>
      )}
      <ChoiceList
        label={texts.timeLabel}
        options={timeOptions}
        value={prefs.startMinutes === null ? SETUP : String(prefs.startMinutes)}
        onChange={(value) => void chooseTime(value)}
      />
      {message ? (
        <Notice tone={message.tone} testID="device-calendar-message">
          <View style={{ gap: 8 }}>
            <Body>{message.text}</Body>
            {message.settings ? (
              <Button
                label={t.notifications.openSystemSettings}
                variant="secondary"
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              />
            ) : null}
          </View>
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={explain}
        title={texts.permissionTitle}
        message={texts.permissionText}
        confirmLabel={texts.permissionContinue}
        confirmVariant="primary"
        onConfirm={() => void turnOn()}
        onCancel={() => setExplain(false)}
      />
    </Screen>
  );
}
