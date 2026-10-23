import { describe, expect, it } from 'vitest';

import { MEAL_SLOT_LAYOUTS } from '../constants';
import {
  calorieRing,
  goalFill,
  MEAL_CARD_GROUPS,
  macroProgress,
  mealCardEntrySlot,
  mealCardGroup,
  mealCardIntake,
  mealCardTargets,
} from './day-ring';
import { FOOD_LOG_SLOTS } from './food-log';
import { MEAL_PLAN_SLOT_KEYS } from './meal-plan-payload';
import { mealSlotLayout, mealSlotsForDay } from './timing';

describe('calorieRing', () => {
  it('Beispiel: 1.478 von 2.869 kcal gegessen → 1.391 übrig', () => {
    const ring = calorieRing({ targetKcal: 2869, eatenKcal: 1478 });
    expect(ring).toEqual({
      kind: 'ring',
      targetKcal: 2869,
      eatenKcal: 1478,
      remainingKcal: 1391,
      overKcal: 0,
      fraction: 1478 / 2869,
      overFraction: 0,
      percent: 52,
      state: 'open',
    });
  });

  it('keine Einträge: alles übrig, leerer Ring', () => {
    const ring = calorieRing({ targetKcal: 2000, eatenKcal: 0 });
    expect(ring).toMatchObject({ remainingKcal: 2000, fraction: 0, percent: 0, state: 'open' });
  });

  it('Ziel 0 oder kein Ziel: kein Ring (keine Division durch 0)', () => {
    expect(calorieRing({ targetKcal: 0, eatenKcal: 500 })).toEqual({ kind: 'no_target' });
    expect(calorieRing({ targetKcal: 0.4, eatenKcal: 0 })).toEqual({ kind: 'no_target' });
    expect(calorieRing({ targetKcal: null, eatenKcal: 500 })).toEqual({ kind: 'no_target' });
  });

  it('genau erreicht: 0 übrig, Ring voll, nichts zu viel', () => {
    expect(calorieRing({ targetKcal: 1800, eatenKcal: 1800 })).toMatchObject({
      remainingKcal: 0,
      overKcal: 0,
      fraction: 1,
      overFraction: 0,
      percent: 100,
      state: 'reached',
    });
  });

  it('Überschreitung: neutrale Zahl „zu viel“, zweite Runde anteilig', () => {
    expect(calorieRing({ targetKcal: 2000, eatenKcal: 2500 })).toMatchObject({
      remainingKcal: 0,
      overKcal: 500,
      fraction: 1,
      overFraction: 0.25,
      percent: 125,
      state: 'over',
    });
  });

  it('sehr hohe Werte: Ring und zweite Runde bleiben bei 1', () => {
    expect(calorieRing({ targetKcal: 1500, eatenKcal: 20_000 })).toMatchObject({
      overKcal: 18_500,
      fraction: 1,
      overFraction: 1,
      percent: 1333,
    });
  });

  it('Rundung: gegessen + übrig = Ziel (aus gerundeten Werten)', () => {
    const ring = calorieRing({ targetKcal: 2000.4, eatenKcal: 999.6 });
    expect(ring).toMatchObject({ targetKcal: 2000, eatenKcal: 1000, remainingKcal: 1000 });
    const tiny = calorieRing({ targetKcal: 2000, eatenKcal: 2000.4 });
    expect(tiny).toMatchObject({ eatenKcal: 2000, state: 'reached' });
  });

  it('ungültige Eingaben werfen', () => {
    expect(() => calorieRing({ targetKcal: 2000, eatenKcal: -1 })).toThrow();
    expect(() => calorieRing({ targetKcal: Number.NaN, eatenKcal: 0 })).toThrow();
    expect(() => calorieRing({ targetKcal: -5, eatenKcal: 0 })).toThrow();
    expect(() => calorieRing({ targetKcal: 2000, eatenKcal: Infinity })).toThrow();
  });
});

describe('macroProgress', () => {
  it('Beispiel 47 / 222 g', () => {
    expect(macroProgress(47, 222)).toEqual({
      eatenG: 47,
      targetG: 222,
      fraction: 47 / 222,
      overG: 0,
      percent: 21,
      over: false,
    });
  });

  it('rundet auf ganze Gramm (Anzeige „47,4“ → 47)', () => {
    expect(macroProgress(47.4, 221.6)).toMatchObject({ eatenG: 47, targetG: 222 });
  });

  it('kein oder 0-Ziel → null', () => {
    expect(macroProgress(10, null)).toBeNull();
    expect(macroProgress(10, 0)).toBeNull();
  });

  it('Überschreitung: Balken voll, Gramm darüber', () => {
    expect(macroProgress(150, 100)).toMatchObject({
      fraction: 1,
      overG: 50,
      percent: 150,
      over: true,
    });
  });

  it('genau am Ziel ist nicht drüber, 1 g mehr schon (keine Toleranz)', () => {
    expect(macroProgress(150, 150)).toMatchObject({ over: false, fraction: 1, percent: 100 });
    expect(macroProgress(151, 150)).toMatchObject({ over: true, overG: 1 });
  });

  it('keine Einträge: 0 g', () => {
    expect(macroProgress(0, 80)).toMatchObject({ eatenG: 0, fraction: 0, percent: 0 });
  });

  it('ungültig wirft', () => {
    expect(() => macroProgress(-1, 100)).toThrow();
    expect(() => macroProgress(1, Number.NaN)).toThrow();
  });
});

