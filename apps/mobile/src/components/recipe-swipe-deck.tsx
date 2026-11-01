import type { RecipeSwipeCard, RecipeSwipeChoice } from '@fitnessapp/core';
import { brandColors, colors, fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  Image,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { MIN_TOUCH } from '@/components/ui';
import { recipeImageFor } from '@/data/recipe-media';
import { t } from '@/i18n';
import { formatGrams, formatKcal } from '@/lib/nutrition-format';
import { SWIPE_THRESHOLD, swipeChoice } from '@/lib/recipe-swipe-gesture';
import { useThemeColors } from '@/lib/theme';

/**
 * Kartenstapel im Stil von Rezept-Spielkarten (Gründer-Wunsch 01.11.2026): vorne die große Karte mit Foto und blauem
 * Balken (Name + Nährwerte je Portion), dahinter bis zu drei Karten – versetzt, kleiner und leicht gedreht
 * (Perspektive, 3D-Eindruck). Reine Bedienung, keine Fachlogik: welche Karten, was eine Entscheidung bewirkt, steht in
 * packages/core (`recipeSwipeStack`, `recipeSwipePreferenceKind`).
 *
 * Gesten: rechts = mag ich, links = mag ich nicht, oben = neutral (PanResponder + Animated – funktioniert gleich mit
 * Finger, Maus und im Web-Export). Ohne Wischen: drei Knöpfe, Pfeiltasten (Web) und Bildschirmleser-Aktionen.
 */

/** Hinter der vorderen Karte sichtbar. */
const BACK_CARDS = 3;
const FLY_MS = 220;
/** Feste Farben (helle Palette) – Stempel und Knöpfe liegen immer auf weißer Fläche bzw. Kartenrand. */
const LIKE_COLOR = colors.light.success;
const DISLIKE_COLOR = colors.light.danger;

interface SwipeLatest {
  front: RecipeSwipeCard | undefined;
  onDecide: (card: RecipeSwipeCard, choice: RecipeSwipeChoice) => void;
  disabled: boolean;
  windowWidth: number;
  cardWidth: number;
  cardHeight: number;
}

/**
 * Gesten-Steuerung (außerhalb von React): Flug-Animation, PanResponder, Sperre während des Flugs. Die Komponente
 * reicht nur die neuesten Werte herein (`update`) und setzt bei neuer Karte zurück (`reset`).
 */
function createSwipeControl(pan: Animated.ValueXY, opacity: Animated.Value) {
  let busy = false;
  let latest: SwipeLatest | null = null;

  const flyOut = (choice: RecipeSwipeChoice) => {
    const now = latest;
    const card = now?.front;
    if (now === null || card === undefined || busy || now.disabled) return;
    busy = true;
    const to =
      choice === 'like'
        ? { x: now.windowWidth + now.cardWidth, y: 40 }
        : choice === 'dislike'
          ? { x: -(now.windowWidth + now.cardWidth), y: 40 }
          : { x: 0, y: -(now.cardHeight * 2) };
    // Abschluss genau einmal: nach der Animation oder spätestens per Zeitgeber (falls die Animation nicht fertig
    // meldet, z. B. bei angehaltener Uhr im Browser-Test oder im Hintergrund).
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      opacity.setValue(0);
      (latest ?? now).onDecide(card, choice);
    };
    Animated.timing(pan, { toValue: to, duration: FLY_MS, useNativeDriver: false }).start(finish);
    setTimeout(finish, FLY_MS + 80);
  };

  const springBack = () =>
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
      !busy && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => pan.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_e, g) => {
      const choice = swipeChoice(g.dx, g.dy);
      if (choice !== null) flyOut(choice);
      else springBack();
    },
    onPanResponderTerminate: springBack,
  });

  return {
    responder,
    flyOut,
    update(next: SwipeLatest) {
      latest = next;
    },
    reset() {
      pan.setValue({ x: 0, y: 0 });
      opacity.setValue(1);
      busy = false;
    },
  };
}

export interface RecipeSwipeDeckProps {
  cards: readonly RecipeSwipeCard[];
  /** Index der vorderen Karte. */
  index: number;
  showNumbers: boolean;
  /** Entscheidung für die vordere Karte (nach der Flug-Animation). */
  onDecide: (card: RecipeSwipeCard, choice: RecipeSwipeChoice) => void;
  disabled?: boolean;
}

