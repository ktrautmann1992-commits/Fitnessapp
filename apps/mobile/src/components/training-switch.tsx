import { useRouter, type Href } from 'expo-router';

import { SegmentedSwitch } from '@/components/slim';
import { t } from '@/i18n';

/**
 * Umschalter oben im Reiter „Training“ („App verschlanken“, Entwurf 2-training): **Mein Plan · Workouts · Übungen**.
 * Workouts (`/workouts`) und das Übungs-Lexikon (`/uebungen`) behalten ihre Adressen – Links, Benachrichtigungen und
 * Tests funktionieren weiter; der Umschalter ist nur der neue Weg dorthin. testIDs je Seite eindeutig (Reiter bleiben
 * im Hintergrund geladen): `prefix` unterscheidet die Seite.
 */
export function TrainingSwitch({
  selected,
  prefix,
  exercisesTestID,
}: {
  selected: 'plan' | 'workouts' | 'exercises';
  prefix: string;
  /** Eigene testID für „Übungen“ (auf „Training“ bleibt `today-glossary` wie bisher). */
  exercisesTestID?: string;
}) {
  const router = useRouter();
  const texts = t.slim.training;
  return (
    <SegmentedSwitch
      accessibilityLabel={texts.switchLabel}
      selected={selected}
      testID={`${prefix}-switch`}
      items={[
        {
          key: 'plan',
          label: texts.plan,
          onPress: () => router.navigate('/today' as Href),
          testID: `${prefix}-switch-plan`,
        },
        {
          key: 'workouts',
          label: texts.workouts,
          onPress: () => router.navigate('/workouts' as Href),
          testID: `${prefix}-switch-workouts`,
        },
        {
          key: 'exercises',
          label: texts.exercises,
          accessibilityLabel: t.glossary.allExercises,
          onPress: () => router.push('/uebungen' as Href),
          testID: exercisesTestID ?? `${prefix}-switch-exercises`,
        },
      ]}
    />
  );
}
