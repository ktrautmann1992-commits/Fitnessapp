import { describe, expect, it } from 'vitest';

import { BOT_LOGIN, createVerifiedCommit, type GitHubApi, utf8Text } from './github-api';

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
