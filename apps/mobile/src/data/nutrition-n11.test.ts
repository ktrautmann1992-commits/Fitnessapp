/**
 * Etappe N11 (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11): Kühlschrank-Suche „Was habe ich da?“ in der App
 * (Testmodus). Treffer nur über `filter.ts` mit demselben Profil wie Essensplan und Rezeptsuche (Ernährungsform des
 * Profils, Schwein, Unverträglichkeiten mit Einwilligung, „mag ich nicht“ je Gruppe und je Lebensmittel,
 * Schwangerschaft); ohne gültige Einwilligung blockiert; die Auswahl wird nicht gespeichert und nicht geloggt.
 */
import {
  type DietType,
  filterRecipe,
  mealPlanProfileSchema,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { fridgeSearchForPerson, fridgeSearchResults, prepareFridgeSearch } from './fridge-search';
import {
  computeNutritionWeek,
  mealPlanProfileFromRows,
  nutritionWeekStart,
  type NutritionWeekResult,
} from './nutrition-plan';
import type { UserRows } from './types';

const WEEK = nutritionWeekStart(TODAY);

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();

interface PersonOptions {
  consent?: 'valid' | 'none';
  flags?: string[];
  diet?: DietType;
  eatsPork?: boolean | null;
  intolerances?: string[];
  dislikes?: string[];
  dislikedFoods?: string[];
}

function rows(options: PersonOptions = {}): UserRows {
  const consent = options.consent ?? 'valid';
  const base = planPersonRows({ consent, goal: 'fat_loss', flags: options.flags ?? [] });
  const prefs = [
    ...(options.intolerances ?? []).map((group) => ({ group, kind: 'intolerance' })),
    ...(options.dislikes ?? []).map((group) => ({ group, kind: 'dislike' })),
  ];
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: options.diet ?? 'vegetarian',
      eats_pork: options.diet === 'omnivore' ? (options.eatsPork ?? null) : null,
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
    foodPreferences: prefs.map((p, i) => ({
      id: `fp-${i}`,
      user_id: USER_ID,
      food_group: p.group,
      kind: p.kind,
    })) as UserRows['foodPreferences'],
    foodDislikes: (options.dislikedFoods ?? []).map((food_id) => ({ user_id: USER_ID, food_id })),
    bodyMetrics:
      consent === 'valid'
        ? [
            {
              id: 'bm-1',
              user_id: USER_ID,
              measured_on: '2026-09-20',
              height_cm: 170,
              weight_kg: 70,
              body_fat_pct: null,
              resting_heart_rate_bpm: null,
            },
          ]
        : [],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }>;

function week(data: UserRows): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart: WEEK,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready') throw new Error(`Woche erwartet: ${result.kind}`);
  return result;
}

function fridge(data: UserRows, foodIds: readonly string[]) {
  const result = fridgeSearchForPerson({
    library: LIBRARY,
    rows: data,
    versions: VERSIONS,
    week: week(data),
    allowDrafts: true,
    foodIds,
  });
  if (result.kind !== 'ok') throw new Error(`Suche erwartet: ${result.kind}`);
  return result;
}

