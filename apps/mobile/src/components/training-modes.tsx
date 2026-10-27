import {
  BODY_REGIONS,
  type BodyRegion,
  type DisplaySession,
  type Exercise,
  type ModeNotice,
  type ModesBanner as ModesBannerData,
  muscleNameDe,
  type RoutineItem,
  type SessionRoutine,
  type StoredSession,
} from '@fitnessapp/core';
import { brandColors, fontSize, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { deModes as M } from '@/i18n/de-training-modes';
import { formatDateDe } from '@/lib/format';
import { shapePaths } from '@/lib/muscle-map-format';
import { MUSCLE_MAP_BODY, MUSCLE_MAP_HEIGHT, MUSCLE_MAP_WIDTH } from '@/lib/muscle-map-paths';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';

import { Badge, Body, Button, Card, Heading, Notice } from './ui';

/**
 * Bausteine der Trainings-Modi (docs/PLAN-TRAINING-MODI.md): Banner auf „Heute“, Hinweise an einer Einheit,
 * Körperkarte (Schmerz-Modus), Aufwärmen/Dehnen im Training. Nur Anzeige – Regeln und Auswahl kommen aus
 * packages/core (modes/).
 */

const regionList = (regions: readonly { region: BodyRegion }[]) =>
  regions.map((r) => M.regions[r.region]).join(', ');

/** Banner „Reise-Modus bis …“ / „Schon-Modus bis …“ (oben auf „Heute“). */
export function ModesBanner({
  banner,
  onTravel,
  onPain,
}: {
  banner: ModesBannerData;
  onTravel: () => void;
  onPain: () => void;
}) {
  if (!banner.travel && !banner.pain) return null;
  const travel = banner.travel;
  const pain = banner.pain;
  return (
    <View style={styles.banners} testID="modes-banner">
      {travel ? (
        <Notice
          tone="info"
          icon="calendar"
          title={
            travel.active
              ? M.banner.travelActive(formatDateDe(travel.endsOn))
              : M.banner.travelUpcoming(formatDateDe(travel.startsOn), formatDateDe(travel.endsOn))
          }
          testID="modes-banner-travel"
        >
          <Body>{M.banner.travelDetail(M.equipment[travel.equipment])}</Body>
          {travel.maxMinutes ? <Body>{M.banner.travelMinutes(travel.maxMinutes)}</Body> : null}
          <Button
            label={M.banner.manageTravel}
            variant="link"
            onPress={onTravel}
            testID="modes-banner-travel-manage"
          />
        </Notice>
      ) : null}
      {pain ? (
        <Notice
          tone={pain.advice.length > 0 ? 'warning' : 'info'}
          title={M.banner.painActive(formatDateDe(pain.until))}
          testID="modes-banner-pain"
        >
          <Body>{M.banner.painRegions(regionList(pain.regions))}</Body>
          {pain.advice.length > 0 ? (
            <Body testID="modes-banner-pain-advice">{`${M.pain.adviceTitle}.`}</Body>
          ) : null}
          <Button
            label={M.banner.managePain}
            variant="link"
            onPress={onPain}
            testID="modes-banner-pain-manage"
          />
        </Notice>
      ) : null}
    </View>
  );
}

/** Reihenfolge der Hinweise an einer Einheit (der Arzt-Hinweis zuerst). */
const NOTICE_ORDER: readonly ModeNotice[] = [
  'pain_medical_advice',
  'pain_session_empty',
  'pain_active',
  'pain_swapped',
  'pain_removed',
  'pain_endurance_easier',
  'pain_endurance_check',
  'pain_combo_run_only',
  'travel_active',
  'travel_swapped',
  'travel_removed',
  'travel_shortened',
];

/** Hinweise der Modi an einer angezeigten Einheit (nur wenn ein Modus an diesem Tag wirkt). */
export function ModeNoticesBlock({
  shown,
  swapPaused = false,
}: {
  shown: Pick<DisplaySession<StoredSession>, 'modeNotices'>;
  /** Tausch-Dialog wegen eines Modus ausgesetzt (Hinweis „wählt die App selbst“). */
  swapPaused?: boolean;
}) {
  const notices = shown.modeNotices ?? [];
  if (notices.length === 0) return null;
  const ordered = NOTICE_ORDER.filter((n) => notices.includes(n));
  const advice = ordered.includes('pain_medical_advice');
  const empty = ordered.includes('pain_session_empty');
  return (
    <Notice
      tone={advice || empty ? 'warning' : 'info'}
      title={advice ? M.pain.adviceTitle : undefined}
      testID="session-mode-notices"
    >
      {ordered
        .filter((n) => n !== 'pain_medical_advice')
        .map((n) => (
          <Body key={n} testID={`session-mode-notice-${n}`}>
            {M.notices[n]}
          </Body>
        ))}
      {swapPaused ? <Body muted>{M.swapPaused}</Body> : null}
    </Notice>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Körperkarte (Schmerz-Modus): Silhouette vorn/hinten mit antippbaren Stellen, Liste als Alternative
// ---------------------------------------------------------------------------------------------------------

/** Lage der Stellen im Raster 200 × 440 der Silhouette (beide Körperseiten, gleiche Region). */
export const BODY_MAP_SPOTS: Readonly<
  Record<
    BodyRegion,
    { readonly view: 'front' | 'back'; readonly points: readonly [number, number][] }
  >
> = {
  neck: { view: 'back', points: [[100, 68]] },
  shoulder: {
    view: 'front',
    points: [
      [50, 96],
      [150, 96],
    ],
  },
  elbow: {
    view: 'back',
    points: [
      [40, 178],
      [160, 178],
    ],
  },
  // Handgelenke hinten: vorn lägen sie direkt neben der Hüfte (Tipp-Flächen überlappten).
  wrist: {
    view: 'back',
    points: [
      [22, 256],
      [178, 256],
    ],
  },
  lower_back: { view: 'back', points: [[100, 206]] },
  hip: {
    view: 'front',
    points: [
      [66, 232],
      [134, 232],
    ],
  },
  knee: {
    view: 'front',
    points: [
      [74, 342],
      [126, 342],
    ],
  },
  ankle: {
    view: 'back',
    points: [
      [76, 408],
      [124, 408],
    ],
  },
};

const FIGURE_HEIGHT = 300;
const SPOT = 34;

function Silhouette({ height }: { height: number }) {
  const dark = useColorScheme() === 'dark';
  const width = Math.round((height * MUSCLE_MAP_WIDTH) / MUSCLE_MAP_HEIGHT);
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${MUSCLE_MAP_WIDTH} ${MUSCLE_MAP_HEIGHT}`}
      accessible={false}
      aria-hidden
    >
      <G>
        {shapePaths(MUSCLE_MAP_BODY.front).map((d, i) => (
          <Path key={i} d={d} fill={dark ? '#2a3140' : '#e2e7f0'} />
        ))}
      </G>
    </Svg>
  );
}

export function BodyMap({
  value,
  onChange,
}: {
  value: BodyRegion | null;
  onChange: (region: BodyRegion) => void;
}) {
  const theme = useThemeColors();
  const scale = FIGURE_HEIGHT / MUSCLE_MAP_HEIGHT;
  const width = Math.round(MUSCLE_MAP_WIDTH * scale);
  return (
    <View style={styles.mapWrap} testID="body-map">
      <Text style={[styles.mapNote, { color: theme.textMuted }]}>{M.pain.mapA11y}</Text>
      <View style={styles.figures}>
        {(['front', 'back'] as const).map((view) => (
          <View key={view} style={styles.figureCol}>
            <View style={{ width, height: FIGURE_HEIGHT }}>
              <Silhouette height={FIGURE_HEIGHT} />
              {BODY_REGIONS.filter((r) => BODY_MAP_SPOTS[r].view === view).flatMap((region) =>
                BODY_MAP_SPOTS[region].points.map(([x, y], i) => {
                  const selected = value === region;
                  return (
                    <Pressable
                      key={`${region}-${i}`}
                      accessibilityRole="radio"
                      accessibilityLabel={M.regions[region]}
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      // Die zweite Körperseite ist nur ein weiterer Tipp-Punkt derselben Stelle (Liste unten für
                      // Bildschirmleser, nicht doppelt ansagen).
                      importantForAccessibility={i === 0 ? 'yes' : 'no-hide-descendants'}
                      accessibilityElementsHidden={i > 0}
                      hitSlop={7}
                      onPress={() => onChange(region)}
                      testID={`body-map-${region}${i === 0 ? '' : `-${i}`}`}
                      style={({ pressed }) => [
                        styles.spot,
                        {
                          left: x * scale - SPOT / 2,
                          top: y * scale - SPOT / 2,
                          borderColor: selected ? brandColors.blau : theme.textMuted,
                          backgroundColor: selected ? brandColors.blau : theme.surface,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      {selected ? <Text style={styles.spotCheck}>✓</Text> : null}
                    </Pressable>
                  );
                }),
              )}
            </View>
            <Text style={[styles.caption, { color: theme.textMuted }]} aria-hidden>
              {view === 'front' ? M.pain.front : M.pain.back}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Aufwärmen & Dehnen
// ---------------------------------------------------------------------------------------------------------

function itemLine(item: RoutineItem): string {
  if (item.kind === 'ramp' && item.reps !== null) {
    const note = item.note ? ` · ${M.warmup[item.note]}` : '';
    return `${M.warmup.rampSets(item.sets, item.reps)}${note}`;
  }
  if (item.seconds !== null) {
    return item.kind === 'stretch'
      ? `${M.warmup.seconds(item.seconds)} ${M.warmup.perSide}`
      : M.warmup.seconds(item.seconds);
  }
  return item.reps !== null ? M.warmup.reps(item.reps) : '';
}

/** Überschrift „Für Beine und Po“ aus den Hauptmuskeln. */
export function routineMusclesText(routine: Pick<SessionRoutine, 'mainMuscles'>): string | null {
  if (routine.mainMuscles.length === 0) return null;
  const names = routine.mainMuscles.map((m) => muscleNameDe(m));
  return M.warmup.forMuscles(
    names.length === 1
      ? (names[0] as string)
      : `${names.slice(0, -1).join(', ')} und ${names.at(-1) as string}`,
  );
}

/** Aufwärmen bzw. Dehnen im Trainingsmodus – mit „Überspringen“. */
export function RoutineBlock({
  part,
  routine,
  fallbackText,
  skipped,
  onSkip,
  onShow,
  library,
}: {
  part: 'warmup' | 'cooldown';
  routine: SessionRoutine;
  /** Text der Vorlage (warmup_de bzw. cooldown_de), wenn keine Übungen passen. */
  fallbackText: string;
  skipped: boolean;
  onSkip: () => void;
  onShow: () => void;
  library: ReadonlyMap<string, Exercise> | null;
}) {
  const theme = useThemeColors();
  const warmup = part === 'warmup';
  const title = warmup ? M.warmup.title : M.warmup.cooldownTitle;
  const items = warmup ? routine.warmup : routine.cooldown;
  const fallback = warmup ? routine.warmupFallback : routine.cooldownFallback;
  const minutes = warmup ? routine.warmupMinutes : routine.cooldownMinutes;
  const testID = `workout-${part}`;
  if (skipped) {
    return (
      <Card>
        <View style={styles.routineHead}>
          <Heading level={2}>{title}</Heading>
        </View>
        <Body muted testID={`${testID}-skipped`}>
          {M.warmup.skipped}
        </Body>
        <Button label={M.warmup.show} variant="link" onPress={onShow} testID={`${testID}-show`} />
      </Card>
    );
  }
  const muscles = warmup ? routineMusclesText(routine) : null;
  return (
    <Card>
      <View style={styles.routineHead} testID={testID}>
        <Heading level={2}>{title}</Heading>
        <Body muted>{M.warmup.minutes(minutes)}</Body>
      </View>
      {muscles ? <Body muted>{muscles}</Body> : null}
      {fallback ? (
        <View style={styles.routineItem} testID={`${testID}-fallback`}>
          <Text style={[styles.routineName, appFont('semibold'), { color: theme.text }]}>
            {warmup ? M.warmup.fallbackWarmup : M.warmup.fallbackCooldown}
          </Text>
          <Body>{fallbackText}</Body>
        </View>
      ) : null}
      {items.map((item) => {
        const draft = library?.get(item.exerciseId)?.status === 'draft';
        return (
          <View
            key={`${item.kind}-${item.exerciseId}`}
            style={[styles.routineItem, { borderColor: theme.border }]}
            testID={`${testID}-item`}
          >
            <View style={styles.routineNameRow}>
              <Text style={[styles.routineName, appFont('semibold'), { color: theme.text }]}>
                {item.nameDe}
              </Text>
              {draft ? <Badge label={M.warmup.draft} testID={`${testID}-draft`} /> : null}
            </View>
            <Body muted>{itemLine(item)}</Body>
          </View>
        );
      })}
      {!warmup && !fallback ? <Body muted>{M.warmup.stretchNote}</Body> : null}
      <Button
        label={M.warmup.skip}
        variant="secondary"
        accessibilityLabel={M.warmup.skipA11y(title)}
        onPress={onSkip}
        testID={`${testID}-skip`}
      />
    </Card>
  );
}

/** Kurzfassung für „Heute“: „Aufwärmen (ca. 5 min): Marschieren, Armkreisen, …“. */
export function routineSummary(
  routine: SessionRoutine,
  part: 'warmup' | 'cooldown',
  fallbackText: string,
): string {
  const items = part === 'warmup' ? routine.warmup : routine.cooldown;
  const fallback = part === 'warmup' ? routine.warmupFallback : routine.cooldownFallback;
  const names = [...new Set(items.map((i) => i.nameDe))].join(', ');
  if (fallback && names.length === 0) return fallbackText;
  if (fallback) return `${fallbackText} ${names}.`;
  return `${names}.`;
}

const styles = StyleSheet.create({
  banners: { gap: spacing.sm },
  mapWrap: { gap: spacing.xs },
  mapNote: { fontSize: fontSize.sm },
  figures: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  figureCol: { alignItems: 'center', gap: spacing.xs },
  caption: { fontSize: fontSize.sm },
  spot: {
    position: 'absolute',
    width: SPOT,
    height: SPOT,
    borderRadius: SPOT / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCheck: { color: brandColors.weiss, fontSize: fontSize.md, fontWeight: '700' },
  routineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  routineItem: { borderTopWidth: 1, paddingTop: spacing.xs, gap: 2 },
  routineNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  routineName: { fontSize: fontSize.md },
});
