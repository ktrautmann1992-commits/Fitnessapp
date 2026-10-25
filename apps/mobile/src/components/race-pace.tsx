import {
  ageInYears,
  type Competition,
  isRunCompetitionDiscipline,
  racePaceDistanceM,
  racePacePlan,
  type RacePacePlan,
  type RacePaceStrategy,
  RACE_PACE_STRATEGIES,
  type TrackedRouteRow,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Button, Card, ChoiceList, Heading, Notice } from '@/components/ui';
import { currentLevel } from '@/data/competition';
import { showEnergyNumbers } from '@/data/nutrition-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { clockText, paceText } from '@/lib/competition-format';
import { appFont } from '@/lib/fonts';
import {
  courseFits,
  racePaceBars,
  racePaceFuelNotice,
  racePaceRows,
  racePaceTarget,
  type RacePaceTarget,
} from '@/lib/race-pace-format';
import { useThemeColors } from '@/lib/theme';
import { useTrackedRoutes } from '@/state/use-tracked-routes';

const P = t.racePace;

/**
 * Renn-Pace-Plan in „Mein Wettkampf“ (docs/PLAN-PHASE-10.md Abschnitt 21): Tabelle der Zwischenzeiten, einfache
 * Balken-Grafik, Aufteilung (gleichmäßig/negativ), optional Höhenprofil einer gespeicherten Strecke und die
 * Verpflegungspunkte aus der Wettkampf-Ernährung. Eigene Datei – die Wettkampf-Seite braucht nur eine Zeile.
 */

export interface RacePaceChoice {
  readonly strategy: RacePaceStrategy;
  readonly routeId: string | null;
  readonly preferPredicted: boolean;
}

export const DEFAULT_RACE_PACE_CHOICE: RacePaceChoice = {
  strategy: 'even',
  routeId: null,
  preferPredicted: false,
};

export interface RacePaceResult {
  readonly target: RacePaceTarget | null;
  readonly plan: RacePacePlan | null;
  readonly invalid: boolean;
  readonly course: TrackedRouteRow | null;
  readonly courses: readonly TrackedRouteRow[];
  readonly showNumbers: boolean;
}

/** Strecken mit Höhenprofil, die zur Renn-Distanz passen (±10 %), neueste zuerst. */
export function courseOptions(
  routes: readonly TrackedRouteRow[],
  distanceM: number,
): TrackedRouteRow[] {
  return routes.filter(
    (r) =>
      r.sport !== 'bike' &&
      (r.elevation_profile?.length ?? 0) >= 2 &&
      courseFits(r.distance_m, distanceM),
  );
}

/** Plan aus Wettkampf, Wahl und Zeilen (gleiche Rechnung in Karte und Druckansicht). */
export function useRacePace(
  competition: Pick<Competition, 'discipline' | 'targetTimeS' | 'reference' | 'raceDate'>,
  choice: RacePaceChoice,
  rows: UserRows | null,
): RacePaceResult {
  const { state } = useTrackedRoutes();
  const routes = state.kind === 'ready' ? state.result.routes : null;
  return useMemo(() => {
    const distanceM = racePaceDistanceM(competition.discipline);
    const target = racePaceTarget(competition, choice.preferPredicted);
    const showNumbers = showEnergyNumbers(rows);
    const courses = distanceM === null ? [] : courseOptions(routes ?? [], distanceM);
    const course = courses.find((r) => r.id === choice.routeId) ?? null;
    if (distanceM === null || target === null || rows === null) {
      return { target, plan: null, invalid: false, course, courses, showNumbers };
    }
    // „Nur allgemein“ wie die Wettkampf-Ernährung: unter 18 am Renntag oder ohne Einwilligung health_data.
    const minor = (() => {
      try {
        return rows.profile
          ? ageInYears(rows.profile.birth_date, competition.raceDate) < 18
          : false;
      } catch {
        return false;
      }
    })();
    const consent = rows.consents.some(
      (c) => c.consent_type === 'health_data' && c.revoked_at === null,
    );
    const result = racePacePlan({
      distanceM,
      targetTimeS: target.timeS,
      strategy: choice.strategy,
      elevationProfile: course?.elevation_profile
        ? course.elevation_profile.map((p) => [p[0] ?? 0, p[1] ?? 0] as [number, number])
        : null,
      fueling: { level: currentLevel(rows), generalOnly: minor || !consent },
      discipline: competition.discipline,
      reference: competition.reference,
    });
    return {
      target,
      plan: result.ok ? result.plan : null,
      invalid: !result.ok,
      course,
      courses,
      showNumbers,
    };
  }, [competition, choice, rows, routes]);
}

