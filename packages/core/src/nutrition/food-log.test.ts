import { describe, expect, it } from 'vitest';

import { FOOD_LOG_LIMITS, FOOD_LOG_PORTION_CHOICES } from '../constants';
import {
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  foodLookup,
  makeFood,
} from '../content/nutrition-fixtures';
import { zeroNutrients } from './recipe-nutrients';
import {
  canAddFoodLogEntries,
  dayIntake,
  dayIntakeView,
  defaultFoodLogSlot,
  entryFromFood,
  entryFromPlanItem,
  entryFromRecipe,
  entryFromTemplate,
  entryFromFavorite,
  favoriteAvailable,
  favoriteFromEntry,
  FOOD_LOG_SLOTS,
  foodLogSaveResponseSchema,
  foodLogDateStatus,
  foodLogDay,
  foodLogEntrySchema,
  foodLogFavoriteSchema,
  foodLogGroup,
  foodLogKey,
  foodLogPayloadSchema,
  foodLogSelectableDates,
  foodLogUnitsFor,
  isFavoriteEntry,
  markPlanItemEaten,
  moveEntry,
  needsFoodLogConfirmation,
  orderFavorites,
  planItemEntry,
  quickEntry,
  recentEntries,
  rescaleEntry,
  searchFoodLogCatalog,
  upsertFavorite,
  type FoodLogBuild,
  type FoodLogEntry,
  type FoodLogFavorite,
} from './food-log';

const TODAY = '2026-10-15';
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FOODS = foodLookup(FIXTURE_FOODS);

function ok(build: FoodLogBuild): FoodLogEntry {
  if (!build.ok) throw new Error(`Eintrag nicht gebaut: ${build.reason}`);
  return build.entry;
}

const banane = FOODS.get('banane') ?? makeFood();
const hafer = makeFood({ units: { tbsp_g: 10 } });
const wasser = makeFood({
  id: 'wasser',
  name_de: 'Wasser',
  nutrients_per_100g: { ...zeroNutrients(), sugar_g: 0, sat_fat_g: 0, fiber_g: 0 },
  units: { ml_to_g: 1 },
});

const meal = {
  slot: 'lunch' as const,
  recipeId: 'spaghetti-tomatensauce',
  titleDe: 'Spaghetti mit Tomatensauce',
  nutrients: { ...zeroNutrients(), kcal: 650.4, protein_g: 21.26, carbs_g: 110.04, fat_g: 12.35 },
};

function timed(entry: FoodLogEntry, at: string) {
  return { ...entry, created_at: at, updated_at: at };
}

describe('FOOD_LOG_LIMITS (Plan 5)', () => {
  it('Werte aus dem Plan: kcal 0–3.000, Menge 1–2.000 g, Portion 0,25–3, 40 je Tag, 14 Tage, Rückfrage ab 1.500', () => {
    expect(FOOD_LOG_LIMITS.kcal).toEqual({ min: 0, max: 3000 });
    expect(FOOD_LOG_LIMITS.amountMass).toEqual({ min: 1, max: 2000 });
    expect(FOOD_LOG_LIMITS.portion).toEqual({ min: 0.25, max: 3 });
    expect(FOOD_LOG_LIMITS.maxEntriesPerDay).toBe(40);
    expect(FOOD_LOG_LIMITS.backdateDays).toBe(14);
    expect(FOOD_LOG_LIMITS.plausibleKcal).toBe(1500);
    expect(FOOD_LOG_LIMITS.recentCount).toBe(20);
    expect(FOOD_LOG_PORTION_CHOICES).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
  });
});

