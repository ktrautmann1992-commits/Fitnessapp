/**
 * Original-Datei einer Quelle laden (docs/PLAN-PHASE-5.md 5.1 Schritt 1): nur HTTPS, Größe begrenzt, Weiterleitung
 * nur auf HTTPS. Fehler mit verständlicher Meldung (z. B. Adresse in sources.ts falsch).
 */

/** Höchstgröße der Original-Datei (BLS 4.0 ≈ 14 MB). */
export const MAX_ORIGINAL_BYTES = 200 * 1024 * 1024;

export type DownloadFetch = (
  url: string,
  init?: { redirect?: 'follow'; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** Wartezeiten vor den Wiederholungen bei Netzfehler, HTTP 429 oder 5xx (Wächter N2b, K2). */
export const DOWNLOAD_RETRY_DELAYS_MS: readonly number[] = [10_000, 30_000];

export interface DownloadOptions {
  readonly retryDelaysMs?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function downloadOriginal(
  url: string,
  fetchImpl: DownloadFetch = fetch as unknown as DownloadFetch,
  maxBytes = MAX_ORIGINAL_BYTES,
  options: DownloadOptions = {},
): Promise<Buffer> {
  if (!url.startsWith('https://')) {
    throw new Error(`Nur HTTPS-Adressen erlaubt: ${url}`);
  }
  const delays = options.retryDelaysMs ?? DOWNLOAD_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  let response: Awaited<ReturnType<DownloadFetch>> | undefined;
  for (let attempt = 0; ; attempt += 1) {
    const retryDelay = delays[attempt];
    try {
      response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) });
    } catch (error) {
      if (retryDelay !== undefined) {
        await sleep(retryDelay);
        continue;
      }
      throw new Error(`Original-Datei nicht erreichbar (${url}): ${(error as Error).message}`, {
        cause: error,
      });
    }
    const transient = response.status === 429 || response.status >= 500;
    if (!response.ok && transient && retryDelay !== undefined) {
      await sleep(retryDelay);
      continue;
    }
    break;
  }
  if (!response.ok) {
    throw new Error(
      `Original-Datei nicht geladen (${url}): HTTP ${response.status}. Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).`,
    );
  }
  if (response.url !== '' && !response.url.startsWith('https://')) {
    throw new Error(`Weiterleitung auf eine Nicht-HTTPS-Adresse: ${response.url}`);
  }
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
  if (url.toLowerCase().endsWith('.xlsx') && !isZip(buffer)) {
    throw new Error(
      `Original-Datei ist keine xlsx-Datei (${describeResponse(response, buffer)}). ` +
        'Vermutlich liefert der Server eine Webseite statt der Datei – Adresse in packages/content/src/foods/sources.ts prüfen (docs/SETUP.md Teil J).',
    );
  }
  return buffer;
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
