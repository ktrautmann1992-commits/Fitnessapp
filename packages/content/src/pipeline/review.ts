/**
 * `content-review` (docs/PLAN-PHASE-2.md Abschnitte 4 Schritt 3 und 6): setzt den Status von Inhalten
 * (freigeben, zurückziehen, zurück auf Entwurf), trägt Prüfer und Datum ein, prüft ALLE Inhalte und öffnet
 * einen Pull Request. Merge = Freigabe durch einen Menschen; der Workflow genehmigt nie.
 *
 * Versionsregel: Hier ändern sich nur `status` und `meta` – der fachliche Inhalt bleibt gleich, die Version
 * bleibt also stehen (Etappe A, Entscheidung 4). Geänderte freigegebene Inhalte ohne höhere Version fängt
 * die Versionsprüfung von content:validate (Vergleich mit origin/main) ab.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTENT_STATUSES, type ContentFileKind, type ContentStatus } from '@fitnessapp/core';
import { z } from 'zod';

import { CONTENT_FOLDERS } from '../validate';
import { BASE_BRANCH, isoDateBerlin, REVIEW_BRANCH_PREFIX, zodMessage } from './config';
import { contentPath, writeJsonFile } from './files';
import { CONTENT_KINDS } from './kinds';
import { commitPushAndOpenPr, issuesFor, PHONE_TEST_SECTION, runPrChecks } from './pull-request';
import { ensureGitIdentity, type PipelineTools } from './tools';

const MAX_IDS = 100;

export const reviewInputSchema = z.object({
  ids: z
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
        .min(1, 'Mindestens eine ID angeben.')
        .max(MAX_IDS, `Höchstens ${MAX_IDS} IDs auf einmal.`),
    ),
  status: z.enum(CONTENT_STATUSES, { error: 'Zielstatus: published, archived oder draft.' }),
  reviewer: z
    .string()
    .trim()
    .min(2, 'Prüfer: Name oder Kürzel angeben (mindestens 2 Zeichen).')
    .max(100, 'Prüfer: höchstens 100 Zeichen.')
    .regex(/^[^\n\r\t]+$/, 'Prüfer: keine Zeilenumbrüche.'),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export interface ReviewDeps {
  readonly repoRoot: string;
  readonly tools: PipelineTools;
  readonly now: () => Date;
  readonly randomShort?: () => string;
}

export interface ReviewResult {
  readonly exitCode: number;
  readonly markdown: string;
  readonly prUrl?: string;
  readonly branch?: string;
}

const ACTION_DE: Record<ContentStatus, string> = {
  published: 'Freigabe',
  archived: 'Zurückziehen',
  draft: 'Zurück auf Entwurf',
};

interface Located {
  readonly id: string;
  readonly kind: ContentFileKind;
  readonly path: string;
}

function locate(repoRoot: string, id: string): Located[] {
  return (Object.keys(CONTENT_FOLDERS) as ContentFileKind[])
    .map((kind) => ({ id, kind, path: contentPath(kind, id) }))
    .filter((item) => {
      try {
        readFileSync(join(repoRoot, item.path));
        return true;
      } catch {
        return false;
      }
    });
}

function fail(markdown: string): ReviewResult {
  return { exitCode: 1, markdown: `### ❌ content-review\n\n${markdown}\n` };
}

export async function runReview(rawInput: unknown, deps: ReviewDeps): Promise<ReviewResult> {
  const parsedInput = reviewInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return fail(zodMessage(parsedInput.error));
  }
  const input = parsedInput.data;
  const { tools, repoRoot } = deps;
  ensureGitIdentity(tools);
  tools.git([
    'fetch',
    '--no-tags',
    'origin',
    `+refs/heads/${BASE_BRANCH}:refs/remotes/origin/${BASE_BRANCH}`,
  ]);
  tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);

  const today = isoDateBerlin(deps.now());
  const problems: string[] = [];
  const changes: { located: Located; from: ContentStatus; data: Record<string, unknown> }[] = [];
  const unchanged: string[] = [];

  for (const id of input.ids) {
    const found = locate(repoRoot, id);
    if (found.length === 0) {
      problems.push(`\`${id}\`: nicht gefunden (weder Übung noch Plan-Vorlage).`);
      continue;
    }
    if (found.length > 1) {
      problems.push(`\`${id}\`: mehrdeutig (Übung und Plan-Vorlage) – bitte einzeln umbenennen.`);
      continue;
    }
    const located = found[0]!;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(join(repoRoot, located.path), 'utf8')) as Record<
        string,
        unknown
      >;
    } catch (error) {
      problems.push(`\`${id}\`: Datei ist kein gültiges JSON (${(error as Error).message}).`);
      continue;
    }
    const parsed = CONTENT_KINDS[located.kind].contentSchema.safeParse(data);
    if (!parsed.success) {
      problems.push(`\`${id}\`: Schema-Fehler (Ü1) – ${zodMessage(parsed.error)}`);
      continue;
    }
    const from = data.status as ContentStatus;
    if (from === input.status) {
      unchanged.push(id);
      continue;
    }
    const meta = { ...(data.meta as Record<string, unknown>) };
    if (input.status === 'draft') {
      meta.reviewed_by = null;
      meta.reviewed_at = null;
    } else {
      meta.reviewed_by = input.reviewer;
      meta.reviewed_at = today;
    }
    changes.push({ located, from, data: { ...data, status: input.status, meta } });
  }

  if (problems.length > 0) {
    return fail(['Nichts geändert:', ...problems.map((problem) => `- ${problem}`)].join('\n'));
  }
  if (changes.length === 0) {
    return {
      exitCode: 0,
      markdown: `### ⏭️ content-review: nichts zu tun\n\nAlle IDs haben schon den Status „${input.status}“: ${unchanged.join(', ')}.\n`,
    };
  }

  for (const change of changes) {
    await writeJsonFile(repoRoot, change.located.path, change.data);
  }
  const paths = changes.map((change) => change.located.path);
  const checks = await runPrChecks(repoRoot, paths, tools);
  const ids = new Set(changes.map((change) => change.located.id));
  const rows = changes.map((change) => {
    const issues = issuesFor(checks.report, new Set([change.located.id]));
    const red = issues.filter((issue) => issue.severity === 'error').length;
    const yellow = issues.length - red;
    return `| \`${change.located.id}\` | ${CONTENT_KINDS[change.located.kind].labelDe} | ${change.from} → **${input.status}** | ${red > 0 ? `🔴 ${red} ` : ''}${yellow > 0 ? `🟡 ${yellow}` : ''}${issues.length === 0 ? '✅' : ''} |`;
  });
  const report = [
    `## ${ACTION_DE[input.status]}: ${changes.length} Inhalte`,
    '',
    `Prüfer: **${input.reviewer}** · Datum: ${today}`,
    '',
    '| ID | Art | Status | Prüfung |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    ...(unchanged.length > 0
      ? [`Schon im Zielstatus (unverändert): ${unchanged.join(', ')}`, '']
      : []),
    input.status === 'published'
      ? 'Freigegeben wird erst mit dem **Merge** durch einen Menschen. Danach spielt content-seed die Inhalte ein. Vor dem öffentlichen Start zusätzlich fachlich prüfen lassen (`expert_reviewed`).'
      : 'Wirksam erst mit dem **Merge**. Zurückgezogene Inhalte bleiben in der Datenbank als „archived“ erhalten.',
    '',
    checks.markdown,
  ].join('\n');

  if (!checks.ok) {
    tools.git(['reset', '--hard', `origin/${BASE_BRANCH}`]);
    return fail(
      [
        'Prüfung rot – **kein Pull Request**. Häufigster Grund: Eine Vorlage soll freigegeben werden, nutzt aber Übungen, die noch Entwurf sind (V3). Dann die Übungen in denselben Lauf aufnehmen.',
        '',
        report,
      ].join('\n'),
    );
  }

  const short = deps.randomShort?.() ?? randomBytes(3).toString('hex');
  const branch = `${REVIEW_BRANCH_PREFIX}${today}-${short}`;
  tools.git(['checkout', '-b', branch]);
  const title = `${ACTION_DE[input.status]}: ${[...ids].slice(0, 3).join(', ')}${ids.size > 3 ? ` und ${ids.size - 3} weitere` : ''}`;
  const pr = commitPushAndOpenPr(tools, {
    branch,
    title,
    body: [
      report,
      '',
      PHONE_TEST_SECTION,
      '',
      '---',
      'Automatisch erstellt von content-review. Dieser Workflow öffnet nur Pull Requests und genehmigt nie.',
    ].join('\n'),
    commitMessage: `${ACTION_DE[input.status]} durch ${input.reviewer}: ${[...ids].join(', ')}`,
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
