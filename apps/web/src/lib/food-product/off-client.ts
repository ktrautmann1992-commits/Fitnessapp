/**
 * Abfrage bei Open Food Facts (Etappe E4a, docs/PLAN-E4.md 3.2 Nr. 9) – NUR vom Server, nie aus der App:
 * - `GET <baseUrl><productPath><Nummer>?fields=…` (Pfad und Felder: VOR LIVEGANG PRÜFEN, constants.ts OPEN_FOOD_FACTS),
 * - genau zwei Kopfzeilen: `User-Agent: Alpha5/<Version> (<Kontakt>)` und `Accept: application/json` – keine Nutzer-ID,
 *   kein Token, kein Cookie, kein X-Forwarded-For, kein Referer,
 * - Zeitlimit 6 s (auch für das Lesen des Körpers), keine Weiterleitungen (`redirect: 'error'`), Antwort höchstens
 *   512 KB (gestreamt mit Byte-Limit), nur `application/json`,
 * - HTTP 404 = nicht gefunden, 429/503 = überlastet (der Aufrufer sperrt 5 Minuten), alles andere = Fehler. Kein
 *   zweiter Versuch.
 * Die Nummer ist vorher geprüft (nur Ziffern) – sie kann die Adresse nicht verändern.
 */
import { OPEN_FOOD_FACTS, type OffFetchResult } from '@fitnessapp/core';

type FetchFn = typeof fetch;

export function offProductUrl(code: string): string {
  if (!/^\d{8,14}$/.test(code)) throw new Error('Ungültige Nummer.');
  return `${OPEN_FOOD_FACTS.baseUrl}${OPEN_FOOD_FACTS.productPath}${code}?fields=${OPEN_FOOD_FACTS.fields.join(',')}`;
}

/** Körper höchstens `limit` Bytes lesen; mehr → null (Lesen abgebrochen). */
async function readLimited(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

export function createOffClient(options: {
  userAgent: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
  maxBytes?: number;
}) {
  const fetchFn = options.fetchFn ?? fetch;
  return async function fetchOff(code: string): Promise<OffFetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? OPEN_FOOD_FACTS.timeoutMs,
    );
    try {
      let response: Response;
      try {
        response = await fetchFn(offProductUrl(code), {
          method: 'GET',
          headers: { 'User-Agent': options.userAgent, Accept: 'application/json' },
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
        });
      } catch {
        return controller.signal.aborted ? { kind: 'timeout' } : { kind: 'failed' };
      }
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return { kind: 'not_found' };
      }
      if (response.status === 429 || response.status === 503) {
        await response.body?.cancel().catch(() => undefined);
        return { kind: 'overloaded' };
      }
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !/^application\/json\b/i.test(type)) {
        await response.body?.cancel().catch(() => undefined);
        return { kind: 'failed' };
      }
      let text: string | null;
      try {
        text = await readLimited(response, options.maxBytes ?? OPEN_FOOD_FACTS.maxResponseBytes);
      } catch {
        return controller.signal.aborted ? { kind: 'timeout' } : { kind: 'failed' };
      }
      if (text === null) return { kind: 'failed' };
      try {
        return { kind: 'answer', body: JSON.parse(text) as unknown };
      } catch {
        return { kind: 'failed' };
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
