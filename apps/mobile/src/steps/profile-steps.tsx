import {
  EXPERIENCE_LEVELS,
  experienceStepSchema,
  SEX_OPTIONS,
  sexStepSchema,
  type ExperienceLevel,
  type Sex,
} from '@fitnessapp/core';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, StepFooter } from '@/components/screen';
import { Body, Button, Card, Checkbox, ChoiceList, Heading, Notice } from '@/components/ui';
import type { ConsentDocument } from '@/data/types';
import { t } from '@/i18n';
import { healthConsentStatus, type HealthConsentStatus } from '@/state/flow';

import type { StepController } from './use-step';

export function SexStep({ ctl }: { ctl: StepController }) {
  const { answers } = ctl.app;
  const [sex, setSex] = useState<Sex | undefined>(answers.sex);
  const [cycle, setCycle] = useState<boolean | null>(answers.cycleModuleInterest ?? null);
  const [fieldError, setFieldError] = useState<string>();

  function next() {
    const parsed = sexStepSchema.safeParse({
      sex,
      cycleModuleInterest: sex === 'female' ? cycle : null,
    });
    if (!parsed.success) {
      setFieldError(t.steps.sex.required);
      return;
    }
    setFieldError(undefined);
    void ctl.submit({
      step: 'sex',
      sex: parsed.data.sex,
      cycleModuleInterest: parsed.data.cycleModuleInterest ?? null,
    });
  }

  return (
    <Screen
      title={t.steps.sex.title}
      intro={t.steps.sex.intro}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        options={SEX_OPTIONS.map((value) => ({ value, label: t.steps.sex.options[value] }))}
        value={sex}
        onChange={setSex}
        error={fieldError}
      />
      {sex === 'female' ? (
        <Card>
          <ChoiceList
            label={t.steps.sex.cycleQuestion}
            horizontal
            options={[
              { value: 'yes', label: t.common.yes },
              { value: 'no', label: t.common.no },
            ]}
            value={cycle === null ? null : cycle ? 'yes' : 'no'}
            onChange={(value) => setCycle(value === 'yes')}
          />
          <Body muted>{t.steps.sex.cycleHint}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}

/** Einwilligungstext health_data mit Häkchen (nicht vorausgewählt). Auch aus den Einstellungen genutzt. */
export function HealthConsentContent({
  document,
  status,
  checked,
  onCheck,
  checkError,
}: {
  document: ConsentDocument | undefined;
  status: HealthConsentStatus;
  checked: boolean;
  onCheck: (value: boolean) => void;
  checkError?: string | undefined;
}) {
  return (
    <>
      {status === 'outdated' ? (
        <Notice tone="warning" title={t.steps.healthConsent.reconsentTitle}>
          {t.steps.healthConsent.reconsentIntro}
        </Notice>
      ) : null}
      <Card>
        {document ? (
          <>
            <Heading level={2}>{document.title}</Heading>
            <Body muted>{t.baseConsents.version(document.version)}</Body>
            <Body>{document.body}</Body>
          </>
        ) : (
          <Notice tone="warning">{t.consentText.notFound}</Notice>
        )}
      </Card>
      {status === 'valid' ? (
        <Notice tone="success">
          {t.steps.healthConsent.alreadyGranted(document?.version ?? 1)}
        </Notice>
      ) : (
        <Checkbox
          label={t.steps.healthConsent.checkbox}
          checked={checked}
          onChange={onCheck}
          error={checkError}
        />
      )}
    </>
  );
}

export function HealthConsentStep({ ctl }: { ctl: StepController }) {
  const { app } = ctl;
  const status = app.rows ? healthConsentStatus(app.rows, app.versions) : 'none';
  const document = app.documents.find((d) => d.type === 'health_data');
  const [checked, setChecked] = useState(false);
  const [checkError, setCheckError] = useState<string>();

  function grant() {
    if (status !== 'valid' && !checked) {
      setCheckError(t.steps.healthConsent.missing);
      return;
    }
    setCheckError(undefined);
    void ctl.submit({ step: 'health_consent', granted: true });
  }

  return (
    <Screen
      title={t.steps.healthConsent.title}
      intro={t.steps.healthConsent.intro}
      progress={ctl.progress}
      footer={
        <StepFooter
          onBack={ctl.goBack}
          onNext={grant}
          nextLabel={status === 'valid' ? t.common.next : t.steps.healthConsent.grant}
          loading={ctl.saving}
          error={ctl.error}
          extra={
            status === 'valid' ? null : (
              <Button
                label={t.steps.healthConsent.decline}
                variant="secondary"
                disabled={ctl.saving}
                onPress={() => void ctl.submit({ step: 'health_consent', granted: false })}
              />
            )
          }
        />
      }
    >
      <HealthConsentContent
        document={document}
        status={status}
        checked={checked}
        onCheck={(value) => {
          setChecked(value);
          setCheckError(undefined);
        }}
        checkError={checkError}
      />
      {status === 'valid' ? null : <Notice tone="info">{t.steps.healthConsent.declineHint}</Notice>}
    </Screen>
  );
}

export function ExperienceStep({ ctl }: { ctl: StepController }) {
  const [level, setLevel] = useState<ExperienceLevel | undefined>(ctl.app.answers.experienceLevel);
  const [fieldError, setFieldError] = useState<string>();

  function next() {
    const parsed = experienceStepSchema.safeParse({ experienceLevel: level });
    if (!parsed.success) {
      setFieldError(t.steps.experience.required);
      return;
    }
    void ctl.submit({ step: 'experience', experienceLevel: parsed.data.experienceLevel });
  }

  return (
    <Screen
      title={t.steps.experience.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <View>
        <ChoiceList
          options={EXPERIENCE_LEVELS.map((value) => ({
            value,
            label: t.steps.experience.options[value].label,
            description: t.steps.experience.options[value].text,
          }))}
          value={level}
          onChange={setLevel}
          error={fieldError}
        />
      </View>
    </Screen>
  );
}
