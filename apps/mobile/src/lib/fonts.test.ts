import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fontFamily } from '@fitnessapp/ui';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(APP_DIR, 'package.json'));

/** Schrift: lokal ausgeliefert, passend zu theme.css, kein Google-Server (DSGVO). */
describe('App-Schrift Plus Jakarta Sans', () => {
  const html = readFileSync(join(APP_DIR, 'public', 'index.html'), 'utf8');
  const nativeLoader = readFileSync(
    join(APP_DIR, 'src', 'lib', 'use-brand-fonts.native.ts'),
    'utf8',
  );

  it('Browser: @font-face mit lokaler Datei und gleicher Familie wie theme.css', () => {
    expect(fontFamily.base).toBe('Plus Jakarta Sans');
    expect(html).toContain(`font-family: '${fontFamily.base}'`);
    expect(html).toContain("url('/fonts/plus-jakarta-sans-latin-wght-normal.woff2')");
    expect(
      existsSync(join(APP_DIR, 'public', 'fonts', 'plus-jakarta-sans-latin-wght-normal.woff2')),
    ).toBe(true);
    expect(existsSync(join(APP_DIR, 'public', 'fonts', 'OFL-PlusJakartaSans.txt'))).toBe(true);
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('iPhone/Android: vier Stärken aus dem Paket, nur einzeln eingebunden', () => {
    const files = [...nativeLoader.matchAll(/require\('([^']+\.ttf)'\)/g)].map((m) => m[1] ?? '');
    expect(files).toHaveLength(4);
    for (const file of files) {
      expect(existsSync(require.resolve(file))).toBe(true);
    }
    expect(nativeLoader).not.toContain("from '@expo-google-fonts/plus-jakarta-sans'");
  });
});
