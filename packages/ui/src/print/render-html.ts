import { APP_NAME } from '../brand';
import { brandColors } from '../tokens';
import { ALPHA5_LOGO_SVG, ARCHIVO_WOFF2_BASE64 } from './assets.generated';
import type {
  TranslatedBlock,
  TranslatedDocument,
  TranslatedOrientation,
  TranslatedTable,
} from './types';

/**
 * Übersetztes Dokument → eigenständiges HTML für den Druck bzw. „Als PDF sichern“ (docs/PLAN-PDF-EXPORT.md §3–§5).
 * Reine Darstellung, keine Fachlogik.
 *
 * - A4 (210 × 297 mm), `@page { margin: 0 }`, Innenränder im HTML (B3, B5). Keine Seitenzahlen über
 *   `@page`-Randboxen (Safari) – Fußzeile als normales Element am Ende jeder Seite.
 * - Sicher (B7): ALLE Texte werden escapt und nur als Textknoten ausgegeben; Attribute sind feste Werte (Sprache
 *   geprüft). Strikte CSP – kein Skript, kein Nachladen; Schrift und Logo eingebettet (B6).
 * - Tabellen in Archivo (leicht schmal, eingebettet): gleiche Spaltenbreiten auf allen Geräten, unabhängig von der
 *   Systemschrift; Fließtext in Systemschrift.
 * - Barrierefrei (B10): `lang`, Überschriften-Hierarchie, Tabellen-Titel (`aria-labelledby`), `<th scope="col|row">`, Logo mit
 *   Text-Alternative; Mindestschrift 10 pt; nichts nur über Farbe.
 */

/** Content-Security-Policy des Druck-HTML (B7). */
export const PRINT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
};

/** Steuerzeichen (außer Zeilenumbruch und Tab) entfernen. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Escapt Text für Textknoten UND Attributwerte. */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(CONTROL, '')
    .replace(/[&<>"'`=]/g, (c) => ESCAPES[c] as string);
}

/** Nur gültige Sprach-Tags; sonst Deutsch. */
function safeLang(lang: string): string {
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang) ? lang : 'de';
}

const c = brandColors;

/** Regeln, die global gelten müssen (Schrift, Seitenformat). */
function globalStyles(): string {
  return `
@font-face {
  font-family: 'Archivo';
  src: url(data:font/woff2;base64,${ARCHIVO_WOFF2_BASE64}) format('woff2');
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-style: normal;
  font-display: block;
}
@page { size: A4 portrait; margin: 0; }
@page quer { size: A4 landscape; margin: 0; }
`;
}

