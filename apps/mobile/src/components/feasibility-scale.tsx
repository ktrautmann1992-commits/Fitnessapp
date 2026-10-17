import type { WeightGoalZone } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';
import type { FeasibilityView } from '@/lib/weight-goal-format';

import { Body, Button } from './ui';

/**
 * Erreichbarkeits-Ampel für das konkrete Abnehmziel (docs/PLAN-ZIELE.md 3.1 und 3.4, Etappe Z4). Nur Anzeige: Stufe,
 * Texte und Zeigerposition kommen aus packages/core (`weightGoalFeasibility`) über `feasibilityView`.
 *
 * - Balken mit Verlauf von Rot (links, „zu schnell“) nach Grün (rechts, „ruhig“), Zeiger in der Zone der Stufe.
 * - Nie nur Farbe: Stufentitel als Text, eigenes Zeichen je Stufe (Haken, Ausrufezeichen, doppeltes Ausrufezeichen,
 *   Stopp-Achteck), Beschriftung unter dem Balken, Zeiger mit Rahmen in Textfarbe (≥ 3 : 1, WCAG 1.4.11).
 * - Screenreader: ganzer Satz; im Web `role="meter"` mit `aria-valuemin/max/now/text` (Wächter K8). Angesagt wird nur
 *   bei Stufenwechsel (Android/Web: Live-Region „polite“, iOS: announceForAccessibility), entprellt 150 ms.
 * - „Bewegung reduzieren“: keine Animation des Zeigers.
 * - Keine kcal, Prozent nur mit „etwa“ in der Detailzeile. Keine Werte in Logs oder Analytics (Wächter K7).
 */

const S = t.steps.weightGoal.scale;
const ANNOUNCE_DEBOUNCE_MS = 150;
const POINTER_ANIMATION_MS = 250;
const BAR_HEIGHT = 16;
const POINTER_WIDTH = 14;

function useZoneColors(): Record<WeightGoalZone, string> {
  const theme = useThemeColors();
  return { red: theme.danger, orange: theme.warning, yellow: theme.caution, green: theme.success };
}

/** Zeichen je Stufe (zusätzlich zur Farbe); dekorativ – der Titel sagt dasselbe in Worten. */
function LevelSymbol({ zone }: { zone: WeightGoalZone }) {
  const colors = useZoneColors();
  const theme = useThemeColors();
  const size = 28;
  const glyph = zone === 'green' ? '✓' : zone === 'yellow' ? '!' : zone === 'orange' ? '!!' : '✕';
  // Stopp-Achteck bei Rot, sonst ein Kreis (Rechteck mit voller Rundung).
  const octagon = '8.2,1 19.8,1 27,8.2 27,19.8 19.8,27 8.2,27 1,19.8 1,8.2';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      testID={`feasibility-symbol-${zone}`}
    >
      <Svg width={size} height={size} viewBox="0 0 28 28">
        {zone === 'red' ? (
          <Polygon points={octagon} fill={colors.red} stroke={theme.text} strokeWidth={1} />
        ) : (
          <Rect
            x={1}
            y={1}
            width={26}
            height={26}
            rx={13}
            fill={colors[zone]}
            stroke={theme.text}
            strokeWidth={1}
          />
        )}
        <SvgText
          x={14}
          y={19}
          fontSize={zone === 'orange' ? 13 : 15}
          fontWeight="bold"
          textAnchor="middle"
          // Zeichen in Schwarz bzw. Weiß je nach Fläche (Gelb/Grün hell → Schwarz).
          fill={zone === 'red' ? '#FFFFFF' : '#0A0C10'}
        >
          {glyph}
        </SvgText>
      </Svg>
    </View>
  );
}

