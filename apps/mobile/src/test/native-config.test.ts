// Statische Prüfung der nativen App-Konfiguration (Etappe E, docs/PLAN-PHASE-4.md 7.2) – läuft ohne
// Expo-Konto, ohne Secrets und ohne Netz. Prüft app.config.ts, eas.json und das, was Expo beim Build daraus
// macht (`expo config --type introspect`: Info.plist und AndroidManifest nach allen Config-Plugins).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExpoConfig } from 'expo/config';
import { beforeAll, describe, expect, it } from 'vitest';

import { WEARABLE_DATA_TYPES } from '@fitnessapp/core';

import appConfig, {
  ANDROID_MIN_SDK,
  CAMERA_PERMISSION_TEXT,
  HEALTH_CONNECT_BLOCKED_PERMISSIONS,
  HEALTH_CONNECT_READ_PERMISSIONS,
  IOS_BACKGROUND_MODES,
  LOCATION_ALWAYS_TEXT,
  LOCATION_WHEN_IN_USE_TEXT,
  MLKIT_DEPENDENCIES_META,
  PUSH_ENTITLEMENT,
} from '../../app.config';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(APP_DIR, 'package.json'));

const BUNDLE_ID = 'de.fitnessapp.app';

// Nur diese Android-Berechtigungen darf die App haben (Supabase, Pausentimer-Vibration, Strichcode-Kamera E4b,
// Ausdauer aufzeichnen E3/E4: Standort „Beim Verwenden“ + Vordergrund-Dienst).
const ALLOWED_ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
  'android.permission.CAMERA',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  // Sprachansagen (expo-audio, 25.10.2026): Audio-Modus setzen (andere Musik leiser) – kein Mikrofon.
  'android.permission.MODIFY_AUDIO_SETTINGS',
  // Smartwatch (Phase 8): nur Leserechte von Health Connect.
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_STEPS',
  // Routen der Uhr (Gründer-Entscheidung 23.10.2026).
  'android.permission.health.READ_EXERCISE_ROUTES',
];
const BLOCKED_ANDROID_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  // Kein „Immer erlauben“ (W-G13): Der Vordergrund-Dienst braucht es nicht.
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  // Phase 8: kein Hintergrund-Lesen, keine älteren Daten, kein Schreiben (Routen lesen seit 23.10.2026 erlaubt).
  'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
  'android.permission.health.WRITE_EXERCISE',
  'android.permission.health.WRITE_EXERCISE_ROUTE',
  'android.permission.health.WRITE_DISTANCE',
  'android.permission.health.WRITE_TOTAL_CALORIES_BURNED',
  'android.permission.health.WRITE_HEART_RATE',
  'android.permission.health.WRITE_RESTING_HEART_RATE',
  'android.permission.health.WRITE_SLEEP',
  'android.permission.health.WRITE_STEPS',
];

function config(): ExpoConfig {
  return appConfig({ config: {} } as Parameters<typeof appConfig>[0]);
}

type EasJson = {
  cli: { appVersionSource?: string };
  build: Record<
    string,
    {
      distribution?: string;
      developmentClient?: boolean;
      autoIncrement?: boolean;
      environment?: string;
      android?: { buildType?: string };
    }
  >;
  submit: { production: { android?: { track?: string; releaseStatus?: string }; ios?: object } };
};

const easJson = JSON.parse(readFileSync(join(APP_DIR, 'eas.json'), 'utf8')) as EasJson;

