import { HYDRATION, hydrationFraction, hydrationHistory, hydrationTotal } from '@fitnessapp/core';
import { areaColors, fontSize, spacing } from '@fitnessapp/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MiniBars, ProgressRing, SectionLabel } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Button, Card, LoadingState, Notice } from '@/components/ui';
import { HydrationError } from '@/data/hydration';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { useSupplements } from '@/state/use-supplements';
import { useTrackedRoutes } from '@/state/use-tracked-routes';
import { hydrationGoalFromRows, useHydration } from '@/state/use-hydration';

const H = t.hydration;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

/**
 * Karte „Trinken“ (25.10.2026) für Heute und Ernährung: Ring (Wasser-Türkis) mit Menge und Richtwert, Schnell-Knöpfe
 * +250/+500 ml, letzten Eintrag zurücknehmen, 7 Tage als Balken. Ohne Ziel (Herz/Niere, kein Gewicht) nur notieren.
 * Ziel und Summen aus packages/core.
 */
export function HydrationCard({
  today,
  testID = 'hydration-card',
}: {
  today: string;
  testID?: string;
}) {
  const app = useApp();
  const theme = useThemeColors();
  const water = areaColors[useColorSchemeName()].einkaufen;
  const { state, add, undoLast, reload } = useHydration(today);
  const routes = useTrackedRoutes();
  const supplements = useSupplements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const kidney = supplements.data.screening?.answers.kidney === true;
  const goal = useMemo(
    () =>
      app.rows
        ? hydrationGoalFromRows(app.rows, today, {
            routes: routes.state.kind === 'ready' ? routes.state.result.routes : [],
            kidney,
          })
        : null,
    [app.rows, kidney, routes.state, today],
  );
  if (state.kind === 'unsupported' || !goal) return null;
  const entries = state.kind === 'ready' ? state.entries : [];
  const total = hydrationTotal(entries, today);
  const fraction = hydrationFraction(total, goal);
  const history = hydrationHistory(entries, today);
  const maxDay = Math.max(
    1,
    ...history.map((h) => h.totalMl),
    goal.kind === 'goal' ? goal.goalMl : 0,
  );

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    try {
      const text = await action();
      if (text) setMessage({ text, tone: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof HydrationError && error.code === 'limit' ? H.limit : H.failed,
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.gap} testID={testID}>
        <SectionLabel>{H.title}</SectionLabel>
        {state.kind === 'loading' ? <LoadingState /> : null}
        {state.kind === 'error' ? (
          <Notice tone="warning" title={H.loadFailed}>
            <Button label={H.retry} variant="secondary" onPress={() => void reload()} />
          </Notice>
        ) : null}
        {state.kind === 'ready' && state.offline ? <Body muted>{H.offline}</Body> : null}
        <View style={styles.row}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={H.ringA11y(total, goal.kind === 'goal' ? goal.goalMl : null)}
            testID={`${testID}-ring`}
          >
            <ProgressRing
              size={96}
              stroke={10}
              fraction={fraction ?? 0}
              color={water.strong}
              trackColor={water.surface}
            >
              <Text style={[styles.ringText, appFont('extrabold'), { color: theme.text }]}>
                {(total / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>l</Text>
            </ProgressRing>
          </View>
          <View style={styles.flex}>
            <Text
              style={[styles.big, appFont('bold'), { color: theme.text }]}
              testID={`${testID}-total`}
            >
              {goal.kind === 'goal' ? H.ofGoal(total, goal.goalMl) : H.today(total)}
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          {HYDRATION.quickMl.map((amount) => (
            <View key={amount} style={styles.flex}>
              <Button
                label={H.add(amount)}
                accessibilityLabel={H.addA11y(amount)}
                onPress={() =>
                  void run(async () =>
                    (await add(amount)) === 'queued' ? H.queued : H.added(amount),
                  )
                }
                disabled={busy}
                testID={`${testID}-add-${amount}`}
              />
            </View>
          ))}
        </View>
        {goal.kind === 'goal' ? (
          <Body muted>{H.goalHint(goal.baseMl, goal.trainingMl, goal.heatMl)}</Body>
        ) : (
          <Body testID={`${testID}-no-goal`}>
            {goal.reason === 'medical' ? H.noGoalMedical : H.noGoalWeight}
          </Body>
        )}
        {message ? (
          <Text
            style={[
              styles.small,
              { color: message.tone === 'success' ? theme.success : theme.warning },
            ]}
            accessibilityLiveRegion="polite"
            testID={`${testID}-message`}
          >
            {message.text}
          </Text>
        ) : null}
        {entries.some((e) => e.day === today) ? (
          <Button
            label={H.undo}
            variant="link"
            onPress={() => void run(async () => ((await undoLast()) ? H.undone : null))}
            disabled={busy}
            testID={`${testID}-undo`}
          />
        ) : null}
        <Text style={[styles.small, appFont('bold'), { color: theme.textMuted }]}>{H.history}</Text>
        <MiniBars
          values={history.map((h) => h.totalMl / maxDay)}
          area="einkaufen"
          highlightIndex={history.length - 1}
          height={40}
          accessibilityLabel={H.historyA11y(
            history
              .map((h) => `${weekday(h.day)} ${h.totalMl.toLocaleString('de-DE')} ml`)
              .join(', '),
          )}
          testID={`${testID}-history`}
        />
        <View style={styles.days}>
          {history.map((h) => (
            <Text key={h.day} style={[styles.tiny, { color: theme.textMuted }]}>
              {weekday(h.day)}
            </Text>
          ))}
        </View>
        <Text style={[styles.tiny, { color: theme.textMuted }]}>{H.disclaimer}</Text>
      </View>
    </Card>
  );
}

function weekday(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  ringText: { fontSize: fontSize.lg },
  big: { fontSize: fontSize.lg },
  small: { fontSize: fontSize.sm },
  tiny: { fontSize: fontSize.xs },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
});
