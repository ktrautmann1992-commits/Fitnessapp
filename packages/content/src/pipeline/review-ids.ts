/**
 * Verteiler für `content-review` (Workflow-Eingaben → richtige Freigabe):
 * - Art „ids“ mit Übungen/Plan-Vorlagen → `runReview` (wie bisher, alle Zielstatus),
 * - Art „ids“ mit Rezepten, Meal-Prep-Plänen oder Ratgebern → `runNutritionIdRelease` (nur Freigabe, gleiche Regeln
 *   wie die Sammelfreigabe; Gründer-Entscheidungen 14.10.2026). Lebensmittel lehnt dieser Weg ab.
 * - Art „recipe“ → `runRecipeCategoryRelease` (Sammelfreigabe pro Kategorie).
 * Gemischte Läufe (Übung und Rezept zugleich) werden abgelehnt – die Regeln und Häkchen sind verschieden.
 * Eingaben ohne Wirkung werden in der Zusammenfassung genannt (Wächter N2d K4).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FOODS_FOLDER } from '../foods/catalog-loader';
import { CONTENT_FOLDERS, NUTRITION_CONTENT_FOLDERS } from '../validate';
import { runReview, type ReviewDeps, reviewInputSchema, type ReviewResult } from './review';
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

export const REVIEW_KINDS = ['ids', 'recipe'] as const;

type Target = 'training' | 'nutrition';

function exists(repoRoot: string, folder: string, id: string): boolean {
  return existsSync(join(repoRoot, 'content', folder, `${id}.json`));
}

export interface IdClassification {
  /** IDs mit Datei unter exercises/ bzw. plan-templates/. */
  readonly training: readonly string[];
  /** IDs mit Datei unter recipes/, meal-prep-plans/, guides/ oder foods/. */
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
export function ignoredInputNotes(input: ReviewEnvInput, target: Target | 'category'): string[] {
  const notes: string[] = [];
  const category = input.category.trim();
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
  deps: ReviewDeps,
): Promise<ReviewResult> {
  const kind = input.kind.trim();
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
        'Gesucht in Übungen, Plan-Vorlagen, Rezepten, Meal-Prep-Plänen, Ratgebern und Lebensmitteln. Tippfehler? Die ID steht im Redaktionsbereich (Rezept → Steckbrief → ID). Neue Inhalte sind erst nach dem Merge ihres Pull Requests freigebbar.',
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
        `- Ernährung (Rezepte, Meal-Prep-Pläne, Ratgeber, Lebensmittel): ${code(classes.nutrition)}`,
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
