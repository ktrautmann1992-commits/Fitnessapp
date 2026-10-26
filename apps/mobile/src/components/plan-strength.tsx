import {
  type DisplayContext,
  type DisplaySession,
  type Exercise,
  type ExerciseMuscleTile,
  exerciseMark,
  exerciseMuscleTiles,
  type SessionRoutine,
  sessionMuscleTiles,
  type StoredSession,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/components/text';
import { exerciseMediaFor, illustrationXml } from '@/data/exercise-media';
import { t } from '@/i18n';
import { appFont, displayFont } from '@/lib/fonts';
import { type ExerciseSummary, exerciseSummary } from '@/lib/plan-format';
import { keyPatternTexts, markText } from '@/lib/swap-format';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

import { Icon, IconButton, IconChip, type IconName, SectionLabel, useAreaColors } from './design';
import { MuscleChips } from './exercise-muscle-tiles';
import { ModeNoticesBlock, routineSummary } from './training-modes';
import { Body, Button, Notice } from './ui';

/**
 * Krafteinheit als kompakte Liste (Gründer-Freigabe Entwurf B, 26.10.2026, docs/DESIGN.md „Übungsliste Training“):
 * Kopf-Karte mit Minuten/Übungen/Sätzen, Hauptmuskeln der Einheit und Start; „Startgewicht finden“ EINMAL als
 * aufklappbarer Hinweis; Aufwärmen/Cool-down als aufklappbare Zeilen; alle Übungen in EINER Karte als Zeilen mit
 * Bild, Name (Link zur Anleitung), einer Zeile Zahlen, Tausch-Knopf (44 px) und Muskel-Chips.
 * Nur Anzeige – Muskeln, Kennzeichen und Vorgaben kommen aus packages/core bzw. lib/plan-format.ts.
 */

const L = t.plan.list;

export interface SessionStartAction {
  label: string;
  onPress: () => void;
}

export interface StrengthSwap {
  enabled: boolean;
  later: boolean;
  onSwap: (index: number) => void;
  onUndoDaySwap: (index: number) => void;
  onViewExclusions: (() => void) | null;
}

export function StrengthSession({
  original,
  shown,
  context,
  heading,
  today,
  targets,
  onOpenExercise,
  swap,
  swapPaused,
  routine,
  start,
}: {
  original: StoredSession;
  shown: DisplaySession<StoredSession>;
  context: Pick<DisplayContext, 'library' | 'profile'>;
  heading: string;
  today: boolean;
  targets: readonly (ExerciseSummary | null)[] | undefined;
  onOpenExercise: ((exerciseId: string) => void) | undefined;
  swap: StrengthSwap | undefined;
  swapPaused: boolean;
  routine: SessionRoutine | null;
  start: SessionStartAction | null;
}) {
  const session = shown.session;
  const library = context.library;
  const entries = session.exercises.map((e) => library?.get(e.exercise_id));
  const summaries = session.exercises.map(
    (exercise, index) =>
      targets?.[index] ?? exerciseSummary(exercise, entries[index]?.load_type ?? null),
  );
  const listed = !shown.libraryMissing;
  const totalSets = listed ? summaries.reduce((sum, s) => sum + s.sets, 0) : 0;
  const sessionTiles = listed ? sessionMuscleTiles(entries) : [];
  const needsWeight = listed && summaries.some((s) => s.findWeight !== null);
  const hiddenByPreference = shown.hiddenByPreference ?? [];
  const notices = shown.preferenceNotices ?? [];
  const keyPatterns = keyPatternTexts(shown.missingKeyPattern);
  const warmupText = routine
    ? routineSummary(routine, 'warmup', session.warmup_de)
    : session.warmup_de;
  const cooldownText = routine
    ? routineSummary(routine, 'cooldown', session.cooldown_de)
    : session.cooldown_de;

  return (
    <View style={styles.stack}>
      <SessionHeader
        heading={heading}
        name={session.name_de}
        minutes={session.estimated_minutes}
        exercises={listed ? session.exercises.length : 0}
        sets={totalSets}
        tiles={sessionTiles}
        today={today}
        start={start}
      />
      {session.status === 'skipped' ? <Notice tone="info">{t.plan.skipped}</Notice> : null}
      <ModeNoticesBlock shown={shown} swapPaused={swapPaused} />
      {needsWeight ? <StartWeightHint /> : null}
      <SectionLabel>{L.sequence}</SectionLabel>
      {warmupText.trim() ? (
        <CollapsibleRow
          icon="sun"
          title={t.plan.warmup}
          subtitle={routine ? L.warmupMinutes(routine.warmupMinutes) : null}
          text={warmupText}
          testID="plan-warmup"
        />
      ) : null}
      {shown.libraryMissing ? (
        <Notice tone="warning" title={t.plan.libraryMissingTitle} testID="plan-library-missing">
          <Body>{t.plan.libraryMissingText}</Body>
        </Notice>
      ) : session.exercises.length > 0 ? (
        <ListCard testID="plan-exercise-list">
          {session.exercises.map((exercise, index) => (
            <ExerciseRow
              key={`${exercise.order_no}-${exercise.exercise_id}`}
              exercise={exercise}
              index={index}
              original={original}
              shown={shown}
              context={context}
              entry={entries[index]}
              summary={summaries[index]!}
              first={index === 0}
              onOpenExercise={onOpenExercise}
              swap={swap}
            />
          ))}
        </ListCard>
      ) : null}
      {!shown.libraryMissing && shown.hidden.length > 0 ? (
        // Nur Sicherheits-Ausblendungen (Wächter B1b) – nie wegen einer Präferenz.
        <Notice tone="warning" testID="plan-hidden-exercises">
          {t.plan.hiddenExercises}
        </Notice>
      ) : null}
      {shown.libraryMissing ? null : shown.emptyByPreference ? (
        <Notice tone="info" testID="plan-empty-by-preference">
          <Body>{t.swap.emptyByPreference}</Body>
          {swap?.onViewExclusions ? (
            <Button label={t.swap.viewExclusions} variant="link" onPress={swap.onViewExclusions} />
          ) : null}
        </Notice>
      ) : hiddenByPreference.length > 0 ? (
        // Neutral, ohne „Plan neu erstellen“ (Wächter B1b, Pflicht-Test 11).
        <Notice tone="info" testID="plan-hidden-by-preference">
          <Body>{t.swap.hiddenByPreference(hiddenByPreference.length)}</Body>
          {keyPatterns.map((text) => (
            <Body key={text}>{text}</Body>
          ))}
          {swap?.onViewExclusions ? (
            <Button
              label={t.swap.viewExclusions}
              variant="link"
              onPress={swap.onViewExclusions}
              testID="plan-view-exclusions"
            />
          ) : null}
        </Notice>
      ) : null}
      {!shown.libraryMissing && notices.includes('many_exclusions') ? (
        <Notice tone="info" testID="plan-many-exclusions">
          {t.swap.manyExclusions}
        </Notice>
      ) : null}
      {cooldownText.trim() ? (
        <CollapsibleRow
          icon="moon"
          title={t.plan.cooldown}
          subtitle={routine ? L.warmupMinutes(routine.cooldownMinutes) : null}
          text={cooldownText}
          testID="plan-cooldown"
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kopf der Einheit
// ---------------------------------------------------------------------------------------------------------
function SessionHeader({
  heading,
  name,
  minutes,
  exercises,
  sets,
  tiles,
  today,
  start,
}: {
  heading: string;
  name: string;
  minutes: number;
  exercises: number;
  sets: number;
  tiles: readonly ExerciseMuscleTile[];
  today: boolean;
  start: SessionStartAction | null;
}) {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const primary = tiles.filter((tile) => tile.role === 'primary');
  const secondary = tiles.filter((tile) => tile.role === 'secondary');
  const names = (list: readonly ExerciseMuscleTile[]) =>
    list.map(({ tile }) => t.glossary.muscleTiles[tile]).join(', ');
  return (
    <ListCard testID="plan-session-header" padded>
      <View style={styles.headTop}>
        <IconChip area="training" icon="dumbbell" size={40} />
        <View style={styles.headText}>
          <Text style={[styles.kicker, appFont('extrabold'), { color: training.icon }]}>
            {heading}
          </Text>
          <Text
            accessibilityRole="header"
            aria-level={2}
            style={[styles.headTitle, displayFont(), { color: theme.text }]}
          >
            {name}
          </Text>
        </View>
      </View>
      <View
        style={[styles.facts, { borderTopColor: theme.divider }]}
        accessible
        accessibilityLabel={
          exercises > 0 ? L.factsA11y(minutes, exercises, sets) : t.plan.duration(minutes)
        }
        testID="plan-session-facts"
      >
        <Fact value={String(minutes)} label={L.factMinutes} />
        {exercises > 0 ? (
          <>
            <Fact value={String(exercises)} label={L.factExercises} />
            <Fact value={String(sets)} label={L.factSets} />
          </>
        ) : null}
      </View>
      {primary.length > 0 ? (
        <View style={styles.headMuscles} testID="plan-session-muscles">
          <Text
            style={[styles.kicker, appFont('extrabold'), { color: theme.textMuted }]}
            accessibilityLabel={`${today ? L.musclesToday : L.muscles}: ${names(primary)}`}
          >
            {today ? L.musclesToday : L.muscles}
          </Text>
          <MuscleChips tiles={primary} />
        </View>
      ) : null}
      {secondary.length > 0 ? (
        <Text
          style={[styles.supporting, appFont('regular'), { color: theme.textMuted }]}
          testID="plan-session-supporting"
        >
          <Text style={[appFont('bold'), { color: theme.text }]}>{L.supporting}</Text>{' '}
          {names(secondary)}
        </Text>
      ) : null}
      {start ? (
        <Button
          label={start.label}
          icon="play"
          onPress={start.onPress}
          testID="plan-session-start"
        />
      ) : null}
    </ListCard>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.fact} aria-hidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.factValue, appFont('extrabold'), { color: theme.text }]}>{value}</Text>
      <Text style={[styles.factLabel, appFont('semibold'), { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Aufklappbare Zeilen: „Startgewicht finden“, Aufwärmen, Cool-down
// ---------------------------------------------------------------------------------------------------------
function Chevron({ open }: { open: boolean }) {
  const theme = useThemeColors();
  return (
    <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
      <Icon name="chevron" size={20} color={theme.textMuted} />
    </View>
  );
}

/** „Startgewicht finden“ – nur EINMAL oben, wenn mindestens einer Übung ein Gewicht fehlt. */
function StartWeightHint() {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const [open, setOpen] = useState(false);
  return (
    <View
      testID="plan-start-weight-hint"
      style={[
        styles.hint,
        {
          backgroundColor: theme.surface,
          borderColor: theme.cardBorder,
          borderLeftColor: training.strong,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${L.startWeightTitle}. ${L.startWeightSubtitle}`}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        testID="plan-start-weight-toggle"
        style={({ pressed }) => [styles.hintHead, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="info" size={22} color={training.icon} />
        <View style={styles.grow}>
          <Text style={[styles.rowTitle, appFont('bold'), { color: theme.text }]}>
            {L.startWeightTitle}
          </Text>
          <Text style={[styles.rowSubtitle, appFont('regular'), { color: theme.textMuted }]}>
            {L.startWeightSubtitle}
          </Text>
        </View>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <View style={styles.hintBody} testID="plan-start-weight-text">
          <Body>{L.startWeightText}</Body>
          <Body muted>{L.reserveText}</Body>
        </View>
      ) : null}
    </View>
  );
}

function CollapsibleRow({
  icon,
  title,
  subtitle,
  text,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle: string | null;
  text: string;
  testID: string;
}) {
  const theme = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <ListCard testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        testID={`${testID}-toggle`}
        style={({ pressed }) => [styles.collapsibleHead, { opacity: pressed ? 0.7 : 1 }]}
      >
        <IconChip area="training" icon={icon} size={36} />
        <View style={styles.grow}>
          <Text style={[styles.rowTitle, appFont('bold'), { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, appFont('regular'), { color: theme.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <View style={styles.collapsibleBody} testID={`${testID}-text`}>
          <Body>{text}</Body>
        </View>
      ) : null}
    </ListCard>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Übungszeile
// ---------------------------------------------------------------------------------------------------------
const ILLUSTRATION = 64;

function ExerciseRow({
  exercise,
  index,
  original,
  shown,
  context,
  entry,
  summary,
  first,
  onOpenExercise,
  swap,
}: {
  exercise: StoredSession['exercises'][number];
  index: number;
  original: StoredSession;
  shown: DisplaySession<StoredSession>;
  context: Pick<DisplayContext, 'library' | 'profile'>;
  entry: Exercise | undefined;
  summary: ExerciseSummary;
  first: boolean;
  onOpenExercise: ((exerciseId: string) => void) | undefined;
  swap: StrengthSwap | undefined;
}) {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const storedOrderNo = shown.storedOrderNos?.[index];
  const mark = exerciseMark(
    exercise,
    original,
    context,
    storedOrderNo !== undefined ? { storedOrderNo, display: shown } : undefined,
  );
  const markLabel = markText(mark, swap?.later ?? false);
  const kept = shown.keptDisliked?.some(
    (k) => k.storedOrderNo === storedOrderNo && k.exerciseId === exercise.exercise_id,
  );
  const tiles = entry ? exerciseMuscleTiles(entry) : [];
  const muscleNames = (role: 'primary' | 'secondary') =>
    tiles
      .filter((tile) => tile.role === role)
      .map(({ tile }) => t.glossary.muscleTiles[tile])
      .join(', ');
  const superset = exercise.superset_group;
  const a11y = [
    `${exercise.order_no}. ${exercise.exercise_name_de}`,
    superset ? L.superset(superset) : null,
    summary.a11y,
    muscleNames('primary') ? L.a11y.primary(muscleNames('primary')) : null,
    muscleNames('secondary') ? L.a11y.secondary(muscleNames('secondary')) : null,
  ]
    .filter((v): v is string => v !== null)
    .join(', ');
  const open = onOpenExercise ? () => onOpenExercise(exercise.exercise_id) : undefined;
  // Geschützte Leerzeichen und Wortverbinder am Strich: „1:30 Pause“ und „2–3 in Reserve“ brechen nie im Wert um.
  const keep = (text: string) => text.replace(/–/g, '\u2060–\u2060').replace(/ /g, '\u00a0');
  const doseRest = [summary.rest, summary.reserve].filter((v): v is string => v !== null);

  return (
    <View
      testID="plan-exercise"
      style={[
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: theme.divider },
        superset ? { borderLeftWidth: 4, borderLeftColor: training.strong } : null,
      ]}
    >
      {superset ? (
        <Text
          style={[styles.kicker, appFont('extrabold'), { color: training.icon }]}
          testID={`plan-superset-${index}`}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
        >
          {L.superset(superset)}
        </Text>
      ) : null}
      <View style={styles.rowTop}>
        <Pressable
          onPress={open}
          disabled={!open}
          accessible={false}
          focusable={false}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          tabIndex={-1}
          style={styles.illustrationBox}
        >
          <ExerciseThumb exerciseId={exercise.exercise_id} />
          <View
            style={[
              styles.number,
              { backgroundColor: training.strong, borderColor: theme.surface },
            ]}
          >
            <Text style={[styles.numberText, appFont('extrabold')]}>{exercise.order_no}</Text>
          </View>
        </Pressable>
        <View style={styles.body}>
          {open ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={a11y}
              accessibilityHint={t.glossary.openGuideHint}
              onPress={open}
              testID="plan-exercise-link"
              style={({ pressed }) => [styles.nameLink, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.name, appFont('bold'), { color: theme.text }]}>
                {exercise.exercise_name_de}
              </Text>
            </Pressable>
          ) : (
            <Text
              accessibilityLabel={a11y}
              style={[styles.name, appFont('bold'), { color: theme.text }]}
            >
              {exercise.exercise_name_de}
            </Text>
          )}
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <Text
              style={[styles.dose, appFont('semibold'), { color: theme.textMuted }]}
              testID={`plan-exercise-dose-${index}`}
            >
              <Text style={[appFont('extrabold'), { color: theme.text }]}>{summary.dose}</Text>
              {doseRest.map((part) => ` · ${keep(part)}`).join('')}
            </Text>
            {summary.weight !== null ? (
              <Text
                style={[styles.dose, appFont('extrabold'), { color: theme.text }]}
                testID={`plan-exercise-weight-${index}`}
              >
                {summary.weight}
              </Text>
            ) : summary.findWeight !== null ? (
              <View style={styles.findWeight} testID={`plan-exercise-find-weight-${index}`}>
                <Icon name="info" size={14} color={theme.link} />
                <Text style={[styles.dose, appFont('bold'), { color: theme.link }]}>
                  {summary.findWeight === 'lightest' ? L.chooseLightest : L.findWeight}
                </Text>
              </View>
            ) : null}
          </View>
          {markLabel ? <Small testID={`plan-exercise-mark-${index}`}>{markLabel}</Small> : null}
          {summary.notes.map((note) => (
            <Small key={note}>{note}</Small>
          ))}
          {exercise.notes_de ? (
            <Small testID={`plan-exercise-note-${index}`}>{exercise.notes_de}</Small>
          ) : null}
          {kept ? (
            <Small testID={`plan-kept-disliked-${index}`}>{t.swap.keptDisliked}</Small>
          ) : null}
          {swap?.enabled && mark === 'day_swap' ? (
            <View style={styles.undo}>
              <Button
                label={t.swap.undoDaySwap}
                variant="link"
                accessibilityLabel={t.swap.undoDaySwapA11y(
                  original.exercises.find((e) => e.order_no === storedOrderNo)?.exercise_name_de ??
                    exercise.exercise_name_de,
                )}
                onPress={() => swap.onUndoDaySwap(index)}
                testID={`plan-swap-undo-${index}`}
              />
            </View>
          ) : null}
        </View>
        {swap?.enabled && mark !== 'day_swap' ? (
          <IconButton
            icon="swap"
            variant="plain"
            area="training"
            accessibilityLabel={t.swap.buttonA11y(exercise.exercise_name_de)}
            onPress={() => swap.onSwap(index)}
            testID={`plan-swap-${index}`}
          />
        ) : null}
      </View>
      <MuscleChips tiles={tiles} testID={`plan-exercise-muscles-${index}`} />
    </View>
  );
}

function Small({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useThemeColors();
  return (
    <Text testID={testID} style={[styles.small, appFont('regular'), { color: theme.textMuted }]}>
      {children}
    </Text>
  );
}

/** 64-px-Bild der Ausgangsposition auf hellem Trainingsblau; ohne Bild nur die Fläche mit Hantel-Icon. */
function ExerciseThumb({ exerciseId }: { exerciseId: string }) {
  const scheme = useColorSchemeName();
  const training = useAreaColors('training');
  const found = exerciseMediaFor(exerciseId, 'start_position');
  return (
    <View style={[styles.illustration, { backgroundColor: training.surface }]}>
      {found === null ? (
        <Icon name="dumbbell" size={26} color={training.icon} />
      ) : found.source.kind === 'svg' ? (
        <SvgXml
          xml={illustrationXml(found.source.template, scheme, { gap: training.surface })}
          width={72}
          height={54}
          accessible={false}
          aria-hidden
        />
      ) : (
        <Image source={found.source.source} resizeMode="contain" style={styles.illustrationImage} />
      )}
    </View>
  );
}

function ListCard({
  children,
  testID,
  padded = false,
}: {
  children: ReactNode;
  testID?: string;
  padded?: boolean;
}) {
  const theme = useThemeColors();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        padded && styles.cardPadded,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm + 4 },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  cardPadded: { padding: spacing.md, gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: fontSize.xs, letterSpacing: 0.8, textTransform: 'uppercase' },
  headTitle: { fontSize: 22, lineHeight: 28 },
  facts: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  fact: { flex: 1 },
  factValue: { fontSize: 20, lineHeight: 26 },
  factLabel: { fontSize: fontSize.xs, lineHeight: 18 },
  headMuscles: { gap: 8 },
  supporting: { fontSize: fontSize.sm, lineHeight: 20 },
  hint: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 16, overflow: 'hidden' },
  hintHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hintBody: { paddingHorizontal: 12, paddingBottom: 12, gap: spacing.xs },
  rowTitle: { fontSize: fontSize.md, lineHeight: 22 },
  rowSubtitle: { fontSize: fontSize.xs, lineHeight: 18 },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  collapsibleBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { paddingTop: 14, paddingBottom: 14, paddingLeft: 12, paddingRight: 4, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  illustrationBox: { width: ILLUSTRATION, height: ILLUSTRATION },
  illustration: {
    width: ILLUSTRATION,
    height: ILLUSTRATION,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationImage: { width: ILLUSTRATION, height: ILLUSTRATION },
  number: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  // Tippfläche ≥ 44 px, ohne die Zeile höher zu machen (Polster nach außen, negativer Rand).
  nameLink: { paddingVertical: 11, marginVertical: -11 },
  name: { fontSize: fontSize.md, lineHeight: 22 },
  dose: { fontSize: fontSize.sm, lineHeight: 20 },
  findWeight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontSize: fontSize.xs, lineHeight: 18 },
  undo: { alignSelf: 'flex-start' },
});
