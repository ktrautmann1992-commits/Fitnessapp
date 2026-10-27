import {
  ageInYears,
  BARBELL_BAR_PRESETS_KG,
  BARBELL_DEFAULT_BAR_KG,
  BARBELL_ID,
  createGoalStepSchema,
  goalPairBlockReason,
  hasGoal,
  isAllowedGoalPair,
  DEFAULT_SLOT_MINUTES,
  ENDURANCE_DISCIPLINES,
  EQUIPMENT,
  EQUIPMENT_LIMITS,
  HOME_SELECTABLE_EQUIPMENT,
  equipmentItemSchema,
  SELECTABLE_GOAL_TYPES,
  MINUTE_PRESETS,
  OTHER_EQUIPMENT_ID,
  scheduleHints,
  slotMinutesSchema,
  suggestedSlotKind,
  suggestedTrainingSlots,
  TRAINING_LIMITS,
  TRAINING_SLOT_KINDS,
  trainingScheduleSchema,
  weeklySessionCap,
  weightPresetsFor,
  weightStepKgSchema,
  type EnduranceDiscipline,
  type EquipmentId,
  type EquipmentItemInput,
  type GoalType,
  type TrainingScheduleMode,
  type TrainingSlotKind,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateInput, Screen, StepFooter } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  Heading,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { t } from '@/i18n';
import { datePartsFromIso, formatKg, isoFromDateParts, parseDecimal } from '@/lib/format';
import { scheduleSummaryText, slotKindLabel } from '@/lib/summary';
import { useThemeColors } from '@/lib/theme';
import { fieldErrorsFromIssues, type FieldErrors } from '@/lib/validation-errors';
import { healthConsentStatus } from '@/state/flow';

import type { StepController } from './use-step';
import { Text } from '@/components/text';

/** Nebenziel-Auswahl: „kein zweites Ziel“ oder ein Ziel (Tabelle 4.2). */
type SecondaryChoice = GoalType | 'none';