export function FeasibilityScale({
  view,
  pendingText,
  onApply,
}: {
  /** null = noch keine Bewertung (Teil-Eingabe oder ungültige Eingabe). */
  view: FeasibilityView | null;
  pendingText: string;
  /** Knopf „Zeitraum auf N Wochen setzen“. */
  onApply: (weeks: number) => void;
}) {
  const theme = useThemeColors();
  const colors = useZoneColors();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(view ? view.percent / 100 : 0);
  const target = view ? view.percent / 100 : null;

  useEffect(() => {
    if (target === null) return;
    position.set(reducedMotion ? target : withTiming(target, { duration: POINTER_ANIMATION_MS }));
  }, [position, reducedMotion, target]);

  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * trackWidth - POINTER_WIDTH / 2 }],
  }));

  // Ansage nur bei Stufenwechsel (entprellt). Web/Android über die Live-Region, iOS über announceForAccessibility.
  const [announcement, setAnnouncement] = useState('');
  const lastLevel = useRef<string | null>(null);
  const level = view?.level ?? null;
  const sentence = view?.a11y ?? '';
  useEffect(() => {
    if (level === null || level === lastLevel.current) return;
    const timer = setTimeout(() => {
      lastLevel.current = level;
      setAnnouncement(sentence);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(sentence);
    }, ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [level, sentence]);

  return (
    <View
      style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="feasibility-scale"
    >
      <Text style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
        {S.title}
      </Text>
      <View
        accessible
        role="meter"
        aria-label={S.meterLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view ? view.percent : undefined}
        aria-valuetext={view ? view.a11y : pendingText}
        accessibilityLabel={view ? view.a11y : `${S.meterLabel}: ${pendingText}`}
        accessibilityValue={
          view ? { min: 0, max: 100, now: view.percent, text: view.zoneWord } : undefined
        }
        testID="feasibility-meter"
        style={styles.meter}
      >
        <View
          style={styles.track}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width="100%" height={BAR_HEIGHT}>
            <Defs>
              <LinearGradient id="feasibility-gradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.red} />
                <Stop offset="0.2" stopColor={colors.red} />
                <Stop offset="0.3" stopColor={colors.orange} />
                <Stop offset="0.5" stopColor={colors.yellow} />
                <Stop offset="0.7" stopColor={colors.green} />
                <Stop offset="1" stopColor={colors.green} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width="100%"
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill="url(#feasibility-gradient)"
              opacity={view ? 1 : 0.35}
            />
          </Svg>
          {view && trackWidth > 0 ? (
            <Animated.View
              testID="feasibility-pointer"
              style={[
                styles.pointer,
                { backgroundColor: theme.surface, borderColor: theme.text },
                pointerStyle,
              ]}
            />
          ) : null}
        </View>
        <View
          style={styles.labels}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          {/* Breite wie die Zonen: Rot, Orange, Gelb je 20 %, Grün 40 % (Plan 3.1). */}
          {S.labels.map((label, index) => (
            <Text
              key={label}
              style={[styles.label, { color: theme.textMuted, flex: index === 3 ? 2 : 1 }]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      {view ? (
        <View style={styles.result}>
          <View style={styles.titleRow}>
            <LevelSymbol zone={view.zone} />
            <Text
              style={[styles.title, { color: theme.text }]}
              testID={`feasibility-level-${view.level}`}
            >
              {view.title}
            </Text>
          </View>
          <Body testID="feasibility-text">{view.text}</Body>
          <Body muted testID="feasibility-detail">
            {view.detail}
          </Body>
          {view.applyWeeks !== null ? (
            <Button
              label={S.apply(view.applyWeeks)}
              variant="secondary"
              onPress={() => onApply(view.applyWeeks as number)}
              testID="feasibility-apply"
            />
          ) : null}
          <Body muted>{S.about}</Body>
        </View>
      ) : (
        <Body muted testID="feasibility-pending">
          {pendingText}
        </Body>
      )}

      {/* Dauerhafte, unsichtbare Live-Region: neu eingefügte Regionen lesen Bildschirmleser oft nicht vor. */}
      <Text
        accessibilityLiveRegion="polite"
        aria-live="polite"
        aria-atomic
        style={styles.visuallyHidden}
        testID="feasibility-announcer"
      >
        {announcement}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meter: { gap: spacing.xs, paddingVertical: spacing.xs },
  track: { height: BAR_HEIGHT + 12, justifyContent: 'center' },
  pointer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: POINTER_WIDTH,
    height: BAR_HEIGHT + 12,
    borderRadius: radius.sm,
    borderWidth: 3,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: fontSize.sm - 2, textAlign: 'center' },
  result: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1, lineHeight: 26 },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
