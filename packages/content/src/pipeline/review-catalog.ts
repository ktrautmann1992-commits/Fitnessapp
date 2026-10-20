/**
 * `content-review` Art „katalog“ = Option „Katalog geprüft“ (R19, R2-K6, docs/PLAN-PHASE-5.md 5.1.1 d):
 * setzt `meta.catalog_reviewed_by` (= Prüfer) und `meta.catalog_reviewed_at` (= heute) und gibt die Lebensmittel frei
 * (Status published, Prüfvermerk) – nur für Lebensmittel ohne roten Befund (Core `planCatalogReview`). IDs = Liste
 * von Lebensmittel-IDs oder „rezepte“ = alle Lebensmittel aus Rezept-Entwürfen (plus Ersatzprodukte).
 *
 * Unter `content/foods/**` lässt `sources-integrity` nur verifizierte Commits von `github-actions[bot]` zu. Deshalb
 * entsteht der Commit hier über die GitHub-API (wie bei foods-import, `createVerifiedCommit`) auf dem Branch
 * `content-review/katalog-<Lauf-ID>`; `sources-integrity` prüft für diesen Branch Lauf (content-review.yml auf main),
 * Herkunft der Commits und dass sich NUR Status, Prüfvermerk und Katalog-Prüfung geändert haben – Nährwerte, Quelle
 * und alle anderen Felder bleiben unangetastet (`catalog-review-guard.ts`).
 *
 * Der Workflow genehmigt nie: wirksam erst mit dem Merge durch einen Menschen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CATALOG_CHECKLIST,
  CATALOG_RECIPES_KEYWORD,
  type CatalogReviewDecision,
  catalogReviewBlockerText,
  catalogSaltCheck,
  CONTENT_STATUSES,
  type Food,
  foodIdsInRecipeDrafts,
  planCatalogReview,
  validateContent,
} from '@fitnessapp/core';
import { z } from 'zod';

import { FOODS_FOLDER, loadNutritionCatalog } from '../foods/catalog-loader';
import {
  createVerifiedCommit,
  dispatchWorkflow,
  type GitHubApi,
  openPullRequest,
} from '../foods/github-api';
import { loadNutritionContentFiles } from '../validate';
import { BASE_BRANCH, isoDateBerlin, zodMessage } from './config';
import { writeJsonFile } from './files';
import { PHONE_TEST_SECTION, runPrChecks, truncateBody } from './pull-request';
import { type ReviewDeps, reviewInputSchema, type ReviewResult } from './review';
import { checkoutBaseBranch } from './review-recipes';

/** Branch der Katalog-Prüfung; `sources-integrity` erkennt ihn an diesem Muster (mit Lauf-ID). */
export const CATALOG_REVIEW_BRANCH_PREFIX = 'content-review/katalog-';

/** Workflows, die nach dem Pull Request für den Branch gestartet werden (PRs mit GITHUB_TOKEN starten keine). */
export const CATALOG_CHECK_WORKFLOWS = ['ci.yml', 'sources-integrity-main.yml'] as const;

/** Höchstens so viele Lebensmittel-IDs von Hand (bei „rezepte“ gilt die Zahl der gefundenen). */
const MAX_FOOD_IDS = 300;

export const catalogReviewInputSchema = z.object({
  ids: z.string(),
  status: z
    .enum(CONTENT_STATUSES, { error: 'Zielstatus: published, archived oder draft.' })
    .refine(
      (status) => status === 'published',
      'Art „katalog“ nur mit Neuer Status = published (Katalog geprüft = Lebensmittel freigeben).',
    ),
  reviewer: reviewInputSchema.shape.reviewer,
});
export type CatalogReviewInput = z.input<typeof catalogReviewInputSchema>;

/** Zusätzlich zu `ReviewDeps`: GitHub-API (verifizierter Commit) und Lauf-ID (Branch-Name). */
export interface CatalogReviewDeps extends ReviewDeps {
  readonly api?: GitHubApi;
  readonly runId?: string;
}

const idsSchema = z
  .string()
  .transform((raw) => [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ])
  .pipe(
    z
      .array(
        z
          .string()
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            'IDs: nur Kleinbuchstaben, Ziffern und Bindestriche.',
          ),
      )
      .min(1, 'Mindestens eine ID angeben (oder „rezepte“).')
      .max(MAX_FOOD_IDS, `Höchstens ${MAX_FOOD_IDS} IDs auf einmal (oder „rezepte“).`),
  );

