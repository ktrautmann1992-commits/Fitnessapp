import { enduranceTileSummary, enduranceWeekBars } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { DashboardTile } from '@/components/dashboard';
import { MiniBars, StatValue } from '@/components/design';
import { activitiesFromRows } from '@/data/endurance-rows';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { useTrackedRoutes } from '@/state/use-tracked-routes';

/**
 * Kachel „Ausdauer“ auf der Übersicht (Etappe E4, docs/PLAN-EINKAUFEN-AUSDAUER.md 6; Design 20.10.2026): km dieser
 * Woche als große Zahl und Mini-Balken je Wochentag (Aufzeichnungen + Einträge ohne GPS, ohne Doppelzählung). Die
 * ganze Kachel führt zu „Ausdauer“. Rechnet nichts selbst (packages/core: enduranceTileSummary, enduranceWeekBars).
 */
export function EnduranceTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const { state } = useTrackedRoutes();
  const result = state.kind === 'ready' ? state.result : null;
  const activities = useMemo(
    () => activitiesFromRows(rows, result?.routes ?? [], result?.pending ?? []),
    [rows, result],
  );
  const tile = useMemo(() => enduranceTileSummary(activities, today), [activities, today]);
  const bars = useMemo(() => enduranceWeekBars(activities, today), [activities, today]);
  const T = t.endurance.tile;
  const weekText = T.week(tile.weekDistanceM, tile.weekCount);
  return (
    <DashboardTile
      title={T.title}
      area="ausdauer"
      icon="run"
      testID="overview-endurance"
      pressTestID="overview-endurance-open"
      accessibilityLabel={`${T.title}: ${weekText}`}
      onPress={() => router.push('/ausdauer' as Href)}
    >
      <StatValue
        value={T.kmValue(tile.weekDistanceM)}
        label={T.statLabel(tile.weekCount)}
        size="lg"
        accessibilityLabel={weekText}
        testID="overview-endurance-week"
      />
      <MiniBars
        values={bars.days.map((d) => d.share)}
        area="ausdauer"
        highlightIndex={bars.todayIndex}
        accessibilityLabel={T.barsA11y(bars.days.map((d) => d.distanceM))}
        testID="overview-endurance-bars"
      />
    </DashboardTile>
  );
}
