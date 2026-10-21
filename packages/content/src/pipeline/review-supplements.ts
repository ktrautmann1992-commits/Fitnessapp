/**
 * `content-review` für Supplement-Inhalte (docs/PLAN-PHASE-6.md 6 und 7, Etappe SU3): Art „ids“ mit Supplement-IDs
 * (z. B. „creatine, protein_powder“) oder dem Stichwort „supplemente“ (alle Supplemente im Entwurf). Gleiche Logik wie
 * Ernährungs-Inhalte per ID: Gesetzt wird `published` mit Prüfer und Datum nur für Entwürfe ohne roten Befund im Stand
 * danach (SK1–SK7, `planSupplementRelease` aus packages/core); Häkchen „fachlich geprüft“ setzt
 * `meta.expert_reviewed`. Dann alle Inhalte prüfen (content:validate, Prettier, Typprüfung) und Pull Request öffnen –
 * freigegeben ist erst nach dem MERGE durch einen Menschen. Unbekannte IDs → Abbruch ohne Änderung.
 * Supplement-IDs haben einen Unterstrich (SUPPLEMENT_IDS) – deshalb ein eigenes Eingabe-Schema.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import {
  CONTENT_STATUSES,
  planSupplementRelease,
  type SupplementReleaseDecision,
  supplementReleaseBlockerText,
} from '@fitnessapp/core';
import { z } from 'zod';

import { loadSupplementContentFiles, SUPPLEMENT_CONTENT_FOLDERS } from '../validate';
import { BASE_BRANCH, isoDateBerlin, REVIEW_BRANCH_PREFIX, zodMessage } from './config';
import { writeJsonFile } from './files';
import { commitPushAndOpenPr, PHONE_TEST_SECTION, runPrChecks } from './pull-request';
import { type ReviewDeps, reviewInputSchema, type ReviewResult } from './review';
import { checkoutBaseBranch } from './review-recipes';

/** Stichwort in „ids“: alle Supplemente im Status „draft“. */
export const ALL_SUPPLEMENTS_KEYWORD = 'supplemente';

const MAX_IDS = 50;

export const supplementIdsReleaseInputSchema = z.object({
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
              /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
              'Supplement-IDs: nur Kleinbuchstaben, Ziffern und Unterstriche (z. B. „protein_powder“).',
            ),
        )
        .min(1, 'Mindestens eine ID angeben.')
        .max(MAX_IDS, `Höchstens ${MAX_IDS} IDs auf einmal.`),
    ),
  status: z
    .enum(CONTENT_STATUSES, { error: 'Zielstatus: published, archived oder draft.' })
    .refine(
      (status) => status === 'published',
      'Supplemente per ID nur mit Neuer Status = published (Zurückziehen folgt später, wie bei Ernährungs-Inhalten).',
    ),
  reviewer: reviewInputSchema.shape.reviewer,
  expertReviewed: z
    .enum(['true', 'false'], { error: 'Häkchen: „true“ oder „false“ erwartet.' })
    .transform((value) => value === 'true'),
});
export type SupplementIdsReleaseInput = z.input<typeof supplementIdsReleaseInputSchema>;

const TITLE = 'Freigabe Supplemente per ID';

function fail(markdown: string): ReviewResult {
  return { exitCode: 1, markdown: `### ❌ content-review (${TITLE})\n\n${markdown}\n` };
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

const EVIDENCE_DE: Record<string, string> = {
  a: 'A – gute Studienlage',
  b: 'B – begrenzte Studienlage',
  c: 'C – nicht empfohlen',
};

function label(d: SupplementReleaseDecision): string {
  return `\`${d.original.id}\` ${cell(d.original.name_de)}`;
}

function releasedTable(released: readonly SupplementReleaseDecision[]): string[] {
  return [
    `#### Freigegeben (${released.length})`,
    '',
    '| Supplement | Stufe | Angaben (Health Claims) | Quellen |',
    '| --- | --- | --- | --- |',
    ...released.map(
      (d) =>
        `| ${label(d)} | ${d.original.evidence_level === null ? '– (Sicherheits-Info)' : (EVIDENCE_DE[d.original.evidence_level] ?? d.original.evidence_level)} | ${d.original.claim_ids.length === 0 ? '–' : d.original.claim_ids.map((id) => `\`${id}\``).join(', ')} | ${d.original.sources.length} |`,
    ),
  ];
}

function skippedTable(skipped: readonly SupplementReleaseDecision[]): string[] {
  if (skipped.length === 0) return ['Übersprungen: keine.'];
  return [
    `#### Übersprungen (${skipped.length}) – bleiben unverändert`,
    '',
    '| Supplement | Grund |',
    '| --- | --- |',
    ...skipped.map(
      (d) => `| ${label(d)} | ${cell(d.blockers.map(supplementReleaseBlockerText).join(' · '))} |`,
    ),
  ];
}

