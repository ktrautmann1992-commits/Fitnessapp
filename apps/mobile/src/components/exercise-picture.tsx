import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { type ExerciseMediaSource, illustrationXml } from '@/data/exercise-media';
import type { IllustrationRole } from '@/data/exercise-illustrations.generated';

/** Hellgrau wie der Studio-Hintergrund der Fotos – sichtbar, solange das Foto lädt. */
export const PHOTO_PLACEHOLDER = '#ececec';
/** Seitenverhältnis der Übungsfotos (640×480). */
export const PHOTO_ASPECT = 4 / 3;

/**
 * Ein Übungsbild – Foto (docs/UEBUNGSFOTOS.md) oder Illustration (SVG-Vorlage in Theme-Farben). Fotos stehen immer in
 * einem festen 4:3-Rahmen mit hellgrauem Grund und füllen ihn (`cover`); die Größe ergibt sich aus `height` (Breite
 * = Höhe × 4/3) oder – ohne `height` – aus der Breite des Elternelements. Rein dekorativ: Den Screenreader-Text trägt
 * der umgebende Rahmen.
 */
export const ExercisePicture = memo(function ExercisePicture({
  source,
  scheme,
  overrides,
  height,
  svgWidth = '100%',
  rounded = 0,
}: {
  source: ExerciseMediaSource;
  scheme: 'light' | 'dark';
  /** Farb-Ersetzungen der Illustration (z. B. `gap` in der Farbe der Fläche). */
  overrides?: Readonly<Partial<Record<IllustrationRole, string>>>;
  /** Höhe in px; ohne Angabe füllt das Bild den Elternrahmen. */
  height?: number;
  svgWidth?: number | `${number}%`;
  rounded?: number;
}) {
  if (source.kind === 'svg') {
    return (
      <SvgXml
        xml={illustrationXml(source.template, scheme, overrides)}
        width={svgWidth}
        height={height ?? '100%'}
        accessible={false}
        aria-hidden
      />
    );
  }
  const isPhoto = source.kind === 'photo';
  return (
    <View
      style={[
        styles.frame,
        isPhoto && styles.photoFrame,
        height !== undefined
          ? { height, width: isPhoto ? Math.round(height * PHOTO_ASPECT) : '100%' }
          : styles.fill,
        rounded > 0 && { borderRadius: rounded },
      ]}
      testID={isPhoto ? 'exercise-photo' : undefined}
    >
      <Image
        source={source.source}
        resizeMode={isPhoto ? 'cover' : 'contain'}
        style={styles.fill}
        accessible={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  photoFrame: { aspectRatio: PHOTO_ASPECT, backgroundColor: PHOTO_PLACEHOLDER },
  fill: { width: '100%', height: '100%' },
});
