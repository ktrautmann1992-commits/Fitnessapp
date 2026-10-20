/**
 * Verteiler für `content-review` (Workflow-Eingaben → richtige Freigabe):
 * - Art „ids“ mit Übungen/Plan-Vorlagen → `runReview` (wie bisher, alle Zielstatus),
 * - Art „ids“ mit Rezepten, Meal-Prep-Plänen, Ratgebern, Austausch-Einträgen oder Packungsgrößen → `runNutritionIdRelease` (nur Freigabe, gleiche Regeln
 *   wie die Sammelfreigabe; Gründer-Entscheidungen 14.10.2026). Lebensmittel lehnt dieser Weg ab.
 * - Art „recipe“ → `runRecipeCategoryRelease` (Sammelfreigabe pro Kategorie).
 * - Art „katalog“ → `runCatalogReview` („Katalog geprüft“ für Lebensmittel, R19/R2-K6): IDs von Lebensmitteln oder
 *   „rezepte“ = alle Lebensmittel aus Rezept-Entwürfen. Verifizierter Commit über die GitHub-API (review-catalog.ts).
 * Gemischte Läufe (Übung und Rezept zugleich) werden abgelehnt – die Regeln und Häkchen sind verschieden.
 * - Art „ids“ mit dem Wort „alle“ → alle Übungen und Plan-Vorlagen im Status „draft“ auf einmal freigeben
 *   (nur Zielstatus published, nur Training; Gründer-Wunsch 17.10.2026 – 122 IDs am Handy nicht tippbar).
 *   Freigabe bleibt der Merge durch einen Menschen.
 * Eingaben ohne Wirkung werden in der Zusammenfassung genannt (Wächter N2d K4).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FOODS_FOLDER } from '../foods/catalog-loader';
import { CONTENT_FOLDERS, NUTRITION_CONTENT_FOLDERS } from '../validate';
import { runReview, type ReviewDeps, reviewInputSchema, type ReviewResult } from './review';
import { type CatalogReviewDeps, runCatalogReview } from './review-catalog';
import {
  checkoutBaseBranch,
  runNutritionIdRelease,
  runRecipeCategoryRelease,
} from './review-recipes';

/** Rohe Workflow-Eingaben (Texte aus den Umgebungsvariablen). */
export interface ReviewEnvInput {
  readonly kind: string;
  readonly ids: string;
  readonly status: string;
  readonly reviewer: string;
  readonly category: string;
  readonly expertReviewed: string;
  readonly confirmAssumptions: string;
}

export const REVIEW_KINDS = ['ids', 'recipe', 'katalog'] as const;

/** Stichwort in „ids“: alle Übungen und Plan-Vorlagen im Entwurf freigeben. */
export const ALL_TRAINING_KEYWORD = 'alle';

/** IDs aller Übungen und Plan-Vorlagen im Status „draft“ (auf dem aktuellen Stand – vorher auf main wechseln). */
export function draftTrainingIds(repoRoot: string): string[] {
  const ids: string[] = [];
  for (const folder of Object.values(CONTENT_FOLDERS)) {
    const dir = join(repoRoot, 'content', folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { status?: unknown };
      if (data.status === 'draft') ids.push(file.slice(0, -'.json'.length));
    }
  }
  return ids;
}

async function runAllTrainingRelease(
  input: ReviewEnvInput,
  deps: ReviewDeps,
): Promise<ReviewResult> {
  if (input.status.trim() !== 'published') {
    return {
      exitCode: 1,
      markdown:
        '### ❌ content-review\n\nNichts geändert: „alle“ gibt es nur zum Freigeben (Neuer Status = published). Zurückziehen bitte per ID.\n',
    };
  }
  checkoutBaseBranch(deps);
  const ids = draftTrainingIds(deps.repoRoot);
  if (ids.length === 0) {
    return {
      exitCode: 0,
      markdown:
        '### ⏭️ content-review: nichts zu tun\n\nKeine Übung und keine Plan-Vorlage ist mehr im Entwurf.\n',
    };
  }
  return runReview({ ids: ids.join(' '), status: input.status, reviewer: input.reviewer }, deps, {
    maxIds: ids.length,
  });
}

type Target = 'training' | 'nutrition';

function exists(repoRoot: string, folder: string, id: string): boolean {
  return existsSync(join(repoRoot, 'content', folder, `${id}.json`));
}

export interface IdClassification {
  /** IDs mit Datei unter exercises/ bzw. plan-templates/. */
  readonly training: readonly string[];
  /** IDs mit Datei unter recipes/, meal-prep-plans/, guides/, substitutions/, package-sizes/ oder foods/. */
  readonly nutrition: readonly string[];
  /** IDs ohne Datei in irgendeinem Bereich. */
  readonly unknown: readonly string[];
}

/**
 * Welche Bereiche die IDs nennen (nach vorhandenen Dateien auf dem aktuellen Stand – vorher auf main wechseln). Eine
 * ID in beiden Bereichen steht in beiden Listen → gemischter Lauf (lieber ablehnen als raten).
 */
export function classifyIds(repoRoot: string, ids: readonly string[]): IdClassification {
  const nutritionFolders = [...Object.values(NUTRITION_CONTENT_FOLDERS), FOODS_FOLDER];
  const training: string[] = [];
  const nutrition: string[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const isNutrition = nutritionFolders.some((folder) => exists(repoRoot, folder, id));
    const isTraining = Object.values(CONTENT_FOLDERS).some((folder) =>
      exists(repoRoot, folder, id),
    );
    if (isNutrition) nutrition.push(id);
    if (isTraining) training.push(id);
    if (!isNutrition && !isTraining) unknown.push(id);
  }
  return { training, nutrition, unknown };
}

