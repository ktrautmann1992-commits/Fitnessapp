/**
 * Aufruf: `pnpm illustrations` (im Hauptordner) – erzeugt die eigenen Übungs-Illustrationen neu
 * (Gründer-Entscheidung B, docs/DESIGN.md „Übungs-Illustrationen“). `--check` schreibt nichts und meldet veraltete
 * Dateien (Exit 1). Logik in illustrations/generate.ts.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXERCISE_MEDIA_ASSET_DIR, EXERCISE_MEDIA_FOLDER } from '@fitnessapp/core';

import { generateIllustrationFiles } from './illustrations/generate';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const check = process.argv.includes('--check');

const files = await generateIllustrationFiles(repoRoot);
const stale: string[] = [];
for (const [path, content] of files) {
  const full = join(repoRoot, path);
  const current = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (current === content) continue;
  stale.push(path);
  if (!check) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}
// Übrig gebliebene Dateien (Übung entfernt) aufräumen bzw. melden.
for (const dir of [EXERCISE_MEDIA_ASSET_DIR, `content/${EXERCISE_MEDIA_FOLDER}`]) {
  const full = join(repoRoot, dir);
  if (!existsSync(full)) continue;
  for (const name of readdirSync(full)) {
    const path = `${dir}/${name}`;
    if (name.startsWith('.') || files.has(path)) continue;
    stale.push(`${path} (überzählig)`);
    if (!check) rmSync(join(full, name));
  }
}
if (check && stale.length > 0) {
  console.error(
    `Übungs-Illustrationen veraltet – „pnpm illustrations“ ausführen:\n${stale.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    check
      ? `Übungs-Illustrationen aktuell (${files.size} Dateien).\n`
      : `Übungs-Illustrationen: ${stale.length} Datei(en) geschrieben/entfernt, ${files.size} insgesamt.\n`,
  );
}
