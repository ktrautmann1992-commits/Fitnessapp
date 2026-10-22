/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Bilder nur über require() */
import type { MuscleTileId } from '@fitnessapp/core';
import type { ImageSourcePropType } from 'react-native';

/**
 * Bilder der Muskelgruppen-Kacheln (Gründer-Wunsch 22.10.2026). KI-generiert (Google Gemini) durch die Gründer,
 * freigestellt (transparent) und auf den hervorgehobenen Muskel zugeschnitten, 720 × 540 px WebP. Herkunft und
 * Aufbereitung: content/muscle-groups/README.md. Der Test `muscle-tiles.test.ts` prüft, dass jede Kachel ein Bild hat.
 */
export const MUSCLE_TILE_IMAGES: Readonly<Record<MuscleTileId, ImageSourcePropType>> = {
  brust: require('../../assets/muscle-groups/brust.webp'),
  schultern: require('../../assets/muscle-groups/schultern.webp'),
  nacken: require('../../assets/muscle-groups/nacken.webp'),
  'ruecken-oben': require('../../assets/muscle-groups/ruecken-oben.webp'),
  'unterer-ruecken': require('../../assets/muscle-groups/unterer-ruecken.webp'),
  bizeps: require('../../assets/muscle-groups/bizeps.webp'),
  trizeps: require('../../assets/muscle-groups/trizeps.webp'),
  unterarme: require('../../assets/muscle-groups/unterarme.webp'),
  bauch: require('../../assets/muscle-groups/bauch.webp'),
  'seitliche-bauchmuskeln': require('../../assets/muscle-groups/seitliche-bauchmuskeln.webp'),
  gesaess: require('../../assets/muscle-groups/gesaess.webp'),
  'oberschenkel-vorne': require('../../assets/muscle-groups/oberschenkel-vorne.webp'),
  beinbeuger: require('../../assets/muscle-groups/beinbeuger.webp'),
  adduktoren: require('../../assets/muscle-groups/adduktoren.webp'),
  waden: require('../../assets/muscle-groups/waden.webp'),
};