const PEOPLE: { name: string; data: PersonOptions }[] = [
  { name: 'vegetarisch', data: {} },
  { name: 'vegan', data: { diet: 'vegan' } },
  { name: 'Mischkost, Schwein unbekannt', data: { diet: 'omnivore', eatsPork: null } },
  { name: 'Mischkost mit Schwein', data: { diet: 'omnivore', eatsPork: true } },
  { name: 'Erdnuss-Unverträglichkeit', data: { diet: 'vegan', intolerances: ['peanuts'] } },
  {
    name: 'schwanger',
    data: { diet: 'omnivore', eatsPork: true, flags: ['pregnancy', 'conservative_plan'] },
  },
  { name: 'Pilze „mag ich nicht“', data: { diet: 'omnivore', dislikes: ['mushrooms'] } },
  {
    name: 'Paprika und Tofu je Lebensmittel abgelehnt',
    data: { diet: 'omnivore', eatsPork: true, dislikedFoods: ['paprika', 'tofu'] },
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Kühlschrank-Suche in der App (19.7 N11)', () => {
  it('Eigenschaftstest: alles ausgewählt → Treffer nur über filter.ts mit der Profil-Ernährungsform, nie Abgelehntes', () => {
    let checked = 0;
    for (const person of PEOPLE) {
      const data = rows(person.data);
      const profile = mealPlanProfileFromRows(data, VERSIONS);
      if (profile.kind !== 'ok') throw new Error('Profil erwartet');
      const parsed = mealPlanProfileSchema.parse(profile.profile);
      const pregnant = (person.data.flags ?? []).includes('pregnancy');
      const all = fridge(data, []).options.map((o) => o.foodId);
      for (const id of person.data.dislikedFoods ?? []) expect(all).not.toContain(id);
      const result = fridge(data, all);
      for (const card of result.cards) {
        checked += 1;
        const recipe = LIBRARY.recipes.find((r) => r.id === card.id);
        if (!recipe) throw new Error(card.id);
        const own = filterRecipe(recipe, LIBRARY.foods, {
          profile: parsed,
          excludePregnancyCaution: pregnant,
          allowDrafts: true,
        });
        expect(own.ok, `${person.name}: ${card.id}`).toBe(true);
        if (own.ok && pregnant) expect(own.value.facts.pregnancyCaution).toBe(false);
        expect(card.percent).toBeGreaterThan(0);
        expect(card.percent).toBeLessThanOrEqual(100);
      }
      expect(result.cards.length, person.name).toBeGreaterThan(0);
    }
    expect(checked).toBeGreaterThan(30);
  }, 60_000);

  it('feste Fälle: vegan mit Hähnchen-Auswahl → kein Fleisch; Erdnuss → kein Curry; Schwangerschaft → kein Räucherlachs', () => {
    const vegan = fridge(rows({ diet: 'vegan' }), ['haehnchenbrust', 'paprika', 'tofu']);
    expect(vegan.cards.map((c) => c.id)).not.toContain('haehnchen-reis');
    expect(vegan.cards.map((c) => c.id)).toContain('tofu-paprika');
    const peanut = fridge(rows({ diet: 'vegan', intolerances: ['peanuts'] }), ['tofu', 'reis']);
    expect(peanut.cards.map((c) => c.id)).not.toContain('tofu-erdnuss-curry');
    const pregnant = fridge(
      rows({ diet: 'omnivore', eatsPork: true, flags: ['pregnancy', 'conservative_plan'] }),
      ['raeucherlachs', 'vollkornbrot'],
    );
    expect(pregnant.cards.map((c) => c.id)).not.toContain('brot-raeucherlachs');
  });

  it('Karten: Prozent, vorhandene und fehlende Zutaten mit Namen, Vorrat getrennt, kcal je Portion, Entwurf', () => {
    const result = fridge(rows({ diet: 'omnivore', eatsPork: true }), ['haehnchenbrust']);
    const card = result.cards.find((c) => c.id === 'haehnchen-reis');
    expect(card?.have).toEqual(['Hähnchenbrust']);
    expect(card?.missing).toEqual(['Paprika rot']);
    expect(card?.missingMinor).toEqual(['Reis parboiled', 'Olivenöl', 'Speisesalz']);
    expect(card?.percent).toBe(48); // 150 g Hähnchen ÷ (150 g + 150 g Paprika + Vorrat × 0,1)
    expect(card?.percent).toBeLessThan(100);
    expect(card?.kcalPerServing).toBeGreaterThan(0);
    expect(card?.isDraft).toBe(true);
    expect(result.hasDrafts).toBe(true);
    expect(result.hasTestphase).toBe(false);
  });

  it('leere Auswahl, nur Gewürze, abgelehntes oder unbekanntes Lebensmittel in der Auswahl → keine Treffer', () => {
    const data = rows({ diet: 'omnivore', eatsPork: true, dislikedFoods: ['paprika'] });
    expect(fridge(data, []).cards).toEqual([]);
    expect(fridge(data, ['salz']).cards).toEqual([]);
    // Eine veraltete Auswahl (Lebensmittel inzwischen abgelehnt) zählt nicht.
    expect(fridge(data, ['paprika', 'gibt-es-nicht']).cards).toEqual([]);
  });

  it('Vorbereitung einmal, Ergebnisse je Auswahl gleich; Kartenliste begrenzt in gleicher Reihenfolge (Wächter N11 S2)', () => {
    const data = rows({ diet: 'omnivore', eatsPork: true });
    const prepared = prepareFridgeSearch({
      library: LIBRARY,
      rows: data,
      versions: VERSIONS,
      week: week(data),
      allowDrafts: true,
    });
    if (prepared.kind !== 'ok') throw new Error('ok erwartet');
    const all = prepared.options.map((o) => o.foodId);
    const full = fridgeSearchResults(prepared, all);
    expect(full.cards).toEqual(fridge(data, all).cards);
    expect(full.total).toBe(full.cards.length);
    expect(full.total).toBeGreaterThan(3);
    const page = fridgeSearchResults(prepared, all, 2);
    expect(page.total).toBe(full.total);
    expect(page.cards).toEqual(full.cards.slice(0, 2));
    expect(page.hasDrafts).toBe(full.hasDrafts);
    expect(page.hasTestphase).toBe(full.hasTestphase);
  });

  it('Unverträglichkeiten ohne gültige Einwilligung → blockiert (wie Essensplan und Rezeptsuche)', () => {
    const data = rows({ consent: 'none', intolerances: ['peanuts'] });
    const valid = week(rows({ diet: 'vegetarian' }));
    expect(
      fridgeSearchForPerson({
        library: LIBRARY,
        rows: data,
        versions: VERSIONS,
        week: valid,
        allowDrafts: true,
        foodIds: ['banane'],
      }).kind,
    ).toBe('blocked');
  });

  it('Auswahl wird nicht gespeichert und nicht geloggt: Zeilen unverändert, keine Konsolen-Ausgabe', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const data = rows({ diet: 'omnivore', eatsPork: true });
    const before = structuredClone(data);
    const ready = week(data);
    fridgeSearchForPerson({
      library: LIBRARY,
      rows: data,
      versions: VERSIONS,
      week: ready,
      allowDrafts: true,
      foodIds: ['haehnchenbrust', 'paprika'],
    });
    expect(data).toEqual(before);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
