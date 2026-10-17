import { z } from 'zod';

/**
 * Barcode-Nummern (Etappe E4a, docs/PLAN-E4.md 4.2): Die Person tippt die 8 oder 13 Ziffern unter dem Strichcode ein.
 * Die Prüfziffer prüft schon das Gerät (gleiche Funktion auf dem Server) – eine vertippte Nummer geht nie an Open Food
 * Facts. Laden- und Waagencodes (Frischetheke), Bücher, Zeitschriften und Gutscheine sind keine Lebensmittel-Nummern:
 * keine Abfrage (Datenschutz und OFF-Kontingent).
 *
 * Normalform (so steht die Nummer in food_products.code, food_log_entries.product_code, user_food_products.code und
 * im Favoriten-Schlüssel – CHECK in der Datenbank):
 * - EAN-8 (8 Ziffern) bleibt,
 * - UPC-A (12 Ziffern) wird mit führender 0 zu EAN-13 (GS1: gleiche Nummer, gleiche Prüfziffer),
 * - EAN-13 (13 Ziffern) bleibt,
 * - GTIN-14 (14 Ziffern): mit Indikator 0 → EAN-13 (führende 0 weg), sonst bleibt sie (Umverpackung).
 * UPC-E (6/8 Ziffern komprimiert) liefert nur die Kamera (E4b) – hier nicht.
 */

/** Gespeicherte Form: 8, 13 oder 14 Ziffern (sync: CHECK `^([0-9]{8}|[0-9]{13,14})$`). */
export const BARCODE_PATTERN = /^(\d{8}|\d{13,14})$/;

/** Höchstens so viele Zeichen werden überhaupt angesehen (Eingabe-Schutz). */
export const BARCODE_INPUT_MAX_CHARS = 64;

/**
 * Prüfziffer nach GS1 (Modulo 10) für die Ziffern OHNE Prüfziffer: von rechts abwechselnd × 3 und × 1, Summe auf den
 * nächsten Zehner ergänzen. Quelle: GS1 General Specifications, Abschnitt 7.9 „Check digit calculation“.
 */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** true = die letzte Ziffer ist die richtige GS1-Prüfziffer. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{2,}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === code.charCodeAt(code.length - 1) - 48;
}

/**
 * Präfixe ohne Lebensmittel-Bezug bzw. nur im Laden gültig (GS1-Präfix-Liste, GS1 General Specifications 1.4.x;
 * VOR LIVEGANG PRÜFEN): Laden-/Waagencodes 020–029, 040–049 und 200–299 (Restricted Circulation Numbers, z. B. Preis
 * oder Gewicht der Frischetheke), Gutscheine 050–059 und 981–984/99, Pfand-/Rückgabebelege 980, Zeitschriften 977
 * (ISSN), Bücher 978/979 (ISBN). Bei EAN-8 sind die Präfixe 0 und 2 Ladencodes (RCN-8). Plan 4.2 nennt 02, 20–29, 977,
 * 978/979, 98/99 – 04x/05x kommen aus derselben GS1-Liste dazu (vorsichtig: lieber keine Abfrage).
 */
function isNonFoodPrefix(code: string): boolean {
  if (code.length === 8) return code.startsWith('0') || code.startsWith('2');
  // GTIN-14: Präfix nach der Indikator-Ziffer.
  const gs1 = code.length === 14 ? code.slice(1) : code;
  const p3 = Number(gs1.slice(0, 3));
  if (p3 >= 20 && p3 <= 29) return true;
  if (p3 >= 40 && p3 <= 59) return true;
  if (p3 >= 200 && p3 <= 299) return true;
  if (p3 === 977 || p3 === 978 || p3 === 979) return true;
  return p3 >= 980;
}

export type BarcodeCheck =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: 'invalid' | 'not_food' };

/**
 * Eingabe → Normalform. Leerzeichen und Bindestriche werden entfernt; sonst nur Ziffern. `invalid` = falsche Länge,
 * falsche Prüfziffer, nur Nullen, Buchstaben, zu lang. `not_food` = Laden-/Waagencode, Buch, Zeitschrift, Gutschein
 * (Hinweis ohne Abfrage).
 */
export function normalizeBarcode(input: unknown): BarcodeCheck {
  if (typeof input !== 'string' || input.length > BARCODE_INPUT_MAX_CHARS) {
    return { ok: false, reason: 'invalid' };
  }
  const digits = input.replace(/[\s-]/gu, '');
  if (!/^\d+$/.test(digits) || /^0+$/.test(digits)) return { ok: false, reason: 'invalid' };
  if (![8, 12, 13, 14].includes(digits.length) || !hasValidCheckDigit(digits)) {
    return { ok: false, reason: 'invalid' };
  }
  let code = digits;
  if (code.length === 12) code = `0${code}`;
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1);
  if (/^0+$/.test(code.slice(0, -1))) return { ok: false, reason: 'invalid' };
  if (isNonFoodPrefix(code)) return { ok: false, reason: 'not_food' };
  return { ok: true, code };
}

/** Gespeicherte Nummer (Normalform, Prüfziffer gültig, kein Ladencode) – Zod für Tagebuch, Favoriten, eigene Produkte. */
export const barcodeSchema = z.string().refine((value) => {
  const check = normalizeBarcode(value);
  return BARCODE_PATTERN.test(value) && check.ok && check.code === value;
}, 'Ungültige Nummer.');

