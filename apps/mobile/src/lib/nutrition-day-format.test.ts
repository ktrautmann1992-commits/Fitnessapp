import { calorieRing, macroProgress } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  macroText,
  mealCardKcalText,
  mealCardPreview,
  mealCardTitle,
  percentText,
  ringCenterText,
} from './nutrition-day-format';

/** Tagesübersicht Ernährung: Texte und Ansagen in Worten, neutrale Sprache bei „zu viel“. */

function ring(target: number, eaten: number) {
  const r = calorieRing({ targetKcal: target, eatenKcal: eaten });
  if (r.kind !== 'ring') throw new Error('Ring erwartet');
  return r;
}

describe('ringCenterText', () => {
  it('übrig mit Tausenderpunkt und Ansage in Worten', () => {
    expect(ringCenterText(ring(2869, 1478), false)).toEqual({
      value: '1.391',
      label: 'übrig',
      a11y: '1.391 kcal übrig von 2.869 kcal Tagesziel. Gegessen: 1.478 kcal.',
    });
  });

  it('zu viel: neutrale Zahl, keine Wertung', () => {
    const text = ringCenterText(ring(2000, 2350), false);
    expect(text.value).toBe('350');
    expect(text.label).toBe('zu viel');
    expect(text.a11y).toBe(
      '350 kcal mehr als dein Tagesziel von 2.000 kcal. Gegessen: 2.350 kcal.',
    );
    expect(text.a11y).not.toMatch(/schlecht|leider|Achtung|überschritten/i);
  });

  it('genau erreicht', () => {
    expect(ringCenterText(ring(1800, 1800), false)).toMatchObject({
      value: '0',
      a11y: 'Tagesziel von 1.800 kcal erreicht.',
    });
  });

  it('künftiger Tag: nur das Ziel', () => {
    expect(ringCenterText(ring(2100, 0), true)).toEqual({
      value: '2.100',
      label: 'Tagesziel',
      a11y: 'Tagesziel: 2.100 kcal. Noch nichts eingetragen.',
    });
  });
});

describe('macroText', () => {
  it('„47 / 222 g“', () => {
    const macro = macroProgress(47.2, 222);
    if (!macro) throw new Error('Makro erwartet');
    expect(macroText('Eiweiß', macro)).toEqual({
      value: '47 / 222 g',
      a11y: 'Eiweiß: 47 von 222 Gramm gegessen',
    });
  });

  it('über dem Ziel: Ansage nennt es in Worten (Ring wird rot, Farbe nie allein)', () => {
    const macro = macroProgress(180, 140);
    if (!macro) throw new Error('Makro erwartet');
    expect(macroText('Eiweiß', macro)).toEqual({
      value: '180 / 140 g',
      a11y: 'Eiweiß: 180 von 140 Gramm gegessen, über dem Ziel',
    });
  });

  it('genau am Ziel ist nicht „über dem Ziel“', () => {
    const macro = macroProgress(140, 140);
    if (!macro) throw new Error('Makro erwartet');
    expect(macroText('Eiweiß', macro).a11y).toBe('Eiweiß: 140 von 140 Gramm gegessen');
  });
});

describe('percentText', () => {
  it('ganze Prozent, gekappt und abgesichert', () => {
    expect(percentText(0)).toBe('0 %');
    expect(percentText(129)).toBe('129 %');
    expect(percentText(999)).toBe('999 %');
    expect(percentText(1000)).toBe('>999 %');
    expect(percentText(Number.NaN)).toBe('0 %');
    expect(percentText(-3)).toBe('0 %');
  });
});

describe('Mahlzeiten-Karten', () => {
  it('Titel; Hauptmahlzeit bei einer Mahlzeit am Tag', () => {
    expect(mealCardTitle('breakfast', false)).toBe('Frühstück');
    expect(mealCardTitle('lunch', false)).toBe('Mittagessen');
    expect(mealCardTitle('lunch', true)).toBe('Hauptmahlzeit');
    expect(mealCardTitle('dinner', true)).toBe('Abendessen');
    expect(mealCardTitle('snacks', false)).toBe('Snacks');
  });

  it('kcal-Zeile mit und ohne Ziel', () => {
    expect(mealCardKcalText('Frühstück', 317, 606)).toEqual({
      value: '317 / 606 kcal',
      a11y: 'Frühstück: 317 von 606 kcal gegessen',
    });
    expect(mealCardKcalText('Snacks', 1200, null)).toEqual({
      value: '1.200 kcal',
      a11y: 'Snacks: 1.200 kcal gegessen',
    });
  });

  it('Vorschau: höchstens drei Titel', () => {
    expect(mealCardPreview([])).toBe('Noch nichts eingetragen');
    expect(mealCardPreview(['Banane'])).toBe('Banane');
    expect(mealCardPreview(['A', 'B', 'C', 'D'])).toBe('A, B, C …');
  });
});
