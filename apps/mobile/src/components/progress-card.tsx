import {
  distanceText,
  type EnduranceActivity,
  paceText,
  progressTrend,
  progressVolume,
  type ProgressDelta,
  type ProgressWeek,
  runProgress,
  speedText,
  usesSpeed,
} from '@fitnessapp/core';
import { areaColors, fontSize, spacing } from '@fitnessapp/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { SectionLabel } from '@/components/design';
import { shortDayDe, useCompareColors } from '@/components/my-routes';
import { Text } from '@/components/text';
import { Body, Card } from '@/components/ui';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { formatDateDe } from '@/lib/format';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

const P = t.endurance.progress;
const E = t.endurance;

/**
 * „Dein Fortschritt“ (25.10.2026): Ø-Pace dieser Einheit gegen den eigenen Schnitt der letzten 4 Wochen und die
 * letzte Einheit ähnlicher Länge, Höhenmeter-Hinweis, Trend je Woche (zeitlich) und Umfang. Rechnungen in
 * packages/core (routes/progress.ts); hier nur Darstellung. Türkis = schneller, Orange = langsamer (neutral).
 */
export function ProgressCard({
  activity,
  activities,
  today,
  showLatest = false,
  testID = 'progress-card',
}: {
  activity: EnduranceActivity;
  activities: readonly EnduranceActivity[];
  today: string;
  /** Ausdauer-Seite: Zeile „Letzte Einheit: …“. */
  showLatest?: boolean;
  testID?: string;
}) {
  const theme = useThemeColors();
  const colors = useCompareColors();
  const speed = usesSpeed(activity.sport);
  const progress = useMemo(() => runProgress(activity, activities), [activity, activities]);
  const trend = useMemo(
    () =>
      progressTrend(activities, {
        sport: activity.sport,
        today,
        similarToM: activity.distanceM,
      }),
    [activities, activity, today],
  );
  const volume = useMemo(
    () => progressVolume(activities, { sport: activity.sport, today }),
    [activities, activity.sport, today],
  );
  if (!progress) return null;
  const fmt = (v: number) => (speed ? speedText(v) : paceText(v).replace(' min/km', ' /km'));
  const diffText = (d: ProgressDelta) =>
    speed ? P.kmh(d.amount.toFixed(1).replace('.', ',')) : P.perKm(Math.round(d.amount));
  const word = (d: ProgressDelta) => (d.code === 'faster' ? P.faster : P.slower);
  const color = (d: ProgressDelta) =>
    d.code === 'faster' ? colors.faster : d.code === 'slower' ? colors.slower : theme.textMuted;
  const plural = P.sportPlural[activity.sport];
  return (
    <Card>
      <View style={styles.gap} testID={testID}>
        <SectionLabel>{P.title}</SectionLabel>
        <Body muted>{P.subtitle(plural)}</Body>
        {showLatest && activity.distanceM !== null ? (
          <Text style={[styles.small, { color: theme.textMuted }]}>
            {P.latest(
              activity.startedAt ? shortDayDe(activity.startedAt) : formatDateDe(activity.day),
              distanceText(activity.distanceM),
            )}
          </Text>
        ) : null}
        <Text
          style={[styles.value, appFont('extrabold'), { color: theme.text }]}
          testID={`${testID}-value`}
        >
          {P.value(fmt(progress.value))}
        </Text>
        {progress.vsAverage && progress.average !== null ? (
          <DeltaRow
            color={color(progress.vsAverage)}
            text={
              progress.vsAverage.code === 'same'
                ? P.vsAverageSame(fmt(progress.average), progress.similarCount)
                : P.vsAverage(
                    diffText(progress.vsAverage),
                    word(progress.vsAverage),
                    fmt(progress.average),
                    progress.similarCount,
                  )
            }
            testID={`${testID}-average`}
          />
        ) : null}
        {progress.vsLast && progress.last ? (
          <DeltaRow
            color={color(progress.vsLast)}
            text={
              progress.vsLast.code === 'same'
                ? P.vsLastSame(formatShort(progress.last.day), fmt(progress.last.value))
                : P.vsLast(
                    diffText(progress.vsLast),
                    word(progress.vsLast),
                    formatShort(progress.last.day),
                    fmt(progress.last.value),
                  )
            }
            testID={`${testID}-last`}
          />
        ) : null}
        {!progress.last ? <Body muted>{P.first}</Body> : null}
        {progress.elevationExtraM !== null ? (
          <Body testID={`${testID}-elevation`}>{P.elevation(progress.elevationExtraM)}</Body>
        ) : null}
        <TrendChart weeks={trend} speed={speed} />
        <Text
          style={[styles.small, appFont('semibold'), { color: theme.text }]}
          testID={`${testID}-volume`}
        >
          {`${P.volume} ${E.sports[activity.sport]}: ${P.volumeWeek(distanceText(volume.weekM))} · ${P.volumeMonth(distanceText(volume.monthM))}`}
        </Text>
      </View>
    </Card>
  );
}