export function GoalStep({ ctl }: { ctl: StepController }) {
  const router = useRouter();
  const g = t.steps.goal;
  const saved = ctl.app.answers.goal;
  const [goalType, setGoalType] = useState<GoalType | undefined>(saved?.goalType);
  const [secondary, setSecondary] = useState<GoalType | null>(
    saved?.goalType !== undefined && isAllowedGoalPair(saved.goalType, saved.secondaryGoalType)
      ? (saved.secondaryGoalType ?? null)
      : null,
  );
  const [discipline, setDiscipline] = useState<EnduranceDiscipline | null>(
    saved?.discipline ?? null,
  );
  const [date, setDate] = useState(() => datePartsFromIso(saved?.targetDate));
  const [errors, setErrors] = useState<FieldErrors>({});

  const hasEndurance = goalType === 'endurance' || secondary === 'endurance';
  const losesWeight =
    goalType !== undefined && hasGoal({ primary: goalType, secondary }, 'fat_loss');
  const consentValid =
    ctl.app.rows !== null && healthConsentStatus(ctl.app.rows, ctl.app.versions) === 'valid';

  function choosePrimary(value: GoalType) {
    setGoalType(value);
    // Ein Nebenziel bleibt, solange es zum neuen Hauptziel passt (Tabelle 4.2); sonst entfällt es.
    if (secondary !== null && !isAllowedGoalPair(value, secondary)) setSecondary(null);
  }

  function next() {
    const anyDatePart = date.day + date.month + date.year !== '';
    const targetDate =
      hasEndurance && anyDatePart ? isoFromDateParts(date.day, date.month, date.year) : null;
    if (hasEndurance && anyDatePart && targetDate === null) {
      setErrors({ targetDate: t.age.incomplete });
      return;
    }
    const parsed = createGoalStepSchema(ctl.today).safeParse({
      goalType,
      secondaryGoalType: secondary,
      discipline: hasEndurance ? discipline : null,
      targetDate,
    });
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues(parsed.error.issues, {
          goalType: g.required,
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
        secondaryGoalType: parsed.data.secondaryGoalType,
        discipline: parsed.data.discipline ?? null,
        targetDate: parsed.data.targetDate ?? null,
      },
    });
  }

  const combination =
    goalType !== undefined && secondary !== null
      ? g.combinations[`${goalType}>${secondary}`]
      : undefined;

  return (
    <Screen
      title={g.title}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      <ChoiceList
        label={g.primaryLabel}
        options={SELECTABLE_GOAL_TYPES.map((value) => ({
          value,
          label: g.options[value],
          description: g.descriptions[value],
        }))}
        value={goalType}
        onChange={choosePrimary}
        error={errors.goalType}
      />
      {goalType !== undefined ? (
        <View style={{ gap: spacing.sm }} testID="goal-secondary">
          <ChoiceList<SecondaryChoice>
            label={g.secondaryLabel}
            horizontal
            options={[
              { value: 'none', label: g.noSecondary },
              ...SELECTABLE_GOAL_TYPES.filter((value) => value !== goalType).map((value) => {
                const reason = goalPairBlockReason(goalType, value);
                const name = g.options[value];
                return {
                  value,
                  label: name,
                  description: reason === null ? undefined : g.blockedReasons[reason],
                  disabled: reason !== null,
                  accessibilityLabel:
                    reason === null
                      ? g.secondaryA11y(name)
                      : g.secondaryBlockedA11y(name, g.blockedReasons[reason]),
                  testID: `goal-secondary-${value}`,
                };
              }),
            ]}
            value={secondary ?? 'none'}
            onChange={(value) => setSecondary(value === 'none' ? null : value)}
            error={errors.secondaryGoalType}
          />
          <Body muted>{g.secondaryIntro}</Body>
          {combination ? (
            <Notice testID="goal-combination">
              <Body>{combination}</Body>
            </Notice>
          ) : null}
        </View>
      ) : null}
      {hasEndurance ? (
        <Card>
          {goalType !== 'endurance' ? <Body muted>{g.enduranceSecondary}</Body> : null}
          <ChoiceList
            label={g.discipline}
            horizontal
            options={ENDURANCE_DISCIPLINES.map((value) => ({
              value,
              label: g.disciplines[value],
            }))}
            value={discipline}
            onChange={(value) => setDiscipline(value === discipline ? null : value)}
            error={errors.discipline}
          />
          <DateInput
            label={g.targetDate}
            value={date}
            onChange={setDate}
            error={errors.targetDate}
          />
          {/* Phase 10 WP4: Wettkampf mit Ampel und Plan unter „Mein Wettkampf“ (das Datum wird dort vorgeschlagen). */}
          <Body muted testID="goal-competition-hint">
            {g.targetDateHint}
          </Body>
        </Card>
      ) : null}
      {losesWeight && !consentValid ? (
        // Ohne Einwilligung Gesundheitsdaten kein Wunschgewicht (Plan 2.3): gesperrt mit Erklärung und Abhilfe.
        <Notice title={g.weightGoalLockedTitle} testID="goal-weight-goal-locked">
          <Body>{g.weightGoalLocked}</Body>
          <Button
            label={g.weightGoalLockedButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
        </Notice>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Schritt „Deine Trainingstage“ (ersetzt Zeitbudget + Trainingsort; Erweiterungsplan Abschnitt 3.2)
// ---------------------------------------------------------------------------------------------------------

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const MAX_SESSIONS = TRAINING_LIMITS.sessionsPerWeek.max;

/** Dauer als Eingabe: Vorschlag angetippt oder „Eigene“ mit Textfeld. */
interface MinutesDraft {
  text: string;
  custom: boolean;
}

interface DayDraft {
  kind: TrainingSlotKind;
  minutes: MinutesDraft;
}

interface FlexDraft {
  count: number;
  minutes: MinutesDraft;
}

function minutesDraft(minutes: number): MinutesDraft {
  return {
    text: String(minutes),
    custom: !(MINUTE_PRESETS as readonly number[]).includes(minutes),
  };
}

function minutesValue(draft: MinutesDraft): number | undefined {
  return parseDecimal(draft.text) ?? undefined;
}

function MinutesPicker({
  label,
  value,
  onChange,
  error,
}: {
  /** Bezug für Screenreader, z. B. „Montag“ oder „Kraft im Studio“. */
  label: string;
  value: MinutesDraft;
  onChange: (value: MinutesDraft) => void;
  error?: string | undefined;
}) {
  const ts = t.steps.trainingSchedule;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.chipRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {MINUTE_PRESETS.map((preset) => (
          <OptionButton
            key={preset}
            role="radio"
            compact
            label={ts.minutesShort(preset)}
            accessibilityLabel={`${label}: ${ts.minutesLong(preset)}`}
            selected={!value.custom && value.text === String(preset)}
            onPress={() => onChange({ text: String(preset), custom: false })}
          />
        ))}
        <OptionButton
          role="radio"
          compact
          label={ts.ownMinutes}
          accessibilityLabel={`${label}: ${ts.ownMinutes}`}
          selected={value.custom}
          onPress={() => onChange({ text: value.custom ? value.text : '', custom: true })}
        />
      </View>
      {value.custom ? (
        <TextField
          label={`${label}: ${ts.ownMinutesField}`}
          value={value.text}
          onChangeText={(text) =>
            onChange({ text: text.replace(/\D/g, '').slice(0, 3), custom: true })
          }
          keyboardType="number-pad"
        />
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

function CounterButton({
  symbol,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  symbol: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.counterButton,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.counterSymbol, { color: theme.text }]}>{symbol}</Text>
    </Pressable>
  );
}

function KindPicker({
  label,
  value,
  discipline,
  onChange,
}: {
  label: string;
  value: TrainingSlotKind;
  discipline: EnduranceDiscipline | null;
  onChange: (kind: TrainingSlotKind) => void;
}) {
  const ts = t.steps.trainingSchedule;
  return (
    <View style={styles.chipRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {TRAINING_SLOT_KINDS.map((kind) => (
        <OptionButton
          key={kind}
          role="radio"
          compact
          label={ts.kinds[kind]}
          description={kind === 'endurance' ? slotKindLabel(kind, discipline, 'short') : undefined}
          accessibilityLabel={`${label}: ${slotKindLabel(kind, discipline, 'long')}`}
          selected={value === kind}
          onPress={() => onChange(kind)}
        />
      ))}
    </View>
  );
}

export function TrainingScheduleStep({ ctl }: { ctl: StepController }) {
  const theme = useThemeColors();
  const ts = t.steps.trainingSchedule;
  const { answers } = ctl.app;
  const saved = answers.trainingSchedule;
  const goalType = answers.goal?.goalType;
  // Nebenziel (Etappe Z4): Ausdauer als Nebenziel belegt Ausdauer-Tage vor (Hauptziel zuerst, Plan 4.3).
  const secondaryGoalType = answers.goal?.secondaryGoalType ?? null;
  const discipline =
    goalType === 'endurance' || secondaryGoalType === 'endurance'
      ? (answers.goal?.discipline ?? null)
      : null;
  const screening = answers.healthScreening;
  const ageYears = answers.birthDate ? ageInYears(answers.birthDate, ctl.today) : null;
  // Vorsichtig = ohne Gesundheits-Check oder mit Flag (wie die Plan-Engine).
  const cautious = !screening || screening.flags.length > 0;

  // Ziel Ausdauer: Ausdauer-Tage vorbelegen – NUR, solange noch keine Trainingstage gewählt sind (nie überschreiben).
  const [suggestion, setSuggestion] = useState(() =>
    saved
      ? null
      : suggestedTrainingSlots({
          goalType,
          secondaryGoalType,
          discipline,
          experienceLevel: answers.experienceLevel,
          ageYears,
          cautious,
        }),
  );
  const initial = saved ?? suggestion;
  // Sportarten Stufe 1 · Etappe R (Gründer-Entscheidung 27.10.2026): „Im Studio auch rudern“ – ausdrückliche Angabe,
  // gespeichert als Gerät `rowing_machine` mit Ort Studio. Standard aus; gesendet wird nur eine Änderung.
  const storedGymRowing = (answers.equipment ?? []).some(
    (item) => item.location === 'gym' && item.equipmentId === 'rowing_machine',
  );
  const [gymRowing, setGymRowing] = useState(storedGymRowing);

  const [mode, setMode] = useState<TrainingScheduleMode>(initial?.mode ?? 'fixed');
  const [days, setDays] = useState<number[]>(() =>
    initial?.mode === 'fixed' ? initial.slots.map((slot) => slot.weekday) : [],
  );
  // Eingaben je Tag bleiben gemerkt, auch wenn der Tag abgewählt wird (bis zum Verlassen des Bildschirms).
  const [dayDrafts, setDayDrafts] = useState<Record<number, DayDraft>>(() =>
    initial?.mode === 'fixed'
      ? Object.fromEntries(
          initial.slots.map((slot) => [
            slot.weekday,
            { kind: slot.kind, minutes: minutesDraft(slot.minutes) },
          ]),
        )
      : {},
  );
  const [lastEdited, setLastEdited] = useState<DayDraft | null>(null);
  const [flex, setFlex] = useState<Record<TrainingSlotKind, FlexDraft>>(() => {
    const drafts = Object.fromEntries(
      TRAINING_SLOT_KINDS.map((kind) => [
        kind,
        { count: 0, minutes: minutesDraft(DEFAULT_SLOT_MINUTES[kind]) },
      ]),
    ) as Record<TrainingSlotKind, FlexDraft>;
    if (saved?.mode === 'flex') {
      for (const kind of TRAINING_SLOT_KINDS) {
        const ofKind = saved.slots.filter((slot) => slot.kind === kind);
        const first = ofKind[0];
        if (first) {
          drafts[kind] = { count: ofKind.length, minutes: minutesDraft(first.minutes) };
        }
      }
    }
    return drafts;
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const sortedDays = [...days].sort((a, b) => a - b);

  function draftFor(day: number): DayDraft {
    const existing = dayDrafts[day];
    if (existing) {
      return existing;
    }
    if (lastEdited) {
      return lastEdited;
    }
    const kind = suggestedSlotKind(goalType);
    return { kind, minutes: minutesDraft(DEFAULT_SLOT_MINUTES[kind]) };
  }

  function toggleDay(day: number) {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day));
      return;
    }
    setDayDrafts((prev) => ({ ...prev, [day]: draftFor(day) }));
    setDays([...days, day]);
  }

  function updateDay(day: number, patch: Partial<DayDraft>) {
    const next = { ...draftFor(day), ...patch };
    setDayDrafts((prev) => ({ ...prev, [day]: next }));
    setLastEdited(next);
  }

  function applyToAll(source: number) {
    const draft = draftFor(source);
    setDayDrafts((prev) => ({
      ...prev,
      ...Object.fromEntries(days.map((day) => [day, { ...draft }])),
    }));
  }

  /** „Ohne Vorschlag planen“: vorbelegte Tage und ihre Eingaben verwerfen. */
  function clearSuggestion() {
    setSuggestion(null);
    setDays([]);
    setDayDrafts({});
    setLastEdited(null);
    setErrors({});
  }

  function changeCount(kind: TrainingSlotKind, delta: number) {
    setFlex((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], count: Math.max(0, prev[kind].count + delta) },
    }));
  }

  /** Eingaben → Wochenplan (noch ungeprüft) und Zuordnung Index → Feld für Fehlermeldungen. */
  function buildInput() {
    if (mode === 'fixed') {
      return {
        keys: sortedDays.map((day) => `day.${day}`),
        input: {
          mode,
          slots: sortedDays.map((day) => {
            const draft = draftFor(day);
            return { weekday: day, kind: draft.kind, minutes: minutesValue(draft.minutes) };
          }),
        },
      };
    }
    const kinds = TRAINING_SLOT_KINDS.flatMap((kind) =>
      Array.from({ length: flex[kind].count }, () => kind),
    );
    return {
      keys: kinds.map((kind) => `flex.${kind}`),
      input: {
        mode,
        slots: kinds.map((kind) => ({ kind, minutes: minutesValue(flex[kind].minutes) })),
      },
    };
  }

  const { keys, input } = buildInput();
  const parsed = trainingScheduleSchema.safeParse(input);
  const validSlots = input.slots.flatMap((slot) => {
    const minutes = slotMinutesSchema.safeParse(slot.minutes);
    return minutes.success ? [{ ...slot, minutes: minutes.data }] : [];
  });
  const flexTotal = TRAINING_SLOT_KINDS.reduce((sum, kind) => sum + flex[kind].count, 0);
  const hints = parsed.success
    ? scheduleHints(parsed.data, {
        goalType,
        secondaryGoalType,
        weeklySessionCap: weeklySessionCap({
          experienceLevel: answers.experienceLevel,
          ageYears,
          cautious,
        }),
      })
    : [];

  function next() {
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const [, index] = issue.path;
        const key = typeof index === 'number' ? (keys[index] ?? 'form') : 'form';
        nextErrors[key] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    void ctl.submit({
      step: 'time_budget',
      schedule: parsed.data,
      ...(gymRowing !== storedGymRowing ? { gymRowing } : {}),
    });
  }

  return (
    <Screen
      title={ts.title}
      intro={ts.intro}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      {suggestion ? (
        <Notice testID="schedule-suggestion">
          <Body>{ts.enduranceSuggestion}</Body>
          <Button label={ts.clearSuggestion} variant="secondary" onPress={clearSuggestion} />
        </Notice>
      ) : null}
      <ChoiceList
        label={ts.modeLabel}
        options={(['fixed', 'flex'] as const).map((value) => ({
          value,
          label: ts.modes[value],
        }))}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setErrors({});
        }}
      />

      {mode === 'fixed' ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <Body>{ts.days}</Body>
            <View style={styles.chipRow}>
              {WEEKDAYS.map((day) => (
                <OptionButton
                  key={day}
                  role="checkbox"
                  compact
                  label={ts.weekdays[day - 1] ?? ''}
                  accessibilityLabel={ts.weekdaysLong[day - 1]}
                  selected={days.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </View>
            {days.length === 0 ? <Body muted>{ts.noDays}</Body> : null}
          </View>
          {sortedDays.map((day, index) => {
            const draft = draftFor(day);
            const name = ts.weekdaysLong[day - 1] ?? '';
            return (
              <Card key={day}>
                <Heading level={2}>{name}</Heading>
                <Body muted>{ts.what}</Body>
                <KindPicker
                  label={name}
                  value={draft.kind}
                  discipline={discipline}
                  onChange={(kind) => updateDay(day, { kind })}
                />
                <Body muted>{ts.howLong}</Body>
                <MinutesPicker
                  label={name}
                  value={draft.minutes}
                  onChange={(minutes) => updateDay(day, { minutes })}
                  error={errors[`day.${day}`]}
                />
                {index === 0 && days.length > 1 ? (
                  <Button
                    label={ts.applyToAll}
                    variant="secondary"
                    onPress={() => applyToAll(day)}
                  />
                ) : null}
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Body muted>{ts.flexIntro}</Body>
          {TRAINING_SLOT_KINDS.map((kind) => {
            const draft = flex[kind];
            const name = slotKindLabel(kind, discipline, 'long');
            return (
              <Card key={kind}>
                <View style={styles.counterRow}>
                  <Text style={[styles.counterLabel, { color: theme.text }]}>{name}</Text>
                  <View style={styles.counter}>
                    <CounterButton
                      symbol="−"
                      accessibilityLabel={ts.decrease(name)}
                      disabled={draft.count === 0}
                      onPress={() => changeCount(kind, -1)}
                    />
                    <Text
                      style={[styles.counterValue, { color: theme.text }]}
                      accessibilityLabel={`${name}: ${ts.countValue(draft.count)}`}
                    >
                      {ts.countValue(draft.count)}
                    </Text>
                    <CounterButton
                      symbol="+"
                      accessibilityLabel={ts.increase(name)}
                      disabled={flexTotal >= MAX_SESSIONS}
                      onPress={() => changeCount(kind, 1)}
                    />
                  </View>
                </View>
                {draft.count > 0 ? (
                  <>
                    <Body muted>{ts.perSession}</Body>
                    <MinutesPicker
                      label={name}
                      value={draft.minutes}
                      onChange={(minutes) =>
                        setFlex((prev) => ({ ...prev, [kind]: { ...prev[kind], minutes } }))
                      }
                      error={errors[`flex.${kind}`]}
                    />
                  </>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
      <FieldError message={errors.form} />

      {/* Etappe R: nur mit Studio-Tagen (oder schon eingeschaltet, damit man es wieder ausschalten kann). */}
      {input.slots.some((slot) => slot.kind === 'strength_gym') || gymRowing ? (
        <Card>
          <Checkbox
            label={t.rowing.gymOption}
            checked={gymRowing}
            onChange={setGymRowing}
            testID="schedule-gym-rowing"
          />
          <Body muted>{t.rowing.gymOptionHint}</Body>
        </Card>
      ) : null}

      <Notice tone="success" title={ts.summaryTitle} testID="schedule-summary">
        {scheduleSummaryText(validSlots, discipline)}
      </Notice>
      {hints.length > 0 ? (
        <Notice tone="info" title={ts.hintsTitle} testID="schedule-hints">
          {hints.map((hint) => (
            <Body key={hint}>{`• ${ts.hints[hint]}`}</Body>
          ))}
        </Notice>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Equipment zu Hause: Gewichte zum Antippen + eigene Werte (Erweiterungsplan Abschnitt 3.3)
// ---------------------------------------------------------------------------------------------------------

interface EquipmentDraft {
  selected: boolean;
  weights: number[];
  weightInput: string;
  note: string;
  /** Nur Langhantel: Stange als Vorschlag (barCustom false) oder eigene Eingabe. */
  barKg: number;
  barCustom: boolean;
  barInput: string;
}

const MAX_STEPS_MESSAGE = t.steps.equipment.tooMany(EQUIPMENT_LIMITS.maxWeightSteps);

export function EquipmentStep({ ctl }: { ctl: StepController }) {
  const theme = useThemeColors();
  const te = t.steps.equipment;
  const saved = ctl.app.answers.equipment ?? [];
  const [drafts, setDrafts] = useState<Record<EquipmentId, EquipmentDraft>>(
    () =>
      Object.fromEntries(
        EQUIPMENT.map((item) => {
          const existing = saved.find((s) => s.equipmentId === item.id && s.location === 'home');
          const barKg = existing?.barKg ?? BARBELL_DEFAULT_BAR_KG;
          const barCustom = !(BARBELL_BAR_PRESETS_KG as readonly number[]).includes(barKg);
          return [
            item.id,
            {
              selected: existing !== undefined,
              weights: existing?.weightsKg ?? [],
              weightInput: '',
              note: existing?.note ?? '',
              barKg,
              barCustom,
              barInput: barCustom ? formatKg(barKg) : '',
            },
          ];
        }),
      ) as Record<EquipmentId, EquipmentDraft>,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (id: EquipmentId, patch: Partial<EquipmentDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  /** Prüft eine neue Gewichtsliste mit dem Schema aus packages/core (Anzahl, Scheiben ≤ 25 kg …). */
  function weightsError(id: EquipmentId, weights: number[]): string | undefined {
    if (weights.length > EQUIPMENT_LIMITS.maxWeightSteps) {
      return MAX_STEPS_MESSAGE;
    }
    const parsed = equipmentItemSchema.safeParse({
      equipmentId: id,
      location: 'home',
      weightsKg: weights,
    });
    return parsed.success ? undefined : fieldErrorsFromIssues(parsed.error.issues).weightsKg;
  }

  function setWeights(id: EquipmentId, weights: number[], patch: Partial<EquipmentDraft> = {}) {
    const sorted = [...weights].sort((a, b) => a - b);
    const error = weightsError(id, sorted);
    if (error) {
      setErrors((prev) => ({ ...prev, [`${id}.weight`]: error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [`${id}.weight`]: '' }));
    update(id, { weights: sorted, ...patch });
  }

  function toggleWeight(id: EquipmentId, kg: number) {
    const current = drafts[id].weights;
    setWeights(id, current.includes(kg) ? current.filter((w) => w !== kg) : [...current, kg]);
  }

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
    if (draft.weights.includes(parsed.data)) {
      update(id, { weightInput: '' });
      return;
    }
    setWeights(id, [...draft.weights, parsed.data], { weightInput: '' });
  }

  function next() {
    const items: EquipmentItemInput[] = [];
    const nextErrors: FieldErrors = {};
    for (const item of HOME_SELECTABLE_EQUIPMENT) {
      const draft = drafts[item.id];
      if (!draft.selected) {
        continue;
      }
      const isBarbell = item.id === BARBELL_ID;
      const barKg = draft.barCustom ? (parseDecimal(draft.barInput) ?? undefined) : draft.barKg;
      const parsed = equipmentItemSchema.safeParse({
        equipmentId: item.id,
        location: 'home',
        weightsKg: item.hasWeights ? draft.weights : [],
        note: item.id === OTHER_EQUIPMENT_ID ? draft.note.trim() || null : null,
        ...(isBarbell ? { barKg } : {}),
      });
      if (parsed.success) {
        items.push(parsed.data);
      } else {
        const fieldErrors = fieldErrorsFromIssues(parsed.error.issues, {
          barKg: 'Stange: bitte eine Zahl eingeben.',
        });
        nextErrors[`${item.id}.note`] = fieldErrors.note ?? '';
        nextErrors[`${item.id}.weight`] = fieldErrors.weightsKg ?? '';
        nextErrors[`${item.id}.bar`] = fieldErrors.barKg ?? '';
      }
    }
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    void ctl.submit({ step: 'equipment', items });
  }

  const nothingSelected = HOME_SELECTABLE_EQUIPMENT.every((item) => !drafts[item.id].selected);

  return (
    <Screen
      title={te.title}
      intro={te.intro}
      progress={ctl.progress}
      footer={
        <StepFooter onBack={ctl.goBack} onNext={next} loading={ctl.saving} error={ctl.error} />
      }
    >
      {/* Nur Geräte für zu Hause – Studio-Geräte (Kabelzug, Maschinen …) erscheinen hier nicht. */}
      {HOME_SELECTABLE_EQUIPMENT.map((item) => {
        const draft = drafts[item.id];
        const presets = weightPresetsFor(item.id);
        const custom = draft.weights.filter((kg) => !presets.includes(kg));
        const isBarbell = item.id === BARBELL_ID;
        const hint = (te.weightsHint as Partial<Record<string, string>>)[item.id];
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
                {isBarbell ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>{te.bar}</Text>
                    <Body muted>{te.barHint}</Body>
                    <View
                      style={styles.chipRow}
                      accessibilityRole="radiogroup"
                      accessibilityLabel={`${item.nameDe}: ${te.bar}`}
                    >
                      {BARBELL_BAR_PRESETS_KG.map((kg) => (
                        <OptionButton
                          key={kg}
                          role="radio"
                          compact
                          label={te.weightChip(formatKg(kg))}
                          accessibilityLabel={`${te.bar}: ${formatKg(kg)} kg`}
                          selected={!draft.barCustom && draft.barKg === kg}
                          onPress={() => update(item.id, { barKg: kg, barCustom: false })}
                        />
                      ))}
                      <OptionButton
                        role="radio"
                        compact
                        label={te.ownBar}
                        accessibilityLabel={`${te.bar}: ${te.ownBar}`}
                        selected={draft.barCustom}
                        onPress={() => update(item.id, { barCustom: true })}
                      />
                    </View>
                    {draft.barCustom ? (
                      <TextField
                        label={te.ownBarField}
                        value={draft.barInput}
                        onChangeText={(text) => update(item.id, { barInput: text })}
                        keyboardType="decimal-pad"
                      />
                    ) : null}
                    <FieldError message={errors[`${item.id}.bar`] || undefined} />
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>{te.plates}</Text>
                  </View>
                ) : (
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>
                    {`${item.nameDe}: ${te.weights}`}
                  </Text>
                )}
                {hint ? <Body muted>{hint}</Body> : null}
                <View style={styles.chipRow}>
                  {presets.map((kg) => (
                    <OptionButton
                      key={kg}
                      role="checkbox"
                      compact
                      filled
                      label={te.weightChip(formatKg(kg))}
                      accessibilityLabel={te.weightChipLabel(item.nameDe, formatKg(kg))}
                      selected={draft.weights.includes(kg)}
                      onPress={() => toggleWeight(item.id, kg)}
                    />
                  ))}
                  {/* Eigene Werte: zusätzliche, ausgewählte Chips mit „✕“ zum Entfernen. */}
                  {custom.map((kg) => (
                    <Pressable
                      key={kg}
                      accessibilityRole="button"
                      accessibilityLabel={te.removeWeight(formatKg(kg))}
                      onPress={() => toggleWeight(item.id, kg)}
                      style={[
                        styles.weightChip,
                        { borderColor: theme.primary, backgroundColor: theme.primary },
                      ]}
                    >
                      <Text style={[styles.weightText, { color: theme.primaryText }]}>
                        {`✓ ${formatKg(kg)} kg  ✕`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.selectedRow}>
                  <Body muted>{te.selectedCount(draft.weights.length)}</Body>
                  {draft.weights.length > 0 ? (
                    <Button
                      label={te.clearAll}
                      variant="secondary"
                      accessibilityLabel={te.clearAllLabel(item.nameDe)}
                      onPress={() => setWeights(item.id, [])}
                    />
                  ) : null}
                </View>
                <View style={styles.addRow}>
                  <TextField
                    label={`${item.nameDe}: ${te.weightInput}`}
                    hint={te.ownWeights}
                    value={draft.weightInput}
                    onChangeText={(text) => update(item.id, { weightInput: text })}
                    keyboardType="decimal-pad"
                    onSubmitEditing={() => addWeight(item.id)}
                    style={{ flex: 1 }}
                  />
                  <View style={styles.addButton}>
                    <Button
                      label={te.addWeight}
                      variant="secondary"
                      accessibilityLabel={`${item.nameDe}: ${te.addWeight}`}
                      onPress={() => addWeight(item.id)}
                    />
                  </View>
                </View>
                <FieldError message={errors[`${item.id}.weight`] || undefined} />
              </Card>
            ) : null}
            {draft.selected && item.id === OTHER_EQUIPMENT_ID ? (
              <TextField
                label={te.otherNote}
                placeholder={te.otherNotePlaceholder}
                value={draft.note}
                onChangeText={(text) => update(item.id, { note: text })}
                maxLength={200}
                error={errors[`${item.id}.note`] || undefined}
              />
            ) : null}
          </View>
        );
      })}
      {nothingSelected ? <Notice tone="info">{te.empty}</Notice> : null}
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
  weightText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  selectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  addButton: { paddingBottom: 2 },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  counterLabel: { flexShrink: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counterButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterSymbol: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  counterValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
