import {
  goalsAfterWeightGoalReached,
  hasGoal,
  startOfIsoWeek,
  type WeightGoalNoticeCode,
  type WeightGoalOverview,
  weightGoalCard,
  weightGoalOverview,
} from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Notice } from '@/components/ui';
import { nutritionInputsFromRows } from '@/data/nutrition-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { useApp } from '@/state/app-state';
import type { ConsentVersions } from '@/data/mapping';

const L = t.weightGoalLife;
const NO_GOAL: WeightGoalOverview = { status: 'none', weightOutdated: false };

/**
 * Stand des Abnehmziels heute (Etappe Z5) – Regel aus packages/core (`weightGoalOverview`). Bei unvollständigen
 * Angaben oder einem Rechenfehler: kein Ziel (bewusst ohne Details: keine Gesundheitsdaten in Logs).
 */
export function weightGoalOverviewFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
): WeightGoalOverview {
  if (rows.weightGoal === null) return NO_GOAL;
  const inputs = nutritionInputsFromRows(rows, versions, today, startOfIsoWeek(today));
  if (inputs === null) return NO_GOAL;
  try {
    return weightGoalOverview(inputs);
  } catch {
    return NO_GOAL;
  }
}

/** Formular des Abnehmziels einzeln öffnen; nach dem Speichern zurück zu `zurueck` (Etappe Z5). */
export function weightGoalFormHref(zurueck: 'heute' | 'abnehmziel', extend = false): Href {
  return `/onboarding/weight_goal?edit=1&zurueck=${zurueck}${extend ? '&verlaengern=1' : ''}` as Href;
}

/**
 * Karte „Wunschgewicht erreicht“ bzw. „Zeitraum vorbei“ (docs/PLAN-ZIELE.md 6 Nr. 4, F10) – auf „Heute“ und unter
 * „Dein Abnehm-Ziel“. Ohne Zahlen, ohne Konfetti, ohne Abzeichen. Nichts passiert automatisch: Erhalt bzw.
 * Standard-Tempo gelten, bis die Person wählt.
 */
export function WeightGoalLifecycleCard({
  overview,
  zurueck,
}: {
  overview: WeightGoalOverview;
  zurueck: 'heute' | 'abnehmziel';
}) {
  const app = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const card = weightGoalCard(overview);
  const goals = app.rows?.goals ?? null;

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: done });
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) || L.settings.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  function changeGoals(choice: 'maintain' | 'muscle_gain') {
    if (goals === null) return;
    const next = goalsAfterWeightGoalReached(
      { primary: goals.goal_type, secondary: goals.secondary_goal_type ?? null },
      choice,
    );
    if (next === null) return;
    const endurance = hasGoal(next, 'endurance');
    void run(
      () =>
        app.saveStep({
          step: 'goal',
          goal: {
            goalType: next.primary,
            secondaryGoalType: next.secondary,
            discipline: endurance ? goals.discipline : null,
            targetDate: endurance ? goals.target_date : null,
          },
        }),
      L.cards.reached.done,
    );
  }

  const feedback = message ? (
    <Notice tone={message.tone} testID="weight-goal-card-message">
      {message.text}
    </Notice>
  ) : null;
  if (card === null) return feedback;

  if (card === 'reached') {
    const c = L.cards.reached;
    return (
      <>
        <Notice tone="info" title={c.title} testID="weight-goal-card-reached">
          <Body>{c.text}</Body>
          <View style={{ gap: 4 }}>
            <Button
              label={c.maintain}
              accessibilityHint={c.maintainHint}
              variant="secondary"
              loading={busy}
              onPress={() => changeGoals('maintain')}
            />
            <Body muted>{c.maintainHint}</Body>
            <Button
              label={c.muscleGain}
              accessibilityHint={c.muscleGainHint}
              variant="secondary"
              disabled={busy}
              onPress={() => changeGoals('muscle_gain')}
            />
            <Body muted>{c.muscleGainHint}</Body>
            <Button
              label={c.newGoal}
              variant="secondary"
              disabled={busy}
              onPress={() => router.push(weightGoalFormHref(zurueck))}
            />
          </View>
        </Notice>
        {feedback}
      </>
    );
  }
  const c = L.cards.datePassed;
  return (
    <>
      <Notice tone="info" title={c.title} testID="weight-goal-card-date-passed">
        <Body>{c.text}</Body>
        <Button
          label={c.extend}
          variant="secondary"
          disabled={busy}
          onPress={() => router.push(weightGoalFormHref(zurueck, true))}
        />
        <Button
          label={c.none}
          variant="secondary"
          loading={busy}
          onPress={() =>
            void run(() => app.saveStep({ step: 'weight_goal', weightGoal: null }), c.done)
          }
        />
      </Notice>
      {feedback}
    </>
  );
}

/**
 * Hinweise zum Abnehmziel in der Ernährungs-Übersicht der Woche (Plan 2.4 Nr. 6, 6 Nr. 4; Wächter K10): die Codes kommen
 * einmal je Woche aus packages/core (`weightGoalNotices`) – „etwas langsamer“ also höchstens einmal pro Woche und nie
 * als Dauerhinweis auf „Heute“. Ohne Zahlen; mit Knopf zu „Dein Abnehm-Ziel“.
 */
export function WeightGoalNutritionNotices({
  notices,
}: {
  notices: readonly WeightGoalNoticeCode[];
}) {
  const router = useRouter();
  if (notices.length === 0) return null;
  const N = L.nutrition;
  const action = notices.includes('weight_goal_invalid')
    ? N.adjust
    : notices.includes('weight_goal_no_deficit')
      ? N.change
      : N.open;
  return (
    <Notice tone="info" title={N.title} testID="nutrition-weight-goal-notices">
      {notices.map((code) => (
        <Body key={code} testID={`nutrition-weight-goal-${code}`}>
          {N[code]}
        </Body>
      ))}
      <Button
        label={action}
        variant="secondary"
        onPress={() => router.push('/abnehmziel' as Href)}
      />
    </Notice>
  );
}
