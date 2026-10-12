/**
 * Diagnose einer HTML-Antwort für die Zusammenfassung des Laufs (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b,
 * Lauf 3: Token-Link liefert HTML statt Datei; Wächter-Prüfung „Diagnose“ B1/S1/S2/K2/K4).
 *
 * REIN BESCHREIBEND: Die Funktion liest nur den schon geladenen Text. Sie löst keine Anfragen aus und befolgt
 * nichts – kein Formular-Absenden (POST), kein meta-refresh, kein Ausführen von Skripten, kein Folgen von Links.
 *
 * Robust gegen kaputtes/bösartiges HTML:
 * - Eingabe auf 128 KB gekappt (Vermerk in der Ausgabe);
 * - EIN linearer Durchlauf (eigener kleiner Tokenizer mit `indexOf`, keine Regex über offene Tag-Anfänge);
 * - jede Liste begrenzt, Gesamtausgabe höchstens 16 KB (Kürzungshinweis);
 * - alle Werte von der Seite als Inline-Code (`mdCode`), Codes/Token gekürzt (`maskTokens`).
 */
import { maskTokens, maskUrl } from './download-page';
import { decodeXmlText } from './xlsx';

export { maskTokens } from './download-page';

/** Grenzen der Diagnose (Zusammenfassung bleibt lesbar und unter der Grenze von GitHub). */
export const HTML_DIAGNOSIS_LIMITS = {
  /** Ausgewertete Eingabe. */
  inputBytes: 128 * 1024,
  /** Gesamtlänge der Ausgabe (Zeichen). */
  outputChars: 16 * 1024,
  text: 1500,
  /** Einträge je Liste. */
  list: 20,
  links: 40,
  forms: 5,
  fieldsPerForm: 20,
  scriptExcerpt: 300,
  /** Länge eines Tag-Inhalts (Attribute), der ausgewertet wird. */
  tagChars: 4000,
} as const;

/** Feldnamen, deren Werte immer gekürzt werden (unabhängig vom Typ, Wächter S2). */
const SECRET_FIELD = /token|csrf|key|session|auth|sig|nonce/i;

/**
 * Für Markdown: als Inline-Code, ohne Zeilenumbrüche/Backticks, gekürzt, Token maskiert. So werden Links, Bilder
 * und HTML von der Seite nie gerendert (Wächter K4).
 */
export function mdCode(value: string, max = 200, mask = true): string {
  // Erst kürzen, dann maskieren – die Laufzeit hängt so nie an der Länge der Eingabe (NS1).
  const cut = value.slice(0, max + 64);
  const clean = (mask ? maskTokens(cut) : cut)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/`/g, "'")
    .trim();
  if (clean === '') {
    return '–';
  }
  return `\`${clean.length > max || value.length > cut.length ? `${clean.slice(0, max)}…` : clean}\``;
}

const code = mdCode;

function attr(attrs: string, name: string): string | undefined {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  ).exec(attrs);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw === undefined ? undefined : decodeXmlText(raw);
}

function hasAttr(attrs: string, name: string): boolean {
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(attrs);
}

function cleanText(text: string): string {
  return decodeXmlText(text).replace(/\s+/g, ' ').trim();
}

function resolveUrl(raw: string | undefined, pageUrl: string): string {
  if (raw === undefined || raw.trim() === '') {
    return '(leer)';
  }
  try {
    return maskUrl(new URL(raw.trim(), pageUrl).toString());
  } catch {
    return raw.trim();
  }
}

/** Liste begrenzen und Anzahl nennen. */
function list(items: readonly string[], max: number = HTML_DIAGNOSIS_LIMITS.list): string {
  if (items.length === 0) {
    return '–';
  }
  const shown = items.slice(0, max).join(' · ');
  return items.length > max ? `${shown} · … (${items.length - max} weitere)` : shown;
}

// --- Tokenizer (linear) ----------------------------------------------------------------------------------

type Token =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'tag';
      readonly name: string;
      readonly closing: boolean;
      readonly attrs: string;
    }
  | {
      readonly kind: 'raw';
      readonly name: string;
      readonly attrs: string;
      readonly content: string;
    };

