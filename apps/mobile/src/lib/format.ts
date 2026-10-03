/**
 * Reine Hilfsfunktionen für Eingabe und Anzeige (ohne React Native, daher mit Vitest testbar).
 * Keine Fachlogik – Grenzen und Regeln kommen aus packages/core.
 */

/** Heutiges Datum (Gerätezeit) als ISO-Datum JJJJ-MM-TT. */
export function todayIso(now: Date = new Date()): string {
  return [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Drei Eingabefelder (TT, MM, JJJJ) → ISO-Datum; null, wenn etwas fehlt oder keine Ziffern sind. */
export function isoFromDateParts(day: string, month: string, year: string): string | null {
  const d = day.trim();
  const m = month.trim();
  const y = year.trim();
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) {
    return null;
  }
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** ISO-Datum → Felder für die Eingabe (TT, MM, JJJJ). */
export function datePartsFromIso(iso: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) {
    return { day: '', month: '', year: '' };
  }
  return { day: match[3] ?? '', month: match[2] ?? '', year: match[1] ?? '' };
}

/** ISO-Datum (oder Zeitstempel) → „03.10.2026“. */
export function formatDateDe(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    return iso;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Zeitstempel → Datum in Gerätezeit, z. B. „03.10.2026“. */
export function formatTimestampDe(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return formatDateDe(todayIso(date));
}

/**
 * Zahl aus einem Textfeld (deutsches Komma oder Punkt). Leer → null (= nicht angegeben).
 * Ungültige Eingaben ergeben NaN – die Zod-Schemas aus packages/core melden dann „bitte eine Zahl eingeben“.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '');
  if (trimmed === '') {
    return null;
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }
  return Number(normalized);
}

/** Zahl für ein Textfeld (deutsches Komma), null/undefined → leer. */
export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return String(value).replace('.', ',');
}

/** Gewicht in kg zur Anzeige, z. B. 1.25 → „1,25“. */
export function formatKg(value: number): string {
  return formatDecimal(value);
}
