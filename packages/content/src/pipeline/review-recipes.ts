/**
 * `content-review` für Ernährungs-Inhalte (docs/PLAN-PHASE-5.md 19.5, Etappe N2d):
 * - Art „recipe“: Sammelfreigabe von Rezepten pro Kategorie (`runRecipeCategoryRelease`),
 * - Art „ids“ mit Rezepten, Meal-Prep-Plänen oder Ratgebern: Freigabe einzelner Inhalte per ID
 *   (`runNutritionIdRelease`, Gründer-Entscheidungen 14.10.2026 – der Weg für Rezepte ohne Kategorie).
 *
 * Die Regeln stehen in packages/core (`planRecipeRelease`, `planNutritionRelease`): Gesetzt wird `published` nur für
 * Entwürfe ohne roten Befund; Rezepte zusätzlich nur mit katalog-geprüften und freigegebenen Lebensmitteln und ohne
 * unbestätigte Import-Annahmen „durchgegart“ (die bestätigt nur das Häkchen „Import-Annahmen geprüft“), Meal-Prep-Pläne
 * nur, wenn alle ihre Rezepte danach freigegeben sind. Lebensmittel nie über diesen Weg. Übersprungene Inhalte stehen
 * mit Grund im Pull Request. Wie bei Übungen: alle Inhalte prüfen (content:validate, Prettier, Typprüfung), dann
 * Pull Request – freigegeben ist erst nach dem MERGE durch einen Menschen.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import {
  CONTENT_STATUSES,
  type ContentIssue,
  type NutritionContentFile,
  type NutritionReleaseDecision,
  planNutritionRelease,
  planRecipeRelease,
  RECIPE_CATEGORIES,
  RECIPE_CATEGORY_IDS,
  recipeReleaseBlockerText,
} from '@fitnessapp/core';
import { z } from 'zod';

import { loadNutritionCatalog } from '../foods/catalog-loader';
import { loadNutritionContentFiles, NUTRITION_CONTENT_FOLDERS } from '../validate';
import { BASE_BRANCH, isoDateBerlin, REVIEW_BRANCH_PREFIX, zodMessage } from './config';
import { writeJsonFile } from './files';
import { commitPushAndOpenPr, PHONE_TEST_SECTION, runPrChecks } from './pull-request';
import { type ReviewDeps, reviewInputSchema, type ReviewResult } from './review';
import { ensureGitIdentity } from './tools';

/** Häkchen aus der Workflow-Eingabe (`true`/`false` als Text). */
const checkbox = z.enum(['true', 'false'], { error: 'Häkchen: „true“ oder „false“ erwartet.' });

const publishedOnly = (hint: string) =>
  z
    .enum(CONTENT_STATUSES, { error: 'Zielstatus: published, archived oder draft.' })
    .refine((status) => status === 'published', hint);

const releaseFields = {
  reviewer: reviewInputSchema.shape.reviewer,
  expertReviewed: checkbox.transform((value) => value === 'true'),
  confirmAssumptions: checkbox.transform((value) => value === 'true'),
};

export const recipeReleaseInputSchema = z.object({
  category: z.enum(RECIPE_CATEGORY_IDS, {
    error: `Kategorie wählen: ${RECIPE_CATEGORY_IDS.join(', ')}.`,
  }),
  status: publishedOnly(
    'Sammelfreigabe (Art „recipe“) nur mit Neuer Status = published. Zurückziehen oder zurück auf Entwurf: Art „ids“ mit einzelnen IDs.',
  ),
  ...releaseFields,
});
export type RecipeReleaseInput = z.input<typeof recipeReleaseInputSchema>;

export const nutritionIdsReleaseInputSchema = z.object({
  ids: reviewInputSchema.shape.ids,
  status: publishedOnly(
    'Rezepte, Meal-Prep-Pläne, Ratgeber, Austausch-Einträge und Packungsgrößen per ID nur mit Neuer Status = published (Zurückziehen folgt später, Plan 19.5).',
  ),
  ...releaseFields,
});
export type NutritionIdsReleaseInput = z.input<typeof nutritionIdsReleaseInputSchema>;

const KIND_LABEL: Record<NutritionReleaseDecision['kind'], string> = {
  recipe: 'Rezept',
  meal_prep_plan: 'Meal-Prep-Plan',
  guide: 'Ratgeber',
  ingredient_substitution: 'Austausch',
  package_size: 'Packungsgröße',
};