describe('„Gegessen“ aus dem Essensplan', () => {
  it('Werte = Plan-Schnappschuss × Portion, gerundet (kcal ganz, Makros 0,1)', () => {
    const entry = ok(entryFromPlanItem(meal, 0.75, { id: ID(1), date: TODAY }));
    expect(entry).toMatchObject({
      source: 'plan_item',
      slot: 'lunch',
      recipe_id: 'spaghetti-tomatensauce',
      title_de: 'Spaghetti mit Tomatensauce',
      portion: 0.75,
      kcal: 488,
      protein_g: 15.9,
      carbs_g: 82.5,
      fat_g: 9.3,
      amount: null,
      unit: null,
    });
  });

  it.each(FOOD_LOG_PORTION_CHOICES)('jede Portion der Auswahl ist gültig (%s)', (portion) => {
    expect(entryFromPlanItem(meal, portion, { id: ID(1), date: TODAY }).ok).toBe(true);
  });

  it.each([0, 0.2, 3.25, 0.3, Number.NaN])('ungültige Portion %s abgelehnt', (portion) => {
    expect(entryFromPlanItem(meal, portion, { id: ID(1), date: TODAY })).toEqual({
      ok: false,
      reason: 'portion',
    });
  });

  it('Mahlzeit über 3.000 kcal bei 2 Portionen → zu viel (nie still gekappt)', () => {
    const big = { ...meal, nutrients: { ...meal.nutrients, kcal: 1600 } };
    expect(entryFromPlanItem(big, 2, { id: ID(1), date: TODAY })).toEqual({
      ok: false,
      reason: 'too_much',
    });
    expect(entryFromPlanItem(big, 1.75, { id: ID(1), date: TODAY }).ok).toBe(true);
  });

  it('doppelt abgehakt ist idempotent; andere Portion ändert denselben Eintrag', () => {
    let n = 10;
    const newId = () => ID((n += 1));
    const first = markPlanItemEaten([], meal, TODAY, 1, newId);
    expect(first.kind).toBe('new');
    if (first.kind !== 'new') return;
    const again = markPlanItemEaten([first.entry], meal, TODAY, 1, newId);
    expect(again).toEqual({ kind: 'unchanged', entry: first.entry });
    const changed = markPlanItemEaten([first.entry], meal, TODAY, 0.5, newId);
    expect(changed.kind).toBe('changed');
    if (changed.kind === 'changed') {
      expect(changed.entry.id).toBe(first.entry.id);
      expect(changed.entry.kcal).toBe(325);
    }
    expect(planItemEntry([first.entry], TODAY, 'lunch')?.id).toBe(first.entry.id);
    expect(planItemEntry([first.entry], TODAY, 'dinner')).toBeNull();
    expect(markPlanItemEaten([], meal, TODAY, 4, newId)).toEqual({
      kind: 'failed',
      reason: 'portion',
    });
  });

  it('Plan ersetzt nach dem Abhaken: der Eintrag bleibt ein Schnappschuss (keine Abhängigkeit vom Plan)', () => {
    const entry = ok(entryFromPlanItem(meal, 1, { id: ID(1), date: '2026-10-12' }));
    const newPlanMeal = { ...meal, recipeId: 'porridge-banane', titleDe: 'Porridge' };
    // Der gespeicherte Eintrag wird nur über markPlanItemEaten geändert – ein neuer Plan berührt ihn nicht.
    expect(entry.recipe_id).toBe('spaghetti-tomatensauce');
    const again = markPlanItemEaten([entry], newPlanMeal, '2026-10-12', 1, () => ID(2));
    expect(again.kind).toBe('changed');
    if (again.kind === 'changed') expect(again.entry.id).toBe(entry.id);
  });

  it('Plan-Mahlzeit lässt sich nicht auf einen anderen Tag oder Platz verschieben', () => {
    const entry = ok(entryFromPlanItem(meal, 1, { id: ID(1), date: TODAY }));
    expect(moveEntry(entry, 'dinner', TODAY).ok).toBe(false);
    expect(moveEntry(entry, 'lunch', '2026-10-14').ok).toBe(false);
    expect(moveEntry(entry, 'lunch', TODAY).ok).toBe(true);
  });
});

