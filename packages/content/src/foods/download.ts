/**
 * Original-Datei einer Quelle laden (docs/PLAN-PHASE-5.md 5.1 Schritt 1, Umsetzungsstand N2b): nur HTTPS, Größe
 * begrenzt, Weiterleitung nur auf HTTPS; bei einer Download-Seite (`downloadPage` in sources.ts) erst die Seite,
 * dann den einen Link daraus – nacheinander, nie parallel, mit User-Agent des Projekts. Bot-Sperren werden nicht
 * umgangen. Fehler mit verständlicher Meldung (z. B. Adresse in sources.ts falsch).
 */

import {
  CHALLENGE_MESSAGE,
  detectChallenge,
  maskUrl,
  selectDownloadLink,
  SourceDownloadError,
} from './download-page';
import { printableStart, type UnpackedOriginal, unpackOriginal } from './original-format';
import type { SourceDefinition } from './sources';

/** Höchstgröße der Original-Datei (BLS 4.0 ≈ 14 MB). */
export const MAX_ORIGINAL_BYTES = 200 * 1024 * 1024;

/** Höchstgröße einer Download-Seite (HTML). */
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Höflich abrufen: Projektname und Repository im User-Agent, damit der Herausgeber weiß, wer lädt. Nur eine
 * Anfrage zur Zeit (Seite, danach Datei), Wiederholungen nur mit Wartezeit (`DOWNLOAD_RETRY_DELAYS_MS`).
 */
export const USER_AGENT =
  'Alpha5-Fitnessapp-Naehrwertimport/1.0 (+https://github.com/ktrautmann1992-commits/Fitnessapp; Workflow foods-import/sources-integrity)';

export interface DownloadResponse {
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null; getSetCookie?(): string[] };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type DownloadFetch = (
  url: string,
  init?: { redirect?: 'follow'; signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<DownloadResponse>;

/** Wartezeiten vor den Wiederholungen bei Netzfehler, HTTP 429 oder 5xx (Wächter N2b, K2). */
export const DOWNLOAD_RETRY_DELAYS_MS: readonly number[] = [10_000, 30_000];

export interface DownloadOptions {
  readonly retryDelaysMs?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Eine Anfrage mit Wiederholungen (Netzfehler, 429, 5xx; nie 404). Wirft nur bei Netzfehlern. */
async function fetchWithRetry(
  url: string,
  fetchImpl: DownloadFetch,
  options: DownloadOptions,
  headers: Record<string, string>,
): Promise<DownloadResponse> {
  const delays = options.retryDelaysMs ?? DOWNLOAD_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt += 1) {
    const retryDelay = delays[attempt];
    let response: DownloadResponse;
    try {
      response = await fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(300_000),
        headers: { 'User-Agent': USER_AGENT, ...headers },
      });
    } catch (error) {
      if (retryDelay !== undefined) {
        await sleep(retryDelay);
        continue;
      }
      throw new Error(
        `Original-Datei nicht erreichbar (${maskUrl(url)}): ${(error as Error).message}`,
        {
          cause: error,
        },
      );
    }
    const transient = response.status === 429 || response.status >= 500;
    if (!response.ok && transient && retryDelay !== undefined) {
      await sleep(retryDelay);
      continue;
    }
    return response;
  }
}

