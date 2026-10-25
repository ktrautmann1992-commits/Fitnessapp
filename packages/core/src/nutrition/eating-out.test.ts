/**
 * Auswärts essen (Reiter „Unterwegs“, Gründer-Freigabe 25.10.2026): Werte nur aus dem Katalog, Entwürfe ohne Werte bei
 * fehlenden Zutaten, Portionen, Rundung, Eintrag als Schnelleintrag „Auswärts gegessen“, „Zuletzt“/Favoriten.
 * Geprüft gegen den ECHTEN Katalog (content/foods), damit jede Katalog-ID der Tabelle existiert.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EATING_OUT, FOOD_LOG_LIMITS } from '../constants';
import { type Food, type FoodLookup, foodSchema } from '../content/food-schema';
import {
  EATING_OUT_CATEGORIES,
  EATING_OUT_DISHES,
  type EatingOutDishDef,
  defaultEatingOutPortion,
  eatingOutCatalog,
  eatingOutContentStatus,
  eatingOutDish,
  eatingOutDishView,
  eatingOutPortionValues,
  eatingOutPortions,
  eatingOutRawValues,
  EMPTY_EATING_OUT_PICKS,
  entryFromEatingOut,
  parseEatingOutPicks,
  roundEatingOutValues,
  toggleEatingOutFavorite,
  withEatingOutRecent,
} from './eating-out';
import { foodLogEntrySchema } from './food-log';

const foodsDir = join(__dirname, '../../../../content/foods');

function loadCatalog(): Map<string, Food> {
  const map = new Map<string, Food>();
  for (const file of readdirSync(foodsDir)) {
    if (!file.endsWith('.json') || file === 'allergen-expectations.json') continue;
    const parsed = foodSchema.safeParse(JSON.parse(readFileSync(join(foodsDir, file), 'utf8')));
    if (parsed.success) map.set(parsed.data.id, parsed.data);
  }
  return map;
}

const CATALOG: FoodLookup = loadCatalog();
const target = {
  id: '00000000-0000-4000-8000-000000000001',
  date: '2026-10-25',
  slot: 'lunch' as const,
};

/** Unabhängig gerechnete kcal einer normalen Portion (Summe Gramm × kcal/100 g). */
function kcalByHand(dish: EatingOutDishDef): number {
  return dish.items.reduce(
    (sum, [id, g]) => sum + (g * (CATALOG.get(id) as Food).nutrients_per_100g.kcal) / 100,
    0,
  );
}