describe('Lebensmittel aus dem Katalog', () => {
  it('Banane 1 Stück = 120 g → Werte aus dem Katalog', () => {
    const entry = ok(entryFromFood(banane, 1, 'piece', { id: ID(1), date: TODAY, slot: 'other' }));
    expect(entry).toMatchObject({
      source: 'food',
      food_id: 'banane',
      title_de: 'Banane',
      amount: 1,
      unit: 'piece',
      kcal: 112,
      protein_g: 1.4,
      carbs_g: 24,
      fat_g: 0.2,
    });
  });

  it('Stück ohne Gewichtsangabe und ml ohne Umrechnung sind nicht möglich', () => {
    expect(foodLogUnitsFor(hafer)).toEqual(['g']);
    expect(foodLogUnitsFor(banane)).toEqual(['g', 'piece']);
    expect(foodLogUnitsFor(wasser)).toEqual(['g', 'ml']);
    expect(entryFromFood(hafer, 1, 'piece', { id: ID(1), date: TODAY, slot: 'other' })).toEqual({
      ok: false,
      reason: 'unit',
    });
    expect(entryFromFood(hafer, 100, 'ml', { id: ID(1), date: TODAY, slot: 'other' })).toEqual({
      ok: false,
      reason: 'unit',
    });
  });

  it.each([
    [1, 'g', true],
    [0.9, 'g', false],
    [2000, 'g', true],
    [2000.1, 'g', false],
    [55.5, 'g', true],
    [55.55, 'g', false],
    [0.5, 'piece', true],
    [0.25, 'piece', false],
    [1.5, 'piece', true],
    [1.3, 'piece', false],
    [16, 'piece', true],
    [17, 'piece', false], // 17 × 120 g = 2.040 g > 2.000 g
  ] as const)('Menge %s %s → gültig: %s', (amount, unit, valid) => {
    expect(entryFromFood(banane, amount, unit, { id: ID(1), date: TODAY, slot: 'other' }).ok).toBe(
      valid,
    );
  });

  it('0 kcal (Wasser) ist ein gültiger Eintrag', () => {
    const entry = ok(entryFromFood(wasser, 500, 'ml', { id: ID(1), date: TODAY, slot: 'other' }));
    expect(entry.kcal).toBe(0);
    expect(dayIntake([entry])).toMatchObject({ count: 1, withoutValue: 0, kcal: 0 });
  });

  it('archiviertes Lebensmittel: der Eintrag bleibt änderbar (Rechnung aus dem Schnappschuss)', () => {
    const entry = ok(entryFromFood(banane, 2, 'piece', { id: ID(1), date: TODAY, slot: 'other' }));
    const changed = ok(rescaleEntry(entry, { amount: 1 }, banane));
    expect(changed.kcal).toBe(112);
    expect(changed.amount).toBe(1);
    expect(rescaleEntry(entry, { amount: 0.3 }, banane)).toEqual({ ok: false, reason: 'amount' });
    expect(rescaleEntry(entry, { portion: 1 })).toEqual({ ok: false, reason: 'invalid' });
    // Wächter E1 H6: Stück/ml umgerechnet höchstens 2.000 g – wie beim Neu-Eintragen (17 × 120 g > 2.000 g).
    expect(rescaleEntry(entry, { amount: 16 }, banane).ok).toBe(true);
    expect(rescaleEntry(entry, { amount: 17 }, banane)).toEqual({ ok: false, reason: 'amount' });
    // Ohne Umrechnung (Lebensmittel nicht im Bestand) ist eine neue Stück-Menge nicht prüfbar → abgelehnt.
    expect(rescaleEntry(entry, { amount: 1 })).toEqual({ ok: false, reason: 'unit' });
    const grams = ok(entryFromFood(banane, 100, 'g', { id: ID(2), date: TODAY, slot: 'other' }));
    expect(rescaleEntry(grams, { amount: 2000 }).ok).toBe(true);
    expect(rescaleEntry(grams, { amount: 2000.1 })).toEqual({ ok: false, reason: 'amount' });
  });
});