/** Regeln des Dokuments (Selektoren für das eigenständige Druck-HTML). */
function documentStyles(): string {
  return `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: ${c.hell};
  color: ${c.schwarz};
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.35;
}
.page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 8mm;
  padding: 12mm 14mm 22mm;
  background: ${c.weiss};
  break-after: page;
  page-break-after: always;
}
.page:last-child { break-after: auto; page-break-after: auto; }
.page--landscape { width: 297mm; min-height: 210mm; padding: 8mm 12mm 16mm; page: quer; }
h1, h2, h3, .h1, .h2, .h3 {
  font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-weight: 800;
  font-stretch: 75%;
  line-height: 1.15;
  margin: 0 0 3.5mm;
  break-after: avoid;
  page-break-after: avoid;
}
h1, .h1 { font-size: 28pt; }
h2, .h2 { font-size: 17pt; margin-top: 2mm; }
h3, .h3 { font-size: 12.5pt; margin-top: 4mm; margin-bottom: 2.5mm; }
p { margin: 0 0 3mm; }
.muted { color: ${c.grau}; font-size: 10pt; }
.brand {
  display: flex;
  align-items: center;
  gap: 5mm;
  padding-bottom: 6mm;
  margin-bottom: 10mm;
  border-bottom: 2pt solid ${c.blau};
}
.brand svg { height: 18mm; width: auto; display: block; }
.brand-name {
  font-family: 'Archivo', system-ui, sans-serif;
  font-weight: 800;
  font-stretch: 75%;
  font-size: 20pt;
  letter-spacing: 0.02em;
}
dl.kv { display: flex; flex-wrap: wrap; gap: 1.5mm 8mm; margin: 0 0 4mm; }
dl.kv div { display: flex; gap: 2mm; }
dl.kv dt { font-weight: 700; }
dl.kv dd { margin: 0; }
.notice {
  border-left: 3pt solid ${c.blau};
  background: ${c.eisblau};
  padding: 3mm 4mm;
  margin: 5mm 0;
  break-inside: avoid;
}
.notice-title { font-weight: 700; display: block; margin-bottom: 1mm; }
table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-stretch: 90%;
  font-size: 10pt;
  margin: 0 0 3mm;
}
.table-title { font-weight: 700; margin: 3mm 0 1.5mm; break-after: avoid; page-break-after: avoid; }
th, td {
  border: 0.75pt solid ${c.grauDunkel};
  padding: 1.2mm 1.2mm;
  text-align: left;
  vertical-align: top;
  overflow-wrap: break-word;
  hyphens: auto;
}
thead th { background: ${c.eisblau}; font-weight: 700; overflow-wrap: normal; }
tbody th { font-weight: 600; }
tr { break-inside: avoid; page-break-inside: avoid; }
td.log { height: 8mm; }
.line { display: block; }
.line + .line { color: ${c.grau}; font-weight: 400; }
.page-footer {
  position: absolute;
  left: 14mm;
  right: 14mm;
  bottom: 10mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6mm;
  border-top: 0.75pt solid ${c.grauDunkel};
  padding-top: 2.5mm;
  font-size: 10pt;
  color: ${c.grau};
}
.page--landscape .page-footer { left: 12mm; right: 12mm; bottom: 6mm; }
.page--landscape h2, .page--landscape .h2 { margin-top: 0; }
.page--landscape h3, .page--landscape .h3 { margin-top: 2.5mm; }
.page--landscape p, .page--landscape dl.kv { margin-bottom: 2mm; }
.page--landscape td.log { height: 7mm; }
.page-footer svg { height: 5mm; width: auto; display: block; }
@media print {
  body { background: ${c.weiss}; }
  .page { margin: 0; }
}
@media screen and (max-width: 800px) {
  .page, .page--landscape { width: auto; min-height: 0; margin: 0 0 4mm; padding: 6mm 4mm; }
  .page-footer { position: static; margin-top: 6mm; }
  /* Tabelle bleibt Tabelle (Semantik für VoiceOver); gescrollt wird der Rahmen. */
  .table-scroll { overflow-x: auto; }
  table { table-layout: auto; min-width: 150mm; }
}
`;
}

/** Logo inline (kein Nachladen); `label` leer = dekorativ. */
function logo(label: string): string {
  const svg = ALPHA5_LOGO_SVG.replace(
    '<svg ',
    label === ''
      ? '<svg aria-hidden="true" focusable="false" '
      : `<svg role="img" aria-label="${escapeHtml(label)}" `,
  );
  return svg;
}

const lines = (values: readonly string[]) =>
  values.map((v) => `<span class="line">${escapeHtml(v)}</span>`).join('');

/**
 * Spaltenbreiten (feste Tabelle, damit nichts über den Rand ragt): Zeilenkopf breiter, bei Mitschreib-Tabellen
 * noch breiter (Übungsnamen); Mitschreib-Felder etwas schmaler als Werte.
 */
