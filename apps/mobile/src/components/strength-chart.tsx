import {
  defaultStrengthMetric,
  STRENGTH_RANGES,
  type StrengthMetric,
  type StrengthRange,
  strengthComparison,
  strengthMetricsAvailable,
  strengthRangeStart,
  type StrengthSeries,
  strengthSeries,
  type StrengthSession,
  strengthSparkline,
  daysBetween,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { SectionLabel, StatValue, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Notice, OptionButton } from '@/components/ui';
import type { StrengthTileItem } from '@/data/strength-progress';
import { t } from '@/i18n';
import { monotonePath, type Pt } from '@/lib/chart-path';
import { appFont } from '@/lib/fonts';
import { formatDateDe } from '@/lib/format';
import { strengthComparisonText, strengthValueText } from '@/lib/strength-format';
import { useThemeColors } from '@/lib/theme';

/**
 * Kraft-Entwicklung je Übung (Gründer-Freigabe 25.10.2026): Linie wie der Tempo-Verlauf der Lauf-Auswertung (gleiche
 * Kurvenform, Fläche mit Verlauf), in der Bereichsfarbe „Fortschritt“. Immer chronologisch (x = Datum), Erholungswochen
 * als hohle Punkte, Wechsel der Belastungsart als Lücke. Keine Bestleistung, keine Abzeichen; der letzte Wert und der
 * Vergleich stehen als Text daneben (nie nur Grafik). Rechnungen in packages/core; hier nur Darstellung.
 */

const S = t.strength;
const PAD_TOP = 22;
const PAD_BOTTOM = 24;
const PAD_X = 10;

function useWidth(initial: number): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(initial);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  return [width, onLayout];
}

/** Kurzes Datum „12.10.“ für die Achse. */
function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

/** Diagramm einer Kennzahl. Ohne Punkte ein Hinweis; mit einem Punkt nur der Punkt. */
export function StrengthChart({
  series,
  today,
  range,
  testID = 'strength-chart',
}: {
  series: StrengthSeries;
  today: string;
  range: StrengthRange;
  testID?: string;
}) {
  const theme = useThemeColors();
  const blue = useAreaColors('fortschritt');
  const [width, onLayout] = useWidth(326);
  const { points, metric } = series;
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || series.min === null || series.max === null) {
    return null;
  }
  const height = 170;
  const bottom = height - PAD_BOTTOM;
  const from = strengthRangeStart(range, today) ?? first.performedOn;
  const to = range === 'all' ? last.performedOn : today;
  const spanDays = Math.max(1, daysBetween(from, to));
  const span = series.max - series.min;
  const pad = Math.max(span * 0.18, Math.abs(series.max) * 0.05, 1);
  const lo = Math.max(0, series.min - pad);
  const hi = series.max + pad;
  const x = (iso: string) =>
    points.length === 1 && range === 'all'
      ? width / 2
      : PAD_X +
        (Math.min(Math.max(daysBetween(from, iso), 0), spanDays) / spanDays) * (width - 2 * PAD_X);
  const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * (bottom - PAD_TOP);
  // x streng steigend (zwei Trainings an einem Tag liegen leicht versetzt).
  const xs: number[] = [];
  for (const p of points) {
    const raw = x(p.performedOn);
    const prev = xs.at(-1);
    xs.push(prev !== undefined && raw <= prev + 3 ? prev + 3 : raw);
  }
  const pts: Pt[] = points.map((p, i) => ({ x: xs[i] as number, y: y(p.value) }));
  // Teilstücke (Lücke bei Wechsel der Belastungsart).
  const segments: Pt[][] = [];
  points.forEach((p, i) => {
    if (i === 0 || p.startsSegment) segments.push([]);
    segments.at(-1)?.push(pts[i] as Pt);
  });
  const lastText = strengthValueText(metric, last.value);
  const firstText = strengthValueText(metric, first.value);
  const a11y = S.chartA11y(
    S.metrics[metric],
    points.length,
    formatDateDe(first.performedOn),
    formatDateDe(last.performedOn),
    firstText.a11y,
    lastText.a11y,
  );
  const lastPt = pts.at(-1) as Pt;
  const labelX = Math.min(Math.max(lastPt.x, 30), width - 30);
  const gradientId = `${testID}-fill`;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
      onLayout={onLayout}
    >
      <Svg width={width} height={height} aria-hidden>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={blue.strong} stopOpacity={0.26} />
            <Stop offset="1" stopColor={blue.strong} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {/* Hilfslinien oben/unten mit Werten (eigene Werte, keine Zielmarke). */}
        <Line x1={0} y1={bottom} x2={width} y2={bottom} stroke={theme.border} strokeWidth={1} />
        <Line
          x1={0}
          y1={y(series.max)}
          x2={width}
          y2={y(series.max)}
          stroke={theme.divider}
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <Path
              key={`a${i}`}
              d={`${monotonePath(seg)}L${(seg.at(-1) as Pt).x.toFixed(1)} ${bottom}L${(seg[0] as Pt).x.toFixed(1)} ${bottom}Z`}
              fill={`url(#${gradientId})`}
            />
          ) : null,
        )}
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <Path
              key={`l${i}`}
              d={monotonePath(seg)}
              stroke={blue.strong}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {points.map((p, i) => {
          const pt = pts[i] as Pt;
          const isLast = i === points.length - 1;
          return (
            <Circle
              key={`p${i}`}
              cx={pt.x}
              cy={pt.y}
              r={isLast ? 5.5 : 4}
              fill={p.isDeload ? theme.surface : blue.strong}
              stroke={blue.strong}
              strokeWidth={p.isDeload ? 2 : 0}
            />
          );
        })}
        <SvgText
          x={labelX}
          y={Math.max(12, lastPt.y - 10)}
          fontSize={12}
          fontWeight="700"
          fill={theme.text}
          textAnchor="middle"
        >
          {lastText.text}
        </SvgText>
        <SvgText x={2} y={bottom + 16} fontSize={11} fill={theme.textMuted}>
          {shortDate(from)}
        </SvgText>
        <SvgText
          x={width - 2}
          y={bottom + 16}
          fontSize={11}
          fill={theme.textMuted}
          textAnchor="end"
        >
          {shortDate(to)}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Mini-Kurve für die Kachel (Werte 0–1 aus `strengthSparkline`), Bild mit Ansage in Worten. */
