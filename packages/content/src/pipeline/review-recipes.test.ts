import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { importAssumptionsFingerprint, RECIPE_CATEGORY_IDS, type Recipe } from '@fitnessapp/core';
import { afterEach, describe, expect, it } from 'vitest';

import { runContentReview } from './review-ids';
import { runRecipeCategoryRelease } from './review-recipes';
import { createTempRepo, fakeTools, REAL_REPO_ROOT, type TempRepo } from './test-helpers';

// Sammelfreigabe Rezepte pro Kategorie (docs/PLAN-PHASE-5.md 19.5, N2d) gegen ein Test-Repository.
// ACHTUNG: TESTWERTE im Quellauszug, keine BLS-Daten.

const HEADER = [
  'BLS-Schlüssel',
  'Bezeichnung',
  'ENERCC [kcal/100g]',
  'PROT625 [g/100g]',
  'CHO [g/100g]',
  'SUGAR [g/100g]',
  'FAT [g/100g]',
  'FASAT [g/100g]',
  'FIBT [g/100g]',
  'NACL [g/100g]',
].join(',');
const EXTRACT = `${HEADER}\nT0001,Haferflocken,370,13.5,58.7,0.7,7,1.2,10,0.01\nT0002,Ei,137,12.5,0.7,0.7,9.3,2.7,0,0.35\n`;

