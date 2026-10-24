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
  mealNumbersLine,
  recipeNumbersText,
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
  it('Lebensmittel in Kaufeinheiten (wie im Laden, 24.10.2026)', () => {
    const fresh = (foodId: string, amount: number, labelDe: string) =>
      shoppingItemText({ amount, unit: 'g', labelDe, isManual: false, foodId });
    expect(fresh('zwiebel', 450, 'Zwiebel')).toBe('6 Zwiebeln');
    expect(fresh('knoblauch', 60, 'Knoblauch')).toBe('1 Knolle Knoblauch');
    expect(fresh('petersilie-frisch', 40, 'Petersilie (frisch)')).toBe('1 Bund Petersilie');
    expect(fresh('haferflocken', 500, 'Haferflocken')).toBe('1 Packung Haferflocken (500 g)');
    expect(fresh('ingwer', 70, 'Ingwer')).toBe('1 Stück Ingwer');
    expect(fresh('olivenoel', 30, 'Olivenöl')).toBe('Olivenöl (Vorrat prüfen)');
    // Eigene Einträge bleiben, wie eingegeben.
    expect(
      shoppingItemText({ amount: 500, unit: 'g', labelDe: 'Hack', isManual: true, foodId: null }),
    ).toBe('500 g Hack');
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

describe('Zahlen auf Rezeptkarten und Mahlzeiten (24.10.2026)', () => {
  const nb = (text: string) => text.replace(/\u00a0/g, ' ');

  it('Rezeptkarte: kcal und „31 g Eiweiß · 40 g KH“, nie mitten in einer Angabe umbrochen', () => {
    const r = recipeNumbersText({ kcal: 482.4, protein_g: 31.2, carbs_g: 39.6 });
    expect(nb(r.kcal)).toBe('482 kcal');
    expect(nb(r.macros)).toBe('31 g Eiweiß · 40 g KH');
    expect(r.macros).toContain('31\u00a0g\u00a0Eiweiß');
    expect(r.a11y).toBe('482 Kilokalorien, 31 Gramm Eiweiß, 40 Gramm Kohlenhydrate');
  });

  it('Mahlzeit: Faktor nur, wenn gerundet nicht 1; kurz genug für eine Zeile auf 390 px', () => {
    const about = mealNumbersLine(0.98, { kcal: 669, protein_g: 44.4, carbs_g: 65 });
    expect(nb(about.text)).toBe('669 kcal · 44 g E · 65 g KH');
    expect(about.a11y).toBe(
      'Eine Portion: 669 Kilokalorien, 44 Gramm Eiweiß, 65 Gramm Kohlenhydrate',
    );
    const more = mealNumbersLine(1.27, { kcal: 870, protein_g: 55, carbs_g: 98 });
    expect(nb(more.text)).toBe('1,3× · 870 kcal · 55 g E · 98 g KH');
    expect(more.a11y).toContain('1,3-fache Portion: 870 Kilokalorien');
    // Höchstens ~35 Zeichen passen neben das Vorschaubild (390 px, Schrift „klein“); nur Extremfälle mit über
    // 1.000 kcal und dreistelligen Grammzahlen dürfen umbrechen.
    expect(more.text.length).toBeLessThanOrEqual(35);
    expect(nb(mealNumbersLine(0.5, { kcal: 300, protein_g: 0, carbs_g: 0 }).text)).toBe(
      '0,5× · 300 kcal · 0 g E · 0 g KH',
    );
  });
});
