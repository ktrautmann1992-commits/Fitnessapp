import { nutritionStepSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { toggleFoodPreference, withoutIntolerances } from './food-preferences';

describe('toggleFoodPreference', () => {
  it('„mag ich“ und „mag ich nicht“ schließen sich aus, Unverträglichkeit bleibt', () => {
    let prefs = toggleFoodPreference([], 'fish', 'like');
    prefs = toggleFoodPreference(prefs, 'fish', 'intolerance');
    prefs = toggleFoodPreference(prefs, 'fish', 'dislike');
    expect(prefs).toEqual([
      { foodGroup: 'fish', kind: 'intolerance' },
      { foodGroup: 'fish', kind: 'dislike' },
    ]);
    // Ergebnis ist immer gültig für das Schema aus packages/core.
    expect(
      nutritionStepSchema.safeParse({
        dietType: 'omnivore',
        mealsPerDay: 3,
        foodPreferences: prefs,
      }).success,
    ).toBe(true);
  });

  it('nochmal tippen entfernt, andere Gruppen bleiben unberührt', () => {
    const prefs = toggleFoodPreference(
      [
        { foodGroup: 'fish', kind: 'like' },
        { foodGroup: 'eggs', kind: 'dislike' },
      ],
      'fish',
      'like',
    );
    expect(prefs).toEqual([{ foodGroup: 'eggs', kind: 'dislike' }]);
  });

  it('withoutIntolerances entfernt nur Unverträglichkeiten', () => {
    expect(
      withoutIntolerances([
        { foodGroup: 'peanuts', kind: 'intolerance' },
        { foodGroup: 'eggs', kind: 'like' },
      ]),
    ).toEqual([{ foodGroup: 'eggs', kind: 'like' }]);
  });
});
