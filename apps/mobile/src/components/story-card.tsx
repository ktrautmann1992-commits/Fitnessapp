import type { StoryCard } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { MARK_ALPHA, MARK_FIVE } from '@/components/brand';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import { STORY_COLORS, STORY_H, STORY_LINE, STORY_W, storyLayout } from '@/lib/story-layout';

const C = STORY_COLORS;

/**
 * Story-Bild als Ansicht (Etappe E6): Vorschau und Vorlage für die Aufnahme (react-native-view-shot, 1080 × 1920).
 * Inhalt = Positivliste aus packages/core, Aufbau = storyLayout (gleich wie das Canvas im Browser).
 */
export const StoryCardView = forwardRef<View, { card: StoryCard; width: number }>(
  function StoryCardView({ card, width }, ref) {
    const scale = width / STORY_W;
    const layout = storyLayout(card);
    const box = layout.lineBox;
    const logo = `translate(${layout.logo.x} ${layout.logo.y}) scale(${layout.logo.width / 1133})`;
    return (
      <View
        ref={ref}
        collapsable={false}
        accessible
        accessibilityLabel={t.endurance.story.previewA11y}
        testID="story-card"
        style={[styles.card, { width, height: STORY_H * scale }]}
      >
        <Svg width={width} height={STORY_H * scale} viewBox={`0 0 ${STORY_W} ${STORY_H}`}>
          <Defs>
            <LinearGradient
              id="story-bg"
              x1="0"
              y1="0"
              x2="0"
              y2={STORY_H}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={C.bgTop} />
              <Stop offset="1" stopColor={C.bgBottom} />
            </LinearGradient>
            <RadialGradient
              id="story-glow"
              cx={layout.glow.x}
              cy={layout.glow.y}
              r={layout.glow.r}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={C.glow} stopOpacity={0.38} />
              <Stop offset="1" stopColor={C.glow} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient
              id="story-line"
              x1={box.x}
              y1={box.y}
              x2={box.x + box.width}
              y2={box.y + box.height}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={C.lineFrom} />
              <Stop offset="1" stopColor={C.lineTo} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill="url(#story-bg)" />
          <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill="url(#story-glow)" />
          {layout.rings.radii.map((r) => (
            <Circle
              key={r}
              cx={layout.rings.x}
              cy={layout.rings.y}
              r={r}
              stroke={C.ring}
              strokeOpacity={0.07}
              strokeWidth={3}
              fill="none"
            />
          ))}
          <Path transform={logo} fill={brandColors.blau} d={MARK_ALPHA} />
          <Path transform={logo} fill={brandColors.blau} d={MARK_FIVE} />
          {layout.linePath ? (
            <>
              {STORY_LINE.glow.map((halo) => (
                <Path
                  key={halo.width}
                  d={layout.linePath}
                  stroke={C.lineTo}
                  strokeOpacity={halo.opacity}
                  strokeWidth={halo.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              <Path
                d={layout.linePath}
                stroke="url(#story-line)"
                strokeWidth={STORY_LINE.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {layout.lineStart ? (
                <Circle
                  cx={layout.lineStart.x}
                  cy={layout.lineStart.y}
                  r={20}
                  fill={C.start}
                  stroke={C.lineTo}
                  strokeWidth={8}
                />
              ) : null}
              {layout.lineEnd ? (
                <Circle cx={layout.lineEnd.x} cy={layout.lineEnd.y} r={24} fill={C.end} />
              ) : null}
            </>
          ) : null}
          {layout.tiles.map((tile) => (
            <Rect
              key={`${tile.x}-${tile.y}`}
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              rx={tile.radius}
              fill={C.tile}
              fillOpacity={0.82}
              stroke={C.tileBorder}
              strokeWidth={2}
            />
          ))}
        </Svg>
        {layout.texts.map((item, i) => {
          const pos =
            item.align === 'right'
              ? { right: (STORY_W - item.x) * scale, textAlign: 'right' as const }
              : { left: item.x * scale };
          return (
            <Text
              key={`${i}-${item.text}`}
              numberOfLines={1}
              style={[
                styles.text,
                pos,
                {
                  // y = Grundlinie im Canvas → Oberkante ungefähr y − 0,85 × Schriftgröße.
                  top: (item.y - item.size * 0.85) * scale,
                  fontSize: item.size * scale,
                  lineHeight: item.size * 1.15 * scale,
                  fontWeight: item.bold ? '700' : '400',
                  color: C[item.tone],
                  maxWidth: item.maxWidth * scale,
                  textTransform: item.upper ? 'uppercase' : 'none',
                },
              ]}
            >
              {item.text}
            </Text>
          );
        })}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { backgroundColor: brandColors.schwarz, overflow: 'hidden', borderRadius: 8 },
  text: { position: 'absolute' },
});
