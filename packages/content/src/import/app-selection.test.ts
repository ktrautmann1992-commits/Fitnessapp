import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MEAL_PLAN_REPEAT_LIMITS, MEAL_SLOT_LAYOUTS, type MealType } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { ALPHA5_SECTIONS, type Alpha5File, Alpha5InputError, parseAlpha5File } from './alpha5';
import {
  allowedPhotoFiles,
  APP_SELECTION_PATH,
  type AppSelection,
  appSelectionProblems,
  appSelectionSchema,
  parseAppSelection,
  photoSlug,
  RECIPE_PHOTO_DIR,
} from './app-selection';

/**
 * App-Auswahl des Rezeptbuchs (Gründer-Entscheidung 30.10.2026, docs/PLAN-PHASE-5.md Nachtrag 30.10.2026):
 * alle Rezepte (gleicher Name in zwei Kapiteln nur einmal), nur Rezepte mit Foto, alle Meal-Prep-Pläne vollständig,
 * Essensplan für jede Ernährungsform weiter machbar.
 */

const REPO_ROOT = join(__dirname, '../../../..');
const FILE: Alpha5File = parseAlpha5File(
  JSON.parse(readFileSync(join(REPO_ROOT, 'packages/content/seed/alpha5-rezepte.json'), 'utf8')),
);
const RAW: unknown = JSON.parse(readFileSync(join(REPO_ROOT, APP_SELECTION_PATH), 'utf8'));
const SELECTION: AppSelection = appSelectionSchema.parse(RAW);
const SELECTED = new Set(SELECTION.rezepte);
const APP = FILE.rezepte.filter((r) => SELECTED.has(r.id));

