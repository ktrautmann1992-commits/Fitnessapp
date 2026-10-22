import {
  type HeartRateSummaryRow,
  type WearableRows,
  type WearableSessionRow,
  zoneShares,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAreaColors } from '@/components/design';
import { Stat } from '@/components/endurance';
import { Text } from '@/components/text';
import { Body, Button, Card, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { useThemeColors } from '@/lib/theme';
import { originLabel, zoneMinutes } from '@/lib/wearable-format';
import { useApp } from '@/state/app-state';
import { forgetWearables, useWearables } from '@/state/use-wearables';

/**
 * Smartwatch im Tagebuch und in der Auswertung (Phase 8 Etappe H4): Uhr-Symbol mit Herkunft, Puls
 * (Ø/Max, Zeit je Zone) und „Möglicher Doppel-Eintrag“. Werte stehen immer auch als Text da. Der Puls erscheint NIE
 * auf dem Story-Bild (STORY_CARD_FIELDS ist eine Positivliste ohne Puls).
 */

const W = t.wearables;

/** Übernommene Einheit bzw. Uhr-Verknüpfung eines Eintrags (oder null). */
export function wearableFor(rows: WearableRows | null, logId: string): WearableSessionRow | null {
  return rows?.sessions.find((s) => s.session_log_id === logId) ?? null;
}

/** Kurzer Hinweis für Listen: „⌚ aus Samsung Health“ (oder null). */
export function wearableBadgeText(rows: WearableRows | null, logId: string): string | null {
  const session = wearableFor(rows, logId);
  return session ? W.badge(originLabel(session.origin)) : null;
}

/** Puls einer Einheit: Ø, Max und Zeit je Zone als Balken mit Text. */
export function HeartRatePanel({ summary }: { summary: HeartRateSummaryRow }) {
  const theme = useThemeColors();
  const red = useAreaColors('ausdauer');
  const shares = zoneShares(summary.zone_s);
  const minutes = zoneMinutes(summary.zone_s);
  return (
    <Card>
      <Heading level={2}>{W.heartTitle}</Heading>
      <View style={styles.stats}>
        <Stat label={W.heartAvg} value={W.heartUnit(summary.avg_bpm)} testID="hr-avg" />
        <Stat label={W.heartMax} value={W.heartUnit(summary.max_bpm)} testID="hr-max" />
      </View>
      <Body muted>{W.zonesTitle}</Body>
      <View style={styles.bars} testID="hr-zones">
        {shares.map((share, i) => (
          <View
            key={i}
            style={styles.barRow}
            accessible
            accessibilityLabel={`${W.zone(i + 1)} (${W.zoneNames[i] ?? ''}): ${W.zoneValue(minutes[i] ?? 0)}`}
          >
            <Text style={[styles.barLabel, { color: theme.textMuted }]}>{W.zone(i + 1)}</Text>
            <View style={[styles.barTrack, { backgroundColor: theme.background }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${share > 0 ? Math.max(4, Math.round(share * 100)) : 0}%`,
                    backgroundColor: red.strong,
                    opacity: 0.45 + i * 0.13,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barValue, { color: theme.text }]}>
              {W.zoneValue(minutes[i] ?? 0)}
            </Text>
          </View>
        ))}
      </View>
      <Body muted>{W.zonesNote(summary.hf_max_used)}</Body>
    </Card>
  );
}

/**
 * Alles zur Uhr an einem Tagebuch-Eintrag: Herkunft, kcal, Doppel-Hinweis mit Knöpfen, Puls. Nichts, wenn der Eintrag
 * nichts mit der Uhr zu tun hat.
 */
export function WearableLogInfo({ logId }: { logId: string }) {
  const app = useApp();
  const router = useRouter();
  const { state, reload } = useWearables();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const rows = state.kind === 'ready' ? state.result.rows : null;
  const session = wearableFor(rows, logId);
  const heart = rows?.heartRates.find((h) => h.session_log_id === logId) ?? null;
  if (!session && !heart) {
    return message ? <Notice tone={message.tone}>{message.text}</Notice> : null;
  }

  async function resolve(merge: boolean) {
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      const target = session.duplicate_of;
      await app.backend.wearables.resolveDuplicate(session.session_log_id, merge);
      forgetWearables();
      await Promise.all([app.reload(), reload()]);
      setMessage({ text: merge ? W.duplicateMerged : W.duplicateKept, tone: 'success' });
      // Zusammengeführt: der übernommene Eintrag ist weg – zum führenden Eintrag wechseln.
      if (merge && target) router.replace(`/log/${target}` as Href);
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} testID="wearable-log-info">
      {session ? (
        <Body muted testID="wearable-badge">
          {/* kcal der Uhr stehen als „ca. … kcal laut Uhr“ an der Einheit (session-kcal.tsx, mit „Zahlen aus“). */}
          {W.badge(originLabel(session.origin))}
        </Body>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {session?.duplicate_of ? (
        <Notice tone="warning" title={W.duplicateTitle} testID="wearable-duplicate">
          {W.duplicateText}
        </Notice>
      ) : null}
      {session?.duplicate_of ? (
        <View style={styles.actions}>
          <Button
            label={W.duplicateOpen}
            variant="link"
            onPress={() => router.push(`/log/${session.duplicate_of}` as Href)}
          />
          <Button
            label={W.duplicateMerge}
            loading={busy}
            onPress={() => void resolve(true)}
            testID="wearable-duplicate-merge"
          />
          <Button
            label={W.duplicateKeep}
            variant="secondary"
            disabled={busy}
            onPress={() => void resolve(false)}
            testID="wearable-duplicate-keep"
          />
        </View>
      ) : null}
      {heart ? <HeartRatePanel summary={heart} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bars: { gap: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  barLabel: { width: 56, fontSize: fontSize.sm },
  barTrack: { flex: 1, height: 14, borderRadius: radius.sm, overflow: 'hidden' },
  barFill: { height: '100%' },
  barValue: { width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
