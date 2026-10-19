import {
  importAssumptionsFingerprint,
  type NutritionContentFile,
  type Recipe,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { CONTENT_BUNDLE } from '@/generated/content-files';

import { getNutritionAdmin } from './data';
import {
  buildNutritionAdmin,
  filterFoods,
  NO_CATEGORY,
  parseFoodFilters,
  parseRecipeGroup,
} from './nutrition';

// Testdaten: Beispiel-Katalog und -Rezepte mit TESTWERTEN (@fitnessapp/core/demo-nutrition), alle Entwurf.
const demo = demoNutritionContent();

function edit(
  files: readonly NutritionContentFile[],
  id: string,
  change: (data: Record<string, unknown>) => void,
): NutritionContentFile[] {
  return files.map((file) => {
    if (file.fileName !== `${id}.json`) return file;
    const data = structuredClone(file.data) as Record<string, unknown>;
    change(data);
    return { ...file, data };
  });
}

/** Alle Lebensmittel freigegeben (Voraussetzung für freigegebene Rezepte). */
function publishFoods(files: readonly NutritionContentFile[]): NutritionContentFile[] {
  return files.map((file) => {
    if (file.kind !== 'food') return file;
    const data = structuredClone(file.data) as Record<string, unknown> & {
      meta: Record<string, unknown>;
    };
    data.status = 'published';
    data.meta = { ...data.meta, reviewed_by: 'KT', reviewed_at: '2026-10-12' };
    return { ...file, data };
  });
}

function categorize(files: readonly NutritionContentFile[], ids: string[], category: string) {
  let result = [...files];
  for (const id of ids) {
    result = edit(result, id, (data) => {
      data.categories = [category];
    });
  }
  return result;
}

// Jeder Aufbau prüft den Bestand dreimal (validateContent + je ein „nachher“ für zwei Vorschauen; vor K2 fünfmal) –
// unter Last (turbo parallel) trotzdem langsam, daher der großzügige Timeout.
describe('Redaktionsbereich Ernährung (N2d)', { timeout: 30_000 }, () => {
  it('echter Stand aus dem Bündel lässt sich aufbauen (mit oder ohne Katalog im Repository)', () => {
    const admin = getNutritionAdmin();
    expect(admin.recipes.length).toBeLessThanOrEqual(CONTENT_BUNDLE.nutritionFiles.length);
    const bundledFoods = CONTENT_BUNDLE.nutritionFiles.filter((f) => f.kind === 'food').length;
    expect(admin.foods.length).toBe(bundledFoods);
    expect(admin.catalogMissing).toBe(bundledFoods === 0);
    // Die Begleitdaten des echten Bestands (Quellauszug, Listen) sind lesbar – sonst wären alle Lebensmittel rot.
    expect(admin.catalogProblems).toEqual([]);
    expect(admin.groups.map((g) => g.id)).toContain(NO_CATEGORY);
  });

  it('ohne Katalog und ohne Rezepte (leeres Repository): Hinweis „Katalog fehlt“, alles leer', () => {
    const admin = buildNutritionAdmin([], undefined);
    expect(admin.catalogMissing).toBe(true);
    expect(admin.foods).toEqual([]);
    expect(admin.recipes).toEqual([]);
    expect(admin.catalogProblems).toEqual([]);
    expect(admin.brokenFiles).toEqual([]);
  });

  it('Lebensmittel: Katalog-Prüfung, Erwartungsliste und Verwendung in Rezepten', () => {
    const admin = buildNutritionAdmin(demo.files, demo.catalog);
    const oats = admin.foodById.get('haferflocken');
    expect(oats?.catalogReviewed).toBe(true);
    expect(oats?.expectedGroups).toEqual(['gluten']);
    expect(oats?.usedIn.map((r) => r.id)).toContain('porridge-banane');
    expect(admin.catalogMissing).toBe(false);
    expect(admin.foods.length).toBe(demo.files.filter((f) => f.kind === 'food').length);
  });

  it('Rezepte nach Kategorie: n:m, „ohne Kategorie“, Zählung Entwürfe/rot/Annahmen', () => {
    const files = categorize(demo.files, ['porridge-banane', 'lachs-reis-annahme'], 'post-workout');
    const withSecond = edit(files, 'porridge-banane', (data) => {
      data.categories = ['schnell', 'post-workout'];
    });
    const admin = buildNutritionAdmin(withSecond, demo.catalog);
    const post = admin.groups.find((g) => g.id === 'post-workout');
    expect(post?.recipes.map((e) => e.recipe.id).sort()).toEqual([
      'lachs-reis-annahme',
      'porridge-banane',
    ]);
    expect(post?.counts.draft).toBe(2);
    expect(post?.withOpenAssumptions).toBe(1);
    expect(admin.groups.find((g) => g.id === 'schnell')?.recipes).toHaveLength(1);
    const none = admin.groups.find((g) => g.id === NO_CATEGORY);
    expect(none?.recipes.length).toBe(admin.recipes.length - 2);
  });

  it('Vorschau Sammelfreigabe: Lebensmittel nur Entwurf → nichts bereit; freigegeben → bereit, Annahme nur mit Häkchen', () => {
    const files = categorize(demo.files, ['porridge-banane', 'lachs-reis-annahme'], 'post-workout');
    const draftFoods = buildNutritionAdmin(files, demo.catalog);
    expect(draftFoods.groups.find((g) => g.id === 'post-workout')?.ready).toBe(0);
    expect(draftFoods.recipeById.get('porridge-banane')?.blockers.map((b) => b.kind)).toContain(
      'foods_not_published',
    );

    const admin = buildNutritionAdmin(publishFoods(files), demo.catalog);
    const post = admin.groups.find((g) => g.id === 'post-workout');
    expect(post?.ready).toBe(1);
    expect(post?.readyWithConfirm).toBe(2);
    expect(admin.recipeById.get('lachs-reis-annahme')?.openAssumptions).toBe(1);
  });

  it('S3: Rezepte ohne Kategorie sind nur per ID freigebbar (releasePath „ids“), mit Kategorie per Sammelfreigabe', () => {
    const files = categorize(publishFoods(demo.files), ['porridge-banane'], 'post-workout');
    const admin = buildNutritionAdmin(files, demo.catalog);
    expect(admin.recipeById.get('porridge-banane')?.releasePath).toBe('category');
    const none = admin.groups.find((g) => g.id === NO_CATEGORY);
    expect(none?.recipes.length).toBeGreaterThan(0);
    expect(none?.recipes.every((e) => e.releasePath === 'ids')).toBe(true);
  });

  it('Import-Annahme bestätigt, danach Zubereitung geändert → Stand „changed“, zählt als offen', () => {
    const files = edit(publishFoods(demo.files), 'lachs-reis-annahme', (data) => {
      const recipe = data as unknown as Recipe;
      data.meta = {
        ...recipe.meta,
        import_assumptions_confirmed_by: 'KT',
        import_assumptions_fingerprint: importAssumptionsFingerprint(recipe),
      };
      data.declared_pregnancy_caution = false;
    });
    const confirmed = buildNutritionAdmin(files, demo.catalog).recipeById.get('lachs-reis-annahme');
    expect(confirmed?.assumptionsState).toBe('confirmed');
    expect(confirmed?.openAssumptions).toBe(0);

    const changed = edit(files, 'lachs-reis-annahme', (data) => {
      data.steps_de = [...(data.steps_de as string[]), 'Mit rohem Lachs garnieren.'];
    });
    const entry = buildNutritionAdmin(changed, demo.catalog).recipeById.get('lachs-reis-annahme');
    expect(entry?.assumptionsState).toBe('changed');
    expect(entry?.openAssumptions).toBe(1);
    expect(entry?.facts.pregnancyCaution).toBe(true);
    expect(entry?.blockers.map((b) => b.kind)).toContain('unconfirmed_assumptions');
  });

  it('nicht katalog-geprüftes Lebensmittel wird am Rezept genannt', () => {
    const files = edit(demo.files, 'banane', (data) => {
      data.meta = {
        ...(data.meta as Record<string, unknown>),
        catalog_reviewed_by: null,
        catalog_reviewed_at: null,
      };
    });
    const admin = buildNutritionAdmin(files, demo.catalog);
    expect(admin.recipeById.get('porridge-banane')?.unreviewedFoodIds).toEqual(['banane']);
    expect(filterFoods(admin.foods, { pruefung: 'offen' }).map((e) => e.food.id)).toEqual([
      'banane',
    ]);
  });

  it('Abweichungen aus dem Import-Bericht: deklariert (Gründer-Datei) ↔ berechnet', () => {
    const files = edit(demo.files, 'porridge-banane', (data) => {
      data.declared_per_serving = { kcal: 700, protein_g: 18, carbs_g: 77, fat_g: 13.5 };
    });
    const admin = buildNutritionAdmin(files, demo.catalog);
    const deviations = admin.recipeById.get('porridge-banane')?.deviations ?? [];
    expect(deviations.map((d) => d.field)).toEqual(['kcal']);
    expect(admin.recipeById.get('spaghetti-tomatensauce')?.deviations).toEqual([]);
  });

  it('ohne Begleitdaten (Katalog-Fehler): Lebensmittel rot, Fehler sichtbar', () => {
    const admin = buildNutritionAdmin(demo.files, undefined, [
      'sources/x/1: Quelle nicht in der Allowlist',
    ]);
    expect(admin.catalogProblems).toHaveLength(1);
    expect(admin.foodById.get('haferflocken')?.summary.errors).toBeGreaterThan(0);
  });

  it('kaputte Datei landet unter „Dateien mit Fehlern“', () => {
    const admin = buildNutritionAdmin(
      [...demo.files, { kind: 'recipe', fileName: 'kaputt.json', jsonError: 'Unexpected token' }],
      demo.catalog,
    );
    expect(admin.brokenFiles.map((f) => f.id)).toEqual(['kaputt.json']);
  });

  it('Adresszeile wird geprüft: ungültige Kategorie/Filter werden ignoriert', () => {
    expect(parseRecipeGroup({ kategorie: 'meal-prep' })).toBe('meal-prep');
    expect(parseRecipeGroup({ kategorie: 'ohne' })).toBe('ohne');
    expect(parseRecipeGroup({ kategorie: '<script>' })).toBeUndefined();
    expect(parseFoodFilters({ pruefung: 'offen', q: 'Hafer' })).toEqual({
      pruefung: 'offen',
      q: 'Hafer',
    });
    expect(parseFoodFilters({ pruefung: 'egal' })).toEqual({ q: undefined, pruefung: undefined });
  });
});