function fail(title: string, markdown: string): ReviewResult {
  return { exitCode: 1, markdown: `### ❌ content-review (${title})\n\n${markdown}\n` };
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function label(d: NutritionReleaseDecision): string {
  if (d.kind === 'ingredient_substitution') {
    const o = d.original;
    return `\`${o.id}\` ${cell(`${o.food_id} → ${o.substitute_food_id} (${o.role}, Faktor ${o.factor.toLocaleString('de-DE')})`)}`;
  }
  if (d.kind === 'package_size') {
    const o = d.original;
    return `\`${o.id}\` ${cell(`${o.food_id}: ${o.package_size_g.toLocaleString('de-DE')} g`)}`;
  }
  return `\`${d.original.id}\` ${cell(d.original.title_de)}`;
}

function skippedTable(skipped: readonly NutritionReleaseDecision[]): string[] {
  if (skipped.length === 0) {
    return ['Übersprungen: keine.'];
  }
  return [
    `#### Übersprungen (${skipped.length}) – bleiben unverändert`,
    '',
    '| Inhalt | Art | Grund |',
    '| --- | --- | --- |',
    ...skipped.map(
      (d) =>
        `| ${label(d)} | ${KIND_LABEL[d.kind]} | ${cell(d.blockers.map(recipeReleaseBlockerText).join(' · '))} |`,
    ),
  ];
}

/** Annahmen, die in diesem Lauf bestätigt werden (Wächter N2d K5: WAS bestätigt wurde, nicht nur die Anzahl). */
function confirmedNow(d: NutritionReleaseDecision): boolean {
  return (
    d.kind === 'recipe' &&
    (d.original.meta.import_assumptions?.length ?? 0) > 0 &&
    d.original.meta.import_assumptions_fingerprint !==
      d.released.meta.import_assumptions_fingerprint
  );
}

/**
 * Gelbe Befunde je freigegebenem Inhalt aus dem Prüfbericht NACH dem Schreiben (Wächter N2d S6) – damit R20H
 * (Haltbarkeit), R21H (Dosierungen), R11, R22 & Co. beim Merge direkt sichtbar sind, auch wenn die Gesamttabelle
 * gekürzt wird.
 */
function warningsList(
  released: readonly NutritionReleaseDecision[],
  issues: readonly ContentIssue[],
): string[] {
  const lines = released.flatMap((d) =>
    issues
      .filter(
        (issue) =>
          issue.severity === 'warning' && issue.kind === d.kind && issue.id === d.original.id,
      )
      .map((issue) => `- \`${d.original.id}\` ${cell(`${issue.rule}: ${issue.message}`)}`),
  );
  return lines.length === 0
    ? ['Gelbe Hinweise zu den freigegebenen Inhalten: keine.']
    : ['**Gelbe Hinweise zu den freigegebenen Inhalten** (bitte beim Merge lesen):', '', ...lines];
}

function releasedTable(released: readonly NutritionReleaseDecision[]): string[] {
  const rows = released.map((d) => {
    if (d.kind !== 'recipe') {
      return `| ${label(d)} | ${KIND_LABEL[d.kind]} | – | – |`;
    }
    const assumptions = d.original.meta.import_assumptions?.length ?? 0;
    const before = d.original.declared_pregnancy_caution;
    const after = d.released.declared_pregnancy_caution;
    return `| ${label(d)} | Rezept | ${
      assumptions === 0
        ? '–'
        : confirmedNow(d)
          ? `${assumptions} bestätigt`
          : `${assumptions} schon bestätigt`
    } | ${before === after ? (after ? 'ja' : 'nein') : `${before ? 'ja' : 'nein'} → **${after ? 'ja' : 'nein'}**`} |`;
  });
  const confirmations = released
    .filter(confirmedNow)
    .flatMap((d) =>
      d.kind === 'recipe'
        ? (d.original.meta.import_assumptions ?? []).map(
            (a) =>
              `- \`${d.original.id}\`, Zutat ${a.ingredient_index + 1} \`${a.food_id}\` durchgegart: ${a.reason_de}`,
          )
        : [],
    );
  return [
    `#### Freigegeben (${released.length})`,
    '',
    '| Inhalt | Art | Import-Annahmen | Schwangerschafts-Hinweis |',
    '| --- | --- | --- | --- |',
    ...rows,
    ...(confirmations.length > 0
      ? [
          '',
          '**Bestätigte Import-Annahmen** (bitte beim Merge gegen die Zubereitung lesen):',
          '',
          ...confirmations,
        ]
      : []),
  ];
}

interface LoadedNutrition {
  readonly files: NutritionContentFile[];
  readonly catalog: ReturnType<typeof loadNutritionCatalog>['catalog'];
}

/** Holt `main` und wechselt darauf (vor dem Klassifizieren und vor jedem Lesen der Inhalte, Wächter N2d K7). */
export function checkoutBaseBranch(deps: ReviewDeps): void {
  const { tools } = deps;
  ensureGitIdentity(tools);
  tools.git([
    'fetch',
    '--no-tags',
    'origin',
    `+refs/heads/${BASE_BRANCH}:refs/remotes/origin/${BASE_BRANCH}`,
  ]);
  tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
}

function checkoutBase(deps: ReviewDeps): LoadedNutrition {
  const { repoRoot } = deps;
  checkoutBaseBranch(deps);
  const contentDir = join(repoRoot, 'content');
  const catalog = loadNutritionCatalog(contentDir);
  const nutritionFiles = loadNutritionContentFiles(contentDir);
  return { files: [...catalog.files, ...nutritionFiles.files], catalog: catalog.catalog };
}

interface ReleaseRun {
  readonly title: string;
  readonly header: readonly string[];
  readonly decisions: readonly NutritionReleaseDecision[];
  readonly emptyText: string;
  readonly expertReviewed: boolean;
  readonly prTitle: (count: number) => string;
  readonly commitMessage: (count: number) => string;
}

/** Schreibt die freigegebenen Inhalte, prüft alles und öffnet den Pull Request (gemeinsam für beide Arten). */
async function finishRelease(run: ReleaseRun, deps: ReviewDeps): Promise<ReviewResult> {
  const { tools, repoRoot } = deps;
  const released = run.decisions.filter((d) => d.blockers.length === 0);
  const skipped = run.decisions.filter((d) => d.blockers.length > 0);

  if (released.length === 0) {
    return {
      exitCode: 0,
      markdown: [
        '### ⏭️ content-review: nichts freigegeben – kein Pull Request',
        '',
        ...run.header,
        ...(run.decisions.length === 0 ? [run.emptyText] : skippedTable(skipped)),
        '',
      ].join('\n'),
    };
  }

  const paths: string[] = [];
  for (const decision of released) {
    const path = `content/${NUTRITION_CONTENT_FOLDERS[decision.kind]}/${decision.original.id}.json`;
    await writeJsonFile(repoRoot, path, decision.released);
    paths.push(path);
  }
  const checks = await runPrChecks(repoRoot, paths, tools);
  const report = [
    ...run.header,
    ...releasedTable(released),
    '',
    ...warningsList(released, checks.report.result.issues),
    '',
    ...skippedTable(skipped),
    '',
    'Freigegeben wird erst mit dem **Merge** durch einen Menschen. Bestätigte Import-Annahmen heißen: Die Zutat wird laut Zubereitung durchgegart – deshalb wurde der Schwangerschafts-Hinweis neu berechnet (Spalte oben). Ändert später jemand die Zubereitung (Zutaten, Schritte, Tipp, Zeiten, Titel, Beschreibung, Geräte), gilt die Bestätigung nicht mehr (Fingerabdruck) und muss neu erfolgen.',
    run.expertReviewed
      ? ''
      : 'Ohne „fachlich geprüft“: für die Testphase in Ordnung. **Für den Livegang (ab N7) nur mit fachlicher Prüfung freigeben** (Gründer-Entscheidung 6).',
    '',
    checks.markdown,
  ].join('\n');

  if (!checks.ok) {
    tools.git(['reset', '--hard', `origin/${BASE_BRANCH}`]);
    return fail(run.title, ['Prüfung rot – **kein Pull Request**.', '', report].join('\n'));
  }

  const today = isoDateBerlin(deps.now());
  const short = deps.randomShort?.() ?? randomBytes(3).toString('hex');
  const branch = `${REVIEW_BRANCH_PREFIX}${today}-${short}`;
  tools.git(['checkout', '-b', branch]);
  const pr = commitPushAndOpenPr(tools, {
    branch,
    title: run.prTitle(released.length),
    body: [
      report,
      '',
      PHONE_TEST_SECTION,
      '',
      '---',
      'Automatisch erstellt von content-review. Dieser Workflow öffnet nur Pull Requests und genehmigt nie.',
    ].join('\n'),
    commitMessage: run.commitMessage(released.length),
    paths,
  });
  tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
  return {
    exitCode: 0,
    prUrl: pr.url,
    branch,
    markdown: [
      `### ✅ content-review: Pull Request ${pr.url}`,
      ...(pr.ciWarning ? ['', `⚠️ ${pr.ciWarning}`] : []),
      '',
      report,
      '',
    ].join('\n'),
  };
}

function checkboxLine(input: {
  reviewer: string;
  expertReviewed: boolean;
  confirmAssumptions: boolean;
  today: string;
}): string {
  return `Prüfer: **${input.reviewer}** · Datum: ${input.today} · fachlich geprüft: **${input.expertReviewed ? 'ja' : 'nein'}** · Import-Annahmen geprüft: **${input.confirmAssumptions ? 'ja' : 'nein'}**`;
}

const NO_CATALOG = [
  '',
  '⚠️ Noch kein Lebensmittel-Katalog im Repository (Workflow foods-import) – ohne ihn ist kein Rezept freigebbar.',
];

export async function runRecipeCategoryRelease(
  rawInput: unknown,
  deps: ReviewDeps,
): Promise<ReviewResult> {
  const parsed = recipeReleaseInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('Sammelfreigabe Rezepte', zodMessage(parsed.error));
  }
  const input = parsed.data;
  const loaded = checkoutBase(deps);
  const today = isoDateBerlin(deps.now());
  const categoryName =
    RECIPE_CATEGORIES.find((c) => c.id === input.category)?.name_de ?? input.category;
  const decisions = planRecipeRelease(
    loaded.files,
    loaded.catalog,
    (recipe) => (recipe.categories ?? []).includes(input.category),
    {
      reviewer: input.reviewer,
      date: today,
      expertReviewed: input.expertReviewed,
      confirmAssumptions: input.confirmAssumptions,
    },
  ).map((d): NutritionReleaseDecision => ({ kind: 'recipe', ...d }));
  const ready = decisions.filter((d) => d.blockers.length === 0).length;

  return finishRelease(
    {
      title: 'Sammelfreigabe Rezepte',
      header: [
        `## Sammelfreigabe Rezepte: Kategorie „${categoryName}“`,
        '',
        checkboxLine({ ...input, today }),
        '',
        `${decisions.length} Rezepte in der Kategorie · ${ready} werden freigegeben · ${decisions.length - ready} übersprungen.`,
        ...(loaded.catalog === undefined ? NO_CATALOG : []),
        '',
      ],
      decisions,
      emptyText: 'In dieser Kategorie gibt es (noch) keine Rezepte.',
      expertReviewed: input.expertReviewed,
      prTitle: (count) => `Sammelfreigabe Rezepte „${categoryName}“: ${count} Rezepte`,
      commitMessage: (count) =>
        `Sammelfreigabe Rezepte „${categoryName}“ durch ${input.reviewer}: ${count} Rezepte`,
    },
    deps,
  );
}