const RAW_ELEMENTS = new Set(['script', 'style', 'template', 'textarea']);

/**
 * Zerlegt HTML in Text, Tags und Roh-Elemente (script/style/template/textarea). Jede Position wird höchstens
 * einmal gesucht: das nächste „>“ wird zwischengespeichert; fehlt ein Abschluss, ist der Rest Text bzw. endet.
 */
function tokenize(html: string): Token[] {
  const lower = html.toLowerCase();
  const tokens: Token[] = [];
  let i = 0;
  let nextGt = -1;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      tokens.push({ kind: 'text', text: html.slice(i) });
      break;
    }
    if (lt > i) {
      tokens.push({ kind: 'text', text: html.slice(i, lt) });
    }
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) {
        break; // offener Kommentar: Rest ist Kommentar
      }
      i = end + 3;
      continue;
    }
    if (nextGt <= lt) {
      nextGt = html.indexOf('>', lt + 1);
    }
    if (nextGt < 0) {
      tokens.push({ kind: 'text', text: html.slice(lt) });
      break; // kein „>“ mehr: keine weiteren Tags
    }
    const inner = html.slice(lt + 1, Math.min(nextGt, lt + 1 + HTML_DIAGNOSIS_LIMITS.tagChars));
    const name = /^(\/?)([a-zA-Z][\w:-]*)/.exec(inner);
    if (name === null) {
      // „<!doctype …>“, „<?xml …>“ oder ein „<“ im Text: überspringen bzw. als Text behalten.
      if (/^[!?]/.test(inner)) {
        i = nextGt + 1;
      } else {
        tokens.push({ kind: 'text', text: '<' });
        i = lt + 1;
      }
      continue;
    }
    const tagName = (name[2] ?? '').toLowerCase();
    const closing = name[1] === '/';
    const attrs = inner.slice(name[0].length);
    i = nextGt + 1;
    if (!closing && RAW_ELEMENTS.has(tagName)) {
      const end = lower.indexOf(`</${tagName}`, i);
      const content = html.slice(i, end < 0 ? html.length : end);
      tokens.push({ kind: 'raw', name: tagName, attrs, content });
      if (end < 0) {
        break;
      }
      const close = html.indexOf('>', end);
      i = close < 0 ? html.length : close + 1;
      continue;
    }
    tokens.push({ kind: 'tag', name: tagName, closing, attrs });
  }
  return tokens;
}

// --- Auswertung ------------------------------------------------------------------------------------------

interface Capture {
  readonly attrs: string;
  readonly parts: string[];
}

function describeField(tag: string, attrs: string, label: string): string {
  const type = (attr(attrs, 'type') ?? (tag === 'input' ? 'text' : tag)).toLowerCase();
  const name = attr(attrs, 'name') ?? attr(attrs, 'id') ?? '(ohne Name)';
  const value = attr(attrs, 'value');
  const parts = [`${tag} ${code(name, 80)}`, `Typ ${code(type, 30)}`];
  if (value !== undefined) {
    // Versteckte Felder und Felder mit „token/csrf/key/…“ im Namen tragen oft Codes – immer kürzen (S2).
    const secret = type === 'hidden' || SECRET_FIELD.test(name);
    const shown = secret && value.length > 4 ? `${value.slice(0, 4)}…` : value;
    parts.push(`Wert ${code(shown, 60)}`);
  }
  if (hasAttr(attrs, 'required')) {
    parts.push('Pflicht');
  }
  if (hasAttr(attrs, 'checked')) {
    parts.push('angehakt');
  }
  if (label !== '') {
    parts.push(`Text ${code(label, 80)}`);
  }
  return parts.join(', ');
}

