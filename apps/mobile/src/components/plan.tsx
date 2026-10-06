import {
  type DisplayContext,
  type DisplaySession,
  exerciseMark,
  type PlanSafetyRules,
  type StoredSession,
  type WeekDay,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { dayLabel, enduranceLines, exerciseLines, weekdayShort } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';

import { Body, Card, Heading, MIN_TOUCH, Notice } from './ui';

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
}) {
  const theme = useThemeColors();
  const session = shown.session;
  return (
    <Card>
      <Body muted>{heading}</Body>
      <Heading level={2}>{session.name_de}</Heading>
      <Body muted>{t.plan.duration(session.estimated_minutes)}</Body>
      {session.status === 'skipped' ? <Notice tone="info">{t.plan.skipped}</Notice> : null}
      <View style={styles.block}>
        <Text style={[styles.label, { color: theme.text }]}>{t.plan.warmup}</Text>
        <Body>{session.warmup_de}</Body>
      </View>
      {session.kind === 'endurance' ? (
        <View style={styles.block} testID="plan-endurance">
          {enduranceLines(session, rules).map((line) => (
            <Body key={line}>{line}</Body>
          ))}
        </View>
      ) : shown.libraryMissing ? (
        <Notice tone="warning" title={t.plan.libraryMissingTitle} testID="plan-library-missing">
          <Body>{t.plan.libraryMissingText}</Body>
        </Notice>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.label, { color: theme.text }]}>{t.plan.exercises}</Text>
          {session.exercises.map((exercise, index) => {
            const mark = exerciseMark(exercise, original, context);
            const computed = targets?.[index] ?? null;
            return (
              <View
                key={`${exercise.order_no}-${exercise.exercise_id}`}
                style={[styles.exercise, { borderColor: theme.border }]}
                testID="plan-exercise"
              >
                <Text style={[styles.exerciseName, { color: theme.text }]}>
                  {exercise.order_no}. {exercise.exercise_name_de}
                </Text>
                {mark === 'equipment_swap' ? <Body muted>{t.plan.substituted}</Body> : null}
                {mark === 'adjusted' ? <Body muted>{t.plan.adjusted}</Body> : null}
                {(computed ?? exerciseLines(exercise)).map((line) => (
                  <Body key={line} muted>
                    {line}
                  </Body>
                ))}
              </View>
            );
          })}
          {shown.hidden.length > 0 ? (
            <Notice tone="warning" testID="plan-hidden-exercises">
              {t.plan.hiddenExercises}
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
          session?.is_deload ? t.plan.deloadBadge : null,
          session?.original_date && session.original_date !== session.scheduled_on
            ? t.plan.movedFrom(weekdayShort(session.original_date))
            : null,
          ...day.movedAway.map((s) => t.plan.movedAway(weekdayShort(s.scheduled_on))),
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
                borderColor: isSelected || day.isToday ? theme.primary : theme.border,
                borderWidth: isSelected ? 3 : day.isToday ? 2 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.dayName, { color: theme.text }]}>{weekdayShort(day.date)}</Text>
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
  week: { gap: spacing.xs },
  day: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayName: { width: 32, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  dayText: { flex: 1, gap: 2 },
  dayStatus: { fontSize: fontSize.md, lineHeight: 22 },
  dayExtra: { fontSize: fontSize.sm, lineHeight: 20 },
});
