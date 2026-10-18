import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withEntitlementsPlist,
} from 'expo/config-plugins';

// Name der App (Anzeige unter dem Icon, im Browser-Tab) – gemeinsam mit packages/ui/src/brand.ts ändern.
// slug = Slug des Expo-Projekts „AlphaFive“ auf expo.dev (muss genau dazu passen, docs/SETUP.md Teil D).
// scheme und bundleIdentifier/package bleiben „fitnessapp“: Daran hängen Anmelde-Links und später die
// Store-Einträge. Für Nutzer sind sie unsichtbar.
const APP_NAME = 'Alpha5';

// Markenfarbe „schwarz“ (packages/ui/theme.css, --brand-schwarz) – Hintergrund von Icon und Startbildschirm.
// Hier als Wert, weil app.config.ts beim Build ohne die Workspace-Pakete gelesen wird.
const BRAND_SCHWARZ = '#0a0c10';

// Icons werden aus packages/ui/brand/alpha5-mark.svg erzeugt: pnpm --filter @fitnessapp/ui icons

// Projekt-ID von expo.dev (kein Geheimnis). Wird einmalig eingetragen, siehe docs/SETUP.md Teil D.
// Solange sie leer ist, überspringt der Workflow eas-build den Build mit einem Hinweis.
const EAS_PROJECT_ID = '7370ffec-3dd0-47bd-91dd-595c67ebae69';

// Besitzer des Expo-Projekts: die Organisation auf expo.dev (kein Geheimnis). Der Build-Schlüssel EXPO_TOKEN gehört
// einem Robot-Benutzer dieser Organisation (docs/SETUP.md Teil D).
const EAS_OWNER = 'ktrautmann1992s-team';

// Text der iOS-Kamera-Abfrage (NSCameraUsageDescription), Wortlaut aus docs/PLAN-E4.md 5.2.
export const CAMERA_PERMISSION_TEXT =
  'Alpha5 nutzt die Kamera nur, um den Strichcode von Lebensmitteln zu lesen. Es werden keine Fotos gespeichert.';

/**
 * expo-camera trägt in sein Android-Manifest `com.google.mlkit.vision.DEPENDENCIES = barcode_ui` ein. Das lässt Google
 * Play-Dienste das Modul des Google-Code-Scanners (eigene Scan-Oberfläche von Google, `launchScanner`) schon bei der
 * Installation herunterladen. Wir nutzen diese Oberfläche nicht – nur den eingebauten ML-Kit-Leser in `CameraView`
 * (gebündelt, ohne Download). Deshalb wird der Eintrag beim Zusammenführen der Manifeste entfernt
 * (`tools:node="remove"`). Die Bibliothek `play-services-code-scanner` selbst bleibt (expo-camera braucht sie beim
 * Kompilieren); ohne den Eintrag lädt sie nur, wenn jemand `launchScanner` aufruft – das tut die App nie.
 * Etappe E4b, Wächter M2; docs/PLAN-E4.md Umsetzungsstand E4b.
 */
export const MLKIT_DEPENDENCIES_META = 'com.google.mlkit.vision.DEPENDENCIES';

const withoutGoogleCodeScannerDownload: ConfigPlugin = (cfg) =>
  withAndroidManifest(cfg, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const metaData = (application['meta-data'] ?? []).filter(
      (entry) => entry.$['android:name'] !== MLKIT_DEPENDENCIES_META,
    );
    metaData.push({
      $: { 'android:name': MLKIT_DEPENDENCIES_META, 'tools:node': 'remove' } as {
        'android:name': string;
        'android:value'?: string;
      },
    });
    application['meta-data'] = metaData;
    mod.modResults.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    return mod;
  });

/**
 * Lokale Benachrichtigungen (Etappe E, docs/PLAN-PHASE-4B.md 7): Das Plugin expo-notifications trägt auf iOS immer
 * `aps-environment` (Push-Fähigkeit) in die Entitlements ein. Wir planen nur LOKALE Benachrichtigungen – kein
 * Push-Token, kein Apple-Push-Dienst. Lokale Benachrichtigungen brauchen die Push-Fähigkeit nicht; ohne den Eintrag
 * schaltet EAS sie für die App-ID auch nicht ein (Datensparsamkeit, Gründer-Frage 8).
 */
