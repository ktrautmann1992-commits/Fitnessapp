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
import {
  STORY_BADGE,
  STORY_H,
  STORY_LINE,
  STORY_W,
  type StoryLayout,
  storyLayout,
  type StoryText,
  type StoryTheme,
} from '@/lib/story-layout';

/**
 * Story-Bild als Ansicht (Etappe E6): Vorschau und Vorlage für die Aufnahme (react-native-view-shot, 1080 × 1920).
 * Inhalt = Positivliste aus packages/core, Aufbau = storyLayout (gleich wie das Canvas im Browser). Ebenen wie im
 * Canvas: Hintergrund (SVG) → riesige Zahl → Logo/Strecke/Kacheln (SVG) → Texte.
 */
export const StoryCardView = forwardRef<
  View,
  { card: StoryCard; width: number; theme?: StoryTheme }
>(function StoryCardView({ card, width, theme = 'neon' }, ref) {
  const scale = width / STORY_W;
  const height = STORY_H * scale;
  const layout = storyLayout(card, theme);
  const P = layout.palette;
  const box = layout.lineBox;
  const logo = `translate(${layout.logo.x} ${layout.logo.y}) scale(${layout.logo.width / 1133})`;
  const viewBox = `0 0 ${STORY_W} ${STORY_H}`;
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={t.endurance.story.previewA11y}
      testID="story-card"
      style={[styles.card, { width, height, backgroundColor: P.bg[0] }]}
    >
      <Svg width={width} height={height} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient
            id={`story-bg-${theme}`}
            x1="0"
            y1="0"
            x2="0"
            y2={STORY_H}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={P.bg[0]} />
            <Stop offset="1" stopColor={P.bg[1]} />
          </LinearGradient>
          {layout.glows.map((g, i) => (
            <RadialGradient
              key={i}
              id={`story-glow-${theme}-${i}`}
              cx={g.x}
              cy={g.y}
              r={g.r}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill={`url(#story-bg-${theme})`} />
        {layout.glows.map((_, i) => (
          <Rect
            key={i}
            x={0}
            y={0}
            width={STORY_W}
            height={STORY_H}
            fill={`url(#story-glow-${theme}-${i})`}
          />
        ))}
        {P.decorWidth > 0
          ? layout.decor.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={P.decor}
                strokeOpacity={P.decorOpacity}
                strokeWidth={P.decorWidth}
                fill="none"
              />
            ))
          : null}
      </Svg>
      <StoryTexts layout={layout} layer="back" scale={scale} />
      <Svg width={width} height={height} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient
            id={`story-line-${theme}`}
            x1={box.x}
            y1={box.y}
            x2={box.x + box.width}
            y2={box.y + box.height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={P.lineFrom} />
            <Stop offset="1" stopColor={P.lineTo} />
          </LinearGradient>
          <RadialGradient
            id={`story-badge-${theme}`}
            cx={layout.badge.x + layout.badge.width / 2}
            cy={layout.badge.y + layout.badge.height / 2}
            r={layout.badge.width * 0.7}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={STORY_BADGE.inner} />
            <Stop offset="1" stopColor={STORY_BADGE.outer} />
          </RadialGradient>
        </Defs>
        <Rect
          x={layout.badge.x}
          y={layout.badge.y}
          width={layout.badge.width}
          height={layout.badge.height}
          rx={layout.badge.radius}
          fill={`url(#story-badge-${theme})`}
        />
        <Path transform={logo} fill={STORY_BADGE.logo} d={MARK_ALPHA} />
        <Path transform={logo} fill={STORY_BADGE.logo} d={MARK_FIVE} />
        {layout.linePath ? (
          <>
            {STORY_LINE.glow.map((halo) => (
              <Path
                key={halo.width}
                d={layout.linePath}
                stroke={P.lineGlow}
                strokeOpacity={halo.opacity}
                strokeWidth={halo.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <Path
              d={layout.linePath}
              stroke={`url(#story-line-${theme})`}
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
                fill={P.start}
                stroke={P.startRing}
                strokeWidth={8}
              />
            ) : null}
            {layout.lineEnd ? (
              <Circle cx={layout.lineEnd.x} cy={layout.lineEnd.y} r={24} fill={P.end} />
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
            fill={P.tile}
            fillOpacity={P.tileOpacity}
            stroke={P.tileBorder}
            strokeOpacity={P.tileBorderOpacity}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <StoryTexts layout={layout} layer="front" scale={scale} />
    </View>
  );
});

function StoryTexts({
  layout,
  layer,
  scale,
}: {
  layout: StoryLayout;
  layer: StoryText['layer'];
  scale: number;
}) {
  return (
    <>
      {layout.texts.map((item, i) => {
        if (item.layer !== layer) return null;
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
                color: layout.palette[item.tone],
                maxWidth: item.maxWidth * scale,
                textTransform: item.upper ? 'uppercase' : 'none',
              },
            ]}
          >
            {item.text}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: brandColors.schwarz, overflow: 'hidden', borderRadius: 8 },
  text: { position: 'absolute' },
});
