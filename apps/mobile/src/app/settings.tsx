import {
  ageInYears,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  measurementReminderIntervalSchema,
  nextMeasurementDue,
  suggestLargeView,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { ConsentSettings } from '@/components/consent-settings';
import { useReadAloudVoice } from '@/components/read-aloud';
import { NotificationSettings } from '@/components/notifications';
import { LiveAdjustSettings } from '@/components/live-adjust';
import { EatingHelpNotice } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { CycleSettingsSection } from '@/components/cycle-entry';
import { ListGroup, ListRow, SectionLabel } from '@/components/design';
import { Body, Button, Card, Checkbox, LoadingState, Notice, TextField } from '@/components/ui';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { useAccessibility } from '@/lib/accessibility';
import { useKeepAwakeSetting } from '@/lib/keep-awake';
import { useToday } from '@/lib/use-today';
import { planTitleText } from '@/lib/plan-title';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, lastMeasurementDate } from '@/state/flow';

/**
 * Abmelden, Datenexport und Konto löschen liegen seit dem 18.10.2026 unter „Mein Konto“ (`/konto`,
 * docs/PLAN-DASHBOARD.md 2.3); die Einwilligungen teilen sich beide Stellen (components/consent-settings.tsx).
 */
type DialogKind = 'clear' | 'recreate' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const app = useApp();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const keepAwake = useKeepAwakeSetting();
  const accessibility = useAccessibility();
  const readAloudVoice = useReadAloudVoice();
  const today = useToday();
  const [reminderEnabled, setReminderEnabled] = useState(app.rows?.reminder?.enabled ?? true);
  const [interval, setIntervalText] = useState(
    String(app.rows?.reminder?.interval_days ?? MEASUREMENT_REMINDER_INTERVAL_DAYS.default),
  );
  const [reminderError, setReminderError] = useState<string>();
  const [reminderSaved, setReminderSaved] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [numbersSaving, setNumbersSaving] = useState(false);
  const [numbersMessage, setNumbersMessage] = useState<string>();
  const { ensureNutritionLibrary } = app;
  const supportsNutrition = app.backend.supportsNutrition;
  useEffect(() => {
    // Testmodus: ob Beispiel-Rezepte angeboten werden, hängt vom Bündel ab.
    if (supportsNutrition) void ensureNutritionLibrary();
  }, [ensureNutritionLibrary, supportsNutrition]);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows?.profile) {
    return <Redirect href="/" />;
  }
  const rows = app.rows;
  const birthDate = rows.profile?.birth_date ?? null;
  const ageYears = birthDate && birthDate <= today ? ageInYears(birthDate, today) : null;
  const healthStatus = healthConsentStatus(rows, app.versions);
  const currentPlan = activePlan(rows)?.plan ?? null;
  const setup = app.answers.nutritionSetup;
  const nutritionLib = app.nutritionLibrary.kind === 'ready' ? app.nutritionLibrary.result : null;

  async function setShowNumbers(value: boolean) {
    if (!setup) return;
    setNumbersSaving(true);
    setNumbersMessage(undefined);
    try {
      await app.saveStep({
        step: 'nutrition_setup',
        setup: { ...setup, showEnergyNumbers: value },
      });
      setNumbersMessage(t.nutrition.settings.showNumbersSaved);
    } catch (caught) {
      setNumbersMessage(errorText(caught));
    } finally {
      setNumbersSaving(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setDialogError(undefined);
    try {
      if (dialog === 'clear') {
        await app.clearDeviceData();
        setDialog(null);
        router.replace('/welcome');
      } else if (dialog === 'recreate') {
        const outcome = await app.createPlan();
        if (outcome.ok) {
          setMessage(t.settings.planCreated);
          setDialog(null);
        } else {
          setDialogError(createPlanErrorText(outcome.code));
        }
      }
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder() {
    setReminderSaved(false);
    const parsed = measurementReminderIntervalSchema.safeParse(Number(interval));
    if (interval.trim() === '' || !parsed.success) {
      setReminderError(
        parsed.success ? 'Bitte eine Zahl eingeben.' : parsed.error.issues[0]?.message,
      );
      return;
    }
    setReminderError(undefined);
    setSavingReminder(true);
    try {
      const last = lastMeasurementDate(rows);
      await app.saveReminder(
        { enabled: reminderEnabled, intervalDays: parsed.data },
        last ? nextMeasurementDue(last, parsed.data) : null,
      );
      setReminderSaved(true);
    } catch (caught) {
      setReminderError(errorText(caught));
    } finally {
      setSavingReminder(false);
    }
  }

  const reminder = rows.reminder;
  const dialogTexts =
    dialog === 'recreate'
      ? {
          title: t.plan.recreateTitle,
          text: t.plan.recreateText,
          confirm: t.plan.recreateConfirm,
        }
      : {
          title: t.settings.clearTitle,
          text: t.settings.clearText,
          confirm: t.settings.clearConfirm,
        };

  return (
    <Screen
      area="training"
      icon="settings"
      title={t.settings.title}
      testID="settings"
      footer={
        <Button
          label={t.settings.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {message ? <Notice tone="success">{message}</Notice> : null}

      <SectionLabel>{t.settings.training}</SectionLabel>
      {currentPlan ? <Body>{planTitleText(currentPlan)}</Body> : null}
      <Body muted>{t.settings.trainingText}</Body>
      <ListGroup>
        {/* Öffnet die vorhandenen Onboarding-Schritte und kehrt danach zu „Heute“ zurück (Plan neu erstellen?). */}
        <ListRow
          icon="edit"
          label={t.settings.editInputs}
          onPress={() => router.push('/onboarding/experience?edit=1')}
        />
        {healthStatus === 'valid' ? (
          <ListRow
            icon="shield"
            label={t.settings.repeatScreening}
            onPress={() => router.push('/onboarding/health_screening?edit=1')}
          />
        ) : null}
        <ListRow
          icon="dumbbell"
          label={t.settings.recreatePlan}
          role="button"
          onPress={() => {
            setDialogError(undefined);
            setDialog('recreate');
          }}
        />
        {/* Phase 10 WP4: Wettkampf mit Ampel, Countdown und Wettkampfplan. */}
        <ListRow
          icon="trophy"
          label={t.competition.settingsLink}
          accessibilityHint={t.competition.settingsLinkHint}
          onPress={() => router.push('/wettkampf' as Href)}
          testID="settings-competition"
          last
        />
      </ListGroup>
      {healthStatus === 'valid' ? null : (
        <Body muted>{t.settings.repeatScreeningNeedsConsent}</Body>
      )}

      {/* Etappe Z5: Abnehm-Ziel nur hier sichtbar (docs/PLAN-ZIELE.md F13) – nur bei Abnehmen als Haupt- oder Nebenziel. */}
      {rows.goals &&
      (rows.goals.goal_type === 'fat_loss' || rows.goals.secondary_goal_type === 'fat_loss') ? (
        <>
          <SectionLabel>{t.weightGoalLife.settings.title}</SectionLabel>
          <ListGroup>
            <ListRow
              icon="scale"
              label={t.weightGoalLife.settings.open}
              description={t.weightGoalLife.settings.entryText}
              onPress={() => router.push('/abnehmziel' as Href)}
              testID="settings-weight-goal"
              last
            />
          </ListGroup>
        </>
      ) : null}

      {supportsNutrition ? (
        <>
          <SectionLabel>{t.nutrition.settings.title}</SectionLabel>
          <Body muted>{t.nutrition.settings.text}</Body>
          <ListGroup>
            <ListRow
              icon="utensils"
              label={t.nutrition.settings.open}
              onPress={() => router.dismissTo('/ernaehrung' as Href)}
              testID="settings-nutrition-open"
            />
            <ListRow
              icon="edit"
              label={t.nutrition.settings.edit}
              onPress={() => router.push('/onboarding/nutrition?edit=1' as Href)}
              testID="settings-nutrition-edit"
            />
            <ListRow
              icon="settings"
              label={t.nutrition.settings.setup}
              onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
              testID="settings-nutrition-setup"
            />
            <ListRow
              icon="recipe"
              label={t.nutrition.foodDislikes.open}
              description={t.nutrition.foodDislikes.settingsText}
              onPress={() => router.push('/ernaehrung/abneigungen' as Href)}
              testID="settings-food-dislikes"
              last
            />
          </ListGroup>
          {setup ? (
            <Card>
              <Checkbox
                label={t.nutrition.settings.showNumbers}
                checked={setup.showEnergyNumbers}
                onChange={(value) => void setShowNumbers(value)}
                testID="settings-show-numbers"
              />
              <Body muted>{t.nutrition.setup.showNumbersHint}</Body>
              {numbersSaving ? <LoadingState /> : null}
              {numbersMessage ? <Body muted>{numbersMessage}</Body> : null}
            </Card>
          ) : null}
          <EatingHelpNotice />
        </>
      ) : null}

      {/* Phase 6 SU4: Supplemente – „Meine Supplements“ und Supplement-Check ändern. */}
      <SectionLabel>{t.supplements.title}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="pill"
          label={t.supplements.mine.title}
          onPress={() => router.push('/supplemente' as Href)}
          testID="settings-supplements"
          last={healthStatus !== 'valid'}
        />
        {healthStatus === 'valid' ? (
          <ListRow
            icon="edit"
            label={t.supplements.check.redo}
            onPress={() => router.push('/supplemente/check' as Href)}
            testID="settings-supplement-check"
            last
          />
        ) : null}
      </ListGroup>

      <SectionLabel>{t.glossary.settingsTitle}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="book"
          label={t.glossary.allExercises}
          description={t.glossary.settingsText}
          onPress={() => router.push('/uebungen' as Href)}
          testID="settings-glossary"
          last={!app.backend.supportsExercisePreferences}
        />
        {app.backend.supportsExercisePreferences ? (
          <ListRow
            icon="dumbbell"
            label={t.exclusions.title}
            description={t.exclusions.settingsText}
            onPress={() => router.push('/ausgeschlossene-uebungen' as Href)}
            testID="settings-exclusions"
            last
          />
        ) : null}
      </ListGroup>

      {/* Phase 8: Smartwatch (Galaxy Watch über Health Connect). */}
      <SectionLabel>{t.wearables.settingsTitle}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="stopwatch"
          label={t.wearables.settingsLink}
          description={t.wearables.settingsText}
          onPress={() => router.push('/smartwatch' as Href)}
          testID="settings-smartwatch"
          last
        />
      </ListGroup>

      {/* Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4): opt-in, eigener Kalender. */}
      <SectionLabel>{t.deviceCalendar.settingsTitle}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="calendar"
          label={t.deviceCalendar.settingsLink}
          description={t.deviceCalendar.settingsText}
          onPress={() => router.push('/handy-kalender' as Href)}
          testID="settings-device-calendar"
          last
        />
      </ListGroup>

      {/* Phase 9: Zyklus-Modul (sichtbar, wenn angeboten oder schon eingeschaltet – auch nach Wechsel auf „männlich“). */}
      <CycleSettingsSection onPress={() => router.push('/zyklus/einstellungen' as Href)} />

      {/* Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5): nur dieses Gerät; nach Smartwatch und Zyklus. */}
      <SectionLabel>{t.accessibility.section}</SectionLabel>
      <Card>
        {!accessibility.settings.largeView &&
        suggestLargeView({ ageYears, goalType: rows.goals?.goal_type ?? null }) ? (
          <Notice tone="info" testID="settings-large-view-suggestion">
            {t.accessibility.largeViewSuggestion}
          </Notice>
        ) : null}
        <Checkbox
          label={t.accessibility.largeView}
          checked={accessibility.settings.largeView}
          onChange={(value) =>
            void accessibility.update({ largeView: value }).catch(() => undefined)
          }
          testID="settings-large-view"
        />
        <Body muted>{t.accessibility.largeViewHint}</Body>
        {readAloudVoice === null ? (
          <Body muted testID="settings-read-aloud-unavailable">
            {t.accessibility.readAloudUnavailable}
          </Body>
        ) : readAloudVoice ? (
          <>
            <Checkbox
              label={t.accessibility.readAloud}
              checked={accessibility.settings.readAloud}
              onChange={(value) =>
                void accessibility.update({ readAloud: value }).catch(() => undefined)
              }
              testID="settings-read-aloud"
            />
            <Body muted>{t.accessibility.readAloudHint}</Body>
          </>
        ) : null}
      </Card>

      {/* Mein Konto (docs/PLAN-DASHBOARD.md 2.3): Abmelden, Datenexport, Konto löschen. */}
      <SectionLabel>{t.settings.account}</SectionLabel>
      <ListGroup>
        <ListRow
          icon="user"
          label={t.konto.settingsLink}
          description={t.konto.settingsLinkText}
          onPress={() => router.push('/konto' as Href)}
          testID="settings-account"
        />
        {/* Etappe E4a: Namensnennung der Nährwert-Quellen (BLS, Open Food Facts). */}
        <ListRow
          icon="info"
          label={t.foodProduct.licenses.open}
          onPress={() => router.push('/lizenzen' as Href)}
          testID="settings-licenses"
          last
        />
      </ListGroup>

      <ConsentSettings rows={rows} />

      <SectionLabel>{t.settings.screen}</SectionLabel>
      <Card>
        <Checkbox
          label={t.settings.keepAwake}
          checked={keepAwake.enabled}
          onChange={(value) => void keepAwake.setEnabled(value).catch(() => undefined)}
          testID="settings-keep-awake"
        />
        <Body muted>{t.settings.keepAwakeHint}</Body>
      </Card>

      <SectionLabel>{t.settings.reminder}</SectionLabel>
      <Card>
        <Checkbox
          label={t.settings.reminderEnabled}
          checked={reminderEnabled}
          onChange={(value) => {
            setReminderEnabled(value);
            setReminderSaved(false);
          }}
        />
        <TextField
          label={t.settings.reminderInterval}
          value={interval}
          onChangeText={(text) => {
            setIntervalText(text.replace(/\D/g, '').slice(0, 2));
            setReminderSaved(false);
          }}
          keyboardType="number-pad"
          error={reminderError}
        />
        <Body muted>
          {!reminder?.enabled
            ? reminder
              ? t.settings.reminderOff
              : t.settings.reminderNoDate
            : reminder.next_due_on
              ? t.settings.reminderNext(formatDateDe(reminder.next_due_on))
              : t.settings.reminderNoDate}
        </Body>
        {reminderSaved ? <Notice tone="success">{t.settings.reminderSaved}</Notice> : null}
        <Button
          label={t.common.save}
          variant="secondary"
          onPress={() => void saveReminder()}
          loading={savingReminder}
        />
      </Card>

      {/* Etappe E (docs/PLAN-PHASE-4B.md 8.1 Nr. 4): lokale Benachrichtigungen; im Browser nur ein Hinweis. */}
      <NotificationSettings rows={rows} />
      {/* Live-Anpassung (Phase 4b, Etappe D): Schalter „Premium simulieren“ nur im Testmodus (Wächter K2). */}
      <LiveAdjustSettings />

      {app.backend.mode === 'local' ? (
        <>
          <SectionLabel>{t.settings.testMode}</SectionLabel>
          <Card>
            <Body muted>{t.settings.testModeText}</Body>
            {nutritionLib && (nutritionLib.demoAvailable || nutritionLib.demo) ? (
              <>
                <Body muted>{t.nutrition.settings.demoText}</Body>
                <Checkbox
                  label={t.nutrition.demoUse}
                  checked={nutritionLib.demo}
                  onChange={(value) => void app.setNutritionDemo(value)}
                  testID="settings-nutrition-demo"
                />
              </>
            ) : null}
          </Card>
          {/* Destruktiv: rot und abgesetzt in eigener Gruppe, immer mit Rückfrage. */}
          <ListGroup>
            <ListRow
              icon="trash"
              label={t.settings.clearTestData}
              role="button"
              tone="danger"
              onPress={() => {
                setDialogError(undefined);
                setDialog('clear');
              }}
              last
            />
          </ListGroup>
        </>
      ) : null}

      <ConfirmDialog
        visible={dialog !== null}
        title={dialogTexts.title}
        message={dialogTexts.text}
        confirmLabel={dialogTexts.confirm}
        confirmVariant={dialog === 'recreate' ? 'primary' : 'danger'}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
        loading={busy}
        error={dialogError}
        testID={dialog ? `dialog-${dialog}` : undefined}
      />
    </Screen>
  );
}
