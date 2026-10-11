import { describe, expect, it } from 'vitest';

import { TRAINING_TIMES, type TrainingTime } from './schemas';
import { isSnackSlot, mealSlotLayout, mealSlotsForDay } from './timing';

const strength60 = [{ kind: 'strength' as const, minutes: 60 }];

describe('Mahlzeiten-Plätze (4.8)', () => {
  it('Layouts 1–8: richtige Anzahl, Anteile summieren sich zu 1, Uhrzeiten aufsteigend', () => {
    for (let meals = 1; meals <= 8; meals += 1) {
      const layout = mealSlotLayout(meals);
      expect(layout).toHaveLength(meals);
      expect(layout.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
      const times = layout.map((s) => s.timeMinutes);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(new Set(layout.map((s) => s.slot)).size).toBe(meals);
    }
    expect(mealSlotLayout(1).map((s) => s.slot)).toEqual(['main']);
    expect(mealSlotLayout(3).map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(mealSlotLayout(4).map((s) => [s.slot, s.share])).toEqual([
      ['breakfast', 0.25],
      ['lunch', 0.35],
      ['snack_afternoon', 0.1],
      ['dinner', 0.3],
    ]);
  });

  it('jede Trainingszeit × 1–8 Mahlzeiten: Anteile = 1, Rollen widerspruchsfrei, vor liegt vor nach', () => {
    for (const trainingTime of [...TRAINING_TIMES, null] as (TrainingTime | null)[]) {
      for (let meals = 1; meals <= 8; meals += 1) {
        for (const sessions of [[], strength60, [{ kind: 'endurance' as const, minutes: 150 }]]) {
          const day = mealSlotsForDay({ mealsPerDay: meals, trainingTime, sessions });
          expect(day.slots.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
          for (const s of day.slots) expect(s.share).toBeGreaterThan(0);
          const roles = day.slots.map((s) => s.role).filter((r) => r !== null);
          expect(new Set(roles).size).toBe(roles.length);
          const pre = day.slots.find((s) => s.role === 'pre');
          const post = day.slots.find((s) => s.role === 'post');
          if (pre && post) expect(pre.timeMinutes).toBeLessThan(post.timeMinutes);
          if (pre) expect(isSnackSlot(pre.slot)).toBe(false);
          const snack = day.slots.find((s) => s.role === 'pre_snack');
          if (snack) expect(isSnackSlot(snack.slot)).toBe(true);
          if (sessions.length === 0 || trainingTime === null || trainingTime === 'varies') {
            expect(roles).toEqual([]);
          }
        }
      }
    }
  });

  it('abends, 4 Mahlzeiten (Testperson 15): Abendessen = nach dem Training, +5 % Anteil', () => {
    const day = mealSlotsForDay({ mealsPerDay: 4, trainingTime: 'evening', sessions: strength60 });
    const dinner = day.slots.find((s) => s.slot === 'dinner');
    expect(dinner?.role).toBe('post');
    expect(dinner?.share).toBeCloseTo(0.35, 9);
  });

  it('nachmittags (16:00): Mittag vorher, Snack 30 min vorher, Abendessen danach', () => {
    const day = mealSlotsForDay({
      mealsPerDay: 4,
      trainingTime: 'afternoon',
      sessions: strength60,
    });
    expect(day.slots.map((s) => [s.slot, s.role])).toEqual([
      ['breakfast', null],
      ['lunch', 'pre'],
      ['snack_afternoon', 'pre_snack'],
      ['dinner', 'post'],
    ]);
  });

  it('vormittags: Frühstück 2 h vorher = vor dem Training, Mittag danach', () => {
    const day = mealSlotsForDay({ mealsPerDay: 3, trainingTime: 'morning', sessions: strength60 });
    expect(day.slots.map((s) => s.role)).toEqual(['pre', 'post', null]);
    expect(day.slots[0]?.share).toBeCloseTo(0.35, 9);
    expect(day.slots[1]?.share).toBeCloseTo(0.4, 9);
    expect(day.slots[2]?.share).toBeCloseTo(0.25, 9);
  });

  it('Frühtraining: Frühstück danach = nach dem Training, Hinweis early_training', () => {
    const day = mealSlotsForDay({ mealsPerDay: 3, trainingTime: 'early', sessions: strength60 });
    expect(day.slots[0]).toMatchObject({ slot: 'breakfast', role: 'post' });
    expect(day.notices).toEqual(['early_training']);
  });

  it('unterschiedlich oder Ruhetag: keine Zuordnung, Grundanteile', () => {
    const varies = mealSlotsForDay({
      mealsPerDay: 4,
      trainingTime: 'varies',
      sessions: strength60,
    });
    expect(varies.slots).toEqual(mealSlotLayout(4));
    const rest = mealSlotsForDay({ mealsPerDay: 4, trainingTime: 'evening', sessions: [] });
    expect(rest.slots).toEqual(mealSlotLayout(4));
  });

  it('1 Mahlzeit: Rolle ja, aber kein Umverteilen', () => {
    const day = mealSlotsForDay({ mealsPerDay: 1, trainingTime: 'midday', sessions: strength60 });
    expect(day.slots).toEqual([{ slot: 'main', share: 1, role: 'post', timeMinutes: 750 }]);
  });

  it('lange Ausdauer-Einheit ab 90 min → long_session_fueling (auch ohne Trainingszeit)', () => {
    expect(
      mealSlotsForDay({
        mealsPerDay: 3,
        trainingTime: null,
        sessions: [{ kind: 'endurance', minutes: 90 }],
      }).notices,
    ).toEqual(['long_session_fueling']);
    expect(
      mealSlotsForDay({
        mealsPerDay: 3,
        trainingTime: null,
        sessions: [{ kind: 'endurance', minutes: 89 }],
      }).notices,
    ).toEqual([]);
    expect(
      mealSlotsForDay({
        mealsPerDay: 3,
        trainingTime: null,
        sessions: [{ kind: 'strength', minutes: 120 }],
      }).notices,
    ).toEqual([]);
  });
});
