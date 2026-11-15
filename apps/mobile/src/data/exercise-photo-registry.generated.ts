// Automatisch erzeugt von scripts/exercise-photos.mjs (Workflow exercise-photos-import) – nicht von Hand ändern.
// Übungsfotos Start/Ende je Übung (docs/UEBUNGSFOTOS.md). Wird erst bei Bedarf nachgeladen (exercise-media.ts).
import type { ImageSourcePropType } from 'react-native';

export interface ExercisePhotoPair {
  readonly start: ImageSourcePropType;
  readonly end: ImageSourcePropType;
}

export const EXERCISE_PHOTOS: Readonly<Record<string, ExercisePhotoPair>> = {};
