import {
  evaluateWeightGoalInput,
  startOfIsoWeek,
  WEIGHT_GOAL_AMOUNT_MODES,
  WEIGHT_GOAL_TIME_MODES,
  weightGoalAvailability,
  weightGoalOverview,
  weightGoalPeriodEnded,
  type NutritionInputsInput,
  type WeightGoal,
  type WeightGoalAvailability,
  type WeightGoalBlockReason,
  type WeightGoalEvaluation,
  type WeightGoalIssueCode,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FeasibilityScale } from '@/components/feasibility-scale';
import { EatingHelpNotice } from '@/components/nutrition';
import { ConfirmDialog, DateInput, Screen, StepFooter } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  ErrorState,
  FieldError,
  Notice,
  TextField,
} from '@/components/ui';
import { nutritionInputsFromRows, showEnergyNumbers } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { formatKg } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import {
  draftFromWeightGoal,
  EMPTY_WEIGHT_GOAL_DRAFT,
  feasibilityView,
  parseWeightGoalDraft,
  stepWeeks,
  type WeightGoalDraft,
  weightGoalSaveDecision,
} from '@/lib/weight-goal-format';
import { stepRoute } from '@/state/flow';

import type { StepController } from './use-step';

/**
 * Schritt „Wie möchtest du abnehmen?“ (weight_goal, docs/PLAN-ZIELE.md 2, 3.4 und 6 Nr. 2, Etappe Z4): „ohne festes
 * Ziel“ (Standard) oder „mit konkretem Ziel“ – Menge („kg abnehmen“ oder „Zielgewicht“) und Zeitraum („Wochen“ oder
 * „bis Datum“, F9) mit live gerechneter Ampel. Alle Regeln aus packages/core (`weightGoalAvailability`,
 * `evaluateWeightGoalInput`); das konkrete Ziel macht den Plan nie schneller als „ohne festes Ziel“ (F5).
 * Gesundheitsdatum (Art. 9): Schritt nur mit Einwilligung (`isStepApplicable`), Werte nie in Logs/Analytics (K7).
 */

const W = t.steps.weightGoal;
const L = t.weightGoalLife;
type Mode = 'none' | 'concrete';

/** Stand des gespeicherten Ziels heute; bei einem Rechenfehler „none“ (keine Details, keine Gesundheitsdaten in Logs). */
function lifecycleStatus(person: NutritionInputsInput) {
  try {
    return weightGoalOverview(person).status;
  } catch {
    return 'none';
  }
}

/** Eingaben der Ernährungs-Engine für die Ampel (Ruhetag; Trainings der Woche spielen keine Rolle). */
function personInputs(
  rows: StepController['app']['rows'],
  versions: StepController['app']['versions'],
  today: string,
): NutritionInputsInput | null {
  if (!rows) return null;
  return nutritionInputsFromRows(rows, versions, today, startOfIsoWeek(today));
}

function availabilityOf(person: NutritionInputsInput): WeightGoalAvailability | null {
  try {
    return weightGoalAvailability(person);
  } catch {
    // Bewusst ohne Details: keine Gesundheitsdaten in Logs oder Fehlermeldungen.
    return null;
  }
}

function evaluate(
  draft: WeightGoalDraft,
  person: NutritionInputsInput,
):
  | { kind: 'partial' }
  | { kind: 'unreadable'; errors: Readonly<Record<string, string>> }
  | { kind: 'evaluated'; result: WeightGoalEvaluation } {
  const parsed = parseWeightGoalDraft(draft);
  if (parsed.kind !== 'input') return parsed;
  return { kind: 'evaluated', result: evaluateWeightGoalInput(parsed.input, person) };
}

const ISSUE_FIELD: Record<string, string> = { 'amount.kg': 'amount', time: 'time' };

function issueText(code: WeightGoalIssueCode): string {
  return code in W.issues
    ? W.issues[code as keyof typeof W.issues]
    : W.blocked[code as WeightGoalBlockReason];
}

