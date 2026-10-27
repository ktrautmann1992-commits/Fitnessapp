import type { Workout, WorkoutRunView, WorkoutTimerStep } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ProgressRing, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Card } from '@/components/ui';
import { exerciseMediaFor, illustrationXml } from '@/data/exercise-media';
import { t } from '@/i18n';
import { deYoga } from '@/i18n/de-yoga';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { clockText, type ExerciseNames } from '@/lib/workout-timer-format';

const Y = deYoga.player;

type WorkStep = Extract<WorkoutTimerStep, { kind: 'work' }>;

/** „Rechte Seite“ / „Linke Seite“ oder null (ohne Seitenwechsel). */
export function sideLabel(step: WorkStep | null): string | null {
  if (!step?.side) return null;
  return step.side === 'right' ? Y.right : Y.left;
}

/**
 * Flow-Ansicht des Workout-Timers (Sportarten Stufe 1 · Etappe Y, docs/PLAN-SPORTARTEN-STUFE-1.md 2.4): großes Bild
 * der Pose, Name, Restzeit-Ring, Seite, Atem-Hinweis (Notiz der Routine, sonst ein ruhiger Standardtext) und die
 * nächste Pose. Nur Darstellung – Zeitrechnung, Seitenwechsel und Reihenfolge kommen aus packages/core
 * (buildFlowTimerSteps, workoutRunView). Bedienung (Pause/Weiter, Überspringen, Beenden) steht im Fuß des Timers.
 */
export function FlowPlayer({
  workout,
  view,
  names,
}: {
  workout: Workout;
  view: WorkoutRunView;
  names: ExerciseNames;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const area = useAreaColors('workouts');
  const step = view.step;
  const work: WorkStep | null = step?.kind === 'work' ? step : null;
  // Während „Gleich geht's los“ zeigt das Bild schon die erste Pose.
  const shown: WorkStep | null = work ?? view.nextWork;
  const name = shown ? (names.get(shown.exerciseId)?.name_de ?? shown.exerciseId) : '';
  const media = shown ? exerciseMediaFor(shown.exerciseId, 'start_position') : null;
  const total = step?.kind === 'work' || step?.kind === 'prepare' ? (step.seconds ?? 0) : 0;
  const remaining = view.remainingS ?? 0;
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const side = sideLabel(work ?? (step?.kind === 'prepare' ? view.nextWork : null));
  const note = shown ? (workout.exercises[shown.itemIndex]?.note_de ?? null) : null;
  const next = view.nextWork && view.nextWork !== shown ? view.nextWork : null;
  const nextName = next ? (names.get(next.exerciseId)?.name_de ?? next.exerciseId) : null;
  const nextSide = sideLabel(next);

  return (
    <View style={styles.wrap} testID="flow-player">
      <Body muted testID="flow-progress">
        {step?.kind === 'prepare'
          ? t.workouts.timer.prepare
          : Y.progress(view.workDone + view.workSkipped, view.workTotal)}
      </Body>
      <View style={[styles.imageBox, { backgroundColor: area.surface }]}>
        {media && media.source.kind === 'svg' ? (
          <SvgXml
            xml={illustrationXml(media.source.template, scheme, { gap: area.surface })}
            width="100%"
            height={200}
            accessibilityLabel={Y.image(name)}
            testID="flow-image"
          />
        ) : null}
      </View>
      <Text
        style={[styles.name, appFont('bold'), { color: theme.text }]}
        accessibilityRole="header"
        testID="flow-name"
      >
        {name}
      </Text>
      {side ? (
        <Text style={[styles.side, appFont('semibold'), { color: area.icon }]} testID="flow-side">
          {side}
        </Text>
      ) : null}
      <View
        style={styles.ringRow}
        accessibilityRole="timer"
        accessibilityLabel={t.workouts.timer.remaining(remaining)}
        testID="flow-ring"
      >
        <ProgressRing size={150} stroke={12} fraction={fraction} color={area.strong}>
          <Text
            style={[styles.clock, appFont('bold'), { color: theme.text }]}
            testID="flow-remaining"
          >
            {clockText(remaining)}
          </Text>
        </ProgressRing>
      </View>
      {view.paused ? (
        <Text style={[styles.paused, { color: area.icon }]} testID="flow-paused">
          {t.workouts.timer.paused}
        </Text>
      ) : null}
      <Body testID="flow-breath">{note ?? Y.breathDefault}</Body>
      {work ? (
        <Card>
          <Body muted>{Y.next}</Body>
          <Body testID="flow-next">
            {nextName ? [nextName, nextSide].filter(Boolean).join(' · ') : Y.nextNone}
          </Body>
        </Card>
      ) : null}
      <Body muted>{Y.hint}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  imageBox: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  side: { fontSize: fontSize.lg, textAlign: 'center', textTransform: 'uppercase' },
  ringRow: { alignItems: 'center', paddingVertical: spacing.sm },
  clock: { fontSize: 40, fontVariant: ['tabular-nums'] },
  paused: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
});
