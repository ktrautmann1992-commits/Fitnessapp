import type { TimelineEntry } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  adjustmentLines,
  entryA11y,
  entryWindow,
  extraLine,
  fuelingLines,
  mealLine,
  portionLabel,
  sessionTimeText,
  timingNoticeText,
  valuesLine,
} from './training-timeline-format';

const entry = (patch: Partial<TimelineEntry> = {}): TimelineEntry => ({
  key: 'k',
  kind: 'pre_meal',
  fromMinutes: 840,
  toMinutes: 960,
  approx: false,
  reason: 'pre_meal',
  meal: {
    slot: 'lunch',
    recipeId: 'r',
    titleDe: 'Hähnchen-Reis-Pfanne',
    factor: 1,
    values: { kcal: 600, proteinG: 35, carbsG: 75, fatG: 12 },
    status: 'fits',
    chosen: false,
  },
  extra: null,
  extraKind: null,
  session: null,
  ...patch,
});

describe('Zeitleiste „Essen rund ums Training“ – Texte', () => {
  it('Zeitfenster mit/ohne „ca.“, danach „bis“', () => {
    expect(entryWindow(entry())).toBe('14:00–16:00');
    expect(entryWindow(entry({ approx: true }))).toBe('ca. 14:00–16:00');
    expect(entryWindow(entry({ kind: 'post_meal', fromMinutes: 1140, toMinutes: 1260 }))).toBe(
      'bis 21:00',
    );
  });

  it('echtes Gericht mit Portion, Werte nur mit Gramm', () => {
    expect(portionLabel(1)).toBe('1 Portion');
    expect(portionLabel(1.43)).toBe('1½ Portionen');
    expect(portionLabel(0.74)).toBe('¾ Portion');
    const e = entry();
    if (e.meal === null) throw new Error();
    expect(mealLine(e.meal)).toBe('Hähnchen-Reis-Pfanne, 1 Portion');
    expect(valuesLine(e.meal)).toBe('ca. 75 g KH · 35 g Eiweiß');
    expect(valuesLine({ values: null })).toBeNull();
    expect(entryA11y(e)).toContain('Mahlzeit vor dem Training');
  });

  it('Snack/Beilage, Einheit, Richtwert unterwegs', () => {
    const extra = { recipeId: 'b', titleDe: 'Banane', values: null };
    expect(extraLine(entry({ extra, extraKind: 'snack' }))).toBe('Zum Beispiel: Banane');
    expect(extraLine(entry({ extra, extraKind: 'side' }))).toBe('+ Banane dazu');
    const session = entry({
      kind: 'session',
      meal: null,
      session: {
        sessionId: 's',
        kind: 'endurance',
        minutes: 120,
        fueling: {
          carbsGPerHour: { min: 0, max: 30 },
          drinkMlPerHour: { min: 400, max: 800 },
          testFirst: false,
        },
      },
    });
    expect(fuelingLines(session)).toEqual([
      'Unterwegs: bis 30 g Kohlenhydrate pro Stunde.',
      'Trinken: Richtwert 400–800 ml pro Stunde nach Durst – bei Hitze mehr und an Salz denken.',
    ]);
    const general = entry({
      kind: 'session',
      meal: null,
      session: {
        sessionId: 's',
        kind: 'endurance',
        minutes: 120,
        fueling: { carbsGPerHour: null, drinkMlPerHour: { min: 400, max: 800 }, testFirst: false },
      },
    });
    expect(fuelingLines(general)[0]).toBe(
      'Unterwegs: Kohlenhydrate in kleinen Mengen, z. B. eine Banane.',
    );
    expect(fuelingLines(entry())).toEqual([]);
  });

  it('Hinweis, Anpassung nach dem Verschieben, Uhrzeit', () => {
    expect(
      timingNoticeText(
        {
          code: 'timing_meal_protein_low',
          slot: 'breakfast',
          titleDe: 'Toast',
          extraTitleDe: 'Joghurt',
        },
        true,
      ),
    ).toBe('Toast ist eiweißarm – z. B. Joghurt dazu.');
    expect(
      adjustmentLines(
        {
          changes: [
            {
              date: '2026-10-14',
              slot: 'lunch',
              role: 'pre',
              fromRecipeId: 'a',
              fromTitleDe: 'Curry',
              toRecipeId: 'b',
              toTitleDe: 'Reis-Pfanne',
            },
          ],
        },
        { added: ['Reis'], removed: [], changed: ['Hähnchen'] },
      ),
    ).toEqual([
      'Mahlzeiten an dein Training angepasst.',
      '1 Gericht getauscht',
      'Curry → Reis-Pfanne',
      'Einkaufsliste angepasst. 1 neu · 1 andere Menge. Abgehaktes bleibt abgehakt.',
    ]);
    expect(adjustmentLines({ changes: [] }, null)).toEqual([
      'Mahlzeiten an dein Training angepasst.',
      'Portionen an den neuen Tag angepasst.',
    ]);
    expect(sessionTimeText(1110, false)).toBe('18:30');
    expect(sessionTimeText(1050, true)).toBe('ca. 17:30 (Standard)');
  });
});
