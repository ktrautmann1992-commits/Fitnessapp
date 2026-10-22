import { MUSCLE_TILE_IDS, type MuscleTileId } from '@fitnessapp/core';
import { brandColors, fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Button, LoadingState } from '@/components/ui';
import { MUSCLE_TILE_IMAGES } from '@/data/muscle-tiles';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const TILE_HEIGHT = 120;

/**
 * Muskelgruppen-Übersicht (Gründer-Wunsch 22.10.2026): eine Kachel pro Muskelgruppe mit anatomischem Bild (Muskel
 * rot hervorgehoben). Tipp → Übungs-Glossar, gefiltert auf diese Muskelgruppe (`/uebungen?muskel=<id>`).
 * Die Kacheln sind immer dunkel (Markenfarbe Graphit) – die hellgrauen Figuren brauchen den dunklen Grund, im
 * Hell- wie im Dunkelmodus. Bilder sind Schmuck: Bildschirmleser hören nur den Namen der Muskelgruppe.
 */
export default function MuscleGroupsScreen() {
  const router = useRouter();
  const app = useApp();

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }

  const open = (tile: MuscleTileId) =>
    router.push(`/uebungen?muskel=${encodeURIComponent(tile)}` as Href);

  return (
    <Screen
      area="training"
      icon="dumbbell"
      title={t.glossary.muscleTitle}
      intro={t.glossary.muscleIntro}
      testID="muscle-groups"
      footer={
        <Button
          label={t.glossary.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/uebungen' as Href))}
        />
      }
    >
      <View style={styles.list}>
        {MUSCLE_TILE_IDS.map((tile) => {
          const name = t.glossary.muscleTiles[tile];
          return (
            <Pressable
              key={tile}
              accessibilityRole="link"
              accessibilityLabel={t.glossary.muscleTileA11y(name)}
              onPress={() => open(tile)}
              testID={`muscle-tile-${tile}`}
              style={({ pressed }) => [
                styles.tile,
                { borderColor: pressed ? brandColors.blau : 'transparent' },
              ]}
            >
              <Image
                source={MUSCLE_TILE_IMAGES[tile]}
                resizeMode="contain"
                style={styles.image}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  tile: {
    height: TILE_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: brandColors.graphit,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  // Bild rechts, volle Kachelhöhe, Seitenverhältnis 4 : 3 wie die Dateien (720 × 540).
  image: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: TILE_HEIGHT,
    width: (TILE_HEIGHT * 4) / 3,
  },
  name: {
    color: brandColors.weiss,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    maxWidth: '52%',
  },
});
