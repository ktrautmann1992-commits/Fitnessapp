import { dayIntakeView } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  buildErrorText,
  confirmText,
  entryAmountText,
  entryDetailText,
  foodLogDayText,
  intakeSummaryText,
  manualSlotOf,
  portionNumber,
  portionText,
} from './food-log-format';

describe('Anzeige des Ernährungstagebuchs (E1)', () => {
  it('Portionen als Brüche', () => {
    expect(portionNumber(0.75)).toBe('¾');
    expect(portionNumber(1.5)).toBe('1½');
    expect(portionNumber(2)).toBe('2');
    expect(portionText(1)).toBe('1 Portion');
    expect(portionText(0.5)).toBe('½ Portion');
    expect(portionText(2)).toBe('2 Portionen');
    expect(portionText(1.25)).toBe('1¼ Portionen');
  });

  it('Menge und Detailzeile; ohne Zahlen keine kcal', () => {
    const banana = {
      amount: 1,
      unit: 'piece' as const,
      portion: null,
      kcal: 112,
      source: 'food' as const,
    };
    expect(entryAmountText(banana)).toBe('1 Stück');
    expect(entryAmountText({ amount: 150.5, unit: 'g', portion: null })).toBe('150,5 g');
    expect(entryDetailText(banana, true)).toBe('1 Stück · 112 kcal');
    expect(entryDetailText(banana, false)).toBe('1 Stück');
    expect(
      entryDetailText(
        { amount: null, unit: null, portion: 0.75, kcal: 1500, source: 'plan_item' },
        false,
      ),
    ).toBe('¾ Portion · aus deinem Essensplan');
    expect(
      entryDetailText(
        { amount: null, unit: null, portion: null, kcal: 1700, source: 'quick' },
        true,
      ),
    ).toBe('1.700 kcal');
  });

  it('Tagessumme: mit Zahlen kcal, ohne Zahlen nur die Anzahl', () => {
    const entries = [
      { kcal: 700, protein_g: null, carbs_g: null, fat_g: null },
      { kcal: 600, protein_g: 20, carbs_g: 80, fat_g: 10 },
    ];
    expect(intakeSummaryText(dayIntakeView(entries, true))).toBe('2 Einträge · 1.300 kcal');
    expect(intakeSummaryText(dayIntakeView(entries, false))).toBe('2 Einträge');
    expect(intakeSummaryText(dayIntakeView(entries.slice(0, 1), false))).toBe('1 Eintrag');
  });

  it('Tag als Text und Platz der Auswahl', () => {
    expect(foodLogDayText('2026-10-15', '2026-10-15')).toBe('Heute');
    expect(foodLogDayText('2026-10-14', '2026-10-15')).toBe('Gestern');
    expect(foodLogDayText('2026-10-12', '2026-10-15')).toMatch(/12\.10\./);
    expect(manualSlotOf('snack_morning')).toBe('other');
    expect(manualSlotOf('extra_1')).toBe('other');
    expect(manualSlotOf('lunch')).toBe('lunch');
    expect(manualSlotOf('main')).toBe('other');
  });
});

describe('Zahlen aus und Schwangerschaft: keine kcal in Fehlern und Rückfragen (Wächter E1 S3/G2)', () => {
  it('Fehlertexte nennen nie kcal', () => {
    for (const reason of ['amount', 'unit', 'portion', 'invalid', 'too_much'] as const) {
      expect(buildErrorText(reason)).not.toMatch(/kcal|Kalorien|3\.000/);
    }
    expect(buildErrorText('too_much')).toBe('Diese Menge ist ungewöhnlich groß – bitte prüfen.');
  });
  it('Rückfrage neutral: ohne Zahlen nur die Menge, mit Zahlen Menge und kcal; keine Bewertung', () => {
    const entry = { amount: 750, unit: 'g' as const, portion: null, kcal: 1650 };
    expect(confirmText(entry, false)).toBe('Stimmen Menge und Einheit: 750 g?');
    expect(confirmText(entry, true)).toBe('Stimmen Menge und Einheit: 750 g, 1.650 kcal?');
    expect(confirmText({ amount: null, unit: null, portion: null, kcal: 1600 }, false)).toBe(
      'Stimmen Menge und Einheit?',
    );
    for (const text of [confirmText(entry, false), confirmText(entry, true)]) {
      expect(text).not.toMatch(/groß|viel/);
    }
  });
});
