/**
 * GitHub-REST-API für `foods-import` und `sources-integrity` (docs/PLAN-PHASE-5.md 5.1 Schritt 4, H1).
 *
 * Commits entstehen über die Git-Data-API mit dem `GITHUB_TOKEN` des Workflows und OHNE Autor-/Committer-
 * Angabe – GitHub signiert sie dann selbst und kennzeichnet sie als „verified“ (Autor `github-actions[bot]`).
 * Ein per `git config` vorgetäuschter Bot-Autor ist dagegen NICHT verifiziert; `sources-integrity` prüft das
 * für jeden Commit über `GET /repos/{repo}/commits/{sha}`.
 */

export const BOT_LOGIN = 'github-actions[bot]';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface GitHubApi {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

/** Client für ein Repository (`owner/name`). Der Token wird nie ausgegeben. */
export function githubApi(
  token: string,
  repository: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  apiUrl = 'https://api.github.com',
): GitHubApi {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error(`Repository „${repository}“ ungültig (owner/name erwartet).`);
  }
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const response = await fetchImpl(`${apiUrl}/repos/${repository}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        const text = (await response.text()).slice(0, 500);
        throw new Error(`GitHub-API ${method} ${path}: HTTP ${response.status} ${text}`);
      }
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
  };
}

export interface CommitFile {
  /** Pfad relativ zum Repository. */
  readonly path: string;
  /** Neuer Inhalt; null = Datei löschen. */
  readonly content: Buffer | null;
}

/**
 * Legt einen Commit auf `base` mit den Dateien an, erstellt den Branch `branch` darauf und prüft, dass GitHub
 * den Commit als „verified“ von `github-actions[bot]` kennzeichnet (sonst Abbruch).
 */
export async function createVerifiedCommit(
  api: GitHubApi,
  input: { base: string; branch: string; message: string; files: readonly CommitFile[] },
): Promise<string> {
  if (input.files.length === 0) {
    throw new Error('Keine Dateien für den Commit.');
  }
  const ref = await api.request<{ object: { sha: string } }>(
    'GET',
    `/git/ref/heads/${encodeURIComponent(input.base)}`,
  );
  const baseSha = ref.object.sha;
  const baseCommit = await api.request<{ tree: { sha: string } }>('GET', `/git/commits/${baseSha}`);
  const tree: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
  for (const file of input.files) {
    if (file.content === null) {
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await api.request<{ sha: string }>('POST', '/git/blobs', {
      content: file.content.toString('base64'),
      encoding: 'base64',
    });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await api.request<{ sha: string }>('POST', '/git/trees', {
    base_tree: baseCommit.tree.sha,
    tree,
  });
  // Bewusst ohne author/committer: nur dann signiert GitHub den Commit („verified“).
  const commit = await api.request<{ sha: string }>('POST', '/git/commits', {
    message: input.message,
    tree: newTree.sha,
    parents: [baseSha],
  });
  await api.request('POST', '/git/refs', { ref: `refs/heads/${input.branch}`, sha: commit.sha });
  const info = await commitProvenance(api, commit.sha);
  if (!info.ok) {
    throw new Error(
      `Commit ${commit.sha} ist nicht als verifizierter Bot-Commit gekennzeichnet: ${info.reason}`,
    );
  }
  return commit.sha;
}

export interface CommitProvenance {
  readonly sha: string;
  /** true = von GitHub verifiziert UND Autor `github-actions[bot]`. */
  readonly ok: boolean;
  readonly reason: string;
}

/** Herkunft eines Commits laut GitHub (verified + Bot-Autor). */
export async function commitProvenance(api: GitHubApi, sha: string): Promise<CommitProvenance> {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    return { sha, ok: false, reason: 'keine gültige Commit-ID' };
  }
  const data = await api.request<{
    author: { login?: string } | null;
    commit: { verification?: { verified?: boolean; reason?: string } };
  }>('GET', `/commits/${sha}`);
  const verified = data.commit.verification?.verified === true;
  const login = data.author?.login ?? null;
  if (!verified) {
    return {
      sha,
      ok: false,
      reason: `nicht „verified“ (${data.commit.verification?.reason ?? 'unbekannt'})`,
    };
  }
  if (login !== BOT_LOGIN) {
    return { sha, ok: false, reason: `Autor ist „${login ?? 'unbekannt'}“, nicht ${BOT_LOGIN}` };
  }
  return { sha, ok: true, reason: 'verified, github-actions[bot]' };
}

/** Öffnet einen Pull Request und liefert dessen Adresse. */
export async function openPullRequest(
  api: GitHubApi,
  input: { base: string; branch: string; title: string; body: string },
): Promise<string> {
  const pr = await api.request<{ html_url: string }>('POST', '/pulls', {
    base: input.base,
    head: input.branch,
    title: input.title,
    body: input.body,
  });
  return pr.html_url;
}

/** Startet einen Workflow (z. B. ci.yml) für einen Branch – PRs mit GITHUB_TOKEN starten ci nicht von selbst. */
export async function dispatchWorkflow(
  api: GitHubApi,
  workflow: string,
  ref: string,
): Promise<void> {
  await api.request('POST', `/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
    ref,
  });
}

/** Pfad des Import-Workflows (Lauf-Prüfung, Wächter N2b S1). */
export const FOODS_IMPORT_WORKFLOW_PATH = '.github/workflows/foods-import.yml';

/**
 * Stammt die Lauf-ID aus `foods-import.yml`, per Hand (workflow_dispatch) auf `main` gestartet und nicht
 * fehlgeschlagen? Läuft der Lauf noch (er startet `ci` selbst am Ende), zählt das als in Ordnung.
 */
export async function importRunProvenance(
  api: GitHubApi,
  runId: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!/^\d+$/.test(runId)) {
    return { ok: false, reason: 'keine gültige Lauf-ID' };
  }
  const run = await api.request<{
    path?: string;
    event?: string;
    head_branch?: string;
    status?: string;
    conclusion?: string | null;
  }>('GET', `/actions/runs/${runId}`);
  const path = (run.path ?? '').replace(/@.*$/, '');
  if (path !== FOODS_IMPORT_WORKFLOW_PATH) {
    return { ok: false, reason: `Workflow „${run.path ?? 'unbekannt'}“` };
  }
  if (run.event !== 'workflow_dispatch') {
    return { ok: false, reason: `Ereignis „${run.event ?? 'unbekannt'}“` };
  }
  if (run.head_branch !== 'main') {
    return { ok: false, reason: `gestartet auf „${run.head_branch ?? 'unbekannt'}“` };
  }
  if (run.status === 'completed' && run.conclusion !== 'success') {
    return { ok: false, reason: `Lauf beendet mit „${run.conclusion ?? 'unbekannt'}“` };
  }
  return { ok: true, reason: 'foods-import.yml auf main' };
}
