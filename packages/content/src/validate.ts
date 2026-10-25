/**
 * Prüfskript `content:validate`: liest alle Inhalte unter `content/` und prüft sie mit den Regeln aus
 * packages/core (Schema Ü1, Plausibilitäts-Checks Ü2–Ü6 und V1–V11, Datei- und Versionsregeln; Ernährung R1–R24
 * für Lebensmittel, Rezepte, Meal-Prep-Pläne, Ratgeber, die Austausch-Tabelle und die Packungsgrößen; Supplemente
 * SK1–SK7 seit Phase 6 SU2; Workouts W1–W7, docs/PLAN-WORKOUTS.md).
 *
 * - Ausgabe auf Deutsch, rot = Fehler, gelb = Hinweis (docs/PLAN-PHASE-2.md Abschnitt 7).
 * - Exit-Code 1 bei Schema-/Dateifehlern jeder Art und bei roten Fehlern an FREIGEGEBENEN Inhalten.
 *   Entwürfe dürfen andere rote Fehler haben (damit man sie korrigieren kann) – sie werden nur gemeldet.
 * - Mit `--base <git-ref>` (z. B. origin/main) wird zusätzlich geprüft, ob geänderte freigegebene Inhalte
 *   eine höhere Version haben.
 * - In GitHub Actions steht der Bericht zusätzlich in der Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import {
  checkExerciseMediaFiles,
  checkRecipeMediaFiles,
  CONTENT_SEED_SETTINGS_FILE,
  type ContentFile,
  type ContentFileKind,
  type ContentIssue,
  type ContentSeedSettings,
  type ContentStatus,
  type ContentValidationResult,
  DIET_TYPES,
  EXERCISE_MEDIA_ASSET_DIR,
  EXERCISE_MEDIA_FOLDER,
  type ExerciseMediaFile,
  isBlockingIssue,
  MEAL_TYPES,
  type NutritionContentFile,
  type NutritionContentFileKind,
  parseContentSeedSettings,
  RECIPE_COVERAGE,
  RECIPE_MEDIA_ASSET_DIR,
  RECIPE_MEDIA_FOLDER,
  type RecipeMediaFile,
  recipeCoverageReport,
  type SupplementContentFile,
  type SupplementContentFileKind,
  validateContent,
  type WorkoutContentFile,
  type WorkoutContentFileKind,
} from '@fitnessapp/core';

import { loadNutritionCatalog } from './foods/catalog-loader';

/** Ordner unter `content/` je Inhaltsart (Übungen, Vorlagen – auch von der Pipeline genutzt). */
export const CONTENT_FOLDERS: Record<ContentFileKind, string> = {
  exercise: 'exercises',
  plan_template: 'plan-templates',
};

/**
 * Ordner der Ernährungs-Inhalte (docs/PLAN-PHASE-5.md 13 N2c, 19.2). Lebensmittel (`foods`) lädt
 * `foods/catalog-loader.ts` mit Quellauszug, Erwartungs- und Ausnahmeliste; Rezepte, Meal-Prep-Pläne und
 * Ratgeber kommen von hier. Gespiegelt in `FOLDERS` von `scripts/bundle-content.mjs`.
 */
export const NUTRITION_CONTENT_FOLDERS: Record<
  Exclude<NutritionContentFileKind, 'food'>,
  string
> = {
  recipe: 'recipes',
  meal_prep_plan: 'meal-prep-plans',
  guide: 'guides',
  ingredient_substitution: 'substitutions',
  package_size: 'package-sizes',
};

/**
 * Ordner der Supplement-Inhalte (docs/PLAN-PHASE-6.md Abschnitt 6, Etappe SU2). Eingespielt seit SU3 (seed_supplements),
 * gebündelt für den Testmodus der App seit SU4 (scripts/bundle-content.mjs).
 */
export const SUPPLEMENT_CONTENT_FOLDERS: Record<SupplementContentFileKind, string> = {
  supplement: 'supplements',
};

