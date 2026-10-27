import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = join(__dirname, '../../../../scripts/bundle-content.mjs');

/** Führt das Bündel-Skript aus und liefert die Anzahl der gebündelten Dateien. */
function bundle(args: string[], env: Record<string, string>): number {
  const out = join(mkdtempSync(join(tmpdir(), 'bundle-')), 'content-files.ts');
  const childEnv = { ...process.env, ...env };
  if (!('EXPO_PUBLIC_SUPABASE_URL' in env)) delete childEnv.EXPO_PUBLIC_SUPABASE_URL;
  execFileSync('node', [script, out, ...args], { env: childEnv, stdio: 'pipe' });
  const source = readFileSync(out, 'utf8');
  const json = JSON.parse(JSON.parse(/JSON\.parse\((".*")\)/s.exec(source)?.[1] ?? '""'));
  return (json.files as unknown[]).length;
}

describe('Inhalts-Bündel der App (scripts/bundle-content.mjs)', () => {
  // 239 Übungen (inkl. 16 Aufwärm-/Dehn-Entwürfe der Trainings-Modi, 74 Entwürfe Calisthenics/Schlingentrainer/
  // Lauf-ABC, 2 Entwürfe Rudern, 50 Posen Yoga/Pilates/Mobility und 17 Hyrox-Entwürfe – Sportarten Stufe 1)
  // + 49 Vorlagen (Körpergewicht K1/K2, 7 Entwürfe Calisthenics/Schlingentrainer).
  it('Testmodus-Build: alle Inhalte; mit Supabase-Werten und --empty-if-supabase: leer (keine Entwürfe im Build)', () => {
    expect(bundle(['--empty-if-supabase'], {})).toBe(322);
    expect(
      bundle(['--empty-if-supabase'], { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }),
    ).toBe(0);
    // Website (ohne Schalter) bündelt immer alles – der Redaktionsbereich braucht die Entwürfe.
    expect(bundle([], { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBe(322);
  });
});