export function RecipeSwipeDeck({
  cards,
  index,
  showNumbers,
  onDecide,
  disabled = false,
}: RecipeSwipeDeckProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(Math.max(windowWidth - 2 * spacing.lg - 16, 240), 360);
  const cardHeight = Math.round(cardWidth * 1.22);
  // Animationswerte einmal je Stapel (useState statt Ref: im Render lesbar).
  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [opacity] = useState(() => new Animated.Value(1));
  const front = cards[index];
  const texts = t.recipeSwipe;
  // Gesten-Steuerung einmal je Stapel; sie hält „läuft gerade“ und die neuesten Werte selbst (kein Ref im Render).
  const [control] = useState(() => createSwipeControl(pan, opacity));

  // Neueste Werte für Gesten-Rückrufe (PanResponder und Tasten werden nicht je Render neu angelegt).
  useLayoutEffect(() => {
    control.update({ front, onDecide, disabled, windowWidth, cardWidth, cardHeight });
  }, [control, front, onDecide, disabled, windowWidth, cardWidth, cardHeight]);

  // Neue vordere Karte: Lage zurücksetzen (erst JETZT, damit die alte Karte nie kurz in die Mitte springt).
  useEffect(() => {
    control.reset();
  }, [control, front?.recipeId]);

  // Pfeiltasten im Browser (nicht in Eingabefeldern).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const choice: RecipeSwipeChoice | null =
        event.key === 'ArrowRight'
          ? 'like'
          : event.key === 'ArrowLeft'
            ? 'dislike'
            : event.key === 'ArrowUp'
              ? 'neutral'
              : null;
      if (choice === null) return;
      event.preventDefault();
      control.flyOut(choice);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [control]);

  if (front === undefined) return null;
  const flyOut = (choice: RecipeSwipeChoice) => control.flyOut(choice);
  const responder = control.responder;

  // Wie weit die vordere Karte schon weg ist (0–1) – die Karten dahinter rücken entsprechend nach.
  const advance = Animated.add(
    pan.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      outputRange: [1, 0, 1],
      extrapolate: 'clamp',
    }),
    pan.y.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  ).interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1], extrapolate: 'clamp' });

  const back = cards.slice(index + 1, index + 1 + BACK_CARDS);
  const total = cards.length;
  const details = cardDetails(front, showNumbers);

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.deck, { width: cardWidth, height: cardHeight + BACK_CARDS * 26 }]}
        testID="recipe-swipe-deck"
      >
        {/* Hintere Karten zuerst (unten), tiefste zuerst. */}
        {back
          .map((card, i) => ({ card, depth: i + 1 }))
          .reverse()
          .map(({ card, depth }) => {
            const tilt = depth % 2 === 1 ? -1 : 1;
            const lift = (d: number) => d * 26;
            const scale = (d: number) => 1 - d * 0.05;
            const rotZ = (d: number) => tilt * d * 3.2;
            const shift = (d: number) => tilt * d * 7;
            return (
              <Animated.View
                key={card.recipeId}
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID={`recipe-swipe-back-${depth}`}
                style={[
                  styles.card,
                  styles.backCard,
                  {
                    width: cardWidth,
                    height: cardHeight,
                    zIndex: BACK_CARDS - depth,
                    transform: [
                      { perspective: 900 },
                      {
                        translateX: advance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [shift(depth), shift(depth - 1)],
                        }),
                      },
                      {
                        translateY: advance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [lift(depth), lift(depth - 1)],
                        }),
                      },
                      {
                        scale: advance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [scale(depth), scale(depth - 1)],
                        }),
                      },
                      {
                        rotateZ: advance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [`${rotZ(depth)}deg`, `${rotZ(depth - 1)}deg`],
                        }),
                      },
                      { rotateX: `${depth * 3}deg` },
                    ],
                  },
                ]}
              >
                <CardFace card={card} showNumbers={showNumbers} />
                {/* Karten weiter hinten etwas dunkler (Tiefe), ohne durchzuscheinen. */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shade,
                    {
                      opacity: advance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [depth * 0.12, (depth - 1) * 0.12],
                      }),
                    },
                  ]}
                />
              </Animated.View>
            );
          })}

        <Animated.View
          {...responder.panHandlers}
          accessible
          accessibilityLabel={texts.cardA11y(front.titleDe, details, index + 1, total)}
          accessibilityHint={texts.cardHint}
          accessibilityActions={[
            { name: 'like', label: texts.like },
            { name: 'dislike', label: texts.dislike },
            { name: 'neutral', label: texts.neutral },
          ]}
          onAccessibilityAction={(event) => {
            const name = event.nativeEvent.actionName;
            if (name === 'like') flyOut('like');
            else if (name === 'dislike') flyOut('dislike');
            else if (name === 'neutral') flyOut('neutral');
          }}
          testID="recipe-swipe-card"
          style={[
            styles.card,
            styles.frontCard,
            {
              width: cardWidth,
              height: cardHeight,
              zIndex: BACK_CARDS + 1,
              opacity,
              transform: [
                { perspective: 900 },
                { translateX: pan.x },
                { translateY: pan.y },
                {
                  rotateZ: pan.x.interpolate({
                    inputRange: [-cardWidth, 0, cardWidth],
                    outputRange: ['-14deg', '0deg', '14deg'],
                  }),
                },
                {
                  rotateY: pan.x.interpolate({
                    inputRange: [-cardWidth, 0, cardWidth],
                    outputRange: ['10deg', '0deg', '-10deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <CardFace card={front} showNumbers={showNumbers} />
          <Stamp
            label={texts.stampLike}
            color={LIKE_COLOR}
            side="left"
            opacity={pan.x.interpolate({
              inputRange: [0, SWIPE_THRESHOLD],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            })}
            testID="recipe-swipe-stamp-like"
          />
          <Stamp
            label={texts.stampDislike}
            color={DISLIKE_COLOR}
            side="right"
            opacity={pan.x.interpolate({
              inputRange: [-SWIPE_THRESHOLD, 0],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            })}
            testID="recipe-swipe-stamp-dislike"
          />
          <Stamp
            label={texts.stampNeutral}
            color={brandColors.grau}
            side="center"
            opacity={pan.y.interpolate({
              inputRange: [-SWIPE_THRESHOLD, 0],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            })}
            testID="recipe-swipe-stamp-neutral"
          />
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <RoundButton
          glyph="✕"
          label={texts.dislike}
          a11y={texts.dislikeA11y(front.titleDe)}
          color={DISLIKE_COLOR}
          onPress={() => flyOut('dislike')}
          disabled={disabled}
          testID="recipe-swipe-dislike"
        />
        <RoundButton
          glyph="–"
          label={texts.neutral}
          a11y={texts.neutralA11y(front.titleDe)}
          color={brandColors.grau}
          small
          onPress={() => flyOut('neutral')}
          disabled={disabled}
          testID="recipe-swipe-neutral"
        />
        <RoundButton
          glyph="♥"
          label={texts.like}
          a11y={texts.likeA11y(front.titleDe)}
          color={LIKE_COLOR}
          onPress={() => flyOut('like')}
          disabled={disabled}
          testID="recipe-swipe-like"
        />
      </View>
    </View>
  );
}

function nutrientParts(card: RecipeSwipeCard) {
  const n = card.perServing;
  if (n === null) return null;
  return [
    formatKcal(n.kcal),
    formatGrams(n.protein_g),
    formatGrams(n.carbs_g),
    formatGrams(n.fat_g),
  ] as const;
}

function cardDetails(card: RecipeSwipeCard, showNumbers: boolean): string {
  const parts = nutrientParts(card);
  const type = card.mealTypes.map((m) => t.recipeSwipe.mealTypes[m]).join(', ');
  const base = `${type}, ${t.recipeSwipe.minutes(card.totalMinutes)}.`;
  return showNumbers && parts !== null ? `${base} ${t.recipeSwipe.nutrientsA11y(...parts)}` : base;
}

/** Vorderseite einer Karte: Foto (oder Rezept-Symbol), darunter der blaue Balken mit Name und Nährwerten. */
function CardFace({ card, showNumbers }: { card: RecipeSwipeCard; showNumbers: boolean }) {
  const image = recipeImageFor(card.recipeId);
  const palette = useAreaColors('ernaehrung');
  const parts = nutrientParts(card);
  const texts = t.recipeSwipe;
  return (
    <View style={styles.face}>
      <View style={[styles.photo, { backgroundColor: palette.surface }]}>
        {image ? (
          <Image
            source={image.banner}
            resizeMode="cover"
            style={styles.photoImage}
            accessible={false}
            testID={`recipe-swipe-image-${card.recipeId}`}
          />
        ) : (
          <Icon name="recipe" size={72} color={palette.icon} />
        )}
        <View style={styles.chips}>
          <Text style={styles.chip}>
            {card.mealTypes.map((m) => texts.mealTypes[m]).join(' · ')}
          </Text>
          <Text style={styles.chip}>{texts.minutes(card.totalMinutes)}</Text>
        </View>
        {image?.ai_notice_de ? <Text style={styles.aiNotice}>{image.ai_notice_de}</Text> : null}
      </View>
      <View style={styles.bar} testID={`recipe-swipe-bar-${card.recipeId}`}>
        <Text style={styles.barTitle} numberOfLines={2}>
          {card.titleDe}
        </Text>
        {showNumbers && parts !== null ? (
          <>
            <Text style={styles.barNumbers} numberOfLines={1}>
              {texts.nutrients(...parts)}
            </Text>
            <Text style={styles.barSmall}>{texts.perServing}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function Stamp({
  label,
  color,
  side,
  opacity,
  testID,
}: {
  label: string;
  color: string;
  side: 'left' | 'right' | 'center';
  opacity: Animated.AnimatedInterpolation<number>;
  testID: string;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      testID={testID}
      style={[
        styles.stamp,
        { borderColor: color, opacity },
        side === 'left'
          ? { left: 18, transform: [{ rotate: '-14deg' }] }
          : side === 'right'
            ? { right: 18, transform: [{ rotate: '14deg' }] }
            : { alignSelf: 'center', top: '38%' },
      ]}
    >
      <Text style={[styles.stampText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

function RoundButton({
  glyph,
  label,
  a11y,
  color,
  small = false,
  onPress,
  disabled,
  testID,
}: {
  glyph: string;
  label: string;
  a11y: string;
  color: string;
  small?: boolean;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  const theme = useThemeColors();
  const size = small ? 56 : 68;
  return (
    <View style={styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.round,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            backgroundColor: theme.surface,
            opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Text style={[styles.glyph, { color, fontSize: small ? 26 : 32 }]}>{glyph}</Text>
      </Pressable>
      <Text style={[styles.roundLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  deck: { position: 'relative', alignItems: 'center' },
  card: {
    position: 'absolute',
    top: 0,
    borderRadius: 22,
    backgroundColor: brandColors.weiss,
    borderWidth: 3,
    borderColor: brandColors.weiss,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  backCard: { shadowOpacity: 0.12, elevation: 4 },
  // Web: Wischen statt Seiten-Scrollen auf der Karte (Touch im Handy-Browser).
  frontCard: { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object,
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 19,
    backgroundColor: brandColors.schwarz,
  },
  face: { flex: 1, borderRadius: 19, overflow: 'hidden' },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  chips: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,12,16,0.62)',
    color: brandColors.weiss,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  aiNotice: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: brandColors.weiss,
    fontSize: 11,
    lineHeight: 14,
  },
  bar: {
    backgroundColor: brandColors.blau,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
    borderTopWidth: 3,
    borderTopColor: brandColors.blauDunkel,
  },
  barTitle: {
    color: brandColors.weiss,
    fontSize: fontSize.lg,
    lineHeight: 25,
    fontWeight: fontWeight.bold,
  },
  barNumbers: { color: brandColors.weiss, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  barSmall: { color: brandColors.eisblau, fontSize: fontSize.xs },
  stamp: {
    position: 'absolute',
    top: 28,
    borderWidth: 4,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  stampText: { fontSize: 26, fontWeight: fontWeight.bold, letterSpacing: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  roundWrap: { alignItems: 'center', gap: 4, minWidth: MIN_TOUCH + 24 },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  glyph: { fontWeight: fontWeight.bold, lineHeight: 36 },
  roundLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