function hintAttributes(attrs: string): string[] {
  return [
    ...attrs.matchAll(/(?:^|\s)(data-[\w-]+|onclick|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ].map((h) => `${h[1]}=${code(decodeXmlText(h[2] ?? h[3] ?? ''), 120)}`);
}

/** Gesamtgrenze der Ausgabe (S1). */
function capOutput(lines: string[]): string[] {
  const max = HTML_DIAGNOSIS_LIMITS.outputChars;
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length > max) {
      const rest = max - used;
      if (rest > 200) {
        out.push(`${line.slice(0, rest)}…`);
      }
      out.push(
        `Diagnose gekürzt (Gesamtgrenze ${max / 1024} KB erreicht, ${lines.length - out.length} Zeilen weggelassen).`,
      );
      return out;
    }
    out.push(line);
    used += line.length;
  }
  return out;
}

/**
 * Strukturierte Beschreibung einer HTML-Seite als Markdown-Listenpunkte (ohne „- “).
 * @param cookieNames Namen der Cookies, die der Server gesetzt hat (keine Werte).
 */
export function describeHtmlPage(
  input: string,
  pageUrl: string,
  cookieNames: readonly string[] = [],
): string[] {
  const limit = HTML_DIAGNOSIS_LIMITS.inputBytes;
  const html = input.length > limit ? input.slice(0, limit) : input;
  const tokens = tokenize(html);

  let title: string[] | null = null;
  const titleParts: string[] = [];
  const headings: string[] = [];
  let heading: { level: string; parts: string[] } | null = null;
  let sawBody = false;
  const allText: string[] = [];
  const bodyText: string[] = [];
  const links: string[] = [];
  let link: Capture | null = null;
  const forms: { attrs: string; fields: string[] }[] = [];
  let form: { attrs: string; fields: string[] } | null = null;
  let button: Capture | null = null;
  const looseButtons: string[] = [];
  const refreshes: string[] = [];
  const dataUrls: string[] = [];
  const scriptSources: string[] = [];
  const excerpts: string[] = [];
  let inlineScripts = 0;
  const relevant = /download|location|\.xlsx|\.zip/i;

  const addText = (text: string) => {
    if (title !== null) {
      title.push(text);
      return;
    }
    allText.push(text);
    if (sawBody) {
      bodyText.push(text);
    }
    heading?.parts.push(text);
    link?.parts.push(text);
    button?.parts.push(text);
  };

  for (const token of tokens) {
    if (token.kind === 'text') {
      addText(token.text);
      continue;
    }
    if (token.kind === 'raw') {
      if (token.name === 'script') {
        const src = attr(token.attrs, 'src');
        if (src !== undefined) {
          scriptSources.push(code(resolveUrl(src, pageUrl)));
        } else if (relevant.test(token.content)) {
          inlineScripts += 1;
          const at = token.content.search(relevant);
          const from = Math.max(0, at - 100);
          excerpts.push(
            code(
              token.content.slice(from, from + HTML_DIAGNOSIS_LIMITS.scriptExcerpt),
              HTML_DIAGNOSIS_LIMITS.scriptExcerpt,
            ),
          );
        }
      } else if (token.name === 'textarea') {
        form?.fields.push(describeField('textarea', token.attrs, ''));
      }
      continue;
    }
    const { name, closing, attrs } = token;
    if (!closing) {
      for (const d of attrs.matchAll(
        /(?:^|\s)(data-[\w-]*(?:url|href|download|file)[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      )) {
        dataUrls.push(`${d[1]}=${code(decodeXmlText(d[2] ?? d[3] ?? ''), 160)}`);
      }
    }
    switch (name) {
      case 'title':
        if (closing) {
          if (title !== null) {
            titleParts.push(...title);
          }
          title = null;
        } else if (titleParts.length === 0) {
          title = [];
        }
        break;
      case 'body':
        sawBody = sawBody || !closing;
        break;
      case 'h1':
      case 'h2':
        if (closing) {
          if (heading !== null) {
            headings.push(`${heading.level} ${code(cleanText(heading.parts.join(' ')), 120)}`);
          }
          heading = null;
        } else {
          heading = { level: name, parts: [] };
        }
        break;
      case 'a':
        if (link !== null) {
          links.push(finishLink(link, pageUrl));
          link = null;
        }
        if (!closing) {
          link = { attrs, parts: [] };
        }
        break;
      case 'form':
        if (closing) {
          form = null;
        } else {
          form = { attrs, fields: [] };
          forms.push(form);
        }
        break;
      case 'input':
      case 'select':
        if (!closing) {
          form?.fields.push(describeField(name, attrs, ''));
        }
        break;
      case 'button':
        if (closing) {
          if (button !== null) {
            const label = cleanText(button.parts.join(' '));
            if (form !== null) {
              form.fields.push(describeField('button', button.attrs, label));
            } else {
              const hints = hintAttributes(button.attrs);
              looseButtons.push(
                `${code(label, 80)}${hints.length === 0 ? '' : ` (${hints.slice(0, 5).join(', ')})`}`,
              );
            }
          }
          button = null;
        } else {
          button = { attrs, parts: [] };
        }
        break;
      case 'meta':
        if ((attr(attrs, 'http-equiv') ?? '').toLowerCase() === 'refresh') {
          refreshes.push(code(attr(attrs, 'content') ?? ''));
        }
        break;
      default:
        break;
    }
  }
  if (link !== null) {
    links.push(finishLink(link, pageUrl));
  }

  const visible = cleanText((sawBody ? bodyText : allText).join(' '));
  const lines: string[] = [];
  if (input.length > limit) {
    lines.push(
      `Eingabe gekürzt auf ${limit / 1024} KB von ${input.length} Zeichen (nur der Anfang wurde ausgewertet).`,
    );
  }
  lines.push(`Titel: ${code(cleanText(titleParts.join(' ')))}`);
  lines.push(`Überschriften: ${list(headings)}`);
  lines.push(
    `Sichtbarer Text (${visible.length} Zeichen, gekürzt): ${code(visible, HTML_DIAGNOSIS_LIMITS.text)}`,
  );
  lines.push(
    `meta refresh (wird NICHT befolgt): ${refreshes.length === 0 ? 'keins' : list(refreshes)}`,
  );
  lines.push(`Links (${links.length}): ${list(links, HTML_DIAGNOSIS_LIMITS.links)}`);
  lines.push(`Formulare: ${forms.length} (werden NICHT abgeschickt)`);
  forms.slice(0, HTML_DIAGNOSIS_LIMITS.forms).forEach((f, index) => {
    lines.push(
      `Formular ${index + 1}: action ${code(resolveUrl(attr(f.attrs, 'action'), pageUrl))}, method ${code((attr(f.attrs, 'method') ?? 'get').toUpperCase(), 10)}, Felder (${f.fields.length}): ${list(f.fields, HTML_DIAGNOSIS_LIMITS.fieldsPerForm)}`,
    );
  });
  if (forms.length > HTML_DIAGNOSIS_LIMITS.forms) {
    lines.push(`… ${forms.length - HTML_DIAGNOSIS_LIMITS.forms} weitere Formulare`);
  }
  if (looseButtons.length > 0) {
    lines.push(`Knöpfe außerhalb von Formularen (${looseButtons.length}): ${list(looseButtons)}`);
  }
  if (dataUrls.length > 0) {
    lines.push(`data-Attribute mit Adressen (${dataUrls.length}): ${list(dataUrls)}`);
  }
  lines.push(
    `Skripte mit src (${scriptSources.length}, werden NICHT ausgeführt): ${scriptSources.length === 0 ? 'keine' : list(scriptSources)}`,
  );
  lines.push(
    `Inline-Skripte mit download/location/.xlsx/.zip (${inlineScripts}): ${excerpts.length === 0 ? 'keine' : list(excerpts, 5)}`,
  );
  const cookies = [...new Set(cookieNames)].map((n) => code(n, 60));
  lines.push(`Gesetzte Cookies (nur Namen): ${cookies.length === 0 ? 'keine' : list(cookies)}`);
  return capOutput(lines);
}

function finishLink(link: Capture, pageUrl: string): string {
  const extra = hasAttr(link.attrs, 'download') ? ' [download]' : '';
  return `${code(resolveUrl(attr(link.attrs, 'href'), pageUrl))} „${code(cleanText(link.parts.join(' ')), 80)}“${extra}`;
}
