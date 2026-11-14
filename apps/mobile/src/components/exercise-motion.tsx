import { WORKOUT_PLAYER } from '@fitnessapp/core';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { exerciseMediaFor, illustrationXml } from '@/data/exercise-media';
import { useReducedMotion } from '@/lib/reduced-motion';
import { useColorSchemeName } from '@/lib/theme';

/** SVG-Vorlagen der Ausgangs- und (falls vorhanden) Endposition einer Übung. */
export function exerciseMotionTemplates(
  exerciseId: string,
): { start: string; end: string | null } | null {
  const start = exerciseMediaFor(exerciseId, 'start_position');
  if (!start || start.source.kind !== 'svg') return null;
  const end = exerciseMediaFor(exerciseId, 'end_position');
  return {
    start: start.source.template,
    end: end && end.source.kind === 'svg' ? end.source.template : null,
  };
}

/**
 * Übungsbild als „GIF“ (Workout-Player, Gründer-Feedback 14.11.2026): Ausgangs- und Endposition wechseln im
 * Sekundentakt mit kurzer Überblendung (WORKOUT_PLAYER.mediaSwapMs/mediaFadeMs) – so sieht man, wie die Bewegung geht.
 * Ohne Endbild (Halteübungen) oder bei „Bewegung reduzieren“: nur das Startbild. Ohne Bild: nichts (kein leerer Rahmen).
 */
export function ExerciseMotion({
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
  const templates = exerciseMotionTemplates(exerciseId);
  const moving = animate && !reduced && templates?.end != null;
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

  if (!templates) return null;
  const xml = (template: string) => illustrationXml(template, scheme, { gap: surface });
  return (
    <View
      style={[styles.box, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      // Für Tests (Playwright): welches Bild gerade vorn ist.
      {...{ dataSet: { motion: moving ? 'on' : 'off', frame: showEnd ? 'end' : 'start' } }}
    >
      <SvgXml xml={xml(templates.start)} width="100%" height={height} />
      {moving && templates.end ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity }]}
          testID={testID ? `${testID}-end` : undefined}
        >
          <SvgXml xml={xml(templates.end)} width="100%" height={height} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
