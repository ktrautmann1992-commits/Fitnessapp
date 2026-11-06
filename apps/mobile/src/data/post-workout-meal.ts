import {
  completedNutritionSessionIds,
  type PlannedMeal,
  type PostWorkoutMealNow,
  postWorkoutMealNow,
  timingSnackCandidates,
  trainingDayTimeline,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { type NutritionWeekResult, trainingTimelineOptionsFromRows } from './nutrition-plan';
import type { UserRows } from './types';

/**
 * „Nach dem Training: Das solltest du jetzt essen“ (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md 6a): nur
 * Abbildung der Zeilen – OB und WELCHE Mahlzeit entscheidet packages/core (`postWorkoutMealNow`), die Gramm kommen aus
 * der Zeitleiste (`trainingDayTimeline`, nur mit „Kalorienzahlen anzeigen“, Körpergewicht und ab 18). Ein Fehler
 * darin sperrt nie die Ansicht (dann keine Karte). Nie loggen.
 */
export interface PostWorkoutMealView {
  readonly now: PostWorkoutMealNow;
  /** Gericht aus dem Essensplan (für Rezept-Link und „Gegessen“); null = nur Snack-Vorschlag. */
  readonly plannedMeal: PlannedMeal | null;
}

export function postWorkoutMealFromWeek(input: {
  week: NutritionWeekResult | null;
  rows: UserRows;
  versions: ConsentVersions;
  today: string;
  /** Jetzt in Minuten nach Mitternacht (Europe/Berlin). */
  nowMinutes: number;
  showNumbers: boolean;
}): PostWorkoutMealView | null {
  const { week, rows, today } = input;
  if (week?.kind !== 'ready') return null;
  try {
    const dayTargets = week.targets.days.find((d) => d.date === today);
    if (dayTargets === undefined) return null;
    const day = week.plan?.days.find((d) => d.date === today) ?? null;
    const options = trainingTimelineOptionsFromRows(
      rows,
      input.versions,
      today,
      week.targets.weekStart,
      input.showNumbers,
    );
    if (options === null) return null;
    const snacks = week.planState ? timingSnackCandidates(week.planState.input, dayTargets) : [];
    const timeline = trainingDayTimeline(dayTargets, day, options, snacks);
    const now = postWorkoutMealNow({
      day: dayTargets,
      timeline,
      today,
      nowMinutes: input.nowMinutes,
      // Irgendein Eintrag in diesem Platz heute (Plan-Gericht oder eigenes Essen) = schon gegessen.
      eaten: new Set(
        rows.foodLogEntries
          .filter((e) => e.eaten_on === today && e.slot !== null)
          .map((e) => `${e.eaten_on}|${e.slot}`),
      ),
      completedSessionIds: completedNutritionSessionIds(rows.plannedSessions, rows.sessionLogs),
    });
    if (now === null) return null;
    const plannedMeal =
      now.slot === null ? null : (day?.meals.find((m) => m.slot === now.slot && !m.isFill) ?? null);
    return { now, plannedMeal };
  } catch {
    return null;
  }
}
