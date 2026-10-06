// @vitest-environment happy-dom
import { renderPrintHtml } from '@fitnessapp/ui/print';
import { describe, expect, it } from 'vitest';

import { exampleDocument, PRINT_EXAMPLES } from '../test/print-examples';
import { translatePrintDocument } from './print-document';
import { sanitizePrintTree } from './print-sanitize';

function sanitized(html: string): Element {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const main = parsed.querySelector('main');
  if (!main) throw new Error('kein main');
  sanitizePrintTree(main);
  return main;
}

describe('sanitizePrintTree (Wächter P3/P4 S1)', () => {
  it('entfernt Skripte, Bilder, Links, iframes und Ereignis-Attribute', () => {
    const main = sanitized(`<main><section class="page" onclick="alert(1)">
      <p>Text<img src="x" onerror="alert(2)"></p>
      <a href="javascript:alert(3)">Link</a>
      <script>alert(4)</script><iframe srcdoc="x"></iframe><object data="x"></object>
      <style>body{display:none}</style>
      <h2 id="t1" style="background:url(x.png)" onmouseover="alert(5)">Titel</h2>
      <table aria-labelledby="t1"><colgroup><col style="width:50.00%"><col style="width:expression(alert(6))"></colgroup>
      <tbody><tr><th scope="row" formaction="javascript:alert(7)">Zeile</th><td>1</td></tr></tbody></table>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(8)"><path fill="#1f5bff" d="M0 0"/><use href="#x"/></svg>
      <!-- Kommentar -->
    </section></main>`);
    const html = main.outerHTML;
    expect(html).not.toMatch(/<(img|a|script|iframe|object|style|use)\b/i);
    expect(html).not.toMatch(/\son\w+=|javascript:|href=|src=|url\(|expression|formaction/i);
    expect(html).not.toContain('<!--');
    // Erlaubtes bleibt.
    expect(html).toContain('<h2 id="t1">Titel</h2>');
    expect(html).toContain('aria-labelledby="t1"');
    expect(html).toContain('<col style="width:50.00%">');
    expect(html).toContain('<th scope="row">Zeile</th>');
    expect(html).toContain('<path fill="#1f5bff" d="M0 0">');
    expect(main.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1 1');
    expect(main.textContent).toContain('Text');
  });

  it('echte Druck-Dokumente bleiben unverändert', () => {
    for (const example of PRINT_EXAMPLES) {
      const html = renderPrintHtml(translatePrintDocument(exampleDocument(example)));
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const before = parsed.querySelector('main')?.outerHTML;
      expect(sanitized(html).outerHTML).toBe(before);
    }
  });
});
