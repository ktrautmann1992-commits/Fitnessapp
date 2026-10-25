import {
  isoWeekday,
  lighterMinutes,
  RECOVERY_STATUS_LABEL_DE,
  RECOVERY_SUMMARY_DE,
  RECOVERY_TEXTS_DE,
  recoveryA11yDe,
  recoveryOffer,
  recoveryReasonsDe,
  type RecoveryResult,
  recoverySignalDe,
  type RecoveryStatus,
  type StoredSession,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DashboardTile } from '@/components/dashboard';
import { Text } from '@/components/text';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { clearRecoveryChoice, setRecoveryChoice } from '@/data/recovery-choice';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { useRecovery, useRecoveryChoice, useRecoveryOfferAllowed } from '@/state/use-recovery';

const R = t.recovery;
const T = RECOVERY_TEXTS_DE;

/**
 * „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15): Kachel auf der Übersicht, Karte auf
 * „Heute“ und Abschnitt auf der Smartwatch-Seite. Rechnet nichts selbst (packages/core: recoveryTrend, recoveryOffer,
 * lighterSessionVariant). Der Status ist eine Trainingshilfe, keine Bewertung der Gesundheit – Farben sind ruhig
 * (grün/gelb/orange, nie Alarm-Rot) und immer mit Wort. Werte sind Gesundheitsdaten: nur Anzeige, nie Logs.
 */

/** Farbe je Status (immer mit Wort daneben, nie Farbe allein). */
function useStatusColor(): (status: RecoveryStatus) => string {
  const theme = useThemeColors();
  return (status) =>
    status === 'good'
      ? theme.success
      : status === 'medium'
        ? theme.caution
        : status === 'low'
          ? theme.warning
          : theme.border;
}

/** Höhe der Säule im Mini-Verlauf: gut = voll, mittel = 2/3, niedrig = 1/3, ohne Einschätzung = Strich. */
const TREND_SHARE: Readonly<Record<RecoveryStatus, number>> = {
  good: 1,
  medium: 0.66,
  low: 0.36,
  unknown: 0,
};

