// @ts-check
/**
 * Liest packages/ui/theme.css und baut daraus die Design-Tokens für die App (React Native kann kein CSS lesen).
 *
 * Reines Node ohne Abhängigkeiten. Der Parser ist absichtlich klein: Er versteht genau das, was ein Farbschema
 * braucht – Regeln mit Custom Properties (--name: wert), Kommentare, @media (prefers-color-scheme: dark),
 * [data-theme='dark'|'light'] und einfache var(--…)-Verweise. Alles andere wird übersprungen.
 *
 * Regeln (siehe auch docs/DESIGN.md):
 * - Pflicht-Variablen fehlen → Fehler.
 * - Es gibt gar keinen Dunkel-Block → Fehler (die App braucht einen Dunkelmodus).
 * - Im Dunkel-Block fehlt eine einzelne Farbe → der helle Wert wird übernommen (mit Warnung).
 * - Dieselbe Variable hat in zwei Blöcken desselben Modus verschiedene Werte → Fehler
 *   (z. B. @media-dark-Block und [data-theme='dark'] widersprechen sich).
 */

/** Farb-Token (Name in der App) → CSS-Variable. Reihenfolge = Reihenfolge in tokens.generated.ts. */
export const COLOR_VARS = /** @type {const} */ ({
  background: '--color-background',
  surface: '--color-surface',
  text: '--color-text',
  textMuted: '--color-text-muted',
  primary: '--color-primary',
  primaryText: '--color-primary-text',
  border: '--color-border',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
});

/** Pixel-Werte: Gruppe → (Token → CSS-Variable). */
export const PIXEL_GROUPS = /** @type {const} */ ({
  spacing: {
    xs: '--space-xs',
    sm: '--space-sm',
    md: '--space-md',
    lg: '--space-lg',
    xl: '--space-xl',
    xxl: '--space-xxl',
  },
  radius: {
    sm: '--radius-sm',
    md: '--radius-md',
    lg: '--radius-lg',
    pill: '--radius-pill',
  },
  fontSize: {
    sm: '--font-size-sm',
    md: '--font-size-md',
    lg: '--font-size-lg',
    xl: '--font-size-xl',
    xxl: '--font-size-xxl',
  },
});

export const FONT_WEIGHT_VARS = /** @type {const} */ ({
  regular: '--font-weight-regular',
  semibold: '--font-weight-semibold',
  bold: '--font-weight-bold',
});

export const MAX_CONTENT_WIDTH_VAR = '--max-content-width';

/** Alle Pflicht-Variablen in einer Liste (für Doku und Fehlermeldungen). */
export const REQUIRED_VARS = [
  ...Object.values(COLOR_VARS),
  ...Object.values(PIXEL_GROUPS).flatMap((group) => Object.values(group)),
  ...Object.values(FONT_WEIGHT_VARS),
  MAX_CONTENT_WIDTH_VAR,
];

/** 1rem = 16px (Browser-Standard). */
const REM_IN_PX = 16;

