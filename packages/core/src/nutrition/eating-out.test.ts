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
  EATING_OUT_MAPPING_ERRORS,
  EATING_OUT_PENDING_FOODS,
  eatingOutDishesFromMapping,
  parseEatingOutMapping,
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
/** Lebensmittel der Alpha5-Zuordnung (schon zugeordnet, ggf. noch nicht importiert). */
const ALPHA5_MAPPED = new Set(
  (
    JSON.parse(
      readFileSync(
        join(__dirname, '../../../../content/food-mapping/alpha5-zuordnung.json'),
        'utf8',
      ),
    ) as { items: { food_id: string }[] }
  ).items.map((item) => item.food_id),
);
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

  it('jede Katalog-ID existiert im Katalog oder wartet auf Import (Abschnitt foods bzw. alpha5-zuordnung), Mengen 1–600 g', () => {
    const pending = new Set([...EATING_OUT_PENDING_FOODS.map((f) => f.food_id), ...ALPHA5_MAPPED]);
    for (const dish of EATING_OUT_DISHES) {
      expect(dish.items.length, dish.id).toBeGreaterThan(0);
      for (const [id, grams] of dish.items) {
        expect(CATALOG.has(id) || pending.has(id), `${dish.id}: ${id}`).toBe(true);
        expect(grams).toBeGreaterThan(0);
        expect(grams).toBeLessThanOrEqual(600);
      }
    }
  });

  it('jedes Gericht hat eine Begründung; jedes neue Lebensmittel hat Suchbegriffe und wird genutzt', () => {
    expect(EATING_OUT_MAPPING_ERRORS).toEqual([]);
    for (const dish of EATING_OUT_DISHES)
      expect(dish.source_de?.length ?? 0, dish.id).toBeGreaterThan(10);
    const used = new Set(EATING_OUT_DISHES.flatMap((d) => d.items.map(([id]) => id)));
    for (const food of EATING_OUT_PENDING_FOODS) {
      expect(food.search_de.length, food.food_id).toBeGreaterThan(0);
      expect(used.has(food.food_id), food.food_id).toBe(true);
      // Neue Lebensmittel nie doppelt zur Alpha5-Zuordnung (eine Zuordnung je Katalog-ID).
      expect(ALPHA5_MAPPED.has(food.food_id), food.food_id).toBe(false);
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
    const butter = status.missingFoods.find((m) => m.food_id === 'butter');
    expect(butter?.name_de).toBe('Butter');
    expect(butter?.search_de).toContain('Butter');
    expect(butter?.dishes).toBeGreaterThanOrEqual(5);
    // Aus alpha5-zuordnung.json (schon zugeordnet, noch nicht importiert): ohne Suchbegriffe aus dieser Datei.
    if (!CATALOG.has('weizenmehl-type-405')) {
      expect(status.missingFoods.find((m) => m.food_id === 'weizenmehl-type-405')).toMatchObject({
        name_de: 'weizenmehl-type-405',
        search_de: [],
      });
    }
    // Was im Katalog ist, steht nie unter „wartet auf Import“.
    for (const m of status.missingFoods) expect(CATALOG.has(m.food_id), m.food_id).toBe(false);
  });
});