function formatShort(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

function DeltaRow({ color, text, testID }: { color: string; text: string; testID: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.deltaRow} testID={testID}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.body, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function TrendChart({ weeks, speed }: { weeks: readonly ProgressWeek[]; speed: boolean }) {
  const theme = useThemeColors();
  const orange = areaColors[useColorSchemeName()].ausdauer.strong;
  const [width, setWidth] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  const withValue = weeks.filter((w) => w.value !== null);
  const label = (v: number) =>
    speed ? speedText(v).replace(' km/h', '') : paceText(v).replace(' min/km', '');
  if (withValue.length < 2) {
    return (
      <View style={styles.gap}>
        <Text style={[styles.small, appFont('bold'), { color: theme.textMuted }]}>{P.trend}</Text>
        <Body muted>{P.trendFew}</Body>
      </View>
    );
  }
  const values = withValue.map((w) => w.value as number);
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const pad = Math.max(speed ? 0.3 : 3, (hi0 - lo0) * 0.2);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const height = 120;
  const top = 18;
  const bottom = height - 22;
  const x = (i: number) => 10 + (i / Math.max(1, weeks.length - 1)) * (width - 20);
  // Größerer Wert = oben: Pace → unten = schneller; km/h → oben = schneller.
  const y = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  // Linie nur zwischen direkt aufeinanderfolgenden Wochen mit Einheit (Lücke = keine Linie).
  let d = '';
  weeks.forEach((w, i) => {
    if (w.value === null) return;
    const prev = weeks[i - 1];
    d += `${prev && prev.value !== null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(w.value).toFixed(1)}`;
  });
  const a11y = weeks
    .map(
      (w) => `${formatShort(w.weekStart)} ${w.value !== null ? label(w.value) : P.trendEmptyWeek}`,
    )
    .join(', ');
  return (
    <View style={styles.gap}>
      <Text style={[styles.small, appFont('bold'), { color: theme.textMuted }]}>{P.trend}</Text>
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={P.trendA11y(a11y)}
        testID="progress-trend"
      >
        <Svg width={width} height={height}>
          {[0, 1].map((f) => (
            <Line
              key={f}
              x1={0}
              x2={width}
              y1={top + f * (bottom - top)}
              y2={top + f * (bottom - top)}
              stroke={theme.border}
              strokeDasharray="3 5"
            />
          ))}
          <Path d={d} stroke={orange} strokeWidth={3} fill="none" strokeLinejoin="round" />
          {weeks.map((w, i) =>
            w.value !== null ? (
              <Circle
                key={w.weekStart}
                cx={x(i)}
                cy={y(w.value)}
                r={i === weeks.length - 1 ? 5.5 : 4}
                fill={i === weeks.length - 1 ? orange : theme.surface}
                stroke={orange}
                strokeWidth={2.5}
              />
            ) : null,
          )}
          {weeks.map((w, i) =>
            i === 0 || i === weeks.length - 1 ? (
              <SvgText
                key={`l-${w.weekStart}`}
                x={i === 0 ? 2 : width - 2}
                y={height - 6}
                fontSize={10}
                fill={theme.textMuted}
                textAnchor={i === 0 ? 'start' : 'end'}
              >
                {formatShort(w.weekStart)}
              </SvgText>
            ) : null,
          )}
          {(() => {
            const lastI =
              weeks.length - 1 - [...weeks].reverse().findIndex((w) => w.value !== null);
            const lw = weeks[lastI];
            if (!lw || lw.value === null) return null;
            return (
              <SvgText
                x={Math.min(width - 2, x(lastI) - 10)}
                y={Math.max(12, y(lw.value) - 10)}
                fontSize={11}
                fontWeight="700"
                fill={theme.text}
                textAnchor="end"
              >
                {label(lw.value)}
              </SvgText>
            );
          })()}
        </Svg>
      </View>
      <Text style={[styles.small, { color: theme.textMuted }]}>
        {speed ? P.trendAxisSpeed : P.trendAxisPace}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  small: { fontSize: fontSize.sm },
  body: { fontSize: fontSize.md, flex: 1 },
  value: { fontSize: fontSize.xl },
  deltaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
