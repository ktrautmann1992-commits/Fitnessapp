import {
  type ColoredRun,
  type ElevationStats,
  type PaceSegment,
  type RunHighlight,
  type SplitInsight,
  distanceTicks,
  durationText,
  paceBucket,
  paceColoredRuns,
  paceDeltaText,
  paceText,
  sketchPath,
  sketchPoints,
  speedText,
} from '@fitnessapp/core';
import { areaColors, fontSize, heroColors, radius, spacing } from '@fitnessapp/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Icon, IconChip, SectionLabel, useAreaColors, type IconName } from '@/components/design';
import { RouteMap } from '@/components/route-map';
import { Text } from '@/components/text';
import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { appFont, displayFont } from '@/lib/fonts';
import { PACE_COLORS, paceColor } from '@/lib/pace-colors';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

/**
 * Anschauliche Auswertung je Lauf (Gründer-Wunsch 22.10.2026): dunkle Kopf-Karte mit großer Distanz und Linien-
 * Skizze, farbige Skizze als Karten-Ersatz, Kilometer-Balken mit Abweichung zum Ø, Tempo-Verlauf, Höhenprofil als
 * Fläche und „Bestwerte“. Rechnungen in packages/core (routes/run-insights.ts); hier nur Darstellung. Jede Grafik hat
 * eine Ansage in Worten, Werte stehen immer auch als Text da (nie nur Farbe). Hell und dunkel, ab 320 px Breite.
 */

const D = t.endurance.detail;
const H = D.highlight;
const kmText = (m: number) => (m / 1000).toFixed(1).replace('.', ',');

/** Breite eines Bereichs messen (Diagramme zeichnen in echten Pixeln, ohne Verzerrung). */
function useWidth(initial: number): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(initial);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  return [width, onLayout];
}

/** Pace bzw. Tempo (Rad) als kurzer Text ohne Einheit-Wiederholung. */
function paceOrSpeed(secondsPerKm: number, speed: boolean): string {
  return speed ? speedText(3600 / secondsPerKm) : paceText(secondsPerKm);
}

// ---------------------------------------------------------------------------------------------------------
// Linien-Skizze (dunkel, farbig nach Tempo)
// ---------------------------------------------------------------------------------------------------------
/**
 * Strecke als Linie auf dunklem Grund, stückweise in den Tempo-Farben, mit Start (grün) und Ziel (weiß). Ohne
 * Kartenkacheln – im Kopf der Auswertung und als Ersatz, wenn die Karte nicht lädt. Nur auf dem eigenen Bildschirm
 * (das Teilen-Bild hat eine eigene Linie mit Privatzone).
 */
