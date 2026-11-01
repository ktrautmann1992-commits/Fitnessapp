/**
 * Ablauf von `content:import-alpha5` (docs/PLAN-PHASE-5.md 19.2, Etappe N2c) mit Dateien:
 * Gründer-Datei lesen → Katalog `content/foods/` lesen (nur lesen, S3) → `importAlpha5` → Bericht.
 *
 * Modi:
 * - `bericht` (Standard): nichts schreiben, nur Bericht (auch lokal in einer Claude-Sitzung).
 * - `schreiben`: Dateien unter `content/recipes|meal-prep-plans|guides/` schreiben (Prettier-Format).
 * - `pull-request` (Workflow `alpha5-import`, nur auf `main`): schreiben, `content:validate`, Commit über die
 *   GitHub-API auf `alpha5-import/<Lauf-ID>`, Pull Request mit Bericht, `ci` starten. Nie direkt in die Datenbank
 *   (KONZEPT 3: Repository → Datenbank, Entwürfe nie in Supabase).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type ContentIssue, type NutritionContentFile, validateContent } from '@fitnessapp/core';

import {
  blockingCount,
  coverageMarkdown,
  formatMarkdownSummary,
  loadNutritionContentFiles,
  validateRepository,
} from '../validate';
import { loadNutritionCatalog } from '../foods/catalog-loader';
import { ALPHA5_SEED_PATH } from '../foods/foods-import';
import {
  type CommitFile,
  createVerifiedCommit,
  dispatchWorkflow,
  type GitHubApi,
  openPullRequest,
  openPullRequestsWithPrefix,
} from '../foods/github-api';
import { formatJson } from '../pipeline/files';
import { PHONE_TEST_SECTION, truncateBody } from '../pipeline/pull-request';
import {
  ALPHA5_TOLERANCE_NOTE,
  type Alpha5ImportOutput,
  type Alpha5ImportReport,
  Alpha5InputError,
  type ExistingFiles,
  GUIDES_DIR,
  importAlpha5,
  MEAL_PREP_PLANS_DIR,
  parseAlpha5File,
  RECIPES_DIR,
} from './alpha5';
import {
  APP_SELECTION_PATH,
  type AppSelection,
  parseAppSelection,
  RECIPE_PHOTO_DIR,
} from './app-selection';

export const ALPHA5_IMPORT_BRANCH_PREFIX = 'alpha5-import/';
/** Regeln, die ohne Lebensmittel-Katalog aussagekräftig sind (Strukturprüfung im Bericht). */
export const STRUCTURE_RULES: readonly string[] = ['R1', 'R10', 'R14', 'R22'];
/** Erlaubte Zielordner – alles andere (v. a. `content/foods/`, `content/sources/`) ist verboten (S3). */
export const ALPHA5_TARGET_DIRS = [RECIPES_DIR, MEAL_PREP_PLANS_DIR, GUIDES_DIR] as const;
export const ALPHA5_MODES = ['bericht', 'schreiben', 'pull-request'] as const;
export type Alpha5Mode = (typeof ALPHA5_MODES)[number];

export interface Alpha5RunDeps {
  readonly repoRoot: string;
  readonly runId: string;
  /** Branch, auf dem der Workflow läuft – Modus `pull-request` nur auf `main`. */
  readonly refName: string;
  /** Commit, aus dem gerechnet wurde (`GITHUB_SHA`) – Basis des Import-Commits (Wächter N2c, S4). */
  readonly baseSha?: string;
  readonly api?: GitHubApi;
}

export interface Alpha5RunResult {
  readonly exitCode: number;
  readonly markdown: string;
  readonly prUrl?: string;
  /** Geschriebene bzw. für den Commit geplante Pfade. */
  readonly paths: readonly string[];
}

function existingFiles(contentDir: string): ExistingFiles {
  const loaded = loadNutritionContentFiles(contentDir);
  const maps = {
    recipe: new Map<string, unknown>(),
    meal_prep_plan: new Map<string, unknown>(),
    guide: new Map<string, unknown>(),
  };
  for (const file of loaded.files) {
    const id = file.fileName.replace(/\.json$/, '');
    // Nicht lesbare Datei: null → gilt als geschützt, wird nie überschrieben.
    maps[file.kind as keyof typeof maps].set(id, file.jsonError === undefined ? file.data : null);
  }
  return maps;
}