/** Einfache Balken-Grafik: ein Balken je Abschnitt, länger = langsamer; Verpflegung mit ◆. */
function PaceBars({ plan }: { plan: RacePacePlan }) {
  const palette = useAreaColors('ausdauer');
  const theme = useThemeColors();
  const bars = racePaceBars(plan);
  const paces = plan.splits.map((s) => s.paceSPerKm);
  return (
    <View
      accessible
      accessibilityLabel={P.chartA11y(paceText(Math.max(...paces)), paceText(Math.min(...paces)))}
      style={styles.bars}
      testID="race-pace-chart"
    >
      {bars.map((bar, i) => (
        <View key={bar.key} style={styles.barRow}>
          <Text style={[styles.barLabel, { color: theme.textMuted }]}>{bar.label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(bar.share * 100)}%`, backgroundColor: palette.strong },
              ]}
            />
          </View>
          <Text style={[styles.barValue, appFont('semibold'), { color: theme.text }]}>
            {`${paceText(plan.splits[i]?.paceSPerKm ?? 0)}${
              (plan.splits[i]?.fuel.length ?? 0) > 0 ? ` ${P.fuelMark}` : ''
            }`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function RacePaceCard({
  competition,
  rows,
  raceDate,
}: {
  competition: Competition;
  rows: UserRows;
  raceDate: string;
}) {
  const router = useRouter();
  const theme = useThemeColors();
  const [choice, setChoice] = useState<RacePaceChoice>(DEFAULT_RACE_PACE_CHOICE);
  const result = useRacePace(competition, choice, rows);
  const distanceM = racePaceDistanceM(competition.discipline);
  // Nur Laufen (Rad ohne Pace; Triathlon hat keine Zielzeit, W-G6).
  if (distanceM === null || !isRunCompetitionDiscipline(competition.discipline)) {
    return null;
  }
  const { plan, target } = result;
  const printHref = `/pace-plan?strategie=${choice.strategy}${
    choice.routeId ? `&strecke=${choice.routeId}` : ''
  }${choice.preferPredicted ? '&vorhersage=1' : ''}` as Href;
  return (
    <Card>
      <View style={styles.section} testID="race-pace">
        <Heading level={2}>{P.title}</Heading>
        {target === null ? (
          <Body muted testID="race-pace-no-target">
            {P.noTarget}
          </Body>
        ) : null}
        {result.invalid ? (
          <Notice tone="warning" testID="race-pace-invalid">
            {P.invalid}
          </Notice>
        ) : null}
        {plan && target ? (
          <>
            <Body testID="race-pace-intro">
              {target.source === 'target'
                ? P.intro(clockText(target.timeS), paceText(plan.averagePaceSPerKm))
                : P.introPredicted(clockText(target.timeS), paceText(plan.averagePaceSPerKm))}
            </Body>
            {plan.plausibility === 'not_plausible' && plan.predictedTimeS !== null ? (
              <Notice tone="warning" testID="race-pace-not-plausible">
                <Body>{P.notPlausible(clockText(plan.predictedTimeS))}</Body>
                <Button
                  label={P.usePredicted}
                  variant="secondary"
                  onPress={() => setChoice((c) => ({ ...c, preferPredicted: true }))}
                  testID="race-pace-use-predicted"
                />
              </Notice>
            ) : null}
            {target.source === 'predicted' && competition.targetTimeS !== null ? (
              <Button
                label={P.useTarget}
                variant="link"
                onPress={() => setChoice((c) => ({ ...c, preferPredicted: false }))}
                testID="race-pace-use-target"
              />
            ) : null}
            <ChoiceList<RacePaceStrategy>
              label={P.strategyLabel}
              options={RACE_PACE_STRATEGIES.map((value) => ({
                value,
                label: P.strategies[value].label,
              }))}
              value={choice.strategy}
              onChange={(strategy) => setChoice((c) => ({ ...c, strategy }))}
              horizontal
            />
            <Body muted>{P.strategies[choice.strategy].text}</Body>
            {result.courses.length > 0 ? (
              <ChoiceList<string>
                label={P.course}
                options={[
                  { value: '', label: P.courseNone },
                  ...result.courses.map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={choice.routeId ?? ''}
                onChange={(id) => setChoice((c) => ({ ...c, routeId: id === '' ? null : id }))}
              />
            ) : (
              <Body muted testID="race-pace-no-course">
                {P.courseNoRoutes}
              </Body>
            )}
            {plan.notices.includes('course_scaled') ? <Body muted>{P.courseScaled}</Body> : null}
            <PaceBars plan={plan} />
            <View accessibilityLabel={P.tableA11y} testID="race-pace-table">
              <View style={[styles.tableRow, styles.tableHead, { borderColor: theme.border }]}>
                <Text style={[styles.cellWide, appFont('semibold')]}>{P.col.segment}</Text>
                <Text style={[styles.cell, appFont('semibold')]}>{P.col.pace}</Text>
                <Text style={[styles.cell, appFont('semibold')]}>{P.col.total}</Text>
              </View>
              {racePaceRows(plan, result.showNumbers).map((row) => (
                <View key={row.key}>
                  <View
                    accessible
                    accessibilityLabel={row.a11y}
                    style={[styles.tableRow, { borderColor: theme.border }]}
                    testID={`race-pace-row-${row.key}`}
                  >
                    <View style={styles.cellWide}>
                      <Text>{row.segment}</Text>
                      {row.elevation ? (
                        <Text style={[styles.small, { color: theme.textMuted }]}>
                          {row.elevation}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.cell}>{row.pace}</Text>
                    <Text style={[styles.cell, appFont('semibold')]}>{row.total}</Text>
                  </View>
                  {row.fuel.map((line) => (
                    <Text
                      key={line}
                      style={[styles.fuel, { color: theme.text }]}
                      testID="race-pace-fuel"
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            {racePaceFuelNotice(plan) ? <Body muted>{racePaceFuelNotice(plan)}</Body> : null}
            <Body muted testID="race-pace-effort">
              {P.effortFirst}
            </Body>
            <Button
              label={P.fuelLink}
              variant="link"
              onPress={() => router.push(`/ernaehrung?tag=${raceDate}` as Href)}
              testID="race-pace-nutrition"
            />
            <Button
              label={P.print}
              accessibilityLabel={P.printA11y}
              variant="secondary"
              onPress={() => router.push(printHref)}
              testID="race-pace-print"
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  bars: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barLabel: { width: 40, fontSize: fontSize.xs, textAlign: 'right' },
  barTrack: { flex: 1, height: 12 },
  barFill: { height: 12, borderRadius: radius.pill },
  barValue: { width: 56, fontSize: fontSize.sm },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  tableHead: { borderBottomWidth: 1 },
  cellWide: { flex: 2 },
  cell: { flex: 1, textAlign: 'right' },
  small: { fontSize: fontSize.xs },
  fuel: { fontSize: fontSize.sm, paddingVertical: 4, paddingLeft: spacing.sm },
});
