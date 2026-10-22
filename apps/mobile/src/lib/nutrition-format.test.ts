import { describe, expect, it } from 'vitest';

import {
  CALORIE_CAP_CODES,
  MEAL_PLAN_NOTICE_CODES,
  NUTRITION_NOTICE_CODES,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import {
  containsText,
  countdownText,
  noticeText,
  formatAmount,
  formatKcal,
  formatNumberDe,
  shoppingCategoryLabel,
  shoppingItemText,
  visibleNotices,
} from './nutrition-format';

describe('Ernährung: Zahlen und Bausteine im deutschen Format (8.4)', () => {
  it('kcal mit Tausenderpunkt, Dezimalzahlen mit Komma', () => {
    expect(formatKcal(2150)).toBe('2.150');
    expect(formatKcal(1910)).toBe('1.910');
    expect(formatKcal(980.4)).toBe('980');
    expect(formatKcal(12345)).toBe('12.345');
    expect(formatNumberDe(1.5)).toBe('1,5');
    expect(formatNumberDe(0.333)).toBe('0,33');
    expect(formatNumberDe(2)).toBe('2');
  });

  it('Mengen mit Einheit („1,5 EL“, „2 Prisen“)', () => {
    expect(formatAmount(1.5, 'tbsp')).toBe('1,5 EL');
    expect(formatAmount(150, 'g')).toBe('150 g');
    expect(formatAmount(2, 'pinch')).toBe('2 Prisen');
    expect(formatAmount(1, 'pinch')).toBe('1 Prise');
  });

  it('„Enthält“ mit Kokos (K11); ohne Gruppen eigener Text', () => {
    expect(containsText({ groups: ['peanuts'], coconut: true })).toBe('Enthält: Erdnüsse, Kokos');
    expect(containsText({ groups: [], coconut: false })).toBe(
      'Enthält keine der erfassten Allergen-Gruppen.',
    );
  });

  it('„Kalorienzahlen anzeigen“ aus: Hinweise mit Zielzahlen entfallen, Sicherheitshinweise bleiben', () => {
    const notices = [
      'carbs_below_reference',
      'pregnancy_no_targets',
      'long_session_fueling',
    ] as const;
    expect(visibleNotices(notices, true)).toEqual([...notices]);
    expect(visibleNotices(notices, false)).toEqual([
      'pregnancy_no_targets',
      'long_session_fueling',
    ]);
  });

  it('„Zahlen aus“ (S3/K9): kein sichtbarer Hinweis nennt kcal, Gramm oder einen BMI-Wert – systematisch über alle Codes', () => {
    const numbers = /\d[\d.,–\s]*(kcal|g)\b|BMI/;
    for (const code of visibleNotices(NUTRITION_NOTICE_CODES, false)) {
      expect(noticeText(code, false), code).not.toMatch(numbers);
    }
    for (const code of MEAL_PLAN_NOTICE_CODES) {
      expect(t.nutrition.planNotices[code], code).not.toMatch(numbers);
    }
    // Mit Zahlen bleiben die genauen Fassungen.
    expect(noticeText('long_session_fueling', true)).toContain('30–60 g');
    expect(noticeText('underweight', true)).toContain('18,5');
    // Schutzgrenzen werden bei „Zahlen aus“ gar nicht gezeigt; sie nennen ohnehin keine kcal.
    for (const cap of CALORIE_CAP_CODES) {
      expect(t.nutrition.caps[cap], cap).not.toMatch(/kcal/);
    }
  });
});

describe('Einkaufsliste: Einträge als Text (Etappe N5b)', () => {
  it('Frisches in Einkaufs-Einheiten mit Grammzahl dahinter', () => {
    const fresh = (foodId: string, amount: number, labelDe: string) =>
      shoppingItemText({ amount, unit: 'g', labelDe, isManual: false, foodId });
    expect(fresh('zwiebel', 450, 'Zwiebel')).toBe('5 Zwiebeln (450 g)');
    expect(fresh('knoblauch', 60, 'Knoblauch')).toBe('1 Knolle Knoblauch (60 g)');
    expect(fresh('petersilie-frisch', 40, 'Petersilie (frisch)')).toBe('1 Bund Petersilie (40 g)');
    expect(fresh('haferflocken', 500, 'Haferflocken')).toBe('500 g Haferflocken');
  });

  it('Menge mit Einheit, „nach Geschmack“, eigener Eintrag ohne Menge, Abteilung', () => {
    expect(
      shoppingItemText({ amount: 500, unit: 'g', labelDe: 'Haferflocken', isManual: false }),
    ).toBe('500 g Haferflocken');
    expect(
      shoppingItemText({ amount: 3, unit: 'piece', labelDe: 'Bananen', isManual: false }),
    ).toBe('3 Stück Bananen');
    expect(shoppingItemText({ amount: null, unit: null, labelDe: 'Salz', isManual: false })).toBe(
      'Salz – nach Geschmack',
    );
    expect(shoppingItemText({ amount: null, unit: null, labelDe: 'Kaffee', isManual: true })).toBe(
      'Kaffee',
    );
    expect(shoppingCategoryLabel('fruit_vegetables')).toBe('Obst & Gemüse');
  });
});

describe('Kochtag-Timer: Restzeit', () => {
  it('Minuten:Sekunden, Stunden nur wenn nötig, nie negativ', () => {
    expect(countdownText(45)).toBe('0:45');
    expect(countdownText(245)).toBe('4:05');
    expect(countdownText(3720)).toBe('1:02:00');
    expect(countdownText(-3)).toBe('0:00');
  });
});
