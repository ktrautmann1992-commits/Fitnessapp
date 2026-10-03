import {
  createGoalStepSchema,
  ENDURANCE_DISCIPLINES,
  EQUIPMENT,
  equipmentItemSchema,
  GOAL_TYPES,
  OTHER_EQUIPMENT_ID,
  TRAINING_LIMITS,
  TRAINING_LOCATIONS,
  timeBudgetStepSchema,
  trainingLocationStepSchema,
  weightStepKgSchema,
  type EnduranceDiscipline,
  type EquipmentId,
  type EquipmentItemInput,
  type GoalType,
  type TrainingLocation,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateInput, Screen, StepFooter } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  FieldError,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { t } from '@/i18n';
import { datePartsFromIso, formatKg, isoFromDateParts, parseDecimal } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { fieldErrorsFromIssues, type FieldErrors } from '@/lib/validation-errors';

import type { StepController } from './use-step';

export function GoalStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.goal;
  const [goalType, setGoalType] = useState<GoalType | undefined>(saved?.goalType);
  const [discipline, setDiscipline] = useState<EnduranceDiscipline | null>(
    saved?.discipline ?? null,
  );
  const [date, setDate] = useState(() => datePartsFromIso(saved?.targetDate));
  const [errors, setErrors] = useState<FieldErrors>({});

  function next() {
    const isEndurance = goalType === 'endurance';
    const anyDatePart = date.day + date.month + date.year !== '';
    const targetDate =
      isEndurance && anyDatePart ? isoFromDateParts(date.day, date.month, date.year) : null;
    if (isEndurance && anyDatePart && targetDate === null) {
      setErrors({ targetDate: t.age.incomplete });
      return;
    }
    const parsed = createGoalStepSchema(ctl.today).safeParse({
      goalType,
      discipline: isEndurance ? discipline : null,
      targetDate,
    });
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          goalType: t.steps.goal.required,
          targetDate: t.age.invalid,
        }),
      );
      return;
    }
    setErrors({});
    void ctl.submit({
      step: 'goal',
      goal: {
        goalType: parsed.data.goalType,
        discipline: parsed.data.discipline ?? null,
        targetDate: parsed.data.targetDate ?? null,
      },
    });
  }

  return (
    <Screen
      title={t.steps.goal.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        options={GOAL_TYPES.map((value) => ({ value, label: t.steps.goal.options[value] }))}
        value={goalType}
        onChange={setGoalType}
        error={errors.goalType}
      />
      {goalType === 'endurance' ? (
        <Card>
          <ChoiceList
            label={t.steps.goal.discipline}
            horizontal
            options={ENDURANCE_DISCIPLINES.map((value) => ({
              value,
              label: t.steps.goal.disciplines[value],
            }))}
            value={discipline}
            onChange={(value) => setDiscipline(value === discipline ? null : value)}
            error={errors.discipline}
          />
          <DateInput
            label={t.steps.goal.targetDate}
            value={date}
            onChange={setDate}
            error={errors.targetDate}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const SESSION_OPTIONS = Array.from(
  { length: TRAINING_LIMITS.sessionsPerWeek.max - TRAINING_LIMITS.sessionsPerWeek.min + 1 },
  (_, index) => TRAINING_LIMITS.sessionsPerWeek.min + index,
);
const MINUTE_PRESETS = [20, 30, 45, 60, 90];

export function TimeBudgetStep({ ctl }: { ctl: StepController }) {
  const saved = ctl.app.answers.timeBudget;
  const [sessions, setSessions] = useState<number | undefined>(saved?.sessionsPerWeek);
  const [minutes, setMinutes] = useState(saved ? String(saved.minutesPerSession) : '');
  const [days, setDays] = useState<number[]>(saved?.preferredDays ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function next() {
    const parsed = timeBudgetStepSchema.safeParse({
      sessionsPerWeek: sessions,
      minutesPerSession: parseDecimal(minutes) ?? undefined,
      preferredDays: [...days].sort((a, b) => a - b),
    });
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          sessionsPerWeek: t.steps.timeBudget.sessionsRequired,
          minutesPerSession: 'Minuten pro Einheit: bitte eine Zahl eingeben.',
        }),
      );
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'time_budget', timeBudget: parsed.data });
  }

  return (
    <Screen
      title={t.steps.timeBudget.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        label={t.steps.timeBudget.sessions}
        horizontal
        options={SESSION_OPTIONS.map((value) => ({ value, label: String(value) }))}
        value={sessions}
        onChange={setSessions}
        error={errors.sessionsPerWeek}
      />
      <TextField
        label={t.steps.timeBudget.minutes}
        hint={t.steps.timeBudget.minutesHint}
        value={minutes}
        onChangeText={(text) => setMinutes(text.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        error={errors.minutesPerSession}
      />
      <View style={styles.chipRow}>
        {MINUTE_PRESETS.map((preset) => (
          <OptionButton
            key={preset}
            role="radio"
            compact
            label={`${preset} min`}
            accessibilityLabel={`${preset} Minuten`}
            selected={minutes === String(preset)}
            onPress={() => setMinutes(String(preset))}
          />
        ))}
      </View>
      <View style={{ gap: spacing.xs }}>
        <Body>{t.steps.timeBudget.days}</Body>
        <Body muted>{t.steps.timeBudget.daysHint}</Body>
        <View style={styles.chipRow}>
          {t.steps.timeBudget.weekdays.map((short, index) => (
            <OptionButton
              key={short}
              role="checkbox"
              compact
              label={short}
              accessibilityLabel={t.steps.timeBudget.weekdaysLong[index]}
              selected={days.includes(index + 1)}
              onPress={() => toggleDay(index + 1)}
            />
          ))}
        </View>
        <FieldError message={errors.preferredDays} />
      </View>
    </Screen>
  );
}

export function TrainingLocationStep({ ctl }: { ctl: StepController }) {
  const [location, setLocation] = useState<TrainingLocation | undefined>(
    ctl.app.answers.trainingLocation,
  );
  const [fieldError, setFieldError] = useState<string>();

  function next() {
    const parsed = trainingLocationStepSchema.safeParse({ trainingLocation: location });
    if (!parsed.success) {
      setFieldError(t.steps.trainingLocation.required);
      return;
    }
    void ctl.submit({ step: 'training_location', trainingLocation: parsed.data.trainingLocation });
  }

  return (
    <Screen
      title={t.steps.trainingLocation.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        options={TRAINING_LOCATIONS.map((value) => ({
          value,
          label: t.steps.trainingLocation.options[value],
        }))}
        value={location}
        onChange={setLocation}
        error={fieldError}
      />
    </Screen>
  );
}

interface EquipmentDraft {
  selected: boolean;
  weights: number[];
  weightInput: string;
  note: string;
}

export function EquipmentStep({ ctl }: { ctl: StepController }) {
  const theme = useThemeColors();
  const saved = ctl.app.answers.equipment ?? [];
  const [drafts, setDrafts] = useState<Record<EquipmentId, EquipmentDraft>>(
    () =>
      Object.fromEntries(
        EQUIPMENT.map((item) => {
          const existing = saved.find((s) => s.equipmentId === item.id && s.location === 'home');
          return [
            item.id,
            {
              selected: existing !== undefined,
              weights: existing?.weightsKg ?? [],
              weightInput: '',
              note: existing?.note ?? '',
            },
          ];
        }),
      ) as Record<EquipmentId, EquipmentDraft>,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (id: EquipmentId, patch: Partial<EquipmentDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  function addWeight(id: EquipmentId) {
    const draft = drafts[id];
    const parsed = weightStepKgSchema.safeParse(parseDecimal(draft.weightInput) ?? undefined);
    if (!parsed.success) {
      setErrors((prev) => ({
        ...prev,
        [`${id}.weight`]:
          fieldErrorsFromIssues(parsed.error.issues, {
            _form: 'Gewichtsstufe: bitte eine Zahl eingeben.',
          })._form ?? 'Gewichtsstufe: bitte eine Zahl eingeben.',
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, [`${id}.weight`]: '' }));
    if (!draft.weights.includes(parsed.data)) {
      update(id, {
        weights: [...draft.weights, parsed.data].sort((a, b) => a - b),
        weightInput: '',
      });
    } else {
      update(id, { weightInput: '' });
    }
  }

  function next() {
    const items: EquipmentItemInput[] = [];
    const nextErrors: FieldErrors = {};
    for (const item of EQUIPMENT) {
      const draft = drafts[item.id];
      if (!draft.selected) {
        continue;
      }
      const parsed = equipmentItemSchema.safeParse({
        equipmentId: item.id,
        location: 'home',
        weightsKg: item.hasWeights ? draft.weights : [],
        note: item.id === OTHER_EQUIPMENT_ID ? draft.note.trim() || null : null,
      });
      if (parsed.success) {
        items.push(parsed.data);
      } else {
        const fieldErrors = fieldErrorsFromIssues(parsed.error.issues);
        nextErrors[`${item.id}.note`] = fieldErrors.note ?? '';
        nextErrors[`${item.id}.weight`] = fieldErrors.weightsKg ?? '';
      }
    }
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'equipment', items });
  }

  const nothingSelected = EQUIPMENT.every((item) => !drafts[item.id].selected);

  return (
    <Screen
      title={t.steps.equipment.title}
      intro={t.steps.equipment.intro}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      {EQUIPMENT.map((item) => {
        const draft = drafts[item.id];
        return (
          <View key={item.id} style={{ gap: spacing.sm }}>
            <OptionButton
              role="checkbox"
              label={item.nameDe}
              selected={draft.selected}
              onPress={() => update(item.id, { selected: !draft.selected })}
            />
            {draft.selected && item.hasWeights ? (
              <Card>
                <Body>{`${item.nameDe}: ${t.steps.equipment.weights}`}</Body>
                {draft.weights.length === 0 ? (
                  <Body muted>{t.steps.equipment.noWeights}</Body>
                ) : (
                  <View style={styles.chipRow}>
                    {draft.weights.map((kg) => (
                      <Pressable
                        key={kg}
                        accessibilityRole="button"
                        accessibilityLabel={t.steps.equipment.removeWeight(formatKg(kg))}
                        onPress={() =>
                          update(item.id, { weights: draft.weights.filter((w) => w !== kg) })
                        }
                        style={[styles.weightChip, { borderColor: theme.primary }]}
                      >
                        <Text style={[styles.weightText, { color: theme.text }]}>
                          {`${formatKg(kg)} kg  ✕`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={styles.addRow}>
                  <TextField
                    label={`${item.nameDe}: ${t.steps.equipment.weightInput}`}
                    value={draft.weightInput}
                    onChangeText={(text) => update(item.id, { weightInput: text })}
                    keyboardType="decimal-pad"
                    onSubmitEditing={() => addWeight(item.id)}
                    style={{ flex: 1 }}
                  />
                  <View style={styles.addButton}>
                    <Button
                      label={t.steps.equipment.addWeight}
                      variant="secondary"
                      accessibilityLabel={`${item.nameDe}: ${t.steps.equipment.addWeight}`}
                      onPress={() => addWeight(item.id)}
                    />
                  </View>
                </View>
                <FieldError message={errors[`${item.id}.weight`] || undefined} />
              </Card>
            ) : null}
            {draft.selected && item.id === OTHER_EQUIPMENT_ID ? (
              <TextField
                label={t.steps.equipment.otherNote}
                placeholder={t.steps.equipment.otherNotePlaceholder}
                value={draft.note}
                onChangeText={(text) => update(item.id, { note: text })}
                maxLength={200}
                error={errors[`${item.id}.note`] || undefined}
              />
            ) : null}
          </View>
        );
      })}
      {nothingSelected ? <Notice tone="info">{t.steps.equipment.empty}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  weightChip: {
    minHeight: 44,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  weightText: { fontSize: fontSize.md },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  addButton: { paddingBottom: 2 },
});