export const PUSH_ENTITLEMENT = 'aps-environment';

const withoutPushEntitlement: ConfigPlugin = (cfg) =>
  withEntitlementsPlist(cfg, (mod) => {
    delete mod.modResults[PUSH_ENTITLEMENT];
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withoutPushEntitlement(withoutGoogleCodeScannerDownload(appConfig(config)));

const appConfig = (config: ConfigContext['config']): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  owner: EAS_OWNER,
  slug: 'alphafive',
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
    // Einziger NS…UsageDescription-Text: Kamera (NSCameraUsageDescription, Strichcode scannen, Etappe E4b) – gesetzt
    // vom Plugin expo-camera unten. Sonst keine: keine Fotos, kein Mikrofon, kein Standort, kein Face ID, keine
    // Health-Daten. Drucken (expo-print), Ordner-Auswahl (expo-file-system), Vibration (expo-haptics),
    // Bildschirm-an (expo-keep-awake), Schlüsselbund (expo-secure-store) und expo-crypto brauchen keine
    // Berechtigung. Kommt später eine dazu (z. B. HealthKit, Phase 8), hier deutschen Text ergänzen.
    // Kamera ist keine „Required Reason API“ (kein Eintrag unten); Kamerabilder verlassen das Gerät nicht, sind also
    // keine „gesammelten Daten“ im Sinne von NSPrivacyCollectedDataTypes.
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
    // Bleiben: INTERNET (Supabase), VIBRATE (Pausentimer, expo-haptics) und CAMERA (Strichcode scannen, expo-camera,
    // Etappe E4b). Kein RECORD_AUDIO (Plugin-Option recordAudioAndroid: false).
    // Aus der Bibliothek expo-notifications (Etappe E, erst beim Bauen eingemischt): POST_NOTIFICATIONS (Android 13+,
    // die App fragt erst nach „Ja“ bzw. Einschalten) und RECEIVE_BOOT_COMPLETED (geplante Erinnerungen überstehen einen
    // Neustart). Keine Berechtigung für exakte Wecker (SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM): Android plant dann
    // „ungefähr“ (setAndAllowWhileIdle) – das Pausenende kann im Energiesparen später kommen (Hinweis in der App).
    // Außerdem bringt die Bibliothek einen Firebase-Messaging-Dienst (ExpoFirebaseMessagingService) und ggf. dessen
    // Berechtigungen mit. Ohne google-services.json wird Firebase nie gestartet, es gibt kein Push-Token. Bewusst KEIN
    // Plugin, das den Dienst aus dem Manifest entfernt (ohne echten Build nicht prüfbar). Vor der ersten Play-Einreichung
    // die fertige APK mit `aapt dump permissions` prüfen (docs/PLAN-PHASE-4B.md Umsetzungsstand E).
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
    // Strichcode scannen (Etappe E4b, docs/PLAN-E4.md 5.2): nur Kamera, kein Mikrofon. Die Erkennung läuft auf dem
    // Gerät; es werden keine Fotos gespeichert oder gesendet. Neues natives Modul → neuer EAS-Build nötig.
    [
      'expo-camera',
      {
        cameraPermission: CAMERA_PERMISSION_TEXT,
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    // Lokale Benachrichtigungen (Etappe E): Mess-Erinnerung und Pausenende, nur auf dem Gerät geplant. Android-Kanal
    // „Erinnerungen“ legt die App selbst an (lib/notification-driver.native.ts). Symbol: weißes Logo auf transparent
    // (wie das Android-13-Symbol). Keine Hintergrund-Push-Nachrichten. Neues natives Modul → neuer EAS-Build nötig.
    [
      'expo-notifications',
      {
        icon: './assets/images/android-icon-monochrome.png',
        sounds: [],
        enableBackgroundRemoteNotifications: false,
      },
    ],
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
