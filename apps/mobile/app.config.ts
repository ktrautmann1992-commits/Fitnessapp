import type { ConfigContext, ExpoConfig } from 'expo/config';

// Arbeitstitel – gemeinsam mit packages/ui/src/brand.ts ändern.
const APP_NAME = 'Fitnessapp';

// Projekt-ID von expo.dev (kein Geheimnis). Wird einmalig eingetragen, siehe docs/SETUP.md Teil D.
// Solange sie leer ist, überspringt der Workflow eas-build den Build mit einem Hinweis.
const EAS_PROJECT_ID = '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'fitnessapp',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'fitnessapp',
  userInterfaceStyle: 'automatic',
  ios: {
    // Vor dem ersten Store-Upload final festlegen – danach nicht mehr änderbar.
    bundleIdentifier: 'de.fitnessapp.app',
    supportsTablet: true,
  },
  android: {
    package: 'de.fitnessapp.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    // Eine einzige index.html – passt zu Vercel (alle Pfade werden auf die App umgeleitet).
    output: 'single',
    favicon: './assets/images/favicon.png',
    lang: 'de',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0F9D58',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
