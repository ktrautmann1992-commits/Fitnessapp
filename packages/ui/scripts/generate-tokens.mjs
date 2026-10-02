// @ts-check
/**
 * Erzeugt packages/ui/src/tokens.generated.ts aus packages/ui/theme.css.
 *
 *   node scripts/generate-tokens.mjs          → Datei neu schreiben
 *   node scripts/generate-tokens.mjs --check  → nur prüfen; Exit-Code 1, wenn die Datei nicht zur CSS passt
 *
 * Läuft in GitHub Actions (ci) automatisch mit --check. Anleitung: docs/DESIGN.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildTokens, renderTokensModule, ThemeError } from './theme-parser.mjs';

const cssPath = fileURLToPath(new URL('../theme.css', import.meta.url));
const outPath = fileURLToPath(new URL('../src/tokens.generated.ts', import.meta.url));
const checkOnly = process.argv.includes('--check');

/** @param {string} text */
const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');

function main() {
  let css;
  try {
    css = readFileSync(cssPath, 'utf8');
  } catch {
    console.error(`Fehler: ${cssPath} wurde nicht gefunden.`);
    return 1;
  }

  let result;
  try {
    result = buildTokens(css);
  } catch (error) {
    if (error instanceof ThemeError) {
      console.error(`Fehler: ${error.message}`);
      console.error('Hilfe: docs/DESIGN.md (Abschnitt „Pflicht-Variablen“).');
      return 1;
    }
    throw error;
  }

  for (const warning of result.warnings) console.warn(`Hinweis: ${warning}`);
  const expected = renderTokensModule(result.tokens);

  if (checkOnly) {
    let current = '';
    try {
      current = readFileSync(outPath, 'utf8');
    } catch {
      // Datei fehlt → gilt als veraltet.
    }
    if (normalizeNewlines(current) !== expected) {
      console.error(
        'Fehler: src/tokens.generated.ts passt nicht zu theme.css – die App hätte sonst andere Farben als die Website.\n' +
          'Lösung: In einer Claude-Code-Sitzung schreiben: „Erzeuge die Design-Tokens aus theme.css neu.“\n' +
          '(technisch: pnpm --filter @fitnessapp/ui tokens)',
      );
      return 1;
    }
    console.log('OK: tokens.generated.ts passt zu theme.css.');
    return 0;
  }

  writeFileSync(outPath, expected);
  console.log('tokens.generated.ts wurde aus theme.css erzeugt.');
  return 0;
}

process.exitCode = main();
