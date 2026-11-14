import {
  type Exercise,
  howToLines,
  playerFocus,
  type WorkoutRunView,
  type WorkoutWorkStep,
} from '@fitnessapp/core';
import {
  areaColors,
  brandColors,
  fontSize,
  fontWeight,
  heroColors,
  radius,
  spacing,
} from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';

import { useAreaColors } from '@/components/design';
import { ExerciseMotion } from '@/components/exercise-motion';
import { Text } from '@/components/text';
import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';
import { clockText, doseText, stepTitle } from '@/lib/workout-timer-format';

const T = t.workouts.timer;

/** Dosierung im Player: Zeitfenster „12 Wiederholungen · 40 s Zeit“, sonst wie die Liste. */
export function playerDoseText(
  step: WorkoutWorkStep,
  names: ReadonlyMap<string, Pick<Exercise, 'name_de' | 'unilateral'>>,
): string {
  if (step.timeBoxed && step.reps !== null && step.seconds !== null) {
    return T.timeBox(
      T.reps(step.reps, names.get(step.exerciseId)?.unilateral === true),
      step.seconds,
    );
  }
  return doseText(step, names);
}

/**
 * Workout-Player für Power-Workouts (Gründer-Feedback 14.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 4): läuft komplett
 * nach Zeit. Countdown zeigt schon die erste Übung mit Bild und „So geht's“; während der Übung groß die Restzeit, die
 * Übung als Bewegungsbild (Start ↔ Ende) und „Als Nächstes“ mit kleinem Bild; in der Pause die Restzeit und die
 * kommende Übung. Nur Darstellung – Ablauf, Zeitfenster und Auswahl kommen aus packages/core (player.ts, timer.ts).
 */
export function PowerPlayer({
  view,
  exercises,
}: {
  view: WorkoutRunView;
  exercises: ReadonlyMap<string, Exercise>;
}) {
  const theme = useThemeColors();
  const area = useAreaColors('workouts');
  const focus = playerFocus(view);
  const step = view.step;
  const isWork = step?.kind === 'work';
  const isPrepare = step?.kind === 'prepare';
  const shown = focus.exercise;
  const shownName = shown ? (exercises.get(shown.exerciseId)?.name_de ?? shown.exerciseId) : '';
  const howTo = focus.upcoming && shown ? howToLines(exercises.get(shown.exerciseId)) : [];
  const box = heroColors.light;
  const accent = isWork ? areaColors.dark.workouts.icon : areaColors.dark.ernaehrung.icon;
  const frame = isWork ? areaColors.light.workouts.strong : areaColors.light.ernaehrung.strong;
  const next = focus.next;
  const nextName = next ? (exercises.get(next.exerciseId)?.name_de ?? next.exerciseId) : null;

  return (
    <View style={styles.wrap} testID="power-player">
      <View
        style={[styles.timerBox, { borderColor: frame, backgroundColor: box.background }]}
        testID="workout-timer-box"
      >
        <Text style={[styles.stepLabel, { color: accent }]} testID="workout-timer-kind">
          {isWork ? T.work : isPrepare ? T.prepare : stepTitle(step, exercises)}
        </Text>
        {view.remainingS !== null ? (
          <Text
            style={[styles.countdown, { color: box.text }]}
            accessibilityRole="timer"
            accessibilityLabel={T.remaining(view.remainingS)}
            testID="workout-timer-remaining"
          >
            {clockText(view.remainingS)}
          </Text>
        ) : null}
        {view.paused ? (
          <Text
            style={[styles.paused, { color: brandColors.signal }]}
            testID="workout-timer-paused"
          >
            {T.paused}
          </Text>
        ) : null}
      </View>

      {shown ? (
        <View style={[styles.card, { backgroundColor: area.surface }]} testID="power-player-focus">
          {focus.upcoming ? (
            <Text style={[styles.upcoming, { color: area.icon }]} testID="power-player-upcoming">
              {T.next}
            </Text>
          ) : null}
          <Text
            style={[styles.name, { color: theme.text }]}
            accessibilityRole="header"
            testID="workout-timer-step"
          >
            {shownName}
          </Text>
          <ExerciseMotion
            key={shown.exerciseId}
            exerciseId={shown.exerciseId}
            height={isWork ? 190 : 150}
            surface={area.surface}
            label={T.image(shownName)}
            testID="power-player-image"
          />
          <Text style={[styles.dose, { color: theme.text }]} testID="workout-timer-dose">
            {playerDoseText(shown, exercises)}
          </Text>
          {howTo.length > 0 ? (
            <View style={styles.howTo} testID="power-player-howto">
              <Text style={[styles.howToTitle, { color: theme.text }]}>{T.howTo}</Text>
              {howTo.map((line, i) => (
                <Body key={i}>{`${i + 1}. ${line}`}</Body>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {isWork ? (
        <View
          style={[styles.nextRow, { borderColor: theme.border }]}
          testID="workout-timer-next-row"
        >
          {next ? (
            <View style={styles.thumb}>
              <ExerciseMotion
                exerciseId={next.exerciseId}
                height={56}
                surface={theme.background}
                label={T.thumb(nextName ?? '')}
                animate={false}
                testID="workout-timer-next-thumb"
              />
            </View>
          ) : null}
          <Body testID="workout-timer-next">
            {next && nextName ? T.nextUp(nextName) : T.nextNone}
          </Body>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  timerBox: {
    borderWidth: 3,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  stepLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  countdown: {
    fontSize: 72,
    lineHeight: 82,
    fontWeight: fontWeight.extrabold,
    fontVariant: ['tabular-nums'],
  },
  paused: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  card: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs, alignItems: 'stretch' },
  upcoming: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  dose: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  howTo: { gap: 2 },
  howToTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  thumb: { width: 76, height: 56 },
});
