import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normalizeLogo, renderAssetsModule } from '../../scripts/generate-print-assets.mjs';
import { ALPHA5_LOGO_SVG, ARCHIVO_WOFF2_BASE64 } from './assets.generated';
import { escapeHtml, PRINT_CSP, renderPrintHtml, splitPages } from './render-html';
import type { TranslatedDocument } from './types';

const EVIL = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'><svg onload=alert(1)>",
  '</style><script>alert(1)</script>',
  '</title><script>alert(1)</script>',
  '<!-- x --><iframe src="https://example.com">',
  'javascript:alert(1)',
];

function doc(evil: string): TranslatedDocument {
  return {
    lang: 'de',
    title: `Trainingsplan ${evil}`,
    footer: `Alpha5 ersetzt keine ärztliche Beratung. ${evil}`,
    logoLabel: `Alpha5 ${evil}`,
    blocks: [
      { type: 'heading', level: 1, text: `Dein Trainingsplan ${evil}` },
      { type: 'keyValue', items: [{ label: `Für ${evil}`, value: evil }] },
      { type: 'notice', title: `Vor dem Training ${evil}`, text: evil },
      { type: 'paragraph', text: evil, muted: true },
      { type: 'pageBreak', orientation: 'portrait' },
      { type: 'heading', level: 2, text: evil },
      {
        type: 'table',
        caption: `Übungen ${evil}`,
        columns: [
          { header: `Übung ${evil}`, role: 'label' },
          { header: 'Sätze', role: 'value' },
          { header: '1', role: 'log' },
        ],
        rows: [{ header: [evil, 'ersetzt (Gerät fehlt)'], cells: [[evil], []] }],
      },
    ],
  };
}

const SAMPLE: TranslatedDocument = {
  lang: 'de',
  title: 'Trainingsplan',
  footer: 'Alpha5 ersetzt keine ärztliche Beratung.',
  logoLabel: 'Alpha5',
  blocks: [
    { type: 'heading', level: 1, text: 'Dein Trainingsplan' },
    { type: 'pageBreak', orientation: 'portrait' },
    { type: 'heading', level: 2, text: 'Wochenübersicht' },
    { type: 'pageBreak', orientation: 'landscape' },
    { type: 'heading', level: 2, text: 'Ganzkörper A' },
    { type: 'pageBreak', orientation: 'portrait' },
    { type: 'pageBreak', orientation: 'portrait' },
    { type: 'paragraph', text: 'Ende' },
  ],
};

/** Inhalt ohne den eingebetteten <style>-Block (Schrift-Base64, CSS). */
const bodyOf = (html: string) => html.slice(html.indexOf('</head>'));

describe('escapeHtml', () => {
  it('escapt Text und Attribute; entfernt Steuerzeichen', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&\`=`)).toBe(
      '&lt;a href&#61;&quot;x&quot; onclick&#61;&#39;y&#39;&gt;&amp;&#96;&#61;',
    );
    expect(escapeHtml('a\u0000b\u001Fc\nd')).toBe('abc\nd');
  });
});

describe('renderPrintHtml – Sicherheit (B7)', () => {
  it.each(EVIL)('Eingabe %s wird harmlos', (evil) => {
    const html = renderPrintHtml(doc(evil));
    const body = bodyOf(html);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    // Genau ein </style> und ein </title> – kein Ausbruch.
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html.match(/<\/title>/g)).toHaveLength(1);
    // Der Text steht escapt als Textknoten im Dokument; nirgends als Link.
    expect(body).toContain(escapeHtml(evil));
    expect(html).not.toMatch(/href/i);
  });

  it('strikte CSP als erstes Meta nach charset; keine externen Verweise', () => {
    const html = renderPrintHtml(SAMPLE);
    expect(PRINT_CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
    );
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">`);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<style>'));
    // Einziger URL-Bezug ist der SVG-Namensraum (kein Laden); keine Links, keine http(s)-Quellen.
    const withoutNamespace = html.replaceAll('xmlns="http://www.w3.org/2000/svg"', '');
    expect(withoutNamespace).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link|<script|@import|src=/i);
    expect(html).toContain('url(data:font/woff2;base64,');
  });

  it('Titel kommt nur aus dem Dokument (die App gibt ihn ohne Namen) und ist escapt', () => {
    expect(renderPrintHtml(SAMPLE)).toContain('<title>Trainingsplan</title>');
    expect(renderPrintHtml(doc('<b>'))).toContain('<title>Trainingsplan &lt;b&gt;</title>');
  });

  it('ungültige Sprache → de (kein Attribut-Ausbruch)', () => {
    expect(renderPrintHtml({ ...SAMPLE, lang: 'de" onload="x' })).toContain('<html lang="de">');
    expect(renderPrintHtml({ ...SAMPLE, lang: 'de-AT' })).toContain('<html lang="de-AT">');
  });
});