function fail(markdown: string): ReviewResult {
  return { exitCode: 1, markdown: `### ❌ content-review (Katalog geprüft)\n\n${markdown}\n` };
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function list(values: readonly string[]): string {
  return values.length === 0 ? '–' : values.join(', ');
}

function num(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Prüfrelevante Angaben je Lebensmittel (Checkliste 5.1.1 d) als Tabellenzeile. */
export function catalogReviewRow(food: Food): string {
  const salt = `${num(food.nutrients_per_100g.salt_g)} g${catalogSaltCheck(food) ? ' ⚠️ prüfen' : ''}`;
  const substitutes = food.substitutes.map((s) => s.food_id);
  return `| \`${food.id}\` ${cell(food.name_de)} | ${cell(`${food.source.ref} „${food.source.name}“`)} | ${cell(list(food.groups))} | ${cell(list(food.animal))} | ${cell(list(food.meat_kind))} | ${food.pregnancy_caution ? '**ja**' : 'nein'} | ${salt} | ${food.max_fridge_days} | ${cell(list(substitutes))} |`;
}

function reviewedTable(decisions: readonly CatalogReviewDecision[]): string[] {
  return [
    `#### Katalog geprüft und freigegeben (${decisions.length}) – bitte je Zeile mit der Checkliste prüfen`,
    '',
    '| Lebensmittel | Quelle (ID „Bezeichnung“) | Gruppen | tierisch (animal) | Fleischart (meat_kind) | Schwangerschaft | Salz/100 g | Kühlschrank-Tage | Ersatz |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...decisions.map((d) => catalogReviewRow(d.reviewed)),
  ];
}

function skippedTable(decisions: readonly CatalogReviewDecision[]): string[] {
  if (decisions.length === 0) return ['Übersprungen: keine.'];
  return [
    `#### Übersprungen (${decisions.length}) – bleiben unverändert`,
    '',
    '| Lebensmittel | Grund |',
    '| --- | --- |',
    ...decisions.map(
      (d) =>
        `| \`${d.original.id}\` ${cell(d.original.name_de)} | ${cell(d.blockers.map(catalogReviewBlockerText).join(' · '))} |`,
    ),
  ];
}

export function catalogChecklistMarkdown(): string[] {
  return [
    '#### Checkliste Katalog-Prüfung (R19, docs/PLAN-PHASE-5.md 5.1.1 d)',
    '',
    ...CATALOG_CHECKLIST.map((item) => `- [ ] ${item}`),
  ];
}

export async function runCatalogReview(
  rawInput: unknown,
  deps: CatalogReviewDeps,
): Promise<ReviewResult> {
  const parsed = catalogReviewInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const input = parsed.data;
  const keyword = input.ids.trim().toLowerCase() === CATALOG_RECIPES_KEYWORD;
  const typedIds = keyword ? undefined : idsSchema.safeParse(input.ids);
  if (typedIds !== undefined && !typedIds.success) return fail(zodMessage(typedIds.error));

  const { repoRoot, tools } = deps;
  checkoutBaseBranch(deps);
  const baseSha = tools.git(['rev-parse', 'HEAD']).trim();
  const contentDir = join(repoRoot, 'content');
  const loaded = loadNutritionCatalog(contentDir);
  if (loaded.catalog === undefined) {
    return fail('Noch kein Lebensmittel-Katalog auf `main` (Workflow foods-import).');
  }
  const files = [...loaded.files, ...loadNutritionContentFiles(contentDir).files];
  const before = validateContent(files, { nutritionCatalog: loaded.catalog });
  const ids = keyword ? foodIdsInRecipeDrafts(before) : typedIds!.data!;
  const today = isoDateBerlin(deps.now());
  const plan = planCatalogReview(
    files,
    loaded.catalog,
    ids,
    { reviewer: input.reviewer, date: today },
    before,
  );
  if (plan.unknownIds.length > 0) {
    return fail(
      [
        `Nichts geändert: Auf \`main\` kein Lebensmittel (mit gültigem Schema) mit diesen IDs: ${plan.unknownIds.map((id) => `\`${id}\``).join(', ')}.`,
        '',
        'Die ID steht im Redaktionsbereich (Lebensmittel → Steckbrief) bzw. als Dateiname unter `content/foods/`.',
      ].join('\n'),
    );
  }
  const reviewed = plan.decisions.filter((d) => d.blockers.length === 0);
  const skipped = plan.decisions.filter((d) => d.blockers.length > 0);
  const header = [
    '## Katalog geprüft (R19)',
    '',
    `Prüfer: **${input.reviewer}** · Datum: ${today} · Auswahl: ${keyword ? '„rezepte“ = alle Lebensmittel aus Rezept-Entwürfen (plus Ersatzprodukte)' : 'IDs'}`,
    '',
    `${plan.decisions.length} Lebensmittel · ${reviewed.length} werden gesetzt · ${skipped.length} übersprungen.`,
    '',
  ];
  if (reviewed.length === 0) {
    return {
      exitCode: 0,
      markdown: [
        '### ⏭️ content-review: nichts zu setzen – kein Pull Request',
        '',
        ...header,
        ...skippedTable(skipped),
        '',
      ].join('\n'),
    };
  }

  const paths: string[] = [];
  for (const decision of reviewed) {
    const path = `content/${FOODS_FOLDER}/${decision.original.id}.json`;
    await writeJsonFile(repoRoot, path, decision.reviewed);
    paths.push(path);
  }
  const checks = await runPrChecks(repoRoot, paths, tools);
  const report = [
    ...header,
    ...catalogChecklistMarkdown(),
    '',
    ...reviewedTable(reviewed),
    '',
    ...skippedTable(skipped),
    '',
    'Geändert werden je Lebensmittel nur `status` (→ published), `meta.reviewed_by/at` (falls leer) und `meta.catalog_reviewed_by/at`. Nährwerte, Quelle, Gruppen und alle anderen Angaben bleiben unverändert – das prüft `sources-integrity`. **Wirksam erst mit dem Merge durch einen Menschen.** Stimmt etwas in einer Zeile nicht: Pull Request NICHT mergen, Korrektur in `content/food-mapping/` und neuer foods-import-Lauf.',
    '',
    checks.markdown,
  ].join('\n');

  const reset = () => tools.git(['reset', '--hard', `origin/${BASE_BRANCH}`]);
  if (!checks.ok) {
    reset();
    return fail(['Prüfung rot – **kein Pull Request**.', '', report].join('\n'));
  }
  if (deps.api === undefined || deps.runId === undefined || !/^\d+$/.test(deps.runId)) {
    reset();
    return fail(
      'Kein GITHUB_TOKEN bzw. keine Lauf-ID – der verifizierte Commit ist nur im Workflow content-review möglich.',
    );
  }
  const branch = `${CATALOG_REVIEW_BRANCH_PREFIX}${deps.runId}`;
  const commitFiles = paths.map((path) => ({
    path,
    content: readFileSync(join(repoRoot, path)),
  }));
  reset();
  await createVerifiedCommit(deps.api, {
    base: BASE_BRANCH,
    expectedBaseSha: baseSha,
    branch,
    message: `Katalog geprüft durch ${input.reviewer}: ${reviewed.length} Lebensmittel (content-review #${deps.runId})`,
    files: commitFiles,
  });
  const prUrl = await openPullRequest(deps.api, {
    base: BASE_BRANCH,
    branch,
    title: `Katalog geprüft: ${reviewed.length} Lebensmittel (${input.reviewer})`,
    body: truncateBody(
      [
        report,
        '',
        PHONE_TEST_SECTION,
        '',
        '---',
        'Automatisch erstellt von content-review (Art „katalog“). Dieser Workflow öffnet nur Pull Requests und genehmigt nie.',
      ].join('\n'),
    ),
  });
  const warnings: string[] = [];
  for (const workflow of CATALOG_CHECK_WORKFLOWS) {
    try {
      await dispatchWorkflow(deps.api, workflow, branch);
    } catch (error) {
      warnings.push(
        `${workflow} konnte nicht gestartet werden (${(error as Error).message}). Bitte Actions → ${workflow} → Run workflow, Branch ${branch}.`,
      );
    }
  }
  return {
    exitCode: 0,
    prUrl,
    branch,
    markdown: [
      `### ✅ content-review: Pull Request ${prUrl}`,
      ...warnings.map((w) => `\n⚠️ ${w}`),
      '',
      report,
      '',
    ].join('\n'),
  };
}
