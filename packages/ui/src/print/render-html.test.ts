import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normalizeLogo, renderAssetsModule } from '../../scripts/generate-print-assets.mjs';
import { ALPHA5_LOGO_SVG, ARCHIVO_WOFF2_BASE64 } from './assets.generated';
import {
  escapeHtml,
  LARGE_PRINT_FONT_SCALE,
  scalePrintFontSizes,
  PRINT_CSP,
  renderPrintHtml,
  scopedPrintStyles,
  splitPages,
} from './render-html';
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
      // Ernährungs-Dokumente (Etappe N6): Kästchen-Liste und Rezept-Schritte.
      {
        type: 'checklist',
        caption: `Obst ${evil}`,
        captionLevel: 3,
        columns: 2,
        checkedLabel: `erledigt ${evil}`,
        items: [
          { lines: [evil], checked: true },
          { lines: [`500 g ${evil}`], checked: false },
        ],
      },
      { type: 'steps', start: 1, items: [evil, `Schritt ${evil}`] },
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

describe('renderPrintHtml – Kästchen-Liste und Schritte (Etappe N6, PDF P5)', () => {
  const html = bodyOf(
    renderPrintHtml({
      ...SAMPLE,
      title: 'Einkaufsliste',
      blocks: [
        {
          type: 'checklist',
          caption: 'Obst & Gemüse',
          captionLevel: 3,
          columns: 2,
          checkedLabel: 'erledigt',
          items: [
            { lines: ['9 Stück Banane'], checked: true },
            { lines: ['700 g Champignons'], checked: false },
          ],
        },
        {
          type: 'checklist',
          caption: 'Vorrat',
          columns: 1,
          checkedLabel: 'erledigt',
          items: [{ lines: ['Salz'], checked: false }],
        },
        { type: 'pageBreak', orientation: 'portrait' },
        { type: 'steps', start: 1, items: ['Reis kochen.', 'Anbraten.'] },
        { type: 'pageBreak', orientation: 'portrait' },
        { type: 'steps', start: 8, items: ['Servieren.'] },
        { type: 'steps', start: Number.NaN, items: ['Ohne Start.'] },
      ],
    }),
  );

  it('Liste mit Titel (aria-labelledby), zweispaltig, Kästchen dekorativ, Haken + Screenreader-Text', () => {
    expect(html).toContain(
      '<h3 id="t1-1">Obst &amp; Gemüse</h3><ul class="checklist checklist--2" aria-labelledby="t1-1">',
    );
    expect(html).toContain(
      '<li class="checked"><span class="box" aria-hidden="true">✓</span><span class="check-text"><span class="line">9 Stück Banane</span><span class="sr-only">erledigt</span></span></li>',
    );
    expect(html).toContain(
      '<li><span class="box" aria-hidden="true"></span><span class="check-text"><span class="line">700 g Champignons</span></span></li>',
    );
    expect(html).toContain(
      '<p class="table-title" id="t1-2">Vorrat</p><ul class="checklist" aria-labelledby="t1-2">',
    );
  });

  it('Schritte als nummerierte Liste; Fortsetzung mit start, ungültiger Start ohne Attribut', () => {
    expect(html).toContain('<ol class="steps"><li>Reis kochen.</li><li>Anbraten.</li></ol>');
    expect(html).toContain('<ol class="steps" start="8"><li>Servieren.</li></ol>');
    expect(html).toContain('<ol class="steps"><li>Ohne Start.</li></ol>');
  });

  it('jede Seite hat Fußzeile; Druck-CSS kennt die neuen Bausteine (auch im Bereich der Vorschau)', () => {
    expect(html.match(/<section class="page">/g)).toHaveLength(3);
    expect(html.match(/class="page-footer"/g)).toHaveLength(3);
    const scoped = scopedPrintStyles(['.vorschau']);
    expect(scoped).toContain('.vorschau ul.checklist--2 {');
    expect(scoped).toContain('.vorschau ol.steps li {');
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

describe('scopedPrintStyles – Druckansicht im Browser (Wächter P3/P4 S2)', () => {
  const css = scopedPrintStyles(['.vorschau', '#druck']);

  /** Alle Selektoren außerhalb von @-Regeln-Köpfen. */
  function selectors(text: string): string[] {
    const found: string[] = [];
    const walk = (part: string) => {
      let i = 0;
      while (i < part.length) {
        const open = part.indexOf('{', i);
        if (open === -1) return;
        const head = part.slice(i, open).trim();
        let depth = 1;
        let j = open + 1;
        while (j < part.length && depth > 0) {
          if (part[j] === '{') depth += 1;
          else if (part[j] === '}') depth -= 1;
          j += 1;
        }
        if (head.startsWith('@media')) walk(part.slice(open + 1, j - 1));
        else if (!head.startsWith('@')) found.push(...head.split(',').map((s) => s.trim()));
        i = j;
      }
    };
    walk(text);
    return found;
  }

  it('jede Regel gilt nur in Vorschau bzw. Druck-Kopie; html/body werden zum Bereich', () => {
    const all = selectors(css);
    expect(all.length).toBeGreaterThan(40);
    for (const sel of all) expect(sel).toMatch(/^(\.vorschau|#druck)( |$)/);
    expect(all).toContain('.vorschau');
    expect(all).toContain('#druck .page--landscape');
    expect(all).toContain('.vorschau .table-scroll');
    expect(all).not.toContain('body');
    expect(all.some((s) => /(^| )(html|body)( |$)/.test(s))).toBe(false);
  });

  it('Schrift und @page einmal global; gleiche Regeln wie im eigenständigen HTML', () => {
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css.match(/@page quer/g)).toHaveLength(1);
    expect(css.match(/@media print/g)).toHaveLength(2);
    const standalone = renderPrintHtml(doc('x'));
    expect(standalone).toContain('* { box-sizing: border-box; }');
    expect(standalone).toContain('@page { size: A4 portrait; margin: 0; }');
  });
});

describe('renderPrintHtml – Großdruck (FA5, docs/PLAN-FIT-IM-ALTER.md 12 Nr. 7)', () => {
  const sizes = (html: string) =>
    [...html.matchAll(/font-size:\s*([\d.]+)pt/g)].map((m) => Number(m[1]));

  it('vergrößert alle Schriften um den Faktor 1,4 – kleinste Schrift mindestens 14 pt', () => {
    const normal = sizes(renderPrintHtml(SAMPLE));
    const large = sizes(renderPrintHtml(SAMPLE, { largePrint: true }));
    expect(large).toHaveLength(normal.length);
    expect(Math.min(...large)).toBeGreaterThanOrEqual(14);
    large.forEach((size, i) =>
      expect(size).toBeCloseTo((normal[i] ?? 0) * LARGE_PRINT_FONT_SCALE, 0),
    );
  });

  it('ohne Großdruck bleibt das HTML gleich', () => {
    expect(renderPrintHtml(SAMPLE, { largePrint: false })).toBe(renderPrintHtml(SAMPLE));
  });

  it('rundet auf halbe Punkte und lässt andere Einheiten in Ruhe', () => {
    expect(scalePrintFontSizes('a{font-size: 11pt; width: 10mm}', 1.4)).toBe(
      'a{font-size: 15.5pt; width: 10mm}',
    );
    expect(scalePrintFontSizes('a{font-size: 11pt}', 1)).toBe('a{font-size: 11pt}');
  });
});