describe('Rezept mit Portionen', () => {
  const recipe = FIXTURE_RECIPES.find((r) => r.id === 'porridge-banane');
  it('Werte je Portion aus Zutaten und Katalog × Portionen', () => {
    if (!recipe) throw new Error('Rezept fehlt');
    const one = ok(
      entryFromRecipe(recipe, FOODS, 1, { id: ID(1), date: TODAY, slot: 'breakfast' }),
    );
    const two = ok(
      entryFromRecipe(recipe, FOODS, 2, { id: ID(2), date: TODAY, slot: 'breakfast' }),
    );
    expect(one.source).toBe('recipe');
    expect(one.portion).toBe(1);
    expect(one.kcal).toBeGreaterThan(300);
    expect(Math.abs((two.kcal ?? 0) - 2 * (one.kcal ?? 0))).toBeLessThanOrEqual(1);
    expect(
      entryFromRecipe(recipe, FOODS, 3.5, { id: ID(3), date: TODAY, slot: 'breakfast' }),
    ).toEqual({ ok: false, reason: 'portion' });
    const half = ok(rescaleEntry(two, { portion: 1 }));
    expect(Math.abs((half.kcal ?? 0) - (one.kcal ?? 0))).toBeLessThanOrEqual(1);
  });
});

describe('Schnelleintrag', () => {
  it('„Auswärts gegessen, 700 kcal“ – Makros optional', () => {
    const entry = ok(
      quickEntry(
        { label: 'Auswärts gegessen', kcal: 700 },
        { id: ID(1), date: TODAY, slot: 'dinner' },
      ),
    );
    expect(entry).toMatchObject({ source: 'quick', title_de: 'Auswärts gegessen', kcal: 700 });
    expect(entry.protein_g).toBeNull();
    expect(dayIntake([entry]).macrosComplete).toBe(false);
  });

  it('ohne kcal (Zahlen aus) zählt nur als gegessen', () => {
    const entry = ok(
      quickEntry({ label: 'Snack', kcal: null }, { id: ID(1), date: TODAY, slot: 'other' }),
    );
    expect(entry.kcal).toBeNull();
    expect(dayIntake([entry])).toMatchObject({ count: 1, withoutValue: 1, kcal: 0 });
  });

  it('Makros ohne kcal, Bezeichnung außerhalb der Liste und über 3.000 kcal werden abgelehnt', () => {
    expect(
      quickEntry(
        { label: 'Snack', kcal: null, protein_g: 10 },
        { id: ID(1), date: TODAY, slot: 'other' },
      ).ok,
    ).toBe(false);
    expect(
      quickEntry(
        { label: 'Pizza' as 'Snack', kcal: 500 },
        { id: ID(1), date: TODAY, slot: 'other' },
      ).ok,
    ).toBe(false);
    expect(
      quickEntry({ label: 'Snack', kcal: 3001 }, { id: ID(1), date: TODAY, slot: 'other' }),
    ).toEqual({
      ok: false,
      reason: 'too_much',
    });
    expect(
      quickEntry({ label: 'Snack', kcal: 3000 }, { id: ID(1), date: TODAY, slot: 'other' }).ok,
    ).toBe(true);
  });

  it('Rückfrage ab 1.500 kcal, keine Sperre', () => {
    expect(needsFoodLogConfirmation({ kcal: 1499 })).toBe(false);
    expect(needsFoodLogConfirmation({ kcal: 1500 })).toBe(true);
    expect(needsFoodLogConfirmation({ kcal: null })).toBe(false);
  });
});

