import {
  type Guide,
  importAssumptionsFingerprint,
  type MealPrepPlan,
  type NutritionContentFile,
  type Recipe,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { buildNutritionAdmin, type NutritionAdmin } from '@/lib/admin/nutrition';

import FoodDetailPage from './lebensmittel/[id]/page';
import FoodsPage from './lebensmittel/page';
import SubstitutionsPage from './austausch/page';
import MealPrepPage from './meal-prep/page';
import GuidesPage from './ratgeber/page';
import RecipeDetailPage from './rezepte/[id]/page';
import RecipesPage from './rezepte/page';

/**
 * Wächter N2d S4: Die Ernährungs-Seiten des Redaktionsbereichs MIT Daten rendern (E2E deckt nur die Leerzustände ab,
 * solange foods-import/alpha5-import nicht gelaufen sind). Daten: Beispiel-Inhalte mit TESTWERTEN
 * (@fitnessapp/core/demo-nutrition) plus ein Meal-Prep-Plan und ein Ratgeber; Zugang ist hier gemockt (die echte
 * Zugangsprüfung testen admin.spec.ts und access/session-Tests).
 */

let admin: NutritionAdmin;

vi.mock('@/lib/admin/access', () => ({
  getAdminAccess: async () => ({ state: 'ok' }),
  requireAdmin: async () => undefined,
}));
vi.mock('@/lib/admin/data', () => ({
  getNutritionAdmin: () => admin,
}));

const PLAN: MealPrepPlan = {
  id: 'pasta-woche',
  version: 1,
  status: 'draft',
  title_de: 'Pasta-Woche',
  description_de: 'Testplan mit Spaghetti, keine echten Inhalte.',
  recipe_ids: ['spaghetti-tomatensauce', 'gibt-es-nicht'],
  cook_steps: [{ start_min: 0, text_de: 'Sauce kochen.' }],
  storage_plan: (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((weekday, index) => ({
    recipe_id: 'spaghetti-tomatensauce',
    weekday,
    method: index < 3 ? ('fridge' as const) : ('freeze' as const),
  })),
  storage_de: ['Hält im Kühlschrank 3 Tage.'],
  meta: {
    origin: 'manual',
    model: null,
    batch_id: null,
    created_on: '2026-10-11',
    expert_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  },
};

const GUIDE: Guide = {
  id: 'wettkampf',
  version: 1,
  status: 'draft',
  title_de: 'Wettkampf-Ernährung',
  sections: [
    {
      heading_de: 'Nichts Neues am Wettkampftag',
      body_de: ['Teste jede Mahlzeit vorher im Training.'],
    },
  ],
  places: [
    { name_de: 'Beim Bäcker', good_de: ['Vollkornbrötchen'], less_often_de: ['Croissants'] },
  ],
  meta: PLAN.meta,
};

function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

const noParams = Promise.resolve({});

beforeAll(() => {
  const demo = demoNutritionContent();
  const files: NutritionContentFile[] = demo.files.map((file) => {
    if (file.kind !== 'recipe') return file;
    const recipe = structuredClone(file.data) as Recipe;
    if (recipe.id === 'porridge-banane') recipe.categories = ['schnell', 'post-workout'];
    if (recipe.id === 'lachs-reis-annahme') {
      // Bestätigt, danach Schritt geändert → „Fingerabdruck passt nicht“.
      recipe.meta = {
        ...recipe.meta,
        import_assumptions_confirmed_by: 'KT',
        import_assumptions_fingerprint: importAssumptionsFingerprint(recipe),
      };
      recipe.steps_de = [...recipe.steps_de, 'Zum Schluss mit rohem Lachs garnieren.'];
    }
    return { ...file, data: recipe };
  });
  files.push({ kind: 'meal_prep_plan', fileName: 'pasta-woche.json', data: PLAN });
  files.push({ kind: 'guide', fileName: 'wettkampf.json', data: GUIDE });
  admin = buildNutritionAdmin(files, demo.catalog);
}, 60_000);

describe(
  'Redaktionsbereich Ernährung mit Beispiel-Inhalten (Wächter N2d S4)',
  { timeout: 60_000 },
  () => {
    it('Rezepte: Kategorien-Übersicht, Kategorie, „ohne Kategorie“ (nur per ID)', async () => {
      const overview = text(render(await RecipesPage({ searchParams: noParams })));
      expect(overview).toContain(`${admin.recipes.length} Rezepte`);
      expect(overview).toContain('Fertig in 10 Minuten (1)');
      expect(overview).toContain('Ohne Kategorie');
      expect(overview).toContain('bereit zur Freigabe per ID');

      const group = text(
        render(await RecipesPage({ searchParams: Promise.resolve({ kategorie: 'post-workout' }) })),
      );
      expect(group).toContain('Porridge mit Banane');
      expect(group).toContain('Sammelfreigabe: übersprungen');
      expect(group).toContain('Sammelfreigabe „Post-Workout“');

      const none = text(
        render(await RecipesPage({ searchParams: Promise.resolve({ kategorie: 'ohne' }) })),
      );
      expect(none).toContain('Freigabe per ID (ohne Kategorie)');
      expect(none).toContain('Freigabe per ID: übersprungen');
      expect(none).not.toContain('Sammelfreigabe: wird freigegeben');
    });

    it('jede Rezept-Seite rendert; ohne Kategorie „über die Sammelfreigabe nicht erreichbar“', async () => {
      for (const entry of admin.recipes) {
        const html = text(
          render(await RecipeDetailPage({ params: Promise.resolve({ id: entry.recipe.id }) })),
        );
        expect(html, entry.recipe.id).toContain(entry.recipe.title_de);
        expect(html).toContain('So steht es später in der App');
        if (entry.releasePath === 'ids') {
          expect(html, entry.recipe.id).toContain('über die Sammelfreigabe nicht erreichbar');
          expect(html).not.toContain('bei der Sammelfreigabe seiner Kategorie');
        }
      }
      const changed = text(
        render(await RecipeDetailPage({ params: Promise.resolve({ id: 'lachs-reis-annahme' }) })),
      );
      expect(changed).toContain('seitdem geändert (Fingerabdruck passt nicht)');
    });

    it('Lebensmittel: Liste und jede Detailseite', async () => {
      const list = text(render(await FoodsPage({ searchParams: noParams })));
      expect(list).toContain('Haferflocken');
      for (const entry of admin.foods) {
        const html = text(
          render(await FoodDetailPage({ params: Promise.resolve({ id: entry.food.id }) })),
        );
        expect(html, entry.food.id).toContain(entry.food.name_de);
      }
    });

    it('Meal-Prep-Plan und Ratgeber mit Daten, Freigabe-Hinweis per ID', async () => {
      const plans = text(render(await MealPrepPage()));
      expect(plans).toContain('Pasta-Woche');
      expect(plans).toContain('gibt-es-nicht (fehlt)');
      expect(plans).toContain('Freigabe per ID');
      expect(plans).toContain('pasta-woche');
      const guides = text(render(await GuidesPage()));
      expect(guides).toContain('Wettkampf-Ernährung');
      expect(guides).toContain('Beim Bäcker');
      expect(guides).toContain('Health-Claims');
    });

    it('Austausch-Tabelle (N9): Paare mit Rolle, Faktor, Hinweis, Prüfbericht und Freigabe per ID', async () => {
      const page = text(render(await SubstitutionsPage()));
      expect(admin.substitutions.length).toBeGreaterThan(0);
      expect(page).toContain(`${admin.substitutions.length} Einträge`);
      expect(page).toContain('Tofu natur → Hähnchenbrust');
      expect(page).toContain('Eiweißquelle (Messgröße: Eiweiß (g))');
      expect(page).toContain('0,57 × Masse der Zutat');
      expect(page).toContain('Hähnchen gut durchgaren.');
      expect(page).toContain('tausch-tofu-zu-haehnchenbrust');
      // Süße: gelber Befund R23H im Prüfbericht.
      expect(page).toContain('R23H');
      expect(page).toContain('Freigabe per ID');
      expect(page).toContain('R23');
    });
  },
);
