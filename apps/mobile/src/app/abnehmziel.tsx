import { hasGoal } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';

import { EatingHelpNotice } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, LoadingState, Notice } from '@/components/ui';
import {
  weightGoalFormHref,
  WeightGoalLifecycleCard,
  weightGoalOverviewFromRows,
} from '@/components/weight-goal';
import { weightGoalFromRow } from '@/data/mapping';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { useToday } from '@/lib/use-today';
import { weightGoalSummary } from '@/lib/weight-goal-format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';

const S = t.weightGoalLife.settings;

/**
 * Einstellungen → „Dein Abnehm-Ziel“ (docs/PLAN-ZIELE.md 6 Nr. 3–4, F10, F13; Etappe Z5): ansehen, bearbeiten,
 * entfernen (= „ohne festes Ziel“), Karten „erreicht“/„Zeitraum vorbei“ und Hinweise. Nur hier ist das Wunschgewicht
 * sichtbar (F13). Keine Restmenge, kein Fortschritt, keine Prognose (F7). Jedes Speichern plant ab heute neu (S15).
 * Gesundheitsdatum (Art. 9): nur mit Einwilligung, nie in Logs oder Analytics (K7).
 */
export default function WeightGoalSettingsScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const { rows: memoRows, versions } = app;
  // Wächter Z5 N8: Stand nur neu rechnen, wenn sich Angaben oder Tag ändern.
  const overview = useMemo(
    () => (memoRows ? weightGoalOverviewFromRows(memoRows, versions, today) : null),
    [memoRows, versions, today],
  );

  if (app.status.kind === 'loading') {
    return (
      <Screen area="fortschritt" icon="scale" title={S.title}>
        <LoadingState />
      </Screen>
    );
  }
  if (app.status.kind === 'error') {
    return (
      <Screen area="fortschritt" icon="scale" title={S.title}>
        <ErrorState message={t.errors.loadFailed} onRetry={() => void app.reload()} />
      </Screen>
    );
  }
  const rows = app.rows;
  if (!app.session || !rows?.profile || rows.profile.onboarding_completed_at == null) {
    return <Redirect href="/" />;
  }

  const back = (
    <Button
      label={t.common.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen
      area="fortschritt"
      icon="scale"
      title={S.title}
      testID="weight-goal-settings"
      footer={back}
    >
      {message ? (
        <Notice tone={message.tone} testID="weight-goal-settings-message">
          {message.text}
        </Notice>
      ) : null}
      {children}
      <EatingHelpNotice />
    </Screen>
  );

  const goals = rows.goals;
  const losesWeight =
    goals !== null &&
    hasGoal({ primary: goals.goal_type, secondary: goals.secondary_goal_type ?? null }, 'fat_loss');
  if (!losesWeight) {
    return shell(
      <Card>
        <Body testID="weight-goal-settings-not-fat-loss">{S.notFatLoss}</Body>
        <Button
          label={S.changeGoal}
          variant="secondary"
          onPress={() => router.push('/onboarding/goal?edit=1' as Href)}
        />
      </Card>,
    );
  }
  if (healthConsentStatus(rows, app.versions) !== 'valid') {
    return shell(
      <Card>
        <Body testID="weight-goal-settings-no-consent">{S.noConsent}</Body>
        <Button
          label={S.consentButton}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
        />
      </Card>,
    );
  }

  const goal = weightGoalFromRow(rows.weightGoal);
  if (goal === null) {
    return shell(
      <Card>
        <Body testID="weight-goal-settings-none">{S.none}</Body>
        <Body muted>{S.noneHint}</Body>
        <Button
          label={S.set}
          onPress={() => router.push(weightGoalFormHref('abnehmziel'))}
          testID="weight-goal-settings-set"
        />
      </Card>,
    );
  }

  const summary = weightGoalSummary(goal);
  const status = overview?.status ?? 'none';

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      await app.saveStep({ step: 'weight_goal', weightGoal: null });
      setConfirmRemove(false);
      setMessage({ tone: 'success', text: S.removed });
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught) || S.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  return shell(
    <>
      {overview ? <WeightGoalLifecycleCard overview={overview} zurueck="abnehmziel" /> : null}
      <Card>
        <Body testID="weight-goal-settings-target">{summary.target}</Body>
        <Body muted testID="weight-goal-settings-period">
          {summary.period}
        </Body>
        {status === 'active' || status === 'paused' ? (
          <Body testID={`weight-goal-settings-status-${status}`}>
            {status === 'paused' && overview?.pausedForCompetition === true
              ? S.status.pausedCompetition
              : S.status[status]}
          </Body>
        ) : null}
        <Button
          label={S.edit}
          variant="secondary"
          onPress={() => router.push(weightGoalFormHref('abnehmziel'))}
          testID="weight-goal-settings-edit"
        />
        {/* Neues Gewicht (z. B. nach dem Wiegen) – daraus leitet die Engine „erreicht“ ab (Wächter S8). */}
        <Button
          label={S.newWeight}
          variant="secondary"
          onPress={() => router.push('/onboarding/body_metrics?edit=1&zurueck=abnehmziel' as Href)}
          testID="weight-goal-settings-weight"
        />
        <Button
          label={S.remove}
          variant="secondary"
          onPress={() => setConfirmRemove(true)}
          testID="weight-goal-settings-remove"
        />
      </Card>
      {status === 'invalid' || status === 'no_deficit' ? (
        <Notice tone="warning" testID={`weight-goal-settings-status-${status}`}>
          <Body>{S.status[status]}</Body>
          <Button
            label={S.adjust}
            variant="secondary"
            onPress={() => router.push(weightGoalFormHref('abnehmziel'))}
          />
        </Notice>
      ) : null}
      {overview?.weightOutdated ? (
        <Notice tone="info" testID="weight-goal-settings-weight-outdated">
          <Body>{S.weightOutdated}</Body>
          <Button
            label={S.weightOutdatedButton}
            variant="secondary"
            onPress={() =>
              router.push('/onboarding/body_metrics?edit=1&zurueck=abnehmziel' as Href)
            }
          />
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={confirmRemove}
        title={S.removeTitle}
        message={S.removeText}
        confirmLabel={S.removeConfirm}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmRemove(false)}
        loading={busy}
        testID="weight-goal-remove-dialog"
      />
    </>,
  );
}