describe('Schema (strikt, wie die Datenbank)', () => {
  const entry = ok(entryFromFood(banane, 1, 'piece', { id: ID(1), date: TODAY, slot: 'other' }));
  it('keine Server-Felder, keine unbekannten Felder', () => {
    expect(foodLogEntrySchema.safeParse({ ...entry, user_id: ID(9) }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, revision: 1 }).success).toBe(false);
  });
  it('Form je Herkunft', () => {
    expect(foodLogEntrySchema.safeParse({ ...entry, portion: 1 }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, recipe_id: 'x-y-z' }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, kcal: null }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, kcal: 12.5 }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, protein_g: 1.25 }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, slot: 'brunch' }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, title_de: ' Banane' }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...entry, title_de: 'x'.repeat(101) }).success).toBe(
      false,
    );
    const plan = ok(entryFromPlanItem(meal, 1, { id: ID(2), date: TODAY }));
    expect(foodLogEntrySchema.safeParse({ ...plan, slot: 'other' }).success).toBe(false);
  });
  it('Liste an save_food_log_entries: 1–40 Einträge, keine doppelte id, write_id und base_revision Pflicht', () => {
    const payload = { ...entry, write_id: ID(50), base_revision: null };
    expect(foodLogPayloadSchema.safeParse([payload]).success).toBe(true);
    expect(foodLogPayloadSchema.safeParse([]).success).toBe(false);
    expect(foodLogPayloadSchema.safeParse([payload, payload]).success).toBe(false);
    expect(foodLogPayloadSchema.safeParse([{ ...entry, base_revision: null }]).success).toBe(false);
    const many = Array.from({ length: 41 }, (_, i) => ({ ...payload, id: ID(100 + i) }));
    expect(foodLogPayloadSchema.safeParse(many).success).toBe(false);
    expect(foodLogPayloadSchema.safeParse(many.slice(0, 40)).success).toBe(true);
  });
});

describe('Datumsfenster: 14 Tage zurück, nie in die Zukunft', () => {
  it.each([
    ['2026-10-15', 'ok'],
    ['2026-10-01', 'ok'], // genau 14 Tage
    ['2026-09-30', 'too_old'], // 15 Tage
    ['2026-10-16', 'future'],
  ] as const)('%s → %s', (date, status) => {
    expect(foodLogDateStatus(date, TODAY)).toBe(status);
  });
  it('wählbare Tage: heute + 14 zurück', () => {
    const dates = foodLogSelectableDates(TODAY);
    expect(dates).toHaveLength(15);
    expect(dates[0]).toBe(TODAY);
    expect(dates.at(-1)).toBe('2026-10-01');
  });
});