describe('renderPrintHtml – Aufbau und Barrierefreiheit (B5, B9, B10)', () => {
  const html = renderPrintHtml(doc('x'));

  it('lang, Überschriften, Tabellen-Titel, th scope', () => {
    expect(html).toMatch(/^<!doctype html>\n<html lang="de">/);
    expect(html).toContain('<h1>');
    expect(html).toContain(
      '<p class="table-title" id="t2-2">Übungen x</p><div class="table-scroll"><table aria-labelledby="t2-2">',
    );
    expect(html).toContain('<th scope="col">Übung x</th>');
    expect(html).toContain('<th scope="row">');
    expect(html).toContain('<td class="log">');
    expect(html).toContain('role="img" aria-label="Alpha5 x"');
  });

  it('Tabellentitel als Überschrift: genau eine h2, Tabelle bleibt Tabelle im Scroll-Rahmen (S3, K3)', () => {
    const html = renderPrintHtml({
      ...SAMPLE,
      blocks: [
        {
          type: 'table',
          caption: 'Wochenübersicht',
          captionLevel: 2,
          columns: [
            { header: 'Woche', role: 'label' },
            { header: 'Mo', role: 'value' },
          ],
          rows: [{ header: ['Woche 1'], cells: [['Ruhetag']] }],
        },
      ],
    });
    expect(html.match(/Wochenübersicht/g)).toHaveLength(1);
    expect(html).toContain(
      '<h2 id="t1-1">Wochenübersicht</h2><div class="table-scroll"><table aria-labelledby="t1-1">',
    );
    expect(html).not.toMatch(/table\s*\{[^}]*display:\s*block/);
  });

  it('jede Seite hat eine Fußzeile mit Hinweis und kleinem Logo', () => {
    const pages = html.match(/<section class="page[^"]*">[\s\S]*?<\/section>/g) ?? [];
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page).toMatch(
        /<footer class="page-footer"><span>Alpha5 ersetzt keine ärztliche Beratung\. x<\/span><svg aria-hidden="true"/,
      );
    }
    // Logo groß nur auf der ersten Seite.
    expect(pages[0]).toContain('class="brand"');
    expect(pages[1]).not.toContain('class="brand"');
  });

  it('A4, @page ohne Rand, keine Randboxen; Mindestschrift 10 pt', () => {
    expect(html).toContain('@page { size: A4 portrait; margin: 0; }');
    expect(html).toContain('@page quer { size: A4 landscape; margin: 0; }');
    expect(html).toContain('width: 210mm');
    expect(html).not.toMatch(/@(top|bottom)-(left|center|right)/);
    const sizes = [...html.matchAll(/font-size:\s*([\d.]+)pt/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
    expect(html).not.toMatch(/font-size:\s*[\d.]+(px|em|rem)/);
  });

  it('Seiten trennen: Querformat je Seite, leere Seiten entfallen', () => {
    expect(splitPages(SAMPLE.blocks).map((p) => [p.orientation, p.blocks.length])).toEqual([
      ['portrait', 1],
      ['portrait', 1],
      ['landscape', 1],
      ['portrait', 1],
    ]);
    expect(renderPrintHtml(SAMPLE)).toContain('<section class="page page--landscape">');
  });
});

describe('assets.generated.ts (B6)', () => {
  it('ist aktuell (wie print-assets:check)', () => {
    const font = readFileSync(
      new URL(
        '../../../../apps/mobile/public/fonts/archivo-latin-wdth-normal.woff2',
        import.meta.url,
      ),
    );
    const logo = normalizeLogo(
      readFileSync(new URL('../../brand/alpha5-mark.svg', import.meta.url), 'utf8'),
    );
    const current = readFileSync(new URL('./assets.generated.ts', import.meta.url), 'utf8');
    expect(current.replace(/\r\n/g, '\n')).toBe(renderAssetsModule(font, logo));
    expect(Buffer.from(ARCHIVO_WOFF2_BASE64, 'base64').subarray(0, 4).toString()).toBe('wOF2');
    expect(ALPHA5_LOGO_SVG).toMatch(/^<svg [^>]*viewBox/);
  });

  it('Logo darf nur Pfade enthalten', () => {
    expect(() => normalizeLogo('<svg><script>alert(1)</script></svg>')).toThrow();
    expect(() => normalizeLogo('<svg><image href="https://x"/></svg>')).toThrow();
    expect(() => normalizeLogo('<svg onload="x"></svg>')).toThrow();
    expect(normalizeLogo('<svg>\n  <path d="M0 0"/>\n</svg>')).toBe('<svg><path d="M0 0"/></svg>');
  });
});
