import {
  brickStepSports,
  type DisplayContext,
  type DisplaySession,
  exerciseMark,
  MULTISPORT_TEXTS_DE,
  type PaceProfile,
  type PlanSafetyRules,
  sessionPaceInfo,
  sessionSafetyNotices,
  type StoredSession,
  type WeekDay,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { workoutInfoLines } from '@/lib/competition-format';
import { dayLabel, enduranceLines, exerciseLines, weekdayShort } from '@/lib/plan-format';
import { keyPatternTexts, markText } from '@/lib/swap-format';
import { useThemeColors } from '@/lib/theme';

import { StepList } from './competition';
import { HeroCard, useAreaColors } from './design';
import { Body, Button, Card, Heading, MIN_TOUCH, Notice } from './ui';
import { Text } from '@/components/text';

/**
 * Bausteine für „Heute“ (docs/PLAN-PHASE-3.md 10.2): Einheit, Arzt-Hinweis, Wochenübersicht. Nur Anzeige –
 * welche Einheit, welche Regeln und welche Texte kommen aus packages/core bzw. lib/plan-format.ts.
 */

/** Arzt-Hinweis – über JEDER Einheit, wenn der Plan medical_notice hat (auch offline). */
export function MedicalNotice() {
  return (
    <Notice tone="warning" title={t.plan.medicalNoticeTitle} testID="plan-medical-notice">
      <Body>{t.plan.medicalNotice}</Body>
    </Notice>
  );
}

export function SessionCard({
  original,
  shown,
  rules,
  context,
  heading,
  targets,
  onOpenExercise,
  swap,
  paceProfile = null,
  hero = false,
}: {
  /** Gespeicherte Einheit (vor den aktuellen Sicherheitsregeln). */
  original: StoredSession;
  /** Dieselbe Einheit nach prepareSessionForDisplay (aktuelle Regeln angewendet). */
  shown: DisplaySession<StoredSession>;
  rules: PlanSafetyRules | null;
  /** Bibliothek und Geräte am Ort – für das Kennzeichen „ersetzt (Gerät fehlt)“. */
  context: Pick<DisplayContext, 'library' | 'profile'>;
  heading: string;
  /**
   * Phase 4: berechnete Vorgabe je angezeigter Übung (gleiche Reihenfolge wie `shown.session.exercises`) – ersetzt die
   * Dosierung aus dem Plan („3 × 10 mit 22,5 kg je Hantel“) und zeigt Hinweise der Progression.
   */
  targets?: readonly (readonly string[] | null)[];
  /** Übungs-Glossar (Etappe G1): Übungsname als Link zur Anleitung. */
  onOpenExercise?: (exerciseId: string) => void;
  /**
   * Übungstausch (Etappe T2): „Tauschen“ an jeder Übung (nur wenn `enabled`), „Tausch zurücknehmen“ bei „heute
   * getauscht“, Link „Ausschlüsse ansehen“ zu den Einstellungen (null = keine Präferenzen, z. B. Supabase vor T3).
   */
  /** Wettkampfplan (WP4): Basis der Pace-Richtwerte (Referenzzeit des Wettkampfs); null = keine Pace. */
  paceProfile?: PaceProfile | null;
  /** Design 20.10.2026: Kopf der Einheit als dunkle Hero-Karte (Training heute), Inhalt darunter als Karte. */
  hero?: boolean;
  swap?: {
    enabled: boolean;
    /** Termin nach heute („für dieses Training getauscht“). */
    later: boolean;
    onSwap: (index: number) => void;
    onUndoDaySwap: (index: number) => void;
    onViewExclusions: (() => void) | null;
  };
}) {
  const theme = useThemeColors();
  const session = shown.session;
  const hiddenByPreference = shown.hiddenByPreference ?? [];
  const notices = shown.preferenceNotices ?? [];
  const keyPatterns = keyPatternTexts(shown.missingKeyPattern);
  const head = hero ? null : (
    <>
      <Body muted>{heading}</Body>
      <Heading level={2}>{session.name_de}</Heading>
      <Body muted>{t.plan.duration(session.estimated_minutes)}</Body>
    </>
  );
  const card = (
    <Card>
      {head}
      {session.status === 'skipped' ? <Notice tone="info">{t.plan.skipped}</Notice> : null}
      <View style={styles.block}>
        <Text style={[styles.label, { color: theme.text }]}>{t.plan.warmup}</Text>
        <Body>{session.warmup_de}</Body>
      </View>
      {session.kind === 'endurance' ? (
        <View style={styles.block} testID="plan-endurance">
          {/* Wettkampfplan (WP4): Art, Pace-Spanne (immer mit Hinweis), Distanz-Richtwert, Ablauf der Schritte. */}
          {workoutInfoLines(session, sessionPaceInfo(session, paceProfile)).map((line) => (
            <Body key={line} testID="plan-workout-info">
              {line}
            </Body>
          ))}
          {enduranceLines(session, rules).map((line) => (
            <Body key={line}>{line}</Body>
          ))}
          {session.workout_steps && session.workout_steps.length > 1 ? (
            <StepList
              steps={session.workout_steps}
              sports={
                session.workout_type === 'brick'
                  ? brickStepSports(session.workout_steps, session.estimated_minutes)
                  : null
              }
            />
          ) : null}
          {/* WP5: bei jeder Schwimm-Einheit der Sicherheitshinweis zum Freiwasser (nie allein, Neopren, Begleitung). */}
          {sessionSafetyNotices(session).includes('open_water') ? (
            <Notice tone="info" title={t.competition.openWaterTitle} testID="plan-open-water">
              <Body>{MULTISPORT_TEXTS_DE.openWater}</Body>
            </Notice>
          ) : null}
        </View>
      ) : shown.libraryMissing ? (
        <Notice tone="warning" title={t.plan.libraryMissingTitle} testID="plan-library-missing">
          <Body>{t.plan.libraryMissingText}</Body>
        </Notice>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.label, { color: theme.text }]}>{t.plan.exercises}</Text>
          {session.exercises.map((exercise, index) => {
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
            const computed = targets?.[index] ?? null;
            return (
              <View
                key={`${exercise.order_no}-${exercise.exercise_id}`}
                style={[styles.exercise, { borderColor: theme.border }]}
                testID="plan-exercise"
              >
                {onOpenExercise ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`${exercise.order_no}. ${exercise.exercise_name_de}`}
                    accessibilityHint={t.glossary.openGuideHint}
                    onPress={() => onOpenExercise(exercise.exercise_id)}
                    testID="plan-exercise-link"
                    style={({ pressed }) => [styles.exerciseLink, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text
                      style={[
                        styles.exerciseName,
                        { color: theme.link, textDecorationLine: 'underline' },
                      ]}
                    >
                      {exercise.order_no}. {exercise.exercise_name_de}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.exerciseName, { color: theme.text }]}>
                    {exercise.order_no}. {exercise.exercise_name_de}
                  </Text>
                )}
                {markLabel ? (
                  <Body muted testID={`plan-exercise-mark-${index}`}>
                    {markLabel}
                  </Body>
                ) : null}
                {(computed ?? exerciseLines(exercise)).map((line) => (
                  <Body key={line} muted>
                    {line}
                  </Body>
                ))}
                {kept ? (
                  <Body muted testID={`plan-kept-disliked-${index}`}>
                    {t.swap.keptDisliked}
                  </Body>
                ) : null}
                {swap?.enabled ? (
                  mark === 'day_swap' ? (
                    <Button
                      label={t.swap.undoDaySwap}
                      variant="secondary"
                      accessibilityLabel={t.swap.undoDaySwapA11y(
                        original.exercises.find((e) => e.order_no === storedOrderNo)
                          ?.exercise_name_de ?? exercise.exercise_name_de,
                      )}
                      onPress={() => swap.onUndoDaySwap(index)}
                      testID={`plan-swap-undo-${index}`}
                    />
                  ) : (
                    <Button
                      label={t.swap.button}
                      variant="secondary"
                      accessibilityLabel={t.swap.buttonA11y(exercise.exercise_name_de)}
                      onPress={() => swap.onSwap(index)}
                      testID={`plan-swap-${index}`}
                    />
                  )
                ) : null}
              </View>
            );
          })}
          {shown.hidden.length > 0 ? (
            // Nur Sicherheits-Ausblendungen (Wächter B1b) – nie wegen einer Präferenz.
            <Notice tone="warning" testID="plan-hidden-exercises">
              {t.plan.hiddenExercises}
            </Notice>
          ) : null}
          {shown.emptyByPreference ? (
            <Notice tone="info" testID="plan-empty-by-preference">
              <Body>{t.swap.emptyByPreference}</Body>
              {swap?.onViewExclusions ? (
                <Button
                  label={t.swap.viewExclusions}
                  variant="link"
                  onPress={swap.onViewExclusions}
                />
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
          {notices.includes('many_exclusions') ? (
            <Notice tone="info" testID="plan-many-exclusions">
              {t.swap.manyExclusions}
            </Notice>
          ) : null}
        </View>
      )}
      <View style={styles.block}>
        <Text style={[styles.label, { color: theme.text }]}>{t.plan.cooldown}</Text>
        <Body>{session.cooldown_de}</Body>
      </View>
    </Card>
  );
  if (!hero) return card;
  return (
    <>
      <HeroCard
        eyebrow={heading}
        eyebrowIcon={session.kind === 'endurance' ? 'run' : 'dumbbell'}
        title={session.name_de}
        subtitle={t.plan.duration(session.estimated_minutes)}
        titleIsHeading
        testID="plan-session-hero"
      />
      {card}
    </>
  );
}

export function WeekOverview({
  days,
  selected,
  onSelect,
}: {
  days: readonly WeekDay<StoredSession>[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  return (
    <View style={styles.week} testID="plan-week">
      {days.map((day) => {
        const session = day.session;
        const status = session
          ? session.name_de
          : day.skipped.length > 0
            ? `${day.skipped[0]?.name_de ?? ''} – ${t.plan.skipped}`
            : t.plan.restShort;
        const extra = [
          day.isToday ? t.plan.todayBadge : null,
          session?.status === 'completed' ? t.plan.completedBadge : null,
          session?.is_deload ? t.plan.deloadBadge : null,
          session?.original_date && session.original_date !== session.scheduled_on
            ? t.plan.movedFrom(weekdayShort(session.original_date))
            : null,
          ...day.movedAway.map((s) => t.plan.movedAway(weekdayShort(s.scheduled_on))),
          // Erledigte Einheit neben einer offenen am selben Tag (completedOn, z. B. alter Plan) – Etappe D.
          ...day.alsoCompleted.map((s) => t.plan.alsoCompleted(s.name_de)),
        ].filter((value): value is string => value !== null);
        const isSelected = day.date === selected;
        return (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel(day.date)}: ${status}${extra.length > 0 ? ` (${extra.join(', ')})` : ''}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(day.date)}
            style={({ pressed }) => [
              styles.day,
              {
                backgroundColor: theme.surface,
                borderColor: isSelected || day.isToday ? theme.primary : theme.cardBorder,
                borderWidth: isSelected ? 3 : day.isToday ? 2 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {/* Wochentag als Chip: mit Einheit in der Trainingsfarbe, Ruhetag neutral (Wort steht daneben). */}
            <View
              style={[
                styles.dayChip,
                { backgroundColor: session ? training.surface : theme.background },
              ]}
            >
              <Text style={[styles.dayName, { color: session ? training.icon : theme.textMuted }]}>
                {weekdayShort(day.date)}
              </Text>
            </View>
            <View style={styles.dayText}>
              <Text
                style={[
                  styles.dayStatus,
                  { color: session ? theme.text : theme.textMuted },
                  session ? { fontWeight: fontWeight.semibold } : null,
                ]}
              >
                {status}
              </Text>
              {extra.length > 0 ? (
                <Text style={[styles.dayExtra, { color: theme.textMuted }]}>
                  {extra.join(' · ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  exercise: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 2,
  },
  exerciseName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  exerciseLink: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  week: { gap: spacing.xs },
  day: {
    minHeight: MIN_TOUCH + 8,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  dayText: { flex: 1, gap: 2 },
  dayStatus: { fontSize: fontSize.md, lineHeight: 22 },
  dayExtra: { fontSize: fontSize.sm, lineHeight: 20 },
});
