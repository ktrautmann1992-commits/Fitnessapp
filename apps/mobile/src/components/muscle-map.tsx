import {
  type MuscleGroup,
  type MuscleHighlight,
  type MuscleMapHighlights,
  type MuscleMapView,
  MUSCLE_MAP_VIEWS,
} from '@fitnessapp/core';
import { brandColors, fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import Svg, { G, Path, SvgXml } from 'react-native-svg';

import { Body, Button, Card, Heading } from '@/components/ui';
import { focusTestId, focusView } from '@/components/swap';
import { exerciseMediaFor, illustrationXml } from '@/data/exercise-media';
import { t } from '@/i18n';
import { muscleMapA11yLabel, muscleMapLegend, shapePaths } from '@/lib/muscle-map-format';
import {
  MUSCLE_MAP_BODY,
  MUSCLE_MAP_DETAILS,
  MUSCLE_MAP_HEIGHT,
  MUSCLE_MAP_PATHS,
  MUSCLE_MAP_WIDTH,
} from '@/lib/muscle-map-paths';
import { useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Muskelkarte (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md): eigene, stilisierte Silhouette vorn und
 * hinten (react-native-svg, gleich auf Web und Handy). Hauptmuskeln kräftig in Markenblau, mitbeteiligte heller,
 * Rest neutral grau. Farbe nie allein: Legende in Worten und Screenreader-Text („Trainiert vor allem: …“).
 */

interface MuscleMapPalette {
  readonly body: string;
  readonly none: string;
  readonly secondary: string;
  readonly primary: string;
  /** Trennlinien zwischen den Regionen (Kartenfarbe). */
  readonly line: string;
}

/** Farben hell/dunkel (docs/DESIGN.md „Muskelkarte“). */
export const MUSCLE_MAP_PALETTE: Readonly<Record<'light' | 'dark', MuscleMapPalette>> = {
  light: {
    body: '#e7ebf2',
    none: '#c9d0dc',
    secondary: brandColors.himmel,
    primary: brandColors.blau,
    line: brandColors.weiss,
  },
  dark: {
    body: '#1d222d',
    none: '#363e4f',
    secondary: '#3b5bab',
    primary: '#4d7dff',
    line: brandColors.graphit,
  },
};

function usePalette(): MuscleMapPalette {
  return MUSCLE_MAP_PALETTE[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

const fillFor = (level: MuscleHighlight, palette: MuscleMapPalette) =>
  level === 'primary' ? palette.primary : level === 'secondary' ? palette.secondary : palette.none;

/** Eine Ansicht (vorn oder hinten) als SVG, rein dekorativ (Text steht daneben). */
function MuscleFigure({
  view,
  highlights,
  height,
}: {
  view: MuscleMapView;
  highlights: MuscleMapHighlights;
  height: number;
}) {
  const palette = usePalette();
  const width = Math.round((height * MUSCLE_MAP_WIDTH) / MUSCLE_MAP_HEIGHT);
  const regions = Object.entries(MUSCLE_MAP_PATHS[view]) as [
    MuscleGroup,
    (typeof MUSCLE_MAP_PATHS)[MuscleMapView][MuscleGroup],
  ][];
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${MUSCLE_MAP_WIDTH} ${MUSCLE_MAP_HEIGHT}`}
      accessible={false}
      aria-hidden
      testID={`muscle-map-figure-${view}`}
    >
      <G>
        {shapePaths(MUSCLE_MAP_BODY[view]).map((d, i) => (
          <Path key={`body-${i}`} d={d} fill={palette.body} />
        ))}
      </G>
      {regions.map(([muscle, shape]) => {
        const level = highlights.regions[muscle];
        return (
          <G key={muscle} testID={`muscle-region-${view}-${muscle}-${level}`}>
            {shapePaths(shape).map((d, i) => (
              <Path
                key={i}
                d={d}
                fill={fillFor(level, palette)}
                stroke={palette.line}
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            ))}
          </G>
        );
      })}
      <G>
        {shapePaths(MUSCLE_MAP_DETAILS[view]).map((d, i) => (
          <Path
            key={`detail-${i}`}
            d={d}
            fill="none"
            stroke={palette.line}
            strokeWidth={1}
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}

function Swatch({ level }: { level: 'primary' | 'secondary' }) {
  const palette = usePalette();
  const theme = useThemeColors();
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: fillFor(level, palette), borderColor: theme.textMuted },
      ]}
    />
  );
}

/** Große Muskelkarte mit beiden Ansichten und Legende (Übungsdetail, Dialog im Training). */
export function MuscleMap({
  highlights,
  testID = 'muscle-map',
  figureHeight = 260,
}: {
  highlights: MuscleMapHighlights;
  testID?: string;
  figureHeight?: number;
}) {
  const theme = useThemeColors();
  const legend = muscleMapLegend(highlights);
  return (
    <View style={styles.map} testID={testID}>
      <View
        style={styles.figures}
        accessible
        accessibilityRole="image"
        accessibilityLabel={muscleMapA11yLabel(highlights)}
        testID={`${testID}-image`}
      >
        {MUSCLE_MAP_VIEWS.map((view) => (
          <View key={view} style={styles.figure}>
            <MuscleFigure view={view} highlights={highlights} height={figureHeight} />
            <Text style={[styles.caption, { color: theme.textMuted }]} aria-hidden>
              {view === 'front' ? t.muscleMap.front : t.muscleMap.back}
            </Text>
          </View>
        ))}
      </View>
      {legend.length > 0 ? (
        <View style={styles.legend} testID={`${testID}-legend`}>
          {legend.map((line) => (
            <View key={line.level} style={styles.legendLine}>
              <Swatch level={line.level} />
              <Body style={styles.legendText}>{line.text}</Body>
            </View>
          ))}
        </View>
      ) : (
        <Body muted>{t.muscleMap.a11yNone}</Body>
      )}
      <Body muted style={styles.note}>
        {t.muscleMap.note}
      </Body>
    </View>
  );
}

/**
 * Kleine Muskelkarte (Trainingsmodus, neben dem Übungsnamen): beide Ansichten verkleinert, antippbar → Dialog mit der
 * großen Karte und Legende. Tippfläche mindestens 48 px.
 */
export function MuscleMapThumbnail({
  highlights,
  exerciseName,
  testID,
}: {
  highlights: MuscleMapHighlights;
  exerciseName: string;
  testID: string;
}) {
  const theme = useThemeColors();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    // Fokus zurück auf die kleine Karte (Browser).
    setTimeout(() => focusTestId(testID), 50);
  };
  const titleRef = useRef<View>(null);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => focusView(titleRef.current), 50);
    return () => clearTimeout(id);
  }, [open]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.muscleMap.openLarge} ${muscleMapA11yLabel(highlights)}`}
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [
          styles.thumb,
          { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {MUSCLE_MAP_VIEWS.map((view) => (
          <MuscleFigure key={view} view={view} highlights={highlights} height={64} />
        ))}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View
            accessibilityViewIsModal
            testID={`${testID}-dialog`}
            style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <View ref={titleRef} tabIndex={-1}>
                <Heading level={2}>{t.muscleMap.dialogTitle(exerciseName)}</Heading>
              </View>
              <MuscleMap highlights={highlights} testID={`${testID}-large`} figureHeight={240} />
              <Button
                label={t.muscleMap.close}
                variant="secondary"
                onPress={close}
                testID={`${testID}-close`}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

/**
 * Bild „Ausgangsposition“ (Gründer-Entscheidung B: eigene Illustrationen, data/exercise-media.ts). SVG-Vorlagen werden
 * mit den Farben des aktuellen Modus (hell/dunkel) gezeichnet – gleich auf Web und Handy, ohne externe Aufrufe.
 * Ohne Bild zeigt die Übung nichts an. Unter dem Bild steht die Herkunft.
 */
export function StartPositionImage({ exerciseId }: { exerciseId: string }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const found = exerciseMediaFor(exerciseId, 'start_position');
  if (!found) return null;
  const { image, source } = found;
  const credit =
    image.license.attribution_de ??
    (image.origin === 'own_work'
      ? t.muscleMap.ownIllustration
      : t.muscleMap.imageCredit(image.source.creator, image.license.name));
  return (
    <Card>
      <View style={styles.map} testID="exercise-start-position">
        <Heading level={2}>{t.muscleMap.startPositionTitle}</Heading>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={image.alt_de}
          style={styles.startImage}
          testID="exercise-start-position-image"
        >
          {source.kind === 'svg' ? (
            <SvgXml
              xml={illustrationXml(source.template, scheme)}
              width="100%"
              height="100%"
              accessible={false}
              aria-hidden
            />
          ) : (
            <Image source={source.source} resizeMode="contain" style={styles.fill} />
          )}
        </View>
        <Body muted style={styles.note}>
          {credit}
        </Body>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  map: { gap: spacing.sm },
  figures: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  figure: { alignItems: 'center', gap: spacing.xs },
  caption: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  legend: { gap: spacing.xs },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { flex: 1 },
  swatch: { width: 18, height: 18, borderRadius: radius.sm, borderWidth: 1 },
  note: { fontSize: fontSize.sm },
  thumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dialogContent: { padding: spacing.lg, gap: spacing.md },
  startImage: { width: '100%', maxWidth: 400, aspectRatio: 4 / 3, alignSelf: 'center' },
  fill: { width: '100%', height: '100%' },
});
