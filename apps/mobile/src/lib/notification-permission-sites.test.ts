import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Etappe E, DoD (docs/PLAN-PHASE-4B.md 10 E, Frage 16): Die System-Erlaubnis für Benachrichtigungen wird NIE beim
 * App-Start oder im Onboarding abgefragt. Statische Prüfung: Nur der Treiber und die Abläufe kennen die Abfrage, nur
 * die Oberflächen-Bausteine in components/notifications.tsx lösen sie aus – und die hängen nur an Einstellungen,
 * „Heute“/Übersicht (nach dem Onboarding) und dem Trainingsmodus.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'generated' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  file: relative(SRC, path).split('\\').join('/'),
  text: readFileSync(path, 'utf8'),
}));

const filesMatching = (pattern: RegExp) =>
  files
    .filter(({ text }) => pattern.test(text))
    .map(({ file }) => file)
    .sort();

describe('Erlaubnis-Abfrage nie beim App-Start oder im Onboarding', () => {
  it('nur der native Treiber ruft requestPermissionsAsync auf', () => {
    expect(filesMatching(/requestPermissionsAsync/)).toEqual(['lib/notification-driver.native.ts']);
  });

  it('nur die Abläufe (lib/notifications.ts) rufen requestPermission() auf – in enable…()', () => {
    // lib/cook-alerts.ts: Browser-Mitteilung beim Kochtag (Etappe N5b, eigene Abfrage erst beim Start des Kochtags).
    // lib/device-calendar.ts: Kalender-Erlaubnis (Trainings im Handy-Kalender) nur in enable() – siehe unten.
    expect(filesMatching(/\.requestPermission\(/)).toEqual([
      'lib/cook-alerts.ts',
      'lib/device-calendar.ts',
      'lib/notifications.ts',
    ]);
  });

  it('Kalender-Erlaubnis nur nach Tipp und Erklärung im Bildschirm „Trainings im Handy-Kalender“', () => {
    expect(filesMatching(/deviceCalendar\.enable\(/)).toEqual(['app/handy-kalender.tsx']);
  });

  it('Einschalten (fragt ggf. nach) nur aus den Bausteinen in components/notifications.tsx', () => {
    expect(filesMatching(/\.(enableMeasurement|enableRestEnd|scheduleTestMeasurement)\(/)).toEqual([
      'components/notifications.tsx',
    ]);
  });

  it('die Bausteine hängen nur an Einstellungen, „Heute“, Übersicht und Trainingsmodus', () => {
    expect(filesMatching(/from '@\/components\/notifications'/)).toEqual([
      'app/(tabs)/today.tsx',
      'app/(tabs)/uebersicht.tsx',
      'app/settings.tsx',
      'app/workout/[sessionId].tsx',
    ]);
  });

  it('App-Start (Layout, Startpunkt, App-Zustand) und Onboarding fragen nicht', () => {
    const startAndOnboarding = files.filter(
      ({ file }) =>
        file === 'app/_layout.tsx' ||
        file === 'app/index.tsx' ||
        file === 'app/welcome.tsx' ||
        file === 'state/app-state.tsx' ||
        file === 'components/notification-router.tsx' ||
        file.startsWith('app/onboarding/') ||
        file.startsWith('app/consent') ||
        file.startsWith('steps/'),
    );
    expect(startAndOnboarding.length).toBeGreaterThan(5);
    for (const { file, text } of startAndOnboarding) {
      expect(text, file).not.toMatch(
        /requestPermission|enableMeasurement|enableRestEnd|scheduleTestMeasurement|components\/notifications'/,
      );
    }
  });
});
