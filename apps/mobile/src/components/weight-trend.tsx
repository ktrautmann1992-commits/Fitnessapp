import {
  daysBetween,
  type WeightEntry,
  weightTrend,
  type WeightTrend,
  type WeightTrendPoint,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { DashboardTile } from '@/components/dashboard';
import { EatingHelpNotice } from '@/components/nutrition';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { deviceStore } from '@/data/create-backend';
import { readJson, writeJson } from '@/data/kv';
import {
  weightEntriesFromHistory,
  weightEntriesFromRows,
  weightHistoryFrom,
  weightTrendContext,
  weightTrendVisibility,
} from '@/data/review';
import { t } from '@/i18n';
import { monthName } from '@/i18n/de-review';
import { formatDateDe, formatDecimal } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';
import { peekCycleSettings } from '@/state/use-cycle';

/**
 * Gewichtstrend im Reiter „Fortschritt“ (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 2, Gründer-Freigabe 25.10.2026):
 * Punkte = einzelne Werte (blass), Linie = geglätteter Trend (EMA aus packages/core), Tempo je Woche und – nur wenn
 * sicher – eine vorsichtige Schätzung zum Wunschgewicht. Rechnet nichts selbst (`weightTrend()`).
 *
 * Sichtbar nur mit gültiger Einwilligung health_data, bei „Kalorienzahlen anzeigen“ = an und wenn nicht auf diesem Gerät
 * ausgeblendet. Der Verlauf wird bei Bedarf geladen und nur im Arbeitsspeicher gehalten (nie geloggt, nie gespeichert).
 * Eigene Komponente, damit der Reiter Fortschritt nur eine Zeile dazubekommt (andere Zweige ändern ihn auch).
 */

export const WEIGHT_TREND_HIDDEN_KEY = 'fitnessapp.weight-trend-hidden.v1';

const r1 = (kg: number) => formatDecimal(Math.round(kg * 10) / 10);

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: WeightEntry[]; offline: boolean }
  | { kind: 'error' };

