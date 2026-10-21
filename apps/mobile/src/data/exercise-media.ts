import {
  type ExerciseMedia,
  type ExerciseMediaImage,
  exerciseMediaImage,
  type ExerciseMediaKind,
} from '@fitnessapp/core';
import type { ImageSourcePropType } from 'react-native';

import { GENERATED_ILLUSTRATIONS, ILLUSTRATION_COLORS } from './exercise-illustrations.generated';

/**
 * Übungsbilder in der App (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md). Gründer-Entscheidung B
 * (21.10.2026): eigene Illustrationen der Ausgangsposition für alle Übungen, erzeugt von
 * packages/content/src/illustrations (`pnpm illustrations`). Sie liegen als SVG-Vorlagen mit Farbmarken im Bundle
 * (exercise-illustrations.generated.ts) – keine externen Aufrufe; die Farben kommen je Hell/Dunkel aus
 * ILLUSTRATION_COLORS.
 *
 * Ein Rasterbild (z. B. lizenziertes Foto) käme so dazu: Datei nach `apps/mobile/assets/exercise-media/`, Zuordnung in
 * `content/exercise-media/<übungs-id>.json` (Lizenz Pflicht) und hier ein Eintrag mit `{ kind: 'raster', source:
 * require('…') }`. Der Test `exercise-media.test.ts` prüft, dass Registry und content/exercise-media übereinstimmen.
 */
export type ExerciseMediaSource =
  | { readonly kind: 'svg'; readonly template: string }
  | { readonly kind: 'raster'; readonly source: ImageSourcePropType };

export interface ExerciseMediaEntry {
  readonly media: ExerciseMedia;
  readonly sources: Readonly<Partial<Record<ExerciseMediaKind, ExerciseMediaSource>>>;
}

export const EXERCISE_MEDIA: Readonly<Record<string, ExerciseMediaEntry>> = Object.fromEntries(
  Object.entries(GENERATED_ILLUSTRATIONS).map(([id, illustration]) => [
    id,
    {
      media: illustration.media,
      sources: { start_position: { kind: 'svg', template: illustration.templates.start_position } },
    },
  ]),
);

/** Setzt die Farben (hell/dunkel) in eine SVG-Vorlage mit Marken `{rolle}` ein. */
export function illustrationXml(template: string, scheme: 'light' | 'dark'): string {
  const palette: Readonly<Record<string, string>> = ILLUSTRATION_COLORS[scheme];
  return template.replace(/\{(\w+)\}/g, (match, role: string) =>
    Object.hasOwn(palette, role) ? palette[role]! : match,
  );
}

/** Bild einer Art zu einer Übung samt Quelle; null = kein Bild → die App zeigt nichts an. */
export function exerciseMediaFor(
  exerciseId: string,
  kind: ExerciseMediaKind,
  registry: Readonly<Record<string, ExerciseMediaEntry>> = EXERCISE_MEDIA,
): { image: ExerciseMediaImage; source: ExerciseMediaSource } | null {
  const entry = Object.hasOwn(registry, exerciseId) ? registry[exerciseId] : undefined;
  const image = exerciseMediaImage(entry?.media, kind);
  const source = entry?.sources[kind];
  return image && source !== undefined ? { image, source } : null;
}
