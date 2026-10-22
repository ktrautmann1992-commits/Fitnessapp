import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MUSCLE_TILE_IDS } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

/**
 * Muskelgruppen-Bilder: jede Kachel hat eine Bilddatei und einen Eintrag in data/muscle-tiles.ts (die Datei selbst
 * nutzt require() für Metro und wird deshalb hier als Text geprüft).
 */
const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '../../assets/muscle-groups');
const registry = readFileSync(join(here, 'muscle-tiles.ts'), 'utf8');

describe('MUSCLE_TILE_IMAGES', () => {
  it.each(MUSCLE_TILE_IDS)('%s: Datei vorhanden und eingetragen', (tile) => {
    expect(existsSync(join(assets, `${tile}.webp`))).toBe(true);
    expect(registry).toContain(`require('../../assets/muscle-groups/${tile}.webp')`);
  });

  it('Bilder bleiben klein (je unter 150 KB)', () => {
    for (const tile of MUSCLE_TILE_IDS) {
      expect(readFileSync(join(assets, `${tile}.webp`)).byteLength).toBeLessThan(150_000);
    }
  });
});