/** Prüft die gebauten Inhalte (auch nicht geschriebene) mit den Regeln aus packages/core – für den Bericht. */
export function validateBuilt(
  output: Alpha5ImportOutput,
  contentDir: string,
): { issues: readonly ContentIssue[]; markdown: string } {
  const catalog = loadNutritionCatalog(contentDir);
  const files: NutritionContentFile[] = [
    ...catalog.files,
    ...output.built.recipes.map((data): NutritionContentFile => ({
      kind: 'recipe',
      fileName: `${data.id}.json`,
      data,
    })),
    ...output.built.mealPrepPlans.map((data): NutritionContentFile => ({
      kind: 'meal_prep_plan',
      fileName: `${data.id}.json`,
      data,
    })),
    ...output.built.guides.map((data): NutritionContentFile => ({
      kind: 'guide',
      fileName: `${data.id}.json`,
      data,
    })),
  ];
  const result = validateContent(
    files,
    catalog.catalog === undefined ? {} : { nutritionCatalog: catalog.catalog },
  );
  const own = result.issues.filter((i) => i.kind !== 'food');
  const byRule = new Map<string, { red: number; yellow: number }>();
  for (const issue of own) {
    const entry = byRule.get(issue.rule) ?? { red: 0, yellow: 0 };
    if (issue.severity === 'error') entry.red += 1;
    else entry.yellow += 1;
    byRule.set(issue.rule, entry);
  }
  const red = own.filter((i) => i.severity === 'error').length;
  const yellow = own.length - red;
  const r20 = own.filter((i) => i.rule === 'R20' || i.rule === 'R20H');
  const guideIssues = own.filter((i) => i.kind === 'guide');

  // Strukturprüfung der Rezepte, deren Lebensmittel noch fehlen: nur Regeln, die ohne Katalog gelten.
  const structure = validateContent(
    output.built.structureOnly.map((data): NutritionContentFile => ({
      kind: 'recipe',
      fileName: `${data.id}.json`,
      data,
    })),
  ).issues.filter((i) => STRUCTURE_RULES.includes(i.rule));
  const structureRed = structure.filter((i) => i.severity === 'error');
  const lines = [
    `#### Prüfung der umgewandelten Inhalte (Regeln R1–R22, mit dem aktuellen Katalog)`,
    '',
    `Gebaut: ${output.built.recipes.length} Rezepte, ${output.built.mealPrepPlans.length} Meal-Prep-Pläne, ${output.built.guides.length} Ratgeber · **${red} rot, ${yellow} gelb** (Entwürfe: rot blockiert nicht, die Rezepte sind dann im Testmodus nicht sichtbar).`,
    '',
    ...(byRule.size > 0
      ? [
          '| Regel | rot | gelb |',
          '| --- | ---: | ---: |',
          ...[...byRule.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
            .map(([rule, n]) => `| ${rule} | ${n.red} | ${n.yellow} |`),
          '',
        ]
      : []),
    ...(guideIssues.length > 0
      ? [
          '#### Ratgeber (R21)',
          '',
          ...list(
            guideIssues,
            (i) =>
              `${i.severity === 'error' ? '🔴' : '🟡'} ${i.rule} \`${i.id}\`${i.path ? ` (${i.path})` : ''}: ${i.message}`,
          ),
          '',
        ]
      : []),
    ...(r20.length > 0
      ? [
          '#### Haltbarkeit der Meal-Prep-Pläne (R20)',
          '',
          ...r20.map(
            (i) =>
              `- ${i.severity === 'error' ? '🔴' : '🟡'} \`${i.id}\`${i.path ? ` (${i.path})` : ''}: ${i.message}`,
          ),
          '',
        ]
      : []),
    ...(output.built.structureOnly.length > 0
      ? [
          `#### Strukturprüfung ohne Katalog (${output.built.structureOnly.length} Rezepte, Regeln ${STRUCTURE_RULES.join(', ')})`,
          '',
          `Diese Rezepte werden erst geschrieben, wenn alle Zutaten im Katalog sind. Schon jetzt prüfbar: **${structureRed.length} rot, ${structure.length - structureRed.length} gelb**.`,
          '',
          ...list(
            structure,
            (i) =>
              `${i.severity === 'error' ? '🔴' : '🟡'} ${i.rule} \`${i.id}\`${i.path ? ` (${i.path})` : ''}: ${i.message}`,
            80,
          ),
          '',
        ]
      : []),
    ...coverageMarkdown(result),
  ];
  return { issues: [...own, ...structure], markdown: lines.join('\n') };
}

function pct(value: number): string {
  return `${(value * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

const FIELD_DE = {
  kcal: 'kcal',
  protein_g: 'Eiweiß',
  carbs_g: 'Kohlenhydrate',
  fat_g: 'Fett',
} as const;

function list<T>(items: readonly T[], render: (item: T) => string, max = 60): string[] {
  return [
    ...items.slice(0, max).map((item) => `- ${render(item)}`),
    ...(items.length > max ? [`- … und ${items.length - max} weitere`] : []),
  ];
}

/** Abschnitt „App-Auswahl“ des Berichts (Gründer-Entscheidung 24.10.2026). */
function selectionMarkdown(report: Alpha5ImportReport): string[] {
  const s = report.selection;
  if (s === null) {
    return [
      `#### App-Auswahl`,
      '',
      `⚠️ \`${APP_SELECTION_PATH}\` fehlt – **alle** Rezepte der Datei kommen in die App.`,
      '',
    ];
  }
  const published = s.repoOutside.filter((o) => o.status === 'published');
  return [
    `#### App-Auswahl (${s.entschieden})`,
    '',
    `In der App: **${s.inApp} von ${report.counts.recipes} Rezepten** · **nur im Buch: ${s.bookOnly}** · Meal-Prep-Pläne in der App: ${s.plansInApp.join(', ') || '–'} · nur im Buch: ${s.plansBookOnly.join(', ') || '–'}.`,
    ...(s.versionMismatch
      ? [
          '',
          `⚠️ Die Auswahl gilt für \`${s.quelle}\`, die Datei ist Fassung ${report.version} – neue Rezepte bleiben nur im Buch, bis die Auswahl neu entschieden ist.`,
        ]
      : []),
    '',
    ...(s.repoOutside.length > 0
      ? [
          `Schon im Repository, jetzt aber nur im Buch (${s.repoOutside.length}, davon ${published.length} veröffentlicht) – **nicht gelöscht**. Veröffentlichte bitte über den Workflow \`content-review\` mit Status \`archived\` zurückziehen:`,
          ...list(s.repoOutside, (o) => `\`${o.id}\` (${o.kind}, ${o.status})`, 40),
          '',
        ]
      : []),
  ];
}