export function RouteSilhouette({
  points,
  runs,
  width,
  height,
  stroke = 4,
  testID,
}: {
  points: readonly { lat: number; lng: number }[];
  runs: readonly ColoredRun[];
  width: number;
  height: number;
  stroke?: number;
  testID?: string;
}) {
  const projected = sketchPoints(points, {
    width,
    height,
    padding: stroke * 2 + 4,
    maxPoints: Math.max(2, points.length),
  });
  if (projected.length < 2) return null;
  const first = projected[0] as { x: number; y: number };
  const last = projected.at(-1) as { x: number; y: number };
  const pieces =
    runs.length > 0 && (runs.at(-1)?.to ?? 0) < projected.length
      ? runs.map((run) => ({
          color: paceColor('dark', run.bucket),
          d: sketchPath(projected.slice(run.from, run.to + 1)),
        }))
      : [{ color: paceColor('dark', null), d: sketchPath(projected) }];
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={D.sketchA11y}
      style={{ width, height }}
    >
      <Svg width={width} height={height}>
        <Path
          d={sketchPath(projected)}
          stroke="#FFFFFF"
          strokeOpacity={0.12}
          strokeWidth={stroke + 6}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pieces.map((piece, i) => (
          <Path
            key={i}
            d={piece.d}
            stroke={piece.color}
            strokeWidth={stroke}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <Circle cx={first.x} cy={first.y} r={stroke + 1.5} fill="#4ADE80" stroke="#0A0C10" />
        <Circle
          cx={last.x}
          cy={last.y}
          r={stroke + 1.5}
          fill="#FFFFFF"
          stroke="#0A0C10"
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

/** Großer Ersatz für die Karte (dunkle Fläche in voller Breite). */
export function RouteSilhouettePanel({
  points,
  runs,
}: {
  points: readonly { lat: number; lng: number }[];
  runs: readonly ColoredRun[];
}) {
  const hero = heroColors[useColorSchemeName()];
  const [width, onLayout] = useWidth(326);
  return (
    <View
      onLayout={onLayout}
      style={[styles.panel, { backgroundColor: hero.background, borderColor: hero.border }]}
    >
      <RouteSilhouette
        points={points}
        runs={runs}
        width={width}
        height={220}
        stroke={5}
        testID="route-silhouette"
      />
    </View>
  );
}

/**
 * Karte der Strecke mit der Linie in Tempo-Farben, Start und Ziel; lädt die Karte nicht, steht die farbige Skizze da.
 * Darunter die Legende (nur mit Kilometerzeiten).
 */
export function RouteMapSection({
  points,
  segments,
}: {
  points: readonly { lat: number; lng: number }[];
  segments: readonly PaceSegment[];
}) {
  const runs = useMemo(() => paceColoredRuns(points, segments), [points, segments]);
  // Gleiches Objekt bei gleichen Daten – sonst lädt die Karte bei jedem Rendern neu.
  const colored = useMemo(
    () =>
      segments.length > 0
        ? runs.map((run) => ({ color: paceColor('light', run.bucket), points: run.points }))
        : [],
    [runs, segments.length],
  );
  return (
    <View style={styles.section}>
      <SectionLabel>{D.route}</SectionLabel>
      <RouteMap
        points={points}
        colored={colored}
        fallback={<RouteSilhouettePanel points={points} runs={runs} />}
      />
      {segments.length > 1 ? <PaceLegend /> : null}
    </View>
  );
}

/** Legende „schneller ↔ langsamer“ mit den fünf Farbstufen. */
export function PaceLegend() {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.legend} accessible accessibilityLabel={D.legendA11y} testID="pace-legend">
      <Text style={[styles.legendText, { color: theme.textMuted }]}>{D.legendFast}</Text>
      <View style={styles.legendBar}>
        {PACE_COLORS[scheme].map((color) => (
          <View key={color} style={[styles.legendStep, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[styles.legendText, { color: theme.textMuted }]}>{D.legendSlow}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kopf-Karte
// ---------------------------------------------------------------------------------------------------------
/** Dunkle Kopf-Karte: Sportart und Datum, große Distanz, Skizze, darunter Ø-Pace, Zeit und Höhenmeter. */
export function RunHero({
  meta,
  distance,
  pace,
  time,
  elevation,
  points,
  runs,
  children,
}: {
  meta: string;
  /** „5,58 km“ */
  distance: string;
  /** „5:33 min/km“ bzw. „24,1 km/h“ */
  pace: string;
  time: string;
  elevation: string | null;
  points: readonly { lat: number; lng: number }[];
  runs: readonly ColoredRun[];
  children?: ReactNode;
}) {
  const hero = heroColors[useColorSchemeName()];
  const [number, unit] = splitUnit(distance);
  const [paceValue, paceUnit] = splitUnit(pace);
  return (
    <View
      testID="route-hero"
      style={[styles.hero, { backgroundColor: hero.background, borderColor: hero.border }]}
    >
      <View style={styles.heroTop}>
        <View style={styles.heroMain}>
          <View style={styles.heroEyebrow}>
            <Icon name="run" size={16} color={areaColors.dark.ausdauer.icon} />
            <Text
              style={[styles.heroMeta, appFont('bold'), { color: hero.accent }]}
              testID="route-detail-meta"
            >
              {meta}
            </Text>
          </View>
          <Text style={[styles.heroDistance, { color: hero.text }]} testID="route-distance">
            <Text style={[styles.heroDistanceNumber, displayFont()]}>{number}</Text>
            <Text style={[styles.heroDistanceUnit, appFont('bold'), { color: hero.muted }]}>
              {unit ? ` ${unit}` : ''}
            </Text>
          </Text>
        </View>
        {points.length > 1 ? (
          <View
            style={[styles.heroSketch, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <RouteSilhouette points={points} runs={runs} width={104} height={104} stroke={3} />
          </View>
        ) : null}
      </View>
      <View style={[styles.heroStats, { borderTopColor: 'rgba(255,255,255,0.12)' }]}>
        <HeroStat
          wide
          label={pace.endsWith('km/h') ? D.speed : D.pace}
          testID="route-pace"
          value={paceValue}
          unit={paceUnit}
        />
        <View style={styles.heroDivider} />
        <HeroStat label={D.heroTime} value={time} testID="route-moving" />
        {elevation !== null ? (
          <>
            <View style={styles.heroDivider} />
            <HeroStat label={D.elevation} value={elevation} testID="route-elevation" />
          </>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function splitUnit(text: string): [string, string] {
  const i = text.indexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

function HeroStat({
  label,
  value,
  unit,
  wide = false,
  testID,
}: {
  wide?: boolean;
  label: string;
  value: string;
  unit?: string;
  testID?: string;
}) {
  const hero = heroColors[useColorSchemeName()];
  return (
    <View
      style={[styles.heroStat, wide ? styles.heroStatWide : null]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
    >
      <Text style={[styles.heroStatValue, { color: hero.text }]} testID={testID} numberOfLines={1}>
        <Text style={appFont('extrabold')}>{value}</Text>
        {unit ? (
          <Text style={[styles.heroStatUnit, appFont('semibold'), { color: hero.muted }]}>
            {` ${unit}`}
          </Text>
        ) : null}
      </Text>
      <Text style={[styles.heroStatLabel, appFont('regular'), { color: hero.muted }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Bestwerte
// ---------------------------------------------------------------------------------------------------------
const HIGHLIGHT_ICON: Record<RunHighlight['kind'], IconName> = {
  fastest_km: 'stopwatch',
  negative_split: 'trend',
  even_pace: 'check',
  biggest_climb: 'mountain',
  highest_point: 'flag',
};

function highlightText(h: RunHighlight): { title: string; value: string; detail: string } {
  switch (h.kind) {
    case 'fastest_km':
      return {
        title: H.fastestKm,
        value: durationText(h.seconds),
        detail: H.fastestKmDetail(h.km),
      };
    case 'negative_split':
      return {
        title: H.negativeSplit,
        value: H.negativeSplitValue(durationText(h.diffS)),
        detail: H.negativeSplitDetail,
      };
    case 'even_pace':
      return { title: H.evenPace, value: H.evenPaceValue(h.spreadS), detail: H.evenPaceDetail };
    case 'biggest_climb':
      return {
        title: H.biggestClimb,
        value: H.biggestClimbValue(h.gainM),
        detail: H.biggestClimbDetail(kmText(h.fromM), kmText(h.toM)),
      };
    case 'highest_point':
      return {
        title: H.highestPoint,
        value: H.highestPointValue(h.heightM),
        detail: H.highestPointDetail(kmText(h.atM)),
      };
  }
}

/** Bestwerte als Kacheln (zwei Spalten). Nichts, wenn es keine gibt. */
export function RunHighlights({ highlights }: { highlights: readonly RunHighlight[] }) {
  const theme = useThemeColors();
  if (highlights.length === 0) return null;
  return (
    <View style={styles.section} testID="route-highlights">
      <SectionLabel>{D.highlights}</SectionLabel>
      <View style={styles.highlightGrid}>
        {highlights.map((h) => {
          const text = highlightText(h);
          return (
            <View
              key={h.kind}
              testID={`highlight-${h.kind}`}
              accessible
              accessibilityLabel={`${text.title}: ${text.value}, ${text.detail}`}
              style={[
                styles.highlight,
                { backgroundColor: theme.surface, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.highlightHead}>
                <IconChip area="ausdauer" icon={HIGHLIGHT_ICON[h.kind]} size={36} />
                <Text
                  style={[styles.highlightTitle, appFont('semibold'), { color: theme.textMuted }]}
                >
                  {text.title}
                </Text>
              </View>
              <Text style={[styles.highlightValue, displayFont(), { color: theme.text }]}>
                {text.value}
              </Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>{text.detail}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kilometerzeiten
// ---------------------------------------------------------------------------------------------------------
/**
 * Kilometer-Balken in den Tempo-Farben: schneller = längerer Balken, Zeit und Abweichung zum Ø als Text, der
 * schnellste Kilometer mit Abzeichen. Darunter der Rest unter 1 km (falls vorhanden).
 */
export function SplitInsightBars({
  splits,
  rest,
  averageText,
  speed,
}: {
  splits: readonly SplitInsight[];
  rest: PaceSegment | null;
  averageText: string | null;
  speed: boolean;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  if (splits.length === 0) return <Body muted>{D.splitsEmpty}</Body>;
  const valid = splits.filter((s) => s.seconds > 0).map((s) => s.seconds);
  const fastest = Math.min(...valid);
  const slowest = Math.max(...valid);
  const length = (s: number) =>
    s <= 0 ? 0 : slowest - fastest < 1 ? 0.85 : 0.45 + (0.55 * (slowest - s)) / (slowest - fastest);
  return (
    <View style={styles.splits}>
      {averageText ? (
        <Text style={[styles.small, { color: theme.textMuted }]}>{D.splitsAvg(averageText)}</Text>
      ) : null}
      <View style={styles.bars} testID="split-bars">
        {splits.map((s) => {
          const delta = s.deltaS === null ? null : paceDeltaText(s.deltaS);
          const color = paceColor(scheme, s.bucket);
          return (
            <View
              key={s.km}
              style={styles.barRow}
              accessible
              accessibilityLabel={
                delta
                  ? D.splitA11yDelta(s.km, durationText(s.seconds), delta)
                  : D.splitA11y(s.km, durationText(s.seconds))
              }
              testID={`split-${s.km}`}
            >
              <Text style={[styles.barLabel, appFont('semibold'), { color: theme.textMuted }]}>
                {s.km}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: theme.background }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round(length(s.seconds) * 100)}%`, backgroundColor: color },
                  ]}
                >
                  {s.fastest ? (
                    <Text
                      testID="split-fastest"
                      numberOfLines={1}
                      style={[
                        styles.badge,
                        appFont('bold'),
                        { color: scheme === 'dark' ? '#0A0C10' : '#FFFFFF' },
                      ]}
                    >
                      {D.fastestBadge}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.barValue, appFont('bold'), { color: theme.text }]}>
                {s.seconds > 0 ? durationText(s.seconds) : '–'}
              </Text>
              <Text
                style={[
                  styles.barDelta,
                  appFont('semibold'),
                  {
                    color: s.deltaS !== null && s.deltaS < 0 ? theme.success : theme.textMuted,
                  },
                ]}
              >
                {delta ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      {rest ? (
        <Text style={[styles.small, { color: theme.textMuted }]} testID="split-rest">
          {D.rest(
            `${kmText(rest.toM - rest.fromM)} ${D.km}`,
            paceOrSpeed(rest.secondsPerKm, speed),
          )}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Diagramme über die Distanz
// ---------------------------------------------------------------------------------------------------------
type Pt = { x: number; y: number };

/** Glatte Kurve ohne Überschwingen (monotone kubische Interpolation nach Fritsch–Carlson). */
function monotonePath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  const f = (v: number) => v.toFixed(1);
  const p = (i: number) => pts[i] as Pt;
  if (n === 2) return `M${f(p(0).x)} ${f(p(0).y)}L${f(p(1).x)} ${f(p(1).y)}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const d = Math.max(1e-6, p(i + 1).x - p(i).x);
    dx.push(d);
    m.push((p(i + 1).y - p(i).y) / d);
  }
  const tan: number[] = [m[0] as number];
  for (let i = 1; i < n - 1; i += 1) {
    const a = m[i - 1] as number;
    const b = m[i] as number;
    tan.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  tan.push(m[n - 2] as number);
  for (let i = 0; i < n - 1; i += 1) {
    const mi = m[i] as number;
    if (mi === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = (tan[i] as number) / mi;
    const b = (tan[i + 1] as number) / mi;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tan[i] = k * a * mi;
      tan[i + 1] = k * b * mi;
    }
  }
  let d = `M${f(p(0).x)} ${f(p(0).y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = (dx[i] as number) / 3;
    d += `C${f(p(i).x + h)} ${f(p(i).y + (tan[i] as number) * h)} ${f(p(i + 1).x - h)} ${f(
      p(i + 1).y - (tan[i + 1] as number) * h,
    )} ${f(p(i + 1).x)} ${f(p(i + 1).y)}`;
  }
  return d;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 22;

/** Senkrechte Hilfslinien und Kilometer-Beschriftung unten (gleiche Achse in beiden Diagrammen). */
function DistanceAxis({
  ticks,
  x,
  top,
  bottom,
}: {
  ticks: readonly number[];
  x: (m: number) => number;
  top: number;
  bottom: number;
}) {
  const theme = useThemeColors();
  return (
    <>
      <Line x1={0} y1={bottom} x2={x(Infinity)} y2={bottom} stroke={theme.border} strokeWidth={1} />
      {ticks.map((m) => (
        <Line
          key={`g${m}`}
          x1={x(m)}
          y1={top}
          x2={x(m)}
          y2={bottom}
          stroke={theme.divider}
          strokeWidth={1}
        />
      ))}
      {ticks.map((m) => (
        <SvgText
          key={`t${m}`}
          x={x(m)}
          y={bottom + 15}
          fontSize={11}
          fill={theme.textMuted}
          textAnchor="middle"
        >
          {`${m / 1000} ${D.km}`}
        </SvgText>
      ))}
    </>
  );
}

/**
 * Tempo-Verlauf über die Distanz: glatte Kurve durch die Abschnitte (schneller = höher), Linie in den Tempo-Farben,
 * Fläche darunter, gestrichelte Ø-Linie mit Wert. Unter 2 Abschnitten nichts (dann reichen die Zahlen).
 */
export function PaceChart({
  segments,
  distanceM,
  averageS,
  speed,
}: {
  segments: readonly PaceSegment[];
  distanceM: number;
  averageS: number | null;
  speed: boolean;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const orange = useAreaColors('ausdauer');
  const [width, onLayout] = useWidth(326);
  if (segments.length < 2 || distanceM <= 0) return null;
  const height = 150;
  const bottom = height - PAD_BOTTOM;
  const paces = segments.map((s) => s.secondsPerKm);
  const fast = Math.min(...paces);
  const slow = Math.max(...paces);
  const pad = Math.max(6, (slow - fast) * 0.25);
  const lo = fast - pad;
  const hi = slow + pad;
  const x = (m: number) => (Math.min(m, distanceM) / distanceM) * width;
  const y = (s: number) => PAD_TOP + ((s - lo) / (hi - lo)) * (bottom - PAD_TOP);
  const first = segments[0] as PaceSegment;
  const last = segments.at(-1) as PaceSegment;
  const pts: Pt[] = [
    { x: x(first.fromM), y: y(first.secondsPerKm) },
    ...segments.map((s) => ({ x: x((s.fromM + s.toM) / 2), y: y(s.secondsPerKm) })),
    { x: x(last.toM), y: y(last.secondsPerKm) },
  ];
  const line = monotonePath(pts);
  const area = `${line}L${x(last.toM).toFixed(1)} ${bottom}L${x(first.fromM).toFixed(1)} ${bottom}Z`;
  const avgY = averageS !== null ? y(averageS) : null;
  const ticks = distanceTicks(distanceM);
  const fastText = paceOrSpeed(fast, speed);
  const slowText = paceOrSpeed(slow, speed);
  const avgLabel = averageS !== null ? D.paceAvg(paceOrSpeed(averageS, speed)) : '';
  return (
    <View
      style={styles.section}
      testID="pace-chart"
      accessible
      accessibilityLabel={D.paceChartA11y(fastText, slowText)}
    >
      <SectionLabel>{D.paceChart}</SectionLabel>
      <View onLayout={onLayout}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={orange.strong} stopOpacity={0.28} />
              <Stop offset="1" stopColor={orange.strong} stopOpacity={0.02} />
            </LinearGradient>
            <LinearGradient
              id="pace-line"
              x1="0"
              y1="0"
              x2={String(width)}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              {segments.map((s) => (
                <Stop
                  key={s.km}
                  offset={String(Math.min(1, Math.max(0, x((s.fromM + s.toM) / 2) / width)))}
                  stopColor={paceColor(
                    scheme,
                    paceBucket(s.secondsPerKm, { fastest: fast, slowest: slow }),
                  )}
                />
              ))}
            </LinearGradient>
          </Defs>
          <DistanceAxis ticks={ticks} x={x} top={PAD_TOP} bottom={bottom} />
          <Path d={area} fill="url(#pace-fill)" />
          <Path
            d={line}
            stroke="url(#pace-line)"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          {avgY !== null ? (
            <>
              <Line
                x1={0}
                y1={avgY}
                x2={width}
                y2={avgY}
                stroke={theme.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Rect
                x={width - avgLabel.length * 6.6 - 10}
                y={avgY - 10}
                width={avgLabel.length * 6.6 + 10}
                height={20}
                rx={10}
                fill={theme.surface}
                stroke={theme.border}
              />
              <SvgText
                x={width - 5 - (avgLabel.length * 6.6) / 2}
                y={avgY + 4}
                fontSize={11}
                fontWeight="700"
                fill={theme.text}
                textAnchor="middle"
              >
                {avgLabel}
              </SvgText>
            </>
          ) : null}
          <SvgText x={0} y={11} fontSize={11} fill={theme.textMuted}>
            {`↑ ${D.legendFast}`}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

/**
 * Höhenprofil als Fläche: Linie und Verlauf in der Bereichsfarbe, größter Anstieg hinterlegt, höchster Punkt markiert,
 * Höhenmeter gesamt rechts oben, tiefster/höchster Wert als Text. Ohne Profil ein Hinweis.
 */
export function ElevationArea({
  profile,
  stats,
  gainM,
  distanceM,
}: {
  profile: readonly (readonly number[])[] | null;
  stats: ElevationStats | null;
  gainM: number | null;
  distanceM: number;
}) {
  const theme = useThemeColors();
  const orange = useAreaColors('ausdauer');
  const [width, onLayout] = useWidth(326);
  const pairs = (profile ?? []).filter((p): p is [number, number] => p.length === 2);
  const header = (
    <View style={styles.chartHeader}>
      <SectionLabel>{D.profile}</SectionLabel>
      {gainM !== null && stats ? (
        <Text style={[styles.chartHeaderValue, appFont('bold'), { color: theme.text }]}>
          {`${D.profileGain(gainM)} · ${D.profileRange(Math.round(stats.minM), Math.round(stats.maxM))}`}
        </Text>
      ) : null}
    </View>
  );
  if (!stats || pairs.length < 2) {
    return (
      <View style={styles.section}>
        {header}
        <Body muted>{D.profileEmpty}</Body>
      </View>
    );
  }
  const height = 130;
  const bottom = height - PAD_BOTTOM;
  const maxD = Math.max(1, distanceM, (pairs.at(-1) as [number, number])[0]);
  const span = Math.max(10, stats.maxM - stats.minM);
  const lo = stats.minM - span * 0.08;
  const hi = stats.minM + span * 1.25;
  const x = (m: number) => (Math.min(m, maxD) / maxD) * width;
  const y = (h: number) => PAD_TOP + (1 - (h - lo) / (hi - lo)) * (bottom - PAD_TOP);
  const pts = pairs.map(([d, h]) => ({ x: x(d), y: y(h / 10) }));
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('');
  const area = `${line}L${(pts.at(-1) as Pt).x.toFixed(1)} ${bottom}L${(pts[0] as Pt).x.toFixed(1)} ${bottom}Z`;
  const climb = stats.biggestClimb;
  const peak = { x: x(stats.highestAtM), y: y(stats.maxM) };
  const maxLabel = D.profileMax(Math.round(stats.maxM));
  const labelX = Math.min(Math.max(peak.x, 30), width - 30);
  const minM = Math.round(stats.minM);
  const maxM = Math.round(stats.maxM);
  return (
    <View
      style={styles.section}
      testID="elevation-chart"
      accessible
      accessibilityLabel={D.profileA11y(minM, maxM)}
    >
      {header}
      <View onLayout={onLayout}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={orange.strong} stopOpacity={0.45} />
              <Stop offset="1" stopColor={orange.strong} stopOpacity={0.05} />
            </LinearGradient>
          </Defs>
          {climb && climb.gainM >= 5 ? (
            <Rect
              x={x(climb.fromM)}
              y={PAD_TOP}
              width={Math.max(2, x(climb.toM) - x(climb.fromM))}
              height={bottom - PAD_TOP}
              fill={orange.surface}
              opacity={0.7}
            />
          ) : null}
          <DistanceAxis ticks={distanceTicks(maxD)} x={x} top={PAD_TOP} bottom={bottom} />
          <Path d={area} fill="url(#elev-fill)" />
          <Path
            d={line}
            stroke={orange.strong}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle
            cx={peak.x}
            cy={peak.y}
            r={4}
            fill={theme.surface}
            stroke={orange.strong}
            strokeWidth={2.5}
          />
          <SvgText
            x={labelX}
            y={Math.max(11, peak.y - 9)}
            fontSize={11}
            fontWeight="700"
            fill={theme.text}
            textAnchor="middle"
          >
            {maxLabel}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  panel: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { fontSize: 12 },
  legendBar: { flexDirection: 'row', flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  legendStep: { flex: 1 },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: 20, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroMain: { flex: 1, gap: spacing.xs, minWidth: 0 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1 },
  heroDistance: { marginTop: 2 },
  heroDistanceNumber: { fontSize: 54, lineHeight: 60 },
  heroDistanceUnit: { fontSize: 20 },
  heroSketch: { borderRadius: radius.md, overflow: 'hidden' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  heroStat: { flex: 1, gap: 2, minWidth: 0 },
  heroStatWide: { flex: 1.45 },
  heroDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: spacing.sm,
  },
  heroStatValue: { fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  heroStatUnit: { fontSize: 12 },
  heroStatLabel: { fontSize: 12, lineHeight: 16 },
  highlightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  highlight: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  highlightHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  highlightTitle: { fontSize: 13, lineHeight: 17, flex: 1 },
  highlightValue: { fontSize: 24, lineHeight: 30, marginTop: 4 },
  splits: { gap: spacing.sm },
  small: { fontSize: fontSize.xs, lineHeight: 18 },
  bars: { gap: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  barLabel: { width: 18, textAlign: 'right', fontSize: fontSize.sm },
  barTrack: { flex: 1, height: 22, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  badge: { fontSize: 11 },
  barValue: { width: 46, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 15 },
  barDelta: { width: 48, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 13 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartHeaderValue: { fontSize: fontSize.sm },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