export function StrengthSparkline({
  values,
  accessibilityLabel,
  width = 96,
  height = 32,
  testID,
}: {
  values: readonly number[];
  accessibilityLabel: string;
  width?: number;
  height?: number;
  testID?: string;
}) {
  const blue = useAreaColors('fortschritt');
  const pad = 4;
  const n = values.length;
  const pts: Pt[] = values.map((v, i) => ({
    x: n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad),
    y: pad + (1 - Math.min(Math.max(v, 0), 1)) * (height - 2 * pad),
  }));
  const last = pts.at(-1);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height }}
    >
      <Svg width={width} height={height} aria-hidden>
        {pts.length > 1 ? (
          <Path
            d={monotonePath(pts)}
            stroke={blue.strong}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {last ? <Circle cx={last.x} cy={last.y} r={3.5} fill={blue.strong} /> : null}
      </Svg>
    </View>
  );
}

/**
 * Abschnitt „Entwicklung“ im Verlauf je Übung: Umschalter Kennzahl (Gewicht/Volumen/Wiederholungen bzw. Haltezeit,
 * nur vorhandene) und Zeitraum (4 W/3 M/Alles), Diagramm, letzter Wert und Vergleich in Worten, Leer-Hinweise.
 */
export function StrengthProgressSection({
  sessions,
  today,
}: {
  sessions: readonly StrengthSession[];
  today: string;
}) {
  const theme = useThemeColors();
  const available = useMemo(() => strengthMetricsAvailable(sessions), [sessions]);
  const [picked, setPicked] = useState<StrengthMetric | null>(null);
  const [range, setRange] = useState<StrengthRange>('3m');
  const metric =
    picked !== null && available.includes(picked) ? picked : defaultStrengthMetric(sessions);
  const series = useMemo(
    () => (metric === null ? null : strengthSeries(sessions, metric, range, today)),
    [metric, range, sessions, today],
  );
  if (metric === null || series === null) {
    return (
      <Notice tone="info" testID="strength-empty">
        {S.empty}
      </Notice>
    );
  }
  const lastIndex = sessions.length - 1;
  const comparison = strengthComparisonText(strengthComparison(sessions, lastIndex, metric));
  const last = series.points.at(-1);
  const lastValue = last ? strengthValueText(metric, last.value) : null;
  return (
    <View style={styles.section} testID="strength-section">
      <SectionLabel>{S.chartTitle}</SectionLabel>
      {available.length > 1 ? (
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel={S.metricLabel}
          testID="strength-metrics"
        >
          {available.map((m) => (
            <OptionButton
              key={m}
              role="radio"
              compact
              label={S.metrics[m]}
              selected={m === metric}
              onPress={() => setPicked(m)}
              testID={`strength-metric-${m}`}
            />
          ))}
        </View>
      ) : null}
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={S.rangeLabel}
        testID="strength-ranges"
      >
        {STRENGTH_RANGES.map((r) => (
          <OptionButton
            key={r}
            role="radio"
            compact
            label={S.ranges[r]}
            accessibilityLabel={S.rangesA11y[r]}
            selected={r === range}
            onPress={() => setRange(r)}
            testID={`strength-range-${r}`}
          />
        ))}
      </View>
      <Body muted>{S.metricHints[metric]}</Body>
      {series.points.length === 0 ? (
        <Notice tone="info" testID="strength-empty-range">
          {S.emptyRange}
        </Notice>
      ) : (
        <>
          <View style={styles.stats}>
            {lastValue ? (
              <StatValue
                value={lastValue.text}
                label={formatDateDe(last?.performedOn ?? today)}
                accessibilityLabel={`${lastValue.a11y}, ${formatDateDe(last?.performedOn ?? today)}`}
                testID="strength-last"
              />
            ) : null}
            {comparison ? (
              <Text
                style={[styles.compare, appFont('semibold'), { color: theme.text }]}
                accessibilityLabel={comparison.a11y}
                testID="strength-compare"
              >
                {comparison.text}
              </Text>
            ) : null}
          </View>
          <StrengthChart series={series} today={today} range={range} />
          {series.points.length === 1 ? <Body muted>{S.single}</Body> : null}
          {series.points.some((p) => p.isDeload) ? <Body muted>{S.deloadLegend}</Body> : null}
          {series.points.some((p) => p.startsSegment) ? <Body muted>{S.segmentLegend}</Body> : null}
        </>
      )}
    </View>
  );
}

