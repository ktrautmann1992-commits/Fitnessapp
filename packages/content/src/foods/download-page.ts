/**
 * Download-Seite mit wechselndem Link (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b – Quelle auf blsdb.de):
 * den EINEN Download-Link aus dem HTML der festen Seite lesen und Bot-Sperren/Anmeldeseiten erkennen.
 *
 * Regeln:
 * - Gezählt werden nur Links auf DENSELBEN Host wie die Seite (HTTPS), mit genau dem Pfad aus sources.ts und nicht
 *   leerem Code-Parameter. Gleiche Links zählen einmal. 0 oder mehr als 1 Treffer → Abbruch.
 * - Eine Challenge-, Captcha- oder Anmeldeseite wird NIE umgangen (kein Lösen, kein Ausweichen) → Abbruch.
 */
import type { DownloadPageConfig } from './sources';
import { decodeXmlText } from './xlsx';

/** Fehler beim Laden der Quelle – mit Diagnose-Zeilen für die Zusammenfassung des Laufs (Markdown). */
export class SourceDownloadError extends Error {
  readonly diagnostics: readonly string[];
  /** Beschreibung der ersten Seite (Download-Seite), für einen aufklappbaren Block. */
  readonly firstPage: readonly string[];

  constructor(
    message: string,
    diagnostics: readonly string[] = [],
    firstPage: readonly string[] = [],
  ) {
    super(message);
    this.name = 'SourceDownloadError';
    this.diagnostics = diagnostics;
    this.firstPage = firstPage;
  }
}

/** Hinweis bei jeder Bot-Sperre (gleicher Wortlaut in Tests und Doku). */
export const CHALLENGE_MESSAGE =
  'Der Server zeigt eine Bot-Sperre bzw. Anmeldeseite (Challenge/Captcha/Login) statt der Datei. Diese wird bewusst NICHT umgangen. Bitte im Browser prüfen, ob der Download noch frei zugänglich ist, und Claude in einer Sitzung Bescheid geben (docs/SETUP.md Teil J).';

const CHALLENGE_URL = /pow-challenge|captcha|challenge|\/login\b|\/signin\b|\/anmeld/i;

const CHALLENGE_HTML: readonly RegExp[] = [
  /pow-challenge/i,
  /proof[\s-]of[\s-]work/i,
  /g-recaptcha|h-captcha|hcaptcha|cf-turnstile|\bcaptcha\b/i,
  /cf-chl|__cf_chl|cdn-cgi\/challenge/i,
  /<title>\s*(just a moment|attention required|access denied|anmeldung|login|sign in)/i,
  /<input\b[^>]*type\s*=\s*["']?password/i,
];

/** Grund, wenn Adresse oder Inhalt nach Bot-Sperre/Anmeldeseite aussehen; sonst null. */
export function detectChallenge(html: string, url: string): string | null {
  if (url !== '' && CHALLENGE_URL.test(safePathAndQuery(url))) {
    return `Adresse nach Weiterleitung sieht nach Sperre/Anmeldung aus (${maskUrl(url)})`;
  }
  const hit = CHALLENGE_HTML.find((pattern) => pattern.test(html));
  return hit === undefined ? null : `Seite enthält „${hit.exec(html)?.[0] ?? ''}“`;
}

function safePathAndQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Werte von Parametern kürzen (Codes nicht vollständig ins Protokoll schreiben). */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const [key, value] of [...parsed.searchParams.entries()]) {
      if (value.length > 4) {
        parsed.searchParams.set(key, `${value.slice(0, 4)}…`);
      }
    }
    return maskTokens(decodeURI(parsed.toString()));
  } catch {
    return maskTokens(url.slice(0, 200));
  }
}

/** Dateiendungen, deren Namen nicht als Code gelten (z. B. `BLS_4_0_Daten_2025_DE.xlsx` bleibt lesbar). */
const FILE_EXTENSION =
  /^\.(?:xlsx?|zip|csv|pdf|js|mjs|css|html?|json|txt|png|jpe?g|svg|gif|webp|woff2?)\b/i;

/**
 * Code-artig: nur Ziffern, oder mindestens zwei Wechsel zwischen Buchstabe und Ziffer (Hex, UUID, Token). Wörter mit
 * angehängter Zahl wie „Proteinbedarf2025“ zählen nicht (Wächter NK1).
 */
function looksLikeCode(run: string): boolean {
  if (/^[\d-]+$/.test(run)) {
    return true;
  }
  return (run.match(/[A-Za-z](?=\d)|\d(?=[A-Za-z])/g)?.length ?? 0) >= 2;
}

const SECRET_WORDS = ['token', 'csrf', 'key', 'session', 'auth', 'sig', 'nonce'];
const capitalize = (w: string) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`;

/**
 * Wert hinter einem Schlüsselwort (`token=…`, `"csrf": "…"`, `downloadToken="…"`). Das Schlüsselwort steht an einer
 * Wortgrenze (Wortanfang oder camelCase-Grenze) und endet dort (kein Kleinbuchstabe danach) – „Monkey“, „keyword“,
 * „Signatur“ zählen nicht (Wächter NK1). Zwischen Schlüsselwort und „=“/„:“ höchstens 30 Zeichen, damit die Regex
 * bei Ketten wie „tokentoken…“ linear bleibt (NS1).
 */
const SECRET_KEY_VALUE = new RegExp(
  `((?:(?<![A-Za-z])(?:${SECRET_WORDS.flatMap((w) => [w, capitalize(w), w.toUpperCase()]).join('|')})|(?<=[a-z])(?:${SECRET_WORDS.map(capitalize).join('|')}))(?![a-z])[\\w-]{0,30}["']?\\s{0,5}[:=]\\s{0,5}["']?)([^"'\\s&,;}<>…]{4})[^"'\\s&,;}<>…]+`,
  'g',
);