describe('app.config.ts', () => {
  it('Bundle-ID und Android-Paket wie in docs/SETUP.md (App Store Connect)', () => {
    const c = config();
    expect(c.ios?.bundleIdentifier).toBe(BUNDLE_ID);
    expect(c.android?.package).toBe(BUNDLE_ID);
    expect(c.slug).toBe('alphafive');
    expect(c.owner).toBe('ktrautmann1992s-team');
    expect(c.extra?.eas?.projectId).toBe('7370ffec-3dd0-47bd-91dd-595c67ebae69');
  });

  it('Exportkontrolle: nur Standard-Verschlüsselung (H4)', () => {
    expect(config().ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it('keine Berechtigungstexte von Hand in der Info.plist (Kamera-Text kommt vom Plugin)', () => {
    const infoPlist = config().ios?.infoPlist ?? {};
    expect(Object.keys(infoPlist).filter((key) => key.endsWith('UsageDescription'))).toEqual([]);
  });

  it('expo-camera: deutscher Kamera-Text, kein Mikrofon, kein RECORD_AUDIO (E4b)', () => {
    const plugin = config().plugins?.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-camera',
    );
    expect(plugin).toEqual([
      'expo-camera',
      {
        cameraPermission: CAMERA_PERMISSION_TEXT,
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ]);
    expect(CAMERA_PERMISSION_TEXT).toMatch(/Strichcode/);
    expect(CAMERA_PERMISSION_TEXT).toMatch(/keine Fotos gespeichert/);
  });

  it('expo-notifications: nur lokal – Symbol, keine Töne, keine Hintergrund-Push-Nachrichten (Etappe E)', () => {
    const plugin = config().plugins?.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-notifications',
    );
    expect(plugin).toEqual([
      'expo-notifications',
      {
        icon: './assets/images/android-icon-monochrome.png',
        sounds: [],
        enableBackgroundRemoteNotifications: false,
      },
    ]);
    expect(existsSync(join(APP_DIR, 'assets/images/android-icon-monochrome.png'))).toBe(true);
  });

  it('expo-location: nur „Beim Verwenden“, Vordergrund-Dienst, kein Hintergrund-Standort, keine Bewegung (E3)', () => {
    const plugin = config().plugins?.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-location',
    );
    expect(plugin).toEqual([
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE_TEXT,
        locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS_TEXT,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: true,
        isAndroidMotionActivityEnabled: false,
        androidForegroundServiceIcon: './assets/images/android-icon-monochrome.png',
      },
    ]);
    expect(LOCATION_WHEN_IN_USE_TEXT).toMatch(/nur, während du/);
    expect(LOCATION_ALWAYS_TEXT).toMatch(/braucht keinen Standort „Immer“/);
  });

  it('kein Plugin, das eine Teilen-Erweiterung oder Mediathek-Zugriff einbaut (E6: Teilen nur über den System-Dialog)', () => {
    const names = (config().plugins ?? []).map((entry) =>
      Array.isArray(entry) ? entry[0] : entry,
    );
    expect(names).not.toContain('expo-sharing');
    expect(names).not.toContain('expo-media-library');
    const pkg = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).not.toContain('expo-media-library');
    // Karte über WebView (Etappe E3-Entscheidung): kein natives Karten-Modul.
    expect(Object.keys(pkg.dependencies)).not.toContain('@maplibre/maplibre-react-native');
  });

  it('expo-secure-store ohne Face ID, mit Android-Sicherungsregeln', () => {
    const plugin = config().plugins?.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-secure-store',
    );
    expect(plugin).toEqual([
      'expo-secure-store',
      { faceIDPermission: false, configureAndroidBackup: true },
    ]);
  });

  it('Android: keine Cloud-Sicherung, unnötige Berechtigungen gesperrt', () => {
    const android = config().android;
    expect(android?.allowBackup).toBe(false);
    expect([...(android?.blockedPermissions ?? [])].sort()).toEqual(
      [...BLOCKED_ANDROID_PERMISSIONS].sort(),
    );
    expect(android?.permissions ?? []).toEqual([...HEALTH_CONNECT_READ_PERMISSIONS]);
  });

  it('Health Connect (Phase 8): je Datentyp genau eine Leseberechtigung plus Trainingsrouten, Plugin und minSdk 26', () => {
    expect(HEALTH_CONNECT_READ_PERMISSIONS).toHaveLength(WEARABLE_DATA_TYPES.length + 1);
    expect(HEALTH_CONNECT_READ_PERMISSIONS).toContain(
      'android.permission.health.READ_EXERCISE_ROUTES',
    );
    for (const permission of HEALTH_CONNECT_READ_PERMISSIONS) {
      expect(permission).toMatch(/^android\.permission\.health\.READ_[A-Z_]+$/);
      expect(HEALTH_CONNECT_BLOCKED_PERMISSIONS as readonly string[]).not.toContain(permission);
    }
    for (const blocked of [
      'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
      'android.permission.health.READ_HEALTH_DATA_HISTORY',
    ]) {
      expect(HEALTH_CONNECT_BLOCKED_PERMISSIONS as readonly string[]).toContain(blocked);
    }
    const plugins = config().plugins ?? [];
    expect(plugins).toContain('react-native-health-connect');
    expect(plugins).toContainEqual(['expo-build-properties', { android: { minSdkVersion: 26 } }]);
    expect(ANDROID_MIN_SDK).toBe(26);
  });

  it('Datenschutz-Manifest: kein Tracking, nur Zweck App-Funktion', () => {
    const manifest = config().ios?.privacyManifests;
    expect(manifest?.NSPrivacyTracking).toBe(false);
    expect(manifest?.NSPrivacyTrackingDomains ?? []).toEqual([]);
    for (const type of manifest?.NSPrivacyCollectedDataTypes ?? []) {
      expect(type.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(type.NSPrivacyCollectedDataTypePurposes).toEqual([
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ]);
    }
  });

  it('Datenschutz-Manifest deckt alle Gründe der eingebauten Bibliotheken ab', () => {
    const declared = new Map(
      (config().ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map((entry) => [
        entry.NSPrivacyAccessedAPIType,
        new Set(entry.NSPrivacyAccessedAPITypeReasons),
      ]),
    );
    const required = libraryPrivacyReasons();
    // Ohne gefundene Manifeste wäre der Test wertlos (z. B. geänderte Ordnerstruktur).
    expect(required.size).toBeGreaterThan(0);
    for (const [category, reasons] of required) {
      for (const reason of reasons) {
        expect(declared.get(category)?.has(reason), `${category} ${reason}`).toBe(true);
      }
    }
  });
});

