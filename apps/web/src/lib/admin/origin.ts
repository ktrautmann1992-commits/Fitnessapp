/**
 * Herkunftsprüfung für schreibende Aktionen im Redaktionsbereich (Login, Abmelden – später Freigeben/Speichern),
 * docs/PLAN-PHASE-2.md Abschnitt 6, Stufe A, Punkt 5: Der Browser schickt bei POST-Anfragen den Kopf `Origin`.
 * Er muss genau die eigene Adresse sein (Host der Anfrage). Fehlt er, wird abgelehnt. Schickt der Browser
 * zusätzlich `Sec-Fetch-Site`, muss es `same-origin` sein.
 */

export interface HeaderReader {
  get(name: string): string | null;
}

/** Erster Wert einer ggf. kommagetrennten Kopfzeile (z. B. X-Forwarded-Host hinter Proxys). */
function firstValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim().toLowerCase();
  return first ? first : null;
}

export function isSameOriginRequest(headers: HeaderReader): boolean {
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
  const hosts = [
    firstValue(headers.get('x-forwarded-host')),
    firstValue(headers.get('host')),
  ].filter((value): value is string => value !== null);
  return hosts.length > 0 && hosts.includes(originUrl.host.toLowerCase());
}
