/**
 * Hilfen für Tests der Pipeline: temporäres git-Repository mit lokalem „origin“ (ohne Netz),
 * gefälschtes gh, gefälschter Gemini-Client (keine echten Netzaufrufe). Wird nur von *.test.ts genutzt.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BatchRequest, BatchResult, ContentApiClient, FinishKind } from './provider/types';
import { systemTools, type PipelineTools } from './tools';

/** Wurzel des echten Repositorys (für den Startbestand unter content/). */
export const REAL_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export interface TempRepo {
  readonly root: string;
  readonly origin: string;
  /** git im Arbeitsordner. */
  git(args: string[]): string;
  /** Datei-Inhalt eines Branches auf origin. */
  showRemote(branch: string, path: string): string;
  cleanup(): void;
}

/**
 * Freigabe-Status der kopierten Übungen und Plan-Vorlagen im Test-Repository:
 * - `draft` (Standard): alles Entwurf ohne Prüfer – der Ausgangszustand, von dem die Pipeline-Tests ausgehen
 *   (Freigabe, V3-Blockade, Einspielen nur freigegebener Inhalte). So hängen die Tests nicht davon ab, ob der
 *   echte Bestand unter content/ schon freigegeben ist.
 * - `published`: alles freigegeben (Prüfer und Datum gesetzt).
 */
export type TempRepoContentStatus = 'draft' | 'published';

/** Prüfer und Datum, mit denen `contentStatus: 'published'` freigibt. */
export const TEMP_REPO_REVIEW = { reviewed_by: 'Test', reviewed_at: '2026-10-03' } as const;

/**
 * Setzt Status und Prüfvermerk einer Inhaltsdatei per Textersetzung (Formatierung bleibt wie im Repository,
 * Prettier-Prüfungen der Pipeline bleiben also grün). Jede Datei hat genau ein `status`, `reviewed_by` und
 * `reviewed_at` (geprüft).
 */
export function setContentStatus(text: string, status: 'draft' | 'published'): string {
  const value = (v: string | null) => (v === null ? 'null' : JSON.stringify(v));
  const review =
    status === 'published' ? TEMP_REPO_REVIEW : { reviewed_by: null, reviewed_at: null };
  let result = text;
  for (const [key, replacement] of [
    ['status', value(status)],
    ['reviewed_by', value(review.reviewed_by)],
    ['reviewed_at', value(review.reviewed_at)],
  ] as const) {
    const pattern = new RegExp(`("${key}": )(null|"[^"]*")`, 'g');
    const matches = result.match(pattern) ?? [];
    if (matches.length !== 1) {
      throw new Error(`setContentStatus: „${key}“ ${matches.length}-mal statt genau einmal`);
    }
    result = result.replace(pattern, `$1${replacement}`);
  }
  return result;
}

/** Legt ein Repository mit dem echten Startbestand an; main ist nach origin gepusht. */
export function createTempRepo(
  options: { withContent?: boolean; contentStatus?: TempRepoContentStatus } = {},
): TempRepo {
  const origin = mkdtempSync(join(tmpdir(), 'content-origin-'));
  const root = mkdtempSync(join(tmpdir(), 'content-repo-'));
  git(origin, ['init', '--quiet', '--bare', '--initial-branch=main']);
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  cpSync(join(REAL_REPO_ROOT, '.prettierrc.json'), join(root, '.prettierrc.json'));
  if (options.withContent !== false) {
    const status = options.contentStatus ?? 'draft';
    for (const folder of ['content/exercises', 'content/plan-templates']) {
      cpSync(join(REAL_REPO_ROOT, folder), join(root, folder), { recursive: true });
      for (const name of readdirSync(join(root, folder))) {
        if (!name.endsWith('.json')) continue;
        const file = join(root, folder, name);
        writeFileSync(file, setContentStatus(readFileSync(file, 'utf8'), status));
      }
    }
  }
  git(root, ['add', '-A']);
  git(root, ['commit', '--quiet', '-m', 'Startbestand']);
  git(root, ['remote', 'add', 'origin', origin]);
  git(root, ['push', '--quiet', '-u', 'origin', 'main']);
  return {
    root,
    origin,
    git: (args) => git(root, args),
    showRemote: (branch, path) => git(origin, ['show', `${branch}:${path}`]),
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
    },
  };
}

