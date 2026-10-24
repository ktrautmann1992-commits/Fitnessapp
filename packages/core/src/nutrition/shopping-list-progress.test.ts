import { describe, expect, it } from 'vitest';

import { shoppingListProgress } from './shopping-list-store';

describe('shoppingListProgress (Kopf „Einkaufen“)', () => {
  it('leere Liste → 0 von 0, Anteil 0', () => {
    expect(shoppingListProgress([])).toEqual({ checked: 0, total: 0, fraction: 0 });
  });

  it('teilweise abgehakt', () => {
    expect(
      shoppingListProgress([{ checked: true }, { checked: false }, { checked: false }]),
    ).toEqual({ checked: 1, total: 3, fraction: 1 / 3 });
  });

  it('alles abgehakt → Anteil 1', () => {
    expect(shoppingListProgress([{ checked: true }, { checked: true }])).toMatchObject({
      checked: 2,
      fraction: 1,
    });
  });

  it('eine einzelne Zutat', () => {
    expect(shoppingListProgress([{ checked: false }])).toEqual({
      checked: 0,
      total: 1,
      fraction: 0,
    });
  });
});
