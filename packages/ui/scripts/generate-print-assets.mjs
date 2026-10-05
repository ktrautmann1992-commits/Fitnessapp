// @ts-check
/**
 * Erzeugt packages/ui/src/print/assets.generated.ts für den PDF-Export (docs/PLAN-PDF-EXPORT.md §5, Wächter B6):
 * Schrift Archivo (OFL, Latin-woff2, variable Stärke/Breite) als Base64 und das Logo als SVG-String. So braucht das
 * Druck-HTML keine Verbindung zu fremden Servern und funktioniert offline.
 *
 *   node scripts/generate-print-assets.mjs          → Datei neu schreiben
 *   node scripts/generate-print-assets.mjs --check  → nur prüfen; Exit-Code 1, wenn die Datei veraltet ist
 *
 * Läuft in GitHub Actions (ci) automatisch mit --check.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fontPath = fileURLToPath(
  new URL('../../../apps/mobile/public/fonts/archivo-latin-wdth-normal.woff2', import.meta.url),
);
const logoPath = fileURLToPath(new URL('../brand/alpha5-mark.svg', import.meta.url));
const outPath = fileURLToPath(new URL('../src/print/assets.generated.ts', import.meta.url));
const checkOnly = process.argv.includes('--check');

/** @param {string} text */
const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');

/**
 * Logo als eine Zeile ohne XML-Kommentare. Nur ein reiner Pfad ist erlaubt (kein Skript, keine externen Verweise).
 * @param {string} svg
 */
export function normalizeLogo(svg) {
  const compact = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  if (/<script|href|on[a-z]+=|url\(|<foreignObject|<style/i.test(compact)) {
    throw new Error('Logo darf nur Pfade enthalten (kein Skript, keine Verweise).');
  }
  if (!compact.startsWith('<svg') || !compact.endsWith('</svg>')) {
    throw new Error('Logo ist kein SVG.');
  }
  return compact;
}

/**
 * @param {Buffer} font
 * @param {string} logo
 */
export function renderAssetsModule(font, logo) {
  const sha = createHash('sha256').update(font).digest('hex').slice(0, 16);
  return `/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Quellen: apps/mobile/public/fonts/archivo-latin-wdth-normal.woff2 (Archivo, SIL Open Font License 1.1,
 * Lizenz in packages/ui/brand/fonts/OFL.txt) und packages/ui/brand/alpha5-mark.svg.
 * Neu erzeugen: pnpm --filter @fitnessapp/ui print-assets (in CI geprüft mit print-assets:check).
 */

/** Archivo (variable Stärke 100–900, Breite 62–125 %), Latin, woff2 als Base64. SHA-256 (gekürzt): ${sha} */
export const ARCHIVO_WOFF2_BASE64 =
  '${font.toString('base64')}';

/** Alpha5-Logo „α5“ als SVG (reiner Pfad, Blau #1f5bff). */
export const ALPHA5_LOGO_SVG =
  '${logo.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
`;
}

function main() {
  let font;
  let logo;
  try {
    font = readFileSync(fontPath);
    logo = normalizeLogo(readFileSync(logoPath, 'utf8'));
  } catch (error) {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const expected = renderAssetsModule(font, logo);
  if (checkOnly) {
    let current = '';
    try {
      current = readFileSync(outPath, 'utf8');
    } catch {
      // Datei fehlt → gilt als veraltet.
    }
    if (normalizeNewlines(current) !== expected) {
      console.error(
        'Fehler: src/print/assets.generated.ts passt nicht zu Schrift bzw. Logo.\n' +
          'Lösung: In einer Claude-Code-Sitzung schreiben: „Erzeuge die Druck-Assets neu.“\n' +
          '(technisch: pnpm --filter @fitnessapp/ui print-assets)',
      );
      return 1;
    }
    console.log('OK: assets.generated.ts passt zu Schrift und Logo.');
    return 0;
  }
  writeFileSync(outPath, expected);
  console.log('assets.generated.ts wurde erzeugt.');
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
