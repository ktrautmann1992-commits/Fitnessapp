/**
 * Anbindung von `sources-integrity` an git und die GitHub-API (in CI). Die Logik steht in integrity.ts.
 *
 * - Vergleichsstand: `origin/main` (Umgebungsvariable `INTEGRITY_BASE` überschreibt das, z. B. in Tests).
 * - Pull Request bzw. Lauf auf einem anderen Branch: geänderte Pfade und Commits gegen den Vergleichsstand,
 *   Herkunftsprüfung der Commits. Lauf auf `main` (Push, wöchentlich, per Hand): volle Prüfung ohne Commit-Prüfung.
 * - Allowlist: `sources.ts` aus dem Vergleichsstand (git show), nie aus dem Arbeitsstand des Pull Requests.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { fetchSourceOriginal } from './download';
import { CONTENT_REVIEW_WORKFLOW_PATH } from './catalog-review-guard';
import {
  commitProvenance,
  githubApi,
  importRunProvenance,
  workflowRunProvenance,
} from './github-api';
import { type IntegrityDeps, NO_SYMLINK_PATHS } from './integrity';
import { SOURCES_DIR } from './extract-source';
import type { SourceDefinition } from './sources';

export const SOURCES_TS_PATH = 'packages/content/src/foods/sources.ts';

function git(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Mindestprüfung der importierten Allowlist (sie stammt aus main, trotzdem nicht blind vertrauen). */
const allowlistSchema = z.array(
  z
    .object({
      db: z.enum(['bls', 'ch_naehrwertdatenbank', 'usda_fdc']),
      version: z.string().min(1),
      url: z.string().startsWith('https://'),
      license: z.string(),
      attribution: z.string(),
      originalSha256: z.string().nullable(),
      // Fehlt in älteren Ständen von main (vor der Umstellung auf blsdb.de) = Datei-Adresse direkt.
      downloadPage: z
        .object({
          linkPath: z.string().startsWith('/'),
          tokenParam: z.string().min(1),
          redirectHosts: z.array(z.string().min(1)),
        })
        .nullable()
        .optional(),
      format: z.enum(['xlsx', 'csv']),
      keyColumn: z.number().int().min(0),
    })
    .passthrough(),
);

/** Lädt `sources.ts` aus einem git-Stand (temporäre Datei, dann import). null = dort nicht vorhanden. */
export async function loadSourcesFromRef(
  repoRoot: string,
  ref: string,
): Promise<readonly SourceDefinition[] | null> {
  let text: string;
  try {
    text = git(repoRoot, ['show', `${ref}:${SOURCES_TS_PATH}`]);
  } catch {
    return null;
  }
  if (
    /^\s*import\s/m.test(text) ||
    /\brequire\(/.test(text) ||
    /\bimport\(/.test(text) ||
    /\bfrom\s+['"]/.test(text)
  ) {
    throw new Error(
      'sources.ts auf main darf keine Imports enthalten (Allowlist muss für sich stehen).',
    );
  }
  const dir = mkdtempSync(join(tmpdir(), 'sources-main-'));
  try {
    const file = join(dir, 'sources-main.ts');
    writeFileSync(file, text);
    const module = (await import(pathToFileURL(file).href)) as { SOURCES?: unknown };
    allowlistSchema.parse(module.SOURCES);
    return module.SOURCES as readonly SourceDefinition[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Alle symbolischen Links unter den Daten-Ordnern (rekursiv, Links werden nicht verfolgt). */
export function findSymlinks(
  repoRoot: string,
  dirs: readonly string[] = NO_SYMLINK_PATHS,
): string[] {
  const found: string[] = [];
  const walk = (rel: string) => {
    const full = join(repoRoot, rel);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) {
      found.push(rel);
      return;
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(full).sort()) {
        walk(`${rel}/${name}`);
      }
    }
  };
  for (const dir of dirs) {
    walk(dir);
  }
  return found;
}

export function integrityDepsFromEnv(repoRoot: string, env: NodeJS.ProcessEnv): IntegrityDeps {
  const base = env.INTEGRITY_BASE?.trim() || 'origin/main';
  // PR-Modus über das EREIGNIS, nie über den Branch-Namen: Ein Fork-PR kommt oft vom Branch „main“ des Forks
  // (Wächter N2b, S1).
  const event = env.GITHUB_EVENT_NAME?.trim() ?? '';
  const prEvent = event === 'pull_request' || event === 'pull_request_target';
  const branch = prEvent
    ? env.GITHUB_HEAD_REF?.trim() || null
    : env.GITHUB_REF_NAME?.trim() || null;
  const onMain = !prEvent && (branch === null || branch === 'main' || event === 'schedule');
  // Kopf-Repository des PRs (aus github.event.pull_request.head.repo.full_name). Fehlt es im PR, gilt
  // vorsichtig „Fork“.
  const headRepo = env.PR_HEAD_REPO?.trim();
  const headIsFork =
    prEvent &&
    (headRepo === undefined || headRepo === '' || headRepo !== env.GITHUB_REPOSITORY?.trim());
  const token = env.GITHUB_TOKEN?.trim();
  const repository = env.GITHUB_REPOSITORY?.trim();
  const api = token && repository ? githubApi(token, repository) : undefined;
  const sourcesRoot = join(repoRoot, SOURCES_DIR);

  return {
    branch,
    headIsFork,
    symlinks: () => findSymlinks(repoRoot),
    importRunProvenance: async (runId) => {
      if (api === undefined) {
        return { ok: false, reason: 'kein GITHUB_TOKEN – Lauf nicht prüfbar' };
      }
      return importRunProvenance(api, runId);
    },
    reviewRunProvenance: async (runId) => {
      if (api === undefined) {
        return { ok: false, reason: 'kein GITHUB_TOKEN – Lauf nicht prüfbar' };
      }
      return workflowRunProvenance(api, runId, CONTENT_REVIEW_WORKFLOW_PATH);
    },
    // Stand am Abzweig vom Vergleichsstand (wie `git diff base...HEAD`), nicht der heutige Stand von main.
    readBaseFile: (path) => {
      try {
        const mergeBase = git(repoRoot, ['merge-base', base, 'HEAD']).trim();
        return execFileSync('git', ['show', `${mergeBase}:${path}`], {
          cwd: repoRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch {
        return undefined;
      }
    },
    loadMainSources: () => loadSourcesFromRef(repoRoot, base),
    download: async (def) => (await fetchSourceOriginal(def)).data,
    listSourceDirs: () => {
      if (!existsSync(sourcesRoot)) {
        return [];
      }
      const dirs: string[] = [];
      for (const db of readdirSync(sourcesRoot).sort()) {
        const dbDir = join(sourcesRoot, db);
        for (const version of readdirSync(dbDir).sort()) {
          dirs.push(`${SOURCES_DIR}/${db}/${version}`);
        }
      }
      return dirs;
    },
    listFiles: (dir) => readdirSync(join(repoRoot, dir)).sort(),
    readFile: (path) => {
      const full = join(repoRoot, path);
      return existsSync(full) ? readFileSync(full) : undefined;
    },
    changedPaths: () => {
      if (onMain) {
        return null;
      }
      return git(repoRoot, ['diff', '--name-only', `${base}...HEAD`])
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    },
    commitsTouching: (paths) =>
      git(repoRoot, ['rev-list', `${base}..HEAD`, '--', ...paths])
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    commitProvenance: async (sha) => {
      if (api === undefined) {
        return { ok: false, reason: 'kein GITHUB_TOKEN – Herkunft nicht prüfbar' };
      }
      return commitProvenance(api, sha);
    },
  };
}