/** Alle Supplemente im Entwurf (auf dem aktuellen Stand – vorher auf main wechseln). */
export function draftSupplementIds(repoRoot: string): string[] {
  const loaded = loadSupplementContentFiles(join(repoRoot, 'content'));
  return loaded.files
    .flatMap((file) => {
      const data = file.data as { id?: unknown; status?: unknown } | undefined;
      return data?.status === 'draft' && typeof data.id === 'string' ? [data.id] : [];
    })
    .sort();
}

export async function runSupplementIdRelease(
  rawInput: { ids: string; status: string; reviewer: string; expertReviewed: string },
  deps: ReviewDeps,
): Promise<ReviewResult> {
  const keyword = rawInput.ids.trim().toLowerCase() === ALL_SUPPLEMENTS_KEYWORD;
  if (keyword) checkoutBaseBranch(deps);
  const ids = keyword ? draftSupplementIds(deps.repoRoot).join(' ') : rawInput.ids;
  if (keyword && ids === '') {
    return {
      exitCode: 0,
      markdown:
        '### ⏭️ content-review: nichts zu tun\n\nKein Supplement ist mehr im Entwurf (alle schon freigegeben).\n',
    };
  }
  const parsed = supplementIdsReleaseInputSchema.safeParse({ ...rawInput, ids });
  if (!parsed.success) {
    return fail(zodMessage(parsed.error));
  }
  const input = parsed.data;
  const { tools, repoRoot } = deps;
  checkoutBaseBranch(deps);
  const today = isoDateBerlin(deps.now());
  const files = loadSupplementContentFiles(join(repoRoot, 'content')).files;
  const plan = planSupplementRelease(files, input.ids, {
    reviewer: input.reviewer,
    date: today,
    expertReviewed: input.expertReviewed,
  });
  if (plan.unknownIds.length > 0) {
    return fail(
      [
        'Nichts geändert:',
        ...plan.unknownIds.map(
          (id) =>
            `- \`${id}\`: kein Supplement mit gültigem Schema gefunden (content:validate zeigt Schemafehler).`,
        ),
      ].join('\n'),
    );
  }
  const released = plan.decisions.filter((d) => d.blockers.length === 0);
  const skipped = plan.decisions.filter((d) => d.blockers.length > 0);
  const header = [
    `## ${TITLE}`,
    '',
    `Prüfer: **${input.reviewer}** · Datum: ${today} · fachlich geprüft: **${input.expertReviewed ? 'ja' : 'nein'}**`,
    '',
    `${plan.decisions.length} Supplemente · ${released.length} werden freigegeben · ${skipped.length} übersprungen.`,
    '',
  ];
  if (released.length === 0) {
    return {
      exitCode: 0,
      markdown: [
        '### ⏭️ content-review: nichts freigegeben – kein Pull Request',
        '',
        ...header,
        ...skippedTable(skipped),
        '',
      ].join('\n'),
    };
  }
  const paths: string[] = [];
  for (const decision of released) {
    const path = `content/${SUPPLEMENT_CONTENT_FOLDERS.supplement}/${decision.original.id}.json`;
    await writeJsonFile(repoRoot, path, decision.released);
    paths.push(path);
  }
  const checks = await runPrChecks(repoRoot, paths, tools);
  const report = [
    ...header,
    ...releasedTable(released),
    '',
    ...skippedTable(skipped),
    '',
    'Freigegeben wird erst mit dem **Merge** durch einen Menschen. Danach spielt **content-seed** die Supplemente ein (Testphase-Regel aus `content/einspiel-regeln.json`).',
    input.expertReviewed
      ? ''
      : 'Ohne „fachlich geprüft“: nur für die Testphase – die App kennzeichnet sie „Testphase – noch nicht fachlich geprüft“. **Vor dem Livegang: Fachprüfung (Ernährungsfachkraft/Sportmedizin) und Rechtsprüfung der Health Claims** (docs/PLAN-PHASE-6.md 18).',
    '',
    checks.markdown,
  ].join('\n');
  if (!checks.ok) {
    tools.git(['reset', '--hard', `origin/${BASE_BRANCH}`]);
    return fail(['Prüfung rot – **kein Pull Request**.', '', report].join('\n'));
  }
  const short = deps.randomShort?.() ?? randomBytes(3).toString('hex');
  const branch = `${REVIEW_BRANCH_PREFIX}${today}-${short}`;
  tools.git(['checkout', '-b', branch]);
  const releasedIds = released.map((d) => d.original.id);
  const shortList = `${releasedIds.slice(0, 3).join(', ')}${releasedIds.length > 3 ? ` und ${releasedIds.length - 3} weitere` : ''}`;
  const pr = commitPushAndOpenPr(tools, {
    branch,
    title: `Freigabe Supplemente: ${shortList} (${released.length} freigegeben)`,
    body: [
      report,
      '',
      PHONE_TEST_SECTION,
      '',
      '---',
      'Automatisch erstellt von content-review. Dieser Workflow öffnet nur Pull Requests und genehmigt nie.',
    ].join('\n'),
    commitMessage: `Freigabe Supplemente durch ${input.reviewer}: ${released.length} Inhalte (${releasedIds.join(', ')})`,
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
