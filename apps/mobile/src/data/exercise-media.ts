import {
  type ExerciseMedia,
  type ExerciseMediaImage,
  exerciseMediaImage,
  type ExerciseMediaKind,
} from '@fitnessapp/core';
import { useEffect, useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';

import type {
  GeneratedIllustration,
  ILLUSTRATION_COLORS as IllustrationColors,
  IllustrationRole,
} from './exercise-illustrations.generated';
import type { ExercisePhotoPair } from './exercise-photo-registry.generated';

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
 *
 * Übungsfotos (docs/UEBUNGSFOTOS.md): Liegt für eine Übung ein KI-Foto-Paar vor (exercise-photo-registry.generated.ts,
 * erzeugt vom Workflow exercise-photos-import), ersetzt es Start- und Endbild der Illustration (`kind: 'photo'`, 4:3).
 * Ohne Foto bleibt die Illustration. Start und Ende kommen immer aus derselben Quelle (nie Foto + Strichfigur).
 */
export type ExerciseMediaSource =
  | { readonly kind: 'svg'; readonly template: string }
  | { readonly kind: 'raster'; readonly source: ImageSourcePropType }
  | { readonly kind: 'photo'; readonly source: ImageSourcePropType };

export interface ExerciseMediaEntry {
  readonly media: ExerciseMedia;
  readonly sources: Readonly<Partial<Record<ExerciseMediaKind, ExerciseMediaSource>>>;
}

/**
 * Registry aus Illustrationen und Fotos. Fotos gelten nur für Übungen mit Illustration (Alt-Text und Bildarten kommen
 * aus deren Zuordnung); das Endfoto nur, wenn die Übung eine Endposition hat (Halteübungen bleiben statisch).
 */
export function registryFrom(
  illustrations: Readonly<Record<string, GeneratedIllustration>>,
  photos: Readonly<Record<string, ExercisePhotoPair>> = {},
): Readonly<Record<string, ExerciseMediaEntry>> {
  return Object.fromEntries(
    Object.entries(illustrations).map(([id, illustration]) => {
      const photo = Object.hasOwn(photos, id) ? photos[id] : undefined;
      const hasEnd = illustration.templates.end_position !== undefined;
      const sources: Partial<Record<ExerciseMediaKind, ExerciseMediaSource>> = photo
        ? {
            start_position: { kind: 'photo', source: photo.start },
            ...(hasEnd ? { end_position: { kind: 'photo', source: photo.end } } : {}),
          }
        : {
            start_position: { kind: 'svg', template: illustration.templates.start_position },
            // Endposition (Workout-Player 14.11.2026): nur bei Übungen mit Bewegung; der Timer blendet beide ineinander.
            ...(illustration.templates.end_position !== undefined
              ? { end_position: { kind: 'svg', template: illustration.templates.end_position } }
              : {}),
          };
      return [id, { media: illustration.media, sources }];
    }),
  );
}

/**
 * Leistung (15.11.2026): Die Vorlagen (≈ 1,5 MB Text) liegen NICHT im Start-Bundle, sondern werden beim ersten Bedarf
 * nachgeladen (`import()` → eigener Teil im Web-Export). Bis dahin ist die Registry leer; `useExerciseMedia()` lädt
 * und zeichnet die Komponente neu, sobald die Bilder da sind. Die Foto-Zuordnung kommt genauso nach; die Fotos selbst
 * sind eigene Dateien (Web: eigene Adressen, Handy: Asset-Dateien) und werden erst beim Anzeigen geladen.
 */
let EXERCISE_MEDIA: Readonly<Record<string, ExerciseMediaEntry>> = {};
let COLORS: typeof IllustrationColors | null = null;
let loading: Promise<Readonly<Record<string, ExerciseMediaEntry>>> | null = null;
const listeners = new Set<() => void>();

/** Übungsbilder laden (einmalig; weitere Aufrufe teilen sich das Laden). */
export function loadExerciseMedia(): Promise<Readonly<Record<string, ExerciseMediaEntry>>> {
  loading ??= Promise.all([
    import('./exercise-illustrations.generated'),
    import('./exercise-photo-registry.generated'),
  ]).then(([{ GENERATED_ILLUSTRATIONS, ILLUSTRATION_COLORS }, { EXERCISE_PHOTOS }]) => {
    EXERCISE_MEDIA = registryFrom(GENERATED_ILLUSTRATIONS, EXERCISE_PHOTOS);
    COLORS = ILLUSTRATION_COLORS;
    for (const listener of listeners) listener();
    return EXERCISE_MEDIA;
  });
  return loading;
}

/** Aktuelle Registry (leer, solange die Bilder noch nicht geladen sind). */
export function exerciseMediaRegistry(): Readonly<Record<string, ExerciseMediaEntry>> {
  return EXERCISE_MEDIA;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isLoaded = () => COLORS !== null;

/** true, sobald die Übungsbilder geladen sind; stößt das Laden an. */
export function useExerciseMedia(): boolean {
  const loaded = useSyncExternalStore(subscribe, isLoaded, isLoaded);
  useEffect(() => {
    if (!loaded) void loadExerciseMedia();
  }, [loaded]);
  return loaded;
}

/**
 * Setzt die Farben (hell/dunkel) in eine SVG-Vorlage mit Marken `{rolle}` ein. `overrides` ersetzt einzelne Rollen,
 * z. B. `gap` (Rand um die Glieder) in der Farbe der Fläche, auf der das Bild liegt (Übungsliste: Trainingsblau-Chip).
 */
export function illustrationXml(
  template: string,
  scheme: 'light' | 'dark',
  overrides: Readonly<Partial<Record<IllustrationRole, string>>> = {},
): string {
  // Leistung: Ergebnis je Vorlage, Modus und Ersetzungen merken (Listen und der Player zeichnen oft neu).
  const key = `${scheme}|${JSON.stringify(overrides)}`;
  let byKey = XML_CACHE.get(template);
  const cached = byKey?.get(key);
  if (cached !== undefined) return cached;
  const palette: Readonly<Record<string, string>> = {
    ...COLORS?.[scheme],
    ...overrides,
  };
  const xml = template.replace(/\{(\w+)\}/g, (match, role: string) =>
    Object.hasOwn(palette, role) ? palette[role]! : match,
  );
  // Ohne geladene Farben (Vorlage von außerhalb der Registry) nicht merken.
  if (COLORS === null) return xml;
  if (!byKey) {
    byKey = new Map();
    XML_CACHE.set(template, byKey);
  }
  byKey.set(key, xml);
  return xml;
}

/** Vorlage → (Modus + Ersetzungen) → fertiges SVG. Begrenzt durch die Zahl der Vorlagen und Flächenfarben. */
const XML_CACHE = new Map<string, Map<string, string>>();

/**
 * Bild einer Art zu einer Übung samt Quelle; null = kein Bild → die App zeigt nichts an. Standard ist die geladene
 * Registry (vor `loadExerciseMedia` leer).
 */
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
