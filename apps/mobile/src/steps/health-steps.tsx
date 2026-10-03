import {
  bodyMetricsStepSchema,
  createBodyMeasurementsInputSchema,
  createHealthScreeningAnswersSchema,
  evaluateHealthScreening,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  MEASUREMENT_SITES,
  requiresMedicalNotice,
  screeningQuestionsFor,
  type HealthScreeningAnswers,
  type MeasurementSiteId,
} from '@fitnessapp/core';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, StepFooter } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  Heading,
  Notice,
  TextField,
} from '@/components/ui';
import { t } from '@/i18n';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { FORM_ERROR, fieldErrorsFromIssues, type FieldErrors } from '@/lib/validation-errors';

import type { StepController } from './use-step';

/**
 * Gesundheitsdaten (Art. 9 DSGVO): Diese Schritte erscheinen nur mit Einwilligung health_data
 * (isStepApplicable in packages/core). Werte werden nie geloggt.
 */

export function BodyMetricsStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.bodyMetrics;
  const [values, setValues] = useState({
    heightCm: formatDecimal(saved?.heightCm),
    weightKg: formatDecimal(saved?.weightKg),
    bodyFatPct: formatDecimal(saved?.bodyFatPct),
    restingHeartRateBpm: formatDecimal(saved?.restingHeartRateBpm),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (key: keyof typeof values) => (text: string) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  function next() {
    const input = {
      heightCm: parseDecimal(values.heightCm) ?? undefined,
      weightKg: parseDecimal(values.weightKg) ?? undefined,
      bodyFatPct: parseDecimal(values.bodyFatPct),
      restingHeartRateBpm: parseDecimal(values.restingHeartRateBpm),
    };
    const parsed = bodyMetricsStepSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          heightCm: 'Größe: bitte eine Zahl eingeben.',
          weightKg: 'Gewicht: bitte eine Zahl eingeben.',
        }),
      );
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'body_metrics', value: parsed.data, measuredOn: ctl.today });
  }

  return (
    <Screen
      title={t.steps.bodyMetrics.title}
      intro={t.steps.bodyMetrics.intro}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <TextField
        label={t.steps.bodyMetrics.height}
        value={values.heightCm}
        onChangeText={set('heightCm')}
        keyboardType="decimal-pad"
        error={errors.heightCm}
      />
      <TextField
        label={t.steps.bodyMetrics.weight}
        value={values.weightKg}
        onChangeText={set('weightKg')}
        keyboardType="decimal-pad"
        hint={t.steps.bodyMetrics.decimalHint}
        error={errors.weightKg}
      />
      <TextField
        label={t.steps.bodyMetrics.bodyFat}
        value={values.bodyFatPct}
        onChangeText={set('bodyFatPct')}
        keyboardType="decimal-pad"
        error={errors.bodyFatPct}
      />
      <TextField
        label={t.steps.bodyMetrics.restingHeartRate}
        value={values.restingHeartRateBpm}
        onChangeText={set('restingHeartRateBpm')}
        keyboardType="number-pad"
        error={errors.restingHeartRateBpm}
      />
    </Screen>
  );
}

export function BodyMeasurementsStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.bodyMeasurements;
  const [values, setValues] = useState<Record<MeasurementSiteId, string>>(
    () =>
      Object.fromEntries(
        MEASUREMENT_SITES.map((site) => [site.id, formatDecimal(saved?.[site.id] ?? null)]),
      ) as Record<MeasurementSiteId, string>,
  );
  const [reminder, setReminder] = useState(ctl.app.rows?.reminder?.enabled ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const interval =
    ctl.app.rows?.reminder?.interval_days ?? MEASUREMENT_REMINDER_INTERVAL_DAYS.default;

  function next() {
    const input: Record<string, number | null> = {};
    for (const site of MEASUREMENT_SITES) {
      input[site.id] = parseDecimal(values[site.id]);
    }
    const parsed = createBodyMeasurementsInputSchema(ctl.today).safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }
    setErrors({});
    void ctl.submit({
      step: 'body_measurements',
      value: parsed.data,
      measuredOn: ctl.today,
      reminderEnabled: reminder,
    });
  }

  function skip() {
    setErrors({});
    void ctl.submit({
      step: 'body_measurements',
      value: null,
      measuredOn: ctl.today,
      reminderEnabled: reminder,
    });
  }

  return (
    <Screen
      title={t.steps.bodyMeasurements.title}
      intro={t.steps.bodyMeasurements.intro}
      progress={ctl.progress}
      footer={
        <StepFooter
          onBack={ctl.goBack}
          onNext={next}
          loading={ctl.saving}
          error={ctl.error ?? errors[FORM_ERROR]}
          extra={
            <Button
              label={t.common.skip}
              variant="secondary"
              onPress={skip}
              disabled={ctl.saving}
            />
          }
        />
      }
    >
      <Notice tone="info">{t.steps.bodyMeasurements.general}</Notice>
      {MEASUREMENT_SITES.map((site) => (
        <TextField
          key={site.id}
          label={`${site.nameDe} (${t.steps.bodyMeasurements.unit})`}
          hint={site.instructionDe}
          value={values[site.id]}
          onChangeText={(text) => setValues((prev) => ({ ...prev, [site.id]: text }))}
          keyboardType="decimal-pad"
          error={errors[site.id]}
        />
      ))}
      <Card>
        <Heading level={2}>{t.steps.bodyMeasurements.reminderTitle}</Heading>
        <Body muted>{t.steps.bodyMeasurements.reminderText(interval)}</Body>
        <Checkbox
          label={t.steps.bodyMeasurements.reminderToggle}
          checked={reminder}
          onChange={setReminder}
        />
      </Card>
    </Screen>
  );
}

