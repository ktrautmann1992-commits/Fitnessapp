/**
 * Testphase (Gründer-Entscheidung 19.10.2026, docs/PLAN-PHASE-5.md „Nachtrag Testphase“): freigegebene Ernährungs-
 * Inhalte ohne Fachprüfung sind in der App nutzbar und gekennzeichnet „Testphase – noch nicht fachlich geprüft“
 * (Rezeptansicht, Ratgeber, Suche). Wie im Supabase-Modus: nur freigegebene Inhalte (allowDrafts: false). Entwürfe und
 * fachlich Geprüftes bekommen dieses Kennzeichen nie; Filter (Unverträglichkeiten) gelten unverändert.
 */
import {
  contentReviewMark,
  guideForDisplay,
  type NutritionLibrary,
  readableGuides,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { t } from '@/i18n';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { fridgeSearchForPerson } from './fridge-search';
import { loadNutritionLibrary } from './local-backend';
import { computeNutritionWeek, nutritionWeekStart } from './nutrition-plan';
import { recipeSearchForPerson } from './recipe-search';
import type { UserRows } from './types';

function rows(intolerances: string[] = []): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss', flags: [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'vegan',
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
    foodPreferences: intolerances.map((group, i) => ({
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

function search(library: NutritionLibrary, data: UserRows, allowDrafts: boolean) {
  const week = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart: nutritionWeekStart(TODAY),
    library,
    allowDrafts,
  });
  if (week.kind !== 'ready') throw new Error(`Woche erwartet: ${week.kind}`);
  const result = recipeSearchForPerson({
    library,
    rows: data,
    versions: VERSIONS,
    week,
    allowDrafts,
    query: { diets: [] },
  });
  if (result.kind !== 'ok') throw new Error(`Suche erwartet: ${result.kind}`);
  return { result, week };
}

describe('Testphase: freigegeben ohne Fachprüfung – nutzbar und gekennzeichnet', () => {
  it('Texte: dezenter Hinweis in Rezeptansicht und Ratgeber, kurzes Kennzeichen in den Suchen', () => {
    expect(t.nutrition.recipe.testphase).toBe('Testphase – noch nicht fachlich geprüft');
    expect(t.nutrition.guides.testphase).toBe('Testphase – noch nicht fachlich geprüft');
    // Kleines Kennzeichen „Testphase“ an den Karten (24.10.2026), ausgeschrieben für Bildschirmleser.
    expect(t.nutrition.search.testphase).toBe('Testphase');
    expect(t.nutrition.fridge.testphase).toBe('Testphase');
    expect(t.nutrition.search.testphaseA11y).toBe('Testphase – nicht fachlich geprüft');
    expect(t.nutrition.fridge.testphaseA11y).toBe('Testphase – nicht fachlich geprüft');
    // Wächter M2 (sichere Variante): Allergen-Warnung auch in der Testphase.
    expect(t.nutrition.fridge.testphaseAllergenWarning).toContain(
      'Allergene noch nicht fachlich geprüft',
    );
    // PDF: eigener Allergen-Hinweis für Testphase-Rezepte.
    expect(t.nutrition.print.testphaseAllergens).toBe(
      'Testphase: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    );
  });

  it('Bestand wie aus der Datenbank (nur freigegeben): Rezepte im Essensplan und in der Suche, alle gekennzeichnet', async () => {
    const { library, demo } = await loadNutritionLibrary({
      demo: true,
      force: true,
      testphase: true,
    });
    expect(demo).toBe(true);
    expect(library.recipes.length).toBeGreaterThan(10);
    expect(library.recipes.every((r) => r.status === 'published')).toBe(true);
    // Rezeptansicht: Hinweis „Testphase“, nie „KI-Entwurf“/„Entwurf“.
    expect(new Set(library.recipes.map((r) => contentReviewMark(r)))).toEqual(
      new Set(['testphase']),
    );
    // Wie im Supabase-Modus OHNE Entwürfe: Essensplan entsteht, Suche findet Rezepte – mit Kennzeichen.
    const { result, week } = search(library, rows(), false);
    expect(week.plan?.days.some((d) => d.meals.length > 0)).toBe(true);
    expect(result.cards.length).toBeGreaterThan(3);
    expect(result.cards.every((c) => c.isTestphase && !c.isDraft)).toBe(true);
    // Kühlschrank-Suche ebenso.
    const fridge = fridgeSearchForPerson({
      library,
      rows: rows(),
      versions: VERSIONS,
      week,
      allowDrafts: false,
      foodIds: [...library.foods.keys()].slice(0, 40),
    });
    if (fridge.kind !== 'ok') throw new Error(`Kühlschrank erwartet: ${fridge.kind}`);
    expect(fridge.cards.length).toBeGreaterThan(0);
    expect(fridge.cards.every((c) => c.isTestphase && !c.isDraft)).toBe(true);
    expect(fridge).toMatchObject({ hasDrafts: false, hasTestphase: true });
    // Ratgeber: lesbar ohne Entwürfe, Hinweis „Testphase“.
    const guides = readableGuides(library.guides, { allowDrafts: false });
    expect(guides.length).toBeGreaterThan(0);
    // Ratgeber mit Dosierungs-Befund (R21H) ohne Fachprüfung nicht freigegeben (Wächter H1).
    expect(guides.map((g) => g.id)).not.toContain('demo-wettkampf');
    for (const guide of guides) {
      expect(guideForDisplay(guide, { showNumbers: true })).toMatchObject({
        isDraft: false,
        isTestphase: true,
      });
    }
  });

  it('Schutzregeln unverändert: Unverträglichkeit Erdnüsse schließt das Erdnuss-Curry auch in der Testphase aus', async () => {
    const { library } = await loadNutritionLibrary({ demo: true, force: true, testphase: true });
    const ids = (data: UserRows) => search(library, data, false).result.cards.map((c) => c.id);
    expect(ids(rows())).toContain('tofu-erdnuss-curry');
    expect(ids(rows(['peanuts']))).not.toContain('tofu-erdnuss-curry');
  });

  it('Gegenprobe: Entwürfe (Testmodus) und fachlich Geprüftes ohne Testphase-Kennzeichen', async () => {
    const { library } = await loadNutritionLibrary({ demo: true, force: true });
    expect(library.recipes.some((r) => contentReviewMark(r) === 'testphase')).toBe(false);
    const { result } = search(library, rows(), true);
    expect(result.cards.every((c) => !c.isTestphase && c.isDraft)).toBe(true);
    const reviewed = library.recipes.map((r) => ({
      ...r,
      status: 'published' as const,
      meta: { ...r.meta, expert_reviewed: true },
    }));
    expect(reviewed.every((r) => contentReviewMark(r) === null)).toBe(true);
  });
});
