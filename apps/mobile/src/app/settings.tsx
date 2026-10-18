import {
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  measurementReminderIntervalSchema,
  nextMeasurementDue,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { ConsentSettings } from '@/components/consent-settings';
import { EatingHelpNotice } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { createPlanErrorText, errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { useKeepAwakeSetting } from '@/lib/keep-awake';
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

      <Heading level={2}>{t.settings.training}</Heading>
      <Card>
        {currentPlan ? <Body>{planTitleText(currentPlan)}</Body> : null}
        <Body muted>{t.settings.trainingText}</Body>
        {/* Öffnet die vorhandenen Onboarding-Schritte und kehrt danach zu „Heute“ zurück (Plan neu erstellen?). */}
        <Button
          label={t.settings.editInputs}
          variant="secondary"
          onPress={() => router.push('/onboarding/experience?edit=1')}
        />
        {healthStatus === 'valid' ? (
          <Button
            label={t.settings.repeatScreening}
            variant="secondary"
            onPress={() => router.push('/onboarding/health_screening?edit=1')}
          />
        ) : (
          <Body muted>{t.settings.repeatScreeningNeedsConsent}</Body>
        )}
        <Button
          label={t.settings.recreatePlan}
          variant="secondary"
          onPress={() => {
            setDialogError(undefined);
            setDialog('recreate');
          }}
        />
        {/* Phase 10 WP4: Wettkampf mit Ampel, Countdown und Wettkampfplan. */}
        <Button
          label={t.competition.settingsLink}
          variant="secondary"
          accessibilityHint={t.competition.settingsLinkHint}
          onPress={() => router.push('/wettkampf' as Href)}
          testID="settings-competition"
        />
      </Card>

      {/* Etappe Z5: Abnehm-Ziel nur hier sichtbar (docs/PLAN-ZIELE.md F13) – nur bei Abnehmen als Haupt- oder Nebenziel. */}
      {rows.goals &&
      (rows.goals.goal_type === 'fat_loss' || rows.goals.secondary_goal_type === 'fat_loss') ? (
        <>
          <Heading level={2}>{t.weightGoalLife.settings.title}</Heading>
          <Card>
            <Body muted>{t.weightGoalLife.settings.entryText}</Body>
            <Button
              label={t.weightGoalLife.settings.open}
              variant="secondary"
              onPress={() => router.push('/abnehmziel' as Href)}
              testID="settings-weight-goal"
            />
          </Card>
        </>
      ) : null}

      {supportsNutrition ? (
        <>
          <Heading level={2}>{t.nutrition.settings.title}</Heading>
          <Card>
            <Body muted>{t.nutrition.settings.text}</Body>
            <Button
              label={t.nutrition.settings.open}
              variant="secondary"
              onPress={() => router.push('/ernaehrung' as Href)}
              testID="settings-nutrition-open"
            />
            <Button
              label={t.nutrition.settings.edit}
              variant="secondary"
              onPress={() => router.push('/onboarding/nutrition?edit=1' as Href)}
              testID="settings-nutrition-edit"
            />
            <Button
              label={t.nutrition.settings.setup}
              variant="secondary"
              onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
              testID="settings-nutrition-setup"
            />
            <Body muted>{t.nutrition.foodDislikes.settingsText}</Body>
            <Button
              label={t.nutrition.foodDislikes.open}
              variant="secondary"
              onPress={() => router.push('/ernaehrung/abneigungen' as Href)}
              testID="settings-food-dislikes"
            />
            {setup ? (
              <>
                <Checkbox
                  label={t.nutrition.settings.showNumbers}
                  checked={setup.showEnergyNumbers}
                  onChange={(value) => void setShowNumbers(value)}
                  testID="settings-show-numbers"
                />
                <Body muted>{t.nutrition.setup.showNumbersHint}</Body>
                {numbersSaving ? <LoadingState /> : null}
                {numbersMessage ? <Body muted>{numbersMessage}</Body> : null}
              </>
            ) : null}
          </Card>
          <EatingHelpNotice />
        </>
      ) : null}

      <Heading level={2}>{t.glossary.settingsTitle}</Heading>
      <Card>
        <Body muted>{t.glossary.settingsText}</Body>
        <Button
          label={t.glossary.allExercises}
          variant="secondary"
          onPress={() => router.push('/uebungen' as Href)}
          testID="settings-glossary"
        />
        {app.backend.supportsExercisePreferences ? (
          <>
            <Body muted>{t.exclusions.settingsText}</Body>
            <Button
              label={t.exclusions.title}
              variant="secondary"
              onPress={() => router.push('/ausgeschlossene-uebungen' as Href)}
              testID="settings-exclusions"
            />
          </>
        ) : null}
      </Card>

      {/* Etappe E4a: Namensnennung der Nährwert-Quellen (BLS, Open Food Facts). */}
      <Card>
        <Button
          label={t.foodProduct.licenses.open}
          variant="secondary"
          onPress={() => router.push('/lizenzen' as Href)}
          testID="settings-licenses"
        />
      </Card>

      {/* Mein Konto (docs/PLAN-DASHBOARD.md 2.3): Abmelden, Datenexport, Konto löschen. */}
      <Heading level={2}>{t.settings.account}</Heading>
      <Card>
        <Body muted>{t.konto.settingsLinkText}</Body>
        <Button
          label={t.konto.settingsLink}
          variant="secondary"
          onPress={() => router.push('/konto' as Href)}
          testID="settings-account"
        />
      </Card>

      <ConsentSettings rows={rows} />

      <Heading level={2}>{t.settings.screen}</Heading>
      <Card>
        <Checkbox
          label={t.settings.keepAwake}
          checked={keepAwake.enabled}
          onChange={(value) => void keepAwake.setEnabled(value).catch(() => undefined)}
          testID="settings-keep-awake"
        />
        <Body muted>{t.settings.keepAwakeHint}</Body>
      </Card>

      <Heading level={2}>{t.settings.reminder}</Heading>
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

      {app.backend.mode === 'local' ? (
        <>
          <Heading level={2}>{t.settings.testMode}</Heading>
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
            <Button
              label={t.settings.clearTestData}
              variant="danger"
              onPress={() => {
                setDialogError(undefined);
                setDialog('clear');
              }}
            />
          </Card>
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