/**
 * Ordner der Workouts (docs/PLAN-WORKOUTS.md, Regeln W1–W7). Gespiegelt in `WORKOUT_FOLDER` von
 * `scripts/bundle-content.mjs` (Testmodus der App).
 */
export const WORKOUT_CONTENT_FOLDERS: Record<WorkoutContentFileKind, string> = {
  workout: 'workouts',
};

/** Liest den Stand einer Datei (Pfad relativ zum Repository) im Vergleichsstand; undefined = nicht vorhanden. */
export type PreviousReader = (repoPath: string) => string | undefined;

export interface LoadedContent<F = ContentFile> {
  readonly files: F[];
  /** Dateien, die nicht als Inhalt gelten (z. B. falsche Endung) – werden als Fehler gemeldet. */
  readonly strayFiles: string[];
}

/**
 * Liest alle JSON-Dateien aus `contentDir/exercises` und `contentDir/plan-templates`.
 * `repoRoot` + `readPrevious` liefern optional den Vergleichsstand je Datei (Versionsregel).
 */
export function loadContentFiles(
  contentDir: string,
  options: { repoRoot?: string; readPrevious?: PreviousReader } = {},
): LoadedContent {
  return loadFolders(contentDir, CONTENT_FOLDERS, options);
}

/** Liest Rezepte, Meal-Prep-Pläne und Ratgeber (Ordner `NUTRITION_CONTENT_FOLDERS`). */
export function loadNutritionContentFiles(
  contentDir: string,
  options: { repoRoot?: string; readPrevious?: PreviousReader } = {},
): LoadedContent<NutritionContentFile> {
  return loadFolders(contentDir, NUTRITION_CONTENT_FOLDERS, options);
}

/** Liest die Supplement-Inhalte (Ordner `SUPPLEMENT_CONTENT_FOLDERS`). */
export function loadSupplementContentFiles(
  contentDir: string,
  options: { repoRoot?: string; readPrevious?: PreviousReader } = {},
): LoadedContent<SupplementContentFile> {
  return loadFolders(contentDir, SUPPLEMENT_CONTENT_FOLDERS, options);
}

/** Liest die Workouts (Ordner `WORKOUT_CONTENT_FOLDERS`). */
export function loadWorkoutContentFiles(
  contentDir: string,
  options: { repoRoot?: string; readPrevious?: PreviousReader } = {},
): LoadedContent<WorkoutContentFile> {
  return loadFolders(contentDir, WORKOUT_CONTENT_FOLDERS, options);
}

function loadFolders<K extends string>(
  contentDir: string,
  folders: Record<K, string>,
  options: { repoRoot?: string; readPrevious?: PreviousReader },
): LoadedContent<{
  kind: K;
  fileName: string;
  data?: unknown;
  jsonError?: string;
  previous?: unknown;
}> {
  const files: {
    kind: K;
    fileName: string;
    data?: unknown;
    jsonError?: string;
    previous?: unknown;
  }[] = [];
  const strayFiles: string[] = [];
  for (const [kind, folder] of Object.entries(folders) as [K, string][]) {
    const dir = join(contentDir, folder);
    if (!existsSync(dir)) {
      continue;
    }
    for (const fileName of readdirSync(dir).sort()) {
      if (fileName.startsWith('.')) {
        continue;
      }
      if (!fileName.endsWith('.json')) {
        strayFiles.push(`${folder}/${fileName}`);
        continue;
      }
      const fullPath = join(dir, fileName);
      const repoPath = options.repoRoot ? relative(options.repoRoot, fullPath) : fullPath;
      const previousText = options.readPrevious?.(repoPath);
      let previous: unknown;
      if (previousText !== undefined) {
        try {
          previous = JSON.parse(previousText);
        } catch {
          previous = undefined;
        }
      }
      try {
        const data: unknown = JSON.parse(readFileSync(fullPath, 'utf8'));
        files.push({ kind, fileName, data, ...(previous === undefined ? {} : { previous }) });
      } catch (error) {
        files.push({ kind, fileName, jsonError: (error as Error).message });
      }
    }
  }
  return { files, strayFiles };
}

