import {
  type AttemptComparison,
  attemptPaceText,
  averagePaceS,
  durationText,
  formatCompareDuration,
  isoDateInTimeZone,
  type MyRouteTile,
  paceText,
  type RouteHistoryPoint,
  sketchPath,
  sketchPoints,
  speedText,
  type TrackedRouteRow,
  usesSpeed,
  weatherLine,
} from '@fitnessapp/core';
import { areaColors, fontSize, heroColors, radius, spacing } from '@fitnessapp/ui';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Icon, SectionLabel } from '@/components/design';
import { Text } from '@/components/text';
import { Body, ChoiceList, MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { appFont, displayFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

/**
 * „Meine Strecken“ (25.10.2026, Mockups 2–4): Kacheln mit Skizze, Vorschlagskarte „Gleiche Strecke wie …“, dunkle
 * Karte „Zum letzten Mal“, Verlauf aller Läufe (zeitliche Reihenfolge), Kilometer im Vergleich (türkis = schneller,
 * orange = langsamer – keine Wertung gut/schlecht) und Liste aller Läufe. Rechnungen in packages/core
 * (routes/match.ts, compare.ts, my-routes.ts); hier nur Darstellung. Werte stehen immer auch als Text da, jede Grafik
 * hat eine Ansage in Worten. Keine Pulswerte, keine Kalorien (bleiben auf der Seite des einzelnen Laufs).
 */

const R = t.endurance.routes;
const E = t.endurance;
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

/** „Fr 24.10.“ (Berliner Tag des Beginns). */
export function shortDayDe(startedAt: string, withWeekday = true): string {
  const day = isoDateInTimeZone(startedAt);
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
  const text = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
  return withWeekday ? `${wd} ${text}` : text;
}

/** Kachel-Farben je Strecke (wechselnd wie im Mockup): Orange, Türkis, Violett, Grün. */
const TILE_AREAS = ['ausdauer', 'einkaufen', 'workouts', 'ernaehrung'] as const;

/** Türkis = schneller, Orange = langsamer (neutral, keine Ampel). */
export function useCompareColors(): { faster: string; slower: string } {
  const scheme = useColorSchemeName();
  return {
    faster: areaColors[scheme].einkaufen.strong,
    slower: areaColors[scheme].ausdauer.strong,
  };
}

/** Neutraler Kurztext zum Vergleich mit dem letzten Mal („1:12 min schneller“, „etwa gleich schnell“). */
export function shortCompareText(c: Pick<AttemptComparison, 'code' | 'diffS'>): string | null {
  switch (c.code) {
    case 'faster':
      return `${formatCompareDuration(c.diffS)} ${E.detail.legendFast}`;
    case 'slower':
      return `${formatCompareDuration(c.diffS)} ${E.detail.legendSlow}`;
    case 'same':
      return 'etwa gleich schnell';
    case 'not_comparable':
      return R.notComparable;
    case 'first':
      return null;
  }
}

function paceOrSpeedShort(sport: TrackedRouteRow['sport'], movingS: number, distanceM: number) {
  if (usesSpeed(sport)) {
    return movingS > 0 ? speedText(distanceM / 1000 / (movingS / 3600)) : '–';
  }
  const p = averagePaceS(distanceM, movingS);
  return p === null ? '–' : paceText(p).replace(' min/km', ' /km');
}

// ---------------------------------------------------------------------------------------------------------
// Skizze
// ---------------------------------------------------------------------------------------------------------
export function MiniSketch({
  points,
  color,
  size = 56,
}: {
  points: readonly { lat: number; lng: number }[];
  color: string;
  size?: number;
}) {
  const theme = useThemeColors();
  const projected = sketchPoints(points, { width: size, height: size, padding: 7, maxPoints: 120 });
  const first = projected[0];
  return (
    <View
      style={[styles.miniSketch, { width: size, height: size, backgroundColor: theme.surface }]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {projected.length > 1 ? (
        <Svg width={size} height={size}>
          <Path
            d={sketchPath(projected)}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {first ? <Circle cx={first.x} cy={first.y} r={3.5} fill={theme.text} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Heutige Linie (Orange) über der gemerkten Strecke (Grau) – gemeinsamer Ausschnitt. */
export function OverlaySketch({
  today,
  saved,
  name,
  height = 120,
}: {
  today: readonly { lat: number; lng: number }[];
  saved: readonly { lat: number; lng: number }[];
  name: string;
  height?: number;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const [width, setWidth] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  const box = { width, height, padding: 12, maxPoints: 200 };
  // Gemeinsamer Ausschnitt: beide Linien zusammen projizieren, dann wieder trennen.
  const both = sketchPoints([...saved, ...today], { ...box, maxPoints: 100_000 });
  const savedPts = both.slice(0, saved.length);
  const todayPts = both.slice(saved.length);
  const orange = areaColors[scheme].ausdauer.strong;
  return (
    <View
      onLayout={onLayout}
      style={[styles.overlay, { backgroundColor: theme.background }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={R.overlayA11y(name)}
      testID="route-match-overlay"
    >
      <Svg width={width} height={height}>
        {savedPts.length > 1 ? (
          <Path
            d={sketchPath(savedPts)}
            stroke={theme.border}
            strokeWidth={9}
            strokeOpacity={0.9}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {todayPts.length > 1 ? (
          <Path
            d={sketchPath(todayPts)}
            stroke={orange}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
      <View style={styles.overlayLegend}>
        <LegendDot color={orange} label={R.overlayToday} />
        <LegendDot color={theme.border} label={R.overlaySaved} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.small, appFont('semibold'), { color: theme.text }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Ausdauer: Kacheln „Meine Strecken“
// ---------------------------------------------------------------------------------------------------------
export function MyRouteTiles({
  tiles,
  points,
  onOpen,
}: {
  tiles: readonly MyRouteTile<TrackedRouteRow>[];
  points: ReadonlyMap<string, readonly { lat: number; lng: number }[]>;
  onOpen: (id: string) => void;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.tiles} testID="my-routes">
      {tiles.map((tile, i) => {
        const area = TILE_AREAS[i % TILE_AREAS.length] as (typeof TILE_AREAS)[number];
        const palette = areaColors[scheme][area];
        const f = tile.favorite;
        const sport = f.e_bike ? E.eBike.sport : E.sports[f.sport];
        const meta = `${sport} · ${(f.distance_m / 1000).toFixed(1).replace('.', ',')} km · ${R.runs(tile.runs, f.sport)}`;
        const cmp = shortCompareText(tile.last);
        const last = `${R.last(shortDayDe(tile.last.startedAt), durationText(tile.last.movingS))}${
          cmp && tile.last.code !== 'not_comparable' ? ` · ${cmp}` : ''
        }`;
        return (
          <Pressable
            key={f.id}
            onPress={() => onOpen(f.id)}
            accessibilityRole="button"
            accessibilityLabel={R.tileA11y(f.name, meta, last)}
            testID={`my-route-${f.id}`}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: palette.surface,
                borderColor: palette.soft,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <MiniSketch points={points.get(f.id) ?? []} color={palette.icon} />
            <View style={styles.tileText}>
              <Text
                style={[styles.tileTitle, appFont('bold'), { color: theme.text }]}
                numberOfLines={2}
              >
                {f.name}
              </Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>{meta}</Text>
              <Text style={[styles.small, appFont('semibold'), { color: theme.text }]}>{last}</Text>
            </View>
            <Icon name="chevron" size={18} color={theme.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Dunkle Karte „Zum letzten Mal“
// ---------------------------------------------------------------------------------------------------------
export function LastTimeCard({
  title,
  headline,
  sport,
  previous,
  current,
  children,
  testID = 'route-last-time',
}: {
  title: string;
  headline: string;
  sport: TrackedRouteRow['sport'];
  previous: Pick<TrackedRouteRow, 'moving_s' | 'distance_m'> | null;
  current: Pick<TrackedRouteRow, 'moving_s' | 'distance_m'>;
  children?: ReactNode;
  testID?: string;
}) {
  const hero = heroColors[useColorSchemeName()];
  const orange = areaColors.dark.ausdauer.icon;
  const speed = usesSpeed(sport);
  const paceLine = previous ? attemptPaceText(sport, previous, current) : null;
  const paceA = previous ? paceOrSpeedShort(sport, previous.moving_s, previous.distance_m) : null;
  const paceB = paceOrSpeedShort(sport, current.moving_s, current.distance_m);
  return (
    <View
      testID={testID}
      style={[styles.hero, { backgroundColor: hero.background, borderColor: hero.border }]}
    >
      <Text style={[styles.heroEyebrow, appFont('bold'), { color: orange }]}>
        {title.toUpperCase()}
      </Text>
      <Text
        style={[styles.heroHeadline, displayFont(), { color: hero.text }]}
        accessibilityRole="header"
        testID={`${testID}-text`}
      >
        {headline}
      </Text>
      {previous ? (
        <View style={styles.heroStats}>
          <HeroPair
            label={R.time}
            a={durationText(previous.moving_s)}
            b={durationText(current.moving_s)}
          />
          <HeroPair
            label={speed ? R.speed : R.pace}
            a={(paceA ?? '').replace(' /km', '').replace(' km/h', '')}
            b={paceB}
            a11y={paceLine ?? undefined}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function HeroPair({ label, a, b, a11y }: { label: string; a: string; b: string; a11y?: string }) {
  const hero = heroColors[useColorSchemeName()];
  return (
    <View
      style={[styles.heroPair, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
      accessible
      accessibilityLabel={a11y ?? R.arrowA11y(label, a, b)}
    >
      <Text style={[styles.small, appFont('semibold'), { color: hero.muted }]}>{label}</Text>
      <Text style={[styles.heroPairValue, appFont('extrabold'), { color: hero.text }]}>
        {R.arrow(a, b)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Verlauf (zeitliche Reihenfolge)
// ---------------------------------------------------------------------------------------------------------
export function RouteHistoryChart({
  history,
  sport,
}: {
  history: readonly RouteHistoryPoint[];
  sport: TrackedRouteRow['sport'];
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const orange = areaColors[scheme].ausdauer.strong;
  const speed = usesSpeed(sport);
  const [mode, setMode] = useState<'time' | 'pace'>('time');
  const [width, setWidth] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  const pts = history.filter((h) => h.comparable);
  if (pts.length < 2) {
    return (
      <View style={styles.section} testID="route-history">
        <SectionLabel>{R.history}</SectionLabel>
        <Body muted testID="route-history-few">
          {R.historyTooFew}
        </Body>
      </View>
    );
  }
  const value = (h: RouteHistoryPoint) =>
    mode === 'time' ? h.movingS : speed ? (h.speedKmh ?? 0) : (h.paceS ?? 0);
  const label = (v: number) =>
    mode === 'time'
      ? durationText(v)
      : speed
        ? speedText(v).replace(' km/h', '')
        : paceText(v).replace(' min/km', '');
  const values = pts.map(value);
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const pad = Math.max(mode === 'time' ? 10 : speed ? 0.3 : 3, (hi0 - lo0) * 0.15);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const height = 170;
  const left = 8;
  const right = 8;
  const top = 22;
  const bottom = height - 26;
  // Größerer Wert = weiter oben: Zeit und Pace → unten = kürzer bzw. schneller; Rad-Tempo (km/h) → oben = schneller.
  const t0 = Date.parse(pts[0]?.startedAt ?? '');
  const t1 = Date.parse(pts.at(-1)?.startedAt ?? '');
  const span = Math.max(1, t1 - t0);
  const x = (h: RouteHistoryPoint) =>
    left + ((Date.parse(h.startedAt) - t0) / span) * (width - left - right);
  const y = (v: number) => {
    const f = (v - lo) / (hi - lo || 1);
    return bottom - f * (bottom - top);
  };
  const d = pts
    .map((h, i) => `${i === 0 ? 'M' : 'L'}${x(h).toFixed(1)} ${y(value(h)).toFixed(1)}`)
    .join('');
  const first = pts[0] as RouteHistoryPoint;
  const last = pts.at(-1) as RouteHistoryPoint;
  const diff = last.movingS - first.movingS;
  const since =
    Math.abs(diff) <= 5
      ? R.historySinceFirstSame
      : diff < 0
        ? R.historySinceFirstShorter(formatCompareDuration(-diff))
        : R.historySinceFirstLonger(formatCompareDuration(diff));
  const axis = mode === 'time' ? R.historyAxisTime : speed ? R.historyAxisSpeed : R.historyAxisPace;
  return (
    <View style={styles.section} testID="route-history">
      <View style={styles.historyHead}>
        <SectionLabel>{R.history}</SectionLabel>
        <View style={styles.historySwitch}>
          <ChoiceList<'time' | 'pace'>
            groupLabel={R.historySwitchA11y}
            options={[
              { value: 'time', label: R.historyTime },
              { value: 'pace', label: speed ? R.historySpeed : R.historyPace },
            ]}
            value={mode}
            onChange={setMode}
            horizontal
          />
        </View>
      </View>
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${R.historyA11y(
          pts.length,
          shortDayDe(first.startedAt, false),
          shortDayDe(last.startedAt, false),
        )}. ${pts.map((h) => `${shortDayDe(h.startedAt, false)} ${label(value(h))}`).join(', ')}`}
        testID="route-history-chart"
      >
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => {
            const gy = top + f * (bottom - top);
            return (
              <Line
                key={f}
                x1={0}
                x2={width}
                y1={gy}
                y2={gy}
                stroke={theme.border}
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            );
          })}
          <Path d={d} stroke={orange} strokeWidth={3} fill="none" strokeLinejoin="round" />
          {pts.map((h, i) => {
            const isLast = i === pts.length - 1;
            return (
              <Circle
                key={h.routeId}
                cx={x(h)}
                cy={y(value(h))}
                r={isLast ? 6 : 4.5}
                fill={isLast ? orange : theme.surface}
                stroke={orange}
                strokeWidth={2.5}
              />
            );
          })}
          {[first, last].map((h, i) => {
            const vx = x(h);
            const vy = y(value(h));
            return (
              <SvgText
                key={`${h.routeId}-${i}`}
                x={i === 0 ? Math.max(2, vx) : Math.min(width - 2, vx)}
                y={vy < top + 14 ? vy + 18 : vy - 10}
                fontSize={11}
                fontWeight="700"
                fill={theme.text}
                textAnchor={i === 0 ? 'start' : 'end'}
              >
                {label(value(h))}
              </SvgText>
            );
          })}
          {pts.map((h, i) =>
            i === 0 || i === pts.length - 1 || pts.length <= 6 ? (
              <SvgText
                key={`d-${h.routeId}`}
                x={Math.min(width - 16, Math.max(16, x(h)))}
                y={height - 8}
                fontSize={10}
                fill={theme.textMuted}
                textAnchor="middle"
              >
                {shortDayDe(h.startedAt, false)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      </View>
      <Text style={[styles.small, { color: theme.textMuted }]}>{axis}</Text>
      <Body testID="route-history-since">{`${since} ${R.historyNote}`}</Body>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kilometer im Vergleich
// ---------------------------------------------------------------------------------------------------------
export function SplitCompareBars({
  previous,
  current,
}: {
  previous: Pick<TrackedRouteRow, 'km_splits' | 'started_at'>;
  current: Pick<TrackedRouteRow, 'km_splits' | 'started_at'>;
}) {
  const theme = useThemeColors();
  const colors = useCompareColors();
  const n = Math.min(previous.km_splits.length, current.km_splits.length);
  const rows = Array.from({ length: n }, (_, i) => {
    const a = previous.km_splits[i] as number;
    const b = current.km_splits[i] as number;
    return { km: i + 1, a, b, delta: b - a };
  });
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  return (
    <View style={styles.section} testID="route-split-compare">
      <SectionLabel>{R.splits}</SectionLabel>
      <Body muted>
        {R.splitsSub(shortDayDe(current.started_at, false), shortDayDe(previous.started_at, false))}
      </Body>
      {n === 0 ? (
        <Body muted>{R.splitsEmpty}</Body>
      ) : (
        <>
          <View style={styles.legend}>
            <LegendDot color={colors.faster} label={R.splitsLegendFaster} />
            <LegendDot color={colors.slower} label={R.splitsLegendSlower} />
          </View>
          {rows.map((r) => {
            const deltaText =
              r.delta === 0
                ? R.deltaSame
                : r.delta < 0
                  ? R.deltaFaster(-r.delta)
                  : R.deltaSlower(r.delta);
            const color = r.delta < 0 ? colors.faster : colors.slower;
            const share = Math.abs(r.delta) / max;
            return (
              <View
                key={r.km}
                style={styles.splitRow}
                accessible
                accessibilityLabel={R.splitsRow(
                  r.km,
                  durationText(r.a),
                  durationText(r.b),
                  deltaText,
                )}
                testID={`route-split-${r.km}`}
              >
                <Text style={[styles.splitKm, { color: theme.textMuted }]}>{`km ${r.km}`}</Text>
                <Text style={[styles.splitTimes, appFont('semibold'), { color: theme.text }]}>
                  {R.arrow(durationText(r.a), durationText(r.b))}
                </Text>
                <View style={styles.splitBarBox}>
                  <View style={[styles.splitAxis, { backgroundColor: theme.border }]} />
                  {r.delta !== 0 ? (
                    <View
                      style={[
                        styles.splitBar,
                        {
                          backgroundColor: color,
                          width: `${Math.max(6, share * 50)}%`,
                          ...(r.delta < 0 ? { right: '50%' } : { left: '50%' }),
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.splitDelta,
                    appFont('bold'),
                    { color: r.delta === 0 ? theme.textMuted : color },
                  ]}
                >
                  {r.delta === 0 ? '±0 s' : `${r.delta < 0 ? '−' : '+'}${Math.abs(r.delta)} s`}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Alle Läufe (zeitlich, neueste oben); nicht vergleichbare grau
// ---------------------------------------------------------------------------------------------------------
export function RouteRunList({
  attempts,
  routes,
  sport,
  onOpen,
}: {
  attempts: readonly AttemptComparison[];
  routes: ReadonlyMap<string, TrackedRouteRow>;
  sport: TrackedRouteRow['sport'];
  onOpen: (id: string) => void;
}) {
  const theme = useThemeColors();
  const rows = [...attempts].reverse();
  return (
    <View style={styles.section} testID="route-runs">
      <SectionLabel>{R.list}</SectionLabel>
      {rows.map((a, i) => {
        const r = routes.get(a.routeId);
        const grey = a.code === 'not_comparable';
        const pace = paceOrSpeedShort(sport, a.movingS, a.distanceM);
        const cmp =
          a.code === 'first'
            ? R.listFirst
            : grey
              ? `${(a.distanceM / 1000).toFixed(1).replace('.', ',')} km · ${R.notComparable}`
              : shortCompareText(a);
        const info = grey ? (cmp ?? '') : `${pace} · ${cmp ?? ''}`;
        const source =
          r?.source === 'watch'
            ? R.sourceWatch
            : r?.source === 'gpx_import'
              ? R.sourceGpx
              : R.sourceApp;
        const day = shortDayDe(a.startedAt);
        const auto = a.matchKind === 'auto';
        return (
          <Pressable
            key={a.routeId}
            onPress={() => onOpen(a.routeId)}
            accessibilityRole="button"
            accessibilityLabel={`${R.listItemA11y(day, durationText(a.movingS), info, source)}${
              auto ? `, ${R.listAutoA11y}` : ''
            }${r?.weather ? `, ${weatherLine(r.weather)}` : ''}`}
            testID={`route-run-${a.routeId}`}
            style={({ pressed }) => [
              styles.runRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              { opacity: pressed ? 0.7 : grey ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[
                styles.runDay,
                appFont('bold'),
                { color: grey ? theme.textMuted : theme.text },
              ]}
            >
              {day}
            </Text>
            <Text
              style={[
                styles.runTime,
                appFont('bold'),
                { color: grey ? theme.textMuted : theme.text },
              ]}
            >
              {durationText(a.movingS)}
            </Text>
            <View style={styles.runInfo}>
              <Text style={[styles.small, { color: theme.textMuted }]}>
                {info}
                {auto ? ` · ${R.listAuto}` : ''}
              </Text>
              {r?.weather ? (
                <Text
                  style={[styles.small, { color: theme.textMuted }]}
                  testID={`route-run-weather-${a.routeId}`}
                >
                  {weatherLine(r.weather)}
                </Text>
              ) : null}
            </View>
            <SourceBadge label={source} watch={r?.source === 'watch'} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function SourceBadge({ label, watch }: { label: string; watch: boolean }) {
  const scheme = useColorSchemeName();
  const palette = watch ? areaColors[scheme].training : areaColors[scheme].ausdauer;
  return (
    <View style={[styles.badge, { backgroundColor: palette.surface }]}>
      <Text style={[styles.badgeText, appFont('bold'), { color: palette.icon }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Schalter (role switch)
// ---------------------------------------------------------------------------------------------------------
export function ToggleRow({
  label,
  value,
  onChange,
  disabled = false,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const on = areaColors[scheme].ernaehrung.icon;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      disabled={disabled}
      onPress={() => onChange(!value)}
      testID={testID}
      style={styles.toggleRow}
    >
      <Text style={[styles.toggleLabel, appFont('semibold'), { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? on : theme.border, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <View style={[styles.toggleKnob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  small: { fontSize: fontSize.sm },
  miniSketch: { borderRadius: radius.md, overflow: 'hidden' },
  overlay: { borderRadius: radius.md, overflow: 'hidden' },
  overlayLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  tiles: { gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: MIN_TOUCH,
  },
  tileText: { flex: 1, gap: 2 },
  tileTitle: { fontSize: fontSize.md },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  heroEyebrow: { fontSize: fontSize.xs, letterSpacing: 0.8 },
  heroHeadline: { fontSize: 24, lineHeight: 30 },
  heroStats: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  heroPair: { flexGrow: 1, flexBasis: 130, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  heroPairValue: { fontSize: fontSize.md },
  historyHead: { gap: spacing.xs },
  historySwitch: { alignSelf: 'flex-start' },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
  splitKm: { width: 38, fontSize: fontSize.sm },
  splitTimes: { width: 92, fontSize: fontSize.sm },
  splitBarBox: { flex: 1, height: 12, justifyContent: 'center' },
  splitAxis: { position: 'absolute', left: '50%', width: 1, top: -4, bottom: -4 },
  splitBar: { position: 'absolute', height: 10, borderRadius: 5 },
  splitDelta: { width: 48, textAlign: 'right', fontSize: fontSize.sm },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH,
  },
  runDay: { width: 72, fontSize: fontSize.sm },
  runTime: { width: 54, fontSize: fontSize.sm },
  runInfo: { flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: fontSize.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
  },
  toggleLabel: { flex: 1, fontSize: fontSize.md },
  toggleTrack: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
});