/** Import-Bericht als Markdown (CI-Zusammenfassung und PR-Text, Plan 19.2). */
export function formatAlpha5Report(report: Alpha5ImportReport): string {
  const c = report.counts;
  const soll = '(Soll 306/267/4/4)';
  const recipeDev = report.deviations.filter((d) => d.scope === 'recipe');
  const ingredientDev = report.deviations.filter((d) => d.scope === 'ingredient');
  const units = report.zeroAmounts;
  return [
    `### Rezept-Import alpha5-rezepte.json (Fassung ${report.version}, Stand ${report.stand})`,
    '',
    `In der Datei: **${c.recipes} Rezepte, ${c.ingredients} Zutaten, ${c.mealPrepPlans} Meal-Prep-Pläne, ${c.guides} Ratgeber** ${soll}.`,
    '',
    ...(report.catalogMissing
      ? [
          '> ⚠️ **Katalog fehlt:** `content/foods/` ist leer. Ohne Katalog lassen sich Allergene, Schwangerschafts-Hinweis, `heated` und Nährwerte nicht berechnen – es wird **nichts geschrieben** und keine Werte werden erfunden. Erst `foods-import` (docs/SETUP.md Teil J), dann diesen Import erneut starten.',
          '',
        ]
      : []),
    `Gebaut: ${report.built.recipes} Rezepte, ${report.built.mealPrepPlans} Meal-Prep-Pläne, ${report.built.guides} Ratgeber · Dateien: ${report.written.new} neu, ${report.written.updated} aktualisiert, ${report.written.unchanged} unverändert.`,
    '',
    `#### Zutaten im Katalog`,
    '',
    report.missingFoods.length === 0
      ? `Alle ${c.ingredients} Zutaten sind im Katalog.`
      : `${c.ingredients - report.missingFoods.length} von ${c.ingredients} im Katalog, **${report.missingFoods.length} fehlen** (Rezepte damit werden nicht importiert): ${report.missingFoods.slice(0, 40).join(', ')}${report.missingFoods.length > 40 ? ' …' : ''}`,
    '',
    ...(report.notImported.length > 0 && !report.catalogMissing
      ? [
          `#### Nicht importiert (${report.notImported.length})`,
          '',
          ...list(report.notImported, (s) => `\`${s.id}\`: ${s.reason}`, 30),
          '',
        ]
      : []),
    ...(report.catalogMissing
      ? [
          `#### Nährwerte, Ernährungsform/Schwein, \`heated\``,
          '',
          '**Nicht prüfbar – Katalog fehlt.** Abweichungen > 3 %, Ernährungsform/Schwein und `heated` werden erst mit dem Lebensmittel-Katalog berechnet.',
          '',
        ]
      : [
          `#### Abweichungen Nährwerte ${ALPHA5_TOLERANCE_NOTE} (maßgeblich sind die berechneten Werte)`,
          '',
          `Rezepte je Portion: ${recipeDev.length} Abweichungen${report.notComputable.length > 0 ? ` · nicht vollständig berechenbar (Einheit fehlt im Katalog): ${report.notComputable.length}` : ''}`,
          ...list(
            recipeDev,
            (d) =>
              `\`${d.id}\` ${FIELD_DE[d.field]}: Datei ${d.file}, berechnet ${Math.round(d.source * 10) / 10} (${pct(d.relative)})`,
            40,
          ),
          '',
          `Zutaten je 100 g: ${ingredientDev.length} Abweichungen`,
          ...list(
            ingredientDev,
            (d) =>
              `\`${d.id}\` ${FIELD_DE[d.field]}: Datei ${d.file}, Quelle ${d.source} (${pct(d.relative)})${d.level === 'review' ? ' – **Zuordnung prüfen**' : ''}`,
            40,
          ),
          '',
          `#### Ernährungsform und Schwein (Datei ↔ berechnet)`,
          '',
          `${report.dietMismatches.length} Abweichungen Ernährungsform, ${report.porkMismatches.length} Abweichungen Schwein.`,
          ...list(
            report.dietMismatches,
            (m) => `\`${m.id}\`: Datei ${m.file}, berechnet ${m.computed}`,
            30,
          ),
          ...list(
            report.porkMismatches,
            (m) =>
              `\`${m.id}\`: Datei ${m.file ? 'mit' : 'ohne'} Schwein, berechnet ${m.computed ? 'mit' : 'ohne'}`,
            30,
          ),
          '',
        ]),
    `#### Umgewandelte Mengen \`menge_g: 0\``,
    '',
    `Prise ${units.pinch} · TL ${units.tsp} · EL ${units.tbsp} · ml ${units.ml} · Stück ${units.piece} (TL/EL/ml/Stück brauchen eine Umrechnung im Katalog, sonst R2).`,
    '',
    ...(report.catalogMissing
      ? []
      : [
          `#### \`heated\` (Vorgabe false = sichere Richtung)`,
          '',
          `${report.heatedFalseCount} Zutaten mit \`heated: false\` (→ Schwangerschafts-Hinweis), ${report.heatedAssumptions.length} Annahmen „durchgegart“ (\`heated: true\`; bis zur Bestätigung zählen sie für die Schwangerschaft wie false) – bei der Freigabe bestätigen (\`meta.import_assumptions_confirmed_by\`):`,
          ...list(
            report.heatedAssumptions,
            (a) => `\`${a.id}\` · \`${a.assumption.food_id}\`: ${a.assumption.reason_de}`,
            40,
          ),
          '',
        ]),
    ...(report.handEdited.length > 0
      ? [
          `#### Von Hand geändert, nicht überschrieben (${report.handEdited.length})`,
          '',
          ...list(report.handEdited, (s) => `\`${s.id}\`: ${s.reason}`),
          '',
        ]
      : []),
    ...(report.protectedFiles.length > 0
      ? [
          `#### Geschützt (${report.protectedFiles.length})`,
          '',
          ...list(report.protectedFiles, (s) => `\`${s.id}\`: ${s.reason}`),
          '',
        ]
      : []),
    ...(report.removedIds.length > 0
      ? [
          `#### Nicht mehr in der Datei – nicht gelöscht (${report.removedIds.length})`,
          '',
          ...list(report.removedIds, (s) => `\`${s.id}\` (${s.kind})`),
          '',
        ]
      : []),
    ...selectionMarkdown(report),
    `#### Abdeckung laut Datei${report.selection === null ? '' : ' (nur Rezepte der App)'} (Hinweis an die Gründer, K9)`,
    '',
    `${report.fileCoverage.meatOnly} Rezepte nur „mit Fleisch“ (inkl. Schwein; 5.4 sah höchstens 5 vor) · ${pct(report.fileCoverage.vegetarianShare)} vegetarisch/vegan (5.4: mindestens 2/3). Nur gelb, kein Hindernis.`,
    '',
  ].join('\n');
}

