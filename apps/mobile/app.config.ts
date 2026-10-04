import type { ConfigContext, ExpoConfig } from 'expo/config';

// Name der App (Anzeige unter dem Icon, im Browser-Tab) – gemeinsam mit packages/ui/src/brand.ts ändern.
// slug, scheme und bundleIdentifier/package bleiben „fitnessapp“: Daran hängen das Expo-Projekt (expo.dev,
// docs/SETUP.md Teil D), Anmelde-Links und später die Store-Einträge. Für Nutzer sind sie unsichtbar.
const APP_NAME = 'Alpha5';

// Markenfarbe „schwarz“ (packages/ui/theme.css, --brand-schwarz) – Hintergrund von Icon und Startbildschirm.
// Hier als Wert, weil app.config.ts beim Build ohne die Workspace-Pakete gelesen wird.
const BRAND_SCHWARZ = '#0a0c10';

// Icons werden aus packages/ui/brand/alpha5-mark.svg erzeugt: pnpm --filter @fitnessapp/ui icons

// Projekt-ID von expo.dev (kein Geheimnis). Wird einmalig eingetragen, siehe docs/SETUP.md Teil D.
// Solange sie leer ist, überspringt der Workflow eas-build den Build mit einem Hinweis.
const EAS_PROJECT_ID = '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'fitnessapp',
  version: '0.1.0',
  orientation: 'portrait',
  // 1024 × 1024, ohne Transparenz und ohne Rundung (iOS und die Stores runden selbst).
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
      // Logo auf 50 % der Breite: bleibt in der Sicherheitszone, egal welche Form (Kreis, Quadrat) Android zuschneidet.
      foregroundImage: './assets/images/adaptive-icon.png',
      // Android 13+ „Designte Symbole“: einfarbiges Logo, Android färbt es passend zum Hintergrundbild ein.
      monochromeImage: './assets/images/android-icon-monochrome.png',
      backgroundColor: BRAND_SCHWARZ,
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
      // SDK 57: Startbildschirm nur noch über dieses Plugin (das alte Feld `splash` gibt es nicht mehr).
      // Hell und dunkel gleich: Logo auf Schwarz. imageWidth = Breite des Bildes (1024 px, Logo = 50 %) in dp.
      {
        backgroundColor: BRAND_SCHWARZ,
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
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
