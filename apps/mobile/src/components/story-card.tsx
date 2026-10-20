import type { StoryCard } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { MARK_ALPHA, MARK_FIVE } from '@/components/brand';
import { t } from '@/i18n';
import { STORY_H, STORY_W, storyLayout } from '@/lib/story-layout';

/**
 * Story-Bild als Ansicht (Etappe E6): Vorschau und Vorlage für die Aufnahme (react-native-view-shot, 1080 × 1920).
 * Inhalt = Positivliste aus packages/core, Aufbau = storyLayout (gleich wie das Canvas im Browser).
 */
export const StoryCardView = forwardRef<View, { card: StoryCard; width: number }>(
  function StoryCardView({ card, width }, ref) {
    const scale = width / STORY_W;
    const layout = storyLayout(card);
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
          <Path
            transform={`translate(${layout.logo.x} ${layout.logo.y}) scale(${layout.logo.width / 1133})`}
            fill={brandColors.blau}
            d={MARK_ALPHA}
          />
          <Path
            transform={`translate(${layout.logo.x} ${layout.logo.y}) scale(${layout.logo.width / 1133})`}
            fill={brandColors.blau}
            d={MARK_FIVE}
          />
          {layout.linePath ? (
            <Path
              d={layout.linePath}
              stroke={brandColors.blau}
              strokeWidth={14}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        {layout.texts.map((item, i) => (
          <Text
            key={`${i}-${item.text}`}
            numberOfLines={1}
            style={[
              styles.text,
              {
                left: item.x * scale,
                // y = Grundlinie im Canvas → Oberkante ungefähr y − 0,8 × Schriftgröße.
                top: (item.y - item.size * 0.85) * scale,
                fontSize: item.size * scale,
                lineHeight: item.size * 1.15 * scale,
                fontWeight: item.bold ? '700' : '400',
                color: item.muted ? brandColors.grauDunkel : brandColors.weiss,
                maxWidth: (STORY_W - item.x - 40) * scale,
              },
            ]}
          >
            {item.text}
          </Text>
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { backgroundColor: brandColors.schwarz, overflow: 'hidden', borderRadius: 8 },
  text: { position: 'absolute' },
});