describe('Tabelle der Gerichte', () => {
  it('60–120 Gerichte, eindeutige IDs, alle sechs Kategorien, jede Kategorie mit mindestens 8 Gerichten', () => {
    expect(EATING_OUT_DISHES.length).toBeGreaterThanOrEqual(60);
    expect(EATING_OUT_DISHES.length).toBeLessThanOrEqual(120);
    expect(new Set(EATING_OUT_DISHES.map((d) => d.id)).size).toBe(EATING_OUT_DISHES.length);
    for (const category of EATING_OUT_CATEGORIES) {
      expect(
        EATING_OUT_DISHES.filter((d) => d.category === category).length,
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it('jede Katalog-ID der Tabelle existiert im Katalog (keine erfundenen Lebensmittel), Mengen 1–600 g', () => {
    for (const dish of EATING_OUT_DISHES) {
      for (const [id, grams] of dish.items) {
        expect(CATALOG.has(id), `${dish.id}: ${id}`).toBe(true);
        expect(grams).toBeGreaterThan(0);
        expect(grams).toBeLessThanOrEqual(600);
      }
    }
  });

  it('ohne Zutaten nur mit fehlenden Zutaten (Entwurf); fehlende Zutaten haben Suchbegriffe', () => {
    for (const dish of EATING_OUT_DISHES) {
      if (dish.items.length === 0) expect(dish.missing?.length ?? 0).toBeGreaterThan(0);
      for (const m of dish.missing ?? []) expect(m.search_de.length).toBeGreaterThan(0);
    }
  });

  it('alles Entwurf, bis die Gründer freigeben (keine Freigabe ohne Prüfer)', () => {
    for (const dish of EATING_OUT_DISHES) {
      if (dish.status === 'released') {
        expect(dish.reviewed_by, dish.id).toBeTruthy();
        expect(dish.reviewed_at, dish.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('die vom Gründer genannten Beispiele sind in der Tabelle', () => {
    const names = EATING_OUT_DISHES.map((d) => d.name_de);
    for (const wanted of [
      'Döner',
      'Dürüm',
      'Currywurst mit Pommes',
      'Pizza Margherita',
      'Schnitzel',
      'Leberkässemmel',
      'Butterbrezel',
      'Croissant',
      'Cappuccino',
      'Latte Macchiato',
      'Kantinen-Tagesgericht',
    ]) {
      expect(
        names.some((n) => n.includes(wanted)),
        wanted,
      ).toBe(true);
    }
  });

  it('Inhaltsstand: mindestens 50 berechenbar mit dem Katalog, fehlende Zutaten nach Häufigkeit', () => {
    const status = eatingOutContentStatus(CATALOG, undefined, true);
    expect(status.total).toBe(EATING_OUT_DISHES.length);
    expect(status.computable.length).toBeGreaterThanOrEqual(50);
    expect(status.computable.length + status.blocked.length).toBe(status.total);
    const counts = status.missingFoods.map((m) => m.dishes);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(status.missingFoods.some((m) => m.name_de === 'Butter')).toBe(true);
  });
});

describe('Werte nur aus dem Katalog', () => {
  it('normale Portion = Summe der Zutaten (unabhängig gerechnet), gerundet auf 10 kcal', () => {
    const dish = eatingOutDish('auswaerts-schnitzel-pommes') as EatingOutDishDef;
    const view = eatingOutDishView(dish, CATALOG, true);
    expect(view.kind).toBe('ok');
    if (view.kind !== 'ok') return;
    expect(view.normal.kcal).toBe(Math.round(kcalByHand(dish) / 10) * 10);
    expect(view.normal.kcal % 10).toBe(0);
    // Plausibel für Schnitzel mit Pommes (Teller): 700–1.200 kcal.
    expect(view.normal.kcal).toBeGreaterThan(700);
    expect(view.normal.kcal).toBeLessThan(1200);
  });

  it('Cappuccino (fettarme Milch) klein / normal / groß – Faktoren ¾, 1, 1½', () => {
    const dish = eatingOutDish('auswaerts-cappuccino') as EatingOutDishDef;
    const raw = eatingOutRawValues(dish, CATALOG, true);
    expect(raw).not.toBeNull();
    const kcal = (id: string) => eatingOutPortionValues(dish, id, CATALOG, true)?.kcal;
    expect(kcal('small')).toBe(Math.round(((raw?.kcal ?? 0) * 0.75) / 10) * 10);
    expect(kcal('normal')).toBe(Math.round((raw?.kcal ?? 0) / 10) * 10);
    expect(kcal('large')).toBe(Math.round(((raw?.kcal ?? 0) * 1.5) / 10) * 10);
    expect(kcal('half')).toBeUndefined();
  });

  it('fehlende Zutat in der Tabelle → nicht verfügbar, ohne Werte (z. B. Butterbrezel, Döner, Croissant)', () => {
    for (const id of [
      'auswaerts-butterbrezel',
      'auswaerts-doener',
      'auswaerts-croissant',
      'auswaerts-currywurst-pommes',
    ]) {
      const dish = eatingOutDish(id) as EatingOutDishDef;
      const view = eatingOutDishView(dish, CATALOG, true);
      expect(view.kind, id).toBe('unavailable');
      if (view.kind === 'unavailable') expect(view.missingFoods.length).toBeGreaterThan(0);
      expect(
        eatingOutPortionValues(dish, defaultEatingOutPortion(dish.portion), CATALOG, true),
      ).toBeNull();
    }
  });

  it('Lebensmittel nicht im geladenen Katalog (z. B. Entwurf ohne Freigabe in der Datenbank) → nicht verfügbar', () => {
    const dish = eatingOutDish('auswaerts-schnitzel-pommes') as EatingOutDishDef;
    const without = new Map(CATALOG);
    without.delete('paniermehl');
    const view = eatingOutDishView(dish, without, true);
    expect(view.kind).toBe('unavailable');
    if (view.kind === 'unavailable') expect(view.missingFoods).toEqual(['paniermehl']);
  });

  it('Grenzfälle: leerer Katalog → nichts berechenbar; Gericht ohne Zutaten → null; Menge 0 → null', () => {
    expect(eatingOutContentStatus(new Map()).computable).toEqual([]);
    expect(eatingOutRawValues({ items: [] }, CATALOG)).toBeNull();
    expect(eatingOutRawValues({ items: [['apfel', 0]] }, CATALOG)).toBeNull();
  });

  it('Rundung: 10 kcal, ganze Gramm; 4 → 0, 5 → 10', () => {
    expect(roundEatingOutValues({ kcal: 4, protein_g: 0.4, carbs_g: 0.5, fat_g: 12.49 })).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 1,
      fat_g: 12,
    });
    expect(roundEatingOutValues({ kcal: 5, protein_g: 1, carbs_g: 1, fat_g: 1 }).kcal).toBe(10);
  });

  it('alle berechenbaren Gerichte: jede Portion unter der Tagebuch-Obergrenze, Makros ≥ 0', () => {
    for (const view of eatingOutCatalog({ foods: CATALOG, allowDrafts: true })) {
      for (const portion of view.portions) {
        const values = eatingOutPortionValues(view.dish, portion.id, CATALOG, true);
        expect(values, `${view.dish.id}/${portion.id}`).not.toBeNull();
        expect(values?.kcal ?? 0).toBeLessThanOrEqual(FOOD_LOG_LIMITS.kcal.max);
        expect(
          Math.min(values?.protein_g ?? 0, values?.carbs_g ?? 0, values?.fat_g ?? 0),
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('Auswahlliste', () => {
  it('ohne Entwürfe (Supabase-Modus) leer, solange nichts freigegeben ist', () => {
    expect(eatingOutCatalog({ foods: CATALOG, allowDrafts: false })).toEqual([]);
  });

  it('freigegebenes Gericht erscheint auch ohne Entwürfe', () => {
    const released: EatingOutDishDef = {
      ...(eatingOutDish('auswaerts-laugenbrezel') as EatingOutDishDef),
      status: 'released',
      reviewed_by: 'Test',
      reviewed_at: '2026-10-25',
    };
    const list = eatingOutCatalog({ foods: CATALOG, allowDrafts: false, dishes: [released] });
    expect(list.map((v) => v.dish.id)).toEqual(['auswaerts-laugenbrezel']);
    expect(list[0]?.isDraft).toBe(false);
  });

  it('ohne Entwürfe nur veröffentlichte, katalog-geprüfte Lebensmittel (R19 wie filter.ts)', () => {
    const schnitzel: EatingOutDishDef = {
      ...(eatingOutDish('auswaerts-schnitzel-pommes') as EatingOutDishDef),
      status: 'released',
      reviewed_by: 'Test',
      reviewed_at: '2026-10-25',
    };
    // Schweineschnitzel und Paniermehl sind noch Katalog-Entwürfe (ungeprüft).
    expect(eatingOutCatalog({ foods: CATALOG, allowDrafts: false, dishes: [schnitzel] })).toEqual(
      [],
    );
    const view = eatingOutDishView(schnitzel, CATALOG, false);
    expect(view.kind === 'unavailable' && view.missingFoods).toEqual([
      'schweineschnitzel',
      'paniermehl',
    ]);
    expect(eatingOutDishView(schnitzel, CATALOG, true).kind).toBe('ok');
    const status = eatingOutContentStatus(CATALOG);
    expect(
      status.unreviewedFoods.find((f) => f.foodId === 'schweineschnitzel')?.dishes,
    ).toBeGreaterThanOrEqual(4);
    expect(status.computable.length).toBeLessThan(
      eatingOutContentStatus(CATALOG, undefined, true).computable.length,
    );
  });

  it('nur berechenbare, sortiert nach Kategorie; Kategorie- und Textfilter (Umlaute gefaltet)', () => {
    const all = eatingOutCatalog({ foods: CATALOG, allowDrafts: true });
    expect(all.every((v) => v.kind === 'ok' && v.isDraft)).toBe(true);
    const order = all.map((v) => EATING_OUT_CATEGORIES.indexOf(v.dish.category));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const cafe = eatingOutCatalog({ foods: CATALOG, allowDrafts: true, category: 'cafe' });
    expect(cafe.length).toBeGreaterThan(0);
    expect(cafe.every((v) => v.dish.category === 'cafe')).toBe(true);
    const text = eatingOutCatalog({ foods: CATALOG, allowDrafts: true, text: 'kaesespaetzle' });
    expect(text.map((v) => v.dish.id)).toEqual(['auswaerts-kaesespaetzle']);
    expect(
      eatingOutCatalog({ foods: CATALOG, allowDrafts: true, text: 'xyz-gibt-es-nicht' }),
    ).toEqual([]);
  });

  it('Portionen je Art: Pizza halb/ganz, Stück 1/2, Standard „normal“', () => {
    expect(eatingOutPortions('pizza').map((p) => p.factor)).toEqual([0.5, 1]);
    expect(eatingOutPortions('piece').map((p) => p.label)).toEqual(['1 Stück', '2 Stück']);
    expect(defaultEatingOutPortion('plate')).toBe('normal');
    expect(defaultEatingOutPortion('pizza')).toBe('whole');
    expect(defaultEatingOutPortion('piece')).toBe('one');
    expect(eatingOutPortions('plate')).toBe(EATING_OUT.portions.plate);
  });
});

describe('Eintrag im Tagebuch', () => {
  const dish = eatingOutDish('auswaerts-kantine-fleisch') as EatingOutDishDef;

  it('Schnelleintrag „Auswärts gegessen“ mit den gerundeten Werten, gültig nach Tagebuch-Schema', () => {
    const build = entryFromEatingOut(dish, 'large', CATALOG, target, { allowDrafts: true });
    expect(build.ok).toBe(true);
    if (!build.ok) return;
    const values = eatingOutPortionValues(dish, 'large', CATALOG, true);
    expect(build.entry).toMatchObject({
      source: 'quick',
      title_de: 'Auswärts gegessen',
      kcal: values?.kcal,
      protein_g: values?.protein_g,
      food_id: null,
      recipe_id: null,
      portion: null,
      amount: null,
    });
    expect(foodLogEntrySchema.safeParse(build.entry).success).toBe(true);
  });

  it('„Kalorienzahlen aus“ → Eintrag ohne Werte', () => {
    const build = entryFromEatingOut(dish, 'normal', CATALOG, target, {
      showNumbers: false,
      allowDrafts: true,
    });
    expect(build.ok && build.entry.kcal === null && build.entry.protein_g === null).toBe(true);
  });

  it('nicht berechenbar oder falsche Portion → invalid', () => {
    expect(
      entryFromEatingOut(
        eatingOutDish('auswaerts-croissant') as EatingOutDishDef,
        'one',
        CATALOG,
        target,
      ),
    ).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(entryFromEatingOut(dish, 'half', CATALOG, target)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});

describe('„Zuletzt“ und Favoriten (nur IDs)', () => {
  it('Zuletzt: neuestes vorn, ein Gericht nur einmal (neue Portion gilt), höchstens 8', () => {
    let picks = EMPTY_EATING_OUT_PICKS;
    for (let i = 0; i < 10; i += 1)
      picks = withEatingOutRecent(picks, { dishId: `gericht-${i}`, portionId: 'normal' });
    expect(picks.recent).toHaveLength(EATING_OUT.recentMax);
    expect(picks.recent[0]?.dishId).toBe('gericht-9');
    picks = withEatingOutRecent(picks, { dishId: 'gericht-5', portionId: 'large' });
    expect(picks.recent[0]).toEqual({ dishId: 'gericht-5', portionId: 'large' });
    expect(picks.recent.filter((p) => p.dishId === 'gericht-5')).toHaveLength(1);
  });

  it('Favorit an/aus, höchstens 30 (ältester fällt weg)', () => {
    let picks = toggleEatingOutFavorite(EMPTY_EATING_OUT_PICKS, 'auswaerts-pommes');
    expect(picks.favorites).toEqual(['auswaerts-pommes']);
    picks = toggleEatingOutFavorite(picks, 'auswaerts-pommes');
    expect(picks.favorites).toEqual([]);
    for (let i = 0; i < 31; i += 1) picks = toggleEatingOutFavorite(picks, `gericht-${i}`);
    expect(picks.favorites).toHaveLength(EATING_OUT.favoritesMax);
    expect(picks.favorites).not.toContain('gericht-0');
  });

  it('gespeicherten Stand lesen: ungültig → leer, nie werfen', () => {
    expect(parseEatingOutPicks(null)).toEqual(EMPTY_EATING_OUT_PICKS);
    expect(parseEatingOutPicks({ recent: 'kaputt' })).toEqual(EMPTY_EATING_OUT_PICKS);
    expect(
      parseEatingOutPicks({
        recent: [{ dishId: 'auswaerts-pommes', portionId: 'small' }],
        favorites: [],
      }),
    ).toEqual({
      recent: [{ dishId: 'auswaerts-pommes', portionId: 'small' }],
      favorites: [],
    });
  });
});
