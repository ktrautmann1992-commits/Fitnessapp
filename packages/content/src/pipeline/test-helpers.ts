/**
 * Hilfen für Tests der Pipeline: temporäres git-Repository mit lokalem „origin“ (ohne Netz),
 * gefälschtes gh, gefälschter Anthropic-Client. Wird nur von *.test.ts genutzt.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type Anthropic from '@anthropic-ai/sdk';

import type { ContentApiClient } from './requests';
import type { BatchResult } from './results';
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

/** Legt ein Repository mit dem echten Startbestand an; main ist nach origin gepusht. */
export function createTempRepo(options: { withContent?: boolean } = {}): TempRepo {
  const origin = mkdtempSync(join(tmpdir(), 'content-origin-'));
  const root = mkdtempSync(join(tmpdir(), 'content-repo-'));
  git(origin, ['init', '--quiet', '--bare', '--initial-branch=main']);
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  cpSync(join(REAL_REPO_ROOT, '.prettierrc.json'), join(root, '.prettierrc.json'));
  if (options.withContent !== false) {
    cpSync(join(REAL_REPO_ROOT, 'content/exercises'), join(root, 'content/exercises'), {
      recursive: true,
    });
    cpSync(join(REAL_REPO_ROOT, 'content/plan-templates'), join(root, 'content/plan-templates'), {
      recursive: true,
    });
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
  readonly calls: { countTokens: number; create: number; retrieve: number; results: number };
  readonly created: Anthropic.Messages.Batches.BatchCreateParams[];
}

/** Gefälschter Anthropic-Client: feste Token-Zahl je Anfrage, Batch-Status und Ergebnisse vorgebbar. */
export function mockClient(
  options: {
    inputTokensPerRequest?: number;
    batchId?: string;
    processingStatus?: 'in_progress' | 'canceling' | 'ended';
    results?: BatchResult[];
  } = {},
): MockClient {
  const calls = { countTokens: 0, create: 0, retrieve: 0, results: 0 };
  const created: Anthropic.Messages.Batches.BatchCreateParams[] = [];
  const batch = (status: 'in_progress' | 'canceling' | 'ended') => ({
    id: options.batchId ?? 'msgbatch_test01abcdef',
    type: 'message_batch',
    processing_status: status,
    request_counts: { canceled: 0, errored: 0, expired: 0, processing: 3, succeeded: 1 },
  });
  const client = {
    calls,
    created,
    messages: {
      countTokens: async () => {
        calls.countTokens += 1;
        return { input_tokens: options.inputTokensPerRequest ?? 1000 };
      },
      batches: {
        create: async (params: Anthropic.Messages.Batches.BatchCreateParams) => {
          calls.create += 1;
          created.push(params);
          return batch('in_progress');
        },
        retrieve: async () => {
          calls.retrieve += 1;
          return batch(options.processingStatus ?? 'ended');
        },
        results: async () => {
          calls.results += 1;
          const items = options.results ?? [];
          return (async function* () {
            yield* items;
          })();
        },
      },
    },
  };
  return client as unknown as MockClient;
}

/** Erfolgreiches Batch-Ergebnis mit Text (z. B. JSON) und Stopp-Grund. */
export function succeeded(
  customId: string,
  text: string,
  stopReason: Anthropic.Messages.StopReason = 'end_turn',
  usage: { input: number; output: number } = { input: 1000, output: 2000 },
): BatchResult {
  return {
    custom_id: customId,
    result: {
      type: 'succeeded',
      message: {
        id: `msg_${customId}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        container: null,
        diagnostics: null,
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          ...(text === '' ? [] : [{ type: 'text' as const, text, citations: null }]),
        ],
        stop_reason: stopReason,
        stop_details:
          stopReason === 'refusal'
            ? { type: 'refusal', category: 'cyber', explanation: null }
            : null,
        stop_sequence: null,
        usage: {
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          inference_geo: null,
          input_tokens: usage.input,
          output_tokens: usage.output,
          output_tokens_details: null,
          server_tool_use: null,
          service_tier: 'batch',
        },
      },
    },
  };
}
