// Bündelt die Inhaltsdateien des Repositorys (content/exercises, content/plan-templates) beim Bauen in ein
// TypeScript-Modul für den Redaktionsbereich (/admin). So zeigt jede Vercel-Vorschau genau die Inhalte ihres
// Branches – ohne Datenbank und ohne Dateizugriff zur Laufzeit. Geprüft wird erst auf dem Server mit
// validateContent aus packages/core (dieselben Regeln wie content:validate).
// Aufruf: automatisch vor build, typecheck, test und dev (package.json). Ausgabe ist nicht eingecheckt.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '../../../content');
const outFile = resolve(here, '../src/generated/content-files.ts');

/** Ordner je Inhaltsart – wie CONTENT_FOLDERS in packages/content/src/validate.ts. */
const FOLDERS = { exercise: 'exercises', plan_template: 'plan-templates' };

const files = [];
const strayFiles = [];
for (const [kind, folder] of Object.entries(FOLDERS)) {
  const dir = join(contentDir, folder);
  if (!existsSync(dir)) {
    continue;
  }
  for (const fileName of readdirSync(dir).sort()) {
    if (fileName.startsWith('.')) {
      continue;
    }
    if (!fileName.endsWith('.json')) {
      strayFiles.push(`${folder}/${fileName}`);
      continue;
    }
    const text = readFileSync(join(dir, fileName), 'utf8');
    try {
      files.push({ kind, fileName, data: JSON.parse(text) });
    } catch (error) {
      files.push({
        kind,
        fileName,
        jsonError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const payload = JSON.stringify({ files, strayFiles });
const source = `// Automatisch erzeugt von apps/web/scripts/bundle-content.mjs – nicht von Hand bearbeiten.
import type { ContentFile } from '@fitnessapp/core';

export interface ContentBundle {
  readonly files: readonly ContentFile[];
  readonly strayFiles: readonly string[];
}

export const CONTENT_BUNDLE: ContentBundle = JSON.parse(${JSON.stringify(payload)}) as ContentBundle;
`;

mkdirSync(dirname(outFile), { recursive: true });
const previous = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
if (previous !== source) {
  writeFileSync(outFile, source);
}
console.log(
  `Inhalte gebündelt: ${files.filter((f) => f.kind === 'exercise').length} Übungen, ${
    files.filter((f) => f.kind === 'plan_template').length
  } Plan-Vorlagen${strayFiles.length > 0 ? `, ${strayFiles.length} fremde Dateien` : ''}.`,
);
