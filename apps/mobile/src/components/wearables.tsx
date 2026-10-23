import {
  type HeartRateSummaryRow,
  releasedWatchRoute,
  type WearableRows,
  type WearableSessionGroup,
  type WearableSessionRow,
  watchRouteSport,
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
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';
import { forgetWearables, useWearables, wearableDriver } from '@/state/use-wearables';

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
 * Farben der fünf Pulszonen im gestapelten Balken (sehr leicht → maximal): Blau, Grün, Gelb, Orange, Rot – wie in
 * Uhr-Apps üblich. Die Minuten stehen immer auch als Text darunter (nie nur Farbe).
 */
const ZONE_COLORS = ['#93C5FD', '#34D399', '#FBBF24', '#F97316', '#EF4444'] as const;

/** Pulszonen als ein gestapelter Balken mit Text „Zone 3: 51 min · …“ (Läufe der Uhr, Mockup 23.10.2026). */
export function HeartZonesBar({ summary }: { summary: HeartRateSummaryRow }) {
  const theme = useThemeColors();
  const shares = zoneShares(summary.zone_s);
  const minutes = zoneMinutes(summary.zone_s);
  const parts = minutes
    .map((min, i) => ({ min, zone: i + 1 }))
    .filter((p) => p.min > 0)
    .map((p) => W.route.zonePart(p.zone, p.min))
    .join(' · ');
  if (shares.every((share) => share === 0)) return null;
  return (
    <View style={styles.wrap} testID="hr-zone-bar">
      <Heading level={2}>{W.route.zonesTitle}</Heading>
      <View
        style={[styles.stack, { backgroundColor: theme.background }]}
        accessible
        accessibilityLabel={W.route.zonesA11y(parts)}
      >
        {shares.map((share, i) =>
          share > 0 ? (
            <View
              key={i}
              style={{ flexGrow: share, flexBasis: 0, backgroundColor: ZONE_COLORS[i] }}
            />
          ) : null,
        )}
      </View>
      <Body muted testID="hr-zone-text">
        {parts}
      </Body>
      <Body muted>{W.zonesNote(summary.hf_max_used)}</Body>
    </View>
  );
}

/**
 * Route einer Uhr-Einheit im Tagebuch (23.10.2026): mit Route → „Strecke mit Karte ansehen“; ohne Route → „Strecke laut
 * Uhr (ohne Route)“ mit Erklärung und „Route freigeben“ (Health-Connect-Dialog je Einheit; Beispiel-Uhr im Testmodus).
 * Nur bei Ausdauer mit Strecke (Laufen, Gehen, Rad).
 */
export function WatchRouteInfo({ session }: { session: WearableSessionRow }) {
  const app = useApp();
  const router = useRouter();
  const tracked = useTrackedRoutes();
  const driver = wearableDriver(app.backend.mode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const cardio = app.rows?.cardioLogs.find((c) => c.session_log_id === session.session_log_id);
  const group = (cardio?.modality ?? null) as WearableSessionGroup | null;
  if (!cardio || !group || watchRouteSport(group) === null) return null;
  const routes = tracked.state.kind === 'ready' ? tracked.state.result.routes : null;
  if (routes === null) return null;
  const route = routes.find((r) => r.session_log_id === session.session_log_id) ?? null;

  if (route) {
    return (
      <View style={styles.wrap}>
        {message ? (
          <Notice tone={message.tone} testID="watch-route-message">
            {message.text}
          </Notice>
        ) : null}
        <Button
          label={W.route.openRoute}
          variant="secondary"
          onPress={() => router.push(`/ausdauer/${route.id}` as Href)}
          testID="watch-route-open"
        />
      </View>
    );
  }

  async function release() {
    if (!cardio || !group) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = releasedWatchRoute(await driver.requestRoute(session.external_id), {
        externalId: session.external_id,
        group,
        startedAt: session.started_at,
        finishedAt: session.finished_at,
        currentDistanceM: cardio.distance_m,
      });
      if (result.kind !== 'ok') {
        setMessage({
          text:
            result.kind === 'none'
              ? W.route.releaseNone
              : result.kind === 'unusable'
                ? W.route.releaseUnusable
                : W.route.releaseDenied,
          tone: 'warning',
        });
        return;
      }
      await app.backend.wearables.saveRoute(result.payload);
      setMessage({ text: W.route.released, tone: 'success' });
      // Gleich zur Auswertung mit Karte (die Seite lädt danach neu).
      const saved = (await app.backend.loadTrackedRoutes()).routes.find(
        (r) => r.session_log_id === session.session_log_id,
      );
      forgetTrackedRoutes();
      await app.reload();
      if (saved) router.push(`/ausdauer/${saved.id}` as Href);
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'warning' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} testID="watch-route-missing">
      <Notice tone="info" title={W.route.missingTitle}>
        {`${W.route.missingText} ${W.route.missingHowTo}`}
      </Notice>
      {message ? (
        <Notice tone={message.tone} testID="watch-route-message">
          {message.text}
        </Notice>
      ) : null}
      {driver.kind === 'none' ? (
        <Body muted>{W.route.releaseOnlyAndroid}</Body>
      ) : (
        <Button
          label={busy ? W.route.releasing : W.route.release}
          loading={busy}
          onPress={() => void release()}
          testID="watch-route-release"
        />
      )}
    </View>
  );
}

/**
 * Alles zur Uhr an einem Tagebuch-Eintrag: Herkunft, kcal, Doppel-Hinweis mit Knöpfen, Route (23.10.2026), Puls.
 * Nichts, wenn der Eintrag nichts mit der Uhr zu tun hat. `compact` (Auswertung eines Uhr-Laufs): ohne Route und Puls
 * – die stehen dort in der Kopf-Karte bzw. als Zonen-Balken.
 */
export function WearableLogInfo({ logId, compact = false }: { logId: string; compact?: boolean }) {
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
      {session && !compact ? <WatchRouteInfo session={session} /> : null}
      {heart && !compact ? <HeartRatePanel summary={heart} /> : null}
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
  stack: { flexDirection: 'row', height: 16, borderRadius: radius.pill, overflow: 'hidden' },
});
