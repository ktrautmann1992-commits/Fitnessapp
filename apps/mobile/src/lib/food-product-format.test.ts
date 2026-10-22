import { describe, expect, it } from 'vitest';

import type { ScanNutrition } from '@fitnessapp/core';

import { t } from '@/i18n';

import {
  PER100_ROWS,
  per100Text,
  SCAN_PER100_ROWS,
  scanNutritionView,
} from './food-product-format';

const per100 = {
  kcal: 380,
  protein_g: 10,
  carbs_g: 60,
  fat_g: 9,
  sugar_g: 15,
  sat_fat_g: 1.5,
  fiber_g: 8,
  salt_g: 0.1,
};

const product = (level: 'ok' | 'review' | 'blocked', mock = false): ScanNutrition => ({
  source: 'product',
  baseUnit: 'g',
  per100,
  check: { level, reasons: [] },
  mock,
  retrievedAt: '2026-10-20T10:00:00.000Z',
});

const own: ScanNutrition = { source: 'own', baseUnit: 'ml', per100 };

const catalog: ScanNutrition = {
  source: 'catalog',
  baseUnit: 'g',
  per100,
  foodSource: {
    db: 'bls',
    version: '4.0',
    ref: 'C130000',
    name: 'Haferflocken',
    category: 'cereal_products',
    license: 'CC BY 4.0',
    retrieved_at: '2026-01-01',
  },
};

describe('SCAN_PER100_ROWS', () => {
  it('kompakt: Energie, Eiweiß, Kohlenhydrate, davon Zucker, Fett, Salz – in der Reihenfolge der Produktansicht', () => {
    expect(SCAN_PER100_ROWS).toEqual([
      'kcal',
      'protein_g',
      'carbs_g',
      'sugar_g',
      'fat_g',
      'salt_g',
    ]);
    const order = SCAN_PER100_ROWS.map((k) => PER100_ROWS.indexOf(k));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('fehlende Werte als „–“, nie als 0', () => {
    expect(per100Text('sugar_g', null)).toBe('–');
    expect(per100Text('kcal', 380)).toBe('380 kcal');
    expect(per100Text('salt_g', 0.1)).toBe('0,1 g');
  });
});

describe('scanNutritionView', () => {
  it('Produktabfrage ok: Zahlen, Quelle Open Food Facts mit Lizenz-Link, kein Hinweis', () => {
    const view = scanNutritionView(product('ok'), true, false);
    expect(view.title).toBe('Nährwerte je 100 g');
    expect(view.showValues).toBe(true);
    expect(view.hiddenNote).toBeNull();
    expect(view.notice).toBeNull();
    expect(view.mockNote).toBeNull();
    expect(view.sourceText).toContain('Open Food Facts');
    expect(view.sourceText).toContain('ODbL');
    expect(view.sourceText).toContain('20.10.2026');
    expect(view.licenseLink).toBe(true);
  });

  it('Testmodus: Hinweis auf die Attrappe', () => {
    expect(scanNutritionView(product('ok', true), true, false).mockNote).toBe(
      t.foodProduct.mockNote,
    );
  });

  it('prüfen: Zahlen mit Hinweis „bitte prüfen“; ohne Zahlen der Satz ohne Nährwerte', () => {
    const view = scanNutritionView(product('review'), true, false);
    expect(view.showValues).toBe(true);
    expect(view.notice).toEqual({
      kind: 'review',
      text: t.nutrition.shopping.scan.nutritionReview,
    });
    expect(view.notice?.text).toContain('Bitte prüfen');
    const hidden = scanNutritionView(product('review'), false, false);
    expect(hidden.showValues).toBe(false);
    expect(hidden.notice?.text).toBe(t.foodProduct.reviewNoNumbers);
  });

  it('gesperrt: nie Zahlen, nur Hinweis', () => {
    const view = scanNutritionView(product('blocked'), true, false);
    expect(view.showValues).toBe(false);
    expect(view.hiddenNote).toBeNull();
    expect(view.notice).toEqual({ kind: 'blocked', text: t.foodProduct.blocked });
    expect(scanNutritionView(product('blocked'), false, false).notice?.text).toBe(
      t.foodProduct.blockedNoNumbers,
    );
  });

  it('„Kalorienzahlen aus“: keine Zahlen, kurzer Hinweis – für jede Quelle', () => {
    for (const n of [product('ok'), own, catalog]) {
      const view = scanNutritionView(n, false, false);
      expect(view.showValues).toBe(false);
      expect(view.hiddenNote).toBe(t.foodProduct.numbersHidden);
    }
  });

  it('eigenes Produkt: „Deine Angaben“, Einheit ml, kein Lizenz-Link', () => {
    const view = scanNutritionView(own, true, false);
    expect(view.title).toBe('Nährwerte je 100 ml');
    expect(view.sourceText).toBe('Deine Angaben – nur für dich sichtbar.');
    expect(view.licenseLink).toBe(false);
    expect(view.notice).toBeNull();
  });

  it('Katalog-Lebensmittel: BLS-Quelle; Beispiel-Inhalte → Testwerte-Hinweis', () => {
    const view = scanNutritionView(catalog, true, false);
    expect(view.sourceText).toContain('Bundeslebensmittelschlüssel (BLS) 4.0');
    expect(view.sourceText).toContain('CC BY 4.0');
    expect(view.licenseLink).toBe(false);
    expect(scanNutritionView(catalog, true, true).sourceText).toBe(t.nutrition.demoSource);
  });
});
