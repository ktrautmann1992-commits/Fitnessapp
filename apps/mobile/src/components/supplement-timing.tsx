import { supplementTrainingDayTiming } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { startLabel, SupplementTimingCard } from '@/components/supplements';
import { todayTimingSession } from '@/data/supplement-library';
import { useApp } from '@/state/app-state';
import {
  supplementEntries,
  useSupplementLibrary,
  useSupplements,
  useSupplementsVisibility,
} from '@/state/use-supplements';

/**
 * „Supplemente heute“ auf „Heute“ (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md): nur an
 * Trainingstagen, nur mit „Nahrungsergänzungsmittel anzeigen“ = an und nur mit mindestens einer Zeile. Die Regeln
 * (`supplementTrainingDayTiming`) stehen in packages/core; hier nur Daten holen und anzeigen. Nie loggen.
 */
export function TodaySupplementTiming({ today }: { today: string }) {
  const router = useRouter();
  const { rows } = useApp();
  const view = useSupplements();
  const visibility = useSupplementsVisibility(view);
  const library = useSupplementLibrary();
  const entries = supplementEntries(library);
  const session = useMemo(() => (rows ? todayTimingSession(rows, today) : null), [rows, today]);
  const timing = useMemo(() => {
    if (!view.recommendations || session === null) return null;
    try {
      return supplementTrainingDayTiming(
        view.recommendations,
        view.data.choices,
        session,
        view.weightKg,
      );
    } catch {
      return null;
    }
  }, [view.recommendations, view.data.choices, view.weightKg, session]);
  const names = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.id, entry.name_de])),
    [entries],
  );
  if (!visibility.loaded || !visibility.visible || !timing || timing.lines.length === 0) {
    return null;
  }
  return (
    <SupplementTimingCard
      timing={timing}
      startText={startLabel(session?.startMinutes ?? null)}
      names={names}
      onMore={() => router.push('/supplemente' as Href)}
    />
  );
}
