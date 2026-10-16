import { type ExperienceLevel, experienceLevelSchema, type planSnapshot } from '@fitnessapp/core';

import type { UserRows } from './types';

/**
 * Level für die Wochenzahl harter Einheiten beim Anzeigen (App, PDF): das strengere aus Profil und Angaben des Plans –
 * wie der Server (Wächter WP3 M1); unbekannt → Einsteiger. Eigene Datei, damit exercise-swap.ts und competition.ts sie
 * ohne Ringbezug nutzen.
 */
export function competitionDisplayLevel(
  rows: Pick<UserRows, 'profile'>,
  snapshot: ReturnType<typeof planSnapshot>,
): ExperienceLevel {
  const order: readonly ExperienceLevel[] = ['beginner', 'advanced', 'competitive'];
  const profile = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  const levels = [
    profile.success ? profile.data : 'beginner',
    snapshot?.experienceLevel ?? 'beginner',
  ];
  return order[Math.min(...levels.map((l) => order.indexOf(l)))] ?? 'beginner';
}