/**
 * Übungsbilder (`content/exercise-media/<übungs-id>.json`, Nachtrag „Muskelkarte“ in
 * docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md): jede Zuordnung braucht Lizenz und Quelle, die Übung muss es geben und die
 * Bilddatei muss unter `apps/mobile/assets/exercise-media/` liegen. Jeder Befund ist ein blockierender Datei-Fehler.
 */
export function checkExerciseMediaFolder(
  contentDir: string,
  exerciseIds: ReadonlySet<string>,
  repoRoot: string | undefined,
): string[] {
  const dir = join(contentDir, EXERCISE_MEDIA_FOLDER);
  if (!existsSync(dir)) {
    return [];
  }
  const files: ExerciseMediaFile[] = [];
  const problems: string[] = [];
  for (const fileName of readdirSync(dir).sort()) {
    if (fileName.startsWith('.')) {
      continue;
    }
    if (!fileName.endsWith('.json')) {
      problems.push(
        `${EXERCISE_MEDIA_FOLDER}/${fileName}: keine JSON-Datei – Bilder gehören nach ${EXERCISE_MEDIA_ASSET_DIR}/.`,
      );
      continue;
    }
    try {
      files.push({ fileName, data: JSON.parse(readFileSync(join(dir, fileName), 'utf8')) });
    } catch (error) {
      files.push({ fileName, jsonError: (error as Error).message });
    }
  }
  const assetDir = join(repoRoot ?? resolve(contentDir, '..'), EXERCISE_MEDIA_ASSET_DIR);
  return [
    ...problems,
    ...checkExerciseMediaFiles(files, {
      exerciseIds,
      assetExists: (file) => existsSync(join(assetDir, file)),
    }),
  ];
}

/** Auswahl der Rezeptbuch-Rezepte für die App (gleiche Datei wie packages/content/src/recipe-media/build.ts). */
const APP_SELECTION_FILE = 'rezeptbuch-app-auswahl.json';

/**
 * Rezeptfotos (`content/recipe-media/<rezept-id>.json`, docs/PLAN-PHASE-5.md Nachtrag „Rezeptbilder“): Lizenz,
 * Quelle und KI-Hinweis Pflicht, beide Bilddateien unter `apps/mobile/assets/recipe-media/`. Das Rezept muss es in
 * `content/recipes/` geben oder es steht in der App-Auswahl `content/rezeptbuch-app-auswahl.json` (Rezeptbuch-Import
 * noch offen; der Import übernimmt die IDs unverändert). Jeder Befund ist ein blockierender Datei-Fehler.
 */
export function checkRecipeMediaFolder(
  contentDir: string,
  recipeIds: ReadonlySet<string>,
  repoRoot: string | undefined,
): string[] {
  const dir = join(contentDir, RECIPE_MEDIA_FOLDER);
  if (!existsSync(dir)) {
    return [];
  }
  const allowed = new Set(recipeIds);
  const problems: string[] = [];
  const selectionPath = join(contentDir, APP_SELECTION_FILE);
  if (existsSync(selectionPath)) {
    try {
      const data: unknown = JSON.parse(readFileSync(selectionPath, 'utf8'));
      const list: unknown = Array.isArray(data)
        ? data
        : ((data as { ids?: unknown; rezepte?: unknown } | null)?.ids ??
          (data as { rezepte?: unknown } | null)?.rezepte);
      for (const entry of Array.isArray(list) ? list : []) {
        const id = typeof entry === 'string' ? entry : (entry as { id?: unknown } | null)?.id;
        if (typeof id === 'string') allowed.add(id);
      }
    } catch (error) {
      problems.push(`${APP_SELECTION_FILE}: kein gültiges JSON (${(error as Error).message}).`);
    }
  }
  const files: RecipeMediaFile[] = [];
  for (const fileName of readdirSync(dir).sort()) {
    if (fileName.startsWith('.')) {
      continue;
    }
    if (!fileName.endsWith('.json')) {
      problems.push(
        `${RECIPE_MEDIA_FOLDER}/${fileName}: keine JSON-Datei – Bilder gehören nach ${RECIPE_MEDIA_ASSET_DIR}/.`,
      );
      continue;
    }
    try {
      files.push({ fileName, data: JSON.parse(readFileSync(join(dir, fileName), 'utf8')) });
    } catch (error) {
      files.push({ fileName, jsonError: (error as Error).message });
    }
  }
  const assetDir = join(repoRoot ?? resolve(contentDir, '..'), RECIPE_MEDIA_ASSET_DIR);
  return [
    ...problems,
    ...checkRecipeMediaFiles(files, {
      recipeIds: allowed,
      assetExists: (file) => existsSync(join(assetDir, file)),
    }),
  ];
}

