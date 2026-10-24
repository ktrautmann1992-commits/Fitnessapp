/**
 * Etappe N5c (docs/PLAN-PHASE-5.md 19.6, Auflagen des Wächters N5a): Rezeptsuche und Ratgeber in der App
 * (Testmodus). Treffer nur über `filter.ts` mit demselben Profil wie der Essensplan inkl. `pregnancy_caution` –
 * Eigenschaftstest über mehrere Personen: kein ausgeschlossenes Rezept in den Treffern, auch nicht über die
 * erweiterte Ernährungsform; Unverträglichkeiten ohne gültige Einwilligung → blockiert; Rezeptansicht aus der Suche
 * gekennzeichnet; Ratgeber nur freigegeben (Testmodus: Entwürfe) und ohne roten Befund.
 */
import {
  type DietType,
  filterRecipe,
  mealPlanProfileSchema,
  readableGuides,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  computeNutritionWeek,
  mealPlanProfileFromRows,
  nutritionWeekStart,
  type NutritionWeekResult,
  recipeForPerson,
} from './nutrition-plan';
import { recipeSearchForPerson } from './recipe-search';
import type { UserRows } from './types';

const WEEK = nutritionWeekStart(TODAY);

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();

function rows(
  options: {
    consent?: 'valid' | 'none';
    flags?: string[];
    diet?: DietType;
    eatsPork?: boolean | null;
    intolerances?: string[];
    dislikes?: string[];
  } = {},
): UserRows {
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

function search(data: UserRows, diets: DietType[] = []) {
  const result = recipeSearchForPerson({
    library: LIBRARY,
    rows: data,
    versions: VERSIONS,
    week: week(data),
    allowDrafts: true,
    query: { diets },
  });
  if (result.kind !== 'ok') throw new Error(`Suche erwartet: ${result.kind}`);
  return result;
}

const PEOPLE: { name: string; data: NonNullable<Parameters<typeof rows>[0]> }[] = [
  { name: 'vegetarisch', data: {} },
  { name: 'vegan', data: { diet: 'vegan' } },
  { name: 'Mischkost, Schwein unbekannt', data: { diet: 'omnivore', eatsPork: null } },
  { name: 'Mischkost ohne Schwein', data: { diet: 'omnivore', eatsPork: false } },
  { name: 'Mischkost mit Schwein', data: { diet: 'omnivore', eatsPork: true } },
  { name: 'Erdnuss-Unverträglichkeit', data: { diet: 'vegan', intolerances: ['peanuts'] } },
  {
    name: 'schwanger',
    data: { diet: 'omnivore', eatsPork: true, flags: ['pregnancy', 'conservative_plan'] },
  },
  { name: 'Fisch „mag ich nicht“', data: { diet: 'omnivore', dislikes: ['fish'] } },
  {
    name: 'vegan, schwanger, Erdnuss',
    data: {
      diet: 'vegan',
      intolerances: ['peanuts'],
      flags: ['pregnancy', 'conservative_plan'],
    },
  },
];

describe('Rezeptsuche in der App (19.6, Wächter-Auflage N5c)', () => {
  it('Eigenschaftstest: Treffer nur über filter.ts mit demselben Profil inkl. pregnancy_caution', () => {
    let checked = 0;
    for (const person of PEOPLE) {
      const data = rows(person.data);
      const ready = week(data);
      const profile = mealPlanProfileFromRows(data, VERSIONS);
      if (profile.kind !== 'ok') throw new Error('Profil erwartet');
      const parsed = mealPlanProfileSchema.parse(profile.profile);
      const pregnant = (person.data.flags ?? []).includes('pregnancy');
      for (const diets of [[], ['vegetarian'], ['omnivore'], ['vegetarian', 'omnivore']] as const) {
        const result = search(data, [...diets]);
        for (const card of result.cards) {
          checked += 1;
          const recipe = LIBRARY.recipes.find((r) => r.id === card.id);
          if (!recipe) throw new Error(card.id);
          const ctx = {
            excludePregnancyCaution: pregnant,
            allowDrafts: true,
          };
          const own = filterRecipe(recipe, LIBRARY.foods, { ...ctx, profile: parsed });
          const wide = filterRecipe(recipe, LIBRARY.foods, {
            ...ctx,
            profile: { ...parsed, diet: diets.length > 0 ? 'omnivore' : parsed.diet },
          });
          expect(own.ok || wide.ok, `${person.name}: ${card.id}`).toBe(true);
          expect(card.outsideProfileDiet === null, `${person.name}: ${card.id}`).toBe(own.ok);
          // Unabhängig: die Woche schließt Schwangerschafts-Rezepte aus, sobald ein Tag es verlangt.
          if (pregnant) {
            const variant = own.ok ? own.value : wide.ok ? wide.value : null;
            expect(variant?.facts.pregnancyCaution, card.id).toBe(false);
          }
        }
        // Gekennzeichnete Treffer gibt es nur, wenn erweitert wurde.
        if (diets.length === 0) {
          expect(result.cards.every((c) => c.outsideProfileDiet === null)).toBe(true);
        }
      }
      expect(ready.kind).toBe('ready');
    }
    expect(checked).toBeGreaterThan(50);
  }, 60_000);

  it('feste Fälle: Erdnuss-Curry, Schwein bei unbekannter Angabe, Räucherlachs in der Schwangerschaft', () => {
    const ids = (data: UserRows, diets: DietType[] = ['vegetarian', 'omnivore']) =>
      search(data, diets).cards.map((c) => c.id);
    expect(ids(rows({ diet: 'vegan' }))).toContain('tofu-erdnuss-curry');
    expect(ids(rows({ diet: 'vegan', intolerances: ['peanuts'] }))).not.toContain(
      'tofu-erdnuss-curry',
    );
    const unknownPork = ids(rows({ diet: 'vegetarian' }));
    expect(unknownPork).not.toContain('hack-spaghetti');
    expect(unknownPork).not.toContain('salami-brot');
    expect(ids(rows({ diet: 'omnivore', eatsPork: true }), [])).toContain('salami-brot');
    const pregnant = ids(
      rows({ diet: 'omnivore', eatsPork: true, flags: ['pregnancy', 'conservative_plan'] }),
      [],
    );
    expect(pregnant).not.toContain('brot-raeucherlachs');
    expect(pregnant).not.toContain('mascarponecreme-roh');
    expect(pregnant).not.toContain('salami-brot');
  });

  it('vorbelegt aus dem Profil, erweiterbar, gekennzeichnet; Unter 10 Minuten; kcal je Portion', () => {
    const own = search(rows({ diet: 'vegan' }));
    expect(own.profileDiet).toBe('vegan');
    expect(own.dietOptions).toEqual(['vegetarian', 'omnivore']);
    const wider = search(rows({ diet: 'vegan' }), ['vegetarian']);
    expect(wider.cards.length).toBeGreaterThan(own.cards.length);
    expect(wider.cards.find((c) => c.id === 'omelett-champignons')?.outsideProfileDiet).toBe(
      'vegetarian',
    );
    expect(own.cards.every((c) => c.perServing === null || c.perServing.kcal > 0)).toBe(true);
    // Makros je Portion auf der Karte: nie negativ, mindestens ein Rezept mit Eiweiß und Kohlenhydraten.
    expect(
      own.cards.every(
        (c) => c.perServing === null || (c.perServing.protein_g >= 0 && c.perServing.carbs_g >= 0),
      ),
    ).toBe(true);
    expect(own.cards.some((c) => (c.perServing?.protein_g ?? 0) > 0)).toBe(true);
    const quick = recipeSearchForPerson({
      library: LIBRARY,
      rows: rows({ diet: 'vegan' }),
      versions: VERSIONS,
      week: week(rows({ diet: 'vegan' })),
      allowDrafts: true,
      query: { quick: true },
    });
    if (quick.kind !== 'ok') throw new Error('ok erwartet');
    expect(quick.cards.length).toBeGreaterThan(0);
    expect(quick.cards.every((c) => c.totalMinutes <= 10)).toBe(true);
  });

  it('Unverträglichkeiten ohne gültige Einwilligung → blockiert (wie Essensplan und Rezeptansicht)', () => {
    const data = rows({ consent: 'none', intolerances: ['peanuts'] });
    const ready = computeNutritionWeek({
      rows: data,
      versions: VERSIONS,
      today: TODAY,
      weekStart: WEEK,
      library: LIBRARY,
      allowDrafts: true,
    });
    expect(ready.kind).toBe('blocked');
    // Auch direkt aufgerufen (Woche einer anderen Quelle): blockiert, nie ohne die Unverträglichkeit gesucht.
    const valid = week(rows({ diet: 'vegetarian' }));
    expect(
      recipeSearchForPerson({
        library: LIBRARY,
        rows: data,
        versions: VERSIONS,
        week: valid,
        allowDrafts: true,
        query: {},
      }).kind,
    ).toBe('blocked');
  });
});

describe('Rezeptansicht aus der Suche (K3/G4)', () => {
  const data = rows({ diet: 'vegan' });
  const ready = week(data);
  const open = (extraDiet: DietType | null, from: { date: string; slot: string } | null = null) =>
    recipeForPerson({
      recipeId: 'omelett-champignons',
      library: LIBRARY,
      rows: data,
      versions: VERSIONS,
      week: ready,
      allowDrafts: true,
      from,
      extraDiet,
    });

  it('mit erweiterter Form gekennzeichnet, ohne „passt nicht“, aus dem Essensplan nie erweitert', () => {
    expect(open(null).kind).toBe('not_for_you');
    const found = open('vegetarian');
    expect(found.kind).toBe('ok');
    if (found.kind === 'ok') expect(found.outsideProfileDiet).toBe('vegetarian');
    expect(open('vegetarian', { date: WEEK, slot: 'breakfast' }).kind).toBe('not_for_you');
    // Erweitern hebt keine Schwangerschaft auf.
    const pregnantData = rows({ diet: 'vegan', flags: ['pregnancy', 'conservative_plan'] });
    expect(
      recipeForPerson({
        recipeId: 'mascarponecreme-roh',
        library: LIBRARY,
        rows: pregnantData,
        versions: VERSIONS,
        week: week(pregnantData),
        allowDrafts: true,
        from: null,
        extraDiet: 'omnivore',
      }).kind,
    ).toBe('not_for_you');
  });
});

describe('Ratgeber im Testmodus (6.8)', () => {
  it('Beispiel-Ratgeber im Bestand, ohne roten Befund; live (ohne Entwürfe) keine', () => {
    expect(LIBRARY.excluded.filter((e) => e.kind === 'guide')).toEqual([]);
    expect(
      readableGuides(LIBRARY.guides, { allowDrafts: true })
        .map((g) => g.id)
        .sort(),
    ).toEqual(['demo-unterwegs', 'demo-wettkampf']);
    expect(readableGuides(LIBRARY.guides, { allowDrafts: false })).toEqual([]);
  });
});
