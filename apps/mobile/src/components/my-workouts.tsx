import {
  canRemoveCustomItem,
  type CustomWorkoutDefinition,
  customHasRoom,
  customTrackLabel,
  type Exercise,
  type WorkoutContentItem,
  type WorkoutSwapCandidate,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ExercisePicture } from '@/components/exercise-picture';
import { Text } from '@/components/text';
import { exerciseMediaFor, illustrationXml, useExerciseMedia } from '@/data/exercise-media';
import { t } from '@/i18n';
import { deMyWorkouts } from '@/i18n/de-my-workouts';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

import { Icon, useAreaColors } from './design';
import { Body, Button, Heading, Notice, TextField } from './ui';

/**
 * Bausteine für „Eigenes Workout“ und den Tausch in Workouts (docs/PLAN-EIGENE-WORKOUTS.md): kleines Übungsbild,
 * Bodenblatt (Bottom Sheet), Tausch-Auswahl mit Bild und Namen, Übungssuche und die Vorschau der Tracks mit
 * Tauschen/Entfernen/Hinzufügen/Verschieben. Nur Darstellung – alle Regeln kommen aus packages/core.
 */

const D = deMyWorkouts;
const THUMB = 56;

/** Ausgangsposition der Übung (Foto oder Illustration) auf hellem Trainingsblau; ohne Bild das Hantel-Symbol. */
export function ExerciseMiniThumb({ exerciseId }: { exerciseId: string }) {
  const scheme = useColorSchemeName();
  const training = useAreaColors('training');
  const loaded = useExerciseMedia();
  const found = loaded ? exerciseMediaFor(exerciseId, 'start_position') : null;
  return (
    <View style={[styles.thumb, { backgroundColor: training.surface }]} accessible={false}>
      {!loaded ? null : found === null ? (
        <Icon name="dumbbell" size={22} color={training.icon} />
      ) : found.source.kind === 'svg' ? (
        <SvgXml
          xml={illustrationXml(found.source.template, scheme, { gap: training.surface })}
          width={THUMB + 8}
          height={THUMB - 8}
          accessible={false}
          aria-hidden
        />
      ) : found.source.kind === 'photo' ? (
        <ExercisePicture source={found.source} scheme={scheme} height={Math.round(THUMB * 0.75)} />
      ) : (
        <Image source={found.source.source} resizeMode="contain" style={styles.thumbImage} />
      )}
    </View>
  );
}

