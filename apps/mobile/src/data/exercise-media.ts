import {
  type ExerciseMedia,
  type ExerciseMediaImage,
  exerciseMediaImage,
  type ExerciseMediaKind,
} from '@fitnessapp/core';
import type { ImageSourcePropType } from 'react-native';

/**
 * Übungsbilder in der App (Platzhalter „Ausgangsposition“, Nachtrag „Muskelkarte“ in
 * docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md). Derzeit LEER – es gibt noch keine Bilder mit geklärten Rechten.
 *
 * Ein Bild kommt so dazu (in derselben Änderung):
 * 1. Bilddatei nach `apps/mobile/assets/exercise-media/<datei>` legen.
 * 2. Zuordnung `content/exercise-media/<übungs-id>.json` mit Lizenz und Quelle anlegen (`content:validate` prüft).
 * 3. Hier einen Eintrag ergänzen: `media` = Inhalt der JSON-Datei, `sources` = `require('…/<datei>')` (Metro braucht
 *    feste Pfade). Der Test `exercise-media.test.ts` prüft, dass Registry und content/exercise-media übereinstimmen.
 */
export interface ExerciseMediaEntry {
  readonly media: ExerciseMedia;
  readonly sources: Readonly<Partial<Record<ExerciseMediaKind, ImageSourcePropType>>>;
}

export const EXERCISE_MEDIA: Readonly<Record<string, ExerciseMediaEntry>> = {};

/** Bild einer Art zu einer Übung samt Quelle; null = kein Bild → die App zeigt nichts an. */
export function exerciseMediaFor(
  exerciseId: string,
  kind: ExerciseMediaKind,
  registry: Readonly<Record<string, ExerciseMediaEntry>> = EXERCISE_MEDIA,
): { image: ExerciseMediaImage; source: ImageSourcePropType } | null {
  const entry = Object.hasOwn(registry, exerciseId) ? registry[exerciseId] : undefined;
  const image = exerciseMediaImage(entry?.media, kind);
  const source = entry?.sources[kind];
  return image && source !== undefined ? { image, source } : null;
}