describe('content/rezeptbuch-app-auswahl.json (echte Datei)', () => {
  it('Aufbau gültig, passt zur Gründer-Datei, keine Probleme', () => {
    expect(appSelectionProblems(SELECTION, FILE)).toEqual([]);
    expect(SELECTION.entschieden).toBe('Karsten 30.10.2026');
    expect(SELECTION.quelle).toBe(`alpha5-rezepte.json@${FILE.version}`);
    expect(SELECTION.regel.length).toBeGreaterThan(100);
    expect(() => parseAppSelection(RAW, FILE)).not.toThrow();
  });

  it('alle Rezepte der Gründer-Datei, nur Namens-Doppel (zweites Kapitel) bleiben im Buch', () => {
    const firstByName = new Map<string, string>();
    for (const r of FILE.rezepte) if (!firstByName.has(r.name)) firstByName.set(r.name, r.id);
    expect(SELECTION.rezepte).toEqual(
      FILE.rezepte.filter((r) => firstByName.get(r.name) === r.id).map((r) => r.id),
    );
  });

  it('Reihenfolge wie in der Gründer-Datei (stabile Diffs)', () => {
    expect(SELECTION.rezepte).toEqual(APP.map((r) => r.id));
  });

  it('nur Rezepte mit Foto: Dateiname je Rezept nach der Regel des Rezeptbuch-Baukastens', () => {
    expect(Object.keys(SELECTION.fotos.dateien).sort()).toEqual([...SELECTED].sort());
    for (const r of APP) {
      expect(allowedPhotoFiles(r)).toContain(SELECTION.fotos.dateien[r.id]);
    }
  });

  it.skipIf(!existsSync(join(REPO_ROOT, RECIPE_PHOTO_DIR)))(
    'Fotos liegen im Repository: jede Datei der Auswahl ist da',
    () => {
      const present = new Set(readdirSync(join(REPO_ROOT, RECIPE_PHOTO_DIR)));
      expect(Object.values(SELECTION.fotos.dateien).filter((f) => !present.has(f))).toEqual([]);
    },
  );

  it('alle Meal-Prep-Pläne vollständig in der App', () => {
    expect(SELECTION.meal_prep_plaene).toEqual(FILE.meal_prep_plaene.map((p) => p.id));
    for (const plan of FILE.meal_prep_plaene) {
      expect(plan.rezepte.every((id) => SELECTED.has(id))).toBe(true);
    }
  });

  it('kein Rezept doppelt mit gleichem Namen (Rezept in zwei Kapiteln nur einmal in der App)', () => {
    const names = APP.map((r) => r.name);
    expect(names.length).toBe(new Set(names).size);
  });

  /**
   * Mindestbestand je Ernährungsform und Mahlzeit, den die Essensplan-Engine für eine Woche ohne Wiederholungs-
   * Hinweis braucht (`MEAL_PLAN_REPEAT_LIMITS`, größtes Layout in `MEAL_SLOT_LAYOUTS`): Plätze je Woche ÷ erlaubte
   * Wiederholungen. Wettkampf-Rezepte zählen nicht (nur an Wettkampftagen).
   */
  it('Essensplan bleibt für jede Ernährungsform machbar (Mindestbestand der Engine)', () => {
    const maxSlots: Record<MealType, number> = { breakfast: 0, main: 0, snack: 0 };
    for (const layout of Object.values(MEAL_SLOT_LAYOUTS)) {
      const perType: Record<MealType, number> = { breakfast: 0, main: 0, snack: 0 };
      for (const [slot] of layout) {
        const type: MealType =
          slot === 'breakfast'
            ? 'breakfast'
            : slot === 'lunch' || slot === 'dinner' || slot === 'main'
              ? 'main'
              : 'snack';
        perType[type] += 1;
      }
      for (const type of ['breakfast', 'main', 'snack'] as const) {
        maxSlots[type] = Math.max(maxSlots[type], perType[type]);
      }
    }
    const minimum = {
      breakfast: Math.ceil((7 * maxSlots.breakfast) / MEAL_PLAN_REPEAT_LIMITS.breakfast),
      main: Math.ceil((7 * maxSlots.main) / MEAL_PLAN_REPEAT_LIMITS.main),
      snack: Math.ceil((7 * maxSlots.snack) / MEAL_PLAN_REPEAT_LIMITS.snack),
    };
    expect(minimum).toEqual({ breakfast: 3, main: 7, snack: 12 });

    const regular = APP.filter(
      (r) => r.kategorie !== 'wettkampf' && !r.tags.some((t) => t.toLowerCase() === 'wettkampf'),
    );
    for (const diet of ['vegan', 'vegetarisch', 'ohne-schwein', 'fleisch'] as const) {
      const recipes = regular.filter((r) => r.ernaehrungsformen.includes(diet));
      for (const type of ['breakfast', 'main', 'snack'] as const) {
        const count = recipes.filter((r) =>
          (ALPHA5_SECTIONS[r.abschnitt]?.mealTypes ?? ['main']).includes(type),
        ).length;
        // Puffer für Unverträglichkeiten/„mag ich nicht“: mindestens das 1,5-Fache des Engine-Minimums.
        expect({ diet, type, ok: count >= 1.5 * minimum[type] }).toEqual({ diet, type, ok: true });
      }
      // Ergänzungs-Snacks brauchen `no_cook`.
      expect(
        recipes.filter(
          (r) =>
            (ALPHA5_SECTIONS[r.abschnitt]?.mealTypes ?? []).includes('snack') &&
            r.tags.some((t) => t.toLowerCase() === 'ohne kochen'),
        ).length,
      ).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('appSelectionProblems / parseAppSelection', () => {
  const recipe = (id: string, extra: Partial<Alpha5File['rezepte'][number]> = {}) =>
    ({
      ...FILE.rezepte[0],
      id,
      name: `Rezept ${id}`,
      kategorie: 'vegan',
      ...extra,
    }) as Alpha5File['rezepte'][number];
  const file: Alpha5File = {
    ...FILE,
    rezepte: [
      recipe('a'),
      recipe('b', { meal_prep_plan: 'p' }),
      recipe('c', { meal_prep_plan: 'p' }),
      recipe('d', { name: 'Gleicher Name & Co', kategorie: 'fleisch' }),
    ],
    meal_prep_plaene: [
      { ...FILE.meal_prep_plaene[0], id: 'p', rezepte: ['b', 'c'] },
    ] as Alpha5File['meal_prep_plaene'],
  };
  const base: AppSelection = {
    format: 'rezeptbuch-app-auswahl',
    version: 1,
    entschieden: 'Test',
    quelle: 'alpha5-rezepte.json@1.1',
    regel: 'Test',
    meal_prep_plaene: ['p'],
    fotos: {
      quelle: 'Test',
      dateien: { a: 'a.jpg', b: 'b.jpg', c: 'c.jpg', d: 'fleisch-gleicher-name-und-co.jpg' },
    },
    rezepte: ['a', 'b', 'c', 'd'],
  };

  it('gültige Auswahl ohne Probleme (auch Foto nach Kapitel-Regel)', () => {
    expect(appSelectionProblems(base, file)).toEqual([]);
  });

  it('unbekannte und doppelte ID', () => {
    const problems = appSelectionProblems(
      {
        ...base,
        rezepte: [...base.rezepte, 'a', 'x'],
        fotos: { ...base.fotos, dateien: { ...base.fotos.dateien, x: 'x.jpg' } },
      },
      file,
    );
    expect(problems.some((p) => p.includes('„a“ doppelt'))).toBe(true);
    expect(problems.some((p) => p.includes('„x“ fehlt in alpha5-rezepte.json'))).toBe(true);
  });

  it('Rezept ohne Foto oder mit fremdem Foto → Problem (nur Rezepte mit Foto)', () => {
    const withoutA = Object.fromEntries(
      Object.entries(base.fotos.dateien).filter(([id]) => id !== 'a'),
    );
    expect(
      appSelectionProblems({ ...base, fotos: { ...base.fotos, dateien: withoutA } }, file).join(
        '\n',
      ),
    ).toContain('kein Foto für „a“');
    expect(
      appSelectionProblems(
        { ...base, fotos: { ...base.fotos, dateien: { ...base.fotos.dateien, a: 'b.jpg' } } },
        file,
      ).join('\n'),
    ).toContain('„b.jpg“ passt nicht zu „a“');
  });

  it('Foto zu einem nicht ausgewählten Rezept → Problem', () => {
    expect(appSelectionProblems({ ...base, rezepte: ['b', 'c', 'd'] }, file).join('\n')).toContain(
      '„a“ ist nicht ausgewählt',
    );
  });

  it('Meal-Prep-Plan unvollständig bzw. Rezept eines Plans ohne Plan → Problem', () => {
    const fotos = {
      ...base.fotos,
      dateien: { a: 'a.jpg', b: 'b.jpg', d: 'fleisch-gleicher-name-und-co.jpg' },
    };
    expect(
      appSelectionProblems({ ...base, rezepte: ['a', 'b', 'd'], fotos }, file).join('\n'),
    ).toContain('Plan „p“ braucht auch „c“');
    expect(appSelectionProblems({ ...base, meal_prep_plaene: [] }, file).join('\n')).toContain(
      'gehört zum Meal-Prep-Plan „p“',
    );
    expect(
      appSelectionProblems({ ...base, meal_prep_plaene: ['p', 'q'] }, file).join('\n'),
    ).toContain('„q“ fehlt');
  });

  it('parseAppSelection wirft Alpha5InputError (Schema und Inhalt), Meldung nennt die Auswahl-Datei', () => {
    expect(() => parseAppSelection({ ...base, extra: 1 }, file)).toThrow(Alpha5InputError);
    expect(() => parseAppSelection({ ...base, rezepte: ['a', 'x'] }, file)).toThrow(
      /rezeptbuch-app-auswahl\.json ist ungültig/,
    );
  });

  it('photoSlug wie im Rezeptbuch-Baukasten', () => {
    expect(photoSlug('Teriyaki-Tofu-Bowl mit Edamame')).toBe('teriyaki-tofu-bowl-mit-edamame');
    expect(photoSlug('Grüne Bohnen & Süßkartoffel')).toBe('gruene-bohnen-und-suesskartoffel');
    expect(photoSlug('Crème brûlée')).toBe('creme-brulee');
  });
});
