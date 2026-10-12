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

  constructor(message: string, diagnostics: readonly string[] = []) {
    super(message);
    this.name = 'SourceDownloadError';
    this.diagnostics = diagnostics;
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
    return decodeURI(parsed.toString());
  } catch {
    return url.slice(0, 200);
  }
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

function pathMatches(pathname: string, linkPath: string): boolean {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  return trim(pathname) === trim(linkPath);
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
      `Kein Download-Link auf der Seite ${pageUrl} gefunden (erwartet genau einen Link ${wanted}). Die Seite hat sich vermutlich geändert – Claude in einer Sitzung Bescheid geben (docs/SETUP.md Teil J).`,
      diagnostics,
    );
  }
  throw new SourceDownloadError(
    `${search.matches.length} verschiedene Download-Links auf der Seite ${pageUrl} gefunden – erwartet genau einen. Es wird nicht geraten.`,
    [`Treffer: ${search.matches.map((u) => `\`${maskUrl(u)}\``).join(', ')}`, ...diagnostics],
  );
}
