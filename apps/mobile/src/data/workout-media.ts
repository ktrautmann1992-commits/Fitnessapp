import type { ImageSourcePropType } from 'react-native';

import { WORKOUT_MEDIA } from './workout-media-registry';

/**
 * Workout-Bilder in der App (docs/PLAN-BARBELL-BURN.md, gleiches Muster wie die Rezeptfotos in recipe-media.ts):
 * Bilder liegen im App-Bündel (apps/mobile/assets/workout-media, Metro-Asset – Web-Export und APK, keine externen
 * Aufrufe). Zuordnung, Lizenz und Quelle stehen in content/workout-media/<workout-id>.json, die require()-Liste in
 * workout-media-registry.ts. Kein Eintrag → null → die App zeigt das bisherige Workout-Symbol.
 */
export interface WorkoutImage {
  readonly alt_de: string;
  readonly ai_notice_de: string | null;
  /** Quadratische Kachel (Workout-Liste). */
  readonly thumbnail: ImageSourcePropType;
  /** 21:9-Banner (Workout-Ansicht). */
  readonly banner: ImageSourcePropType;
}

/** Bild eines Workouts oder null (dann bleibt das Workout-Symbol). */
export function workoutImageFor(
  workoutId: string,
  registry: Readonly<Record<string, WorkoutImage>> = WORKOUT_MEDIA,
): WorkoutImage | null {
  return Object.hasOwn(registry, workoutId) ? (registry[workoutId] ?? null) : null;
}
