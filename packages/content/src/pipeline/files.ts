/**
 * Dateien lesen/schreiben: Inhaltsstand laden und JSON so formatieren, wie Prettier es im Repository
 * erwartet (damit `pnpm format:check` in ci grün bleibt).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { isCatalogReviewed, validateContent } from '@fitnessapp/core';
import * as prettier from 'prettier';

import { loadNutritionCatalog } from '../foods/catalog-loader';
import { CONTENT_FOLDERS, loadContentFiles, loadNutritionContentFiles } from '../validate';
import type { LibraryContext, PipelineContentKind } from './kinds';

/** Ordner unter `content/` je Pipeline-Art (Training + Austausch-Tabelle, N9, + Packungsgrößen, N11). */
export const PIPELINE_FOLDERS: Record<PipelineContentKind, string> = {
  ...CONTENT_FOLDERS,
  ingredient_substitution: 'substitutions',
  package_size: 'package-sizes',
};

/** Lädt den Inhaltsstand unter `<repoRoot>/content` als Kontext für die Pipeline. */
export function loadLibrary(repoRoot: string): LibraryContext {
  const contentDir = join(repoRoot, 'content');
  const { files } = loadContentFiles(contentDir);
  const result = validateContent(files);
  // Lebensmittel-Katalog, Austausch-Tabelle (N9) und Packungsgrößen (N11): Katalog-IDs für Structured Outputs.
  const catalog = loadNutritionCatalog(contentDir);
  const substitutionFiles = loadNutritionContentFiles(contentDir).files.filter(
    (file) => file.kind === 'ingredient_substitution' || file.kind === 'package_size',
  );
  const nutrition = validateContent(
    [...catalog.files, ...substitutionFiles],
    catalog.catalog === undefined ? {} : { nutritionCatalog: catalog.catalog },
  );
  const takenIds: Record<PipelineContentKind, Set<string>> = {
    exercise: new Set(),
    plan_template: new Set(),
    ingredient_substitution: new Set(),
    package_size: new Set(),
  };
  for (const file of [...files, ...substitutionFiles]) {
    takenIds[file.kind as PipelineContentKind].add(file.fileName.replace(/\.json$/, ''));
  }
  return {
    exercises: result.exercises,
    templates: result.templates,
    foods: nutrition.foods.filter((food) => food.status !== 'archived' && isCatalogReviewed(food)),
    substitutions: nutrition.substitutions,
    packageSizes: nutrition.packageSizes,
    takenIds,
  };
}

/** Pfad einer Inhaltsdatei relativ zum Repository, z. B. `content/exercises/kniebeuge.json`. */
export function contentPath(kind: PipelineContentKind, id: string): string {
  return `content/${PIPELINE_FOLDERS[kind]}/${id}.json`;
}

/** JSON im Prettier-Format des Repositorys. */
export async function formatJson(repoRoot: string, repoPath: string, data: unknown) {
  const filepath = join(repoRoot, repoPath);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(`${JSON.stringify(data, null, 2)}\n`, { ...options, filepath });
}

/** Schreibt eine JSON-Datei (Prettier-Format) und legt Ordner bei Bedarf an. */
export async function writeJsonFile(repoRoot: string, repoPath: string, data: unknown) {
  const filepath = join(repoRoot, repoPath);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, await formatJson(repoRoot, repoPath, data));
}

/** Prettier-Prüfung (wie `prettier --check`) für die angegebenen Dateien; liefert die nicht formatierten. */
export async function prettierUnformatted(
  repoRoot: string,
  repoPaths: readonly string[],
  readText: (repoPath: string) => string,
): Promise<string[]> {
  const unformatted: string[] = [];
  for (const repoPath of repoPaths) {
    const filepath = join(repoRoot, repoPath);
    const options = (await prettier.resolveConfig(filepath)) ?? {};
    if (!(await prettier.check(readText(repoPath), { ...options, filepath }))) {
      unformatted.push(repoPath);
    }
  }
  return unformatted;
}
