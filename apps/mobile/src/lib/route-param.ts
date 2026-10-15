/**
 * Pfad-Parameter sicher dekodieren: kaputte Prozent-Folgen (z. B. „%“) werfen bei decodeURIComponent einen URIError –
 * dann leerer Text (= unbekannte ID, die Seite zeigt „gibt es nicht (mehr)“) statt eines Absturzes.
 */
export function decodeRouteParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

/** Datums-Parameter (JJJJ-MM-TT, gültiger Kalendertag) – sonst null (Etappe A1b: „+ Einheit“, Nachtragen). */
export function isoDateParam(value: string | string[] | undefined): string | null {
  const raw = decodeRouteParam(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : null;
}
