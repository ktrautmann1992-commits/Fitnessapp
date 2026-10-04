// @ts-check
/**
 * Erzeugt alle App-Icons, Favicons und das Open-Graph-Bild aus dem Logo alpha5-mark.svg.
 *
 *   pnpm --filter @fitnessapp/ui icons
 *
 * Vorgaben (Größen, Hintergründe, Logo-Breite): docs/ALPHA5-PAKET.md, Abschnitt „Icons“.
 * - Das Logo ist immer waagerecht und senkrecht zentriert. „Breite“ = Anteil der Logo-Breite an der Kantenlänge.
 * - Alles wird als Vektor gerendert (SVG → PNG), das Logo also nie hochskaliert.
 * - Ergebnisse landen in brand/generated/ und werden zusätzlich dorthin kopiert, wo App und Website sie nutzen
 *   (Liste COPIES unten). Erzeugte Dateien werden eingecheckt – in GitHub Actions läuft das Skript nicht.
 * - Schrift im Open-Graph-Bild: Archivo Bold (OFL), liegt in brand/fonts/ (kein Download zur Laufzeit).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const brandDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(brandDir, '..', '..', '..');
const outDir = join(brandDir, 'generated');
const fontFile = join(brandDir, 'fonts', 'Archivo-Bold.ttf');

/** Farben aus der Marken-Palette (packages/ui/theme.css, --brand-…). */
const SCHWARZ = '#0a0c10';
const BLAU = '#1f5bff';
const WEISS = '#ffffff';

/** Deckkraft des blauen Scheins in der Mitte (außen 0 %). */
const GLOW_OPACITY = 0.28;

const OG_TEXT = 'Training und Ernährung, die zu dir passen.';

// ---------------------------------------------------------------------------------------------
// Logo einlesen
// ---------------------------------------------------------------------------------------------

const markSvg = readFileSync(join(brandDir, 'alpha5-mark.svg'), 'utf8');
const viewBoxMatch = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markSvg);
const innerMatch = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(markSvg);
if (!viewBoxMatch || !innerMatch) {
  throw new Error('alpha5-mark.svg: viewBox „0 0 B H“ oder Inhalt nicht gefunden.');
}
const MARK_W = Number(viewBoxMatch[1]);
const MARK_H = Number(viewBoxMatch[2]);
const MARK_INNER = /** @type {string} */ (innerMatch[1]).trim();

/** @param {number} n */
const fmt = (n) => String(Math.round(n * 1000) / 1000);

/**
 * Logo als verschachteltes <svg>, Mittelpunkt bei (cx, cy), Breite `width`. `color` färbt es einfarbig um.
 * @param {number} cx @param {number} cy @param {number} width @param {string} [color]
 */
function markAt(cx, cy, width, color) {
  const height = (width * MARK_H) / MARK_W;
  const inner = color ? MARK_INNER.replaceAll(`fill="${BLAU}"`, `fill="${color}"`) : MARK_INNER;
  return (
    `<svg x="${fmt(cx - width / 2)}" y="${fmt(cy - height / 2)}" width="${fmt(width)}" ` +
    `height="${fmt(height)}" viewBox="0 0 ${MARK_W} ${MARK_H}">${inner}</svg>`
  );
}

/**
 * Radialer Schein: #1f5bff mit GLOW_OPACITY in der Mitte, 0 % am Rand (Radius r).
 * @param {number} cx @param {number} cy @param {number} r
 */
function glow(cx, cy, r) {
  return (
    `<defs><radialGradient id="schein" gradientUnits="userSpaceOnUse" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}">` +
    `<stop offset="0" stop-color="${BLAU}" stop-opacity="${GLOW_OPACITY}"/>` +
    `<stop offset="1" stop-color="${BLAU}" stop-opacity="0"/>` +
    `</radialGradient></defs><rect width="100%" height="100%" fill="url(#schein)"/>`
  );
}

/**
 * Quadratisches Icon als SVG-Text.
 * @param {{ size: number, background: string | null, logoShare: number, withGlow?: boolean, markColor?: string }} options
 */
function squareSvg({ size, background, logoShare, withGlow = false, markColor }) {
  const c = size / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    (background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '') +
    (withGlow ? glow(c, c, c) : '') +
    markAt(c, c, size * logoShare, markColor) +
    `</svg>`
  );
}

/**
 * SVG → PNG. `opaque`: Alpha-Kanal entfernen (Stores verlangen Icons ohne Transparenz).
 * @param {string} svg @param {{ opaque: boolean, background?: string }} options
 */
async function renderPng(svg, { opaque, background = SCHWARZ }) {
  let image = sharp(Buffer.from(svg));
  if (opaque) image = image.flatten({ background }).removeAlpha();
  return image.png({ compressionLevel: 9 }).toBuffer();
}

