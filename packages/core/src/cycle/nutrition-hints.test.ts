import { describe, expect, it } from 'vitest';

import { cycleNutritionHints } from './nutrition-hints';
import { entry } from './test-helpers';

describe('Ernährungs-Hinweise ohne Zahlen (Plan 3.5)', () => {
  it('starke Blutung → Eisen (vegan/vegetarisch ohne Fleisch) und Trinken', () => {
    const today = entry('2026-10-21', { bleeding: 'heavy' });
    expect(cycleNutritionHints(today, [], 'omnivore')).toEqual(['iron', 'drink']);
    expect(cycleNutritionHints(today, [], 'vegan')).toEqual(['iron_plant', 'drink']);
    expect(cycleNutritionHints(today, [], 'vegetarian')).toEqual(['iron_plant', 'drink']);
    expect(cycleNutritionHints(today, [], null)).toEqual(['iron', 'drink']);
  });

  it('Eisen höchstens einmal je Zyklus: weggetippt in dieser Periode → nicht erneut', () => {
    const recent = [entry('2026-10-19', { bleeding: 'medium' })];
    const today = entry('2026-10-21', { bleeding: 'heavy' });
    expect(
      cycleNutritionHints(today, recent, 'omnivore', { ironDismissedOn: '2026-10-20' }),
    ).toEqual(['drink']);
    // weggetippt in der vorigen Periode → wieder
    expect(
      cycleNutritionHints(today, recent, 'omnivore', { ironDismissedOn: '2026-09-20' }),
    ).toEqual(['iron', 'drink']);
  });

  it('W4 aktiv → Eisen-Hinweis auch ohne starke Blutung heute', () => {
    const today = entry('2026-10-21', { energy: 3 });
    expect(cycleNutritionHints(today, [], 'omnivore', { heavyBleedingWarning: true })).toEqual([
      'iron',
    ]);
  });

  it('Trinken bei mittlerer Blutung oder Kopfschmerzen; sonst nichts', () => {
    expect(cycleNutritionHints(entry('2026-10-21', { bleeding: 'medium' }), [], 'vegan')).toEqual([
      'drink',
    ]);
    expect(
      cycleNutritionHints(entry('2026-10-21', { symptoms: { headache: 'mild' } }), [], 'vegan'),
    ).toEqual(['drink']);
    expect(cycleNutritionHints(entry('2026-10-21', { bleeding: 'light' }), [], 'vegan')).toEqual(
      [],
    );
    expect(cycleNutritionHints(null, [], 'vegan')).toEqual([]);
  });
});
