import type { NavArea } from '@fitnessapp/core';
import type { AreaId } from '@fitnessapp/ui';

import type { IconName } from '@/components/design';

/**
 * Zentrale Zuordnung Bereich der App (NavArea) → Bereichsfarbe (AreaId, packages/ui/theme.css) und Strich-Icon
 * (components/design.tsx). Übersicht und Mehr haben keinen eigenen Bereich – sie tragen die Markenfarbe Blau
 * (gleiche Werte wie `training`). Nur Darstellung, keine Fachlogik.
 */
export const NAV_AREA_STYLE: Record<NavArea, { area: AreaId; icon: IconName }> = {
  // Reiter „Heute“ (Startseite, 26.10.2026): Haus wie im Entwurf 8-navigation.
  uebersicht: { area: 'training', icon: 'home' },
  today: { area: 'training', icon: 'dumbbell' },
  workouts: { area: 'workouts', icon: 'stopwatch' },
  ernaehrung: { area: 'ernaehrung', icon: 'utensils' },
  einkaufsliste: { area: 'einkaufen', icon: 'cart' },
  wettkampf: { area: 'wettkampf', icon: 'trophy' },
  fortschritt: { area: 'fortschritt', icon: 'trend' },
  mehr: { area: 'training', icon: 'dots' },
};
