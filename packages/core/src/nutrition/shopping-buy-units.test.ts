import { describe, expect, it } from 'vitest';

import { SHOPPING_BUY_UNITS } from '../constants';
import { shoppingBuyHint } from './shopping-buy-units';

describe('Einkaufs-Einheiten („wie im Laden“)', () => {
  it('Gramm → Stück, Bund, Knolle (aufgerundet, Spielraum 0,1)', () => {
    expect(shoppingBuyHint('zwiebel', 450, 'g')).toEqual({ count: 5, label: 'Zwiebeln' });
    expect(shoppingBuyHint('zwiebel', 110, 'g')).toEqual({ count: 1, label: 'Zwiebel' });
    expect(shoppingBuyHint('zwiebel', 120, 'g')).toEqual({ count: 2, label: 'Zwiebeln' });
    expect(shoppingBuyHint('zucchini', 900, 'g')).toEqual({ count: 4, label: 'Zucchini' });
    expect(shoppingBuyHint('petersilie-frisch', 40, 'g')).toEqual({
      count: 1,
      label: 'Bund Petersilie',
    });
    expect(shoppingBuyHint('knoblauch', 60, 'g')).toEqual({ count: 1, label: 'Knolle Knoblauch' });
    expect(shoppingBuyHint('knoblauch', 180, 'g')).toEqual({
      count: 3,
      label: 'Knollen Knoblauch',
    });
  });

  it('sehr kleine Menge ergibt nie 0 Einheiten', () => {
    expect(shoppingBuyHint('weisskohl', 10, 'g')).toEqual({ count: 1, label: 'Weißkohl' });
  });

  it('ohne Tabelleneintrag, ml, Stück, ohne Menge, eigene Einträge → keine Einkaufs-Einheit', () => {
    expect(shoppingBuyHint('haferflocken', 500, 'g')).toBeNull();
    expect(shoppingBuyHint('zwiebel', 500, 'ml')).toBeNull();
    expect(shoppingBuyHint('zwiebel', 3, 'piece')).toBeNull();
    expect(shoppingBuyHint('zwiebel', null, null)).toBeNull();
    expect(shoppingBuyHint('zwiebel', 0, 'g')).toBeNull();
    expect(shoppingBuyHint('zwiebel', Number.NaN, 'g')).toBeNull();
    expect(shoppingBuyHint(null, 500, 'g')).toBeNull();
    expect(shoppingBuyHint(undefined, 500, 'g')).toBeNull();
    expect(shoppingBuyHint('toString', 500, 'g')).toBeNull();
  });

  it('Tabelle: plausible Gewichte, Texte gesetzt', () => {
    for (const [id, def] of Object.entries(SHOPPING_BUY_UNITS)) {
      expect(def.grams, id).toBeGreaterThanOrEqual(20);
      expect(def.grams, id).toBeLessThanOrEqual(1500);
      expect(def.one.length, id).toBeGreaterThan(1);
      expect(def.many.length, id).toBeGreaterThan(1);
    }
  });
});