/**
 * Inhalt der Kachel „Kraft-Entwicklung“ unter Fortschritt: je Übung Name, letzter Wert, Vergleich in Worten und eine
 * Mini-Kurve; antippen öffnet den Verlauf der Übung. Leer: Hinweis, wann hier etwas erscheint.
 */
export function StrengthTileRows({
  items,
  onOpen,
}: {
  items: readonly StrengthTileItem[];
  onOpen: (exerciseId: string) => void;
}) {
  const theme = useThemeColors();
  if (items.length === 0) {
    return (
      <Body muted testID="strength-tile-empty">
        {S.tileEmpty}
      </Body>
    );
  }
  return (
    <View style={styles.tileRows}>
      {items.map((item, index) => {
        const first = item.series.points[0];
        const last = item.series.points.at(-1);
        const lastText = last ? strengthValueText(item.metric, last.value) : null;
        const firstText = first ? strengthValueText(item.metric, first.value) : null;
        const compare = strengthComparisonText(item.comparison);
        return (
          <Pressable
            key={item.exerciseId}
            accessibilityRole="button"
            accessibilityLabel={[
              S.tileOpenA11y(item.name),
              lastText?.a11y ?? null,
              compare?.a11y ?? null,
            ]
              .filter((part): part is string => part !== null)
              .join('. ')}
            onPress={() => onOpen(item.exerciseId)}
            testID={`strength-tile-${item.exerciseId}`}
            style={({ pressed }) => [
              styles.tileRow,
              index > 0 ? { borderTopWidth: 1, borderColor: theme.divider } : null,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.tileText}>
              <Text
                style={[styles.tileName, appFont('bold'), { color: theme.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {lastText ? (
                <Text style={[styles.tileValue, appFont('extrabold'), { color: theme.text }]}>
                  {lastText.text}
                </Text>
              ) : null}
              <Text style={[styles.tileCompare, { color: theme.textMuted }]}>
                {compare?.text ?? S.metrics[item.metric]}
              </Text>
            </View>
            <StrengthSparkline
              values={strengthSparkline(item.series)}
              accessibilityLabel={S.sparkA11y(
                item.name,
                firstText?.a11y ?? '',
                lastText?.a11y ?? '',
              )}
              testID={`strength-tile-${item.exerciseId}-spark`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tileRows: { gap: 0 },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  tileText: { flex: 1, minWidth: 0, gap: 1 },
  tileName: { fontSize: fontSize.sm, lineHeight: 20 },
  tileValue: { fontSize: 20, lineHeight: 26 },
  tileCompare: { fontSize: fontSize.xs, lineHeight: 18 },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stats: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: spacing.md },
  compare: { fontSize: fontSize.sm, lineHeight: 20, flexShrink: 1, minWidth: 0 },
});