const META = {
  origin: 'claude_session',
  model: 'test',
  batch_id: null,
  created_on: '2026-10-11',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

function food(reviewed: boolean) {
  return {
    id: 'haferflocken',
    version: 1,
    status: 'published',
    name_de: 'Haferflocken',
    aliases_de: [],
    shopping_category: 'cereal_breakfast',
    pantry: true,
    nutrients_per_100g: {
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    },
    units: {},
    groups: ['gluten'],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    source: {
      db: 'bls',
      version: '4.0',
      ref: 'T0001',
      name: 'Haferflocken',
      category: 'cereal_products',
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-11',
    },
    meta: {
      ...META,
      reviewed_by: 'KT',
      reviewed_at: '2026-10-12',
      catalog_reviewed_by: reviewed ? 'KT' : null,
      catalog_reviewed_at: reviewed ? '2026-10-12' : null,
    },
  };
}

function egg() {
  const base = food(true);
  return {
    ...base,
    id: 'huehnerei',
    name_de: 'Ei',
    shopping_category: 'chilled_dairy_eggs',
    pantry: false,
    nutrients_per_100g: {
      kcal: 137,
      protein_g: 12.5,
      carbs_g: 0.7,
      sugar_g: 0.7,
      fat_g: 9.3,
      sat_fat_g: 2.7,
      fiber_g: 0,
      salt_g: 0.35,
    },
    units: { piece_g: 60 },
    groups: ['eggs'],
    animal: ['egg'],
    max_fridge_days: 2,
    freezable: false,
    source: { ...base.source, ref: 'T0002', name: 'Ei', category: 'eggs' },
  };
}

/** Rührei mit Import-Annahme „Ei durchgegart“ (unbestätigt → Schwangerschafts-Hinweis ja). */
function scrambledEggs(categories: string[] = []) {
  return {
    ...recipe('ruehrei', 'huehnerei', categories),
    title_de: 'Rührei',
    description_de: 'Zwei Eier in der Pfanne gestockt.',
    ingredients: [
      {
        food_id: 'huehnerei',
        amount: 2,
        unit: 'piece',
        optional: false,
        scales: true,
        heated: true,
      },
    ],
    steps_de: ['Eier verquirlen und in der Pfanne unter Rühren stocken lassen.'],
    equipment_de: ['Pfanne'],
    meal_prep: { suitable: false, fridge_days: 0, freezable: false },
    declared_per_serving: { kcal: 164, protein_g: 15, carbs_g: 0.8, fat_g: 11.2 },
    declared_diet: 'vegetarian',
    declared_allergens: ['eggs'],
    declared_pregnancy_caution: true,
    meta: {
      ...META,
      import_assumptions: [
        {
          ingredient_index: 0,
          food_id: 'huehnerei',
          field: 'heated',
          value: true,
          reason_de: 'Schritt 1 „stocken lassen“ mit Hitze.',
        },
      ],
      import_assumptions_confirmed_by: null,
    },
  };
}

function recipe(id: string, foodId = 'haferflocken', categories = ['meal-prep']) {
  return {
    id,
    version: 1,
    status: 'draft',
    title_de: 'Haferbrei',
    description_de: 'Haferflocken mit Wasser, schnell gemacht.',
    meal_types: ['breakfast'],
    training_tags: [],
    servings: 1,
    ingredients: [{ food_id: foodId, amount: 60, unit: 'g', optional: false, scales: true }],
    steps_de: ['Haferflocken mit Wasser aufkochen.'],
    categories,
    prep_minutes: 2,
    cook_minutes: 3,
    no_cook: false,
    meal_prep: { suitable: true, fridge_days: 3, freezable: true },
    equipment_de: ['Topf'],
    declared_per_serving: { kcal: 222, protein_g: 8.1, carbs_g: 35.2, fat_g: 4.2 },
    declared_diet: 'vegan',
    declared_allergens: ['gluten'],
    contains_pork: false,
    declared_pregnancy_caution: false,
    meta: META,
  };
}

function write(repo: TempRepo, path: string, data: unknown) {
  const full = join(repo.root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
}

function setup(options: { reviewed?: boolean; eggs?: string[] } = {}): TempRepo {
  const repo = createTempRepo({ withContent: false });
  write(repo, 'content/sources/bls/4.0/extract.csv', EXTRACT);
  write(repo, 'content/foods/allergen-expectations.json', {
    haferflocken: ['gluten'],
    huehnerei: ['eggs'],
  });
  write(repo, 'content/foods/haferflocken.json', food(options.reviewed ?? true));
  write(repo, 'content/foods/huehnerei.json', egg());
  if (options.eggs !== undefined) {
    write(repo, 'content/recipes/ruehrei.json', scrambledEggs(options.eggs));
  }
  write(repo, 'content/recipes/haferbrei.json', recipe('haferbrei'));
  write(
    repo,
    'content/recipes/haferbrei-mit-luecke.json',
    recipe('haferbrei-mit-luecke', 'gibt-es-nicht'),
  );
  write(
    repo,
    'content/recipes/haferbrei-schnell.json',
    recipe('haferbrei-schnell', 'haferflocken', ['schnell']),
  );
  repo.git(['add', '-A']);
  repo.git(['commit', '--quiet', '-m', 'Ernährung']);
  repo.git(['push', '--quiet', 'origin', 'main']);
  return repo;
}

const INPUT = {
  category: 'meal-prep',
  status: 'published',
  reviewer: 'KT',
  expertReviewed: 'false',
  confirmAssumptions: 'false',
};

let repo: TempRepo | undefined;
afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

describe('content-review Art „recipe“ (Sammelfreigabe, N2d)', () => {
  it('gibt freigebbare Rezepte der Kategorie frei, übersprungene stehen mit Grund im Pull Request', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const result = await runRecipeCategoryRelease(INPUT, {
      repoRoot: repo.root,
      tools,
      now: () => new Date('2026-10-13T10:00:00Z'),
      randomShort: () => 'abc123',
    });
    expect(result.exitCode, result.markdown).toBe(0);
    expect(result.branch).toBe('content/review-2026-10-13-abc123');
    const released = JSON.parse(
      repo.showRemote(result.branch!, 'content/recipes/haferbrei.json'),
    ) as { status: string; version: number; meta: { reviewed_by: string; reviewed_at: string } };
    expect(released.status).toBe('published');
    expect(released.version).toBe(1);
    expect(released.meta).toMatchObject({ reviewed_by: 'KT', reviewed_at: '2026-10-13' });
    // Nicht in der Kategorie bzw. übersprungen → unverändert.
    expect(
      JSON.parse(repo.showRemote(result.branch!, 'content/recipes/haferbrei-mit-luecke.json')),
    ).toMatchObject({ status: 'draft' });
    expect(
      JSON.parse(repo.showRemote(result.branch!, 'content/recipes/haferbrei-schnell.json')),
    ).toMatchObject({ status: 'draft' });
    const body = tools.prBodies[0] ?? '';
    expect(body).toContain('Sammelfreigabe Rezepte: Kategorie „Meal-Prep“');
    expect(body).toContain('`haferbrei-mit-luecke`');
    expect(body).toContain('Lebensmittel fehlt im Katalog: gibt-es-nicht');
    expect(body).toContain('**Merge**');
    expect(body).toContain('Für den Livegang (ab N7) nur mit fachlicher Prüfung');
    expect(body).toContain('So testest du es am Handy');
    expect(tools.ghCalls.some((call) => call[0] === 'pr' && call[1] === 'merge')).toBe(false);
  });

  it('nichts freigebbar (Lebensmittel nicht katalog-geprüft) → kein Pull Request, Gründe in der Zusammenfassung', async () => {
    repo = setup({ reviewed: false });
    const tools = fakeTools(repo.root);
    const result = await runRecipeCategoryRelease(INPUT, {
      repoRoot: repo.root,
      tools,
      now: () => new Date('2026-10-13T10:00:00Z'),
    });
    expect(result.exitCode).toBe(0);
    expect(result.prUrl).toBeUndefined();
    expect(tools.prBodies).toEqual([]);
    expect(result.markdown).toContain('nichts freigegeben');
    expect(result.markdown).toContain('Lebensmittel nicht katalog-geprüft: haferflocken');
  });

  it('falsche Eingaben → Abbruch ohne Änderung', async () => {
    repo = setup();
    const deps = { repoRoot: repo.root, tools: fakeTools(repo.root), now: () => new Date() };
    expect((await runRecipeCategoryRelease({ ...INPUT, category: '-' }, deps)).markdown).toContain(
      'Kategorie wählen',
    );
    expect(
      (await runRecipeCategoryRelease({ ...INPUT, status: 'archived' }, deps)).markdown,
    ).toContain('nur mit Neuer Status = published');
    expect((await runRecipeCategoryRelease({ ...INPUT, reviewer: ' ' }, deps)).exitCode).toBe(1);
    expect(
      (await runRecipeCategoryRelease({ ...INPUT, confirmAssumptions: 'ja' }, deps)).exitCode,
    ).toBe(1);
  });

  it('S1: mit Häkchen „Import-Annahmen geprüft“ – Datei mit Bestätigung + Fingerabdruck, PR-Tabelle „ja → nein“, Annahme aufgelistet', async () => {
    repo = setup({ eggs: ['schnell'] });
    const tools = fakeTools(repo.root);
    const result = await runRecipeCategoryRelease(
      { ...INPUT, category: 'schnell', confirmAssumptions: 'true' },
      { repoRoot: repo.root, tools, now: () => new Date('2026-10-13T10:00:00Z') },
    );
    expect(result.exitCode, result.markdown).toBe(0);
    const released = JSON.parse(
      repo.showRemote(result.branch!, 'content/recipes/ruehrei.json'),
    ) as Recipe;
    expect(released.status).toBe('published');
    expect(released.declared_pregnancy_caution).toBe(false);
    expect(released.meta.import_assumptions_confirmed_by).toBe('KT');
    expect(released.meta.import_assumptions_fingerprint).toBe(
      importAssumptionsFingerprint(released),
    );
    const body = tools.prBodies[0] ?? '';
    expect(body).toContain('| `ruehrei` Rührei | Rezept | 1 bestätigt | ja → **nein** |');
    expect(body).toContain('Bestätigte Import-Annahmen');
    // S6: gelbe Hinweise je freigegebenem Inhalt stehen direkt im PR-Text.
    expect(body).toMatch(/Gelbe Hinweise zu den freigegebenen Inhalten/);
    expect(body).toContain(
      '`ruehrei`, Zutat 1 `huehnerei` durchgegart: Schritt 1 „stocken lassen“ mit Hitze.',
    );
  });

  it('ohne Häkchen: Rührei übersprungen (Annahme nicht bestätigt)', async () => {
    repo = setup({ eggs: ['schnell'] });
    const tools = fakeTools(repo.root);
    const result = await runRecipeCategoryRelease(
      { ...INPUT, category: 'schnell' },
      { repoRoot: repo.root, tools, now: () => new Date('2026-10-13T10:00:00Z') },
    );
    expect(result.exitCode, result.markdown).toBe(0);
    expect(tools.prBodies[0]).toMatch(
      /`ruehrei` Rührei \| Rezept \| 1 Import-Annahme „durchgegart“ nicht \(mehr\) bestätigt/,
    );
  });

  it('Kategorien im Workflow content-review = RECIPE_CATEGORY_IDS (eine Wahrheit im Core)', () => {
    const yml = readFileSync(join(REAL_REPO_ROOT, '.github/workflows/content-review.yml'), 'utf8');
    const block = yml.split('kategorie:')[1]?.split('default:')[0] ?? '';
    const options = [...block.matchAll(/^\s+- '?([a-z-]+)'?$/gm)].map((m) => m[1]);
    expect(options).toEqual(['-', ...RECIPE_CATEGORY_IDS]);
    expect(yml).toContain('REVIEW_KIND: ${{ inputs.art }}');
    expect(yml).toContain('REVIEW_CONFIRM_ASSUMPTIONS: ${{ inputs.annahmen_geprueft }}');
  });
});

const IDS_INPUT = {
  kind: 'ids',
  ids: '',
  status: 'published',
  reviewer: 'KT',
  category: '-',
  expertReviewed: 'false',
  confirmAssumptions: 'false',
};

describe('content-review Art „ids“ mit Ernährungs-Inhalten (Gründer-Entscheidungen 14.10.2026)', () => {
  it('Rezept ohne Kategorie per ID: gleiche Regeln und Häkchen, Pull Request', async () => {
    repo = setup({ eggs: [] });
    const tools = fakeTools(repo.root);
    const result = await runContentReview(
      { ...IDS_INPUT, ids: 'ruehrei', confirmAssumptions: 'true', expertReviewed: 'true' },
      {
        repoRoot: repo.root,
        tools,
        now: () => new Date('2026-10-13T10:00:00Z'),
        randomShort: () => 'def456',
      },
    );
    expect(result.exitCode, result.markdown).toBe(0);
    const released = JSON.parse(
      repo.showRemote(result.branch!, 'content/recipes/ruehrei.json'),
    ) as Recipe;
    expect(released.status).toBe('published');
    expect(released.meta.expert_reviewed).toBe(true);
    expect(released.meta.import_assumptions_fingerprint).toBe(
      importAssumptionsFingerprint(released),
    );
    const body = tools.prBodies[0] ?? '';
    expect(body).toContain('## Freigabe Ernährung per ID');
    expect(body).toContain('ja → **nein**');
    expect(tools.ghCalls.some((call) => call[0] === 'pr' && call[1] === 'merge')).toBe(false);
  });

  it('Rezept per ID ohne Häkchen „Import-Annahmen geprüft“ → übersprungen, kein Pull Request', async () => {
    repo = setup({ eggs: [] });
    const tools = fakeTools(repo.root);
    const result = await runContentReview(
      { ...IDS_INPUT, ids: 'ruehrei' },
      { repoRoot: repo.root, tools, now: () => new Date('2026-10-13T10:00:00Z') },
    );
    expect(result.exitCode).toBe(0);
    expect(tools.prBodies).toEqual([]);
    expect(result.markdown).toContain('nicht (mehr) bestätigt');
  });

  it('Lebensmittel per ID → Abbruch ohne Änderung (eigene Katalog-Prüfung)', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const result = await runContentReview(
      { ...IDS_INPUT, ids: 'haferbrei, haferflocken' },
      { repoRoot: repo.root, tools, now: () => new Date() },
    );
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain(
      '`haferflocken`: Lebensmittel werden nicht über Art „ids“ freigegeben – dafür gibt es Art „katalog“',
    );
    expect(tools.prBodies).toEqual([]);
  });

  it('nur Freigabe: Zielstatus archived bei Ernährungs-IDs → Abbruch', async () => {
    repo = setup();
    const result = await runContentReview(
      { ...IDS_INPUT, ids: 'haferbrei', status: 'archived' },
      { repoRoot: repo.root, tools: fakeTools(repo.root), now: () => new Date() },
    );
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain('nur mit Neuer Status = published');
  });

  it('gemischte IDs (Übung + Rezept) → Abbruch; Eingaben ohne Wirkung stehen als Hinweis (K4)', async () => {
    repo = setup();
    write(repo, 'content/exercises/kniebeuge.json', { id: 'kniebeuge' });
    const deps = { repoRoot: repo.root, tools: fakeTools(repo.root), now: () => new Date() };
    const mixed = await runContentReview({ ...IDS_INPUT, ids: 'kniebeuge haferbrei' }, deps);
    expect(mixed.exitCode).toBe(1);
    expect(mixed.markdown).toContain('bitte getrennt starten');
    expect(mixed.markdown).toContain('- Übungen/Vorlagen: `kniebeuge`');
    // Gleiche ID als Übung und Rezept → ebenfalls abgelehnt.
    write(repo, 'content/exercises/haferbrei.json', { id: 'haferbrei' });
    expect((await runContentReview({ ...IDS_INPUT, ids: 'haferbrei' }, deps)).exitCode).toBe(1);

    const unknown = await runContentReview({ ...IDS_INPUT, ids: 'haferbrei gibt-es-nicht' }, deps);
    expect(unknown.exitCode).toBe(1);
    expect(unknown.markdown).toContain('Auf `main` nicht gefunden: `gibt-es-nicht`');

    const withNotes = await runContentReview(
      { ...IDS_INPUT, ids: 'kniebeuge', category: 'schnell', expertReviewed: 'true' },
      deps,
    );
    expect(withNotes.markdown).toContain('Kategorie „schnell“ hat bei Art „ids“ keine Wirkung.');
    expect(withNotes.markdown).toContain('„fachlich geprüft“ wirkt nur bei Ernährungs-Inhalten');

    const recipeKind = await runContentReview(
      { ...IDS_INPUT, kind: 'recipe', category: '-', ids: 'haferbrei' },
      deps,
    );
    expect(recipeKind.markdown).toContain('IDs haben bei Art „recipe“');
    expect((await runContentReview({ ...IDS_INPUT, kind: 'quatsch' }, deps)).exitCode).toBe(1);
  });
});