/** Fehler im Farbschema. `problems` enthält alle gefundenen Probleme auf Deutsch. */
export class ThemeError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(
      `Das Farbschema (theme.css) hat ${problems.length} Problem(e):\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
    this.name = 'ThemeError';
    this.problems = problems;
  }
}

/**
 * Entfernt CSS-Kommentare. Kommentarzeichen innerhalb von Strings bleiben erhalten.
 * @param {string} css
 */
export function stripComments(css) {
  let out = '';
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += css[i + 1] ?? '';
        i++;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) {
        throw new ThemeError(['Ein Kommentar /* … wird nicht mit */ geschlossen.']);
      }
      out += ' ';
      i = end + 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * @typedef {{ selector: string, atRules: string[], declarations: Array<[string, string]> }} CssRule
 */

/**
 * Zerlegt CSS (ohne Kommentare) in Regeln mit ihren Deklarationen. Verschachtelte At-Regeln
 * (z. B. @media) werden in `atRules` festgehalten.
 * @param {string} css
 * @returns {CssRule[]}
 */
export function parseRules(css) {
  /** @type {CssRule[]} */
  const rules = [];
  let pos = 0;

  /**
   * Liest bis zum nächsten `;`, `{` oder `}` auf oberster Ebene (Strings und Klammern werden übersprungen).
   * @returns {{ text: string, stop: string }}
   */
  function readUntilDelimiter() {
    let text = '';
    let quote = '';
    let parens = 0;
    while (pos < css.length) {
      const ch = /** @type {string} */ (css[pos]);
      if (quote) {
        text += ch;
        if (ch === '\\') {
          text += css[pos + 1] ?? '';
          pos++;
        } else if (ch === quote) {
          quote = '';
        }
        pos++;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') parens++;
      else if (ch === ')') parens = Math.max(0, parens - 1);
      else if (parens === 0 && (ch === ';' || ch === '{' || ch === '}')) {
        pos++;
        return { text, stop: ch };
      }
      text += ch;
      pos++;
    }
    return { text, stop: '' };
  }

  /**
   * Liest den Inhalt eines Blocks bis zur schließenden Klammer.
   * @param {string | null} selector  Selektor der Regel oder null bei At-Regeln/oberster Ebene
   * @param {string[]} atRules
   * @param {boolean} topLevel
   */
  function parseBlock(selector, atRules, topLevel) {
    /** @type {Array<[string, string]>} */
    const declarations = [];
    for (;;) {
      const { text, stop } = readUntilDelimiter();
      const trimmed = text.trim();
      if (stop === '') {
        if (!topLevel) throw new ThemeError(['Eine geschweifte Klammer { wird nicht geschlossen.']);
        break;
      }
      if (stop === '{') {
        if (trimmed.startsWith('@')) {
          parseBlock(null, [...atRules, collapse(trimmed)], false);
        } else {
          parseBlock(collapse(trimmed), atRules, false);
        }
        continue;
      }
      if (trimmed) {
        const colon = trimmed.indexOf(':');
        if (selector !== null && colon > 0 && !trimmed.startsWith('@')) {
          declarations.push([trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim()]);
        }
      }
      if (stop === '}') {
        if (topLevel) throw new ThemeError(['Es gibt eine schließende Klammer } zu viel.']);
        break;
      }
    }
    if (selector !== null) rules.push({ selector, atRules, declarations });
  }

  parseBlock(null, [], true);
  return rules;
}

/** @param {string} value */
function collapse(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Teilt eine Selektor-Liste an Kommas auf oberster Ebene.
 * @param {string} selector
 */
function splitSelectors(selector) {
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Ordnet eine Regel einem Modus zu: 'light', 'dark' oder null (für die Tokens irrelevant).
 * @param {CssRule} rule
 * @returns {'light' | 'dark' | null}
 */
export function classifyRule(rule) {
  /** @type {'light' | 'dark' | null} */
  let mediaMode = null;
  for (const at of rule.atRules) {
    const lower = at.toLowerCase();
    if (lower.startsWith('@layer')) continue;
    const scheme = /prefers-color-scheme\s*:\s*(dark|light)/.exec(lower);
    if (lower.startsWith('@media') && scheme) {
      // Weitere Bedingungen (z. B. min-width) gelten nicht für die App.
      const rest = lower
        .replace(/^@media/, '')
        .replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/, '')
        .replace(/\b(only|screen|all|and)\b/g, '')
        .trim();
      if (rest) return null;
      mediaMode = /** @type {'light' | 'dark'} */ (scheme[1]);
      continue;
    }
    return null;
  }

  /** @type {'light' | 'dark' | null} */
  let mode = null;
  for (const raw of splitSelectors(rule.selector)) {
    // :not(…) entfernen, damit z. B. :root:not([data-theme='light']) als :root zählt.
    const sel = raw
      .replace(/:not\([^)]*\)/g, '')
      .replace(/["'\s]/g, '')
      .toLowerCase();
    // Erlaubt: :root, html, [data-theme=dark|light], .dark/.light – jeweils optional mit :root/html davor.
    const rest = sel.replace(/^(:root|html)/, '');
    /** @type {'light' | 'dark' | null} */
    let selMode = null;
    if (rest === '') selMode = mediaMode ?? 'light';
    else if (rest === '[data-theme=dark]' || rest === '.dark') selMode = 'dark';
    else if (rest === '[data-theme=light]' || rest === '.light') selMode = 'light';
    if (selMode && mediaMode && selMode !== mediaMode) selMode = null;
    if (selMode) mode = selMode;
  }
  return mode;
}

/**
 * @typedef {{ value: string, selector: string }} VarSource
 * @typedef {{ light: Map<string, VarSource[]>, dark: Map<string, VarSource[]> }} ThemeVariables
 */

/**
 * Sammelt alle Custom Properties (--name) je Modus.
 * @param {string} css
 * @returns {ThemeVariables}
 */
export function extractThemeVariables(css) {
  const rules = parseRules(stripComments(css));
  /** @type {ThemeVariables} */
  const result = { light: new Map(), dark: new Map() };
  for (const rule of rules) {
    const mode = classifyRule(rule);
    if (!mode) continue;
    /** @type {Map<string, string>} */
    const inRule = new Map();
    for (const [prop, value] of rule.declarations) {
      if (prop.startsWith('--')) {
        inRule.set(prop, collapse(value.replace(/!important\s*$/i, '')));
      }
    }
    const target = result[mode];
    for (const [prop, value] of inRule) {
      const list = target.get(prop) ?? [];
      list.push({ value, selector: rule.selector });
      target.set(prop, list);
    }
  }
  return result;
}

const NAMED_COLOR_HINT =
  'Farbnamen wie „red“ gehen nicht – bitte Hex (#RRGGBB), rgb() oder hsl() verwenden';

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;

/**
 * Prüft die Werte in rgb()/rgba()/hsl()/hsla() und gibt sie einheitlich formatiert zurück (oder null).
 * Erlaubt: Komma-Schreibweise mit 3 oder 4 Werten – rgb(1, 2, 3) / rgba(1, 2, 3, 0.5) –
 * und Leerzeichen-Schreibweise mit 3 Werten und optional „/ Deckkraft“ – rgb(1 2 3 / 50%).
 * Je Wert nur Zahl, Zahl% oder (nur beim Farbton von hsl) Zahl deg.
 * @param {boolean} isHsl
 * @param {string} raw
 * @returns {string | null}
 */
function normalizeColorArgs(isHsl, raw) {
  const text = raw.trim().replace(/\s+/g, ' ');
  /** @type {string[]} */
  let parts;
  /** @type {string | undefined} */
  let alpha;
  let legacy = false;
  if (text.includes(',')) {
    legacy = true;
    parts = text.split(',').map((p) => p.trim());
    if (parts.length === 4) alpha = parts.pop();
  } else {
    const [main = '', slashAlpha, ...extra] = text.split('/').map((p) => p.trim());
    if (extra.length > 0) return null;
    parts = main.split(' ').filter(Boolean);
    alpha = slashAlpha;
    if (alpha === '') return null;
  }
  if (parts.length !== 3) return null;
  const plain = new RegExp(`^${NUMBER}%?$`);
  const hue = new RegExp(`^${NUMBER}(deg)?$`);
  const valid = parts.every((part, index) => (isHsl && index === 0 ? hue : plain).test(part));
  if (!valid || (alpha !== undefined && !plain.test(alpha))) return null;
  if (legacy) return [...parts, ...(alpha !== undefined ? [alpha] : [])].join(', ');
  return parts.join(' ') + (alpha !== undefined ? ` / ${alpha}` : '');
}

/**
 * Prüft und normalisiert eine Farbe für React Native und Web.
 * Hex → #RRGGBB bzw. #RRGGBBAA (großgeschrieben); rgb()/rgba()/hsl()/hsla() werden durchgereicht.
 * @param {string} value
 * @param {string} name  Variablenname für Fehlermeldungen
 */
export function parseColor(value, name) {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
  if (hex) {
    let digits = /** @type {string} */ (hex[1]);
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('');
    return `#${digits.toUpperCase()}`;
  }
  const fn = /^(rgba?|hsla?)\(([^()]*)\)$/i.exec(v);
  if (fn) {
    const fnName = /** @type {string} */ (fn[1]).toLowerCase();
    const args = normalizeColorArgs(fnName.startsWith('hsl'), /** @type {string} */ (fn[2]));
    if (args) return `${fnName}(${args})`;
  }
  if (v.toLowerCase() === 'transparent') return 'transparent';
  if (/^[a-z]+$/i.test(v)) throw new Error(`${name}: „${v}“ – ${NAMED_COLOR_HINT}.`);
  throw new Error(`${name}: „${v}“ ist keine gültige Farbe (erlaubt: #RRGGBB, rgb(), hsl()).`);
}

