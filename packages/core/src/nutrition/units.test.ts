import { describe, expect, it } from 'vitest';

import { PINCH_G } from '../constants';
import {
  gramsPerUnit,
  isUnitConvertible,
  RECIPE_UNITS,
  roundAmount,
  toGrams,
  unitLabelDe,
} from './units';

const milk = { ml_to_g: 1.03, tbsp_g: 15 };

describe('gramsPerUnit / toGrams', () => {
  it('Gramm immer, Prise fest, sonst aus dem Lebensmittel', () => {
    expect(gramsPerUnit('g', {})).toBe(1);
    expect(gramsPerUnit('pinch', {})).toBe(PINCH_G);
    expect(gramsPerUnit('ml', milk)).toBe(1.03);
    expect(gramsPerUnit('tbsp', milk)).toBe(15);
    expect(gramsPerUnit('piece', { piece_g: 60 })).toBe(60);
    expect(gramsPerUnit('tsp', { tsp_g: 4 })).toBe(4);
  });

  it('fehlende Umrechnung → null (Regel R2)', () => {
    expect(gramsPerUnit('ml', {})).toBeNull();
    expect(gramsPerUnit('piece', milk)).toBeNull();
    expect(isUnitConvertible('tsp', milk)).toBe(false);
    expect(isUnitConvertible('g', {})).toBe(true);
    expect(toGrams(2, 'piece', {})).toBeNull();
  });

  it('rechnet Mengen um, auch 0 und sehr große Mengen', () => {
    expect(toGrams(250, 'ml', milk)).toBeCloseTo(257.5, 10);
    expect(toGrams(0, 'tbsp', milk)).toBe(0);
    expect(toGrams(5000, 'g', {})).toBe(5000);
    expect(toGrams(3, 'pinch', {})).toBeCloseTo(1.5, 10);
  });

  it('ungültige Eingaben werden abgelehnt (Zod)', () => {
    expect(() => toGrams(-1, 'g', {})).toThrow();
    expect(() => toGrams(Number.NaN, 'g', {})).toThrow();
    expect(() => toGrams(1, 'kg' as never, {})).toThrow();
  });
});

describe('roundAmount (Plan 6.2)', () => {
  it('Gramm/ml auf 5, unter 20 auf 1', () => {
    expect(roundAmount(123, 'g')).toBe(125);
    expect(roundAmount(122.4, 'ml')).toBe(120);
    expect(roundAmount(19.4, 'g')).toBe(19);
    expect(roundAmount(20, 'g')).toBe(20);
    expect(roundAmount(0.3, 'g')).toBe(1);
  });
  it('Stück auf ½, Eier ganz; EL/TL auf ½; Prise ganz', () => {
    expect(roundAmount(1.3, 'piece')).toBe(1.5);
    expect(roundAmount(1.2, 'piece')).toBe(1);
    expect(roundAmount(1.5, 'piece', { wholePieces: true })).toBe(2);
    expect(roundAmount(0.2, 'piece', { wholePieces: true })).toBe(1);
    expect(roundAmount(0.7, 'tbsp')).toBe(0.5);
    expect(roundAmount(1.8, 'tsp')).toBe(2);
    expect(roundAmount(1.4, 'pinch')).toBe(1);
  });
  it('0 bleibt 0, alles andere wird nie zu 0', () => {
    for (const unit of RECIPE_UNITS) {
      expect(roundAmount(0, unit)).toBe(0);
      expect(roundAmount(0.01, unit)).toBeGreaterThan(0);
    }
  });
  it('keine Gleitkomma-Reste', () => {
    expect(roundAmount(0.1 + 0.2 + 1, 'tbsp')).toBe(1.5);
    expect(String(roundAmount(2.25, 'tsp'))).toMatch(/^\d+(\.5)?$/);
  });
});

describe('unitLabelDe', () => {
  it('Prise/Prisen, sonst Kurzform', () => {
    expect(unitLabelDe('pinch', 1)).toBe('Prise');
    expect(unitLabelDe('pinch', 2)).toBe('Prisen');
    expect(unitLabelDe('tbsp', 2)).toBe('EL');
    expect(unitLabelDe('piece', 1)).toBe('Stück');
  });
});
