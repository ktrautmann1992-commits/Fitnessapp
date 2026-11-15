import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  checkExercisePhotoManifest,
  EXERCISE_PHOTOS_ASSET_DIR,
  EXERCISE_PHOTOS_IMPORTED,
  EXERCISE_PHOTOS_MANIFEST,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

/** Übungsfotos (docs/UEBUNGSFOTOS.md): Das echte Manifest ist gültig und nennt nur vorhandene Übungen. */

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exerciseIds = new Set(
  readdirSync(`${root}content/exercises`)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, '')),
);
const readJson = (path: string): unknown => JSON.parse(readFileSync(`${root}${path}`, 'utf8'));

describe(EXERCISE_PHOTOS_MANIFEST, () => {
  it('ist gültig: bekannte Übungs-IDs, https-Adressen, UUIDs', () => {
    expect(checkExercisePhotoManifest(readJson(EXERCISE_PHOTOS_MANIFEST), exerciseIds)).toEqual([]);
  });

  it('übernommene Bilder liegen als Paar Start/Ende im App-Ordner', () => {
    const imported = readJson(EXERCISE_PHOTOS_IMPORTED) as Record<string, unknown>;
    const dir = `${root}${EXERCISE_PHOTOS_ASSET_DIR}`;
    const files = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.webp')) : [];
    for (const id of Object.keys(imported)) {
      expect(files, id).toContain(`${id}-start.webp`);
      expect(files, id).toContain(`${id}-end.webp`);
    }
    for (const name of files) {
      expect(name).toMatch(/^[a-z0-9-]+-(start|end)\.webp$/);
      expect(exerciseIds.has(name.replace(/-(start|end)\.webp$/, '')), name).toBe(true);
    }
  });
});
