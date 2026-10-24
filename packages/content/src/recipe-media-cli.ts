/**
 * Aufruf: `pnpm recipe-media` (im Hauptordner) – übernimmt Rezeptbuch-Fotos in die App (docs/PLAN-PHASE-5.md
 * Nachtrag „Rezeptbilder“, Logik in recipe-media/build.ts).
 *
 *   pnpm recipe-media                      Auswahl aus content/rezeptbuch-app-auswahl.json und alle Rezepte aus
 *                                          content/recipes mit Rezeptbuch-Foto
 *   pnpm recipe-media --ids a,b,c          nur diese Rezepte (z. B. solange es die Auswahl-Datei noch nicht gibt)
 *   pnpm recipe-media --all                alle 306 (nur zum lokalen Ansehen – nicht so committen, App-Größe!)
 *   pnpm recipe-media --ref <git-ref>     Fotos von einem anderen Stand (Vorgabe: origin/rezeptbuch-baukasten)
 *   pnpm recipe-media --check              schreibt nichts; meldet, wenn das App-Modul nicht zu den Zuordnungen passt
 *
 * Die Fotos werden per `git show <ref>:content/rezeptbuch/fotos/<datei>.jpg` gelesen (kein Download). Bilder und
 * Zuordnungen von Rezepten außerhalb der Auswahl werden entfernt – ins App-Bündel kommt nur, was ausgewählt ist.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RECIPE_MEDIA_ASSET_DIR,
  RECIPE_MEDIA_FOLDER,
  RECIPE_MEDIA_KINDS,
  RECIPE_MEDIA_SIZES,
} from '@fitnessapp/core';
import sharp from 'sharp';

import {
  APP_SELECTION_FILE,
  type BookRecipe,
  parseAppSelection,
  PHOTO_DIR,
  PHOTO_ORDERS_FILE,
  photoFileByRecipe,
  type PhotoOrder,
  RECIPE_MEDIA_MODULE,
  recipeMediaFor,
  recipeMediaModule,
  readRecipeMediaFolder,
  WEBP_QUALITY,
} from './recipe-media/build';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const check = args.includes('--check');
const ref = option('--ref') ?? 'origin/rezeptbuch-baukasten';

async function writeModule(): Promise<boolean> {
  const media = readRecipeMediaFolder(repoRoot);
  const content = await recipeMediaModule(repoRoot, media);
  const full = join(repoRoot, RECIPE_MEDIA_MODULE);
  const current = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (current === content) return false;
  if (check) {
    console.error(`${RECIPE_MEDIA_MODULE} veraltet – „pnpm recipe-media“ ausführen.`);
    process.exitCode = 1;
    return true;
  }
  writeFileSync(full, content);
  return true;
}

if (check) {
  await writeModule();
  if (!process.exitCode) {
    process.stdout.write(`Rezeptbilder aktuell (${readRecipeMediaFolder(repoRoot).length}).\n`);
  }
} else {
  const git = (...gitArgs: string[]) =>
    execFileSync('git', gitArgs, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  const book = JSON.parse(
    readFileSync(join(repoRoot, 'packages/content/seed/alpha5-rezepte.json'), 'utf8'),
  ) as { rezepte: BookRecipe[] };
  const orders = JSON.parse(
    git('show', `${ref}:${PHOTO_ORDERS_FILE}`).toString('utf8'),
  ) as PhotoOrder[];
  const files = new Set(
    git('ls-tree', '--name-only', `${ref}:${PHOTO_DIR}`)
      .toString('utf8')
      .split('\n')
      .filter((name) => name.endsWith('.jpg'))
      .map((name) => name.slice(0, -4)),
  );
  const { byRecipe, problems } = photoFileByRecipe(book.rezepte, orders, files);
  if (problems.length > 0) throw new Error(`Foto-Zuordnung:\n${problems.join('\n')}`);

  const idsArg = option('--ids');
  const selectionPath = join(repoRoot, APP_SELECTION_FILE);
  const selection = args.includes('--all')
    ? book.rezepte.map((r) => r.id)
    : idsArg !== undefined
      ? idsArg.split(',').filter((id) => id !== '')
      : existsSync(selectionPath)
        ? parseAppSelection(JSON.parse(readFileSync(selectionPath, 'utf8')))
        : null;
  if (selection === null) {
    throw new Error(`Keine Auswahl: ${APP_SELECTION_FILE} fehlt – oder --ids a,b,c angeben.`);
  }
  const unknown = selection.filter((id) => !byRecipe.has(id));
  if (unknown.length > 0) {
    throw new Error(`Kein Rezeptbuch-Foto für: ${unknown.join(', ')}`);
  }
  // Dazu alle Rezepte, die schon in content/recipes stehen und ein Rezeptbuch-Foto haben (laufen heute in der App –
  // sonst fehlen dort Bilder, bis der Import die Auswahl übernimmt). Nicht bei --ids/--all.
  const inApp =
    idsArg === undefined && !args.includes('--all')
      ? readdirSync(join(repoRoot, 'content/recipes'))
          .filter((name) => name.endsWith('.json'))
          .map((name) => name.slice(0, -5))
          .filter((id) => byRecipe.has(id))
      : [];
  const wanted = new Set([...selection, ...inApp]);
  // Gegenprobe: Foto-Datei laut Auswahl-Datei (fotos.dateien) = eigene Zuordnung.
  if (idsArg === undefined && existsSync(selectionPath)) {
    const listed = (
      JSON.parse(readFileSync(selectionPath, 'utf8')) as {
        fotos?: { dateien?: Record<string, string> };
      }
    ).fotos?.dateien;
    for (const [id, file] of Object.entries(listed ?? {})) {
      if (`${byRecipe.get(id)}.jpg` !== file) {
        throw new Error(
          `Auswahl nennt für ${id} das Foto ${file}, Zuordnung ergibt ${byRecipe.get(id)}.jpg.`,
        );
      }
    }
  }
  const assetDir = join(repoRoot, RECIPE_MEDIA_ASSET_DIR);
  const mediaDir = join(repoRoot, 'content', RECIPE_MEDIA_FOLDER);
  mkdirSync(assetDir, { recursive: true });
  mkdirSync(mediaDir, { recursive: true });

  let written = 0;
  for (const id of [...wanted].sort()) {
    const recipe = book.rezepte.find((r) => r.id === id)!;
    const photoFile = byRecipe.get(id)!;
    const media = recipeMediaFor(recipe, photoFile);
    const jsonPath = join(mediaDir, `${id}.json`);
    const json = `${JSON.stringify(media, null, 2)}\n`;
    const complete =
      existsSync(jsonPath) &&
      readFileSync(jsonPath, 'utf8') === json &&
      media.images.every((image) => existsSync(join(assetDir, image.file)));
    if (complete) continue;
    const jpg = git('show', `${ref}:${PHOTO_DIR}/${photoFile}.jpg`);
    for (const kind of RECIPE_MEDIA_KINDS) {
      const { width, height } = RECIPE_MEDIA_SIZES[kind];
      const file = media.images.find((image) => image.kind === kind)!.file;
      // Vorschaubild: quadratisch aus der Bildmitte; Banner: ganzes Bild (21:9) verkleinert.
      await sharp(jpg)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .webp({ quality: WEBP_QUALITY[kind], effort: 6 })
        .toFile(join(assetDir, file));
    }
    writeFileSync(jsonPath, json);
    written += 1;
  }
  // Nicht (mehr) ausgewählte Rezepte entfernen – App-Größe.
  let removed = 0;
  for (const name of readdirSync(mediaDir)) {
    if (name.startsWith('.') || wanted.has(name.replace(/\.json$/, ''))) continue;
    rmSync(join(mediaDir, name));
    removed += 1;
  }
  for (const name of readdirSync(assetDir)) {
    if (name.startsWith('.')) continue;
    const id = name.replace(/-(thumb|banner)\.webp$/, '');
    if (!wanted.has(id)) rmSync(join(assetDir, name));
  }
  const moduleChanged = await writeModule();
  process.stdout.write(
    `Rezeptbilder: ${wanted.size} ausgewählt, ${written} neu erzeugt, ${removed} entfernt` +
      `${moduleChanged ? ', App-Modul aktualisiert' : ''}.\n`,
  );
}
