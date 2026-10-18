import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useExerciseNames } from '@/components/live-adjust';
import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { type LocalAdjustment, revertAllowed } from '@/data/live-adjust';
import { t } from '@/i18n';
import { formatDateDe, todayIso } from '@/lib/format';
import {
  adjustmentBeforeAfter,
  adjustmentExplanation,
  groupAdjustmentsByWeek,
  localDateOf,
} from '@/lib/live-adjust-format';
import { useApp } from '@/state/app-state';

/**
 * „Warum hat sich mein Plan geändert?“ (docs/PLAN-PHASE-4B.md 8.1 Punkt 2, Zustände 8.4): Liste nach Wochen, je Eintrag
 * Datum, Erklärsatz (feste Bausteine, keine KI) und vorher → nachher; „Rückgängig“ nur, solange canRevert() es erlaubt.
 */
export default function AdjustmentChangesScreen() {
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  const names = useExerciseNames(app.rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const { ensureLibrary } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  if (app.status.kind === 'loading' || app.liveAdjust.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows) return <Redirect href="/" />;
  const rows = app.rows;
  const all = app.liveAdjust.adjustments;
  const groups = groupAdjustmentsByWeek(all);

  async function revert(adjustment: LocalAdjustment) {
    setBusyId(adjustment.id);
    setMessage(undefined);
    try {
      const result = await app.revertAdjustment(adjustment.id);
      setMessage(
        result === 'reverted'
          ? { tone: 'success', text: t.adjust.reverted }
          : { tone: 'danger', text: t.adjust.revertNotPossible },
      );
    } catch {
      setMessage({ tone: 'danger', text: t.adjust.revertFailed });
    } finally {
      setBusyId(null);
    }
  }

  function actions(adjustment: LocalAdjustment) {
    const title = t.adjust.ruleTitles[adjustment.rule];
    if (adjustment.status === 'pending_confirmation') {
      if (adjustment.expiresOn !== null && adjustment.expiresOn < today) {
        return <Body muted>{t.adjust.proposalExpired}</Body>;
      }
      return (
        <Button
          label={t.adjust.proposalOpen}
          variant="secondary"
          onPress={() =>
            router.push(`/plan/weniger-tage?id=${encodeURIComponent(adjustment.id)}` as Href)
          }
          testID="adjust-open-proposal"
        />
      );
    }
    if (adjustment.status === 'expired') return <Body muted>{t.adjust.proposalExpired}</Body>;
    if (adjustment.status !== 'applied' || adjustment.requiresConfirmation) return null;
    if (app.offline) return <Body muted>{t.adjust.offline}</Body>;
    if (!revertAllowed(rows, all, adjustment, { versions: app.versions, today })) {
      return (
        <Body muted testID="adjust-revert-blocked">
          {t.adjust.revertNotPossible}
        </Body>
      );
    }
    return (
      <Button
        label={t.adjust.revert}
        variant="secondary"
        accessibilityLabel={t.adjust.revertA11y(title)}
        loading={busyId === adjustment.id}
        onPress={() => void revert(adjustment)}
        testID="adjust-revert"
      />
    );
  }

  return (
    <Screen
      title={t.adjust.title}
      testID="adjust-changes"
      footer={
        <Button
          label={t.adjust.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {message ? (
        <Notice tone={message.tone} testID="adjust-message">
          <Body>{message.text}</Body>
        </Notice>
      ) : null}
      {app.liveAdjust.status === 'error' ? (
        <Notice tone="warning" testID="adjust-load-failed">
          <Body>{t.adjust.loadFailed}</Body>
        </Notice>
      ) : null}
      {app.liveAdjust.available && !app.liveAdjust.simulatePremium && all.length > 0 ? (
        <Notice tone="info" testID="adjust-premium-ended">
          <Body>{t.adjust.premiumEndedTest}</Body>
        </Notice>
      ) : null}
      {groups.length === 0 ? (
        <Body muted testID="adjust-empty">
          {t.adjust.empty}
        </Body>
      ) : null}
      {groups.map((group) => (
        <View key={group.monday} style={{ gap: 12 }}>
          <Heading level={2}>{group.label}</Heading>
          {group.items.map((adjustment) => (
            <Card key={adjustment.id}>
              <View testID={`adjust-entry-${adjustment.rule}`} style={{ gap: 6 }}>
                <Body>{`${t.adjust.badge} · ${t.adjust.ruleTitles[adjustment.rule]}`}</Body>
                <Body muted>
                  {`${t.adjust.createdOn(formatDateDe(localDateOf(adjustment.createdAt)))} · ${t.adjust.status[adjustment.status]}`}
                </Body>
                <Body testID="adjust-explanation">{adjustmentExplanation(adjustment, names)}</Body>
                {adjustmentBeforeAfter(adjustment, names).map((line) => (
                  <Body key={line} muted testID="adjust-before-after">
                    {line}
                  </Body>
                ))}
                {actions(adjustment)}
              </View>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
