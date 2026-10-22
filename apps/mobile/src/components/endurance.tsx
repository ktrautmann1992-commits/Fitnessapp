import {
  type EnduranceActivity,
  type EndurancePeriodSummary,
  distanceText,
  durationText,
  sketchPath,
  sketchPoints,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Body, Heading, MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useAreaColors } from '@/components/design';
import { Text } from '@/components/text';

/**
 * Bausteine für „Ausdauer“ (Etappen E4/E5): Linien-Skizze ohne Kartenkacheln, Summen der Woche/des Monats und eine
 * Zeile je Aktivität (Auswertung je Lauf: run-insights.tsx). Rechnungen in packages/core; hier nur Darstellung.
 * Werte stehen immer auch als Text da (nie nur Farbe/Grafik).
 */

const E = t.endurance;

/** Linien-Skizze (Plan 11.1 „Kosten-Bremse“: keine Kartenvorschau in Listen). */
export function RouteSketch({
  points,
  width = 96,
  height = 64,
  testID,
}: {
  points: readonly { lat: number; lng: number }[];
  width?: number;
  height?: number;
  testID?: string;
}) {
  const theme = useThemeColors();
  const orange = useAreaColors('ausdauer');
  const projected = sketchPoints(points, { width, height, padding: 6, maxPoints: 200 });
  const first = projected[0];
  const last = projected.at(-1);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={E.list.sketchA11y}
      style={[styles.sketch, { width, height, backgroundColor: theme.background }]}
    >
      {projected.length > 1 ? (
        <Svg width={width} height={height}>
          <Path
            d={sketchPath(projected)}
            stroke={orange.strong}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {first ? <Circle cx={first.x} cy={first.y} r={3} fill={theme.success} /> : null}
          {last ? <Circle cx={last.x} cy={last.y} r={3} fill={theme.text} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Kopf mit Summen der Woche bzw. des Monats und neutralem Vergleich (E5). */
export function TotalsView({ summary }: { summary: EndurancePeriodSummary }) {
  const theme = useThemeColors();
  const orange = useAreaColors('ausdauer');
  const week = summary.period === 'week';
  const T = E.totals;
  const diff = summary.distanceDiffM;
  const compare =
    summary.previous.total.count === 0 && summary.total.count === 0
      ? null
      : Math.abs(diff) < 100
        ? T.compareSame(week)
        : diff > 0
          ? T.compareMore(diff, week)
          : T.compareLess(-diff, week);
  const maxWeek = Math.max(1, ...summary.weeks.map((w) => w.distanceM));
  return (
    <View style={styles.totals} testID="endurance-totals">
      <Body muted testID="endurance-totals-range">
        {T.range(formatDateDe(summary.from), formatDateDe(summary.to))}
      </Body>
      {summary.total.count === 0 ? (
        <Body testID="endurance-totals-empty">{T.empty}</Body>
      ) : (
        <View style={styles.statGrid}>
          <Stat
            label={T.distance}
            value={distanceText(summary.total.distanceM)}
            testID="totals-distance"
          />
          <Stat label={T.time} value={durationText(summary.total.movingS)} />
          <Stat label={T.elevation} value={`${summary.total.elevationM} m`} />
          <Stat
            label={T.count(summary.total.count).replace(/^\d+ /, '')}
            value={String(summary.total.count)}
            testID="totals-count"
          />
        </View>
      )}
      {summary.bySport.length > 1 ? (
        <View>
          {summary.bySport.map((entry) => (
            <Body key={entry.sport} muted>
              {`${E.sports[entry.sport]}: ${distanceText(entry.totals.distanceM)} · ${T.count(entry.totals.count)}`}
            </Body>
          ))}
        </View>
      ) : null}
      {summary.weeks.length > 0 && summary.total.count > 0 ? (
        <View style={styles.bars}>
          {summary.weeks.map((w) => (
            <View
              key={w.from}
              style={styles.barRow}
              accessible
              accessibilityLabel={T.weekBar(formatDateDe(w.from), distanceText(w.distanceM))}
            >
              <Text style={[styles.weekLabel, { color: theme.textMuted }]}>
                {formatDateDe(w.from).slice(0, 6)}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: theme.background }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((w.distanceM / maxWeek) * 100)}%`,
                      backgroundColor: orange.strong,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: theme.text }]}>
                {distanceText(w.distanceM)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {compare ? (
        <Body muted testID="endurance-totals-compare">
          {compare}
        </Body>
      ) : null}
    </View>
  );
}

export function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** Eine Aktivität in „Meine Läufe“ (Strecke mit Skizze bzw. Eintrag ohne GPS). */
export function ActivityRow({
  activity,
  points,
  badge,
  note,
  onPress,
}: {
  activity: EnduranceActivity;
  points: readonly { lat: number; lng: number }[] | null;
  badge?: string | null;
  /** Neutraler Zusatz, z. B. „⌚ aus Samsung Health“ (Phase 8). */
  note?: string | null;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const day = formatDateDe(activity.day);
  const distance = activity.distanceM !== null ? distanceText(activity.distanceM) : '–';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={E.list.itemA11y(activity.name, day, distance)}
      testID={`endurance-item-${activity.key}`}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: theme.cardBorder,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {points && points.length > 1 ? (
        <RouteSketch points={points} />
      ) : (
        <View style={[styles.noGps, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.sm }}>{E.list.noGps}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {activity.isFavorite ? '★ ' : ''}
          {activity.name}
        </Text>
        <Text style={{ color: theme.textMuted }}>{`${E.sports[activity.sport]} · ${day}`}</Text>
        <Text style={{ color: theme.text }}>
          {`${distance} · ${durationText(activity.durationS)}`}
        </Text>
        {note ? <Text style={{ color: theme.textMuted }}>{note}</Text> : null}
        {badge ? <Text style={{ color: theme.warning }}>{badge}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Heading level={2}>{children}</Heading>;
}

const styles = StyleSheet.create({
  sketch: { borderRadius: radius.md, overflow: 'hidden' },
  bars: { gap: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  weekLabel: { width: 52, fontSize: fontSize.sm },
  barTrack: { flex: 1, height: 14, borderRadius: radius.sm, overflow: 'hidden' },
  barFill: { height: '100%' },
  barValue: { width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
  totals: { gap: spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { minWidth: 120, flexGrow: 1 },
  statLabel: { fontSize: fontSize.sm },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.sm,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
  },
  noGps: {
    width: 96,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
