import {
  addCustomItem,
  buildCustomWorkout,
  type CustomBuildIssue,
  type CustomWorkoutDefinition,
  customAddCandidates,
  customFlatIndex,
  customTrackLabel,
  customWorkoutFromDefinition,
  customWorkoutId,
  customWorkoutMinutes,
  customWorkoutNameSchema,
  type Exercise,
  moveCustomItem,
  nextCustomSeed,
  removeCustomItem,
  replaceCustomItem,
  workoutSwapCandidates,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import { Text } from '@/components/text';
import { MyWorkoutsError } from '@/data/my-workouts';
import { customBuildContextFor, workoutSwapContextFor } from '@/data/my-workouts-view';
import { deMyWorkouts } from '@/i18n/de-my-workouts';
import { appFont } from '@/lib/fonts';
import { berlinTodayIso } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { beginWorkoutRun } from '@/state/begin-workout-run';
import { useMyWorkouts } from '@/state/use-my-workouts';

import { CustomTracksEditor, ExerciseSearchSheet, SwapSheet } from './my-workouts';
import { Body, Button, Card, Notice, TextField } from './ui';

const D = deMyWorkouts;

/** Hinweise des Bauens als Texte (Namen der Übungen aus der Bibliothek). */
export function buildIssueTexts(
  issues: readonly CustomBuildIssue[],
  lookup: ReadonlyMap<string, Exercise>,
): string[] {
  return issues.map((issue) => {
    switch (issue.kind) {
      case 'no_candidates':
        return D.preview.noCandidates(issue.areas.map((a) => D.areas[a]).join(', '));
      case 'favorite_skipped':
        return D.preview.favoriteSkipped(
          lookup.get(issue.exerciseId)?.name_de ?? issue.exerciseId,
          D.preview.favoriteReasons[issue.reason],
        );
      case 'duration_short':
        return D.preview.durationShort(issue.minutes);
      case 'duration_long':
        return D.preview.durationLong(issue.minutes);
    }
  });
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; text: string; tone: 'success' | 'warning' }
  | { kind: 'error'; text: string };

/**
 * Vorschau und Bearbeiten eines eigenen Workouts (Assistent und „Meine Workouts“): Tracks mit Tauschen/Entfernen/
 * Hinzufügen/Verschieben, Gesamtdauer live, Name, „Neu würfeln“, „Speichern“, „Jetzt starten“ (speichert vorher) und –
 * bei gespeicherten Workouts – „Löschen“. Regeln aus packages/core; Speichern über useMyWorkouts (offline-first).
 */
export function CustomWorkoutEditor({
  rowId,
  initialDefinition,
  initialName,
  initialIssues = [],
  existing,
}: {
  /** Kennung der Zeile (neu: vorab erzeugt, damit Speichern und Starten dieselbe Zeile treffen). */
  rowId: string;
  initialDefinition: CustomWorkoutDefinition;
  initialName: string;
  initialIssues?: readonly CustomBuildIssue[];
  /** Schon gespeichert (Löschen anbieten, Knopf „Änderungen speichern“). */
  existing: boolean;
}) {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const mine = useMyWorkouts();
  const lib = app.library.kind === 'ready' ? app.library.library : null;
  const library = lib?.exercises ?? null;
  const lookup = lib ? (lib.displayExercises ?? lib.exercises) : null;
  const [definition, setDefinition] = useState(initialDefinition);
  const [issues, setIssues] = useState<readonly CustomBuildIssue[]>(initialIssues);
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string>();
  const [swapAt, setSwapAt] = useState<{ ti: number; ii: number } | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saved, setSaved] = useState(existing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const workoutId = customWorkoutId(rowId);

  const build = useMemo(
    () => customBuildContextFor(app.rows, app.safetyRules, mine.dislikes),
    [app.rows, app.safetyRules, mine.dislikes],
  );
  const workout = useMemo(
    () =>
      lookup
        ? customWorkoutFromDefinition(
            definition,
            { id: workoutId, name, today: berlinTodayIso() },
            lookup,
          )
        : null,
    [definition, lookup, name, workoutId],
  );
  const minutes = lookup ? customWorkoutMinutes(definition, lookup) : definition.input.minutes;
  const swapCandidates = useMemo(() => {
    if (!swapAt || !workout || !library) return [];
    return workoutSwapCandidates(
      workout,
      customFlatIndex(definition, swapAt.ti, swapAt.ii),
      workoutSwapContextFor({
        library,
        lookup,
        available: new Set(definition.input.equipment_ids),
        build,
      }),
    );
  }, [build, definition, library, lookup, swapAt, workout]);
  const addCandidates = useMemo(
    () =>
      addAt === null || !library
        ? []
        : customAddCandidates(definition, addAt, library, build, query),
    [addAt, build, definition, library, query],
  );

  if (!lookup || !library || !workout) return null;
  const swapName =
    swapAt !== null
      ? (lookup.get(definition.tracks[swapAt.ti]?.items[swapAt.ii]?.exercise_id ?? '')?.name_de ??
        '')
      : '';
  const hasWork = definition.tracks.some((t) => t.kind === 'area' && t.items.length > 0);
  const issueTexts = buildIssueTexts(issues, lookup);

  function change(next: CustomWorkoutDefinition | null) {
    if (!next) return;
    setDefinition(next);
    setStatus({ kind: 'idle' });
  }

  function reroll() {
    if (!library) return;
    const result = buildCustomWorkout(
      { ...definition.input, seed: nextCustomSeed(definition.input.seed) },
      library,
      build,
    );
    if (result.definition) {
      setDefinition(result.definition);
      setIssues(result.issues);
      setStatus({ kind: 'idle' });
    } else {
      setStatus({ kind: 'error', text: D.preview.noWork });
    }
  }

  async function save(): Promise<boolean> {
    const parsed = customWorkoutNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(D.preview.nameInvalid);
      return false;
    }
    setNameError(undefined);
    setStatus({ kind: 'busy' });
    try {
      const result = await mine.saveCustom({ id: rowId, name: parsed.data, definition });
      setSaved(true);
      setStatus({
        kind: 'done',
        text: result === 'queued' ? D.preview.queued : D.preview.saved,
        tone: result === 'queued' ? 'warning' : 'success',
      });
      return true;
    } catch (caught) {
      setStatus({
        kind: 'error',
        text:
          caught instanceof MyWorkoutsError && caught.code === 'limit'
            ? D.preview.limit
            : D.preview.saveFailed,
      });
      return false;
    }
  }

  async function start() {
    if (!(await save()) || !workout || !app.session) return;
    beginWorkoutRun(app.session.userId, workout, lookup, true);
    router.push(`/workout-timer/${workout.id}` as Href);
  }

  async function remove() {
    setStatus({ kind: 'busy' });
    try {
      await mine.deleteCustom(rowId);
      setConfirmDelete(false);
      router.replace('/workouts' as Href);
    } catch {
      setStatus({ kind: 'error', text: D.preview.saveFailed });
    }
  }

  const busy = status.kind === 'busy';
  return (
    <View style={styles.stack} testID="custom-editor">
      <Card>
        <View style={styles.totalRow}>
          <Text
            style={[styles.total, appFont('bold'), { color: theme.text }]}
            accessibilityLabel={D.preview.totalA11y(minutes, definition.input.minutes)}
            testID="custom-total"
          >
            {D.preview.total(minutes)}
          </Text>
          <Body muted>{D.preview.target(definition.input.minutes)}</Body>
        </View>
        <Body muted>{definition.input.areas.map((a) => D.areas[a]).join(', ')}</Body>
        <Body muted>{D.preview.safety}</Body>
      </Card>
      {issueTexts.length > 0 ? (
        <Notice tone="warning" testID="custom-issues">
          {issueTexts.map((text) => (
            <Body key={text}>{text}</Body>
          ))}
        </Notice>
      ) : null}
      {!hasWork ? <Notice tone="warning">{D.preview.noWork}</Notice> : null}
      <CustomTracksEditor
        definition={definition}
        lookup={lookup}
        onSwap={(ti, ii) => setSwapAt({ ti, ii })}
        onRemove={(ti, ii) => change(removeCustomItem(definition, ti, ii))}
        onMove={(ti, ii, dir) => change(moveCustomItem(definition, ti, ii, dir))}
        onAdd={(ti) => {
          setQuery('');
          setAddAt(ti);
        }}
      />
      <TextField
        label={D.preview.name}
        hint={D.preview.nameHint}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameError(undefined);
        }}
        maxLength={60}
        error={nameError}
        testID="custom-name"
      />
      {status.kind === 'done' ? (
        <Notice tone={status.tone} testID="custom-saved">
          {status.text}
        </Notice>
      ) : null}
      {status.kind === 'error' ? (
        <Notice tone="danger" testID="custom-error">
          {status.text}
        </Notice>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={D.preview.start}
          icon="play"
          onPress={() => void start()}
          disabled={!hasWork || busy}
          testID="custom-start"
        />
        <Button
          label={saved ? D.preview.saveChanges : D.preview.save}
          variant="secondary"
          onPress={() => void save()}
          disabled={!hasWork}
          loading={busy}
          testID="custom-save"
        />
        <Button
          label={D.preview.reroll}
          variant="secondary"
          onPress={reroll}
          disabled={busy}
          testID="custom-reroll"
        />
        {existing ? (
          <Button
            label={D.preview.delete}
            variant="danger"
            onPress={() => setConfirmDelete(true)}
            disabled={busy}
            testID="custom-delete"
          />
        ) : null}
      </View>

      <SwapSheet
        visible={swapAt !== null}
        currentName={swapName}
        candidates={swapCandidates}
        onClose={() => setSwapAt(null)}
        onPick={(candidate) => {
          if (swapAt) {
            change(replaceCustomItem(definition, swapAt.ti, swapAt.ii, candidate.exercise, lookup));
          }
          setSwapAt(null);
        }}
      />
      <ExerciseSearchSheet
        visible={addAt !== null}
        title={D.add.title(addAt === null ? '' : customTrackLabel(definition, addAt))}
        query={query}
        onQuery={setQuery}
        results={addCandidates}
        emptyText={D.add.empty}
        onClose={() => setAddAt(null)}
        onPick={(exercise) => {
          if (addAt !== null) change(addCustomItem(definition, addAt, exercise));
          setAddAt(null);
        }}
        testID="custom-add-sheet"
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={D.preview.deleteTitle}
        message={D.preview.deleteMessage(name)}
        confirmLabel={D.preview.delete}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
        loading={busy}
        testID="custom-delete-dialog"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  total: { fontSize: fontSize.lg },
  buttons: { gap: spacing.sm },
});
