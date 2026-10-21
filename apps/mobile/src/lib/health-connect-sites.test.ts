import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Phase 8 (docs/PLAN-PHASE-8.md 2, 4): Statische Prüfung der Smartwatch-Anbindung.
 * - Das native Modul react-native-health-connect lädt NUR der Android-Treiber (*.native.ts) – nie im Web-Bündel.
 * - Der Systemdialog kommt nur aus „Smartwatch verbinden“ (nach der eigenen Einwilligung), nie beim App-Start.
 * - Keine Logs in den Smartwatch-Dateien (Art. 9: Puls, Schlaf, Schritte nie in Logs).
 * - Das Story-Bild (Teilen) kennt keine Smartwatch-Daten.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'generated' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
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

describe('Smartwatch über Health Connect', () => {
  it('nur der Android-Treiber lädt react-native-health-connect', () => {
    expect(filesMatching(/from 'react-native-health-connect'/)).toEqual([
      'lib/health-connect-driver.native.ts',
    ]);
  });

  it('Systemdialog nur aus „Smartwatch verbinden“', () => {
    expect(filesMatching(/driver\.requestPermissions\(/)).toEqual(['app/smartwatch.tsx']);
  });

  it('keine Logs in den Smartwatch-Dateien (Gesundheitsdaten)', () => {
    const wearableFiles = files.filter(({ file }) =>
      /wearable|health-connect|smartwatch/.test(file),
    );
    expect(wearableFiles.length).toBeGreaterThanOrEqual(8);
    for (const { file, text } of wearableFiles) {
      expect(text, file).not.toMatch(/console\.(log|warn|error|info|debug)/);
    }
  });

  it('Story-Bild und Teilen kennen keine Smartwatch-Daten (nie Puls im Bild)', () => {
    expect(
      files.filter(({ file }) => /(^|\/)(story|teilen|share)/.test(file)).length,
    ).toBeGreaterThan(3);
    for (const { file, text } of files.filter(({ file }) =>
      /(^|\/)(story|teilen|share)/.test(file),
    )) {
      expect(text, file).not.toMatch(/heartRate|heart_rate|wearable|bpm/i);
    }
  });
});