// ---------------------------------------------------------------------------------------------------------
// Kamera (Etappe E4b, docs/PLAN-E4.md 4.2 und 5): Der Scanner liefert Text + Format. Dieselbe Prüfung wie beim
// Eintippen (normalizeBarcode); nur UPC-E (komprimiert) wird vorher auf UPC-A erweitert.
// ---------------------------------------------------------------------------------------------------------

/**
 * Formate, die die App annimmt – Namen aus der Browser-Schnittstelle `BarcodeDetector` (`ean_13`, `ean_8`, `upc_a`,
 * `upc_e`, auch vom ZXing-Polyfill) und aus `expo-camera` (`ean13`, `ean8`, `upc_a`, `upc_e`). Alles andere (QR-Code,
 * Code 128 …) ist keine Lebensmittel-Nummer und wird ignoriert.
 */
export const SCANNED_BARCODE_FORMATS = ['ean13', 'ean8', 'upca', 'upce'] as const;
export type ScannedBarcodeFormat = (typeof SCANNED_BARCODE_FORMATS)[number];

/** `ean_13`, `EAN-13`, `ean13` … → `ean13`; unbekannt → null. */
export function scannedBarcodeFormat(format: unknown): ScannedBarcodeFormat | null {
  if (typeof format !== 'string' || format.length > 32) return null;
  const key = format.toLowerCase().replace(/[^a-z0-9]/gu, '');
  return (SCANNED_BARCODE_FORMATS as readonly string[]).includes(key)
    ? (key as ScannedBarcodeFormat)
    : null;
}

/**
 * UPC-E → UPC-A (12 Ziffern mit Prüfziffer). Eingabe: 6 Ziffern (Nummernsystem 0, ohne Prüfziffer), 7 (Nummernsystem
 * + 6, ohne Prüfziffer) oder 8 (Nummernsystem + 6 + Prüfziffer – die muss zur erweiterten Nummer passen). Nur
 * Nummernsystem 0 oder 1. Regel nach der letzten der sechs Ziffern (GS1 General Specifications, Abschnitt 5.2.2.4.2
 * „UPC-E“; VOR LIVEGANG PRÜFEN): 0–2 → Hersteller d1 d2 d6 0 0, Artikel 0 0 d3 d4 d5; 3 → d1 d2 d3 0 0, 0 0 0 d4 d5;
 * 4 → d1 d2 d3 d4 0, 0 0 0 0 d5; 5–9 → d1 d2 d3 d4 d5, 0 0 0 0 d6. Ungültig → null.
 */
export function expandUpcE(input: string): string | null {
  if (!/^\d{6,8}$/.test(input)) return null;
  const system = input.length === 6 ? '0' : input.charAt(0);
  if (system !== '0' && system !== '1') return null;
  const d = input.length === 6 ? input : input.slice(1, 7);
  const last = d.charAt(5);
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  } else if (last === '3') {
    body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  } else if (last === '4') {
    body = `${d.slice(0, 4)}00000${d.charAt(4)}`;
  } else {
    body = `${d.slice(0, 5)}0000${last}`;
  }
  const withoutCheck = `${system}${body}`;
  const check = gs1CheckDigit(withoutCheck);
  if (input.length === 8 && input.charCodeAt(7) - 48 !== check) return null;
  return `${withoutCheck}${check}`;
}

/**
 * Ziffern, die die App für einen Scan ins Nummernfeld schreibt (UPC-E erweitert), oder null (falsches Format, falsche
 * Länge zum Format, Buchstaben, zu lang). Die eigentliche Prüfung macht danach `normalizeBarcode`.
 */
export function scannedBarcodeDigits(raw: unknown, format: unknown): string | null {
  const kind = scannedBarcodeFormat(format);
  if (kind === null || typeof raw !== 'string' || raw.length > BARCODE_INPUT_MAX_CHARS) return null;
  const digits = raw.trim();
  if (!/^\d+$/.test(digits)) return null;
  switch (kind) {
    case 'ean8':
      return digits.length === 8 ? digits : null;
    case 'ean13':
      return digits.length === 13 ? digits : null;
    case 'upca':
      // Manche Geräte (iOS) liefern UPC-A schon als EAN-13 mit führender 0.
      return digits.length === 12 || (digits.length === 13 && digits.startsWith('0'))
        ? digits
        : null;
    case 'upce':
      if (digits.length === 12 || (digits.length === 13 && digits.startsWith('0'))) return digits;
      return expandUpcE(digits);
  }
}

/**
 * Scan → Normalform, gleiche Ergebnisse wie `normalizeBarcode` (`invalid` | `not_food` | ok). Ein Scanner meldet auch
 * Fehllesungen; die Kamera läuft bei `invalid` weiter, bei `ok` und `not_food` endet sie.
 */
export function normalizeScannedBarcode(
  raw: unknown,
  format: unknown,
): BarcodeCheck & { readonly digits: string | null } {
  const digits = scannedBarcodeDigits(raw, format);
  if (digits === null) return { ok: false, reason: 'invalid', digits: null };
  return { ...normalizeBarcode(digits), digits };
}
