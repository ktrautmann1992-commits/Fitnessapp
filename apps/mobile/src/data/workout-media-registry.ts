/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Bilder nur über require() */
/**
 * Workout-Bilder im App-Bündel (Zuordnung zu content/workout-media/<workout-id>.json – workout-media.test.ts prüft,
 * dass beides zusammenpasst). Neues Bild: Dateien nach apps/mobile/assets/workout-media, Zuordnung nach
 * content/workout-media, Eintrag hier ergänzen. Lookup und Typ in workout-media.ts.
 */
import type { WorkoutImage } from './workout-media';

export const WORKOUT_MEDIA: Readonly<Record<string, WorkoutImage>> = {
  'barbell-burn-30': {
    alt_de:
      'Foto: Training mit leichter Langhantel in der Gruppe – Kniebeuge mit der Stange auf den vorderen Schultern, dahinter weitere Teilnehmende im Trainingsraum.',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/workout-media/barbell-burn-30-thumb.webp'),
    banner: require('../../assets/workout-media/barbell-burn-30-banner.webp'),
  },
  'barbell-burn-60': {
    alt_de:
      'Foto: Training mit leichter Langhantel in der Gruppe – Kniebeuge mit der Stange auf dem oberen Rücken, im Hintergrund weitere Teilnehmende auf Stepbrettern.',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/workout-media/barbell-burn-60-thumb.webp'),
    banner: require('../../assets/workout-media/barbell-burn-60-banner.webp'),
  },
};
