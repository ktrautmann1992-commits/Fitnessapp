import { type ExerciseMuscleTile } from '@fitnessapp/core';
import { brandColors, fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { MUSCLE_TILE_IMAGES } from '@/data/muscle-tiles';
import { t } from '@/i18n';

const TILE_HEIGHT = 96;

/**
 * Trainierte Muskelgruppen auf der Übungsseite (Gründer-Wunsch 22.10.2026): dieselben Bild-Kacheln wie in der
 * Muskelgruppen-Übersicht, kleiner, mit „Hauptmuskel“ bzw. „unterstützend beteiligt“. Tipp → alle Übungen für diese
 * Muskelgruppe. Bilder sind Schmuck; Bildschirmleser hören Name, Rolle und Ziel.
 */
export function ExerciseMuscleTiles({ tiles }: { tiles: readonly ExerciseMuscleTile[] }) {
  const router = useRouter();
  if (tiles.length === 0) return null;
  return (
    <View style={styles.list} testID="exercise-muscle-tiles">
      {tiles.map(({ tile, role }) => {
        const name = t.glossary.muscleTiles[tile];
        const roleText = role === 'primary' ? t.glossary.musclePrimary : t.glossary.muscleSecondary;
        return (
          <Pressable
            key={tile}
            accessibilityRole="link"
            accessibilityLabel={`${name}, ${roleText}. ${t.glossary.muscleTileA11y(name)}`}
            onPress={() => router.push(`/uebungen?muskel=${encodeURIComponent(tile)}` as Href)}
            testID={`exercise-muscle-tile-${tile}`}
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
            <Text style={styles.role}>{roleText}</Text>
          </Pressable>
        );
      })}
    </View>
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
    gap: 2,
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
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    maxWidth: '55%',
  },
  role: { color: brandColors.weiss, fontSize: fontSize.sm, maxWidth: '55%', opacity: 0.85 },
});