export interface FakeTools extends PipelineTools {
  readonly ghCalls: string[][];
  /** Texte der Pull Requests (aus --body-file bzw. --body). */
  readonly prBodies: string[];
  typecheckCalls: number;
}

/** Echtes git im Test-Repository, gh und Typprüfung gefälscht (kein Netz). */
export function fakeTools(
  root: string,
  options: { prListCount?: string; failPrCreate?: boolean; typecheckError?: string } = {},
): FakeTools {
  const real = systemTools(root);
  const tools: FakeTools = {
    ghCalls: [],
    prBodies: [],
    typecheckCalls: 0,
    git: real.git,
    gh: (args) => {
      tools.ghCalls.push([...args]);
      if (args[0] === 'pr' && args[1] === 'create') {
        if (options.failPrCreate) {
          throw new Error('gh pr create fehlgeschlagen (Test)');
        }
        const bodyFile = args[args.indexOf('--body-file') + 1];
        tools.prBodies.push(
          args.includes('--body-file') && bodyFile
            ? readFileSync(bodyFile, 'utf8')
            : (args[args.indexOf('--body') + 1] ?? ''),
        );
        return `https://github.com/example/fitnessapp/pull/${tools.ghCalls.length}\n`;
      }
      if (args[0] === 'pr' && args[1] === 'list') {
        return `${options.prListCount ?? '1'}\n`;
      }
      return '';
    },
    typecheck: () => {
      tools.typecheckCalls += 1;
      if (options.typecheckError) {
        throw new Error(options.typecheckError);
      }
    },
  };
  return tools;
}

/** Gefälschte Tools ohne git (nur Aufrufe merken). */
export function recordingTools(): PipelineTools & { gitCalls: string[][]; ghCalls: string[][] } {
  const gitCalls: string[][] = [];
  const ghCalls: string[][] = [];
  return {
    gitCalls,
    ghCalls,
    git: (args) => {
      gitCalls.push([...args]);
      return '';
    },
    gh: (args) => {
      ghCalls.push([...args]);
      return '';
    },
    typecheck: () => undefined,
  };
}

export interface MockClient extends ContentApiClient {
  readonly calls: { countTokens: number; create: number; get: number };
  /** Angelegte Batches (Modell, Anfragen, Anzeigename). */
  readonly created: { model: string; requests: readonly BatchRequest[]; displayName: string }[];
}

/**
 * Gefälschter Gemini-Client (anbieter-neutrale Schnittstelle): feste Token-Zahl je Anfrage, Batch-Stand und
 * Ergebnisse vorgebbar. Kein Netz.
 */
export function mockClient(
  options: {
    inputTokensPerRequest?: number;
    batchId?: string;
    state?: 'pending' | 'ended';
    results?: BatchResult[];
  } = {},
): MockClient {
  const calls = { countTokens: 0, create: 0, get: 0 };
  const created: MockClient['created'] = [];
  return {
    provider: 'gemini',
    calls,
    created,
    countTokens: async () => {
      calls.countTokens += 1;
      return options.inputTokensPerRequest ?? 1000;
    },
    createBatch: async (model, requests, displayName) => {
      calls.create += 1;
      created.push({ model, requests, displayName });
      return { id: options.batchId ?? 'batches/test01abcdef' };
    },
    getBatch: async () => {
      calls.get += 1;
      return options.state === 'pending'
        ? { state: 'pending', info: 'Status JOB_STATE_RUNNING.' }
        : { state: 'ended', info: 'Status JOB_STATE_SUCCEEDED.', results: options.results ?? [] };
    },
  };
}

/** Gelieferte Antwort mit Text (z. B. JSON) und Ende-Grund. */
export function succeeded(
  customId: string,
  text: string,
  finish: FinishKind = 'stop',
  usage: { input: number; output: number } = { input: 1000, output: 2000 },
  finishDetail = finish === 'stop' ? '' : finish === 'refusal' ? 'SAFETY' : String(finish),
): BatchResult {
  return {
    custom_id: customId,
    result: {
      type: 'succeeded',
      text,
      finish,
      finishDetail,
      usage: { inputTokens: usage.input, outputTokens: usage.output },
    },
  };
}
