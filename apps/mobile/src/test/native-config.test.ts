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

import appConfig from '../../app.config';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(APP_DIR, 'package.json'));

const BUNDLE_ID = 'de.fitnessapp.app';

// Nur diese Android-Berechtigungen darf die App haben (Supabase, Pausentimer-Vibration).
const ALLOWED_ANDROID_PERMISSIONS = ['android.permission.INTERNET', 'android.permission.VIBRATE'];
const BLOCKED_ANDROID_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
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
    expect(c.slug).toBe('fitnessapp');
  });

  it('Exportkontrolle: nur Standard-Verschlüsselung (H4)', () => {
    expect(config().ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it('keine Berechtigungstexte in der Info.plist (die App nutzt keine geschützten Dienste)', () => {
    const infoPlist = config().ios?.infoPlist ?? {};
    expect(Object.keys(infoPlist).filter((key) => key.endsWith('UsageDescription'))).toEqual([]);
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
    expect(android?.permissions ?? []).toEqual([]);
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
        ios: { infoPlist: Record<string, unknown> };
        android: {
          manifest: {
            manifest: {
              'uses-permission'?: { $: Record<string, string> }[];
              application: { $: Record<string, string> }[];
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

  it('Info.plist: keine Berechtigungstexte, Exportkontrolle false', () => {
    const plist = result._internal.modResults.ios.infoPlist;
    expect(Object.keys(plist).filter((key) => key.endsWith('UsageDescription'))).toEqual([]);
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