describe('Tag: Summen, Gruppen, Grenzen', () => {
  const a = ok(
    quickEntry(
      { label: 'Snack', kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 6 },
      { id: ID(1), date: TODAY, slot: 'other' },
    ),
  );
  const b = ok(entryFromPlanItem(meal, 1, { id: ID(2), date: TODAY }));
  const c = ok(
    quickEntry({ label: 'Getränk', kcal: null }, { id: ID(3), date: TODAY, slot: 'breakfast' }),
  );

  it('leerer Tag: 0 Einträge', () => {
    expect(dayIntake([])).toEqual({
      count: 0,
      withoutValue: 0,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      macrosComplete: true,
    });
  });

  it('Summen ohne Einträge ohne Wert, Anzahl mit', () => {
    expect(dayIntake([a, b, c])).toEqual({
      count: 3,
      withoutValue: 1,
      kcal: 850,
      protein_g: 26.3,
      carbs_g: 140,
      fat_g: 18.4,
      macrosComplete: true,
    });
  });

  it('„Kalorienzahlen aus“ bzw. no_targets: nur die Anzahl, keine kcal im Ergebnis', () => {
    const view = dayIntakeView([a, b, c], false);
    expect(view).toEqual({ kind: 'count', count: 3 });
    expect(JSON.stringify(view)).not.toMatch(/kcal|protein|carbs|fat|850/);
    expect(dayIntakeView([a], true)).toMatchObject({ kind: 'numbers', kcal: 200 });
  });

  it('Gruppen: Frühstück, Hauptmahlzeit, Mittag, Abend, Snack (Zwischenmahlzeiten, Ergänzungen, frei)', () => {
    expect(FOOD_LOG_SLOTS.map((s) => [s, foodLogGroup(s)])).toEqual([
      ['main', 'main'],
      ['breakfast', 'breakfast'],
      ['snack_morning', 'snack'],
      ['lunch', 'lunch'],
      ['snack_afternoon', 'snack'],
      ['snack_pre_dinner', 'snack'],
      ['dinner', 'dinner'],
      ['snack_late', 'snack'],
      ['snack_night', 'snack'],
      ['extra_1', 'snack'],
      ['extra_2', 'snack'],
      ['other', 'snack'],
    ]);
    const day = foodLogDay(
      [
        timed(a, '2026-10-15T08:00:00Z'),
        timed(b, '2026-10-15T12:00:00Z'),
        timed(c, '2026-10-15T07:00:00Z'),
      ],
      TODAY,
    );
    expect(day.map((e) => e.id)).toEqual([ID(3), ID(2), ID(1)]);
    expect(foodLogDay([timed(a, 'x')], '2026-10-14')).toEqual([]);
  });

  it('Vorbelegung des Platzes nach Uhrzeit', () => {
    expect(defaultFoodLogSlot(7 * 60)).toBe('breakfast');
    expect(defaultFoodLogSlot(10 * 60 + 30)).toBe('lunch');
    expect(defaultFoodLogSlot(15 * 60)).toBe('other');
    expect(defaultFoodLogSlot(19 * 60)).toBe('dinner');
    expect(defaultFoodLogSlot(23 * 60)).toBe('other');
    expect(defaultFoodLogSlot(-5)).toBe('breakfast');
    expect(defaultFoodLogSlot(99_999)).toBe('other');
  });

  it('höchstens 40 Einträge je Tag', () => {
    const day = Array.from({ length: 39 }, () => ({ eaten_on: TODAY }));
    expect(canAddFoodLogEntries(day, TODAY)).toBe(true);
    expect(canAddFoodLogEntries([...day, { eaten_on: TODAY }], TODAY)).toBe(false);
    expect(canAddFoodLogEntries([...day, { eaten_on: TODAY }], '2026-10-14')).toBe(true);
    expect(canAddFoodLogEntries(day, TODAY, 2)).toBe(false);
  });
});

