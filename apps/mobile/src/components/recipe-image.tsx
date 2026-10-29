import { fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Image, StyleSheet, View } from 'react-native';

import { Icon, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { recipeImageFor } from '@/data/recipe-media';
import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';

/** Kantenlänge des Vorschaubilds in Listen (Rezeptsuche, Kühlschrank, Mahlzeiten). */
export const RECIPE_THUMB_SIZE = 56;

/**
 * Vorschaubild links in Rezeptkarten (Gründer-Wunsch 24.10.2026). Reiner Schmuck – der Titel daneben trägt die
 * Ansage; ohne Foto das bisherige grüne Rezept-Symbol in derselben Größe (Karten bleiben gleich ausgerichtet).
 */
export function RecipeThumb({ recipeId, testID }: { recipeId: string; testID?: string }) {
  const image = recipeImageFor(recipeId);
  const palette = useAreaColors('ernaehrung');
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[styles.thumb, { backgroundColor: palette.surface }]}
    >
      {image ? (
        <Image
          source={image.thumbnail}
          resizeMode="cover"
          style={styles.thumbImage}
          accessible={false}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Icon name="recipe" size={26} color={palette.icon} />
      )}
    </View>
  );
}

/**
 * Großes Foto (21:9) oben in der Rezeptansicht mit sichtbarem KI-Hinweis („KI-Bild, Higgsfield“). Ohne Foto nichts
 * (kein leerer Rahmen).
 */
export function RecipeBanner({ recipeId }: { recipeId: string }) {
  const image = recipeImageFor(recipeId);
  const theme = useThemeColors();
  if (!image) return null;
  return (
    <View style={[styles.banner, { backgroundColor: theme.border }]} testID="recipe-banner">
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
          accessibilityLabel={t.nutrition.recipe.aiImageA11y(image.ai_notice_de)}
          testID="recipe-banner-ai"
        >
          {image.ai_notice_de}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: RECIPE_THUMB_SIZE,
    height: RECIPE_THUMB_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: RECIPE_THUMB_SIZE, height: RECIPE_THUMB_SIZE },
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