// ---------------------------------------------------------------------------------------------
// Open-Graph-Bild: Logo (30 % Breite) mit Text darunter, beides zusammen mittig
// ---------------------------------------------------------------------------------------------

async function renderOgImage() {
  const W = 1200;
  const H = 630;
  const logoW = W * 0.3;
  const logoH = (logoW * MARK_H) / MARK_W;
  const gap = 56;

  // Text mit Archivo Bold rendern (Pango), weiß auf transparent.
  const escaped = OG_TEXT.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = await sharp({
    text: {
      text: `<span foreground="${WEISS}">${escaped}</span>`,
      font: 'Archivo Bold 46',
      fontfile: fontFile,
      dpi: 72,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  const textW = text.info.width;
  const textH = text.info.height;

  const groupH = logoH + gap + textH;
  const top = (H - groupH) / 2;
  const logoCy = top + logoH / 2;

  const base =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${SCHWARZ}"/>` +
    glow(W / 2, logoCy, H * 0.75) +
    markAt(W / 2, logoCy, logoW) +
    `</svg>`;

  return sharp(Buffer.from(base))
    .composite([
      {
        input: text.data,
        left: Math.round((W - textW) / 2),
        top: Math.round(top + logoH + gap),
      },
    ])
    .flatten({ background: SCHWARZ })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ---------------------------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------------------------

/** Tabelle „Icons“ aus docs/ALPHA5-PAKET.md. */
const SQUARE_ICONS = [
  {
    file: 'icon.png',
    size: 1024,
    background: SCHWARZ,
    logoShare: 0.66,
    withGlow: true,
    opaque: true,
  },
  { file: 'adaptive-icon.png', size: 1024, background: null, logoShare: 0.5, opaque: false },
  { file: 'splash-icon.png', size: 1024, background: null, logoShare: 0.5, opaque: false },
  // Zusätzlich (nicht in der Paket-Tabelle): Android 13+ „Designte Symbole“ – Android nutzt nur die Form (Alpha).
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    background: null,
    logoShare: 0.5,
    markColor: WEISS,
    opaque: false,
  },
  { file: 'favicon.png', size: 48, background: SCHWARZ, logoShare: 0.84, opaque: true },
  { file: 'apple-touch-icon.png', size: 180, background: SCHWARZ, logoShare: 0.7, opaque: true },
];

/** Wohin die erzeugten Dateien zusätzlich kopiert werden (Quelle in generated/ → Ziel ab Repo-Hauptordner). */
const COPIES = [
  ['icon.png', 'apps/mobile/assets/images/icon.png'],
  ['adaptive-icon.png', 'apps/mobile/assets/images/adaptive-icon.png'],
  ['splash-icon.png', 'apps/mobile/assets/images/splash-icon.png'],
  ['android-icon-monochrome.png', 'apps/mobile/assets/images/android-icon-monochrome.png'],
  ['favicon.png', 'apps/mobile/assets/images/favicon.png'],
  // Expo-Web-Export (output 'single'): public/ wird unverändert in dist/ kopiert. Safari holt sich
  // /apple-touch-icon.png beim „Zum Home-Bildschirm“ automatisch.
  ['apple-touch-icon.png', 'apps/mobile/public/apple-touch-icon.png'],
  // Next.js (App Router): Dateinamen-Konvention erzeugt die <link>-Tags selbst.
  ['favicon.svg', 'apps/web/src/app/icon.svg'],
  ['favicon.png', 'apps/web/src/app/icon.png'],
  ['apple-touch-icon.png', 'apps/web/src/app/apple-icon.png'],
  // Vorschaubild beim Teilen (Open Graph / X). Alt-Text: opengraph-image.alt.txt / twitter-image.alt.txt.
  ['og-image.png', 'apps/web/src/app/opengraph-image.png'],
  ['og-image.png', 'apps/web/src/app/twitter-image.png'],
];

async function main() {
  mkdirSync(outDir, { recursive: true });

  for (const icon of SQUARE_ICONS) {
    const png = await renderPng(squareSvg(icon), { opaque: icon.opaque });
    writeFileSync(join(outDir, icon.file), png);
    console.log(`erzeugt: ${icon.file} (${icon.size} × ${icon.size})`);
  }

  // favicon.svg bleibt Vektor (64 × 64, Logo 84 %).
  writeFileSync(
    join(outDir, 'favicon.svg'),
    squareSvg({ size: 64, background: SCHWARZ, logoShare: 0.84 }) + '\n',
  );
  console.log('erzeugt: favicon.svg (64 × 64)');

  writeFileSync(join(outDir, 'og-image.png'), await renderOgImage());
  console.log('erzeugt: og-image.png (1200 × 630)');

  for (const [source, target] of COPIES) {
    const to = join(repoRoot, /** @type {string} */ (target));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(outDir, /** @type {string} */ (source)), to);
    console.log(`kopiert: ${source} → ${relative(repoRoot, to)}`);
  }
}

await main();
