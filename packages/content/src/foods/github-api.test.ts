import { describe, expect, it } from 'vitest';

import {
  BOT_LOGIN,
  BOT_PR_TOKEN_HINT,
  createVerifiedCommit,
  type GitHubApi,
  openPullRequestWithChecks,
  prApiFromEnv,
  utf8Text,
} from './github-api';

function fakeApi() {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const commitSha = 'c'.repeat(40);
  const api: GitHubApi = {
    request<T>(method: string, path: string, body?: unknown): Promise<T> {
      calls.push({ method, path, body });
      let result: unknown = {};
      if (path.startsWith('/git/ref/heads/')) result = { object: { sha: 'b'.repeat(40) } };
      else if (path.startsWith('/git/commits/')) result = { tree: { sha: 't'.repeat(40) } };
      else if (path === '/git/blobs') result = { sha: 'blob1' };
      else if (path === '/git/trees') result = { sha: 'tree1' };
      else if (path === '/git/commits') result = { sha: commitSha };
      else if (path === `/commits/${commitSha}`)
        result = { author: { login: BOT_LOGIN }, commit: { verification: { verified: true } } };
      return Promise.resolve(result as T);
    },
  };
  return { api, calls };
}

describe('createVerifiedCommit', () => {
  it('Textdateien direkt im Baum (ein Aufruf), Binärdateien als Blob, Löschungen mit sha null', async () => {
    const { api, calls } = fakeApi();
    const many = Array.from({ length: 300 }, (_, i) => ({
      path: `content/recipes/r${i}.json`,
      content: Buffer.from(`{"id":"r${i}","name":"Käsespätzle ${i}"}\n`, 'utf8'),
    }));
    await createVerifiedCommit(api, {
      base: 'main',
      branch: 'alpha5-import/1',
      message: 'Test',
      files: [
        ...many,
        { path: 'bild.bin', content: Buffer.from([0xff, 0xfe, 0x00, 0x80]) },
        { path: 'alt.json', content: null },
      ],
    });
    // Nur die Binärdatei braucht einen eigenen Blob – nicht 300 Anfragen für die Rezepte.
    expect(calls.filter((c) => c.path === '/git/blobs')).toHaveLength(1);
    const tree = (
      calls.find((c) => c.path === '/git/trees')?.body as {
        tree: { path: string; content?: string; sha?: string | null }[];
      }
    ).tree;
    expect(tree).toHaveLength(302);
    expect(tree[0]).toEqual({
      path: 'content/recipes/r0.json',
      mode: '100644',
      type: 'blob',
      content: '{"id":"r0","name":"Käsespätzle 0"}\n',
    });
    expect(tree.find((t) => t.path === 'bild.bin')?.sha).toBe('blob1');
    expect(tree.find((t) => t.path === 'alt.json')?.sha).toBeNull();
  });

  it('utf8Text: nur verlustfrei umwandelbare Inhalte gelten als Text', () => {
    expect(utf8Text(Buffer.from('Grüße\n', 'utf8'))).toBe('Grüße\n');
    expect(utf8Text(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    // BOM bleibt erhalten (Bytes identisch).
    expect(utf8Text(Buffer.from('﻿a', 'utf8'))).toBe('﻿a');
  });
});

describe('openPullRequestWithChecks (BOT_PR_TOKEN, docs/SETUP.md Teil P)', () => {
  function recorder(options: { failPulls?: boolean } = {}) {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const api: GitHubApi = {
      request<T>(method: string, path: string, body?: unknown): Promise<T> {
        calls.push({ method, path, ...(body === undefined ? {} : { body }) });
        if (path === '/pulls') {
          return options.failPulls
            ? Promise.reject(new Error('GitHub-API POST /pulls: HTTP 401 Bad credentials'))
            : Promise.resolve({ html_url: 'https://github.com/o/r/pull/7' } as T);
        }
        return Promise.resolve(undefined as T);
      },
    };
    return { api, calls };
  }
  const input = { base: 'main', branch: 'foods-import/1', title: 'T', body: 'B' };
  const workflows = ['ci.yml', 'sources-integrity-main.yml'];

  it('mit Token: Pull Request über den Token, kein workflow_dispatch (Checks starten von selbst)', async () => {
    const bot = recorder();
    const pr = recorder();
    const result = await openPullRequestWithChecks(bot.api, pr.api, input, workflows);
    expect(result.prUrl).toBe('https://github.com/o/r/pull/7');
    expect(pr.calls.map((c) => c.path)).toEqual(['/pulls']);
    expect(bot.calls).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('ohne Token: Pull Request mit GITHUB_TOKEN und beide Workflows per workflow_dispatch', async () => {
    const bot = recorder();
    const result = await openPullRequestWithChecks(bot.api, undefined, input, workflows);
    expect(bot.calls.map((c) => c.path)).toEqual([
      '/pulls',
      '/actions/workflows/ci.yml/dispatches',
      '/actions/workflows/sources-integrity-main.yml/dispatches',
    ]);
    expect(result.notes).toContain(BOT_PR_TOKEN_HINT);
    expect(result.warnings).toEqual([]);
  });

  it('Token abgelehnt (z. B. abgelaufen): Rückfall auf GITHUB_TOKEN mit Warnung, nichts bricht', async () => {
    const bot = recorder();
    const pr = recorder({ failPulls: true });
    const result = await openPullRequestWithChecks(bot.api, pr.api, input, workflows);
    expect(result.prUrl).toBe('https://github.com/o/r/pull/7');
    expect(bot.calls.filter((c) => c.path.endsWith('/dispatches'))).toHaveLength(2);
    expect(result.warnings.join(' ')).toContain('BOT_PR_TOKEN wurde abgelehnt');
  });

  it('prApiFromEnv: nur mit nicht leerem Token und Repository', () => {
    expect(prApiFromEnv({}, 'o/r')).toBeUndefined();
    expect(prApiFromEnv({ BOT_PR_TOKEN: '  ' }, 'o/r')).toBeUndefined();
    expect(prApiFromEnv({ BOT_PR_TOKEN: 'x' }, undefined)).toBeUndefined();
    expect(prApiFromEnv({ BOT_PR_TOKEN: 'x' }, 'o/r')).toBeDefined();
  });
});