/** Dosierung als Text („3 Sätze · 12 Wdh. · 20 s Pause“). */
export function doseText(
  item: WorkoutContentItem,
  exercise: Pick<Exercise, 'unilateral'> | undefined,
) {
  return [
    item.sets !== null ? t.workouts.detail.sets(item.sets) : null,
    item.reps !== null
      ? t.workouts.detail.reps(item.reps, exercise?.unilateral === true)
      : t.workouts.detail.seconds(item.duration_s ?? 0, exercise?.unilateral === true),
    t.workouts.detail.rest(item.rest_s),
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');
}

/** Bodenblatt: Fläche unten, scrollbar, Titel und „Schließen“. Funktioniert auch im Browser (Modal). */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTap}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={D.swap.close}
        />
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          testID={testID}
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.sheetHead}>
            <Heading level={2}>{title}</Heading>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.sheetFoot}>
            <Button
              label={D.swap.close}
              variant="secondary"
              onPress={onClose}
              testID={testID ? `${testID}-close` : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Eine Übung zum Antippen (Bild, Name, Zusatz). */
export function ExerciseChoice({
  exercise,
  detail,
  onPress,
  selected = false,
  testID,
  accessibilityLabel,
}: {
  exercise: Exercise;
  detail?: string | undefined;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? [exercise.name_de, detail].filter(Boolean).join(', ')
      }
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? theme.primary : theme.border,
          borderWidth: selected ? 3 : 1,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <ExerciseMiniThumb exerciseId={exercise.id} />
      <View style={styles.grow}>
        <Text style={[styles.choiceTitle, appFont('bold'), { color: theme.text }]}>
          {selected ? `✓ ${exercise.name_de}` : exercise.name_de}
        </Text>
        {detail ? (
          <Text style={[styles.choiceDetail, appFont('regular'), { color: theme.textMuted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Tausch-Auswahl (Bodenblatt): Kandidaten aus workoutSwapCandidates mit Bild, Name, Grund und Dosierung. */
export function SwapSheet({
  visible,
  currentName,
  candidates,
  onPick,
  onClose,
  error,
}: {
  visible: boolean;
  currentName: string;
  candidates: readonly WorkoutSwapCandidate[];
  onPick: (candidate: WorkoutSwapCandidate) => void;
  onClose: () => void;
  error?: string | undefined;
}) {
  return (
    <BottomSheet visible={visible} title={D.swap.title} onClose={onClose} testID="swap-sheet">
      <Body>{D.swap.insteadOf(currentName)}</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {candidates.length === 0 ? (
        <Notice testID="swap-sheet-empty">{D.swap.none}</Notice>
      ) : (
        <View style={styles.list} testID="swap-sheet-candidates">
          {candidates.map((c) => (
            <ExerciseChoice
              key={c.exercise.id}
              exercise={c.exercise}
              detail={`${D.swap.reasons[c.reason]} · ${doseText(c.item, c.exercise)}`}
              onPress={() => onPick(c)}
              testID={`swap-candidate-${c.exercise.id}`}
              accessibilityLabel={D.swap.pick(c.exercise.name_de)}
            />
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

/** Übungssuche im Bodenblatt (Hinzufügen, Lieblings-/„Mag ich nicht“-Übungen). */
export function ExerciseSearchSheet({
  visible,
  title,
  query,
  onQuery,
  results,
  onPick,
  onClose,
  emptyText,
  selectedIds,
  testID = 'exercise-search-sheet',
  needsQuery = false,
}: {
  visible: boolean;
  title: string;
  query: string;
  onQuery: (text: string) => void;
  results: readonly Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  emptyText: string;
  selectedIds?: ReadonlySet<string>;
  testID?: string;
  /** Liste erst ab zwei Buchstaben (Suche in der ganzen Bibliothek). */
  needsQuery?: boolean;
}) {
  const short = needsQuery && query.trim().length < 2;
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} testID={testID}>
      <TextField
        label={D.wizard.search}
        value={query}
        onChangeText={onQuery}
        placeholder={D.wizard.searchPlaceholder}
        testID={`${testID}-query`}
      />
      {short ? (
        <Body muted>{D.wizard.searchHint}</Body>
      ) : results.length === 0 ? (
        <Notice testID={`${testID}-empty`}>{emptyText}</Notice>
      ) : (
        <View style={styles.list}>
          {results.slice(0, 30).map((exercise) => (
            <ExerciseChoice
              key={exercise.id}
              exercise={exercise}
              selected={selectedIds?.has(exercise.id) === true}
              onPress={() => onPick(exercise)}
              testID={`${testID}-pick-${exercise.id}`}
            />
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

/**
 * Vorschau eines eigenen Workouts: Tracks mit Übungen (Bild, Name, Dosierung) und je Übung Tauschen, Entfernen,
 * nach oben/unten; je Track „Übung hinzufügen“. Gesamtdauer kommt vom Aufrufer (live neu berechnet).
 */
export function CustomTracksEditor({
  definition,
  lookup,
  onSwap,
  onRemove,
  onMove,
  onAdd,
}: {
  definition: CustomWorkoutDefinition;
  lookup: ReadonlyMap<string, Exercise>;
  onSwap: (trackIndex: number, itemIndex: number) => void;
  onRemove: (trackIndex: number, itemIndex: number) => void;
  onMove: (trackIndex: number, itemIndex: number, direction: -1 | 1) => void;
  onAdd: (trackIndex: number) => void;
}) {
  const theme = useThemeColors();
  const room = customHasRoom(definition);
  return (
    <View style={styles.tracks} testID="custom-tracks">
      {definition.tracks.map((track, ti) => {
        const label = customTrackLabel(definition, ti);
        const removable = canRemoveCustomItem(definition, ti);
        return (
          <View
            key={`${ti}-${track.kind}-${track.area ?? ''}`}
            style={[
              styles.track,
              { borderColor: theme.cardBorder, backgroundColor: theme.surface },
            ]}
            testID={`custom-track-${ti}`}
          >
            <Text style={[styles.trackTitle, appFont('bold'), { color: theme.text }]}>
              {D.preview.track(ti + 1, label)}
            </Text>
            {track.items.map((item, ii) => {
              const exercise = lookup.get(item.exercise_id);
              const name = exercise?.name_de ?? item.exercise_id;
              return (
                <View
                  key={item.exercise_id}
                  style={styles.item}
                  testID={`custom-item-${item.exercise_id}`}
                >
                  <View style={styles.itemTop}>
                    <ExerciseMiniThumb exerciseId={item.exercise_id} />
                    <View style={styles.grow}>
                      <Text style={[styles.itemTitle, appFont('bold'), { color: theme.text }]}>
                        {name}
                      </Text>
                      <Text
                        style={[styles.itemDose, appFont('regular'), { color: theme.textMuted }]}
                      >
                        {doseText(item, exercise)}
                      </Text>
                    </View>
                    <View style={styles.moves}>
                      {ii > 0 ? (
                        <ArrowButton
                          up
                          label={D.preview.up(name)}
                          onPress={() => onMove(ti, ii, -1)}
                          testID={`custom-up-${item.exercise_id}`}
                        />
                      ) : null}
                      {ii < track.items.length - 1 ? (
                        <ArrowButton
                          up={false}
                          label={D.preview.down(name)}
                          onPress={() => onMove(ti, ii, 1)}
                          testID={`custom-down-${item.exercise_id}`}
                        />
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label={D.preview.swap}
                      icon="swap"
                      variant="secondary"
                      compact
                      accessibilityLabel={D.preview.swapA11y(name)}
                      onPress={() => onSwap(ti, ii)}
                      testID={`custom-swap-${item.exercise_id}`}
                    />
                    <Button
                      label={D.preview.remove}
                      icon="trash"
                      variant="secondary"
                      compact
                      disabled={!removable}
                      accessibilityLabel={D.preview.removeA11y(name)}
                      onPress={() => onRemove(ti, ii)}
                      testID={`custom-remove-${item.exercise_id}`}
                    />
                  </View>
                </View>
              );
            })}
            {!removable ? <Body muted>{D.preview.keepOne}</Body> : null}
            <Button
              label={D.preview.add}
              icon="plus"
              variant="link"
              disabled={!room}
              accessibilityLabel={D.preview.addA11y(label)}
              onPress={() => onAdd(ti)}
              testID={`custom-add-${ti}`}
            />
          </View>
        );
      })}
      {!room ? <Body muted>{D.preview.full}</Body> : null}
    </View>
  );
}

/** Nach oben/unten (Pfeil, 44 px Tippfläche). */
function ArrowButton({
  up,
  label,
  onPress,
  testID,
}: {
  up: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [
        styles.arrow,
        { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.arrowText, { color: theme.text }]}>{up ? '▲' : '▼'}</Text>
    </Pressable>
  );
}

/** „angepasst“-Kennzeichen (Workout mit getauschten Übungen). */
export function AdjustedBadge({ testID }: { testID?: string }) {
  const theme = useThemeColors();
  return (
    <View
      accessible
      accessibilityLabel={D.swap.adjustedA11y}
      testID={testID}
      style={[styles.badge, { borderColor: theme.primary }]}
    >
      <Text style={[styles.badgeText, appFont('semibold'), { color: theme.text }]}>
        {D.swap.adjusted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHead: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sheetBody: { padding: spacing.lg, gap: spacing.md },
  sheetFoot: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  list: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: radius.md,
    minHeight: 64,
  },
  grow: { flex: 1, minWidth: 0 },
  choiceTitle: { fontSize: fontSize.md },
  choiceDetail: { fontSize: fontSize.sm },
  tracks: { gap: spacing.md },
  track: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  trackTitle: { fontSize: fontSize.md, letterSpacing: 0.3 },
  item: { gap: 6, paddingVertical: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { fontSize: fontSize.md },
  itemDose: { fontSize: fontSize.sm },
  moves: { flexDirection: 'row', gap: 4 },
  arrow: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.sm },
});