/**
 * Wandelt eine Längenangabe in Pixel (Zahl) um. Erlaubt: 16px, 1rem (= 16px), 0.
 * @param {string} value
 * @param {string} name
 */
export function parsePixels(value, name) {
  const v = value.trim().toLowerCase();
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem)?$/.exec(v);
  if (!match) {
    throw new Error(`${name}: „${value}“ ist keine gültige Größe (Beispiel: 16px).`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (!unit && amount !== 0) {
    throw new Error(`${name}: „${value}“ – Einheit fehlt, bitte z. B. „${amount}px“ schreiben.`);
  }
  if (amount < 0) {
    throw new Error(`${name}: „${value}“ darf nicht negativ sein.`);
  }
  const px = unit === 'rem' ? amount * REM_IN_PX : amount;
  return Math.round(px * 100) / 100;
}

/**
 * Schriftstärke als String '100'…'900' (so erwartet React Native den Wert).
 * @param {string} value
 * @param {string} name
 */
export function parseFontWeight(value, name) {
  const v = value.trim().toLowerCase();
  if (v === 'normal') return '400';
  if (v === 'bold') return '700';
  if (/^[1-9]00$/.test(v)) return v;
  throw new Error(`${name}: „${value}“ ist keine gültige Schriftstärke (100, 200, … 900).`);
}

/**
 * Löst var(--name) bzw. var(--name, ersatz) auf. Gesucht wird erst im eigenen Modus, dann im hellen.
 * @param {string} value
 * @param {(name: string) => string | undefined} lookup
 * @param {string} name
 */
function resolveVar(value, lookup, name) {
  let current = value;
  for (let depth = 0; depth < 10; depth++) {
    const match = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(current);
    if (!match) return current;
    const next = lookup(/** @type {string} */ (match[1])) ?? match[2];
    if (next === undefined) {
      throw new Error(`${name}: Verweis auf ${match[1]}, die nirgends definiert ist.`);
    }
    current = next.trim();
  }
  throw new Error(`${name}: var()-Verweise bilden eine Schleife.`);
}

/**
 * @typedef {{
 *   colors: { light: Record<string, string>, dark: Record<string, string> },
 *   spacing: Record<string, number>,
 *   radius: Record<string, number>,
 *   fontSize: Record<string, number>,
 *   fontWeight: Record<string, string>,
 *   maxContentWidth: number,
 * }} ThemeTokens
 */

/**
 * Baut aus dem CSS die Tokens. Wirft ThemeError mit allen Problemen auf einmal.
 * @param {string} css
 * @returns {{ tokens: ThemeTokens, warnings: string[] }}
 */
export function buildTokens(css) {
  const vars = extractThemeVariables(css);
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const warnings = [];

  /** @param {'light' | 'dark'} mode @param {string} prop */
  const firstRaw = (mode, prop) => vars[mode].get(prop)?.[0]?.value;
  /** @param {'light' | 'dark'} mode */
  const lookupFor = (mode) => (/** @type {string} */ prop) =>
    (mode === 'dark' ? firstRaw('dark', prop) : undefined) ?? firstRaw('light', prop);

  /**
   * Liefert den normalisierten Wert einer Variable im Modus oder undefined, wenn sie fehlt.
   * @template T
   * @param {'light' | 'dark'} mode
   * @param {string} prop
   * @param {(value: string, name: string) => T} parse
   * @returns {T | undefined}
   */
  function read(mode, prop, parse) {
    const sources = vars[mode].get(prop);
    if (!sources) return undefined;
    /** @type {T | undefined} */
    let first;
    for (const [index, source] of sources.entries()) {
      try {
        const parsed = parse(resolveVar(source.value, lookupFor(mode), prop), prop);
        if (index === 0) first = parsed;
        else if (parsed !== first) {
          problems.push(
            `${prop} hat im ${mode === 'dark' ? 'Dunkel' : 'Hell'}-Modus zwei verschiedene Werte ` +
              `(„${sources[0]?.value}“ in ${sources[0]?.selector} und „${source.value}“ in ${source.selector}).`,
          );
        }
      } catch (error) {
        problems.push(/** @type {Error} */ (error).message);
        return undefined;
      }
    }
    return first;
  }

  /**
   * @template T
   * @param {string} prop
   * @param {(value: string, name: string) => T} parse
   * @param {T} placeholder
   */
  function required(prop, parse, placeholder) {
    if (!vars.light.has(prop)) {
      problems.push(`Pflicht-Variable ${prop} fehlt im :root-Block.`);
      return placeholder;
    }
    return read('light', prop, parse) ?? placeholder;
  }

  if (vars.dark.size === 0) {
    problems.push(
      'Kein Dunkelmodus gefunden. Bitte einen Block @media (prefers-color-scheme: dark) { :root { … } } ' +
        "oder [data-theme='dark'] { … } mit den Farb-Variablen ergänzen.",
    );
  }

  /** @type {Record<string, string>} */
  const light = {};
  /** @type {Record<string, string>} */
  const dark = {};
  for (const [token, prop] of Object.entries(COLOR_VARS)) {
    light[token] = required(prop, parseColor, '#000000');
    const darkValue = read('dark', prop, parseColor);
    if (darkValue === undefined && vars.dark.size > 0 && !vars.dark.has(prop)) {
      warnings.push(`${prop} fehlt im Dunkelmodus – der helle Wert wird übernommen.`);
    }
    dark[token] = darkValue ?? light[token];
  }

  const schemaVars = new Set(REQUIRED_VARS);
  for (const prop of vars.dark.keys()) {
    if (schemaVars.has(prop) && !prop.startsWith('--color-')) {
      warnings.push(
        `${prop} im Dunkelmodus wird ignoriert – nur Farben können sich hell/dunkel unterscheiden.`,
      );
    }
  }
  for (const prop of vars.light.keys()) {
    if (prop.startsWith('--color-') && !schemaVars.has(prop)) {
      warnings.push(
        `${prop} ist keine Schema-Variable – nur die Website kann sie nutzen, die App nicht.`,
      );
    }
  }

  /** @param {Record<string, string>} group */
  const pixelGroup = (group) =>
    Object.fromEntries(
      Object.entries(group).map(([token, prop]) => [token, required(prop, parsePixels, 0)]),
    );

  /** @type {ThemeTokens} */
  const tokens = {
    colors: { light, dark },
    spacing: pixelGroup(PIXEL_GROUPS.spacing),
    radius: pixelGroup(PIXEL_GROUPS.radius),
    fontSize: pixelGroup(PIXEL_GROUPS.fontSize),
    fontWeight: Object.fromEntries(
      Object.entries(FONT_WEIGHT_VARS).map(([token, prop]) => [
        token,
        required(prop, parseFontWeight, '400'),
      ]),
    ),
    maxContentWidth: required(MAX_CONTENT_WIDTH_VAR, parsePixels, 0),
  };

  if (problems.length > 0) throw new ThemeError(problems);
  return { tokens, warnings };
}

/**
 * Erzeugt den Inhalt von src/tokens.generated.ts.
 * @param {ThemeTokens} tokens
 */
export function renderTokensModule(tokens) {
  /** @param {Record<string, string | number>} obj @param {string} indent */
  const body = (obj, indent) =>
    Object.entries(obj)
      .map(
        ([key, value]) => `${indent}${key}: ${typeof value === 'number' ? value : `'${value}'`},`,
      )
      .join('\n');

  return `/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Quelle: packages/ui/theme.css (einzige Quelle für Farben, Abstände und Schrift).
 * Neu erzeugen: pnpm --filter @fitnessapp/ui tokens
 * Anleitung: docs/DESIGN.md
 */

export const colors = {
  light: {
${body(tokens.colors.light, '    ')}
  },
  dark: {
${body(tokens.colors.dark, '    ')}
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];

/** Abstände in Pixeln. */
export const spacing = {
${body(tokens.spacing, '  ')}
} as const;

/** Ecken-Rundung in Pixeln. */
export const radius = {
${body(tokens.radius, '  ')}
} as const;

/** Schriftgrößen in Pixeln. */
export const fontSize = {
${body(tokens.fontSize, '  ')}
} as const;

/** Schriftstärken (als Text, so erwartet es React Native). */
export const fontWeight = {
${body(tokens.fontWeight, '  ')}
} as const;

/** Maximale Inhaltsbreite in Pixeln, damit die Web-Version auf Tablets/Desktop nicht zu breit wird. */
export const maxContentWidth = ${tokens.maxContentWidth};
`;
}