export function RecoveryTrend({
  trend,
  testID,
}: {
  trend: readonly RecoveryResult[];
  testID?: string;
}) {
  const theme = useThemeColors();
  const color = useStatusColor();
  const height = 30;
  const label = R.tile.trendA11y(
    trend.map((d) => ({
      weekday: isoWeekday(d.day),
      label: RECOVERY_STATUS_LABEL_DE[d.status],
    })),
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      style={styles.trend}
    >
      {trend.map((d, i) => {
        const today = i === trend.length - 1;
        const share = TREND_SHARE[d.status];
        return (
          <View key={d.day} style={styles.trendDay} testID={`${testID}-${d.status}`}>
            <View style={[styles.trendTrack, { height }]}>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: share === 0 ? 3 : Math.round(share * height),
                    backgroundColor: color(d.status),
                    opacity: today ? 1 : 0.75,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.trendLabel,
                appFont(today ? 'bold' : 'regular'),
                { color: today ? theme.text : theme.textMuted },
              ]}
            >
              {today ? R.tile.today : R.tile.weekdayShort(isoWeekday(d.day))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Punkt + Status-Wort („niedrig“). */
function StatusWord({ status, testID }: { status: RecoveryStatus; testID?: string }) {
  const theme = useThemeColors();
  const color = useStatusColor();
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, { backgroundColor: color(status) }]} />
      <Text
        style={[styles.statusWord, appFont('extrabold'), { color: theme.text }]}
        testID={testID}
      >
        {RECOVERY_STATUS_LABEL_DE[status]}
      </Text>
    </View>
  );
}

/** Kachel „Erholung“ auf der Übersicht: Status heute, Gründe, Mini-Verlauf 7 Tage; Leerzustand „Uhr verbinden“. */
export function RecoveryTile({ today }: { today: string }) {
  const router = useRouter();
  const state = useRecovery(today);
  const theme = useThemeColors();
  const toSmartwatch = () => router.push('/smartwatch' as Href);
  const base = { title: R.tile.title, area: 'training' as const, icon: 'moon' as const };

  if (state.kind === 'loading') {
    return (
      <DashboardTile {...base} testID="overview-recovery">
        <LoadingState label={R.tile.loading} />
      </DashboardTile>
    );
  }
  if (state.kind === 'empty') {
    const text =
      state.reason === 'only_android'
        ? R.tile.onlyAndroid
        : state.reason === 'no_watch'
          ? R.tile.noWatch
          : R.tile.noConsent;
    return (
      <DashboardTile {...base} testID="overview-recovery">
        <Body muted style={styles.small} testID="overview-recovery-empty">
          {text}
        </Body>
        {state.reason === 'only_android' ? null : (
          <View style={styles.connectRow}>
            <Button
              label={R.tile.connect}
              variant="secondary"
              compact
              onPress={toSmartwatch}
              testID="overview-recovery-connect"
            />
          </View>
        )}
      </DashboardTile>
    );
  }
  if (state.kind === 'no_data') {
    return (
      <DashboardTile
        {...base}
        testID="overview-recovery"
        pressTestID="overview-recovery-open"
        accessibilityLabel={`${R.tile.title}: ${R.tile.noData}`}
        onPress={toSmartwatch}
      >
        <Body muted style={styles.small} testID="overview-recovery-no-data">
          {R.tile.noData}
        </Body>
      </DashboardTile>
    );
  }
  const now = state.today;
  const reasons = recoveryReasonsDe(now);
  return (
    <DashboardTile
      {...base}
      testID="overview-recovery"
      pressTestID="overview-recovery-open"
      accessibilityLabel={`${recoveryA11yDe(now)} ${RECOVERY_SUMMARY_DE[now.status]} ${R.tile.open}`}
      onPress={toSmartwatch}
    >
      <View style={styles.tileHead}>
        <StatusWord status={now.status} testID="overview-recovery-status" />
        {reasons.length > 0 ? (
          <Text
            style={[styles.reasons, appFont('semibold'), { color: theme.textMuted }]}
            testID="overview-recovery-reasons"
          >
            {reasons.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Body style={styles.small} testID="overview-recovery-summary">
        {RECOVERY_SUMMARY_DE[now.status]}
      </Body>
      {now.learning ? (
        <Body muted style={styles.small} testID="overview-recovery-learning">
          {T.learning}
        </Body>
      ) : null}
      <RecoveryTrend trend={state.trend} testID="overview-recovery-trend" />
    </DashboardTile>
  );
}

/**
 * Karte auf „Heute“ bei niedriger Erholung und heute geplanter, noch offener Einheit. Mit Live-Anpassung (Premium bzw.
 * Testmodus-Schalter): Angebot „Leichter trainieren“ / „Wie geplant“ – nie automatisch, jederzeit vor dem Start
 * umkehrbar. Ohne: nur der Hinweis (Status ist gratis). `locked` = Training schon begonnen (Entwurf) – Wahl fest.
 */
export function RecoveryTodayCard({
  today,
  session,
  locked,
}: {
  today: string;
  session: StoredSession;
  locked: boolean;
}) {
  const app = useApp();
  const state = useRecovery(today);
  const allowed = useRecoveryOfferAllowed();
  const choice = useRecoveryChoice(today, session.id);
  const userId = app.session?.userId ?? null;
  if (state.kind !== 'ready' || !userId) return null;
  const status = state.today.status;
  const offer = recoveryOffer({ status, plannedSessionOpenToday: true, entitled: allowed });
  const choose = (next: 'lighter' | 'as_planned') =>
    setRecoveryChoice({ userId, day: today, sessionId: session.id, choice: next });

  if (choice === 'lighter') {
    const text =
      session.kind === 'strength'
        ? T.chosenLighterStrength
        : T.chosenLighterEndurance(
            lighterMinutes(session.estimated_minutes),
            session.estimated_minutes,
          );
    return (
      <Notice tone="info" title={T.offerTitle} testID="recovery-today-chosen">
        <Body testID="recovery-today-chosen-text">{text}</Body>
        {locked ? null : (
          <Button
            label={T.chosenUndo}
            variant="link"
            onPress={() => clearRecoveryChoice()}
            testID="recovery-today-undo"
          />
        )}
      </Notice>
    );
  }
  if (choice === 'as_planned') {
    return locked ? null : (
      <View style={styles.plannedRow} testID="recovery-today-as-planned">
        <Body muted style={styles.small}>
          {T.chosenAsPlanned}
        </Body>
        <Button
          label={T.chosenAsPlannedUndo}
          variant="link"
          onPress={() => clearRecoveryChoice()}
          testID="recovery-today-reopen"
        />
      </View>
    );
  }
  if (status !== 'low' || locked) return null;
  if (offer !== 'lighter') {
    // Gratis bzw. ohne Live-Anpassung: Status und neutraler Hinweis, kein Angebot.
    return (
      <Notice tone="info" title={R.today.infoTitle} testID="recovery-today-info">
        <Body>{RECOVERY_SUMMARY_DE.low}</Body>
        <Body muted style={styles.small}>
          {R.today.infoHint}
        </Body>
      </Notice>
    );
  }
  const reasons = recoveryReasonsDe(state.today);
  return (
    <Card>
      <View style={styles.stack} testID="recovery-today-offer">
        <Heading level={2}>{T.offerTitle}</Heading>
        <Body>{T.offerBody}</Body>
        {reasons.length > 0 ? (
          <Body muted style={styles.small} testID="recovery-today-reasons">
            {reasons.join(' · ')}
          </Body>
        ) : null}
        <Body muted style={styles.small}>
          {session.kind === 'strength'
            ? T.chosenLighterStrength
            : T.chosenLighterEndurance(
                lighterMinutes(session.estimated_minutes),
                session.estimated_minutes,
              )}
        </Body>
        <View style={styles.buttons}>
          <View style={styles.buttonCell}>
            <Button
              label={T.offerLighter}
              onPress={() => choose('lighter')}
              testID="recovery-today-lighter"
            />
          </View>
          <View style={styles.buttonCell}>
            <Button
              label={T.offerAsPlanned}
              variant="secondary"
              onPress={() => choose('as_planned')}
              testID="recovery-today-planned"
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

/** Abschnitt „Erholung“ auf der Smartwatch-Seite: Status, Werte heute, Regeln, Hinweise. */
export function RecoveryDetails({ today }: { today: string }) {
  const state = useRecovery(today);
  const theme = useThemeColors();
  if (state.kind !== 'ready' && state.kind !== 'no_data') return null;
  return (
    <Card>
      <View style={styles.stack} testID="recovery-details">
        <Heading level={2}>{R.details.title}</Heading>
        <Body muted>{R.details.intro}</Body>
        {state.kind === 'no_data' ? (
          <Body testID="recovery-details-no-data">{R.tile.noData}</Body>
        ) : (
          <>
            <StatusWord status={state.today.status} testID="recovery-details-status" />
            <Body>{RECOVERY_SUMMARY_DE[state.today.status]}</Body>
            <RecoveryTrend trend={state.trend} testID="recovery-details-trend" />
            <Text style={[styles.subTitle, appFont('bold'), { color: theme.text }]}>
              {R.details.valuesTitle}
            </Text>
            {state.today.signals.map((signal) => (
              <Body key={signal.kind} testID={`recovery-signal-${signal.kind}`}>
                {`• ${recoverySignalDe(signal)}`}
              </Body>
            ))}
            {state.today.learning ? <Body muted>{T.learning}</Body> : null}
            {state.medication ? <Body muted>{T.medication}</Body> : null}
          </>
        )}
        <Text style={[styles.subTitle, appFont('bold'), { color: theme.text }]}>{T.howTitle}</Text>
        {T.how.map((line) => (
          <Body key={line} muted style={styles.small}>
            {`• ${line}`}
          </Body>
        ))}
        <Body muted style={styles.small} testID="recovery-disclaimer">
          {T.disclaimer}
        </Body>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: fontSize.sm, lineHeight: 20 },
  stack: { gap: spacing.sm },
  connectRow: { flexDirection: 'row' },
  tileHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: radius.pill },
  statusWord: { fontSize: fontSize.lg, lineHeight: 26 },
  reasons: { fontSize: fontSize.sm, lineHeight: 20, flexShrink: 1 },
  trend: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  trendDay: { flex: 1, alignItems: 'center', gap: 4 },
  trendTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  trendBar: { width: '70%', maxWidth: 28, borderRadius: radius.sm },
  trendLabel: { fontSize: fontSize.xs, lineHeight: 16 },
  subTitle: { fontSize: fontSize.md, marginTop: spacing.xs },
  plannedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  // Untereinander: „Leichter trainieren“ bricht nebeneinander bei 390 px um (Screenshot-Prüfung 25.10.2026).
  buttons: { gap: spacing.sm },
  buttonCell: {},
});
