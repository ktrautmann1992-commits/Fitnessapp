import {
  findEquipment,
  missingWorkoutEquipment,
  WORKOUT_LIMITS,
  type Workout,
  workoutDiscipline,
  workoutTileSummary,
} from '@fitnessapp/core';
import { areaColors, fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { workoutImageFor } from '@/data/workout-media';
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

/**
 * Karte in der Liste: Titel, Sterne, Dauer, Sportart (sonst Ziel), Geräte; fehlende Geräte als Hinweis (nie
 * ausgeblendet); ganze Karte tippbar (Rolle „Link“).
 */
export function WorkoutCard({
  workout,
  doneToday,
  onPress,
  available = null,
}: {
  workout: Workout;
  doneToday: boolean;
  onPress: () => void;
  /** Geräte laut Angaben (useWorkoutEquipment); null = unbekannt, kein Hinweis. */
  available?: ReadonlySet<string> | null;
}) {
  const theme = useThemeColors();
  const discipline = workoutDiscipline(workout);
  const missing = missingWorkoutEquipment(workout, available);
  const missingText =
    missing.length > 0 ? t.workouts.equipmentMissing(equipmentText(missing)) : null;
  const meta = [
    t.workouts.minutes(workout.minutes),
    discipline ? t.workouts.disciplines[discipline] : t.workouts.categories[workout.category],
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
        missingText,
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
        <WorkoutThumb workoutId={workout.id} testID={`workout-card-${workout.id}-thumb`} />
        <Text style={[styles.cardTitle, { color: theme.text }]}>{workout.title_de}</Text>
      </View>
      <StarRating difficulty={workout.difficulty} />
      <Text style={[styles.cardMeta, { color: theme.textMuted }]}>{meta}</Text>
      {missingText ? (
        <Text
          style={[styles.cardMeta, { color: theme.warning }]}
          testID={`workout-card-${workout.id}-missing`}
        >
          {missingText}
        </Text>
      ) : null}
      {doneToday ? (
        <Text style={[styles.cardDone, { color: theme.success }]}>{t.workouts.doneToday}</Text>
      ) : null}
    </Pressable>
  );
}

/** Kantenlänge des Workout-Bilds in der Liste. */
export const WORKOUT_THUMB_SIZE = 64;

/**
 * Bild links in der Workout-Karte (Barbell Burn, 14.11.2026, docs/PLAN-BARBELL-BURN.md). Reiner Schmuck – der Titel
 * daneben trägt die Ansage; ohne Bild das bisherige Stoppuhr-Symbol (Workouts ohne Bild bleiben unverändert).
 */
export function WorkoutThumb({ workoutId, testID }: { workoutId: string; testID?: string }) {
  const image = workoutImageFor(workoutId);
  if (!image) return <IconChip area="workouts" icon="stopwatch" size={40} />;
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={styles.thumb}
    >
      <Image
        source={image.thumbnail}
        resizeMode="cover"
        style={styles.thumbImage}
        accessible={false}
      />
    </View>
  );
}

/**
 * Großes Bild (21:9) oben in der Workout-Ansicht mit sichtbarem KI-Hinweis (wie die Rezeptfotos). Ohne Bild nichts
 * (kein leerer Rahmen).
 */
export function WorkoutBanner({ workoutId }: { workoutId: string }) {
  const image = workoutImageFor(workoutId);
  const theme = useThemeColors();
  if (!image) return null;
  return (
    <View style={[styles.banner, { backgroundColor: theme.border }]} testID="workout-banner">
      <Image
        source={image.banner}
        resizeMode="cover"
        style={styles.bannerImage}
        accessibilityRole="image"
        accessibilityLabel={image.alt_de}
        alt={image.alt_de}
      />
      {image.ai_notice_de ? (
        <Text
          style={styles.notice}
          accessibilityLabel={t.workouts.aiImageA11y(image.ai_notice_de)}
          testID="workout-banner-ai"
        >
          {image.ai_notice_de}
        </Text>
      ) : null}
    </View>
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
  thumb: {
    width: WORKOUT_THUMB_SIZE,
    height: WORKOUT_THUMB_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbImage: { width: WORKOUT_THUMB_SIZE, height: WORKOUT_THUMB_SIZE },
  // Fester Rahmen 21:9 (wie die Bilder); das Bild füllt ihn – so auch im Web-Export (react-native-web).
  banner: { width: '100%', aspectRatio: 21 / 9, borderRadius: radius.lg, overflow: 'hidden' },
  // Ausdrücklich 100 % – react-native-web nimmt sonst die Pixelmaße der Bilddatei (1080 × 463).
  bannerImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  notice: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    lineHeight: 14,
  },
});