describe('Zuletzt gegessen und Favoriten', () => {
  const quick700 = ok(
    quickEntry(
      { label: 'Auswärts gegessen', kcal: 700 },
      { id: ID(1), date: '2026-10-14', slot: 'dinner' },
    ),
  );
  const banana1 = ok(
    entryFromFood(banane, 1, 'piece', { id: ID(2), date: '2026-10-13', slot: 'other' }),
  );
  const banana2 = ok(
    entryFromFood(banane, 2, 'piece', { id: ID(3), date: '2026-10-14', slot: 'other' }),
  );
  const plan = ok(entryFromPlanItem(meal, 1, { id: ID(4), date: '2026-10-14' }));

  it('je Schlüssel der neueste, Plan-Mahlzeiten nicht, neueste zuerst', () => {
    const list = recentEntries([
      timed(banana1, '2026-10-13T10:00:00Z'),
      timed(quick700, '2026-10-14T19:00:00Z'),
      timed(banana2, '2026-10-14T10:00:00Z'),
      timed(plan, '2026-10-14T12:00:00Z'),
    ]);
    expect(list.map((e) => e.id)).toEqual([ID(1), ID(3)]);
  });

  it('höchstens 20 verschiedene', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      timed(
        ok(
          quickEntry(
            { label: 'Snack', kcal: 100 + i },
            { id: ID(10 + i), date: TODAY, slot: 'other' },
          ),
        ),
        `2026-10-15T10:${String(i).padStart(2, '0')}:00Z`,
      ),
    );
    const list = recentEntries(many);
    expect(list).toHaveLength(20);
    expect(list[0]?.kcal).toBe(124);
    expect(recentEntries(many, 0)).toEqual([]);
  });

  it('Stern → Favorit; morgen daraus ein neuer Eintrag mit denselben Werten', () => {
    const fav = favoriteFromEntry(quick700);
    expect(fav).toMatchObject({
      fav_key: 'quick|Auswärts gegessen|700',
      source: 'quick',
      kcal: 700,
    });
    if (!fav) return;
    expect(foodLogFavoriteSchema.safeParse(fav).success).toBe(true);
    expect(foodLogFavoriteSchema.safeParse({ ...fav, fav_key: 'quick|x|1' }).success).toBe(false);
    expect(isFavoriteEntry([fav], quick700)).toBe(true);
    const tomorrow = ok(entryFromTemplate(fav, { id: ID(20), date: TODAY, slot: 'lunch' }));
    expect(tomorrow).toMatchObject({
      eaten_on: TODAY,
      slot: 'lunch',
      kcal: 700,
      title_de: 'Auswärts gegessen',
    });
    expect(favoriteFromEntry(plan)).toBeNull();
    expect(isFavoriteEntry([fav], plan)).toBe(false);
  });

  it('Favoriten aus Katalog/Rezept speichern keine Werte; beim Eintragen neu aus dem Bestand gerechnet (Wächter S1)', () => {
    const fav = favoriteFromEntry(banana2) as FoodLogFavorite;
    expect(fav).toMatchObject({
      fav_key: 'food|banane',
      amount: 2,
      unit: 'piece',
      kcal: null,
      protein_g: null,
    });
    expect(foodLogFavoriteSchema.safeParse({ ...fav, kcal: 9 }).success).toBe(false);
    const library = { foods: FOODS, recipes: FIXTURE_RECIPES };
    expect(favoriteAvailable(fav, library)).toBe(true);
    const entry = ok(entryFromFavorite(fav, library, { id: ID(30), date: TODAY, slot: 'other' }));
    expect(entry).toMatchObject({ source: 'food', amount: 2, kcal: 223, title_de: 'Banane' });
    const missing = { ...fav, fav_key: 'food|weg', food_id: 'weg' };
    expect(favoriteAvailable(missing, library)).toBe(false);
    expect(entryFromFavorite(missing, library, { id: ID(31), date: TODAY, slot: 'other' }).ok).toBe(
      false,
    );
    const quick = favoriteFromEntry(quick700) as FoodLogFavorite;
    expect(
      ok(entryFromFavorite(quick, library, { id: ID(32), date: TODAY, slot: 'other' })).kcal,
    ).toBe(700);
  });

  it('gleicher Schlüssel ersetzt (neue Menge); höchstens 100 Favoriten', () => {
    const f1 = favoriteFromEntry(banana1) as FoodLogFavorite;
    const f2 = favoriteFromEntry(banana2) as FoodLogFavorite;
    expect(f1.fav_key).toBe(f2.fav_key);
    expect(upsertFavorite([f1], f2)).toEqual([f2]);
    const full = Array.from({ length: 100 }, (_, i) => ({ ...f1, fav_key: `food|f${i}` }));
    expect(upsertFavorite(full, f2)).toBeNull();
    expect(upsertFavorite(full.slice(0, 99), f2)).toHaveLength(100);
  });

  it('Reihenfolge: zuletzt gegessen zuerst, dann alphabetisch', () => {
    const fQuick = favoriteFromEntry(quick700) as FoodLogFavorite;
    const fBanana = favoriteFromEntry(banana1) as FoodLogFavorite;
    const fApfel = { ...fBanana, fav_key: 'food|apfel', food_id: 'apfel', title_de: 'Apfel' };
    const ordered = orderFavorites(
      [fApfel, fBanana, fQuick],
      [timed(banana2, '2026-10-14T10:00:00Z'), timed(quick700, '2026-10-14T19:00:00Z')],
    );
    expect(ordered.map((f) => f.fav_key)).toEqual([fQuick.fav_key, fBanana.fav_key, 'food|apfel']);
  });

  it('Schlüssel: Plan-Mahlzeit wie Rezept, Schnelleintrag ohne kcal', () => {
    expect(foodLogKey(plan)).toBe('recipe|spaghetti-tomatensauce');
    expect(
      foodLogKey({
        source: 'quick',
        food_id: null,
        recipe_id: null,
        title_de: 'Snack',
        kcal: null,
      }),
    ).toBe('quick|Snack|');
  });
});