const code = (ids: readonly string[]) => ids.map((id) => `\`${id}\``).join(', ');

/** Hinweise zu Eingaben ohne Wirkung (damit niemand glaubt, ein Häkchen sei gesetzt worden). */
export function ignoredInputNotes(
  input: ReviewEnvInput,
  target: Target | 'category' | 'catalog',
): string[] {
  const notes: string[] = [];
  const category = input.category.trim();
  if (target === 'catalog') {
    if (category !== '' && category !== '-') {
      notes.push(`Kategorie „${category}“ hat bei Art „katalog“ keine Wirkung.`);
    }
    if (input.expertReviewed === 'true') {
      notes.push(
        'Häkchen „fachlich geprüft“ wirkt bei Art „katalog“ nicht – die Katalog-Prüfung setzt nur „Katalog geprüft“ und die Freigabe.',
      );
    }
    if (input.confirmAssumptions === 'true') {
      notes.push('Häkchen „Import-Annahmen geprüft“ wirkt nur bei Rezepten – hier ohne Wirkung.');
    }
    return notes;
  }
  if (target !== 'category' && category !== '' && category !== '-') {
    notes.push(`Kategorie „${category}“ hat bei Art „ids“ keine Wirkung.`);
  }
  if (target === 'category' && input.ids.trim() !== '') {
    notes.push('IDs haben bei Art „recipe“ (Sammelfreigabe pro Kategorie) keine Wirkung.');
  }
  if (target === 'training') {
    if (input.expertReviewed === 'true') {
      notes.push(
        'Häkchen „fachlich geprüft“ wirkt nur bei Ernährungs-Inhalten – bei Übungen/Vorlagen nicht gesetzt.',
      );
    }
    if (input.confirmAssumptions === 'true') {
      notes.push('Häkchen „Import-Annahmen geprüft“ wirkt nur bei Rezepten – hier ohne Wirkung.');
    }
  }
  return notes;
}

function withNotes(result: ReviewResult, notes: readonly string[]): ReviewResult {
  if (notes.length === 0) return result;
  return {
    ...result,
    markdown: `${notes.map((note) => `> ℹ️ ${note}`).join('\n')}\n\n${result.markdown}`,
  };
}

export async function runContentReview(
  input: ReviewEnvInput,
  deps: CatalogReviewDeps,
): Promise<ReviewResult> {
  const kind = input.kind.trim();
  if (kind === 'katalog') {
    const result = await runCatalogReview(
      { ids: input.ids, status: input.status, reviewer: input.reviewer },
      deps,
    );
    return withNotes(result, ignoredInputNotes(input, 'catalog'));
  }
  if (kind === 'recipe') {
    const result = await runRecipeCategoryRelease(
      {
        category: input.category,
        status: input.status,
        reviewer: input.reviewer,
        expertReviewed: input.expertReviewed,
        confirmAssumptions: input.confirmAssumptions,
      },
      deps,
    );
    return withNotes(result, ignoredInputNotes(input, 'category'));
  }
  if (kind !== 'ids') {
    return {
      exitCode: 1,
      markdown: `### ❌ content-review\n\nArt „${kind}“ unbekannt – erlaubt: ${REVIEW_KINDS.join(', ')}.\n`,
    };
  }
  if (input.ids.trim().toLowerCase() === ALL_TRAINING_KEYWORD) {
    return withNotes(
      await runAllTrainingRelease(input, deps),
      ignoredInputNotes(input, 'training'),
    );
  }
  const ids = reviewInputSchema.shape.ids.safeParse(input.ids);
  // Klassifizieren auf dem Stand von main – genau dem Stand, den die Freigabe danach liest (Wächter N2d K7).
  if (ids.success) checkoutBaseBranch(deps);
  const classes = ids.success ? classifyIds(deps.repoRoot, ids.data) : undefined;
  if (classes !== undefined && classes.unknown.length > 0) {
    return {
      exitCode: 1,
      markdown: [
        '### ❌ content-review',
        '',
        `Nichts geändert: Auf \`main\` nicht gefunden: ${code(classes.unknown)}.`,
        '',
        'Gesucht in Übungen, Plan-Vorlagen, Rezepten, Meal-Prep-Plänen, Ratgebern, Austausch-Einträgen, Packungsgrößen und Lebensmitteln. Tippfehler? Die ID steht im Redaktionsbereich (Rezept → Steckbrief → ID). Neue Inhalte sind erst nach dem Merge ihres Pull Requests freigebbar.',
        '',
      ].join('\n'),
    };
  }
  if (classes !== undefined && classes.training.length > 0 && classes.nutrition.length > 0) {
    return {
      exitCode: 1,
      markdown: [
        '### ❌ content-review',
        '',
        'Nichts geändert: Die IDs mischen Training und Ernährung – bitte getrennt starten, die Regeln und Häkchen sind verschieden.',
        '',
        `- Übungen/Vorlagen: ${code(classes.training)}`,
        `- Ernährung (Rezepte, Meal-Prep-Pläne, Ratgeber, Austausch, Packungsgrößen, Lebensmittel): ${code(classes.nutrition)}`,
        '',
      ].join('\n'),
    };
  }
  const target: Target =
    classes !== undefined && classes.nutrition.length > 0 ? 'nutrition' : 'training';
  const result =
    target === 'nutrition'
      ? await runNutritionIdRelease(
          {
            ids: input.ids,
            status: input.status,
            reviewer: input.reviewer,
            expertReviewed: input.expertReviewed,
            confirmAssumptions: input.confirmAssumptions,
          },
          deps,
        )
      : await runReview({ ids: input.ids, status: input.status, reviewer: input.reviewer }, deps);
  return withNotes(result, ignoredInputNotes(input, target));
}
