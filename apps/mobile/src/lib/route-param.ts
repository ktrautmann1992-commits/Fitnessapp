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
