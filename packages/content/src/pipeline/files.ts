/**
 * Dateien lesen/schreiben: Inhaltsstand laden und JSON so formatieren, wie Prettier es im Repository
 * erwartet (damit `pnpm format:check` in ci grün bleibt).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type ContentFileKind, validateContent } from '@fitnessapp/core';
import * as prettier from 'prettier';

import { CONTENT_FOLDERS, loadContentFiles } from '../validate';
import type { LibraryContext } from './kinds';

/** Lädt den Inhaltsstand unter `<repoRoot>/content` als Kontext für die Pipeline. */
export function loadLibrary(repoRoot: string): LibraryContext {
  const { files } = loadContentFiles(join(repoRoot, 'content'));
  const result = validateContent(files);
  const takenIds: Record<ContentFileKind, Set<string>> = {
    exercise: new Set(),
    plan_template: new Set(),
  };
  for (const file of files) {
    takenIds[file.kind].add(file.fileName.replace(/\.json$/, ''));
  }
  return { exercises: result.exercises, templates: result.templates, takenIds };
}

/** Pfad einer Inhaltsdatei relativ zum Repository, z. B. `content/exercises/kniebeuge.json`. */
export function contentPath(kind: ContentFileKind, id: string): string {
  return `content/${CONTENT_FOLDERS[kind]}/${id}.json`;
}

/** JSON im Prettier-Format des Repositorys. */
export async function formatJson(repoRoot: string, repoPath: string, data: unknown) {
  const filepath = join(repoRoot, repoPath);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(`${JSON.stringify(data, null, 2)}\n`, { ...options, filepath });
}

/** Schreibt eine JSON-Datei (Prettier-Format) und legt Ordner bei Bedarf an. */
export async function writeJsonFile(repoRoot: string, repoPath: string, data: unknown) {
  const filepath = join(repoRoot, repoPath);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, await formatJson(repoRoot, repoPath, data));
}

/** Prettier-Prüfung (wie `prettier --check`) für die angegebenen Dateien; liefert die nicht formatierten. */
export async function prettierUnformatted(
  repoRoot: string,
  repoPaths: readonly string[],
  readText: (repoPath: string) => string,
): Promise<string[]> {
  const unformatted: string[] = [];
  for (const repoPath of repoPaths) {
    const filepath = join(repoRoot, repoPath);
    const options = (await prettier.resolveConfig(filepath)) ?? {};
    if (!(await prettier.check(readText(repoPath), { ...options, filepath }))) {
      unformatted.push(repoPath);
    }
  }
  return unformatted;
}
