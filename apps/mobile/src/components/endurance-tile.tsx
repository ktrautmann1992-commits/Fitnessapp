import { enduranceTileSummary } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { DashboardTile } from '@/components/dashboard';
import { Body, Button } from '@/components/ui';
import { activitiesFromRows } from '@/data/endurance-rows';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useTrackedRoutes } from '@/state/use-tracked-routes';

/**
 * Kachel „Ausdauer“ auf der Übersicht (Etappe E4, docs/PLAN-EINKAUFEN-AUSDAUER.md 6): km dieser Woche und die letzte
 * Aktivität (Aufzeichnungen + Einträge ohne GPS, ohne Doppelzählung). Eigene Datei, damit die Übersicht (E2) nur eine
 * Zeile dazu braucht.
 */
export function EnduranceTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const { state } = useTrackedRoutes();
  const result = state.kind === 'ready' ? state.result : null;
  const tile = useMemo(
    () =>
      enduranceTileSummary(
        activitiesFromRows(rows, result?.routes ?? [], result?.pending ?? []),
        today,
      ),
    [rows, result, today],
  );
  const T = t.endurance.tile;
  return (
    <DashboardTile title={T.title} testID="overview-endurance">
      <Body testID="overview-endurance-week">{T.week(tile.weekDistanceM, tile.weekCount)}</Body>
      {tile.latest ? (
        <Body muted>{T.latest(tile.latest.name, formatDateDe(tile.latest.day))}</Body>
      ) : null}
      <Button
        label={T.open}
        variant="secondary"
        onPress={() => router.push('/ausdauer' as Href)}
        testID="overview-endurance-open"
      />
    </DashboardTile>
  );
}