describe('Zuordnungsdatei (Schema)', () => {
  const dish = {
    id: 'auswaerts-test',
    name_de: 'Testgericht',
    category: 'imbiss',
    portion: 'plate',
    basis_de: '1 Teller',
    items: [{ food_id: 'kartoffeln', g: 200 }],
    source_de: 'Annahme: übliche Imbiss-Portion.',
    status: 'draft',
  };
  const file = (dishes: unknown[], foods: unknown[] = []) => ({
    format: 'alpha5-auswaerts-zuordnung',
    version: 1,
    status: 'entwurf',
    fachpruefung_de: 'VOR LIVEGANG FACHLICH PRÜFEN',
    origin: 'claude_session',
    model: 'claude-opus-5-5',
    created_on: '2026-10-26',
    note_de: 'Testdatei für die Zuordnung.',
    foods,
    dishes,
  });

  it('gültige Datei → Gerichte als [ID, Gramm]', () => {
    const parsed = parseEatingOutMapping(file([dish]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(eatingOutDishesFromMapping(parsed.mapping)[0]).toMatchObject({
      id: 'auswaerts-test',
      items: [['kartoffeln', 200]],
      source_de: 'Annahme: übliche Imbiss-Portion.',
    });
  });

  it('blockiert: fehlende Begründung, Menge 0 oder über 600 g, Nährwert-Felder, Freigabe ohne Prüfer, doppelte IDs', () => {
    const withoutSource: Partial<typeof dish> = { ...dish };
    delete withoutSource.source_de;
    for (const bad of [
      file([withoutSource]),
      file([{ ...dish, items: [{ food_id: 'kartoffeln', g: 0 }] }]),
      file([{ ...dish, items: [{ food_id: 'kartoffeln', g: 601 }] }]),
      file([{ ...dish, kcal: 500 }]),
      file([{ ...dish, items: [{ food_id: 'kartoffeln', g: 100, kcal: 80 }] }]),
      file([{ ...dish, status: 'released' }]),
      file([dish, dish]),
      file([{ ...dish, items: [...dish.items, ...dish.items] }]),
      file([{ ...dish, id: 'test-ohne-praefix' }]),
      file([]),
      { ...file([dish]), fachpruefung_de: 'geprüft' },
    ]) {
      const parsed = parseEatingOutMapping(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.length).toBeGreaterThan(0);
    }
  });

  it('neues Lebensmittel: Fleisch nur mit Tierart; kaputte Daten werfen nie', () => {
    const food = EATING_OUT_PENDING_FOODS.length > 0;
    expect(food).toBe(true);
    const bratwurst = {
      food_id: 'test-wurst',
      name_de: 'Testwurst',
      source: {
        db: 'bls',
        version: '4.0',
        ref: null,
        search: ['Wurst'],
        state_de: 'gegart',
        category: 'sausage_meat_products',
      },
      aliases_de: [],
      shopping_category: 'meat_sausage',
      pantry: false,
      units: {},
      groups: [],
      animal: ['meat'],
      meat_kind: [],
      pregnancy_caution: false,
      alcohol: false,
      max_fridge_days: 3,
      freezable: true,
      substitutes: [],
      reason_de: 'Testeintrag ohne Tierart.',
    };
    expect(parseEatingOutMapping(file([dish], [bratwurst])).ok).toBe(false);
    expect(parseEatingOutMapping(file([dish], [{ ...bratwurst, meat_kind: ['pork'] }])).ok).toBe(
      true,
    );
    for (const junk of [null, undefined, 42, 'text', [], {}]) {
      expect(parseEatingOutMapping(junk).ok).toBe(false);
    }
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

  it('Zutat wartet auf Import → nicht verfügbar, ohne Werte (z. B. Butterbrezel, Döner, Croissant)', () => {
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

  it('nach dem Import (Lebensmittel im Katalog) wird das Gericht berechenbar – Werte nur aus dem Katalog', () => {
    const dish = eatingOutDish('auswaerts-butterbrezel') as EatingOutDishDef;
    expect(dish.items).toContainEqual(['butter', 15]);
    const rapsoel = CATALOG.get('rapsoel') as Food;
    // Testwerte (keine echten Butter-Werte): nur, um die Rechnung nach dem Import zu prüfen.
    const imported = new Map(CATALOG);
    imported.set('butter', {
      ...rapsoel,
      id: 'butter',
      name_de: 'Butter',
      status: 'draft',
      nutrients_per_100g: { ...rapsoel.nutrients_per_100g, kcal: 700, fat_g: 80 },
    });
    const before = eatingOutDishView(dish, CATALOG, true);
    expect(before.kind === 'unavailable' && before.missingFoods).toEqual(['butter']);
    const after = eatingOutDishView(dish, imported, true);
    expect(after.kind).toBe('ok');
    if (after.kind !== 'ok') return;
    const laugenbrezel = (CATALOG.get('laugenbrezel') as Food).nutrients_per_100g.kcal * 0.8;
    expect(after.normal.kcal).toBe(Math.round((laugenbrezel + 105) / 10) * 10);
    // Ohne Entwürfe (Supabase-Modus) zählt ein frisch importierter Entwurf (noch nicht katalog-geprüft) nicht.
    expect(eatingOutDishView(dish, imported, false).kind).toBe('unavailable');
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
