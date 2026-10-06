/**
 * PDF-Vorschau für die CI (docs/PLAN-PDF-EXPORT.md §8 P1+P2, §9 Schritt 1): schreibt für AUSGEDACHTE Beispiel-Personen
 * das Druck-HTML nach `pdf-vorschau/` (GitHub Actions lädt den Ordner als Artefakt „pdf-vorschau“ hoch). Am Handy
 * öffnen und über „Drucken“ → „Als PDF sichern“ prüfen. Keine echten Nutzerdaten.
 *
 *   pnpm --filter @fitnessapp/mobile pdf:preview
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderPrintHtml } from '@fitnessapp/ui/print';

import { translatePrintDocument } from '../src/lib/print-document';
import {
  EXAMPLE_DAY,
  exampleDocument,
  EXTREME_EXAMPLE,
  extremeDocument,
  PRINT_EXAMPLES,
} from '../src/test/print-examples';

const outDir = fileURLToPath(new URL('../pdf-vorschau/', import.meta.url));
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const summary: string[] = [
  '## PDF-Vorschau (Trainingsplan)',
  '',
  `Stichtag ${EXAMPLE_DAY}. Artefakt **pdf-vorschau** herunterladen, HTML-Datei öffnen, „Drucken“ → „Als PDF sichern“.`,
  '',
  '| Datei | Beispiel |',
  '| --- | --- |',
];

// Beispiele plus Belastungstest (Wächter K2: Fortsetzungsseiten statt Überlauf).
const all = [
  ...PRINT_EXAMPLES.map((example) => ({ example, doc: exampleDocument(example) })),
  { example: EXTREME_EXAMPLE, doc: extremeDocument() },
];
for (const { example, doc } of all) {
  const html = renderPrintHtml(translatePrintDocument(doc));
  const file = `${doc.meta.fileName}-${example.slug}.html`;
  writeFileSync(new URL(file, `file://${outDir}`), html);
  summary.push(`| \`${file}\` | ${example.description} |`);
  process.stdout.write(
    `geschrieben: pdf-vorschau/${file} (${Math.round(html.length / 1024)} KB)\n`,
  );
}

const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) writeFileSync(stepSummary, `${summary.join('\n')}\n`, { flag: 'a' });
