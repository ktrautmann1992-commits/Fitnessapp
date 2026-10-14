// Bündelt die Inhaltsdateien des Repositorys (content/exercises, content/plan-templates; Ernährung: content/foods,
// recipes, meal-prep-plans, guides, substitutions, package-sizes + Katalog-Begleitdaten) beim Bauen in ein
// TypeScript-Modul. Gemeinsam genutzt von
// - apps/web (Redaktionsbereich /admin): jede Vercel-Vorschau zeigt genau die Inhalte ihres Branches,
// - apps/mobile (Testmodus ohne Supabase, docs/PLAN-PHASE-3.md 10.1): Plan aus den gebündelten Entwürfen; das Modul
//   wird erst bei Bedarf nachgeladen (import()), der Supabase-Modus lädt Inhalte aus der Datenbank.
// Ohne Datenbank und ohne Dateizugriff zur Laufzeit. Geprüft wird beim Nutzen mit validateContent aus packages/core
// (dieselben Regeln wie content:validate).
// Aufruf: node scripts/bundle-content.mjs <Ausgabedatei relativ zum aktuellen Ordner>, automatisch vor build,
// typecheck, test und dev (package.json der Apps). Ausgabe ist nicht eingecheckt.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '../content');
const target = process.argv[2];
if (!target) {
  console.error('Aufruf: node scripts/bundle-content.mjs <Ausgabedatei> [--empty-if-supabase]');
  process.exit(1);
}
const outFile = resolve(process.cwd(), target);
// App (apps/mobile): Mit Supabase-Werten (EXPO_PUBLIC_SUPABASE_URL gesetzt) lädt die App Inhalte nur aus der
// Datenbank (nur freigegebene) – dann wird nur ein LEERES Bündel erzeugt, damit keine Entwürfe im Build landen.
// Fällt die App wegen fehlerhafter Werte in den Testmodus zurück, zeigt sie „kein freigegebener Plan“.
const emptyBundle =
  process.argv.includes('--empty-if-supabase') &&
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() !== '';

/** Ordner je Inhaltsart – wie CONTENT_FOLDERS in packages/content/src/validate.ts. */
const FOLDERS = { exercise: 'exercises', plan_template: 'plan-templates' };
/**
 * Ernährung (docs/PLAN-PHASE-5.md 13 N2c, 19.2) – wie NUTRITION_CONTENT_FOLDERS in packages/content/src/validate.ts
 * plus Lebensmittel. Die Begleitdaten des Katalogs (Quellauszüge, Erwartungs- und Ausnahmeliste, Namensnennung)
 * kommen als Texte mit; übersetzt werden sie in der App mit `@fitnessapp/content/catalog` (eine Stelle, R17).
 */
const NUTRITION_FOLDERS = {
  food: 'foods',
  recipe: 'recipes',
  meal_prep_plan: 'meal-prep-plans',
  guide: 'guides',
  ingredient_substitution: 'substitutions',
  package_size: 'package-sizes',
};
/** Begleitdatei in content/foods/, kein Lebensmittel. */
const EXPECTATIONS_FILE = 'allergen-expectations.json';

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

const files = [];
const nutritionFiles = [];
const strayFiles = [];
const folders = [
  ...Object.entries(FOLDERS).map(([kind, folder]) => [kind, folder, files]),
  ...Object.entries(NUTRITION_FOLDERS).map(([kind, folder]) => [kind, folder, nutritionFiles]),
];
for (const [kind, folder, target] of emptyBundle ? [] : folders) {
  const dir = join(contentDir, folder);
  if (!existsSync(dir)) {
    continue;
  }
  for (const fileName of readdirSync(dir).sort()) {
    if (fileName.startsWith('.') || (kind === 'food' && fileName === EXPECTATIONS_FILE)) {
      continue;
    }
    if (!fileName.endsWith('.json')) {
      strayFiles.push(`${folder}/${fileName}`);
      continue;
    }
    const text = readFileSync(join(dir, fileName), 'utf8');
    try {
      target.push({ kind, fileName, data: JSON.parse(text) });
    } catch (error) {
      target.push({
        kind,
        fileName,
        jsonError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Begleitdaten des Lebensmittel-Katalogs (nur, wenn es Lebensmittel gibt).
const nutritionCatalog = { extracts: [], expectations: null, exceptions: null, attributions: [] };
const sourcesDir = join(contentDir, 'sources');
if (!emptyBundle && existsSync(sourcesDir)) {
  // Nur Ordner lesen – eine Datei (z. B. README) darf den Build nicht abbrechen (Wächter N2c, K3).
  const subdirs = (dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  for (const db of subdirs(sourcesDir)) {
    for (const version of subdirs(join(sourcesDir, db))) {
      const dir = join(sourcesDir, db, version);
      nutritionCatalog.extracts.push({ db, version, csv: readText(join(dir, 'extract.csv')) });
      const attribution = readText(join(dir, 'ATTRIBUTION.md'));
      if (attribution !== null) {
        nutritionCatalog.attributions.push({ db, version, text: attribution });
      }
    }
  }
}
if (!emptyBundle) {
  nutritionCatalog.expectations = readText(join(contentDir, 'foods', EXPECTATIONS_FILE));
  nutritionCatalog.exceptions = readText(
    join(contentDir, 'food-mapping', 'allergen-exceptions.json'),
  );
}

const payload = JSON.stringify({ files, strayFiles, nutritionFiles, nutritionCatalog });
const source = `// Automatisch erzeugt von scripts/bundle-content.mjs – nicht von Hand bearbeiten.
import type { ContentFile, NutritionContentFile } from '@fitnessapp/core';

/** Begleitdaten des Lebensmittel-Katalogs als Texte (R17/R18, Namensnennung der Quelle). */
export interface NutritionCatalogBundle {
  readonly extracts: readonly { readonly db: string; readonly version: string; readonly csv: string | null }[];
  readonly expectations: string | null;
  readonly exceptions: string | null;
  readonly attributions: readonly { readonly db: string; readonly version: string; readonly text: string }[];
}

export interface ContentBundle {
  readonly files: readonly ContentFile[];
  readonly strayFiles: readonly string[];
  /** Lebensmittel, Rezepte, Meal-Prep-Pläne, Ratgeber (Etappe N2c). */
  readonly nutritionFiles: readonly NutritionContentFile[];
  readonly nutritionCatalog: NutritionCatalogBundle;
}

export const CONTENT_BUNDLE: ContentBundle = JSON.parse(${JSON.stringify(payload)}) as ContentBundle;
`;

mkdirSync(dirname(outFile), { recursive: true });
const previous = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
if (previous !== source) {
  writeFileSync(outFile, source);
}
console.log(
  emptyBundle
    ? 'Supabase-Werte gesetzt: leeres Inhalts-Bündel (Inhalte kommen aus der Datenbank).'
    : `Inhalte gebündelt: ${files.filter((f) => f.kind === 'exercise').length} Übungen, ${
        files.filter((f) => f.kind === 'plan_template').length
      } Plan-Vorlagen, ${nutritionFiles.length} Ernährungs-Inhalte${strayFiles.length > 0 ? `, ${strayFiles.length} fremde Dateien` : ''}.`,
);