function colgroup(table: TranslatedTable): string {
  const hasLog = table.columns.some((col) => col.role === 'log');
  const weights = table.columns.map((col) => {
    if (col.role === 'label') {
      if (!hasLog) return table.columns.length > 6 ? 1.2 : 2.2;
      return table.columns.length > 10 ? 3.6 : 3;
    }
    return col.role === 'log' ? 1 : hasLog ? 1.3 : 1.2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return `<colgroup>${weights
    .map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`)
    .join('')}</colgroup>`;
}

/**
 * Tabellen-Titel als Absatz mit `aria-labelledby` statt `<caption>`: Chrome bricht Tabellen mit `<caption>` auf
 * Querformat-Seiten (benannte @page) unnötig auf eine neue Seite um.
 */
function renderTable(table: TranslatedTable, id: string): string {
  const head = table.columns
    .map((col) => `<th scope="col">${escapeHtml(col.header)}</th>`)
    .join('');
  const body = table.rows
    .map((row) => {
      const cells = row.cells
        .map((cell, index) => {
          const role = table.columns[index + 1]?.role;
          return role === 'log' ? `<td class="log">${lines(cell)}</td>` : `<td>${lines(cell)}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${lines(row.header)}</th>${cells}</tr>`;
    })
    .join('');
  const title = escapeHtml(table.caption);
  // Titel als Überschrift (captionLevel) oder als Absatz – nie doppelt (Wächter S3).
  const heading =
    table.captionLevel === 2
      ? `<h2 id="${id}">${title}</h2>`
      : table.captionLevel === 3
        ? `<h3 id="${id}">${title}</h3>`
        : `<p class="table-title" id="${id}">${title}</p>`;
  return `${heading}<div class="table-scroll"><table aria-labelledby="${id}">${colgroup(table)}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderBlock(block: TranslatedBlock, id: string): string {
  switch (block.type) {
    case 'heading': {
      const tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
      return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
    }
    case 'paragraph':
      return block.muted
        ? `<p class="muted">${escapeHtml(block.text)}</p>`
        : `<p>${escapeHtml(block.text)}</p>`;
    case 'keyValue':
      return `<dl class="kv">${block.items
        .map((i) => `<div><dt>${escapeHtml(i.label)}</dt><dd>${escapeHtml(i.value)}</dd></div>`)
        .join('')}</dl>`;
    case 'table':
      return renderTable(block, id);
    case 'notice':
      return `<aside class="notice"><strong class="notice-title">${escapeHtml(block.title)}</strong>${escapeHtml(block.text)}</aside>`;
    case 'pageBreak':
      return '';
    default: {
      const never: never = block;
      return never;
    }
  }
}

interface Page {
  orientation: TranslatedOrientation;
  blocks: TranslatedBlock[];
}

/** Blöcke an `pageBreak` in Seiten teilen (leere Seiten entfallen). */
export function splitPages(blocks: readonly TranslatedBlock[]): Page[] {
  const pages: Page[] = [{ orientation: 'portrait', blocks: [] }];
  for (const block of blocks) {
    const current = pages.at(-1) as Page;
    if (block.type === 'pageBreak') {
      const orientation = block.orientation === 'landscape' ? 'landscape' : 'portrait';
      if (current.blocks.length === 0) current.orientation = orientation;
      else pages.push({ orientation, blocks: [] });
      continue;
    }
    current.blocks.push(block);
  }
  return pages.filter((page) => page.blocks.length > 0);
}

/** Erzeugt das vollständige, eigenständige Druck-HTML. */
export function renderPrintHtml(doc: TranslatedDocument): string {
  const footer = `<footer class="page-footer"><span>${escapeHtml(doc.footer)}</span>${logo('')}</footer>`;
  const pages = splitPages(doc.blocks)
    .map((page, index) => {
      const brand =
        index === 0
          ? `<header class="brand">${logo(doc.logoLabel)}<span class="brand-name" aria-hidden="true">${escapeHtml(APP_NAME)}</span></header>`
          : '';
      const cls = page.orientation === 'landscape' ? 'page page--landscape' : 'page';
      return `<section class="${cls}">${brand}${page.blocks.map((block, n) => renderBlock(block, `t${index + 1}-${n + 1}`)).join('')}${footer}</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="${safeLang(doc.lang)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title)}</title>
<style>${globalStyles()}${documentStyles()}</style>
</head>
<body>
<main>
${pages}
</main>
</body>
</html>
`;
}

/**
 * Selektoren einer Regel auf einen Bereich begrenzen: `html`/`body` werden zum Bereich selbst, alles andere wird
 * zum Nachfahren des Bereichs. Gilt nur für das CSS dieses Renderers (keine Kommas in Klammern).
 */
function scopeSelectors(selectors: string, scope: string): string {
  return selectors
    .split(',')
    .map((raw) => {
      const sel = raw.trim();
      if (sel === 'html' || sel === 'body') return scope;
      return `${scope} ${sel}`;
    })
    .join(', ');
}

/** CSS-Text blockweise durchgehen; `@media` rekursiv, andere @-Regeln unverändert. */
function scopeCss(css: string, scope: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@media')) out += `${head} {${scopeCss(body, scope)}}\n`;
    else if (head.startsWith('@')) out += `${head} {${body}}\n`;
    else if (head.startsWith('/*')) {
      // Kommentar vor der Regel: abtrennen.
      const end = head.indexOf('*/') + 2;
      out += `${scopeSelectors(head.slice(end), scope)} {${body}}\n`;
    } else out += `${scopeSelectors(head, scope)} {${body}}\n`;
    i = j;
  }
  return out;
}

/**
 * Druck-CSS für die Druckansicht im Browser (Wächter P3/P4 S2): Schrift und `@page` global, alle übrigen Regeln
 * nur innerhalb der angegebenen Bereiche (z. B. Vorschau und Druck-Kopie) – die App-Oberfläche bleibt unberührt.
 */
export function scopedPrintStyles(scopes: readonly string[]): string {
  return [globalStyles(), ...scopes.map((scope) => scopeCss(documentStyles(), scope))].join('\n');
}
