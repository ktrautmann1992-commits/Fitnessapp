import {
  type EnduranceActivity,
  type EndurancePeriodSummary,
  distanceText,
  durationText,
  elevationRange,
  sketchPath,
  sketchPoints,
  splitBars,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Body, Heading, MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Bausteine für „Ausdauer“ (Etappen E4/E5): Linien-Skizze ohne Kartenkacheln, Kilometer-Balken, Höhenprofil, Summen
 * der Woche/des Monats und eine Zeile je Aktivität. Rechnungen in packages/core; hier nur Darstellung. Werte stehen
 * immer auch als Text da (nie nur Farbe/Grafik).
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
            stroke={theme.primary}
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

/** Kilometerzeiten als waagerechte Balken (langsamster = 100 %), Zeit als Text daneben. */
export function SplitBars({ splits }: { splits: readonly number[] }) {
  const theme = useThemeColors();
  const bars = splitBars(splits);
  if (bars.length === 0) return <Body muted>{E.detail.splitsEmpty}</Body>;
  return (
    <View style={styles.bars} testID="split-bars">
      {bars.map((bar) => (
        <View
          key={bar.km}
          style={styles.barRow}
          accessible
          accessibilityLabel={E.detail.splitA11y(bar.km, durationText(bar.seconds))}
        >
          <Text style={[styles.barLabel, { color: theme.textMuted }]}>{bar.km}</Text>
          <View style={[styles.barTrack, { backgroundColor: theme.background }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(4, Math.round(bar.share * 100))}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.barValue, { color: theme.text }]}>{durationText(bar.seconds)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Höhenprofil als Linie (Distanz → Höhe), Achsenwerte als Text. */
export function ElevationChart({
  profile,
  width = 320,
  height = 120,
}: {
  profile: readonly (readonly number[])[] | null;
  width?: number;
  height?: number;
}) {
  const theme = useThemeColors();
  const pairs = (profile ?? []).filter((p): p is [number, number] => p.length === 2) as [
    number,
    number,
  ][];
  const range = elevationRange(pairs);
  if (!range || pairs.length < 2) return <Body muted>{E.detail.profileEmpty}</Body>;
  const maxD = Math.max(1, (pairs.at(-1) as [number, number])[0]);
  const span = Math.max(1, range.maxM - range.minM);
  const pad = 4;
  const pts = pairs
    .map(([d, h]) => {
      const x = pad + (d / maxD) * (width - 2 * pad);
      const y = pad + (1 - (h / 10 - range.minM) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const minM = Math.round(range.minM);
  const maxM = Math.round(range.maxM);
  return (
    <View testID="elevation-chart" accessible accessibilityLabel={E.detail.profileA11y(minM, maxM)}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke={theme.border}
          strokeWidth={1}
        />
        <Polyline points={pts} stroke={theme.primary} strokeWidth={2.5} fill="none" />
      </Svg>
      <View style={styles.axis}>
        <Body muted>{`${minM} m`}</Body>
        <Body muted>{`${maxM} m`}</Body>
      </View>
    </View>
  );
}

/** Kopf mit Summen der Woche bzw. des Monats und neutralem Vergleich (E5). */
export function TotalsView({ summary }: { summary: EndurancePeriodSummary }) {
  const theme = useThemeColors();
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
                      backgroundColor: theme.primary,
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
  onPress,
}: {
  activity: EnduranceActivity;
  points: readonly { lat: number; lng: number }[] | null;
  badge?: string | null;
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
  barLabel: { width: 28, textAlign: 'right', fontSize: fontSize.sm },
  weekLabel: { width: 52, fontSize: fontSize.sm },
  barTrack: { flex: 1, height: 14, borderRadius: radius.sm, overflow: 'hidden' },
  barFill: { height: '100%' },
  barValue: { width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
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
