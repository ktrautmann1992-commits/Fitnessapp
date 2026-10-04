/**
 * Herkunftsprüfung für schreibende Aktionen im Redaktionsbereich (Login, Abmelden – später Freigeben/Speichern),
 * docs/PLAN-PHASE-2.md Abschnitt 6, Stufe A, Punkt 5: Der Browser schickt bei POST-Anfragen den Kopf `Origin`.
 * Er muss genau die eigene Adresse sein (Kopf `Host` der Anfrage). Fehlt er, wird abgelehnt. Schickt der Browser
 * zusätzlich `Sec-Fetch-Site`, muss es `same-origin` sein.
 */

export interface HeaderReader {
  get(name: string): string | null;
}

/** Host aus dem Kopf `Host` (klein geschrieben, ohne Leerzeichen). */
function hostHeader(headers: HeaderReader): string | null {
  const value = headers.get('host')?.trim().toLowerCase();
  return value ? value : null;
}

/**
 * Herkunft prüfen. `X-Forwarded-Host` wird NICHT vertraut (ein Angreifer könnte ihn setzen); maßgeblich ist der
 * Kopf `Host`, über den Vercel die Anfrage überhaupt erst diesem Projekt zuordnet.
 * `allowedOrigins` (optional): Origin muss zusätzlich in dieser Liste stehen (z. B. Produktions- und
 * Vorschau-Adresse). Lokale Adressen (localhost/127.0.0.1) gelten nur, wenn auch `Host` lokal ist.
 */
export function isSameOriginRequest(
  headers: HeaderReader,
  allowedOrigins?: readonly string[],
): boolean {
  const origin = headers.get('origin');
  if (!origin || origin === 'null') {
    return false;
  }
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
    return false;
  }
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return false;
  }
  const host = hostHeader(headers);
  if (host === null || host !== originUrl.host.toLowerCase()) {
    return false;
  }
  if (allowedOrigins === undefined) {
    return true;
  }
  const isLocal = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
  return isLocal || allowedOrigins.includes(originUrl.origin);
}
