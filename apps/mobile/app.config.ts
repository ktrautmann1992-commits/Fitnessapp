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
    // GRÜNDER-ENTSCHEIDUNG bis Phase 12 (Wächter E, K2): true = die App läuft auch als iPad-App. Folgen: Apple
    // verlangt iPad-Bildschirmfotos und prüft die Darstellung auf dem iPad. false = auf dem iPad nur im
    // iPhone-Format. Für TestFlight egal; vor der ersten Einreichung zur Prüfung festlegen.
    supportsTablet: true,
    config: {
      // Setzt ITSAppUsesNonExemptEncryption = false (Exportkontrolle, Frage bei jedem TestFlight-Upload entfällt).
      // Begründung: nur Standard-Verschlüsselung zum Schutz der eigenen Daten auf dem Gerät (AES über
      // expo-crypto/Schlüsselbund) und HTTPS – docs/PLAN-PHASE-4.md 7.2 Punkt 3 (Wächter H4).
      // Bestätigung in der Rechts-Checkliste Phase 12.
      usesNonExemptEncryption: false,
    },
    // Keine NS…UsageDescription-Texte: Die App nutzt keine Kamera, keine Fotos, keinen Standort, kein Face ID,
    // keine Health-Daten. Drucken (expo-print), Ordner-Auswahl (expo-file-system), Vibration (expo-haptics),
    // Bildschirm-an (expo-keep-awake), Schlüsselbund (expo-secure-store) und expo-crypto brauchen keine
    // Berechtigung. Kommt später eine dazu (z. B. HealthKit, Phase 8), hier deutschen Text ergänzen.
    //
    // Datenschutz-Manifest (PrivacyInfo.xcprivacy), Pflicht für den App Store. Gründe für „Required Reason
    // APIs“ = Vereinigung der Manifeste der eingebauten Bibliotheken (React Native, expo-constants,
    // expo-system-ui, expo-file-system, AsyncStorage; Stand SDK 57). Expo empfiehlt, sie hier zu wiederholen,
    // weil Apple die Manifeste statischer Bibliotheken nicht immer zusammenführt.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        // UserDefaults: nur eigene App-Einstellungen (React Native, expo-constants, expo-system-ui).
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        // Datei-Zeitstempel: eigene App-Dateien (React Native, AsyncStorage, expo-file-system).
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        // Freier Speicher (expo-file-system).
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
        // Systemstartzeit für Zeitmessung (React Native).
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
      // Was die App über das Konto (Supabase) speichert – nur für den App-Betrieb, mit dem Konto verknüpft,
      // kein Tracking, keine Werbung. Muss zu den Datenschutzangaben in App Store Connect passen (Gründer,
      // Rechts-Checkliste Phase 12).
      NSPrivacyCollectedDataTypes: [
        'NSPrivacyCollectedDataTypeEmailAddress',
        'NSPrivacyCollectedDataTypeUserID',
        'NSPrivacyCollectedDataTypeHealth',
        'NSPrivacyCollectedDataTypeFitness',
        'NSPrivacyCollectedDataTypeOtherUserContent',
      ].map((type) => ({
        NSPrivacyCollectedDataType: type,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      })),
    },
  },
  android: {
    package: 'de.fitnessapp.app',
    // Keine Android-Sicherung in Google Drive: Das Tagebuch liegt verschlüsselt auf dem Gerät, der Schlüssel im
    // Android-Keystore wird nicht mitgesichert – eine wiederhergestellte Kopie wäre unlesbar. Der Server
    // (Supabase) ist die Sicherung. Zusätzlich schließen die Regeln von expo-secure-store (Plugin unten) dessen
    // Daten von Sicherung und Geräte-Umzug aus.
    allowBackup: false,
    // Nicht gebraucht: Die Ordner-Auswahl beim Export (Storage Access Framework) braucht keine
    // Speicher-Berechtigung; SYSTEM_ALERT_WINDOW (Einblendung über anderen Apps) kommt nur aus der Vorlage.
    // Bleiben: INTERNET (Supabase) und VIBRATE (Pausentimer, expo-haptics).
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
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
    // Kein Face ID (die App fragt keine Biometrie ab) → kein NSFaceIDUsageDescription; Android-Sicherungsregeln an.
    ['expo-secure-store', { faceIDPermission: false, configureAndroidBackup: true }],
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
