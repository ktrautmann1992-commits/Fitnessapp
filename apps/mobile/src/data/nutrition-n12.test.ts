/**
 * Etappe N12 (docs/PLAN-PHASE-5.md 19.7 N12, 19.8 Nr. 8, KONZEPT 6.13): Einkaufsliste weitergeben – Zusammenstecken
 * in der App. Woche aus `computeNutritionWeek` (Testmodus, Beispiel-Bestand) → `shoppingListToText`. Der Text
 * enthält keine Gesundheitsdaten (keine Unverträglichkeit, keine Schwangerschaft, kein Gewicht, keine kcal, kein Ziel,
 * kein „statt“), Ersatzprodukte lösen den Hinweis aus, und es wird nichts geloggt.
 */
import {
  shoppingListShareNotice,
  shoppingListToText,
  type ShoppingListShareOptionsInput,
} from '@fitnessapp/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { DEMO_LIBRARY } from '../test/nutrition-print-examples';
import { computeNutritionWeek, type NutritionWeekResult } from './nutrition-plan';
import type { UserRows } from './types';

function rows(options: { intolerances?: string[]; flags?: string[] } = {}): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss', flags: options.flags ?? [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'vegetarian',
      eats_pork: null,
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: true,
    },
    foodPreferences: (options.intolerances ?? []).map((group, i) => ({
      id: `fp-${i}`,
      user_id: USER_ID,
      food_group: group,
      kind: 'intolerance',
    })) as UserRows['foodPreferences'],
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-09-20',
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }>;

function week(data: UserRows): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart: '2026-09-28',
    library: DEMO_LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.shopping === null) throw new Error('Liste erwartet');
  return result;
}

const FORBIDDEN = [
  /kcal|kalorie/i,
  /statt/i,
  /unverträglich|allergi|intoleran|laktoseintoleranz|zöliakie/i,
  /schwanger|stillzeit|pregnan/i,
  /körpergewicht|\bkg\b/i,
  /abnehmen|fat_loss|ziel/i,
  /https?:|www\.|utm_/i,
];

const OPTION_SETS: readonly ShoppingListShareOptionsInput[] = [
  {},
  { includeChecked: true },
  { includePantry: false, includeManual: false },
];

describe('Einkaufsliste weitergeben in der App (N12)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  }, 60_000);

  it('keine Gesundheitsdaten im Text – mit Unverträglichkeiten, Schwangerschaft und ohne', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const people = [
      rows(),
      rows({ intolerances: ['lactose'] }),
      rows({ intolerances: ['gluten', 'peanuts'] }),
      rows({ flags: ['pregnancy', 'conservative_plan'] }),
    ];
    for (const person of people) {
      const data = week(person);
      const list = data.shopping?.list;
      if (!list) throw new Error('Liste erwartet');
      for (const options of OPTION_SETS) {
        const result = shoppingListToText(list, options);
        if (!result.ok) continue;
        for (const pattern of FORBIDDEN) expect(result.text).not.toMatch(pattern);
        expect(result.omittedForLength).toBe(0);
      }
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  }, 60_000);

  it('Laktose-Unverträglichkeit: Ersatzprodukt im Text ohne Grund, Hinweis nennt es vor dem Weitergeben', () => {
    const data = week(rows({ intolerances: ['lactose'] }));
    const list = data.shopping?.list;
    if (!list) throw new Error('Liste erwartet');
    const substitutes = list.items.filter((i) => i.substituteFor.length > 0 && !i.checked);
    expect(substitutes.length).toBeGreaterThan(0);
    const notice = shoppingListShareNotice(list);
    expect(notice.required).toBe(true);
    expect(notice.usesHealthData).toBe(true);
    for (const item of substitutes) expect(notice.substituteLabels).toContain(item.labelDe);
    const result = shoppingListToText(list);
    if (!result.ok) throw new Error('Text erwartet');
    for (const item of substitutes) expect(result.text).toContain(item.labelDe);
  }, 60_000);

  it('Text hängt nur an der Liste – gleiche Liste, anderer Gesundheitsbezug → gleicher Text', () => {
    const list = week(rows({ intolerances: ['lactose'] })).shopping?.list;
    if (!list) throw new Error('Liste erwartet');
    const text = shoppingListToText(list);
    const stripped = shoppingListToText({
      ...list,
      items: list.items.map((i) => ({ ...i, substituteFor: [] })),
    });
    expect(stripped).toEqual(text);
    expect(shoppingListShareNotice({ ...list, usesHealthData: false, items: [] }).required).toBe(
      false,
    );
  }, 60_000);
});