describe('mealCardGroup / mealCardEntrySlot', () => {
  it('jeder Platz (Plan und Tagebuch) landet auf genau einer Karte', () => {
    for (const slot of [...MEAL_PLAN_SLOT_KEYS, ...FOOD_LOG_SLOTS]) {
      expect(MEAL_CARD_GROUPS).toContain(mealCardGroup(slot));
    }
    expect(mealCardGroup('breakfast')).toBe('breakfast');
    expect(mealCardGroup('main')).toBe('lunch');
    expect(mealCardGroup('lunch')).toBe('lunch');
    expect(mealCardGroup('dinner')).toBe('dinner');
    expect(mealCardGroup('snack_afternoon')).toBe('snacks');
    expect(mealCardGroup('extra_1')).toBe('snacks');
    expect(mealCardGroup('other')).toBe('snacks');
  });

  it('„+“ trägt im passenden Platz ein', () => {
    expect(mealCardEntrySlot('breakfast')).toBe('breakfast');
    expect(mealCardEntrySlot('lunch')).toBe('lunch');
    expect(mealCardEntrySlot('dinner')).toBe('dinner');
    expect(mealCardEntrySlot('snacks')).toBe('other');
  });
});

describe('mealCardTargets', () => {
  it('4 Mahlzeiten (25/35/10/30 %) bei 2.400 kcal', () => {
    expect(mealCardTargets(2400, mealSlotLayout(4))).toEqual({
      breakfast: 600,
      lunch: 840,
      dinner: 720,
      snacks: 240,
    });
  });

  it('Summe = Tagesziel für 1–8 Mahlzeiten und krumme Ziele (größter Rest)', () => {
    for (const count of Object.keys(MEAL_SLOT_LAYOUTS).map(Number)) {
      for (const target of [1, 7, 1201, 1999, 2869, 4567]) {
        const cards = mealCardTargets(target, mealSlotLayout(count));
        const sum = MEAL_CARD_GROUPS.reduce((s, g) => s + (cards[g] ?? 0), 0);
        expect(sum).toBe(target);
        for (const g of MEAL_CARD_GROUPS) {
          const value = cards[g];
          if (value !== null) expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });

  it('1 Mahlzeit: alles auf „Mittagessen“ (Hauptmahlzeit), andere Karten ohne Ziel', () => {
    expect(mealCardTargets(1800, mealSlotLayout(1))).toEqual({
      breakfast: null,
      lunch: 1800,
      dinner: null,
      snacks: null,
    });
  });

  it('2 Mahlzeiten: kein Frühstück, keine Snacks', () => {
    expect(mealCardTargets(2001, mealSlotLayout(2))).toEqual({
      breakfast: null,
      lunch: 1001,
      dinner: 1000,
      snacks: null,
    });
  });

  it('übernimmt den Bonus vor/nach dem Training aus den Tageszielen', () => {
    const day = mealSlotsForDay({
      mealsPerDay: 4,
      trainingTime: 'evening',
      sessions: [{ kind: 'strength', minutes: 60 }],
    });
    const cards = mealCardTargets(2000, day.slots);
    const base = mealCardTargets(2000, mealSlotLayout(4));
    expect(cards).not.toEqual(base);
    expect(MEAL_CARD_GROUPS.reduce((s, g) => s + (cards[g] ?? 0), 0)).toBe(2000);
  });

  it('kein Ziel, Ziel 0 oder keine Plätze', () => {
    const none = { breakfast: null, lunch: null, dinner: null, snacks: null };
    expect(mealCardTargets(null, mealSlotLayout(3))).toEqual(none);
    expect(mealCardTargets(2000, [])).toEqual(none);
    expect(mealCardTargets(2000, [{ slot: 'lunch', share: 0 }])).toEqual(none);
    expect(mealCardTargets(0, mealSlotLayout(3))).toEqual({
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snacks: null,
    });
  });

  it('normiert Anteile, die nicht genau 1 ergeben', () => {
    expect(
      mealCardTargets(1000, [
        { slot: 'breakfast', share: 0.2 },
        { slot: 'dinner', share: 0.2 },
      ]),
    ).toEqual({ breakfast: 500, lunch: null, dinner: 500, snacks: null });
  });

  it('ungültige Eingaben werfen', () => {
    expect(() => mealCardTargets(-1, mealSlotLayout(3))).toThrow();
    expect(() => mealCardTargets(2000, [{ slot: 'lunch', share: -0.1 }])).toThrow();
  });
});

describe('mealCardIntake', () => {
  it('summiert je Karte, Einträge ohne kcal nur gezählt', () => {
    const sums = mealCardIntake([
      { slot: 'breakfast', kcal: 317 },
      { slot: 'main', kcal: 600 },
      { slot: 'lunch', kcal: 200 },
      { slot: 'snack_afternoon', kcal: 150 },
      { slot: 'other', kcal: null },
      { slot: 'extra_2', kcal: 90 },
    ]);
    expect(sums).toEqual({
      breakfast: { count: 1, kcal: 317, withoutValue: 0 },
      lunch: { count: 2, kcal: 800, withoutValue: 0 },
      dinner: { count: 0, kcal: 0, withoutValue: 0 },
      snacks: { count: 3, kcal: 240, withoutValue: 1 },
    });
  });

  it('keine Einträge: überall 0', () => {
    const sums = mealCardIntake([]);
    for (const g of MEAL_CARD_GROUPS)
      expect(sums[g]).toEqual({ count: 0, kcal: 0, withoutValue: 0 });
  });

  it('sehr hohe Werte werden ohne Grenze summiert und gerundet', () => {
    expect(
      mealCardIntake([
        { slot: 'dinner', kcal: 9999 },
        { slot: 'dinner', kcal: 9999 },
      ]).dinner,
    ).toEqual({ count: 2, kcal: 19_998, withoutValue: 0 });
  });
});

describe('goalFill (Ziel-Ring: füllt sich, über dem Ziel Dunkelrot)', () => {
  it('Ziel 0, fehlend, NaN, negativ oder unendlich → kein Ring', () => {
    expect(goalFill(10, 0)).toBeNull();
    expect(goalFill(10, null)).toBeNull();
    expect(goalFill(10, undefined)).toBeNull();
    expect(goalFill(10, Number.NaN)).toBeNull();
    expect(goalFill(10, -50)).toBeNull();
    expect(goalFill(10, Number.POSITIVE_INFINITY)).toBeNull();
    // 0,4 wird auf 0 gerundet → kein sinnvolles Ziel.
    expect(goalFill(10, 0.4)).toBeNull();
  });

  it('nichts gegessen → leer', () => {
    expect(goalFill(0, 420)).toEqual({ eaten: 0, goal: 420, fraction: 0, percent: 0, over: false });
  });

  it('teilweise gefüllt', () => {
    expect(goalFill(120, 420)).toMatchObject({ fraction: 120 / 420, percent: 29, over: false });
  });

  it('genau 100 % → voll, aber nicht drüber', () => {
    expect(goalFill(150, 150)).toEqual({
      eaten: 150,
      goal: 150,
      fraction: 1,
      percent: 100,
      over: false,
    });
  });

  it('101 % → drüber, Ring voll', () => {
    expect(goalFill(101, 100)).toEqual({
      eaten: 101,
      goal: 100,
      fraction: 1,
      percent: 101,
      over: true,
    });
  });

  it('rundet wie die Anzeige: 150,4 / 150 g ist nicht drüber, 150,6 schon', () => {
    expect(goalFill(150.4, 150)?.over).toBe(false);
    expect(goalFill(150.6, 150)?.over).toBe(true);
  });

  it('riesige Werte: Anteil bleibt 1, Prozent endlich', () => {
    const fill = goalFill(1e9, 85);
    expect(fill).toMatchObject({ fraction: 1, over: true });
    expect(Number.isFinite(fill?.percent)).toBe(true);
    expect(goalFill(5, 1e9)).toMatchObject({ fraction: 5 / 1e9, over: false, percent: 0 });
  });

  it('ungültig gegessen (negativ, NaN, unendlich, null) zählt als 0', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(goalFill(bad, 100)).toMatchObject({ eaten: 0, fraction: 0, over: false });
    }
  });

  it('gleiche Regel wie calorieRing: „over“ genau dann, wenn state „over“', () => {
    for (const eaten of [0, 1999, 2000, 2001, 5000]) {
      const ring = calorieRing({ targetKcal: 2000, eatenKcal: eaten });
      expect(ring.kind === 'ring' && ring.state === 'over').toBe(goalFill(eaten, 2000)?.over);
    }
  });
});
