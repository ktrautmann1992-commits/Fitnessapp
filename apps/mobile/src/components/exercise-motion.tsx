import { WORKOUT_PLAYER } from '@fitnessapp/core';
import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { ExercisePicture } from '@/components/exercise-picture';
import {
  type ExerciseMediaSource,
  exerciseMediaFor,
  useExerciseMedia,
} from '@/data/exercise-media';
import { useReducedMotion } from '@/lib/reduced-motion';
import { useColorSchemeName } from '@/lib/theme';

/**
 * Bilder der Ausgangs- und (falls vorhanden) Endposition einer Übung: Foto-Paar (docs/UEBUNGSFOTOS.md) oder
 * Illustration. Ende nur aus derselben Quellart wie der Start.
 */
export function exerciseMotionFrames(
  exerciseId: string,
): { start: ExerciseMediaSource; end: ExerciseMediaSource | null } | null {
  const start = exerciseMediaFor(exerciseId, 'start_position');
  if (!start || start.source.kind === 'raster') return null;
  const end = exerciseMediaFor(exerciseId, 'end_position');
  return {
    start: start.source,
    end: end && end.source.kind === start.source.kind ? end.source : null,
  };
}

/**
 * Übungsbild als „GIF“ (Workout-Player, Gründer-Feedback 14.11.2026): Ausgangs- und Endposition wechseln im
 * Sekundentakt mit kurzer Überblendung (WORKOUT_PLAYER.mediaSwapMs/mediaFadeMs) – so sieht man, wie die Bewegung geht.
 * Ohne Endbild (Halteübungen) oder bei „Bewegung reduzieren“: nur das Startbild. Ohne Bild: nichts (kein leerer Rahmen).
 * Leistung (15.11.2026): `memo` – der Player zeichnet alle 250 ms neu; das SVG nur, wenn sich Bild oder Bildwechsel ändert.
 * Fotos (docs/UEBUNGSFOTOS.md) stehen 4:3 in der vorgegebenen Höhe; das Endfoto wird nur bei Bewegung eingebunden.
 */
export const ExerciseMotion = memo(function ExerciseMotion({
  exerciseId,
  height,
  surface,
  label,
  animate = true,
  testID,
}: {
  exerciseId: string;
  height: number;
  /** Farbe der Fläche unter dem Bild (Trennrand um die Glieder). */
  surface: string;
  label: string;
  animate?: boolean;
  testID?: string;
}) {
  const scheme = useColorSchemeName();
  const reduced = useReducedMotion();
  const mediaLoaded = useExerciseMedia();
  const frames = useMemo(
    () => (mediaLoaded ? exerciseMotionFrames(exerciseId) : null),
    [mediaLoaded, exerciseId],
  );
  const moving = animate && !reduced && frames?.end != null;
  const [opacity] = useState(() => new Animated.Value(0));
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    opacity.setValue(0);
    if (!moving) return;
    let end = false;
    const id = setInterval(() => {
      end = !end;
      setShowEnd(end);
      Animated.timing(opacity, {
        toValue: end ? 1 : 0,
        duration: WORKOUT_PLAYER.mediaFadeMs,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, WORKOUT_PLAYER.mediaSwapMs);
    return () => {
      clearInterval(id);
      setShowEnd(false);
    };
  }, [moving, opacity, exerciseId]);

  const overrides = useMemo(() => ({ gap: surface }), [surface]);
  const startImage = useMemo(
    () =>
      frames ? (
        <ExercisePicture
          source={frames.start}
          scheme={scheme}
          overrides={overrides}
          height={height}
          rounded={frames.start.kind === 'photo' ? 8 : 0}
        />
      ) : null,
    [frames, scheme, overrides, height],
  );
  const endImage = useMemo(
    () =>
      frames?.end && moving ? (
        <ExercisePicture
          source={frames.end}
          scheme={scheme}
          overrides={overrides}
          height={height}
          rounded={frames.end.kind === 'photo' ? 8 : 0}
        />
      ) : null,
    [frames, moving, scheme, overrides, height],
  );

  if (!frames) return null;
  return (
    <View
      style={[styles.box, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      // Für Tests (Playwright): welches Bild gerade vorn ist und ob Foto oder Illustration.
      {...{
        dataSet: {
          motion: moving ? 'on' : 'off',
          frame: showEnd ? 'end' : 'start',
          media: frames.start.kind,
        },
      }}
    >
      {startImage}
      {moving && endImage ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}
          testID={testID ? `${testID}-end` : undefined}
        >
          {endImage}
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
});