async function readBody(response: DownloadResponse, maxBytes: number): Promise<Buffer> {
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > maxBytes) {
    throw new Error(`Original-Datei zu groß (${length} Bytes).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`Original-Datei zu groß (${buffer.length} Bytes).`);
  }
  if (buffer.length === 0) {
    throw new Error('Original-Datei ist leer.');
  }
  return buffer;
}

export async function downloadOriginal(
  url: string,
  fetchImpl: DownloadFetch = fetch as unknown as DownloadFetch,
  maxBytes = MAX_ORIGINAL_BYTES,
  options: DownloadOptions = {},
): Promise<Buffer> {
  if (!url.startsWith('https://')) {
    throw new Error(`Nur HTTPS-Adressen erlaubt: ${url}`);
  }
  const response = await fetchWithRetry(url, fetchImpl, options, {});
  if (!response.ok) {
    throw new Error(
      `Original-Datei nicht geladen (${url}): HTTP ${response.status}. Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).`,
    );
  }
  if (response.url !== '' && !response.url.startsWith('https://')) {
    throw new Error(`Weiterleitung auf eine Nicht-HTTPS-Adresse: ${response.url}`);
  }
  const buffer = await readBody(response, maxBytes);
  if (url.toLowerCase().endsWith('.xlsx') && !isZip(buffer)) {
    throw new Error(
      `Original-Datei ist keine xlsx-Datei (${describeResponse(response, buffer)}). ` +
        'Vermutlich liefert der Server eine Webseite statt der Datei – Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).',
    );
  }
  return buffer;
}

/** Ergebnis von `fetchSourceOriginal`. */
export interface FetchedOriginal extends UnpackedOriginal {
  /** Tatsächlich geladene Adresse (Codes gekürzt) – nur fürs Protokoll, nie für die Prüfung. */
  readonly downloadUrl: string;
}

function hostOf(url: string): string {
  return new URL(url).host;
}

/** Cookies, die die Seite gesetzt hat (nur Name=Wert), für die Folge-Anfrage auf denselben Host – wie ein Browser. */
function cookieHeader(response: DownloadResponse): string | null {
  const raw =
    response.headers.getSetCookie?.() ??
    (response.headers.get('set-cookie') ?? '').split(/,(?=\s*[^;,=\s]+=)/).filter(Boolean);
  const pairs = raw
    .map((cookie) => cookie.split(';', 1)[0]?.trim() ?? '')
    .filter((pair) => /^[^=\s]+=/.test(pair));
  return pairs.length === 0 ? null : pairs.join('; ');
}

/**
 * Original-Datei einer Quelle laden (Allowlist-Eintrag, für foods-import UND sources-integrity):
 * - `downloadPage === null`: `url` ist die Datei selbst.
 * - sonst: Seite `url` laden (gleicher Host nach Weiterleitung, keine Challenge), genau EINEN Download-Link
 *   auslesen (`download-page.ts`), Datei laden (Weiterleitung nur auf HTTPS und den Host der Seite bzw.
 *   `redirectHosts`). Danach Format erkennen (`original-format.ts`).
 * Fehler als `SourceDownloadError` mit Diagnose für die Zusammenfassung.
 */
export async function fetchSourceOriginal(
  def: Pick<SourceDefinition, 'url' | 'format' | 'originalFilename'> & {
    readonly downloadPage?: SourceDefinition['downloadPage'] | undefined;
  },
  fetchImpl: DownloadFetch = fetch as unknown as DownloadFetch,
  options: DownloadOptions & { readonly maxBytes?: number } = {},
): Promise<FetchedOriginal> {
  const maxBytes = options.maxBytes ?? MAX_ORIGINAL_BYTES;
  if (!def.url.startsWith('https://')) {
    throw new SourceDownloadError(`Nur HTTPS-Adressen erlaubt: ${def.url}`);
  }
  const page = def.downloadPage ?? null;
  const pageHost = hostOf(def.url);
  let fileUrl = def.url;
  const headers: Record<string, string> = {};
  const details: string[] = [];

  if (page !== null) {
    const response = await fetchWithRetry(def.url, fetchImpl, options, {
      Accept: 'text/html,application/xhtml+xml',
    });
    const finalUrl = response.url || def.url;
    const body = await readBody(response, MAX_PAGE_BYTES).catch((error: Error) => {
      throw new SourceDownloadError(`Download-Seite ${def.url}: ${error.message}`);
    });
    const html = body.toString('utf8');
    const info = `HTTP ${response.status}, Typ ${response.headers.get('content-type') ?? 'unbekannt'}, ${body.length} Bytes, Adresse ${maskUrl(finalUrl)}`;
    const challenge = detectChallenge(html, finalUrl);
    if (challenge !== null) {
      throw new SourceDownloadError(`${CHALLENGE_MESSAGE} (${challenge})`, [
        `Download-Seite: ${info}`,
        `Anfang „${printableStart(body)}“`,
      ]);
    }
    if (!response.ok) {
      throw new SourceDownloadError(
        `Download-Seite ${def.url} nicht geladen: HTTP ${response.status}. Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).`,
        [`Download-Seite: ${info}`],
      );
    }
    if (!finalUrl.startsWith('https://') || hostOf(finalUrl) !== pageHost) {
      throw new SourceDownloadError(
        `Download-Seite leitet auf eine fremde Adresse weiter (${maskUrl(finalUrl)}) – erwartet https://${pageHost}.`,
        [`Download-Seite: ${info}`],
      );
    }
    fileUrl = selectDownloadLink(html, def.url, page);
    details.push(`Download-Seite: ${info}`, `Download-Link aus der Seite: \`${maskUrl(fileUrl)}\``);
    headers.Referer = def.url;
    const cookies = cookieHeader(response);
    if (cookies !== null) {
      headers.Cookie = cookies;
    }
  }

  const response = await fetchWithRetry(fileUrl, fetchImpl, options, headers);
  const finalUrl = response.url || fileUrl;
  const allowedHosts = new Set([pageHost, ...(page?.redirectHosts ?? [])]);
  if (!finalUrl.startsWith('https://')) {
    throw new SourceDownloadError(
      `Weiterleitung auf eine Nicht-HTTPS-Adresse: ${maskUrl(finalUrl)}`,
    );
  }
  if (page !== null && !allowedHosts.has(hostOf(finalUrl))) {
    throw new SourceDownloadError(
      `Download leitet auf den fremden Host ${hostOf(finalUrl)} weiter – erlaubt: ${[...allowedHosts].join(', ')} (sources.ts \`redirectHosts\`, nur nach Prüfung per Gründer-PR).`,
    );
  }
  if (!response.ok) {
    throw new SourceDownloadError(
      `Original-Datei nicht geladen (${maskUrl(fileUrl)}): HTTP ${response.status}. Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).`,
      [
        `Antwort: HTTP ${response.status}, Typ ${response.headers.get('content-type') ?? 'unbekannt'}`,
      ],
    );
  }
  const buffer = await readBody(response, maxBytes).catch((error: Error) => {
    throw new SourceDownloadError(error.message);
  });
  const unpacked = unpackOriginal(buffer, def, {
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'),
    finalUrl,
  });
  return {
    ...unpacked,
    details: [...details, ...unpacked.details],
    downloadUrl: maskUrl(fileUrl),
  };
}

/** xlsx ist ein ZIP-Archiv: beginnt mit „PK\x03\x04“. */
export function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/** Kurzbeschreibung der Antwort für die Fehlermeldung (keine Geheimnisse, nur öffentliche Server-Antwort). */
export function describeResponse(
  response: { status: number; url: string; headers: { get(name: string): string | null } },
  buffer: Buffer,
): string {
  const start = buffer
    .subarray(0, 160)
    .toString('utf8')
    .replace(/[^\x20-\x7E\u00C0-\u017F]+/g, ' ')
    .trim();
  return [
    `HTTP ${response.status}`,
    `Typ ${response.headers.get('content-type') ?? 'unbekannt'}`,
    `${buffer.length} Bytes`,
    response.url !== '' ? `Adresse nach Weiterleitung ${response.url}` : null,
    `Anfang „${start}“`,
  ]
    .filter(Boolean)
    .join(', ');
}
