/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Bilder nur über require() */
/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Rezeptfotos (Zuordnungen aus content/recipe-media/, Bilder unter apps/mobile/assets/recipe-media/).
 * Neu erzeugen: pnpm recipe-media (im Hauptordner), siehe packages/content/src/recipe-media/build.ts.
 */
import type { ImageSourcePropType } from 'react-native';

/** Nur, was die App anzeigt (Lizenz und Quelle stehen in content/recipe-media/<id>.json – Test prüft Gleichheit). */
export interface GeneratedRecipeMedia {
  readonly alt_de: string;
  readonly ai_notice_de: string | null;
  readonly thumbnail: ImageSourcePropType;
  readonly banner: ImageSourcePropType;
}

export const GENERATED_RECIPE_MEDIA: Readonly<Record<string, GeneratedRecipeMedia>> = {
  'beeren-frozen-joghurt-bark': {
    alt_de: 'Foto: Beeren-Frozen-Joghurt-Bark',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/beeren-frozen-joghurt-bark-thumb.webp'),
    banner: require('../../assets/recipe-media/beeren-frozen-joghurt-bark-banner.webp'),
  },
  'beeren-quark-mit-mandeln': {
    alt_de: 'Foto: Beeren-Quark mit Mandeln',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/beeren-quark-mit-mandeln-thumb.webp'),
    banner: require('../../assets/recipe-media/beeren-quark-mit-mandeln-banner.webp'),
  },
  'caprese-spiesse-mit-balsamico': {
    alt_de: 'Foto: Caprese-Spieße mit Balsamico',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/caprese-spiesse-mit-balsamico-thumb.webp'),
    banner: require('../../assets/recipe-media/caprese-spiesse-mit-balsamico-banner.webp'),
  },
  'dattel-kakao-kugeln-mit-reiswaffel-crunch': {
    alt_de: 'Foto: Dattel-Kakao-Kugeln mit Reiswaffel-Crunch',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/dattel-kakao-kugeln-mit-reiswaffel-crunch-thumb.webp'),
    banner: require('../../assets/recipe-media/dattel-kakao-kugeln-mit-reiswaffel-crunch-banner.webp'),
  },
  'eier-reis-mit-tofu-und-brokkoli': {
    alt_de: 'Foto: Eier-Reis mit Tofu & Brokkoli',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/eier-reis-mit-tofu-und-brokkoli-thumb.webp'),
    banner: require('../../assets/recipe-media/eier-reis-mit-tofu-und-brokkoli-banner.webp'),
  },
  'eiermuffins-mit-paprika-und-gouda': {
    alt_de: 'Foto: Eiermuffins mit Paprika & Gouda',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/eiermuffins-mit-paprika-und-gouda-thumb.webp'),
    banner: require('../../assets/recipe-media/eiermuffins-mit-paprika-und-gouda-banner.webp'),
  },
  'eierspaetzle-mit-erbsen-und-schnittlauchquark': {
    alt_de: 'Foto: Eierspätzle mit Erbsen und Schnittlauchquark',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/eierspaetzle-mit-erbsen-und-schnittlauchquark-thumb.webp'),
    banner: require('../../assets/recipe-media/eierspaetzle-mit-erbsen-und-schnittlauchquark-banner.webp'),
  },
  'harzer-brot-mit-radieschen-und-schnittlauch': {
    alt_de: 'Foto: Harzer-Brot mit Radieschen & Schnittlauch',
    ai_notice_de: 'KI-Bild, Higgsfield',
    thumbnail: require('../../assets/recipe-media/harzer-brot-mit-radieschen-und-schnittlauch-thumb.webp'),
    banner: require('../../assets/recipe-media/harzer-brot-mit-radieschen-und-schnittlauch-banner.webp'),
  },
};