type Answer = 'yes' | 'no';

export function HealthScreeningStep({ ctl }: { ctl: StepController }) {
  const sex = ctl.app.answers.sex;
  const questions = screeningQuestionsFor(sex);
  const saved = ctl.app.answers.healthScreening?.answers;
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>(() =>
    Object.fromEntries(
      questions.map((q) => {
        const value = saved?.[q.id as keyof HealthScreeningAnswers];
        return [q.id, value === undefined ? undefined : value ? 'yes' : 'no'];
      }),
    ),
  );
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<HealthScreeningAnswers | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [noticeError, setNoticeError] = useState<string>();

  function toAnswers(): HealthScreeningAnswers | null {
    const candidate = Object.fromEntries(
      questions.flatMap((q) => {
        const value = answers[q.id];
        return value === undefined ? [] : [[q.id, value === 'yes']];
      }),
    );
    const parsed = createHealthScreeningAnswersSchema(sex).safeParse(candidate);
    if (!parsed.success) {
      setMissing(new Set(questions.filter((q) => answers[q.id] === undefined).map((q) => q.id)));
      return null;
    }
    setMissing(new Set());
    return parsed.data;
  }

  function next() {
    const parsed = toAnswers();
    if (!parsed) {
      return;
    }
    // Flags nur für die sofortige Anzeige des Arzt-Hinweises; gespeichert berechnet sie die Datenbank selbst.
    if (requiresMedicalNotice(evaluateHealthScreening(parsed))) {
      setNotice(parsed);
      setAcknowledged(false);
      return;
    }
    void ctl.submit({ step: 'health_screening', answers: parsed, acknowledgedAt: null });
  }

  function confirmNotice() {
    if (!notice) {
      return;
    }
    if (!acknowledged) {
      setNoticeError(t.steps.healthScreening.noticeMissing);
      return;
    }
    setNoticeError(undefined);
    void ctl.submit({
      step: 'health_screening',
      answers: notice,
      acknowledgedAt: new Date().toISOString(),
    });
  }

  if (notice) {
    return (
      <Screen
        title={t.steps.healthScreening.noticeTitle}
        progress={ctl.progress}
        testID="medical-notice"
        footer={
          <StepFooter
            onBack={() => setNotice(null)}
            onNext={confirmNotice}
            nextLabel={t.steps.healthScreening.noticeConfirm}
            loading={ctl.saving}
            error={ctl.error}
          />
        }
      >
        <Notice tone="warning" title={t.steps.healthScreening.noticeTitle}>
          {t.steps.healthScreening.noticeText}
        </Notice>
        <Checkbox
          label={t.steps.healthScreening.noticeCheckbox}
          checked={acknowledged}
          onChange={(value) => {
            setAcknowledged(value);
            setNoticeError(undefined);
          }}
          error={noticeError}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t.steps.healthScreening.title}
      intro={t.steps.healthScreening.intro}
      progress={ctl.progress}
      footer={
        <StepFooter
          onBack={ctl.goBack}
          onNext={next}
          loading={ctl.saving}
          error={ctl.error ?? (missing.size > 0 ? t.steps.healthScreening.unanswered : undefined)}
        />
      }
    >
      {questions.map((question, index) => (
        <View key={question.id} style={{ gap: 4 }}>
          <Body>{`${index + 1}. ${question.textDe}`}</Body>
          <ChoiceList
            groupLabel={question.textDe}
            horizontal
            options={[
              { value: 'yes', label: t.common.yes },
              { value: 'no', label: t.common.no },
            ]}
            value={answers[question.id]}
            onChange={(value: Answer) => {
              setAnswers((prev) => ({ ...prev, [question.id]: value }));
              setMissing((prev) => {
                const next = new Set(prev);
                next.delete(question.id);
                return next;
              });
            }}
          />
          <FieldError
            message={missing.has(question.id) ? t.steps.healthScreening.unanswered : undefined}
          />
        </View>
      ))}
    </Screen>
  );
}