export function WeightGoalStep({ ctl }: { ctl: StepController }) {
  const { rows, versions } = ctl.app;
  // Wächter Z5 N8: nur neu rechnen, wenn sich Angaben oder Tag ändern.
  const person = useMemo(
    () => personInputs(rows, versions, ctl.today),
    [rows, versions, ctl.today],
  );
  if (person === null) {
    return (
      <Screen title={W.title} progress={ctl.progress}>
        <Notice tone="warning">{W.noGoal}</Notice>
        <Button
          label={t.common.back}
          variant="secondary"
          onPress={() => ctl.goBack?.()}
          disabled={!ctl.goBack}
        />
      </Screen>
    );
  }
  const availability = availabilityOf(person);
  if (availability === null) {
    return (
      <Screen title={W.title} progress={ctl.progress}>
        <ErrorState message={W.loadFailed} onRetry={() => void ctl.app.reload()} />
      </Screen>
    );
  }
  return <WeightGoalForm ctl={ctl} person={person} availability={availability} />;
}

function WeightGoalForm({
  ctl,
  person,
  availability,
}: {
  ctl: StepController;
  person: NutritionInputsInput;
  availability: WeightGoalAvailability;
}) {
  const router = useRouter();
  // „Verlängern“ aus der Karte bzw. den Einstellungen (Etappe Z5, F10): ausdrücklich, nie automatisch.
  const { verlaengern } = useLocalSearchParams<{ verlaengern?: string }>();
  const saved: WeightGoal | null = ctl.app.answers.weightGoal ?? null;
  const currentWeightKg = availability.available ? availability.body.weightKg : null;
  // Gespeichertes Ziel → „mit konkretem Ziel“ (auch wenn es gerade ruht, z. B. Schwangerschaft; dann gesperrt).
  const [mode, setMode] = useState<Mode>(saved !== null ? 'concrete' : 'none');
  const [draft, setDraft] = useState<WeightGoalDraft>(() =>
    saved !== null
      ? draftFromWeightGoal(saved, currentWeightKg, ctl.today)
      : EMPTY_WEIGHT_GOAL_DRAFT,
  );
  const [submitted, setSubmitted] = useState(false);
  const [confirmHidden, setConfirmHidden] = useState(false);
  // Unverändert → „Weiter“ behält das gespeicherte Ziel genau so (Wächter Z4 N10, Etappe Z5).
  const [touched, setTouched] = useState(false);
  // Stand des gespeicherten Ziels heute (erreicht/abgelaufen) – Regel aus packages/core.
  const lifecycle = useMemo(
    () => (saved === null ? 'none' : lifecycleStatus(person)),
    [saved, person],
  );
  const ended = saved !== null && weightGoalPeriodEnded(saved, ctl.today);
  const formNotice =
    saved === null || mode !== 'concrete'
      ? null
      : verlaengern === '1' && ended
        ? L.form.extend
        : lifecycle === 'reached'
          ? L.form.reached
          : ended
            ? L.form.datePassed
            : null;

  const evaluation = mode === 'concrete' ? evaluate(draft, person) : null;
  const rating =
    evaluation?.kind === 'evaluated' && evaluation.result.ok ? evaluation.result.rating : null;
  const view = rating ? feasibilityView(rating) : null;

  // Kein Defizit planbar (S1) und Ziel-BMI zu niedrig sofort zeigen (Wächter Z4 M4), alle anderen Fehler je Feld erst
  // nach „Weiter“, danach live.
  const liveIssue =
    evaluation?.kind === 'evaluated' && !evaluation.result.ok
      ? (evaluation.result.issues.find(
          (issue) => issue.code === 'no_deficit' || issue.code === 'target_bmi_too_low',
        )?.code ?? null)
      : null;
  const fieldErrors: Record<string, string> = {};
  if (liveIssue === 'target_bmi_too_low') fieldErrors.amount = issueText(liveIssue);
  let formError: string | undefined;
  if (submitted && evaluation) {
    if (evaluation.kind === 'partial') {
      formError = W.required;
    } else if (evaluation.kind === 'unreadable') {
      for (const [path, message] of Object.entries(evaluation.errors)) {
        fieldErrors[ISSUE_FIELD[path] ?? 'form'] ??= message;
      }
    } else if (!evaluation.result.ok) {
      for (const issue of evaluation.result.issues) {
        const key = ISSUE_FIELD[issue.path.join('.')] ?? 'form';
        fieldErrors[key] ??= issueText(issue.code);
      }
    }
  }
  formError ??= fieldErrors.form;

  const update = (patch: Partial<WeightGoalDraft>) => {
    setTouched(true);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  function chooseMode(next: Mode) {
    if (next === 'concrete' && mode !== 'concrete' && !showEnergyNumbers(ctl.app.rows)) {
      // Wächter K6: Kalorienzahlen ausgeblendet → ruhige Rückfrage, Standard bleibt „ohne festes Ziel“.
      setConfirmHidden(true);
      return;
    }
    if (next !== mode) setTouched(true);
    setMode(next);
  }

  function next() {
    // Regel „neu / ruht / löschen“ rein und getestet in weightGoalSaveDecision (Plan 2.3).
    const decision = weightGoalSaveDecision({
      mode,
      saved,
      availability,
      evaluated:
        evaluation?.kind === 'evaluated' && evaluation.result.ok ? evaluation.result.goal : null,
      // „Verlängern“ verlangt immer eine neue Eingabe (ausdrücklich, F10).
      pristine: !touched && verlaengern !== '1',
    });
    if (decision.kind === 'invalid') {
      setSubmitted(true);
      return;
    }
    void ctl.submit({ step: 'weight_goal', weightGoal: decision.weightGoal });
  }

  function remedy(reason: WeightGoalBlockReason) {
    const completed = ctl.app.rows?.profile?.onboarding_completed_at != null;
    const edit = (step: 'body_metrics' | 'health_screening') =>
      `${stepRoute(step)}${completed ? '?edit=1' : ''}` as Href;
    if (reason === 'no_consent') router.push('/health-consent');
    else if (reason === 'body_data_missing' || reason === 'weight_outdated') {
      router.push(edit('body_metrics'));
    } else if (reason === 'health_check_missing') router.push(edit('health_screening'));
  }

  const blockedReason = availability.available ? null : availability.reason;
  const remedyLabel =
    blockedReason !== null && blockedReason in W.remedies
      ? W.remedies[blockedReason as keyof typeof W.remedies]
      : null;

  return (
    <Screen
      title={W.title}
      progress={ctl.progress}
      footer={
        <StepFooter
          onBack={ctl.goBack}
          onNext={next}
          {...(ctl.returnTo !== null ? { nextLabel: L.form.saveButton } : {})}
          loading={ctl.saving}
          error={ctl.error ?? (mode === 'concrete' ? formError : undefined)}
        />
      }
    >
      <ChoiceList
        groupLabel={W.modeLabel}
        options={(['none', 'concrete'] as const).map((value) => ({
          value,
          label: W.modes[value].label,
          description: W.modes[value].text,
          disabled: value === 'concrete' && blockedReason !== null,
        }))}
        value={mode}
        onChange={chooseMode}
      />
      {formNotice !== null ? (
        <Notice tone="info" testID="weight-goal-form-lifecycle">
          {formNotice}
        </Notice>
      ) : null}
      {blockedReason !== null ? (
        <Notice tone="info" title={W.blockedTitle} testID={`weight-goal-blocked-${blockedReason}`}>
          <Body>{W.blocked[blockedReason]}</Body>
          {remedyLabel ? (
            <Button label={remedyLabel} variant="secondary" onPress={() => remedy(blockedReason)} />
          ) : null}
        </Notice>
      ) : null}

      {mode === 'concrete' && availability.available ? (
        <>
          <Card>
            <ChoiceList
              label={W.amountLabel}
              horizontal
              options={WEIGHT_GOAL_AMOUNT_MODES.map((value) => ({
                value,
                label: W.amountModes[value],
              }))}
              value={draft.amountMode}
              onChange={(amountMode) => update({ amountMode, amountText: '' })}
            />
            <TextField
              label={draft.amountMode === 'kg_to_lose' ? W.kgField : W.targetField}
              hint={
                draft.amountMode === 'kg_to_lose'
                  ? W.kgHint
                  : W.currentWeight(formatKg(availability.body.weightKg))
              }
              value={draft.amountText}
              onChangeText={(amountText) =>
                update({ amountText: amountText.replace(/[^\d,.]/g, '').slice(0, 5) })
              }
              keyboardType="decimal-pad"
              error={fieldErrors.amount}
              testID="weight-goal-amount"
            />
          </Card>
          <Card>
            <ChoiceList
              label={W.timeLabel}
              horizontal
              options={WEIGHT_GOAL_TIME_MODES.map((value) => ({
                value,
                label: W.timeModes[value],
              }))}
              value={draft.timeMode}
              // Beim Umschalten bleibt das Datum leer (kein vorgeschlagenes Kalenderdatum, Wächter Z4 N3).
              onChange={(timeMode) => update({ timeMode })}
            />
            {draft.timeMode === 'weeks' ? (
              <WeeksStepper
                value={draft.weeksText}
                onChange={(weeksText) => update({ weeksText })}
                error={fieldErrors.time}
              />
            ) : (
              <DateInput
                label={W.dateField}
                value={draft.date}
                onChange={(date) => update({ date })}
                error={fieldErrors.time}
              />
            )}
          </Card>
          <FeasibilityScale
            view={view}
            pendingText={
              liveIssue !== null
                ? issueText(liveIssue)
                : evaluation?.kind === 'partial'
                  ? W.scale.pending
                  : W.scale.pendingInvalid
            }
            pendingAction={
              liveIssue === 'no_deficit'
                ? { label: W.scale.useNone, onPress: () => setMode('none') }
                : null
            }
            onApply={(weeks) => update({ timeMode: 'weeks', weeksText: String(weeks) })}
          />
          {/* Stillzeit-Hinweis (K5) nur, wenn nicht männlich (Wächter Z4 N13). */}
          {person.sex !== 'male' ? (
            <Notice tone="info" testID="weight-goal-breastfeeding">
              {W.breastfeeding}
            </Notice>
          ) : null}
          <View testID="weight-goal-eating-help">
            <EatingHelpNotice />
          </View>
        </>
      ) : null}

      <ConfirmDialog
        visible={confirmHidden}
        title={W.hiddenNumbersTitle}
        message={W.hiddenNumbers}
        confirmLabel={W.hiddenNumbersConfirm}
        confirmVariant="primary"
        onConfirm={() => {
          setConfirmHidden(false);
          setTouched(true);
          setMode('concrete');
        }}
        onCancel={() => setConfirmHidden(false)}
        testID="weight-goal-hidden-numbers"
      />
    </Screen>
  );
}

/** Wochen als Zahl mit −/+ (4–104). */
function WeeksStepper({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const theme = useThemeColors();
  const button = (delta: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta === 1 ? W.weeksPlus : W.weeksMinus}
      onPress={() => onChange(stepWeeks(value, delta))}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.stepSymbol, { color: theme.text }]}>{delta === 1 ? '+' : '−'}</Text>
    </Pressable>
  );
  return (
    <View>
      <View style={styles.stepRow}>
        <View style={styles.stepField}>
          <TextField
            label={W.weeksField}
            hint={W.weeksHint}
            value={value}
            onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            testID="weight-goal-weeks"
          />
        </View>
        {button(-1)}
        {button(1)}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  stepField: { flex: 1 },
  stepButton: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepSymbol: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