/**
 * Einspiel-Regel `content/einspiel-regeln.json` (Testphase, Gründer-Entscheidung 19.10.2026): fehlt die Datei, gilt
 * „nur fachlich geprüft“; eine kaputte Datei ist ein blockierender Datei-Fehler (und es gilt ebenfalls die strenge Regel).
 */
export function loadContentSeedSettings(contentDir: string): {
  settings: ContentSeedSettings;
  problems: string[];
} {
  const path = join(contentDir, CONTENT_SEED_SETTINGS_FILE);
  return parseContentSeedSettings(existsSync(path) ? readFileSync(path, 'utf8') : undefined);
}

/** Einspiel-Regel als ein Satz für Berichte. */
export function seedSettingsText(settings: ContentSeedSettings): string {
  return settings.nur_fachlich_geprueft
    ? 'Ernährung nur fachlich geprüft (Livegang-Regel)'
    : 'TESTPHASE – freigegebene Ernährungs-Inhalte auch ohne Fachprüfung (content/einspiel-regeln.json)';
}

/** Repository-Wurzel per git (undefined ohne git). */
export function gitRepoRoot(cwd: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Leser für den Vergleichsstand `ref` (z. B. origin/main). undefined, wenn es den Stand nicht gibt
 * (z. B. flacher Checkout) – dann entfällt die Versionsprüfung mit Hinweis.
 */
export function gitPreviousReader(repoRoot: string, ref: string): PreviousReader | undefined {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch {
    return undefined;
  }
  return (repoPath) => {
    try {
      return execFileSync('git', ['show', `${ref}:${repoPath}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return undefined; // Datei ist neu
    }
  };
}

const STATUS_DE: Record<ContentStatus, string> = {
  draft: 'Entwurf',
  published: 'freigegeben',
  archived: 'zurückgezogen',
};

const KIND_DE = {
  exercise: 'Übung',
  plan_template: 'Vorlage',
  library: 'Bibliothek',
  food: 'Lebensmittel',
  recipe: 'Rezept',
  recipe_library: 'Rezeptbestand',
  meal_prep_plan: 'Meal-Prep-Plan',
  guide: 'Ratgeber',
  ingredient_substitution: 'Austausch',
  package_size: 'Packungsgröße',
  supplement: 'Supplement',
  workout: 'Workout',
} as const;

function countByStatus(items: readonly { status: ContentStatus }[]): string {
  const count = (status: ContentStatus) => items.filter((item) => item.status === status).length;
  return `${count('draft')} Entwürfe, ${count('published')} freigegeben, ${count('archived')} zurückgezogen`;
}

function issueLine(issue: ContentIssue): string {
  const level = issue.severity === 'error' ? 'ROT ' : 'GELB';
  const status = issue.status ? ` (${STATUS_DE[issue.status]})` : '';
  const path = issue.path ? ` · ${issue.path}` : '';
  const blocking = isBlockingIssue(issue) ? ' [blockiert]' : '';
  return `${level} ${issue.rule.padEnd(7)} ${KIND_DE[issue.kind]} ${issue.id}${status}${path}: ${issue.message}${blocking}`;
}

export interface ReportInput {
  readonly result: ContentValidationResult;
  readonly strayFiles: readonly string[];
  /** Hinweis zur Versionsprüfung (z. B. „Vergleich mit origin/main“). */
  readonly versionNote: string;
  /** Einspiel-Regel aus `content/einspiel-regeln.json`; fehlt = nur fachlich geprüft. */
  readonly seedSettings?: ContentSeedSettings;
}

/** Fehler insgesamt, die das Skript fehlschlagen lassen (inkl. fremder Dateien). */
export function blockingCount(input: ReportInput): number {
  return input.result.blocking.length + input.strayFiles.length;
}

/** Prüfbericht als Text (Konsole). */
export function formatReport(input: ReportInput): string {
  const { result, strayFiles, versionNote } = input;
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');
  const blocking = blockingCount(input);
  const lines = [
    'Inhalte prüfen (content:validate)',
    `Übungen: ${result.exercises.length} (${countByStatus(result.exercises)})`,
    `Plan-Vorlagen: ${result.templates.length} (${countByStatus(result.templates)})`,
    ...nutritionCountLines(result),
    `Versionen: ${versionNote}`,
    ...(input.seedSettings ? [`Einspielen: ${seedSettingsText(input.seedSettings)}`] : []),
    '',
    ...strayFiles.map(
      (file) =>
        `ROT  DATEI   ${file}${file.includes(': ') ? '' : ': keine JSON-Datei – bitte entfernen oder umbenennen.'} [blockiert]`,
    ),
    ...[...errors, ...warnings].map(issueLine),
    ...(result.issues.length + strayFiles.length === 0 ? ['Keine Befunde.'] : []),
    '',
    `Ergebnis: ${blocking} blockierende Fehler · ${errors.length + strayFiles.length - blocking} rote Fehler an Entwürfen/zurückgezogenen Inhalten · ${warnings.length} gelbe Hinweise`,
    blocking === 0
      ? '✔ Bestanden.'
      : '✘ Nicht bestanden: Schema-/Dateifehler oder rote Fehler an freigegebenen Inhalten (Details oben).',
  ];
  return lines.join('\n');
}

/** Kurzfassung als Markdown für die Zusammenfassung in GitHub Actions (am Handy lesbar). */
export function formatMarkdownSummary(input: ReportInput): string {
  const { result } = input;
  const blocking = blockingCount(input);
  const rows = result.issues.map((issue) => {
    const level = issue.severity === 'error' ? '🔴' : '🟡';
    const status = issue.status ? STATUS_DE[issue.status] : '–';
    return `| ${level} ${issue.rule} | ${KIND_DE[issue.kind]} \`${issue.id}\` | ${status} | ${issue.message.replace(/\|/g, '\\|')} |`;
  });
  return [
    blocking === 0 ? '### ✅ Inhalte geprüft' : '### ❌ Inhalte: blockierende Fehler',
    '',
    [
      `Übungen: ${result.exercises.length} (${countByStatus(result.exercises)})`,
      `Plan-Vorlagen: ${result.templates.length} (${countByStatus(result.templates)})`,
      ...nutritionCountLines(result),
    ].join(' · '),
    '',
    `Versionen: ${input.versionNote}`,
    '',
    ...(input.seedSettings ? [`Einspielen: ${seedSettingsText(input.seedSettings)}`, ''] : []),
    ...(input.strayFiles.length > 0 ? [`🔴 Datei-Fehler: ${input.strayFiles.join(', ')}`, ''] : []),
    ...(rows.length > 0
      ? ['| Regel | Inhalt | Status | Befund |', '| --- | --- | --- | --- |', ...rows]
      : ['Keine Befunde.']),
    '',
    ...coverageMarkdown(result),
    'Rot blockiert nur bei freigegebenen Inhalten (Schema-/Dateifehler immer). Regeln: docs/PLAN-PHASE-2.md Abschnitt 7, Supplemente (SK1–SK7): docs/PLAN-PHASE-6.md Abschnitt 6, Workouts (W1–W7): docs/PLAN-WORKOUTS.md.',
    '',
  ].join('\n');
}

function nutritionCountLines(result: ContentValidationResult): string[] {
  const lines: string[] = [];
  const add = (label: string, items: readonly { status: ContentStatus }[]) => {
    if (items.length > 0) {
      lines.push(`${label}: ${items.length} (${countByStatus(items)})`);
    }
  };
  add('Lebensmittel', result.foods);
  add('Rezepte', result.recipes);
  add('Meal-Prep-Pläne', result.mealPrepPlans);
  add('Ratgeber', result.guides);
  add('Austausch-Einträge', result.substitutions);
  add('Packungsgrößen', result.packageSizes);
  add('Supplemente', result.supplements);
  add('Workouts', result.workouts);
  return lines;
}

const MEAL_TYPE_DE = { breakfast: 'Frühstück', main: 'Hauptgericht', snack: 'Snack' } as const;
const DIET_DE = {
  omnivore: 'mit Fleisch/Fisch',
  vegetarian: 'vegetarisch',
  vegan: 'vegan',
} as const;

/**
 * Abdeckungsbericht (R16, Plan 5.4, 13 N2c): passende Rezepte je Mahlzeit × Ernährungsform × häufige
 * Unverträglichkeit (Entwürfe und freigegebene). Nur, wenn es Rezepte gibt.
 */
export function coverageMarkdown(
  result: Pick<ContentValidationResult, 'recipes' | 'foods'>,
): string[] {
  if (result.recipes.length === 0) {
    return [];
  }
  const rows = recipeCoverageReport(result.recipes, new Map(result.foods.map((f) => [f.id, f])));
  const intolerances: (string | null)[] = [null, ...RECIPE_COVERAGE.intolerances];
  const count = (mealType: string, diet: string, intolerance: string | null) =>
    rows.find((r) => r.mealType === mealType && r.diet === diet && r.intolerance === intolerance)
      ?.count ?? 0;
  const lines = [
    '#### Abdeckung (R16)',
    '',
    `Passende Rezepte je Mahlzeit und Ernährungsform; Spalten „ohne …“ = bei dieser Unverträglichkeit. Unter ${RECIPE_COVERAGE.minPerCombination} = gelb. Lebensmittel, die im Katalog fehlen, zählen nicht.`,
    '',
    `| Mahlzeit | Ernährungsform | alle | ${RECIPE_COVERAGE.intolerances.map((g) => `ohne ${g}`).join(' | ')} |`,
    `| --- | --- | ${intolerances.map(() => '---:').join(' | ')} |`,
  ];
  for (const mealType of MEAL_TYPES) {
    for (const diet of DIET_TYPES) {
      const cells = intolerances.map((g) => {
        const n = count(mealType, diet, g);
        return n < RECIPE_COVERAGE.minPerCombination ? `🟡 ${n}` : `${n}`;
      });
      lines.push(`| ${MEAL_TYPE_DE[mealType]} | ${DIET_DE[diet]} | ${cells.join(' | ')} |`);
    }
  }
  lines.push('');
  return lines;
}

export interface CliResult {
  readonly exitCode: number;
  readonly output: string;
  readonly markdown: string;
}

/** Argumente: `--content <ordner>` (Standard: <repo>/content), `--base <git-ref>`. */
export function parseArgs(argv: readonly string[]): { contentDir?: string; base?: string } {
  const result: { contentDir?: string; base?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (
      (arg === '--content' || arg === '--base') &&
      value !== undefined &&
      !value.startsWith('--')
    ) {
      if (arg === '--content') {
        result.contentDir = value;
      } else {
        result.base = value;
      }
      i += 1;
    } else if (arg !== '--') {
      throw new Error(
        `Unbekanntes Argument: ${arg} (erlaubt: --content <Ordner>, --base <git-ref>)`,
      );
    }
  }
  return result;
}

/**
 * Prüft den Inhaltsstand eines Repositorys (strukturiertes Ergebnis). Wird von `content:validate` und von
 * den Workflows der Pipeline (content-collect, content-review, content-seed) genutzt.
 */
export function validateRepository(options: {
  cwd: string;
  contentDir?: string;
  base?: string;
}): ReportInput {
  const cwdRoot = gitRepoRoot(options.cwd);
  const contentDir = resolve(
    options.cwd,
    options.contentDir ?? join(cwdRoot ?? options.cwd, 'content'),
  );
  // Mit --content (z. B. sources-integrity: Code von main, PR-Stand als Daten in einem eigenen Checkout) gilt
  // das Repo des Inhalts-Ordners – dort liegen die Bilddateien und der Vergleichsstand dieses Stands.
  const repoRoot =
    options.contentDir === undefined ? cwdRoot : (gitRepoRoot(contentDir) ?? cwdRoot);

  let readPrevious: PreviousReader | undefined;
  let versionNote = 'nicht geprüft (kein Vergleichsstand angegeben, Option --base)';
  if (options.base !== undefined) {
    readPrevious = repoRoot ? gitPreviousReader(repoRoot, options.base) : undefined;
    versionNote = readPrevious
      ? `Vergleich mit ${options.base}`
      : `nicht geprüft – Vergleichsstand „${options.base}“ nicht verfügbar`;
  }

  const readOptions = {
    ...(repoRoot === undefined ? {} : { repoRoot }),
    ...(readPrevious === undefined ? {} : { readPrevious }),
  };
  const loaded = loadContentFiles(contentDir, readOptions);
  // Rezepte, Meal-Prep-Pläne, Ratgeber (Etappe N2c).
  const nutritionFiles = loadNutritionContentFiles(contentDir, readOptions);
  // Lebensmittel-Katalog (Etappe N2b, R17/R18): nur, wenn `content/foods/` existiert.
  const nutrition = loadNutritionCatalog(contentDir);
  // Einspiel-Regel (Testphase 19.10.2026); kaputte Datei = blockierender Datei-Fehler.
  const seed = loadContentSeedSettings(contentDir);
  // Supplemente (Phase 6 SU2, SK1–SK7).
  const supplementFiles = loadSupplementContentFiles(contentDir, readOptions);
  // Workouts (docs/PLAN-WORKOUTS.md, W1–W7) – geprüft gegen die Übungsbibliothek.
  const workoutFiles = loadWorkoutContentFiles(contentDir, readOptions);
  // Übungsbilder „Ausgangsposition“ (Bild ohne Lizenz = blockierend).
  const exerciseIds = new Set(
    loaded.files.flatMap((file) => {
      const id = (file.data as { id?: unknown } | undefined)?.id;
      return file.kind === 'exercise' && typeof id === 'string' ? [id] : [];
    }),
  );
  const mediaProblems = checkExerciseMediaFolder(contentDir, exerciseIds, repoRoot);
  // Rezeptfotos (Bild ohne Lizenz/KI-Hinweis = blockierend).
  const recipeIds = new Set(
    nutritionFiles.files.flatMap((file) => {
      const id = (file.data as { id?: unknown } | undefined)?.id;
      return file.kind === 'recipe' && typeof id === 'string' ? [id] : [];
    }),
  );
  const recipeMediaProblems = checkRecipeMediaFolder(contentDir, recipeIds, repoRoot);
  return {
    result: validateContent(
      [
        ...loaded.files,
        ...nutrition.files,
        ...nutritionFiles.files,
        ...supplementFiles.files,
        ...workoutFiles.files,
      ],
      nutrition.catalog === undefined ? {} : { nutritionCatalog: nutrition.catalog },
    ),
    strayFiles: [
      ...loaded.strayFiles,
      ...nutritionFiles.strayFiles,
      ...supplementFiles.strayFiles,
      ...workoutFiles.strayFiles,
      ...nutrition.problems,
      ...seed.problems,
      ...mediaProblems,
      ...recipeMediaProblems,
    ],
    versionNote,
    seedSettings: seed.settings,
  };
}

/** Führt die Prüfung aus (ohne Prozess-Ende) – testbar. */
export function runValidate(argv: readonly string[], cwd: string): CliResult {
  const args = parseArgs(argv);
  const input = validateRepository({
    cwd,
    ...(args.contentDir === undefined ? {} : { contentDir: args.contentDir }),
    ...(args.base === undefined ? {} : { base: args.base }),
  });
  return {
    exitCode: blockingCount(input) > 0 ? 1 : 0,
    output: formatReport(input),
    markdown: formatMarkdownSummary(input),
  };
}
