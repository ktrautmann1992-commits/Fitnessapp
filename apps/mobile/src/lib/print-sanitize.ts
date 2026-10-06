/**
 * Zweite Schutzschicht für die Druckansicht im Browser (Wächter P3/P4 S1, B7): Die CSP-Meta des Druck-HTML gilt
 * nicht, sobald die Knoten in die App-Seite gehängt werden. Darum werden nach dem Einlesen (DOMParser) nur die
 * Elemente und Attribute behalten, die der Renderer aus packages/ui wirklich erzeugt – alles andere fliegt raus
 * (Skripte, Bilder, Links, Ereignis-Attribute, fremde Stile). Der Renderer escapt ohnehin alles; das hier greift
 * nur, falls dort einmal ein Fehler passiert.
 */

const ALLOWED_ELEMENTS = new Set([
  'main',
  'section',
  'header',
  'footer',
  'aside',
  'h1',
  'h2',
  'h3',
  'p',
  'span',
  'strong',
  'div',
  'dl',
  'dt',
  'dd',
  'table',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'svg',
  'path',
]);

const ALLOWED_ATTRIBUTES = new Set(['class', 'id', 'lang', 'scope', 'role', 'focusable']);
const SVG_ATTRIBUTES = new Set(['viewbox', 'd', 'fill', 'xmlns']);
/** Breite einer Tabellenspalte, wie sie der Renderer setzt (`width:12.50%`). */
const COL_STYLE = /^width:\d{1,3}(\.\d{1,2})?%$/;
/** Werte ohne Skript-Schemata und Klammern (z. B. `url(…)`, `javascript:`). */
const SAFE_VALUE = /^[^<>()]*$/;

function keepAttribute(element: Element, name: string, value: string): boolean {
  const tag = element.localName.toLowerCase();
  const attr = name.toLowerCase();
  if (attr.startsWith('on')) return false;
  if (!SAFE_VALUE.test(value) || /javascript:|data:/i.test(value)) return false;
  if (attr === 'style') return tag === 'col' && COL_STYLE.test(value.replace(/\s+/g, ''));
  if (attr === 'fill') return tag === 'path' && /^#[0-9a-f]{3,8}$/i.test(value);
  if (SVG_ATTRIBUTES.has(attr)) return tag === 'svg' || tag === 'path';
  return ALLOWED_ATTRIBUTES.has(attr) || attr.startsWith('aria-');
}

/** Entfernt alle nicht erlaubten Elemente (samt Inhalt) und Attribute unterhalb von `root` (inkl. root). */
export function sanitizePrintTree(root: Element): void {
  const walk = (element: Element) => {
    for (const attr of [...element.attributes]) {
      if (!keepAttribute(element, attr.name, attr.value)) element.removeAttribute(attr.name);
    }
    for (const child of [...element.children]) {
      if (ALLOWED_ELEMENTS.has(child.localName.toLowerCase())) walk(child);
      else child.remove();
    }
  };
  walk(root);
  // Kommentare und Verarbeitungsanweisungen entfernen (nur Text- und Element-Knoten bleiben).
  const strip = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) strip(child);
      else if (child.nodeType !== 3) child.remove();
    }
  };
  strip(root);
}