/**
 * Art „ids“ mit Ernährungs-Inhalten: Rezepte (auch ohne Kategorie), Meal-Prep-Pläne und Ratgeber per ID. Gleiche
 * Gründe und Häkchen wie die Sammelfreigabe. Lebensmittel, unbekannte oder mehrdeutige IDs → Abbruch ohne Änderung
 * (wie bei Übungen: lieber nichts als die Hälfte).
 */
export async function runNutritionIdRelease(
  rawInput: unknown,
  deps: ReviewDeps,
): Promise<ReviewResult> {
  const title = 'Freigabe Ernährung per ID';
  const parsed = nutritionIdsReleaseInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(title, zodMessage(parsed.error));
  }
  const input = parsed.data;
  const loaded = checkoutBase(deps);
  const today = isoDateBerlin(deps.now());
  const plan = planNutritionRelease(loaded.files, loaded.catalog, input.ids, {
    reviewer: input.reviewer,
    date: today,
    expertReviewed: input.expertReviewed,
    confirmAssumptions: input.confirmAssumptions,
  });
  const problems = [
    ...plan.foodIds.map(
      (id) =>
        `\`${id}\`: Lebensmittel werden nicht über Art „ids“ freigegeben – dafür gibt es Art „katalog“ (Katalog geprüft, R19).`,
    ),
    ...plan.unknownIds.map(
      (id) =>
        `\`${id}\`: nicht gefunden (weder Rezept, Meal-Prep-Plan, Ratgeber, Austausch-Eintrag noch Packungsgröße mit gültigem Schema – content:validate zeigt Schemafehler).`,
    ),
    ...plan.ambiguousIds.map(
      (id) => `\`${id}\`: mehrdeutig (mehrere Inhaltsarten mit dieser ID) – bitte umbenennen.`,
    ),
  ];
  if (problems.length > 0) {
    return fail(title, ['Nichts geändert:', ...problems.map((p) => `- ${p}`)].join('\n'));
  }
  const ready = plan.decisions.filter((d) => d.blockers.length === 0).length;
  const ids = plan.decisions.map((d) => d.original.id);
  const shortList = `${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ` und ${ids.length - 3} weitere` : ''}`;

  return finishRelease(
    {
      title,
      header: [
        '## Freigabe Ernährung per ID',
        '',
        checkboxLine({ ...input, today }),
        '',
        `${plan.decisions.length} Inhalte · ${ready} werden freigegeben · ${plan.decisions.length - ready} übersprungen.`,
        ...(loaded.catalog === undefined ? NO_CATALOG : []),
        '',
      ],
      decisions: plan.decisions,
      emptyText: 'Keine Inhalte ausgewählt.',
      expertReviewed: input.expertReviewed,
      prTitle: (count) => `Freigabe Ernährung: ${shortList} (${count} freigegeben)`,
      commitMessage: (count) =>
        `Freigabe Ernährung durch ${input.reviewer}: ${count} Inhalte (${ids.join(', ')})`,
    },
    deps,
  );
}
