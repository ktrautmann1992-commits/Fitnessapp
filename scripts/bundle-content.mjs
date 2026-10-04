// Bündelt die Inhaltsdateien des Repositorys (content/exercises, content/plan-templates) beim Bauen in ein
// TypeScript-Modul. Gemeinsam genutzt von
// - apps/web (Redaktionsbereich /admin): jede Vercel-Vorschau zeigt genau die Inhalte ihres Branches,
// - apps/mobile (Testmodus ohne Supabase, docs/PLAN-PHASE-3.md 10.1): Plan aus den gebündelten Entwürfen; das Modul
//   wird erst bei Bedarf nachgeladen (import()), der Supabase-Modus lädt Inhalte aus der Datenbank.
// Ohne Datenbank und ohne Dateizugriff zur Laufzeit. Geprüft wird beim Nutzen mit validateContent aus packages/core
// (dieselben Regeln wie content:validate).
// Aufruf: node scripts/bundle-content.mjs <Ausgabedatei relativ zum aktuellen Ordner>, automatisch vor build,
// typecheck, test und dev (package.json der Apps). Ausgabe ist nicht eingecheckt.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '../content');
const target = process.argv[2];
if (!target) {
  console.error('Aufruf: node scripts/bundle-content.mjs <Ausgabedatei> [--empty-if-supabase]');
  process.exit(1);
}
const outFile = resolve(process.cwd(), target);
// App (apps/mobile): Mit Supabase-Werten (EXPO_PUBLIC_SUPABASE_URL gesetzt) lädt die App Inhalte nur aus der
// Datenbank (nur freigegebene) – dann wird nur ein LEERES Bündel erzeugt, damit keine Entwürfe im Build landen.
// Fällt die App wegen fehlerhafter Werte in den Testmodus zurück, zeigt sie „kein freigegebener Plan“.
const emptyBundle =
  process.argv.includes('--empty-if-supabase') &&
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() !== '';

/** Ordner je Inhaltsart – wie CONTENT_FOLDERS in packages/content/src/validate.ts. */
const FOLDERS = { exercise: 'exercises', plan_template: 'plan-templates' };

const files = [];
const strayFiles = [];
for (const [kind, folder] of emptyBundle ? [] : Object.entries(FOLDERS)) {
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
const source = `// Automatisch erzeugt von scripts/bundle-content.mjs – nicht von Hand bearbeiten.
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
  emptyBundle
    ? 'Supabase-Werte gesetzt: leeres Inhalts-Bündel (Inhalte kommen aus der Datenbank).'
    : `Inhalte gebündelt: ${files.filter((f) => f.kind === 'exercise').length} Übungen, ${
        files.filter((f) => f.kind === 'plan_template').length
      } Plan-Vorlagen${strayFiles.length > 0 ? `, ${strayFiles.length} fremde Dateien` : ''}.`,
);
