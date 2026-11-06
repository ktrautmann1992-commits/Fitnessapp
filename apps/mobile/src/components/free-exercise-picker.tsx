import { SESSION_LOG_LIMITS } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, LoadingState, Notice, OptionButton, TextField } from '@/components/ui';
import { freeExerciseCandidates } from '@/data/backfill';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

type Library = ReturnType<typeof useApp>['library'];

/**
 * Auswahl der Übungen einer freien Krafteinheit (Suche, höchstens `SESSION_LOG_LIMITS.exercisesPerSession.max`),
 * gemeinsam für „Einheit eintragen“ und „Krafttraining starten“. Ansagen für Bildschirmleser über `announce`.
 */
export function useFreeExerciseSelection(announce: (text: string) => void) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const max = SESSION_LOG_LIMITS.exercisesPerSession.max;

  function toggle(id: string, name: string) {
    setError(undefined);
    if (selected.includes(id)) {
      setSelected((current) => current.filter((x) => x !== id));
      announce(t.backfill.selected(selected.length - 1));
      return;
    }
    if (selected.length >= max) {
      const text = t.backfill.maxReached(max);
      setError(text);
      announce(text);
      return;
    }
    setSelected((current) => [...current, id]);
    announce(`${name}: ${t.backfill.selected(selected.length + 1)}`);
  }

  /** Gewählte Übungen aus der Bibliothek (Reihenfolge = Auswahl); leer, solange die Bibliothek fehlt. */
  function exercisesOf(library: Library) {
    if (library.kind !== 'ready') return [];
    return selected.flatMap((id) => {
      const exercise = library.library.exercises.get(id);
      return exercise ? [exercise] : [];
    });
  }

  return { selected, toggle, error, setError, exercisesOf };
}

export function FreeExercisePicker({
  library,
  selected,
  onToggle,
}: {
  library: Library;
  selected: readonly string[];
  onToggle: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const lib = library.kind === 'ready' ? library.library : null;
  const candidates = useMemo(
    () => (lib ? freeExerciseCandidates(lib.exercises, query, selected) : null),
    [lib, query, selected],
  );
  if (library.kind === 'missing') {
    return (
      <Notice tone="warning" testID="backfill-library-missing">
        {t.backfill.libraryMissing}
      </Notice>
    );
  }
  if (!candidates) return <LoadingState label={t.backfill.libraryLoading} />;
  return (
    <View style={styles.section}>
      <TextField
        label={t.backfill.searchLabel}
        hint={t.backfill.searchHint}
        value={query}
        onChangeText={setQuery}
        testID="backfill-search"
      />
      <Body testID="backfill-selected">{t.backfill.selected(selected.length)}</Body>
      {candidates.items.length === 0 ? <Body muted>{t.backfill.noResults}</Body> : null}
      {candidates.items.map((exercise) => {
        const isSelected = selected.includes(exercise.id);
        return (
          <OptionButton
            key={exercise.id}
            role="checkbox"
            label={exercise.name_de}
            selected={isSelected}
            accessibilityLabel={t.backfill.pickA11y(exercise.name_de, isSelected)}
            onPress={() => onToggle(exercise.id, exercise.name_de)}
          />
        );
      })}
      {candidates.more > 0 ? <Body muted>{t.backfill.moreResults(candidates.more)}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
