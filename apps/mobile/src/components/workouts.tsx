import { findEquipment, WORKOUT_LIMITS, type Workout, workoutTileSummary } from '@fitnessapp/core';
import { areaColors, fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';

import { DashboardTile } from './dashboard';
import { HeroSurface, Icon, IconChip, StatValue, useAreaColors } from './design';
import { Body, MIN_TOUCH } from './ui';
import { Text } from '@/components/text';

/**
 * Bausteine der Workout-Bibliothek (docs/PLAN-WORKOUTS.md): Sterne, Karte, Kachel für die Übersicht. Nur Darstellung;
 * Filter, Kachel-Zahlen und Timer kommen aus packages/core.
 */

/**
 * Sterne mit Wort („★★☆☆☆ eher leicht“). Für Bildschirmleser EIN Text („Schwierigkeit 2 von 5 Sternen: eher leicht“) –
 * die Sternzeichen selbst werden nicht vorgelesen.
 */
export function StarRating({
  difficulty,
  size = 'md',
  testID,
}: {
  difficulty: number;
  size?: 'md' | 'lg';
  testID?: string;
}) {
  const theme = useThemeColors();
  const violet = useAreaColors('workouts');
  const max = WORKOUT_LIMITS.stars.max;
  const filled = Math.min(max, Math.max(WORKOUT_LIMITS.stars.min, difficulty));
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t.workouts.stars.a11y(filled)}
      aria-label={t.workouts.stars.a11y(filled)}
      style={styles.starsRow}
      testID={testID}
    >
      <Text
        aria-hidden
        importantForAccessibility="no"
        style={[styles.stars, size === 'lg' && styles.starsLarge, { color: violet.icon }]}
      >
        {/* Design 20.10.2026: Sterne in Workout-Violett (Signal-Orange bleibt Warnungen vorbehalten), leere
            Sterne in Nebentext-Grau – beide gut lesbar (≥ 4,5 : 1). */}
        {'★'.repeat(filled)}
        <Text style={{ color: theme.textMuted }}>{'☆'.repeat(max - filled)}</Text>
      </Text>
      <Text
        aria-hidden
        importantForAccessibility="no"
        style={[styles.starWord, { color: theme.text }]}
      >
        {t.workouts.stars.word(filled)}
      </Text>
    </View>
  );
}

/** Geräte als Text („ohne Geräte“ bzw. Namen aus dem Katalog). */
export function equipmentText(ids: readonly string[]): string {
  if (ids.length === 0) return t.workouts.noEquipment;
  return ids.map((id) => findEquipment(id)?.nameDe ?? id).join(', ');
}

/** Karte in der Liste: Titel, Sterne, Dauer, Ziel, Geräte; ganze Karte tippbar (Rolle „Link“). */
export function WorkoutCard({
  workout,
  doneToday,
  onPress,
}: {
  workout: Workout;
  doneToday: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const meta = [
    t.workouts.minutes(workout.minutes),
    t.workouts.categories[workout.category],
    t.workouts.formats[workout.format],
    equipmentText(workout.equipment_ids),
  ].join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[
        workout.title_de,
        t.workouts.stars.a11y(workout.difficulty),
        meta,
        doneToday ? t.workouts.doneToday : null,
      ]
        .filter((x): x is string => x !== null)
        .join(', ')}
      onPress={onPress}
      testID={`workout-card-${workout.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <IconChip area="workouts" icon="stopwatch" size={40} />
        <Text style={[styles.cardTitle, { color: theme.text }]}>{workout.title_de}</Text>
      </View>
      <StarRating difficulty={workout.difficulty} />
      <Text style={[styles.cardMeta, { color: theme.textMuted }]}>{meta}</Text>
      {workout.status === 'draft' ? (
        <Text style={[styles.cardMeta, { color: theme.textMuted }]}>{t.workouts.testContent}</Text>
      ) : null}
      {doneToday ? (
        <Text style={[styles.cardDone, { color: theme.success }]}>{t.workouts.doneToday}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Kachel „Workouts“ für die Übersicht (Daten: workoutTileSummary aus packages/core). Wird von der Übersicht
 * eingebunden, sobald die anpassbare Menüleiste/Übersicht zusammengeführt ist – hier nur der Baustein.
 */
export function WorkoutsTile({
  workouts,
  logs,
  today,
  onOpen,
}: {
  workouts: readonly Workout[];
  logs: readonly { readonly performed_on: string; readonly source: string }[];
  today: string;
  onOpen: () => void;
}) {
  const summary = workoutTileSummary(workouts, logs, today);
  const T = t.workouts.tile;
  // Design 20.10.2026: die ganze Kachel führt zu „Workouts“ (Link), große Zahl + kurzer Text.
  return (
    <DashboardTile
      title={T.title}
      area="workouts"
      icon="stopwatch"
      testID="tile-workouts"
      onPress={onOpen}
      accessibilityLabel={`${T.title}: ${T.text(summary.total, summary.withoutEquipment)}`}
    >
      <StatValue
        value={String(summary.total)}
        label={T.statLabel(summary.withoutEquipment)}
        size="lg"
      />
      {summary.doneToday > 0 ? <Body>{T.doneToday(summary.doneToday)}</Body> : null}
    </DashboardTile>
  );
}

/**
 * Kopf des Reiters „Workouts“ (Design 23.10.2026): dunkle Hero-Karte in Workout-Violett mit Bestand und heute
 * Erledigtem (Zahlen aus packages/core `workoutTileSummary`, wie die Kachel der Übersicht).
 */
export function WorkoutsHero({
  workouts,
  logs,
  today,
}: {
  workouts: readonly Workout[];
  logs: readonly { readonly performed_on: string; readonly source: string }[];
  today: string;
}) {
  const summary = workoutTileSummary(workouts, logs, today);
  const T = t.workouts.tile;
  // Kennzeile auf Dunkel: Violett der Dunkel-Palette (≥ 4,5 : 1, packages/ui tokens.test.ts).
  const accent = areaColors.dark.workouts.icon;
  return (
    <HeroSurface area="workouts" testID="workouts-hero">
      <View style={styles.heroEyebrow}>
        <Icon name="stopwatch" size={16} color={accent} strokeWidth={2.2} />
        <Text style={[styles.heroEyebrowText, appFont('bold'), { color: accent }]}>
          {t.workouts.hero.eyebrow}
        </Text>
      </View>
      <StatValue
        value={String(summary.total)}
        label={T.statLabel(summary.withoutEquipment)}
        size="lg"
      />
      {summary.doneToday > 0 ? (
        <Body testID="workouts-hero-done">{T.doneToday(summary.doneToday)}</Body>
      ) : null}
    </HeroSurface>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroEyebrowText: { fontSize: fontSize.xs, letterSpacing: 0.6, textTransform: 'uppercase' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  stars: { fontSize: fontSize.lg, letterSpacing: 2 },
  starsLarge: { fontSize: fontSize.xl },
  starWord: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  card: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { flex: 1, minWidth: 0, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  cardMeta: { fontSize: fontSize.sm },
  cardDone: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