/**
 * Codes/Token in beliebigem Text kürzen (Protokoll, Summary, Actions-Logs; Wächter „Diagnose“ S2):
 * - Werte von Parametern (`?`, `&`, `;`, `#` … `name=`) ab 5 Zeichen → 4 Zeichen + „…“;
 * - Werte hinter Namen wie token/csrf/key/session/auth/sig/nonce (`"token":"…"`, `downloadToken="…"`);
 * - Blöcke wie `6NHL-47N5-K4S1-…` (≥ 3 Gruppen à 4 Zeichen);
 * - jede Folge aus ≥ 16 Zeichen `[A-Za-z0-9_-]` mit mindestens einer Ziffer (UUID, Hex-Code, Pfad-Segment) –
 *   außer Dateinamen vor einer bekannten Endung.
 */
export function maskTokens(text: string): string {
  return text
    .replace(/([?&;#][\w.%-]{0,40}=)([^&"'\s<>#]{4})[^&"'\s<>#]+/g, '$1$2…')
    .replace(SECRET_KEY_VALUE, '$1$2…')
    .replace(
      /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g,
      (run, offset: number, all: string) =>
        looksLikeCode(run) &&
        // Bezeichner mit „_“ (z. B. Spaltennamen wie E200_Sorbinsaeure_in_mg_100g) sind keine Codes (NK1).
        !run.includes('_') &&
        !FILE_EXTENSION.test(all.slice(offset + run.length, offset + run.length + 8))
          ? `${run.slice(0, 4)}…`
          : run,
    )
    .replace(/\b([A-Za-z0-9]{4})(?:-[A-Za-z0-9]{4}){2,}\b/g, '$1…');
}

/** Alle `href`-Ziele im HTML (Entitäten aufgelöst, relativ zur Seite aufgelöst, ungültige weggelassen). */
export function extractHrefs(html: string, pageUrl: string): string[] {
  const result: string[] = [];
  for (const match of html.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    const raw = decodeXmlText((match[1] ?? match[2] ?? match[3] ?? '').trim());
    if (raw === '' || /^(javascript|mailto|tel|data):/i.test(raw)) {
      continue;
    }
    try {
      result.push(new URL(raw, pageUrl).toString());
    } catch {
      // ungültige Adresse – ignorieren
    }
  }
  return result;
}

export interface DownloadLinkSearch {
  /** Passende Links auf demselben Host (ohne Doppelte). */
  readonly matches: string[];
  /** Links mit passendem Pfad und Parameter, aber fremdem Host oder ohne HTTPS (werden nie genutzt). */
  readonly foreign: string[];
  /** Alle Links der Seite (für die Diagnose). */
  readonly all: string[];
}

/** Pfad EXAKT wie in sources.ts (kein Präfix, kein Muster, kein angehängter Schrägstrich). */
function pathMatches(pathname: string, linkPath: string): boolean {
  return pathname === linkPath;
}

/** Sucht Download-Links nach den Regeln aus sources.ts. */
export function findDownloadLinks(
  html: string,
  pageUrl: string,
  config: DownloadPageConfig,
): DownloadLinkSearch {
  const page = new URL(pageUrl);
  const all = extractHrefs(html, pageUrl);
  const matches = new Set<string>();
  const foreign = new Set<string>();
  for (const href of all) {
    const url = new URL(href);
    const token = url.searchParams.get(config.tokenParam);
    if (!pathMatches(url.pathname, config.linkPath) || token === null || token.trim() === '') {
      continue;
    }
    if (url.protocol === 'https:' && url.host === page.host) {
      matches.add(url.toString());
    } else {
      foreign.add(url.toString());
    }
  }
  return { matches: [...matches], foreign: [...foreign], all };
}

/** Genau einen Download-Link wählen – sonst Abbruch mit Diagnose. */
export function selectDownloadLink(
  html: string,
  pageUrl: string,
  config: DownloadPageConfig,
): string {
  const search = findDownloadLinks(html, pageUrl, config);
  const wanted = `https://${new URL(pageUrl).host}${config.linkPath}?${config.tokenParam}=…`;
  const diagnostics = [
    `Gesucht: Link der Form \`${wanted}\` (gleicher Host, HTTPS).`,
    ...(search.foreign.length > 0
      ? [
          `Ignoriert (fremder Host oder kein HTTPS): ${search.foreign.map((u) => `\`${maskUrl(u)}\``).join(', ')}`,
        ]
      : []),
    `Links auf der Seite (${search.all.length}, höchstens 40): ${
      search.all
        .slice(0, 40)
        .map((u) => `\`${maskUrl(u)}\``)
        .join(', ') || '–'
    }`,
  ];
  if (search.matches.length === 1) {
    return search.matches[0] as string;
  }
  if (search.matches.length === 0) {
    throw new SourceDownloadError(
      `Kein Download-Link auf der Seite ${pageUrl} gefunden (erwartet genau einen Link ${wanted}). Die Seite hat sich vermutlich geändert, z. B. ein neuer Dateiname (neue BLS-Fassung) – dann \`linkPath\` in packages/content/src/foods/sources.ts per Gründer-PR anpassen. Claude in einer Sitzung Bescheid geben (docs/SETUP.md Teil J).`,
      diagnostics,
    );
  }
  throw new SourceDownloadError(
    `${search.matches.length} verschiedene Download-Links auf der Seite ${pageUrl} gefunden – erwartet genau einen. Es wird nicht geraten.`,
    [`Treffer: ${search.matches.map((u) => `\`${maskUrl(u)}\``).join(', ')}`, ...diagnostics],
  );
}
