import { describe, expect, it } from 'vitest';

import { SHOPPING_SAME_PRODUCT } from '../constants';
import {
  SHOPPING_BUY_UNITS,
  shoppingPackCombination,
  shoppingPurchase,
  shoppingSizeText,
} from './shopping-buy-units';

const buy = (
  foodId: string | null,
  amount: number | null,
  unit: 'g' | 'ml' | 'piece' | null = 'g',
  labelDe = 'Etwas',
) => shoppingPurchase({ foodId, labelDe, amount, unit });
const text = (foodId: string, amount: number | null, unit: 'g' | 'ml' | 'piece' | null = 'g') =>
  buy(foodId, amount, unit)?.text;

describe('Einkaufen wie im Laden (`shoppingPurchase`)', () => {
  it('Beispiele des Gründers: Ingwer, Kartoffeln, Karotten, Hähnchen, Quark, Milch, Eier', () => {
    expect(text('ingwer', 70)).toBe('1 Stück Ingwer');
    expect(text('kartoffeln', 1200)).toBe('1 Netz Kartoffeln (1,5 kg)');
    expect(text('kartoffeln', 1900)).toBe('1 Netz Kartoffeln (2 kg)');
    expect(text('kartoffeln', 2400)).toBe('1 Netz Kartoffeln (2,5 kg)');
    expect(text('karotten', 450)).toBe('1 Beutel Karotten (500 g)');
    expect(text('karotten', 350)).toBe('1 Beutel Karotten (500 g)');
    expect(text('haehnchenbrustfilet', 900)).toBe('1 Packung Hähnchenbrustfilet (1 kg)');
    expect(text('haehnchenbrustfilet', 1200)).toBe('2 Packungen Hähnchenbrustfilet (à 600 g)');
    expect(text('magerquark', 500)).toBe('1 Becher Magerquark (500 g)');
    expect(text('milch-1-5', 600)).toBe('1 Packung Milch 1,5 % (1 l)');
    expect(text('haferflocken', 300)).toBe('1 Packung Haferflocken (500 g)');
    expect(text('basmatireis-trocken', 800)).toBe('1 Packung Basmatireis (1 kg)');
    expect(text('joghurt-1-5', 400)).toBe('1 Becher Joghurt 1,5 % (500 g)');
    expect(text('huehnerei', 180)).toBe('1 Packung Eier (6 Stück)');
    expect(text('huehnerei', 480)).toBe('1 Packung Eier (10 Stück)');
    expect(text('passierte-tomaten', 400)).toBe('1 Packung Passierte Tomaten (500 g)');
    expect(text('kichererbsen-dose-abgetropft', 240)).toBe('1 Dose Kichererbsen (400 g)');
    expect(text('kichererbsen-dose-abgetropft', 400)).toBe('2 Dosen Kichererbsen (à 400 g)');
    expect(text('feta', 150)).toBe('1 Packung Feta (200 g)');
    expect(text('zitronensaft', 30)).toBe('1 Zitrone (für den Saft)');
    expect(text('zitronensaft', 80)).toBe('2 Zitronen (für den Saft)');
    expect(text('petersilie-frisch', 20)).toBe('1 Bund Petersilie');
    expect(text('basilikum', 10)).toBe('1 Topf Basilikum');
    expect(text('spinat', 300)).toBe('1 Beutel Spinat (500 g)');
    expect(text('erbsen-tk', 300)).toBe('1 Beutel TK-Erbsen (450 g)');
    expect(text('olivenoel', 30)).toBe('Olivenöl (Vorrat prüfen)');
  });

  it('Zeilen aus dem Screenshot des Gründers werden zu Kaufeinheiten', () => {
    expect(text('avocado', 150)).toBe('1 Avocado');
    expect(text('brokkoli', 1600)).toBe('4 Köpfe Brokkoli');
    expect(text('champignons', 300)).toBe('1 Schale Champignons (500 g)');
    expect(text('fruehlingszwiebeln', 30)).toBe('1 Bund Frühlingszwiebeln');
    expect(text('gurke', 950)).toBe('3 Gurken');
    expect(text('knoblauch', 60)).toBe('1 Knolle Knoblauch');
  });

  it('winziger Bedarf (5 g) → trotzdem 1 Einheit, nie 0', () => {
    expect(buy('ingwer', 5)?.count).toBe(1);
    expect(text('knoblauch', 3)).toBe('1 Knolle Knoblauch');
    expect(text('haehnchenbrustfilet', 5)).toBe('1 Packung Hähnchenbrustfilet (400 g)');
    expect(text('zwiebel', 5)).toBe('1 Zwiebel');
    expect(text('huehnerei', 5)).toBe('1 Packung Eier (6 Stück)');
  });

  it('genaues Vielfaches und knapp darüber', () => {
    expect(text('feta', 400)).toBe('2 Packungen Feta (à 200 g)');
    // Spielraum 0,1 Packung: 210 g passt noch in eine 200-g-Packung, 230 g nicht mehr.
    expect(text('feta', 210)).toBe('1 Packung Feta (200 g)');
    expect(text('feta', 230)).toBe('2 Packungen Feta (à 200 g)');
    expect(text('zwiebel', 160)).toBe('2 Zwiebeln');
    expect(text('zwiebel', 165)).toBe('2 Zwiebeln');
    expect(text('zwiebel', 180)).toBe('3 Zwiebeln');
  });

  it('mehrere Größen: möglichst wenig Rest, dann möglichst wenige Packungen', () => {
    expect(shoppingPackCombination(900, [400, 600, 1000])).toEqual([{ size: 1000, count: 1 }]);
    expect(shoppingPackCombination(1300, [400, 600, 1000])).toEqual([
      { size: 1000, count: 1 },
      { size: 400, count: 1 },
    ]);
    expect(shoppingPackCombination(4000, [1000, 1500, 2000, 2500])).toEqual([
      { size: 2000, count: 2 },
    ]);
    expect(shoppingPackCombination(700, [250, 500])).toEqual([
      { size: 500, count: 1 },
      { size: 250, count: 1 },
    ]);
    expect(text('magerquark', 700)).toBe('2 Becher Magerquark (500 g + 250 g)');
    expect(text('haehnchenbrustfilet', 1300)).toBe('2 Packungen Hähnchenbrustfilet (1 kg + 400 g)');
    expect(text('kartoffeln', 3500)).toBe('2 Netze Kartoffeln (2,5 kg + 1 kg)');
    // Sehr großer Bedarf: nur noch die größte Packung (Rechenschutz).
    expect(shoppingPackCombination(1_000_000, [400, 600, 1000])).toEqual([
      { size: 1000, count: 1000 },
    ]);
  });

  it('ml-Einträge und Packungen in ml', () => {
    expect(text('milch-1-5', 1500, 'ml')).toBe('2 Packungen Milch 1,5 % (à 1 l)');
    expect(text('sojadrink-ungesuesst', 300, 'ml')).toBe('1 Packung Sojadrink ungesüßt (1 l)');
    // Gramm → ml über die Dichte (1 l Milch ≈ 1.030 g).
    expect(text('milch-1-5', 1030)).toBe('1 Packung Milch 1,5 % (1 l)');
    expect(text('wasser', 500, 'ml')).toBe('Wasser (aus der Leitung)');
  });

  it('Stück aus Rezepten: über Gramm, wenn das Stückgewicht bekannt ist', () => {
    expect(text('apfel', 3, 'piece')).toBe('3 Äpfel');
    expect(text('huehnerei', 4, 'piece')).toBe('1 Packung Eier (6 Stück)');
    // 4 Knoblauchzehen à 5 g = 20 g → 1 Knolle (nicht 4 Knollen).
    expect(
      shoppingPurchase({ foodId: 'knoblauch', labelDe: 'Knoblauch', amount: 4, unit: 'piece' }, 5)
        ?.text,
    ).toBe('1 Knolle Knoblauch');
    expect(
      shoppingPurchase({ foodId: 'vollkorn-wrap', labelDe: 'Wrap', amount: 8, unit: 'piece' })
        ?.text,
    ).toBe('2 Packungen Vollkorn-Wraps (à 6 Stück)');
    expect(text('vollkorn-wrap', 120)).toBe('1 Packung Vollkorn-Wraps (6 Stück)');
  });

  it('Vorrat ohne Menge; „nach Geschmack“ ohne Menge', () => {
    expect(buy('salz', null, null)).toMatchObject({
      kind: 'stock',
      quantity: null,
      product: 'Salz',
      detail: 'Vorrat prüfen',
      text: 'Salz (Vorrat prüfen)',
    });
    expect(text('sojasauce', 45)).toBe('Sojasauce (Vorrat prüfen)');
    expect(buy('haferflocken', null, null)?.text).toBe('Haferflocken (nach Geschmack)');
    expect(buy('zwiebel', 0)?.text).toBe('Zwiebeln (nach Geschmack)');
    expect(buy('zwiebel', Number.NaN)?.text).toBe('Zwiebeln (nach Geschmack)');
  });

  it('eigene Einträge bleiben unverändert (null)', () => {
    expect(buy(null, 500)).toBeNull();
    expect(shoppingPurchase({ labelDe: 'Kerzen', amount: null, unit: null })).toBeNull();
  });

  it('unbekanntes Lebensmittel → sicherer Ersatz „1 Packung …“ mit Bedarf', () => {
    expect(buy('gibt-es-nicht', 350, 'g', 'Drachenfrucht')).toMatchObject({
      kind: 'fallback',
      quantity: '1 Packung',
      product: 'Drachenfrucht',
      text: '1 Packung Drachenfrucht (insgesamt 350 g)',
    });
    expect(buy('toString', 2, 'piece', 'X')?.text).toBe('1 Packung X (insgesamt 2 Stück)');
    expect(buy('gibt-es-nicht', null, null, 'Y')?.text).toBe('1 Packung Y');
  });

  it('Größen-Text', () => {
    expect(shoppingSizeText(500, 'g')).toBe('500 g');
    expect(shoppingSizeText(1500, 'g')).toBe('1,5 kg');
    expect(shoppingSizeText(1000, 'ml')).toBe('1 l');
    expect(shoppingSizeText(10, 'pcs')).toBe('10 Stück');
  });

  it('Tabelle: gültige Größen, Synonyme haben dieselbe Kaufeinheit', () => {
    for (const [id, def] of Object.entries(SHOPPING_BUY_UNITS)) {
      // Keine Klammern im Namen – die Klammer gehört der Packungsgröße („1 Beutel TK-Erbsen (450 g)“).
      expect(def.name, id).not.toMatch(/[()]/u);
      if (def.kind === 'loose') expect(def.plural, id).not.toMatch(/[()]/u);
      if (def.kind === 'pack') {
        expect(def.sizes.length, id).toBeGreaterThan(0);
        expect(
          def.sizes.every((s) => Number.isInteger(s) && s > 0),
          id,
        ).toBe(true);
        if (def.labels !== undefined) expect(def.labels.length, id).toBe(def.sizes.length);
      }
      if (def.kind === 'loose' || def.kind === 'piece') expect(def.pieceG, id).toBeGreaterThan(0);
    }
    for (const [from, to] of Object.entries(SHOPPING_SAME_PRODUCT)) {
      expect(SHOPPING_BUY_UNITS[from], from).toEqual(SHOPPING_BUY_UNITS[to]);
    }
  });

  it('jedes Lebensmittel der Tabelle ergibt bei 1 g bis 5 kg eine Kaufzeile ohne Gramm vorn', () => {
    for (const id of Object.keys(SHOPPING_BUY_UNITS)) {
      for (const amount of [1, 80, 450, 1200, 5000]) {
        const result = buy(id, amount);
        expect(result, id).not.toBeNull();
        expect(result?.kind, id).not.toBe('fallback');
        expect(result?.text, id).not.toMatch(/^\d[\d.,]* ?(g|kg|ml|l) /u);
        if (result?.kind !== 'stock') expect(result?.count, id).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