describe('Suche im Katalog', () => {
  const library = { foods: FOODS, recipes: FIXTURE_RECIPES };
  it('„Banane“ findet das Lebensmittel und Rezepte mit Banane im Titel', () => {
    const result = searchFoodLogCatalog(library, 'Banane');
    expect(result.foods.map((f) => f.id)).toContain('banane');
    expect(result.recipes.map((r) => r.id)).toContain('porridge-banane');
  });
  it('Umlaute/Groß-Kleinschreibung wie die Zutaten-Suche; unter 2 Zeichen nichts; ohne Treffer leer', () => {
    expect(searchFoodLogCatalog(library, 'b')).toEqual({ foods: [], recipes: [] });
    expect(searchFoodLogCatalog(library, 'xyzxyz')).toEqual({ foods: [], recipes: [] });
    expect(searchFoodLogCatalog(library, 'BANANE').foods.map((f) => f.id)).toContain('banane');
  });
  it('Treffer am Wortanfang vor Treffern im Wort; höchstens 20', () => {
    const foods = foodLookup([
      makeFood({ id: 'zz-milchreis', name_de: 'Milchreis' }),
      makeFood({ id: 'aa-vollmilch', name_de: 'Vollmilch' }),
    ]);
    const result = searchFoodLogCatalog({ foods, recipes: [] }, 'milch');
    expect(result.foods.map((f) => f.id)).toEqual(['zz-milchreis', 'aa-vollmilch']);
    const many = foodLookup(
      Array.from({ length: 30 }, (_, i) => makeFood({ id: `apfel-${i}`, name_de: `Apfel ${i}` })),
    );
    expect(searchFoodLogCatalog({ foods: many, recipes: [] }, 'apfel').foods).toHaveLength(20);
  });
});

describe('Antwort von save_food_log_entries je Eintrag (Wächter S2/H1)', () => {
  it('saved, conflict (revision, plan_item_exists, deleted mit id null), rejected mit Code', () => {
    const ok = foodLogSaveResponseSchema.safeParse([
      { result: 'saved', id: ID(1), revision: 1 },
      { result: 'conflict', reason: 'revision', id: ID(2), revision: 3 },
      { result: 'conflict', reason: 'plan_item_exists', id: ID(3), revision: 1 },
      { result: 'conflict', reason: 'deleted', id: null, revision: null },
      { result: 'rejected', code: 'out_of_range' },
    ]);
    expect(ok.success).toBe(true);
  });
  it('id null nur bei „deleted“; unbekannte Codes und Felder abgelehnt', () => {
    expect(
      foodLogSaveResponseSchema.safeParse([
        { result: 'conflict', reason: 'revision', id: null, revision: null },
      ]).success,
    ).toBe(false);
    expect(
      foodLogSaveResponseSchema.safeParse([{ result: 'rejected', code: 'kaputt' }]).success,
    ).toBe(false);
    expect(
      foodLogSaveResponseSchema.safeParse([{ result: 'saved', id: ID(1), revision: 1, kcal: 5 }])
        .success,
    ).toBe(false);
    expect(foodLogSaveResponseSchema.safeParse([]).success).toBe(false);
  });
});