describe('eas.json', () => {
  it('Profile development, preview (Android-APK), production (Versionsnummer automatisch)', () => {
    expect(Object.keys(easJson.build).sort()).toEqual(['development', 'preview', 'production']);
    expect(easJson.build.development).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
    });
    expect(easJson.build.preview).toMatchObject({
      distribution: 'internal',
      android: { buildType: 'apk' },
    });
    expect(easJson.build.production?.autoIncrement).toBe(true);
    expect(easJson.build.production?.distribution).toBeUndefined();
    expect(easJson.cli.appVersionSource).toBe('remote');
  });

  it('jedes Build-Profil nimmt die gleichnamige Expo-Umgebung (W12)', () => {
    for (const [name, profile] of Object.entries(easJson.build)) {
      expect(profile.environment).toBe(name);
    }
  });

  it('Einreichen: Android intern als Entwurf (App bei Google noch nie veröffentlicht)', () => {
    expect(easJson.submit.production.android).toEqual({
      track: 'internal',
      releaseStatus: 'draft',
    });
    expect(easJson.submit.production.ios).toBeDefined();
  });
});

describe('expo config --type introspect (nach allen Config-Plugins, offline)', () => {
  type Introspect = {
    _internal: {
      modResults: {
        ios: { infoPlist: Record<string, unknown>; entitlements?: Record<string, unknown> };
        android: {
          manifest: {
            manifest: {
              'uses-permission'?: { $: Record<string, string> }[];
              application: {
                $: Record<string, string>;
                'meta-data'?: { $: Record<string, string> }[];
              }[];
            };
          };
        };
      };
    };
  };
  let result: Introspect;

  beforeAll(() => {
    const cli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
    const out = execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
      cwd: APP_DIR,
      env: { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', CI: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    result = JSON.parse(out) as Introspect;
  }, 60_000);

  it('Info.plist: nur deutsche Kamera- und Standort-Texte (kein Mikrofon, kein „Immer“ allein), Exportkontrolle false', () => {
    const plist = result._internal.modResults.ios.infoPlist;
    expect(
      Object.keys(plist)
        .filter((key) => key.endsWith('UsageDescription'))
        .sort(),
    ).toEqual([
      'NSCameraUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
      'NSLocationWhenInUseUsageDescription',
    ]);
    expect(plist.NSCameraUsageDescription).toBe(CAMERA_PERMISSION_TEXT);
    expect(plist.NSLocationWhenInUseUsageDescription).toBe(LOCATION_WHEN_IN_USE_TEXT);
    expect(plist.NSLocationAlwaysAndWhenInUseUsageDescription).toBe(LOCATION_ALWAYS_TEXT);
    expect(plist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('AndroidManifest: nur erlaubte Berechtigungen, gesperrte entfernt, keine Sicherung', () => {
    const manifest = result._internal.modResults.android.manifest.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    const active = permissions
      .filter((entry) => entry.$['tools:node'] !== 'remove')
      .map((entry) => entry.$['android:name']);
    const removed = permissions
      .filter((entry) => entry.$['tools:node'] === 'remove')
      .map((entry) => entry.$['android:name']);
    expect(active.sort()).toEqual([...ALLOWED_ANDROID_PERMISSIONS].sort());
    expect(removed.sort()).toEqual([...BLOCKED_ANDROID_PERMISSIONS].sort());
    const application = manifest.application[0]?.$ ?? {};
    expect(application['android:allowBackup']).toBe('false');
    expect(application['android:dataExtractionRules']).toBe(
      '@xml/secure_store_data_extraction_rules',
    );
  });

  it('iOS: keine Push-Fähigkeit (aps-environment entfernt), kein remote-notification (Etappe E)', () => {
    const ios = result._internal.modResults.ios;
    // Ohne Entitlements wäre die Prüfung wertlos (z. B. geänderte introspect-Ausgabe).
    expect(ios.entitlements).toBeDefined();
    expect(ios.entitlements).not.toHaveProperty(PUSH_ENTITLEMENT);
    expect((ios.infoPlist.UIBackgroundModes as string[] | undefined) ?? []).not.toContain(
      'remote-notification',
    );
  });

  it('iOS: Hintergrundmodi nur „location“ (Aufzeichnung) und „audio“ (Sprachansagen), kein „fetch“ (E3)', () => {
    expect(result._internal.modResults.ios.infoPlist.UIBackgroundModes).toEqual([
      ...IOS_BACKGROUND_MODES,
    ]);
  });

  it('AndroidManifest: Health-Connect-Erklärung (Datenschutz-Link im Systemdialog) für Android ≤ 13 und 14+', () => {
    const manifest = result._internal.modResults.android.manifest.manifest as unknown as {
      application: {
        activity?: {
          $: Record<string, string>;
          'intent-filter'?: { action?: { $: Record<string, string> }[] }[];
        }[];
        'activity-alias'?: {
          $: Record<string, string>;
          'intent-filter'?: {
            action?: { $: Record<string, string> }[];
            category?: { $: Record<string, string> }[];
          }[];
        }[];
      }[];
    };
    const app = manifest.application[0];
    const actions = (app?.activity ?? []).flatMap((a) =>
      (a['intent-filter'] ?? []).flatMap((f) => (f.action ?? []).map((x) => x.$['android:name'])),
    );
    expect(actions).toContain('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE');
    const alias = (app?.['activity-alias'] ?? []).find(
      (a) => a.$['android:name'] === 'ViewPermissionUsageActivity',
    );
    expect(alias?.$['android:permission']).toBe('android.permission.START_VIEW_PERMISSION_USAGE');
    expect(alias?.['intent-filter']?.[0]?.action?.[0]?.$['android:name']).toBe(
      'android.intent.action.VIEW_PERMISSION_USAGE',
    );
    expect(alias?.['intent-filter']?.[0]?.category?.[0]?.$['android:name']).toBe(
      'android.intent.category.HEALTH_PERMISSIONS',
    );
  });

  it('AndroidManifest: Symbol der Benachrichtigung „Aufzeichnung läuft“ (E3)', () => {
    const manifest = result._internal.modResults.android.manifest.manifest;
    const meta = (manifest.application[0]?.['meta-data'] ?? []).map((entry) => entry.$);
    expect(meta).toContainEqual({
      'android:name': 'expo.modules.location.foreground_service_icon',
      'android:resource': '@drawable/location_foreground_service_icon',
    });
  });

  it('AndroidManifest: Benachrichtigungs-Symbol gesetzt (Etappe E)', () => {
    const manifest = result._internal.modResults.android.manifest.manifest;
    const meta = (manifest.application[0]?.['meta-data'] ?? []).map((entry) => entry.$);
    expect(meta).toContainEqual({
      'android:name': 'expo.modules.notifications.default_notification_icon',
      'android:resource': '@drawable/notification_icon',
    });
  });

  it('AndroidManifest: Download des Google-Code-Scanners (barcode_ui) wird entfernt (E4b, Wächter M2)', () => {
    const manifest = result._internal.modResults.android.manifest.manifest;
    const meta = (manifest.application[0]?.['meta-data'] ?? []).filter(
      (entry) => entry.$['android:name'] === MLKIT_DEPENDENCIES_META,
    );
    expect(meta).toEqual([
      { $: { 'android:name': MLKIT_DEPENDENCIES_META, 'tools:node': 'remove' } },
    ]);
  });
});

/** Gründe aus den PrivacyInfo.xcprivacy-Dateien von React Native und den direkten Abhängigkeiten. */
function libraryPrivacyReasons(): Map<string, Set<string>> {
  const pkg = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const result = new Map<string, Set<string>>();
  for (const name of Object.keys(pkg.dependencies)) {
    if (name.startsWith('@fitnessapp/')) continue;
    let root: string;
    try {
      root = dirname(require.resolve(`${name}/package.json`));
    } catch {
      continue;
    }
    for (const file of findPrivacyFiles(root, 0)) {
      const xml = readFileSync(file, 'utf8');
      const blocks = xml.split('<key>NSPrivacyAccessedAPIType</key>').slice(1);
      for (const block of blocks) {
        const category = /<string>([^<]+)<\/string>/.exec(block)?.[1];
        const reasonsXml =
          /NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(block)?.[1];
        if (!category || !reasonsXml) continue;
        const set = result.get(category) ?? new Set<string>();
        for (const match of reasonsXml.matchAll(/<string>([^<]+)<\/string>/g)) {
          if (match[1]) set.add(match[1]);
        }
        result.set(category, set);
      }
    }
  }
  return result;
}

function findPrivacyFiles(dir: string, depth: number): string[] {
  if (depth > 5 || !existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'android', 'build', 'lib', 'src', '__tests__', 'docs'].includes(entry)) {
      continue;
    }
    const path = join(dir, entry);
    if (entry === 'PrivacyInfo.xcprivacy') {
      found.push(path);
    } else if (statSync(path).isDirectory()) {
      found.push(...findPrivacyFiles(path, depth + 1));
    }
  }
  return found;
}