export async function runAlpha5Import(
  mode: Alpha5Mode,
  deps: Alpha5RunDeps,
): Promise<Alpha5RunResult> {
  const contentDir = join(deps.repoRoot, 'content');
  const seedPath = join(deps.repoRoot, ALPHA5_SEED_PATH);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(seedPath, 'utf8'));
  } catch (error) {
    return {
      exitCode: 1,
      markdown: `### ❌ ${ALPHA5_SEED_PATH} nicht lesbar\n\n${(error as Error).message}\n`,
      paths: [],
    };
  }

  // App-Auswahl (Gründer 24.10.2026): fehlt die Datei, gilt die ganze Gründer-Datei (Hinweis im Bericht).
  const selectionPath = join(deps.repoRoot, APP_SELECTION_PATH);
  let selection: AppSelection | undefined;
  if (existsSync(selectionPath)) {
    try {
      selection = parseAppSelection(
        JSON.parse(readFileSync(selectionPath, 'utf8')),
        parseAlpha5File(data),
      );
    } catch (error) {
      return {
        exitCode: 1,
        markdown: `### ❌ Import abgebrochen\n\n${(error as Error).message}\n`,
        paths: [],
      };
    }
    // Liegen die Rezeptfotos im Repository, muss jedes Foto der Auswahl da sein.
    const photoDir = join(deps.repoRoot, RECIPE_PHOTO_DIR);
    if (existsSync(photoDir)) {
      const present = new Set(readdirSync(photoDir));
      const missing = Object.values(selection.fotos.dateien).filter((f) => !present.has(f));
      if (missing.length > 0) {
        return {
          exitCode: 1,
          markdown: `### ❌ Import abgebrochen\n\nFotos fehlen in \`${RECIPE_PHOTO_DIR}\`: ${missing.join(', ')}\n`,
          paths: [],
        };
      }
    }
  }

  // Katalog nur LESEN (S3). Nur schema-gültige Lebensmittel zählen.
  const catalog = loadNutritionCatalog(contentDir);
  const foods = new Map(
    validateContent(
      catalog.files,
      catalog.catalog === undefined ? {} : { nutritionCatalog: catalog.catalog },
    ).foods.map((food) => [food.id, food]),
  );

  let output: Alpha5ImportOutput;
  try {
    output = importAlpha5({
      data,
      foods,
      existing: existingFiles(contentDir),
      ...(selection === undefined ? {} : { selection }),
    });
  } catch (error) {
    if (error instanceof Alpha5InputError) {
      return {
        exitCode: 1,
        markdown: `### ❌ Import abgebrochen\n\n${error.message}\n`,
        paths: [],
      };
    }
    throw error;
  }

  for (const write of output.writes) {
    if (!ALPHA5_TARGET_DIRS.some((dir) => write.path.startsWith(`${dir}/`))) {
      throw new Error(
        `Interner Fehler: Import will außerhalb der Zielordner schreiben (${write.path}).`,
      );
    }
  }

  const files: CommitFile[] = [];
  for (const write of output.writes) {
    files.push({
      path: write.path,
      content: Buffer.from(await formatJson(deps.repoRoot, write.path, write.content)),
    });
  }
  const validation = validateBuilt(output, contentDir);
  const reportMd = [formatAlpha5Report(output.report), validation.markdown].join('\n');
  const paths = files.map((f) => f.path);

  if (mode === 'bericht') {
    return {
      exitCode: 0,
      markdown: `${reportMd}\n**Modus „bericht“: nichts geschrieben** (${files.length} Dateien wären neu bzw. geändert).\n`,
      paths,
    };
  }
  if (files.length === 0) {
    return {
      exitCode: 0,
      markdown: `${reportMd}\n**Keine Änderungen – nichts geschrieben.**\n`,
      paths,
    };
  }
  if (mode === 'pull-request' && deps.api !== undefined) {
    // Kein zweiter, konkurrierender Import-PR (Wächter N2c, S4).
    const open = await openPullRequestsWithPrefix(deps.api, ALPHA5_IMPORT_BRANCH_PREFIX);
    if (open.length > 0) {
      return {
        exitCode: 1,
        markdown: `${reportMd}\n❌ Es gibt schon einen offenen Import-Pull-Request (${open.map((p) => p.url).join(', ')}) – erst mergen oder schließen, dann neu starten.\n`,
        paths,
      };
    }
  }
  if (mode === 'pull-request' && deps.refName !== 'main') {
    return {
      exitCode: 1,
      markdown: `${reportMd}\n❌ Modus „pull-request“ nur auf dem Branch main (gestartet auf ${deps.refName}).\n`,
      paths,
    };
  }
  for (const file of files) {
    const full = join(deps.repoRoot, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content as Buffer);
  }
  if (mode === 'schreiben') {
    return {
      exitCode: 0,
      markdown: `${reportMd}\n**${files.length} Dateien geschrieben.**\n`,
      paths,
    };
  }

  // Modus pull-request: erst prüfen (Schema-/Dateifehler blockieren), dann verifizierter Commit + PR.
  const repoValidation = validateRepository({ cwd: deps.repoRoot });
  if (blockingCount(repoValidation) > 0) {
    return {
      exitCode: 1,
      markdown: `${reportMd}\n❌ content:validate meldet blockierende Fehler – kein Pull Request.\n\n${formatMarkdownSummary(repoValidation)}`,
      paths,
    };
  }
  if (deps.api === undefined) {
    return {
      exitCode: 1,
      markdown: `${reportMd}\n❌ Kein GITHUB_TOKEN – kein Commit möglich.\n`,
      paths,
    };
  }
  const branch = `${ALPHA5_IMPORT_BRANCH_PREFIX}${deps.runId}`;
  if (deps.baseSha === undefined) {
    return {
      exitCode: 1,
      markdown: `${reportMd}\n❌ Kein GITHUB_SHA – Basis des Commits unbekannt.\n`,
      paths,
    };
  }
  await createVerifiedCommit(deps.api, {
    base: 'main',
    expectedBaseSha: deps.baseSha,
    branch,
    message: `Rezepte aus alpha5-rezepte.json ${output.report.version} als Entwurf (alpha5-import #${deps.runId})`,
    files,
  });
  const body = truncateBody(
    [
      `Automatischer Import der Gründer-Datei \`${ALPHA5_SEED_PATH}\` (Workflow \`alpha5-import\`, Lauf ${deps.runId}). Alle Inhalte sind **Entwürfe** (\`draft\`); Nährwerte, Allergene und Schwangerschafts-Hinweis berechnet der Core aus dem Katalog (docs/PLAN-PHASE-5.md 19.2). Keine Datei unter \`content/foods/\` oder \`content/sources/\`.`,
      '',
      reportMd,
      '',
      PHONE_TEST_SECTION,
      '',
      '**Danach:** Entwürfe fachlich prüfen und freigeben (Sammelfreigabe je Kategorie ab Etappe N2d). Annahmen „erhitzt“ bei der Freigabe bestätigen.',
    ].join('\n'),
  );
  const prUrl = await openPullRequest(deps.api, {
    base: 'main',
    branch,
    title: `Rezepte als Entwurf: alpha5-rezepte.json ${output.report.version} (alpha5-import #${deps.runId})`,
    body,
  });
  let ciNote: string;
  try {
    await dispatchWorkflow(deps.api, 'ci.yml', branch);
    ciNote = 'ci gestartet.';
  } catch (error) {
    ciNote = `ci konnte nicht gestartet werden (${(error as Error).message}) – bitte Actions → ci → Run workflow, Branch ${branch}.`;
  }
  return {
    exitCode: 0,
    markdown: `${reportMd}\n**Pull Request:** ${prUrl}\n\n${ciNote}\n`,
    prUrl,
    paths,
  };
}
