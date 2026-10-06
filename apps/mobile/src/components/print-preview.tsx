import { scopedPrintStyles } from '@fitnessapp/ui/print';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { sanitizePrintTree } from '@/lib/print-sanitize';

/**
 * Druckansicht im Browser (docs/PLAN-PDF-EXPORT.md §3 „Web“, Wächter B5). Gegenstück für iPhone/Android:
 * print-preview.native.tsx (dort druckt expo-print das HTML direkt).
 *
 * Das Druck-HTML aus packages/ui wird mit DOMParser gelesen, gegen eine Erlaubnisliste bereinigt (lib/print-sanitize,
 * Wächter S1 – die CSP-Meta des HTML gilt in der App-Seite nicht) und zweimal eingehängt:
 * 1. als Vorschau in der App (Handy-Layout, scrollt mit der Seite),
 * 2. als Druck-Kopie direkt unter <body>, die NUR beim Drucken sichtbar ist (A4, `@page { margin: 0 }`,
 *    benannte Seite „quer“). Beim Drucken wird alles andere (App, Dialoge) ausgeblendet.
 * Das Druck-CSS gilt nur in diesen beiden Bereichen (scopedPrintStyles, Wächter S2); global sind nur Schrift und
 * `@page`. Es wird einmal eingehängt, nicht bei jeder Änderung. Beim Verlassen wird alles entfernt; nichts wird
 * gespeichert.
 */

const STYLE_ID = 'alpha5-print-style';
const PRINT_ROOT_ID = 'alpha5-print-root';
const HTML_CLASS = 'alpha5-print';

const SYSTEM_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Ergänzungen: Vorschau in der App (immer Handy-Layout) und Druck nur der Druck-Kopie. */
const SUPPLEMENT = `
#${PRINT_ROOT_ID} { display: none; }
#root .a5-print-preview, #root .a5-print-preview * { font-family: ${SYSTEM_FONT}; }
#root .a5-print-preview :is(.h1, .h2, .h3, table, th, td, .brand-name) {
  font-family: 'Archivo', ${SYSTEM_FONT};
}
.a5-print-preview { background: transparent; }
.a5-print-preview main { display: block; }
.a5-print-preview .page, .a5-print-preview .page--landscape {
  width: auto; min-height: 0; margin: 0 0 4mm; padding: 6mm 4mm;
  border: 1px solid rgba(10, 12, 16, 0.15); border-radius: 8px;
}
.a5-print-preview .page-footer { position: static; margin-top: 6mm; }
.a5-print-preview .table-scroll { overflow-x: auto; }
.a5-print-preview table { table-layout: auto; min-width: 150mm; }
@media print {
  html.${HTML_CLASS}, html.${HTML_CLASS} body {
    height: auto !important; overflow: visible !important; background: #fff !important;
  }
  html.${HTML_CLASS} body > :not(#${PRINT_ROOT_ID}) { display: none !important; }
  html.${HTML_CLASS} #${PRINT_ROOT_ID} { display: block; }
}
`;

/** IDs der Druck-Kopie umbenennen, damit sie nicht mit der Vorschau kollidieren (aria-labelledby). */
function prefixIds(root: Element, prefix: string) {
  for (const el of root.querySelectorAll('[id]')) el.id = `${prefix}${el.id}`;
  for (const el of root.querySelectorAll('[aria-labelledby]')) {
    const ids = el.getAttribute('aria-labelledby') ?? '';
    el.setAttribute(
      'aria-labelledby',
      ids
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => `${prefix}${id}`)
        .join(' '),
    );
  }
}

/** Druck-CSS (nur in Vorschau und Druck-Kopie) und Ergänzungen – solange die Druckansicht offen ist. */
function usePrintStyles() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${scopedPrintStyles(['.a5-print-preview', `#${PRINT_ROOT_ID}`])}\n${SUPPLEMENT}`;
    document.head.appendChild(style);
    document.documentElement.classList.add(HTML_CLASS);
    return () => {
      style.remove();
      document.documentElement.classList.remove(HTML_CLASS);
    };
  }, []);
}

export function PrintPreview({ html, title }: { html: string; title: string }) {
  const hostRef = useRef<View>(null);
  usePrintStyles();

  useEffect(() => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const main = parsed.querySelector('main');
    if (!main) return undefined;
    sanitizePrintTree(main);
    const lang = parsed.documentElement.lang || 'de';

    // 1. Vorschau in der App (react-native-web: die View ist ein <div>). Überschriften eine Stufe tiefer
    //    ankündigen – die Seite hat schon „Plan als PDF“ als oberste Überschrift (Wächter K4).
    const host = hostRef.current as unknown as HTMLElement | null;
    const preview = document.createElement('div');
    preview.className = 'a5-print-preview';
    preview.lang = lang;
    const shown = document.importNode(main, true);
    for (const heading of shown.querySelectorAll('h1, h2, h3')) {
      const level = Number(heading.localName.slice(1));
      const replacement = document.createElement('div');
      for (const attr of heading.attributes) replacement.setAttribute(attr.name, attr.value);
      replacement.classList.add(`h${level}`);
      replacement.setAttribute('role', 'heading');
      replacement.setAttribute('aria-level', String(level + 1));
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);
    }
    preview.appendChild(shown);
    host?.replaceChildren(preview);

    // 2. Druck-Kopie direkt unter <body> (nur beim Drucken sichtbar, für Screenreader verborgen).
    const printRoot = document.createElement('div');
    printRoot.id = PRINT_ROOT_ID;
    printRoot.lang = lang;
    printRoot.setAttribute('aria-hidden', 'true');
    const copy = document.importNode(main, true);
    prefixIds(copy, 'druck-');
    printRoot.appendChild(copy);
    document.body.appendChild(printRoot);

    const previousTitle = document.title;
    document.title = title;

    return () => {
      printRoot.remove();
      host?.replaceChildren();
      document.title = previousTitle;
    };
  }, [html, title]);

  return (
    <View
      ref={hostRef}
      testID="print-preview"
      accessibilityLabel={t.printView.previewLabel}
      role="region"
    />
  );
}