/** Gewichtsverlauf ab `from` laden (nur wenn `enabled`); ohne Verbindung die Werte auf dem Gerät. */
export function useWeightHistory(enabled: boolean, from: string) {
  const app = useApp();
  const [state, setState] = useState<HistoryState>({ kind: 'loading' });
  const rows = app.rows;
  // Nach jedem neuen Gewicht neu laden (die Zeilen ändern sich mit).
  const latestKey = useMemo(
    () =>
      rows?.bodyMetrics
        .filter((r) => r.weight_kg !== null)
        .map((r) => `${r.measured_on}:${r.weight_kg}`)
        .join('|') ?? '',
    [rows],
  );
  const [attempt, setAttempt] = useState(0);
  const backend = app.backend;
  useEffect(() => {
    if (!enabled || !rows) return;
    let alive = true;
    backend
      .loadWeightHistory(from)
      .then((history) => {
        if (alive) {
          setState({ kind: 'ready', entries: weightEntriesFromHistory(history), offline: false });
        }
      })
      .catch(() => {
        if (!alive) return;
        // Ohne Verbindung: die Werte auf dem Gerät (Supabase: nur die neuesten). Keine Details ins Log.
        const fallback = weightEntriesFromRows(rows);
        setState(
          fallback.length > 0
            ? { kind: 'ready', entries: fallback, offline: true }
            : { kind: 'error' },
        );
      });
    return () => {
      alive = false;
    };
    // latestKey statt rows: nur neu laden, wenn sich ein Gewicht ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, backend, from, latestKey, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}

/** „Gewichtstrend ausblenden“ – nur auf diesem Gerät; null = noch nicht gelesen. */
export function useWeightTrendHidden(): [boolean | null, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    void readJson<boolean>(deviceStore, WEIGHT_TREND_HIDDEN_KEY)
      .then((value) => setHidden(value === true))
      .catch(() => setHidden(false));
  }, []);
  const update = useCallback((next: boolean) => {
    setHidden(next);
    void writeJson(deviceStore, WEIGHT_TREND_HIDDEN_KEY, next).catch(() => undefined);
  }, []);
  return [hidden, update];
}

export function WeightTrendSection() {
  const app = useApp();
  const router = useRouter();
  const today = useToday();
  const [hidden, setHiddenPref] = useWeightTrendHidden();
  const rows = app.rows;
  const consentValid = rows ? healthConsentStatus(rows, app.versions) === 'valid' : false;
  const visibility =
    rows && hidden !== null
      ? weightTrendVisibility({ rows, consentValid, hiddenOnDevice: hidden })
      : null;
  const { state, reload } = useWeightHistory(visibility === 'visible', weightHistoryFrom(today));
  const texts = t.weightTrend;

  const toggleHidden = setHiddenPref;

  if (!rows || visibility === null) return null;

  const tile = (children: ReactNode) => (
    <DashboardTile title={texts.title} area="fortschritt" icon="scale" testID="weight-trend">
      {children}
    </DashboardTile>
  );

  if (visibility === 'no_consent') {
    return tile(
      <>
        <Body muted testID="weight-trend-no-consent">
          {texts.noConsent}
        </Body>
        <Button
          label={texts.grantConsent}
          variant="secondary"
          onPress={() => router.push('/health-consent' as Href)}
        />
      </>,
    );
  }
  if (visibility === 'hidden_by_numbers') {
    return tile(
      <Body muted testID="weight-trend-hidden-numbers">
        {texts.hiddenByNumbers}
      </Body>,
    );
  }
  if (visibility === 'hidden') {
    return tile(
      <>
        <Body muted testID="weight-trend-hidden">
          {texts.hidden}
        </Body>
        <Button
          label={texts.show}
          variant="secondary"
          onPress={() => toggleHidden(false)}
          testID="weight-trend-show"
        />
      </>,
    );
  }

  const addWeight = (
    <Button
      label={texts.addWeight}
      variant="secondary"
      onPress={() => router.push('/onboarding/body_metrics?edit=1' as Href)}
      testID="weight-trend-add"
    />
  );
  const hide = (
    <Button
      label={texts.hide}
      variant="secondary"
      onPress={() => toggleHidden(true)}
      testID="weight-trend-hide"
    />
  );

  if (state.kind === 'loading') return tile(<LoadingState label={texts.loading} />);
  if (state.kind === 'error') {
    return tile(
      <>
        <Notice tone="danger">{texts.error}</Notice>
        <Button label={texts.retry} variant="secondary" onPress={reload} />
      </>,
    );
  }

  const context = weightTrendContext({
    rows,
    answers: app.answers,
    versions: app.versions,
    cyclePregnant: peekCycleSettings(app.session?.userId ?? null)?.status === 'pregnant',
  });
  let trend: WeightTrend;
  try {
    trend = weightTrend({
      entries: state.entries,
      today,
      goal: context.goal,
      pregnancy: context.pregnancy,
      maxWeeklyLossFraction: context.maxWeeklyLossFraction,
    });
  } catch {
    // Ungültige Werte (sollte die Datenbank verhindern) – nie Werte loggen.
    return tile(<Notice tone="danger">{texts.error}</Notice>);
  }

  return tile(
    <>
      <Body muted>{texts.intro}</Body>
      {state.offline ? <Notice tone="warning">{texts.offline}</Notice> : null}
      {trend.status === 'empty' ? (
        <Body testID="weight-trend-empty">{texts.empty}</Body>
      ) : (
        <WeightTrendDetails
          trend={trend}
          cycleHint={context.cycleHint}
          pregnancy={context.pregnancy}
          activeAging={context.activeAging}
        />
      )}
      {addWeight}
      {hide}
    </>,
  );
}

function WeightTrendDetails({
  trend,
  cycleHint,
  pregnancy,
  activeAging,
}: {
  trend: WeightTrend;
  cycleHint: boolean;
  pregnancy: boolean;
  activeAging: boolean;
}) {
  const texts = t.weightTrend;
  const latest = trend.latest;
  if (!latest) return null;
  const rate = trend.rate;
  const forecast = trend.forecast;
  const forecastText =
    forecast.kind === 'date'
      ? texts.forecast(monthName(forecast.date.slice(0, 7)))
      : forecast.reason in texts.forecastNone
        ? texts.forecastNone[forecast.reason as keyof typeof texts.forecastNone]
        : null;
  return (
    <View style={styles.details}>
      {trend.status === 'ready' ? <WeightTrendChart points={trend.points} /> : null}
      {trend.status === 'ready' ? (
        <View style={styles.legend}>
          <Body muted>{texts.legendDots}</Body>
          <Body muted>{texts.legendLine}</Body>
        </View>
      ) : null}
      <Body testID="weight-trend-latest">
        {texts.trend(r1(latest.trendKg), formatDateDe(latest.date))}
      </Body>
      {trend.status === 'single' ? <Body muted>{texts.single}</Body> : null}
      {trend.stale ? (
        <Body muted testID="weight-trend-stale">
          {texts.stale}
        </Body>
      ) : null}
      {rate !== null && !trend.tooFast ? (
        <Body testID="weight-trend-rate">
          {rate.direction === 'stable'
            ? texts.rate.stable
            : texts.rate[rate.direction](r1(Math.abs(rate.kgPerWeek)))}
        </Body>
      ) : null}
      {rate === null && trend.status === 'ready' && !trend.stale && !pregnancy ? (
        <Body muted testID="weight-trend-rate-few">
          {texts.rateTooFew}
        </Body>
      ) : null}
      {trend.restarted ? <Body muted>{texts.restarted}</Body> : null}
      {trend.tooFast ? (
        <View testID="weight-trend-too-fast" style={styles.details}>
          <Notice tone="warning">{activeAging ? texts.tooFastActiveAging : texts.tooFast}</Notice>
          <EatingHelpNotice />
        </View>
      ) : null}
      {forecastText !== null ? (
        <Body muted={forecast.kind !== 'date'} testID="weight-trend-forecast">
          {forecastText}
        </Body>
      ) : null}
      {cycleHint ? (
        <Body muted testID="weight-trend-cycle">
          {texts.cycleHint}
        </Body>
      ) : null}
    </View>
  );
}

const CHART_HEIGHT = 170;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

/** Liniendiagramm: blasse Punkte (Werte) und eine Linie je Abschnitt (Trend). Achsen zurückhaltend. */
export function WeightTrendChart({ points }: { points: readonly WeightTrendPoint[] }) {
  const theme = useThemeColors();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const values = points.flatMap((p) => [p.weightKg, p.trendKg]);
  const min = Math.floor(Math.min(...values) - 0.5);
  const max = Math.ceil(Math.max(...values) + 0.5);
  const spanDays = Math.max(1, daysBetween(first.date, last.date));
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + (daysBetween(first.date, date) / spanDays) * plotW;
  const y = (kg: number) => PAD.top + ((max - kg) / (max - min)) * plotH;
  const segments = new Map<number, WeightTrendPoint[]>();
  for (const p of points) segments.set(p.segment, [...(segments.get(p.segment) ?? []), p]);
  const ticks = [max, (max + min) / 2, min];
  const a11y = t.weightTrend.chartA11y(
    points.length,
    formatDateDe(first.date),
    formatDateDe(last.date),
    r1(first.trendKg),
    r1(last.trendKg),
  );
  return (
    <View
      onLayout={onLayout}
      style={{ height: CHART_HEIGHT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
      testID="weight-trend-chart"
    >
      {width > 0 ? (
        <Svg width={width} height={CHART_HEIGHT}>
          {ticks.map((tick) => (
            <Line
              key={`grid-${tick}`}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={theme.divider}
              strokeWidth={1}
            />
          ))}
          {ticks.map((tick) => (
            <SvgText
              key={`label-${tick}`}
              x={PAD.left - 6}
              y={y(tick) + 4}
              fontSize={fontSize.xs - 2}
              fill={theme.textMuted}
              textAnchor="end"
            >
              {r1(tick)}
            </SvgText>
          ))}
          <SvgText
            x={PAD.left}
            y={CHART_HEIGHT - 6}
            fontSize={fontSize.xs - 2}
            fill={theme.textMuted}
          >
            {formatDateDe(first.date).slice(0, 6)}
          </SvgText>
          <SvgText
            x={width - PAD.right}
            y={CHART_HEIGHT - 6}
            fontSize={fontSize.xs - 2}
            fill={theme.textMuted}
            textAnchor="end"
          >
            {formatDateDe(last.date).slice(0, 6)}
          </SvgText>
          {points.map((p) => (
            <Circle
              key={`dot-${p.date}`}
              cx={x(p.date)}
              cy={y(p.weightKg)}
              r={3}
              fill={theme.textMuted}
              opacity={0.35}
            />
          ))}
          {[...segments.values()].map((segment) =>
            segment.length > 1 ? (
              <Path
                key={`line-${segment[0]?.date}`}
                d={segment
                  .map(
                    (p, i) =>
                      `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.trendKg).toFixed(1)}`,
                  )
                  .join(' ')}
                stroke={theme.primary}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          <Circle
            cx={x(last.date)}
            cy={y(last.trendKg)}
            r={4}
            fill={theme.primary}
            stroke={theme.surface}
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  details: { gap: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
});
