import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { HeroCard } from '@/components/design';
import { Body, Card, Checkbox, FieldError } from '@/components/ui';
import { routineMusclesText } from '@/components/training-modes';
import { recoverySuggestionFromRows } from '@/data/recovery-routine';
import type { UserRows } from '@/data/types';
import { deYoga } from '@/i18n/de-yoga';
import { useApp } from '@/state/app-state';
import { useAppLayout } from '@/state/use-app-layout';
import { useExerciseLookup, useFlowSafety } from '@/state/use-flow-safety';
import { useWorkoutLibrary } from '@/state/use-workouts';

const R = deYoga.recovery;

/**
 * Karte „Erholungstag: Mobility 15 min?“ auf „Heute“ (Sportarten Stufe 1 · Etappe Y, Entscheidung 13): nur an
 * trainingsfreien Tagen bzw. in der Erholungswoche, abschaltbar in den Einstellungen. Nur ein Vorschlag – keine
 * geplante Einheit, zählt nicht für Plan oder 10-%-Regel. Ohne passende Routine (Bibliothek lädt noch, Filter blendet
 * alles aus) erscheint nichts.
 */
export function RecoveryRoutineCard({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const { ensureLibrary } = useApp();
  // Posen kommen aus der Übungsbibliothek (displayExercises) – einmal laden.
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const library = useWorkoutLibrary();
  const exercises = useExerciseLookup();
  const safety = useFlowSafety();
  const workouts = library.kind === 'ready' ? library.workouts : null;
  const suggestion = useMemo(
    () =>
      workouts && exercises
        ? recoverySuggestionFromRows({ rows, today, workouts, exercises, safety })
        : null,
    [exercises, rows, safety, today, workouts],
  );
  if (!suggestion) return null;
  const muscles = routineMusclesText({ mainMuscles: suggestion.muscles });
  return (
    <HeroCard
      area="workouts"
      eyebrow={R.eyebrow}
      eyebrowIcon="lotus"
      title={R.title(suggestion.minutes)}
      subtitle={[suggestion.day === 'deload' ? R.deload : R.rest, muscles]
        .filter(Boolean)
        .join(' ')}
      note={`${suggestion.title} · ${R.notCounted} ${R.settingsHint}`}
      noteTestID="overview-recovery-routine-note"
      actionLabel={R.open}
      actionIcon={null}
      onAction={() => router.push(`/workouts/${suggestion.workoutId}` as Href)}
      actionTestID="overview-recovery-routine-open"
      testID="overview-recovery-routine"
    />
  );
}

/** Einstellung „Erholungs-Routine vorschlagen“ (app_layout_settings.recovery_routine über save_app_layout). */
export function RecoveryRoutineSetting() {
  const { recoveryRoutine, saveRecoveryRoutine } = useAppLayout();
  const [failed, setFailed] = useState(false);
  return (
    <Card>
      <Checkbox
        label={deYoga.settings.recovery}
        checked={recoveryRoutine}
        onChange={(value) => {
          setFailed(false);
          void saveRecoveryRoutine(value).catch(() => setFailed(true));
        }}
        testID="settings-recovery-routine"
      />
      <Body muted>{deYoga.settings.recoveryHint}</Body>
      <FieldError
        message={failed ? deYoga.settings.saveFailed : undefined}
        testID="settings-recovery-routine-error"
      />
    </Card>
  );
}
